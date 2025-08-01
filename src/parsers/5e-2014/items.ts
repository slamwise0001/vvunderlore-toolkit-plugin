import type { ParsedMarkdownFile } from "../../types";
import { replace5eTags }     from "./helpers/tagReplacer";
import { getFullSourceName } from "./helpers/sourceMap";
import { buildFM, serializeFrontmatter, ITEM_META_DEFS, FM_FIELDS } from "./helpers/frontmatter";


/** Helper to capitalize first letter – never crashes on non-strings */
function capitalizeFirst(input: any): string {
  // if it’s not a non-empty string, bail out
  if (typeof input !== "string" || input.length === 0) return "";
  const s = input.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}


export const DAMAGE_TYPE_MAP: Record<string,string> = {
  P: "Piercing",
  B: "Bludgeoning",
  S: "Slashing",
  N: "Necrotic",
  R: "Radiant",
  F: "Fire",
  C: "Cold",
  L: "Lightning",
  T: "Thunder",
  A: "Acid",
  H: "Healing",
  U: "Force",
  V: "Psychic",
};

export const PROPERTY_MAP: Record<string,string> = {
  A: "Ammunition",
  F: "Finesse",
  H: "Heavy",
  L: "Light",
  R: "Reload",
  S: "Special",
  "2H": "Two-Handed",
  T: "Thrown",
  V: "Versatile"
};

export const ITEM_TYPE_MAP: Record<string,string> = {
  $C:  "Currency",
  $G:  "Gem",
  A:   "Ammunition",
  "AIR|DMG": "Vehicle (air)",
  "AF|DMG": "Future Ammo",
  AT:  "Artisan Tools",
  EXP: "Explosive",
  FD:  "Food and Drink",
  G:   "Gear",
  GS:  "Game",
  HA:  "Heavy Armor",
  "IDG|TDCSR": "Illicit Drug",
  INS: "Instrument",
  LA:  "Light Armor",
  M:   "Weapon",
  MA:  "Medium Armor",
  MNT: "Mounts and Vehicles",
  ODH: "Miscellaneous",
  P:   "Consumable",
  R:   "Ranged Weapon",
  RD:  "Rod",
  RG:  "Ring",
  S:   "Shield",
  SC:  "Scroll",
  SCF: "Spell Casting Focus",
  SHP: "Ship",
  T:   "Tool",
  TAH: "Mounts and Vehicles",
  TG:  "Trade Goods",
  VEH: "Mounts and Vehicles",
  WD:  "Wand",
};

/** code → full folder path under Items/ */
const codeFolderMap: Record<string,string> = {
  // Weapons & Armor
  "A":   "Weapons and Armor/Ammunition",
  "M":   "Weapons and Armor/Weapons",
  "R":   "Weapons and Armor/Ranged Weapons",
  "S":   "Weapons and Armor/Shields",
  "LA":  "Weapons and Armor/Armor/Light Armor",
  "MA":  "Weapons and Armor/Armor/Medium Armor",
  "HA":  "Weapons and Armor/Armor/Heavy Armor",
  "EXP": "Weapons and Armor/Weapons/Explosives",
  // Future Ammo (AF|DMG → rawCode "AF")
  "AF":  "Weapons and Armor/Ammunition/Future Ammo",

  // Magical Items
  "RD":  "Magical Items/Rods",
  "RG":  "Magical Items/Rings",
  "SC":  "Magical Items/Scrolls",
  "SCF": "Magical Items/Spell Casting Focus",
  "WD":  "Magical Items/Wands",

  // Valuables
  "$G": "Valuables/Gems",
  // Currency (rawCode becomes "C" after stripping $)
  "C":  "Valuables/Currency",
  "TG": "Valuables/Trade Goods",

  // Artisan Goods
  "AT":  "Artisan Goods/Tools",
  "T":   "Artisan Goods/Tools",
  "INS": "Artisan Goods/Instruments",
  "GS":  "Artisan Goods/Games",

  // Gear & Mounts
  "G":   "Gear",
  // Mounts & Vehicles
  "MNT": "Gear/Mounts and Vehicles",
  "TAH": "Gear/Mounts and Vehicles",
  "VEH": "Gear/Mounts and Vehicles",
  // Air vehicles (AIR|DMG → rawCode "AIR")
  "AIR": "Gear/Mounts and Vehicles/Air",

  // Consumables
  "P":   "Consumables",
  // Food & Drink
  "FD":  "Consumables/Food and Drink",

  // Illicit Drugs (IDG|TDCSR → rawCode "IDG")
  "IDG": "Gear/Illicit Drugs",

  // Miscellaneous (ODH)
  "ODH": "Gear/Miscellaneous",
};

