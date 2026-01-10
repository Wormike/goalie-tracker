"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type { Goalie, Season, Competition, GoalieEvent } from "@/lib/types";
import {
  getGoalies,
  getSeasons,
  getCompetitions,
  getEvents,
  calculateGoalieStats,
} from "@/lib/storage";
import { getAllEvents } from "@/lib/repositories/events";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type SortKey = "name" | "games" | "shots" | "saves" | "goals" | "savePercentage";
type SortOrder = "asc" | "desc";

export default function StatsPage() {
  const [goalies, setGoalies] = useState<Goalie[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [allEvents, setAllEvents] = useState<GoalieEvent[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [selectedCompetition, setSelectedCompetition] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("savePercentage");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    setGoalies(getGoalies());
    setSeasons(getSeasons());
    setCompetitions(getCompetitions());
    
    // Load events from Supabase if configured, otherwise from localStorage
    const loadEvents = async () => {
      if (isSupabaseConfigured()) {
        try {
          const events = await getAllEvents();
          setAllEvents(events);
        } catch (err) {
          console.error("[StatsPage] Failed to load events from Supabase:", err);
          // Fallback to localStorage
          setAllEvents(getEvents());
        }
      } else {
        setAllEvents(getEvents());
      }
    };
    
    loadEvents();
  }, []);

  // Filter competitions by selected season
  const filteredCompetitions = useMemo(() => {
    if (selectedSeason === "all") return competitions;
    return competitions.filter((c) => c.seasonId === selectedSeason);
  }, [competitions, selectedSeason]);

  // Calculate stats for all goalies
  const goalieStats = useMemo(() => {
    return goalies.map((goalie) => {
      const stats = calculateGoalieStats(
        goalie.id,
        selectedSeason === "all" ? undefined : selectedSeason,
        selectedCompetition === "all" ? undefined : selectedCompetition,
        allEvents // Pass events from Supabase/localStorage
      );
      return { goalie, stats };
    });
  }, [goalies, selectedSeason, selectedCompetition, allEvents]);

  // Sort goalies
  const sortedGoalieStats = useMemo(() => {
    return [...goalieStats].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortKey) {
        case "name":
          aVal = `${a.goalie.lastName} ${a.goalie.firstName}`;
          bVal = `${b.goalie.lastName} ${b.goalie.firstName}`;
          break;
        case "games":
          aVal = a.stats.gamesPlayed;
          bVal = b.stats.gamesPlayed;
          break;
        case "shots":
          aVal = a.stats.totalShots;
          bVal = b.stats.totalShots;
          break;
        case "saves":
          aVal = a.stats.totalSaves;
          bVal = b.stats.totalSaves;
          break;
        case "goals":
          aVal = a.stats.totalGoals;
          bVal = b.stats.totalGoals;
          break;
        case "savePercentage":
          aVal = a.stats.savePercentage;
          bVal = b.stats.savePercentage;
          break;
        default:
          aVal = a.stats.savePercentage;
          bVal = b.stats.savePercentage;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal, "cs")
          : bVal.localeCompare(aVal, "cs");
      }

      return sortOrder === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [goalieStats, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const getSortIndicator = (columnKey: SortKey) => {
    if (sortKey !== columnKey) return null;
    return sortOrder === "asc" ? "↑" : "↓";
  };

  // Find best performers
  const topSavePercentage = useMemo(() => {
    const withGames = goalieStats.filter((g) => g.stats.gamesPlayed > 0);
    if (withGames.length === 0) return null;
    return withGames.reduce((best, current) =>
      current.stats.savePercentage > best.stats.savePercentage ? current : best
    );
  }, [goalieStats]);

  const mostGames = useMemo(() => {
    const withGames = goalieStats.filter((g) => g.stats.gamesPlayed > 0);
    if (withGames.length === 0) return null;
    return withGames.reduce((best, current) =>
      current.stats.gamesPlayed > best.stats.gamesPlayed ? current : best
    );
  }, [goalieStats]);

  return (
    <main className="flex min-h-screen flex-col bg-bgMain">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-borderSoft bg-bgSurfaceSoft px-4 py-3">
        <Link href="/" className="text-sm text-slate-300">
          ← Zpět
        </Link>
        <h1 className="text-lg font-semibold">Porovnání brankářů</h1>
        <div className="w-12" />
      </div>

      {/* Filters */}
      <div className="border-b border-borderSoft bg-bgSurfaceSoft p-4">
        <div className="flex gap-2">
          <select
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value);
              setSelectedCompetition("all");
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
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
            className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">Všechny soutěže</option>
            {filteredCompetitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Highlights */}
      {(topSavePercentage || mostGames) && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {topSavePercentage && topSavePercentage.stats.gamesPlayed > 0 && (
            <Link
              href={`/goalies/${topSavePercentage.goalie.id}`}
              className="rounded-xl bg-accentSuccess/10 p-3"
            >
              <div className="text-xs text-accentSuccess">🏆 Nejvyšší save%</div>
              <div className="mt-1 font-semibold text-slate-100">
                {topSavePercentage.goalie.firstName}{" "}
                {topSavePercentage.goalie.lastName}
              </div>
              <div className="text-2xl font-bold text-accentSuccess">
                {topSavePercentage.stats.savePercentage.toFixed(1)}%
              </div>
            </Link>
          )}
          {mostGames && mostGames.stats.gamesPlayed > 0 && (
            <Link
              href={`/goalies/${mostGames.goalie.id}`}
              className="rounded-xl bg-accentPrimary/10 p-3"
            >
              <div className="text-xs text-accentPrimary">📊 Nejvíce zápasů</div>
              <div className="mt-1 font-semibold text-slate-100">
                {mostGames.goalie.firstName} {mostGames.goalie.lastName}
              </div>
              <div className="text-2xl font-bold text-accentPrimary">
                {mostGames.stats.gamesPlayed}
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-x-auto p-4">
        {goalies.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400">Žádní brankáři k zobrazení</p>
            <Link
              href="/goalies"
              className="mt-2 inline-block text-sm text-accentPrimary"
            >
              Přidat brankáře →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl bg-bgSurfaceSoft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borderSoft text-xs text-slate-400">
                  <th
                    className="cursor-pointer p-3 text-left font-medium"
                    onClick={() => handleSort("name")}
                  >
                    Brankář{getSortIndicator("name") && <span className="ml-1">{getSortIndicator("name")}</span>}
                  </th>
                  <th
                    className="cursor-pointer p-3 text-center font-medium"
                    onClick={() => handleSort("games")}
                  >
                    Z{getSortIndicator("games") && <span className="ml-1">{getSortIndicator("games")}</span>}
                  </th>
                  <th
                    className="cursor-pointer p-3 text-center font-medium"
                    onClick={() => handleSort("shots")}
                  >
                    S{getSortIndicator("shots") && <span className="ml-1">{getSortIndicator("shots")}</span>}
                  </th>
                  <th
                    className="cursor-pointer p-3 text-center font-medium"
                    onClick={() => handleSort("saves")}
                  >
                    ZÁK{getSortIndicator("saves") && <span className="ml-1">{getSortIndicator("saves")}</span>}
                  </th>
                  <th
                    className="cursor-pointer p-3 text-center font-medium"
                    onClick={() => handleSort("goals")}
                  >
                    G{getSortIndicator("goals") && <span className="ml-1">{getSortIndicator("goals")}</span>}
                  </th>
                  <th
                    className="cursor-pointer p-3 text-center font-medium"
                    onClick={() => handleSort("savePercentage")}
                  >
                    %{getSortIndicator("savePercentage") && <span className="ml-1">{getSortIndicator("savePercentage")}</span>}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedGoalieStats.map(({ goalie, stats }, index) => (
                  <tr
                    key={goalie.id}
                    className={`border-b border-borderSoft/50 ${
                      index === 0 && sortKey === "savePercentage"
                        ? "bg-accentSuccess/5"
                        : ""
                    }`}
                  >
                    <td className="p-3">
                      <Link
                        href={`/goalies/${goalie.id}`}
                        className="flex items-center gap-2"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accentPrimary/20 text-xs font-bold text-accentPrimary">
                          {goalie.jerseyNumber || goalie.firstName[0]}
                        </span>
                        <div>
                          <div className="font-medium text-slate-100">
                            {goalie.lastName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {goalie.firstName}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="p-3 text-center text-slate-300">
                      {stats.gamesPlayed}
                    </td>
                    <td className="p-3 text-center text-slate-300">
                      {stats.totalShots}
                    </td>
                    <td className="p-3 text-center text-accentSuccess">
                      {stats.totalSaves}
                    </td>
                    <td className="p-3 text-center text-accentDanger">
                      {stats.totalGoals}
                    </td>
                    <td className="p-3 text-center font-semibold text-accentPrimary">
                      {stats.gamesPlayed > 0
                        ? stats.savePercentage.toFixed(1)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span>Z = Zápasy</span>
          <span>S = Střely</span>
          <span>ZÁK = Zákroky</span>
          <span>G = Góly</span>
          <span>% = Save %</span>
        </div>
      </div>
    </main>
  );
}

