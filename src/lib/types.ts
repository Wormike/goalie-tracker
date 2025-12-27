// ═══════════════════════════════════════════════════════════════════════════
// GOALIE TRACKER - TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Basic enums and types
// ─────────────────────────────────────────────────────────────────────────────

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

// NEW: Input source for events (how the event was recorded)
export type InputSource = "live" | "manual" | "import";

// NEW: Event status for tracking edits/deletions
export type EventStatus = "confirmed" | "edited" | "deleted";

// NEW: Match status (open for recording, closed when finished)
export type MatchStatus = "open" | "closed";

export type MatchType = "league" | "friendly" | "tournament" | "cup";
export type MatchSource = "manual" | "imported" | "ceskyhokej";

// ─────────────────────────────────────────────────────────────────────────────
// Position types
// ─────────────────────────────────────────────────────────────────────────────

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

// NEW: Shot target zone - where the shot was aimed at in the goal (from goalie's perspective)
export type ShotTargetZone =
  | "high_glove" // horní lapačka
  | "low_glove" // dolní lapačka
  | "high_blocker" // horní vyrážečka
  | "low_blocker" // dolní vyrážečka
  | "five_hole" // mezi betony
  | "high_center" // horní střed
  | "low_center" // spodní střed
  | "off_target"; // mimo branku

// ─────────────────────────────────────────────────────────────────────────────
// Core entities
// ─────────────────────────────────────────────────────────────────────────────

// Goalie profile
export interface Goalie {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  team: string;
  jerseyNumber?: number;
  catchHand?: "L" | "R"; // NEW: Catching hand
  photo?: string;
  profilePhotoUrl?: string; // NEW: Alternative photo field
  clubTeamId?: string; // NEW: Link to Team
  note?: string; // NEW: Notes about goalie
  createdAt: string;
  updatedAt?: string; // NEW
}

// Season definition
export interface Season {
  id: string;
  name: string; // "2024/2025"
  label?: string; // Display label (auto-generated from years)
  startDate: string;
  endDate: string;
  startYear: number; // Required for proper management
  endYear: number; // Required for proper management
  isActive: boolean; // Legacy field
  isCurrent: boolean; // NEW: Whether this is the currently selected season
  externalId?: string; // Season ID on ceskyhokej.cz
}

// NEW: Team entity
export interface Team {
  id: string;
  name: string;
  shortName?: string;
  clubExternalId?: string; // ID klubu na svazu
  teamExternalId?: string; // ID konkrétního družstva/týmu
  defaultCompetitionIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// NEW: Competition entity
export interface Competition {
  id: string;
  name: string; // "Liga starších žáků A – Ústecká"
  category: string; // "7. třída"
  seasonId: string;
  externalId?: string; // competitionId ze svazu
  source?: "ceskyhokej" | "manual";
  standingsUrl?: string; // External URL to standings on ceskyhokej.cz
  createdAt?: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Match and events
// ─────────────────────────────────────────────────────────────────────────────

// NEW: Import metadata
export interface ImportMeta {
  source: "ceskyhokej" | "other";
  sourceUrl?: string;
  externalMatchId?: string;
  externalCompetitionId?: string;
  externalHomeTeamId?: string;
  externalAwayTeamId?: string;
  scrapedAt: string;
}

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
  assists?: string[];
  isOurTeam: boolean;
}

// Match roster with goal scorers
export interface MatchRoster {
  players: RosterPlayer[];
  goalScorers: GoalScorer[];
}

// Match entity
export interface Match {
  id: string;
  
  // Teams - support both legacy (string) and new (ID) format
  home: string; // Team name (legacy)
  away: string; // Team name (legacy)
  homeTeamId?: string; // NEW: Reference to Team
  awayTeamName?: string; // NEW: Away team name (when not in our Team list)
  
  // Classification
  category: string;
  matchType: MatchType;
  competitionId?: string; // NEW: Reference to Competition
  seasonId: string;
  
  // Timing and location
  datetime: string;
  venue?: string;
  
  // Status
  status?: MatchStatus; // NEW: open/closed
  completed?: boolean; // Legacy field
  
  // Scores
  homeScore?: number;
  awayScore?: number;
  
  // Goalie assignment
  goalieId?: string;
  
  // Import tracking
  source?: MatchSource;
  externalId?: string;
  externalUrl?: string;
  importedFrom?: ImportMeta; // NEW: Detailed import metadata
  
  // Roster and goal scorers
  roster?: MatchRoster;
  
  // Manual stats entry (when no detailed tracking)
  manualStats?: {
    shots: number;
    saves: number;
    goals: number;
  };
  
