import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { Match } from "@/lib/types";

interface ScrapedMatch {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  datetime: string;
  venue?: string;
  category: string;
  matchNumber?: string;
  completed: boolean;
  statusText?: string;
}

type CategoryConfig = {
  slug: "starsi-zaci-a" | "starsi-zaci-b" | "mladsi-zaci-a" | "mladsi-zaci-b";
  displayName: string;
  // Strings we expect to find in the "Soutěž" column
  aliases: string[];
};

// Pre-filter configuration for zapasy.ceskyhokej.cz per category.
// These correspond to Slovan Ústí team (1710) in Ústecký kraj (6) and specific league IDs.
const CATEGORY_FILTERS: Partial<Record<CategoryConfig["slug"], { league: string; team: string; region?: string }>> = {
  "starsi-zaci-a": { league: "league_115", team: "1710", region: "6" },
  "starsi-zaci-b": { league: "league_116", team: "1710", region: "6" },
  "mladsi-zaci-a": { league: "league_117", team: "1710", region: "6" },
  "mladsi-zaci-b": { league: "league_118", team: "1710", region: "6" },
};

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    slug: "starsi-zaci-a",
    displayName: 'Liga starších žáků "A" sk. 2',
    aliases: [
      'Liga starších žáků "A" sk. 2',
      "starsi zaci a",
      'SŽ "A"',
      "SŽA",
      "S3T",
      "SŽA USK",
      "SŽA ÚK",
    ],
  },
  {
    slug: "starsi-zaci-b",
    displayName: 'Liga starších žáků "B" sk. 10',
    aliases: [
      'Liga starších žáků "B" sk. 10',
      "starsi zaci b",
      'SŽ "B"',
      "SŽB",
      "S3T",
      "SŽB USK",
      "SŽB ÚK",
    ],
  },
  {
    slug: "mladsi-zaci-a",
    displayName: 'Liga mladších žáků "A" sk. 4',
    aliases: [
      'Liga mladších žáků "A" sk. 4',
      "mladsi zaci a",
      'MŽ "A"',
      "MŽA",
      "M3T",
      "MŽA USK",
      "MŽA ÚK",
    ],
  },
  {
    slug: "mladsi-zaci-b",
    displayName: 'Liga mladších žáků "B" sk. 14',
    aliases: [
      'Liga mladších žáků "B" sk. 14',
      "mladsi zaci b",
      'MŽ "B"',
      "MŽB",
      "M3T",
      "MŽB USK",
      "MŽB ÚK",
    ],
  },
];

const SLOVAN_VARIANTS = [
  "slovan ústí n.labem",
  "slovan ústí nad labem",
  "hc slovan ústí nad labem",
  "slovan usti nad labem",
  "slovan usti n.labem",
  "slovan usti",
  "slovan ústí n.labem b",
  "slovan usti n.labem b",
  "slovan usti b",
  "slovan ústí b",
];

