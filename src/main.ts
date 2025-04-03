import { Plugin, Notice } from 'obsidian';
import { ToolkitSettingsTab } from './settings';


interface ToolkitSettings {
	installedVersion: string;
	updateTargets: {
	  tools: boolean;
	  toolsPath?: string;
	  templates: boolean;
	  templatesPath?: string;
	  omninomicon: boolean;
	  omninomiconPath?: string;
	  spellbookPath: string;
	};
	latestDefaults?: {
	  tools?: string;
	  templates?: string;
	  omninomicon?: string;
	  spellbook?: string;
	};
  }
  
  

  const DEFAULT_SETTINGS: ToolkitSettings = {
	installedVersion: '1.0.0',
	updateTargets: {
	  tools: true,
	  toolsPath: 'Tools',
	  templates: true,
	  templatesPath: 'Extras/Templates',
	  omninomicon: true,
	  omninomiconPath: 'Adventures/Omninomicon.md',
	  spellbookPath: 'Compendium/Spells/_Spellbook.md',
	},
	latestDefaults: undefined // will be populated by checkForUpdates()
  };
  
  

export default class VVunderloreToolkitPlugin extends Plugin {
  settings: ToolkitSettings;

  async onload() {
    await this.loadSettings();
	this.addSettingTab(new ToolkitSettingsTab(this.app, this));
	this.checkForUpdates();
	this.scheduleAutoUpdateCheck();


	this.addCommand({
		id: 'update-selected-toolkit-content',
		name: 'Update Selected Toolkit Content',
		callback: () => this.updateSelectedToolkitContent()
	});
	

    this.addCommand({
      id: 'check-for-toolkit-update',
      name: 'Check for Toolkit Update',
      callback: () => this.checkForUpdates()
    });
  }

