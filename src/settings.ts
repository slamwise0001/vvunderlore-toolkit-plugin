import { PluginSettingTab, Setting, App, TextComponent, TFile, FuzzySuggestModal } from 'obsidian';
import type VVunderloreToolkitPlugin from './main';

// This class handles the live file search and suggestion behavior
class FileSuggester extends FuzzySuggestModal<TFile> {
	constructor(
		app: App,  // We now pass app directly to super (no need to define it here)
		private input: TextComponent,
		private onChoose: (file: TFile) => void
	) {
		super(app);  // Pass app to the parent class (FuzzySuggestModal)
	}

	// This method will return all markdown files to be used as suggestions
	getItems(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	// This method returns the name of each item for display purposes
	getItemText(item: TFile): string {
		return item.path;
	}

	// This method is called when the user selects an item from the suggestions
	onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.input.setValue(item.path);  // Update the input box with the selected path
		this.onChoose(item);  // Notify that a file was selected
	}
}

export class ToolkitSettingsTab extends PluginSettingTab {
	plugin: VVunderloreToolkitPlugin;

	constructor(app: App, plugin: VVunderloreToolkitPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'VVunderlore Toolkit' });

		const local = await this.plugin.getLocalToolkitVersion();
		const remote = await this.plugin.getRemoteToolkitVersion();

		// Display installed and latest versions of the toolkit
		new Setting(containerEl)
			.setName('Installed Toolkit Version')
			.setDesc(local ?? 'Not installed');

		new Setting(containerEl)
			.setName('Latest Toolkit Version')
			.setDesc(remote ?? 'Could not fetch');

		new Setting(containerEl)
			.addButton((btn) => {
				btn.setButtonText('Check for Updates')
					.setCta()
					.onClick(async () => {
						await this.plugin.checkForUpdates();
						this.display(); // Refresh settings
					});
			});

		// Add button to update selected content
		new Setting(containerEl)
			.setName('Update Selected Content')
			.setDesc('Pull the latest versions of selected toolkit content')
			.addButton((btn) =>
				btn.setButtonText('Update Now')
					.setCta()
					.onClick(async () => {
						await this.plugin.updateSelectedToolkitContent();
					})
			);

		// Add toggle to include Tools folder in updates
		new Setting(containerEl)
			.setName('Tools')
			.setDesc('Include Tools folder in updates')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.updateTargets.tools)
					.onChange(async (value) => {
						this.plugin.settings.updateTargets.tools = value;
						await this.plugin.saveSettings();
					})
			);

		// Add toggle to include Templates folder in updates
		new Setting(containerEl)
			.setName('Templates')
			.setDesc('Include Templates folder in updates')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.updateTargets.templates)
					.onChange(async (value) => {
						this.plugin.settings.updateTargets.templates = value;
						await this.plugin.saveSettings();
					})
			);

		// Add toggle to include the Omninomicon in updates
		new Setting(containerEl)
			.setName('The Omninomicon')
			.setDesc('Updates Adventures/Omninomicon.md')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.updateTargets.omninomicon)
					.onChange(async (value) => {
						this.plugin.settings.updateTargets.omninomicon = value;
						await this.plugin.saveSettings();
					})
			);

		// **Spellbook Path** - This is the input where the user can search and select a file using fuzzy matching
		const spellbookInput = new TextComponent(containerEl);
		spellbookInput
			.setPlaceholder('Search for a file...')
			.setValue(this.plugin.settings.updateTargets.spellbookPath || '')
			.onChange(async (value) => {
				this.plugin.settings.updateTargets.spellbookPath = value;
				await this.plugin.saveSettings();
			});

		// Add the file search suggester
		new Setting(containerEl)
			.setName('Spellbook Location')
			.setDesc('Type or search for the location of your Spellbook file')
			.addText((cb: TextComponent) => {
				cb.inputEl.replaceWith(spellbookInput.inputEl);
			})
			.addButton((btn) => {
				btn.setButtonText('Search')
					.setCta()
					.onClick(() => {
						// Open the file suggester when the user clicks 'Search'
						new FileSuggester(this.app, spellbookInput, (file: TFile) => {
							this.plugin.settings.updateTargets.spellbookPath = file.path;
							spellbookInput.setValue(file.path);  // Set the input to the selected path
							this.plugin.saveSettings();
						}).open();
					});
			});
	}
}
