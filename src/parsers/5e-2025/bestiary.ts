// parsers/5e-json/bestiary.ts

import type { ParsedMarkdownFile } from "src/types";
import { getFullSourceName } from "./helpers/sourceMap";
import { replace5eTags } from "./helpers/tagReplacer";
import { renderMarkdownTable } from "./helpers/markdownTable";
import { buildFM, serializeFrontmatter, BESTIARY_META_DEFS, unifiedSkills, FM_FIELDS } from "./helpers/frontmatter";

const skippedMonsters: string[] = [];

// Size abbreviations mapping
export 
const SIZE_MAP: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan"
};

// Alignment abbreviations mapping
const ALIGNMENT_MAP: Record<string, string> = {
  L: "Lawful",
  N: "Neutral",
  C: "Chaotic",
  G: "Good",
  E: "Evil",
  U: "Unaligned"
};

// Helper to capitalize first letter of a string
function capitalizeFirst(str: unknown): string {
  const s = String(str || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatSizeAbbrev(abbrev: string): string {
  return SIZE_MAP[abbrev] || abbrev;
}

export function formatAlignmentAbbrev(abbrev: string): string {
  return abbrev
    .trim()
    .split(/\s+/)
    .map(letter => ALIGNMENT_MAP[letter] || letter)
    .join(" ");
}

const RAW_NPCS: string[] = [
  "Abjurer", "Acolyte", "Apprentice Wizard", "Archdruid", "Archer", "Archmage", "Assassin",
  "Bandit", "Bandit Captain", "Bard", "Berserker", "Blackguard", "Champion", "Commoner",
  "Conjurer", "Cult Fanatic", "Cultist", "Diviner", "Druid (NPC)", "Druid NPC", "Enchanter",
  "Evoker", "Gladiator", "Guard", "Illusionist", "Knight", "Kraken Priest", "Mage",
  "Martial Arts Adept", "Master Thief", "Necromancer", "Noble", "Priest", "Scout", "Spy",
  "Swashbuckler", "Thug", "Transmuter", "Tribal Warrior", "Veteran", "War Priest",
  "Warlock of the Archfey", "Warlock of the Fiend", "Warlock of the Great Old One", "Warlord"
];
const NORMALIZED_NPC_NAMES = new Set(RAW_NPCS.map(n => normalizeName(n)));

function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

function categorizeCreature(monster: any): string {
  const typeValue = monster.type;
  const name = monster.name;
  const t = typeof typeValue === "string"
    ? typeValue.toLowerCase()
    : typeValue?.type?.toLowerCase() || String(typeValue).toLowerCase();

  const normalizedName = normalizeName(name);

  if (monster.isNpc || monster.isNamedCreature) return "Story NPCs";
  if (t === "beast") return "Beasts";
  if (t === "humanoid" && NORMALIZED_NPC_NAMES.has(normalizedName)) return "Non-Beasts";
  if (t === "humanoid") return "Monsters";
  return "Monsters";
}

function renderAbilitiesTable(str: number, dex: number, con: number, int: number, wis: number, cha: number): string {
  return [
    `| STR | DEX | CON | INT | WIS | CHA |`,
    `| --- | --- | --- | --- | --- | --- |`,
    `| ${str} | ${dex} | ${con} | ${int} | ${wis} | ${cha} |`
  ].join("\n");
}

function renderEntry(entry: any): string {
  const name = entry.name;
  let descriptions: string[] = [];
  if (Array.isArray(entry.entries)) {
    descriptions = entry.entries;
  } else if (typeof entry.entries === "string") {
    descriptions = [entry.entries];
  } else if (Array.isArray(entry.desc)) {
    descriptions = entry.desc;
  } else if (typeof entry.desc === "string") {
    descriptions = [entry.desc];
  }
  const raw = descriptions.join(" ");
  const desc = replace5eTags(raw);
  return `***${name}.*** ${desc}`;
}

export function parseBestiaryFile(json: any, editionId: string): ParsedMarkdownFile[] {
    if (!json.monster) return [];
    (json as any)._editionId = editionId;
  
    // 1) Filter out “reference” entries with no AC or HP
    const validMonsters = json.monster.filter((m: any) => {
    const acVal = Array.isArray(m.ac)
      ? m.ac[0]?.ac ?? m.ac[0]
      : typeof m.ac === "object"
        ? m.ac?.ac ?? null
        : m.ac;

    const hpVal = typeof m.hp === "object"
      ? m.hp?.average ?? m.hp?.hp ?? null
      : m.hp;
      return acVal != null && hpVal != null && !isNaN(Number(acVal)) && !isNaN(Number(hpVal));
    });

    const allNames = new Set(json.monster.map((m: any) => m.name));
const validNames = new Set(validMonsters.map((m: any) => m.name));
const missing = [...allNames].filter(name => !validNames.has(name));

  
    return validMonsters.map((monster: any) => {
      const name     = monster.name as string;
      const safeName = name.replace(/\//g, "-");
  
      // — Raw fields & formatting —
      const rawSize      = monster.size || "M";
      const rawAlignment = Array.isArray(monster.alignment)
        ? monster.alignment.join(" ")
        : monster.alignment || "N";
    let rawType = "Unknown";

    if (typeof monster.type === "string") {
      rawType = capitalizeFirst(monster.type);
    } else if (monster.type?.type) {
      const base = capitalizeFirst(monster.type.type);
      const tags = monster.type.tags?.length ? ` (${monster.type.tags.map(capitalizeFirst).join(", ")})` : "";
      rawType = `${base}${tags}`;
    }

    monster._parsedType = rawType;
      
    // — AC, HP, CR —
    const ac = Array.isArray(monster.ac) ? monster.ac[0].ac : monster.ac;
    const hp = monster.hp?.average ?? monster.hp;
    const cr = monster.cr;

    // Skip monsters with no AC and HP
    if (!ac && !hp) {
      skippedMonsters.push(monster.name);
      return null;
    }
      
      // — Abilities —
      const abilities = Array.isArray(monster.ability)
        ? monster.ability
        : [monster.str, monster.dex, monster.con, monster.int, monster.wis, monster.cha];
      const [str = 10, dex = 10, con = 10, int = 10, wis = 10, cha = 10] = abilities;
  
      // — Speed (handles hover & object speeds) —
      const speedList: string[] = [];
      if (typeof monster.speed === "object") {
        for (const [mode, val] of Object.entries(monster.speed)) {
          if (mode === "canHover") continue;
          if (val && typeof val === "object" && "number" in val) {
            const num  = (val as any).number;
            const cond = (val as any).condition ? ` ${(val as any).condition}` : "";
            speedList.push(`${mode} ${num} ft.${cond}`);
          } else {
            speedList.push(`${mode} ${val} ft.`);
          }
        }
      } else {
        speedList.push(`${monster.speed} ft.`);
      }
      const speed = speedList.join(", ");
  
      // — Source sanitization —
      let source = getFullSourceName(monster.source, editionId);
      source     = source.replace(/:/g, " -");
  
      // — Category for folder —
      const category = categorizeCreature(monster);
  
      const fm   = buildFM(monster, BESTIARY_META_DEFS);
      const yaml = serializeFrontmatter(fm, BESTIARY_META_DEFS);
      
      const savingThrows = (fm[FM_FIELDS.SAVING_THROWS] as string[]) || [];
      const skills       = (fm[FM_FIELDS.SKILLS]        as string[]) || [];
      const senses       = (fm[FM_FIELDS.SENSES]        as string[]) || [];
      const languages    = (fm[FM_FIELDS.LANGUAGES]     as string[]) || [];


      // — Body —
      let body =
      `# ${name}\n\n` +
      `${formatSizeAbbrev(rawSize)} ${rawType}, ${formatAlignmentAbbrev(rawAlignment)}\n\n` +
      `**Armor Class**: ${ac}\n` +
      `**Hit Points**: ${hp}\n` +
      `**Speed**: ${speed}\n` +
      (savingThrows.length
        ? `**Saving Throws**: ${savingThrows.join(", ")}\n`
        : "") +
      (skills.length
        ? `**Skills**: ${skills.join(", ")}\n`
        : "") +
      (senses.length
        ? `**Senses**: ${senses.join(", ")}\n`
        : "") +
      (languages.length
        ? `**Languages**: ${languages.join(", ")}\n`
        : "") +
      `**Challenge**: ${cr}\n\n` +
      renderAbilitiesTable(str, dex, con, int, wis, cha);

  
      if (monster.trait)     body += `\n\n### Traits\n${monster.trait.map(renderEntry).join("\n\n")}`;
      if (monster.action)    body += `\n\n### Actions\n${monster.action.map(renderEntry).join("\n\n")}`;
      if (monster.reaction)  body += `\n\n### Reactions\n${monster.reaction.map(renderEntry).join("\n\n")}`;
      if (monster.legendary) body += `\n\n### Legendary Actions\n${monster.legendary.map(renderEntry).join("\n\n")}`;
  
      const content = `---\n${yaml}\n---\n\n${body}`;
  
      return {
        path:    `${category}/${safeName}.md`,
        content,
      };
    });
  }
