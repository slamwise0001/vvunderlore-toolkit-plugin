//5e 2025 classes

import type { ParsedMarkdownFile } from "../../types";
import { 
  buildFM, 
  serializeFrontmatter, 
  CLASS_META_DEFS, 
  unifiedToolProfs, 
  unifiedWeaponProfs, 
  SkillOption,
  unifiedSkills,
  SKILL_OPTIONS, 
  FM_FIELDS
} from "./helpers/frontmatter";
import { renderMarkdownTable } from "./helpers/markdownTable";
import { replace5eTags } from "./helpers/tagReplacer";
import { formatEntry } from "./helpers/formatEntry";

function isTypedEntry(x: any): x is { type: string; [k: string]: any } {
  return (
    x != null &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    typeof (x as any).type === "string"
  );
}

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
        if (isTypedEntry(entry) && entry.type === "refClassFeature") {
          const [name] = entry.classFeature.split("|");
          return `*See feature: **${name}***`;
        }
  
        if (isTypedEntry(entry) && entry.type === "entries") {
          const inner = renderEntries(entry.entries || []);
          return `**${entry.name}**\n\n${inner}`;
        }
  
        if (isTypedEntry(entry) && entry.type === "entries") {
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

const baseFM = buildFM(cls, CLASS_META_DEFS);
const fm     = { ...baseFM, hd: hdStr };
const yaml   = serializeFrontmatter(fm, CLASS_META_DEFS);

// 1) Declare your lines buffer immediately
const lines: string[] = [];

// 4) Now carry on with the rest of your body
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


// ─── Skills ───
{
  // 1) grab whatever array holds the raw objects/strings
  const rawSkills: any[] =
    Array.isArray(sp.skillProficiencies) ? sp.skillProficiencies
    : Array.isArray(sp.skills)             ? sp.skills
    : Array.isArray(sp.skillProf)          ? sp.skillProf
    : [];

  // 2) look for the “choose N from […]” entry
  const choiceEntry = rawSkills.find(
    e => e &&
         (typeof e.choose === "object" || typeof e.any === "number")
  );

  if (choiceEntry) {
    // how many to choose
    const count = choiceEntry.choose?.count ?? choiceEntry.any ?? 1;

    // pull the actual list of options, or fall back to the global SKILL_OPTIONS
    const options: string[] = Array.isArray(choiceEntry.choose?.from)
      ? choiceEntry.choose.from.map((s: string) =>
          // title-case each word (or just use s)
          s.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")
        )
      : SKILL_OPTIONS;

    lines.push(`- **Skills (Choose ${count}):** ${options.join(", ")}`);

  } else {
    // no choose-from object → flat list from your unified helper
    const flat = unifiedSkills(sp);
    if (flat.length) {
      lines.push(`- **Skills:** ${flat.join(", ")}`);
    }
  }
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

  // ─── Header metadata ───
  subLines.push(`# ${subclassName}`);
  subLines.push(`**Parent Class:** [[${className}]]`);
  if (sc.source) subLines.push(`**Source:** ${sc.source}`);
  subLines.push(``); // blank line

  // ─── Intro entry (level 3 feature description) ───
  const intro = subclassFeatures.find((f: any) =>
    f.name === sc.name &&
    f.level === 3 &&
    f.subclassShortName === sc.shortName &&
    f.subclassSource === sc.source
  );
  if (intro?.entries?.length) {
    const introText = Array.isArray(intro.entries)
      ? intro.entries.map((e: any) =>
          typeof e === "string" ? replace5eTags(e) : formatEntry(e)
        ).join("\n\n")
      : formatEntry(intro.entries);
    subLines.push(introText, ``);
  }

  // ─── Optional‐feature block ───
  const code = (Object.entries(OPT_FEATURE_TYPE_TO_FULL) as [string,string][])
    .find(([, full]) =>
      full.toLowerCase().includes(subclassName.toLowerCase())
    )?.[0];
  if (code) {
    const matches = optionalFeatures.filter(of =>
      Array.isArray(of.featureType) && of.featureType.includes(code)
    );
    if (matches.length) {
      subLines.push(`## ${subclassName} Optional Features`);
      for (const feat of matches) {
        for (const entry of feat.entries) {
          const txt = typeof entry === "string"
            ? replace5eTags(entry)
            : formatEntry(entry);
          subLines.push(`**${feat.name}:** ${txt}`);
        }
        subLines.push(``);
      }
    }
  }

  // ─── Subclass progression table ───
  const prog = sc.subclassTableGroups ?? [];
  if (prog.length) {
    const labels = new Set<string>();
    const rowsMap: Record<number, Record<string,string>> = {};
    for (const g of prog) {
      const cols = (g.colLabels ?? []).map(replace5eTags);
      const rows = Array.isArray(g.rows)
        ? g.rows
        : Array.isArray(g.rowsSpellProgression)
          ? g.rowsSpellProgression
          : [];
      rows.forEach((r: any, i: any) => {
        const lvl = i + 1;
        rowsMap[lvl] ??= {};
        r.forEach((c: any, j: number) => {
          const lab = cols[j];
          if (!lab) return;
          labels.add(lab);
          rowsMap[lvl][lab] = typeof c === "object" && c !== null && "value" in c
            ? String(c.value)
            : String(c ?? "");
        });
      });
    }
    const hdrs = Array.from(labels);
    subLines.push(`## Subclass Progression`);
    subLines.push(renderMarkdownTable({
      type:      "table",
      caption:   "",
      colLabels: ["Level", ...hdrs],
      rows:      Array.from({ length: 20 }, (_, i) => {
        const lvl = i + 1;
        return [String(lvl), ...hdrs.map(h => rowsMap[lvl]?.[h] ?? "")];
      })
    }));
  }

// ─── Detailed level‐by‐level features ───
const featsByLvl: Record<number, any[]> = {};
for (const f of subclassFeatures) {
  if (
    f.subclassShortName === sc.shortName &&
    f.subclassSource === sc.source &&
    f.className === className
  ) {
    const lvl = f.level ?? 0;
    ;(featsByLvl[lvl] ??= []).push(f);
  }
}

for (const lvl of Object.keys(featsByLvl).map(Number).sort((a,b)=>a-b)) {
  subLines.push(`---`, `## Level ${lvl}`);

  for (const f of featsByLvl[lvl]) {
  subLines.push(`### ${f.name}`);

  // Walk each entry for this feature
  for (const ent of Array.isArray(f.entries) ? f.entries : [f.entries]) {
    // 1) Plain paragraph entries
    if (typeof ent === "string") {
      subLines.push(replace5eTags(ent));
      continue;
    }

    // 2) If it's the "Maneuvers" entries‐block, inject your list here
    if (isTypedEntry(ent) && ent.type === "entries" && /^Maneuvers$/i.test(ent.name)) {
      // first print the sub‐heading and any text it had
      subLines.push(`##### ${ent.name}`);
      for (const txt of Array.isArray(ent.entries) ? ent.entries : [ent.entries]) {
        subLines.push(typeof txt === "string"
          ? replace5eTags(txt)
          : formatEntry(txt));
      }

      // now inject the full maneuver definitions for this subclass
      const code = (Object.entries(OPT_FEATURE_TYPE_TO_FULL) as [string,string][])
        .find(([, full]) =>
          full.toLowerCase().includes(subclassName.toLowerCase())
        )?.[0];
      if (code) {
        const matches = optionalFeatures.filter(of =>
          Array.isArray(of.featureType) && of.featureType.includes(code)
        );
        for (const featDef of matches) {
          for (const sub of featDef.entries) {
            const line = typeof sub === "string"
              ? replace5eTags(sub)
              : formatEntry(sub);
            subLines.push(`**${featDef.name}:** ${line}`);
          }
          subLines.push(""); // spacer
        }
      }
      continue;
    }

    // 3) Any other nested "entries" blocks
    if (isTypedEntry(ent) && ent.type === "entries" && ent.name) {
      subLines.push(`##### ${ent.name}`);
      for (const e2 of Array.isArray(ent.entries) ? ent.entries : [ent.entries]) {
        subLines.push(formatEntry(e2));
      }
      continue;
    }

    // 4) Insets
    if (isTypedEntry(ent) && ent.type === "inset" && ent.name) {
      const inner = Array.isArray(ent.entries) ? ent.entries : [ent.entries];
      subLines.push(`> **${ent.name}**`);
      inner.forEach((e2: any) => subLines.push(`> ${formatEntry(e2)}`));
      continue;
    }

    // 5) Fallback
    const fb = formatEntry(ent);
    if (fb) subLines.push(fb);
  }
  }
}


  // ─── Clean up & push ───
  const subclassContent = subLines
    .join("\n\n")
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
          const txt = formatEntry(ent).trim();
          // skip any pure-brace lines
          if (txt === "{" || txt === "}") continue;
          lines.push(txt);
          continue;
        }

        if (isTypedEntry(ent) && ent.type === "list" && Array.isArray(ent.items)) {
    for (const item of ent.items) {
      lines.push(`- ${replace5eTags(item)}`);
    }
    continue;
  }
      // ─── inside your for (const ent of entries) loop ───
      if (isTypedEntry(ent) && ent.type === "options") {
  if (ent.count) {
    lines.push("");
    lines.push(`**Choose ${ent.count} of the following options:**`);
    lines.push("");
  }

  for (const optRef of Array.isArray(ent.entries) ? ent.entries : [ent.entries]) {
    if (optRef.type === "refOptionalfeature") {
      const [optName, optSrc] = optRef.optionalfeature.split("|");
      const featDef = optionalFeatures.find(
        f => f.name === optName && (!optSrc || f.source === optSrc)
      );

      if (featDef) {
        // loop through each line in the feature’s entries[]
        featDef.entries.forEach((subEntry: any, idx: any) => {
          // render text
          const text = typeof subEntry === "string"
            ? replace5eTags(subEntry)
            : formatEntry(subEntry);

          if (idx === 0) {
            // first line: bolded name + description
            lines.push(`- **${featDef.name}:** ${text}`);
          } else {
            // subsequent lines: nested bullet
            lines.push(`  - ${text}`);
          }
        });
        lines.push(""); // blank line after each feature block
      } else {
        // fallback if not found
        lines.push(`**${optName}:**`);
      }
    } else {
      // non‐refOptionalfeature fallback
      const txt = formatEntry(optRef);
      if (txt) lines.push(`- ${txt}`);
    }
  }

  continue;
}


      // 3) Standalone refOptionalfeature
      if (isTypedEntry(ent) && ent.type === "refOptionalfeature") {
        const [name] = ent.optionalfeature.split("|");
        lines.push(`- [[${name}|${name}]]`);
        continue;
      }

      // 4) Nested “entries” block with its own heading
      if (isTypedEntry(ent) && ent.type === "entries" && ent.name) {
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
