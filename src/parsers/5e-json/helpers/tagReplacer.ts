// parsers/5e-json/helpers/tagReplacer.ts

export function replace5eTags(input: unknown): string {
  // 1) Turn arrays into space-joined strings
  // 2) Leave strings alone
  // 3) Coerce everything else to string (or empty)
  let text: string;
  if (Array.isArray(input)) {
    text = input.join(" ");
  } else if (typeof input === "string") {
    text = input;
  } else {
    text = String(input ?? "");
  }

  // now run all your @-tag replacements on that text
  return text
    .replace(/\{@(spell|item|creature|race) ([^|}]+)(?:\|[^}]+)?\}/g, (_, __, name) =>
      `[[${capitalizeEach(name)}]]`
    )
    .replace(/\{@(condition|status|action|skill) ([^|}]+)(?:\|[^}]+)?\}/g, (_, tag, name) =>
      `[[${capitalize(tag)}s#${name}|${capitalizeEach(name)}]]`
    )
    .replace(/\{@classFeature ([^|}]+)\|([^|}]+)(?:\|[^}]+)?\}/g, (_, feature, cls) =>
      `[[${cls}#${feature}]]`
    )
    .replace(/\{@(book|filter) ([^|}]+)(?:\|[^}]+)?\}/g, (_, __, txt) => txt)
    .replace(/\{@note ([^}]+)\}/g, (_, note) => `*${note}*`)
    .replace(/\{@(damage|dice|dc|hit|sense) ([^}]+)\}/g, (_, __, value) => value)
    .replace(/\{@chance ([^|}]+)(?:\|[^}]+)?\}/g, (_, value) => `${value}%`)
    .replace(/\{@quickref ([^|}]+)(?:\|[^|]*\|[^}]*)?\}/g, (_, term) => {
      const known = [
        "difficult terrain", "total cover", "half cover", "three-quarters cover",
        "heavily obscured", "lightly obscured"
      ];
      return known.includes(term.toLowerCase())
        ? `[[Rules#${capitalizeEach(term)}]]`
        : term;
    })
    .replace(/\{\@5etools\s+([^|}]+)\|[^}]+\}/g, '$1')
    .replace(/\{@recharge\s*([^}]+)\}/g, (_, num) => `(recharge: ${num.trim()})`)
    .replace(/\{@(scaledice|scaledamage)[^}]*\|([^|}]+)\}/g, (_, __, value) => value)
    .replace(/\{@d20[^}]*\}/g, "")
    .replace(/\{@[^}]+\}/g, "");
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function capitalizeEach(str: string): string {
  return str.split(" ").map(capitalize).join(" ");
}
