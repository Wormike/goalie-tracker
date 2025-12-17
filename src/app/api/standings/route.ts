import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { StandingsRow, CompetitionStandings } from "@/lib/types";

type CategoryCode = "Z8" | "Z7" | "Z6" | "Z5";

const CATEGORY_CONFIG = [
  {
    code: "Z8" as CategoryCode,
    name: 'Liga starších žáků "A" sk. 2',
    display: "Starší žáci A (8. třída)",
  },
  {
    code: "Z7" as CategoryCode,
    name: 'Liga starších žáků "B" sk. 10',
    display: "Starší žáci B (7. třída)",
  },
  {
    code: "Z6" as CategoryCode,
    name: 'Liga mladších žáků "A" sk. 4',
    display: "Mladší žáci A (6. třída)",
  },
  {
    code: "Z5" as CategoryCode,
    name: 'Liga mladších žáků "B" sk. 14',
    display: "Mladší žáci B (5. třída)",
  },
];

function isSlovanUsti(teamName: string): boolean {
  const norm = teamName.toLowerCase().replace(/\s+/g, " ").trim();
  const variants = [
    "slovan ústí",
    "hc slovan ústí",
    "slovan usti",
    "hc slovan usti",
  ];
  return variants.some((v) => norm.includes(v));
}

async function fetchStandingsFromLitomerice(categoryCode: CategoryCode, season: string): Promise<CompetitionStandings | null> {
  // NOTE: Although the helper name mentions Litoměřice, the data source
  // is the Slovan Ústí website, which používá stejný systém standings.
  const url = `https://slovanusti.cz/standings?season=${season}&category=${categoryCode}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Standings] HTTP error ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Pick the first meaningful table on the page
    const table = $("table").first();
    if (!table || table.length === 0) {
      console.warn("[Standings] No table found on standings page");
      return null;
    }

    const rows: StandingsRow[] = [];

    table.find("tbody tr").each((index, row) => {
      const cells = $(row).find("td");
      if (cells.length < 5) return;

      // Slovanusti standings tables typically use:
      // Poř., Tým, Z, V, VP, R, PP, P, Skóre, B
      const getText = (i: number) =>
        $(cells[i] || {}).text().trim().replace(/\s+/g, " ");

      const rawPosition = getText(0);
      const position = parseInt(rawPosition.replace(".", ""), 10) || index + 1;

      const teamName = getText(1);
      if (!teamName) return;

      const gamesPlayed = parseInt(getText(2), 10) || 0;
      const wins = parseInt(getText(3), 10) || 0;
      const winsOT = parseInt(getText(4), 10) || 0;
      const draws = parseInt(getText(5), 10) || 0;
      const lossesOT = parseInt(getText(6), 10) || 0;
      const losses = parseInt(getText(7), 10) || 0;

      const scoreText = getText(8);
      const goalsMatch = scoreText.match(/(\d+)\s*[:\-]\s*(\d+)/);
      const goalsFor = goalsMatch ? parseInt(goalsMatch[1], 10) : 0;
      const goalsAgainst = goalsMatch ? parseInt(goalsMatch[2], 10) : 0;

      const points = parseInt(getText(9), 10) || 0;

      const isOurTeam = isSlovanUsti(teamName);

      rows.push({
        position,
        teamName,
        gamesPlayed,
        wins,
        winsOT,
        draws,
        lossesOT,
        losses,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        points,
        isOurTeam,
      });
    });

    if (rows.length === 0) {
      console.warn("[Standings] No rows parsed from standings table");
      return null;
    }

    rows.sort((a, b) => a.position - b.position);

    const config = CATEGORY_CONFIG.find((c) => c.code === categoryCode);

    return {
      id: `standings-${categoryCode}-${season}`,
      competitionId: categoryCode,
      competitionName: config?.name || categoryCode,
      seasonId: season,
      externalCompetitionId: categoryCode,
      updatedAt: new Date().toISOString(),
      rows,
    };
  } catch (error) {
    console.error(`[Standings] Error fetching for category ${categoryCode}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get("season") || "2026";
  const competitionId = (request.nextUrl.searchParams.get("competitionId") ||
    request.nextUrl.searchParams.get("category")) as CategoryCode | null;

  const start = Date.now();

  try {
    if (competitionId) {
      const standings = await fetchStandingsFromLitomerice(competitionId, season);

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

    const standingsPromises = CATEGORY_CONFIG.map((comp) =>
      fetchStandingsFromLitomerice(comp.code, season)
    );
    const results = await Promise.all(standingsPromises);
    const standings = results.filter((s): s is CompetitionStandings => s !== null);

    return NextResponse.json({
      success: true,
      standings,
      competitions: CATEGORY_CONFIG,
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
  const season: string = body.season || "2026";
  const competitionId: CategoryCode | undefined = body.competitionId || body.category;

  const start = Date.now();

  try {
    if (competitionId) {
      const standings = await fetchStandingsFromLitomerice(competitionId, season);

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

    const standingsPromises = CATEGORY_CONFIG.map((comp) =>
      fetchStandingsFromLitomerice(comp.code, season)
    );
    const results = await Promise.all(standingsPromises);
    const standings = results.filter((s): s is CompetitionStandings => s !== null);

    return NextResponse.json({
      success: true,
      standings,
      competitions: CATEGORY_CONFIG,
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
