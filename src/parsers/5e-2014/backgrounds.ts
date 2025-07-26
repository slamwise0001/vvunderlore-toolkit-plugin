// src/parsers/backgrounds.ts
import type { ParsedMarkdownFile } from "../../types";
import { replace5eTags } from "./helpers/tagReplacer";
import { renderMarkdownTable } from "./helpers/markdownTable";
import { buildFM, serializeFrontmatter, FM_FIELDS, filterValidSkills, BACKGROUND_META_DEFS } from "./helpers/frontmatter";

/**
 * Parse backgrounds.json into one Markdown file per background under Player Build/Backgrounds,
 * excluding any “Variant…” or “Baldur’s Gate…” entries.
 */

export function parseBackgroundsFile(json: any, editionId: string): ParsedMarkdownFile[] {
  // pull in the array
  const raw: any[] = Array.isArray(json.background)
    ? json.background
    : Array.isArray(json.backgrounds)
    ? json.backgrounds
    : [];

  // filter out unwanted entries
  const backgrounds = raw.filter(bg => {
    const nm: string = bg.name || "";
    return !nm.startsWith("Variant") && !nm.includes("Baldur's Gate");
  });

  const outputs: ParsedMarkdownFile[] = [];

  backgrounds.forEach(bg => {
    const lines: string[] = [];

// ─── build frontmatter ───
const fm = buildFM(bg, BACKGROUND_META_DEFS);

// ─── collect only the entries flagged isFeature ───
const extraTraits: string[] = Array.isArray(bg.entries)
  ? (bg.entries as any[])
      .filter((e: any) => e.data?.isFeature && typeof e.name === "string")
      .map((e: any) => {
        const name = e.name.replace(/^Feature:\s*/, "");
        return `[[${bg.name}#${name}]]`;
      })
  : [];

// ─── serialize frontmatter ───
const yaml = serializeFrontmatter(fm, BACKGROUND_META_DEFS);
lines.push("---", yaml, "---", "");

 
    // title
    lines.push(`# ${bg.name}`, "");

    // ─── skill proficiencies ───
    if (Array.isArray(bg.skillProficiencies) && bg.skillProficiencies.length) {
      const skills: string[] = [];
      bg.skillProficiencies.forEach((ent: any) => {
        if (typeof ent === "string") {
          skills.push(cap(ent));
        } else if (ent.choose && Array.isArray(ent.choose.from)) {
          skills.push(`Choose ${ent.choose.amount} from ${ent.choose.from.join(", ")}`);
        } else {
          Object.entries(ent)
            .filter(([, v]) => v === true)
            .forEach(([k]) => skills.push(cap(k)));
        }
      });
      lines.push(`**Skill Proficiencies:** ${skills.join(", ")}`, "");
    }

    // ─── language proficiencies ───
    if (Array.isArray(bg.languageProficiencies) && bg.languageProficiencies.length) {
      const langs: string[] = [];
      bg.languageProficiencies.forEach((ent: any) => {
        if (ent.anyStandard) {
          langs.push(`${ent.anyStandard} of your choice`);
        } else {
          Object.entries(ent)
            .filter(([, v]) => v === true)
            .forEach(([k]) => langs.push(cap(k)));
        }
      });
      lines.push(`**Languages:** ${langs.join(", ")}`, "");
    }

    // ─── tool proficiencies ───
        if (Array.isArray(bg.toolProficiencies) && bg.toolProficiencies.length) {
        const tools: string[] = [];

        bg.toolProficiencies.forEach((ent: any) => {
            // “Choose X from …”
            if (ent.choose && Array.isArray(ent.choose.from)) {
            const list = ent.choose.from.map(humanize).join(", ");
            tools.push(`Choose ${ent.choose.count} from ${list}`);
            return;
            }

            // plain string (rare here, but just in case)
            if (typeof ent === "string") {
            tools.push(humanize(ent));
            return;
            }

            // object with boolean flags: gather *all* true keys
            Object.entries(ent)
            .filter(([_, v]) => v === true)
            .forEach(([k]) => tools.push(humanize(k)));
        });

        lines.push(`**Tool Proficiencies:** ${tools.join(", ")}`, "");
        }



    // ─── starting equipment ───
    if (Array.isArray(bg.startingEquipment) && bg.startingEquipment.length) {
      lines.push(`**Equipment:**`);
      bg.startingEquipment.forEach((grp: any) => {
        if (Array.isArray(grp._)) {
          grp._.forEach((it: any) => lines.push(`- ${fmtItem(it)}`));
        }
        ["a", "b"].forEach(key => {
          if (Array.isArray(grp[key])) {
            grp[key].forEach(it => lines.push(`- ${fmtItem(it)}`));
          }
        });
      });
      lines.push("");
    }

    // ─── all feature & entries blocks ───
    if (Array.isArray(bg.entries)) {
      bg.entries.forEach((entry: any) => {
        // skip the summary list block
        if (entry.type === "list" && entry.style === "list-hang-notitle") {
          return;
        }
        // section header
        if (entry.name) {
const header = entry.data?.isFeature
  ? entry.name.replace(/^Feature:\s*/, "")
  : entry.name;
lines.push(`## ${header}`, "");        }
        // entry content
        if (Array.isArray(entry.entries)) {
          entry.entries.forEach((e: any) => {
            if (typeof e === "string") {
              lines.push(replace5eTags(e), "");
            } else if (e.type === "list" && Array.isArray(e.items)) {
              e.items.forEach((it: any) =>
                lines.push(`- ${replace5eTags(it.entry ?? it)}`)
              );
              lines.push("");
            } else if (e.type === "table") {
              const tbl = renderMarkdownTable(e);
              if (tbl) lines.push(tbl, "");
            }
          });
        } else if (entry.type === "list" && Array.isArray(entry.items)) {
          entry.items.forEach((it: any) =>
            lines.push(`- ${replace5eTags(it.entry ?? it)}`)
          );
          lines.push("");
        }
      });
    }

    outputs.push({
      path: `Player Build/Backgrounds/${bg.name}.md`,
      content: lines.join("\n").trimEnd() + "\n",
    });
  });

  return outputs;
}

