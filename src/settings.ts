import {
	PluginSettingTab,
	Setting,
	App,
	TFile,
	TFolder,
	AbstractInputSuggest,
	setIcon,
	Modal,
	MarkdownRenderer,
	Component,
	Notice,
	TextComponent,
	ToggleComponent,
	ButtonComponent,
	DropdownComponent,
	SearchComponent
} from 'obsidian';
import type VVunderloreToolkitPlugin from './main';
import { ConfirmFreshInstallModal } from './firstinstallconfirm';
import { showCustomInstallModal } from "./customInstallModal";
import * as path from 'path';
import { AVAILABLE_EDITIONS, Edition } from './editions'


// Define your CustomPathEntry interface.
interface CustomPathEntry {
	vaultPath: string;
	manifestKey: string;
	doUpdate: boolean;
}

// FilePathSuggester for live search on vault files.
class FilePathSuggester extends AbstractInputSuggest<string> {
	private inputEl: HTMLInputElement;
	private paths: { path: string; isFolder: boolean }[] = [];
	private currentSuggestions: string[] = [];
	private renderedSuggestions: Map<HTMLElement, string> = new Map();

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;

		// Get folders and markdown files from the vault.
		const folders = Object.values(app.vault.getAllLoadedFiles())
			.filter((f): f is TFolder => f instanceof TFolder)
			.map(f => ({ path: f.path, isFolder: true }));
		const files = app.vault.getMarkdownFiles()
			.map(f => ({ path: f.path, isFolder: false }));
		this.paths = [...folders, ...files];

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
		el.addEventListener("click", (e: MouseEvent) => {
			e.stopPropagation();
			this.selectSuggestion(path);
		});
		this.renderedSuggestions.set(el, path);
	}

	selectSuggestion(path: string): void {
		this.inputEl.value = path;
		this.inputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}

// Modal for displaying the changelog.
class MarkdownPreviewModal extends Modal {
	constructor(app: App, private content: string) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.addEventListener('click', (e) => e.stopPropagation());
		this.contentEl.empty();
		this.contentEl.createEl('h2', { text: 'Toolkit Changelog' });
		const md = this.contentEl.createDiv();
		const dummyComponent = new class extends Component { }();
		MarkdownRenderer.renderMarkdown(this.content, md, '/', dummyComponent);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

// The full settings tab.
export class ToolkitSettingsTab extends PluginSettingTab {
	plugin: VVunderloreToolkitPlugin;

