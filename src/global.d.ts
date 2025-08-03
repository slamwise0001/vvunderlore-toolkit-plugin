import 'obsidian';
import { WorkspaceLeaf, TFile, EventRef } from 'obsidian';

declare module '*.png';
declare module "obsidian" {
  interface Workspace {
    on(
      event: "file-open",
      callback: (leaf: WorkspaceLeaf, file: TFile) => void
    ): EventRef;
    off(
      event: "file-open",
      callback: (leaf: WorkspaceLeaf, file: TFile) => void
    ): void;
  }
    interface App {
    plugins: any;
  }
}
