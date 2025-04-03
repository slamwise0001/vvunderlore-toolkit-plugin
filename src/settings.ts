import { PluginSettingTab, Setting, App, TFile, TFolder, AbstractInputSuggest, setIcon } from 'obsidian';
import type VVunderloreToolkitPlugin from './main';

class FilePathSuggester extends AbstractInputSuggest<string> {
    private inputEl: HTMLInputElement;
    private paths: { path: string; isFolder: boolean }[] = [];
    private currentSuggestions: string[] = [];
    private renderedSuggestions: Map<HTMLElement, string> = new Map();
  
    constructor(app: App, inputEl: HTMLInputElement) {
      super(app, inputEl);
      this.inputEl = inputEl;
  
      const folders = Object.values(app.vault.getAllLoadedFiles())
        .filter((f): f is TFolder => f instanceof TFolder)
        .map(f => ({ path: f.path, isFolder: true }));
  
      const files = app.vault.getMarkdownFiles()
        .map(f => ({ path: f.path, isFolder: false }));
  
      this.paths = [...folders, ...files];
  
      // ✅ Handle Enter key
      this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          setTimeout(() => {
            const container = (this as any).containerEl as HTMLElement;
            if (!container) return;
  
            const selectedEl = container.querySelector('.suggestion-item.is-selected') as HTMLElement;
            if (selectedEl) {
              const selectedPath = this.renderedSuggestions.get(selectedEl);
              if (selectedPath) {
                this.selectSuggestion(selectedPath);
              }
            }
          }, 0);
        }
      });
    }
  
    getSuggestions(inputStr: string): string[] {
      const query = inputStr.toLowerCase();
      this.currentSuggestions = this.paths
        .filter(({ path }) => path.toLowerCase().includes(query))
        .map(p => p.path);
      return this.currentSuggestions;
    }
  
    renderSuggestion(path: string, el: HTMLElement): void {
      const isFolder = this.paths.find(p => p.path === path)?.isFolder;
  
      el.addClass("mod-complex");
  
      const iconEl = el.createDiv({ cls: 'suggestion-icon' });
      setIcon(iconEl, isFolder ? 'folder' : 'document');
  
      const name = path.split('/').pop()!;
      const displayName = isFolder ? name : name.replace(/\.md$/, '');
      el.createDiv({ text: displayName, cls: 'suggestion-title' });
  
      const parentPath = path.split('/').slice(0, -1).join('/');
      el.createDiv({ text: parentPath, cls: 'search-suggest-info-text' });
  
      el.addEventListener("click", () => {
        this.selectSuggestion(path);
      });
  
      // ✅ Save reference to this DOM element
      this.renderedSuggestions.set(el, path);
    }
  
    selectSuggestion(path: string): void {
      this.inputEl.value = path;
      this.inputEl.dispatchEvent(new Event("input"));
      this.close();
    }
  }
  
  
  

// === Settings tab ===
export class ToolkitSettingsTab extends PluginSettingTab {
  plugin: VVunderloreToolkitPlugin;

