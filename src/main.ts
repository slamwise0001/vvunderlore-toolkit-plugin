import {
  App,
  Plugin,
  Notice,
  Modal,
  Setting,
  TFolder,
  TFile,
  Vault
} from 'obsidian'; 

import { ToolkitSettingsTab } from './settings';
import { ToolkitFileCacheManager } from './fileCacheManager';
import type { ToolkitFileCacheEntry } from './fileCacheManager';
import { BackupManager } from './backup/BackupManager';
import { showCustomInstallModal } from './customInstallModal';
import { AVAILABLE_EDITIONS } from './editions';
import { importRulesetData } from './rulesetInstaller';

const loadingIcon = 
'data:image/png;base64,' +
'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'
 
class InstallingModal extends Modal {
  constructor(app: App) { super(app); }
  onOpen() {
    this.contentEl.empty();
    const img = this.contentEl.createEl('img', {
      attr: { src: loadingIcon, alt: 'Installing…' },
    });
    Object.assign(img.style, {
      display: 'block',
      margin: '1em auto 0.5em',
      width: '100px',
      height: '100px',
    });
    img.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-360deg)' }
      ],
      {
        duration: 1500,      // one and a half seconds per revolution
        iterations: Infinity,
        easing: 'linear'
      }
    );
    const txt = this.contentEl.createDiv({ text: 'Installing…', cls: 'mod-quiet' });
    txt.style.cssText =
      'font-style: italic; color: var(--text-muted); text-align: center; padding: 1em;';
  }
  onClose() {
    this.contentEl.empty();
  } 
}


interface PreviewItem {
  filePath: string;
  action: string;
  selected: boolean; 
  isFolder?: boolean;
}

interface ToolkitSettings {
  installedVersion: string;
  latestToolkitVersion?: string;
  customizeUpdates: boolean;
  updateTargets: {
    tools: boolean;
    toolsPath?: string;
    templates: boolean;
    templatesPath?: string;
    omninomicon: boolean;
    omninomiconPath?: string;
    spellbook: boolean;
    spellbookPath: string;
  };
  latestDefaults?: {
    tools?: string;
    templates?: string;
    omninomicon?: string;
    spellbook?: string;
  };
  lastChecked?: string;
  lastForceUpdate?: string;
  fileCache?: Record<string, ToolkitFileCacheEntry>;
  pathOverrides?: Record<string, string>;
  backupFiles?: Record<string, string>;
  backupPath?: string;
  autoBackup?: boolean;
  lastBackupTime?: string;
  backupError?: string;
  customPaths: CustomPathEntry[];
  autoBackupBeforeUpdate: boolean;
  needsInstall: boolean;
  highlightEnabled: boolean;
  highlightColorLight: string;
  highlightColorDark: string;
  rulesetCompendium: string;
  rulesetReference: string[];
}

const DEFAULT_SETTINGS: ToolkitSettings = {
  installedVersion: '1.0.0',
  customizeUpdates: false,
  updateTargets: {
    tools: true,
    toolsPath: 'Tools',
    templates: true,
    templatesPath: 'Extras/Templates',
    omninomicon: true,
    omninomiconPath: 'Adventures/Omninomicon.md',
    spellbook: true,
    spellbookPath: 'Compendium/Spells/_Spellbook.md',
  },
  latestDefaults: undefined,
  pathOverrides: {},
  backupFiles: {},
  backupPath: '',
  autoBackup: false,
  lastBackupTime: '',
  backupError: '',
  customPaths: [],
  autoBackupBeforeUpdate: true,
  needsInstall: true,
  highlightEnabled: false,
  highlightColorLight: 'rgb(107, 146, 120)',
  highlightColorDark: 'rgb( 50,  70,  50)',
  rulesetCompendium: "",
  rulesetReference: [],
};

interface CustomPathEntry {
  vaultPath: string;
  manifestKey: string;
  doUpdate: boolean;
}

export interface ManifestFileEntry {
  path: string;
  key: string;
  customOverride?: boolean;
  displayName?: string;
  optional?: boolean; // ← mark optional files/folders if you wish
}

export interface InstallOptions {
	compendium: string;
	references: string[];
  }

export default class VVunderloreToolkitPlugin extends Plugin {
  requiresGraph: Map<string, string[]>;
  public settingsTab: ToolkitSettingsTab;
  settings: ToolkitSettings;
  fileCacheManager: ToolkitFileCacheManager;
  manifestCache: {
    files: ManifestFileEntry[];
    folders: ManifestFileEntry[];
  } = { files: [], folders: [] };
  changelog: string = '';
  private autoCheckInterval: number | null = null;
  private oldPathsByGithub: Record<string, string> = {};
  private styleEl: HTMLStyleElement | null = null;

  backupManager: BackupManager;
  excludedPaths = [
    '.obsidian',
    '.DS_Store',
    '.gitignore',
    '.gitattributes',
    '.github',
    'README.md',
    '.version.json',
    'plugins',
    'Compendium'
  ];
  
  // ─── HELPERS ────────────────────────────────────────────────────────

  /** Given a GitHub path, return the overridden vault path or the original. */
  resolveVaultPath(githubPath: string): string {
    const custom = this.settings.customPaths.find(
      (c) =>
        c.manifestKey === githubPath ||
        c.manifestKey === this.keyFor(githubPath)
    );
    return custom?.vaultPath ?? githubPath;
  }

  /** Convert “some/folder/file.md” → “some-folder-file” (lowercased, no extension). */
  keyFor(path: string): string {
    return path
      .replace(/[/\\]/g, '-')
      .replace(/\.[^.]+$/, '')
      .toLowerCase();
  }

  isExcluded(path: string): boolean {
    return this.excludedPaths.some(
      (ex) =>
        path === ex ||
        path.startsWith(`${ex}/`) ||
        path.includes(`/${ex}/`) ||
        path.endsWith(`/${ex}`) ||
        path.includes(`/${ex}`)
    );
  }
  
  // ─── CUSTOM INSTALL LOGIC ───────────────────────────────────────────

  public async performCustomInstall(
    toInstall: { path: string; isFolder: boolean }[]
  ): Promise<void> {
		
	// optional backup //
	const allFiles = this.app.vault.getAllLoadedFiles()
	.filter((f): f is TFile => f instanceof TFile)
	.map((f) => f.path);
	const nonMarkerFiles = allFiles.filter((p) => p !== '.vvunderlore_installed');

	if (nonMarkerFiles.length > 0 && this.settings.autoBackupBeforeUpdate) {
	const folder = await this.backupManager.backupVaultMirror('pre-custom-install');
	new Notice(`Backup before custom‐install created at: ${folder}`);
	}
    // 2) Loop over each selected path
    for (const entry of toInstall) {
      if (entry.isFolder) {
        if (!(await this.app.vault.adapter.exists(entry.path))) {
          await this.app.vault.createFolder(entry.path);
          console.log(`Created folder: ${entry.path}`);
        }
      } else {
        // File → find ManifestFileEntry
        const manifestEntry = this.manifestCache.files.find(
          (f) => f.path === entry.path
        );
        if (!manifestEntry) {
          console.warn(`Could not find manifest entry for file: ${entry.path}`);
          continue;
        }
        // Reuse your existing “updateEntryFromManifest” (force = true)
        await this.updateEntryFromManifest(manifestEntry, true);
      }
    }
		// 3) Update .version.json and settings
		await this.updateVersionFile();
		this.settings.installedVersion =
		this.settings.latestToolkitVersion ?? this.settings.installedVersion;
		this.settings.lastForceUpdate = new Date().toISOString();
		this.settings.needsInstall = false;
		await this.saveSettings();

		// 4) Create the hidden marker file
		const markerPath = '.vvunderlore_installed';
		if (!(await this.app.vault.adapter.exists(markerPath))) {
		await this.app.vault.create(markerPath, '');
		}

		// 5) Re‐enable highlighting (always turn it back on)
		this.settings.needsInstall = false;
		this.settings.highlightEnabled = true;
		await this.saveSettings();
		this.enableHighlight();
		
		if (this.settingsTab) {
		  this.settingsTab.display();
		}
		new Notice('✅ Custom install complete …');
	}

