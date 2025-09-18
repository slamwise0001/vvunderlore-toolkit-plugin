// modalFormsUpdater.ts
import { App, normalizePath, Notice } from "obsidian";

/** Shapes we care about from Modal Forms' data.json */
type MFInput =
  | { type: "text" | "textarea" | "number" | "date" | "image" | "toggle" | "slider"; hidden?: boolean; [k: string]: any }
  | { type: "select"; source: "fixed" | "notes" | "dataview"; options?: Array<{ value: string; label: string }>; [k: string]: any }
  | { type: "multiselect"; source: "fixed" | "notes" | "dataview"; multi_select_options?: string[]; allowUnknownValues?: boolean; [k: string]: any }
  | { type: "dataview"; query: string; [k: string]: any };

interface MFField {
  name: string;
  label?: string;
  description?: string;
  isRequired?: boolean;
  input: MFInput;
  condition?: { dependencyName: string; type: string; value: any };
}

interface MFFormDef {
  title: string;
  name: string;               // identity key we match on
  customClassname?: string;
  fields: MFField[];
  version?: string;           // repo can bump this when it changes
  [k: string]: any;           // future-proof
}

interface MFDataFile {
  editorPosition?: string;
  attachShortcutToGlobalWindow?: boolean;
  globalNamespace?: string;
  formDefinitions: MFFormDef[];
  [k: string]: any;
}

export interface MFUpdaterOptions {
  /** Raw URL to your upstream data.json in the repo */
  upstreamUrl?: string;
  /**
   * Forms "owned" by VV (only these get replaced from upstream).
   * Matching is by exact `name`.
   */
  ownedFormNames?: string[];
  /** Make a timestamped .bak file next to data.json before writing (default: true) */
  makeBackup?: boolean;
  /** Show Notices for success/failure (default: true) */
  notify?: boolean;
}

export interface MFMergeReport {
  modalFormsPath: string;
  replacedForms: string[];
  addedForms: string[];     // owned form was missing locally, so we added it
  keptUserForms: number;
  totalAfter: number;
}

/** Sensible defaults you can tweak */
const DEFAULTS: Required<MFUpdaterOptions> = {
  upstreamUrl:
    "https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/Extras/ModalForms/data.json",
  ownedFormNames: [
    "next-session-date",
    "new-creature",
    "new-item-form",
    "new-npc-form",
    "new-place-form",
    "new-player-character",
  ],
  makeBackup: true,
  notify: true,
};

/**
 * Entry point you call from main.ts update flow.
 * - Finds Modal Forms plugin data.json
 * - Fetches upstream data.json
 * - Replaces ONLY VV-owned forms by `name`
 * - Leaves user-created/edited forms alone
 */
export async function updateModalFormsFromRepo(
  app: App,
  opts: MFUpdaterOptions = {}
): Promise<MFMergeReport | null> {
  const cfg = { ...DEFAULTS, ...opts };

  // 1) Locate Modal Forms plugin data.json on disk
  const mfPath = await findModalFormsDataPath(app);
  if (!mfPath) {
    if (cfg.notify) new Notice("⚠️ Could not find Modal Forms plugin data.json.");
    return null;
  }

  // 2) Read local MF data file
  const localRaw = await safeRead(app, mfPath);
  if (!localRaw) {
    if (cfg.notify) new Notice(`⚠️ Failed to read: ${mfPath}`);
    return null;
  }

  let localData: MFDataFile;
  try {
    localData = JSON.parse(localRaw);
    if (!Array.isArray(localData.formDefinitions)) throw new Error("Bad structure");
  } catch {
    if (cfg.notify) new Notice("⚠️ Modal Forms data.json is not valid JSON.");
    return null;
  }

  // 3) Fetch upstream
  const upstreamData = await fetchUpstreamMF(cfg.upstreamUrl);
  if (!upstreamData) {
    if (cfg.notify) new Notice("⚠️ Could not fetch upstream Modal Forms data.json.");
    return null;
  }

  // 4) Merge (replace owned forms only)
  const ownedSet = new Set((cfg.ownedFormNames || []).map((n) => n.trim()).filter(Boolean));
  const result = mergeByOwnedNames(localData, upstreamData, ownedSet);

  // 5) If nothing changed, bail
  const changed = result.replacedForms.length > 0 || result.addedForms.length > 0;
  if (!changed) {
    if (cfg.notify) new Notice("Modal Forms: no changes needed.");
    return {
      modalFormsPath: mfPath,
      ...result,
      totalAfter: (localData.formDefinitions || []).length,
    };
  }

  // 6) Backup, then write
  if (cfg.makeBackup) {
    try {
      const backupPath = mfPath.replace(/\.json$/i, "") + "." + timeStamp() + ".bak.json";
      await app.vault.adapter.write(backupPath, JSON.stringify(localData, null, 2));
    } catch {
      // non-fatal
    }
  }

  const newData: MFDataFile = {
    ...localData,
    formDefinitions: result.merged,
  };

  await app.vault.adapter.write(mfPath, JSON.stringify(newData, null, 2));

  if (cfg.notify) {
    const noteBits = [];
    if (result.replacedForms.length) noteBits.push(`replaced: ${result.replacedForms.length}`);
    if (result.addedForms.length) noteBits.push(`added: ${result.addedForms.length}`);
    new Notice(`✅ Modal Forms updated (${noteBits.join(", ") || "no changes"}).`);
  }

  return {
    modalFormsPath: mfPath,
    replacedForms: result.replacedForms,
    addedForms: result.addedForms,
    keptUserForms: result.keptUserForms,
    totalAfter: result.merged.length,
  };
}

