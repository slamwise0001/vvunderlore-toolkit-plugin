import { replace5eTags } from "./tagReplacer";

export function renderMarkdownTable(entry: any): string {
  if (entry.type !== "table" || !Array.isArray(entry.rows)) return "";

  const caption = entry.caption ? `##### ${entry.caption}\n` : "";

  const headers = (entry.colLabels ?? [])
    .map((h: string) => replace5eTags(h.trim())); // ✅ tag replace on headers

  const headerRow = `| ${headers.join(" | ")} |`;
  const dividerRow = `| ${headers.map(() => ":--").join(" | ")} |`;

  const bodyRows = entry.rows.map((row: any[]) => {
    const cells = row.map((cell) => {
      if (typeof cell === "string") return replace5eTags(cell); // ✅ tag replace strings

      if (typeof cell === "object") {
        if (cell.roll?.exact !== undefined) return `${cell.roll.exact}`;
        if (cell.roll?.min !== undefined && cell.roll?.max !== undefined) {
          return `${cell.roll.min}–${cell.roll.max}`;
        }
        return replace5eTags(JSON.stringify(cell)); // fallback for unknown shapes
      }

      return replace5eTags(String(cell));
    });

    return `| ${cells.join(" | ")} |`;
  });

  return `${caption}${headerRow}\n${dividerRow}\n${bodyRows.join("\n")}`;
}
