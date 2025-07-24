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
  fileName?: string
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

lines.push(`\n## Class Progression`);

if (!progGroups.length) {
  lines.push(`*(No class table provided for this class.)*`);
} else {
  // Build level → feature map
  const featuresByLevel: Record<number, string[]> = {};
  for (const feat of cls.classFeatures ?? []) {
    const raw = typeof feat === "object" && feat.classFeature ? feat.classFeature : String(feat);
    const [name,, ,lvlStr] = raw.split("|");
    const lvl = Number(lvlStr ?? 0);
    if (!featuresByLevel[lvl]) featuresByLevel[lvl] = [];
    featuresByLevel[lvl].push(name);
  }

  // Unified colLabels across all groups
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
        const cell = cells[i];

        allLabelsSet.add(label);

        let val = "";
        if (Array.isArray(cell)) {
          val = cell.join(", ");
        } else if (typeof cell === "object" && cell !== null && "value" in cell) {
          val = String(cell.value);
        } else {
          val = String(cell ?? "");
        }

        rowMap[label] = val;
      }
    }
  }


  // Merge all data into rows
  const allLabels = Array.from(allLabelsSet);
  const mergedLabels = ["Level", "Proficiency Bonus", "Class Features", ...allLabels];
  const mergedRows: string[][] = [];

  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const featureList = (featuresByLevel[lvl] ?? []).map(formatFeatureLink);
    const rowMap = rowMaps[lvl] ?? {};
    const row: string[] = [
      lvl.toString(),
      PROF_BONUS_BY_LEVEL[lvl - 1],
      featureList.join(", ").replace(/\|/g, "&#124;"),
      ...allLabels.map(label => rowMap[label] ?? "")
    ];
    mergedRows.push(row);
  }

  lines.push(renderMarkdownTable({
    type: "table",
    caption: "",
    colLabels: mergedLabels,
    rows: mergedRows,
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
  
    const featuresByLevel: Record<number, any[]> = {};
  
    const introEntry = subclassFeatures.find((f: any) =>
      f.name === sc.name &&
      f.level === 3 &&
      f.subclassShortName === sc.shortName &&
      f.subclassSource === sc.source
    );
    
    if (introEntry?.entries?.length) {
      subLines.push(formatEntry(introEntry.entries));
    }

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

  subLines.push(`# ${subclassName}`);
  subLines.push(`**Parent Class:** [[${className}]]`);
  if (sc.source) subLines.push(`**Source:** ${sc.source}`);
  

  // Subclass progression table (optional)
  const progGroups = sc.subclassTableGroups ?? [];
  if (progGroups.length) {
    const allLabelsSet = new Set<string>();
    const rowMaps: Record<number, Record<string, string>> = {};
    for (const group of progGroups) {
      const labels = (group.colLabels ?? []).map(replace5eTags);
      const rows = group.rows ?? group.rowsSpellProgression ?? [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!rowMaps[i + 1]) rowMaps[i + 1] = {};
        row.forEach((cell: any, j: number) => {
          const label = labels[j];
          if (!label) return;
          allLabelsSet.add(label);
          rowMaps[i + 1][label] = typeof cell === "object" && "value" in cell
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
      const finalRow = [String(lvl), ...allLabels.map(label => row[label] ?? "")];
      mergedRows.push(finalRow);
    }

    subLines.push(`## Subclass Progression`);
    subLines.push(renderMarkdownTable({
      type: "table",
      caption: "",
      colLabels: mergedLabels,
      rows: mergedRows,
    }));
    
  }

  // Features
  for (const lvl of Object.keys(featuresByLevel).sort((a, b) => +a - +b)) {
    subLines.push(`---`);
    subLines.push(`## Level ${lvl}`);
    for (const feat of featuresByLevel[+lvl]) {
      subLines.push(`### ${feat.name}`);
      const desc = Array.isArray(feat.entries)
        ? feat.entries.map(formatEntry).join('\n\n')
        : formatEntry(feat.entries);
      subLines.push(desc);
    }
  }
  
  
  let subclassContent = subLines.join("\n\n");

  // Clean up only *excessive* blank lines (3+ → 2)
  subclassContent = subclassContent.replace(/\n{3,}/g, '\n\n');
  
  subclassFiles.push({
    path: `Classes/${className}/Subclasses/${subclassName}.md`,
    content: subclassContent
  });
  
  
  
}

  if (subs.length) {
    lines.push(`\n## Subclasses`);
    for (const sc of subs) {
        lines.push(`- [[Subclasses/${sc.name.replace(/[\/\\]/g, "-")}]]`);
    }
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

for (const lvl of Object.keys(featuresByLevel).sort((a, b) => +a - +b)) {
// ─── Level Features ───
lines.push(`---`);
lines.push(`## Level Features`);
const levels = Object.keys(featuresByLevel)
  .map(n => +n)
  .sort((a, b) => a - b);

for (const lvl of levels) {
  lines.push(`### Level ${lvl}`);
  for (const feat of featuresByLevel[lvl]) {
    // force TS to know these are “any”
    const entries = Array.isArray(feat.entries)
      ? feat.entries as any[]
      : [feat.entries] as any[];

    const block = entries
      .map((e: any) => formatEntry(e))   // ← annotate `e`
      .join("\n\n");

    lines.push(block);
    lines.push("");    // blank line between features
  }
  lines.push(`---`);  // divider between levels
}
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
