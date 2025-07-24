import type { ParsedMarkdownFile } from "../../types";
import { 
  buildFM, 
  serializeFrontmatter, 
  CLASS_META_DEFS, 
  unifiedToolProfs, 
  unifiedWeaponProfs, 
  SkillOption,
  unifiedSkills 
} from "./helpers/frontmatter";
import { renderMarkdownTable } from "./helpers/markdownTable";
import { replace5eTags } from "./helpers/tagReplacer";
import { formatEntry } from "./helpers/formatEntry";

function formatFeatureLink(name: string): string {
    const ignore = ["Ability Score Improvement", "Archetype Feature", "Subclass Feature"];
    if (ignore.some(sub => name.toLowerCase().includes(sub.toLowerCase()))) {
      return name;
    }
  
    const anchor = name
      .replace(/[^\w\s]/g, "")           // remove punctuation (keep spaces)
      .replace(/-/g, " ")                // remove dashes
      .replace(/\s+/g, " ")              // normalize whitespace
      .trim()
      .replace(/\b\w/g, l => l.toUpperCase()); // capitalize words
  
    return `[[#${anchor}]]`;
  }
  
export const OPT_FEATURE_TYPE_TO_FULL: Record<string,string> = {
  AI:   "Artificer Infusion",
  ED:   "Elemental Discipline",
  EI:   "Eldritch Invocation",
  MM:   "Metamagic",
  MV:   "Maneuver",
  "MV:B":    "Maneuver, Battle Master",
  "MV:C2-UA":"Maneuver, Cavalier V2 (UA)",
  "AS:V1-UA":"Arcane Shot, V1 (UA)",
  "AS:V2-UA":"Arcane Shot, V2 (UA)",
  AS:   "Arcane Shot",
  OTH:  "Other",
  "FS:F":"Fighting Style; Fighter",
  "FS:B":"Fighting Style; Bard",
  "FS:P":"Fighting Style; Paladin",
  "FS:R":"Fighting Style; Ranger",
  PB:   "Pact Boon",
  OR:   "Onomancy Resonant",
  RN:   "Rune Knight Rune",
  AF:   "Alchemical Formula",
  TT:   "Traveler's Trick",
};
  
  function renderEntries(entries: any[]): string {
    return entries.map((entry) => {
      if (typeof entry === "string") {
        return replace5eTags(entry);
      }
  
      if (typeof entry === "object") {
        if (entry.type === "refClassFeature") {
          const [name] = entry.classFeature.split("|");
          return `*See feature: **${name}***`;
        }
  
        if (entry.type === "entries" && entry.name) {
          const inner = renderEntries(entry.entries || []);
          return `**${entry.name}**\n\n${inner}`;
        }
  
        if (entry.type === "inset" && entry.name) {
          const inner = renderEntries(entry.entries || []);
          return `> **${entry.name}**\n>\n> ${inner.split("\n").join("\n> ")}`;
        }
  
        // fallback
        if (Array.isArray(entry.entries)) {
          return renderEntries(entry.entries);
        }
      }
  
      return "";
    }).filter(Boolean).join("\n");
  }
  
