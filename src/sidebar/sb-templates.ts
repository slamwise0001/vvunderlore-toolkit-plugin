import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  Notice,
  ButtonComponent,
  MarkdownView,
  Setting,
  TFolder
} from 'obsidian';
import { SPELLBOOK_VIEW_TYPE } from './sb-spellbook';

export const SIDEBAR_VIEW_TYPE = 'vvunderlore-templates-sidebar';

const TEMPLATE_BUTTONS: { label: string; path: string }[] = [
  { label: 'New Adventure',        path: 'Extras/Templates/newadventure_template.md' },
  { label: 'New PC',                path: 'Extras/Templates/playercharacter_template.md' },
  { label: 'New NPC',              path: 'Extras/Templates/npc_template.md' },
  { label: 'New Item',             path: 'Extras/Templates/newitem_template.md' },
  { label: 'New Place',            path: 'Extras/Templates/newplace_template.md' },
  { label: 'New Creature', path: 'Extras/Templates/newcreature_template.md' },
];

const SCHOOL_ABBR: Record<string,string> = {
  Abjuration:     "Abj.",
  Conjuration:    "Conj.",
  Divination:     "Div.",
  Enchantment:    "Ench.",
  Evocation:      "Envo.",
  Illusion:       "Illu.",
  Necromancy:     "Nec.",
  Transmutation:  "Trans."
};

const DAMAGE_ABBR: Record<string,string> = {
  acid:       "Acid",
  cold:       "Cold",
  fire:       "Fire",
  force:      "Force",
  lightning:  "Ltng.",
  necrotic:   "Necro",
  poison:     "Pois.",
  psychic:    "Psyc.",
  radiant:    "Radi.",
  thunder:    "Thun.",
  bludgeoning: "Bludg.",
  piercing:   "Pierce",
  slashing:   "Slash"
};

export class SidebarTemplatesView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() { return SIDEBAR_VIEW_TYPE; }
  getDisplayText() { return 'Adventure Materials'; }
  getIcon() { return 'scroll-text'; }


