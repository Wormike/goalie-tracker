/**
 * Scraper pro zápasy z ustecky.ceskyhokej.cz
 * 
 * Spuštění:
 *   npx ts-node scripts/scrape-ustecky.ts
 * 
 * Nebo s konkrétní soutěží:
 *   npx ts-node scripts/scrape-ustecky.ts --competition 1872
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ScrapedMatch {
  externalId: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  datetime: string;
  category: string;
  completed: boolean;
}

// Competition IDs from ustecky.ceskyhokej.cz
// Note: IDs differ between seasons!
const COMPETITIONS_BY_SEASON: Record<string, { id: string; name: string; category: string }[]> = {
  '2025-2026': [
    { id: '1860', name: 'Liga starších žáků A', category: 'Starší žáci A' },
    { id: '1872', name: 'Liga starších žáků B', category: 'Starší žáci B' },
    { id: '1884', name: 'Liga mladších žáků A', category: 'Mladší žáci A' },
    { id: '1894', name: 'Liga mladších žáků B', category: 'Mladší žáci B' },
  ],
  '2024-2025': [
    { id: '1696', name: 'Liga starších žáků A', category: 'Starší žáci A' },
    { id: '1706', name: 'Liga starších žáků B', category: 'Starší žáci B' },
    { id: '1718', name: 'Liga mladších žáků A', category: 'Mladší žáci A' },
    { id: '1727', name: 'Liga mladších žáků B', category: 'Mladší žáci B' },
  ],
};

async function fetchAllMatchesForCompetition(
  competitionId: string,
  season: string,
  categoryName: string
): Promise<ScrapedMatch[]> {
  const allMatches: ScrapedMatch[] = [];
  
  // Fetch all rounds (1-20)
  for (let round = 1; round <= 20; round++) {
    const url = `https://ustecky.ceskyhokej.cz/rozpis-utkani-a-vysledky?seasonFilter-filter-id=${season}&leagueFilter-filter-id=${competitionId}&roundFilter-filter-id=${round}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      
      if (!response.ok) continue;
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Find the table with matches
      $('table.table tbody tr').each((index, row) => {
        const cells = $(row).find('td');
        if (cells.length < 6) return;
        
        const matchId = $(cells[0]).text().trim();
        const dateTimeStr = $(cells[1]).text().trim();
        const homeTeam = $(cells[2]).text().trim();
        const scoreCell = $(cells[3]).text().trim();
        const awayTeam = $(cells[5]).text().trim();
        
        if (!matchId || !homeTeam || !awayTeam) return;
        
        // Parse date and time (format: "22.09.2024 17:00")
        let datetime = '';
        const dateMatch = dateTimeStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
        if (dateMatch) {
          const [, day, month, year, hour, minute] = dateMatch;
          datetime = `${year}-${month}-${day}T${hour}:${minute}:00`;
        }
        
        // Parse score
        let homeScore: number | null = null;
        let awayScore: number | null = null;
        let completed = false;
        
        const scoreMatch = scoreCell.match(/(\d+)\s*[:\-]\s*(\d+)/);
        if (scoreMatch) {
          homeScore = parseInt(scoreMatch[1]);
          awayScore = parseInt(scoreMatch[2]);
          completed = true;
        } else if (datetime) {
          const matchDate = new Date(datetime);
          completed = matchDate < new Date();
        }
        
        // Filter only matches involving Slovan Ústí n.Labem (not Louny!)
        const isSlovanUstiMatch = 
          homeTeam.toLowerCase().includes('ústí') || 
          awayTeam.toLowerCase().includes('ústí') ||
          homeTeam.toLowerCase().includes('usti') || 
          awayTeam.toLowerCase().includes('usti');
        
        if (isSlovanUstiMatch && datetime) {
          allMatches.push({
            externalId: `${competitionId}-${matchId}`,
            home: homeTeam,
            away: awayTeam,
            homeScore,
            awayScore,
            datetime,
            category: categoryName,
            completed,
          });
        }
      });
      
    } catch {
      // Continue to next round
    }
  }
  
  return allMatches;
}

async function main() {
  const args = process.argv.slice(2);
  let competitionFilter: string | null = null;
  let season = '2024-2025';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--competition' && args[i + 1]) {
      competitionFilter = args[i + 1];
    }
    if (args[i] === '--season' && args[i + 1]) {
      season = args[i + 1];
    }
  }
  
  console.log('🏒 Goalie Tracker - Scraper zápasů (ustecky.ceskyhokej.cz)');
  console.log('============================================================');
  console.log(`   Sezóna: ${season}\n`);
  
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const allMatches: ScrapedMatch[] = [];
  
  const COMPETITIONS = COMPETITIONS_BY_SEASON[season] || COMPETITIONS_BY_SEASON['2025-2026'];
  
  const competitions = competitionFilter
    ? COMPETITIONS.filter(c => c.id === competitionFilter)
    : COMPETITIONS;
  
  for (const comp of competitions) {
    console.log(`📋 Načítám: ${comp.category}...`);
    const matches = await fetchAllMatchesForCompetition(comp.id, season, comp.category);
    console.log(`   ✓ Nalezeno ${matches.length} zápasů\n`);
    allMatches.push(...matches);
  }
  
  // Remove duplicates
  const uniqueMatches = Array.from(
    new Map(allMatches.map(m => [m.externalId, m])).values()
  );
  
  // Convert to app format
  const appMatches = uniqueMatches.map(m => ({
    id: `imported-${m.externalId}`,
    externalId: m.externalId,
    home: m.home,
    away: m.away,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    datetime: m.datetime,
    category: m.category,
    matchType: 'league' as const,
    source: 'ceskyhokej' as const,
    completed: m.completed,
    seasonId: season,
    manualStats: m.completed ? { shots: 0, saves: 0, goals: 0 } : undefined,
  }));
  
  // Sort by date
  appMatches.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  
  const outputPath = path.join(dataDir, 'scraped-matches.json');
  fs.writeFileSync(outputPath, JSON.stringify(appMatches, null, 2));
  
  console.log('============================================================');
  console.log(`✓ Celkem nalezeno: ${appMatches.length} unikátních zápasů`);
  console.log(`✓ Uloženo do: ${outputPath}`);
  
  const completedCount = appMatches.filter(m => m.completed).length;
  const upcomingCount = appMatches.filter(m => !m.completed).length;
  console.log(`   - Proběhlé: ${completedCount}`);
  console.log(`   - Nadcházející: ${upcomingCount}`);
  
  if (appMatches.length > 0) {
    console.log('\n📋 Přehled zápasů:');
    appMatches.forEach(m => {
      const date = new Date(m.datetime).toLocaleDateString('cs-CZ');
      const score = m.completed && m.homeScore !== null 
        ? `${m.homeScore}:${m.awayScore}` 
        : '-';
      const status = m.completed ? '✓' : '○';
      console.log(`   ${status} ${date} | ${m.home} ${score} ${m.away} (${m.category})`);
    });
    
    console.log('\n💡 Pro import do aplikace:');
    console.log('   1. Otevřete http://localhost:3000');
    console.log('   2. Klikněte na "Import z webu"');
    console.log('   3. Přepněte na záložku "Z JSON"');
    console.log(`   4. Vložte obsah souboru: ${outputPath}`);
  }
}

main().catch(console.error);
