// Shared competition presets for HC Slovan Ústí nad Labem (zapasy.ceskyhokej.cz)
// Used for import functionality

export interface CompetitionPreset {
  id: string;
  name: string;
  season: string;
  externalId?: string;
  standingsUrl?: string;
}

export const COMPETITION_PRESETS: CompetitionPreset[] = [
  { 
    id: "starsi-zaci-a", 
    name: 'Liga starších žáků "A" sk. 2', 
    season: "2025-2026",
    externalId: "Z8",
    standingsUrl: "https://www.ceskyhokej.cz/competition/standings/24"
  },
  { 
    id: "starsi-zaci-b", 
    name: 'Liga starších žáků "B" sk. 10', 
    season: "2025-2026",
    externalId: "Z7",
    standingsUrl: "https://www.ceskyhokej.cz/competition/standings/26"
  },
  { 
    id: "mladsi-zaci-a", 
    name: 'Liga mladších žáků "A" sk. 4', 
    season: "2025-2026",
    externalId: "Z6",
    standingsUrl: "https://www.ceskyhokej.cz/competition/standings/25"
  },
  { 
    id: "mladsi-zaci-b", 
    name: 'Liga mladších žáků "B" sk. 14', 
    season: "2025-2026",
    externalId: "Z5",
    standingsUrl: "https://www.ceskyhokej.cz/competition/standings/27"
  },
];

