// sb-gameplay.ts

// ── Gameplay Sidebar View ─────────────────────────────────────────────
import {
    App,
    ItemView,
    WorkspaceLeaf,
    TFile,
    Notice,
    Modal
} from 'obsidian';

export const GAMEPLAY_VIEW_TYPE = "vvunderlore-gameplay";

// plugin accessor
function getToolkit(app: App): any {
    return (
        (app as any).plugins.getPlugin("vvunderlore-toolkit") ||
        (app as any).plugins.plugins?.["vvunderlore-toolkit"]
    );
}

const ALIGN_ABBR: Record<string, string> = {
    "lawful good": "LG",
    "neutral good": "NG",
    "chaotic good": "CG",
    "lawful neutral": "LN",
    "true neutral": "N",
    "neutral": "N",
    "chaotic neutral": "CN",
    "lawful evil": "LE",
    "neutral evil": "NE",
    "chaotic evil": "CE",
};

const ABILITY_ABBR: Record<string, string> = {
    strength: "STR",
    dexterity: "DEX",
    constitution: "CON",
    intelligence: "INT",
    wisdom: "WIS",
    charisma: "CHA",
};

// const SKILL_ABBR: Record<string, string> = {
//     acrobatics: "Acro",
//     "animal handling": "Anim",
//     arcana: "Arc.",
//     athletics: "Ath.",
//     deception: "Dec.",
//     history: "His.",
//     insight: "Ins.",
//     intimidation: "Int.",
//     investigation: "Inv.",
//     medicine: "Med.",
//     nature: "Nat.",
//     perception: "Perc.",
//     performance: "Perf.",
//     persuasion: "Pers.",
//     religion: "Rel.",
//     "sleight of hand": "SoH",
//     stealth: "Stl.",
//     survival: "Surv.",
// };


type PlayerRow = {
    file: TFile;
    name: string;
    ac: string;
    hpCur: string;
    hpMax: string;
    speed: string;
    align: string;
    pp: number;
};

function sanitizeSpeed(raw: string): string {
    if (!raw) return "—";
    const lower = raw.toLowerCase();

    // extract walk
    const walkMatch = lower.match(/walk\s+(\d+)/);
    const walk = walkMatch ? walkMatch[1] : "";

    // extract fly
    const flyMatch = lower.match(/fly\s+(\d+)/);
    const fly = flyMatch ? flyMatch[1] : "";

    // build display
    if (walk && fly) return `${walk} / ${fly}`;
    if (walk) return walk;
    if (fly) return fly;

    return "—";
}

// SPELL AND ITEM EDIT MODAL

type EditListOpts = {
    title: string;
    initial: string[];
    candidates: string[];          // e.g. ["[[Fog Cloud]]","[[Cure Wounds]]", ...]
    placeholder?: string;
    onSave: (values: string[]) => void | Promise<void>;
};

export class EditListModal extends Modal {
    private values: string[];
    private candidates: string[];
    private opts: EditListOpts;

    private inputWrap!: HTMLDivElement;
    private inputEl!: HTMLInputElement;
    private addBtn!: HTMLButtonElement;
    private suggestWrap!: HTMLDivElement;
    private listWrap!: HTMLDivElement;

    private hoverIndex = -1;
    private filtered: string[] = [];

    constructor(app: App, opts: EditListOpts) {
        super(app);
        this.values = [...(opts.initial || [])];
        this.candidates = Array.from(new Set((opts.candidates || []).map(s => this.ensureWikilink(s)))).sort();
        this.opts = opts;
    }



