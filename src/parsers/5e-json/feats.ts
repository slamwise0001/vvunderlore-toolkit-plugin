import type { ParsedMarkdownFile } from "../../types";
import { replace5eTags } from "./helpers/tagReplacer";
import { buildFM, serializeFrontmatter, FEATS_META_DEFS } from "./helpers/frontmatter";

/**
 * Parse feats.json into one Markdown file per feat under Player Build/Feats,
 * including frontmatter, cleaned prerequisites, and formatted entries.
 */
export function parseFeatsFile(json: any, editionId: string): ParsedMarkdownFile[] {
  const feats: any[] = Array.isArray(json.feat)
    ? json.feat
    : Array.isArray(json.feats)
    ? json.feats
    : [];

  return feats.map((feat: any) => {
    const lines: string[] = [];

    // ─── Frontmatter ───
    const fm = buildFM({ ...feat, _editionId: editionId }, FEATS_META_DEFS);
    lines.push("---");
    lines.push(serializeFrontmatter(fm, FEATS_META_DEFS));
    lines.push("---", "");

    // ─── Title ───
    lines.push(`# ${feat.name}`, "");

    // ─── Prerequisites ───
    const prereqs: string[] = [];
    if (Array.isArray(feat.prerequisite)) {
      feat.prerequisite.forEach((pr: any) => {
        if (pr.level) prereqs.push(`Level ${pr.level}`);
        if (Array.isArray(pr.feat)) {
          pr.feat.forEach((f: string) => {
            const name = f.split("|")[0].replace(/\b\w/g, c => c.toUpperCase());
            prereqs.push(`Prerequisite: [[${name}]]`);
          });
        }
      });
    }
    if (feat.spellcastingPrepared) prereqs.push(`Prerequisite: Spellcaster`);
    if (Array.isArray(feat.toolProficiencies)) {
      feat.toolProficiencies.forEach((tp: any) => {
        Object.entries(tp).forEach(([key]) => {
          if (key === 'anyArtisansTool') {
            prereqs.push(`Prerequisite: Proficient with an artisan's tool`);
          } else {
            prereqs.push(`Prerequisite: Proficient with ${key.replace(/([A-Z])/g,' $1').trim()}`);
          }
        });
      });
    }
    if (Array.isArray(feat.armorProficiencies)) {
      feat.armorProficiencies.forEach((arm: any) => {
        const armStr = typeof arm === 'string' ? arm : JSON.stringify(arm);
        prereqs.push(`Prerequisite: Proficient with ${armStr.replace(/([A-Z])/g,' $1').trim()}`);
      });
    }
    if (feat.race) prereqs.push(`Prerequisite: ${feat.race}`);

    if (prereqs.length) {
      lines.push("**Prerequisites**");
      prereqs.forEach(p => lines.push(`- ${p}`));
      lines.push("");
    }

    // ─── Entries rendering ───
    const entries = Array.isArray(feat.entries) ? feat.entries : [feat.entries];
    entries.forEach((entry: any) => {
      if (!entry) return;

      // Plain text
      if (typeof entry === 'string') {
        entry.split(/\n{2,}/).forEach(p => {
          const t = p.trim();
          if (t) {
            lines.push(replace5eTags(t));
            lines.push("");
          }
        });

      // List
      } else if (entry.type === 'list' && Array.isArray(entry.items)) {
        entry.items.forEach((it: any) => {
          if (typeof it === 'string') {
            lines.push(`- ${replace5eTags(it)}`);
          } else if (it.type === 'item' && it.name) {
            lines.push(`- **${it.name}**`);
            const subs = Array.isArray(it.entries) ? it.entries : [it.entries];
            subs.forEach((s: any) =>
              lines.push(`  - ${replace5eTags(typeof s === 'string' ? s : JSON.stringify(s))}`)
            );
          }
        });
        lines.push("");

      // Inset as indented bullet
      } else if (entry.type === 'inset') {
        lines.push(`- *${entry.name}*`);
        const subs = Array.isArray(entry.entries) ? entry.entries : [entry.entries];
        subs.forEach((s: any) => lines.push(`  - ${replace5eTags(s)}`));
        lines.push("");

      // Section or entries
      } else if ((entry.type === 'section' || entry.type === 'entries') && Array.isArray(entry.entries)) {
        if (entry.name) {
          lines.push(`## ${entry.name}`);
          lines.push("");
        }
        entry.entries.forEach((s: any) => {
          lines.push(replace5eTags(typeof s === 'string' ? s : JSON.stringify(s)));
          lines.push("");
        });

      // Table
      } else if (entry.type === 'table' && Array.isArray(entry.rows)) {
        const hdr = entry.colLabels || [];
        lines.push(`| ${hdr.join(' | ')} |`);
        lines.push(`| ${hdr.map(() => '---').join(' | ')} |`);
        entry.rows.forEach((row: any[]) =>
          lines.push(`| ${row.join(' | ')} |`)
        );
        lines.push("");
      }
    });

    return {
      path: `Player Build/Feats/${feat.name}.md`,
      content: lines.join("\n").trim() + "\n",
    };
  });
}
