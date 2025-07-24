// FUTURE SYSTEMS: 
// Call of Cthulu 
// Mothership
// PF2E
// Mörk Borg
// Blades in the Dark
// Delta Green
// Starfinder
// The One Ring
// Fate 
// Cyberpunk
// Lancer
// Powered by the Apocalypse
// Star Wars RPG

export interface Edition {
    id: string;              // e.g. "5e-2014"
    label: string;           // e.g. "D&D 5E (2014)"
    repo?: string;            // e.g. "5etools-mirror-3/5etools-2014-src"
    parser?: string;       // your parser‐selector
    sourceUrl?: string;
    categories?: string[];
  }
  
  export const AVAILABLE_EDITIONS: Edition[] = [
    {
      id: '5e-2014',
      label: 'D&D 5E (2014)',
      repo: '5etools-mirror-3/5etools-2014-src',
      parser: '5e-json',
      sourceUrl: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main/data',
      categories: [''],
    },
    {
      id: '5e-2025',
      label: 'D&D 5E (2025)',
      repo: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data',
      parser: '5e-json',
      sourceUrl: '5etools-mirror-3/5etools-src'
    },
    {
      id: 'test',
      label: 'Test Ruleset',
      repo: '5etools-mirror-3/5etools-2014-src',
      parser: '5e-json',
      sourceUrl: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main/data',
      categories: ['spells', 'bestiary'],
    }, 
    

  ];

    // {
    //   id: '',
    //   label: '',
    //   repo: '',
    //   parser: '',
    //   sourceUrl: '',
    //   categories: [''],
    // },  