export function parseClassFile(
  json: any,
  editionId: string,
  fileName: string,
  optionalFeatures: any[]
): ParsedMarkdownFile[] {
  // make editionId available for frontmatter
  (json as any)._editionId = editionId;

  // unwrap the real class record
  const cls = Array.isArray(json.class) ? json.class[0] : json;
  // derive the Markdown filename
  const className =
    typeof cls.name === "string"
      ? cls.name
      : fileName
      ? fileName.replace(/^class-/, "").replace(/\.json$/, "")
      : "Unknown";

  const subclassFiles: ParsedMarkdownFile[] = [];

  const PROF_BONUS_BY_LEVEL = [
    "+2", "+2", "+2", "+2",
    "+3", "+3", "+3", "+3",
    "+4", "+4", "+4", "+4",
    "+5", "+5", "+5", "+5",
    "+6", "+6", "+6", "+6"
  ];
  
  // normalize hit‐dice
  const hdNum   = cls.hd?.number ?? 1;
  const hdFaces = cls.hd?.faces  ?? 6;
  const hdStr   = `${hdNum}d${hdFaces}`;
  const hdMax   = hdNum * hdFaces;
  const hdAvg   = Math.ceil((hdFaces + 1) / 2);

  // build & override frontmatter
  const baseFM = buildFM(cls, CLASS_META_DEFS);
  const fm     = { ...baseFM, hd: hdStr };
  const yaml   = serializeFrontmatter(fm, CLASS_META_DEFS);

  const lines: string[] = [];

  // ─── Title & Source ───
lines.push(`# ${className}`);
if (cls.source) lines.push(`**Source:** ${cls.source}`);
lines.push(``);
lines.push(`---`);

  // ─── Hit Points ───
  lines.push(`## Hit Points`);
  lines.push(`**Hit Dice:** ${hdStr} per ${className} level`);
  lines.push(`**Hit Points at 1st Level:** ${hdMax} + your Constitution modifier`);
  lines.push(
    `**Hit Points at Higher Levels:** ${hdStr} (or ${hdAvg}) + your Constitution modifier per level after 1st`
  );

// ─── Proficiencies ───
lines.push(``);
lines.push(`---`);
lines.push(`## Proficiencies`);

const sp = cls.startingProficiencies ?? {};

// Armor
if (Array.isArray(sp.armor) && sp.armor.length) {
  lines.push(`- **Armor:** ${sp.armor.join(", ")}`);
}

// Weapons
const weaponList = unifiedWeaponProfs(sp);
if (weaponList.length) {
  lines.push(`- **Weapons:** ${weaponList.join(", ")}`);
}

// Tools
const toolList = unifiedToolProfs(sp);
if (toolList.length) {
  lines.push(`- **Tools:** ${toolList.join(", ")}`);
}

// Saving Throws
const saves = Array.isArray(cls.proficiency)
  ? cls.proficiency.map((k: string) =>
      ({ str:"Strength", dex:"Dexterity", con:"Constitution",
         int:"Intelligence", wis:"Wisdom", cha:"Charisma" }[k] || k.toUpperCase())
    )
  : [];
if (saves.length) {
  lines.push(`- **Saving Throws:** ${saves.join(", ")}`);
}

// Skills
const skillList = unifiedSkills(sp);
if (skillList.length) {
  lines.push(`- **Skills:** ${skillList.join(", ")}`);
}


  // ─── Equipment ───
  if (Array.isArray(cls.startingEquipment)) {
    lines.push(`\n### Equipment`);
    cls.startingEquipment
      .filter((e: any) => typeof e === "string")
      .forEach((item: string) => lines.push(`- ${item}`));
  }

// ─── Class Progression ───
const progGroups = cls.classTableGroups ?? [];
const maxLevel = 20;

if (!progGroups.length) {
  lines.push(`*(No class table provided for this class.)*`);
} else {
  // 1) Build level → feature map
  const featuresByLevel: Record<number, string[]> = {};
  for (const feat of cls.classFeatures ?? []) {
    const raw = typeof feat === "object" && feat.classFeature ? feat.classFeature : String(feat);
    const [name,, ,lvlStr] = raw.split("|");
    const lvl = Number(lvlStr ?? 0);
    if (!featuresByLevel[lvl]) featuresByLevel[lvl] = [];
    featuresByLevel[lvl].push(name);
  }

  // 2) Gather every column label & row value
  const allLabelsSet = new Set<string>();
  const rowMaps: Record<number, Record<string, string>> = {};

  for (const group of progGroups) {
    const labels = Array.isArray(group.colLabels)
      ? group.colLabels.map((l: string) => replace5eTags(l))
      : [];
    const rows = Array.isArray(group.rows)
      ? group.rows
      : Array.isArray(group.rowsSpellProgression)
        ? group.rowsSpellProgression
        : [];

    if (!labels.length || !rows.length) continue;

    for (let lvl = 0; lvl < rows.length; lvl++) {
      const levelNum = lvl + 1;
      if (!rowMaps[levelNum]) rowMaps[levelNum] = {};
      const rowMap = rowMaps[levelNum];
      const cells = rows[lvl];

      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        let val = "";
        const cell = cells[i];

        if (Array.isArray(cell)) {
          val = cell.join(", ");
        } else if (cell && typeof cell === "object" && "value" in cell) {
          val = String(cell.value);
        } else {
          val = String(cell ?? "");
        }

        allLabelsSet.add(label);
        rowMap[label] = val;
      }
    }
  }

  // 3) **Filter out** any spell‐table columns
  const allLabels = Array.from(allLabelsSet).filter(lbl =>
    !/Cantrips Known|Spells Known|\d+(st|nd|rd|th)/.test(lbl)
  );

  // 4) Build final header & rows
  const mergedLabels = ["Level", "Proficiency Bonus", "Class Features", ...allLabels];
  const mergedRows: string[][] = [];

  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const featureList = (featuresByLevel[lvl] ?? []).map(formatFeatureLink);
    const rowMap = rowMaps[lvl] ?? {};

    mergedRows.push([
      lvl.toString(),
      PROF_BONUS_BY_LEVEL[lvl - 1] || "",
      featureList.join(", ").replace(/\|/g, "&#124;"),
      ...allLabels.map(label => rowMap[label] ?? "")
    ]);
  }

  // 5) Render the features‐only table
lines.push(`\n> [!example]- Class Progression Table`);
lines.push(
  renderMarkdownTable({
    type:      "table",
    caption:   "",
    colLabels: mergedLabels,
    rows:      mergedRows,
  }));
}

