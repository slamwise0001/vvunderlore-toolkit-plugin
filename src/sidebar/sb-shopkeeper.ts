import { App, TFile } from 'obsidian';
import type VVunderloreToolkitPlugin from '../main';

type ItemRecord = {
  name: string;
  path: string;
  type: string;
  rarity: string;
  cost_gp: number | null;
  magical: boolean;
};

export class ShopkeeperPanel {
  private app: App;
  private plugin: VVunderloreToolkitPlugin;
  private containerEl: HTMLElement;
  private _ddCloser?: (evt: PointerEvent) => void;

  constructor(app: App, plugin: VVunderloreToolkitPlugin, containerEl: HTMLElement) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = containerEl;
  }

  // UI ------------------------------------------------------------------------
  public async render(): Promise<void> {
    this.containerEl.empty();

    const details = this.containerEl.createEl('details');
    details.createEl('summary', { text: 'SHOPKEEPER' })
      .setAttr('style', 'font-size:1.3em;font-weight:600;margin:0.5em 0;');

    const wrapper = details.createDiv({
      attr: { style: 'display:flex;flex-direction:column;gap:8px;margin:8px 0;' }
    });

    // Build sets
    const itemFiles = this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith('Compendium/Items'));
    const types = new Set<string>();
    const rarities = new Set<string>();
    for (const f of itemFiles) {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (!fm) continue;
      if (typeof fm.type === 'string' && fm.type.trim()) types.add(String(fm.type));
      if (typeof fm.rarity === 'string' && fm.rarity.trim()) rarities.add(String(fm.rarity));
    }

    // Filters row
    const filters = wrapper.createDiv({
      attr: { style: 'display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start;' }
    });

    type Item = { value: string; label: string };

    const makeCheckboxDropdown = (
      title: string,
      items: Item[]
    ): { wrapper: HTMLDetailsElement; getSelected: () => string[] } => {
      const dd = filters.createEl('details') as HTMLDetailsElement;
      dd.classList.add('sb-dd');

      const summary = dd.createEl('summary') as HTMLElement;
      summary.classList.add('sb-dd__button');
      summary.setText(`${title} (0)`);
      summary.setAttr('tabindex', '0');
      summary.setAttr('role', 'button');
      summary.setAttr('aria-expanded', 'false');

      const toggleOpen = () => {
        dd.open = !dd.open;
        summary.setAttr('aria-expanded', String(dd.open));
      };

      summary.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleOpen(); });
      summary.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); }
      });

      const panel = dd.createEl('div');
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
        wrapper: dd,
        getSelected: () => inputs.filter(i => i.checked).map(i => i.value),
      };
    };

    const typeItems = Array.from(types).sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, label: v }));
    const rarityItems = Array.from(rarities).sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, label: v }));

    const { wrapper: typeDD, getSelected: getTypes } = makeCheckboxDropdown('Types', typeItems);
    const { wrapper: rarityDD, getSelected: getRarities } = makeCheckboxDropdown('Rarity', rarityItems);

    if (!this._ddCloser) {
      this._ddCloser = (evt: PointerEvent) => {
        for (const dd of [typeDD, rarityDD]) {
          if (dd.open && !dd.contains(evt.target as Node)) {
            dd.open = false;
            dd.querySelector('summary')?.setAttr('aria-expanded', 'false');
          }
        }
      };
      document.addEventListener('pointerdown', this._ddCloser, true);
    }

    // Toggles + price + count
    const extraRow = wrapper.createDiv({
      attr: { style: 'display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-top:-6px;' }
    });

    const magLabel = extraRow.createEl('label', {
      attr: { style: 'display:inline-flex; align-items:center; gap:8px; cursor:pointer;' }
    });
    magLabel.createSpan({ text: 'Magical only' });
    const magicalChk = magLabel.createEl('input', { attr: { type: 'checkbox', id: 'sk-magical' } }) as HTMLInputElement;

    const minWrap = extraRow.createDiv({ attr: { style: 'display:flex;gap:6px;align-items:center;' } });
    minWrap.createSpan({ text: 'Min (gp)' });
    const minInput = minWrap.createEl('input', { attr: { type: 'number', id: 'sk-price-min', style: 'width:90px;' } }) as HTMLInputElement;

    const maxWrap = extraRow.createDiv({ attr: { style: 'display:flex;gap:6px;align-items:center;' } });
    maxWrap.createSpan({ text: 'Max (gp)' });
    const maxInput = maxWrap.createEl('input', { attr: { type: 'number', id: 'sk-price-max', style: 'width:90px;' } }) as HTMLInputElement;

    const countWrap = extraRow.createDiv({ attr: { style: 'display:flex;gap:6px;align-items:center;' } });
    countWrap.createSpan({ text: 'Count' });
    const countInput = countWrap.createEl('input', {
      attr: { type: 'number', id: 'sk-count', min: '1', max: '50', value: '5', style: 'width:70px;' }
    }) as HTMLInputElement;

    // Buttons
    const btnWrap = wrapper.createDiv({
      attr: { style: 'display:flex; gap:8px; justify-content:center; margin-bottom:8px;' }
    });
    const goBtn = btnWrap.createEl('button', { text: 'Go', cls: 'mod-cta' });
    goBtn.setAttr('style', 'flex:1;');
    const clearBtn = btnWrap.createEl('button', { text: 'Clear Filters' });
    clearBtn.setAttr('style', 'flex:1;');

    // Results containers
    wrapper.createEl('div', { attr: { id: 'shopkeeper-picks' } });
    wrapper.createEl('div', { attr: { id: 'shopkeeper-table' } });

    goBtn.addEventListener('click', () => {
      const typesSel = getTypes();
      const rarSel = getRarities();
      const magicalOnly = magicalChk.checked;
      const min = this.parseNumber(minInput.value);
      const max = this.parseNumber(maxInput.value);
      const count = this.parseIntInRange(countInput.value, 1, 50) ?? 5;
      this.renderItemsTable(typesSel, rarSel, magicalOnly, min, max, count);
    });

    clearBtn.addEventListener('click', () => {
      for (const dd of [typeDD, rarityDD]) {
        dd.querySelectorAll('input[type=checkbox]').forEach(cb => (cb as HTMLInputElement).checked = false);
        dd.querySelector('summary')?.setText(`${dd === typeDD ? 'Types' : 'Rarity'} (0)`);
        dd.open = false;
      }
      magicalChk.checked = false;
      minInput.value = '';
      maxInput.value = '';
      countInput.value = '5';
      const tableDiv = wrapper.find('#shopkeeper-table') as HTMLDivElement;
      if (tableDiv) tableDiv.empty();
    });
  }

  public dispose(): void {
    if (this._ddCloser) {
      document.removeEventListener('pointerdown', this._ddCloser, true);
      this._ddCloser = undefined;
    }
  }

  // Results -------------------------------------------------------------------
  private renderItemsTable(
    selectedTypes: string[],
    selectedRarities: string[],
    magicalOnly: boolean,
    minPrice: number | null,
    maxPrice: number | null,
    count: number
  ): void {
    const tableDiv = this.containerEl.find('#shopkeeper-table') as HTMLDivElement;
    if (!tableDiv) return;
    tableDiv.replaceChildren();

    const allItems = this.app.vault
      .getMarkdownFiles()
      .filter(f => f.path.startsWith('Compendium/Items'));

    const filtered = allItems.filter(f => this.filterItemFile(
      f, selectedTypes, selectedRarities, magicalOnly, minPrice, maxPrice
    ));

    const picked = this.sampleWithoutReplacement(filtered, Math.max(1, Math.min(count, 50)));

    picked.sort((a, b) => {
      const fa = this.app.metadataCache.getFileCache(a)?.frontmatter;
      const fb = this.app.metadataCache.getFileCache(b)?.frontmatter;
      const na = String(fa?.name ?? a.basename).toLowerCase();
      const nb = String(fb?.name ?? b.basename).toLowerCase();
      return na.localeCompare(nb);
    });

    if (!picked.length) {
      tableDiv.createEl('p').setText('No items match your filter criteria.');
      return;
    }

    const table = tableDiv.createEl('table');
    table.setAttr('style', 'width:100%;border-collapse:collapse;');

    const headerRow = table.createEl('tr');
    headerRow.setAttr('style', 'display:flex;');

    const columns: { label: string; key: 'name'|'type'|'rarity'|'price'|'mag'; flex: number; align?: 'center'|'left' }[] = [
      { label: 'Name', key: 'name', flex: 2, align: 'left' },
      { label: 'Type', key: 'type', flex: 1, align: 'center' },
      { label: 'Rarity', key: 'rarity', flex: 1, align: 'center' },
      { label: 'Price (gp)', key: 'price', flex: 1, align: 'center' },
      { label: 'Mag', key: 'mag', flex: 0.6, align: 'center' },
    ];

    for (const { label, flex, align } of columns) {
      const th = headerRow.createEl('th');
      th.setText(label);
      th.setAttr('style', `flex:${flex};padding:4px;${align === 'left' ? 'text-align:left' : 'text-align:center'}`);
    }

    for (const f of picked) {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (!fm) continue;

      const row = table.createEl('tr');
      row.setAttr('style', 'display:flex;');

      // name
      const nameTd = row.createEl('td');
      nameTd.setAttr('style', 'flex:2;padding:4px;');
      const nm = String(fm.name ?? f.basename);
      const link = nameTd.createEl('a', { attr: { href: '#' } });
      link.setText(nm);
      const enablePreview = !!(this.plugin as any)?.settings?.enableSidebarPreviews;
      if (enablePreview) {
        link.classList.add('internal-link');
        link.setAttr('data-href', f.path);
        link.setAttr('href', f.path);
      }
      link.addEventListener('click', e => {
        e.preventDefault();
        this.app.workspace.openLinkText(f.path, '', false);
      });

      // type
      const typeTd = row.createEl('td');
      typeTd.setAttr('style', 'flex:1; display:flex; align-items:center; justify-content:center; padding:4px;');
      typeTd.createSpan({ text: String(fm.type ?? '—') });

      // rarity
      const rarTd = row.createEl('td');
      rarTd.setAttr('style', 'flex:1; display:flex; align-items:center; justify-content:center; padding:4px;');
      rarTd.createSpan({ text: String(fm.rarity ?? '—') });

      // price
      const priceTd = row.createEl('td');
      priceTd.setAttr('style', 'flex:1; display:flex; align-items:center; justify-content:center; padding:4px;');
      const gp = this.costToGp(fm.cost);
      priceTd.createSpan({ text: gp == null ? '—' : this.prettyGp(gp) });

      // magical
      const magTd = row.createEl('td');
      magTd.setAttr('style', 'flex:0.6; display:flex; align-items:center; justify-content:center; padding:4px;');
      const mag = this.isMagical(fm);
      magTd.createSpan({ text: mag ? '✓' : '—' });
    }
  }

  // Filtering helpers ---------------------------------------------------------
  private filterItemFile(
    f: TFile,
    selectedTypes: string[],
    selectedRarities: string[],
    magicalOnly: boolean,
    minPrice: number | null,
    maxPrice: number | null
  ): boolean {
    const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
    if (!fm) return false;

    const type = String(fm.type ?? '').trim();
    const rarity = String(fm.rarity ?? '').trim();

    if (selectedTypes.length && !selectedTypes.some(t => t.toLowerCase() === type.toLowerCase())) return false;
    if (selectedRarities.length && !selectedRarities.some(r => r.toLowerCase() === rarity.toLowerCase())) return false;

    const magical = this.isMagical(fm);
    if (magicalOnly && !magical) return false;

    const cost = this.costToGp(fm.cost);
    if (minPrice != null) {
      if (cost == null || cost < minPrice) return false;
    }
    if (maxPrice != null) {
      if (cost == null || cost > maxPrice) return false;
    }

    return true;
  }

  private isMagical(fm: any): boolean {
    const raw = fm?.magical;
    if (typeof raw === 'boolean') return raw;
    const s = String(raw ?? '').toLowerCase();
    if (['true', 'yes', 'y', '1', 'required'].includes(s)) return true;
    const rar = String(fm?.rarity ?? '').toLowerCase();
    const nm = String(fm?.name ?? '').toLowerCase();
    if (rar && !['common', 'unknown'].includes(rar)) return true;
    if (nm.includes('+1') || nm.includes('+2') || nm.includes('+3')) return true;
    return false;
  }

  // Parsing/helpers ------------------------------------------------------------
  private parseNumber(v: string): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private parseIntInRange(v: string, min: number, max: number): number | null {
    if (v == null || v === '') return null;
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, n));
  }

  private sampleWithoutReplacement<T>(arr: T[], k: number): T[] {
    if (k >= arr.length) {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }
    const res: T[] = [];
    const pool = arr.slice();
    for (let i = pool.length - 1; i >= 0 && res.length < k; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      res.push(pool[i]);
    }
    return res;
  }

  private costToGp(cost: unknown): number | null {
    if (cost == null) return null;

    if (typeof cost === 'number' && Number.isFinite(cost)) return cost;

    if (typeof cost === 'string') {
      const s = cost.trim().toLowerCase();
      if (!s) return null;

      let total = 0;
      const re = /(\d+(\.\d+)?)\s*(pp|gp|sp|cp)?/g;
      let matched = false;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) {
        matched = true;
        const val = parseFloat(m[1]);
        const unit = (m[3] ?? 'gp').toLowerCase();
        switch (unit) {
          case 'pp': total += val * 10; break;
          case 'gp': total += val; break;
          case 'sp': total += val * 0.1; break;
          case 'cp': total += val * 0.01; break;
          default: total += val; break;
        }
      }
      if (matched) return total;

      const n = Number(s.replace(/[^\d.]/g, ''));
      return Number.isFinite(n) ? n : null;
    }

    return null;
  }

  private prettyGp(gp: number): string {
    if (gp >= 1) return `${Math.round(gp * 100) / 100} gp`;
    if (gp >= 0.1) return `${Math.round((gp / 0.1) * 10) / 10} sp`;
    return `${Math.round((gp / 0.01))} cp`;
  }
}