  // ─── HIGHLIGHTING (Light + Dark Mode) ──────────────────────────────

  private get highlightCSS(): string {
    const light = this.settings.highlightColorLight.trim() || 'rgba(107,146,120,1)';
    const dark = this.settings.highlightColorDark.trim() || 'rgba( 50, 70, 50,1)';

    const fileSelectors = this.manifestCache.files.map((f) => {
      const escaped = f.path.replace(/"/g, '\\"');
      return `.nav-file-title[data-path="${escaped}"]`;
    });

    const folderSelectors = this.manifestCache.folders.map((f) => {
      const escaped = f.path.replace(/"/g, '\\"');
      return `.nav-folder-title[data-path="${escaped}"]`;
    });

    const lines: string[] = [
      `:root {`,
      `  --vvunderlore-toolkit-highlight: ${light};`,
      `}`,
      ``,
      `body.theme-dark {`,
      `  --vvunderlore-toolkit-highlight: ${dark};`,
      `}`,
      ``,
    ];

    if (fileSelectors.length) {
      lines.push(`${fileSelectors.join(', ')} {`);
      lines.push(`  background-color: var(--vvunderlore-toolkit-highlight);`);
      lines.push(`  border-radius: 3px;`);
      lines.push(`}`);
      lines.push(``);
    }

    if (folderSelectors.length) {
      lines.push(`${folderSelectors.join(', ')} {`);
      lines.push(`  background-color: var(--vvunderlore-toolkit-highlight);`);
      lines.push(`  border-radius: 3px;`);
      lines.push(`}`);
      lines.push(``);
    }

    return lines.join('\n');
  }

  public enableHighlight(): void {
    if (this.styleEl) return;
    this.styleEl = document.createElement('style');
    this.styleEl.id = 'vvunderlore-highlight-inject';
    this.styleEl.textContent = this.highlightCSS;
    document.head.appendChild(this.styleEl);
  }

  public disableHighlight(): void {
    if (!this.styleEl) return;
    this.styleEl.remove();
    this.styleEl = null;
  }

  // ─── REMOTE BASELINE CACHING ─────────────────────────────────────────

  public async fetchRemoteBaseline(): Promise<void> {
    console.log('🔁 fetchRemoteBaseline() called');

    if (!this.manifestCache || !Array.isArray(this.manifestCache.files)) {
      console.warn('⚠️ manifestCache is missing or invalid');
      return;
    }

    for (const entry of this.manifestCache.files) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/${entry.path}`;
        const remoteText = await (await fetch(rawUrl)).text();
        const resolved = this.resolveVaultPath(entry.path);

        // If remapped, remove the old cache entry
        if (resolved !== entry.path) {
          await this.fileCacheManager.removeFromCache(entry.path);
        }

        await this.fileCacheManager.updateCache(
          resolved,
          remoteText,
          entry.path,
          false
        );
      } catch (e) {
        console.error(`Failed to fetch raw baseline for ${entry.path}`, e);
      }
    }

    console.log('📦 Final cache:', this.fileCacheManager.getCache());
  }

  // ─── MARKER FILE CHECKS (first‐run detection) ───────────────────────

  private async checkMarkerFile() {
    const devForce = (window as any).forceNeedsInstall;
    if (devForce) {
      this.settings.needsInstall = true;
      console.log('🧪 DEV MODE: Forcing needsInstall = true');
      await this.saveSettings();
      if (this.settingsTab) this.settingsTab.display();
      return;
    }

    const markerPath = '.TEST_vvunderlore_installed';
    const markerExists = await this.app.vault.adapter.exists(markerPath);
    this.settings.needsInstall = !markerExists;

    console.log(
      markerExists
        ? '✅ Marker file found → needsInstall = false'
        : '🟡 Marker file NOT found → needsInstall = true'
    );

    await this.saveSettings();
    if (this.settingsTab) {
      this.settingsTab.display();
    }
  }

  // ─── MANIFEST SYNC ────────────────────────────────────────────────────

  async syncManifest(): Promise<void> {
    try {
      const res = await fetch(
        'https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/manifest.json'
      );
      if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.statusText}`);
      const manifest = await res.json();
      this.settings.latestDefaults = manifest.defaultPaths || {};
      this.manifestCache = manifest;

      const manifestContent = JSON.stringify(manifest, null, 2);
      await this.app.vault.adapter.write('manifest.json', manifestContent);
      await this.saveSettings();

      console.log('Manifest synced and local manifest updated.');
    } catch (error) {
      console.error('Error syncing manifest:', error);
      new Notice('Failed to sync manifest.');
    }
  }

  // ─── PLUGIN LIFECYCLE ─────────────────────────────────────────────────

  async onload() {
    await this.loadSettings();

    this.backupManager = new BackupManager(this.app.vault);

    this.fileCacheManager = new ToolkitFileCacheManager(
      this.app.vault,
      this.settings.fileCache ?? {},
      async () => await this.saveSettings()
    );


      const origError = console.error.bind(console);
  console.error = (msg?: any, ...rest: any[]) => {
    if (
      typeof msg === "string" &&
      msg.includes("Cannot index file") &&
      msg.includes("Dataview")
    ) {
      return;
    }
    origError(msg, ...rest);
  };
  
    this.settingsTab = new ToolkitSettingsTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    // Immediately load any cached manifest.json. If not present, we'll fetch in a moment.
    try {
      const content = await this.app.vault.adapter.read('manifest.json');
      this.manifestCache = JSON.parse(content);
      console.log('✅ Loaded manifest from vault:', this.manifestCache);
    } catch (err) {
      console.warn('Manifest not found in vault; will fetch from GitHub shortly.');
    }
    
    // If highlighting was ON before, restore it now:
	if (this.settings.highlightEnabled && !this.settings.needsInstall) {
		this.enableHighlight();
	  }

    // Defer heavier tasks slightly so UI isn’t blocked:
    setTimeout(async () => {
      await this.syncManifest();
      await this.showIndexingModal();
      await this.checkForUpdates();

      // Build reverse cache for “moved” detection
      this.oldPathsByGithub = Object.entries(
        this.fileCacheManager.getCache() as Record<string, ToolkitFileCacheEntry>
      ).reduce((map, [vaultPath, entry]) => {
        map[entry.githubPath] = vaultPath;
        return map;
      }, {} as Record<string, string>);

      console.log('📦 Cached Files:', this.fileCacheManager.getCache());
    }, 250);

    this.scheduleAutoUpdateCheck();

  this.registerEvent(
    this.app.vault.on("delete", () =>
    (this.app as any).commands.executeCommandById("dataview:clear-cache")    )
  );
  this.registerEvent(
    this.app.vault.on("rename", () =>
      (this.app as any).commands.executeCommandById("dataview:clear-cache")
    )
  );

    // Defensive: ensure settings.customPaths exists
    if (!this.settings.customPaths) {
      this.settings.customPaths = [];
    }

    // Build the requiresGraph from manifest.json
    try {
      const raw = await this.app.vault.adapter.read('manifest.json');
      const manifest = JSON.parse(raw) as {
        files: Array<{ key: string; requires?: string[] }>;
        folders: Array<{ key: string; requires?: string[] }>;
      };
      const entries = [...(manifest.folders || []), ...(manifest.files || [])];
      this.requiresGraph = new Map<string, string[]>();
      for (const e of entries) {
        this.requiresGraph.set(e.key, e.requires ?? []);
      }
    } catch (e) {
      console.warn('Could not build requiresGraph (manifest.json missing or invalid).');
      this.requiresGraph = new Map();
    }
  }