// ——— helpers ———
function cap(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


function fmtItem(item: any): string {
  // 1) raw string or tagged item
  if (typeof item === "string") {
    if (item.includes("|")) {
      return replace5eTags(`{@item ${item}}`);
    }
    return replace5eTags(item);
  }

  // 2) pure gold-piece entry: { value: 10 } or { containsValue: 1500 }
  const priceRaw = (item.containsValue ?? item.value) as number | undefined;
  if (
    typeof priceRaw === "number" &&
    // make sure it’s not also an “item” or “equipmentType”
    !item.item &&
    !item.equipmentType &&
    !item.special
  ) {
    const gp = priceRaw >= 100 ? priceRaw / 100 : priceRaw;
    return `${gp} gp`;
  }

  // 3) explicit item object with optional price
  if (item.item) {
    const link = replace5eTags(`{@item ${item.item}}`);
    if (typeof priceRaw === "number") {
      const gp = priceRaw >= 100 ? priceRaw / 100 : priceRaw;
      return `${link} (${gp} gp)`;
    }
    return link;
  }

  // 4) special-case text
  if (typeof item.special === "string") {
    return item.special;
  }

  // 5) known equipmentType keys
  if (item.equipmentType) {
    switch (item.equipmentType) {
      case "toolArtisan":
        return "One type of artisan’s tools (of your choice)";
      case "instrumentMusical":
        return "One type of musical instrument (of your choice)";
      case "setGaming":
        return "One set of gaming dice (of your choice)";
      default:
        return humanize(item.equipmentType);
    }
  }

  // 6) fallback: dump any leftover tag syntax
  return replace5eTags(JSON.stringify(item));
}



function humanize(str: string): string {
  const spaced = str.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
