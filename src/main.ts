// src/main.ts
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

class InstallingModal extends Modal {
	constructor(app: App) {
	  super(app);
	}
	onOpen() {
	  this.contentEl.empty();
	  this.contentEl
		.createDiv({ text: 'Installing…', cls: 'mod-quiet' })
		.style.cssText =
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
  highlightColorDark: 'rgb( 50,  70,  50)'
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

    const markerPath = '.vvunderlore_installed';
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

    // 1) Deny-listed files first
    for (const entry of this.manifestCache.files) {
      const custom = this.settings.customPaths.find((c) => c.manifestKey === entry.key);
      if (custom?.doUpdate === false) {
        previewList.push({
          filePath: custom.vaultPath ?? entry.path,
          action: 'deny-listed – will not update',
          selected: false,
        });
      }
    }

    // 2) FULL-SYNC mode
    if (!this.settings.customizeUpdates) {
      for (const f of this.manifestCache.files) {
        const vp = this.resolveVaultPath(f.path);
        if (this.settings.customPaths.some((c) => c.vaultPath === vp && c.doUpdate === false)) {
          continue;
        }
        let tag = '';
        if (vp !== f.path) tag = ' (remapped)';

        if (!(await this.app.vault.adapter.exists(vp))) {
          previewList.push({ filePath: vp, action: `new file${tag}`, selected: true });
        } else if (!(await this.fileCacheManager.isUpToDate(vp))) {
          previewList.push({ filePath: vp, action: `will be overwritten${tag}`, selected: true });
        }
      }

      for (const fld of this.manifestCache.folders) {
        if (!(await this.app.vault.adapter.exists(fld.path))) {
          previewList.push({ filePath: fld.path, action: 'missing folder (will be created)', selected: true, isFolder: true });
        }
      }
      return previewList;
    }

    // 3) CUSTOM-SYNC mode (skip deny-listed)
    for (const entry of this.manifestCache.files) {
      const custom = this.settings.customPaths.find((c) => c.manifestKey === entry.key);
      if (custom?.doUpdate === false) continue;

      const vaultPath = custom?.vaultPath ?? this.resolveVaultPath(entry.path);
      const exists = await this.app.vault.adapter.exists(vaultPath);
      const upToDate = exists && (await this.fileCacheManager.isUpToDate(vaultPath));

      let tag = '';
      if (vaultPath !== entry.path) tag = ' (remapped)';

      if (!exists) {
        previewList.push({ filePath: vaultPath, action: `new file${tag}`, selected: true });
      } else if (!upToDate) {
        previewList.push({ filePath: vaultPath, action: `will be overwritten${tag}`, selected: true });
      }
    }

    for (const entry of this.manifestCache.folders) {
      if (!(await this.app.vault.adapter.exists(entry.path))) {
        previewList.push({ filePath: entry.path, action: 'missing folder (will be created)', selected: true, isFolder: true });
      }
    }

    // 3c) “Moved” detection for stray files
    for (const f of this.manifestCache.files) {
      const manifestKey = f.key;
      const manifestPath = f.path;
      const custom = this.settings.customPaths.find((c) => c.manifestKey === manifestKey);
      const remappedPath = custom?.vaultPath ?? manifestPath;
      const prevPath = this.oldPathsByGithub[manifestPath];

      if (custom?.doUpdate === false) continue;
      if (custom && custom.vaultPath && custom.vaultPath !== manifestPath) continue;
      if (prevPath && prevPath !== manifestPath && (!custom || custom.vaultPath === manifestPath)) {
        previewList.push({
          filePath: prevPath,
          action: `moved → ${manifestPath}`,
          selected: true,
        });
      }
    }

    return previewList;
  }

  async buildForceUpdatePreviewRecursive(githubPath: string): Promise<PreviewItem[]> {
    const previewList: PreviewItem[] = [];
    const apiUrl = `https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/contents/${githubPath}`;
    const response = await fetch(apiUrl);
    if (!response.ok) return previewList;
    const items = await response.json();
    for (const item of items) {
      if (this.isExcluded(item.path)) continue;
      if (item.type === 'dir') {
        previewList.push(...(await this.buildForceUpdatePreviewRecursive(item.path)));
      } else if (item.type === 'file') {
        const exists = await this.app.vault.adapter.exists(item.path);
        if (!exists) {
          previewList.push({ filePath: item.path, action: 'new file', selected: true, isFolder: false });
        } else {
          previewList.push({ filePath: item.path, action: 'will be overwritten', selected: true, isFolder: false });
        }
      }
    }
    return previewList;
  }

