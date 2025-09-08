import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  Notice,
  ButtonComponent,
  MarkdownView,
  Setting,
  TFolder,
  setIcon
} from 'obsidian';
import { SPELLBOOK_VIEW_TYPE } from './sb-spellbook';

export const SIDEBAR_VIEW_TYPE = 'vvunderlore-templates-sidebar';

const TEMPLATE_BUTTONS: { label: string; path: string }[] = [
  { label: 'New Adventure', path: 'Extras/Templates/newadventure_template.md' },
  { label: 'New PC', path: 'Extras/Templates/playercharacter_template.md' },
  { label: 'New NPC', path: 'Extras/Templates/npc_template.md' },
  { label: 'New Item', path: 'Extras/Templates/newitem_template.md' },
  { label: 'New Place', path: 'Extras/Templates/newplace_template.md' },
  { label: 'New Creature', path: 'Extras/Templates/newcreature_template.md' },
];

const SCHOOL_ABBR: Record<string, string> = {
  Abjuration: "Abj.",
  Conjuration: "Conj.",
  Divination: "Div.",
  Enchantment: "Ench.",
  Evocation: "Envo.",
  Illusion: "Illu.",
  Necromancy: "Nec.",
  Transmutation: "Trans."
};

const DAMAGE_ABBR: Record<string, string> = {
  acid: "Acid",
  cold: "Cold",
  fire: "Fire",
  force: "Force",
  lightning: "Ltng.",
  necrotic: "Necro",
  poison: "Pois.",
  psychic: "Psyc.",
  radiant: "Radi.",
  thunder: "Thun.",
  bludgeoning: "Bludg.",
  piercing: "Pierce",
  slashing: "Slash"
};