	constructor(app: App, plugin: VVunderloreToolkitPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	private renderHeader(root: HTMLElement): void {
		const header = root.createDiv();
		header.addClass("settings-header");

		header.createEl('h3', { text: 'VVunderlore Toolkit Settings' });

		const headerBtns = header.createDiv();
		headerBtns.addClass("settings-header-btn");

		const docsBtn = headerBtns.createEl('button', { text: 'Docs' });
		docsBtn.onclick = () => window.open('http://vvunderlore.com', '_blank');

		const githubBtn = headerBtns.createEl('button', { text: 'GitHub' });
		githubBtn.onclick = () =>
			window.open('https://github.com/slamwise0001/VVunderlore-Toolkit-Full', '_blank');

		const kofiBtn = headerBtns.createEl('button', {
			text: '☕ Ko-fi',
			cls: 'mod-cta',
		});
		kofiBtn.addClass("settings-kofi");
		kofiBtn.onclick = () => window.open('https://ko-fi.com/vvunderlore', '_blank');
	}

	private renderFirstRunCard(root: HTMLElement) {

		// 1) Outer wrapper
		const card = root.createEl('div', { cls: 'vvunderlore-first-run' });
		Object.assign(card.style, {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			textAlign: 'center',
			marginTop: '2em',
			padding: '1em',
			border: '2px solid var(--divider-color)',
			borderRadius: '18px',        /* (optional) round the corners slightly */
			backgroundColor: 'var(--background-primary)', /* (optional) white/gray background */
		});

		// 2) Header
		const title = card.createEl('h2', {
			text: '🏰 Welcome to VVunderlore',
			cls: 'vv-card-title',
		});
		// Give the title a little bottom margin
		title.addClass("vv-mb-sm");

		// 3) Instructional copy
		const desc = card.createEl('p', {
			text:
				'Get started by installing the default toolkit—\nor choose individual pieces to suit your vault.',
			cls: 'vv-card-desc',
		});
		// Slight bottom margin so it doesn't butt right up against the buttons
		desc.addClass("vv-mb-lg");

		// ─── RULESET / REFERENCE GRID ───────────────────────────────────────────────────
		const plugin = this.plugin;

		// 1) Grid container
		const grid = card.createDiv();
		Object.assign(grid.style, {
			display: 'grid',
			gridTemplateColumns: 'max-content max-content',
			columnGap: '1rem',
			rowGap: '0.25rem',
			justifyContent: 'center',
			justifyItems: 'center',
			marginBottom: '1rem',
		});

		// 2) Header row
		const labelRs = grid.createEl('div', { text: 'Ruleset' });
		labelRs.addClass("install-rulesheader");
		const labelRef = grid.createEl('div', { text: 'Reference (optional)' });
		labelRef.addClass("install-rulesheader");

		// 3) Input cells
		const rsCell = grid.createDiv({ attr: { style: 'text-align:center' } });
		const refCell = grid.createDiv({ attr: { style: 'text-align:center' } });

		// 4) Muted, italic summary bar (spans both columns)
		const summaryBar = grid.createDiv();
		Object.assign(summaryBar.style, {
			gridColumn: '1 / span 2',
			display: 'flex',
			alignItems: 'center',
			flexWrap: 'wrap',
			gap: '0.5rem',
			fontSize: '0.85em',
			color: 'var(--text-muted)',
			fontStyle: 'italic',
			marginTop: '0.25rem',
			marginBottom: '1rem',
		});
		const rulesetSpan = summaryBar.createSpan({
			text: `Ruleset: ${plugin.settings.rulesetCompendium
				? `D&D 5E (${plugin.settings.rulesetCompendium})`
				: ''
				}`,
		});
		rulesetSpan.addClass("install-rulesheader");
		summaryBar.createSpan({ text: 'References:' });
		const chipsWrapper = summaryBar.createDiv();
		Object.assign(chipsWrapper.style, { display: 'flex', gap: '4px' });

		// Helper to render a chip
		function addChip(id: string) {
			const ed = AVAILABLE_EDITIONS.find(e => e.id === id)!;
			const chip = chipsWrapper.createDiv({
				attr: {
					style:
						'background: var(--interactive-accent); color: white; padding:2px 6px; ' +
						'border-radius:4px; display:inline-flex; align-items:center; gap:4px;'
				}
			});
			chip.createSpan({ text: ed.label });
			const rem = chip.createSpan({
				text: '×',
				attr: { style: 'cursor:pointer; margin-left:4px;' }
			});
			rem.onclick = async () => {
				plugin.settings.rulesetReference = plugin.settings.rulesetReference.filter(x => x !== id);
				await plugin.saveSettings();
				chip.remove();
				updateInstallButtons();
			};
		}
		;

		// Initial chips draw
		plugin.settings.rulesetReference.forEach(e => addChip(e));

		// 5) Ruleset dropdown
		const rsDropdown = new DropdownComponent(rsCell);
		rsDropdown.addOption('', 'Select edition…');
		AVAILABLE_EDITIONS.forEach((ed: Edition) => {
			rsDropdown.addOption(ed.id, ed.label);
		});
		rsDropdown
			.setValue(this.plugin.settings.rulesetCompendium)
			.onChange(async (val) => {
				this.plugin.settings.rulesetCompendium = val;
				await this.plugin.saveSettings();

				// Live‐update your summary bar:
				const chosen = AVAILABLE_EDITIONS.find(e => e.id === val);
				rulesetSpan.textContent = chosen ? chosen.label : '';

				// Clear any existing reference chips:
				chipsWrapper.empty();

				updateInstallButtons();
			});

		const searchWrapperEl = refCell.createDiv({ attr: { style: 'text-align:center;' } });
		const searchComp = new SearchComponent(searchWrapperEl);
		searchComp.setPlaceholder('Add reference rules…');
		const suggestionInputEl = searchComp.inputEl;

		new class extends AbstractInputSuggest<string> {
			constructor(app: App, inputEl: HTMLInputElement) {
				super(app, inputEl);
			}

			// 1) Propose edition IDs (minus the one they picked as the main ruleset)
			getSuggestions(input: string): string[] {
				return AVAILABLE_EDITIONS
					.filter(ed => ed.id !== plugin.settings.rulesetCompendium)            // filter out the chosen ruleset
					.filter(ed => ed.label.toLowerCase().includes(input.toLowerCase()))     // match on label text
					.map(ed => ed.id);                                                      // return the ID for each
			}

			// 2) Render the human-readable label
			renderSuggestion(item: string, el: HTMLElement): void {
				const ed = AVAILABLE_EDITIONS.find(e => e.id === item)!;
				el.createDiv({ text: ed.label });
			}

			// 3) When they pick one, store its ID and add a chip
			selectSuggestion(item: string): void {
				if (!plugin.settings.rulesetReference.includes(item)) {
					plugin.settings.rulesetReference.push(item);
					plugin.saveSettings();
					addChip(item);
				}
				this.close();
				suggestionInputEl.value = '';
				updateInstallButtons();
			}
		}(this.app, suggestionInputEl);





		// ─── Button row ───────────────────────────────────────────────
		const btnRow1 = card.createEl('div', { cls: 'vv-button-row' });
		Object.assign(btnRow1.style, {
			display: 'flex',
			gap: '0.75em',
			justifyContent: 'center',
			marginBottom: '1.5em',
		});

		const installBtn1 = btnRow1.createEl('button', {
			text: 'Install Toolkit',
			cls: 'mod-cta',
		});
		installBtn1.onClickEvent(() =>
			new ConfirmFreshInstallModal(this.app, this.plugin).open()
		);

		// const customBtn1 = btnRow1.createEl('button', {
		// text: 'Custom Install',
		// cls: 'mod-cta',
		// });
		// Object.assign(customBtn1.style, {
		// background: 'none',
		// border: '1px solid var(--interactive-accent)',
		// color: 'var(--text-normal)',
		// });
		// customBtn1.onClickEvent(() => showCustomInstallModal(this.app, this.plugin));

		// ─── Helper to enable/disable the buttons ─────────────────────
		const updateInstallButtons = () => {
			const hasRuleset = Boolean(this.plugin.settings.rulesetCompendium);
			installBtn1.toggleAttribute('disabled', !hasRuleset);
			// customBtn1.toggleAttribute('disabled', !hasRuleset);
		};

		// 7) Initial call, in case we’re re-rendering
		updateInstallButtons();


		// 5) “Skip” link
		const skipPara = card.createEl('p', { cls: 'vv-skip-link' });
		// Center it and give it a tiny top margin
		Object.assign(skipPara.style, {
			textAlign: 'center',
			marginTop: '0.25em',
		});
		skipPara
			.createEl('a', {
				text: 'Already have the Toolkit? Show me the settings →',
			})
			.onClickEvent(async () => {
				// 1) Create the hidden marker file so "first‐run" never shows again:
				const markerPath = '.vvunderlore_installed';
				try {
					// Only write it if it does not exist yet
					if (!(await this.app.vault.adapter.exists(markerPath))) {
						await this.app.vault.create(markerPath, '');
					}
				} catch (e) {
					console.error('❌ Failed to create marker file:', e);
				}


				// 3) Re‐render the normal settings UI
				this.display();
			});
	}

	private formatRulesetLabel(id?: string | null): string {
		if (!id) return "Unknown";
		const ed = AVAILABLE_EDITIONS.find(e => e.id === id);
		return ed ? ed.label : String(id);
	}

	private async resolveRulesetId(): Promise<string | null> {
		// 1) settings (preferred)
		const s = this.plugin?.settings as any;
		const fromSettings =
			s?.rulesetCompendium ||  // <— your installer dropdown saves here
			s?.rulesetId ||
			s?.ruleset ||
			null;
		if (fromSettings) return String(fromSettings);

		// 2) optional sentinels
		try {
			const txt = await this.app.vault.adapter.read("Compendium/.ruleset.json");
			const j = JSON.parse(txt);
			return j.rulesetId || j.ruleset || null;
		} catch (_) { }

		try {
			const txt = await this.app.vault.adapter.read(".version.json");
			const j = JSON.parse(txt);
			return j.rulesetId || j.ruleset || null;
		} catch (_) { }

		return null;
	}

	private async updateRulesetDisplay(): Promise<void> {
		if (!this.rulesetValueEl) return;
		const id = await this.resolveRulesetId();
		const label = this.formatRulesetLabel(id);

		this.rulesetValueEl.textContent = label;
		this.rulesetValueEl.classList.remove("vv-success", "vv-warn", "vv-error");
		this.rulesetValueEl.addClass(id ? "vv-success" : "vv-warn");
	}


	private versionValueEl: HTMLElement | null = null;
	private forceWarningEl: HTMLElement | null = null;
	private rulesetValueEl: HTMLSpanElement | null = null;

	async display(): Promise<void> {
		const { containerEl } = this;
		const savedScrollTop = containerEl.scrollTop;
		containerEl.empty();

		const markerPath = '.vvunderlore_installed';
		const isInstalled = await this.app.vault.adapter.exists(markerPath);
		if (!isInstalled) {
			this.renderFirstRunCard(containerEl);
			containerEl.scrollTop = savedScrollTop;
			return;
		}

		this.renderHeader(containerEl); // 👈 Always render header first

		; (async () => {

			/** ─── VERSION SECTION ─── */
			const versionRow = containerEl.createDiv();
			versionRow.addClass("settings-versionrow");

			const versionInfo = versionRow.createDiv();
			versionInfo.addClass("settings-versioninfo");

			let installed = 'Not installed';
			try {
				const verContent = await this.app.vault.adapter.read('.version.json');
				const json = JSON.parse(verContent);
				installed = json.version ?? 'Not installed';
			} catch (err) {
				console.warn('Could not read .version.json from vault:', err);
			}
			const latest = this.plugin.settings.latestToolkitVersion ?? 'Could not fetch';
			const isMatch = installed === latest;

			const vaultRow = versionInfo.createDiv();
			vaultRow.appendText('Vault Toolkit Version: ');

			this.versionValueEl = vaultRow.createSpan();  // 🔥 save ref
			this.versionValueEl.textContent = installed;
			this.versionValueEl.addClass("vv-bold", isMatch ? "vv-success" : "vv-error");


			const latestRow = versionInfo.createEl('div', { text: 'Latest Official Version: ' });
			latestRow.createSpan({
				text: latest,
				attr: { style: 'font-weight: bold; color: var(--text-success);' }
			});

			const versionControls = versionRow.createDiv();
			versionControls.addClass("settings-versioncontrols");

			const buttonRow = versionControls.createDiv();
			buttonRow.addClass("settings-buttonrow");

			const checkBtn = buttonRow.createEl('button', {
				text: installed !== latest ? 'Preview Update' : 'Check for Updates',
				cls: 'mod-cta'
			});
			checkBtn.addEventListener('click', async () => {
				if (installed !== latest) {
					this.plugin.previewUpdatesModal();
				} else {
					await this.plugin.checkForUpdates();
				}
			});
			const changelogBtn = buttonRow.createEl('button', { text: '📖 View Changelog' });
			changelogBtn.addEventListener('click', () => {
				new MarkdownPreviewModal(this.app, this.plugin.changelog).open();
			});
			if (this.plugin.settings.lastChecked) {
				const lastChecked = versionControls.createDiv();
				lastChecked.addClass("settings-lastchecked");
				lastChecked.textContent = `Last checked: ${new Date(this.plugin.settings.lastChecked).toLocaleString()}`;
			}
			//ruleset ident
			const rulesetRow = versionInfo.createDiv();
			rulesetRow.addClass("settings-rulesetrow");
			rulesetRow.setAttr("style", "margin-top: 6px;margin-bottom: 12px;");

			rulesetRow.appendText("Vault Ruleset: ");
			this.rulesetValueEl = rulesetRow.createSpan({});
			this.rulesetValueEl.textContent = "Detecting…";

			await this.updateRulesetDisplay();



			/** ─── FIX YOUR VAULT SECTION (collapsible, fixed‐icon) ─── */
			const fixDetails = containerEl.createEl('details', { cls: 'vk-section' });

			// ─── Replace your old fixHeader with this <summary> ──────────────────────────
			const fixHeader = fixDetails.createEl('summary', { cls: 'vk-section-header' });
			Object.assign(fixHeader.style, {
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'stretch',
				padding: '0.5em 0',
				borderBottom: '1px solid var(--divider-color)',
				cursor: 'pointer',
			});

			// ── Create a single flex‐row inside the summary for title+icon ──────────────
			const fixHeaderRow = fixHeader.createDiv({
				attr: {
					style: `
			display: flex;
			justify-content: space-between;
			align-items: flex-end;
			`,
				},
			});

			// ── Left side: title + description block ────────────────────────────────────
			const fixTitleBlock = fixHeaderRow.createDiv({
				attr: { style: 'display: flex; flex-direction: column;' }
			});
			fixTitleBlock.createEl('h5', { text: 'Fix Your Vault' });
			fixTitleBlock.createEl('div', {
				text: 'Fix and broken, deleted, or misplaced files in your toolkit.',
				cls: 'setting-item-description',
				attr: { style: 'margin-top: 0.25em;' },
			});

			// ── Right side: static toggle icon (rotates in place only) ──────────────────
			const fixToggleIcon = fixHeaderRow.createEl('span', { text: 'VV', cls: 'vk-toggle-icon' });
			Object.assign(fixToggleIcon.style, {
				fontWeight: 'bold',
				display: 'inline-block',
				transition: 'transform 0.2s ease',
				transformOrigin: '50% 50%', // Rotate around its own center
				userSelect: 'none',
				transform: fixDetails.open ? 'rotate(0deg)' : 'rotate(180deg)',
			});
			fixDetails.ontoggle = () => {
				fixToggleIcon.addClass("vv-rotated");
			};

			// ─── Body (same as before, just indented under <details>) ───────────────────
			const fixBody = fixDetails.createDiv({ cls: 'vk-section-body' });
			fixBody.addClass("vv-pl-md");

			// ── Button + warning row ───────────────────────────────────────────────────
			const fixButtonRow = fixBody.createDiv();
			fixButtonRow.addClass("vv-checkbox-row", "vv-justify-between");

			const warningContainer = fixButtonRow.createDiv();
			this.forceWarningEl = warningContainer;

			let installedVersionStr = '';
			try {
				const versionFile = await this.plugin.app.vault.adapter.read('.version.json');
				const parsed = JSON.parse(versionFile);
				installedVersionStr = (parsed.version ?? '').trim();
			} catch {
				installedVersionStr = '';
			}

			const latestVersionStr = (this.plugin.settings.latestToolkitVersion ?? '').trim();

			if (installedVersionStr && latestVersionStr && installedVersionStr !== latestVersionStr) {
				const warn = warningContainer.createEl('div', {
					text: `⚠️ New version available (${installedVersionStr} → ${latestVersionStr}) — use regular update instead`,
				});
				warn.addClass("vv-small", "vv-muted", "vv-italic");
				warn.setAttr(
					'title',
					'Force updating while a new version is available may skip important changes.'
				);
			}

			// ➡️ Right side: action buttons
			const buttonGroup = fixButtonRow.createDiv();
			buttonGroup.addClass("settings-buttonrow");

			buttonGroup
				.createEl("button", { text: "Force Update Vault", cls: "mod-cta" })
				.onclick = async () => {
					// first do your normal “force update” flow:
					await this.plugin.forceUpdatePreviewAndConfirm();
					// then, if the user asked for a re-parse, do that:
					if (this.plugin.settings.reparseGamesets) {
						await this.plugin.refreshGameSetData();
					}
				};


			buttonGroup.createEl('button', {
				text: 'Undo Update'
			}).onclick = async () => {
				await this.plugin.undoForceUpdate();
			};


			// ── Timestamp row ──────────────────────────────────────────────────────────
			const fixTimestampRow = fixBody.createDiv();
			Object.assign(fixTimestampRow.style, {
				textAlign: 'right',
				fontSize: '11px',
				color: 'var(--text-muted)',
				marginTop: '0.25em'
			});
			fixTimestampRow.textContent = `Last forced: ${this.plugin.settings.lastForceUpdate
				? new Date(this.plugin.settings.lastForceUpdate).toLocaleString()
				: 'Not forced yet'
				}`;

			// ──────────────── divider ────────────────
			fixBody.createEl('div', {
				attr: {
					style: 'border-top: 1px solid var(--divider-color); margin: 0.75em 0;'
				}
			});

			// ─── New “re-parse gamesets” toggle ─────────────────────────────────────
			const reparseRow = fixBody.createDiv();
			reparseRow.addClass("vv-mt-sm");
			new Setting(reparseRow)
				.setName("Re-parse Game Sets On Force Update")
				.setDesc(
					"Also re-parse your ruleset compendium and reference sets. This won't delete any files in the Compendium or Reference folders."
				)

				.addToggle((tog) =>
					tog
						.setValue(this.plugin.settings.reparseGamesets)
						.onChange(async (value) => {
							this.plugin.settings.reparseGamesets = value;
							await this.plugin.saveSettings();
						})
				);

			// ─── BACKUP SECTION ────────────────────────────────────
			const backupDetails = containerEl.createEl('details', { cls: 'vk-section' });

			// Summary block: stacked column layout
			const backupSummary = backupDetails.createEl('summary', { cls: 'vk-section-header' });

			Object.assign(backupSummary.style, {
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'stretch',
				padding: '0.5em 0',
				borderBottom: '1px solid var(--divider-color)',
				cursor: 'pointer',
			});

			// Create title + icon row
			const backupTitleRow = backupSummary.createDiv({
				attr: {
					style: `
			display: flex;
			justify-content: space-between;
			align-items: flex-end;
			`,
				},
			});

			// Left: header block (title + description together) 
			const titleBlock = backupTitleRow.createDiv({
				attr: { style: 'display: flex; flex-direction: column;' }
			});

			titleBlock.createEl('h5', { text: 'Vault Backups' });

			titleBlock.createEl('div', {
				text: 'The Toolkit will back up your vault automatically before updates. You can also back up manually anytime.',
				cls: 'setting-item-description',
				attr: { style: 'margin-top: 0.25em;' },
			});

			// Right: collapse icon
			const backupVvIcon = backupTitleRow.createEl('span', { text: 'VV', cls: 'vk-toggle-icon' });

			Object.assign(backupVvIcon.style, {
				fontWeight: 'bold',
				display: 'inline-block',
				transition: 'transform 0.2s ease',
				transformOrigin: '50% 50%',
				userSelect: 'none',
				transform: backupDetails.open ? 'rotate(0deg)' : 'rotate(180deg)',
			});

			// Collapse rotation behavior
			backupDetails.ontoggle = () => {
				backupVvIcon.addClass("vv-rotated");
			};

			// 2) Body
			const backupBody = backupDetails.createDiv({ cls: 'vk-section-body' });
			backupBody.addClass("vv-pl-md");

			new Setting(backupBody)
				.setName('Auto-Backup Before Update')
				.setDesc('Create a full .zip of the vault before applying version updates. Force updates will only back up the files that will be modified or removed.')
				.addToggle(t =>
					t
						.setValue(this.plugin.settings.autoBackupBeforeUpdate)
						.onChange(async v => {
							this.plugin.settings.autoBackupBeforeUpdate = v;
							await this.plugin.saveSettings();
						})
				);

			new Setting(backupBody)
				.setName('Manual Backup')
				.setDesc('Immediately create a zip backup of your vault')
				.addButton(b =>
					b
						.setButtonText('Backup Vault Now')
						.setCta()
						.onClick(async () => {
							const path = await this.plugin.backupManager.backupVaultToZip('manual');
							new Notice(`Backup created: ${path}`);
						})
				);

			new Setting(backupBody)
				.setName('Open Backups Folder')
				.setDesc('Open the backups folder on disk. MacOS: Cant see it? Hit Shift+Cmd+(period).')
				.addButton(b =>
					b
						.setButtonText('Open Folder')
						.onClick(async () => {
							try {

								const vaultBasePath: string = (this.plugin.app.vault.adapter as any).getBasePath();

								const backupFolderPath = path.join(
									vaultBasePath,
									'.vault-backups'
								);

								const { shell } = (window as any).require('electron');
								const result = await shell.openPath(backupFolderPath);
								if (typeof result === 'string' && result.length > 0) {
									console.error('❌ shell.openPath error:', result);
									new Notice('Could not open backups folder. See console.');
								}
							} catch (err) {
								console.error('❌ Could not open backups folder:', err);
								new Notice('Could not open backups folder. See console.');
							}
						})
				);
			backupBody.createEl('div', {
				attr: {
					style: 'border-top: 1px solid var(--divider-color); margin-top: 1.5em;'
				}
			});



			// ──────────────── CUSTOM UPDATES SECTION ────────────────
			const customizationDetails = containerEl.createEl('details', { cls: 'vk-section' });

			const customizationSummary = customizationDetails.createEl('summary', { cls: 'vk-section-header' });

			Object.assign(customizationSummary.style, {
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'flex-start',
				padding: '0.5em 0',
				cursor: 'pointer',
			});

			const titleRow = customizationSummary.createDiv({
				attr: {
					style: `
			display: flex;
			width: 100%;
			justify-content: space-between;
			align-items: flex-end;
			`,
				},
			});

			const customizationTitleBlock = titleRow.createDiv({
				attr: { style: 'display: flex; flex-direction: column;' }
			});

			const h5 = customizationTitleBlock.createEl('h5');
			h5.appendText('Custom File Management ');

			customizationTitleBlock.createEl('div', {
				text: 'Skip updates on certain files or remap relocated Toolkit files so they can update.',
				cls: 'setting-item-description',
				attr: { style: 'margin-top: 0.25em;' },
			});

			const customVvIcon = titleRow.createEl('span', { text: 'VV', cls: 'vk-toggle-icon' });

			Object.assign(customVvIcon.style, {
				fontWeight: 'bold',
				transition: 'transform 0.2s ease',
				transformOrigin: '50% 50%',
				userSelect: 'none',
				transform: customizationDetails.open ? 'rotate(0deg)' : 'rotate(180deg)',
			});

			customizationDetails.ontoggle = () => {
				customVvIcon.addClass("vv-rotated");
			};

			const customizationBodyWrapper = customizationDetails.createDiv({
				attr: { style: 'padding-left: 1em; padding-right: 1em;' }
			});
			const customizationBody = customizationBodyWrapper.createDiv({ cls: 'vk-section-body' });



			// ─── SKIP-LIST PANEL ──────────────────────────────────────────────

			const skipSection = customizationBody.createDiv();

			// 1. Create setting block (matches Obsidian native UI layout)
			const settingItem = skipSection.createDiv({ cls: 'setting-item' });

			// 2. Left column: title + description
			const info = settingItem.createDiv({ cls: 'setting-item-info' });
			info.createDiv({ text: 'Skip Toolkit Items', cls: 'setting-item-name' });
			info.createDiv({
				text: 'Files listed here will be ignored during toolkit updates.',
				cls: 'setting-item-description',
			});

			// 3. Right column: dropdown + button
			const control = settingItem.createDiv({ cls: 'setting-item-control' });

			const dropdown = new DropdownComponent(control);
			dropdown.selectEl.addClass("dropdownwidth");
			dropdown.addOption('', 'Select an item…');
			this.plugin.manifestCache.files
				.filter(f => !f.optional)
				.forEach(f => dropdown.addOption(f.path, f.displayName ?? f.path.split('/').pop()!));
			this.plugin.manifestCache.folders
				.filter(f => !f.optional)
				.forEach(f => dropdown.addOption(f.path, (f.displayName ?? f.path.split('/').pop()!) + '/ (folder)'));

			new ButtonComponent(control)
				.setButtonText('Add')
				.setCta()
				.onClick(async () => {
					const key = dropdown.getValue();
					if (!key) return new Notice('Pick something to skip.');
					if (!this.plugin.settings.customPaths.some(c => c.manifestKey === key)) {
						this.plugin.settings.customPaths.push({ vaultPath: key, manifestKey: key, doUpdate: false });
						await this.plugin.saveSettings();
						renderSkipTable();
					}
				});

			// 4. Table wrapper for skipped items
			const skipTableWrapper = skipSection.createDiv({ cls: 'vk-table-wrapper', attr: { style: 'margin-top:0.75em' } });

			const renderSkipTable = () => {
				skipTableWrapper.empty();

				const items = this.plugin.settings.customPaths.filter(c => !c.doUpdate);

				if (items.length === 0) {
					// No table if nothing to show — just an empty state message
					const emptyMsg = skipTableWrapper.createEl('div', { text: 'No items skipped.' });
					emptyMsg.addClass("settings-emptymsg");
					return;
				}

				// Render table only if items exist
				const table = skipTableWrapper.createEl('table', { cls: 'setting-table' });

				const header = table.createTHead().insertRow();
				header.insertCell().textContent = 'Skipped Files/Folders';

				const body = table.createTBody();

				items.forEach((entry) => {
					const row = body.insertRow();
					const contentCell = row.insertCell();
					contentCell.addClass("settings-filetable");

					contentCell.createSpan({ text: entry.manifestKey });

					const removeLink = contentCell.createEl('a', { text: 'Remove entry', href: '#' });
					removeLink.addClass("settings-removelink");
					removeLink.onclick = async (e) => {
						e.preventDefault();
						this.plugin.settings.customPaths.remove(entry);
						await this.plugin.saveSettings();
						renderSkipTable();
					};
				});
			};

			renderSkipTable();

			// ──────────────── Spacer & Divider Before Remap Panel ────────────────
			customizationBody.createEl('div', {
				attr: { style: 'height: 1em; border-top: 1px solid var(--divider-color); margin: 1em 0;' }
			});

			// ──────────────── REMAP PANEL ────────────────
			const remapSection = customizationBody.createDiv();


			// Setting-style wrapper
			const remapSetting = remapSection.createDiv({ cls: 'setting-item' });

			// Left: header + description (unchanged style)
			const remapInfo = remapSetting.createDiv({ cls: 'setting-item-info' });
			remapInfo.createDiv({ text: 'Remap File Paths', cls: 'setting-item-name' });
			remapInfo.createDiv({
				text: 'Remap toolkit files vault paths if you chose to move anything. Moving files without remapping will result in duplicate and/or out-of-date files after update.',
				cls: 'setting-item-description'
			});

			// New full-width block below for controls
			const remapControlBlock = remapSection.createDiv({ cls: 'vk-inline-add-controls' });
			remapControlBlock.addClass("settings-remapcontrol");

			let remapDrop: DropdownComponent;
			let remapInput: HTMLInputElement;

			remapDrop = new DropdownComponent(remapControlBlock);
			remapDrop.selectEl.addClass("dropdownwidth");
			remapDrop.addOption('', 'Select an item…');
			this.plugin.manifestCache.files.forEach(f =>
				remapDrop.addOption(f.path, f.displayName ?? f.path.split('/').pop()!)
			);
			this.plugin.manifestCache.folders.forEach(f =>
				remapDrop.addOption(f.path, (f.displayName ?? f.path.split('/').pop()!) + '/ (folder)')
			);

			const searchWrapper = remapControlBlock.createDiv();
			const searchComponent = new SearchComponent(searchWrapper);
			searchComponent.setPlaceholder('Search vault path…');
			new FilePathSuggester(this.app, searchComponent.inputEl);
			remapInput = searchComponent.inputEl;

			new ButtonComponent(remapControlBlock)
				.setButtonText('Add Remap')
				.setCta()
				.onClick(async () => {
					const key = remapDrop.getValue();
					const vp = remapInput.value.trim();
					if (!key || !vp) return new Notice('Select an item and enter a vault path.');
					if (!this.app.vault.getAbstractFileByPath(vp)) return new Notice('Vault path not found.');
					this.plugin.settings.customPaths = this.plugin.settings.customPaths.filter(c => c.manifestKey !== key);
					this.plugin.settings.customPaths.push({ manifestKey: key, vaultPath: vp, doUpdate: true });
					await this.plugin.saveSettings();
					remapInput.value = '';
					remapDrop.setValue('');
					renderRemapPanel();
				});


			// 4. Table wrapper
			const remapTableWrapper = remapSection.createDiv({ cls: 'vk-table-wrapper', attr: { style: 'margin-top: 0.75em' } });

			const renderRemapPanel = () => {
				remapTableWrapper.empty();

				const toRemap = this.plugin.settings.customPaths.filter(c => c.doUpdate);

				if (toRemap.length === 0) {
					const emptyMsg = remapTableWrapper.createEl('div', { text: 'No custom paths defined.' });
					emptyMsg.addClass("settings-emptymsg");
					return;
				}

				const table = remapTableWrapper.createEl('table', { cls: 'setting-table' });
				const head = table.createTHead().insertRow();
				['Toolit Item', 'New Vault Path', ''].forEach(txt => head.insertCell().textContent = txt);

				const body = table.createTBody();
				toRemap.forEach(entry => {
					const row = body.insertRow();

					// Manifest Key
					row.insertCell().textContent = entry.manifestKey;

					// Vault Path
					row.insertCell().textContent = entry.vaultPath;

					// Remove link
					const removeCell = row.insertCell();
					const removeLink = removeCell.createEl('a', { text: 'Remove entry', href: '#' });
					removeLink.addClass("settings-removelink");
					removeLink.onclick = async (e) => {
						e.preventDefault();
						this.plugin.settings.customPaths.remove(entry);
						await this.plugin.saveSettings();
						renderRemapPanel();
					};
				});
			};

			renderRemapPanel();

			// Add divider inside the body, at the top
			customizationBody.createEl('div', {
				attr: {
					style: 'border-top: 1px solid var(--divider-color); margin: 0.5em 0;'
				}
			});

			// ───── TOOLKIT BEHAVIOR SECTION ─────────────────────────────────────────────
			const behaviorDetails = containerEl.createEl('details', { cls: 'vk-section' });

			const behaviorSummary = behaviorDetails.createEl('summary', { cls: 'vk-section-header' });
			Object.assign(behaviorSummary.style, {
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'stretch',
				padding: '0.5em 0',
				borderBottom: '1px solid var(--divider-color)',
				cursor: 'pointer',
			});

			const behaviorRow = behaviorSummary.createDiv({
				attr: { style: 'display:flex; justify-content:space-between; align-items:flex-end;' }
			});

			const behaviorTitle = behaviorRow.createDiv({ attr: { style: 'display:flex; flex-direction:column;' } });
			behaviorTitle.createEl('h5', { text: 'Toolkit Behavior' });
			behaviorTitle.createEl('div', {
				text: 'Fine-tune how the toolkit behaves during common workflows.',
				cls: 'setting-item-description',
				attr: { style: 'margin-top:0.25em;' },
			});

			const behaviorIcon = behaviorRow.createEl('span', { text: 'VV', cls: 'vk-toggle-icon' });
			Object.assign(behaviorIcon.style, {
				fontWeight: 'bold',
				display: 'inline-block',
				transition: 'transform 0.2s ease',
				transformOrigin: '50% 50%',
				userSelect: 'none',
				transform: behaviorDetails.open ? 'rotate(0deg)' : 'rotate(180deg)',
			});
			behaviorDetails.ontoggle = () => {
				behaviorIcon.addClass("vv-rotated");
			};

			const behaviorBody = behaviorDetails.createDiv({ cls: 'vk-section-body' });
			behaviorBody.addClass("vv-pl-md");

			// Dropdown: Session title preference
			new Setting(behaviorBody)
				.setName("Session Template Naming")
				.setDesc("When both a date and a name are entered in the New Session form, choose which one to use in the session note title. For example, 'Session 14 - Burning Down the Village' vs 'Session 14 - 4.5.63'")
				.addDropdown((dd) => {
					dd.addOption("name", "Session Name");
					dd.addOption("date", "Date");
					dd.setValue(this.plugin.settings.sessionTitlePreference ?? "name");
					dd.onChange(async (val: "name" | "date") => {
						this.plugin.settings.sessionTitlePreference = val;
						await this.plugin.saveSettings();
					});
				});





			// ───── HIGHLIGHT SECTION ───────────────────────────────────────────────────
			const highlightDetails = containerEl.createEl('details', { cls: 'vk-section' });

			// 1) Build the <summary> for highlight, matching backup style:
			const highlightSummary = highlightDetails.createEl('summary', { cls: 'vk-section-header' });
			Object.assign(highlightSummary.style, {
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'stretch',
				padding: '0.5em 0',
				borderBottom: '1px solid var(--divider-color)',
				cursor: 'pointer',
			});

			// 1a) Create the title + icon row (flex row justify space-between):
			const highlightTitleRow = highlightSummary.createDiv({
				attr: {
					style: `
			display: flex;
			justify-content: space-between;
			align-items: flex-end;
			`,
				},
			});

			// 1b) Left side: title + description
			const hlTitleBlock = highlightTitleRow.createDiv({
				attr: { style: 'display: flex; flex-direction: column;' }
			});
			hlTitleBlock.createEl('h5', { text: 'File Highlights' });
			hlTitleBlock.createEl('div', {
				text: 'Toggle on/off the highlighting of Toolkit-specific files. Also make the highlights cool colors.',
				cls: 'setting-item-description',
				attr: { style: 'margin-top: 0.25em;' },
			});

			// 1c) Right side: collapsing arrow/icon
			const hlToggleIcon = highlightTitleRow.createEl('span', { text: 'VV', cls: 'vk-toggle-icon' });
			Object.assign(hlToggleIcon.style, {
				fontWeight: 'bold',
				display: 'inline-block',
				transition: 'transform 0.2s ease',
				transformOrigin: '50% 50%',
				userSelect: 'none',
				transform: highlightDetails.open ? 'rotate(0deg)' : 'rotate(180deg)',
			});

			// 1d) Make the icon rotate when the <details> opens/closes:
			highlightDetails.ontoggle = () => {
				hlToggleIcon.addClass("vv-rotated");
			};

			// 2) Create the body container (indented, same as backup)
			const highlightBody = highlightDetails.createDiv({ cls: 'vk-section-body' });
			highlightBody.addClass("vv-pl-md");

			// 3) “Enable Highlight” toggle as a Setting inside highlightBody:
			new Setting(highlightBody)
				.setName('Enable File Highlighting')
				.setDesc('Any file installed by VVunderlore will have this background.')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.highlightEnabled)
						.onChange(async (enabled) => {
							this.plugin.settings.highlightEnabled = enabled;
							await this.plugin.saveSettings();

							if (enabled) {
								this.plugin.enableHighlight();
							} else {
								this.plugin.disableHighlight();
							}

							// Re‐render the color pickers whenever the toggle changes:
							renderHighlightColorPickers();
						});
				});

			// 4) Wrapper for Light/Dark color pickers:
			const colorPickerWrapper = highlightBody.createDiv();

			// 5) A function to render or clear the two ColorPicker settings:
			const renderHighlightColorPickers = () => {
				colorPickerWrapper.empty();

				if (!this.plugin.settings.highlightEnabled) {
					return; // do not show pickers if highlighting is disabled
				}

				// 5a) Light mode color picker
				new Setting(colorPickerWrapper)
					.setName('Light Mode Highlight Color')
					.setDesc('Choose the background color for files/folders in Light mode.')
					.addColorPicker(picker => {
						picker
							.setValue(this.plugin.settings.highlightColorLight)
							.onChange(async (newColor) => {
								this.plugin.settings.highlightColorLight = newColor;
								await this.plugin.saveSettings();

								// Re‐inject CSS so the new color takes effect immediately:
								this.plugin.disableHighlight();
								this.plugin.enableHighlight();
							});
					});

				// 5b) Dark mode color picker
				new Setting(colorPickerWrapper)
					.setName('Dark Mode Highlight Color')
					.setDesc('Choose the background color for files/folders in Dark mode.')
					.addColorPicker(picker => {
						picker
							.setValue(this.plugin.settings.highlightColorDark)
							.onChange(async (newColor) => {
								this.plugin.settings.highlightColorDark = newColor;
								await this.plugin.saveSettings();

								// Re‐inject CSS so the new color takes effect immediately:
								this.plugin.disableHighlight();
								this.plugin.enableHighlight();
							});
					});
			};

			// 6) Call once on initial render so that if highlightEnabled === true, the pickers show up.
			renderHighlightColorPickers();


			// ─── INITIAL DRAW ───────────────────────────────────────────────────────
			renderSkipTable();
			renderRemapPanel();


			//REMOVE DEMO FILES
			// ─── REMOVE DEMO FILES (updated) ────────────────────────────────────────

			// 1) Create a Setting row, but immediately strip off its default top‐border:
			const removeDemoSetting = new Setting(containerEl);
			(removeDemoSetting.settingEl as HTMLElement).addClass("vv-no-border-top");

			removeDemoSetting
				.setName('Remove Demo Files')
				.setDesc('Delete every “optional” demo file and folder from your vault.')
				.addButton((button) =>
					button
						.setButtonText('Remove Demo Files')

						.onClick(async () => {
							const optionalFileEntries = this.plugin.manifestCache.files.filter((f) => f.optional);
							const optionalFolderEntries = this.plugin.manifestCache.folders.filter((f) => f.optional);

							const totalCountFiles = optionalFileEntries.length;
							const totalCountFolders = optionalFolderEntries.length;
							const totalCount = totalCountFiles + totalCountFolders;

							if (totalCount === 0) {
								new Notice('No “optional” demo files or folders to remove.');
								return;
							}

							// --- 2) Ask for confirmation in a small Modal ---
							const userConfirmed = await new Promise<boolean>((resolve) => {
								const confirmModal = new class extends Modal {
									constructor(app: App) {
										super(app);
									}
									onOpen() {
										this.contentEl.empty();
										this.contentEl.createEl('h2', { text: 'Confirm Removal' });
										this.contentEl.createEl('p', {
											text: `This will permanently delete ${totalCountFiles} file(s) and ${totalCountFolders} folder(s). Continue?`,
										});

										const btnRow = this.contentEl.createEl('div');
										Object.assign(btnRow.style, {
											display: 'flex',
											justifyContent: 'flex-end',
											gap: '0.5em',
											marginTop: '1.5em',
										});

										btnRow.createEl('button', { text: 'Cancel' }).onclick = () => {
											resolve(false);
											this.close();
										};

										btnRow.createEl('button', { text: 'Yes, Remove', cls: 'mod-danger' }).onclick = () => {
											resolve(true);
											this.close();
										};
									}
									onClose() {
										this.contentEl.empty();
									}
								}(this.app);

								confirmModal.open();
							});

							if (!userConfirmed) {
								return; // user clicked “Cancel”
							}

							// --- 3) Delete optional files one by one ---
							let filesDeleted = 0;
							for (const fileEntry of optionalFileEntries) {
								// 3a) Respect any remapping in customPaths
								const mapped = this.plugin.settings.customPaths.find((c) => c.manifestKey === fileEntry.key);
								const vaultPath = mapped?.vaultPath ?? fileEntry.path;

								// 3b) If it actually exists, remove it
								if (await this.app.vault.adapter.exists(vaultPath)) {
									try {
										await this.app.vault.adapter.remove(vaultPath);
										filesDeleted++;
									} catch (err) {
										console.error(`Failed to delete optional file ${vaultPath}`, err);
									}
								}
							}

							// --- 4) Delete optional folders recursively ---
							let foldersDeleted = 0;
							for (const folderEntry of optionalFolderEntries) {
								const mapped = this.plugin.settings.customPaths.find((c) => c.manifestKey === folderEntry.key);
								const vaultFolderPath = mapped?.vaultPath ?? folderEntry.path;

								if (await this.app.vault.adapter.exists(vaultFolderPath)) {
									try {
										// The second argument `true` ensures recursive delete
										await this.app.vault.adapter.rmdir(vaultFolderPath, true);
										foldersDeleted++;
									} catch (err) {
										console.error(`Failed to delete optional folder ${vaultFolderPath}`, err);
									}
								}
							}

							// --- 5) Clean up any “customPaths” entries for optional items ---
							this.plugin.settings.customPaths = this.plugin.settings.customPaths.filter((c) => {
								// If this mapping’s manifestKey was optional, drop it
								const isOptFile = optionalFileEntries.some((f) => f.key === c.manifestKey);
								const isOptFolder = optionalFolderEntries.some((f) => f.key === c.manifestKey);
								return !isOptFile && !isOptFolder;
							});
							await this.plugin.saveSettings();

							// --- 6) Show a notice and re-render the settings page ---
							new Notice(`Deleted ${filesDeleted} file(s) and ${foldersDeleted} folder(s).`);
							this.display();
						})
				);




			/** ─── FOOTER SECTION ─── */
			const footer = containerEl.createDiv({ cls: 'setting-item' });
			Object.assign(footer.style, {
				fontSize: '0.85em',
				color: 'var(--text-muted)',
				marginTop: '1em',
			});
			footer.createEl('span', {
				text: `VVunderlore Toolkit Plugin v${this.plugin.manifest.version} • `
			});
			footer.createEl('a', {
				text: 'View on GitHub',
				href: 'https://github.com/slamwise0001/vvunderlore-toolkit-plugin',
				attr: { target: '_blank' }
			});

			containerEl.scrollTop = savedScrollTop;
		})();
	}

	async updateVersionDisplay(): Promise<void> {
		if (!this.versionValueEl || !this.forceWarningEl) return;

		// read .version.json
		let installed = '';
		try {
			const ver = await this.plugin.app.vault.adapter.read('.version.json');
			installed = JSON.parse(ver).version ?? '';
		} catch { }
		const latest = (this.plugin.settings.latestToolkitVersion ?? '').trim();
		const isMatch = installed === latest;

		// update just the version span
		this.versionValueEl.textContent = installed || 'Not installed';
		this.versionValueEl.addClass(isMatch ? "vv-success" : "vv-error");

		// clear and re-render just the warning container
		this.forceWarningEl.empty();
		if (installed && latest && installed !== latest) {
			const warn = this.forceWarningEl.createDiv({
				text: `⚠️ New version available (${installed} → ${latest}) — use regular update instead`,
			});
			warn.addClass("vv-small", "vv-muted", "vv-italic");
			warn.setAttr('title', 'Force updating while a new version is available may skip important changes.');
		}
	}

}  
