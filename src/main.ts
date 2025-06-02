import { App, Plugin, Notice, Modal, Setting, TFolder, TFile, Vault } from 'obsidian';
import { ToolkitSettingsTab } from './settings';
import { ToolkitFileCacheManager } from './fileCacheManager';
import * as fs from 'fs';
import * as path from 'path';
import type { ToolkitFileCacheEntry } from './fileCacheManager';
import { BackupManager } from './backup/BackupManager';
import { dirname } from 'path';
  

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
	optional?: boolean;        // ← add this
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
	private oldPathsByGithub: Record<string,string> = {};
	
	resolveVaultPath(githubPath: string): string {
		const custom = this.settings.customPaths.find(
			c => c.manifestKey === githubPath || c.manifestKey === this.keyFor(githubPath)
		);
		return custom?.vaultPath ?? githubPath;
	}

	keyFor(path: string): string {
		return path
			.replace(/[/\\]/g, '-')
			.replace(/\.[^.]+$/, '')
			.toLowerCase();
	}
	
	private async ensureFolderExists(folder: string) {
		if (!folder || await this.app.vault.adapter.exists(folder)) {
		  return;
		}
		const parent = dirname(folder);
		await this.ensureFolderExists(parent);
		await this.app.vault.createFolder(folder);
	  }

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
 
	isExcluded(path: string): boolean {
		return this.excludedPaths.some(ex =>
			path === ex ||
			path.startsWith(`${ex}/`) ||
			path.includes(`/${ex}/`) ||
			path.endsWith(`/${ex}`) ||
			path.includes(`/${ex}`)
		);
	}

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
		  
			  // 🔥 Clean old cache entry if this is a remap
			  if (resolved !== entry.path) {
				await this.fileCacheManager.removeFromCache(entry.path);
			  }
		  
			  await this.fileCacheManager.updateCache(resolved, remoteText, entry.path, false);
		  
			} catch (e) {
			  console.error(`Failed to fetch raw baseline for ${entry.path}`, e);
			}
		  }
		  
	
		console.log('📦 Final cache:', this.fileCacheManager.getCache());
	}
	
	/**
	 * checkMarkerFile():
	 *   On plugin load, decide whether “first‐run” card still shows.
	 *   If .vvunderlore_installed exists, needsInstall=false; otherwise true.
	 */
	private async checkMarkerFile() {
		const devForce = (window as any).forceNeedsInstall;
		if (devForce) {
			this.settings.needsInstall = true;
			console.log("🧪 DEV MODE: Forcing needsInstall = true");
			await this.saveSettings();
			if (this.settingsTab) this.settingsTab.display();
			return;
		}

		const markerPath = ".vvunderlore_installed";
		const markerExists = await this.app.vault.adapter.exists(markerPath);
		this.settings.needsInstall = !markerExists;

		console.log(
			markerExists
				? "✅ Marker file found → needsInstall = false"
				: "🟡 Marker file NOT found → needsInstall = true"
		);

		await this.saveSettings();
		if (this.settingsTab) {
			this.settingsTab.display();
		}
	}

	// ─── Manifest Sync ─────────────────────────────────────────────
	async syncManifest(): Promise<void> {
		try {
			const res = await fetch('https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/manifest.json');
			if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.statusText}`);
			const manifest = await res.json();
			// Assume manifest contains a "defaultPaths" property.
			this.settings.latestDefaults = manifest.defaultPaths || {};
			this.manifestCache = manifest;
			// Write the updated manifest to the vault.
			const manifestContent = JSON.stringify(manifest, null, 2);
			await this.app.vault.adapter.write('manifest.json', manifestContent);
			await this.saveSettings();
			console.log('Manifest synced and local manifest updated.');
		} catch (error) {
			console.error('Error syncing manifest:', error);
			new Notice('Failed to sync manifest.');
		}
	}  
 
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
		setTimeout(() => this.fetchRemoteBaseline(), 0);
		// Register commands immediately
		this.addCommand({
			id: 'backup-vault',
			name: 'Backup Vault Now',
			callback: async () => {
				const folder = await this.backupManager.backupVaultMirror('manual');
				new Notice(`Vault mirror backup created at: ${folder}`);
			}
		});
		this.addCommand({
			id: 'check-for-toolkit-update',
			name: 'Check for Toolkit Update',
			callback: () => this.checkForUpdates()
		});
		this.addCommand({
			id: 'force-update-toolkit-content',
			name: 'Force Update Toolkit (No Version Check)',
			callback: async () => {
				await this.syncManifest();
				await this.forceUpdatePreviewAndConfirm();
			}
		});
		this.addCommand({
			id: 'undo-force-update',
			name: 'Undo Force Update',
			callback: async () => {
				await this.undoForceUpdate();
			}
		});
	
		// Try loading cached manifest immediately (non-blocking)
		try {
			const content = await this.app.vault.adapter.read('manifest.json');
			this.manifestCache = JSON.parse(content);
			console.log('✅ Loaded manifest from vault:', this.manifestCache);
		} catch (err) {
			console.warn('Manifest not found in vault; will fetch from GitHub shortly.');
		}
	
		// Defer heavy tasks to avoid UI blocking
		setTimeout(async () => {
			await this.syncManifest();
			await this.showIndexingModal();
			await this.checkForUpdates();
	
			// Build reverse lookup from fresh cache
			this.oldPathsByGithub = Object.entries(this.fileCacheManager.getCache() as Record<string, ToolkitFileCacheEntry>)
				.reduce((map, [vaultPath, entry]) => {
					map[entry.githubPath] = vaultPath;
					return map;
				}, {} as Record<string, string>);
			console.log('📦 Cached Files:', this.fileCacheManager.getCache());
		}, 250);
	
		this.scheduleAutoUpdateCheck();
	
		// Defensive check to ensure customPaths is always defined
		if (!this.settings.customPaths) {
			this.settings.customPaths = [];
		}

		// 1) Read the manifest.json you just validated
		const raw = await this.app.vault.adapter.read('manifest.json');
		const manifest = JSON.parse(raw) as {
		  files: Array<{ key: string; requires?: string[] }>;
		  folders: Array<{ key: string; requires?: string[] }>;
		};
	
		// 2) Combine folders + files into one array
		const entries = [
		  ...(manifest.folders || []),
		  ...(manifest.files   || [])
		];
	
		// 3) Build the key → requires map
		this.requiresGraph = new Map<string, string[]>();
		for (const e of entries) {
		  this.requiresGraph.set(e.key, e.requires ?? []);
		}
	}
	

	

	// ─── Backup/Undo Functions ─────────────────────────────────────────
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

	// ─── Folder Sync ─────────────────────────────────────────────────────
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

	async buildForceUpdatePreview(): Promise<PreviewItem[]> {
		const previewList: PreviewItem[] = [];
	  
		// ── 1) List deny-listed files first ──────────────────────────────
		for (const entry of this.manifestCache.files) {
			const custom = this.settings.customPaths.find(c => c.manifestKey === entry.key);
			if (custom?.doUpdate === false) {
			  previewList.push({
				filePath: custom.vaultPath ?? entry.path,
				action: 'deny-listed – will not update',
				selected: false,
			  });
			}
		  }
		  
	  
		// ── 2) FULL-SYNC MODE ─────────────────────────────────────────────
		if (!this.settings.customizeUpdates) {
			// (a) new or overwritten files
			for (const f of this.manifestCache.files) {
			  const vp = this.resolveVaultPath(f.path);
			  // skip any that were deny-listed
			  if (this.settings.customPaths.some(c => c.vaultPath === vp && c.doUpdate === false)) {
				continue;
			  }
			  // THIS IS THE KEY LINE:
			  let tag = '';
			  if (vp !== f.path) tag = ' (remapped)';
		  
			  if (!await this.app.vault.adapter.exists(vp)) {
				previewList.push({ filePath: vp, action: `new file${tag}`, selected: true });
			  } else if (!await this.fileCacheManager.isUpToDate(vp)) {
				previewList.push({ filePath: vp, action: `will be overwritten${tag}`, selected: true });
			  }
			}
			// (b) missing folders
			for (const fld of this.manifestCache.folders) {
			  if (!await this.app.vault.adapter.exists(fld.path)) {
				previewList.push({
				  filePath: fld.path,
				  action: 'missing folder (will be created)',
				  selected: true,
				  isFolder: true
				});
			  }
			}
			return previewList;
		  }
		  
	  
		// ── 3) CUSTOM-SYNC MODE ────────────────────────────────────────────
		// (a) new or overwritten, skipping deny-listed
		for (const entry of this.manifestCache.files) {
			const custom = this.settings.customPaths.find(c => c.manifestKey === entry.key);
			if (custom?.doUpdate === false) continue;
		  
			const vaultPath = custom?.vaultPath ?? this.resolveVaultPath(entry.path);
			const exists = await this.app.vault.adapter.exists(vaultPath);
			const upToDate = exists && await this.fileCacheManager.isUpToDate(vaultPath);
		  
			let tag = '';
			if (vaultPath !== entry.path) tag = ' (remapped)';
			
			if (!exists) {
			  previewList.push({ 
				filePath: vaultPath, 
				action: `new file${tag}`,
				selected: true 
			  });
			} else if (!upToDate) {
			  previewList.push({ 
				filePath: vaultPath, 
				action: `will be overwritten${tag}`,
				selected: true 
			  });
			}
			
		  }
		  
		// (b) missing folders
		for (const entry of this.manifestCache.folders) {
			if (!await this.app.vault.adapter.exists(entry.path)) {
			  previewList.push({
				filePath: entry.path,
				action: 'missing folder (will be created)',
				selected: true,
				isFolder: true
			  });
			}
		  }
		  
		// (c) ONLY show 'moved' for unexpected stray files (not remapped)
		for (const f of this.manifestCache.files) {
			const manifestKey = f.key;
			const manifestPath = f.path;
			const custom = this.settings.customPaths.find(c => c.manifestKey === manifestKey);
			const remappedPath = custom?.vaultPath ?? manifestPath;
			const prevPath = this.oldPathsByGithub[manifestPath];

			// Ignore if deny-listed
			if (custom?.doUpdate === false) continue;

			// 1. If it's intentionally remapped, DO NOT show as moved
			if (custom && custom.vaultPath && custom.vaultPath !== manifestPath) {
				// skip: it's an intentional override
				continue;
			}

			// 2. If old path exists and is NOT the manifest path,
			//     and there is NOT a remap for this file, then warn about moved
			if (prevPath && prevPath !== manifestPath && (!custom || custom.vaultPath === manifestPath)) {
				previewList.push({
					filePath: prevPath,
					action: `moved → ${manifestPath}`,
					selected: true
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
				previewList.push(...await this.buildForceUpdatePreviewRecursive(item.path));
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
		const modal = new class extends Modal {
			plugin: VVunderloreToolkitPlugin;
			constructor(app: App) { super(app); }
			onOpen() {
				// Prevent clicks from propagating beyond the modal
				this.contentEl.addEventListener('click', (e) => e.stopPropagation());
				this.contentEl.empty();
				this.titleEl.setText('Force Update Preview');
			
				this.contentEl.createEl('p', {
					text: 'The following items will be updated. Uncheck any items you do NOT want to change, then click "Confirm and Update".'
				});
			
				const listContainer = this.contentEl.createEl('div');
				listContainer.style.maxHeight = '400px';
				listContainer.style.overflowY = 'auto';
				listContainer.style.marginTop = '1em';
			
				previewList.forEach((item, index) => {
					const row = listContainer.createDiv();
					row.style.display = 'flex';
					row.style.alignItems = 'flex-start'; // fix alignment
					row.style.justifyContent = 'space-between';
					row.style.padding = '6px 0';
					row.style.fontFamily = 'monospace';
			
					// Left: Label and action note
					const label = row.createDiv();
					label.style.flexGrow = '1';
					label.style.display = 'flex';
					label.style.flexDirection = 'column';
			
					const labelWrapper = label.createDiv();
					labelWrapper.textContent = item.filePath;
			
					const note = label.createDiv({
						text: item.action,
					});
					note.style.fontSize = '13px';
					note.style.color = 'var(--text-muted)';
					note.style.fontStyle = 'italic';
					
					if (item.action.startsWith('deny-listed')) {
						// Fade & strike only the file path:
						labelWrapper.style.color = 'var(--text-faint)';
						labelWrapper.style.textDecoration = 'line-through';
					  
						// Fade the note, but keep it italic without strikethrough:
						note.style.color = 'var(--text-faint)';
						note.style.fontStyle = 'italic';
						note.style.textDecoration = '';   // ← clear any strike
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
			
				// Buttons
				const buttonRow = this.contentEl.createEl('div');
				buttonRow.style.display = 'flex';
				buttonRow.style.justifyContent = 'flex-end';
				buttonRow.style.gap = '0.5em';
				buttonRow.style.marginTop = '1.5em';
			
				const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
				cancelBtn.onclick = () => this.close();
			
				const confirmBtn = buttonRow.createEl('button', { text: 'Confirm and Update', cls: 'mod-cta' });
				confirmBtn.onclick = async () => {
					this.close();
					await this.plugin.performForceUpdateWithSelection(previewList);
				};
			}
			
			onClose() { this.contentEl.empty(); }
		}(this.app);
		(modal as any).plugin = this;
		modal.open();
	}

	async updateEntryFromManifest(entry: ManifestFileEntry, force: boolean = false) {
		const custom = this.settings.customPaths.find(c => c.manifestKey === entry.key);
		if (custom?.doUpdate === false) {
			console.log(`⏭️ Skipping ${entry.key} (${entry.displayName}) — blacklisted`);
			return;
		}
	
		const finalVaultPath = custom?.vaultPath ?? this.resolveVaultPath(entry.path);
	
		if (!force && await this.fileCacheManager.isUpToDate(finalVaultPath)) {
			console.log(`✔️ Already up to date: ${entry.displayName}`);
			return;
		}
	
		const url = `https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-full/main/${entry.path}`;
		const res = await fetch(url);
		const text = await res.text();
	
		await this.app.vault.adapter.write(finalVaultPath, text);
		await this.fileCacheManager.updateCache(finalVaultPath, text, entry.path); // ← Fix is here
	
		console.log(`✅ Updated ${entry.displayName} → ${finalVaultPath}`);
	}
	

	async performForceUpdateWithSelection(previewList: PreviewItem[]) {
		// 1) Partial backup (unchanged)
		if (this.settings.autoBackupBeforeUpdate) {
		  // … your existing backup code …
		}
	  
		this.settings.backupFiles = {};
		await this.saveSettings();
	  
		try {
		  // ① Filter out folders, unchecked and deny‐listed:
		const toUpdate = previewList.filter(item =>
			item.selected &&
			!item.isFolder &&
			!this.settings.customPaths.some(c =>
			c.vaultPath === item.filePath && c.doUpdate === false
			)
		);
		
		// ② Run through the pruned list
		for (const item of toUpdate) {
			// Find the matching manifest entry based on file path
			const entry = this.manifestCache.files.find(f => this.resolveVaultPath(f.path) === item.filePath);
			if (!entry) {
				console.warn(`⚠️ Could not match preview item to manifest: ${item.filePath}`);
				continue;
			}
			await this.updateEntryFromManifest(entry, true);
		}

		for (const entry of this.manifestCache.folders) {
			if (!await this.app.vault.adapter.exists(entry.path)) {
				await this.app.vault.createFolder(entry.path);
			}
		}
		
	  
		  // ── Only if all of the above succeeded do we bump the version ──
		  await this.updateVersionFile();
		  this.settings.installedVersion   = this.settings.latestToolkitVersion ?? 'unknown';
		  this.settings.lastForceUpdate    = new Date().toISOString();
		  await this.saveSettings();
		  new Notice('✅ Toolkit force‐updated with your selections.');
	  
		  // ── Live‐update the settings UI ───────────────────────────────
		  if (this.settingsTab) {
			await this.settingsTab.updateVersionDisplay();
		  }
	  
		} catch (err) {
		  console.error('❌ Force update failed. Version not changed.', err);
		  new Notice('❌ One or more files failed. Version NOT updated.');
		}
	  }
	  
	

	async updateSingleFileFromGitHub(
		
		{ githubPath, vaultPath }: { githubPath: string; vaultPath: string },
		force: boolean = false
	) {
		//console.log(`🛠️ updateSingleFileFromGitHub called with`, { githubPath, vaultPath, force });
		
		// ─── Decide canonical vs. custom mode ─────────────────────────
		if (this.settings.customizeUpdates) {
			// In custom-mode: remap & skip blacklisted
			vaultPath = this.resolveVaultPath(githubPath);
			const custom = this.settings.customPaths.find(c => c.manifestKey === githubPath);
			if (custom?.doUpdate === false) {
				//(`⏭️ Skipping ${githubPath} because customPaths.doUpdate=false`);
				return;
			}
		} else {
			// In full-sync mode: always use the manifest’s path
			vaultPath = githubPath;
		}
	
		if (!vaultPath) {
			console.error(`❌ No valid vault path resolved for ${githubPath}`);
			return;
		}
	
		// ─── 1) Handle local renames first ─────────────────────────────
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
				//console.log(`🔀 Renamed ${oldVault} → ${vaultPath}`);
				return;
			}
		}
	
		// ─── 2) Existence, backup & skip logic ─────────────────────────
		const fileExists = await this.app.vault.adapter.exists(vaultPath);
	
		// Backup only on force-update
		if (force && fileExists) {
			const current = await this.app.vault.adapter.read(vaultPath);
			await this.backupFile(vaultPath, current);
		}
	
		// If not a force-update and already up to date, skip entirely
		if (!force && fileExists && await this.fileCacheManager.isUpToDate(vaultPath)) {
			//console.log(`✅ Skipped (cached): ${vaultPath}`);
			return;
		}
	
		// ─── 3) Fetch from GitHub contents API (with raw fallback) ─────
		const apiUrl = encodeURI(
			`https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/contents/${githubPath}?ref=main`
		);
		//console.log(`🌐 Fetching metadata for ${githubPath} via`, apiUrl);
		try {
			let res = await fetch(apiUrl);
			if (res.status === 404) {
				//console.warn(`⚠️ 404 metadata for ${githubPath}, falling back to raw URL`);
				const rawUrl = encodeURI(
					`https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/${githubPath}`
				);
				//console.log(`➡️ Fetching raw content from`, rawUrl);
				res = await fetch(rawUrl);
				if (!res.ok) throw new Error(`Raw fetch failed: ${res.statusText}`);
				const content = await res.text();
	
				if (fileExists) {
					await this.app.vault.adapter.write(vaultPath, content);
					//console.log(`🔁 Overwritten via raw fallback: ${vaultPath}`);
				} else {
					await this.app.vault.create(vaultPath, content);
					//console.log(`✅ Created via raw fallback: ${vaultPath}`);
				}
				await this.fileCacheManager.updateCache(vaultPath, content, githubPath);
				return;
			}
	
			if (!res.ok) throw new Error(`GitHub API error: ${res.statusText}`);
			const { download_url } = (await res.json()) as { download_url: string };
			const content = await (await fetch(download_url)).text();
	
			if (fileExists) {
				await this.app.vault.adapter.write(vaultPath, content);
				//console.log(`🔁 Overwritten: ${vaultPath}`);
			} else {
				await this.app.vault.create(vaultPath, content);
				//console.log(`✅ Created: ${vaultPath}`);
			}
			await this.fileCacheManager.updateCache(vaultPath, content, githubPath);
		} catch (e) {
			console.error(`❌ Failed to update ${vaultPath}`, e);
		}
	}
	

	// ─── Preview + Remote-baseline + Diff ────────────────────────────────
	async previewUpdatesModal() {
		// 1) Quick “loading” modal
		const loading = new class extends Modal {
		constructor(app: App) { super(app); }
		onOpen() {
			this.contentEl.empty();
			this.contentEl.createDiv({
			text: "🔄 Checking for updates…",
			cls: "mod-warning"
			}).addEventListener("click", e => e.stopPropagation());
		}
		}(this.app);
		loading.open();
	
		// 2) Refresh manifest
		await this.syncManifest();
	
		// 3) Fetch and cache every remote file’s raw contents
		await this.fetchRemoteBaseline();
	
		// 4) Compute diffs
		const diffs = await this.buildUpdatePreview();
	
		loading.close();
	
		// 5) Render preview modal
		const modal = new class extends Modal {
		constructor(app: App, private diffs: string[]) { super(app); }
		onOpen() {
			this.contentEl.empty();
			this.contentEl.createEl("h2", { text: "Update Preview" });
			this.contentEl.createEl("p", {
			text: "Only files whose contents differ from GitHub will be updated:"
			});
			const ul = this.contentEl.createEl("ul");
			this.diffs.forEach(d => {
				const li = ul.createEl("li", { text: d });
				if (d.startsWith("❌ deny-listed")) {
				  // grey + italic, but no strikethrough on the note
				  li.style.color     = "var(--text-faint)";
				  li.style.fontStyle = "italic";
				}
			  });
			new Setting(this.contentEl)
			.addButton(b =>
				b.setButtonText("Confirm & Update")
				.setCta()
				.onClick(async () => {
					await (this as any).plugin.updateSelectedToolkitContent();
					this.close();
				})
			)
			.addButton(b =>
				b.setButtonText("Cancel")
				.onClick(() => this.close())
			);
		}
		onClose() { this.contentEl.empty(); }
		}(this.app, diffs);
	
		// Wire up plugin reference
		(modal as any).plugin = this;
		modal.open();
	}
		
	
	async buildUpdatePreview(): Promise<string[]> {
		const changes: string[] = [];
	  
		// ── 1) Deny‐listed entries ────────────────────────────────────────
		for (const f of this.manifestCache.files) {
		  const custom = this.settings.customPaths.find(c => c.manifestKey === f.path);
		  if (custom?.doUpdate === false) {
			const vp = this.resolveVaultPath(f.path);
			changes.push(`❌ deny-listed – will not update: ${vp}`);
		  }
		}
	  
		// ── 2) FULL‐SYNC MODE (skip deny‐listed) ──────────────────────────
		if (!this.settings.customizeUpdates) {
			// files
			for (const f of this.manifestCache.files) {
			  const custom = this.settings.customPaths.find(c => c.manifestKey === f.path);
			  if (custom?.doUpdate === false) continue;      // ← skip deny
			  const vp = this.resolveVaultPath(f.path);
		  
			  // ── INSERT THESE TWO LINES ─────────────────────
			  let tag = '';
			  if (vp !== f.path) tag = ' (remapped)';
			  // ────────────────────────────────────────────────
		  
			  if (!await this.app.vault.adapter.exists(vp)) {
				// ← append ${tag} here
				changes.push(`📄 New file: ${vp}${tag}`);
			  } else if (!(await this.fileCacheManager.isUpToDate(vp))) {
				// ← and here
				changes.push(`🔁 Will update: ${vp}${tag}`);
			  }
			}
		  // folders
		  for (const fld of this.manifestCache.folders) {
			if (!await this.app.vault.adapter.exists(fld.path)) {
			  changes.push(`📁 New folder: ${fld.path}`);
			}
		  }
		  
		  return changes.length
			? changes
			: ["✅ Everything is already up to date!"];
		}
	  
		// ── 3) CUSTOM MODE (also skip deny) ───────────────────────────────
		// files
		for (const f of this.manifestCache.files) {
			const custom = this.settings.customPaths.find(c => c.manifestKey === f.path);
			if (custom?.doUpdate === false) continue; // skip deny
			const vp = this.resolveVaultPath(f.path);
			let tag = '';
			if (vp !== f.path) tag = ' (remapped)';
			if (!await this.app.vault.adapter.exists(vp)) {
			  changes.push(`📄 New file: ${vp}${tag}`);
			} else if (!(await this.fileCacheManager.isUpToDate(vp))) {
			  changes.push(`🔁 Will update: ${vp}${tag}`);
			}
		  }
		  
		// folders
		for (const fld of this.manifestCache.folders) {
		  if (!await this.app.vault.adapter.exists(fld.path)) {
			changes.push(`📁 New folder: ${fld.path}`);
		  }
		}

		return changes.length
		  ? changes
		  : ["✅ Everything is already up to date!"];
	  }
	  

	  async checkForUpdates(): Promise<void> {
		// helper to compare versions numerically
		const isNewerVersion = (remote: string, local: string): boolean => {
		  const pa = remote.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
		  const pb = local .replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
		  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
			if ((pa[i] || 0) > (pb[i] || 0)) return true;
			if ((pa[i] || 0) < (pb[i] || 0)) return false;
		  }
		  return false;
		};
	  
		const toolkitPath   = '.version.json';
		const toolkitUrl    = 'https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-full/main/.version.json';
		const pluginUrl     = 'https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-plugin/main/version.json';
		const changelogUrl  = 'https://raw.githubusercontent.com/slamwise0001/VVunderlore-Toolkit-Full/main/README.md';
	  
		// ─── 1) Read local toolkit version ───────────────────────────────────
		let localTK = '0.0.0';
		try {
		  const content = await this.app.vault.adapter.read(toolkitPath);
		  const json    = JSON.parse(content);
		  localTK       = json.version || localTK;
		} catch (err) {
		  console.error('❌ Failed to read local toolkit version:', err);
		}
	  
		// ─── 2) Fetch remote toolkit version & defaults ──────────────────────
		let remoteTK = '0.0.0';
		try {
		  const res  = await fetch(toolkitUrl);
		  const data = await res.json();
		  remoteTK   = data.version || remoteTK;
	  
		  // persist in settings
		  this.settings.latestToolkitVersion = remoteTK;
		  if (data.defaultPaths) {
			this.settings.latestDefaults = data.defaultPaths;
		  }
		  this.settings.lastChecked = new Date().toISOString();
		  await this.saveSettings();
		} catch (err) {
		  console.error('❌ Failed to fetch remote toolkit version:', err);
		}
	  
		// ─── 3) Compare toolkit versions ─────────────────────────────────────
		console.log({ localTK, remoteTK });
		if (isNewerVersion(remoteTK, localTK)) {
		  new Notice(`⚠️ Toolkit update available! Installed: v${localTK}, Latest: v${remoteTK}`);
		  await this.fetchRemoteBaseline();  // refresh your baseline now that you know there's an update
		} else {
		  new Notice(`✅ Toolkit is up to date (v${localTK})`);
		}
	  
		// ─── 4) Read local plugin version ────────────────────────────────────
		const localPL = this.manifest.version;
	  
		// ─── 5) Fetch remote plugin version & compare ───────────────────────
		let remotePL = localPL;
		try {
		  const res  = await fetch(pluginUrl);
		  const data = await res.json();
		  remotePL   = data.version || remotePL;
		} catch (err) {
		  console.error('❌ Failed to fetch remote plugin version:', err);
		}
	  
		console.log({ localPL, remotePL });
		if (isNewerVersion(remotePL, localPL)) {
		  new Notice(`⚙️ Plugin update available! Installed: v${localPL}, Latest: v${remotePL}`);
		} else {
		  new Notice(`✅ Plugin is up to date (v${localPL})`);
		}
	  
		// ─── 6) Fetch changelog for UI display ───────────────────────────────
		try {
		  const changelogRes = await fetch(changelogUrl);
		  this.changelog = await changelogRes.text();
		} catch (err) {
		  console.error('❌ Failed to fetch changelog:', err);
		}
	  }
	  
	  async loadSettings() {
		const loaded = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

		this.fileCacheManager = new ToolkitFileCacheManager(
			this.app.vault,
			loaded?.fileCache ?? {},
			async () => await this.saveSettings()
		);

		// Give the vault a half‐second to finish mounting, then run checkMarkerFile()
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
		const excluded = ['.obsidian', '.gitignore', '.gitattributes', '.DS_Store', 'plugins', 'Compendium', 'README.md', '.version.json', '.github'];
		const fetchRepoRoot = async () => {
			const apiUrl = `https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/contents/`;
			const response = await fetch(apiUrl);
			if (!response.ok) throw new Error(`Failed to fetch repo root`);
			return await response.json();
		};
		const contents = await fetchRepoRoot();
		for (const item of contents) {
			if (this.isExcluded(item.path)) {
				//console.log(`⏭️ Skipped excluded item: ${item.path}`);
				continue;
			}
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
					//console.log(`✅ Created: ${filePath}`);
				} else {
					const current = await this.app.vault.adapter.read(filePath);
					if (current !== content) {
						await this.app.vault.adapter.write(filePath, content);
						//console.log(`🔁 Overwritten: ${filePath}`);
					} else {
						//console.log(`✅ Already up to date: ${filePath}`);
					}
				}
				await this.fileCacheManager.updateCache(filePath, content, item.path, false);
			}
		}
		await this.saveSettings();
	}

	async updateSelectedToolkitContent() {
		// 1) Optional manual backup
		if (this.settings.autoBackupBeforeUpdate) {
		  const folder = await this.backupManager.backupVaultMirror('pre-update');
		  new Notice(`Vault mirror backup created at: ${folder}`);
		}
	  
		// 2) Must have defaults loaded
		if (!this.settings.latestDefaults) {
		  new Notice('❌ GitHub defaults not loaded yet.');
		  return;
		}
	  
		// 3) Prepare lookup for deny-listed entries
		const allManifestFiles = this.manifestCache.files.map(f => f.path);
		const fileOverrides    = Object.fromEntries(
		  this.settings.customPaths.map(c => [c.manifestKey, c])
		);
	  
		try {
		  // 4) Single guarded loop: skip deny-listed, optional, then update
		  for (const ghPath of allManifestFiles) {
			// → skip deny-listed
			const override = fileOverrides[ghPath];
			if (override?.doUpdate === false) {
			  console.log(`⏭️ Skipping deny-listed: ${ghPath}`);
			  continue;
			}
	  
			// → resolve vault path
			const vaultPath = this.settings.customizeUpdates
			  ? this.resolveVaultPath(ghPath)
			  : ghPath;
	  
			// → skip missing optional files
			const entry = this.manifestCache.files.find(f => f.path === ghPath);
			if (!entry) continue;  // ← early exit if no matching manifest entry
			
			await this.updateEntryFromManifest(entry, false);

		  }
	  
		  // 5) Sync any missing folders
		  for (const folder of this.manifestCache.folders) {
			if (!(await this.app.vault.adapter.exists(folder.path))) {
			  await this.app.vault.createFolder(folder.path);
			}
		  }
	  
		  // 6) Bump version file and save settings
		  await this.updateVersionFile();
		  this.settings.installedVersion = this.settings.latestToolkitVersion!;
		  await this.saveSettings();
		  new Notice('✅ Toolkit content updated.');
	  
		  // 7) Live-refresh the version display
		  if (this.settingsTab) {
			await this.settingsTab.updateVersionDisplay();
		  }
	  
		} catch (err) {
		  console.error('❌ Update failed. Version not updated.', err);
		  new Notice('❌ Update failed. See console for details. Version file NOT changed.');
		}
	  }
	  
	
	async updateFolderFromGitHub(githubFolderPath: string, vaultFolderPath: string) {
		const excluded = ['.obsidian', '.gitignore', '.gitattributes', '.DS_Store', 'plugins', 'Compendium', 'README.md', '.version.json', '.github'];
		if (excluded.some(ex => githubFolderPath === ex || githubFolderPath.startsWith(`${ex}/`))) {
			//console.log(`⏭️ Skipped excluded folder: ${githubFolderPath}`);
			return;
		}
		const apiUrl = `https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/contents/${githubFolderPath}`;
		try {
			const response = await fetch(apiUrl);
			if (!response.ok) throw new Error(`Failed to fetch folder: ${githubFolderPath}`);
			const files = await response.json();
			if (!(await this.app.vault.adapter.exists(vaultFolderPath))) {
				await this.app.vault.createFolder(vaultFolderPath);
				//console.log(`📁 Created folder: ${vaultFolderPath}`);
			}
			for (const file of files) {
				if (excluded.some(ex => file.path === ex || file.path.startsWith(`${ex}/`))) {
					//console.log(`⏭️ Skipped excluded item: ${file.path}`);
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
						//console.log(`✅ Created: ${filePath}`);
					} else {
						if ((await this.app.vault.adapter.read(filePath)) !== content) {
							await this.app.vault.adapter.write(filePath, content);
							//console.log(`🔁 Overwritten: ${filePath}`);
						} else {
							//console.log(`✅ Already up to date: ${filePath}`);
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

	// ─── Modified Update Single File (with force option) ─────────────────


	async rebuildFileCache() {
		const cache = this.fileCacheManager;
		const tasks: Promise<void>[] = [];
	
		// 1) Index exactly the files listed in the manifest
		for (const entry of this.manifestCache.files) {
		  // Respect custom path overrides
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
			Vault.recurseChildren(folder, file => {
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
	
		// 3) Run tasks in parallel batches
		const batchSize = 10;
		for (let i = 0; i < tasks.length; i += batchSize) {
		  await Promise.all(tasks.slice(i, i + batchSize));
		}
	
		await this.saveSettings();
	  }

	async showIndexingModal() {
		const modal = new class extends Modal {
			constructor(app: App) { super(app); }
			onOpen() {
				// Prevent click propagation in the modal
				this.contentEl.addEventListener('click', (e) => e.stopPropagation());
				this.titleEl.setText('🔄 Indexing Toolkit Files...');
				this.contentEl.createEl('p', {
					text: 'Indexing and caching your VVunderlore Vault for faster updates and safer syncing.'
				});
			}
		}(this.app);
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
			//console.log(`🔁 Updated ${versionPath}`);
		} else {
			await this.app.vault.create(versionPath, content);
			//console.log(`✅ Created ${versionPath}`);
		}
	}

	public async installFullToolkit(): Promise<void> {
		try {
		  const treeApi =
			"https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/git/trees/main?recursive=1";
		  const treeResp = await fetch(treeApi);
		  if (!treeResp.ok) {
			throw new Error(`Failed to list repo tree: ${treeResp.status} ${treeResp.statusText}`);
		  }
	  
		  const treeJson: any = await treeResp.json();
		  if (!treeJson.tree || !Array.isArray(treeJson.tree)) {
			throw new Error("Unexpected GitHub response: treeJson.tree missing or not an array");
		  }
	  
		  // 1) Decide which top‐level prefixes or files to skip.
		  const skipPrefixes = [".git/", "scripts/"];
		  const skipFiles    = [".gitignore"];
	  
		  // optionally, if you want a future whitelist for Compendium,
		  // you could put the allowed subfolders here:
		  const compendiumWhitelist: string[] = [
			// "Compendium/Spells",  // uncomment to allow downloading anything under Compendium/Spells
		  ];
	  
		  // 2) Filter the Git‐tree
		  const filtered = (treeJson.tree as Array<{ path: string; type: "blob" | "tree" }>)
			.filter(item => {
			  // a) skip .git/, scripts/, and skipFiles exactly
			  if (skipPrefixes.some(pref => item.path.startsWith(pref))) return false;
			  if (skipFiles.includes(item.path)) return false;
	  
			  // b) if this is a file under Compendium/, only allow if whitelisted:
			  if (item.type === "blob" && item.path.startsWith("Compendium/")) {
				// If no whitelist entries match, we skip it:
				const allowed = compendiumWhitelist.some(white => item.path.startsWith(white + "/"));
				return allowed;
			  }
	  
			  // c) otherwise keep it
			  return true;
			});
	  
		  // 3) Ensure folders are created first (sort “tree” before “blob”)
		  filtered.sort((a, b) => (a.type === b.type ? 0 : a.type === "tree" ? -1 : 1));
	  
		  // 4) Walk through each filtered item
		  for (let i = 0; i < filtered.length; i++) {
			const entry = filtered[i];
	  
			if (entry.type === "tree") {
			  // Create the folder if it doesn’t exist
			  if (!(await this.app.vault.adapter.exists(entry.path))) {
				await this.app.vault.createFolder(entry.path);
			  }
			} else {
			  // entry.type === "blob"
			  // Build a raw URL without encoding slashes:
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
				if (existing === fileText) {
				  console.log(`[install] skipping unchanged ${entry.path}`);
				  continue;
				} else {
				  console.log(`[install] overwriting changed ${entry.path}`);
				  await this.app.vault.adapter.write(entry.path, fileText);
				}
			  } else {
				console.log(`[install] creating new ${entry.path}`);
				await this.app.vault.create(entry.path, fileText);
			  }
			}
		  }
	  
		  // 5) Create the marker file so next load knows “we’re installed.”
		  const markerPath = ".vvunderlore_installed";
		  if (!(await this.app.vault.adapter.exists(markerPath))) {
			await this.app.vault.create(markerPath, "");
		  }
	  
		  // 6) Flip needsInstall, save settings, re‐render UI
		  this.settings.needsInstall = false;
		  await this.saveSettings();
		  if (this.settingsTab) {
			this.settingsTab.display();
		  }
	  
		  new Notice("✅ VVunderlore Toolkit successfully installed!");
		} catch (err) {
		  console.error("❌ installFullToolkit() error:", err);
		  new Notice("❌ Failed to install toolkit. See console for details.");
		}
	  }
	  
	  
/**
 * Helper: walk a GitHub folder (via the Contents API) and call
 * onFolder(fn) for each subfolder, onFile(fn) for each file.
 *
 * If GitHub returns 403 on a folder, just skip it (do NOT throw).
 * If GitHub returns any other non‐ok status, we throw.
 */
private async _downloadFolderRecursively(
    folderPath: string,
    onFolder: (folderPath: string) => Promise<void>,
    onFile: (fileInfo: { path: string; download_url: string }) => Promise<void>
): Promise<void> {
    // 1) Try to fetch the Contents API for this folder
    const apiUrl = `https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/contents/${folderPath}`;

    let res: Response;
    try {
        res = await fetch(apiUrl);
    } catch (err) {
        // Network error or CORS issue—abort the install
        throw new Error(`Failed to fetch folder listing for "${folderPath}" → ${err}`);
    }

    // 2) If GitHub expressly forbids listing this path, just skip it.
    if (res.status === 403) {
        console.log(`⏭️ Skipping forbidden folder in repo: "${folderPath}"`);
        return;
    }

    // 3) Any other bad status (404, 500, etc.) should throw:
    if (!res.ok) {
        throw new Error(`Failed to fetch folder listing for "${folderPath}": ${res.status} ${res.statusText}`);
    }

    // 4) At this point we have a valid JSON of “tree items”:
    const items: Array<{
        path: string;
        type: "file" | "dir";
        download_url?: string;
    }> = await res.json();

    // 5) First create subfolders, then pull files.
    //    (sorting so that we create all “dir” entries before “blob” entries)
    items.sort((a, b) => (a.type === b.type ? 0 : a.type === "dir" ? -1 : 1));

    for (const item of items) {
        if (item.type === "dir") {
            // Create the folder in the vault (if needed), then recurse:
            await onFolder(item.path);
            await this._downloadFolderRecursively(item.path, onFolder, onFile);
        }
        else if (item.type === "file" && item.download_url) {
            await onFile({ path: item.path, download_url: item.download_url });
        }
    }
}


	onunload() {
		if (this.autoCheckInterval) {
			clearInterval(this.autoCheckInterval);
		}
	}

	scheduleAutoUpdateCheck() {
		this.autoCheckInterval = window.setInterval(() => {
			this.checkForUpdates();
		}, 60 * 60 * 1000);
	}
}