  async forceUpdatePreviewAndConfirm() {
    const previewList = await this.buildForceUpdatePreview();
    const modal = new (class extends Modal {
      plugin: VVunderloreToolkitPlugin;
      previewList: PreviewItem[];

      constructor(app: App, previewList: PreviewItem[]) {
        super(app);
        this.previewList = previewList;
      }

      onOpen() {
        this.contentEl.addEventListener('click', (e) => e.stopPropagation());
        this.contentEl.empty();
        this.titleEl.setText('Force Update Preview');

        this.contentEl.createEl('p', {
          text:
            'The following items will be updated. Uncheck any items you do NOT want to change, then click "Confirm and Update".',
        });

        const listContainer = this.contentEl.createEl('div');
        listContainer.style.maxHeight = '400px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.marginTop = '1em';

        this.previewList.forEach((item) => {
          const row = listContainer.createDiv();
          Object.assign(row.style, {
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '6px 0',
            fontFamily: 'monospace',
          });

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

          if (item.action.startsWith('deny-listed')) {
            labelWrapper.style.color = 'var(--text-faint)';
            labelWrapper.style.textDecoration = 'line-through';
            note.style.color = 'var(--text-faint)';
            note.style.fontStyle = 'italic';
            note.style.textDecoration = '';
          }

          const checkbox = row.createEl('input', { type: 'checkbox' });
          checkbox.checked = item.selected;
          if (item.action.startsWith('deny-listed')) {
            checkbox.disabled = true;
            checkbox.title = 'This item is deny-listed';
          } else {
            checkbox.onchange = () => {
              item.selected = checkbox.checked;
            };
          }
        });

        const buttonRow = this.contentEl.createEl('div');
        Object.assign(buttonRow.style, {
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5em',
          marginTop: '1.5em',
        });

        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const confirmBtn = buttonRow.createEl('button', { text: 'Confirm and Update', cls: 'mod-cta' });
        confirmBtn.onclick = async () => {
          this.close();
          await this.plugin.performForceUpdateWithSelection(this.previewList);
        };
      }

      onClose() {
        this.contentEl.empty();
      }
    })(this.app, previewList);

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
    const loading = new (class extends Modal {
      constructor(app: App) {
        super(app);
      }
      onOpen() {
        this.contentEl.empty();
        this.contentEl.createDiv({
          text: '🔄 Checking for updates…',
          cls: 'mod-warning'
        }).addEventListener('click', (e) => e.stopPropagation());
      }
    })(this.app);

    loading.open();
    await this.syncManifest();
    await this.fetchRemoteBaseline();
    const diffs = await this.buildUpdatePreview();
    loading.close();

    const modal = new (class extends Modal {
      plugin: VVunderloreToolkitPlugin;
      diffs: string[];

      constructor(app: App, diffs: string[]) {
        super(app);
        this.diffs = diffs;
      }

      onOpen() {
        this.contentEl.empty();
        this.contentEl.createEl('h2', { text: 'Update Preview' });
        this.contentEl.createEl('p', {
          text: 'Only files whose contents differ from GitHub will be updated:'
        });
        const ul = this.contentEl.createEl('ul');
        this.diffs.forEach((d) => {
          const li = ul.createEl('li', { text: d });
          if (d.startsWith('❌ deny-listed')) {
            li.style.color = 'var(--text-faint)';
            li.style.fontStyle = 'italic';
          }
        });
        new Setting(this.contentEl)
          .addButton((b) =>
            b.setButtonText('Confirm & Update')
              .setCta()
              .onClick(async () => {
                await (this as any).plugin.updateSelectedToolkitContent();
                this.close();
              })
          )
          .addButton((b) =>
            b.setButtonText('Cancel').onClick(() => this.close())
          );
      }

      onClose() {
        this.contentEl.empty();
      }
    })(this.app, diffs);

    (modal as any).plugin = this;
    modal.open();
  }

