import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { StandingsRow, CompetitionStandings } from "@/lib/types";

// Competition IDs for ustecky.ceskyhokej.cz
// Tyto ID odpovídají selectu "competitions" na stránce /tabulky
const COMPETITIONS = [
  { id: '1860', category: 'Starší žáci A', name: 'Liga starších žáků "A"' },
  { id: '1872', category: 'Starší žáci B', name: 'Liga starších žáků "B"' },
  { id: '1884', category: 'Mladší žáci A', name: 'Liga mladších žáků "A"' },
  { id: '1894', category: 'Mladší žáci B', name: 'Liga mladších žáků "B"' },
  { id: '1844', category: 'Muži', name: 'Krajská liga mužů Ústeckého kraje' },
  { id: '1970', category: 'Junioři', name: 'Regionální liga juniorů' },
  { id: '1986', category: 'Dorost', name: 'Regionální liga dorostu' },
];

async function fetchStandingsForCompetition(
  competitionId: string,
  season: string
): Promise<CompetitionStandings | null> {
  // Web používá POST request s parametry pro správné načtení tabulky
  // Klíčové je použít správný "do" parameter pro submit formuláře
  const url = `https://ustecky.ceskyhokej.cz/tabulky`;
  
  const formData = new URLSearchParams({
    'seasons': season,
    'competitions': competitionId,
    'do': 'competitionsTableList-competitionsFilter-form-submit',
  });
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.error(`[Standings] HTTP error ${response.status} for competition ${competitionId}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const rows: StandingsRow[] = [];
    
    // Najdi název soutěže z h2 nadpisu
    const competitionTitle = $('h2.mb-6').first().text().trim() || 
      COMPETITIONS.find(c => c.id === competitionId)?.name || 
      `Soutěž ${competitionId}`;
    
    // Parsuj tabulku - struktura: # | Tým | Z | V | VP | PP | P | Skóre | B
    $('table.table tbody tr, table.table tr').each((index, row) => {
      const cells = $(row).find('td');
      if (cells.length < 8) return;
      
      // Pozice - odstraň tečku (např. "1." -> 1)
      const posText = $(cells[0]).text().trim().replace('.', '');
      const position = parseInt(posText) || index + 1;
      
      // Název týmu
      const teamName = $(cells[1]).text().trim();
      if (!teamName) return;
      
      // Statistiky - počet sloupců může být 9 nebo 10 podle toho, zda jsou VP/PP
      const numCols = cells.length;
      
      let gamesPlayed = 0;
      let wins = 0;
      let winsOT = 0; // VP - výhry v prodloužení
      let lossesOT = 0; // PP - prohry v prodloužení  
      let losses = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;
      let points = 0;
      
      if (numCols >= 10) {
        // Rozšířená tabulka: # | Tým | Z | V | VP | PP | P | Skóre | B
        gamesPlayed = parseInt($(cells[2]).text().trim()) || 0;
        wins = parseInt($(cells[3]).text().trim()) || 0;
        winsOT = parseInt($(cells[4]).text().trim()) || 0;
        lossesOT = parseInt($(cells[5]).text().trim()) || 0;
        losses = parseInt($(cells[6]).text().trim()) || 0;
        
        const goalsCell = $(cells[7]).text().trim();
        const goalsMatch = goalsCell.match(/(\d+)\s*[:\-]\s*(\d+)/);
        if (goalsMatch) {
          goalsFor = parseInt(goalsMatch[1]) || 0;
          goalsAgainst = parseInt(goalsMatch[2]) || 0;
        }
        
        points = parseInt($(cells[8]).text().trim()) || 0;
      } else if (numCols >= 9) {
        // Tabulka s VP/PP: # | Tým | Z | V | VP | PP | P | Skóre | B
        gamesPlayed = parseInt($(cells[2]).text().trim()) || 0;
        wins = parseInt($(cells[3]).text().trim()) || 0;
        winsOT = parseInt($(cells[4]).text().trim()) || 0;
        lossesOT = parseInt($(cells[5]).text().trim()) || 0;
        losses = parseInt($(cells[6]).text().trim()) || 0;
        
        const goalsCell = $(cells[7]).text().trim();
        const goalsMatch = goalsCell.match(/(\d+)\s*[:\-]\s*(\d+)/);
        if (goalsMatch) {
          goalsFor = parseInt(goalsMatch[1]) || 0;
          goalsAgainst = parseInt(goalsMatch[2]) || 0;
        }
        
        points = parseInt($(cells[8]).text().trim()) || 0;
      } else {
        // Základní tabulka: # | Tým | Z | V | R | P | Skóre | B
        gamesPlayed = parseInt($(cells[2]).text().trim()) || 0;
        wins = parseInt($(cells[3]).text().trim()) || 0;
        const draws = parseInt($(cells[4]).text().trim()) || 0;
        losses = parseInt($(cells[5]).text().trim()) || 0;
        
        const goalsCell = $(cells[6]).text().trim();
        const goalsMatch = goalsCell.match(/(\d+)\s*[:\-]\s*(\d+)/);
        if (goalsMatch) {
          goalsFor = parseInt(goalsMatch[1]) || 0;
          goalsAgainst = parseInt(goalsMatch[2]) || 0;
        }
        
        points = parseInt($(cells[7]).text().trim()) || 0;
        winsOT = draws; // Pro kompatibilitu
      }
      
      // Označ náš tým
      const isOurTeam = teamName.toLowerCase().includes('ústí') || 
                        teamName.toLowerCase().includes('usti') ||
                        teamName.toLowerCase().includes('slovan ústí');
      
      rows.push({
        position,
        teamName,
        gamesPlayed,
        wins,
        winsOT,
        lossesOT,
        draws: winsOT, // Pro zpětnou kompatibilitu
        losses,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        points,
        isOurTeam,
      });
    });
    
    if (rows.length === 0) {
      console.warn(`[Standings] No rows found for competition ${competitionId}`);
      return null;
    }
    
    // Seřaď podle pozice
    rows.sort((a, b) => a.position - b.position);
    
    console.log(`[Standings] Loaded ${rows.length} teams for ${competitionTitle}`);
    
    return {
      id: `standings-${competitionId}-${season}`,
      competitionId: `comp-${competitionId}`,
      competitionName: competitionTitle,
      seasonId: season,
      externalCompetitionId: competitionId,
      updatedAt: new Date().toISOString(),
      rows,
    };
  } catch (error) {
    console.error(`[Standings] Error fetching for competition ${competitionId}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get('season') || '2025-2026';
  const competitionId = request.nextUrl.searchParams.get('competitionId');
  
  const start = Date.now();
  
  try {
    if (competitionId) {
      // Fetch single competition standings
      const standings = await fetchStandingsForCompetition(competitionId, season);
      
      if (!standings) {
        return NextResponse.json(
          { error: "Standings not found", competitionId, season },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        standings,
        elapsed: Date.now() - start,
      });
    }
    
    // Fetch all competitions standings
    const standingsPromises = COMPETITIONS.map(comp => 
      fetchStandingsForCompetition(comp.id, season)
    );
    const results = await Promise.all(standingsPromises);
    const standings = results.filter((s): s is CompetitionStandings => s !== null);
    
    return NextResponse.json({
      success: true,
      standings,
      competitions: COMPETITIONS,
      elapsed: Date.now() - start,
    });
  } catch (error) {
    console.error("[Standings] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch standings", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { season = '2025-2026', competitionId } = body;
  
  const start = Date.now();
  
  try {
    if (competitionId) {
      const standings = await fetchStandingsForCompetition(competitionId, season);
      
      if (!standings) {
        return NextResponse.json(
          { error: "Standings not found", competitionId, season },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        standings,
        elapsed: Date.now() - start,
      });
    }
    
    // Fetch all competitions
    const standingsPromises = COMPETITIONS.map(comp => 
      fetchStandingsForCompetition(comp.id, season)
    );
    const results = await Promise.all(standingsPromises);
    const standings = results.filter((s): s is CompetitionStandings => s !== null);
    
    return NextResponse.json({
      success: true,
      standings,
      competitions: COMPETITIONS,
      elapsed: Date.now() - start,
    });
  } catch (error) {
    console.error("[Standings] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch standings", details: String(error) },
      { status: 500 }
    );
  }
}