  onunload() {
    this.disableHighlight();
    if (this.autoCheckInterval) {
      clearInterval(this.autoCheckInterval);
    }
  }

  scheduleAutoUpdateCheck() {
    this.autoCheckInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, 60 * 60 * 1000);
  }

  // ─── BACKUP & UNDO ────────────────────────────────────────────────────

  async backupFile(filePath: string, content: string): Promise<void> {
    this.settings.backupFiles = this.settings.backupFiles || {};
    this.settings.backupFiles[filePath] = content;
    await this.saveSettings();
    console.log(`Backup stored for ${filePath}`);
  }

  async undoForceUpdate(): Promise<void> {
    if (!this.settings.backupFiles || Object.keys(this.settings.backupFiles).length === 0) {
      new Notice('No backups available to restore.');
      return;
    }
    for (const [filePath, backupContent] of Object.entries(this.settings.backupFiles)) {
      if (await this.app.vault.adapter.exists(filePath)) {
        await this.app.vault.adapter.write(filePath, backupContent);
        console.log(`Restored ${filePath}`);
      } else {
        await this.app.vault.create(filePath, backupContent);
        console.log(`Recreated and restored ${filePath}`);
      }
    }
    new Notice('✅ Force update undone.');
    this.settings.backupFiles = {};
    await this.saveSettings();
  }

  // ─── FOLDER SYNC ───────────────────────────────────────────────────────

  async syncMissingFolders(): Promise<void> {
    if (this.manifestCache && this.manifestCache.folders) {
      for (const folderEntry of this.manifestCache.folders) {
        const folderPath = folderEntry.path;
        if (!(await this.app.vault.adapter.exists(folderPath))) {
          await this.app.vault.createFolder(folderPath);
          console.log(`📁 Created missing folder: ${folderPath}`);
        }
      }
    }
  }

// ─── FORCE-UPDATE PREVIEW ──────────────────────────────────────────────

