import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';

export const SPELLBOOK_VIEW_TYPE = 'vvunderlore-spellbook-sidebar';

export class SpellbookView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return SPELLBOOK_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Spellbook';
  }

  getIcon(): string {
    return 'sparkles';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl;
    container.empty();

    // --- Filters (flex spaced) ---
    const filtersContainer = container.createDiv();
    filtersContainer.setAttr('style', 'display: flex; gap: 8px; margin-bottom: 12px;');

    // Level select
    const levelSelect = filtersContainer.createEl('select', { attr: { name: 'level', style: 'flex: 1;' } });
    levelSelect.createEl('option', { attr: { value: '' } }).setText('All Levels');

    // School select
    const schoolSelect = filtersContainer.createEl('select', { attr: { name: 'school', style: 'flex: 1;' } });
    schoolSelect.createEl('option', { attr: { value: '' } }).setText('All Schools');

    // Damage select
    const damageSelect = filtersContainer.createEl('select', { attr: { name: 'damage_type', style: 'flex: 1;' } });
    damageSelect.createEl('option', { attr: { value: '' } }).setText('All Damage');

    // Populate select options
    const files = this.app.vault.getMarkdownFiles().filter((f: TFile) => f.path.startsWith('Compendium/Spells'));
    const levels = new Set<number>();
    const schools = new Set<string>();
    const damages = new Set<string>();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter) {
        const fm = cache.frontmatter;
        if (fm.level != null) levels.add(Number(fm.level));
        if (fm.school) schools.add(String(fm.school));
        if (fm.damage_type) damages.add(String(fm.damage_type));
      }
    }

    Array.from(levels).sort((a, b) => a - b).forEach(lvl => {
      levelSelect.createEl('option', { attr: { value: lvl.toString() } }).setText(`Level ${lvl}`);
    });
    Array.from(schools).sort().forEach(sch => {
      schoolSelect.createEl('option', { attr: { value: sch } }).setText(sch);
    });
    Array.from(damages).sort().forEach(dt => {
      damageSelect.createEl('option', { attr: { value: dt } }).setText(dt);
    });

    // --- Go button (full-width) ---
        const btnContainer = container.createDiv();
    btnContainer.setAttr('style', 'display: flex; justify-content: center; margin-bottom: 12px;');
    const goBtn = btnContainer.createEl('button', { text: 'Go', cls: 'mod-cta' });
    goBtn.setAttr('style', 'flex: 1; ');
    goBtn.addEventListener('click', () => {
      this.renderTable(levelSelect.value, schoolSelect.value, damageSelect.value);
    });

    // Divider and table container
    container.createEl('hr');
    container.createEl('div', { attr: { id: 'spellbook-table' } });
  }

  async renderTable(level: string, school: string, damage: string): Promise<void> {
    const tableDiv = this.containerEl.find('#spellbook-table') as HTMLDivElement;
    if (!tableDiv) return;
    tableDiv.empty();

    const table = tableDiv.createEl('table');
    const headerRow = table.createEl('tr');
    ['Name', 'Level', 'School', 'Damage', 'Link'].forEach(h => headerRow.createEl('th').setText(h));

    const files = this.app.vault.getMarkdownFiles().filter((f: TFile) => f.path.startsWith('Compendium/Spells'));
    let matchCount = 0;

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;
      const fm = cache.frontmatter;

      if (level && String(fm.level) !== level) continue;
      if (school && String(fm.school) !== school) continue;
      if (damage && String(fm.damage_type) !== damage) continue;

      const row = table.createEl('tr');
      row.createEl('td').setText(String(fm.name || file.basename));
      row.createEl('td').setText(`Level ${fm.level}`);
      row.createEl('td').setText(String(fm.school));
      row.createEl('td').setText(String(fm.damage_type));
      const linkTd = row.createEl('td');
      const linkEl = linkTd.createEl('a', { attr: { href: '#', 'data-path': file.path } });
      linkEl.setText('Open');
      linkEl.addEventListener('click', evt => {
        evt.preventDefault();
        this.app.workspace.openLinkText(file.basename, '', false);
      });

      matchCount++;
    }

    if (matchCount === 0) {
      tableDiv.createEl('p').setText('No spells match your filter criteria.');
    }
  }

  async onClose(): Promise<void> {}
}
