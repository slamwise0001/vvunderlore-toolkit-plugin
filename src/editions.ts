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
    id: string;              
    label: string;           
    repo?: string;            
    parser?: string;       
    sourceUrl?: string;
    categories?: string[];
  }
  
  export const AVAILABLE_EDITIONS: Edition[] = [
    {
      id: 'none',
      label: 'None',
      repo: '',
      parser: '',
      sourceUrl: '',
    },
    {
      id: '5e-2014',
      label: 'D&D 5e (2014)',
      repo: '5etools-mirror-3/5etools-2014-src',
      parser: '5e-2014',
      sourceUrl: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main/data',
      categories: [''],
    },
    {
      id: '5e-2025',
      label: 'D&D 5e (2024)',
      repo: '5etools-mirror-3/5etools-src',
      parser: '5e-2025',
      sourceUrl: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data',
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