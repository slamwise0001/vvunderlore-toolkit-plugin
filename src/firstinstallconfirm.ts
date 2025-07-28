// src/firstinstallconfirm.ts
import { App, Modal, ButtonComponent, Notice, normalizePath } from 'obsidian';
import type VVunderloreToolkitPlugin from './main';
import { InstallOptions } from './main';
import { importRulesetData } from "./rulesetInstaller";

async function activateCopiedPlugins(app: App) {
  const filePath = normalizePath(".obsidian/community-plugins.json");

  try {
    const raw = await app.vault.adapter.read(filePath);
    const pluginsToEnable: string[] = JSON.parse(raw);

    if (!Array.isArray(pluginsToEnable)) return;

    const loaded = (app as any).plugins;

    for (const pluginId of pluginsToEnable) {
      if (!loaded.enabledPlugins.has(pluginId)) {
        await loaded.enablePluginAndSave(pluginId);
        console.log(`Activated plugin: ${pluginId}`);
      }
    }

    new Notice("Toolkit plugins enabled. Some may need a reload.");
  } catch (e) {
    console.warn("Failed to enable toolkit plugins:", e);
  }
}


export class ConfirmFreshInstallModal extends Modal {
  private plugin: VVunderloreToolkitPlugin;

  constructor(app: App, plugin: VVunderloreToolkitPlugin) {
    super(app);
    this.plugin = plugin;
  }
  

  onOpen() {
    this.contentEl.empty();

    this.titleEl.setText("⚠️ Warning: Fresh Vault Recommended");

    // Disclaimer text
    this.contentEl
      .createEl('div', {
        text:
          "The full VVunderlore install is intended for a fresh, empty Obsidian vault. " +
          "If you install in a vault that already has files, any file whose path matches a " +
          "VVunderlore Toolkit file will be overwritten.\n\n" +
          "Also things could just get messy.\n\n" +
          "Make a perception check and proceed with caution!",
      })
      .style.cssText = `
        white-space: pre-wrap;
        margin-bottom: 1em;
        line-height: 1.4em;
      `;

    // Button row container
    const buttonRow = this.contentEl.createEl('div');
    buttonRow.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 0.5em;
    `;

    // "Oh god, cancel!" button
    new ButtonComponent(buttonRow)
      .setButtonText("Oh god, cancel!")
      .onClick(() => {
        this.close();
      });

    // "Install!!" button
new ButtonComponent(buttonRow)
  .setButtonText("Install!!")
  .setCta()
  .onClick(async () => {

    // 1) Show an in-modal Installing state (instead of a toast)
    this.contentEl.empty();
    this.titleEl.setText("⏳ Installing Toolkit…");
    this.contentEl
      .createEl("div", {
        text: "Please hang tight—this may take a moment.",
      })
      .style.cssText = `
        text-align: center;
        margin-top: 1em;
        line-height: 1.4em;
      `;

    // 2) Run your installer + compendium import
    const compendium = this.plugin.settings.rulesetCompendium;
    const references = [...this.plugin.settings.rulesetReference];
    try {
      await this.plugin.installFullToolkit({ compendium, references });
      if (compendium) {
        await importRulesetData({
          app: this.app,
          editionKey: compendium,
          targetPath: "Compendium",
        });
      }
    } catch (err) {
      console.error("❌ installFullToolkit() failed:", err);
      // you can swap to an error screen here if you like
    }

    // 3) Persist settings (no settingsTab.display())
    await this.plugin.saveSettings();

    // 4) Swap to success screen
    this.contentEl.empty();
    this.titleEl.setText("✅ Toolkit Installed");
    this.contentEl
      .createEl("div", {
        text: "Reloading vault in 3 seconds…",
      })
      .style.cssText = `
        text-align: center;
        margin-top: 1em;
      `;

    // 5) Finally reload
    setTimeout(() => {
      location.reload();
    }, 3000);
  });
  }

  onClose() {
    this.contentEl.empty();
  }
}
