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

function slug(name: string): string {
  return name.replace(/[\/:"]/g, "-");
}

const BLOCKED_TRAITS = ["Age", "Size", "Languages", "Creature Type", "Speed"];

export function parseSpeciesFile(
  json: { race: any[]; subrace?: any[]; _editionId?: string },
  editionId: string
): ParsedMarkdownFile[] {
  if (!Array.isArray(json.race)) return [];
  json._editionId = editionId;

  // 1) Filter out reprints
  const rawVariants: any[] = json.race.filter((r: any) =>
    !("reprintedAs" in r) &&
    !/\((?:Kaladesh|Zendikar|Amonkhet|Innistrad|Ixalan)\)$/.test(r.name)
  );

  // 2) Group by race name
  const byName: Map<string, any[]> = new Map();
  for (const r of rawVariants) {
    const bucket: any[] = byName.get(r.name) ?? [];
    bucket.push(r);
    byName.set(r.name, bucket);
  }

  // 3) Pull all subraces
  const subracesList: any[] = Array.isArray(json.subrace) ? json.subrace : [];

  const out: ParsedMarkdownFile[] = [];
for (const entry of byName.entries() as Iterable<[string, any[]]>) {
  const [raceName, raceVariants] = entry;
  const safeName: string = slug(raceName);

    // 4) Pick the “fullest” variant for frontmatter
    const primary: any = raceVariants.reduce(
      (best: any, cur: any) =>
        Object.keys(cur).length > Object.keys(best).length ? cur : best,
      raceVariants[0]
    );

      if (!primary.ability && Array.isArray(subracesList)) {
    const humanEntry = subracesList.find((sr: any) =>
      // same race, same source
      sr.raceName   === raceName &&
      sr.raceSource === primary.source &&
      // but no "name" key at all
      !("name" in sr) &&
      // and it actually has ability bonuses
      Array.isArray(sr.ability)
    );
    if (humanEntry) {
      primary.ability = humanEntry.ability;
    }
  }

    // 5) Build & clean frontmatter
    const fm: any = buildFM(primary, SPECIES_META_DEFS);
    const senses: string[] = [];
    if (primary.darkvision)  senses.push(`Darkvision ${primary.darkvision} ft.`);
    if (primary.blindsight)  senses.push(`Blindsight ${primary.blindsight} ft.`);
    if (primary.tremorsense) senses.push(`Tremorsense ${primary.tremorsense} ft.`);
    if (primary.truesight)   senses.push(`Truesight ${primary.truesight} ft.`);
    if (senses.length) fm.senses = senses;

    if (Array.isArray(fm.traits)) {
      fm.traits = fm.traits.filter((t: string) => !BLOCKED_TRAITS.includes(t));
    }

    const yaml: string = serializeFrontmatter(fm, SPECIES_META_DEFS);

    // 6) Build the body
    const lines: string[] = [];
    lines.push(`# ${raceName}`, `## Stats`);

    // — Size
    const size = Array.isArray(primary.size)
      ? primary.size.map((s: string) => SIZE_MAP[s] || s).join("/")
      : SIZE_MAP[primary.size] ?? primary.size;
    lines.push(`**Size:** ${size}`);

    // — Speed
    const speedVal: number = typeof primary.speed === "number"
      ? primary.speed
      : primary.speed?.walk ?? primary.speed?.base ?? 0;
    lines.push(`**Speed:** ${speedVal} ft. walking`);

    // — Abilities
    const kids = subracesList.filter(
      sr =>
        sr.name &&
        sr.raceName === raceName &&
        sr.raceSource === primary.source
    );

    const rawAbility: any[] = Array.isArray(primary.ability)
      ? primary.ability
      : Array.isArray(kids[0]?.ability)
        ? kids[0].ability
        : [];

    if (Array.isArray(rawAbility) && rawAbility.length) {
      const bonuses = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
      let chooseOpt: any = null;

      for (const obj of rawAbility) {
        if ("choose" in obj) chooseOpt = obj.choose;
        else for (const [k, v] of Object.entries(obj)) {
          (bonuses as any)[k] += v as number;
        }
      }

      const parts = Object.entries(bonuses)
        .filter(([, v]) => v !== 0)
        .map(([k, v]) => `${k.toUpperCase()} ${v >= 0 ? "+" : ""}${v}`);

      if (chooseOpt?.count && Array.isArray(chooseOpt.from)) {
        const opts = (chooseOpt.from as string[]).map(s => s.toUpperCase());
        parts.push(`CHOOSE ${chooseOpt.count} from ${opts.join(", ")}`);
      }

      if (parts.length) {
        lines.push(`**Ability Scores:** ${parts.join(", ")}`);
      }
    }

    // — Languages
    const langs = fm.languages as string[] | undefined;
    if (langs?.length) {
      lines.push(`**Languages:** ${langs.join(", ")}`);
    }

    // — Skills
    if (Array.isArray(primary.skillProficiencies) && primary.skillProficiencies.length) {
      const skillLabels: string[] = [];
      for (const entry of primary.skillProficiencies as any[]) {
        if (entry.choose?.from) {
          const from = (entry.choose.from as string[]).map(s => s.charAt(0).toUpperCase() + s.slice(1));
          skillLabels.push(`Choose from: ${from.join(", ")}`);
        } else {
          const val = entry.proficiency ?? entry.name ?? entry;
          if (typeof val === "string") {
            skillLabels.push(val.charAt(0).toUpperCase() + val.slice(1));
          }
        }
      }
      lines.push(`**Skill Proficiencies:** ${skillLabels.join("; ")}`);
    }

    // — Tools / Weapons / Armor
    const toolProfs   = fm[FM_FIELDS.TOOL_PROFICIENCIES]   as string[]|undefined;
    const weaponProfs = fm[FM_FIELDS.WEAPON_PROFICIENCIES] as string[]|undefined;
    const armorProfs  = fm[FM_FIELDS.ARMOR_PROFICIENCIES]  as string[]|undefined;
    if (toolProfs?.length)   lines.push(`**Tool Proficiencies:**   ${toolProfs.join(", ")}`);
    if (weaponProfs?.length) lines.push(`**Weapon Proficiencies:** ${weaponProfs.join(", ")}`);
    if (armorProfs?.length)  lines.push(`**Armor Proficiencies:**  ${armorProfs.join(", ")}`);

    // — Traits
    lines.push(`## Traits`);
    const seen = new Set<string>();
    for (const trait of (fm.traits as string[]) || []) {
      lines.push(`##### ${trait}`);
      const ent = (primary.entries as any[]).find((e: any) => e.name === trait);
      if (ent?.entries) {
        ent.entries.forEach((sub: any, idx: number) => {
          let block: string|undefined;
          if (sub.type === "table") {
            block = renderMarkdownTable(sub);
          } else if (sub.type === "list") {
            block = sub.items
              .map((it: any) =>
                typeof it === "string"
                  ? `- ${replace5eTags(it).trim()}`
                  : `- ${it.name?.trim() ?? ""}${it.entry ? " "+replace5eTags(it.entry) : ""}`.trim()
              )
              .filter(Boolean)
              .join("\n");
          } else if (typeof sub === "string") {
            block = replace5eTags(sub).trim();
          }
          if (block && !seen.has(block)) {
            lines.push(block);
            seen.add(block);
            if (ent.entries.length > 1 && idx < ent.entries.length - 1) {
              lines.push("");
            }
          }
        });
      }
    }

    // 7) Inject Subraces (and skip any with no name)
    const matchedSubraces = subracesList.filter((sr: any) =>
      sr.name && sr.raceName === raceName && sr.raceSource === primary.source
    );
    if (matchedSubraces.length) {
      lines.push(`## Subraces`);
      for (const sr of matchedSubraces as any[]) {
        lines.push(``);
        lines.push(`---`);
        lines.push(`### ${sr.name}`);

        // — subrace ability
        if (Array.isArray(sr.ability)) {
          const bonuses = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
          let chooseOpt: any = null;
          for (const obj of sr.ability as any[]) {
            if ("choose" in obj) chooseOpt = obj.choose;
            else for (const [k, v] of Object.entries(obj)) {
              (bonuses as any)[k] += v as number;
            }
          }
          const parts = Object.entries(bonuses)
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => `${k.toUpperCase()} ${v >= 0 ? "+" : ""}${v}`);
          if (chooseOpt?.count && Array.isArray(chooseOpt.from)) {
            const opts = (chooseOpt.from as string[]).map(s => s.toUpperCase());
            parts.push(`CHOOSE ${chooseOpt.count} from ${opts.join(", ")}`);
          }
          if (parts.length) lines.push(`**Ability Scores:** ${parts.join(", ")}`);
        }

        // — subrace height & weight
        if (sr.heightAndWeight) {
          const hw: any = sr.heightAndWeight;
          lines.push(
            `**Height & Weight:** base ${hw.baseHeight}″ + ${hw.heightMod} / base ${hw.baseWeight} lbs + ${hw.weightMod}`
          );
        }

        // — subrace entries
        for (const entry of (sr.entries as any[]) || []) {
          lines.push(`##### ${entry.name}`);
          for (const sub of (entry.entries as any[]) || []) {
            if (sub.type === "table") {
              lines.push(renderMarkdownTable(sub));
            } else if (sub.type === "list") {
              lines.push(
                sub.items
                  .map((it: any) =>
                    typeof it === "string"
                      ? `- ${replace5eTags(it).trim()}`
                      : `- ${it.name?.trim() ?? ""}${it.entry ? " "+replace5eTags(it.entry) : ""}`.trim()
                  )
                  .filter(Boolean)
                  .join("\n")
              );
            } else if (typeof sub === "string") {
              lines.push(replace5eTags(sub).trim());
            }
          }
        }
      }
    }

    out.push({
      path:    `Species/${safeName}.md`,
      content: `---\n${yaml}\n---\n\n${lines.join("\n")}`,
    });
  }

  // 8) Sort and return
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
