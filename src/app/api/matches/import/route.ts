import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { Match } from "@/lib/types";

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

// Competition IDs for ustecky.ceskyhokej.cz
const COMPETITIONS_BY_SEASON: Record<string, { id: string; category: string }[]> = {
  '2025-2026': [
    { id: '1860', category: 'Starší žáci A' },
    { id: '1872', category: 'Starší žáci B' },
    { id: '1884', category: 'Mladší žáci A' },
    { id: '1894', category: 'Mladší žáci B' },
  ],
  '2024-2025': [
    { id: '1696', category: 'Starší žáci A' },
    { id: '1706', category: 'Starší žáci B' },
    { id: '1718', category: 'Mladší žáci A' },
    { id: '1727', category: 'Mladší žáci B' },
  ],
};

async function fetchMatchesFromRegionalSite(
  competitionId: string,
  season: string,
  category: string
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
      
      $('table.table tbody tr').each((index, row) => {
        const cells = $(row).find('td');
        if (cells.length < 6) return;
        
        const matchId = $(cells[0]).text().trim();
        const dateTimeStr = $(cells[1]).text().trim();
        const homeTeam = $(cells[2]).text().trim();
        const scoreCell = $(cells[3]).text().trim();
        const awayTeam = $(cells[5]).text().trim();
        
        if (!matchId || !homeTeam || !awayTeam) return;
        
        // Parse date and time
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
        
        // Filter only matches involving Slovan Ústí
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
            category,
            completed,
          });
        }
      });
      
    } catch (error) {
      // Continue to next round
    }
  }
  
  return allMatches;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { competitionId, season = '2025-2026' } = body;

    const allMatches: ScrapedMatch[] = [];
    
    // Get competitions for the season
    const competitions = COMPETITIONS_BY_SEASON[season] || COMPETITIONS_BY_SEASON['2025-2026'];
    
    // If specific competition requested, filter to that one
    const targetCompetitions = competitionId
      ? competitions.filter(c => c.id === competitionId)
      : competitions;

    // Fetch matches from all competitions
    for (const comp of targetCompetitions) {
      const matches = await fetchMatchesFromRegionalSite(comp.id, season, comp.category);
      allMatches.push(...matches);
    }

    // Remove duplicates
    const uniqueMatches = Array.from(
      new Map(allMatches.map(m => [m.externalId, m])).values()
    );

    // Convert to app format
    const matches: Match[] = uniqueMatches.map((m) => ({
      id: `imported-${m.externalId}`,
      externalId: m.externalId,
      home: m.home,
      away: m.away,
      homeScore: m.homeScore ?? undefined,
      awayScore: m.awayScore ?? undefined,
      datetime: m.datetime,
      category: m.category,
      matchType: "league" as const,
      source: "ceskyhokej" as const,
      completed: m.completed,
      seasonId: season,
      manualStats: m.completed
        ? { shots: 0, saves: 0, goals: 0 }
        : undefined,
    }));

    // Sort by date
    matches.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    return NextResponse.json({
      success: true,
      matches,
      totalCount: matches.length,
      completedCount: matches.filter(m => m.completed).length,
      upcomingCount: matches.filter(m => !m.completed).length,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import matches" },
      { status: 500 }
    );
  }
}
