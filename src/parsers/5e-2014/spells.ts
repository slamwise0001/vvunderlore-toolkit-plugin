//dnd 5e 2014 ed spells

import type { ParsedMarkdownFile } from "src/types";
import { replace5eTags } from "./helpers/tagReplacer";
import { getFullSourceName } from "./helpers/sourceMap";
import { renderMarkdownTable } from "./helpers/markdownTable";
import { formatEntry } from "./helpers/formatEntry";
import { buildFM, serializeFrontmatter, SPELL_META_DEFS, FM_FIELDS } from "./helpers/frontmatter";


export const SCHOOL_MAP: Record<string, string> = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
};

function ordinal(n: number): string {
  const suffix = (n === 1) ? "st" : (n === 2) ? "nd" : (n === 3) ? "rd" : "th";
  return `${n}${suffix}`;
}

export function formatRange(range: any): string {
  if (!range) return "";

  if (typeof range === "string") return range;

  if (range.type === "special") return "Special";
  if (range.type === "point" && range.distance) {
    const dist = range.distance;
    if (dist.type === "touch") return "Touch";
    if (dist.type === "self") return "Self";
    if (dist.type === "sight") return "Sight";
    if (dist.amount) return `${dist.amount} ${dist.type}`;
  }

  return "Varies";
}

export function formatTime(time: any[]): string {
  if (!Array.isArray(time)) return "";

  return time.map(t => `${t.number} ${t.unit}`).join(", ");
}

export function formatDuration(duration: any[]): string {
  if (!Array.isArray(duration)) return "";

  return duration.map(d => {
    if (d.type === "instant") return "Instantaneous";
    if (d.type === "timed" && d.duration) {
      return `${d.duration.amount} ${d.duration.type}${d.concentration ? " (concentration)" : ""}`;
    }
    if (d.type === "permanent") return "Permanent";
    return "Special";
  }).join(", ");
}
// in parsers/5e-json/parseSpellsFile.ts (or wherever formatComponents lives)

function formatComponents(components: any): string {
  if (!components) return "";

  const parts: string[] = [];

  if (components.v) parts.push("V");
  if (components.s) parts.push("S");

  if (components.m) {
    // pull out the actual material text(s)
    let matDetails: string[] = [];

    if (Array.isArray(components.m)) {
      matDetails = components.m
        .map((item:any) =>
          typeof item === "string"
            ? item
            : item && typeof item.text === "string"
            ? item.text
            : null
        )
        .filter((t:any): t is string => !!t);
    } else if (typeof components.m === "string") {
      matDetails = [components.m];
    } else if (components.m.text) {
      matDetails = [components.m.text];
    }

    // build the “M” entry, appending details if any
    const matPart =
      matDetails.length > 0
        ? `M (${matDetails.join(", ")})`
        : "M";

    parts.push(matPart);
  }

  return parts.join(", ");
}


export function parseSpellsFile(json: any, editionId: string): ParsedMarkdownFile[] {
  if (!json.spell) return [];

  // make editionId available for our SOURCE converter
  (json as any)._editionId = editionId;

  return json.spell.map((spell: any) => {
    // — gather data for header/body/footer as before —
    const sources = spell.source
      ? Array.isArray(spell.source) ? spell.source : [spell.source]
      : ["unknown"];
    const name = spell.name;
    const school = SCHOOL_MAP[spell.school] ?? spell.school;
    const level = spell.level;
    const range = formatRange(spell.range);
    const castingTime = formatTime(spell.time);
    const duration = formatDuration(spell.duration);
    const formattedSources = sources.map((s: string) => getFullSourceName(s, editionId));

    const attackType = spell.attackType || "";
    const damageType = spell.damageInflict?.[0] || "Teleportation";
    const ritual = spell.ritual === true;
    const concentration = spell.duration?.some((d: any) => d.concentration) ?? false;
    
    const FM   = buildFM(spell, SPELL_META_DEFS);
    const yaml = serializeFrontmatter(FM, SPELL_META_DEFS);
    const savingThrows = (FM[FM_FIELDS.SAVING_THROWS] as string[]) || [];
    const saveAttr = FM[FM_FIELDS.SAVE] as string | undefined;

    // — title/subtitle and body layout —
    const safeName = name.replace(/\//g, "-");
    const title = `# ${name}`;
    const levelLabel =
      level === 0
        ? `${school} Cantrip`
        : `${ordinal(level)}-level ${school} Spell`;
    const subtitle = `### *${levelLabel}*${concentration ? " *(Concentration)*" : ""}`;

    const headerLines = [
      title,
      subtitle,
      `**Casting Time:** ${castingTime}`,
      `**Range:** ${range}`,
      `**Components:** ${formatComponents(spell.components)}`,
      ...(savingThrows.length ? [`**Saving Throw:** ${savingThrows.join(", ")}`] : []),
      `**Duration:** ${duration}`,
    ];

    const bodyLines = [
      ...((spell.entries ?? []).map((e: any) => formatEntry(e))),
      ...((spell.entriesHigherLevel ?? []).map((e: any) => formatEntry(e))),
    ];

    const footerLines = [
      `---`,
      `**Source:** ${formattedSources.join(", ")}`,
    ];

    // — assemble the note with YAML frontmatter —
    return {
      path: `${safeName}.md`,
      content: [
        `---\n${yaml}\n---`,
        headerLines.join("\n"),
        ``,
        bodyLines.join("\n\n"),
        ``,
        footerLines.join("\n"),
      ].join("\n"),
    };
  });
}

