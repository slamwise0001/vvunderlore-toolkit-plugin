import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  Notice,
  ButtonComponent,
  MarkdownView,
  Setting,
  TFolder,
  setIcon,
  App,
} from 'obsidian';
import { SPELLBOOK_VIEW_TYPE } from './sb-spellbook';
import { ADVENTURE_CATEGORY_DEFS, getAdventureCategoryIds } from 'src/adv-categories';


function getToolkit(app: App): any {
  const pm: any = (app as any).plugins;
  return (
    pm.getPlugin?.('vvunderlore-toolkit-plugin') ||
    pm.getPlugin?.('vvunderlore-toolkit') ||
    Object.values(pm.plugins || {}).find((p: any) =>
      p?.manifest?.id?.startsWith?.('vvunderlore-toolkit')
    )
  );
}


export const SIDEBAR_VIEW_TYPE = 'vvunderlore-templates-sidebar';

function getFullCommandId(app: App, shortId: string): string {
  if (shortId.includes(':')) return shortId;
  const registry: Record<string, any> = (app as any).commands?.commands || {};
  const match = Object.keys(registry).find(k => k.endsWith(`:${shortId}`));
  if (match) return match;
  const plugin = getToolkit(app);
  return plugin?.manifest?.id ? `${plugin.manifest.id}:${shortId}` : shortId;
}

function captureSelectionOrWord(app: App, sidebar: SidebarTemplatesView) {
  return sidebar.lastSelection;
}

type TemplateButton = { label: string; path: string } | { label: string; commandId: string };

