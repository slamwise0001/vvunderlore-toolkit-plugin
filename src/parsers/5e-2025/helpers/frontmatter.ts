// frontmatter 5e 2025

import { getFullSourceName } from "./sourceMap";
import { formatSizeAbbrev, formatAlignmentAbbrev } from "../bestiary";
import { formatRange, formatTime, formatDuration, SCHOOL_MAP } from "../spells";
import { PROPERTY_MAP, DAMAGE_TYPE_MAP, ITEM_TYPE_MAP } from "../items";
import { replace5eTags } from "./tagReplacer";

function blankUndefined(val: any): any {
  return val === undefined ? "" : val;
}

export function cap(str: any): string {
  if (typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const ABILITY_FULL: Record<string,string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const SIZE_MAP: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan"
};

// ─── Universal frontmatter keys ───  
export const FM_FIELDS = {
  ABILITY_BONUSES:    "ability_bonuses",
  AC:                 "AC",
  ALIGNMENT:          "Alignment",
  AMMO_TYPE:          "Ammo Type",
  ARMOR_PROFICIENCIES:"armor-prof",
  ATTACK_TYPE:        "attack_type",
  ATTUNEMENT:         "Attunement",
  ATTUNE_REQ:         "Attune_Req",
  CASTING_TIME:       "casting_time",
  CHARISMA:           "charisma",
  CHA_MOD:            "cha_mod",
  CONCENTRATION:      "concentration",
  CONDITION_IMM:      "cond_immunity",
  CONSTITUTION:       "constitution",
  CON_MOD:            "con_mod",
  COST:               "cost",
  COMPONENTS:         "Components",
  CHALLENGE_RATING:   "CR",
  DAMAGE_TYPE:        "damage_type",
  DAMAGE_TYPES:       "damageTypes",
  DAMAGE:             "damage",
  DAMAGE_RES:         "dmg_resistance",
  DAMAGE_IMM:         "dmg_immunity",
  DEXTERITY:          "dexterity",
  DEX_MOD:            "dex_mod",
  DURATION:           "duration",
  RULESET:            "ruleset",
  HP:                 "HP",
  INTELLIGENCE:       "intelligence",
  INT_MOD:            "int_mod",
  LANGUAGES:          "languages",
  LEVEL:              "level",
  MAGICAL:            "magical",
  MATERIAL:           "material",
  NAME:               "name",
  PROPERTIES:         "properties",
  RANGE:              "range",
  RARITY:             "rarity",
  RELOAD:             "reload",
  RITUAL:             "ritual",
  SAVE:               "save",
  SAVING_THROWS:      "saving_throws",
  SCHOOL:             "school",
  SENSES:             "senses",
  SIZE:               "size",
  SKILLS:             "skills",
  SKILL_CHOICE_LIST:  "skill_choice_list",
  SOMATIC:            "somatic",
  SOURCE:             "source",
  SPECIES:            "species",
  SPEED:              "speed",
  SPELL_CAST_MOD:     "Spell Cast Mod",
  SPELL_RANGE:        "Range",
  STEALTH_DISADVANTAGE: "stealthDisadvantage",
  STRENGTH:           "strength",
  STR_MOD:            "str_mod",
  SUBRACES:           "subraces",
  TOOL_PROFICIENCIES: "tool-prof",
  TOOL_CHOICE_LIST:  "tool_choice_list",
  TRAITS:             "traits",
  TYPE:               "type",
  VARIANT:            "Variant",
  VERBAL:             "verbal",
  VERMUN:             "vermun",
  WEAPON_PROFICIENCIES: "weapon-prof",
  WEIGHT:             "weight",
  WISDOM:             "wisdom",
  WIS_MOD:            "wis_mod",
} as const;

export type FMKey = keyof typeof FM_FIELDS;
export type Frontmatter = Partial<Record<typeof FM_FIELDS[FMKey], unknown>>;

// ─── Definition of a single field mapping ───
export interface FieldDef {
  /** Which call‐sign (key in FM_FIELDS) */
  callSign: FMKey;
  /** Which JSON property to read */
  jsonKey:  string | string[];
  /** Optional transformer: raw JSON → final value */
  conv?:    (raw: any, allJson?: any) => unknown;
}

const unifiedArmorProfs = (val: any): string[] =>
  Array.isArray(val?.armor) ? val.armor.map(cap) :
  Array.isArray(val) ? val.map(cap) : [];

// frontmatter.ts

export function unifiedWeaponProfs(val: any): string[] {
  // pull the “weapons” array off either a raw array or a startingProficiencies object
  const rawArr: any[] = Array.isArray(val?.weapons)
    ? val.weapons
    : Array.isArray(val)
    ? val
    : [];

  const out = new Set<string>();

  function handleOne(entry: any) {
    if (Array.isArray(entry)) {
      // flatten nested arrays
      entry.forEach(handleOne);
      return;
    }

    if (typeof entry === "string") {
      const lit = entry.trim().toLowerCase();
      if (lit === "simple") {
        out.add("Simple Weapons");
      } else if (lit === "martial") {
        out.add("Martial Weapons");
      } else {
        // detect tagged items vs simple words
        const text = entry.startsWith("{@")
          ? replace5eTags(entry)
          : cap(entry);
        out.add(text);
      }
      return;
    }

    if (entry && typeof entry === "object" && entry.proficiency) {
      // { proficiency: "firearms", optional: true }
      const name = cap(entry.proficiency);
      out.add(entry.optional ? `${name} (optional)` : name);
    }
  }

  rawArr.forEach(handleOne);
  return [...out];
}


const unifiedSaves = (val: any): string[] => {
  if (Array.isArray(val)) {
      return val.map((k: string) =>
        ({ str: "Strength", dex: "Dexterity", con: "Constitution",
          int: "Intelligence", wis: "Wisdom", cha: "Charisma" }[k] ?? k.toUpperCase())
      );
  }
  if (typeof val === "object" && val !== null) {
    return Object.keys(val).map(k => k.toUpperCase());
  }
  return [];
};

export const unifiedSkills = (val: any): string[] => {
  // 1) “Bestiary” style: flat object mapping skill→modifier
  if (
    val &&
    !Array.isArray(val) &&
    typeof val === "object" &&
    // ensure every value is a string or number
    Object.values(val).every(v => typeof v === "string" || typeof v === "number")
  ) {
    return Object.entries(val).map(
      ([skill, mod]) => `${cap(skill)} ${mod}`.trim()
    );
  }

  // 2) nested under .skills / .skillProficiencies / .skillProf
  if (val && !Array.isArray(val) && typeof val === "object") {
    const nested = (val as any).skills
      ?? (val as any).skillProf
      ?? (val as any).skillProficiencies;
    return unifiedSkills(nested);
  }

  // 3) array-style
  if (!Array.isArray(val)) return [];

  const out = new Set<string>();
  for (const e of val) {
    // 3a) { any: N }
    if (e && typeof e === "object" && typeof (e as any).any === "number") {
      out.add(`Choose ${(e as any).any}`);
      continue;
    }
    // 3b) { choose: { count, … } }
    if (e && typeof e === "object" && (e as any).choose) {
      const cnt = (e as any).choose.count ?? 1;
      out.add(`Choose ${cnt}`);
    }
    // 3c) fixed flags foo: true
    if (e && typeof e === "object") {
      for (const [k, v] of Object.entries(e)) {
        if (v === true) out.add(cap(k));
      }
    }
    // 3d) literal strings
    if (typeof e === "string") {
      out.add(cap(e));
    }
  }

  return [...out];
};


 
export const unifiedToolProfs = (val: any): string[] => {
  // pull nested array if someone passed you the whole startingProficiencies obj
  let entries: any[] = Array.isArray(val) ? val
    : Array.isArray(val?.toolProficiencies) ? val.toolProficiencies
    : Array.isArray(val?.tools)             ? val.tools
    : [];

  const out = new Set<string>();
  let sawChoose = false;

  for (const e of entries) {
    if (typeof e === "string") {
      out.add(cap(e));
      continue;
    }

    if (e?.choose) {
      const cnt = e.choose.count ?? 1;
      sawChoose = true;
      out.add(`Choose ${cnt}`);
    }

    // pull out any fixed “foo: true” or numeric “anyFoo: N”
    for (const [k,v] of Object.entries(e)) {
      if (v === true) {
        out.add(cap(k));
      } else if (typeof v === "number" && k.startsWith("any")) {
        // e.g. anyArtisansTool:1
        const raw = k.replace(/^any/, "");
        const spaced = raw
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .split(" ")
          .map(cap)
          .join(" ");
        out.add(`Choose ${v} ${spaced}`);
      }
    }
  }

  return [...out];
};

export const ALL_FIELD_DEFS: FieldDef[] = [
  // ─── Core ───
  { callSign: "NAME",  jsonKey: "name" },
{
  callSign: "SOURCE",
  jsonKey: ["source"],
  conv: (raw: any, allJson: any): string[] => {
    const out = new Set<string>();
    const editionId = (allJson as any)._editionId;

    // 1) primary source(s)
    const arr = Array.isArray(raw) ? raw : [raw];
    arr.forEach(src => {
      out.add(getFullSourceName(src, editionId));
    });

    // 2) any otherSources entries
    for (const os of allJson.otherSources ?? []) {
      if (os && typeof os.source === "string") {
        out.add(getFullSourceName(os.source, editionId));
      }
    }

    // 3) reprintedAs entries (guard before splitting)
    for (const rep of allJson.reprintedAs ?? []) {
      // ensure we have a string to split
      const repStr = typeof rep === "string" ? rep : String(rep);
      const parts = repStr.split("|");
      // if there's no pipe, parts[1] will be undefined, so fallback to parts[0]
      const src = parts[1] ?? parts[0];
      out.add(getFullSourceName(src, editionId));
    }

    return [...out];
  }
},


  // ─── Proficiencies ───
  { callSign: "ARMOR_PROFICIENCIES",  jsonKey: ["armorProficiencies", "armorProfs", "startingProficiencies"], conv: unifiedArmorProfs },
  { 
    callSign: "WEAPON_PROFICIENCIES",
    jsonKey: ["weaponProficiencies","weaponProfs","startingProficiencies"],
    conv: unifiedWeaponProfs
  },
  { callSign: "TOOL_PROFICIENCIES",   jsonKey: ["toolProficiencies", "toolProfs", "startingProficiencies"], conv: unifiedToolProfs },
  {
    callSign: "TOOL_CHOICE_LIST",
    jsonKey: ["toolProficiencies", "toolProfs", "startingProficiencies"],
    conv: (raw: any) => {
      const arr = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.toolProficiencies)
        ? raw.toolProficiencies
        : Array.isArray(raw?.tools)
        ? raw.tools
        : [];
      const choice = arr.find((e: any) => e?.choose);
      return choice?.choose?.from?.map((s: string) => cap(s)) ?? [];
    }
  },
  { callSign: "SAVING_THROWS",        jsonKey: ["save", "proficiency"], conv: unifiedSaves },
  {
    callSign: "SKILLS",
    jsonKey: ["skill", "skillProf", "skillProficiencies", "startingProficiencies"],
    conv: unifiedSkills
  },

  {
    callSign: "SKILL_CHOICE_LIST",
    jsonKey: ["skill", "skillProf", "skillProficiencies", "startingProficiencies"],
    conv: (raw: any) => {
      // normalize into an array of entries
      const arr: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.skillProficiencies)
        ? raw.skillProficiencies
        : Array.isArray(raw?.skills)
        ? raw.skills
        : Array.isArray(raw?.skillProf)
        ? raw.skillProf
        : [];

      // find the one entry that represents the “choose” bucket
      const choiceObj = arr.find(e => e?.choose || typeof e.any === "number");
      if (!choiceObj) return [];

      // explicit “choose from [ ... ]”
      if (choiceObj.choose && Array.isArray(choiceObj.choose.from)) {
        return choiceObj.choose.from.map(cap);
      }

      // the “any: 3” shorthand → offer every skill
      if (typeof choiceObj.any === "number") {
        // SKILL_OPTIONS is your const ["Acrobatics", "Animal Handling", …]
        return SKILL_OPTIONS;
      }

      return [];
    }
  },
  { callSign: "SPELL_CAST_MOD",jsonKey: "spellcastingAbility",  
    conv: (raw) => {
    // raw might be "cha" or "CHA"
    const key = String(raw).toLowerCase();
    return ABILITY_FULL[key] || key.toUpperCase();
  }},


  // ─── Spells ───
  { callSign: "LEVEL",         jsonKey: "level" },
  { callSign: "SCHOOL",        jsonKey: "school",   conv: s => SCHOOL_MAP[s] ?? s },
  { callSign: "CASTING_TIME",  jsonKey: "time",     conv: formatTime },
  { callSign: "SPELL_RANGE",   jsonKey: "range",    conv: formatRange },
  { callSign: "DURATION",      jsonKey: "duration", conv: formatDuration },
  { callSign: "VERBAL",        jsonKey: "components", conv: (c:any) => !!c.v },
  { callSign: "SOMATIC",       jsonKey: "components", conv: (c:any) => !!c.s },
  { callSign: "MATERIAL",      jsonKey: "components", conv: (c:any) => !!c.m },
  { callSign: "COMPONENTS",
    jsonKey:  "components",
    conv: (c: any): string[] => {
      if (!c.m) return [];

      const raw = Array.isArray(c.m) ? c.m : [c.m];

      return raw
        .map((item: any): string | null => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && typeof item.text === "string") {
            return item.text;
          }
          return null;
        })
        .filter((comp: string | null): comp is string => comp !== null);
    }
  }, 
  { callSign: "ATTACK_TYPE",   jsonKey: "attackType" },
  { callSign: "DAMAGE_TYPE",   jsonKey: "damageInflict", conv: d => Array.isArray(d) ? d[0] : d },
  { callSign: "RITUAL",        jsonKey: "ritual" },
  { callSign: "CONCENTRATION", jsonKey: "duration", conv: ds => Array.isArray(ds) && ds.some((x:any)=> x.concentration) },
  { callSign: "SAVE",          jsonKey: "saveAttr" },

  // ─── Species / Creatures ───
  { callSign: "SPECIES", jsonKey: "name" },
  { callSign: "SIZE", jsonKey: "size", conv: (raw: any) => {
      // handle ["S","M"] or just "L"
      if (Array.isArray(raw)) {
        return raw.map(r => SIZE_MAP[r] || r);
      } else {
        return SIZE_MAP[raw] || raw;
      }
    }
  },
    {
  callSign: "SPEED",
  jsonKey:   "speed",
  conv: (sp: number | Record<string, any>) => {
    // handle both numeric speeds and object speeds
    if (typeof sp === "number") {
      return [`Walk ${sp} ft.`];
    }
    if (!sp || typeof sp !== "object") return [];
    return Object.entries(sp)
      .filter(([mode]) => mode !== "canHover")
      .map(([mode, v]) => {
        const n = typeof v === "object" && v !== null && "number" in v ? (v as any).number : v;
        const label = mode === "walk" ? "Walk" : cap(mode);
        return `${label} ${n} ft.`;
      });
  },
},
{ callSign: "LANGUAGES", jsonKey: ["languages", "languageProficiencies"], conv: arr => {
      if (!Array.isArray(arr)) return [];
      const out: string[] = [];
      for (const lp of arr) {
        if (typeof lp === "string") out.push(cap(lp));
        else if (typeof lp === "object") {
          for (const [lang, val] of Object.entries(lp)) {
            if (val) out.push(cap(lang));
          }
        }
      }
      return [...new Set(out)];
  }},
  { callSign: "SENSES", jsonKey: "senses", conv: sen => {
      if (Array.isArray(sen)) return sen.map((s:string)=>s.replace(/^\d+\s*/,"").replace(/^./,c=>c.toUpperCase()));
      if (sen && typeof sen==="object") return Object.entries(sen).map(([k,v])=>`${k.charAt(0).toUpperCase()+k.slice(1)} ${v}`);
      return [];
  }}, 
{
  callSign: "TRAITS",
  jsonKey: ["classFeatures", "entries"],
  conv: (raw: any, allJson: any): string[] => {
    // pull the class record so we know its display name
    const clsRec = Array.isArray(allJson.class) ? allJson.class[0] : allJson;
    const className = typeof clsRec.name === "string" ? clsRec.name : "";

    // names we never want to emit
    const omit = new Set([
      "Ability Score Improvement",
      "Archetype Feature",
      "Subclass Feature",
      // add more if you like…
    ]);
    const seen = new Set<string>();

    // 1) if there's a classFeatures array, use it
    if (Array.isArray(allJson.classFeatures)) {
      return allJson.classFeatures.flatMap((feat: any) => {
        // skip subclass‐injected features entirely
        if (feat && typeof feat === "object" && feat.gainSubclassFeature) return [];

        // normalize to a string
        const rawName =
          typeof feat === "string"
            ? feat
            : typeof feat.classFeature === "string"
            ? feat.classFeature
            : "";

        // drop everything after the first “|”
        const name = rawName.split("|")[0].trim();
        if (!name || omit.has(name) || seen.has(name)) return [];
        seen.add(name);

        // build a nice anchor (must match your headers)
        const anchor = name
          .replace(/[^\w\s]/g, "")    // strip punctuation
          .replace(/\s+/g, " ")       // collapse spaces
          .trim()
          .replace(/\b\w/g, (c: any) => c.toUpperCase()); // Title Case

        // produce a file-anchor link
        return `[[${className}#${anchor}|${name}]]`;
      });
    }

    // 2) otherwise fall back to your old entries-based logic
    const ents = Array.isArray(raw) ? raw : [];
    const featureNames = ents
      .filter((e: any) => e?.data?.isFeature && typeof e.name === "string")
      .map((e: any) => e.name.replace(/^Feature:\s*/, "").trim());
    if (featureNames.length) return featureNames;

    return ents
      .filter((e: any) => e && typeof e.name === "string")
      .map((e: any) => e.name.replace(/^Feature:\s*/, "").trim());
  },
},


  { callSign: "AC", jsonKey: "ac", conv: a => Array.isArray(a)?a[0].ac:a },
  { callSign: "HP", jsonKey: "hp", conv: hp => hp?.average ?? hp },
  { callSign: "CHALLENGE_RATING", jsonKey: "cr" },
  { callSign: "STRENGTH",     jsonKey: "ability", conv: arr=>Array.isArray(arr)?arr[0]:arr?.str ?? 0 },
  { callSign: "DEXTERITY",    jsonKey: "ability", conv: arr=>Array.isArray(arr)?arr[1]:arr?.dex ?? 0 },
  { callSign: "CONSTITUTION", jsonKey: "ability", conv: arr=>Array.isArray(arr)?arr[2]:arr?.con ?? 0 },
  { callSign: "INTELLIGENCE", jsonKey: "ability", conv: arr=>Array.isArray(arr)?arr[3]:arr?.int ?? 0 },
  { callSign: "WISDOM",       jsonKey: "ability", conv: arr=>Array.isArray(arr)?arr[4]:arr?.wis ?? 0 },
  { callSign: "CHARISMA",     jsonKey: "ability", conv: arr=>Array.isArray(arr)?arr[5]:arr?.cha ?? 0 },
  {
    callSign: "ALIGNMENT",
    jsonKey: "alignment",
    conv: (a: any) => {
      const raw = Array.isArray(a) ? a.join(" ") : typeof a === "string" ? a : String(a);
      const cleaned = raw
        .replace(/\bA\b/g, "Any")
        .replace(/\bU\b/g, "Unaligned")
        .replace(/\bN\b/g, "Neutral")
        .replace(/\bL\b/g, "Lawful")
        .replace(/\bC\b/g, "Chaotic")
        .replace(/\bG\b/g, "Good")
        .replace(/\bE\b/g, "Evil");

      return formatAlignmentAbbrev(cleaned); // reuse your normalizer if it exists
    }
  },
    {
      callSign: "TYPE",
      jsonKey: "type",
      conv: (t: any): string | undefined => {
        // 1) If it’s a simple string code, map it
        if (typeof t === "string") {
          // direct lookup—if no mapping, just title‐case the code
          return ITEM_TYPE_MAP[t] ?? cap(t);
        }

        // 2) If it’s an object with a .type tag
        if (t && typeof t === "object") {
          const code = String(t.type || "").toUpperCase();
          // try the map first
          if (ITEM_TYPE_MAP[code]) {
            return ITEM_TYPE_MAP[code];
          }
          // otherwise fall back to “Base (tags…)” style
          const base = t.type ? cap(t.type) : "Unknown";
          const tags = Array.isArray(t.tags) ? t.tags.map(cap) : [];
          return tags.length ? `${base} (${tags.join(", ")})` : base;
        }

        return undefined;
      }
    },


  // ─── Items ───
  { callSign: "TYPE",   jsonKey: "_parsedType" },
  { callSign: "RARITY", jsonKey: "rarity", conv: r => {
      const s = String(r||"").toLowerCase();
      return s && s!=="none" ? s[0].toUpperCase()+s.slice(1) : undefined;
  }},
  {
    callSign: "COST",
    jsonKey: "value",
    conv: (raw: any) => {
      const s = String(raw).trim().toLowerCase();
      let num: number;

      // explicit copper?
      if (s.endsWith("cp")) {
        num = parseFloat(s);
        // convert to gp only if 100+ cp
        return num >= 100
          ? `${Math.round((num/100) * 100)/100}gp`
          : `${num}cp`;
      }

      // explicit silver?
      if (s.endsWith("sp")) {
        num = parseFloat(s);
        // convert to gp only if 10+ sp
        return num >= 10
          ? `${Math.round((num/10) * 100)/100}gp`
          : `${num}sp`;
      }

      // explicit gold?
      if (s.endsWith("gp")) {
        num = parseFloat(s);
        return `${Math.round(num * 100)/100}gp`;
      }

      // bare number → assume copper
      num = parseFloat(s) || 0;
      return num >= 100
        ? `${Math.round((num/100) * 100)/100}gp`
        : `${num}cp`;
    }
  },
  { callSign: "WEIGHT", jsonKey: "weight" },
  { callSign: "MAGICAL", jsonKey: "wondrous", conv: (_w,all) => !!all.wondrous || !!all.reqAttune },
  { callSign: "VARIANT", jsonKey: "bonusWeapon", conv: b => typeof b==="string" && b.startsWith("+") },
  { callSign: "PROPERTIES", jsonKey: "property", conv: arr => Array.isArray(arr) ? arr.map(p => PROPERTY_MAP[p] || p) : [] },
  { callSign: "DAMAGE", jsonKey: "dmg1", conv: (d,all) => d ? all.dmg2 ? `${d} / ${all.dmg2}` : `${d}` : undefined },
  { callSign: "DAMAGE_TYPES", jsonKey: "dmgType", conv: dt => dt == null ? [] : Array.isArray(dt) ? dt : [dt] },
  { callSign: "RANGE", jsonKey: "range" },
  { callSign: "RELOAD", jsonKey: "reload" },
  { callSign: "AMMO_TYPE", jsonKey: "ammoType" },
  { callSign: "STEALTH_DISADVANTAGE", jsonKey: "stealth" },
  {
    callSign: "ATTUNEMENT",
    jsonKey: ["wondrous", "reqAttune", "req_attune", "reqAttuneTags"],
    conv: (_raw, allJson) => {
      const j = allJson as any;
      const hasText = typeof j.reqAttune === "string" && j.reqAttune.trim() !== "";
      const hasTags = Array.isArray(j.reqAttuneTags) && j.reqAttuneTags.length > 0;
      return hasText || hasTags;
    }
  },
    {
    callSign: "ATTUNE_REQ",
    jsonKey: "reqAttuneTags",
    conv: (tags: any[] = [], _all) => {
      const mapLetter: Record<string,string> = {
        A: "Any", U: "Unaligned", N: "Neutral",
        L: "Lawful", C: "Chaotic", G: "Good", E: "Evil"
      };
      const reqs: string[] = [];

      for (const tag of tags) {
        if (tag.class && Array.isArray(tag.alignment)) {
          const cls = cap(tag.class);
          for (const code of tag.alignment) {
            reqs.push(`${mapLetter[code] || code} ${cls}`);
          }
        } else if (tag.class) {
          reqs.push(cap(tag.class));
        } else if (Array.isArray(tag.alignment)) {
          for (const code of tag.alignment) {
            reqs.push(mapLetter[code] || code);
          }
        } else if (tag.background) {
          const [bg] = String(tag.background).split("|");
          reqs.push(bg.split(" ").map(cap).join(" "));
        } else if (tag.spellcasting) {
          reqs.push("Spellcaster");
        }
      }

      return Array.from(new Set(reqs));
    }
  },
    {
    callSign: "VERMUN",
    jsonKey: "wondrous",            // or whatever property you use to detect “magical”
    conv: (_raw, all) => !!all.wondrous || !!all.reqAttune
  },
  // ─── Other ───
  { callSign: "DAMAGE_RES", jsonKey: "resist", conv: v => Array.isArray(v) ? v.map(cap) : [] },
{
  callSign: "RULESET",
  jsonKey: "name",
  // ignore the raw value, always print HELLO
  conv: (_raw, _all) => "D&D 5e (2025)",
}, 
    // ─── Ability‐score modifiers (only emit when nonzero) ───
  {
    callSign: "STR_MOD",
    jsonKey:  "ability",
    conv: (arr: any): number | undefined => {
      const v = Array.isArray(arr) ? (arr[0].str ?? 0) : (arr.str ?? 0);
      return v !== 0 ? v : undefined;
    },
  },
  {
    callSign: "DEX_MOD",
    jsonKey:  "ability",
    conv: (arr: any): number | undefined => {
      const v = Array.isArray(arr) ? (arr[0].dex ?? 0) : (arr.dex ?? 0);
      return v !== 0 ? v : undefined;
    },
  },
  {
    callSign: "CON_MOD",
    jsonKey:  "ability",
    conv: (arr: any): number | undefined => {
      const v = Array.isArray(arr) ? (arr[0].con ?? 0) : (arr.con ?? 0);
      return v !== 0 ? v : undefined;
    },
  },
  {
    callSign: "INT_MOD",
    jsonKey:  "ability",
    conv: (arr: any): number | undefined => {
      const v = Array.isArray(arr) ? (arr[0].int ?? 0) : (arr.int ?? 0);
      return v !== 0 ? v : undefined;
    },
  },
  {
    callSign: "WIS_MOD",
    jsonKey:  "ability",
    conv: (arr: any): number | undefined => {
      const v = Array.isArray(arr) ? (arr[0].wis ?? 0) : (arr.wis ?? 0);
      return v !== 0 ? v : undefined;
    },
  },
  {
    callSign: "CHA_MOD",
    jsonKey:  "ability",
    conv: (arr: any): number | undefined => {
      const v = Array.isArray(arr) ? (arr[0].cha ?? 0) : (arr.cha ?? 0);
      return v !== 0 ? v : undefined;
    },
  },


];