  constructor(app: App, plugin: VVunderloreToolkitPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    const FALLBACK_DEFAULT_PATHS = {
        tools: 'Tools',
        templates: 'Extras/Templates',
        omninomicon: 'Adventures/Omninomicon.md',
        spellbook: 'Compendium/Spells/_Spellbook.md',
      };
      
      const DEFAULT_GITHUB_PATHS = {
        ...FALLBACK_DEFAULT_PATHS,
        ...this.plugin.settings.latestDefaults  // override with fetched values if available
      };
      
    
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'VVunderlore Toolkit' });

    const local = await this.plugin.getLocalToolkitVersion();
    const remote = await this.plugin.getRemoteToolkitVersion();

    new Setting(containerEl)
      .setName('Installed Toolkit Version')
      .setDesc(local ?? 'Not installed');

    new Setting(containerEl)
      .setName('Latest Toolkit Version')
      .setDesc(remote ?? 'Could not fetch');

    new Setting(containerEl)
      .addButton(btn =>
        btn.setButtonText('Check for Updates')
          .setCta()
          .onClick(async () => {
            await this.plugin.checkForUpdates();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName('Update Selected Content')
      .setDesc('Pull the latest versions of selected toolkit content')
      .addButton(btn =>
        btn.setButtonText('Update Now')
          .setCta()
          .onClick(async () => {
            await this.plugin.updateSelectedToolkitContent();
          })
      );

    // === TOOLS Section ===
containerEl.createEl('h3', { text: '🧰 Tools' });

new Setting(containerEl)
  .setName('Enable Tools Update')
  .setDesc('Include Tools folder in updates')
  .addToggle(toggle =>
    toggle
      .setValue(this.plugin.settings.updateTargets.tools)
      .onChange(async (value) => {
        this.plugin.settings.updateTargets.tools = value;
        await this.plugin.saveSettings();
      })
  );

new Setting(containerEl)
  .setName('Tools Folder Path')
  .setDesc('Where to place/update the Tools folder')
  .addSearch(search => {
    search
      .setPlaceholder(DEFAULT_GITHUB_PATHS.tools)
      .setValue(this.plugin.settings.updateTargets.toolsPath || '')
      .onChange(async (value) => {
        this.plugin.settings.updateTargets.toolsPath = value;
        await this.plugin.saveSettings();
      });

    new FilePathSuggester(this.app, search.inputEl);
  });


// === TEMPLATES Section ===
containerEl.createEl('h3', { text: '📑 Templates' });

new Setting(containerEl)
  .setName('Enable Templates Update')
  .setDesc('Include Templates folder in updates')
  .addToggle(toggle =>
    toggle
      .setValue(this.plugin.settings.updateTargets.templates)
      .onChange(async (value) => {
        this.plugin.settings.updateTargets.templates = value;
        await this.plugin.saveSettings();
      })
  );

new Setting(containerEl)
  .setName('Templates Folder Path')
  .setDesc('Where to place/update the Templates folder')
  .addSearch(search => {
    search
      .setPlaceholder(DEFAULT_GITHUB_PATHS.templates)
      .setValue(this.plugin.settings.updateTargets.templatesPath || '')
      .onChange(async (value) => {
        this.plugin.settings.updateTargets.templatesPath = value;
        await this.plugin.saveSettings();
      });

    new FilePathSuggester(this.app, search.inputEl);
  });


// === OMNINOMICON Section ===
containerEl.createEl('h3', { text: '📖 Omninomicon' });

new Setting(containerEl)
  .setName('Enable Omninomicon Update')
  .setDesc('Update the Omninomicon?')
  .addToggle(toggle =>
    toggle
      .setValue(this.plugin.settings.updateTargets.omninomicon)
      .onChange(async (value) => {
        this.plugin.settings.updateTargets.omninomicon = value;
        await this.plugin.saveSettings();
      })
  );

new Setting(containerEl)
  .setName('Omninomicon File Path')
  .setDesc('Where to update Omninomicon.md')
  .addSearch(search => {
    search
      .setPlaceholder(DEFAULT_GITHUB_PATHS.omninomicon)
      .setValue(this.plugin.settings.updateTargets.omninomiconPath || '')
      .onChange(async (value) => {
        this.plugin.settings.updateTargets.omninomiconPath = value;
        await this.plugin.saveSettings();
      });

    new FilePathSuggester(this.app, search.inputEl);
  });


// === SPELLBOOK Section ===
containerEl.createEl('h3', { text: '📕 Spellbook' });


new Setting(containerEl)
  .setName('Spellbook Location')
  .setDesc('Type or search for the location of your Spellbook file')
  .addSearch(search => {
    search
      .setPlaceholder(DEFAULT_GITHUB_PATHS.spellbook)
      .setValue(this.plugin.settings.updateTargets.spellbookPath || '')
      .onChange(async (value) => {
        this.plugin.settings.updateTargets.spellbookPath = value;
        await this.plugin.saveSettings();
      });

    new FilePathSuggester(this.app, search.inputEl);
  });

      
  }
}
