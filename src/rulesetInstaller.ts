// src/rulesetInstaller.ts
import { App } from "obsidian";
import { AVAILABLE_EDITIONS } from "./editions";

// STATIC import of every installer you ship:
import * as fiveeInstaller from "./parsers/5e-json/installer";
// import * as anotherInstaller from "./parsers/other/installer";

export async function importRulesetData(params: {
  app: App;
  editionKey: string;
  targetPath: string;
}) {
  const { app, editionKey, targetPath } = params;
  const edition = AVAILABLE_EDITIONS.find((e) => e.id === editionKey);
  if (!edition) return;
  if (!edition.parser) {
    console.warn("No parser defined for:", editionKey);
    return;
  }

  let installerModule: { importEditionData: any };

  switch (edition.parser) {
    case "5e-json":
      installerModule = fiveeInstaller;
      break;

    // case "other-parser":
    //   installerModule = anotherInstaller;
    //   break;

    default:
      throw new Error(`Unknown parser: ${edition.parser}`);
  }

  await installerModule.importEditionData({ app, edition, targetPath });
}
