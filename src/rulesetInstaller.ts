// src/rulesetInstaller.ts
import { App } from "obsidian";
import { AVAILABLE_EDITIONS } from "./editions";

// STATIC import of every installer you ship:
import * as fivee2014Installer from "./parsers/5e-2014/installer";
import * as fivee2025Installer from "./parsers/5e-2025/installer";
// import * as anotherInstaller from "./parsers/other/installer";

export async function importRulesetData(params: {
  app: App;
  editionKey: string;
  targetPath: string;
}) {
  const { app, editionKey, targetPath } = params;
  const edition = AVAILABLE_EDITIONS.find((e) => e.id === editionKey);
  if (!edition) {
    console.warn("Edition not found for:", editionKey);
    return;
  }
  if (!edition.parser) {
    console.warn("No parser defined for:", editionKey);
    return;
  }

  // all installers expose importEditionData()
  let installerModule: { importEditionData: (args: { app: App; edition: typeof edition; targetPath: string }) => Promise<void> };

  switch (edition.parser) {
    case "5e-2014":
      installerModule = fivee2014Installer;
      break;
    case "5e-2025":
      installerModule = fivee2025Installer;
      break;
    // case "other-parser":
    //   installerModule = anotherInstaller;
    //   break;
    default:
      throw new Error(`Unknown parser: ${edition.parser}`);
  }

  await installerModule.importEditionData({ app, edition, targetPath });
}
