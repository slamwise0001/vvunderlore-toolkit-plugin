//5e 2025 installer

import { App, normalizePath } from "obsidian";
import type { Edition } from "../../editions";
import { parseSpellsFile } from "./spells";
import { parseBestiaryFile } from "./bestiary";
import { parseItemsFile } from "./items";
import { parseSpeciesFile } from "./species";
import { parseClassFile } from "./classes";
import { parseActionsFile, parseConditionsDiseasesFile, parseSensesFile, parseSkillsFile } from "./rules";
import { parseFeatsFile } from "./feats";
import { parseBackgroundsFile } from "./backgrounds";
import { TFile } from "obsidian";


// — GitHub listings —
async function listSpellFilesFromGitHub(repo: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/data/spells`;
  const res = await fetch(url);
  const data = (await res.json()) as Array<{ name: string; type: string }>;
  return data
    .filter(item => item.type === "file" && item.name.startsWith("spells-") && item.name.endsWith(".json"))
    .map(item => item.name);
}

async function listBestiaryFilesFromGitHub(repo: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/data/bestiary`;
  const res = await fetch(url);
  const list = (await res.json()) as Array<{ name: string; type: string }>;
  const CORE_SOURCES = [
    "bestiary-phb.json", "bestiary-mm.json", "bestiary-dmg.json",
    "bestiary-xge.json", "bestiary-vgm.json", "bestiary-tce.json",
    "bestiary-egw.json", "bestiary-erlw.json", "bestiary-mtf.json",
    "bestiary-vrgr.json", "bestiary-cos.json", "bestiary-oota.json",
    "bestiary-pota.json", "bestiary-hotdq.json", "bestiary-rot.json",
    "bestiary-skt.json", "bestiary-tftyp.json", "bestiary-toa.json"
  ];
  return list
    .filter(item => item.type === "file" && CORE_SOURCES.includes(item.name))
    .map(item => item.name);
}

const ITEM_JSON_FILES = [
  "items-base.json",
  "items.json",
  "objects.json",
  "vehicles.json",
  "decks.json",
];

async function listItemFilesFromGitHub(repo: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/data`;
  const res = await fetch(url);
  const data = (await res.json()) as Array<{ name: string; type: string }>;
  return data
    .filter(item => item.type === "file" && ITEM_JSON_FILES.includes(item.name))
    .map(item => item.name);
}

async function listClassFilesFromGitHub(repo: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/data/class`;
  const res = await fetch(url);
  const listing = (await res.json()) as Array<{ name: string; type: string }>;
  return listing
    .filter(item =>
      item.type === "file" &&
      item.name.startsWith("class-") &&
      item.name.endsWith(".json")
    )
    .map(item => item.name);
}

// — ensure the vault folder exists —
async function ensureFolder(app: App, folderPath: string) {
  const parts = folderPath.split("/");
  let curr = "";
  for (const p of parts) {
    curr = curr ? `${curr}/${p}` : p;
    try { await app.vault.createFolder(curr); }
    catch {} // already exists
  }
}

