import { Vault } from 'obsidian';
import { createHash } from 'crypto';

export interface ToolkitFileCacheEntry {
	hash: string;
	githubPath: string;
}

export type ToolkitFileCache = Record<string, ToolkitFileCacheEntry>; // vaultPath => {hash, githubPath}

export class ToolkitFileCacheManager {
	private vault: Vault;
	private cache: ToolkitFileCache;
	private save: () => Promise<void>;

	constructor(vault: Vault, initialCache: ToolkitFileCache | undefined, saveCallback: () => Promise<void>) {
		this.vault = vault;
		this.cache = initialCache || {};
		this.save = saveCallback;
	}

	private hashContent(content: string): string {
		return createHash('sha256').update(content).digest('hex');
	}

	async isUpToDate(vaultPath: string): Promise<boolean> {
		//console.log(`🔍 Checking if "${vaultPath}" is up to date.`);
	
		const entry = this.cache[vaultPath];
		if (!entry) {
			//console.log(`❌ No cached hash found for: ${vaultPath}`);
			return false;
		}
	
		const exists = await this.vault.adapter.exists(vaultPath);
		if (!exists) {
			//console.log(`❌ File does not exist in vault: ${vaultPath}`);
			return false;
		}
	
		const content = await this.vault.adapter.read(vaultPath);
		const localHash = this.hashContent(content);
		const isSame = localHash === entry.hash;
	
		//console.log(`🔢 Local hash:  ${localHash}`);
		//console.log(`📦 Cached hash: ${entry.hash}`);
		//console.log(isSame ? `✅ File is up to date.` : `🔁 File needs update.`);
	
		return isSame;
	}
	

	async updateCache(vaultPath: string, content: string, githubPath: string, saveNow: boolean = true) {
		this.cache[vaultPath] = {
			hash: this.hashContent(content),
			githubPath
		};
		if (saveNow) await this.save();
	}

	getCache(): ToolkitFileCache {
		return this.cache;
	}

	getTrackedFiles(): string[] {
		return Object.keys(this.cache);
	}

	getGitHubPath(vaultPath: string): string | undefined {
		return this.cache[vaultPath]?.githubPath;
	}

	resetCache() {
		this.cache = {};
	}

	async removeFromCache(vaultPath: string) {
		delete this.cache[vaultPath];
		await this.save();
	}
}
