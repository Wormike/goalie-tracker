import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface DiscoveredCompetition {
  name: string;
  abbreviation: string;
  matchCount: number;
  hasUpcoming: boolean;
  hasCompleted: boolean;
  sampleMatch?: string;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getMatchRows(html: string): cheerio.Cheerio<cheerio.Element> {
  const $ = cheerio.load(html);
  return $("table tbody tr, table tr");
}

function parseRows(
  rows: cheerio.Cheerio<cheerio.Element>,
  $: cheerio.CheerioAPI,
  map: Map<string, DiscoveredCompetition>
): number {
  let parsed = 0;
  rows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 7) return;

    const competitionAbbr = normalizeText($(cells[5]).text());
    if (!competitionAbbr) return;

    const homeTeam = normalizeText($(cells[8] || {}).text() || $(cells[6] || {}).text());
    const awayTeam = normalizeText($(cells[9] || {}).text() || $(cells[7] || {}).text());
    const statusText = normalizeText(
      $(cells[10] || cells[cells.length - 1] || {}).text()
    );
    const hasScore = /\d+\s*:\s*\d+/.test(statusText);

    const existing = map.get(competitionAbbr) || {
      name: competitionAbbr,
      abbreviation: competitionAbbr,
      matchCount: 0,
      hasUpcoming: false,
      hasCompleted: false,
      sampleMatch: undefined,
    };

    existing.matchCount += 1;
    if (hasScore) existing.hasCompleted = true;
    if (!hasScore) existing.hasUpcoming = true;
    if (!existing.sampleMatch && homeTeam && awayTeam) {
      existing.sampleMatch = `${homeTeam} vs ${awayTeam}`;
    }

    map.set(competitionAbbr, existing);
    parsed += 1;
  });

  return parsed;
}

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get("season") || "2025";
  const teamId = request.nextUrl.searchParams.get("teamId") || "1710";

  try {
    const competitionMap = new Map<string, DiscoveredCompetition>();
    let start = 0;
    const count = 30;
    let emptyPages = 0;

    while (start <= 600 && emptyPages < 2) {
      const url =
        `https://zapasy.ceskyhokej.cz/seznam-zapasu?` +
        `filter%5Bseason%5D=${season}` +
        `&filter%5Bteam%5D=${teamId}` +
        `&filter%5BtimeShortcut%5D=this-season` +
        `&filter%5Bdirection%5D=ASC` +
        `&filter%5BteamType%5D=all` +
        `&start=${start}&count=${count}` +
        `&actionType=default&do=more`;

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch competitions" }, { status: 502 });
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const rows = $("table tbody tr, table tr");
      const parsed = parseRows(rows, $, competitionMap);

      if (parsed === 0) {
        emptyPages += 1;
      } else {
        emptyPages = 0;
      }

      start += count;
    }

    const competitions = Array.from(competitionMap.values()).sort(
      (a, b) => b.matchCount - a.matchCount
    );

    return NextResponse.json({
      success: true,
      competitions,
      totalMatches: competitions.reduce((sum, c) => sum + c.matchCount, 0),
      scrapedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

