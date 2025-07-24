// src/parsers/rules.ts
import type { ParsedMarkdownFile } from "../../types";
import { replace5eTags } from "./helpers/tagReplacer";

/**
 * Parse actions.json into a single Markdown note with ## headers for each action,
 * handling nested entries, insets, lists, tables, and adding separators.
 */
export function parseActionsFile(json: any, editionId: string): ParsedMarkdownFile[] {
  if (!Array.isArray(json.action)) return [];

  const lines: string[] = [];
  for (const action of json.action) {
    lines.push(`## ${action.name}`);
    const entries = Array.isArray(action.entries) ? action.entries : [action.entries];
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
      } else if ((entry.type === "entries" || entry.type === "inset") && Array.isArray(entry.entries)) {
        lines.push(`### ${entry.name}`);
        for (const sub of entry.entries) {
          if (typeof sub === "string") {
            const ps = sub.split(/\n{2,}/);
            for (const p of ps) {
              const tt = p.trim();
              if (tt) {
                lines.push(replace5eTags(tt));
                lines.push("");
              }
            }
          } else if (sub.type === "list" && Array.isArray(sub.items)) {
            for (const li of sub.items) {
              lines.push(`- ${replace5eTags(li)}`);
            }
            lines.push("");
          } else {
            const txt = Array.isArray(sub)
              ? sub.join(" ")
              : typeof sub === "object"
                ? JSON.stringify(sub)
                : String(sub);
            lines.push(replace5eTags(txt));
            lines.push("");
          }
        }
      } else if (entry.type === "table" && Array.isArray(entry.rows)) {
        const headers = entry.colLabels || [];
        lines.push(`| ${headers.join(" | ")} |`);
        lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
        for (const row of entry.rows) {
          lines.push(`| ${row.join(" | ")} |`);
        }
        lines.push("");
      } else {
        const txt = Array.isArray(entry)
          ? entry.join(" ")
          : typeof entry === "object"
            ? JSON.stringify(entry)
            : String(entry);
        lines.push(replace5eTags(txt));
        lines.push("");
      }
    }
    // Separator between actions
    lines.push("---");
  }
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
      lines.push(`## ${item.name}`);
      const entries = Array.isArray(item.entries) ? item.entries : [item.entries];
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
          for (const txt of entry.items) {
            lines.push(`- ${replace5eTags(txt)}`);
          }
          lines.push("");
        } else if (entry.type === "table" && Array.isArray(entry.rows)) {
          const headers = entry.colLabels || [];
          lines.push(`| ${headers.join(" | ")} |`);
          lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
          for (const row of entry.rows) {
            lines.push(`| ${row.join(" | ")} |`);
          }
          lines.push("");
        } else if (entry.type === "entries" && Array.isArray(entry.entries)) {
          lines.push(`### ${entry.name}`);
          for (const sub of entry.entries) {
            const txt = typeof sub === "string" ? sub : String(sub);
            lines.push(replace5eTags(txt));
            lines.push("");
          }
        } else {
          const txt = Array.isArray(entry) ? entry.join(" ") : String(entry);
          lines.push(replace5eTags(txt));
          lines.push("");
        }
      }
      // Separator between items
      lines.push("---");
    }
    const cleaned = lines.reduce<string[]>((acc, curr) => {
      if (curr === "" && acc.length && acc[acc.length - 1] === "") return acc;
      return acc.concat(curr);
    }, []);
    outputs.push({ path: outPath, content: cleaned.join("\n").trim() + "\n" });
  };
  processItems(json.condition || [], "Rules and Reference/Conditions.md");
  processItems(json.disease || [], "Rules and Reference/Diseases.md");
  return outputs;
}

/**
 * Parse senses.json into a single Markdown note with ## headers for each sense,
 * handling lists, tables, nested entries/insets, and separators.
 */
export function parseSensesFile(json: any, editionId: string): ParsedMarkdownFile[] {
  const items = Array.isArray(json.sense) ? json.sense : Array.isArray(json.senses) ? json.senses : [];
  if (!items.length) return [];

  const lines: string[] = [];
  for (const sense of items) {
    lines.push(`## ${sense.name}`);
    const entries = Array.isArray(sense.entries) ? sense.entries : [sense.entries];
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
      } else if ((entry.type === "entries" || entry.type === "inset") && Array.isArray(entry.entries)) {
        lines.push(`### ${entry.name}`);
        for (const sub of entry.entries) {
          const txt = typeof sub === "string" ? sub : String(sub);
          lines.push(replace5eTags(txt));
          lines.push("");
        }
      } else if (entry.type === "table" && Array.isArray(entry.rows)) {
        const headers = entry.colLabels || [];
        lines.push(`| ${headers.join(" | ")} |`);
        lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
        for (const row of entry.rows) {
          lines.push(`| ${row.join(" | ")} |`);
        }
        lines.push("");
      } else {
        const txt = Array.isArray(entry) ? entry.join(" ") : String(entry);
        lines.push(replace5eTags(txt));
        lines.push("");
      }
    }
    // Separator between senses
    lines.push("---");
  }
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
