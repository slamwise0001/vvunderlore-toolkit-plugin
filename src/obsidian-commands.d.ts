// obsidian-commands.d.ts
import type { Commands } from 'obsidian';

declare module 'obsidian' {
  interface App {
    /** Exposed at runtime, even if not in the official .d.ts: */
    commands: Commands;
  }
}