function normalizeTeam(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function isSlovanUsti(team: string): boolean {
  const norm = normalizeTeam(team);
  return SLOVAN_VARIANTS.some((variant) => norm.includes(variant));
}

function parseDateTime(dateStr: string, timeStr: string): string | null {
  const dateMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dateMatch) return null;
  const [, day, month, year] = dateMatch;

  // time can be "08:00" or "10:00 - 19:00"
  const timePart = (timeStr || "").split("-")[0]?.trim() || "";
  const [hh = "00", mm = "00"] = timePart.split(":");

  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00`;
  return iso;
}

function parseDateRange(dateCell: string, timeCell: string): string[] {
  // Handles "17.01.2026 - 18.01.2026" or single date
  const parts = dateCell.split("-").map((p) => p.trim()).filter(Boolean);
  const uniqueIso: string[] = [];
  parts.forEach((p) => {
    const iso = parseDateTime(p, timeCell);
    if (iso) uniqueIso.push(iso);
  });
  // If nothing parsed but single date, try whole string
  if (uniqueIso.length === 0) {
    const iso = parseDateTime(dateCell.trim(), timeCell);
    if (iso) uniqueIso.push(iso);
  }
  return uniqueIso;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getCategoryFromText(text: string): CategoryConfig | null {
  const normalized = text.toLowerCase();
  return (
    CATEGORY_CONFIGS.find((cfg) =>
      cfg.aliases.some((alias) => normalized.includes(alias.toLowerCase()))
    ) || null
  );
}

async function scrapeZapasyCeskyhokej(categorySlug?: CategoryConfig["slug"], season = "2025-2026"): Promise<ScrapedMatch[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const seasonStr = season || "2025-2026";
    const startYear = parseInt(seasonStr.slice(0, 4), 10) || 2025;
    const filterSeason = String(startYear);

    // Prefer a pre-filtered URL per category (whole season for Slovan Ústí in given league).
    const filterPreset = categorySlug ? CATEGORY_FILTERS[categorySlug] : null;
    const filteredUrl = filterPreset
      ? `https://zapasy.ceskyhokej.cz/seznam-zapasu?filter%5Bseason%5D=${filterSeason}&filter%5BdateRange%5D=&filter%5BmanagingAuthorities%5D=all&filter%5Bregion%5D=${filterPreset.region || "6"}&filter%5Bteam%5D=${filterPreset.team}&filter%5BtimeShortcut%5D=this-season&filter%5Bleague%5D=${filterPreset.league}&filter%5Bnumber%5D=&filter%5Bstadium%5D=all&filter%5Bstate%5D=&filter%5BteamType%5D=all&filter%5Bsort%5D=&filter%5Bdirection%5D=ASC`
      : "https://zapasy.ceskyhokej.cz/seznam-zapasu";

    const response = await fetch(filteredUrl, {
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
      console.error("[Import] HTTP error from zapasy.ceskyhokej.cz:", response.status);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const matches: ScrapedMatch[] = [];
    const now = new Date();
    // If we used a pre-filtered URL (all configured categories have it),
    // load the whole season based on the season parameter; otherwise keep 1w back / 3w forward.
    const useFullSeason = Boolean(filterPreset);
    const fromDate = useFullSeason
      ? new Date(`${startYear}-01-01`)
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const toDate = useFullSeason
      ? new Date(`${startYear + 1}-12-31`)
      : new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

    $("table tbody tr, table tr").each((index, row) => {
      const cells = $(row).find("td");
      if (cells.length < 7) return;

      // The first cell is a checkbox; adjust indices accordingly.
      const dateText = $(cells[2]).text().trim();
      const timeText = $(cells[3]).text().trim();
      const venue = $(cells[4]).text().trim();
      const competitionText = $(cells[5]).text().trim();
      const round = $(cells[6] || {}).text().trim();
      const matchNumber = $(cells[7] || {}).text().trim();
      const homeTeam = $(cells[8] || {}).text().trim() || $(cells[6] || {}).text().trim();
      const awayTeam = $(cells[9] || {}).text().trim() || $(cells[7] || {}).text().trim();
      const statusText = $(cells[10] || cells[cells.length - 1] || {}).text().trim();

      const datetimes = parseDateRange(dateText, timeText);
      if (datetimes.length === 0) return;

      const inWindow = datetimes.some((dt) => {
        const dv = new Date(dt);
        return dv >= fromDate && dv <= toDate;
      });
      if (!inWindow) return;

      // Filter only Slovan Ústí matches
      const involvesSlovan = isSlovanUsti(homeTeam) || isSlovanUsti(awayTeam);
      if (!involvesSlovan) return;

      const categoryFromText = getCategoryFromText(competitionText);
      const requestedCategory = categorySlug
        ? CATEGORY_CONFIGS.find((cfg) => cfg.slug === categorySlug) || null
        : null;

      // Respect requested category; if no category provided, use detected or fallback to raw competitionText
      if (requestedCategory && categoryFromText && requestedCategory.slug !== categoryFromText.slug) {
        return;
      }

      const categoryName = (requestedCategory || categoryFromText)?.displayName || competitionText || "Neznámá soutěž";

      // Parse score from status cell (e.g. "[3:2]" or "3:2")
      let homeScore: number | null = null;
      let awayScore: number | null = null;
      const scoreMatch = statusText.match(/(\d+)\s*[:\-]\s*(\d+)/);
      if (scoreMatch) {
        homeScore = parseInt(scoreMatch[1], 10);
        awayScore = parseInt(scoreMatch[2], 10);
      }

      const completed = homeScore !== null && awayScore !== null;

      datetimes.forEach((dt, idx) => {
        const base = `${categorySlug || categoryName}-${matchNumber || round || index}`;
        const externalIdBase = slugify(base) || `row-${index}`;
        const externalId = datetimes.length > 1 ? `${externalIdBase}-${idx + 1}` : externalIdBase;

        matches.push({
          externalId,
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
          datetime: dt,
          venue,
          category: categoryName,
          matchNumber,
          completed,
          statusText,
        });
      });
    });

    if (matches.length > 0) {
      return matches;
    }

    // If nothing parsed, save debug HTML for inspection
    try {
      const fs = await import("fs");
      const path = await import("path");
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const debugPath = path.join(dataDir, "debug-zapasy.html");
      fs.writeFileSync(debugPath, html, "utf8");
      console.warn("[Import] No rows parsed, saved HTML to", debugPath);
    } catch (e) {
      console.warn("[Import] No rows parsed and failed to save debug HTML:", e);
    }

    return [];
  } catch (error) {
    console.error("[Import] Error scraping zapasy.ceskyhokej.cz:", error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const body = await request.json();
    const season = body.season || "2025-2026";
    const categorySlug: CategoryConfig["slug"] | undefined = body.category;

    const scrapedMatches = await scrapeZapasyCeskyhokej(categorySlug, season);

    // Deduplicate by externalId
    const uniqueMatches = Array.from(
      new Map(scrapedMatches.map((m) => [m.externalId, m])).values()
    );

    const matches: Match[] = uniqueMatches.map((m) => ({
      id: `imported-${m.externalId}`,
      externalId: m.externalId,
      home: m.homeTeam,
      away: m.awayTeam,
      homeScore: m.homeScore ?? undefined,
      awayScore: m.awayScore ?? undefined,
      datetime: m.datetime,
      category: m.category,
      matchType: "league",
      source: "ceskyhokej",
      completed: m.completed,
      seasonId: season,
      venue: m.venue,
      status: m.completed ? "completed" : "scheduled",
      manualStats: m.completed ? { shots: 0, saves: 0, goals: 0 } : undefined,
    }));

    matches.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    return NextResponse.json({
      success: true,
      matches,
      standings: [],
      totalCount: matches.length,
      completedCount: matches.filter((m) => m.completed).length,
      upcomingCount: matches.filter((m) => !m.completed).length,
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
  const season = request.nextUrl.searchParams.get("season") || "2025-2026";
  const category = request.nextUrl.searchParams.get("category") as CategoryConfig["slug"] | null;
  return POST({ json: async () => ({ season, category }) } as NextRequest);
}
