import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface CompetitionOption {
  leagueId: string;
  name: string;
  parentGroup: string;
  season: string | null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractSeason(label: string): string | null {
  const match = label.match(/(\d{4}\/\d{2})/);
  return match ? match[1] : null;
}

export async function GET() {
  try {
    const response = await fetch("https://zapasy.ceskyhokej.cz/seznam-zapasu", {
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

    const competitions: CompetitionOption[] = [];
    let currentGroup = "";

    const candidates = new Map<string, string>();

    $("option, [data-value], [data-id], [data-filter]").each((_, el) => {
      const value =
        $(el).attr("value") ||
        $(el).attr("data-value") ||
        $(el).attr("data-id") ||
        $(el).attr("data-filter") ||
        "";
      if (!value.includes("league_")) return;
      const text = normalizeText($(el).text());
      if (!text) return;
      candidates.set(value, text);
    });

    candidates.forEach((text, leagueId) => {
      if (!text.startsWith("-")) {
        currentGroup = text;
        return;
      }

      const name = normalizeText(text.replace(/^-+/, ""));
      competitions.push({
        leagueId,
        name,
        parentGroup: currentGroup,
        season: extractSeason(name),
      });
    });

    return NextResponse.json({
      success: true,
      competitions,
      scrapedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

