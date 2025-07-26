//5e 2025 rules

import type { ParsedMarkdownFile } from "../../types";
import { replace5eTags } from "./helpers/tagReplacer";

/**
 * Parse actions.json into a single Markdown note with ## headers for each action,
 * handling nested entries, insets, lists, tables, and adding separators.
 */
export function parseActionsFile(json: any, editionId: string): ParsedMarkdownFile[] {
  if (!Array.isArray(json.action)) return [];

  const lines: string[] = [];

  /** Recursively emit any block: text, list, table, entries/inset, or fallback */
  function emitBlock(block: any) {
    if (!block) return;

    // 1) Plain text paragraphs
    if (typeof block === "string") {
      for (const para of block.split(/\n{2,}/)) {
        const t = para.trim();
        if (t) {
          lines.push(replace5eTags(t));
          lines.push("");
        }
      }
      return;
    }

    // 2) Bullet list
    if (block.type === "list" && Array.isArray(block.items)) {
      for (const item of block.items) {
        lines.push(`- ${replace5eTags(item)}`);
      }
      lines.push("");
      return;
    }

    // 3) Table
    if (block.type === "table" && Array.isArray(block.rows)) {
      const headers = block.colLabels || [];
      lines.push(`| ${headers.join(" | ")} |`);
      lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
      for (const row of block.rows) {
        lines.push(`| ${row.join(" | ")} |`);
      }
      lines.push("");
      return;
    }

    // 4) Nested entries/inset
    if ((block.type === "entries" || block.type === "inset") && Array.isArray(block.entries)) {
      if (block.name) {
        if (lines[lines.length - 1] === "") lines.pop();
        lines.push(`### ${block.name}`);
      }
      for (const child of block.entries) {
        emitBlock(child);
      }
      return;
    }

    // 5) Fallback for any other object or array
    const txt = Array.isArray(block)
      ? block.join(" ")
      : typeof block === "object"
      ? JSON.stringify(block)
      : String(block);
    lines.push(replace5eTags(txt));
    lines.push("");
  }

  // Loop through each action
  for (const action of json.action) {
    lines.push(`## ${action.name}`);
    for (const entry of Array.isArray(action.entries) ? action.entries : [action.entries]) {
      emitBlock(entry);
    }

    // “See Also” section
    if (Array.isArray(action.seeAlsoAction)) {
      lines.push("**See Also:**");
      lines.push("");
      for (const ref of action.seeAlsoAction) {
        const [name] = String(ref).split("|");
        lines.push(`- [[${name}]]`);
      }
      lines.push("");
    }

    // Separator
    lines.push("---");
  }

  // Remove any double-blank lines
  const cleaned = lines.reduce<string[]>((acc, curr) => {
    if (curr === "" && acc.length && acc[acc.length - 1] === "") return acc;
    return acc.concat(curr);
  }, []);

  return [
    {
      path: "Rules and Reference/Actions.md",
      content: cleaned.join("\n").trim() + "\n",
    },
  ];
}

/**
 * Parse combined conditionsdiseases.json into two Markdown notes: Conditions.md and Diseases.md
 * adding separators between entries.
 */