async onOpen() {
  this.contentEl.empty();

// TEMPLATES//

    // heading
    this.contentEl.createEl('h5', { text: 'NOTE TEMPLATES' });
    // buttons
    const btnContainer = this.contentEl.createDiv();
    btnContainer.style.display = 'flex';
    btnContainer.style.flexWrap = 'wrap';
    btnContainer.style.gap = '8px';

    for (const { label, path } of TEMPLATE_BUTTONS) {
    // create each button in the flex container
    const btn = new ButtonComponent(btnContainer)
      .setButtonText(label)
      .onClick(() => this.runTemplate(path));
    // make buttons grow evenly
    btn.buttonEl.style.flex = '1';
    btn.buttonEl.style.minWidth = '120px'; // ensure a minimum width
  }
  this.contentEl.createEl('hr', { attr: { style: 'margin: 12px 0;' } });


  // ─── ADVENTURE LINKS ───────────────────────────────────────────────
  const advDetails  = this.contentEl.createEl('details', { attr: { open: 'true' } });
  const advSummary  = advDetails.createEl('summary', { text: 'ADVENTURE LINKS' });
  advSummary.setAttr('style', 'font-size: 1.1em; font-weight: 600; margin: 0.5em 0;');
  const advContainer = advDetails.createDiv({
    attr: { style: 'margin:8px 0;' },
  });
  // dropdown lives in advContainer
  new Setting(advContainer)
    .setName('Filter by Adventure')
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
        const related = advContainer.createDiv({ cls: 'vvunderlore-adventure-assets' });
        if (adv) await this.showAdventureAssets(adv, related);
      });
    });

  this.contentEl.createEl('hr');

  // ─── SPELLBOOK ─────────────────────────────────────────────────────
  await this.showSpellbookSection();
}



  
  async onClose() {
    // clear it again
    this.contentEl.empty();
  }

    private async runTemplate(path: string) {
  // 1️⃣ Ensure template exists
  const tpl = this.app.vault.getAbstractFileByPath(path);
  if (!(tpl instanceof TFile)) {
    new Notice(`⚠️ Template not found: ${path}`);
    return;
  }

  // 2️⃣ Grab Templater’s internal API
  const tpObs = this.app.plugins.getPlugin('templater-obsidian') as any;
  const tpAlt = this.app.plugins.getPlugin('templater')          as any;
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

  // 3️⃣ Check if there's highlighted text
  const rawSel = window.getSelection()?.toString().trim() || '';

  if (rawSel) {
    // Compute a safe base filename
    const base = rawSel.replace(/[\/:*?"<>|]/g, '').slice(0, 100);

    // ─── Wrap the highlighted text in [[…]] in the original note ────────
    const mdLeaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of mdLeaves) {
      const view = leaf.view as MarkdownView;
      const file = view.file;
      if (!(file instanceof TFile)) continue;
      const content = view.editor.getValue();
      if (content.includes(rawSel)) {
        const updated = content.replace(rawSel, `[[${base}]]`);
        await this.app.vault.modify(file, updated);
        break;
      }
    }

    // ─── Highlight-driven flow ─────────────────────────────────────────
    // Map each template to its real folder
    const TEMPLATE_DEST: Record<string,string> = {
      'newadventure_template.md':    'Adventures',
      'playercharacter_template.md': 'World/People/Player Characters/Active',
      'npc_template.md':             'World/People/Non-Player Characters',
      'newitem_template.md':         'Extras/Items',
      'newplace_template.md':        'World/Places',
      'newcreature_template.md':     'Bestiary',
    };
    const destPath = TEMPLATE_DEST[tpl.name] || tpl.parent!.path;

    // Create folder if missing
    let destFolderRaw = this.app.vault.getAbstractFileByPath(destPath);
    if (!(destFolderRaw instanceof TFolder)) {
      try { await this.app.vault.createFolder(destPath); } catch {}
      destFolderRaw = this.app.vault.getAbstractFileByPath(destPath);
    }
    if (!(destFolderRaw instanceof TFolder)) {
      new Notice(`⚠️ Could not create folder: ${destPath}`);
      return;
    }
    const destFolder = destFolderRaw as TFolder;

    // Create & open the templated note
    let newFile: TFile;
    try {
      newFile = await tpObj.file.create_new(
        tpl,
        base,      // filename base (no .md)
        true,      // open immediately (runs ModalForms)
        destFolder // destination folder
      );
    } catch (e) {
      console.error('Templater.create_new failed', e);
      new Notice('❌ Could not instantiate template.');
      return;
    }

    // Merge stray file (folder-named) if it exists
    const parentPath = destFolder.parent?.path;
    if (parentPath) {
      const strayPath = `${parentPath}/${destFolder.name}.md`;
      const stray = this.app.vault.getAbstractFileByPath(strayPath);
      if (stray instanceof TFile) {
        try {
          const contents = await this.app.vault.read(stray);
          await this.app.vault.modify(newFile, contents);
          await this.app.vault.delete(stray);
        } catch (err) {
          console.warn('Error merging stray file:', err);
        }
      }
    }

    // Focus the final file
    this.app.workspace.getLeaf(true).openFile(newFile);

  } else {
    // ─── No-selection: default Templater behavior ────────────────────────
    let wrapperFile: TFile;
    try {
      // create stub without opening it
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

    // Templater will open the real note and run ModalForms
    // Delete the wrapper stub
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

    // 1) Gather every link destination
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

    // 2) Your override rules: [pattern, headerName]
    const overrides: [RegExp, string][] = [
      [/Non-Player Characters\//, 'NPCs'],
      [/Player Characters\//,     'Player Characters'],
      [/Factions\//,                              'Factions'],
      [/Compendium\/Bestiary\//,                  'Monsters'],
      [/Compendium\/Items\//,     'Items'],
      [/Compendium\/Spells\//,    'Spells'],
      [/World\/History\//,                        'History'],
      [/World\/Events\//,                         'Events'],
      [/Deities\//,                        'Deities'],
      [/World\/Places\//,                         'Places'],
      // add more rules here...
    ];

    // 3) Group strictly into your headers, or "Other"
    const groups: Record<string, string[]> = {};
    for (const fullPath of linkedPaths) {
      let section = 'Other';
      for (const [pattern, name] of overrides) {
        if (pattern.test(fullPath)) {
          section = name;
          break;
        }
      }
      (groups[section] ||= []).push(fullPath);
    }

     for (const section of Object.keys(groups).sort()) {
      // <details> wrapper
      const details = renderInto.createEl('details', { attr: { open: 'true' } });
      const summary = details.createEl('summary', { text: section });
      // —— inline styles to bump up the font and spacing ——
      summary.addClass("sb-summary");

      // link grid inside <details>
      const grid = details.createDiv();
      grid.addClass("sb-adv-grid");

      // sort and render links
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
  }}

  //---------_++++++++++ SPELLBOOK
  private async showSpellbookSection(): Promise<void> {
    // ─── COLLAPSIBLE SPELLBOOK ─────────────────────────────────────────
    const sbDetails = this.contentEl.createEl('details');
    sbDetails.createEl('summary', { text: 'SPELLBOOK' })
      .setAttr('style','font-size:1.1em;font-weight:600;margin:0.5em 0;');
    const container = sbDetails.createDiv({
      attr: { style: 'display:flex;flex-direction:column;gap:8px;margin:8px 0;' }
    });

    // ─── 1️⃣ Build your Sets ────────────────────────────────────────────
    const spellFiles = this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith('Compendium/Spells'));
    const levels  = new Set<number>();
    const schools = new Set<string>(); 
    const damages = new Set<string>();
    for (const f of spellFiles) {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (!fm) continue;
      if (typeof fm.level === 'number')        levels.add(fm.level);
      if (typeof fm.school === 'string')       schools.add(fm.school);
      if (typeof fm.damage_type === 'string')  damages.add(fm.damage_type);
    }

    // ─── 2️⃣ Popover‐style checkbox dropdowns ──────────────────────────
    const filters = container.createDiv({
      attr: { style: 'display:flex; gap:16px; margin-bottom:12px;' }
    });

    type Item = { value: string; label: string };
    function makeCheckboxDropdown(
      title: string,
      items: Item[]
    ): { wrapper: HTMLDetailsElement; getSelected: () => string[] } {
      // wrapper flex styles
      const wrapper = filters.createEl('details') as HTMLDetailsElement;
      wrapper.setAttr('style', [
        'position:relative',
        'flex:1',
        'min-width:0'
      ].join(';'));

      // summary
      const summary = wrapper.createEl('summary', { text: `${title} (0)` });
      summary.setAttr('style', [
        'display:flex','align-items:center','flex:1',
        'cursor:pointer','padding:6px 12px',
        'border:1px solid var(--interactive-normal)',
        'border-radius:4px',
        'background:var(--background-secondary)',
        'user-select:none','white-space:nowrap',
        'overflow:hidden','text-overflow:ellipsis',
        'margin-bottom:4px'
      ].join(';'));

      // panel (must keep this)
      const panel = wrapper.createEl('div');
      panel.setAttr('style', [
        'position:absolute','top:100%','left:0',
        'background:var(--background-primary)',
        'border:1px solid var(--interactive-normal)',
        'border-radius:4px','padding:8px',
        'max-height:200px','overflow:auto',
        'z-index:10','min-width:120px'
      ].join(';'));
      panel.addEventListener('click', (evt: MouseEvent) => {
        evt.stopPropagation();
      });

      const inputs: HTMLInputElement[] = [];
      for (const {value,label} of items) {
        const lbl = panel.createEl('label', { text: label });
        lbl.setAttr('style','display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer;');
        const cb = lbl.createEl('input', { attr:{ type:'checkbox', value } }) as HTMLInputElement;
        inputs.push(cb);
        cb.addEventListener('change', () => {
          const count = inputs.filter(c => c.checked).length;
          summary.setText(`${title} (${count})`);
        });
      }

      return {
        wrapper,
        getSelected: () => inputs.filter(c => c.checked).map(c => c.value),
      };
   }

    // prepare items
    const levelItems  = Array.from(levels).sort((a,b)=>a-b).map(lvl => ({ value:`${lvl}`, label:`Level ${lvl}` }));
    const schoolItems = Array.from(schools).sort().map(sch => ({ value:sch, label:sch }));
    const damageItems = Array.from(damages).sort().map(dmg => ({ value:dmg, label:dmg }));

    // create dropdowns and grab their APIs
    const { wrapper: lvlDD,    getSelected: getLevels   } = makeCheckboxDropdown('Levels',  levelItems);
    const { wrapper: schoolDD, getSelected: getSchools  } = makeCheckboxDropdown('Schools', schoolItems);
    const { wrapper: dmgDD,    getSelected: getDamages  } = makeCheckboxDropdown('Damage',  damageItems);

    // ─── CLOSE ON OUTSIDE CLICK ─────────────────────────────────────────
    document.addEventListener('click', evt => {
      for (const dd of [lvlDD, schoolDD, dmgDD]) {
        if (dd.open && !dd.contains(evt.target as Node)) {
          dd.open = false;
        }
      }
    });

     // ─── 3️⃣ “Go” + 4️⃣ “Clear” buttons wrapper ─────────────────────────
  const btnWrap = container.createDiv({
    attr: { style: 'display:flex; justify-content:center; margin-bottom:12px;' }
  });

  const goBtn = btnWrap.createEl('button', { text: 'Go', cls: 'mod-cta' });
  goBtn.setAttr('style', 'flex:1;');
  goBtn.addEventListener('click', () => {
    this.renderTable(getLevels(), getSchools(), getDamages());
  });

  const clearBtn = btnWrap.createEl('button', { text: 'Clear Filters and Reset', cls: 'mod-cta' });
  clearBtn.setAttr('style', 'flex:1; margin-left:8px;');
  clearBtn.addEventListener('click', () => {
    // reset your dropdowns…
    ([
      [lvlDD,    'Levels'],
      [schoolDD, 'Schools'],
      [dmgDD,    'Damage'],
    ] as const).forEach(([dd, title]) => {
      dd.querySelectorAll('input[type=checkbox]').forEach(cb =>
        (cb as HTMLInputElement).checked = false
      );
      dd.querySelector('summary')?.setText(`${title} (0)`);
      dd.open = false;
    });

    // clear the table
    const tableDiv = container.find('#spellbook-table') as HTMLDivElement;
    if (tableDiv) tableDiv.empty();
  });

  // ─── Divider + placeholder ─────────────────────────────────────────
  container.createEl('hr');
  container.createEl('div', { attr: { id: 'spellbook-table' } });
}


private renderTable(
  selectedLevels: string[],
  selectedSchools: string[],
  selectedDamages: string[]
): void {
  // 1) grab & clear
  const tableDiv = this.containerEl.find('#spellbook-table') as HTMLDivElement;
  if (!tableDiv) return;
  tableDiv.empty();

  // 2) build & style the table + header row
  const table = tableDiv.createEl('table');
  table.setAttr('style', 'width:100%;border-collapse:collapse;');
  const header = table.createEl('tr');
  header.setAttr('style', 'display:flex;');
  ['Name','Lvl','School','Dmg Type'].forEach((text, idx) => {
    const th = header.createEl('th');
    th.setText(text);
    th.setAttr('style', idx === 0
      ? 'flex:2;padding:4px;text-align:left;'
      : 'flex:1;padding:4px;text-align:left;'
    );
  });

  // 3) loop + filter
  const allSpells = this.app.vault
    .getMarkdownFiles()
    .filter(f => f.path.startsWith('Compendium/Spells'));

  let found = 0;
  for (const f of allSpells) {
    const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
    if (!fm) continue;

    const lvl    = String(fm.level);
    const sch    = String(fm.school);
    // ← guard here: default to empty string if missing
    const dmgRaw = typeof fm.damage_type === 'string' ? fm.damage_type : '';

    if (selectedLevels.length  && !selectedLevels.includes(lvl))    continue;
    if (selectedSchools.length && !selectedSchools.includes(sch))   continue;
    if (selectedDamages.length && !selectedDamages.includes(dmgRaw)) continue;

    // 4) render a matching row
    const row = table.createEl('tr');
    row.setAttr('style','display:flex;');

    // Name
    const nameTd = row.createEl('td');
    nameTd.setAttr('style','flex:2;padding:4px;');
    const link = nameTd.createEl('a', { attr:{ href:'#' } });
    link.setText(fm.name || f.basename);
    link.addEventListener('click', e => {
      e.preventDefault();
      this.app.workspace.openLinkText(f.basename, '', false);
    });

    // Level
    const lvlTd = row.createEl('td');
    lvlTd.setText(lvl);
    lvlTd.setAttr('style','flex:1;padding:4px;');

    // School
    const schTd = row.createEl('td');
    schTd.setText(SCHOOL_ABBR[sch] ?? sch.slice(0,3));
    schTd.setAttr('style','flex:1;padding:4px;');

    // Damage (empty if none)
    const dmgTd = row.createEl('td');
    dmgTd.setText(
      dmgRaw
        ? (DAMAGE_ABBR[dmgRaw] ?? dmgRaw.slice(0,3))
        : '—'
    );
    dmgTd.setAttr('style','flex:1;padding:4px;');

    found++;
  }

  // 5) no results?
  if (!found) {
    tableDiv.createEl('p').setText('No spells match your filter criteria.');
  }
}

  }