    onOpen() {
        const { contentEl, modalEl } = this;
        this.modalEl.addClass("vv-fixed-modal");
        this.modalEl.style.width = "520px";    // ← make it thinner here
        this.modalEl.style.maxWidth = "96vw";  // small screens shrink gracefully
        this.modalEl.style.maxHeight = "82vh"; // allow height

        const header = contentEl.createEl("h2", { text: this.opts.title });

        // ── Search row
        const row = contentEl.createDiv({ cls: "vv-field-row" });
        this.inputWrap = row.createDiv({ cls: "vv-searchwrap" });
        this.inputEl = this.inputWrap.createEl("input", {
            type: "text",
            placeholder: this.opts.placeholder || "Search…",
            cls: "vv-search",
        });
        this.addBtn = row.createEl("button", { text: "Add", cls: "mod-cta vv-addbtn" });

        // Suggest dropdown
        this.suggestWrap = this.inputWrap.createDiv({ cls: "vv-suggest", attr: { "aria-hidden": "true" } });

        this.listWrap = contentEl.createDiv({ cls: "vv-list-wrap" });
        this.paintList();

        // ── Actions
        const actions = contentEl.createDiv({ cls: "vv-actions" });
        const save = actions.createEl("button", { text: "Save", cls: "mod-cta" });
        const cancel = actions.createEl("button", { text: "Cancel", cls: "vv-cancel" });

        // Listeners
        const commitCurrent = () => {
            const raw = this.inputEl.value.trim();
            if (!raw) return;
            this.addValue(raw);
        };

        this.inputEl.addEventListener("input", () => this.showSuggestions(this.inputEl.value));
        this.inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (this.hoverIndex >= 0 && this.filtered[this.hoverIndex]) {
                    this.addValue(this.filtered[this.hoverIndex]);
                } else {
                    commitCurrent();
                }
            }
            if (e.key === "ArrowDown") { e.preventDefault(); this.moveHover(1); }
            if (e.key === "ArrowUp") { e.preventDefault(); this.moveHover(-1); }
            if (e.key === "Escape") { this.hideSuggestions(); }
        });
        this.addBtn.addEventListener("click", commitCurrent);
        save.addEventListener("click", async () => {
            await this.opts.onSave?.([...this.values]);
            this.close();
        });
        cancel.addEventListener("click", () => this.close());

        // initial focus
        setTimeout(() => this.inputEl.focus(), 0);
    }

    onClose() {
        this.modalEl.classList.remove("vv-fixed-modal");
        this.modalEl.style.removeProperty("width");
        this.modalEl.style.removeProperty("max-width");
        this.modalEl.style.removeProperty("max-height");
        this.contentEl.empty();
    }


    // ── UI helpers
    private ensureWikilink(s: string): string {
        let t = (s ?? "").toString().trim();
        if (!t) return "";
        // strip quotes or accidental array-ish strings
        try { const j = JSON.parse(t); if (typeof j === "string") t = j; } catch { }
        t = t.replace(/^\[+\s*|\s*\]+$/g, "");
        // drop any pipes/anchors & keep basename path if you prefer
        t = t.split("|")[0].split("#")[0].trim();
        if (!t.startsWith("[[")) t = `[[${t}]]`;
        return t;
    }

    private addValue(raw: string) {
        const v = this.ensureWikilink(raw);
        if (!v) return;
        if (!this.values.includes(v)) {
            this.values.push(v);
            this.values.sort((a, b) => a.localeCompare(b));
            this.paintList();                 // was paintPills()
        }
        this.inputEl.value = "";
        this.hideSuggestions();
        this.inputEl.focus();
    }

    private removeValue(v: string) {
        this.values = this.values.filter(x => x !== v);
        this.paintList();                   // was paintPills()
    }

    private paintList() {
        this.listWrap.empty();

        if (!this.values.length) {
            this.listWrap.createDiv({ cls: "vv-empty", text: "Nothing added yet." });
            return;
        }

        const ul = this.listWrap.createEl("ul", { cls: "vv-list" });

        for (const v of this.values) {
            const li = ul.createEl("li", { cls: "vv-li" });
            li.createSpan({ cls: "vv-li-text", text: v });
            const x = li.createEl("button", {
                cls: "vv-li-x",
                text: "×",
                attr: { "aria-label": `Remove ${v}` },
            });
            x.addEventListener("click", () => this.removeValue(v));
        }
    }


    private showSuggestions(q: string) {
        const needle = q.trim().toLowerCase();
        if (!needle) return this.hideSuggestions();

        this.filtered = this.candidates
            .filter(c => c.toLowerCase().includes(needle) && !this.values.includes(c))
            .slice(0, 50);

        this.suggestWrap.empty();
        if (!this.filtered.length) return this.hideSuggestions();

        this.hoverIndex = -1;
        this.suggestWrap.setAttr("aria-hidden", "false");
        this.suggestWrap.toggleClass("is-open", true);

        this.filtered.forEach((opt, i) => {
            const li = this.suggestWrap.createDiv({ cls: "vv-suggest-item", text: opt });
            li.addEventListener("mouseenter", () => this.setHover(i));
            li.addEventListener("mouseleave", () => this.setHover(-1));
            li.addEventListener("mousedown", (e) => { e.preventDefault(); this.addValue(opt); });
        });
    }

    private hideSuggestions() {
        this.suggestWrap.empty();
        this.suggestWrap.setAttr("aria-hidden", "true");
        this.suggestWrap.toggleClass("is-open", false);
        this.filtered = [];
        this.hoverIndex = -1;
    }

    private setHover(i: number) {
        this.hoverIndex = i;
        const kids = Array.from(this.suggestWrap.children) as HTMLElement[];
        kids.forEach((el, idx) => el.toggleClass("is-hover", idx === i));
    }

    private moveHover(delta: number) {
        if (!this.filtered.length) return;
        this.hoverIndex = (this.hoverIndex + delta + this.filtered.length) % this.filtered.length;
        this.setHover(this.hoverIndex);
    }

}

