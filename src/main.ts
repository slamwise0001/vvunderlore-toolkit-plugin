import { App, Plugin, Notice, Modal, Setting, TFolder, TFile, Vault, requestUrl, WorkspaceLeaf, addIcon, MarkdownView } from 'obsidian';
import { ToolkitSettingsTab } from './settings';
import { ToolkitFileCacheManager } from './fileCacheManager';
import type { ToolkitFileCacheEntry } from './fileCacheManager';
import { BackupManager } from './backup/BackupManager';
import { showCustomInstallModal } from './customInstallModal';
import { AVAILABLE_EDITIONS } from './editions';
import { importRulesetData } from './rulesetInstaller';
import { ConfirmFreshInstallModal } from './firstinstallconfirm';
import "../styles.css";
import { SidebarTemplatesView, SIDEBAR_VIEW_TYPE } from './sidebar/sb-worldbuilding';
import { GameplaySidebarView, GAMEPLAY_VIEW_TYPE } from './sidebar/sb-gameplay';
import { updateModalFormsFromRepo } from './modalFormsUpdater';
import { AdventureSortOption } from './types';
import { getAdventureCategoryIds } from './adv-categories';


function getRulesetDisplayName(key: string): string {
  const ed = AVAILABLE_EDITIONS.find(e => e.id === key);
  return ed?.label ?? key;
}

const mapmaking_icon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
    <g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.97 10.15v7.08c0 .38-.21.72-.55.89l-4.55 2.28c-.56.28-1.23.28-1.79 0l-4.21-2.11c-.56-.28-1.23-.28-1.79 0L4.42 20.12a1 1 0 0 1-1.45-.9V6.47c0-.38.21-.72.55-.89l4.55-2.28c.56-.28 1.23-.28 1.79 0l2.52 1.28"/>
      <path d="M14.97 13.51v7.1"/>
      <path d="M8.97 3.09v15"/>
      <path d="M21.48 5.03a1.79 1.79 0 1 0-2.53-2.53l-4.22 4.22c-.2.2-.35.45-.43.72l-.7 2.42a.4.4 0 0 0 .53.49l2.42-.7c.27-.08.52-.23.72-.43l4.22-4.22Z"/>
    </g>
  </svg>