/* --------------------------------- internals -------------------------------- */

async function safeRead(app: App, path: string): Promise<string | null> {
  try {
    return await app.vault.adapter.read(path);
  } catch {
    return null;
  }
}

/** Try to find the Modal Forms plugin folder by heuristics */
async function findModalFormsDataPath(app: App): Promise<string | null> {
  const plugsDir = normalizePath(`${app.vault.configDir}/plugins`);
  try {
    const listing = await (app.vault.adapter as any).list(plugsDir);
    const folderCandidates: string[] = [
      // heuristic ids people use
      "obsidian-modal-forms",
      "modalforms",
      "obsidian-modalforms",
      "modal-forms",
    ];

    // 1) If we can list folders, try to match by manifest name/id
    if (listing && Array.isArray(listing.folders)) {
      // try a “smart” scan: read manifest.json and match plugin name/id
      for (const f of listing.folders as string[]) {
        const manifestPath = normalizePath(`${f}/manifest.json`);
        try {
          const raw = await app.vault.adapter.read(manifestPath);
          const man = JSON.parse(raw);
          const id: string = String(man?.id ?? "").toLowerCase();
          const name: string = String(man?.name ?? "").toLowerCase();
          if (
            id.includes("modal") && id.includes("form") ||
            name.includes("modal") && name.includes("form")
          ) {
            const dataPath = normalizePath(`${f}/data.json`);
            const exists = await app.vault.adapter.exists(dataPath);
            if (exists) return dataPath;
          }
        } catch {
          /* ignore */
        }
      }

      // 2) Fallback to common ids
      for (const id of folderCandidates) {
        const dataPath = normalizePath(`${plugsDir}/${id}/data.json`);
        if (await app.vault.adapter.exists(dataPath)) return dataPath;
      }
    } else {
      // If we cannot list, just try common ids
      for (const id of folderCandidates) {
        const dataPath = normalizePath(`${plugsDir}/${id}/data.json`);
        if (await app.vault.adapter.exists(dataPath)) return dataPath;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Fetch upstream data.json from your repo */
async function fetchUpstreamMF(url: string): Promise<MFDataFile | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const upstream = (await res.json()) as MFDataFile;
    if (!upstream || !Array.isArray(upstream.formDefinitions)) return null;
    return upstream;
  } catch {
    return null;
  }
}

/**
 * Merge logic:
 * - Keep ALL local forms whose `name` is NOT in ownedSet (user forms).
 * - Replace local forms whose `name` IS in ownedSet with upstream versions (if present upstream).
 * - If an owned form is missing locally but present upstream, ADD it.
 * Returns merged list and a small report.
 */
function mergeByOwnedNames(
  local: MFDataFile,
  upstream: MFDataFile,
  ownedSet: Set<string>
): { merged: MFFormDef[]; replacedForms: string[]; addedForms: string[]; keptUserForms: number } {
  const localForms = Array.isArray(local.formDefinitions) ? local.formDefinitions : [];
  const upstreamForms = Array.isArray(upstream.formDefinitions) ? upstream.formDefinitions : [];

  const upstreamByName = new Map<string, MFFormDef>();
  for (const f of upstreamForms) upstreamByName.set(f.name, f);

  const kept: MFFormDef[] = [];
  const replaced: string[] = [];
  let keptUsers = 0;

  // Keep only non-owned local forms (user stuff)
  for (const lf of localForms) {
    if (!ownedSet.has(lf.name)) {
      kept.push(lf);
      keptUsers++;
    }
  }

  // Now lay in all owned upstream forms (replace / add)
  const added: string[] = [];
  for (const name of ownedSet) {
    const uf = upstreamByName.get(name);
    if (!uf) continue; // if not in upstream, skip silently
    // If we had a local owned form, it's replaced; otherwise it's added
    const hadLocal = localForms.some((lf) => lf.name === name);
    if (hadLocal) replaced.push(name);
    else added.push(name);
    kept.push(uf);
  }

  return {
    merged: kept,
    replacedForms: replaced,
    addedForms: added,
    keptUserForms: keptUsers,
  };
}

/** e.g., 2025-01-31_14-07-05 */
function timeStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