export class GameplaySidebarView extends ItemView {
    private folderRow!: HTMLDivElement;
    private addRow!: HTMLDivElement;
    private partyTableWrap: HTMLDivElement | null = null;
    private detailsWrap: HTMLDivElement | null = null;
    private detailsOpenPath: string | null = null;

    constructor(leaf: WorkspaceLeaf) { super(leaf); }
    getViewType() { return GAMEPLAY_VIEW_TYPE; }
    getDisplayText() { return "Gameplay"; }
    getIcon() { return "gameplay"; }
    private async saveFrontmatterNumber(file: TFile, key: string, value: number): Promise<void> {
        const raw = await this.app.vault.read(file);
        // detect YAML frontmatter
        const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
        if (!fmMatch) {
            // no frontmatter → create one
            const yaml = `---\n${key}: ${value}\n---\n`;
            await this.app.vault.modify(file, yaml + raw);
            return;
        }

        const full = fmMatch[0];
        const body = fmMatch[1];

        const hasKey = new RegExp(`^${key}\\s*:`, "mi").test(body);
        let newBody: string;

        if (hasKey) {
            // replace existing line
            newBody = body.replace(new RegExp(`^${key}\\s*:\\s*.*$`, "mi"), `${key}: ${value}`);
        } else {
            // insert new line at end of FM body
            newBody = body.replace(/\s*$/, `\n${key}: ${value}\n`);
        }

        const updated = raw.replace(full, `---\n${newBody.replace(/\r?\n$/, "")}\n---\n`);
        await this.app.vault.modify(file, updated);
    }


    private collectCandidates(folder: string, asWikilinks = true): string[] {
        const root = folder.replace(/\/+$/, "") + "/";
        return this.app.vault
            .getMarkdownFiles()
            .filter(f => f.path.startsWith(root))
            .map(f => (asWikilinks ? `[[${f.basename}]]` : f.basename));
    }

    // Merge candidates from multiple folders, de-dupe, sort
    private collectFromFolders(folders: string[], asWikilinks = true): string[] {
        return Array.from(
            new Set(folders.flatMap(f => this.collectCandidates(f, asWikilinks)))
        ).sort((a, b) => a.localeCompare(b));
    }

    private refreshDetailPlaceholder() {
        const wrap = this.detailsWrap!;
        const hasCard = !!wrap.querySelector(".vv-gp-card");
        const empty = wrap.querySelector(".vv-gp-detail-empty");
        if (hasCard && empty) empty.remove();
        if (!hasCard && !empty) {
            wrap.createDiv({ cls: "vv-gp-detail-empty", text: "Click a name to see details…" });
        }
    }

    private getActiveFolderPrefix(): string {
        const plugin = getToolkit(this.app);
        const s = plugin?.settings?.gameplay || {};
        return ((s.activeFolder || "World/People/Player Characters/Active").replace(/\/+$/, "")) + "/";
    }
    private tableRefreshTimer: number | null = null;

    private queueTable = () => {
        if (this.tableRefreshTimer) window.clearTimeout(this.tableRefreshTimer);
        this.tableRefreshTimer = window.setTimeout(async () => {
            this.tableRefreshTimer = null;
            await this.renderTable();
        }, 120); // small debounce
    };

    private detailRefreshTimer: number | null = null;
    private queueDetail = () => {
        if (this.detailRefreshTimer) window.clearTimeout(this.detailRefreshTimer);
        this.detailRefreshTimer = window.setTimeout(async () => {
            this.detailRefreshTimer = null;
            const p = this.detailsOpenPath;
            if (!p) return;
            const f = this.app.vault.getAbstractFileByPath(p);
            if (f instanceof TFile) await this.showDetails(f);
        }, 120);
    };

    private isSelectedPath = (path: string): boolean => {
        const plugin = getToolkit(this.app);
        const s = plugin?.settings?.gameplay || {};
        const list: string[] = s.selectedPlayers || [];
        return list.includes(path);
    };

