// dnd 5e 2014 bestiary parser

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

  function renderEntry(entry: any, inBreathBlock = false): string {
    const ensurePeriod = (s: string) => (/[.!?]\s*$/.test(s) ? s : `${s}.`);
    const renderStr = (s: string) => replace5eTags(s);

    if (typeof entry === "string") return renderStr(entry);
    if (!entry || typeof entry !== "object") return String(entry ?? "");

    const rawName = typeof entry.name === "string" ? entry.name : "";
    const nameTxt = rawName ? renderStr(rawName) : "";
    const isBreath = /\bbreath weapon/i.test(nameTxt);

    const lead = nameTxt ? `***${ensurePeriod(nameTxt)}***` : "";

    const blocks: any[] = [];
    if (Array.isArray(entry.entries)) blocks.push(...entry.entries);
    else if (typeof entry.entries === "string") blocks.push(entry.entries);
    else if (Array.isArray(entry.desc)) blocks.push(...entry.desc);
    else if (typeof entry.desc === "string") blocks.push(entry.desc);
    else if (Array.isArray((entry as any).entry)) blocks.push(...(entry as any).entry);
    else if (typeof (entry as any).entry === "string") blocks.push((entry as any).entry);

    const out: string[] = [];
    for (const blk of blocks) {
      if (typeof blk === "string") {
        out.push(renderStr(blk));
        continue;
      }

      const isHangNoTitleList =
        blk &&
        blk.type === "list" &&
        blk.style === "list-hang-notitle" &&
        Array.isArray(blk.items) &&
        blk.items.every((it: any) => it?.type === "item");

      if ((isBreath || inBreathBlock || isHangNoTitleList) && blk && blk.type === "list" && Array.isArray(blk.items)) {
        const bullets: string[] = [];
        for (const it of blk.items) {
          const itName = it?.name ? renderStr(String(it.name).trim()) : "";
          let itBody = "";
          if (typeof it?.entry === "string") itBody = renderStr(it.entry);
          else if (Array.isArray(it?.entries)) itBody = it.entries.map((e: any) => renderEntry(e, true)).join(" ");
          else if (typeof it?.entries === "string") itBody = renderStr(it.entries);

          const head = itName ? `***${ensurePeriod(itName)}***` : "";
          const line = [head, itBody].filter(Boolean).join(" ").trim();
          if (line) bullets.push(`- ${line}`);
        }
        if (bullets.length) out.push("\n" + bullets.join("\n"));
        continue;
      }

      out.push(String(blk));
    }

    return [lead, out.join(" ")].filter(Boolean).join(" ").replace(/[ \t]+/g, " ").trim();
  }

  function renderSpellcasting(spellcastingArr: any[]): string {
    if (!Array.isArray(spellcastingArr) || spellcastingArr.length === 0) return "";

    const lines: string[] = [];

    // Each entry becomes its own subsection (e.g., "Innate Spellcasting", "Spellcasting")
    for (const sc of spellcastingArr) {
      if (!sc || typeof sc !== "object") continue;

      const title = typeof sc.name === "string" && sc.name.trim() ? sc.name.trim() : "Spellcasting";
      const header = `### ${replace5eTags(title)}`;
      const bodyParts: string[] = [];

      // 1) Header text block(s)
      const headerEntries = Array.isArray(sc.headerEntries)
        ? sc.headerEntries
        : typeof sc.headerEntries === "string"
        ? [sc.headerEntries]
        : [];
      if (headerEntries.length) {
        bodyParts.push(headerEntries.map((e: any) => replace5eTags(e)).join(" "));
      }

      // 2) “At will”
      if (Array.isArray(sc.will) && sc.will.length) {
        const spells = sc.will.map((s: any) => replace5eTags(String(s))).join(", ");
        bodyParts.push(`- **At will:** ${spells}`);
      }

      // 3) “Daily” buckets — keys like "1", "2", "3", and "1e"/"2e" (“each”)
      if (sc.daily && typeof sc.daily === "object") {
        const keys = Object.keys(sc.daily).sort((a,b) => {
          // numeric-first sort: 1, 1e, 2, 2e, …
          const parse = (k: string) => ({ n: parseInt(k, 10) || 0, e: /e$/i.test(k) ? 1 : 0 });
          const A = parse(a), B = parse(b);
          return A.n - B.n || A.e - B.e;
        });

        for (const k of keys) {
          const arr = Array.isArray(sc.daily[k]) ? sc.daily[k] : [];
          if (!arr.length) continue;
          const n = parseInt(k, 10) || 0;
          const each = /e$/i.test(k);
          const label = n > 0
            ? each ? `${n}/day each` : `${n}/day`
            : "Daily";

          const spells = arr.map((s: any) => replace5eTags(String(s))).join(", ");
          bodyParts.push(`- **${label}:** ${spells}`);
        }
      }

      // 4) Optional: other buckets used occasionally by 5etools (“rest”, “ritual”, etc.)
      //    We keep this conservative; add more if you see them in your feeds.
      if (sc.ritual && Array.isArray(sc.ritual) && sc.ritual.length) {
        const spells = sc.ritual.map((s: any) => replace5eTags(String(s))).join(", ");
        bodyParts.push(`- **Rituals:** ${spells}`);
      }

      // Stitch this block
      if (bodyParts.length) {
        lines.push(`${header}\n${bodyParts.join("\n")}`);
      }
    }

    return lines.join("\n\n");
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

    const ac = Array.isArray(monster.ac) ? monster.ac[0].ac : monster.ac;
    const hp = monster.hp?.average ?? monster.hp;

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
      const fmAny = fm as Record<string, unknown>;
      const challengeText = String(fmAny["CR"] ?? fmAny["challenge"] ?? "");
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
      `**Challenge**: ${challengeText}\n\n` +
      renderAbilitiesTable(str, dex, con, int, wis, cha);

      if (monster.spellcasting) {
        body += `\n\n### Spellcasting\n${monster.spellcasting
          .map((sc: any) => {
            const name = sc.name || "Spellcasting";
            const parts: string[] = [];

            if (sc.headerEntries) {
              const headers = Array.isArray(sc.headerEntries)
                ? sc.headerEntries
                : [sc.headerEntries];
              parts.push(headers.map((e: any) => replace5eTags(e)).join(" "));
            }

            if (sc.will) {
              parts.push(`- **At will:** ${sc.will.map((s: any) => replace5eTags(String(s))).join(", ")}`);
            }

            if (sc.daily) {
              for (const [k, arr] of Object.entries(sc.daily)) {
                const spells = (arr as any[]).map(s => replace5eTags(String(s))).join(", ");
                const n = parseInt(k, 10) || 0;
                const each = /e$/i.test(k);
                const label = n > 0 ? (each ? `${n}/day each` : `${n}/day`) : "Daily";
                parts.push(`- **${label}:** ${spells}`);
              }
            }

            return `***${name}.***\n${parts.join("\n")}`;
          })
        .join("\n\n")}`;
      }
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
