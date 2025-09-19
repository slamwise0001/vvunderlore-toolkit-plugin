export interface ParsedMarkdownFile {
  path: string;
  content: string;
}

export type AdventureSortOption = 'name' | 'recent' | 'refs';