    private async showDetails(file: TFile) {
        this.detailsOpenPath = file.path;

        // container
        const wrap = this.detailsWrap!;

        // 1) If this file already has a PINNED card, just focus it and bail
        {
            const cards = Array.from(wrap.querySelectorAll<HTMLElement>(".vv-gp-card"));
            const pinnedForPath = cards.find(el => el.dataset.pinned === "true" && el.dataset.path === file.path);
            if (pinnedForPath) {
                pinnedForPath.scrollIntoView({ block: "nearest", behavior: "smooth" });
                return;
            }
        }

        // 2) Remove any existing UNPINNED card (we only ever allow one)
        {
            const existingUnpinned = wrap.querySelector<HTMLElement>('.vv-gp-card[data-pinned="false"]');
            if (existingUnpinned) existingUnpinned.remove();
        }

        // 3) Create new UNPINNED card for this file
        const card = document.createElement("div");
        card.addClass("vv-gp-card");
        card.dataset.pinned = "false";
        card.dataset.path = file.path;

        // place the card directly after the last pinned (or at top if none)
        const placeCard = (c: HTMLElement) => {
            const kids = Array.from(wrap.children) as HTMLElement[];
            const cards = kids.filter(el => el.classList.contains("vv-gp-card"));
            const pinned = cards.filter(el => el.dataset.pinned === "true");

            if (pinned.length) {
                const after = pinned[pinned.length - 1];
                wrap.insertBefore(c, after.nextSibling);
            } else {
                wrap.insertBefore(c, wrap.firstChild); // newest-first at top of stack
            }
        };

        // if pin state changes, re-place in the stack
        const reposition = (c: HTMLElement) => {
            if (c.parentElement === wrap) wrap.removeChild(c);
            placeCard(c);
        };

        placeCard(card);

        // ── controls
        const controls = card.createDiv({ cls: "vv-gp-detail-controls" });

        const pinBtn = controls.createEl("button", { text: "pin", cls: "vv-gp-btn" });
        pinBtn.title = "Pin card";
        pinBtn.addEventListener("click", () => {
            const pinned = card.dataset.pinned === "true";
            card.dataset.pinned = (!pinned).toString();
            pinBtn.textContent = !pinned ? "unpin" : "pin";
            pinBtn.title = !pinned ? "Unpin card" : "Pin card";
            reposition(card);
        });

        const closeBtn = controls.createEl("button", { text: "✕", cls: "vv-gp-btn" });
        closeBtn.title = "Close card";
        closeBtn.addEventListener("click", () => {
            card.remove();
            this.refreshDetailPlaceholder();
        });

        // render INTO the card
        const box = card;


        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
        const name = (fm["Name"] ?? file.basename) as string;

        const header = box.createDiv({ cls: "vv-gp-detail-header" });
        const titleEl = header.createEl("h2", { text: name });
        titleEl.classList.add("vv-gp-detail-title");

        // helpers
        const linkTo = (target: string, label?: string) => {
            const dest = this.app.metadataCache.getFirstLinkpathDest(target, file.path);
            const text = (label ?? target.split("/").pop()!.replace(/\.md$/, "")).trim();
            return dest
                ? `<a class="internal-link" href="${dest.path}">${text}</a>`
                : text;
        };

        const parseMaybeLink = (val: unknown): string => {
            // supports '[[Path|Label]]', '[[Path]]', plain string, or dv-like {path: "..."}
            if (!val) return "N/A";
            if (typeof val === "object" && (val as any).path) {
                const p = String((val as any).path);
                return linkTo(p);
            }
            const s = String(val);
            const m = s.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
            if (m) return linkTo(m[1], m[2]);
            return s;
        };

        const arrToList = (v: unknown): string[] => {
            if (Array.isArray(v)) return v.map((x) => String(x));
            if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
            return [];
        };

        // species/class/subclass
        const species = parseMaybeLink(fm["species"]);
        const race = parseMaybeLink(fm["race"]);
        const klass = parseMaybeLink(fm["class"]);
        const subclass = parseMaybeLink(fm["subclass"]);

        // proficiencies (vertical list, centered, abbreviated)
        const skillProfs = arrToList(fm["skills"]); // keep full names
        const stProfs = arrToList(fm["saving_throws"])
            .map(s => {
                const key = s.toLowerCase().trim();
                return ABILITY_ABBR[key] ?? s; // abbreviate if it matches ability
            });


        const joinComma = (items: string[]): string => {
            const xs = items.filter(Boolean);
            return xs.length ? xs.join(", ") : "—";
        };

        const profsHtml = joinComma(skillProfs);
        const stHtml = joinComma(stProfs);

        // header is already created above…

        // key–value stack header
        const kv = box.createDiv({ cls: "vv-gp-kvlist" });

        const makeKVRow = (label: string, html: string) => {
            const row = kv.createDiv({ cls: "vv-gp-kvrow" });
            row.createEl("div", { cls: "vv-gp-kvlabel", text: label });
            const val = row.createDiv({ cls: "vv-gp-kvvalue" });
            val.innerHTML = html;
        };

        // rows
        makeKVRow("Species", species);
        makeKVRow("Race", race);
        makeKVRow("Class", klass);
        makeKVRow("Subclass", subclass);
        makeKVRow("Proficiencies", profsHtml);
        makeKVRow("Saving Throws", stHtml);

        // Languages (from fm["languages"])
        const languagesArr = arrToList(fm["languages"]);
        const languagesHtml = languagesArr.length ? joinComma(languagesArr) : "—";
        makeKVRow("Languages", languagesHtml);


        // ——— KEY ITEMS (editable) ————————————————————————————————
        {
            const sec = box.createDiv({ cls: "vv-gp-detail-section" });
            const h = sec.createEl("h4", { text: "Key Items" });
            const edit = h.createSpan({ cls: "vv-gp-edit-link", text: "edit" });
            const list = sec.createEl("div", { cls: "vv-gp-detail-inline" });

            const read = () => this.readFmStringList(fm, ["key_items", "Key Items"]);

            const paint = (arr: string[]) => {
                list.empty();
                list.innerHTML = (arr.length ? arr : ["—"])
                    .map((s) => {
                        const m = String(s).match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
                        return m ? linkTo(m[1], m[2]) : s;
                    })
                    .join(" , ");
            };

            paint(read());

            edit.addEventListener("click", () => {
                const candidates = this.collectFromFolders(
                    ["Compendium/Items", "Compendium/Magic Items"], true
                );
                new EditListModal(this.app, {
                    title: "Edit Key Items",
                    initial: read(),
                    candidates,
                    placeholder: "Search items…",
                    onSave: async (newList) => {
                        await this.writeFmStringList(file, "key_items", newList);
                        const newFm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
                        paint(this.readFmStringList(newFm, ["key_items", "Key Items"]));
                    }
                }).open();
            });

        }

        // ——— SPELLS (editable) ————————————————————————————————
        {
            const sec = box.createDiv({ cls: "vv-gp-detail-section" });
            const h = sec.createEl("h4", { text: "Spells" });
            const edit = h.createSpan({ cls: "vv-gp-edit-link", text: "edit" });

            const get = () => this.readFmStringList(fm, ["Spells", "spells"]);

            const tableWrap = sec.createDiv();

            const paintTable = (names: string[]) => {
                tableWrap.empty();

                const st = tableWrap.createEl("table", { cls: "vv-gp-spell-table" });
                const thead = st.createEl("thead").createEl("tr");
                ["Spell", "Lvl", "Cast", "Range", "Save"].forEach(h => thead.createEl("th", { text: h }));
                const tbody = st.createEl("tbody");

                type Row = { nameHtml: string; level: number | string; cast: string; range: string; save: string };
                const rows: Row[] = [];

                const normalize = (raw: string): { linkText: string; label?: string } => {
                    const m = raw.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
                    if (m) return { linkText: m[1], label: m[2] };
                    return { linkText: raw };
                };

                for (const s of names) {
                    const n = normalize(String(s));
                    let dest = this.app.metadataCache.getFirstLinkpathDest(n.linkText, file.path);
                    if (!dest && !n.linkText.includes("/")) {
                        dest = this.app.metadataCache.getFirstLinkpathDest(`Compendium/Spells/${n.linkText}`, file.path);
                    }

                    const displayName = (n.label ?? n.linkText).split("/").pop()!.replace(/\.md$/, "").trim();
                    const nameHtml = dest
                        ? `<a class="internal-link" href="${dest.path}">${displayName}</a>`
                        : displayName;

                    const fmSpell = dest ? (this.app.metadataCache.getFileCache(dest)?.frontmatter || {}) : {};
                    const lvlRaw = fmSpell["level"];
                    const lvlNum = Number(lvlRaw);
                    const level: number | string = Number.isFinite(lvlNum) ? lvlNum : (lvlRaw ?? "—");

                    rows.push({
                        nameHtml,
                        level,
                        cast: String(fmSpell["casting_time"] ?? "—"),
                        range: String(fmSpell["Range"] ?? "—"),
                        save: (fmSpell["saving_throws"] ?? "").toString().trim() || "—",
                    });
                }

                rows.sort((a, b) => {
                    const an = typeof a.level === "number" ? a.level : 99;
                    const bn = typeof b.level === "number" ? b.level : 99;
                    return an - bn;
                });

                for (const r of rows) {
                    const tr = tbody.createEl("tr");
                    const nameTd = tr.createEl("td"); nameTd.innerHTML = r.nameHtml;
                    tr.createEl("td", { text: String(r.level) });
                    tr.createEl("td", { text: r.cast });
                    tr.createEl("td", { text: r.range });
                    tr.createEl("td", { text: r.save });
                }
            };

            const openSpellEditor = (initial: string[]) => {
                const candidates = this.collectFromFolders(["Compendium/Spells", "Spells"], true);
                new EditListModal(this.app, {
                    title: "Edit Spells",
                    initial,
                    candidates,
                    placeholder: "Search spells…",
                    onSave: async (newList) => {
                        await this.writeFmStringList(file, "Spells", newList);
                        const refreshed = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
                        paintTable(this.readFmStringList(refreshed, ["Spells", "spells"]));
                    }
                }).open();
            };

            paintTable(get());
            edit.addEventListener("click", () => openSpellEditor(get()));

        }

    }

