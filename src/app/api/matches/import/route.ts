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

// Competition IDs for ustecky.ceskyhokej.cz (verified for 2025-2026 season)
const COMPETITIONS = [
  { id: '1860', category: 'Starší žáci A' },
  { id: '1872', category: 'Starší žáci B' },
  { id: '1884', category: 'Mladší žáci A' },
  { id: '1894', category: 'Mladší žáci B' },
];

async function fetchAllMatchesForCompetition(
  competitionId: string,
  season: string,
  category: string
): Promise<ScrapedMatch[]> {
  // Fetch all rounds at once by not specifying round filter
  // The site shows current round by default, but we can try fetching multiple
  const url = `https://ustecky.ceskyhokej.cz/rozpis-utkani-a-vysledky?seasonFilter-filter-id=${season}&leagueFilter-filter-id=${competitionId}`;
  
  const matches: ScrapedMatch[] = [];
  
  // Fetch rounds 1-12 in parallel (most competitions have ~10-12 rounds)
  const roundPromises = Array.from({ length: 12 }, (_, i) => i + 1).map(async (round) => {
    const roundUrl = `${url}&roundFilter-filter-id=${round}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(roundUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      
      clearTimeout(timeoutId);
      if (!response.ok) return [];
      
      const html = await response.text();
      const $ = cheerio.load(html);
      const roundMatches: ScrapedMatch[] = [];
      
      $('table.table tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 6) return;
        
        const matchId = $(cells[0]).text().trim();
        const dateTimeStr = $(cells[1]).text().trim();
        const homeTeam = $(cells[2]).text().trim();
        const scoreCell = $(cells[3]).text().trim();
        const awayTeam = $(cells[5]).text().trim();
        
        if (!matchId || !homeTeam || !awayTeam) return;
        
        // Parse date
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
        } else if (datetime && new Date(datetime) < new Date()) {
          completed = true;
        }
        
        // Filter Slovan Ústí matches
        const text = (homeTeam + awayTeam).toLowerCase();
        if ((text.includes('ústí') || text.includes('usti')) && datetime) {
          roundMatches.push({
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
      
      return roundMatches;
    } catch {
      return [];
    }
  });
  
  const results = await Promise.all(roundPromises);
  results.forEach(r => matches.push(...r));
  
  return matches;
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  
  try {
    const body = await request.json();
    const { season = '2025-2026', category } = body;

    // Fetch all competitions in parallel
    const competitionsToFetch = category 
      ? COMPETITIONS.filter(c => c.category === category)
      : COMPETITIONS;
    
    const allResults = await Promise.all(
      competitionsToFetch.map(comp => 
        fetchAllMatchesForCompetition(comp.id, season, comp.category)
      )
    );
    
    const allMatches = allResults.flat();
    
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
      manualStats: m.completed ? { shots: 0, saves: 0, goals: 0 } : undefined,
    }));

    matches.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    return NextResponse.json({
      success: true,
      matches,
      totalCount: matches.length,
      completedCount: matches.filter(m => m.completed).length,
      upcomingCount: matches.filter(m => !m.completed).length,
      elapsed: Date.now() - start,
    });
  } catch (error) {
    console.error("[Import] Error:", error);
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get('season') || '2025-2026';
  return POST({ json: async () => ({ season }) } as NextRequest);
}
