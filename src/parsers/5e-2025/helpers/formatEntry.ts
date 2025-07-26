// 5e 2025 formatEntry.ts
import { replace5eTags } from "./tagReplacer";
import { renderMarkdownTable } from "./markdownTable";

function isTypedEntry(x: any): x is { type: string; [k: string]: any } {
  return (
    x != null &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    typeof (x as any).type === "string"
  );
}

export function formatEntry(entry: any): string {
  if (typeof entry === "string") {
    const cleaned = entry.trim();
    if (!cleaned || cleaned === "}") return "";
    return replace5eTags(cleaned);
  }

  if (isTypedEntry(entry) && entry.type === "entries" && Array.isArray(entry.entries)) {
    const body = entry.entries
      .map(formatEntry)
      .filter((str: string) => str.trim().length > 0)
      .join("\n\n");

    return entry.name
      ? `##### ${entry.name}\n${body}`
      : body;
  }

  if (isTypedEntry(entry) && entry.type === "list" && Array.isArray(entry.items)) {
    return entry.items
      .map((i: any) => `- ${replace5eTags(typeof i === "string" ? i : JSON.stringify(i))}`)
      .join("\n");
  }

  if (isTypedEntry(entry) && entry.type === "table" && Array.isArray(entry.rows)) {
    return renderMarkdownTable(entry);
  }

  if (isTypedEntry(entry) && entry.type === "quote" && Array.isArray(entry.entries)) {
    const quote = entry.entries.map(formatEntry).join(" ").trim();
    const author = entry.by ? ` — ${entry.by}` : "";
    return `*"${quote}${author}"*`;
  }

  if (isTypedEntry(entry) && entry.type === "inset" && Array.isArray(entry.entries)) {
    const inset = entry.entries.map(formatEntry).join("\n").trim();
    return `> ${inset.replace(/\n/g, "\n> ")}`;
  }

  if (isTypedEntry(entry) && entry.type === "refClassFeature" && typeof entry.classFeature === "string") {
    const [name] = entry.classFeature.split("|");
    const anchor = name
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    return `[[#${anchor}]]`;
  }

  // If it's an unknown object, skip it safely
  return "";
}