`;

const gameplay_icon = `
<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24">
  <!-- Generator: Adobe Illustrator 29.2.1, SVG Export Plug-In . SVG Version: 2.1.0 Build 116)  -->
  <defs>
    <style>
      .st0 {
        fill: currentColor;
      }

      .st0, .st1 {
        stroke: currentColor;
        stroke-miterlimit: 10;
      }

      .st0, .st1, .st2 {
        stroke-width: 2px;
      }

      .st1, .st2 {
        fill: none;
      }

      .st2 {
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .st3 {
        display: none;
      }
    </style>
  </defs>
  <g id="Layer_4" class="st3">
    <path class="st0" d="M11.98-25.16c-1.29,0-2.79.18-3.25.23-.07,0-.12-.03-.12-.08l.19-2.56c0-.08.05-.16.11-.21.22-.17.91-.51,3.06-.51"/>
    <path class="st1" d="M8.24-26.61s-2.39.43-2.78.76c-.22.19-1.52,9.89-1.9,12.91-.07.56.18,1.12.64,1.44.57.39,1.31.84,1.67.84"/>
    <path class="st1" d="M11.98-8.36c-2.92,0-5.04-.09-5.7-.13-.13,0-.21-.11-.21-.24.03-.42.11-1.5.16-2.1.02-.26.19-.49.44-.57l2.65-1.28h2.66"/>
    <path class="st0" d="M11.98-8.36c-2.92,0-5.04-.09-5.7-.13-.13,0-.21-.11-.21-.24.03-.42.11-1.5.16-2.1.02-.26.19-.49.44-.57l2.65-1.28h2.66"/>
    <path class="st0" d="M11.98-8.36c2.92,0,5.04-.09,5.7-.13.13,0,.21-.11.21-.24-.03-.42-.11-1.5-.16-2.1-.02-.26-.19-.49-.44-.57l-2.65-1.28h-2.66"/>
    <path class="st0" d="M11.98-25.16c1.29,0,2.79.18,3.25.23.07,0,.12-.03.12-.08l-.19-2.56c0-.08-.05-.16-.11-.21-.22-.17-.91-.51-3.06-.51"/>
    <path class="st1" d="M9-24.92l-1.47,6.19c-.12.52-.19,1.06-.17,1.59,0,.41.05.88.15,1.29.25.94,1.39,2.3,1.39,3.17h6.17c0-.86,1.13-2.23,1.38-3.17.11-.4.14-.88.15-1.29.01-.54-.05-1.07-.17-1.59l-1.47-6.19-.23-.11c-1.83-.22-3.67-.22-5.5,0,0,0-.23.11-.23.11Z"/>
    <path class="st1" d="M15.77-26.61s2.39.43,2.78.76c.22.19,1.52,9.89,1.9,12.91.07.56-.18,1.12-.64,1.44-.57.39-1.31.84-1.67.84"/>
  </g>
  <g id="Layer_5" class="st3">
    <path class="st2" d="M20.97-16.16v7.08c0,.38-.21.72-.55.89l-4.55,2.28c-.56.28-1.23.28-1.79,0l-4.21-2.11c-.56-.28-1.23-.28-1.79,0l-3.66,1.83c-.49.25-1.09.05-1.34-.45-.07-.14-.11-.29-.11-.45v-12.76c0-.38.21-.72.55-.89l4.55-2.28c.56-.28,1.23-.28,1.79,0l2.52,1.28"/>
    <path class="st2" d="M14.97-12.8v7.1"/>
    <path class="st2" d="M8.97-23.23v15"/>
    <path class="st2" d="M21.48-21.29c.7-.7.7-1.83,0-2.53s-1.83-.7-2.53,0l-4.22,4.22c-.2.2-.35.45-.43.72l-.7,2.42c-.07.22.06.46.29.52.08.02.16.02.24,0l2.42-.7c.27-.08.52-.23.72-.43l4.22-4.22h0Z"/>
  </g>
  <g id="Layer_6">
    <path class="st2" d="M5.87,10.85h12.15v9.15c0,.55-.45,1-1,1H6.87c-.55,0-1-.45-1-1v-9.15h0Z"/>
    <polyline class="st2" points="5.87 10.85 1.97 9.1 1.97 19.15 6.56 20.95"/>
    <polyline class="st2" points="18.02 10.85 22 9.1 22 19.15 17.33 20.95"/>
  </g>
  <g id="Layer_7">
    <path class="st2" d="M8.5,5.77s-2.08-.95-1.89-3.34c0,0,1.56,1.84,2.79,1.86"/>
    <path class="st2" d="M15.51,5.77s2.08-.95,1.89-3.34c0,0-1.56,1.84-2.79,1.86"/>
  </g>
  <g id="Layer_3" class="st3">
    <path class="st2" d="M40.66,11.97h-5"/>
    <path class="st2" d="M40.66,7.97h-5"/>
    <path class="st2" d="M44.66,16.97V4.97c0-1.1-.9-2-2-2h-13"/>
    <path class="st2" d="M33.66,20.97h12c1.1,0,2-.9,2-2v-1c0-.55-.45-1-1-1h-10c-.55,0-1,.45-1,1v1c0,1.1-.9,2-2,2s-2-.9-2-2V4.97c0-1.1-.9-2-2-2s-2,.9-2,2v2c0,.55.45,1,1,1h3"/>
  </g>
  <path class="st2" d="M14.17,10.67c.97-.69,1.65-2.05,1.65-3.34,0-2.11-1.71-3.82-3.82-3.82s-3.82,1.71-3.82,3.82c0,1.29.69,2.64,1.66,3.34"/>
</svg>
`

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
    txt.addClass("installmodal-txt");
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
  highlightEnabled: boolean;
  highlightColorLight: string;
  highlightColorDark: string;
  rulesetCompendium: string;
  rulesetReference: string[];
  reparseGamesets: boolean;
  isFirstRun: "yes" | "no" | "shown";
  sessionTitlePreference: "name" | "date";
  enableSidebarPreviews: boolean;
  templateOpenMode: "default" | "current" | "background";
  adventureSort: 'name' | 'recent' | 'refs';
  enabledAdventureCategories: string[];
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
  highlightEnabled: false,
  highlightColorLight: '#DFE7E2',
  highlightColorDark: '#1F2943',
  rulesetCompendium: "",
  rulesetReference: [],
  reparseGamesets: true,
  isFirstRun: "yes",
  sessionTitlePreference: "name",
  enableSidebarPreviews: true,
  templateOpenMode: "default",
  adventureSort: 'name',
  enabledAdventureCategories: ['npcs','factions','monsters','history','places'],
};

interface CustomPathEntry {
  vaultPath: string;
  manifestKey: string;
  doUpdate: boolean;
}

interface PendingSelection {
  text: string;
  filePath: string;
  from?: { line: number; ch: number };
  to?: { line: number; ch: number };
  preText?: string;
  preWrapped?: boolean;   // NEW: we wrapped the selection in the editor already
}

export interface ManifestFileEntry {
  path: string;
  key: string;
  customOverride?: boolean;
  displayName?: string;
  optional?: boolean;
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
    '.DS_Store',
    '.gitignore',
    '.gitattributes',
    '.github',
    'README.md',
    'Compendium',
    `${this.app.vault.configDir}/plugins/vvunderlore-toolkit-plugin/manifest.json`,
    `${this.app.vault.configDir}/plugins/vvunderlore-toolkit-plugin/main.js`,
    `${this.app.vault.configDir}/plugins/vvunderlore-toolkit-plugin/styles.css`
  ];

  private isFirstRun: boolean = false;

  public pendingRulesetKey: string = '';
  public pendingReferenceKeys: string[] = [];

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

  private buildIncomingRefCounts(): Map<string, number> {
    const incoming = new Map<string, number>();
    const resolved = this.app.metadataCache.resolvedLinks as Record<string, Record<string, number>>;

    for (const from in resolved) {
      const toMap = resolved[from];
      for (const to in toMap) {
        incoming.set(to, (incoming.get(to) || 0) + (toMap[to] || 1));
      }
    }
    return incoming;
  }

  private sortFilesByMode(files: TFile[]): void {
    const mode = this.settings.adventureSort;

    if (mode === 'name') {
      files.sort((a, b) =>
        a.basename.localeCompare(b.basename, undefined, { numeric: true, sensitivity: 'base' })
      );
      return;
    }

    if (mode === 'recent') {
      files.sort((a, b) => (b.stat.mtime || 0) - (a.stat.mtime || 0));
      return;
    }

    // mode === 'refs'
    const incoming = this.buildIncomingRefCounts();
    files.sort((a, b) => {
      const rb = incoming.get(b.path) || 0;
      const ra = incoming.get(a.path) || 0;
      if (rb !== ra) return rb - ra;
      const mt = (b.stat.mtime || 0) - (a.stat.mtime || 0);
      if (mt !== 0) return mt;
      return a.basename.localeCompare(b.basename);
    });
  }

  private pendingSelection: PendingSelection | null = null;

  public setPendingSelectionContext(ctx: PendingSelection | null) {
    this.pendingSelection = ctx;
  }
  private takePendingSelectionContext(): PendingSelection | null {
    const c = this.pendingSelection;
    this.pendingSelection = null;
    return c;
  }

  // keep your old API working, but add a preWrap flag
  public setPendingSeed(s: string | null, preWrap: boolean = false) {
    const v = this.app.workspace.getActiveViewOfType(MarkdownView);
    const ed: any = v?.editor;
    const filePath = v?.file?.path || '';
    const sel = (s ?? ed?.getSelection?.() ?? '').toString();

    if (sel && filePath) {
      const ctx: PendingSelection = {
        text: sel,
        filePath,
        from: ed?.getCursor?.('from'),
        to: ed?.getCursor?.('to'),
        preText: ed?.getValue?.(),
        preWrapped: false,
      };

      if (preWrap && ed) {
        // wrap now (preserve outer whitespace), but only if not already a wikilink
        const alreadyLinked = /^\s*\[\[[\s\S]*\]\]\s*$/.test(sel);
        if (!alreadyLinked) {
          const m = sel.match(/^(\s*)([\s\S]*?)(\s*)$/);
          const leading = m?.[1] ?? '';
          const core = (m?.[2] ?? '').trim();
          const trailing = m?.[3] ?? '';
          if (core) {
            ed.replaceSelection(`${leading}[[${core}]]${trailing}`);
            ctx.preWrapped = true;
          }
        }
      }

      this.setPendingSelectionContext(ctx);
    } else {
      this.setPendingSelectionContext(null);
    }
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
    // 0) Close any open markdown & graph panes
    this.app.workspace.getLeavesOfType('markdown').forEach(l => l.detach());
    this.app.workspace.getLeavesOfType('graph').forEach(l => l.detach());

    // 1) Show the “Installing…” spinner
    const installing = new InstallingModal(this.app);
    installing.open();

    try {
      // 2) Optional backup
      const allFiles = this.app.vault.getAllLoadedFiles()
        .filter((f): f is TFile => f instanceof TFile)
        .map(f => f.path)
        .filter(p => p !== '.vvunderlore_installed');
      if (allFiles.length && this.settings.autoBackupBeforeUpdate) {
        const folder = await this.backupManager.backupVaultMirror('pre-custom-install');
        new Notice(`Backup before custom‐install at: ${folder}`);
      }

      // 3) Loop over exactly the selected files/folders
      for (const entry of toInstall) {
        if (entry.isFolder) {
          if (!(await this.app.vault.adapter.exists(entry.path))) {
            await this.app.vault.createFolder(entry.path);
          }
        } else {
          const manifestEntry = this.manifestCache.files.find(f => f.path === entry.path);
          if (!manifestEntry) continue;
          await this.updateEntryFromManifest(manifestEntry, true);
        }
      }



      // 4) Bump version.json + settings
      await this.updateVersionFile();
      this.settings.installedVersion = this.settings.latestToolkitVersion!;
      this.settings.lastForceUpdate = new Date().toISOString();
      await this.saveSettings();

      // 5) Import selected compendium + references
      const comp = this.settings.rulesetCompendium;
      const refs = this.settings.rulesetReference ?? [];
      if (comp) {
        const jobs: Promise<unknown>[] = [
          importRulesetData({ app: this.app, editionKey: comp, targetPath: "Compendium" }),
          ...refs.map(refKey => {
            const label = getRulesetDisplayName(refKey);
            return importRulesetData({
              app: this.app,
              editionKey: refKey,
              targetPath: `Resources/Rulesets/${label}`,
            });
          })
        ];
        await Promise.all(jobs);
      }

      // 6) Marker + re‐enable highlighting + repaint UI
      const marker = '.vvunderlore_installed';
      if (!(await this.app.vault.adapter.exists(marker))) {
        await this.app.vault.create(marker, '');
      }
      this.settings.highlightEnabled = true;
      await this.saveSettings();
      this.enableHighlight();
      if (this.settingsTab) this.settingsTab.display();

      // 7) Success modal & reload vault
      installing.close();
      const success = new Modal(this.app);
      success.onOpen = () => {
        success.contentEl.empty();
        success.titleEl.setText('✅ Custom Install Complete');
        success.contentEl.createEl('div', {
          text: 'Reloading vault in 3 seconds…',
          cls: 'installsuccess'
        });
      };
      success.open();
      setTimeout(() => {
        success.close();
        location.reload();
      }, 3000);

    } catch (err) {
      console.error('❌ performCustomInstall failed:', err);
      installing.close();
      new Notice('❌ Custom install failed; check console for details.');
    }
  }


  // ─── HIGHLIGHTING (Light + Dark Mode) ──────────────────────────────

  private get highlightCSS(): string {
    const light = this.settings.highlightColorLight.trim() || 'rgba(107,146,120,1)';
    const dark = this.settings.highlightColorDark.trim() || 'rgba( 50, 70, 50,1)';

    const fileSelectors = this.manifestCache.files.map((f) => {
      const escaped = f.path.replace(/"/g, '\\"');
      return `.nav-file-title[data-path="${escaped}"]`;
    });

    // const folderSelectors = this.manifestCache.folders.map((f) => {
    //   const escaped = f.path.replace(/"/g, '\\"');
    //   return `.nav-folder-title[data-path="${escaped}"]`;
    // });

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

    // if (folderSelectors.length) {
    //   lines.push(`${folderSelectors.join(', ')} {`);
    //   lines.push(`  background-color: var(--vvunderlore-toolkit-highlight);`);
    //   lines.push(`  border-radius: 3px;`);
    //   lines.push(`}`);
    //   lines.push(``);
    // }

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

  }

  private sanitizeTitle(s: string): string {
    return (s ?? '').replace(/[\/:*?"<>|]/g, '').trim().slice(0, 100) || 'Untitled';
  }

  private async replaceSelectionWithLink(view: MarkdownView, original: string, createdTitle: string) {
    const ed = view.editor;
    const current = ed.getValue();
    const link = `[[${createdTitle}]]`;

    if (original && current.includes(original)) {
      const updated = current.replace(original, link);
      await this.app.vault.modify(view.file!, updated);
    } else {
      ed.replaceSelection(link);
    }
  }

  private async runVvTemplateCommand(templatePath: string) {
    await this.runSBTemplate(templatePath);
  }




  // ─── MARKER FILE CHECKS (first‐run detection) ───────────────────────

  private async checkMarkerFile() {
    const markerPath = '.vvunderlore_installed';
    const markerExists = await this.app.vault.adapter.exists(markerPath);
    this.isFirstRun = !markerExists;
    delete (this.settings as any).needsInstall;
    await this.saveSettings();
    this.settingsTab.display();
  }


  // ─── MANIFEST SYNC ────────────────────────────────────────────────────

  async syncManifest(): Promise<void> {
    try {
      const res = await requestUrl({
        url: 'https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/manifest.json'
      });

      const manifest = res.json;
      this.settings.latestDefaults = manifest.defaultPaths || {};
      this.manifestCache = manifest;

      const manifestContent = JSON.stringify(manifest, null, 2);
      await this.app.vault.adapter.write('manifest.json', manifestContent);
      await this.saveSettings();

    } catch (error) {
      console.error('Error syncing manifest:', error);
      new Notice('Failed to sync manifest.');
    }
  }

  // ─── PLUGIN LIFECYCLE ─────────────────────────────────────────────────

  async onload() {
    await this.loadSettings();

if (!Array.isArray(this.settings.enabledAdventureCategories)) {
  this.settings.enabledAdventureCategories = ['npcs','factions','monsters','history','places'];
  await this.saveSettings();
}


    addIcon('mapmaking', mapmaking_icon)
    addIcon('gameplay', gameplay_icon)
    // ─── CORE MANAGERS ───────────────────────────────────────────────────
    this.backupManager = new BackupManager(this.app);
    this.fileCacheManager = new ToolkitFileCacheManager(
      this.app.vault,
      this.settings.fileCache ?? {},
      async () => await this.saveSettings()
    );

    // ─── SETTINGS UI ────────────────────────────────────────────────────
    this.settingsTab = new ToolkitSettingsTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    // sidebars
    this.registerView(SIDEBAR_VIEW_TYPE, (leaf) => new SidebarTemplatesView(leaf));
    this.registerView(GAMEPLAY_VIEW_TYPE, (leaf) => new GameplaySidebarView(leaf));

    // ******++++++ SUPER COOL HOTKEY COMMANDS SECTION--------------------------------

    this.addCommand({
      id: "open-worldbuilding-sidebar",
      name: "Open VVorldbuilding pane",
      icon: "mapmaking",
      callback: async () => {
        let leaf: WorkspaceLeaf | undefined | null =
          this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)[0];
        if (!leaf) {
          leaf =
            this.app.workspace.getRightLeaf(false) ??
            this.app.workspace.getRightLeaf(true);
        }
        if (!leaf) {
          new Notice("❌ Could not open Templates sidebar");
          return;
        }
        await leaf.setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
        this.app.workspace.revealLeaf(leaf);
      },
    });

    this.addCommand({
      id: "open-gameplay-sidebar",
      name: "Open Gameplay pane",
      icon: "gameplay",
      callback: async () => {
        let leaf: WorkspaceLeaf | undefined | null =
          this.app.workspace.getLeavesOfType(GAMEPLAY_VIEW_TYPE)[0];
        if (!leaf) {
          leaf =
            this.app.workspace.getRightLeaf(false) ??
            this.app.workspace.getRightLeaf(true);
        }
        if (!leaf) {
          new Notice("❌ Could not open Gameplay sidebar");
          return;
        }
        await leaf.setViewState({ type: GAMEPLAY_VIEW_TYPE, active: true });
        this.app.workspace.revealLeaf(leaf);
      },
    });

    this.addCommand({
      id: 'vv-new-pc',
      name: 'VVunderlore: New Player Character',
      callback: async () => {
        await this.runSBTemplate('Extras/Templates/playercharacter_template.md');
      },
    });
    this.addCommand({
      id: 'vv-new-npc',
      name: 'VVunderlore: New NPC',
      callback: async () => {
        await this.runSBTemplate('Extras/Templates/npc_template.md');
      },
    });
    this.addCommand({
      id: 'vv-new-item',
      name: 'VVunderlore: New Item',
      callback: async () => {
        await this.runSBTemplate('Extras/Templates/newitem_template.md');
      },
    });
    this.addCommand({
      id: 'vv-new-creature',
      name: 'VVunderlore: New Creature',
      callback: async () => {
        await this.runSBTemplate('Extras/Templates/newcreature_template.md');
      },
    });
    this.addCommand({
      id: 'vv-new-place',
      name: 'VVunderlore: New Place',
      callback: async () => {
        await this.runSBTemplate('Extras/Templates/newplace_template.md');
      },
    });


    this.addCommand({
      id: 'vv-check-updates',
      name: 'VVunderlore: Run — Check for Toolkit Updates',
      callback: async () => { await this.checkForUpdates(); },
    });

    this.addCommand({
      id: 'vv-force-update',
      name: 'VVunderlore: Run — Force Update',
      callback: async () => { await this.forceUpdatePreviewAndConfirm(); },
    });

    // this.addCommand({
    //   id: 'vv-migrate-scan',
    //   name: 'VVunderlore: Run — Migration Auditor (Scan)',
    //   callback: async () => { await this.openMigrationAuditorScan(); },
    // });


    // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    this.addRibbonIcon('scroll-text', 'VVunderlore Sidebars', async () => {
      await this.openSidebar(SIDEBAR_VIEW_TYPE, 'right');
      await this.openSidebar(GAMEPLAY_VIEW_TYPE, 'right');
    });


    // ─── RESTORE STATE ──────────────────────────────────────────────────
    if (this.settings.isFirstRun !== 'yes') {
      try {
        const content = await this.app.vault.adapter.read('manifest.json');
        this.manifestCache = JSON.parse(content);
      } catch { }
    }
    //  • Highlight nav items if enabled
    if (this.settings.highlightEnabled) this.enableHighlight();

    // ─── DEFER HEAVY TASKS ───────────────────────────────────────────────
    setTimeout(async () => {
      await this.syncManifest();
      await this.showIndexingModal();
      await this.checkForUpdates();

      // build your requiresGraph from manifest.json
      try {
        const raw = await this.app.vault.adapter.read('manifest.json');
        const manifest = JSON.parse(raw);
        const entries = [...(manifest.folders || []), ...(manifest.files || [])];
        this.requiresGraph = new Map(entries.map(e => [e.key, e.requires || []]));
      } catch {
        this.requiresGraph = new Map();
      }
    }, 250);

    this.scheduleAutoUpdateCheck();
    this.registerEvent(
      this.app.vault.on('delete', () =>
        this.registerEvent(
          this.app.vault.on('delete', () =>
            (this.app as any).commands.executeCommandById('dataview:clear-cache')
          )
        )));
    this.registerEvent(
      this.app.vault.on('rename', () =>
        (this.app as any).commands.executeCommandById('dataview:clear-cache')
      )
    );
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, view) => {
        const sel = editor.getSelection().trim();
        if (!sel.length) return;

        menu.addItem(i => i
          .setTitle('VVunderlore: New NPC from selection')
          .setIcon('user-plus')
          .onClick(async () => {
            this.setPendingSeed(sel);
            await this.runSBTemplate('Extras/Templates/npc_template.md');
          }));

        menu.addItem(i => i
          .setTitle('VVunderlore: New Item from selection')
          .setIcon('plus-circle')
          .onClick(async () => {
            this.setPendingSeed(sel);
            await this.runSBTemplate('Extras/Templates/item_template.md');
          }));

        menu.addItem(i => i
          .setTitle('VVunderlore: New Place from selection')
          .setIcon('plus-circle')
          .onClick(async () => {
            this.setPendingSeed(sel);
            await this.runSBTemplate('Extras/Templates/place_template.md');
          }));
      })
    );


    // ─── FIRST-RUN “Welcome.md” ─────────────────────────────────────────
    if (this.settings.isFirstRun === 'no') {
      this.app.workspace.onLayoutReady(() => {
        const welcome = this.app.vault.getAbstractFileByPath('Welcome.md');
        if (welcome instanceof TFile) {
          this.app.workspace.detachLeavesOfType('settings');
          this.app.workspace.getLeaf(true).openFile(welcome);
        }
        // mark shown
        this.settings.isFirstRun = 'shown';
        this.saveSettings();
      });
    }
  }


  onunload() {
    this.disableHighlight();
    this.app.workspace.detachLeavesOfType(SIDEBAR_VIEW_TYPE);
    if (this.autoCheckInterval) clearInterval(this.autoCheckInterval);
  }

  scheduleAutoUpdateCheck() {
    this.autoCheckInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, 60 * 60 * 1000);
  }

  public async activateTemplatesSidebar(): Promise<void> {
    // Close any open sidebar of our view type
    this.app.workspace.detachLeavesOfType(SIDEBAR_VIEW_TYPE);

    // Open a new one on the left
    await this.app.workspace.getLeftLeaf(false)!
      .setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
  }

  private async getUniqueNewNotePath(basePath: string): Promise<string> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(basePath))) return basePath;
    const dot = basePath.lastIndexOf('.');
    const stem = dot >= 0 ? basePath.slice(0, dot) : basePath;
    const ext = dot >= 0 ? basePath.slice(dot) : '';
    let i = 2;
    while (true) {
      const candidate = `${stem} (${i})${ext}`;
      if (!(await adapter.exists(candidate))) return candidate;
      i++;
    }
  }

  public async runSBTemplate(templatePath: string) {
    const tpl = this.app.vault.getAbstractFileByPath(templatePath);
    if (!(tpl instanceof TFile)) { new Notice(`⚠️ Template not found: ${templatePath}`); return; }

    const tpObs = (this.app as any).plugins.getPlugin('templater-obsidian') as any;
    const tpAlt = (this.app as any).plugins.getPlugin('templater') as any;
    const templater = tpObs || tpAlt;
    if (!templater) { new Notice('⚠️ Could not find Templater – is it enabled?'); return; }

    const tpObj = templater.templater?.current_functions_object;
    if (!tpObj) { new Notice('⚠️ Templater API not ready—add a startup template and restart.'); return; }

    const srcView = this.app.workspace.getActiveViewOfType(MarkdownView);
    srcView?.editor?.focus();
    const pending = this.takePendingSelectionContext?.() ?? null;
    const legacySeed = typeof (this as any).takePendingSeed === 'function'
      ? (this as any).takePendingSeed()
      : null;

    // Build a stable snapshot of the source doc and positions (survives focus loss)
    const ed: any = srcView?.editor ?? null;
    const baseText: string =
      pending?.preText ??
      (ed ? ed.getValue() : (srcView?.file ? await this.app.vault.read(srcView.file) : ''));

    const from = pending?.from ?? ed?.getCursor?.('from');
    const to = pending?.to ?? ed?.getCursor?.('to');

    function posToOffset(text: string, pos: { line: number; ch: number }) {
      let off = 0, i = 0, line = 0;
      while (line < pos.line && i < text.length) {
        const nl = text.indexOf('\n', i);
        if (nl === -1) return text.length;
        off = nl + 1; i = off; line++;
      }
      return off + pos.ch;
    }

    // Prefer exact slice by offsets; fall back to string-based sources
    let rawSel = '';
    if (baseText && from && to) {
      try {
        const startOff = posToOffset(baseText, from);
        const endOff = posToOffset(baseText, to);
        if (endOff >= startOff) rawSel = baseText.slice(startOff, endOff);
      } catch { /* ignore */ }
    }
    if (!rawSel) {
      rawSel =
        (pending?.text && pending.text.length ? pending.text : '') ||
        (legacySeed || '') ||
        (srcView?.editor?.getSelection?.() ?? '') ||
        (window.getSelection()?.toString() ?? '');
    }

    // If nothing was selected, just run the template (your existing behavior)
    if (!rawSel) {
      let wrapperFile: TFile;
      try {
        wrapperFile = await tpObj.file.create_new(tpl, undefined, false);
      } catch (e) {
        console.error('Error invoking Templater:', e);
        new Notice('❌ Failed to run template; check console.');
        return;
      }
      try { await this.app.vault.delete(wrapperFile); } catch { }
      return;
    }

    // We have a selection → run template and then replace the selection with a link
    const originView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const srcPath: string | null = pending?.filePath || originView?.file?.path || null;
    if (!srcPath) {
      // No source to modify; run and exit
      let wrapperFile: TFile | null = null;
      try {
        wrapperFile = await tpObj.file.create_new(tpl, undefined, false);
      } catch (e) {
        console.error('Templater.create_new (no srcPath) failed', e);
        new Notice('❌ Could not run template.');
      }
      // only try to delete if we actually created it
      try { if (wrapperFile) await this.app.vault.delete(wrapperFile); } catch { }
      return;
    }

    // Wait for the new note to be created
    const startMs = Date.now();
    const createdFilePromise = new Promise<TFile | null>((resolve) => {
      const ref = this.app.vault.on('create', (af) => {
        if (af instanceof TFile && af.extension === 'md' && af.stat.ctime >= startMs) {
          this.app.vault.offref(ref);
          resolve(af);
        }
      });
      setTimeout(() => { this.app.vault.offref(ref); resolve(null); }, 6000);
    });

    // --- later, after you set up createdFilePromise
    let wrapperFile: TFile | null = null;
    try {
      wrapperFile = await tpObj.file.create_new(tpl, undefined, false);
    } catch (e) {
      console.error('Templater.create_new (wrapper) failed', e);
      new Notice('❌ Could not run template.');
      return;
    }
    try { if (wrapperFile) await this.app.vault.delete(wrapperFile); } catch { }

    // ----------------- new template note behavior -----------------
    const created = await createdFilePromise;
    if (!created) return;

    const newNoteFile: TFile | null =
      (this.app.workspace.activeLeaf?.view instanceof MarkdownView)
        ? (this.app.workspace.activeLeaf.view.file as TFile)
        : created;

    const behavior = this.settings?.templateOpenMode ?? "default";

    if (behavior === "background") {

      const newLeaf = this.app.workspace.activeLeaf;

      setTimeout(() => {
        if (newLeaf?.view instanceof MarkdownView) {
          newLeaf.detach();
        }
      }, 100);
    } else if (behavior === "current") {
      const leaves = this.app.workspace.getLeavesOfType('markdown');
      const createdLeaf =
        leaves.find(l => (l.view as any)?.file === created)
        ?? leaves.find(l => (l.view as any)?.file?.path === created.path)
        ?? null;

      if (createdLeaf) {
        createdLeaf.detach();
      }

      const originLeaf =
        leaves.find(l => (l.view as any)?.file?.path === srcPath)
        ?? originView?.leaf
        ?? this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;

      if (originLeaf) {
        this.app.workspace.setActiveLeaf(originLeaf, { focus: true });
      }
    }

    await new Promise(r => setTimeout(r, 150)); // let template finish writing
    try {
      if (!newNoteFile || !(await this.app.vault.adapter.exists(newNoteFile.path))) return;
      const txt = await this.app.vault.adapter.read(newNoteFile.path);
      if (!txt || !txt.trim()) return;
    } catch { return; }

    const alreadyLinked = /^\s*\[\[[\s\S]*\]\]\s*$/.test(rawSel);
    let wrapped = rawSel;
    if (!alreadyLinked) {
      const m = rawSel.match(/^(\s*)([\s\S]*?)(\s*)$/) as RegExpMatchArray;
      const leading = m?.[1] ?? '';
      const core = (m?.[2] ?? '').trim();
      const trailing = m?.[3] ?? '';
      wrapped = core.length ? `${leading}[[${core}]]${trailing}` : rawSel;
    }

    const tf = this.app.vault.getAbstractFileByPath(srcPath) as TFile | null;
    if (!tf) return;
    const cur = await this.app.vault.read(tf);

    // Try offset-based replacement first (only if the slice still matches)
    let updated: string | null = null;
    if (baseText && from && to) {
      try {
        const startOff = posToOffset(baseText, from);
        const endOff = posToOffset(baseText, to);
        if (endOff >= startOff) {
          const slice = cur.slice(startOff, endOff);
          if (slice === rawSel) {
            updated = cur.slice(0, startOff) + wrapped + cur.slice(endOff);
          }
        }
      } catch { /* ignore */ }
    }

    // Fallback: first exact occurrence
    if (updated == null) {
      const idx = cur.indexOf(rawSel);
      if (idx >= 0) updated = cur.slice(0, idx) + wrapped + cur.slice(idx + rawSel.length);
    }

    if (updated != null && updated !== cur) {
      await this.app.vault.modify(tf, updated);
    }
  }



  private pendingSeed: string | null = null;
  private takePendingSeed(): string | null {
    const s = this.pendingSeed;
    this.pendingSeed = null;
    return s;
  }


  private async openSidebar(viewType: string, side: 'left' | 'right'): Promise<void> {
    const ws = this.app.workspace;
    const existing = ws.getLeavesOfType(viewType)[0];
    if (existing) {
      await existing.setViewState({ type: viewType, active: true });
      ws.revealLeaf(existing);
      return;
    }
    const leaf = side === 'left' ? ws.getLeftLeaf(false) ?? ws.getLeftLeaf(true)
      : ws.getRightLeaf(false) ?? ws.getRightLeaf(true);
    if (!leaf) {
      new Notice(`❌ Could not open ${viewType} sidebar`);
      return;
    }
    await leaf.setViewState({ type: viewType, active: true });
    ws.revealLeaf(leaf);
  }



  // ─── BACKUP & UNDO ────────────────────────────────────────────────────

  async backupFile(filePath: string, content: string): Promise<void> {
    this.settings.backupFiles = this.settings.backupFiles || {};
    this.settings.backupFiles[filePath] = content;
    await this.saveSettings();
  }

  async undoForceUpdate(): Promise<void> {
    if (!this.settings.backupFiles || Object.keys(this.settings.backupFiles).length === 0) {
      new Notice('No backups available to restore.');
      return;
    }
    for (const [filePath, backupContent] of Object.entries(this.settings.backupFiles)) {
      if (await this.app.vault.adapter.exists(filePath)) {
        await this.app.vault.adapter.write(filePath, backupContent);
      } else {
        await this.app.vault.create(filePath, backupContent);
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
            label.addClass("forceupdate-flexcolumn");

            const labelWrapper = label.createDiv();
            labelWrapper.textContent = item.filePath;

            const note = label.createDiv({ text: item.action });
            note.addClass("forceupdate-note");

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
            toggleIcon.toggleClass("vv-rotated", !denyDetails.open);
          };

          // Body of <details> — each deny-listed item is faint and disabled
          const denyBody = denyDetails.createDiv({ cls: 'vk-section-body' });
          denyBody.addClass("denylist");

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
            labelWrapper.addClass("forceupdate-labelwrapper");

            const note = row.createDiv({ text: item.action });
            note.addClass("forceupdate-note-b");

            // Deny-listed checkbox is disabled
            const checkbox = row.createEl('input', { type: 'checkbox' });
            checkbox.checked = item.selected;
            checkbox.disabled = true;
            checkbox.title = 'This item is deny-listed';
          });
        }

        if (this.plugin.settings.reparseGamesets) {
          this.contentEl
            .createDiv({ cls: 'mod-aux-text' })
            .setText('🔄 Refreshing Gameset Data');
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
      return;
    }

    const finalVaultPath = custom?.vaultPath ?? this.resolveVaultPath(entry.path);
    if (!force && (await this.fileCacheManager.isUpToDate(finalVaultPath))) {
      return;
    }

    const url = `https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-full/main/${entry.path}`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      await this.app.vault.adapter.write(finalVaultPath, text);
      await this.fileCacheManager.updateCache(finalVaultPath, text, entry.path);
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

      try {
        await updateModalFormsFromRepo(this.app);
      } catch (e) {
        console.warn('Modal Forms updater (force selection) failed:', e);
      }

      // 4) Bump version
      await this.updateVersionFile();
      this.settings.installedVersion = this.settings.latestToolkitVersion ?? 'unknown';
      this.settings.lastForceUpdate = new Date().toISOString();
      await this.saveSettings();

      new Notice('✅ Toolkit force‐updated with your selections.');

      if (this.settings.reparseGamesets) {
        new Notice('🔄 Refreshing Game Set Data…');
        await this.refreshGameSetData();
      }

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
            toggleIcon.toggleClass("vv-rotated", !denyDetails.open);
          };

          // Body of the details: a simple <ul> containing only deny‐listed lines
          const denyBody = denyDetails.createDiv({ cls: 'vk-section-body' });
          denyBody.addClass("denylist");
          const denyUl = denyBody.createEl('ul');
          this.denied.forEach((line) => {
            const li = denyUl.createEl('li', { text: line });
            li.addClass("forceupdate-note-c");
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
    if (this.settings.isFirstRun !== "yes") {
      try {
        const content = await this.app.vault.adapter.read(toolkitPath);
        const json = JSON.parse(content);
        localTK = json.version || localTK;
      } catch (err) {
        console.error('❌ Failed to read local toolkit version:', err);
      }
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

    if (isNewerVersion(remoteTK, localTK)) {
      new Notice(`⚠️ Toolkit update available! Latest: v${remoteTK}`);
      await this.fetchRemoteBaseline();
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
    }

    if (isNewerVersion(remotePL, localPL)) {
      new Notice(`⚙️ Plugin update available! Latest: v${remotePL}`);
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
    // 1) grab whatever’s on disk (might be null)
    const raw = (await this.loadData()) as Partial<ToolkitSettings> | null;
    const cleaned = raw ?? {};

    // 2) drop the old needsInstall flag
    if ((cleaned as any).needsInstall != null) {
      delete (cleaned as any).needsInstall;
    }

    // 3) merge defaults + cleaned data
    this.settings = Object.assign({}, DEFAULT_SETTINGS, cleaned);
    if (typeof (cleaned as any).preferNameWhenBoth === "boolean") {
      this.settings.sessionTitlePreference =
        (cleaned as any).preferNameWhenBoth ? "name" : "date";
      delete (this.settings as any).preferNameWhenBoth;
    };

    // 4) figure out whether we’re first-run
    this.isFirstRun = !(await this.app.vault.adapter.exists('.vvunderlore_installed'));

    // 5) set up cacheManager so saveSettings() can safely use .getCache()
    this.fileCacheManager = new ToolkitFileCacheManager(
      this.app.vault,
      cleaned.fileCache ?? {},
      async () => await this.saveSettings()
    );

    // 6) now persist the “cleaned” settings back to disk exactly once
    await this.saveSettings();

    // 7) back-fill any brand-new fields
    if (typeof this.settings.rulesetCompendium !== 'string') {
      this.settings.rulesetCompendium = '';
    }
    if (!Array.isArray(this.settings.rulesetReference)) {
      this.settings.rulesetReference = [];
    }
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
      this.app.vault.configDir,
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

      if (this.settings.highlightEnabled) {
        this.enableHighlight();
      }

      try {
        await updateModalFormsFromRepo(this.app);
      } catch (e) {
        console.warn('Modal Forms updater (full repo) failed:', e);
      }

      new Notice('✅ VVunderlore Toolkit successfully installed!');
    } catch (err) {
      console.error('❌ updateFullToolkitRepo() error:', err);
      new Notice('❌ Failed to update toolkit. See console for details.');
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

      try {
        await updateModalFormsFromRepo(this.app);
      } catch (e) {
        console.warn('Modal Forms updater (selected content) failed:', e);
      }

      await this.updateVersionFile();
      this.settings.installedVersion = this.settings.latestToolkitVersion!;
      await this.saveSettings();
      new Notice('✅ Toolkit content updated.');

      if (this.settingsTab) {
        await this.settingsTab.updateVersionDisplay();
      }
    } catch (err) {
      console.error('❌ CUstom update failed. Version not updated.', err);
      new Notice('❌ Update failed. See console for details.');
    }

    if (this.settings.highlightEnabled) {
      this.enableHighlight();
    }
  }

  async updateFolderFromGitHub(githubFolderPath: string, vaultFolderPath: string) {
    const excluded = [
      this.app.vault.configDir,
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
      console.error(`❌ Failed to sync folder with m-repo: ${vaultFolderPath}`, error);
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

      this.settings.rulesetCompendium = compendium;
      const pickedRefs = references.length > 0
        ? references
        : this.settings.rulesetReference;
      this.settings.rulesetReference = pickedRefs;

      await this.saveSettings();

      // now run the import jobs against the compendium + the actual refs
      const jobs = [
        importRulesetData({ app: this.app, editionKey: compendium, targetPath: "Compendium" }),
        ...pickedRefs.map(refKey => {
          const displayName = getRulesetDisplayName(refKey);
          return importRulesetData({
            app: this.app,
            editionKey: refKey,
            targetPath: `Resources/Rulesets/${displayName}`,
          })
        })
      ];
      await Promise.all(jobs);

      // 3) Kick off your JSON→MD parsers in parallel
      const parseJobs = [
        importRulesetData({
          app: this.app,
          editionKey: compendium,
          targetPath: `Compendium`,
        }),
        ...references.map(refKey => {
          const displayName = getRulesetDisplayName(refKey);
          return importRulesetData({
            app: this.app,
            editionKey: refKey,
            targetPath: `Resources/Rulesets/${displayName}`,
          })
        }),
      ];
      // this won’t resolve until _all_ parsers have finished writing their MD files
      await Promise.all(parseJobs);

      try {
        await updateModalFormsFromRepo(this.app);
      } catch (e) {
        console.warn('Modal Forms updater (first-time install) failed:', e);
      }

      // 4) Post-install housekeeping
      const marker = ".vvunderlore_installed";
      if (!(await this.app.vault.adapter.exists(marker))) {
        await this.app.vault.create(marker, "");
      }
      this.settings.highlightEnabled = true;
      await this.saveSettings();
      this.enableHighlight();

      installSucceeded = true;
    } catch (err) {
      console.error("❌ installFullToolkit()", err);
    } finally {
      // only now close the spinner & redraw the UI
      if (this.settingsTab) this.settingsTab.display();
      new Notice(
        installSucceeded
          ? "✅ VVunderlore Toolkit successfully installed!"
          : "❌ Failed to install toolkit. See console for details."
      );
    }
  }

  // * Re-parse all gameset data (ruleset compendium + reference sets)
  async refreshGameSetData(): Promise<void> {
    const { rulesetCompendium, rulesetReference } = this.settings;

    if (!rulesetCompendium && rulesetReference.length === 0) {
      new Notice("⚠️ No gameset keys set; nothing to refresh.");
      return;
    }

    const jobs: Promise<unknown>[] = [];
    if (rulesetCompendium) {
      jobs.push(importRulesetData({
        app: this.app,
        editionKey: rulesetCompendium,
        targetPath: "Compendium",
      }));
    }
    for (const ref of rulesetReference) {
      const displayName = getRulesetDisplayName(ref);
      jobs.push(importRulesetData({
        app: this.app,
        editionKey: ref,
        targetPath: `Resources/Rulesets/${displayName}`,
      }));
    }

    await Promise.all(jobs);
    new Notice("✅ Game Set Data refreshed.");
  }



}
export { InstallingModal };