// ─── Spell Progression ───
// 1) find the two groups
const csGroup = progGroups.find((g: any) =>
  Array.isArray(g.colLabels) &&
  g.colLabels.some((lbl: any) => /Cantrips Known|Spells Known/.test(String(lbl)))
);
const slotGroup = progGroups.find((g: any) =>
  Array.isArray(g.colLabels) &&
  g.title === "Spell Slots per Spell Level"
);

if (csGroup && slotGroup) {
  // 2) raw labels
  const csLabels   = (csGroup.colLabels as string[]).map(l => replace5eTags(l));
  const slotLabels = (slotGroup.colLabels as string[]).map(l => replace5eTags(l));

  // 3) raw rows
  const csRows   = (csGroup.rows      as any[][])              || [];
  const slotRows = (slotGroup.rowsSpellProgression as any[][]) || [];

  // 4) build header: Level + cantrips/spells + each slot level
  const colLabels = ["Level", ...csLabels, ...slotLabels];

  // 5) build each row by zipping csRows[i] + slotRows[i]
  const spellRows: string[][] = [];
  for (let i = 0; i < Math.max(csRows.length, slotRows.length); i++) {
    const lvl = String(i + 1);
    const csCells   = csRows[i]   ? csRows[i].map(String)   : csLabels.map(_ => "");
    const slotCells = slotRows[i] ? slotRows[i].map(String) : slotLabels.map(_ => "");
    spellRows.push([lvl, ...csCells, ...slotCells]);
  }

  // 6) render!
  lines.push(`\n> [!tip]- Spell Progression Table`);
  lines.push(
    renderMarkdownTable({
      type:      "table",
      caption:   "",
      colLabels: colLabels,
      rows:      spellRows,
  }));
}


  // ─── Subclasses ───
const subs = Array.isArray(json.subclass) ? json.subclass : [];
const subclassFeatures = Array.isArray(json.subclassFeature)
  ? json.subclassFeature
  : json.lookup?.subclassFeature ?? [];

for (const sc of subs) {
  const subclassName = sc.name;
  const subLines: string[] = [];

  // Intro entry (level 3 feature description)
  const introEntry = subclassFeatures.find((f: any) =>
    f.name === sc.name &&
    f.level === 3 &&
    f.subclassShortName === sc.shortName &&
    f.subclassSource === sc.source
  );
  if (introEntry?.entries?.length) {
    subLines.push(formatEntry(introEntry.entries));
  }

  // Gather features by level
  const featuresByLevel: Record<number, any[]> = {};
  for (const feat of subclassFeatures) {
    if (
      feat.subclassShortName === sc.shortName &&
      feat.subclassSource === sc.source &&
      feat.className === className
    ) {
      const lvl = feat.level ?? 0;
      if (!featuresByLevel[lvl]) featuresByLevel[lvl] = [];
      featuresByLevel[lvl].push(feat);
    }
  }

  // Header metadata
  subLines.push(`# ${subclassName}`);
  subLines.push(`**Parent Class:** [[${className}]]`);
  if (sc.source) subLines.push(`**Source:** ${sc.source}`);

  // Optional subclass progression table
  const progGroups = sc.subclassTableGroups ?? [];
  if (progGroups.length) {
    const allLabelsSet = new Set<string>();
    const rowMaps: Record<number, Record<string, string>> = {};

    for (const group of progGroups) {
      const labels = (group.colLabels ?? []).map(replace5eTags);
      const rows = Array.isArray(group.rows)
        ? group.rows
        : Array.isArray(group.rowsSpellProgression)
          ? group.rowsSpellProgression
          : [];

      for (let i = 0; i < rows.length; i++) {
        if (!rowMaps[i+1]) rowMaps[i+1] = {};
        rows[i].forEach((cell: any, j: number) => {
          const label = labels[j];
          if (!label) return;
          allLabelsSet.add(label);
          rowMaps[i+1][label] = typeof cell === "object" && cell !== null && "value" in cell
            ? String(cell.value)
            : String(cell ?? "");
        });
      }
    }

    const allLabels = Array.from(allLabelsSet);
    const mergedLabels = ["Level", ...allLabels];
    const mergedRows: string[][] = [];

    for (let lvl = 1; lvl <= 20; lvl++) {
      const row = rowMaps[lvl] ?? {};
      mergedRows.push([String(lvl), ...allLabels.map(label => row[label] ?? "")]);
    }

    subLines.push(`## Subclass Progression`);
    subLines.push(renderMarkdownTable({
      type:      "table",
      caption:   "",
      colLabels: mergedLabels,
      rows:      mergedRows,
    }));
  }

  // Detailed level-by-level features
  for (const lvl of Object.keys(featuresByLevel).map(Number).sort((a, b) => a - b)) {
    subLines.push(`---`);
    subLines.push(`## Level ${lvl}`);
    for (const feat of featuresByLevel[lvl]) {
      subLines.push(`### ${feat.name}`);
      const desc = Array.isArray(feat.entries)
        ? feat.entries.map(formatEntry).join("\n\n")
        : formatEntry(feat.entries);
      subLines.push(desc);
    }
  }

  // Clean up excessive blank lines
  let subclassContent = subLines.join("\n\n")
    .replace(/\n{3,}/g, "\n\n");

  subclassFiles.push({
    path: `Classes/${className}/Subclasses/${subclassName}.md`,
    content: subclassContent
  });
}