// ─── Generic builder ───
export function buildFM(json: any, defs: FieldDef[]): Frontmatter {
  const fm: Frontmatter = {};
  for (const { callSign, jsonKey, conv } of defs) {
    const keys = Array.isArray(jsonKey) ? jsonKey : [jsonKey];
    let raw: any = undefined;

    for (const key of keys) {
      if (json[key] != null) {
        raw = json[key];
        break;
      }
    }

    if (raw == null) continue;
    const val = conv ? conv(raw, json) : raw;
    fm[FM_FIELDS[callSign]] = val;
  }
  return fm;
}

// frontmatter.ts

export function serializeFrontmatter(
  fm: Frontmatter,
  defs?: FieldDef[]
): string {
  const filtered: Record<string, any> = {};

  // detect if we have any actual choice-lists
  const hasSkillChoice = Array.isArray(fm[FM_FIELDS.SKILL_CHOICE_LIST]) 
    && (fm[FM_FIELDS.SKILL_CHOICE_LIST] as any[]).length > 0;
  const hasToolChoice = Array.isArray(fm[FM_FIELDS.TOOL_CHOICE_LIST]) 
    && (fm[FM_FIELDS.TOOL_CHOICE_LIST] as any[]).length > 0;


  for (const [k, v] of Object.entries(fm)) {
    // 1) never emit undefined
    if (v === undefined) continue;
    // 2) drop empty COMPONENTS, TOOL_CHOICE_LIST, SKILL_CHOICE_LIST
    if (k === FM_FIELDS.COMPONENTS && Array.isArray(v) && v.length === 0) continue;
    if (
      (k === FM_FIELDS.TOOL_CHOICE_LIST || k === FM_FIELDS.SKILL_CHOICE_LIST) &&
      Array.isArray(v) && v.length === 0
    ) continue;

    filtered[k] = v;
  }

  // build the list of keys in the exact order from defs
  let keysToEmit: string[];
  if (defs) {
    // map each FieldDef to its frontmatter key
    const wanted = defs.map(d => FM_FIELDS[d.callSign]);
    // only keep the ones we actually have, in order
    keysToEmit = wanted.filter(k => k in filtered);
    // then append any extra keys that weren't in defs
    keysToEmit.push(
      ...Object.keys(filtered).filter(k => !keysToEmit.includes(k))
    );
  } else {
    keysToEmit = Object.keys(filtered);
  }

  // now emit YAML in that order
  return keysToEmit
    .map(k => {
      const v = filtered[k];
      if (Array.isArray(v)) {
        // JSON.stringify to handle spaces, commas, etc.
        const inline = v.map(item => JSON.stringify(item)).join(", ");
        return `${k}: [${inline}]`;
      }
      if (typeof v === "string") {
        return `${k}: "${v}"`;
      }
      return `${k}: ${v}`;
    })
    .join("\n");
}


