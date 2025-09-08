import { normalizePath, Vault, App, Notice } from 'obsidian';
import { dirname, basename, join } from 'path';
import { promises as fs } from 'fs';

export class BackupManager {
  constructor(private app: App) {}

  async backupVaultMirror(label?: string, maxFullBackups: number = 5): Promise<string> {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const tag = label ? `-${label}` : '';
    const base = normalizePath(`.vault-backups/full/${ts}${tag}`);

    await this.ensureFolderExists(base);

    for (const file of this.app.vault.getFiles()) {
      const p = file.path;
      if (
        p.startsWith('.vault-backups/') ||
        p.startsWith(`${this.app.vault.configDir}/`) ||
        p.startsWith('.trash/') ||
        p.startsWith('.git/')
      ) {
        continue;
      }

      const target = normalizePath(`${base}/${p}`);
      await this.ensureFolderExists(dirname(target));

      try {
        const data = await this.app.vault.adapter.readBinary(p);
        await this.app.vault.adapter.writeBinary(target, data);
      } catch (e) {
        console.error('[BackupManager] copy failed:', p, e);
        // continue to next file
      }
    }
    await this.pruneFullBackups(base, maxFullBackups);
    new Notice("✅ Backup complete!");
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
  await this.ensureFolderExists(root);

  const listing = await this.app.vault.adapter.list(root);
  const folderPaths: string[] = (listing as any)?.folders ?? [];
  const names = folderPaths.map(f => basename(f));

  // sort newest→oldest by ISO-ish folder name
  const sorted = [...names].sort((a, b) => b.localeCompare(a));

  const toRemove = sorted.slice(keep);
  for (const name of toRemove) {
    const vaultPath = normalizePath(`${root}/${name}`);
    try {
      // remove snapshot folder recursively via adapter
      await this.app.vault.adapter.rmdir(vaultPath, true);
    } catch (e) {
      console.error('[BackupManager] prune failed:', vaultPath, e);
    }
  }
}

  /**
   * Recursively ensures that a directory exists in the vault.
   */
  private async ensureFolderExists(folderPath: string) {
    if (!folderPath || (await this.app.vault.adapter.exists(folderPath))) {
      return;
    }
    const parent = dirname(folderPath);
    await this.ensureFolderExists(parent);
    await this.app.vault.createFolder(folderPath);
  }
}