  // Timestamps
  createdAt?: string; // NEW
  updatedAt?: string; // NEW
}

// Goalie event (shot tracking)
export interface GoalieEvent {
  id: string;
  matchId: string;
  goalieId: string;
  
  // Timing
  period: Period;
  gameTime: string; // "14:32"
  timestamp: string; // ISO when recorded
  
  // Result
  result: ResultType;
  shotPosition?: ShotPosition;
  goalPosition?: GoalPosition;
  shotTarget?: ShotTargetZone; // NEW: Where the shot was aimed at in the goal
  
  // Details
  saveType?: SaveType;
  goalType?: GoalType;
  situation?: SituationType;
  rebound?: boolean;
  screenedView?: boolean;
  
  // Tracking fields
  inputSource?: InputSource; // How event was recorded
  status?: EventStatus; // confirmed/edited/deleted
  originalEventId?: string; // For tracking edits
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Competition Standings
// ─────────────────────────────────────────────────────────────────────────────

// Row in standings table
export interface StandingsRow {
  position: number;
  teamName: string;
  teamId?: string; // Reference to Team.id if matched
  gamesPlayed: number;
  wins: number;
  winsOT?: number; // Wins in overtime/shootout (VP)
  lossesOT?: number; // Losses in overtime/shootout (PP)
  draws?: number; // For backward compatibility
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference?: number;
  points: number;
  isOurTeam?: boolean; // Highlight our team
}

// Full standings for a competition
export interface CompetitionStandings {
  id: string;
  competitionId: string; // Reference to Competition.id
  competitionName?: string; // Human-readable name of the competition
  seasonId: string; // Reference to Season.id
  externalCompetitionId?: string; // External ID from ceskyhokej.cz
  updatedAt: string;
  rows: StandingsRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────────────────────────

export interface GoalieSeasonStats {
  id?: string; // NEW
  goalieId: string;
  seasonId: string;
  competitionId?: string; // NEW: Optional filter by competition
  
  // Basic stats
  gamesPlayed: number;
  totalShots: number;
  totalSaves: number;
  totalGoals: number;
  savePercentage: number;
  minutesPlayed?: number; // NEW
  
  // NEW: Situation breakdown
  shotsEven?: number;
  savesEven?: number;
  shotsPP?: number;
  savesPP?: number;
  shotsSH?: number;
  savesSH?: number;
  
  // NEW: Goal type breakdown
  goalsDirect?: number;
  goalsRebound?: number;
  goalsBreakaway?: number;
  
  // Legacy fields
  shutouts: number;
  wins: number;
  losses: number;
  otLosses: number;
  
  updatedAt?: string; // NEW
}

// ─────────────────────────────────────────────────────────────────────────────
// Import/Export
// ─────────────────────────────────────────────────────────────────────────────

// NEW: External ID mapping for import wizard
export interface ExternalMapping {
  id: string;
  source: "ceskyhokej" | "other";
  externalType: "team" | "competition" | "season";
  externalId: string;
  externalName?: string;
  internalId: string;
  createdAt: string;
}

// Export bundle for backup/restore
export interface ExportBundle {
  version: 1;
  exportedAt: string;
  goalies: Goalie[];
  teams: Team[];
  seasons: Season[];
  competitions: Competition[];
  matches: Match[];
  events: GoalieEvent[];
  externalMappings?: ExternalMapping[];
  goalieSeasonStats?: GoalieSeasonStats[];
  standings?: CompetitionStandings[]; // NEW
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Team configuration for scraping (legacy)
export interface TeamConfig {
  id: string;
  name: string;
  ceskyhokejId?: string;
  categories: string[];
}

// Import configuration
export interface ImportConfig {
  competitionId: string;
  clubId?: string;
  teamName?: string;
}

// NEW: Scraped match draft (for import wizard)
export interface ScrapedMatchDraft {
  source: "ceskyhokej" | "other";
  sourceUrl?: string;
  
  // Extracted data
  homeTeamName: string;
  awayTeamName: string;
  competitionName?: string;
  seasonName?: string;
  
  // External IDs
  externalMatchId?: string;
  externalCompetitionId?: string;
  externalHomeTeamId?: string;
  externalAwayTeamId?: string;
  
  // Match details
  datetime: string;
  venue?: string;
  homeScore?: number;
  awayScore?: number;
  
  // Scraped roster/stats if available
  roster?: MatchRoster;
  shotsAgainst?: number;
  goalsAgainst?: number;
  
  scrapedAt: string;
}