// ─── Skill helpers ───
export const SKILL_OPTIONS = [
  "Acrobatics","Animal Handling","Arcana","Athletics","Deception","History",
  "Insight","Intimidation","Investigation","Medicine","Nature","Perception",
  "Performance","Persuasion","Religion","Sleight of Hand","Stealth","Survival",
] as const;
export type SkillOption = typeof SKILL_OPTIONS[number];
export function normalizeSkill(raw: string): SkillOption | null {
  const lower = raw.trim().toLowerCase();
  return SKILL_OPTIONS.find(skill => skill.toLowerCase() === lower) ?? null;
}
export function filterValidSkills(rawArr: any[]): SkillOption[] {
  if (!Array.isArray(rawArr)) return [];
  const seen = new Set<SkillOption>();
  for (const ent of rawArr) {
    let candidate: string | undefined;
    if (typeof ent === "string") candidate = ent;
    else if (ent.name && typeof ent.name === "string") candidate = ent.name;
    if (candidate) {
      const norm = normalizeSkill(candidate);
      if (norm) seen.add(norm);
    }
  }
  return [...seen];
}

// ─── Which FM_KEYS each parser should include ───
export const SPELL_KEYS: FMKey[] = [
  "NAME",
  "LEVEL",
  "SCHOOL",
  "CASTING_TIME",
  "SPELL_RANGE",
  "DURATION",
  "VERBAL",
  "SOMATIC",
  "MATERIAL",
  "COMPONENTS",
  "CONCENTRATION",
  "SOURCE",
  "RULESET"
];

