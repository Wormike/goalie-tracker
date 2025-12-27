import type { Match, GoalieEvent, Goalie } from "./types";

/**
 * Generate a text report for sharing match statistics
 */
export function generateMatchReport(
  match: Match,
  events: GoalieEvent[],
  goalie?: Goalie | null
): string {
  const lines: string[] = [];

  // Header
  lines.push("🥅 GOALIE TRACKER - Zápasová statistika");
  lines.push("═".repeat(35));

  // Match info
  lines.push(`${match.home} vs ${match.away}`);
  lines.push(
    `📅 ${new Date(match.datetime).toLocaleDateString("cs-CZ", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`
  );

  if (match.category) {
    lines.push(`📋 ${match.category}`);
  }

  if (match.venue) {
    lines.push(`📍 ${match.venue}`);
  }

  // Score if available
  if (match.homeScore !== undefined && match.awayScore !== undefined) {
    lines.push(`⚽ Výsledek: ${match.homeScore}:${match.awayScore}`);
  }

  lines.push("");

  // Goalie info
  if (goalie) {
    lines.push(`🧤 Brankář: ${goalie.firstName} ${goalie.lastName}`);
    if (goalie.jerseyNumber) {
      lines.push(`#${goalie.jerseyNumber}`);
    }
    lines.push("");
  }

  // Calculate stats
  let shots: number, saves: number, goals: number;

  if (events.length > 0) {
    saves = events.filter((e) => e.result === "save").length;
    goals = events.filter((e) => e.result === "goal").length;
    shots = saves + goals;
  } else if (match.manualStats && match.manualStats.shots > 0) {
    shots = match.manualStats.shots;
    saves = match.manualStats.saves;
    goals = match.manualStats.goals;
  } else {
    shots = 0;
    saves = 0;
    goals = 0;
  }

  const savePercentage = shots > 0 ? ((saves / shots) * 100).toFixed(1) : "0.0";

  // Main stats
  lines.push("📊 STATISTIKY");
  lines.push("─".repeat(35));
  lines.push(`Střely na bránu: ${shots}`);
  lines.push(`Zákroky: ${saves}`);
  lines.push(`Góly: ${goals}`);
  lines.push(`Save %: ${savePercentage}%`);

  // Situation breakdown (if events have this data)
  if (events.length > 0) {
    const evenShots = events.filter(
      (e) =>
        (e.situation === "even" || !e.situation) &&
        (e.result === "save" || e.result === "goal")
    );
    const evenSaves = evenShots.filter((e) => e.result === "save").length;

    const ppShots = events.filter(
      (e) =>
        e.situation === "powerplay" && (e.result === "save" || e.result === "goal")
    );
    const ppSaves = ppShots.filter((e) => e.result === "save").length;

    const shShots = events.filter(
      (e) =>
        e.situation === "shorthanded" &&
        (e.result === "save" || e.result === "goal")
    );
    const shSaves = shShots.filter((e) => e.result === "save").length;

    if (evenShots.length > 0 || ppShots.length > 0 || shShots.length > 0) {
      lines.push("");
      lines.push("🎯 PODLE SITUACE");
      lines.push("─".repeat(35));

      if (evenShots.length > 0) {
        const pct = ((evenSaves / evenShots.length) * 100).toFixed(1);
        lines.push(`5v5: ${evenSaves}/${evenShots.length} (${pct}%)`);
      }

      if (ppShots.length > 0) {
        const pct = ((ppSaves / ppShots.length) * 100).toFixed(1);
        lines.push(`PP: ${ppSaves}/${ppShots.length} (${pct}%)`);
      }

      if (shShots.length > 0) {
        const pct = ((shSaves / shShots.length) * 100).toFixed(1);
        lines.push(`SH: ${shSaves}/${shShots.length} (${pct}%)`);
      }
    }

    // Period breakdown
    const periods = [1, 2, 3] as const;
    const periodStats = periods.map((p) => {
      const periodEvents = events.filter(
        (e) => e.period === p && (e.result === "save" || e.result === "goal")
      );
      const periodSaves = periodEvents.filter((e) => e.result === "save").length;
      return { period: p, shots: periodEvents.length, saves: periodSaves };
    });

    if (periodStats.some((ps) => ps.shots > 0)) {
      lines.push("");
      lines.push("⏱️ PODLE TŘETIN");
      lines.push("─".repeat(35));
      periodStats.forEach((ps) => {
        if (ps.shots > 0) {
          const pct = ((ps.saves / ps.shots) * 100).toFixed(0);
          lines.push(`${ps.period}. třetina: ${ps.saves}/${ps.shots} (${pct}%)`);
        }
      });
    }
  }

  lines.push("");
  lines.push("─".repeat(35));
  lines.push("📱 Goalie Tracker App");

  return lines.join("\n");
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * Share text using Web Share API or fallback to clipboard
 */
export async function shareText(
  title: string,
  text: string
): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return "failed";
      }
      // Fall through to clipboard
    }
  }

  const copied = await copyToClipboard(text);
  return copied ? "copied" : "failed";
}

/**
 * Format date in Czech locale
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format time
 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate save percentage
 */
export function calculateSavePercentage(saves: number, shots: number): number {
  if (shots === 0) return 0;
  return (saves / shots) * 100;
}