  async checkForUpdates() {
	const toolkitPath = '.version.json';  // ← in vault root
	let localToolkitVersion = 'unknown';
	let remoteToolkitVersion = 'unknown';
  
	// Get local toolkit version
	try {
		const content = await this.app.vault.adapter.read(toolkitPath);
	  const json = JSON.parse(content);
	  localToolkitVersion = json.version || 'unknown';
	} catch (err) {
	  console.warn(`Couldn't read local toolkit version:`, err);
	}
  
	// Get remote toolkit version
	try {
		const res = await fetch('https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-full/main/.version.json');
		const data = await res.json();
		
		remoteToolkitVersion = data.version || 'unknown';
	
		this.settings.latestDefaults = data.defaultPaths || {};
		await this.saveSettings();
	  } catch (err) {
		console.error('Error fetching version data:', err);
	  }
	  
	  
  
	

	// Compare versions
	if (localToolkitVersion === remoteToolkitVersion) {
	  new Notice(`✅ VVunderlore Toolkit is up to date (v${localToolkitVersion})`);
	} else {
	  new Notice(`⚠️ Toolkit update available! Installed: v${localToolkitVersion}, Latest: v${remoteToolkitVersion}`);
	}

	try {
		const res = await fetch('https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-plugin/main/version.json');
		const data = await res.json();
		remoteToolkitVersion = data.version || 'unknown';
	  
		// 💡 Store or update the current "latest paths"
		this.settings.latestDefaults = data.defaultPaths || {};
		await this.saveSettings();
	  } catch (err) {
		console.error(`Couldn't fetch remote toolkit version`, err);
	  }
	  
  }
  

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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

async updateSelectedToolkitContent() {
	if (this.settings.updateTargets.tools) await this.updateToolsFolder();
	if (this.settings.updateTargets.templates) await this.updateTemplatesFolder();
	if (this.settings.updateTargets.omninomicon) await this.updateOmninomiconFile();
	if (this.settings.updateTargets.spellbookPath) await this.updateSpellbookFile();
}




async updateToolsFolder() {
	if (!this.settings.updateTargets.tools) {
		console.log('Tools folder update skipped by settings.');
		return;
	}
		
	const repoOwner = 'slamwise0001';
	const repoName = 'VVunderlore-Toolkit-Full'; 
	const githubFolderPath = 'Tools';
	const vaultFolderPath = 'Tools';

	const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${githubFolderPath}`;

	try {
		const response = await fetch(apiUrl);
		const files = await response.json();
		console.log('📦 GitHub API files fetched:', files);


		for (const file of files) {
			if (file.type === 'file') {
				const fileResponse = await fetch(file.download_url);
				const content = await fileResponse.text();
				const filePath = `${vaultFolderPath}/${file.name}`;
				const fileExists = await this.app.vault.adapter.exists(filePath);

				if (!fileExists) {
					await this.app.vault.create(filePath, content);
					console.log(`✅ Created: ${filePath}`);
				} else {
					const existing = await this.app.vault.adapter.read(filePath);
					if (existing !== content) {
						await this.app.vault.adapter.write(filePath, content);
						console.log(`🔁 Overwritten: ${filePath}`);
					} else {
						console.log(`✅ Already up to date: ${filePath}`);
					}
				}
				
			}
		}

		new Notice('✅ Tools folder updated from GitHub.');
	} catch (error) {
		console.error('❌ Failed to update Tools folder:', error);
		new Notice('❌ Failed to update Tools folder.');
	}
}
async updateTemplatesFolder() {
	if (!this.settings.updateTargets.templates) {
		console.log('Templates folder update skipped by settings.');
		return;
	}
		
	const repoOwner = 'slamwise0001';
	const repoName = 'VVunderlore-Toolkit-Full'; 
	const githubFolderPath = 'Extras/Templates';
	const vaultFolderPath = 'Extras/Templates';

	const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${githubFolderPath}`;

	try {
		const response = await fetch(apiUrl);
		const files = await response.json();
		console.log('📦 GitHub API files fetched:', files);


		for (const file of files) {
			if (file.type === 'file') {
				const fileResponse = await fetch(file.download_url);
				const content = await fileResponse.text();
				const filePath = `${vaultFolderPath}/${file.name}`;
				const fileExists = await this.app.vault.adapter.exists(filePath);

				if (!fileExists) {
					await this.app.vault.create(filePath, content);
					console.log(`✅ Created: ${filePath}`);
				} else {
					const existing = await this.app.vault.adapter.read(filePath);
					if (existing !== content) {
						await this.app.vault.adapter.write(filePath, content);
						console.log(`🔁 Overwritten: ${filePath}`);
					} else {
						console.log(`✅ Already up to date: ${filePath}`);
					}
				}
				
			}
		}

		new Notice('✅ Templates folder updated from GitHub.');
	} catch (error) {
		console.error('❌ Failed to update Templates folder:', error);
		new Notice('❌ Failed to update Templates folder.');
	}
}

async updateOmninomiconFile() {
	if (!this.settings.updateTargets.omninomicon) return;

	await this.updateSingleFileFromGitHub({
		githubPath: 'Adventures/Omninomicon.md',
		vaultPath: 'Adventures/Omninomicon.md'
	});
}

async updateSpellbookFile() {
	const fileName = '_Spellbook.md'; // or whatever it actually is
	const githubPath = 'Compendium/Spells/_Spellbook'; // the canonical GitHub location
	const userPath = this.settings.updateTargets.spellbookPath?.trim();

	// If the user set a path, we always use that
	if (userPath && userPath !== githubPath) {
		await this.updateSingleFileFromGitHub({
			githubPath,
			vaultPath: userPath
		});
		return;
	}

	// No user path set, so we want to find out where (if anywhere) the file currently exists
	const allFiles = await this.app.vault.adapter.list('');
	const matchingVaultFile = allFiles.files.find(path => path.endsWith(fileName));

	// If it's already in the right place, just update it
	if (matchingVaultFile === githubPath) {
		await this.updateSingleFileFromGitHub({
			githubPath,
			vaultPath: githubPath
		});
		return;
	}

	// If it's somewhere else in the vault (not user-defined), delete it
	if (matchingVaultFile && matchingVaultFile !== githubPath) {
		await this.app.vault.adapter.remove(matchingVaultFile);
		console.log(`🗑 Removed old instance of ${fileName} from: ${matchingVaultFile}`);
	}

	// Write the file to the correct path from GitHub
	await this.updateSingleFileFromGitHub({
		githubPath,
		vaultPath: githubPath
	});
}



async updateSingleFileFromGitHub({ githubPath, vaultPath }: { githubPath: string; vaultPath: string }) {
	const repoOwner = 'slamwise0001';
	const repoName = 'VVunderlore-Toolkit-Full';
	const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${githubPath}`;

	try {
		const response = await fetch(apiUrl);
		const file = await response.json();

		const fileResponse = await fetch(file.download_url);
		const content = await fileResponse.text();

		const fileExists = await this.app.vault.adapter.exists(vaultPath);

		if (!fileExists) {
			await this.app.vault.create(vaultPath, content);
			console.log(`✅ Created: ${vaultPath}`);
		} else {
			const existing = await this.app.vault.adapter.read(vaultPath);
			if (existing !== content) {
				await this.app.vault.adapter.write(vaultPath, content);
				console.log(`🔁 Overwritten: ${vaultPath}`);
			} else {
				console.log(`✅ Already up to date: ${vaultPath}`);
			}
		}
	} catch (error) {
		console.error(`❌ Failed to update file: ${vaultPath}`, error);
	}
}

  
  async getRemoteToolkitVersion(): Promise<string | null> {
	try {
	  const res = await fetch('https://raw.githubusercontent.com/slamwise0001/vvunderlore-toolkit-plugin/main/version.json');
	  const data = await res.json();
	  return data.version || null;
	} catch {
	  return null;
	}
  }

  private autoCheckInterval: number | null = null;

scheduleAutoUpdateCheck() {
  // Check every hour (60 * 60 * 1000)
  this.autoCheckInterval = window.setInterval(() => {
    this.checkForUpdates(); // Will compare versions AND pull new defaults
  }, 60 * 60 * 1000);
}

onunload() {
  if (this.autoCheckInterval) {
    clearInterval(this.autoCheckInterval);
  }
}

  
}