const TEMPLATE_BUTTONS: TemplateButton[] = [
  { label: 'New Adventure', path: 'Extras/Templates/newadventure_template.md' },
  { label: 'New PC', commandId: 'vv-new-pc' },
  { label: 'New NPC', commandId: 'vv-new-npc' },
  { label: 'New Item', commandId: 'vv-new-item' },
  { label: 'New Place', commandId: 'vv-new-place' },
  { label: 'New Creature', commandId: 'vv-new-creature' },
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

  public lastSelection: {
    text: string;
    filePath: string;
    from: CodeMirror.Position;
    to: CodeMirror.Position;
    preText: string;
  } | null = null;


  private spellSortKey: 'name' | 'level' | 'school' | 'damage' = 'name';
  private spellSortDir: 1 | -1 = 1;

  // ── Selected Spells (memory only; no persistence) ───────────────────
  private picks: string[] = [];
  private addBtnByPath = new Map<string, HTMLButtonElement>(); // table “Add” buttons by file path

  private _ddCloser?: (ev: PointerEvent) => void;

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

  private _rewirePreviews(): void {
    const enablePreview = !!getToolkit(this.app)?.settings?.enableSidebarPreviews;
    const wrap = this.contentEl; // parent container for this view
    const pagePreview = (this.app as any).internalPlugins?.getPluginById?.('page-preview')?.instance;

    // If previously wired but now disabled, remove the handler
    if ((wrap as any)._vvHoverWired && !enablePreview) {
      const prev = (wrap as any)._vvHoverHandler as ((ev: MouseEvent) => void) | undefined;
      if (prev) wrap.removeEventListener('mousemove', prev);
      delete (wrap as any)._vvHoverWired;
      delete (wrap as any)._vvHoverHandler;
    }

    // If enabled and not yet wired, attach handler
    if (enablePreview && pagePreview?.onLinkHover && !(wrap as any)._vvHoverWired) {
      const handler = (ev: MouseEvent) => {
        const t = ev.target as HTMLElement | null;
        const a = t?.closest('a.internal-link') as HTMLAnchorElement | null;
        if (!a) return;
        const linkText = a.getAttribute('data-href') || a.getAttribute('href');
        if (!linkText) return;
        // source path not critical here; pass empty since these links can come from mixed sources
        pagePreview.onLinkHover(ev, a, linkText, '');
      };
      wrap.addEventListener('mousemove', handler);
      (wrap as any)._vvHoverWired = true;
      (wrap as any)._vvHoverHandler = handler;
    }
  }

  private buildIncomingRefCounts(): Map<string, number> {
    const incoming = new Map<string, number>();
    const resolved = this.app.metadataCache
      .resolvedLinks as Record<string, Record<string, number>>;

    for (const from in resolved) {
      const toMap = resolved[from];
      for (const to in toMap) {
        incoming.set(to, (incoming.get(to) || 0) + (toMap[to] || 1));
      }
    }
    return incoming;
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

        const enablePreview = !!getToolkit(this.app)?.settings?.enableSidebarPreviews;
        if (enablePreview) {
          if (file instanceof TFile) {
            nameLink.classList.add('internal-link');
            nameLink.setAttr('data-href', file.path);
            nameLink.setAttr('href', file.path);
          }
        }

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

    this.registerEvent(
      (this.app.workspace as any).on('editor-selection-change', (editor: any, view: any) => {
        const text = editor.getSelection();
        this.lastSelection = {
          text,
          filePath: view.file.path,
          from: editor.getCursor('from'),
          to: editor.getCursor('to'),
          preText: editor.getValue(),
        };
      })
    );

    this.picks = [];
    this.addBtnByPath.clear();

    // heading
    this.contentEl.createEl('h4', { text: 'TEMPLATES' });

    // template buttons
    const btnContainer = this.contentEl.createDiv();
    btnContainer.addClass("sb-btn");

    for (const def of TEMPLATE_BUTTONS) {
      const btnEl = btnContainer.createEl("button", { text: def.label });
      btnEl.style.flex = "1";
      btnEl.style.minWidth = "120px";

      let originLeaf: WorkspaceLeaf | undefined;

      // pointerdown: capture selection + origin leaf BEFORE sidebar steals focus
      btnEl.addEventListener("pointerdown", () => {
        const plugin = getToolkit(this.app);

        // capture text selection (your existing logic)
        const ctx = captureSelectionOrWord(this.app, this);
        if (ctx) plugin?.setPendingSelectionContext?.(ctx);

        // capture origin leaf
        originLeaf = this.app.workspace.activeLeaf ?? undefined;
        console.log("🟣 [pointerdown] Captured originLeaf:", originLeaf?.view instanceof MarkdownView ? originLeaf.view.file?.path : "(none)");
      });

      // click: run either a command or template with captured originLeaf
      btnEl.addEventListener("click", () => {
        if ("commandId" in def) {
          const fullId = getFullCommandId(this.app, def.commandId);
          const cmd = this.app.commands.findCommand(fullId);
          if (!cmd) {
            new Notice(`Command not found: ${fullId}`);
            return;
          }
          this.app.commands.executeCommandById(fullId);
        } else {
          console.log("🟣 [click] Running template with originLeaf:", originLeaf?.view instanceof MarkdownView ? originLeaf.view.file?.path : "(none)");
          this.runTemplate(def.path, originLeaf);
        }
      });
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
          // nuke any previous render
          advContainer.findAll('.vvunderlore-adventure-assets').forEach(el => el.remove());

          const wrapper = advContainer.createDiv({ cls: 'vvunderlore-adventure-assets' });
          if (!adv) return;

          const quick = wrapper.createDiv();
          quick.setAttr('style', 'display:flex;justify-content:center;gap:20px;flex-wrap:wrap;margin:6px 0 10px;');

          // Adventure Hub
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
            const enablePreview = !!getToolkit(this.app)?.settings?.enableSidebarPreviews;
            if (enablePreview) {
              const p = hubFile!.path;
              hubLink.classList.add('internal-link');
              hubLink.setAttr('data-href', p);
              hubLink.setAttr('href', p);
            }
          }

          // Most recent session link
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
            const enablePreview = !!getToolkit(this.app)?.settings?.enableSidebarPreviews;
            if (enablePreview) {
              const p = latest.path;
              sessionLink.classList.add('internal-link');
              sessionLink.setAttr('data-href', p);
              sessionLink.setAttr('href', p);
            }
          }

          // Where the grouped links will render
          const list = wrapper.createDiv();
          await this.showAdventureAssets(adv, list);
        });

      });

    this.contentEl.createEl('hr');

    // ─── SPELLBOOK ─────────────────────────────────────────────────────
    await this.showSpellbookSection();

    this._rewirePreviews(); // initial
    this.registerEvent(
      (this.app.workspace as any).on('vv:sidebar-previews-changed', (_data?: { enabled: boolean }) => {
        this._rewirePreviews();
      })
    );
  }

  async onClose() {
    this.picks = [];
    this.addBtnByPath.clear();
    this.contentEl.empty();
    if (this._ddCloser) {
      document.removeEventListener('pointerdown', this._ddCloser, true);
      this._ddCloser = undefined;
    }
  }

  private async runTemplate(path: string, originLeaf?: WorkspaceLeaf) {
    originLeaf?.view instanceof MarkdownView ? originLeaf.view.file?.path : "(none)";
    const plugin = getToolkit(this.app);
    if (!plugin) { new Notice('⚠️ VVunderlore Toolkit plugin not found.'); return; }
    await plugin.runSBTemplate(path, originLeaf);
  }


  //-------+++++++++++ ADVENTURE FILTER

  private async showAdventureAssets(adventureName: string, renderInto: HTMLElement) {
    const prefix = `Adventures/${adventureName}/`;
    const files = this.app.vault
      .getFiles()
      .filter(f => f.path.startsWith(prefix));

    // gather all internal link destinations inside the adventure
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

    const catById = new Map(ADVENTURE_CATEGORY_DEFS.map(d => [d.id, d]));

    const groups: Record<string, string[]> = {};
    for (const fullPath of linkedPaths) {
      let id = 'other';
      for (const def of ADVENTURE_CATEGORY_DEFS) {
        if (def.test && def.test.test(fullPath)) { id = def.id; break; }
      }
      (groups[id] ||= []).push(fullPath);
    }

    const plugin = getToolkit(this.app);
const enabledIds = new Set(
  Array.isArray(plugin?.settings?.enabledAdventureCategories)
    ? plugin!.settings!.enabledAdventureCategories
    : getAdventureCategoryIds()
);


    // sort mode from plugin settings (default 'name')
    const sortMode = (getToolkit(this.app)?.settings?.adventureSort ?? 'name') as
      'name' | 'recent' | 'refs';

    // backlink counts once
    const incoming = this.buildIncomingRefCounts();

    // render each section once
    for (const sectionId of Object.keys(groups).sort((a, b) => {
      const la = catById.get(a)?.label ?? a;
      const lb = catById.get(b)?.label ?? b;
      return la.localeCompare(lb, undefined, { sensitivity: 'base' });
    })) {
      if (!enabledIds.has(sectionId)) continue;

      const label = catById.get(sectionId)?.label ?? sectionId;

      const details = renderInto.createEl('details', { attr: { open: 'true' } });
      const summary = details.createEl('summary', { text: label });
      summary.addClass("sb-summary");

      const grid = details.createDiv();
      grid.addClass("sb-adv-grid");

      const paths = groups[sectionId].slice();

      paths.sort((a, b) => {
        if (sortMode === 'recent') {
          const af = this.app.vault.getAbstractFileByPath(a);
          const bf = this.app.vault.getAbstractFileByPath(b);
          const am = (af instanceof TFile ? af.stat.mtime : 0) || 0;
          const bm = (bf instanceof TFile ? bf.stat.mtime : 0) || 0;
          if (bm !== am) return bm - am; // newer first
        } else if (sortMode === 'refs') {
          const ar = incoming.get(a) || 0;
          const br = incoming.get(b) || 0;
          if (br !== ar) return br - ar;   // more backlinks first

          // tie-break by recency
          const af = this.app.vault.getAbstractFileByPath(a);
          const bf = this.app.vault.getAbstractFileByPath(b);
          const am = (af instanceof TFile ? af.stat.mtime : 0) || 0;
          const bm = (bf instanceof TFile ? bf.stat.mtime : 0) || 0;
          if (bm !== am) return bm - am;
        }

        // final/default: name A→Z
        const aName = a.split('/').pop()!.replace(/\.md$/, '').toLowerCase();
        const bName = b.split('/').pop()!.replace(/\.md$/, '').toLowerCase();
        return aName.localeCompare(bName);
      });

      paths.forEach(path => {
        const name = path.split('/').pop()!.replace(/\.md$/, '');
        const linkEl = grid.createEl('a', { text: name, href: '#' });
        linkEl.addClass("sb-adv-links");
        linkEl.addEventListener('click', () => {
          this.app.workspace.openLinkText(path, '', false);
        });
        const enablePreview = !!getToolkit(this.app)?.settings?.enableSidebarPreviews;
        if (enablePreview) {
          linkEl.classList.add('internal-link');
          linkEl.setAttr('data-href', path);
          linkEl.setAttr('href', path);
        }
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
      const wrapper = filters.createEl('details') as HTMLDetailsElement;
      wrapper.classList.add('sb-dd');

      const summary = wrapper.createEl('summary') as HTMLElement;
      summary.classList.add('sb-dd__button');
      summary.setText(`${title} (0)`);

      // make summary behave like a real button regardless of theme quirks
      summary.setAttr('tabindex', '0');
      summary.setAttr('role', 'button');
      summary.setAttr('aria-expanded', 'false');

      const toggleOpen = () => {
        wrapper.open = !wrapper.open;
        summary.setAttr('aria-expanded', String(wrapper.open));
      };

      summary.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleOpen();
      });
      summary.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleOpen();
        }
      });

      const panel = wrapper.createEl('div');
      panel.classList.add('sb-dd__panel');
      panel.addEventListener('click', (evt: MouseEvent) => evt.stopPropagation());

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

    // 2.5) Include Concentration checkbox (simple toggle)
    const concRow = container.createDiv({
      attr: {
        style: 'display:flex; justify-content:center; margin:-6px 0 6px 0;'
      }
    });

    const concLabel = concRow.createEl('label', {
      attr: { style: 'display:inline-flex; align-items:center; gap:8px; cursor:pointer;' }
    });

    concLabel.createSpan({ text: 'Include Concentration Spells?' });
    const concChk = concLabel.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement;
    concChk.checked = true; // default ON

    const levelItems = Array.from(levels).sort((a, b) => a - b).map(lvl => ({ value: `${lvl}`, label: lvl === 0 ? 'Cantrip' : `Level ${lvl}` }));
    const schoolItems = Array.from(schools).sort().map(sch => ({ value: sch, label: sch }));
    const damageItems = Array.from(damages).sort().map(dmg => ({ value: dmg, label: dmg }));

    const { wrapper: lvlDD, getSelected: getLevels } = makeCheckboxDropdown('Levels', levelItems);
    const { wrapper: schoolDD, getSelected: getSchools } = makeCheckboxDropdown('Schools', schoolItems);
    const { wrapper: dmgDD, getSelected: getDamages } = makeCheckboxDropdown('Damage', damageItems);

    if (!this._ddCloser) {
      this._ddCloser = (evt: PointerEvent) => {
        for (const dd of [lvlDD, schoolDD, dmgDD]) {
          if (dd.open && !dd.contains(evt.target as Node)) {
            dd.open = false;
            dd.querySelector('summary')?.setAttr('aria-expanded', 'false');
          }
        }
      };
      document.addEventListener('pointerdown', this._ddCloser, true);
    }

    const btnWrap = container.createDiv({
      attr: { style: 'display:flex; justify-content:center; margin-bottom:8px;' }
    });

    const goBtn = btnWrap.createEl('button', { text: 'Go', cls: 'mod-cta' });
    goBtn.setAttr('style', 'flex:1;');
    goBtn.addEventListener('click', () => {
      this.renderTable(getLevels(), getSchools(), getDamages(), concChk.checked);;
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
      concChk.checked = true;
      const tableDiv = container.find('#spellbook-table') as HTMLDivElement;
      if (tableDiv) tableDiv.empty();
    });
    container.createEl('div', { attr: { id: 'spellbook-picks' } });
    container.createEl('div', { attr: { id: 'spellbook-table' } });

    this.renderPicks();
  }

  private renderTable(
    selectedLevels: string[],
    selectedSchools: string[],
    selectedDamages: string[],
    includeConcentration: boolean
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

      const isConc = fm.concentration === true ||
        String(fm.concentration ?? '').toLowerCase() === 'true';

      if (!includeConcentration && isConc) return false;

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
      'flex:0 0 28px',
      'padding:4px',
      'text-align:left'
    ].join(';'));

    type SpellColKey = 'name' | 'level' | 'school' | 'damage';

    const columns: { label: string; key?: SpellColKey; flex: number }[] = [
      { label: 'Name', key: 'name', flex: 2 },
      { label: 'Lvl', key: 'level', flex: 1 },
      { label: 'School', key: 'school', flex: 1 },
      { label: 'Dmg Type', key: 'damage', flex: 1 },
      { label: 'Conc.', flex: 1 },
    ];

    for (const { label, key, flex } of columns) {
      const th = headerRow.createEl('th');
      th.setText(label);
      th.setAttr(
        'style',
        [
          `flex:${flex}`,
          'padding:4px',
          label === 'Name' ? 'text-align:left' : 'text-align:center',
          key ? 'cursor:pointer' : '',
        ].join(';')
      );

      if (key) {
        th.addEventListener('click', () => {
          if (this.spellSortKey === key) {
            this.spellSortDir = this.spellSortDir === 1 ? -1 : 1;
          } else {
            this.spellSortKey = key;
            this.spellSortDir = 1;
          }
          this.renderTable(selectedLevels, selectedSchools, selectedDamages, includeConcentration);
        });
      }
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
      const enablePreview = !!getToolkit(this.app)?.settings?.enableSidebarPreviews;
      if (enablePreview) {
        link.classList.add('internal-link');
        link.setAttr('data-href', f.path);
        link.setAttr('href', f.path);
      }
      link.addEventListener('click', e => {
        e.preventDefault();
        this.app.workspace.openLinkText(f.path, '', false);
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

      const concTd = row.createEl('td');
      concTd.setAttr(
        'style',
        'flex:1; display:flex; align-items:center; justify-content:center; padding:4px;'
      );

      const isConc =
        fm.concentration === true ||
        String(fm.concentration ?? '').toLowerCase() === 'true';

      concTd.createSpan({ text: isConc ? '✓' : '—' });

      found++;
    }

    if (!found) {
      tableDiv.createEl('p').setText('No spells match your filter criteria.');
    }
  }
}
