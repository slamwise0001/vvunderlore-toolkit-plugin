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
 * Shows a “Custom Install” modal.  Once the user clicks “Install Selected,”
 * this will hand back an array of `{ path, isFolder }` to `plugin.performCustomInstall(...)`.
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

  // Helper: ensureFolderNode(["Foo","Bar"]) creates (or returns) root.children["Foo"].children["Bar"]
  const ensureFolderNode = (segments: string[]): TreeNode => {
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
  };

  // (2a) Insert all folder entries first
  for (const folderEntry of plugin.manifestCache.folders) {
    const segments = folderEntry.path.split('/');
    ensureFolderNode(segments);
  }

  // (2b) Insert all file entries under their parent folder nodes
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
    private consoleEl: HTMLElement;      // <div> that will hold “dependency console” lines
    private currentBatchLines: HTMLElement[] = [];  // which console lines were added by the most recent dependency pass

    constructor(app: App) {
      super(app);
    }

    onOpen() {
      this.titleEl.setText('Custom Install');

      // (A) Build a scrollable “tree” container
      const container = this.contentEl.createDiv();
      Object.assign(container.style, {
        maxHeight: '300px',        // leave room below for console
        overflowY: 'auto',
        margin: '0.5em 0',
        border: '1px solid var(--divider-color)',
        borderRadius: '4px',
        padding: '4px',
      });

      // (B) How many px per indent level?
      const INDENT_PX = 16;

      // (C) Recursive renderer function:
      const renderNode = (node: TreeNode, parentEl: HTMLElement, indent = 0) => {
        if (node.isFolder) {
          // ─── FOLDER CASE ─────────────────────────────────────
          const details = parentEl.createEl('details');
          details.open = true;
          details.style.margin = '4px 0';

          const summary = details.createEl('summary');
          Object.assign(summary.style, {
            display: 'flex',
            alignItems: 'center',
            marginLeft: `${indent * INDENT_PX}px`,   // use marginLeft so the checkbox + icon align
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

          // 1) Folder checkbox:
          const cb = summary.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
          cb.style.marginRight = '0.5em';
          cb.checked = true;
          cb.style.cursor = 'pointer';
          this.checkboxMap[node.fullPath] = cb;

          // 2) Folder icon:
          const iconEl = summary.createDiv({ cls: 'suggestion-icon' });
          setIcon(iconEl, 'folder');
          iconEl.style.marginRight = '0.3em';
          iconEl.style.transform = 'scale(0.9)';
          iconEl.style.opacity = '0.75';

          // 3) Folder label (bold):
          const label = summary.createEl('span', { text: node.name });
          label.style.fontWeight = '600';
          label.style.fontSize = '0.95em';

          // 4) Toggling this folder checkbox:
          cb.onchange = () => {
            // Do NOT log each descendant; just flip them underneath.
            this.toggleDescendants(node, cb.checked);
            this.enforceDependencies(node.fullPath, cb.checked);
            this.fadeAllExceptCurrentBatch();
          };

          // 5) Recurse into children
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

          // 1) File checkbox
          const cb = row.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
          cb.style.marginRight = '0.5em';
          cb.checked = true;
          cb.style.cursor = 'pointer';
          this.checkboxMap[node.fullPath] = cb;

          // 2) File icon
          const iconEl = row.createDiv({ cls: 'suggestion-icon' });
          setIcon(iconEl, 'document');
          iconEl.style.marginRight = '0.3em';
          iconEl.style.transform = 'scale(0.8)';
          iconEl.style.opacity = '0.5';

          // 3) File label
          const label = row.createEl('label', { text: node.name });
          label.style.fontSize = '0.9em';

          // 4) When this file checkbox flips:
          cb.onchange = () => {
            this.enforceDependencies(node.fullPath, cb.checked);
            this.fadeAllExceptCurrentBatch();
          };
        }
      };

      // (D) Kick off the recursion at root level:
      for (const topName of Object.keys(root.children).sort()) {
        renderNode(root.children[topName], container, 0);
      }

      // (E) Build the “console” panel immediately below the tree
      this.consoleEl = this.contentEl.createDiv({ cls: 'custom-console' });
      Object.assign(this.consoleEl.style, {
        height: '180px',     // made a bit taller so you see more lines
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
        text: '> Dependency console output will appear here…',
      });
      Object.assign(placeholder.style, {
        opacity: '0.4',
        fontStyle: 'italic',
        marginBottom: '4px',
      });

      // (F) Finally, add a separator + “Install Selected” button at the bottom
      const buttonRow = this.contentEl.createDiv();
      Object.assign(buttonRow.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        paddingTop: '8px',
        borderTop: '1px solid var(--divider-color)',
        marginTop: '8px',
      });
      const installBtn = buttonRow.createEl('button', {
        text: 'Install Selected',
        cls: 'mod-cta',
      });
      installBtn.onclick = async () => {
        // Prevent double‐click
        installBtn.setAttribute('disabled', '');
      
        // 1) Close the CustomInstallModal immediately
        this.close();
      
        // 2) Show the “Installing…” placeholder
        const installing = new InstallingModal(app);
        installing.open();
      
        // 3) Gather all checked paths
        const toInstall: { path: string; isFolder: boolean }[] = [];
        for (const [fp, checkbox] of Object.entries(this.checkboxMap)) {
          if (checkbox.checked) {
            const isFolder = plugin.manifestCache.folders.some(f => f.path === fp);
            toInstall.push({ path: fp, isFolder });
          }
        }
      
        // 4) Run performCustomInstall, then close the InstallingModal
        try {
          await plugin.performCustomInstall(toInstall);
        } catch (err) {
          console.error('❌ performCustomInstall() threw:', err);
          new Notice('❌ Custom install failed—see console');
        } finally {
          installing.close();
        }
      };
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
     * Each time we actually flip a box “because of a dependency,” we log one line
     * to the console and collect it into currentBatchLines.  After the batch is done,
     * we fade everything except the newest batch.
     */
    private enforceDependencies(changedPath: string, isChecked: boolean) {
      const changedKey = fullPathToKey[changedPath];
      if (!changedKey) return;

      // Build a quick map: fullPath → displayName (using displayName if available)
      const fullPathToDisplay: Record<string, string> = {};
      for (const f of plugin.manifestCache.folders) {
        fullPathToDisplay[f.path] = f.displayName ?? f.path.split('/').pop()!;
      }
      for (const f of plugin.manifestCache.files) {
        fullPathToDisplay[f.path] = f.displayName ?? f.path.split('/').pop()!;
      }
      const changedName = fullPathToDisplay[changedPath] ?? changedPath.split('/').pop()!;

      // Start a brand‐new “batch”:
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
                // check it and log it
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
     * Append one “mono” line plus a tiny undo button.  Returns the new <div> so we can track it.
     */
    private appendLogLine(fullPath: string, text: string): HTMLElement {
      // 1) If the very first child is still placeholder text, remove it.
      if (
        this.consoleEl.children.length === 1 &&
        (this.consoleEl.children[0] as HTMLElement).textContent?.startsWith(
          '> Dependency console'
        )
      ) {
        this.consoleEl.children[0].remove();
      }

      // 2) Build a new <div> for this line
      const line = this.consoleEl.createDiv();
      Object.assign(line.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '2px 0',
        opacity: '1.0',             // newest line = fully opaque
        transition: 'opacity 0.2s ease',
      });

      // 3) Left: the message text
      const messageSpan = line.createSpan({ text });

      // 4) Right: “undo” button
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
          // re‐run dependency logic on that exact path:
          this.enforceDependencies(fullPath, cb.checked);
          this.fadeAllExceptCurrentBatch();
        }
      };

      // 5) Scroll console to bottom
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

  // (4) Fire it off:
  new CustomInstallModal(app).open();
}