// — the one entry-point that your top-level calls —
export async function importEditionData(params: {
  app: App;
  edition: Edition;
  targetPath: string;
}) {
  const { app, edition, targetPath } = params;
  const repo = edition.repo ?? "";

  // 🔹 SPELLS
  {
    const spellFiles = await listSpellFilesFromGitHub(repo);
    for (const fileName of spellFiles) {
      try {
        const res  = await fetch(`${edition.sourceUrl}/spells/${fileName}`);
        const json = await res.json();
        const files = parseSpellsFile(json, edition.id);
        for (const md of files) {
          const fullPath = normalizePath(`${targetPath}/Spells/${md.path}`);
          const folder   = fullPath.split("/").slice(0, -1).join("/");
          await ensureFolder(app, folder);
          await app.vault.adapter.write(fullPath, md.content);
        }
      } catch (e) {
        console.warn(`Failed to import spell ${fileName}:`, e);
      }
    }
  }

  // 🔹 BESTIARY
  {
    const bestiaryFiles = await listBestiaryFilesFromGitHub(repo);
    for (const fileName of bestiaryFiles) {
      try {
        const res    = await fetch(`${edition.sourceUrl}/bestiary/${fileName}`);
        const json   = await res.json();
        const parsed = parseBestiaryFile(json, edition.id);
        for (const md of parsed) {
          const fullPath = normalizePath(`${targetPath}/Bestiary/${md.path}`);
          const folder   = fullPath.split("/").slice(0, -1).join("/");
          await ensureFolder(app, folder);
          await app.vault.adapter.write(fullPath, md.content);
        }
      } catch (e) {
        console.warn(`Failed to import bestiary ${fileName}:`, e);
      }
    }
  }

  // 🔹 ITEMS
  {
    const itemFiles = await listItemFilesFromGitHub(repo);
    for (const fn of itemFiles) {
      try {
        const res  = await fetch(`${edition.sourceUrl}/${fn}`);
        const json = await res.json();
        const mdFiles = parseItemsFile(json, edition.id);
        for (const md of mdFiles) {
          const fullPath = normalizePath(`${targetPath}/${md.path}`);
          const folder   = fullPath.split("/").slice(0, -1).join("/");
          await ensureFolder(app, folder);
          await app.vault.adapter.write(fullPath, md.content);
        }
      } catch (e) {
        console.warn(`Failed to import items from ${fn}:`, e);
      }
    }
  }
// 🔹 SPECIES
{
  const res  = await fetch(`${edition.sourceUrl}/races.json`);
  const json = await res.json();
  const mdFiles = parseSpeciesFile(json, edition.id);
  for (const md of mdFiles) {
    const fullPath = normalizePath(`${targetPath}/Player Build/${md.path}`);
    await ensureFolder(app, fullPath.split("/").slice(0, -1).join("/"));
    await app.vault.adapter.write(fullPath, md.content);
  }
// 🔹 FETCH OPTIONAL FEATURES JSON
let optionalFeatures: any[] = [];
try {
  const url  = `${edition.sourceUrl}/optionalfeatures.json`;
  const res  = await fetch(url);
  const text = await res.text();

  // strip any JSON-hijack prefix (e.g. )]}',) and any BOM/whitespace
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found");
  const cleanJson = text.slice(start);

  const raw = JSON.parse(cleanJson);
  optionalFeatures = Array.isArray(raw.optionalfeature)
    ? raw.optionalfeature
    : [];
} catch (e) {
  console.warn("Failed to import optionalfeatures.json:", e);
}
// 🔹 CLASSES
{
  const classFiles = await listClassFilesFromGitHub(repo);
  for (const fileName of classFiles) {
    try {
      // fetch the raw class JSON
      const res    = await fetch(`${edition.sourceUrl}/class/${fileName}`);
      const json   = await res.json();

      // parse into one or more markdown files
      const mdFiles = parseClassFile(
        json,
        edition.id,
        fileName,
        optionalFeatures
      );
      for (const md of mdFiles) {
        const fullPath = normalizePath(`${targetPath}/Player Build/${md.path}`);
        // 1) ensure the folder exists
        await ensureFolder(app, fullPath.split("/").slice(0, -1).join("/"));

        // 2) write via Obsidian’s API so notes refresh
        const existing = app.vault.getAbstractFileByPath(fullPath);
        if (existing instanceof TFile) {
          // Overwrite an existing note and fire the change event
          await app.vault.modify(existing, md.content);
        } else {
          // Create a brand-new note (also fires the change event)
          await app.vault.create(fullPath, md.content);
        }
      }
    } catch (e) {
      console.warn(`Failed to import class ${fileName}:`, e);
    }
  }
}


 // 🔹 RULES: ACTIONS
  {
    try {

      const res  = await fetch(`${edition.sourceUrl}/actions.json`);
      const json = await res.json();
    
      const mdFiles = parseActionsFile(json, edition.id);
    
      for (const md of mdFiles) {
        const fullPath = normalizePath(
          `${targetPath}/${md.path}`
        );
        const folder = fullPath.split("/").slice(0, -1).join("/");

        await ensureFolder(app, folder);
        await app.vault.adapter.write(fullPath, md.content);
      }
    } catch (e) {
      console.warn("Failed to import actions.json:", e);
    }
  }


    // 🔹 RULES: CONDITIONS & DISEASES
  {
    try {
      const res  = await fetch(`${edition.sourceUrl}/conditionsdiseases.json`);
      const json = await res.json();
      const mdFiles = parseConditionsDiseasesFile(json, edition.id);
      for (const md of mdFiles) {
        const fullPath = normalizePath(
          `${targetPath}/${md.path}`
        );
        const folder = fullPath.split("/").slice(0, -1).join("/");
        await ensureFolder(app, folder);
        await app.vault.adapter.write(fullPath, md.content);
      }
    } catch (e) {
      console.warn("Failed to import conditionsdiseases.json:", e);
    }
  }

   // 🔹 RULES: SENSES
  {
    try {

      const res  = await fetch(`${edition.sourceUrl}/senses.json`);
      const json = await res.json();
    
      const mdFiles = parseSensesFile(json, edition.id);
    
      for (const md of mdFiles) {
        const fullPath = normalizePath(
          `${targetPath}/${md.path}`
        );
        const folder = fullPath.split("/").slice(0, -1).join("/");

        await ensureFolder(app, folder);
        await app.vault.adapter.write(fullPath, md.content);
      }
    } catch (e) {
      console.warn("Failed to import senses.json:", e);
    }
  }

     // 🔹 RULES: SKILLS
  {
    try {

      const res  = await fetch(`${edition.sourceUrl}/skills.json`);
      const json = await res.json();
    
      const mdFiles = parseSkillsFile(json, edition.id);
    
      for (const md of mdFiles) {
        const fullPath = normalizePath(
          `${targetPath}/${md.path}`
        );
        const folder = fullPath.split("/").slice(0, -1).join("/");

        await ensureFolder(app, folder);
        await app.vault.adapter.write(fullPath, md.content);
      }
    } catch (e) {
      console.warn("Failed to import skills.json:", e);
    }
  }

   // 🔹 FEATS
  {
    try {

      const res  = await fetch(`${edition.sourceUrl}/feats.json`);
      const json = await res.json();
    
      const mdFiles = parseFeatsFile(json, edition.id);
    
      for (const md of mdFiles) {
        const fullPath = normalizePath(
          `${targetPath}/${md.path}`
        );
        const folder = fullPath.split("/").slice(0, -1).join("/");

        await ensureFolder(app, folder);
        await app.vault.adapter.write(fullPath, md.content);
      }
    } catch (e) {
      console.warn("Failed to import feats.json:", e);
    }
  }

// 🔹 BACKGROUNDS
{
  try {
    const res  = await fetch(`${edition.sourceUrl}/backgrounds.json`);
    const json = await res.json();

    const mdFiles = parseBackgroundsFile(json, edition.id);

    for (const md of mdFiles) {
      // md.path is "Player Build/Backgrounds/<Name>.md"
      const fullPath = normalizePath(`${targetPath}/${md.path}`);
      const folder   = fullPath.split("/").slice(0, -1).join("/");

      await ensureFolder(app, folder);
      await app.vault.adapter.write(fullPath, md.content);
    }
  } catch (e) {
    console.warn("Failed to import backgrounds.json:", e);
  }
}
}
}