  async buildUpdatePreview(): Promise<string[]> {
    const changes: string[] = [];

    // 1) Deny-listed entries
    for (const f of this.manifestCache.files) {
      const custom = this.settings.customPaths.find((c) => c.manifestKey === f.path);
      if (custom?.doUpdate === false) {
        const vp = this.resolveVaultPath(f.path);
        changes.push(`❌ deny-listed – will not update: ${vp}`);
      }
    }

    // 2) FULL-SYNC mode (skip deny-listed)
    if (!this.settings.customizeUpdates) {
      for (const f of this.manifestCache.files) {
        const custom = this.settings.customPaths.find((c) => c.manifestKey === f.path);
        if (custom?.doUpdate === false) continue;
        const vp = this.resolveVaultPath(f.path);

        let tag = '';
        if (vp !== f.path) tag = ' (remapped)';

        if (!(await this.app.vault.adapter.exists(vp))) {
          changes.push(`📄 New file: ${vp}${tag}`);
        } else if (!(await this.fileCacheManager.isUpToDate(vp))) {
          changes.push(`🔁 Will update: ${vp}${tag}`);
        }
      }

      for (const fld of this.manifestCache.folders) {
        if (!(await this.app.vault.adapter.exists(fld.path))) {
          changes.push(`📁 New folder: ${fld.path}`);
        }
      }

      return changes.length ? changes : ['✅ Everything is already up to date!'];
    }

    // 3) CUSTOM mode
    for (const f of this.manifestCache.files) {
      const custom = this.settings.customPaths.find((c) => c.manifestKey === f.path);
      if (custom?.doUpdate === false) continue;
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
      if (!(await this.app.vault.adapter.exists(fld.path))) {
        changes.push(`📁 New folder: ${fld.path}`);
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

  public async installFullToolkit(): Promise<void> {
	
	if (this.settings.autoBackupBeforeUpdate) {
		// You can skip this if the vault is completely empty, but the simplest check is:
		const allFiles = await this.app.vault.getFiles();
		if (allFiles.length > 0) {
		  const backupFolder = await this.backupManager.backupVaultMirror('pre-install');
		  new Notice(`Backup before full install created at: ${backupFolder}`);
		}
	  }
	
	// ─── (A) show the “Installing…” placeholder immediately ─────────────────
	const placeholder = new InstallingModal(this.app);
	placeholder.open();
  
	try {
	  // ─── (B) Now run exactly the same code you had before… ──────────────────
	  const treeApi =
		'https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/git/trees/main?recursive=1';
	  const treeResp = await fetch(treeApi);
	  if (!treeResp.ok) {
		throw new Error(`Failed to list repo tree: ${treeResp.status} ${treeResp.statusText}`);
	  }
  
	  const treeJson: any = await treeResp.json();
	  if (!treeJson.tree || !Array.isArray(treeJson.tree)) {
		throw new Error('Unexpected GitHub response: treeJson.tree missing or not an array');
	  }
  
	  const skipPrefixes = ['.git/', 'scripts/'];
	  const skipFiles = ['.gitignore'];
  
	  // (Optional) whitelist under Compendium, if needed:
	  const compendiumWhitelist: string[] = [
		// e.g. "Compendium/Spells"
	  ];
  
	  const filtered = (treeJson.tree as Array<{ path: string; type: 'blob' | 'tree' }>)
		.filter((item) => {
		  if (skipPrefixes.some((pref) => item.path.startsWith(pref))) return false;
		  if (skipFiles.includes(item.path)) return false;
		  if (item.type === 'blob' && item.path.startsWith('Compendium/')) {
			const allowed = compendiumWhitelist.some((white) => item.path.startsWith(white + '/'));
			return allowed;
		  }
		  return true;
		});
  
	  // Ensure folders come before files
	  filtered.sort((a, b) => (a.type === b.type ? 0 : a.type === 'tree' ? -1 : 1));
  
	  for (const entry of filtered) {
		if (entry.type === 'tree') {
		  if (!(await this.app.vault.adapter.exists(entry.path))) {
			await this.app.vault.createFolder(entry.path);
		  }
		} else {
		  // entry.type === 'blob'
		  const encodedPath = encodeURI(entry.path);
		  const rawUrl = `https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/${encodedPath}`;
		  const fileResp = await fetch(rawUrl);
		  if (!fileResp.ok) {
			console.warn(`[install] skipping ${entry.path} (HTTP ${fileResp.status})`);
			continue;
		  }
		  const fileText = await fileResp.text();
		  if (await this.app.vault.adapter.exists(entry.path)) {
			const existing = await this.app.vault.adapter.read(entry.path);
			if (existing !== fileText) {
			  await this.app.vault.adapter.write(entry.path, fileText);
			}
		  } else {
			await this.app.vault.create(entry.path, fileText);
		  }
		}
	  }
  
	  // ─── (C) Create marker file + flip needsInstall + enable highlight ─────────
	  const markerPath = '.vvunderlore_installed';
	  if (!(await this.app.vault.adapter.exists(markerPath))) {
		await this.app.vault.create(markerPath, '');
	  }
  
	  this.settings.needsInstall = false;
	  await this.saveSettings();
	  if (this.settingsTab) {
		this.settingsTab.display();
	  }
  
	  this.settings.highlightEnabled = true;
	  await this.saveSettings();
	  this.enableHighlight();
  
	  new Notice('✅ VVunderlore Toolkit successfully installed!');
	} catch (err) {
	  console.error('❌ installFullToolkit() error:', err);
	  new Notice('❌ Failed to install toolkit. See console for details.');
	} finally {
	  // ─── (D) close “Installing…” placeholder once everything is done ─────────
	  placeholder.close();
	}
  }
  
}
export { InstallingModal };