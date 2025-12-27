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
  // Zdrojová data bereme z webu Litoměřic (stejný systém pro celou soutěž),
  // ale v aplikaci pořád zvýrazňujeme HC Slovan Ústí jako „náš“ tým.
  const url = `https://www.hclitomerice.cz/standings?season=${season}&category=${categoryCode}`;

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

    // Najdi tabulku s hlavičkou obsahující "Tým" a "Z" – na hclitomerice.cz
    // může být více tabulek (přehledy, rozpisy apod.).
    let table = $("table")
      .filter((_, el) => {
        const headerCells = $(el).find("thead tr").first().find("th");
        const headerTexts = headerCells
          .map((_, c) => $(c).text().trim().toLowerCase())
          .get();
        return (
          headerTexts.length > 0 &&
          headerTexts.some((t) => t.includes("tým")) &&
          headerTexts.some((t) => t.startsWith("z"))
        );
      })
      .first();

    if (!table || table.length === 0) {
      // Fallback: první tabulka na stránce
      table = $("table").first();
    }

    if (!table || table.length === 0) {
      console.warn("[Standings] No table found on standings page");
      return null;
    }

    // Hlavička: pokud není <thead>, vezmi první řádek tabulky jako header
    const headRow =
      table.find("thead tr").first().length > 0
        ? table.find("thead tr").first()
        : table.find("tr").first();
    const headerCells = headRow.find("th,td");
    const headerTexts = headerCells
      .map((_, c) => $(c).text().trim().toUpperCase())
      .get();

    const hasVP = headerTexts.some((t) => t.includes("VP"));
    const hasPP = headerTexts.some((t) => t.includes("PP"));
    const hasR = headerTexts.some((t) => t === "R");

    const rows: StandingsRow[] = [];

    // Řádky dat – přeskoč header
    table.find("tr").slice(1).each((index, row) => {
      const cells = $(row).find("th,td");
      if (cells.length < 6) return;

      const cellTexts = cells
        .map((_, c) => $(c).text().trim().replace(/\s+/g, " "))
        .get();

      const position =
        parseInt(cellTexts[0].replace(".", ""), 10) || index + 1;
      const teamName = cellTexts[1] || "";
      if (!teamName) return;

      const gamesPlayed = parseInt(cellTexts[2], 10) || 0;

      let wins = 0;
      let winsOT = 0;
      let draws = 0;
      let lossesOT = 0;
      let losses = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;
      let points = 0;

      if (hasVP && hasPP && cellTexts.length >= 11) {
        // Formát Litoměřice:
        // P., TÝM, Z, V, VP, R, PP, P, VB, IB, B, RB
        wins = parseInt(cellTexts[3], 10) || 0;
        winsOT = parseInt(cellTexts[4], 10) || 0;
        draws = parseInt(cellTexts[5], 10) || 0;
        lossesOT = parseInt(cellTexts[6], 10) || 0;
        losses = parseInt(cellTexts[7], 10) || 0;
        goalsFor = parseInt(cellTexts[8], 10) || 0;
        goalsAgainst = parseInt(cellTexts[9], 10) || 0;
        points = parseInt(cellTexts[10], 10) || 0;
      } else if (hasR && cellTexts.length >= 8) {
        // Poř., Tým, Z, V, R, P, Skóre, B
        wins = parseInt(cellTexts[3], 10) || 0;
        draws = parseInt(cellTexts[4], 10) || 0;
        losses = parseInt(cellTexts[5], 10) || 0;
        const scoreText = cellTexts[6] || "";
        const goalsMatch = scoreText.match(/(\d+)\s*[:\-]\s*(\d+)/);
        goalsFor = goalsMatch ? parseInt(goalsMatch[1], 10) : 0;
        goalsAgainst = goalsMatch ? parseInt(goalsMatch[2], 10) : 0;
        points = parseInt(cellTexts[7], 10) || 0;
      } else {
        // Fallback: vezmi první číslo jako V, poslední jako B a najdi Skóre podle ":"
        wins = parseInt(cellTexts[3], 10) || 0;
        points = parseInt(cellTexts[cellTexts.length - 1], 10) || 0;
        const scoreText =
          cellTexts.find((txt) => txt.includes(":")) || "";
        const goalsMatch = scoreText.match(/(\d+)\s*[:\-]\s*(\d+)/);
        goalsFor = goalsMatch ? parseInt(goalsMatch[1], 10) : 0;
        goalsAgainst = goalsMatch ? parseInt(goalsMatch[2], 10) : 0;
        // Zbytek sloupců necháme jako 0
      }

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
      console.warn("[Standings] No rows parsed from standings table for", url);
      // Ulož HTML pro ladění
      try {
        const fs = await import("fs");
        const path = await import("path");
        const dataDir = path.join(process.cwd(), "data");
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        const debugPath = path.join(
          dataDir,
          `debug-standings-${categoryCode}.html`
        );
        fs.writeFileSync(debugPath, html, "utf8");
        console.warn("[Standings] Saved debug HTML to", debugPath);
      } catch (e) {
        console.warn("[Standings] Failed to save debug HTML:", e);
      }
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
        // Nevracej 404, aby v UI nestrašil „Failed to load resource“.
        // Místo toho vrať success:false a prázdná data.
        return NextResponse.json({
          success: false,
          standings: null,
          competitions: CATEGORY_CONFIG,
          competitionId,
          season,
          elapsed: Date.now() - start,
        });
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
        return NextResponse.json({
          success: false,
          standings: null,
          competitions: CATEGORY_CONFIG,
          competitionId,
          season,
          elapsed: Date.now() - start,
        });
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
