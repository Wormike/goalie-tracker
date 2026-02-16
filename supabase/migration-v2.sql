-- Goalie Tracker - Migration v2
-- Aktualizace produkční DB podle nového schématu

-- 1. Přidat chybějící sloupce
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_team_id UUID REFERENCES teams(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_team_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'friendly';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS season_id TEXT;

-- 2. Migrovat data ze starých sloupců
UPDATE matches SET match_type = type WHERE type IS NOT NULL AND match_type IS NULL;
UPDATE matches SET season_id = season WHERE season IS NOT NULL AND season_id IS NULL;

-- 3. Přejmenovat manual_goals → manual_goals_against
ALTER TABLE matches RENAME COLUMN manual_goals TO manual_goals_against;

-- 4. Aktualizovat status CHECK constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'));

-- 5. Migrovat legacy status hodnoty
UPDATE matches SET status = 'completed' WHERE status = 'closed';
UPDATE matches SET status = 'scheduled' WHERE status = 'open';

-- 6. Aktualizovat goalie_events situation CHECK
ALTER TABLE goalie_events DROP CONSTRAINT IF EXISTS goalie_events_situation_check;
ALTER TABLE goalie_events ADD CONSTRAINT goalie_events_situation_check
  CHECK (situation IN ('even', 'pp', 'sh', '4v4', '3v3'));

-- 7. Migrovat legacy situation hodnoty
UPDATE goalie_events SET situation = 'pp' WHERE situation = 'powerplay';
UPDATE goalie_events SET situation = 'sh' WHERE situation = 'shorthanded';

-- 8. FK index pro away_team_id
CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team_id);

-- 9. Indexy pro nové sloupce
CREATE INDEX IF NOT EXISTS idx_matches_season_id ON matches(season_id);