async buildForceUpdatePreview(): Promise<PreviewItem[]> {
	const previewList: PreviewItem[] = [];

	// 0) Collect all blacklisted folders (manifestKey values where doUpdate === false)
	const denyListedFolders = this.settings.customPaths
	  .filter((c) => c.doUpdate === false)
	  .map((c) => c.manifestKey);

	// 1) Deny-listed files first—but only if they would actually be "new" or "out of date"
	for (const entry of this.manifestCache.files) {
	  // ── SKIP any optional:true file
	  if (entry.optional) {
		continue;
	  }

	  const custom = this.settings.customPaths.find((c) => c.manifestKey === entry.key);
	  const isInDenyFolder = denyListedFolders.some((folder) =>
		entry.path.startsWith(folder + '/')
	  );
	  if (custom?.doUpdate === false || isInDenyFolder) {
		// Resolve vault path (accounting for any remapping)
		const vp = custom?.vaultPath ?? this.resolveVaultPath(entry.path);

		// Check: does the file exist locally? And is it up-to-date?
		const exists = await this.app.vault.adapter.exists(vp);
		const upToDate = exists && (await this.fileCacheManager.isUpToDate(vp));

		// Only show as deny-listed if it would have been “new” (missing) or “out-of-date”
		if (!exists || !upToDate) {
		  previewList.push({
			filePath: vp,
			action: 'deny-listed – will not update',
			selected: false,
		  });
		}
	  }
	}

	// 2) FULL-SYNC mode (skip any file/folder that is blacklisted)
	if (!this.settings.customizeUpdates) {
	  for (const f of this.manifestCache.files) {
		// ── SKIP any optional:true file
		if (f.optional) {
		  continue;
		}

		const custom = this.settings.customPaths.find((c) => c.manifestKey === f.key);
		const isInDenyFolder = denyListedFolders.some((folder) =>
		  f.path.startsWith(folder + '/')
		);
		if (custom?.doUpdate === false || isInDenyFolder) {
		  continue;
		}

		const vp = this.resolveVaultPath(f.path);
		let tag = '';
		if (vp !== f.path) tag = ' (remapped)';

		const exists = await this.app.vault.adapter.exists(vp);
		if (!exists) {
		  previewList.push({
			filePath: vp,
			action: `new file${tag}`,
			selected: true,
		  });
		} else if (!(await this.fileCacheManager.isUpToDate(vp))) {
		  previewList.push({
			filePath: vp,
			action: `will be overwritten${tag}`,
			selected: true,
		  });
		}
	  }

	  for (const fld of this.manifestCache.folders) {
		// ── SKIP any optional:true folder
		if (fld.optional) {
		  continue;
		}

		const isDenyFolder = denyListedFolders.includes(fld.path);
		if (!(await this.app.vault.adapter.exists(fld.path)) && !isDenyFolder) {
		  previewList.push({
			filePath: fld.path,
			action: 'missing folder (will be created)',
			selected: true,
			isFolder: true,
		  });
		}
	  }

	  return previewList;
	}

	// 3) CUSTOM-SYNC mode (skip any file/folder that is blacklisted)
	for (const entry of this.manifestCache.files) {
	  // ── SKIP any optional:true file
	  if (entry.optional) {
		continue;
	  }

	  const custom = this.settings.customPaths.find((c) => c.manifestKey === entry.key);
	  const isInDenyFolder = denyListedFolders.some((folder) =>
		entry.path.startsWith(folder + '/')
	  );
	  if (custom?.doUpdate === false || isInDenyFolder) {
		continue;
	  }

	  const vaultPath = custom?.vaultPath ?? this.resolveVaultPath(entry.path);
	  const exists = await this.app.vault.adapter.exists(vaultPath);
	  const upToDate = exists && (await this.fileCacheManager.isUpToDate(vaultPath));

	  let tag = '';
	  if (vaultPath !== entry.path) tag = ' (remapped)';

	  if (!exists) {
		previewList.push({
		  filePath: vaultPath,
		  action: `new file${tag}`,
		  selected: true,
		});
	  } else if (!upToDate) {
		previewList.push({
		  filePath: vaultPath,
		  action: `will be overwritten${tag}`,
		  selected: true,
		});
	  }
	}

	for (const entry of this.manifestCache.folders) {
	  // ── SKIP any optional:true folder
	  if (entry.optional) {
		continue;
	  }

	  const isDenyFolder = denyListedFolders.includes(entry.path);
	  if (!(await this.app.vault.adapter.exists(entry.path)) && !isDenyFolder) {
		previewList.push({
		  filePath: entry.path,
		  action: 'missing folder (will be created)',
		  selected: true,
		  isFolder: true,
		});
	  }
	}

	// 3c) “Moved” detection (skip blacklisted)
	for (const f of this.manifestCache.files) {
	  // ── SKIP any optional:true file
	  if (f.optional) {
		continue;
	  }

	  const manifestKey = f.key;
	  const manifestPath = f.path;
	  const custom = this.settings.customPaths.find((c) => c.manifestKey === manifestKey);
	  const prevPath = this.oldPathsByGithub[manifestPath];

	  const isInDenyFolder = denyListedFolders.some((folder) =>
		manifestPath.startsWith(folder + '/')
	  );
	  if (custom?.doUpdate === false || isInDenyFolder) {
		continue;
	  }
	  if (custom && custom.vaultPath && custom.vaultPath !== manifestPath) {
		continue;
	  }
	  if (
		prevPath &&
		prevPath !== manifestPath &&
		(!custom || custom.vaultPath === manifestPath)
	  ) {
		previewList.push({
		  filePath: prevPath,
		  action: `moved → ${manifestPath}`,
		  selected: true,
		});
	  }
	}

	return previewList;
  }

  
  
  
  async forceUpdatePreviewAndConfirm() {
	// 1) Build the flat list of PreviewItem objects
	const previewList = await this.buildForceUpdatePreview();
  
	// 2) Split the items into “deny-listed” vs. “normal” items
	//    (buildForceUpdatePreview uses action = 'deny-listed – will not update')
	const denyItems: PreviewItem[] = [];
	const normalItems: PreviewItem[] = [];
	for (const item of previewList) {
	  if (item.action.startsWith('deny-listed')) {
		denyItems.push(item);
	  } else {
		normalItems.push(item);
	  }
	}
  
	// 3) Create and open the modal with both lists
	const modal = new (class extends Modal {
	  plugin: VVunderloreToolkitPlugin;
	  normal: PreviewItem[];
	  denied: PreviewItem[];
  
	  constructor(app: App, normal: PreviewItem[], denied: PreviewItem[]) {
		super(app);
		this.normal = normal;
		this.denied = denied;
	  }
  
	  onOpen() {
		// Prevent clicks from closing anything behind
		this.contentEl.addEventListener('click', (e) => e.stopPropagation());
		this.contentEl.empty();
		this.titleEl.setText('Force Update Preview');
  
		// Intro paragraph
		this.contentEl.createEl('p', {
		  text:
			'The following items will be updated. Uncheck any items you do NOT want to change, then click "Confirm and Update".',
		});
  
		// 4) Render “normal” (non-deny) items with checkboxes
		if (this.normal.length) {
		  const normalContainer = this.contentEl.createEl('div');
		  Object.assign(normalContainer.style, {
			maxHeight: '300px',
			overflowY: 'auto',
			marginTop: '1em',
		  });
  
		  this.normal.forEach((item) => {
			const row = normalContainer.createDiv();
			Object.assign(row.style, {
			  display: 'flex',
			  alignItems: 'flex-start',
			  justifyContent: 'space-between',
			  padding: '6px 0',
			  fontFamily: 'monospace',
			});
  
			// Left: file path + action note
			const label = row.createDiv();
			label.style.flexGrow = '1';
			label.style.display = 'flex';
			label.style.flexDirection = 'column';
  
			const labelWrapper = label.createDiv();
			labelWrapper.textContent = item.filePath;
  
			const note = label.createDiv({ text: item.action });
			note.style.fontSize = '13px';
			note.style.color = 'var(--text-muted)';
			note.style.fontStyle = 'italic';
  
			// Right: checkbox
			const checkbox = row.createEl('input', { type: 'checkbox' });
			checkbox.checked = item.selected;
			checkbox.onchange = () => {
			  item.selected = checkbox.checked;
			};
		  });
		} else {
			const noCandidates = this.contentEl.createEl('div');
			Object.assign(noCandidates.style, {
			  display: 'inline-block',
			  fontFamily: 'monospace',
			  fontStyle: 'italic',
			  marginTop: '0.5em',
			});
			noCandidates.textContent = 'No force-update candidates.';
		}
  
		// 5) Render “deny-listed” items inside a collapsed <details>
		if (this.denied.length) {
		  const denyDetails = this.contentEl.createEl('details', { cls: 'vk-section' });
		  denyDetails.open = false;
  
		  const summary = denyDetails.createEl('summary', { cls: 'vk-section-header' });
		  Object.assign(summary.style, {
			cursor: 'pointer',
			display: 'flex',
			color: 'var(--text-faint)',
			alignItems: 'center',
			gap: '0.5em',
			marginTop: '1em',
		  });
		  summary.createEl('span', { text: `Deny-List Files (${this.denied.length})` });
  
		  // Rotating “VV” icon on expand/collapse
		  const toggleIcon = summary.createEl('span', { text: 'VV', cls: 'vk-toggle-icon' });
		  Object.assign(toggleIcon.style, {
			fontWeight: 'bold',
			display: 'inline-block',
			transition: 'transform 0.2s ease',
			transformOrigin: '50% 50%',
			userSelect: 'none',
			transform: 'rotate(180deg)',
		  });
		  denyDetails.ontoggle = () => {
			toggleIcon.style.transform = denyDetails.open ? 'rotate(0deg)' : 'rotate(180deg)';
		  };
  
		  // Body of <details> — each deny-listed item is faint and disabled
		  const denyBody = denyDetails.createDiv({ cls: 'vk-section-body' });
		  denyBody.style.paddingLeft = '1em';
  
		  this.denied.forEach((item) => {
			const row = denyBody.createDiv();
			Object.assign(row.style, {
			  display: 'flex',
			  alignItems: 'flex-start',
			  justifyContent: 'space-between',
			  padding: '6px 0',
			  fontFamily: 'monospace',
			  color: 'var(--text-faint)',
			  fontStyle: 'italic',
			});
  
			const labelWrapper = row.createDiv();
			labelWrapper.textContent = item.filePath;
			labelWrapper.style.textDecoration = 'line-through';
  
			const note = row.createDiv({ text: item.action });
			note.style.fontSize = '13px';
			note.style.color = 'var(--text-faint)';
			note.style.fontStyle = 'italic';
  
			// Deny-listed checkbox is disabled
			const checkbox = row.createEl('input', { type: 'checkbox' });
			checkbox.checked = item.selected;
			checkbox.disabled = true;
			checkbox.title = 'This item is deny-listed';
		  });
		}
  
		// 6) Buttons at the bottom
		const buttonRow = this.contentEl.createEl('div');
		Object.assign(buttonRow.style, {
		  display: 'flex',
		  justifyContent: 'flex-end',
		  gap: '0.5em',
		  marginTop: '1.5em',
		});
  
		const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();
  
		const confirmBtn = buttonRow.createEl('button', {
		  text: 'Confirm and Update',
		  cls: 'mod-cta',
		});
		confirmBtn.onclick = async () => {
		  this.close();
		  // Pass everything into performForceUpdateWithSelection; deny-listed items will be skipped
		  await this.plugin.performForceUpdateWithSelection([...this.normal, ...this.denied]);
		};
	  }
  
	  onClose() {
		this.contentEl.empty();
	  }
	})(this.app, normalItems, denyItems);
  
	// Attach plugin pointer and open
	(modal as any).plugin = this;
	modal.open();
  }
  

  async updateEntryFromManifest(entry: ManifestFileEntry, force: boolean = false) {
    const custom = this.settings.customPaths.find((c) => c.manifestKey === entry.key);
    if (custom?.doUpdate === false) {
      console.log(`⏭️ Skipping ${entry.key} (${entry.displayName}) — blacklisted`);
      return;
    }

    const finalVaultPath = custom?.vaultPath ?? this.resolveVaultPath(entry.path);
    if (!force && (await this.fileCacheManager.isUpToDate(finalVaultPath))) {
      console.log(`✔️ Already up to date: ${entry.displayName}`);
      return;
    }

    const url = `https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-full/main/${entry.path}`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      await this.app.vault.adapter.write(finalVaultPath, text);
      await this.fileCacheManager.updateCache(finalVaultPath, text, entry.path);
      console.log(`✅ Updated ${entry.displayName} → ${finalVaultPath}`);
    } catch (e) {
      console.error(`❌ Error updating ${entry.displayName}:`, e);
    }
  }

  async performForceUpdateWithSelection(previewList: PreviewItem[]) {
    if (this.settings.autoBackupBeforeUpdate) {
      // … (your existing backup code) …
    }

    this.settings.backupFiles = {};
    await this.saveSettings();

    try {
      // ① Filter out folders, unchecked, and deny-listed:
      const toUpdate = previewList.filter(
        (item) =>
          item.selected &&
          !item.isFolder &&
          !this.settings.customPaths.some(
            (c) => c.vaultPath === item.filePath && c.doUpdate === false
          )
      );

      // ② Update each selected file
      for (const item of toUpdate) {
        const entry = this.manifestCache.files.find(
          (f) => this.resolveVaultPath(f.path) === item.filePath
        );
        if (!entry) {
          console.warn(`⚠️ Could not match preview item to manifest: ${item.filePath}`);
          continue;
        }
        await this.updateEntryFromManifest(entry, true);
      }

      // ③ Ensure all manifest folders exist
      for (const entry of this.manifestCache.folders) {
        if (!(await this.app.vault.adapter.exists(entry.path))) {
          await this.app.vault.createFolder(entry.path);
        }
      }

      // 4) Bump version
      await this.updateVersionFile();
      this.settings.installedVersion = this.settings.latestToolkitVersion ?? 'unknown';
      this.settings.lastForceUpdate = new Date().toISOString();
      await this.saveSettings();

      new Notice('✅ Toolkit force‐updated with your selections.');

      if (this.settingsTab) {
        await this.settingsTab.updateVersionDisplay();
      }
    } catch (err) {
      console.error('❌ Force update failed. Version not changed.', err);
      new Notice('❌ One or more files failed. Version NOT updated.');
    }

    if (this.settings.highlightEnabled) {
      this.enableHighlight();
    }
  }

  // ─── SINGLE-FILE UPDATE (with GitHub API + raw fallback) ──────────────

  async updateSingleFileFromGitHub(
    { githubPath, vaultPath }: { githubPath: string; vaultPath: string },
    force: boolean = false
  ) {
    if (this.settings.customizeUpdates) {
      vaultPath = this.resolveVaultPath(githubPath);
      const custom = this.settings.customPaths.find((c) => c.manifestKey === githubPath);
      if (custom?.doUpdate === false) {
        return;
      }
    } else {
      vaultPath = githubPath;
    }

    if (!vaultPath) {
      console.error(`❌ No valid vault path resolved for ${githubPath}`);
      return;
    }

    // 1) Handle local renames first
    const oldVault = this.oldPathsByGithub[githubPath];
    if (oldVault && oldVault !== vaultPath) {
      if (await this.app.vault.adapter.exists(vaultPath)) {
        const stray = await this.app.vault.adapter.read(vaultPath);
        await this.backupFile(vaultPath, stray);
        await this.app.vault.adapter.remove(vaultPath);
      }
      const oldFile = this.app.vault.getAbstractFileByPath(oldVault);
      if (oldFile instanceof TFile) {
        await this.app.vault.rename(oldFile, vaultPath);
        const newContent = await this.app.vault.adapter.read(vaultPath);
        await this.fileCacheManager.updateCache(vaultPath, newContent, githubPath);
        return;
      }
    }

    // 2) Existence, backup & skip logic
    const fileExists = await this.app.vault.adapter.exists(vaultPath);
    if (force && fileExists) {
      const current = await this.app.vault.adapter.read(vaultPath);
      await this.backupFile(vaultPath, current);
    }
    if (!force && fileExists && (await this.fileCacheManager.isUpToDate(vaultPath))) {
      return;
    }

    // 3) Fetch via GitHub API, fallback to raw
    const apiUrl = encodeURI(
      `https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/contents/${githubPath}?ref=main`
    );
    try {
      let res = await fetch(apiUrl);
      if (res.status === 404) {
        const rawUrl = encodeURI(
          `https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/${githubPath}`
        );
        res = await fetch(rawUrl);
        if (!res.ok) throw new Error(`Raw fetch failed: ${res.statusText}`);
        const content = await res.text();
        if (fileExists) {
          await this.app.vault.adapter.write(vaultPath, content);
        } else {
          await this.app.vault.create(vaultPath, content);
        }
        await this.fileCacheManager.updateCache(vaultPath, content, githubPath);
        return;
      }

      if (!res.ok) throw new Error(`GitHub API error: ${res.statusText}`);
      const { download_url } = (await res.json()) as { download_url: string };
      const content = await (await fetch(download_url)).text();
      if (fileExists) {
        await this.app.vault.adapter.write(vaultPath, content);
      } else {
        await this.app.vault.create(vaultPath, content);
      }
      await this.fileCacheManager.updateCache(vaultPath, content, githubPath);
    } catch (e) {
      console.error(`❌ Failed to update ${vaultPath}`, e);
    }
  }

  // ─── PREVIEW + REMOTE-BASELINE + DIFF ─────────────────────────────────

  async previewUpdatesModal() {
	// “Loading…” placeholder while syncing
	const loading = new (class extends Modal {
	  constructor(app: App) {
		super(app);
	  }
	  onOpen() {
		this.contentEl.empty();
		this.contentEl
		  .createDiv({
			text: '🔄 Checking for updates…',
			cls: 'mod-warning',
		  })
		  .addEventListener('click', (e) => e.stopPropagation());
	  }
	})(this.app);
  
	loading.open();
	await this.syncManifest();
	await this.fetchRemoteBaseline();
	// buildUpdatePreview() now returns only “real” diffs (no stale deny‐list)
	const diffs = await this.buildUpdatePreview();
	loading.close();
  
	// Split out deny‐listed lines vs. everything else
	const denyListedLines: string[] = [];
	const normalLines: string[] = [];
  
	for (const d of diffs) {
	  if (d.startsWith('❌ deny‐listed')) {
		denyListedLines.push(d);
	  } else {
		normalLines.push(d);
	  }
	}
  
	// Now create the modal
	const modal = new (class extends Modal {
	  plugin: VVunderloreToolkitPlugin;
	  normal: string[];
	  denied: string[];
  
	  constructor(app: App, normal: string[], denied: string[]) {
		super(app);
		this.normal = normal;
		this.denied = denied;
	  }
  
	  onOpen() {
		this.contentEl.empty();
		this.titleEl.setText('Update Preview');
  
		// Intro paragraph
		this.contentEl.createEl('p', {
		  text: 'Only files whose contents differ from GitHub will be updated:',
		});
  
		// 1) If there are any “normal” diffs, render them in a bullet list
		if (this.normal.length) {
		  const ul = this.contentEl.createEl('ul');
		  this.normal.forEach((line) => {
			const li = ul.createEl('li', { text: line });
			// No special styling for these; they show up normally.
		  });
		} else {
		  // If no normal diffs, say “Up to date”
		  this.contentEl.createEl('div', {
			text: '✅ Everything is already up to date!',
			cls: 'mod-info',
		  });
		}
  
		// 2) If there are any deny‐listed lines, tuck them into a <details> block
		if (this.denied.length) {
		  const denyDetails = this.contentEl.createEl('details', { cls: 'vk-section' });
		  // Always start collapsed by default
		  denyDetails.open = false;
  
		  // Summary line: shows “Deny‐List Files (n)”
		  const summary = denyDetails.createEl('summary', { cls: 'vk-section-header' });
		  Object.assign(summary.style, {
			cursor: 'pointer',
			display: 'flex',
			color: 'var(--text-faint)',
			alignItems: 'center',
			gap: '0.5em',
		  });
		  summary.createEl('span', { text: `Deny‐List Files (${this.denied.length})` });
  
		  // Right‐side icon rotating on expand/collapse
		  const toggleIcon = summary.createEl('span', { text: 'VV', cls: 'vk-toggle-icon' });
		  Object.assign(toggleIcon.style, {
			fontWeight: 'bold',
			display: 'inline-block',
			transition: 'transform 0.2s ease',
			transformOrigin: '50% 50%',
			userSelect: 'none',
			transform: 'rotate(180deg)',
		  });
		  denyDetails.ontoggle = () => {
			toggleIcon.style.transform = denyDetails.open ? 'rotate(0deg)' : 'rotate(180deg)';
		  };
  
		  // Body of the details: a simple <ul> containing only deny‐listed lines
		  const denyBody = denyDetails.createDiv({ cls: 'vk-section-body' });
		  denyBody.style.paddingLeft = '1em';
		  const denyUl = denyBody.createEl('ul');
		  this.denied.forEach((line) => {
			const li = denyUl.createEl('li', { text: line });
			li.style.color = 'var(--text-faint)';
			li.style.fontStyle = 'italic';
		  });
		}
  
		const buttonRow = this.contentEl.createEl('div');
		Object.assign(buttonRow.style, {
		  display: 'flex',
		  justifyContent: 'flex-end',
		  marginTop: '1.25em',       // tweak spacing as you like
		});
		
		// “Confirm & Update” button
		const confirmBtn = buttonRow.createEl('button', {
		  text: 'Confirm & Update',
		  cls: 'mod-cta',
		});
		confirmBtn.onclick = async () => {
		  await (this as any).plugin.updateSelectedToolkitContent();
		  this.close();
		};
		
		// “Cancel” button
		const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();
	  }
  
	  onClose() {
		this.contentEl.empty();
	  }
	})(this.app, normalLines, denyListedLines);
  
	// Attach plugin pointer and open
	(modal as any).plugin = this;
	modal.open();
  }
  

  async buildUpdatePreview(): Promise<string[]> {
	const changes: string[] = [];
  
	// 0) Collect all blacklisted folders (manifestKey values where doUpdate === false)
	const denyListedFolders = this.settings.customPaths
	  .filter((c) => c.doUpdate === false)
	  .map((c) => c.manifestKey);
  
	// 1) Deny‐listed entries—but only if they’d actually be “new” (missing) or “out‐of‐date”
	for (const f of this.manifestCache.files) {
	  // ── SKIP any optional:true file
	  if (f.optional) {
		continue;
	  }
  
	  const custom = this.settings.customPaths.find((c) => c.manifestKey === f.path);
	  const isInDenyFolder = denyListedFolders.some((folder) =>
		f.path.startsWith(folder + '/')
	  );
	  if (custom?.doUpdate === false || isInDenyFolder) {
		// Resolve the vault path (handles remapping if present)
		const vp = custom?.vaultPath ?? this.resolveVaultPath(f.path);
  
		// Check if file exists locally and if it’s up‐to‐date
		const exists = await this.app.vault.adapter.exists(vp);
		const upToDate = exists && (await this.fileCacheManager.isUpToDate(vp));
  
		// Only show a deny‐listed entry if it would otherwise be created or overwritten
		if (!exists || !upToDate) {
		  changes.push(`❌ deny‐listed – will not update: ${vp}`);
		}
	  }
	}
  
	// 2) FULL‐SYNC mode (skip any file/folder that’s blacklisted)
	if (!this.settings.customizeUpdates) {
	  for (const f of this.manifestCache.files) {
		// ── SKIP any optional:true file
		if (f.optional) {
		  continue;
		}
  
		const custom = this.settings.customPaths.find((c) => c.manifestKey === f.path);
		const isInDenyFolder = denyListedFolders.some((folder) =>
		  f.path.startsWith(folder + '/')
		);
		if (custom?.doUpdate === false || isInDenyFolder) {
		  continue;
		}
  
		const vp = this.resolveVaultPath(f.path);
		let tag = '';
		if (vp !== f.path) tag = ' (remapped)';
  
		const exists = await this.app.vault.adapter.exists(vp);
		const upToDate = exists && (await this.fileCacheManager.isUpToDate(vp));
  
		if (!exists) {
		  changes.push(`📄 New file: ${vp}${tag}`);
		} else if (!upToDate) {
		  changes.push(`🔁 Will update: ${vp}${tag}`);
		}
	  }
  
	  for (const fld of this.manifestCache.folders) {
		// ── SKIP any optional:true folder
		if (fld.optional) {
		  continue;
		}
  
		const isDenyFolder = denyListedFolders.includes(fld.path);
		const exists = await this.app.vault.adapter.exists(fld.path);
		if (!exists && !isDenyFolder) {
		  changes.push(`📁 New folder: ${fld.path}`);
		}
	  }
  
	  return changes.length ? changes : ['✅ Everything is already up to date!'];
	}
  
	// 3) CUSTOM‐SYNC mode (skip any file/folder that’s blacklisted)
	for (const f of this.manifestCache.files) {
	  // ── SKIP any optional:true file
	  if (f.optional) {
		continue;
	  }
  
	  const custom = this.settings.customPaths.find((c) => c.manifestKey === f.path);
	  const isInDenyFolder = denyListedFolders.some((folder) =>
		f.path.startsWith(folder + '/')
	  );
	  if (custom?.doUpdate === false || isInDenyFolder) {
		continue;
	  }
  
	  const vp = custom?.vaultPath ?? this.resolveVaultPath(f.path);
	  let tag = '';
	  if (vp !== f.path) tag = ' (remapped)';
  
	  const exists = await this.app.vault.adapter.exists(vp);
	  const upToDate = exists && (await this.fileCacheManager.isUpToDate(vp));
  
	  if (!exists) {
		changes.push(`📄 New file: ${vp}${tag}`);
	  } else if (!upToDate) {
		changes.push(`🔁 Will update: ${vp}${tag}`);
	  }
	}
  
	for (const fld of this.manifestCache.folders) {
	  // ── SKIP any optional:true folder
	  if (fld.optional) {
		continue;
	  }
  
	  const isDenyFolder = denyListedFolders.includes(fld.path);
	  const exists = await this.app.vault.adapter.exists(fld.path);
	  if (!exists && !isDenyFolder) {
		changes.push(`📁 New folder: ${fld.path}`);
	  }
	}
  
	// 3c) “Moved” detection (skip blacklisted)
	for (const f of this.manifestCache.files) {
	  // ── SKIP any optional:true file
	  if (f.optional) {
		continue;
	  }
  
	  const manifestKey = f.key;
	  const manifestPath = f.path;
	  const custom = this.settings.customPaths.find((c) => c.manifestKey === manifestKey);
	  const prevPath = this.oldPathsByGithub[manifestPath];
  
	  const isInDenyFolder = denyListedFolders.some((folder) =>
		manifestPath.startsWith(folder + '/')
	  );
	  if (custom?.doUpdate === false || isInDenyFolder) {
		continue;
	  }
	  if (custom && custom.vaultPath && custom.vaultPath !== manifestPath) {
		continue;
	  }
	  if (
		prevPath &&
		prevPath !== manifestPath &&
		(!custom || custom.vaultPath === manifestPath)
	  ) {
		changes.push(`➡️ Moved: ${prevPath} → ${manifestPath}`);
	  }
	}
  
	return changes.length ? changes : ['✅ Everything is already up to date!'];
  }
  
  
  
  // ─── VERSION-CHECK / UPDATE FLOW ─────────────────────────────────────

  async checkForUpdates(): Promise<void> {
    const isNewerVersion = (remote: string, local: string): boolean => {
      const pa = remote
        .replace(/^v/, '')
        .split('.')
        .map((n) => parseInt(n, 10) || 0);
      const pb = local
        .replace(/^v/, '')
        .split('.')
        .map((n) => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return true;
        if ((pa[i] || 0) < (pb[i] || 0)) return false;
      }
      return false;
    };

    const toolkitPath = '.version.json';
    const toolkitUrl =
      'https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-full/main/.version.json';
    const pluginUrl =
      'https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-plugin/main/version.json';
    const changelogUrl =
      'https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/README.md';

    // 1) Read local toolkit version
    let localTK = '0.0.0';
    try {
      const content = await this.app.vault.adapter.read(toolkitPath);
      const json = JSON.parse(content);
      localTK = json.version || localTK;
    } catch (err) {
      console.error('❌ Failed to read local toolkit version:', err);
    }

    // 2) Fetch remote toolkit version & defaults
    let remoteTK = '0.0.0';
    try {
      const res = await fetch(toolkitUrl);
      const data = await res.json();
      remoteTK = data.version || remoteTK;

      this.settings.latestToolkitVersion = remoteTK;
      if (data.defaultPaths) {
        this.settings.latestDefaults = data.defaultPaths;
      }
      this.settings.lastChecked = new Date().toISOString();
      await this.saveSettings();
    } catch (err) {
      console.error('❌ Failed to fetch remote toolkit version:', err);
    }

    console.log({ localTK, remoteTK });
    if (isNewerVersion(remoteTK, localTK)) {
      new Notice(`⚠️ Toolkit update available! Installed: v${localTK}, Latest: v${remoteTK}`);
      await this.fetchRemoteBaseline();
    } else {
      new Notice(`✅ Toolkit is up to date (v${localTK})`);
    }

    // 4) Read local plugin version
    const localPL = this.manifest.version;

    // 5) Fetch remote plugin version & compare
    let remotePL = localPL;
    try {
      const res = await fetch(pluginUrl);
      const data = await res.json();
      remotePL = data.version || remotePL;
    } catch (err) {
      console.error('❌ Failed to fetch remote plugin version:', err);
    }

    console.log({ localPL, remotePL });
    if (isNewerVersion(remotePL, localPL)) {
      new Notice(`⚙️ Plugin update available! Installed: v${localPL}, Latest: v${remotePL}`);
    } else {
      new Notice(`✅ Plugin is up to date (v${localPL})`);
    }

    // 6) Fetch changelog for UI display
    try {
      const changelogRes = await fetch(changelogUrl);
      this.changelog = await changelogRes.text();
    } catch (err) {
      console.error('❌ Failed to fetch changelog:', err);
    }
  }

  async loadSettings() {
	const loaded = (await this.loadData()) as Partial<ToolkitSettings>;
	this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
  
	// Backfill our new fields if the stored data was missing them
	if (typeof this.settings.rulesetCompendium !== "string") {
	  this.settings.rulesetCompendium = "";
	}
	if (!Array.isArray(this.settings.rulesetReference)) {
	  this.settings.rulesetReference = [];
	}
  
	this.fileCacheManager = new ToolkitFileCacheManager(
	  this.app.vault,
	  loaded?.fileCache ?? {},
	  async () => await this.saveSettings()
	);

	// Give vault a moment to settle, then check for marker
	setTimeout(() => this.checkMarkerFile(), 500);
  } 

  async saveSettings() {
    await this.saveData({
      ...this.settings,
      fileCache: this.fileCacheManager.getCache(),
    });
  }

  async getLocalToolkitVersion(): Promise<string | null> {
    try {
      const content = await this.app.vault.adapter.read('.version.json');
      const json = JSON.parse(content);
      return json.version || null;
    } catch (err) {
      console.error('❌ Failed to read .version.json:', err);
      return null;
    }
  }

  async updateFullToolkitRepo(): Promise<void> {
    const excluded = [
      '.obsidian',
      '.gitignore',
      '.gitattributes',
      '.DS_Store',
      'plugins',
      'Compendium',
      'README.md',
      '.version.json',
      '.github'
    ];

    const fetchRepoRoot = async () => {
      const apiUrl =
        'https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/contents/';
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Failed to fetch repo root`);
      return await response.json();
    };

    try {
      const contents = await fetchRepoRoot();
      // filter out excluded top-level items
      const filtered = contents.filter(
        (item: any) =>
          !excluded.some(
            (ex) =>
              item.path === ex ||
              item.path.startsWith(`${ex}/`)
          )
      );

      // Sort so “tree” (folders) come before “blob” (files)
      filtered.sort((a: any, b: any) => (a.type === b.type ? 0 : a.type === 'tree' ? -1 : 1));

      for (const item of filtered) {
        if (item.type === 'dir') {
          await this.updateFolderFromGitHub(item.path, item.path);
        }
        if (item.type === 'file') {
          const response = await fetch(item.download_url);
          const content = await response.text();
          const filePath = item.path;
          const exists = await this.app.vault.adapter.exists(filePath);
          if (!exists) {
            await this.app.vault.create(filePath, content);
          } else {
            const current = await this.app.vault.adapter.read(filePath);
            if (current !== content) {
              await this.app.vault.adapter.write(filePath, content);
            }
          }
          await this.fileCacheManager.updateCache(filePath, content, item.path, false);
        }
      }

      await this.saveSettings();

      const markerPath = '.vvunderlore_installed';
      if (!(await this.app.vault.adapter.exists(markerPath))) {
        await this.app.vault.create(markerPath, '');
      }

      this.settings.needsInstall = false;
      await this.saveSettings();
      if (this.settingsTab) {
        this.settingsTab.display();
      }

      if (this.settings.highlightEnabled) {
        this.enableHighlight();
      }

      new Notice('✅ VVunderlore Toolkit successfully installed!');
    } catch (err) {
      console.error('❌ updateFullToolkitRepo() error:', err);
      new Notice('❌ Failed to install toolkit. See console for details.');
    }
  }

  async updateSelectedToolkitContent() {
    if (this.settings.autoBackupBeforeUpdate) {
      const folder = await this.backupManager.backupVaultMirror('pre-update');
      new Notice(`Vault mirror backup created at: ${folder}`);
    }

    if (!this.settings.latestDefaults) {
      new Notice('❌ GitHub defaults not loaded yet.');
      return;
    }

    const allManifestFiles = this.manifestCache.files.map((f) => f.path);
    const fileOverrides = Object.fromEntries(
      this.settings.customPaths.map((c) => [c.manifestKey, c])
    );

    try {
      for (const ghPath of allManifestFiles) {
        const override = fileOverrides[ghPath];
        if (override?.doUpdate === false) {
          console.log(`⏭️ Skipping deny-listed: ${ghPath}`);
          continue;
        }

        const vaultPath = this.settings.customizeUpdates
          ? this.resolveVaultPath(ghPath)
          : ghPath;

        const entry = this.manifestCache.files.find((f) => f.path === ghPath);
        if (!entry) continue;
        await this.updateEntryFromManifest(entry, false);
      }

      for (const folder of this.manifestCache.folders) {
        if (!(await this.app.vault.adapter.exists(folder.path))) {
          await this.app.vault.createFolder(folder.path);
        }
      }

      await this.updateVersionFile();
      this.settings.installedVersion = this.settings.latestToolkitVersion!;
      await this.saveSettings();
      new Notice('✅ Toolkit content updated.');

      if (this.settingsTab) {
        await this.settingsTab.updateVersionDisplay();
      }
    } catch (err) {
      console.error('❌ Update failed. Version not updated.', err);
      new Notice('❌ Update failed. See console for details. Version file NOT changed.');
    }

    if (this.settings.highlightEnabled) {
      this.enableHighlight();
    }
  }

  async updateFolderFromGitHub(githubFolderPath: string, vaultFolderPath: string) {
    const excluded = [
      '.obsidian',
      '.gitignore',
      '.gitattributes',
      '.DS_Store',
      'plugins',
      'Compendium',
      'README.md',
      '.version.json',
      '.github'
    ];
    if (excluded.some((ex) => githubFolderPath === ex || githubFolderPath.startsWith(`${ex}/`))) {
      return;
    }
    const apiUrl = `https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/contents/${githubFolderPath}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Failed to fetch folder: ${githubFolderPath}`);
      const files = await response.json();
      if (!(await this.app.vault.adapter.exists(vaultFolderPath))) {
        await this.app.vault.createFolder(vaultFolderPath);
      }
      for (const file of files) {
        if (excluded.some((ex) => file.path === ex || file.path.startsWith(`${ex}/`))) {
          continue;
        }
        const filePath = `${vaultFolderPath}/${file.name}`;
        if (file.type === 'file') {
          const fileResponse = await fetch(file.download_url);
          const content = await fileResponse.text();
          const exists = await this.app.vault.adapter.exists(filePath);
          if (exists) {
            const current = await this.app.vault.adapter.read(filePath);
            if (current !== content) {
              await this.backupFile(filePath, current);
            }
          }
          if (!exists) {
            await this.app.vault.create(filePath, content);
          } else {
            if ((await this.app.vault.adapter.read(filePath)) !== content) {
              await this.app.vault.adapter.write(filePath, content);
            }
          }
          await this.fileCacheManager.updateCache(filePath, content, file.path, false);
        } else if (file.type === 'dir') {
          await this.updateFolderFromGitHub(file.path, `${vaultFolderPath}/${file.name}`);
        }
      }
      await this.saveSettings();
      new Notice(`✅ Folder synced: ${vaultFolderPath}`);
    } catch (error) {
      console.error(`❌ Failed to sync folder: ${vaultFolderPath}`, error);
      new Notice(`❌ Failed to update folder: ${vaultFolderPath}`);
    }
  }

  async rebuildFileCache() {
    const cache = this.fileCacheManager;
    const tasks: Promise<void>[] = [];

    // 1) Index exactly the files listed in the manifest
    for (const entry of this.manifestCache.files) {
      const vaultPath = this.resolveVaultPath(entry.path);
      if (await this.app.vault.adapter.exists(vaultPath)) {
        tasks.push((async () => {
          const content = await this.app.vault.adapter.read(vaultPath);
          await cache.updateCache(vaultPath, content, entry.path, false);
        })());
      }
    }

    // 2) Index any markdown children under manifest folders
    for (const folderEntry of this.manifestCache.folders) {
      const folderPath = folderEntry.path;
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (folder instanceof TFolder) {
        Vault.recurseChildren(folder, (file) => {
          if (file instanceof TFile && file.extension === 'md') {
            const filePath = file.path;
            tasks.push((async () => {
              const content = await this.app.vault.adapter.read(filePath);
              await cache.updateCache(filePath, content, filePath, false);
            })());
          }
        });
      }
    }

    const batchSize = 10;
    for (let i = 0; i < tasks.length; i += batchSize) {
      await Promise.all(tasks.slice(i, i + batchSize));
    }

    await this.saveSettings();
  }

  async showIndexingModal() {
    const modal = new (class extends Modal {
      constructor(app: App) {
        super(app);
      }
      onOpen() {
        this.contentEl.addEventListener('click', (e) => e.stopPropagation());
        this.titleEl.setText('🔄 Indexing Toolkit Files...');
        this.contentEl.createEl('p', {
          text: 'Indexing and caching your VVunderlore Vault for faster updates and safer syncing.'
        });
      }
    })(this.app);

    modal.open();
    await this.rebuildFileCache();
    modal.close();
    new Notice('✅ VVunderlore caching complete.');
  }

  async updateVersionFile() {
    if (!this.settings.latestToolkitVersion) {
      console.warn('No latest version found; skipping version file update.');
      return;
    }
    const versionPath = '.version.json';
    const content = JSON.stringify({ version: this.settings.latestToolkitVersion }, null, 2);
    const exists = await this.app.vault.adapter.exists(versionPath);
    if (exists) {
      await this.app.vault.adapter.write(versionPath, content);
    } else {
      await this.app.vault.create(versionPath, content);
    }
  }

  /** main.ts **/

/** 
 * Install the selected compendium and zero or more reference editions.
 */
public async installFullToolkit(
  opts: { compendium: string; references: string[] } = { compendium: "", references: [] }
): Promise<void> {
  const { compendium, references } = opts;
  if (!compendium) {
    throw new Error("No compendium edition selected");
  }

  // 1) Show the “Installing…” spinner
  const placeholder = new InstallingModal(this.app);
  placeholder.open();

  let installSucceeded = false;
  try {
    // 2) Static copy of everything in the repo EXCEPT any Compendium/*
    const treeApi =
      "https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/git/trees/main?recursive=1";
    const resp = await fetch(treeApi);
    if (!resp.ok) {
      throw new Error(`Failed to list repo tree: ${resp.statusText}`);
    }
    const json: any = await resp.json();
    const items = Array.isArray(json.tree) ? json.tree : [];

    // Use your excludedPaths (which already contains "Compendium")
    const staticEntries = (items as Array<{ path: string; type: string }>)
      .filter((item) =>
        !this.excludedPaths.some(ex =>
          item.path === ex || item.path.startsWith(`${ex}/`)
        )
      )
      .sort((a, b) => (a.type === b.type ? 0 : a.type === "tree" ? -1 : 1));

    for (const entry of staticEntries) {
      if (entry.type === "tree") {
        if (!(await this.app.vault.adapter.exists(entry.path))) {
          await this.app.vault.createFolder(entry.path);
        }
      } else {
        const rawUrl = 
          `https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/${encodeURIComponent(entry.path)}`;
        const fileResp = await fetch(rawUrl);
        if (!fileResp.ok) continue;
        const text = await fileResp.text();
        if (await this.app.vault.adapter.exists(entry.path)) {
          const old = await this.app.vault.adapter.read(entry.path);
          if (old !== text) {
            await this.app.vault.adapter.write(entry.path, text);
          }
        } else {
          await this.app.vault.create(entry.path, text);
        }
      }
    }

    // 3) Kick off your JSON→MD parsers in parallel
    const parseJobs = [
      importRulesetData({
        app: this.app,
        editionKey: compendium,
        targetPath: `Compendium`,
      }),
      ...references.map(refKey =>
        importRulesetData({
          app: this.app,
          editionKey: refKey,
          targetPath: `${refKey}`,
        })
      ),
    ];
    // this won’t resolve until _all_ parsers have finished writing their MD files
    await Promise.all(parseJobs);

    // 4) Post-install housekeeping
    const marker = ".vvunderlore_installed";
    if (!(await this.app.vault.adapter.exists(marker))) {
      await this.app.vault.create(marker, "");
    }
    this.settings.needsInstall     = false;
    this.settings.highlightEnabled = true;
    await this.saveSettings();
    this.enableHighlight();

    installSucceeded = true;
  } catch (err) {
    console.error("❌ installFullToolkit()", err);
  } finally {
    // only now close the spinner & redraw the UI
    placeholder.close();
    if (this.settingsTab) this.settingsTab.display();
    new Notice(
      installSucceeded
        ? "✅ VVunderlore Toolkit successfully installed!"
        : "❌ Failed to install toolkit. See console for details."
    );
  }
}



}
export { InstallingModal };