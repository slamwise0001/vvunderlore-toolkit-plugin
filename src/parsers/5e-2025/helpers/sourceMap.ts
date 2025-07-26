// helpers/sourceMap.ts

// Map of 5e source abbreviations to their full titles
const SOURCE_NAME_MAP: Record<string, string> = {
  // Core rulebooks
  PHB: "Player's Handbook",
  MM:  "Monster Manual",
  DMG: "Dungeon Master's Guide",

  // Official expansions & adventure modules
  CoS:  "Curse of Strahd",
  OotA: "Out of the Abyss",
  PotA: "Princes of the Apocalypse",
  HotDQ: "Hoard of the Dragon Queen",
  RoT:  "Rise of Tiamat",
  SKT:  "Storm King's Thunder",
  TftYP:"Tales from the Yawning Portal",
  ToA:  "Tomb of Annihilation",

  // Supplemental guides
  XGE: "Xanathar's Guide to Everything",
  VGM: "Volo's Guide to Monsters",
  TCE: "Tasha's Cauldron of Everything",
  EGW: "Eberron: Rising from the Last War",
  ERLW:"Explorer's Guide to Wildemount",
  MTF: "Monsters of the Multiverse",
  VRGR:"Van Richten's Guide to Ravenloft",

  // Additional sourcebooks
  AAG:      "Astral Adventurer’s Guide",
  AI:       "Acquisitions Incorporated",
  AitFRAVFT:"Adventures in the Forgotten Realms: A Visual Field Test",
  BMT:      "Big Monster Tome",
  DoDk:     "Dragon of Darkkeep",
  FTD:      "Fizban’s Treasury of Dragons",
  GGR:      "Guildmaster’s Guide to Ravnica",
  GHLoE:    "Ghosts of the Horizon: Light Over Elensaria",
  IDRotF:   "Icewind Dale: Rime of the Frostmaiden",
  LLK:      "Lost Laboratory of Kwalish",
  SatO:     "Sapphire of Truth",
  SCC:      "Strixhaven: Curriculum of Chaos",
  TDCSR:    "The Dungeon Coach’s Rulebook",
  JttRC:    "Journeys through the Radiant Citadel",
  "AitFR-AVT":"Adventures in the Forgotten Realms: A Verdant Tomb",
  "AitFR-FCD":"Adventures in the Forgotten Realms: From Cyan Depths",
  RMR:      "Dungeons and Dragons: Rick and Morty",
  SCAG:     "Sword Coast Adventurer's Guide",
  EEPC:     "Elemental Evil Player's Companion",
  MOT:      "Mythic Odysseys of Theros",
  WBtW:     "The Wild Beyond the Witchlight",
  BGDIA:    "Baldur's Gate: Descent Into Avernus",
  ToFW:     "Turn of Fortune's Wheel",
  CoA:      "Chains of Asmodeus",
  CRCotN:   "Critical Role: Call of the Netherdeep",
  ToD:      "Tyranny of Dragons",
  MPMM:     "Mordenkainen Presents: Monsters of the Multiverse",
  LoX:      "Light of Xaryxis",
  QftIS:    "Quests from the Infinite Staircase",
  WDH:      "Waterdeep: Dragon Heist",
  WDMM:     "Waterdeep: Dungeon of the Mad Mage",
  PaBTSO:   "Phandelver and Below: The Shattered Obelisk",
  CM:       "Candlekeep Mysteries",
  GoS:      "Ghosts of Saltmarsh",
  DSotDQ:   "Dragonlance: Shadow of the Dragon Queen",
  KftGV:    "Keys from the Golden Vault",
  SDW:      "Essentials Kit: Sleeping Dragon's Wake",
  DoSI:     "Dragons of Stormwreck Isle",
  GotSF:    "Giants of the Star Forge",
  DIP:      "Essentials Kit: Dragon of Icespire Peak",
  SLW:      "Essentials Kit: Storm Lord's Wrath",
  IMR:      "Infernal Machine Rebuild",
  VEoR:     "Vecna: Eve of Ruin",
  PSI:      "Plane Shift: Innistrad",
  AATM:     "Adventure Atlas: The Mortuary",
  PSZ:      "Plane Shift: Zendikar",
  DC:       "Essentials Kit: Divine Contention",
  LMoP:     "Lost Mine of Phandelver",
  RMBRE:    "The Lost Dungeon of Rickedness: Big Rick Energy",
  HftT:     "Hunt for the Thessalhydra",
  PSX:      "Plane Shift: Ixalan",
  HFStCM:   "Heroes' Feast: Saving the Childrens Menu",
  SjA:      "Spelljammer Academy",
  LK:       "Lightning Keep",
  RtG:      "Return to the Glory",
  TTP:      "The Tortle Package",
  LR:       "Locathah Rising",
  PSA:      "Plane Shift: Amonkhet",
  OGA:      "One Grung Above",
  "NRH-TLT":  "Nerds Restoring Harmony: The Lost Tomb",
  "NRH-AT":   "Nerds Restoring Harmony: Adventure Together",
  BGG:      "Bigby Presents: Glory of the Giants",
  RoTOS:    "The Rise of Tiamat Online Supplement",
  XMtS:     "X Marks the Spot",
  "HAT-LMI":  "Honor Among Theives: Legendary Magic Items",
  DitLCoT:  "Descent into the Lost Caverns of Tsojcanth",
  "AitFR-DN": "Adventures in the Forgotten Realms: Deepest Night",
  "AitFR-THP":"Adventures in the Forgotten Realms: The Hidden Pages",
  BAM:      "Boo's Astral Menagerie",
  AZfyT:    "A Zib for Your Thougts",
  MCV2DC:   "Monstrous Compendium Volume 2: Dragonlance Creatures",
  PSK:      "Plane Shift: Kaladesh",
  PSD:      "Plane Shift: Dominaria",
  AWM:      "Adventure with Muk",
  UATheMysticClass: "Unearthed Arcana: The Mystic Class",
  ALCurseOfStrahd: "Adventurers League: Curse of Strahd",
  ALElementalEvil: "Adventurers League: Elemental Evil",
  ALRageOfDemons:  "Adventurers League: Rage of Demons"
};

/**
 * Returns the full source name for a given abbreviation.
 * Optionally appends year for PHB variants.
 */
export function getFullSourceName(abbrev: string, editionId?: string): string {
  let name = SOURCE_NAME_MAP[abbrev] ?? abbrev;

  // Append year for PHB if the edition context is known
  if (abbrev === "PHB") {
    if (editionId?.includes("2014")) name += " (2014)";
    else if (editionId?.includes("2025")) name += " (2025)";
  }

  return name;
}