export const SPECIES_KEYS: FMKey[] = [
  "SPECIES",
  "SIZE",
  "SPEED",
  "LANGUAGES",
  "TRAITS",
  "SKILLS",
  "STR_MOD",
  "DEX_MOD",
  "CON_MOD",
  "INT_MOD",
  "WIS_MOD",
  "CHA_MOD",
  "SKILL_CHOICE_LIST",
  "TOOL_PROFICIENCIES",
  "TOOL_CHOICE_LIST",
  "WEAPON_PROFICIENCIES",
  "SENSES",
  "DAMAGE_RES",
  "SOURCE",
  "RULESET"
];

export const ITEM_KEYS: FMKey[] = [
  "NAME",
  "TYPE",
  "RARITY",
  "COST",
  "WEIGHT",
  "PROPERTIES",
  "DAMAGE",
  "DAMAGE_TYPES",
  "RANGE",
  "RELOAD",
  "AMMO_TYPE",
  "AC",
  "STEALTH_DISADVANTAGE",
  "MAGICAL",
  "ATTUNEMENT",
  "ATTUNE_REQ",
  "VERMUN",
  "SOURCE",
  "RULESET"
];

export const BESTIARY_KEYS: FMKey[] = [
  "NAME",
  "SIZE",
  "TYPE",
  "ALIGNMENT",
  "AC",
  "HP",
  "SPEED",
  "STRENGTH",
  "DEXTERITY",
  "CONSTITUTION",
  "INTELLIGENCE",
  "WISDOM",
  "CHARISMA",
  "SAVING_THROWS",
  "SKILLS",
  "SENSES",
  "LANGUAGES",
  "CHALLENGE_RATING",
  "SOURCE",
  "RULESET"
];

