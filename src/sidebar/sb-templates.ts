import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  Notice,
  ButtonComponent,
  MarkdownView,
  Setting
} from 'obsidian';

export const SIDEBAR_VIEW_TYPE = 'vvunderlore-templates-sidebar';

const TEMPLATE_BUTTONS: { label: string; path: string }[] = [
  { label: 'New Adventure',        path: 'Extras/Templates/newadventure_template.md' },
  { label: 'New Player Character', path: 'Extras/Templates/playercharacter_template.md' },
  { label: 'New NPC',              path: 'Extras/Templates/npc_template.md' },
  { label: 'New Item',             path: 'Extras/Templates/newitem_template.md' },
  { label: 'New Place',            path: 'Extras/Templates/newplace_template.md' },
  { label: 'New Creature/Monster', path: 'Extras/Templates/newcreature_template.md' },
];

export class SidebarTemplatesView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() { return SIDEBAR_VIEW_TYPE; }
  getDisplayText() { return 'Quick Templates'; }
  getIcon() { return 'notebook-pen'; }


  async onOpen() {
    // clear out the *content* area
    this.contentEl.empty();

// TEMPLATES//

    // heading
    this.contentEl.createEl('h4', { text: '▶️ Run a Template' });
    // buttons
    for (const { label, path } of TEMPLATE_BUTTONS) {
      new ButtonComponent(this.contentEl)
        .setButtonText(label)
        .onClick(() => this.runTemplate(path));
    }

    const adventureNames = Array.from(new Set(
      this.app.vault.getFiles()
        .filter(f => f.path.startsWith('Adventures/'))
        .map(f => f.path.split('/')[1])
    ));

    // we’ll fill this in when the user picks an adventure
    let relatedContainer: HTMLElement;

    // create the setting
    new Setting(this.contentEl)
      .setName('Filter by Adventure')
      .addDropdown(drop => {
        drop.addOption('', '— pick one —');
        adventureNames.forEach(name => drop.addOption(name, name));
        drop.onChange(async adv => {
          // clear previous results
          relatedContainer.empty();
          if (!adv) return;
          // populate for the chosen adventure
          await this.showAdventureAssets(adv, relatedContainer);
        });
      });

    // placeholder for links
    relatedContainer = this.contentEl.createDiv({
      cls: 'vvunderlore-adventure-assets',
    });
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
  const templater = this.app.plugins.getPlugin('templater-obsidian') as any;
  if (!templater) {
    new Notice('⚠️ Please install & enable Templater.');
    return;
  }
  const tpObj = templater.templater?.current_functions_object;
  if (!tpObj) {
    new Notice('⚠️ Templater API not ready—add a startup template in its settings and restart.');
    return;
  }

  // 3️⃣ Create the wrapper file, but don’t open it
  let wrapperFile: TFile;
  try {
    wrapperFile = await tpObj.file.create_new(tpl, /* newName? */ undefined, /* openNew= */ false);
  } catch (e) {
    console.error('Error invoking Templater:', e);
    new Notice('❌ Failed to run template; check console.');
    return;
  }

  // 4️⃣ Now the user has seen and filled in your template’s form,
  //    and Templater has opened the real note for them.
  //    We can safely delete the wrapper.
  try {
    await this.app.vault.delete(wrapperFile);
  } catch (e) {
    console.warn('Could not delete wrapper file:', e);
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
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr 1fr';
      grid.style.gap = '4px';
      grid.style.margin = '4px 0';

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
          linkEl.style.textDecoration = 'none';
          linkEl.style.padding = '2px 4px';
          linkEl.style.borderRadius = '3px';
          linkEl.addEventListener('click', () => {
            this.app.workspace.openLinkText(path, '', false);
          });
      });
  }}
  }