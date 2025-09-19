
export const ADVENTURE_CATEGORY_DEFS: { id: string; label: string; test?: RegExp }[] = [
  { id: 'npcs',     label: 'NPCs',               test: /Non-Player Characters\// },
  { id: 'pcs',      label: 'Player Characters',  test: /Player Characters\// },
  { id: 'factions', label: 'Factions',           test: /Factions\// },
  { id: 'monsters', label: 'Monsters',           test: /Compendium\/Bestiary\// },
  { id: 'items',    label: 'Items',              test: /Compendium\/Items\// },
  { id: 'spells',   label: 'Spells',             test: /Compendium\/Spells\// },
  { id: 'history',  label: 'History',            test: /World\/History\// },
  { id: 'events',   label: 'Events',             test: /World\/Events\// },
  { id: 'deities',  label: 'Deities',            test: /Deities\// },
  { id: 'places',   label: 'Places',             test: /World\/Places\// },
  { id: 'other',    label: 'Other' },
];

export const getAdventureCategoryIds = (): string[] =>
  ADVENTURE_CATEGORY_DEFS.map(d => d.id);
