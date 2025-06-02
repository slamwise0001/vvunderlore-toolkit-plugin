import { normalizePath, Vault } from 'obsidian';
import { dirname, basename, join } from 'path';
import { promises as fs } from 'fs';

export class BackupManager {
  constructor(private vault: Vault) {}

  /**
   * Mirror every vault file (excluding .obsidian & backups) into a timestamped folder,
   * then prune to keep only the latest N full snapshots.
   * @param label Optional suffix for the backup folder name
   * @param maxFullBackups Number of full snapshots to retain (default: 5)
   */
  async backupVaultMirror(label?: string, maxFullBackups: number = 5): Promise<string> {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const tag = label ? `-${label}` : '';
    const base = normalizePath(`.vault-backups/full/${ts}${tag}`);
    console.log(`[BackupManager] Starting mirror backup: ${base}`);

    await this.ensureFolderExists(base);

    for (const file of this.vault.getFiles()) {
      if (file.path.startsWith('.vault-backups/') || file.path.startsWith('.obsidian/')) {
        continue;
      }
      const content = await this.vault.read(file);
      const target = normalizePath(`${base}/${file.path}`);
      await this.ensureFolderExists(dirname(target));
      await this.vault.create(target, content);
    }

    console.log('[BackupManager] Mirror backup complete. Pruning old backups...');
    await this.pruneFullBackups(base, maxFullBackups);
   // console.log('[BackupManager] Pruning complete.');
    return base;
  }

  /**
   * Legacy alias for mirror-based backups
   */
  async backupVaultToZip(label?: string): Promise<string> {
    return this.backupVaultMirror(label);
  }

  /**
   * Deletes oldest full backup folders, keeping only the most recent `keep` snapshots.
   */
  private async pruneFullBackups(currentPath: string, keep: number) {
    const root = normalizePath('.vault-backups/full');
   // console.log(`[BackupManager] pruneFullBackups: root=${root}, keep=${keep}`);

    // ensure the root exists
    await this.ensureFolderExists(root);
    if (!(await this.vault.adapter.exists(root))) {
     // console.log('[BackupManager] pruneFullBackups: root folder not found');
      return;
    }

    // get folder names
    const listing = await this.vault.adapter.list(root);
    const rawFolders: string[] = Array.isArray(listing)
      ? listing as string[]
      : 'folders' in listing
      ? (listing as any).folders
      : [];
    const folders = rawFolders.map(f => basename(f));
    //console.log('[BackupManager] pruneFullBackups: folders (basenames):', folders);

    // sort descending so newest first
    const sorted = [...folders].sort((a, b) => b.localeCompare(a));
    //console.log('[BackupManager] pruneFullBackups: sorted:', sorted);

    // compute filesystem root to remove from
    const adapterAny = this.vault.adapter as any;
    const fsRoot = adapterAny.basePath ? join(adapterAny.basePath, root) : null;
    if (!fsRoot) {
      //console.warn('[BackupManager] pruneFullBackups: cannot determine FS root, skipping prune');
      return;
    }

    // remove old snapshots beyond `keep`
    for (let i = keep; i < sorted.length; i++) {
      const name = sorted[i];
      const vaultPath = normalizePath(`${root}/${name}`);
      if (vaultPath === currentPath) {
       // console.log(`[BackupManager] pruneFullBackups: skipping current ${name}`);
        continue;
      }
      //console.log(`[BackupManager] pruneFullBackups: removing FS folder: ${name}`);
      const removePath = join(fsRoot, name);
      try {
        await fs.rm(removePath, { recursive: true, force: true });
        //console.log(`[BackupManager] pruneFullBackups: removed ${removePath}`);
      } catch (e) {
       // console.error(`[BackupManager] pruneFullBackups: failed to remove ${removePath}`, e);
      }
      // also clean up vault index
      const af = this.vault.getAbstractFileByPath(vaultPath);
      if (af) {
        await this.vault.delete(af);
      }
    }
  }

  /**
   * Recursively ensures that a directory exists in the vault.
   */
  private async ensureFolderExists(folderPath: string) {
    if (!folderPath || (await this.vault.adapter.exists(folderPath))) {
      return;
    }
    const parent = dirname(folderPath);
    await this.ensureFolderExists(parent);
    await this.vault.createFolder(folderPath);
  }
}
