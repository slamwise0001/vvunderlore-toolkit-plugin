import { Plugin, Notice } from 'obsidian';

interface ToolkitSettings {
  installedVersion: string;
}

const DEFAULT_SETTINGS: ToolkitSettings = {
  installedVersion: '1.0.0'
};

export default class VVunderloreToolkitPlugin extends Plugin {
  settings: ToolkitSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'check-for-toolkit-update',
      name: 'Check for Toolkit Update',
      callback: () => this.checkForUpdates()
    });
  }

  async checkForUpdates() {
    const current = this.settings.installedVersion;

    try {
      const res = await fetch('https://raw.githubusercontent.com/YOUR_USERNAME/vvunderlore-toolkit/main/version.json');
      const data = await res.json();
      const latest = data.version;

      if (latest === current) {
        new Notice(`VVunderlore Toolkit is up to date (v${current})`);
      } else {
        new Notice(`Update available! Latest: v${latest}, Installed: v${current}`);
      }
    } catch (err) {
      new Notice(`Failed to check for update.`);
      console.error(err);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
