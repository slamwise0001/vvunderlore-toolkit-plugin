// src/firstinstallconfirm.ts
import { App, Modal, ButtonComponent, Notice } from 'obsidian';
import type VVunderloreToolkitPlugin from './main';
import { InstallingModal } from './main';

export class ConfirmFreshInstallModal extends Modal {
  private plugin: VVunderloreToolkitPlugin;

  constructor(app: App, plugin: VVunderloreToolkitPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.contentEl.empty();

    // Title
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
      .setCta() // makes it look like a primary action
      .onClick(async () => {
        // disable both buttons to prevent double‐clicks
        buttonRow.querySelectorAll('button').forEach((b) =>
          (b as HTMLButtonElement).setAttribute("disabled", ""),
        );

        // 1) Immediately close this confirm‐dialog
        this.close();

        // 2) Open the "Installing…" placeholder
        const installing = new InstallingModal(this.app);
        installing.open();

        try {
          // 3) Run the full‐install routine (awaits until done)
          await this.plugin.installFullToolkit();
        } catch (err) {
          console.error("❌ installFullToolkit() threw:", err);
          new Notice("❌ Toolkit install failed – see console");
        } finally {
          // 4) Close "Installing…" placeholder no matter what
          installing.close();
        }
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}