    private startLiveUpdates() {
        // Metadata frontmatter changed (fires on save)
        this.registerEvent(
            this.app.metadataCache.on("changed", (file) => {
                if (file instanceof TFile && this.isSelectedPath(file.path)) {
                    this.queueTable();
                }
                if (this.detailsOpenPath) this.queueDetail();
            })
        );

        this.registerEvent(
            this.app.vault.on("modify", async (file) => {
                if (!(file instanceof TFile)) return;
                if (file.extension !== "md") return;
                if (file.path.startsWith(this.getActiveFolderPrefix())) {
                    await this.renderAddRow();
                }
            })
        );

        // Full metadata resolve (useful on initial index or big changes)
        this.registerEvent(
            this.app.metadataCache.on("resolved", () => {
                this.queueTable();
            })
        );

        // File content changed (extra safety)
        this.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (file instanceof TFile && this.isSelectedPath(file.path)) {
                    this.queueTable();
                }
            })
        );

        // New character note created → repopulate dropdown if it’s in the active folder
        this.registerEvent(
            this.app.vault.on("create", async (file) => {
                if (!(file instanceof TFile)) return;
                if (file.extension !== "md") return;
                if (file.path.startsWith(this.getActiveFolderPrefix())) {
                    await this.renderAddRow();
                }
            })
        );

        // Rename/move could add/remove from the active folder → refresh dropdown
        this.registerEvent(
            this.app.vault.on("rename", async (file) => {
                if (!(file instanceof TFile)) return;
                await this.renderAddRow();
            })
        );

        // Deletions affect available options too → refresh dropdown
        this.registerEvent(
            this.app.vault.on("delete", async (file) => {
                if (!(file instanceof TFile)) return;
                await this.renderAddRow();
            })
        );


        // Handle renames: keep roster paths current
        this.registerEvent(
            this.app.vault.on("rename", async (file, oldPath) => {
                if (!(file instanceof TFile)) return;
                const plugin = getToolkit(this.app);
                const s = plugin?.settings?.gameplay || {};
                const list: string[] = s.selectedPlayers || [];
                const idx = list.indexOf(oldPath);
                if (idx !== -1) {
                    list[idx] = file.path;
                    plugin.settings.gameplay.selectedPlayers = list;
                    await plugin.saveSettings();
                    this.queueTable();
                }
            })
        );

        // If a selected note is deleted, drop it from the roster
        this.registerEvent(
            this.app.vault.on("delete", async (file) => {
                if (!(file instanceof TFile)) return;
                const plugin = getToolkit(this.app);
                const s = plugin?.settings?.gameplay || {};
                const list: string[] = s.selectedPlayers || [];
                if (list.includes(file.path)) {
                    plugin.settings.gameplay.selectedPlayers = list.filter((p) => p !== file.path);
                    await plugin.saveSettings();
                    this.queueTable();
                }
            })
        );
    }

    // Read a string-array frontmatter field regardless of key casing/shape
    private readFmStringList(fm: any, keys: string[]): string[] {
        for (const k of keys) {
            const v = fm?.[k];
            if (!v) continue;
            if (Array.isArray(v)) return v.map(x => String(x));
            if (typeof v === "string") {
                // try JSON or comma list
                try { const j = JSON.parse(v); if (Array.isArray(j)) return j.map(String); } catch { }
                return v.split(",").map(s => s.trim()).filter(Boolean);
            }
        }
        return [];
    }

    // Write array back to a SINGLE canonical key (creates if missing)
    private async writeFmStringList(file: TFile, key: string, list: string[]) {
        await this.app.fileManager.processFrontMatter(file, (fm) => {
            (fm as any)[key] = list;
        });
    }


    async onOpen() {
        const cont = this.containerEl.children[1] as HTMLDivElement;
        cont.empty();

        // One big collapsible wrapper
        const party = cont.createEl("details", { attr: { open: "true" } });
        party.addClass("vv-gp-root");

        const summary = party.createEl("summary", { text: "Party Overview" });
        summary.addClass("vv-gp-summary");

        const desc = party.createDiv({ cls: "vv-gp-desc" });
        desc.setText("Add players to the list below to see their general stats. Click a name for expanded details.");

        // Everything else lives inside this body
        const body = party.createDiv({ cls: "vv-gp-root-body" });

        // build the usual sections, but inside `body`
        this.folderRow = body.createDiv({ cls: "vv-gameplay-folderrow" });
        this.addRow = body.createDiv({ cls: "vv-gameplay-addrow" });
        this.partyTableWrap = body.createDiv({ cls: "vv-gameplay-tablewrap" });
        this.detailsWrap = body.createDiv({ cls: "vv-gp-detailwrap" });
        this.detailsWrap.createDiv({ cls: "vv-gp-detail-empty", text: "Click a name to see details…" });

        // render everything
        await this.renderAddRow();
        await this.renderTable();
        this.startLiveUpdates();
    }

    async onClose() { }

    private async renderAddRow() {
        const plugin = getToolkit(this.app);
        const s = plugin?.settings?.gameplay || {};
        this.addRow.empty();

        const wrap = this.addRow.createDiv({ cls: "vv-gp-addwrap" });

        const count = (s.selectedPlayers || []).length;
        const trigger = wrap.createEl("button", { cls: "vv-gp-checkdd-trigger", text: `Add Players` });

        const clearBtn = wrap.createEl("button", { cls: "vv-gp-clearall", text: "Clear All" });
        clearBtn.addEventListener("click", async () => {
            plugin.settings.gameplay.selectedPlayers = [];
            await plugin.saveSettings();
            await this.renderTable();
            await this.renderAddRow();
        });

        const panel = this.addRow.createDiv({ cls: "vv-gp-checkdd-panel" });

        const folder = this.getActiveFolderPrefix();
        const files = this.app.vault
            .getMarkdownFiles()
            .filter(f => f.path.startsWith(folder))
            .sort((a, b) => a.basename.localeCompare(b.basename));

        const selected = new Set<string>(s.selectedPlayers || []);

        const updateCountLabel = () => {
            const n = selected.size;
            trigger.textContent = `Players (${n})`;
        };

        for (const f of files) {
            const row = panel.createDiv({ cls: "vv-gp-checkdd-row" });
            const id = `gp-${f.path.replace(/[^\w-]+/g, "_")}`;
            const cb = row.createEl("input", { type: "checkbox", attr: { id } }) as HTMLInputElement;
            cb.checked = selected.has(f.path);
            const lab = row.createEl("label", { attr: { for: id } });
            lab.textContent = f.basename;

            cb.addEventListener("change", async () => {
                if (cb.checked) selected.add(f.path); else selected.delete(f.path);
                plugin.settings.gameplay.selectedPlayers = Array.from(selected);
                await plugin.saveSettings();
                updateCountLabel();
                await this.renderTable();
            });
        }

        const open = () => {
            if (panel.classList.contains("open")) return;
            panel.classList.add("open");
            const rect = trigger.getBoundingClientRect();
            const containerRect = this.containerEl.getBoundingClientRect();
            panel.style.left = `${rect.left - containerRect.left}px`;
            panel.style.top = `${rect.bottom - containerRect.top + 4}px`;

            const onDocClick = (ev: MouseEvent) => {
                if (panel.contains(ev.target as Node) || trigger.contains(ev.target as Node)) return;
                close();
            };
            const onEsc = (ev: KeyboardEvent) => { if (ev.key === "Escape") close(); };
            const close = () => {
                panel.classList.remove("open");
                document.removeEventListener("mousedown", onDocClick, true);
                document.removeEventListener("keydown", onEsc, true);
            };
            // stash close so we can reuse
            (panel as any)._close = close;

            document.addEventListener("mousedown", onDocClick, true);
            document.addEventListener("keydown", onEsc, true);
        };

        trigger.addEventListener("click", () => {
            if (panel.classList.contains("open")) (panel as any)._close?.(); else open();
        });
    }


    // ── Party table ─────────────────────────────────────────────────────
    private async renderTable() {
        const plugin = getToolkit(this.app);
        const s = plugin?.settings?.gameplay || {};
        this.partyTableWrap!.empty();

        const paths: string[] = s.selectedPlayers || [];
        if (!paths.length) {
            this.partyTableWrap!.createEl("div", { text: "No players selected.", cls: "vv-gp-empty" });
            return;
        }

        const rows: PlayerRow[] = [];
        for (const p of paths) {
            const file = this.app.vault.getAbstractFileByPath(p);
            if (!(file instanceof TFile)) continue;
            const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
            const name = (fm["Name"] ?? file.basename) as string;

            const wis = Number(fm["wisdom"] ?? 10);
            const wisMod = Math.floor((wis - 10) / 2);
            const prof = Number(
                fm["Proficiency bonus"] ?? fm["Proficiency Bonus"] ?? 0
            );
            const rawSkills = fm["skills"] ?? fm["Skill Proficiencies"];
            const skillsArr: string[] =
                Array.isArray(rawSkills) ? rawSkills.map(String) :
                    typeof rawSkills === "string" ? rawSkills.split(",").map(s => s.trim()) :
                        [];
            const hasPerception = skillsArr.some(s => s.toLowerCase() === "perception");
            const pp = 10 + wisMod + (hasPerception ? prof : 0);

            const ac = (fm["ac"] ?? "N/A") + "";
            const hpM = (fm["hp"] ?? "N/A") + "";
            const hpC = (fm["current_hp"] ?? fm["hp"] ?? "N/A") + "";
            const spdRaw = (fm["Speed"] ?? fm["speed"] ?? "") + "";
            const spd = sanitizeSpeed(spdRaw);
            let alnRaw = (fm["Alignment"] ?? fm["Alignnment"] ?? "") + "";
            let aln = "—";
            if (alnRaw) {
                const key = alnRaw.toLowerCase().trim();
                aln = ALIGN_ABBR[key] ?? alnRaw;
            }

            rows.push({
                file, name,
                ac: ac || "N/A",
                hpCur: hpC || "N/A",
                hpMax: hpM || "N/A",
                speed: spd || "N/A",
                align: aln,
                pp
            });
        }

        rows.sort((a, b) => a.name.localeCompare(b.name));

        const table = this.partyTableWrap!.createEl("table", { cls: "vv-gp-table" });
        const cg = table.createEl("colgroup");
        [
            ["name", ""],        // auto → absorbs leftover space
            ["pp", "pp"],
            ["ac", "ac"],
            ["hp", "hp"],
            ["spd", "spd"],
            ["aln", "aln"],
            ["rm", "rm"],        // the tiny × column
        ].forEach(([cls]) => cg.createEl("col", { cls: `vv-col-${cls}` }));
        const thead = table.createEl("thead");
        const trH = thead.createEl("tr");
        ["Name", "PP", "AC", "HP", "Spd", "Align"].forEach(h => {
            trH.createEl("th", { text: h });
        });

        const tbody = table.createEl("tbody");
        for (const r of rows) {
            const tr = tbody.createEl("tr");

            // name
            const nameTd = tr.createEl("td");
            const a = nameTd.createEl("a", { text: r.name, href: r.file.path });
            a.addEventListener("click", async (e) => {
                e.preventDefault();
                // Cmd/Ctrl-click still opens the note
                if (e.metaKey || e.ctrlKey) {
                    this.app.workspace.openLinkText(r.file.path, "", false);
                    return;
                }
                await this.showDetails(r.file);
            });

            // pp
            tr.createEl("td", { text: String(r.pp), attr: { style: "text-align:center; white-space:nowrap;" } });

            // ac
            tr.createEl("td", { text: r.ac, attr: { style: "text-align:center; white-space:nowrap;" } });

            // HP cell (editable CUR / static MAX)
            {
                const td = tr.createEl("td");
                const wrap = td.createDiv({ cls: "vv-gp-hpwrap", attr: { title: "Click to edit current HP" } });

                // current HP input
                const cur = wrap.createEl("input", { type: "text", cls: "vv-gp-hpcur" }) as HTMLInputElement;
                cur.value = String(r.hpCur ?? "");
                cur.inputMode = "numeric";
                cur.pattern = "\\d*";

                // separator and max
                wrap.createSpan({ text: "/", cls: "vv-gp-hpsep" });
                wrap.createSpan({ text: String(r.hpMax ?? "N/A"), cls: "vv-gp-hpmax" });

                const commit = async () => {
                    const cleaned = cur.value.trim();
                    if (!/^\d+$/.test(cleaned)) { new Notice("HP must be a number"); cur.value = String(r.hpCur ?? ""); return; }
                    if (cleaned === String(r.hpCur ?? "")) return;
                    try {
                        await this.saveFrontmatterNumber(r.file, "current_hp", Number(cleaned));
                        r.hpCur = cleaned;
                    } catch (e) {
                        console.error(e);
                        new Notice("Failed to update HP");
                        cur.value = String(r.hpCur ?? "");
                    }
                };

                cur.addEventListener("keydown", (ev) => {
                    if (ev.key === "Enter") { ev.preventDefault(); (ev.target as HTMLInputElement).blur(); }
                    if (ev.key === "Escape") { ev.preventDefault(); cur.value = String(r.hpCur ?? ""); cur.blur(); }
                });
                cur.addEventListener("blur", commit);
            }

            // speed / align / lang
            tr.createEl("td", { text: r.speed, attr: { style: "text-align:center; white-space:nowrap;" } });
            tr.createEl("td", { text: r.align, attr: { style: "text-align:center; white-space:nowrap;" } });

            const rmTd = tr.createEl("td", { cls: "vv-gp-rmcell" });

            const rmBtn = rmTd.createEl("button", { text: "x", cls: "vv-gp-rm-btn" });
            rmBtn.setAttr("title", "Remove from roster");

            rmBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                const plugin = getToolkit(this.app);
                const s = plugin?.settings?.gameplay || {};
                const list: string[] = s.selectedPlayers || [];
                const idx = list.indexOf(r.file.path);
                if (idx !== -1) {
                    list.splice(idx, 1);
                    plugin.settings.gameplay.selectedPlayers = list;
                    await plugin.saveSettings();
                    await this.renderTable();
                    this.startLiveUpdates();
                }
            });

        }
    }
}
