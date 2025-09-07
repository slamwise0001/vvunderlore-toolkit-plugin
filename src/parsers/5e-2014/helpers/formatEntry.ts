//formatentry dnd 5e 2014
import { replace5eTags } from "./tagReplacer";
import { renderMarkdownTable } from "./markdownTable";

const ensurePeriod = (s: string) => (/[.!?]\s*$/.test(s) ? s : `${s}.`);

function renderList(list: any): string {
  const items = Array.isArray(list?.items) ? list.items : [];
  if (!items.length) return "";

  const lines: string[] = [];

  for (const it of items) {
    // simple string bullet
    if (typeof it === "string") {
      lines.push(`- ${replace5eTags(it)}`);
      continue;
    }

    // object bullet: name + entry/entries
    if (it && typeof it === "object") {
      const head =
        typeof it.name === "string" && it.name.trim()
          ? `***${ensurePeriod(replace5eTags(it.name))}***`
          : "";

      let body = "";
      if (typeof it.entry === "string") {
        body = replace5eTags(it.entry);
      } else if (Array.isArray(it.entries)) {
        body = it.entries
          .map((e: any) =>
            typeof e === "string" ? replace5eTags(e) : formatEntry(e)
          )
          .join(" ");
      }

      const line = [head, body].filter(Boolean).join(" ").trim();
      lines.push(`- ${line}`.trim());
      continue;
    }

    // final fallback (shouldn’t usually hit)
    lines.push(`- ${String(it ?? "")}`);
  }

  return lines.join("\n");
}

function renderTable(t: any): string {
  const headers: string[] = Array.isArray(t?.colLabels)
    ? t.colLabels.map((h: any) => replace5eTags(h))
    : [];

  const rows: string[][] = Array.isArray(t?.rows)
    ? t.rows.map((r: any) =>
        Array.isArray(r) ? r.map((cell: any) => replace5eTags(cell)) : []
      )
    : [];

  return renderMarkdownTable([headers, ...rows]);

}

/** Generic 5e.tools entry → markdown paragraph/bullets/etc. */
export function formatEntry(entry: any): string {
  // bare string
  if (typeof entry === "string") return replace5eTags(entry);

  // null/undefined or non-objects
  if (!entry || typeof entry !== "object") return String(entry ?? "");

  // explicit list → bullets
  if (entry.type === "list") {
    return renderList(entry);
  }

  // nested “entries” block; title if present
  if (entry.type === "entries") {
    const head =
      typeof entry.name === "string" && entry.name.trim()
        ? `***${ensurePeriod(replace5eTags(entry.name))}*** `
        : "";

    const body = Array.isArray(entry.entries)
      ? entry.entries.map((e: any) => formatEntry(e)).join("\n\n")
      : "";

    return (head + body).trim();
  }

  // table
  if (entry.type === "table") {
    return renderTable(entry);
  }

  // fallback: try common fields or stringify
  if (Array.isArray(entry.entries)) {
    return entry.entries.map((e: any) => formatEntry(e)).join("\n\n");
  }
  if (typeof entry.entry === "string") {
    return replace5eTags(entry.entry);
  }

  return replace5eTags(String(entry));
}
