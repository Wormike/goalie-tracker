-- ═══════════════════════════════════════════════════════════════════════════
-- GOALIE TRACKER - SUPABASE DATABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Jak použít:
-- 1. Přihlas se do Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Vytvoř nový projekt nebo použij existující
-- 3. Jdi do SQL Editor
-- 4. Vlož celý tento soubor a spusť (Run)
-- 5. Zkopíruj URL a anon key z Settings > API do .env.local
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- TEAMS - Týmy
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT,
  club_external_id TEXT,        -- ID klubu na svazu (ceskyhokej.cz)
  team_external_id TEXT,        -- ID konkrétního družstva
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pro vyhledávání podle externího ID
CREATE INDEX IF NOT EXISTS idx_teams_club_external_id ON teams(club_external_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEASONS - Sezóny
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,           -- "2024-2025"
  name TEXT NOT NULL,            -- "2024/2025"
  label TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  external_id TEXT,              -- ID sezóny na svazu
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPETITIONS - Soutěže
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,            -- "Liga starších žáků A – Ústecká"
  category TEXT,                 -- "7. třída"
  season_id TEXT REFERENCES seasons(id),
  external_id TEXT,              -- competitionId ze svazu
  source TEXT DEFAULT 'manual',  -- "ceskyhokej" | "manual"
  standings_url TEXT,            -- URL na tabulku
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitions_season ON competitions(season_id);
CREATE INDEX IF NOT EXISTS idx_competitions_external_id ON competitions(external_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- GOALIES - Brankáři
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_year INTEGER,
  team TEXT,                     -- Název týmu (legacy)
  club_team_id UUID REFERENCES teams(id),
  jersey_number INTEGER,
  catch_hand TEXT CHECK (catch_hand IN ('L', 'R')),
  photo_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Computed column pro celé jméno
CREATE INDEX IF NOT EXISTS idx_goalies_name ON goalies(last_name, first_name);

-- ─────────────────────────────────────────────────────────────────────────────
-- MATCHES - Zápasy
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Týmy
  home_team_id UUID REFERENCES teams(id),
  home_team_name TEXT,           -- Záloha pokud není v teams
  away_team_name TEXT NOT NULL,
  
  -- Klasifikace
  type TEXT DEFAULT 'friendly' CHECK (type IN ('friendly', 'league', 'tournament', 'cup')),
  competition TEXT,              -- Název soutěže (legacy)
  competition_id UUID REFERENCES competitions(id),
  season TEXT,                   -- ID sezóny (legacy string)
  
  -- Čas a místo
  datetime TIMESTAMPTZ NOT NULL,
  venue TEXT,
  
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  
  -- Skóre
  home_score INTEGER,
  away_score INTEGER,
  
  -- Brankář
  goalie_id UUID REFERENCES goalies(id),
  
  -- Import tracking
  source TEXT DEFAULT 'manual',  -- "manual" | "imported" | "ceskyhokej"
  external_id TEXT,              -- ID zápasu ze zdroje
  external_url TEXT,
  
  -- Manuální statistiky (když není detailní tracking)
  manual_shots INTEGER,
  manual_saves INTEGER,
  manual_goals INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_datetime ON matches(datetime DESC);
CREATE INDEX IF NOT EXISTS idx_matches_goalie ON matches(goalie_id);
CREATE INDEX IF NOT EXISTS idx_matches_competition ON matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_matches_external_id ON matches(external_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- GOALIE_EVENTS - Události brankáře (střely, zákroky, góly)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goalie_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  goalie_id UUID REFERENCES goalies(id),
  
  -- Čas v zápase
  period TEXT NOT NULL CHECK (period IN ('1', '2', '3', 'OT')),
  game_time TEXT,                -- "14:32"
  
  -- Výsledek
  result TEXT NOT NULL CHECK (result IN ('save', 'goal', 'miss')),
  
  -- Pozice střely (na ledě)
  shot_x NUMERIC(5,2),           -- 0-100
  shot_y NUMERIC(5,2),           -- 0-100
  shot_zone TEXT CHECK (shot_zone IN ('slot', 'left_wing', 'right_wing', 'blue_line', 'behind_goal')),
  
  -- Cíl střely (v bráně)
  goal_x NUMERIC(5,2),           -- 0-100
  goal_y NUMERIC(5,2),           -- 0-100
  shot_target TEXT CHECK (shot_target IN (
    'high_glove', 'low_glove', 
    'high_blocker', 'low_blocker',
    'five_hole', 'high_center', 'low_center',
    'off_target'
  )),
  
  -- Detaily
  save_type TEXT CHECK (save_type IN ('catch', 'rebound')),
  goal_type TEXT CHECK (goal_type IN ('direct', 'rebound', 'breakaway')),
  situation TEXT DEFAULT 'even' CHECK (situation IN ('even', 'powerplay', 'shorthanded')),
  is_rebound BOOLEAN DEFAULT FALSE,
  screened_view BOOLEAN DEFAULT FALSE,
  
  -- Tracking
  input_source TEXT DEFAULT 'manual' CHECK (input_source IN ('live', 'manual', 'import')),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'edited', 'deleted')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_match ON goalie_events(match_id);
CREATE INDEX IF NOT EXISTS idx_events_goalie ON goalie_events(goalie_id);
CREATE INDEX IF NOT EXISTS idx_events_result ON goalie_events(result);

-- ─────────────────────────────────────────────────────────────────────────────
-- GOALIE_STATS - Agregované statistiky brankáře (cache)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goalie_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goalie_id UUID NOT NULL REFERENCES goalies(id) ON DELETE CASCADE,
  season_id TEXT REFERENCES seasons(id),
  competition_id UUID REFERENCES competitions(id),
  
  -- Základní statistiky
  games_played INTEGER DEFAULT 0,
  total_shots INTEGER DEFAULT 0,
  total_saves INTEGER DEFAULT 0,
  total_goals INTEGER DEFAULT 0,
  save_percentage NUMERIC(5,2) DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  
  -- Rozpad podle situace
  shots_even INTEGER DEFAULT 0,
  saves_even INTEGER DEFAULT 0,
  shots_pp INTEGER DEFAULT 0,
  saves_pp INTEGER DEFAULT 0,
  shots_sh INTEGER DEFAULT 0,
  saves_sh INTEGER DEFAULT 0,
  
  -- Typy gólů
  goals_direct INTEGER DEFAULT 0,
  goals_rebound INTEGER DEFAULT 0,
  goals_breakaway INTEGER DEFAULT 0,
  
  -- Výsledky
  shutouts INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ot_losses INTEGER DEFAULT 0,
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(goalie_id, season_id, competition_id)
);

CREATE INDEX IF NOT EXISTS idx_stats_goalie ON goalie_stats(goalie_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTERNAL_MAPPINGS - Mapování externích ID
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,          -- "ceskyhokej" | "other"
  external_type TEXT NOT NULL,   -- "team" | "competition" | "season"
  external_id TEXT NOT NULL,
  external_name TEXT,
  internal_id TEXT NOT NULL,     -- UUID nebo string ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(source, external_type, external_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS - Automatická aktualizace updated_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplikace triggerů na všechny tabulky
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['teams', 'seasons', 'competitions', 'goalies', 'matches', 'goalie_events', 'goalie_stats'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) - Volitelné
-- ─────────────────────────────────────────────────────────────────────────────
-- 
-- Pro veřejnou aplikaci bez autentizace můžeš nechat RLS vypnuté.
-- Pokud chceš více uživatelů, přidej sloupec user_id a povol RLS.
--

-- Příklad pro jednoduchou aplikaci - povol vše pro anonymní uživatele
-- ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for anon" ON teams FOR ALL TO anon USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWS - Užitečné pohledy
-- ─────────────────────────────────────────────────────────────────────────────

-- Pohled na brankáře s kompletním jménem
CREATE OR REPLACE VIEW v_goalies AS
SELECT 
  id,
  first_name,
  last_name,
  first_name || ' ' || last_name AS full_name,
  birth_year,
  team,
  jersey_number,
  catch_hand,
  photo_url,
  created_at
FROM goalies;

-- Pohled na zápasy s týmy
CREATE OR REPLACE VIEW v_matches AS
SELECT 
  m.id,
  m.datetime,
  COALESCE(t.name, m.home_team_name, 'Domácí') AS home_team,
  m.away_team_name AS away_team,
  m.home_score,
  m.away_score,
  m.type,
  m.status,
  m.venue,
  g.first_name || ' ' || g.last_name AS goalie_name,
  m.goalie_id,
  c.name AS competition_name,
  m.created_at
FROM matches m
LEFT JOIN teams t ON m.home_team_id = t.id
LEFT JOIN goalies g ON m.goalie_id = g.id
LEFT JOIN competitions c ON m.competition_id = c.id
ORDER BY m.datetime DESC;

-- Pohled na statistiky událostí za zápas
CREATE OR REPLACE VIEW v_match_stats AS
SELECT 
  match_id,
  COUNT(*) FILTER (WHERE result IN ('save', 'goal')) AS total_shots,
  COUNT(*) FILTER (WHERE result = 'save') AS saves,
  COUNT(*) FILTER (WHERE result = 'goal') AS goals,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE result = 'save') / 
    NULLIF(COUNT(*) FILTER (WHERE result IN ('save', 'goal')), 0),
    1
  ) AS save_percentage
FROM goalie_events
WHERE status != 'deleted'
GROUP BY match_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA - Výchozí data
-- ─────────────────────────────────────────────────────────────────────────────

-- Výchozí sezóny
INSERT INTO seasons (id, name, label, start_date, end_date, start_year, end_year, is_current)
VALUES 
  ('2024-2025', '2024/2025', '2024/2025', '2024-09-01', '2025-06-30', 2024, 2025, FALSE),
  ('2025-2026', '2025/2026', '2025/2026', '2025-09-01', '2026-06-30', 2025, 2026, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Výchozí tým
INSERT INTO teams (id, name, short_name, club_external_id)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'HC Slovan Ústí nad Labem', 'Slovan Ústí', '228')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- HOTOVO! 
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Teď jdi do Settings > API v Supabase Dashboard a zkopíruj:
-- - Project URL → NEXT_PUBLIC_SUPABASE_URL
-- - anon public key → NEXT_PUBLIC_SUPABASE_ANON_KEY
--
-- Vlož je do .env.local:
--
-- NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
--
-- ═══════════════════════════════════════════════════════════════════════════