export const CLASS_KEYS: FMKey[] = [
  "NAME",
  "SPELL_CAST_MOD",
  "ARMOR_PROFICIENCIES",
  "WEAPON_PROFICIENCIES",
  "TOOL_PROFICIENCIES",
  "TOOL_CHOICE_LIST",
  "SAVING_THROWS",
  "SKILLS",
  "SKILL_CHOICE_LIST",
  "TRAITS",
  "SOURCE",
  "RULESET"
];

export const BACKGROUND_KEYS: FMKey[] = [
  "NAME",
  "SKILLS",
  "SKILL_CHOICE_LIST",  
  "TOOL_PROFICIENCIES",
  "TOOL_CHOICE_LIST",
  "TRAITS",
  "SOURCE",
  "RULESET"
];

export const FEATS_KEYS: FMKey[] = [
  "SOURCE",
  "RULESET"
];

// ─── Field subsets for each parser ───
export const SPELL_META_DEFS: FieldDef[] = SPELL_KEYS.map(key => {
  const def = ALL_FIELD_DEFS.find(d => d.callSign === key);
  if (!def) throw new Error(`Missing FieldDef for SPELL_KEY ${key}`);
  return def;
});
export const SPECIES_META_DEFS: FieldDef[] = SPECIES_KEYS.map(key => {
  const def = ALL_FIELD_DEFS.find(d => d.callSign === key);
  if (!def) throw new Error(`Missing FieldDef for SPECIES_KEY ${key}`);
  return def;
});
export const ITEM_META_DEFS: FieldDef[] = ITEM_KEYS.map(key => {
  const def = ALL_FIELD_DEFS.find(d => d.callSign === key);
  if (!def) throw new Error(`Missing FieldDef for ITEM_KEY ${key}`);
  return def;
});
export const BESTIARY_META_DEFS: FieldDef[] = BESTIARY_KEYS.map(key => {
  const def = ALL_FIELD_DEFS.find(d => d.callSign === key);
  if (!def) throw new Error(`Missing FieldDef for BESTIARY_KEY ${key}`);
  return def;
});
export const CLASS_META_DEFS: FieldDef[] = CLASS_KEYS.map(key => {
  const def = ALL_FIELD_DEFS.find(d => d.callSign === key);
  if (!def) throw new Error(`Missing FieldDef for CLASS_KEY ${key}`);
  return def;
});
export const BACKGROUND_META_DEFS: FieldDef[] = BACKGROUND_KEYS.map(key => {
  const def = ALL_FIELD_DEFS.find(d => d.callSign === key);
  if (!def) throw new Error(`Missing FieldDef for BACKGROUND_KEY ${key}`);
  return def;
});
export const FEATS_META_DEFS: FieldDef[] = FEATS_KEYS.map(key => {
  const def = ALL_FIELD_DEFS.find(d => d.callSign === key);
  if (!def) throw new Error(`Missing FieldDef for BACKGROUND_KEY ${key}`);
  return def;
});