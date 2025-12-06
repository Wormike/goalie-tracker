"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import type { Goalie, GoalieEvent, Match, Season } from "@/lib/types";
import {
  getGoalieById,
  getMatches,
  getEvents,
  getSeasons,
  calculateGoalieStats,
} from "@/lib/storage";
import { ShotHeatmap } from "@/components/ShotHeatmap";
import { GoalHeatmap } from "@/components/GoalView";

export default function GoalieDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [goalie, setGoalie] = useState<Goalie | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<GoalieEvent[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [selectedMatch, setSelectedMatch] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"stats" | "heatmap" | "goal">("stats");

  useEffect(() => {
    const g = getGoalieById(params.id);
    if (g) {
      setGoalie(g);
      const allMatches = getMatches().filter((m) => m.goalieId === params.id);
      setMatches(allMatches);
      setEvents(getEvents().filter((e) => e.goalieId === params.id));
      setSeasons(getSeasons());
    }
  }, [params.id]);

  if (!goalie) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bgMain">
        <p className="text-slate-400">Brankář nenalezen</p>
      </div>
    );
  }

  const stats = calculateGoalieStats(
    goalie.id,
    selectedSeason === "all" ? undefined : selectedSeason
  );

  // Filter matches by season
  const filteredMatches =
    selectedSeason === "all"
      ? matches
      : matches.filter((m) => m.seasonId === selectedSeason);

  // Filter events by match or season
  const filteredEvents = events.filter((e) => {
    if (selectedMatch !== "all") {
      return e.matchId === selectedMatch;
    }
    if (selectedSeason !== "all") {
      const matchIds = new Set(filteredMatches.map((m) => m.id));
      return matchIds.has(e.matchId);
    }
    return true;
  });

  // Zone stats
  const zoneStats = filteredEvents.reduce(
    (acc, e) => {
      const zone = e.shotPosition?.zone || "slot";
      if (!acc[zone]) {
        acc[zone] = { saves: 0, goals: 0, total: 0 };
      }
      if (e.result === "save") acc[zone].saves++;
      if (e.result === "goal") acc[zone].goals++;
      if (e.result !== "miss") acc[zone].total++;
      return acc;
    },
    {} as Record<string, { saves: number; goals: number; total: number }>
  );

  const zoneNames: Record<string, string> = {
    slot: "Slot",
    left_wing: "Levé křídlo",
    right_wing: "Pravé křídlo",
    blue_line: "Modrá čára",
    behind_goal: "Za brankou",
  };

  // Events with goal position for goal heatmap
  const eventsWithGoalPos = filteredEvents.filter((e) => e.goalPosition);

  return (
    <div className="flex min-h-screen flex-col bg-bgMain">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-borderSoft bg-bgSurfaceSoft px-4 py-3">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-300"
        >
          ← Zpět
        </button>
        <h1 className="text-sm font-semibold">Statistiky brankáře</h1>
        <div className="w-12" />
      </div>

      {/* Goalie header */}
      <div className="border-b border-borderSoft bg-bgSurfaceSoft p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accentPrimary/20 text-2xl font-bold text-accentPrimary">
            {goalie.jerseyNumber || goalie.firstName[0]}
          </div>
          <div>
            <div className="text-lg font-semibold">
              {goalie.firstName} {goalie.lastName}
            </div>
            <div className="text-sm text-slate-400">{goalie.team}</div>
            <div className="text-xs text-slate-500">
              Ročník {goalie.birthYear}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2 border-b border-borderSoft bg-bgSurfaceSoft px-4 py-2">
        <div className="flex gap-2">
          <select
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value);
              setSelectedMatch("all");
            }}
            className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">Všechny sezóny</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={selectedMatch}
            onChange={(e) => setSelectedMatch(e.target.value)}
            className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">Všechny zápasy</option>
            {filteredMatches.map((m) => (
              <option key={m.id} value={m.id}>
                {new Date(m.datetime).toLocaleDateString("cs-CZ")} - {m.away}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-borderSoft bg-bgSurfaceSoft">
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex-1 py-3 text-xs font-medium ${
            activeTab === "stats"
              ? "border-b-2 border-accentPrimary text-accentPrimary"
              : "text-slate-400"
          }`}
        >
          Statistiky
        </button>
        <button
          onClick={() => setActiveTab("heatmap")}
          className={`flex-1 py-3 text-xs font-medium ${
            activeTab === "heatmap"
              ? "border-b-2 border-accentPrimary text-accentPrimary"
              : "text-slate-400"
          }`}
        >
          Střely - odkud
        </button>
        <button
          onClick={() => setActiveTab("goal")}
          className={`flex-1 py-3 text-xs font-medium ${
            activeTab === "goal"
              ? "border-b-2 border-accentPrimary text-accentPrimary"
              : "text-slate-400"
          }`}
        >
          Střely - kam
        </button>
      </div>

      {/* Content based on active tab */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "stats" && (
          <div className="p-4">
            {/* Main stats */}
            <div className="mb-4">
              <h2 className="mb-3 text-xs font-semibold text-slate-400">
                CELKOVÉ STATISTIKY
              </h2>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="rounded-xl bg-bgSurfaceSoft p-3">
                  <div className="text-2xl font-bold text-slate-50">
                    {stats.gamesPlayed}
                  </div>
                  <div className="text-xs text-slate-400">Zápasů</div>
                </div>
                <div className="rounded-xl bg-bgSurfaceSoft p-3">
                  <div className="text-2xl font-bold text-accentSuccess">
                    {stats.totalSaves}
                  </div>
                  <div className="text-xs text-slate-400">Zákroků</div>
                </div>
                <div className="rounded-xl bg-bgSurfaceSoft p-3">
                  <div className="text-2xl font-bold text-accentDanger">
                    {stats.totalGoals}
                  </div>
                  <div className="text-xs text-slate-400">Gólů</div>
                </div>
                <div className="rounded-xl bg-bgSurfaceSoft p-3">
                  <div className="text-2xl font-bold text-accentPrimary">
                    {stats.savePercentage.toFixed(1).replace(".", ",")}%
                  </div>
                  <div className="text-xs text-slate-400">Úspěšnost</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-bgSurfaceSoft p-3">
                  <div className="text-xl font-bold text-slate-50">
                    {stats.totalShots}
                  </div>
                  <div className="text-xs text-slate-400">Střel celkem</div>
                </div>
                <div className="rounded-xl bg-bgSurfaceSoft p-3">
                  <div className="text-xl font-bold text-accentHighlight">
                    {stats.shutouts}
                  </div>
                  <div className="text-xs text-slate-400">Čistá konta</div>
                </div>
              </div>
            </div>

            {/* Zone stats */}
            {Object.keys(zoneStats).length > 0 && (
              <div className="mb-4">
                <h2 className="mb-3 text-xs font-semibold text-slate-400">
                  STATISTIKY PODLE ZÓNY
                </h2>
                <div className="space-y-2">
                  {Object.entries(zoneStats).map(([zone, data]) => {
                    const pct =
                      data.total > 0 ? (data.saves / data.total) * 100 : 0;
                    return (
                      <div
                        key={zone}
                        className="flex items-center justify-between rounded-lg bg-bgSurfaceSoft px-3 py-2"
                      >
                        <span className="text-sm text-slate-300">
                          {zoneNames[zone] || zone}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-accentSuccess">
                            {data.saves} zák.
                          </span>
                          <span className="text-accentDanger">
                            {data.goals} gól
                          </span>
                          <span className="font-semibold text-accentPrimary">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Match history */}
            <div>
              <h2 className="mb-3 text-xs font-semibold text-slate-400">
                HISTORIE ZÁPASŮ ({filteredMatches.length})
              </h2>
              {filteredMatches.length === 0 ? (
                <p className="text-center text-sm text-slate-500">
                  Žádné zápasy v této sezóně
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredMatches
                    .sort(
                      (a, b) =>
                        new Date(b.datetime).getTime() -
                        new Date(a.datetime).getTime()
                    )
                    .map((match) => {
                      const matchEvents = events.filter(
                        (e) => e.matchId === match.id
                      );
                      let saves, goals, shots, pct;

                      if (match.manualStats && match.manualStats.shots > 0) {
                        saves = match.manualStats.saves;
                        goals = match.manualStats.goals;
                        shots = match.manualStats.shots;
                      } else {
                        saves = matchEvents.filter(
                          (e) => e.result === "save"
                        ).length;
                        goals = matchEvents.filter(
                          (e) => e.result === "goal"
                        ).length;
                        shots = saves + goals;
                      }
                      pct = shots > 0 ? ((saves / shots) * 100).toFixed(1) : "0";

                      return (
                        <div
                          key={match.id}
                          onClick={() => setSelectedMatch(match.id)}
                          className={`cursor-pointer rounded-lg px-3 py-2 ${
                            selectedMatch === match.id
                              ? "bg-accentPrimary/20 ring-1 ring-accentPrimary"
                              : "bg-bgSurfaceSoft"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">
                                {match.home} vs {match.away}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date(match.datetime).toLocaleDateString(
                                  "cs-CZ"
                                )}{" "}
                                •{" "}
                                {match.matchType === "friendly"
                                  ? "Přátelský"
                                  : match.category}
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <div className="font-semibold text-accentPrimary">
                                {pct}%
                              </div>
                              <div className="text-slate-400">
                                {saves}/{shots} zák.
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "heatmap" && (
          <div className="p-4">
            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400">
                  Žádná data pro zobrazení heatmapy
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Zaznamenejte střely během zápasu
                </p>
              </div>
            ) : (
              <ShotHeatmap
                events={filteredEvents}
                title={
                  selectedMatch !== "all"
                    ? `Zápas: ${
                        filteredMatches.find((m) => m.id === selectedMatch)
                          ?.away
                      }`
                    : selectedSeason !== "all"
                    ? `Sezóna: ${
                        seasons.find((s) => s.id === selectedSeason)?.name
                      }`
                    : "Všechny zápasy"
                }
              />
            )}
          </div>
        )}

        {activeTab === "goal" && (
          <div className="p-4">
            {eventsWithGoalPos.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400">
                  Žádná data pro zobrazení heatmapy branky
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Při záznamu střely vyberte i místo na brance
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-bgSurfaceSoft p-4">
                  <h3 className="mb-3 text-sm font-semibold">
                    Všechny střely na bránu
                  </h3>
                  <GoalHeatmap events={eventsWithGoalPos} />
                </div>

                <div className="rounded-2xl bg-bgSurfaceSoft p-4">
                  <h3 className="mb-3 text-sm font-semibold text-accentDanger">
                    Pouze góly
                  </h3>
                  <GoalHeatmap events={eventsWithGoalPos} showGoalsOnly />
                </div>

                <div className="rounded-2xl bg-bgSurfaceSoft p-4">
                  <h3 className="mb-3 text-sm font-semibold text-accentSuccess">
                    Pouze zákroky
                  </h3>
                  <GoalHeatmap events={eventsWithGoalPos} showSavesOnly />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