export class SidebarTemplatesView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() { return SIDEBAR_VIEW_TYPE; }
  getDisplayText() { return 'VVorldbuiling'; }
  getIcon() { return 'mapmaking'; }

  private spellSortKey: 'name' | 'level' | 'school' | 'damage' = 'name';
  private spellSortDir: 1 | -1 = 1;

  // ── Selected Spells (memory only; no persistence) ───────────────────
  private picks: string[] = [];
  private addBtnByPath = new Map<string, HTMLButtonElement>(); // table “Add” buttons by file path


  private buildDataviewForPicks(): string {
    const paths = this.picks.map(p => `"${p.replace(/"/g, '\\"')}"`).join(', ');
    return [
      '```dataview',
      'TABLE',
      '  level AS "Lvl",',
      '  school AS "School",',
      '  damage_type AS "Damage",',
      '  range AS "Range",',
      '  casting_time AS "Casting Time"',
      'WHERE contains([' + paths + '], file.path)',
      'SORT level ASC, name ASC',
      '```'
    ].join('\n');
  }

  private renderPicks(): void {
    const picksDiv = this.containerEl.find('#spellbook-picks') as HTMLDivElement;
    if (!picksDiv) return;
    picksDiv.empty();

    // Outer wrapper with black border
    const wrapper = picksDiv.createDiv();
    wrapper.setAttr('style', [
      'border:1.5px solid black',
      'border-radius:6px',
      'padding:8px',
      'margin-top:8px',
      'background:var(--background-secondary)'
    ].join(';'));

    const details = wrapper.createEl('details', { attr: { open: 'true' } });

    // Header without border now
    const summary = details.createEl('summary', { text: 'Selected Spells' });
    summary.setAttr('style', [
      'font-size:1.1em',
      'font-weight:600',
      'margin:0 0 4px',
      'cursor:pointer',
      'padding:4px 8px',
      'background:var(--background-secondary)',
      'border-radius:4px'
    ].join(';'));

    const body = details.createDiv();
    const grid = body.createDiv();
    grid.setAttr('style', [
      'display:grid',
      'grid-template-columns:1fr',
      'row-gap:2px',
      'margin:8px 0',
      'padding:0 16px' //sidepadding
    ].join(';'));

    if (!this.picks.length) {
      const empty = grid.createEl('div', { text: 'No spells selected yet.' });
      empty.setAttr('style', 'opacity:0.7;');
    } else {
      for (const path of this.picks) {
        const file = this.app.vault.getAbstractFileByPath(path);
        const row = grid.createDiv();
        row.setAttr('style', [
          'display:flex',
          'align-items:center',
          'justify-content:space-between',
          'gap:8px',
          'padding:2px 0'
        ].join(';'));

        const nameLink = row.createEl('a', {
          text: (() => {
            if (file instanceof TFile) {
              const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
              return fm?.name || file.basename;
            }
            const base = path.split('/').pop() || path;
            return base.replace(/\.md$/, '');
          })(),
          href: '#'
        });
        nameLink.setAttr('style', 'font-weight:600; text-decoration:none; color:var(--text-accent);');
        nameLink.addEventListener('click', e => {
          e.preventDefault();
          this.app.workspace.openLinkText(path, '', false);
        });

        // Small "×" remove icon
        const rmBtn = row.createEl('span', { text: '×' });
        rmBtn.setAttr('style', 'cursor:pointer; font-size:1.2em; line-height:1;');
        rmBtn.addEventListener('click', async e => {
          e.preventDefault();
          this.picks = this.picks.filter(p => p !== path);
          const btn = this.addBtnByPath.get(path);
          if (btn) {
            btn.disabled = false;
            btn.textContent = '＋';
          }
          this.renderPicks();
        });
      }
    }

    const actions = body.createDiv();
    actions.setAttr(
      'style',
      'display:flex;gap:8px;justify-content:flex-end;margin-top:4px;'
    );

    // CLEAR (secondary)
    const clearBtn = actions.createEl('button', { text: 'Clear' });
    // keep it visually “secondary”
    clearBtn.setAttr('style', 'opacity:0.9;');
    clearBtn.addEventListener('click', e => {
      e.preventDefault();
      // empty picks
      this.picks = [];
      // re‑enable all + buttons we tracked
      this.addBtnByPath.forEach((btn) => {
        if (!btn.isConnected) return;      // in case table re-rendered
        btn.disabled = false;
        btn.textContent = '＋';
      });
      this.renderPicks();
    });

    // COPY (primary)
    const copyBtn = actions.createEl('button', { text: 'Copy Spellbook' });
    copyBtn.classList.add('mod-cta');
    // disable when nothing selected
    copyBtn.toggleAttribute('disabled', this.picks.length === 0);

    copyBtn.addEventListener('click', async e => {
      e.preventDefault();
      if (!this.picks.length) return;

      const md = this.buildDataviewForPicks();
      try {
        await navigator.clipboard.writeText(md);
        new Notice('📋 Dataview table copied to clipboard.');
      } catch {
        const ta = body.createEl('textarea', { text: md });
        ta.setAttr('style', 'width:100%;height:220px;margin-top:8px;');
        ta.select();
        new Notice('Clipboard blocked. Dataview shown below—copy manually.');
      }
    });
  }


  async onOpen() {
    this.contentEl.empty();

    this.picks = [];
    this.addBtnByPath.clear();

    // heading
    this.contentEl.createEl('h4', { text: 'TEMPLATES' });

    // template buttons
    const btnContainer = this.contentEl.createDiv();
    btnContainer.addClass("sb-btn");
    for (const { label, path } of TEMPLATE_BUTTONS) {
      const btn = new ButtonComponent(btnContainer)
        .setButtonText(label)
        .onClick(() => this.runTemplate(path));
      btn.buttonEl.style.flex = '1';
      btn.buttonEl.style.minWidth = '120px';
    }
    this.contentEl.createEl('hr', { attr: { style: 'margin: 12px 0;' } });

    //  ADVENTURE LINKS 
    const advDetails = this.contentEl.createEl('details', { attr: { open: 'true' } });
    const advSummary = advDetails.createEl('summary', { text: 'ADVENTURES' });
    advSummary.setAttr('style', 'font-size: 1.3em; font-weight: 600; margin: 0.5em 0;');
    const advContainer = advDetails.createDiv({ attr: { style: 'margin:8px 0;' } });

    new Setting(advContainer)
      .setName('Filter by Adventure:')
      .addDropdown(drop => {
        const names = Array.from(new Set(
          this.app.vault.getFiles()
            .filter(f => f.path.startsWith('Adventures/'))
            .map(f => f.path.split('/')[1])
        ));
        drop.addOption('', '— pick one —');
        names.forEach(n => drop.addOption(n, n));

        drop.onChange(async adv => {
          advContainer.findAll('.vvunderlore-adventure-assets').forEach(el => el.remove());
          const wrapper = advContainer.createDiv({ cls: 'vvunderlore-adventure-assets' });
          if (!adv) return;

          const quick = wrapper.createDiv();
          quick.setAttr('style', 'display:flex;justify-content:center;gap:20px;flex-wrap:wrap;margin:6px 0 10px;');

          const hubExactPath = `Adventures/${adv}/${adv} - Adventure Hub.md`;
          let hubFile: TFile | null = null;

          const exact = this.app.vault.getAbstractFileByPath(hubExactPath);
          if (exact instanceof TFile) {
            hubFile = exact;
          } else {
            hubFile = (this.app.vault.getFiles().find(f =>
              f.path.startsWith(`Adventures/${adv}/`) &&
              f.parent?.path === `Adventures/${adv}` &&
              f.basename.toLowerCase().includes('adventure hub')
            ) ?? null);
          }

          if (hubFile) {
            const hubLink = quick.createEl('a', { text: 'Adventure Hub', href: '#' });
            hubLink.addClass('sb-adv-nav');
            hubLink.addEventListener('click', e => {
              e.preventDefault();
              this.app.workspace.openLinkText(hubFile!.path, '', false);
            });
          }

          const sessionDir = `Adventures/${adv}/Session Notes/`;
          const sessionFiles = this.app.vault.getFiles().filter(f => f.path.startsWith(sessionDir));
          if (sessionFiles.length) {
            sessionFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
            const latest = sessionFiles[0];
            const sessionLink = quick.createEl('a', { text: 'Most Recent Session', href: '#' });
            sessionLink.addClass('sb-adv-nav');
            sessionLink.addEventListener('click', e => {
              e.preventDefault();
              this.app.workspace.openLinkText(latest.path, '', false);
            });
          }

          const list = wrapper.createDiv();
          await this.showAdventureAssets(adv, list);
        });
      });

    this.contentEl.createEl('hr');

    // ─── SPELLBOOK ─────────────────────────────────────────────────────
    await this.showSpellbookSection();
  }

  async onClose() {
    this.picks = [];
    this.addBtnByPath.clear();
    this.contentEl.empty();
  }

  private async runTemplate(path: string) {
    const tpl = this.app.vault.getAbstractFileByPath(path);
    if (!(tpl instanceof TFile)) {
      new Notice(`⚠️ Template not found: ${path}`);
      return;
    }

    const tpObs = this.app.plugins.getPlugin('templater-obsidian') as any;
    const tpAlt = this.app.plugins.getPlugin('templater') as any;
    const templater = tpObs || tpAlt;
    if (!templater) {
      new Notice('⚠️ Could not find Templater – is it enabled?');
      return;
    }

    const tpObj = templater.templater?.current_functions_object;
    if (!tpObj) {
      new Notice('⚠️ Templater API not ready—add a startup template and restart.');
      return;
    }

    const rawSel = window.getSelection()?.toString().trim() || '';

    if (rawSel) {
      // capture the editor + exact selection up front (but don't mutate yet)
      const srcView = this.app.workspace.getActiveViewOfType(MarkdownView);
      const selectedText =
        srcView?.editor.getSelection()?.trim() || rawSel;

      // sanitize a filename from the selection
      const base = selectedText.replace(/[\/:*?"<>|]/g, '').slice(0, 100);

      // figure out destination as you had before
      const TEMPLATE_DEST: Record<string, string> = {
        'newadventure_template.md': 'Adventures',
        'playercharacter_template.md': 'World/People/Player Characters/Active',
        'npc_template.md': 'World/People/Non-Player Characters',
        'newitem_template.md': 'Extras/Items',
        'newplace_template.md': 'World/Places',
        'newcreature_template.md': 'Bestiary',
      };
      const destPath = TEMPLATE_DEST[tpl['name']] || (tpl as TFile).parent!.path;

      // ensure folder exists (same as before)
      let destFolderRaw = this.app.vault.getAbstractFileByPath(destPath);
      if (!(destFolderRaw instanceof TFolder)) {
        try { await this.app.vault.createFolder(destPath); } catch { }
        destFolderRaw = this.app.vault.getAbstractFileByPath(destPath);
      }
      if (!(destFolderRaw instanceof TFolder)) {
        new Notice(`⚠️ Could not create folder: ${destPath}`);
        return;
      }
      const destFolder = destFolderRaw as TFolder;

      // run the template to create the new note
      let newFile: TFile;
      try {
        newFile = await tpObj.file.create_new(
          tpl,
          base,
          true,
          destFolder
        );
      } catch (e) {
        console.error('Templater.create_new failed', e);
        new Notice('❌ Could not instantiate template.');
        return;
      }

      // (optional) your stray merge logic here…

      // Check if the template was canceled and deleted the file.
      const stillExists = this.app.vault.getAbstractFileByPath(newFile.path) instanceof TFile;

      // Only now, after success, turn the original selection into a link.
      if (stillExists && srcView && selectedText) {
        const ed = srcView.editor;
        const current = ed.getValue();
        const link = `[[${base}]]`;

        // Prefer replacing the exact first occurrence of the captured text
        if (current.includes(selectedText)) {
          const updated = current.replace(selectedText, link);
          await this.app.vault.modify(srcView.file!, updated);
        } else {
          // Fallback: if selection is still active, replace it
          ed.replaceSelection(link);
        }
      }

      // open the new file (only if it actually exists)
      if (stillExists) {
        this.app.workspace.getLeaf(true).openFile(newFile);
      }

    } else {
      let wrapperFile: TFile;
      try {
        wrapperFile = await tpObj.file.create_new(
          tpl,
          undefined,
          false
        );
      } catch (e) {
        console.error('Error invoking Templater:', e);
        new Notice('❌ Failed to run template; check console.');
        return;
      }

      try {
        await this.app.vault.delete(wrapperFile);
      } catch (e) {
        console.warn('Could not delete wrapper file:', e);
      }
    }
  }

  //-------+++++++++++ ADVENTURE FILTER

  private async showAdventureAssets(adventureName: string, renderInto: HTMLElement) {
    const prefix = `Adventures/${adventureName}/`;
    const files = this.app.vault
      .getFiles()
      .filter(f => f.path.startsWith(prefix));

    const linkedPaths = new Set<string>();
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      (cache?.links || []).forEach(link => {
        const dest = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (dest) linkedPaths.add(dest.path);
      });
    }

    renderInto.empty();
    if (linkedPaths.size === 0) {
      renderInto.createEl('div', { text: 'No linked pages found.' });
      return;
    }

    const overrides: [RegExp, string][] = [
      [/Non-Player Characters\//, 'NPCs'],
      [/Player Characters\//, 'Player Characters'],
      [/Factions\//, 'Factions'],
      [/Compendium\/Bestiary\//, 'Monsters'],
      [/Compendium\/Items\//, 'Items'],
      [/Compendium\/Spells\//, 'Spells'],
      [/World\/History\//, 'History'],
      [/World\/Events\//, 'Events'],
      [/Deities\//, 'Deities'],
      [/World\/Places\//, 'Places'],
    ];

    const groups: Record<string, string[]> = {};
    for (const fullPath of linkedPaths) {
      let section = 'Other';
      for (const [pattern, name] of overrides) {
        if (pattern.test(fullPath)) { section = name; break; }
      }
      (groups[section] ||= []).push(fullPath);
    }

    for (const section of Object.keys(groups).sort()) {
      const details = renderInto.createEl('details', { attr: { open: 'true' } });
      const summary = details.createEl('summary', { text: section });
      summary.addClass("sb-summary");

      const grid = details.createDiv();
      grid.addClass("sb-adv-grid");

      groups[section]
        .sort((a, b) => {
          const aName = a.split('/').pop()!.replace(/\.md$/, '').toLowerCase();
          const bName = b.split('/').pop()!.replace(/\.md$/, '').toLowerCase();
          return aName.localeCompare(bName);
        })
        .forEach(path => {
          const name = path.split('/').pop()!.replace(/\.md$/, '');
          const linkEl = grid.createEl('a', { text: name, href: '#' });
          linkEl.addClass("sb-adv-links");
          linkEl.addEventListener('click', () => {
            this.app.workspace.openLinkText(path, '', false);
          });
        });
    }
  }

  //---------_++++++++++ SPELLBOOK
  private async showSpellbookSection(): Promise<void> {
    const sbDetails = this.contentEl.createEl('details');
    sbDetails.createEl('summary', { text: 'SPELLBOOK' })
      .setAttr('style', 'font-size:1.3em;font-weight:600;margin:0.5em 0;');
    const container = sbDetails.createDiv({
      attr: { style: 'display:flex;flex-direction:column;gap:8px;margin:8px 0;' }
    });

    // 1) Build Sets
    const spellFiles = this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith('Compendium/Spells'));
    const levels = new Set<number>();
    const schools = new Set<string>();
    const damages = new Set<string>();
    for (const f of spellFiles) {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (!fm) continue;
      if (typeof fm.level === 'number') levels.add(fm.level);
      if (typeof fm.school === 'string') schools.add(fm.school);
      if (typeof fm.damage_type === 'string') damages.add(fm.damage_type);
    }

    // 2) Checkbox dropdowns
    const filters = container.createDiv({
      attr: { style: 'display:flex; gap:16px; margin-bottom:12px;' }
    });

    type Item = { value: string; label: string };

    const makeCheckboxDropdown = (
      title: string,
      items: Item[]
    ): { wrapper: HTMLDetailsElement; getSelected: () => string[] } => {
      // wrapper
      const wrapper = filters.createEl('details') as HTMLDetailsElement;
      wrapper.classList.add('sb-dd'); // style hook

      // select‑like “button”
      const summary = wrapper.createEl('summary') as HTMLElement;
      summary.classList.add('sb-dd__button');
      summary.setText(`${title} (0)`);

      // dropdown panel
      const panel = wrapper.createEl('div');
      panel.classList.add('sb-dd__panel');
      panel.addEventListener('click', (evt: MouseEvent) => evt.stopPropagation());

      // checkbox list
      const inputs: HTMLInputElement[] = [];
      for (const { value, label } of items) {
        const row = panel.createEl('label');
        row.classList.add('sb-dd__item');

        const cb = row.createEl('input', { attr: { type: 'checkbox', value } }) as HTMLInputElement;
        inputs.push(cb);

        row.createEl('span', { text: label });

        cb.addEventListener('change', () => {
          const count = inputs.filter(i => i.checked).length;
          summary.setText(`${title} (${count})`);
        });
      }

      return {
        wrapper,
        getSelected: () => inputs.filter(i => i.checked).map(i => i.value),
      };
    };


    const levelItems = Array.from(levels).sort((a, b) => a - b).map(lvl => ({ value: `${lvl}`, label: lvl === 0 ? 'Cantrip' : `Level ${lvl}` }));
    const schoolItems = Array.from(schools).sort().map(sch => ({ value: sch, label: sch }));
    const damageItems = Array.from(damages).sort().map(dmg => ({ value: dmg, label: dmg }));

    const { wrapper: lvlDD, getSelected: getLevels } = makeCheckboxDropdown('Levels', levelItems);
    const { wrapper: schoolDD, getSelected: getSchools } = makeCheckboxDropdown('Schools', schoolItems);
    const { wrapper: dmgDD, getSelected: getDamages } = makeCheckboxDropdown('Damage', damageItems);

    document.addEventListener('click', evt => {
      for (const dd of [lvlDD, schoolDD, dmgDD]) {
        if (dd.open && !dd.contains(evt.target as Node)) dd.open = false;
      }
    });

    // 3) Go / Clear
    const btnWrap = container.createDiv({
      attr: { style: 'display:flex; justify-content:center; margin-bottom:8px;' }
    });

    const goBtn = btnWrap.createEl('button', { text: 'Go', cls: 'mod-cta' });
    goBtn.setAttr('style', 'flex:1;');
    goBtn.addEventListener('click', () => {
      this.renderTable(getLevels(), getSchools(), getDamages());
    });

    const clearBtn = btnWrap.createEl('button', { text: 'Clear Filters and Reset' });
    clearBtn.setAttr('style', 'flex:1; margin-left:8px;');
    clearBtn.addEventListener('click', () => {
      ([
        [lvlDD, 'Levels'],
        [schoolDD, 'Schools'],
        [dmgDD, 'Damage'],
      ] as const).forEach(([dd, title]) => {
        dd.querySelectorAll('input[type=checkbox]').forEach(cb => (cb as HTMLInputElement).checked = false);
        dd.querySelector('summary')?.setText(`${title} (0)`);
        dd.open = false;
      });
      const tableDiv = container.find('#spellbook-table') as HTMLDivElement;
      if (tableDiv) tableDiv.empty();
    });

    // Picks area + table
    container.createEl('div', { attr: { id: 'spellbook-picks' } });
    container.createEl('div', { attr: { id: 'spellbook-table' } });

    this.renderPicks();
  }

  private renderTable(
    selectedLevels: string[],
    selectedSchools: string[],
    selectedDamages: string[]
  ): void {
    const tableDiv = this.containerEl.find('#spellbook-table') as HTMLDivElement;
    if (!tableDiv) return;
    tableDiv.replaceChildren();
    this.addBtnByPath.clear();


    const allSpells = this.app.vault
      .getMarkdownFiles()
      .filter(f => f.path.startsWith('Compendium/Spells'));

    const filtered = allSpells.filter(f => {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (!fm) return false;

      const lvl = String(fm.level);
      const sch = String(fm.school);
      const dmgRaw = typeof fm.damage_type === 'string' ? fm.damage_type : '';

      return (
        (!selectedLevels.length || selectedLevels.includes(lvl)) &&
        (!selectedSchools.length || selectedSchools.includes(sch)) &&
        (!selectedDamages.length || selectedDamages.includes(dmgRaw))
      );
    });

    filtered.sort((a, b) => {
      const fa = this.app.metadataCache.getFileCache(a)!.frontmatter!;
      const fb = this.app.metadataCache.getFileCache(b)!.frontmatter!;

      let va: any, vb: any;
      switch (this.spellSortKey) {
        case 'level': va = fa.level ?? 0; break;
        case 'school': va = String(fa.school ?? '').toLowerCase(); break;
        case 'damage': va = String(fa.damage_type ?? '').toLowerCase(); break;
        default: va = String(fa.name ?? a.basename).toLowerCase();
      }
      switch (this.spellSortKey) {
        case 'level': vb = fb.level ?? 0; break;
        case 'school': vb = String(fb.school ?? '').toLowerCase(); break;
        case 'damage': vb = String(fb.damage_type ?? '').toLowerCase(); break;
        default: vb = String(fb.name ?? b.basename).toLowerCase();
      }

      if (va < vb) return -1 * this.spellSortDir;
      if (va > vb) return 1 * this.spellSortDir;
      return 0;
    });

    const table = tableDiv.createEl('table');
    table.setAttr('style', 'width:100%;border-collapse:collapse;');

    const headerRow = table.createEl('tr');
    headerRow.setAttr('style', 'display:flex;');

    const actTh = headerRow.createEl('th');
    actTh.setAttr('style', [
      'flex:0 0 56px',
      'padding:4px',
      'text-align:left'
    ].join(';'));

    const columns: { label: string; key: 'name' | 'level' | 'school' | 'damage'; flex: number }[] = [
      { label: 'Name', key: 'name', flex: 2 },
      { label: 'Lvl', key: 'level', flex: 1 },
      { label: 'School', key: 'school', flex: 1 },
      { label: 'Dmg Type', key: 'damage', flex: 1 },
    ];

    for (const { label, key, flex } of columns) {
      const th = headerRow.createEl('th');
      th.setText(label);
      th.setAttr(
        'style',
        [
          `flex:${flex}`,
          'padding:4px',
          key === 'name' ? 'text-align:left' : 'text-align:center',
          'cursor:pointer',
        ].join(';')
      );

      th.addEventListener('click', () => {
        if (this.spellSortKey === key) {
          this.spellSortDir = this.spellSortDir === 1 ? -1 : 1;
        } else {
          this.spellSortKey = key;
          this.spellSortDir = 1;
        }
        this.renderTable(selectedLevels, selectedSchools, selectedDamages);
      });
    }

    let found = 0;
    for (const f of filtered) {
      const fm = this.app.metadataCache.getFileCache(f)!.frontmatter!;
      const lvl = String(fm.level);
      const sch = String(fm.school);
      const dmgRaw = typeof fm.damage_type === 'string' ? fm.damage_type : '';

      const row = table.createEl('tr');
      row.setAttr('style', 'display:flex;');

      const actTd = row.createEl('td');
      actTd.setAttr(
        'style',
        'flex:0 0 28px; padding:0; display:flex; align-items:center; justify-content:center;'
      );

      // create + button
      const addBtn = actTd.createEl('button', { text: '＋' });
      addBtn.addClass('sb-spelladd-btn');

      // ① remember this button for this spell path
      this.addBtnByPath.set(f.path, addBtn);

      // ② if already selected, show ✓ and disable
      if (this.picks.includes(f.path)) {
        addBtn.textContent = '✓';
        addBtn.disabled = true;
      }

      // ③ click -> add to picks, flip to ✓, disable, and re-render picks
      addBtn.addEventListener('click', e => {
        e.preventDefault();
        if (this.picks.includes(f.path)) {
          new Notice('Already in Selected Spells.');
          return;
        }
        this.picks.push(f.path);
        addBtn.textContent = '✓';
        addBtn.disabled = true;
        this.renderPicks();   // this will also show the item in the Selected Spells box
      });


      const nameTd = row.createEl('td');
      nameTd.setAttr('style', 'flex:2;padding:4px;');
      const link = nameTd.createEl('a', { attr: { href: '#' } });
      link.setText(fm.name || f.basename);
      link.addEventListener('click', e => {
        e.preventDefault();
        this.app.workspace.openLinkText(f.basename, '', false);
      });

      // Level
      const lvlTd = row.createEl('td');
      lvlTd.setAttr('style', 'flex:1; display:flex; align-items:center; justify-content:center; padding:4px;');
      lvlTd.createSpan({ text: lvl === '0' ? 'Cantrip' : lvl });

      // School
      const schTd = row.createEl('td');
      schTd.setAttr('style', 'flex:1; display:flex; align-items:center; justify-content:center; padding:4px;');
      schTd.createSpan({ text: SCHOOL_ABBR[sch] ?? sch.slice(0, 3) });

      // Damage
      const dmgTd = row.createEl('td');
      dmgTd.setAttr('style', 'flex:1; display:flex; align-items:center; justify-content:center; padding:4px;');
      dmgTd.createSpan({ text: dmgRaw ? (DAMAGE_ABBR[dmgRaw] ?? dmgRaw.slice(0, 3)) : '—' });


      found++;
    }

    if (!found) {
      tableDiv.createEl('p').setText('No spells match your filter criteria.');
    }
  }
}