export function parseItemsFile(json: any, editionId: string): ParsedMarkdownFile[] {
  const rawItems: any[] = [];
  if (Array.isArray(json.baseitem)) rawItems.push(...json.baseitem);
  if (Array.isArray(json.item))     rawItems.push(...json.item);
  if (Array.isArray(json.object))   rawItems.push(...json.object);
  if (Array.isArray(json.vehicle))  rawItems.push(...json.vehicle);
  if (!rawItems.length) return [];

  const baseNames = new Set<string>(
    Array.isArray(json.baseitem) ? json.baseitem.map((b: any) => b.name) : []
  );
  const out: ParsedMarkdownFile[] = [];

  for (const it of rawItems) {
    const name     = it.name as string;
    const safeName = name.replace(/[\/\\:]/g, "-");

    // Determine folder
    const rawCode = (it.type as string || "").split("|")[0]
        .split("|")[0]      // drop anything after “|”
        .replace(/^\$/, ""); // strip leading “$”
    let folder    = codeFolderMap[rawCode] ?? "Miscellaneous";

    // Variants
    if (it.bonusWeapon) {
      folder = `${folder}/Variants`;
    }
    // Magical
    else {
      const isMagic = !!it.wondrous || !!it.reqAttune || !!it.req_attune
        || String(it.rarity).toLowerCase().includes("magic");
      if (isMagic) {
        const [ , ...rest ] = folder.split("/");
        folder = ["Magical Items", ...rest].join("/");
      }
    }

    // Weapon category subfolder
    if ((folder.startsWith("Weapons and Armor/Weapons") ||
         folder.startsWith("Weapons and Armor/Ranged Weapons")) && it.weaponCategory) {
      folder = `${folder}/${capitalizeFirst(it.weaponCategory)}`;
    }

    // make editionId available for the SOURCE field
(json as any)._editionId = editionId;

// build a Frontmatter object from the JSON
const fm   = buildFM(it, ITEM_META_DEFS);

// if the built frontmatter says this is a magical item…
if (fm[FM_FIELDS.MAGICAL]) {
  // …then add our Vermun flag
  fm[FM_FIELDS.VERMUN] = false;
}

if (rawCode === "M" && it.weaponCategory) {
  // “M” → use weaponCategory (“Simple”/“Martial”)
  fm.type = `${capitalizeFirst(it.weaponCategory)} Weapon`;
} else if (ITEM_TYPE_MAP[rawCode]) {
  // any other code → mapped label
  fm.type = ITEM_TYPE_MAP[rawCode];
}
if (Array.isArray(fm.damageTypes)) {
  fm.damageTypes = fm.damageTypes.map((code: string) =>
    DAMAGE_TYPE_MAP[code] || code
  );
}
// serialize it to YAML
let yaml = serializeFrontmatter(fm, ITEM_META_DEFS);

// if you still want packContents, append it here:
if (Array.isArray(it.packContents)) {
  yaml += "\npackContents:";
  for (const pc of it.packContents) {
    yaml += `\n  - item: "${pc.item}"\n    quantity: ${pc.quantity}`;
  }
}
 
// wrap it in the YAML fence
const frontmatter = `---\n${yaml}\n---`;


    // Body lines
    const lines: string[] = [];
    lines.push(`# ${name}`);
    lines.push("");

    // Subtitle
    const subtitle = it.weapon
      ? `${capitalizeFirst(it.weaponCategory)} Weapon`
      : it.armor
        ? folder.split("/").pop() || "Armor"
        : "";
    if (subtitle) lines.push(`### *${subtitle}*`);

    // Stats lines
    if (it.weapon) {
      lines.push(`**Category**: ${capitalizeFirst(it.weaponCategory)}`);
      lines.push(`**Damage**: ${it.dmg1 ?? ""}${it.dmg2 ? ` / ${it.dmg2}` : ""}`);
      const typesBody = (Array.isArray(it.dmgType) ? it.dmgType : [it.dmgType])
        .filter((t: any) => Boolean(t))
        .map((t: string) => DAMAGE_TYPE_MAP[t] || t);
      lines.push(`**Damage Type**: ${typesBody.join(", ")}`);
      lines.push(`**Range**: ${it.range ?? "—"}`);
      lines.push(`**Reload**: ${it.reload ?? "—"}`);
      if (it.ammoType) lines.push(`**Ammo Type**: ${it.ammoType}`);
      if (Array.isArray(it.property) && it.property.length) {
        const propsBody = it.property.map((p: string) => PROPERTY_MAP[p] || p);
        lines.push(`**Properties**: ${propsBody.join(", ")}`);
      }
    }
    if (it.armor) {
      lines.push(`**Armor Class**: ${it.ac}`);
      if (it.stealth) lines.push(`**Stealth Disadvantage**: true`);
      lines.push("");
    }

    // Description with nested entries
    const desc = it.entries ?? it.desc;
    if (desc) {
      for (const p of Array.isArray(desc) ? desc : [desc]) {
        if (typeof p === 'string') {
          for (const line of replace5eTags(p).split("\n")) {
            lines.push(line);
          }
          lines.push("");
        } else if (p && typeof p === 'object') {
          if (lines[lines.length - 1] === "") {
            lines.pop();
          }
          lines.push(`#### ${p.name}`);
          const sub = Array.isArray(p.entries) ? p.entries : [];
          for (const sp of sub) {
            for (const line of replace5eTags(sp).split("\n")) {
              lines.push(line);
            }
          }
          lines.push("");
        }
      }
    }

    const body = lines.join("\n");

    out.push({ path: `Items/${folder}/${safeName}.md`, content: `${frontmatter}\n\n${body}` });
  }

  return out.sort((a,b) => a.path.localeCompare(b.path));
}