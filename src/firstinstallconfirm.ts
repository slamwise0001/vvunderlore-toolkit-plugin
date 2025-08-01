// src/firstinstallconfirm.ts
import { App, Modal, ButtonComponent, Notice, normalizePath } from 'obsidian';
import type VVunderloreToolkitPlugin from './main';
import { InstallOptions, InstallingModal } from './main';
import { importRulesetData } from "./rulesetInstaller";

async function activateCopiedPlugins(app: App) {
  const filePath = normalizePath(`${app.vault.configDir}/community-plugins.json`);

  try {
    const raw = await app.vault.adapter.read(filePath);
    const pluginsToEnable: string[] = JSON.parse(raw);

    if (!Array.isArray(pluginsToEnable)) return;

    const loaded = (app as any).plugins;

    for (const pluginId of pluginsToEnable) {
      if (!loaded.enabledPlugins.has(pluginId)) {
        await loaded.enablePluginAndSave(pluginId);
      }
    }

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
    const warningEl = this.contentEl
      .createEl('div', {
        text:
          "The full VVunderlore install is intended for a fresh, empty Obsidian vault. " +
          "If you install in a vault that already has files, any file whose path matches a " +
          "VVunderlore Toolkit file will be overwritten.\n\n" +
          "Also things could just get messy.\n\n" +
          "Make a perception check and proceed with caution!",
      })
      warningEl.addClass("installconf-disclaimer");

    // Button row container
    const buttonRow = this.contentEl.createEl('div');
    buttonRow.addClass("installconf-buttonrow");

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
        this.app.workspace.getLeavesOfType('markdown').forEach(leaf => leaf.detach());
        this.app.workspace.getLeavesOfType('graph').forEach(leaf => leaf.detach());
      
        this.close();

        const installing = new InstallingModal(this.app);
        installing.open();

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
        }

        this.plugin.settings.isFirstRun = "no";
        await this.plugin.saveSettings();

        // 4) Swap to success screen
        installing.close();

        const successModal = new Modal(this.app);
        successModal.onOpen = () => {
          successModal.contentEl.empty();
          successModal.titleEl.setText("✅ Toolkit Installed");
          const msg = successModal.contentEl.createEl("div", {
            text: "Reloading vault in 3 seconds…",
          });
          msg.addClass("installsuccess");
        };
        successModal.open();

        // 5) reload
        setTimeout(() => {
          successModal.close();
          location.reload();
        }, 3000);
      });
      }

      onClose() {
        this.contentEl.empty();
      }
    }


 