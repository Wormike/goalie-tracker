"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ActionBar } from "@/components/ActionBar";
import { LiveStatsBar } from "@/components/LiveStatsBar";
import { RinkView } from "@/components/RinkView";
import { EventModal } from "@/components/EventModal";
import { EventListModal } from "@/components/EventListModal";
import { LandscapeTrackingView } from "@/components/LandscapeTrackingView";
import { useIsMobile } from "@/hooks/useOrientation";
import type {
  GoalieEvent,
  Match,
  Period,
  ShotZone,
  SituationType,
  Goalie,
  MatchStatus,
} from "@/lib/types";
import {
  getMatchById as getMatchByIdLocal,
  getEventsByMatch as getEventsByMatchLocal,
  getAllEventsByMatch,
  saveEvent as saveEventLocal,
  getGoalieById,
  getGoalies,
  saveMatch as saveMatchLocal,
  saveEvents,
  getEvents,
} from "@/lib/storage";
import {
  getMatchById as getMatchByIdSupabase,
  updateMatch as updateMatchSupabase,
} from "@/lib/repositories/matches";
import {
  getEventsForMatch as getEventsForMatchSupabase,
  createEvent as createEventSupabase,
} from "@/lib/repositories/events";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { generateMatchReport, shareText } from "@/lib/utils";
import { useAutoSync } from "@/hooks/useAutoSync";

