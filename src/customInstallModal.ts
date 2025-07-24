// customInstallModal.ts
import { App, Modal, setIcon, Notice } from 'obsidian';
import type VVunderloreToolkitPlugin from './main';

export class InstallingModal extends Modal {
  constructor(app: App) {
    super(app);
  }
  onOpen() {
    this.contentEl.empty();
    this.contentEl
      .createDiv({ text: 'Installing…', cls: 'mod-quiet' })
      .style.cssText =
      'font-style: italic; color: var(--text-muted); text-align: center; padding: 1em;';
  }
  onClose() {
    this.contentEl.empty();
  }
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  children: Record<string, TreeNode>;
}

/**
 * Shows a “Custom Install” modal. Once the user clicks “Install Selected,”
 * this hands back an array of `{ path, isFolder }` to `plugin.performCustomInstall(...)`.
 */
export function showCustomInstallModal(
  app: App,
  plugin: VVunderloreToolkitPlugin
) {
  // (1) Build a quick map: fullPath → manifestKey (for dependency lookups)
  const fullPathToKey: Record<string, string> = {};
  for (const f of plugin.manifestCache.folders) {
    fullPathToKey[f.path] = f.key;
  }
  for (const f of plugin.manifestCache.files) {
    fullPathToKey[f.path] = f.key;
  }

  // (2) Build a nested TreeNode structure from manifestCache
  const root: TreeNode = { name: '', fullPath: '', isFolder: true, children: {} };

  function ensureFolderNode(segments: string[]): TreeNode {
    let cursor = root;
    let builtSoFar = '';
    for (const seg of segments) {
      builtSoFar = builtSoFar ? `${builtSoFar}/${seg}` : seg;
      if (!cursor.children[seg]) {
        cursor.children[seg] = {
          name: seg,
          fullPath: builtSoFar,
          isFolder: true,
          children: {},
        };
      }
      cursor = cursor.children[seg];
    }
    return cursor;
  }

  // Insert all folder entries first
  for (const folderEntry of plugin.manifestCache.folders) {
    const segments = folderEntry.path.split('/');
    ensureFolderNode(segments);
  }

  // Insert all file entries under their parent folder nodes
  for (const fileEntry of plugin.manifestCache.files) {
    const segments = fileEntry.path.split('/');
    const fileName = segments.pop()!;
    const parentNode = segments.length ? ensureFolderNode(segments) : root;
    parentNode.children[fileName] = {
      name: fileName,
      fullPath: fileEntry.path,
      isFolder: false,
      children: {},
    };
  }

  // (3) Define our Modal subclass
  class CustomInstallModal extends Modal {
    private checkboxMap: Record<string, HTMLInputElement> = {};
    private consoleEl: HTMLElement;                // <div> that holds “dependency console”
    private currentBatchLines: HTMLElement[] = [];  // lines from the most recent dependency pass

    // Top‐level filter checkboxes:
    private pluginCheckbox: HTMLInputElement;
    private demoCheckbox: HTMLInputElement;
    private settingsCheckbox: HTMLInputElement;

    constructor(app: App) {
      super(app);
    }

    onOpen() {
      this.contentEl.empty();
      this.titleEl.setText('Custom Install');
    
      const descriptionEl = this.contentEl.createDiv();
      descriptionEl.textContent = 'All checked items will be installed. Dependencies will be managed automatically.';
      descriptionEl.style.cssText = `
        font-size: 0.9em;
        color: var(--text-muted);
        margin-top: 0.25em;
        margin-bottom: 0.75em;
      `;

      //
      // ─── (A) SINGLE SCROLLABLE BOX FOR “OPTIONS + TREE” ─────────────────────
      //
      const optionsBox = this.contentEl.createDiv();
      Object.assign(optionsBox.style, {
        maxHeight: '480px',               // Enough space for checkboxes + tree
        overflowY: 'auto',                // Everything inside optionsBox will scroll
        margin: '0.5em 0',
        border: '1px solid var(--divider-color)',
        borderRadius: '4px',
        padding: '0.5em',
      });
    
      //
      // ─── (A1) “Include …” CHECKBOXES AT THE TOP ─────────────────────────────
      //
      // We create one small “checkbox panel” that sits at the top of optionsBox.
      const checkboxSection = optionsBox.createDiv();
      Object.assign(checkboxSection.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5em',
        marginBottom: '0.75em',
      });
    
      // 1) “Include Plugins”
      const pluginRow = checkboxSection.createDiv();
      pluginRow.style.display = 'flex';
      pluginRow.style.alignItems = 'center';
      this.pluginCheckbox = pluginRow.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
      this.pluginCheckbox.checked = true;
      this.pluginCheckbox.id = 'vvunderlore-checkbox-plugins';
      this.pluginCheckbox.style.marginRight = '0.5em';
      pluginRow.createEl('label', {
        text: 'Community Plugins',
        attr: { for: this.pluginCheckbox.id },
      });
    
      // 2) “Include Demo Files”
      const demoRow = checkboxSection.createDiv();
      demoRow.style.display = 'flex';
      demoRow.style.alignItems = 'center';
      this.demoCheckbox = demoRow.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
      this.demoCheckbox.checked = true;
      this.demoCheckbox.id = 'vvunderlore-checkbox-demo';
      this.demoCheckbox.style.marginRight = '0.5em';
      demoRow.createEl('label', {
        text: 'VVunderlore Demo Files',
        attr: { for: this.demoCheckbox.id },
      });
    
      // 3) “Include Vault Settings (hotkeys, etc.)”
      const settingsRow = checkboxSection.createDiv();
      settingsRow.style.display = 'flex';
      settingsRow.style.alignItems = 'center';
      this.settingsCheckbox = settingsRow.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
      this.settingsCheckbox.checked = true;
      this.settingsCheckbox.id = 'vvunderlore-checkbox-settings';
      this.settingsCheckbox.style.marginRight = '0.5em';
      settingsRow.createEl('label', {
        text: 'Vault Settings (apperance, hotkeys, graph setup, etc.)',
        attr: { for: this.settingsCheckbox.id },
      });
    
      //
      // ─── (A2) THIN DIVIDER LINE BETWEEN CHECKBOXES AND TREE ─────────────────
      //
      const divider = optionsBox.createDiv();
      Object.assign(divider.style, {
        borderTop: '1px solid var(--divider-color)',
        margin: '0.5em 0',
      });
    
      //
      // ─── (A3) MANIFEST TREE RENDERED BELOW THE DIVIDER ───────────────────────
      //
      const container = optionsBox.createDiv();
      Object.assign(container.style, {
        // We no longer give this inner div its own scrollbar.
        // Instead, container will expand inside optionsBox, and
        // optionsBox will scroll everything (checkboxes + tree) together.
        margin: '0',
        padding: '0',
        border: 'none',
      });
    
      const INDENT_PX = 16;
      const lookupEntry = (fullPath: string) => {
        return (
          plugin.manifestCache.folders.find((f) => f.path === fullPath) ||
          plugin.manifestCache.files.find((f) => f.path === fullPath)
        );
      };
    
      // Rerender logic for the tree; hides optional items if the demoCheckbox is unchecked
      const renderTree = () => {
        container.empty();
        this.checkboxMap = {};
        this.currentBatchLines = [];
    
        const demoAllowed = this.demoCheckbox.checked;
    
        const renderNode = (node: TreeNode, parentEl: HTMLElement, indent = 0) => {
          // If this node corresponds to a manifest entry:
          if (node.fullPath) {
            const entry = lookupEntry(node.fullPath);
            if (entry && entry.optional && !demoAllowed) {
              // Skip optional demo items when “Include Demo Files” is false
              return;
            }
          }
    
          if (node.isFolder) {
            // ─── FOLDER CASE ─────────────────────────────────────
            const details = parentEl.createEl('details');
            details.open = true;
            details.style.margin = '4px 0';
    
            const summary = details.createEl('summary');
            Object.assign(summary.style, {
              display: 'flex',
              alignItems: 'center',
              marginLeft: `${indent * INDENT_PX}px`,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
              userSelect: 'none',
            });
            summary.addEventListener('mouseenter', () => {
              summary.style.backgroundColor = 'var(--background-modifier-hover)';
            });
            summary.addEventListener('mouseleave', () => {
              summary.style.backgroundColor = 'transparent';
            });
    
            // (1) Folder checkbox
            const cb = summary.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
            cb.style.marginRight = '0.5em';
            cb.checked = true;
            cb.style.cursor = 'pointer';
            this.checkboxMap[node.fullPath] = cb;
    
            // (2) Folder icon
            const iconEl = summary.createDiv({ cls: 'suggestion-icon' });
            setIcon(iconEl, 'folder');
            iconEl.style.marginRight = '0.3em';
            iconEl.style.transform = 'scale(0.9)';
            iconEl.style.opacity = '0.75';
    
            // (3) Folder label
            const label = summary.createEl('span', { text: node.name });
            label.style.fontWeight = '600';
            label.style.fontSize = '0.95em';
    
            // (4) When folder‐checkbox toggles:
            cb.onchange = () => {
              this.toggleDescendants(node, cb.checked);
              this.enforceDependencies(node.fullPath, cb.checked);
              this.fadeAllExceptCurrentBatch();
            };
    
            // (5) Recurse into children
            const childrenContainer = details.createDiv();
            childrenContainer.style.marginTop = '4px';
            for (const childName of Object.keys(node.children).sort()) {
              renderNode(node.children[childName], childrenContainer, indent + 1);
            }
          } else {
            // ─── FILE CASE ─────────────────────────────────────────
            const row = parentEl.createDiv();
            Object.assign(row.style, {
              display: 'flex',
              alignItems: 'center',
              marginLeft: `${indent * INDENT_PX}px`,
              padding: '2px 6px',
              borderRadius: '4px',
              marginTop: '2px',
              marginBottom: '2px',
              userSelect: 'none',
            });
            row.addEventListener('mouseenter', () => {
              row.style.backgroundColor = 'var(--background-modifier-hover)';
            });
            row.addEventListener('mouseleave', () => {
              row.style.backgroundColor = 'transparent';
            });
    
            // (1) File checkbox
            const cb = row.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
            cb.style.marginRight = '0.5em';
            cb.checked = true;
            cb.style.cursor = 'pointer';
            this.checkboxMap[node.fullPath] = cb;
    
            // (2) File icon
            const iconEl = row.createDiv({ cls: 'suggestion-icon' });
            setIcon(iconEl, 'document');
            iconEl.style.marginRight = '0.3em';
            iconEl.style.transform = 'scale(0.8)';
            iconEl.style.opacity = '0.5';
    
            // (3) File label
            const label = row.createEl('label', { text: node.name });
            label.style.fontSize = '0.9em';
    
            // (4) When file‐checkbox toggles:
            cb.onchange = () => {
              this.enforceDependencies(node.fullPath, cb.checked);
              this.fadeAllExceptCurrentBatch();
            };
          }
        };
    
        // Kick off recursion at root
        for (const topName of Object.keys(root.children).sort()) {
          renderNode(root.children[topName], container, 0);
        }
      };
    
      // First draw of the tree (below the divider)
      renderTree();
    
      //
      // ─── (B) DEPENDENCY CONSOLE BELOW THE SCROLLABLE OPTIONS BOX ─────────────
      //
      this.consoleEl = this.contentEl.createDiv({ cls: 'custom-console' });
      Object.assign(this.consoleEl.style, {
        height: '140px',
        margin: '0.5em 0',
        padding: '8px',
        backgroundColor: 'var(--background-secondary)',
        border: '1px solid var(--divider-color)',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '0.82em',
        lineHeight: '1.4em',
        color: 'var(--text-normal)',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
      });
      const placeholder = this.consoleEl.createDiv({
        text: '> Dependency errors and warnings will appear here…',
      });
      Object.assign(placeholder.style, {
        opacity: '0.4',
        fontStyle: 'italic',
        marginBottom: '4px',
      });
    
      //
      // ─── (C) EVENT HANDLERS FOR THE THREE CHECKBOXES ───────────────────────
      //
      // 1) “Include Plugins” toggled
      this.pluginCheckbox.onchange = () => {
        const WARNING_CLASS = 'vvunderlore-warning';
        if (!this.pluginCheckbox.checked) {
          // If console only has the placeholder, clear it
          if (
            this.consoleEl.children.length === 1 &&
            (this.consoleEl.children[0] as HTMLElement).textContent?.startsWith(
              '> Dependency console'
            )
          ) {
            this.consoleEl.empty();
          }
    
          // Add a red warning line
          const warningLine = this.consoleEl.createDiv({
            text:
              'WARNING: The VVunderlore Toolkit will not function without all included plugins! You probably want to re-check that one.',
          });
          warningLine.addClass(WARNING_CLASS);
          warningLine.style.color = '#FF0000';
    
          // Scroll console to bottom
          this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
        } else {
          // Remove only our warning lines (leave any other messages alone)
          const existingWarnings = this.consoleEl.querySelectorAll(`.${WARNING_CLASS}`);
          existingWarnings.forEach((el) => el.remove());
    
          // If console is now empty, re‐insert the placeholder
          if (this.consoleEl.children.length === 0) {
            const ph = this.consoleEl.createDiv({
              text: '> Dependency console output will appear here…',
            });
            Object.assign(ph.style, {
              opacity: '0.4',
              fontStyle: 'italic',
              marginBottom: '4px',
            });
          }
    
          // Scroll to bottom again
          this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
        }
      };
    
      // 2) “Include Demo Files” toggled
      this.demoCheckbox.onchange = () => {
        renderTree();
      };
    
      // 3) “Include Vault Settings” toggled
      // (no need to re-render the tree, since vault settings aren’t in the manifest tree)
    
      //
      const buttonRow = this.contentEl.createDiv();
      Object.assign(buttonRow.style, {
        display: 'flex',
        justifyContent: 'space-between',   // push left vs right
        alignItems: 'center',
        paddingTop: '8px',
        borderTop: '1px solid var(--divider-color)',
        marginTop: '8px',
      });
      
      // 1) “Reset Selection” on the LEFT
      const resetBtn = buttonRow.createEl('button', { text: 'Reset Selection' });
      resetBtn.style.cssText = `
        font-size: 0.9em;
        color: var(--text-normal);
      `;
      resetBtn.onclick = () => {
        // 1) Gather any existing WARNING lines
        const warnings = Array.from(
          this.consoleEl.querySelectorAll('.vvunderlore-warning')
        ) as HTMLElement[];
      
        // 2) Wipe out the console entirely (this removes all dependency lines)
        this.consoleEl.empty();
      
        // 3) Re‐append each plugin‐warning back into the console
        warnings.forEach((warningEl) => {
          this.consoleEl.appendChild(warningEl);
        });
      
        // 4) Re‐check every single manifest‐tree checkbox
        Object.values(this.checkboxMap).forEach((cb) => {
          cb.checked = true;
        });
      };
      
      
      // 2) Create a right‐aligned sub‐container for “Install Selected” + “Cancel”
      const rightGroup = buttonRow.createDiv();
      Object.assign(rightGroup.style, {
        display: 'flex',
        gap: '0.5em',
      });
      
      // 2a) “Install Selected” (primary CTA)
      const installBtn = rightGroup.createEl('button', {
        text: 'Install Selected',
        cls: 'mod-cta',
      });
      installBtn.onclick = async () => {
        installBtn.setAttribute('disabled', '');
      
        // (i) Close this custom‐install modal
        this.close();
      
        // (ii) Show “Installing…” placeholder
        const installing = new InstallingModal(app);
        installing.open();
      
        // (iii) Gather all checked manifest entries
        const toInstall: { path: string; isFolder: boolean }[] = [];
        for (const [fp, checkbox] of Object.entries(this.checkboxMap)) {
          if (checkbox.checked) {
            const isFolder = plugin.manifestCache.folders.some((f) => f.path === fp);
            toInstall.push({ path: fp, isFolder });
          }
        }
      
        // (iv) If “Include Plugins” is checked → pull down `.obsidian/plugins` + `community-plugins.json`
        // (iv) If “Include Plugins” is checked → fetch the GitHub-side .obsidian/plugins and only enqueue
//     those folders/files that aren’t already in the vault.
if (this.pluginCheckbox.checked) {
  try {
    const apiUrl =
      'https://api.github.com/repos/slamwise0001/VVunderlore-Toolkit-Full/contents/.obsidian/plugins?ref=main';
    const resp = await fetch(apiUrl);
    if (resp.ok) {
      const pluginFiles: Array<{ name: string; type: 'file' | 'dir' }> = await resp.json();
      for (const item of pluginFiles) {
        const localPath = `.obsidian/plugins/${item.name}`;
        // If that plugin folder (or file) does _not_ already exist in the vault, enqueue it:
        const existsLocally = await this.app.vault.adapter.exists(localPath);
        if (!existsLocally) {
          if (item.type === 'dir') {
            toInstall.push({ path: localPath, isFolder: true });
          } else {
            toInstall.push({ path: localPath, isFolder: false });
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to enumerate .obsidian/plugins from GitHub:', e);
  }

  // Even if community-plugins.json already exists, you might want to overwrite it,
  // or you can also check adapter.exists(...) before pushing it. Example always overwrites:
  toInstall.push({ path: '.obsidian/community-plugins.json', isFolder: false });
}

      
        // (v) If “Include Vault Settings” is checked → add the four JSON files under `.obsidian/`
        if (this.settingsCheckbox.checked) {
          const vaultSettingsPaths = [
            '.obsidian/app.json',
            '.obsidian/appearance.json',
            '.obsidian/graph.json',
            '.obsidian/hotkeys.json',
          ];
          for (const vs of vaultSettingsPaths) {
            toInstall.push({ path: vs, isFolder: false });
          }
        }
      
        // (vi) Perform the actual install
        try {
          await plugin.performCustomInstall(toInstall);
        } catch (err) {
          console.error('❌ performCustomInstall() threw:', err);
          new Notice('❌ Custom install failed—see console');
        } finally {
          installing.close();
        }
      };
      
      // 2b) “Cancel” on the right
      const cancelBtn = rightGroup.createEl('button', { text: 'Cancel' });
      cancelBtn.onclick = () => this.close();
    }
    

    onClose() {
      this.contentEl.empty();
    }

    /** Recursively toggle descendants’ checked‐state without logging each one. */
    private toggleDescendants(node: TreeNode, checked: boolean) {
      for (const child of Object.values(node.children)) {
        const cb = this.checkboxMap[child.fullPath];
        if (cb) cb.checked = checked;
        if (child.isFolder) {
          this.toggleDescendants(child, checked);
        }
      }
    }

    /**
     * Enforce dependency logic (auto‐check prerequisites, auto‐uncheck dependents).
     * Each time we flip a box “because of a dependency,” we log one line to the console.
     */
    private enforceDependencies(changedPath: string, isChecked: boolean) {
      const changedKey = fullPathToKey[changedPath];
      if (!changedKey) return;

      // Build a quick map: fullPath → displayName
      const fullPathToDisplay: Record<string, string> = {};
      for (const f of plugin.manifestCache.folders) {
        fullPathToDisplay[f.path] = f.displayName ?? f.path.split('/').pop()!;
      }
      for (const f of plugin.manifestCache.files) {
        fullPathToDisplay[f.path] = f.displayName ?? f.path.split('/').pop()!;
      }
      const changedName = fullPathToDisplay[changedPath] ?? changedPath.split('/').pop()!;

      // Start a new “batch”:
      this.currentBatchLines = [];

      if (isChecked) {
        // ▶ Auto‐check prerequisites
        const stack = [changedKey];
        while (stack.length) {
          const cur = stack.pop()!;
          const deps = plugin.requiresGraph.get(cur) ?? [];
          for (const depKey of deps) {
            const depEntry =
              plugin.manifestCache.files.find((x) => x.key === depKey) ||
              plugin.manifestCache.folders.find((x) => x.key === depKey);
            if (depEntry) {
              const depPath = depEntry.path;
              const cb = this.checkboxMap[depPath];
              if (cb && !cb.checked) {
                cb.checked = true;
                const depName = fullPathToDisplay[depPath] ?? depPath.split('/').pop()!;
                const lineEl = this.appendLogLine(
                  depPath,
                  `> ${depName} automatically checked (required by ${changedName})`
                );
                this.currentBatchLines.push(lineEl);
                stack.push(depKey);
              }
            }
          }
        }
      } else {
        // ▶ Auto‐uncheck dependents
        const dependentsOf = (targetKey: string) =>
          Array.from(plugin.requiresGraph.entries())
            .filter(([, deps]) => deps.includes(targetKey))
            .map(([k]) => k);

        const stack = [changedKey];
        while (stack.length) {
          const cur = stack.pop()!;
          for (const childKey of dependentsOf(cur)) {
            const childEntry =
              plugin.manifestCache.files.find((x) => x.key === childKey) ||
              plugin.manifestCache.folders.find((x) => x.key === childKey);
            if (childEntry) {
              const childPath = childEntry.path;
              const cb = this.checkboxMap[childPath];
              if (cb && cb.checked) {
                cb.checked = false;
                const childName = fullPathToDisplay[childPath] ?? childPath.split('/').pop()!;
                const lineEl = this.appendLogLine(
                  childPath,
                  `> ${childName} automatically unchecked (depends on ${changedName})`
                );
                this.currentBatchLines.push(lineEl);
                stack.push(childKey);
              }
            }
          }
        }
      }

      this.fadeAllExceptCurrentBatch();
    }

    /**
     * Append one “mono” line plus a tiny undo button. Returns the new <div>.
     */
    private appendLogLine(fullPath: string, text: string): HTMLElement {

      // (2) Build a new <div> for this line
      const line = this.consoleEl.createDiv();
      Object.assign(line.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '2px 0',
        opacity: '1.0',
        transition: 'opacity 0.2s ease',
      });

      // (3) Left: the message text
      line.createSpan({ text });

      // (4) Right: “undo” button
      const undoBtn = line.createEl('button', { text: 'undo', cls: 'mod-small' });
      Object.assign(undoBtn.style, {
        marginLeft: '0.5em',
        fontSize: '0.75em',
        padding: '2px 4px',
        cursor: 'pointer',
      });
      undoBtn.onclick = () => {
        const cb = this.checkboxMap[fullPath];
        if (cb) {
          cb.checked = !cb.checked;
          this.enforceDependencies(fullPath, cb.checked);
          this.fadeAllExceptCurrentBatch();
        }
      };

      // (5) Scroll the console to bottom
      this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
      return line;
    }

    /** Fade out every console line that is *not* part of currentBatchLines. */
    private fadeAllExceptCurrentBatch() {
      const total = this.consoleEl.children.length;
      for (let i = 0; i < total; i++) {
        const child = this.consoleEl.children[i] as HTMLElement;
        if (this.currentBatchLines.includes(child)) {
          child.style.opacity = '1.0';
        } else {
          child.style.opacity = '0.6';
        }
      }
    }
  }

  // (4) Finally, open the modal
  new CustomInstallModal(app).open();
}