export function parseConditionsDiseasesFile(json: any, editionId: string): ParsedMarkdownFile[] {
  const outputs: ParsedMarkdownFile[] = [];

  const processItems = (items: any[], outPath: string) => {
    const lines: string[] = [];

    for (const item of items) {
      // Top‐level header for each condition/disease
      lines.push(`## ${item.name}`);

      const entries = Array.isArray(item.entries) ? item.entries : [item.entries];
      for (const entry of entries) {
        if (!entry) continue;

        // 1) Plain text paragraphs
        if (typeof entry === "string") {
          for (const para of entry.split(/\n{2,}/)) {
            const t = para.trim();
            if (t) {
              lines.push(replace5eTags(t));
              lines.push("");
            }
          }
        }
        // 2) Bullet lists
        else if (entry.type === "list" && Array.isArray(entry.items)) {
          for (const txt of entry.items) {
            lines.push(`- ${replace5eTags(txt)}`);
          }
          lines.push("");
        }
        // 3) Tables
        else if (entry.type === "table" && Array.isArray(entry.rows)) {
          const headers = entry.colLabels || [];
          lines.push(`| ${headers.join(" | ")} |`);
          lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
          for (const row of entry.rows) {
            lines.push(`| ${row.join(" | ")} |`);
          }
          lines.push("");
        }
        // 4) Nested "entries" blocks
        else if (entry.type === "entries" && Array.isArray(entry.entries)) {
          // If this block has its own name, emit it
          if (entry.name) {
            lines.push(`### ${entry.name}`);
            for (const sub of entry.entries) {
              // Named sub‐block (e.g. "Can't See")
              if (sub.type === "entries" && sub.name && Array.isArray(sub.entries)) {
                if (lines[lines.length - 1] === "") lines.pop();
                lines.push(`#### ${sub.name}`);
                for (const txtEntry of sub.entries) {
                  const text = typeof txtEntry === "string"
                    ? replace5eTags(txtEntry)
                    : replace5eTags(String(txtEntry));
                  lines.push(text);
                  lines.push("");
                }
              }
              // Plain‐text sub‐entry
              else if (typeof sub === "string") {
                lines.push(replace5eTags(sub));
                lines.push("");
              }
            }
          } else {
            // Unnamed wrapper: just flatten its children
            for (const sub of entry.entries) {
              if (sub.type === "entries" && sub.name && Array.isArray(sub.entries)) {
                if (lines[lines.length - 1] === "") lines.pop();
                lines.push(`### ${sub.name}`);
                for (const txtEntry of sub.entries) {
                  const text = typeof txtEntry === "string"
                    ? replace5eTags(txtEntry)
                    : replace5eTags(String(txtEntry));
                  lines.push(text);
                  lines.push("");
                }
              } else if (typeof sub === "string") {
                lines.push(replace5eTags(sub));
                lines.push("");
              }
            }
          }
        }
        // 5) Anything else (fallback)
        else {
          const txt = Array.isArray(entry)
            ? entry.join(" ")
            : typeof entry === "object"
              ? JSON.stringify(entry)
              : String(entry);
          lines.push(replace5eTags(txt));
          lines.push("");
        }
      }

      // Separator between entries
      lines.push("---");
    }

    // Clean up any double‐blank lines
    const cleaned = lines.reduce<string[]>((acc, curr) => {
      if (curr === "" && acc.length && acc[acc.length - 1] === "") return acc;
      return acc.concat(curr);
    }, []);

    outputs.push({
      path: outPath,
      content: cleaned.join("\n").trim() + "\n",
    });
  };

  processItems(json.condition || [],   "Rules and Reference/Conditions.md");
  processItems(json.disease   || [],   "Rules and Reference/Diseases.md");
  return outputs;
}

/**
 * Parse senses.json into a single Markdown note with ## headers for each sense,
 * handling lists, tables, nested entries/insets, and separators.
 */
