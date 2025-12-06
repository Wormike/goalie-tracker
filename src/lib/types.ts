export type Period = 1 | 2 | 3 | "OT";

export type ShotZone =
  | "slot"
  | "left_wing"
  | "right_wing"
  | "blue_line"
  | "behind_goal";

export type ResultType = "save" | "goal" | "miss";

export type SaveType = "catch" | "rebound";
export type GoalType = "direct" | "rebound" | "breakaway";
export type SituationType = "even" | "powerplay" | "shorthanded";

// Position where shot originated from (on the ice)
export interface ShotPosition {
  x: number; // 0–100
  y: number; // 0–100
  zone: ShotZone;
}

// Position where shot was aimed at (on the goal)
export type GoalZone =
  | "top_left"
  | "top_center"
  | "top_right"
  | "middle_left"
  | "middle_center"
  | "middle_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right"
  | "five_hole";

export interface GoalPosition {
  x: number; // 0–100 (left to right)
  y: number; // 0–100 (top to bottom)
  zone: GoalZone;
}

export interface GoalieEvent {
  id: string;
  matchId: string;
  goalieId: string;
  period: Period;
  gameTime: string; // "14:32"
  timestamp: string;
  result: ResultType;
  shotPosition?: ShotPosition; // Where the shot came from
  goalPosition?: GoalPosition; // Where the shot was aimed (on the goal)

  saveType?: SaveType;
  goalType?: GoalType;
  situation?: SituationType;
  rebound?: boolean;
  screenedView?: boolean;
}

export type MatchType = "league" | "friendly" | "tournament" | "cup";
export type MatchSource = "manual" | "imported" | "ceskyhokej";

// Player in roster
export interface RosterPlayer {
  number?: number;
  name: string;
  position?: string;
}

// Goal scorer info
export interface GoalScorer {
  name: string;
  time: string; // "12:34"
  period: number;
  assists?: string[]; // Names of assistants
  isOurTeam: boolean;
}

// Match roster with goal scorers
export interface MatchRoster {
  players: RosterPlayer[];
  goalScorers: GoalScorer[];
}

export interface Match {
  id: string;
  home: string;
  away: string;
  category: string;
  datetime: string;
  venue?: string;
  matchType: MatchType;
  goalieId?: string;
  seasonId: string;
  completed?: boolean;
  homeScore?: number;
  awayScore?: number;
  source?: MatchSource;
  externalId?: string; // ID from ceskyhokej.cz
  externalUrl?: string; // URL to match detail on ceskyhokej.cz
  
  // Roster and goal scorers (our team)
  roster?: MatchRoster;
  
  // Manual stats entry (when no detailed tracking)
  manualStats?: {
    shots: number;
    saves: number;
    goals: number;
  };
}

export interface Goalie {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  team: string;
  jerseyNumber?: number;
  photo?: string;
  createdAt: string;
}

export interface Season {
  id: string;
  name: string; // "2024/2025"
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface GoalieSeasonStats {
  goalieId: string;
  seasonId: string;
  gamesPlayed: number;
  totalShots: number;
  totalSaves: number;
  totalGoals: number;
  savePercentage: number;
  shutouts: number;
  wins: number;
  losses: number;
  otLosses: number;
}

// Team configuration for scraping
export interface TeamConfig {
  id: string;
  name: string;
  ceskyhokejId?: string; // ID on ceskyhokej.cz
  categories: string[]; // e.g., ["7. třída", "5. třída"]
}

// Import configuration
export interface ImportConfig {
  competitionId: string; // e.g., "24"
  clubId?: string; // e.g., "115" for HC Slovan Ústí
  teamName?: string; // Team name to filter by
}
