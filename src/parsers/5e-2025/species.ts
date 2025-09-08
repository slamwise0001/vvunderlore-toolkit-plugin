// dnd 5e 2024 species

import type { ParsedMarkdownFile } from "../../types";
import { replace5eTags } from "./helpers/tagReplacer";
import {
  buildFM,
  serializeFrontmatter,
  FM_FIELDS,
  SPECIES_META_DEFS,
  SIZE_MAP,
} from "./helpers/frontmatter";
import { renderMarkdownTable } from "./helpers/markdownTable";
import { formatEntry } from "./helpers/formatEntry";

function slug(name: string): string {
  return name
    .replace(/;/g, ":")       // semicolon → dash
    .replace(/[\/:"]/g, ":")  // slash, colon, quote → dash
    .trim();
}

const BLOCKED_TRAITS = ["Age", "Size", "Languages", "Creature Type", "Speed"];

function linkDisplay(str: string): string {
  if (typeof str !== "string") return String(str ?? "");
  const m = str.match(/^\[\[(.+?)\]\]$/);
  if (!m) return str;
  const inner = m[1];
  const pipe = inner.split("|");
  if (pipe.length > 1) return pipe[1].trim();         // ...|Display
  const hash = inner.split("#");
  if (hash.length > 1) return hash[1].trim();         // File#Header
  return inner.trim();
}

// Normalize heading names for comparison and lookup
function normName(n: string): string {
  return String(n ?? "")
    .replace(/^Feature:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Find a named entry either at top level or one level nested under entries[]
function findEntryByName(entries: any[] | undefined, display: string): any | null {
  if (!Array.isArray(entries)) return null;
  const target = normName(display);

  // direct hit
  const direct = entries.find(e => typeof e?.name === "string" && normName(e.name) === target);
  if (direct) return direct;

  // one level nested
  for (const e of entries) {
    if (Array.isArray(e?.entries)) {
      const sub = e.entries.find((s: any) => typeof s?.name === "string" && normName(s.name) === target);
      if (sub) return sub;
    }
  }

  return null;
}

export function parseSpeciesFile(
  json: { race: any[]; subrace?: any[]; _editionId?: string },
  editionId: string
): ParsedMarkdownFile[] {
  if (!Array.isArray(json.race)) return [];
  json._editionId = editionId;

  // 1) Filter out reprints
const rawVariants = json.race.filter((r: any) =>
  !/\((?:Kaladesh|Zendikar|Amonkhet|Innistrad|Ixalan)\)$/.test(r.name)
);

  // 2) Group by race name
  const byName = new Map<string, any[]>();
  for (const r of rawVariants) {
    const list = byName.get(r.name) ?? [];
    list.push(r);
    byName.set(r.name, list);
  }

  // 3) All subraces array
  const subracesList = Array.isArray(json.subrace) ? json.subrace : [];

  const out: ParsedMarkdownFile[] = [];

  // 4) Main loop over each species
  for (const [raceName, raceVariants] of byName.entries()) {
    const safeName = slug(raceName);

    // pick the “fullest” variant as primary
    const primary = raceVariants.reduce(
      (best, cur) =>
        Object.keys(cur).length > Object.keys(best).length ? cur : best,
      raceVariants[0]
    );

    // one‐off: graft Human ability if missing
    if (!primary.ability) {
      const humanEntry = subracesList.find((sr: any) =>
        sr.raceName === raceName &&
        sr.raceSource === primary.source &&
        !("name" in sr) &&
        Array.isArray(sr.ability)
      );
      if (humanEntry) primary.ability = humanEntry.ability;
    }

    // build frontmatter
    const fm = buildFM(primary, SPECIES_META_DEFS);
    const senses: string[] = [];
    if (primary.darkvision)  senses.push(`Darkvision ${primary.darkvision} ft.`);
    if (primary.blindsight)  senses.push(`Blindsight ${primary.blindsight} ft.`);
    if (primary.tremorsense) senses.push(`Tremorsense ${primary.tremorsense} ft.`);
    if (primary.truesight)   senses.push(`Truesight ${primary.truesight} ft.`);
    if (senses.length) fm.senses = senses;
    if (Array.isArray(fm.traits)) {
      fm.traits = fm.traits.filter(t => !BLOCKED_TRAITS.includes(t));
    }
    const yaml = serializeFrontmatter(fm, SPECIES_META_DEFS);

    // build species body
    const lines: string[] = [];
    lines.push(`# ${raceName}`, `## Stats`);

    // Size
    const size = Array.isArray(primary.size)
      ? primary.size.map((s: string) => SIZE_MAP[s] || s).join("/")
      : SIZE_MAP[primary.size] ?? primary.size;
    lines.push(`**Size:** ${size}`);

    // Speed
    const speed = typeof primary.speed === "number"
      ? primary.speed
      : primary.speed?.walk ?? primary.speed?.base ?? 0;
    lines.push(`**Speed:** ${speed} ft. walking`);

    // Abilities
    const kids = subracesList.filter(sr =>
      sr.name && sr.raceName === raceName && sr.raceSource === primary.source
    );
    const rawAbility = Array.isArray(primary.ability)
      ? primary.ability
      : Array.isArray(kids[0]?.ability) ? kids[0].ability : [];
    if (Array.isArray(rawAbility) && rawAbility.length) {
      const bonuses = { str:0,dex:0,con:0,int:0,wis:0,cha:0 };
      let chooseOpt: any = null;
      for (const obj of rawAbility) {
        if ("choose" in obj) chooseOpt = obj.choose;
        else for (const [k,v] of Object.entries(obj)) (bonuses as any)[k] += v as number;
      }
      const pairs = Object.entries(bonuses) as [string,number][];
      const parts = pairs.filter(([,v])=>v!==0).map(([k,v])=>`${k.toUpperCase()} ${v>=0?"+":""}${v}`);
      if (chooseOpt?.count && Array.isArray(chooseOpt.from)) {
        parts.push(`CHOOSE ${chooseOpt.count} from ${chooseOpt.from.map((s:string)=>s.toUpperCase()).join(", ")}`);
      }
      if (parts.length) lines.push(`**Ability Scores:** ${parts.join(", ")}`);
    }

    // Languages
    const langs = fm.languages as string[]|undefined;
    if (langs?.length) lines.push(`**Languages:** ${langs.join(", ")}`);

    // Skills
    if (Array.isArray(primary.skillProficiencies)) {
      const skillLabels: string[] = [];
      for (const e of primary.skillProficiencies as any[]) {
        if (e.choose?.from) {
          skillLabels.push(`Choose from: ${e.choose.from.map((s:string)=>s.charAt(0).toUpperCase()+s.slice(1)).join(", ")}`);
        } else {
          const val = e.proficiency ?? e.name ?? e;
          if (typeof val === "string") skillLabels.push(val.charAt(0).toUpperCase()+val.slice(1));
        }
      }
      if (skillLabels.length) lines.push(`**Skill Proficiencies:** ${skillLabels.join("; ")}`);
    }

    // Tool / Weapon / Armor
    const tp = fm[FM_FIELDS.TOOL_PROFICIENCIES] as string[]|undefined;
    const wp = fm[FM_FIELDS.WEAPON_PROFICIENCIES] as string[]|undefined;
    const ap = fm[FM_FIELDS.ARMOR_PROFICIENCIES] as string[]|undefined;
    if (tp?.length) lines.push(`**Tool Proficiencies:** ${tp.join(", ")}`);
    if (wp?.length) lines.push(`**Weapon Proficiencies:** ${wp.join(", ")}`);
    if (ap?.length) lines.push(`**Armor Proficiencies:** ${ap.join(", ")}`);

    // Traits
    lines.push(`## Traits`);
    const seen = new Set<string>();
    for (const trait of (fm.traits as string[] || [])) {
      const title = linkDisplay(trait);         // plain header text, no link
      lines.push(`##### ${title}`);

      const ent = findEntryByName(primary.entries, title);
      if (ent?.entries) {
        ent.entries.forEach((sub: any, idx: number) => {
          let blk: string | undefined;
          if (sub.type === "table") {
            blk = renderMarkdownTable(sub);
          } else if (sub.type === "list") {
            blk = sub.items
              .map((it: any) => (typeof it === "string" ? `- ${replace5eTags(it)}` : `- ${it.name}`))
              .join("\n");
          } else if (typeof sub === "string") {
            blk = replace5eTags(sub);
          }
          if (blk && !seen.has(blk)) {
            lines.push(blk);
            seen.add(blk);
            if (ent.entries.length > 1 && idx < ent.entries.length - 1) lines.push("");
          }
        });
      }
    }

    // ─── Now branch on subraces ───
    const subs = kids;  // already filtered
    if (subs.length) {
      // 1) main file in folder
      out.push({
        path: `Species/${safeName}/${safeName}.md`,
        content: `---\n${yaml}\n---\n\n${lines.join("\n")}`,
      });

      // 2) each subspecies
      const subFolder = `Species/${safeName}/Races`;
      for (const sr of subs) {
        // turn semicolons → colons
        const display = sr.name.replace(/;/g, ":");
        const subLines: string[] = [`# ${display}`];

        // copy Stats block if you like:
        if (Array.isArray(sr.ability)) {
          const bonuses = { str:0,dex:0,con:0,int:0,wis:0,cha:0 };
          let chooseOpt:any = null;
          for (const obj of sr.ability) {
            if ("choose" in obj) chooseOpt = obj.choose;
            else for (const [k,v] of Object.entries(obj)) (bonuses as any)[k]+=v as number;
          }
          const pairs = Object.entries(bonuses) as [string,number][];
          const parts = pairs.filter(([,v])=>v!==0).map(([k,v])=>`${k.toUpperCase()} ${v>=0?"+":""}${v}`);
          if (chooseOpt?.count) parts.push(`CHOOSE ${chooseOpt.count} from ${(chooseOpt.from as string[]).map(s=>s.toUpperCase()).join(", ")}`);
          if (parts.length) subLines.push(`**Ability Scores:** ${parts.join(", ")}`);
        }

        // then traits/entries
        for (const entry of sr.entries || []) {
          subLines.push(formatEntry(entry));
          subLines.push(""); // optional blank line between features
        }

        const subYaml = serializeFrontmatter(buildFM(sr, SPECIES_META_DEFS), SPECIES_META_DEFS);
        out.push({
          path: `${subFolder}/${slug(sr.name)}.md`,
          content: `---\n${subYaml}\n---\n\n${subLines.join("\n")}`,
        });
      }
    } else {
      // no subraces ⇒ a single flat file
      out.push({
        path: `Species/${safeName}.md`,
        content: `---\n${yaml}\n---\n\n${lines.join("\n")}`,
      });
    }
  }

  // 5) Sort & return
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