function getZoneFromCoords(x: number, y: number): ShotZone {
  if (y < 30) return "blue_line";
  if (y > 85) return "behind_goal";
  if (x < 30) return "left_wing";
  if (x > 70) return "right_wing";
  return "slot";
}

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isUuid(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export default function MatchPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isMobile = useIsMobile();
  const { syncNow } = useAutoSync();

  const [match, setMatch] = useState<Match | null>(null);
  const [showLandscapeMode, setShowLandscapeMode] = useState(false);
  const [goalie, setGoalie] = useState<Goalie | null>(null);
  const [goalies, setGoalies] = useState<Goalie[]>([]);
  const [period, setPeriod] = useState<Period>(1);
  const [gameTime, setGameTime] = useState("20:00");
  const [events, setEvents] = useState<GoalieEvent[]>([]);
  const [allEvents, setAllEvents] = useState<GoalieEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingZone, setPendingZone] = useState<ShotZone | null>(null);
  const [showGoalieSelect, setShowGoalieSelect] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showEventList, setShowEventList] = useState(false);
  const [activeTab, setActiveTab] = useState<"tracking" | "roster">("tracking");
  const [dataSource, setDataSource] = useState<"supabase" | "local">("local");
  const [loading, setLoading] = useState(true);

  // Load match data - try Supabase first, fall back to localStorage
  const loadMatchData = async (matchId: string) => {
    setLoading(true);
    
    if (isSupabaseConfigured() && isUuid(matchId)) {
      try {
        // Try loading from Supabase
        const supabaseMatch = await getMatchByIdSupabase(matchId);
        if (supabaseMatch) {
          setMatch(supabaseMatch);
          setDataSource("supabase");
          
          // Load events from Supabase
          const supabaseEvents = await getEventsForMatchSupabase(matchId);
          setEvents(supabaseEvents);
          setAllEvents(supabaseEvents);
          
          if (supabaseMatch.goalieId) {
            setGoalie(getGoalieById(supabaseMatch.goalieId) || null);
          }
          
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("[MatchPage] Failed to load from Supabase:", err);
      }
    }
    
    // Fallback to localStorage
    const localMatch = getMatchByIdLocal(matchId);
    if (localMatch) {
      setMatch(localMatch);
      setDataSource("local");
      setEvents(getEventsByMatchLocal(localMatch.id));
      setAllEvents(getAllEventsByMatch(localMatch.id));
      if (localMatch.goalieId) {
        setGoalie(getGoalieById(localMatch.goalieId) || null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMatchData(params.id);
    setGoalies(getGoalies());
  }, [params.id]);

  // Auto-refresh events when match changes (for local storage mode)
  useEffect(() => {
    if (match && dataSource === "local") {
      setEvents(getEventsByMatchLocal(match.id));
      setAllEvents(getAllEventsByMatch(match.id));
    }
  }, [match, dataSource]);

  // Force reload events when page becomes visible (mobile fix)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && match && dataSource === 'local') {
        // Reload events when user comes back to the page
        const reloadedEvents = getEventsByMatchLocal(match.id);
        if (reloadedEvents.length !== events.length) {
          setEvents(reloadedEvents);
          setAllEvents(getAllEventsByMatch(match.id));
          console.log('[MatchPage] Reloaded events on visibility change:', reloadedEvents.length);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [match, dataSource, events.length]);

  const isMatchClosed = match?.status === "closed" || match?.status === "completed" || match?.status === "cancelled" || match?.completed;

  const stats = useMemo(() => {
    const filtered = events.filter(
      (e) => e.period === period || period === "OT"
    );
    const shots = filtered.filter(
      (e) => e.result === "save" || e.result === "goal"
    ).length;
    const saves = filtered.filter((e) => e.result === "save").length;
    const goals = filtered.filter((e) => e.result === "goal").length;
    return { shots, saves, goals };
  }, [events, period]);

  const totalStats = useMemo(() => {
    const shots = events.filter(
      (e) => e.result === "save" || e.result === "goal"
    ).length;
    const saves = events.filter((e) => e.result === "save").length;
    const goals = events.filter((e) => e.result === "goal").length;
    return { shots, saves, goals };
  }, [events]);

  const handleRinkTap = (coords: { x: number; y: number }) => {
    if (isMatchClosed) return;
    const zone = getZoneFromCoords(coords.x, coords.y);
    setPendingCoords(coords);
    setPendingZone(zone);
    setModalOpen(true);
  };

  const addEventQuick = async (result: "save" | "goal" | "miss") => {
    if (!match || isMatchClosed) return;
    const now = new Date().toISOString();
    const zone: ShotZone = "slot";

    if (dataSource === "supabase") {
      // Create event in Supabase
      const periodStr = period === "OT" ? "OT" : String(period) as "1" | "2" | "3";
      const createdEvent = await createEventSupabase({
        match_id: match.id,
        goalie_id: goalie?.id,
        period: periodStr,
        game_time: gameTime,
        result,
        shot_x: 50,
        shot_y: 50,
        input_source: "live",
      });
      
      if (createdEvent) {
        setEvents((prev) => [...prev, createdEvent]);
        setAllEvents((prev) => [...prev, createdEvent]);
      } else {
        console.error("[MatchPage] Failed to create event in Supabase");
      }
    } else {
      // Create event in localStorage
      const newEvent: GoalieEvent = {
        id: generateEventId(),
        matchId: match.id,
        goalieId: goalie?.id || "",
        period,
        gameTime,
        timestamp: now,
        result,
        shotPosition: { x: 50, y: 50, zone },
        situation: "even" as SituationType,
        inputSource: "live",
        status: "confirmed",
        createdAt: now,
      };
      
      saveEventLocal(newEvent);
      
      // Re-read from storage to ensure consistency
      const updatedEvents = getEventsByMatchLocal(match.id);
      setEvents(updatedEvents);
      setAllEvents(getAllEventsByMatch(match.id));
      
      // Trigger sync to Supabase (background)
      syncNow().catch(err => {
        console.error('[MatchPage] Background sync failed:', err);
      });
    }
  };

  const handleGoalieChange = async (goalieId: string) => {
    if (!match) return;
    
    if (dataSource === "supabase") {
      // Update in Supabase
      const updated = await updateMatchSupabase(match.id, { goalie_id: goalieId || undefined });
      if (updated) {
        setMatch(updated);
      }
    } else {
      // Update in localStorage
      const updatedMatch = { ...match, goalieId };
      saveMatchLocal(updatedMatch);
      setMatch(updatedMatch);
    }
    
    setGoalie(goalieId ? getGoalieById(goalieId) || null : null);

    // Update all events with new goalie ID (localStorage only for now)
    const updatedEvents = events.map((e) => ({ ...e, goalieId }));
    const allEventsStorage = getEvents();
    const otherEvents = allEventsStorage.filter((e) => e.matchId !== match.id);
    saveEvents([...otherEvents, ...updatedEvents]);
    setEvents(updatedEvents);

    setShowGoalieSelect(false);
  };

  const handleDeleteLastEvent = () => {
    if (events.length === 0 || isMatchClosed) return;
    if (!confirm("Smazat poslední událost?")) return;

    const allEventsStorage = getEvents();
    const lastEvent = events[events.length - 1];
    const filtered = allEventsStorage.filter((e) => e.id !== lastEvent.id);
    saveEvents(filtered);
    setEvents(events.slice(0, -1));
    setAllEvents((prev) => prev.filter((e) => e.id !== lastEvent.id));
  };

  const toggleMatchStatus = async () => {
    if (!match) return;
    const newStatus: MatchStatus = isMatchCompleted(match.status) ? "in_progress" : "completed";
    
    if (dataSource === "supabase") {
      const updated = await updateMatchSupabase(match.id, { status: newStatus });
      if (updated) {
        setMatch(updated);
      }
    } else {
      const updatedMatch: Match = {
        ...match,
        status: newStatus,
        completed: newStatus === "completed",
        updatedAt: new Date().toISOString(),
      };
      saveMatchLocal(updatedMatch);
      setMatch(updatedMatch);
    }
  };

  if (!match) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bgMain">
        <p className="text-slate-400">Zápas nenalezen</p>
      </div>
    );
  }

  const hasRoster = match.roster && (match.roster.players.length > 0 || match.roster.goalScorers.length > 0);

  return (
    <div className="flex min-h-screen flex-col bg-bgMain">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-borderSoft bg-bgSurfaceSoft px-4 py-3">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-slate-300"
        >
          ← Zpět
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xs text-slate-400">{match.category}</span>
          <span className="text-xs font-semibold">
            {match.home} vs {match.away}
          </span>
          {match.homeScore !== undefined && (
            <span className="mt-0.5 rounded bg-slate-700 px-2 py-0.5 text-xs font-bold">
              {match.homeScore} : {match.awayScore}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowGoalieSelect(true)}
          className="text-xs text-accentPrimary"
        >
          {goalie ? "Změnit" : "Přiřadit"}
        </button>
      </div>

      {/* Match status bar */}
      <div
        className={`flex items-center justify-between px-4 py-2 text-xs ${
          isMatchClosed
            ? "bg-slate-700/50 text-slate-400"
            : "bg-accentSuccess/10 text-accentSuccess"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isMatchClosed ? "bg-slate-500" : "bg-accentSuccess animate-pulse"
            }`}
          />
          <span>{isMatchClosed ? "Zápas ukončen" : "Zápas probíhá"}</span>
        </div>
        <button
          onClick={toggleMatchStatus}
          className={`rounded-lg px-2 py-1 text-xs font-medium ${
            isMatchClosed
              ? "bg-accentSuccess/20 text-accentSuccess"
              : "bg-accentDanger/20 text-accentDanger"
          }`}
        >
          {isMatchClosed ? "Znovu otevřít" : "Ukončit zápas"}
        </button>
      </div>

      {/* Goalie info */}
      {goalie ? (
        <div className="flex items-center justify-center gap-2 border-b border-borderSoft bg-bgSurfaceSoft/50 px-4 py-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accentPrimary/20 text-xs font-bold text-accentPrimary">
            {goalie.jerseyNumber || goalie.firstName[0]}
          </span>
          <span className="text-sm">
            {goalie.firstName} {goalie.lastName}
          </span>
        </div>
      ) : (
        <button
          onClick={() => setShowGoalieSelect(true)}
          className="border-b border-borderSoft bg-accentPrimary/10 px-4 py-2 text-center text-xs text-accentPrimary"
        >
          ⚠️ Přiřaďte brankáře pro ukládání statistik
        </button>
      )}

      {/* Tabs - show only if roster exists */}
      {hasRoster && (
        <div className="flex border-b border-borderSoft bg-bgSurfaceSoft">
          <button
            onClick={() => setActiveTab("tracking")}
            className={`flex-1 py-2.5 text-xs font-medium ${
              activeTab === "tracking"
                ? "border-b-2 border-accentPrimary text-accentPrimary"
                : "text-slate-400"
            }`}
          >
            🎯 Tracking
          </button>
          <button
            onClick={() => setActiveTab("roster")}
            className={`flex-1 py-2.5 text-xs font-medium ${
              activeTab === "roster"
                ? "border-b-2 border-accentPrimary text-accentPrimary"
                : "text-slate-400"
            }`}
          >
            📋 Soupiska ({match.roster?.players.length || 0})
          </button>
        </div>
      )}

      {/* Goalie selector modal */}
      {showGoalieSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-bgSurfaceSoft p-4">
            <h3 className="mb-4 text-center font-semibold">Vybrat brankáře</h3>
            {goalies.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-slate-400">Žádní brankáři</p>
                <button
                  onClick={() => router.push("/goalies")}
                  className="mt-2 text-sm text-accentPrimary"
                >
                  Vytvořit brankáře →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {goalies.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleGoalieChange(g.id)}
                    className={`w-full rounded-lg px-3 py-3 text-left ${
                      goalie?.id === g.id
                        ? "bg-accentPrimary/20 text-accentPrimary"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accentPrimary/20 text-sm font-bold text-accentPrimary">
                        {g.jerseyNumber || g.firstName[0]}
                      </span>
                      <div>
                        <div className="font-medium">
                          {g.firstName} {g.lastName}
                        </div>
                        <div className="text-xs text-slate-400">{g.team}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowGoalieSelect(false)}
              className="mt-4 w-full rounded-lg bg-slate-800 py-2 text-sm text-slate-300"
            >
              Zavřít
            </button>
          </div>
        </div>
      )}

      {/* Event List Modal */}
      <EventListModal
        open={showEventList}
        onClose={() => setShowEventList(false)}
        events={allEvents}
        onEventsChange={async () => {
          if (dataSource === "supabase") {
            const supabaseEvents = await getEventsForMatchSupabase(match.id);
            setEvents(supabaseEvents);
            setAllEvents(supabaseEvents);
          } else {
            setEvents(getEventsByMatchLocal(match.id));
            setAllEvents(getAllEventsByMatch(match.id));
          }
        }}
        matchClosed={isMatchClosed}
      />

      {/* Landscape Tracking View */}
      {showLandscapeMode && !isMatchClosed && (
        <LandscapeTrackingView
          period={period}
          gameTime={gameTime}
          events={events}
          totalStats={totalStats}
          onAddEvent={({ result, situation, shotPosition }) => {
            const now = new Date().toISOString();
            const newEvent: GoalieEvent = {
              id: generateEventId(),
              matchId: match.id,
              goalieId: goalie?.id || "",
              period,
              gameTime,
              timestamp: now,
              result,
              shotPosition: shotPosition || { x: 50, y: 50, zone: "slot" },
              situation,
              inputSource: "live",
              status: "confirmed",
              createdAt: now,
            };
            
            saveEventLocal(newEvent);
            
            // Re-read from storage
            const updatedEvents = getEventsByMatchLocal(match.id);
            setEvents(updatedEvents);
            setAllEvents(getAllEventsByMatch(match.id));
            
            // Trigger sync to Supabase (background)
            syncNow().catch(err => {
              console.error('[MatchPage] Background sync failed:', err);
            });
          }}
          onClose={() => setShowLandscapeMode(false)}
        />
      )}

      {/* ROSTER TAB */}
      {activeTab === "roster" && match.roster && (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Goal scorers */}
          {match.roster.goalScorers.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-semibold text-slate-400">
                ⚽ STŘELCI GÓLŮ
              </h3>
              <div className="space-y-2">
                {match.roster.goalScorers.map((gs, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      gs.isOurTeam
                        ? "bg-accentSuccess/20"
                        : "bg-accentDanger/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          gs.isOurTeam
                            ? "bg-accentSuccess text-white"
                            : "bg-accentDanger text-white"
                        }`}
                      >
                        {gs.isOurTeam ? "✓" : "✕"}
                      </span>
                      <span className="font-medium">{gs.name}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {gs.period}. třetina • {gs.time}
                      {gs.assists && gs.assists.length > 0 && (
                        <span className="ml-2 text-slate-500">
                          ({gs.assists.join(", ")})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Players roster */}
          {match.roster.players.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-400">
                👥 SOUPISKA NAŠEHO TÝMU
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {match.roster.players.map((player, i) => {
                  // Check if this player scored
                  const goals = match.roster?.goalScorers.filter(
                    (gs) => gs.isOurTeam && gs.name === player.name
                  ).length || 0;

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                        goals > 0 ? "bg-accentSuccess/10" : "bg-slate-800/50"
                      }`}
                    >
                      {player.number && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                          {player.number}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">
                          {player.name}
                        </div>
                        {player.position && (
                          <div className="text-[10px] text-slate-500">
                            {player.position === "G"
                              ? "Brankář"
                              : player.position === "D"
                              ? "Obránce"
                              : player.position === "F"
                              ? "Útočník"
                              : player.position}
                          </div>
                        )}
                      </div>
                      {goals > 0 && (
                        <span className="rounded bg-accentSuccess/20 px-1.5 py-0.5 text-[10px] font-bold text-accentSuccess">
                          {goals}⚽
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* External link */}
          {match.externalUrl && (
            <div className="mt-4 text-center">
              <a
                href={match.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accentPrimary"
              >
                Zobrazit na ceskyhokej.cz →
              </a>
            </div>
          )}
        </div>
      )}

      {/* TRACKING TAB */}
      {activeTab === "tracking" && (
        <>
          {/* Period and time selector */}
          <div className="flex items-center justify-between border-b border-borderSoft bg-bgSurfaceSoft px-4 py-2 text-xs text-slate-400">
            <div className="flex gap-1">
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p as Period)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold ${
                    period === p
                      ? "bg-accentPrimary text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {p}.
                </button>
              ))}
              <button
                onClick={() => setPeriod("OT")}
                className={`h-8 rounded-lg px-2 text-xs font-semibold ${
                  period === "OT"
                    ? "bg-accentPrimary text-white"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                OT
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`rounded-lg px-2 py-1 text-[10px] ${
                  showHeatmap
                    ? "bg-accentPrimary text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                🔥
              </button>
              <button
                onClick={() => setShowEventList(true)}
                className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-400"
              >
                📋 {events.length}
              </button>
              <input
                value={gameTime}
                onChange={(e) => setGameTime(e.target.value)}
                className="h-8 w-16 rounded-lg bg-slate-800 text-center font-mono text-sm text-slate-100"
                disabled={isMatchClosed}
              />
              {!isMatchClosed && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              )}
            </div>
          </div>

          <LiveStatsBar
            shots={stats.shots}
            saves={stats.saves}
            goals={stats.goals}
          />

          <RinkView
            period={period}
            events={events}
            onTap={handleRinkTap}
            showHeatmap={showHeatmap}
          />

          {/* Disabled overlay when match is closed */}
          {isMatchClosed && (
            <div className="px-4 py-2">
              <div className="rounded-lg bg-slate-800/50 p-3 text-center text-xs text-slate-400">
                Zápas je ukončen. Pro přidání událostí nejprve znovu otevřete
                zápas.
              </div>
            </div>
          )}

          {/* Events list */}
          <div className="flex-1 px-4 pb-2">
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => setShowEventList(true)}
                className="text-xs text-accentPrimary"
              >
                Všechny události ({events.length}) →
              </button>
              {events.length > 0 && !isMatchClosed && (
                <button
                  onClick={handleDeleteLastEvent}
                  className="text-xs text-accentDanger"
                >
                  Smazat poslední
                </button>
              )}
            </div>
            <div className="space-y-2 text-xs">
              {events.length === 0 && (
                <p className="text-slate-600">Zatím žádné události</p>
              )}
              {events
                .slice(-5)
                .reverse()
                .map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-lg bg-slate-800/70 px-3 py-2"
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        e.result === "save"
                          ? "bg-accentSuccess"
                          : e.result === "goal"
                          ? "bg-accentDanger"
                          : "bg-slate-600"
                      }`}
                    >
                      {e.result === "save"
                        ? "✓"
                        : e.result === "goal"
                        ? "✕"
                        : "○"}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium">
                        {e.result === "save"
                          ? "Zákrok"
                          : e.result === "goal"
                          ? "Gól"
                          : "Mimo"}
                        {e.situation && e.situation !== "even" && (
                          <span className="ml-1 text-accentHighlight">
                            ({e.situation === "powerplay" ? "PP" : "SH"})
                          </span>
                        )}
                        {e.goalPosition && (
                          <span className="ml-1 text-slate-400">
                            → {e.goalPosition.zone.replace("_", " ")}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {e.period}. třetina • {e.gameTime} •{" "}
                        {e.shotPosition?.zone ?? "slot"}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Total stats footer */}
          <div className="border-t border-borderSoft bg-bgSurfaceSoft/50 px-4 py-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Celkem za zápas:</span>
              <span>
                <span className="text-slate-50">{totalStats.shots}</span> střel •{" "}
                <span className="text-accentSuccess">{totalStats.saves}</span>{" "}
                zákroků •{" "}
                <span className="text-accentDanger">{totalStats.goals}</span> gólů •{" "}
                <span className="text-accentPrimary">
                  {totalStats.shots > 0
                    ? ((totalStats.saves / totalStats.shots) * 100)
                        .toFixed(1)
                        .replace(".", ",")
                    : "0,0"}
                  %
                </span>
              </span>
            </div>
            {/* Share button */}
            {(totalStats.shots > 0 || (match.manualStats && match.manualStats.shots > 0)) && (
              <button
                onClick={async () => {
                  const report = generateMatchReport(match, events, goalie);
                  const result = await shareText(
                    `${match.home} vs ${match.away} - Statistiky brankáře`,
                    report
                  );
                  if (result === "copied") {
                    alert("Statistiky zkopírovány do schránky!");
                  } else if (result === "failed") {
                    alert("Nepodařilo se sdílet statistiky");
                  }
                }}
                className="mt-2 w-full rounded-lg bg-accentPrimary/20 py-2 text-xs font-medium text-accentPrimary"
              >
                📤 Sdílet statistiky zápasu
              </button>
            )}
          </div>

          {!isMatchClosed && (
            <>
              {/* Landscape mode button */}
              {isMobile && (
                <div className="border-t border-borderSoft bg-bgSurfaceSoft/50 px-4 py-2">
                  <button
                    onClick={() => setShowLandscapeMode(true)}
                    className="w-full rounded-lg bg-accentPrimary/20 py-2 text-xs font-medium text-accentPrimary"
                  >
                    📱 Otočit na šířku pro lepší tracking
                  </button>
                </div>
              )}
              
              <ActionBar
                onSave={() => addEventQuick("save")}
                onGoal={() => addEventQuick("goal")}
                onMiss={() => addEventQuick("miss")}
              />
            </>
          )}
        </>
      )}

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        zone={pendingZone}
        header={`${period}. třetina • ${gameTime}`}
        onSubmit={async ({ result, saveType, goalType, situation, goalPosition }) => {
          if (!pendingCoords || !match || isMatchClosed) return;
          const now = new Date().toISOString();
          const zone =
            pendingZone ?? getZoneFromCoords(pendingCoords.x, pendingCoords.y);

          if (dataSource === "supabase") {
            // Create event in Supabase
            const periodStr = period === "OT" ? "OT" : String(period) as "1" | "2" | "3";
            const createdEvent = await createEventSupabase({
              match_id: match.id,
              goalie_id: goalie?.id,
              period: periodStr,
              game_time: gameTime,
              result,
              shot_x: pendingCoords.x,
              shot_y: pendingCoords.y,
              input_source: "live",
            });
            
            if (createdEvent) {
              setEvents((prev) => [...prev, createdEvent]);
              setAllEvents((prev) => [...prev, createdEvent]);
            } else {
              console.error("[MatchPage] Failed to create event in Supabase");
            }
          } else {
            // Create event in localStorage
            const newEvent: GoalieEvent = {
              id: generateEventId(),
              matchId: match.id,
              goalieId: goalie?.id || "",
              period,
              gameTime,
              timestamp: now,
              result,
              shotPosition: {
                x: pendingCoords.x,
                y: pendingCoords.y,
                zone,
              },
              goalPosition,
              saveType,
              goalType,
              situation,
              inputSource: "live",
              status: "confirmed",
              createdAt: now,
            };
            
            saveEventLocal(newEvent);
            
            // Re-read from storage
            const updatedEvents = getEventsByMatchLocal(match.id);
            setEvents(updatedEvents);
            setAllEvents(getAllEventsByMatch(match.id));
            
            // Trigger sync to Supabase (background)
            syncNow().catch(err => {
              console.error('[MatchPage] Background sync failed:', err);
            });
          }
          
          setModalOpen(false);
          setPendingCoords(null);
        }}
      />
    </div>
  );
}