// ─── Subclasses Summary ───
if (subs.length) {
  const links = subs.map((sc: any) =>
    `[[Subclasses/${sc.name.replace(/[\\/]/g, "-")}|${sc.name}]]`
  );
  lines.push(`\n**Subclasses:** ${links.join(", ")}`);
}


  // Get full class feature definitions
const allFeatures = Array.isArray(json.classFeature) ? json.classFeature : json.lookup?.classFeature ?? [];
const featuresByLevel: Record<number, any[]> = {};

for (const entry of allFeatures) {
  if (entry.className !== className) continue;
  const lvl = entry.level ?? 0;
  if (!featuresByLevel[lvl]) featuresByLevel[lvl] = [];
  featuresByLevel[lvl].push(entry);
}


// ─── Level Features ───
lines.push(``);
lines.push(`---`);
lines.push(`## Level Features`);

const levels = Object
  .keys(featuresByLevel)
  .map(n => +n)
  .sort((a, b) => a - b);

for (const lvl of levels) {
  lines.push(`### Level ${lvl}`);

  for (const feat of featuresByLevel[lvl]) {
    // Feature header
    lines.push(`#### ${feat.name}`);

    // Ensure entries is always an array
    const entries = Array.isArray(feat.entries)
      ? feat.entries
      : [feat.entries];

    for (const ent of entries) {
      // 1) Plain-text paragraph
      if (typeof ent === "string") {
        lines.push(formatEntry(ent));
        continue;
      }

      // 2) “options” block → optional “Choose N” + bullet list

      // ─── inside your for (const ent of entries) loop ───
      if (ent.type === "options") {
        // optional “Choose N” header, bolded
        if (ent.count) {
          lines.push("");
          lines.push(`**Choose ${ent.count} of the following options:**`);
          lines.push("");
        }

        // loop over each placeholder reference
        for (const optRef of Array.isArray(ent.entries) ? ent.entries : [ent.entries]) {
          if (optRef.type === "refOptionalfeature") {
            const [optName, optSrc] = optRef.optionalfeature.split("|");
            const featDef = optionalFeatures.find(
              f => f.name === optName && (!optSrc || f.source === optSrc)
            );

            if (featDef) {
              // inline every text entry as “**Name:** description”
              for (const sub of featDef.entries) {
                if (typeof sub === "string") {
                  lines.push(`- **${featDef.name}:** ${replace5eTags(sub)}`);
                } else {
                  lines.push(`- **${featDef.name}:** ${formatEntry(sub)}`);
                }
              }
              lines.push(""); // blank line after each feature block
            } else {
              // fallback if not found
              lines.push(`**${optName}:**`);
            }

          } else {
            // any non‐refOptionalfeature fallback
            const txt = formatEntry(optRef);
            if (txt) lines.push(`- ${txt}`);
          }
        }

        continue;
      }


      // 3) Standalone refOptionalfeature
      if (ent.type === "refOptionalfeature") {
        const [name] = ent.optionalfeature.split("|");
        lines.push(`- [[${name}|${name}]]`);
        continue;
      }

      // 4) Nested “entries” block with its own heading
      if (ent.type === "entries" && ent.name) {
        lines.push(`##### ${ent.name}`);
        const inner = Array.isArray(ent.entries) ? ent.entries : [ent.entries];
        for (const e2 of inner) {
          lines.push(formatEntry(e2));
        }
        continue;
      }

      // 5) Fallback for any other object shape
      const fallback = formatEntry(ent);
      if (fallback) lines.push(fallback);
    }

    // Blank line after each feature
    lines.push(``);
  } 

  // Divider between levels
  lines.push(`---`);
}



  // stitch, replace tags, return
  let content = `---\n${yaml}\n---\n\n${lines.join("\n")}`;
  // comment this out while debugging:
  content = replace5eTags(content);

  content = content
  .replace(/\n{3,}/g, '\n\n')   // no more than 2 newlines in a row
  .replace(/\n +\n/g, '\n\n');  // trim blank lines with trailing spaces

  return [
    {
      path: `Classes/${className}/${className}.md`,
      content,
    },
    ...subclassFiles,
  ];
  
}