export function parseSensesFile(json: any, editionId: string): ParsedMarkdownFile[] {
  const items = Array.isArray(json.sense)
    ? json.sense
    : Array.isArray(json.senses)
    ? json.senses
    : [];
  if (!items.length) return [];

  const lines: string[] = [];

  function emitBlock(block: any) {
    if (!block) return;

    // 1) Plain‐text paragraph(s)
    if (typeof block === "string") {
      for (const para of block.split(/\n{2,}/)) {
        const t = para.trim();
        if (t) {
          lines.push(replace5eTags(t));
          lines.push("");
        }
      }
      return;
    }

    // 2) Bullet list (handles both string items and object items)
    if (block.type === "list" && Array.isArray(block.items)) {
      for (const item of block.items) {
        if (typeof item === "string") {
          lines.push(`- ${replace5eTags(item)}`);
          lines.push("");
        } else if (item && typeof item === "object") {
          // object items with name+entries
          if (item.name && Array.isArray(item.entries)) {
            lines.push(`- **${item.name}**`);
            for (const ent of item.entries) {
              lines.push(`  - ${replace5eTags(ent)}`);
            }
            lines.push("");
          } else {
            // fallback: stringify
            lines.push(`- ${replace5eTags(JSON.stringify(item))}`);
            lines.push("");
          }
        }
      }
      return;
    }

    // 3) Table
    if (block.type === "table" && Array.isArray(block.rows)) {
      const headers = block.colLabels || [];
      lines.push(`| ${headers.join(" | ")} |`);
      lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
      for (const row of block.rows) {
        lines.push(`| ${row.join(" | ")} |`);
      }
      lines.push("");
      return;
    }

    // 4) Nested entries / insets
    if ((block.type === "entries" || block.type === "inset") && Array.isArray(block.entries)) {
      // named block → "### Name"
      if (block.name) {
        if (lines[lines.length - 1] === "") lines.pop();
        lines.push(`### ${block.name}`);
      }
      // recurse into children
      for (const child of block.entries) {
        emitBlock(child);
      }
      return;
    }

    // 5) Fallback for arrays or other objects
    const txt =
      Array.isArray(block)
        ? block.join(" ")
        : typeof block === "object"
        ? JSON.stringify(block)
        : String(block);
    lines.push(replace5eTags(txt));
    lines.push("");
  }

  // Build out each sense
  for (const sense of items) {
    lines.push(`## ${sense.name}`);
    for (const entry of Array.isArray(sense.entries) ? sense.entries : [sense.entries]) {
      emitBlock(entry);
    }
    lines.push("---");
  }

  // Remove any double‐blank lines
  const cleaned = lines.reduce<string[]>((acc, curr) => {
    if (curr === "" && acc.length && acc[acc.length - 1] === "") return acc;
    return acc.concat(curr);
  }, []);

  return [
    {
      path: "Rules and Reference/Senses.md",
      content: cleaned.join("\n").trim() + "\n",
    },
  ];
}

/**
 * Parse skills.json into a single Markdown note with ## headers for each skill,
 * prepending an ability line, handling paragraphs, and separators.
 */
export function parseSkillsFile(json: any, editionId: string): ParsedMarkdownFile[] {
  const items = Array.isArray(json.skill)
    ? json.skill
    : Array.isArray(json.skills)
    ? json.skills
    : [];
  if (!items.length) return [];

  const lines: string[] = [];
  for (const skill of items) {
    lines.push(`## ${skill.name}`);
    if (skill.ability) {
      lines.push(`*Ability: ${skill.ability}*`);
      lines.push("");
    }
    const entries = Array.isArray(skill.entries) ? skill.entries : [skill.entries];
    for (const entry of entries) {
      if (!entry) continue;
      if (typeof entry === "string") {
        const paras = entry.split(/\n{2,}/);
        for (const para of paras) {
          const t = para.trim();
          if (t) {
            lines.push(replace5eTags(t));
            lines.push("");
          }
        }
      } else if (entry.type === "list" && Array.isArray(entry.items)) {
        for (const item of entry.items) {
          lines.push(`- ${replace5eTags(item)}`);
        }
        lines.push("");
      } else {
        const txt = Array.isArray(entry) ? entry.join(" ") : String(entry);
        lines.push(replace5eTags(txt));
        lines.push("");
      }
    }
    // Separator between skills
    lines.push("---");
  }
  const cleaned = lines.reduce<string[]>((acc, curr) => {
    if (curr === "" && acc.length && acc[acc.length - 1] === "") return acc;
    return acc.concat(curr);
  }, []);

  return [
    {
      path: "Rules and Reference/Skills.md",
      content: cleaned.join("\n").trim() + "\n",
    },
  ];
}
