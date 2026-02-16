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
import { isMatchCompleted } from "@/lib/utils/matchStatus";
import type {
  GoalieEvent,
  Match,
  Period,
  ShotZone,
  SituationType,
  Goalie,
  MatchStatus,
} from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { generateMatchReport, shareText } from "@/lib/utils";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useCompetitions } from "@/lib/competitionService";

function getZoneFromCoords(x: number, y: number): ShotZone {
  if (y < 30) return "blue_line";
  if (y > 85) return "behind_goal";
  if (x < 30) return "left_wing";
  if (x > 70) return "right_wing";
  return "slot";
}

function generateEventId(): string {
  return crypto.randomUUID();
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
  const [showCompetitionSelect, setShowCompetitionSelect] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showEventList, setShowEventList] = useState(false);
  const [activeTab, setActiveTab] = useState<"tracking" | "roster">("tracking");
  const [loading, setLoading] = useState(true);
  const [currentSituation, setCurrentSituation] = useState<SituationType>("even");
  const { competitions: userCompetitions } = useCompetitions();

  // Load match data
  const loadMatchData = async (matchId: string) => {
    setLoading(true);
    const [matches, eventsForMatch, goaliesList] = await Promise.all([
      dataService.getMatches(),
      dataService.getEvents(matchId),
      dataService.getGoalies(),
    ]);

    const loadedMatch = matches.find((m) => m.id === matchId) || null;
    if (!loadedMatch) {
      setLoading(false);
      return;
    }

    const filteredEvents = eventsForMatch.filter((e) => e.status !== "deleted");

    const hasGoalie = !!loadedMatch.goalieId;
    const hasEvents = filteredEvents.length > 0;
    const isCompleted = isMatchCompleted(loadedMatch.status) || loadedMatch.completed;
    
    if (isCompleted && !hasGoalie && !hasEvents) {
      const matchMetadata = JSON.parse(localStorage.getItem('match-metadata') || '{}');
      const metadata = matchMetadata[loadedMatch.id];
      const originalDatetime = metadata?.originalDatetime || loadedMatch.datetime;

      const revertedMatch: Match = {
        ...loadedMatch,
        status: "scheduled" as MatchStatus,
        completed: false,
        datetime: originalDatetime,
      };

      await dataService.saveMatch(revertedMatch);
      setMatch(revertedMatch);
    } else {
      setMatch(loadedMatch);
    }

    setEvents(filteredEvents);
    setAllEvents(eventsForMatch);
    setGoalies(goaliesList);
    setGoalie(goaliesList.find((g) => g.id === loadedMatch.goalieId) || null);
    setLoading(false);
  };

  const loadGoalies = async () => {
    const loadedGoalies = await dataService.getGoalies();
    setGoalies(loadedGoalies);
    if (match?.goalieId) {
      const foundGoalie = loadedGoalies.find(g => g.id === match.goalieId);
      setGoalie(foundGoalie || null);
    }
  };

  useEffect(() => {
    const initData = async () => {
      await loadMatchData(params.id);
      await loadGoalies();
    };
    initData();
  }, [params.id]);

  // Reload goalies when page becomes visible (e.g., after creating goalie on another page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadGoalies();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Reload goalies when goalie selection modal opens
  useEffect(() => {
    if (showGoalieSelect) {
      loadGoalies();
    }
  }, [showGoalieSelect]);

  // Update goalie when match changes (e.g., after loading)
  useEffect(() => {
    if (match?.goalieId) {
      loadGoalies();
    }
  }, [match?.goalieId]);

  // Auto-revert completed match to upcoming if goalie and events are removed
  useEffect(() => {
    if (!match) return;
    
    const isCompleted = isMatchCompleted(match.status) || match.completed;
    const hasGoalie = !!match.goalieId;
    const hasEvents = events.length > 0;
    
    // If match is completed but has no goalie and no events, auto-revert to upcoming
    if (isCompleted && !hasGoalie && !hasEvents) {
      const matchMetadata = JSON.parse(localStorage.getItem('match-metadata') || '{}');
      const metadata = matchMetadata[match.id];
      
      // Check if we have originalDatetime stored (meaning match was closed and moved to today)
      if (metadata?.originalDatetime) {
        const originalDatetime = metadata.originalDatetime;
        const matchDatetime = new Date(match.datetime).getTime();
        const originalDatetimeTime = new Date(originalDatetime).getTime();
        const today = new Date().getTime();
        const isToday = Math.abs(matchDatetime - today) < 24 * 60 * 60 * 1000; // Within 24 hours of today
        
        // Only revert if datetime is today (moved when closed) and different from original
        if (isToday && originalDatetimeTime !== matchDatetime) {
          
          const revertedMatch: Match = {
            ...match,
            status: "scheduled" as MatchStatus,
            completed: false,
            datetime: originalDatetime,
          };
          
          const revertMatch = async () => {
            const saved = await dataService.saveMatch(revertedMatch);
            setMatch(saved);
            setTimeout(() => router.push('/'), 500);

            syncNow().catch(err => {
              console.error('[MatchPage] Background sync failed:', err);
            });
          };
          
          revertMatch();
        }
      }
    }
  }, [match?.status, match?.completed, match?.goalieId, events.length, match?.id, match?.datetime]);

  // Auto-refresh events when match changes
  useEffect(() => {
    if (!match) return;
    dataService.getEvents(match.id).then((loaded) => {
      setEvents(loaded.filter((e) => e.status !== "deleted"));
      setAllEvents(loaded);
    });
  }, [match]);

  // Force reload events when page becomes visible (mobile fix)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && match) {
        dataService.getEvents(match.id).then((reloadedEvents) => {
          const visibleEvents = reloadedEvents.filter((e) => e.status !== "deleted");
          if (visibleEvents.length !== events.length) {
            setEvents(visibleEvents);
            setAllEvents(reloadedEvents);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [match, events.length]);

  const isMatchClosed = match ? (isMatchCompleted(match.status) || match.status === "cancelled" || match.completed) : false;

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
    const zone: ShotZone = getZoneFromCoords(50, 50);

    const newEvent: GoalieEvent = {
      id: generateEventId(),
      matchId: match.id,
      goalieId: goalie?.id || "",
      period,
      gameTime,
      timestamp: now,
      result,
      shotPosition: { x: 50, y: 50, zone },
      situation: currentSituation,
      inputSource: "live",
      status: "confirmed",
      createdAt: now,
    };

    const saved = await dataService.saveEvent(newEvent);
    const updatedAllEvents = await dataService.getEvents(match.id);
    setEvents(updatedAllEvents.filter((e) => e.status !== "deleted"));
    setAllEvents(updatedAllEvents);

    if (!saved) {
      console.error("[MatchPage] Failed to save quick event");
    }
  };

  const handleGoalieChange = async (goalieId: string | null) => {
    if (!match) return;
    
    // If goalieId is empty string, convert to null to allow removal
    const finalGoalieId = goalieId && goalieId.trim() !== "" ? goalieId : undefined;
    
    const updatedMatch = { ...match, goalieId: finalGoalieId };
    const saved = await dataService.saveMatch(updatedMatch);
    setMatch(saved);
    setGoalie(finalGoalieId ? goalies.find(g => g.id === finalGoalieId) || null : null);

    if (finalGoalieId) {
      const updatedEvents = events.map((e) => ({ ...e, goalieId: finalGoalieId }));
      for (const event of updatedEvents) {
        // eslint-disable-next-line no-await-in-loop
        await dataService.saveEvent(event);
      }
      const refreshed = await dataService.getEvents(match.id);
      setEvents(refreshed.filter((e) => e.status !== "deleted"));
      setAllEvents(refreshed);
    }

    setShowGoalieSelect(false);
  };

  const handleCompetitionChange = async (competitionId: string | null) => {
    if (!match) return;
    
    // If competitionId is empty string, convert to null to allow removal
    const finalCompetitionId = competitionId && competitionId.trim() !== "" ? competitionId : undefined;

    const updatedMatch = {
      ...match,
      competitionId: finalCompetitionId,
      competitionIdManuallySet: true,
    };
    const saved = await dataService.saveMatch(updatedMatch);
    setMatch(saved);
    setShowCompetitionSelect(false);
  };

  const handleDeleteLastEvent = () => {
    if (events.length === 0 || isMatchClosed) return;
    if (!confirm("Smazat poslední událost?")) return;

    const lastEvent = events[events.length - 1];
    dataService.deleteEvent(lastEvent.id).then(async () => {
      if (!match) return;
      const refreshed = await dataService.getEvents(match.id);
      setEvents(refreshed.filter((e) => e.status !== "deleted"));
      setAllEvents(refreshed);
    });
  };

  const toggleMatchStatus = async () => {
    if (!match) return;
    const newStatus: MatchStatus = isMatchCompleted(match.status) ? "in_progress" : "completed";

    const updatedMatch: Match = {
      ...match,
      status: newStatus,
      completed: newStatus === "completed",
      updatedAt: new Date().toISOString(),
    };
    const saved = await dataService.saveMatch(updatedMatch);
    setMatch(saved);
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

      {/* Competition info */}
      <div className="border-b border-borderSoft bg-bgSurfaceSoft/30 px-4 py-2">
        <button
          onClick={() => setShowCompetitionSelect(true)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Soutěž:</span>
            <span className="text-sm font-medium text-slate-200">
              {match.competitionId
                ? userCompetitions.find((c) => c.id === match.competitionId)?.name || "Neznámá soutěž"
                : match.category || "Nepřiřazeno"}
            </span>
          </div>
          <span className="text-xs text-slate-500">✏️ Změnit</span>
        </button>
      </div>

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
                {goalie && (
                  <button
                    onClick={() => {
                      if (confirm("Opravdu odebrat brankáře z tohoto zápasu?")) {
                        handleGoalieChange(null);
                      }
                    }}
                    className="w-full rounded-lg border border-accentDanger/50 bg-accentDanger/10 px-3 py-2 text-left text-sm text-accentDanger"
                  >
                    ✕ Odebrat {goalie.firstName} {goalie.lastName}
                  </button>
                )}
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

      {/* Competition selector modal */}
      {showCompetitionSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-bgSurfaceSoft p-4">
            <h3 className="mb-4 text-center font-semibold">Vybrat soutěž</h3>
            {userCompetitions.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-slate-400">Žádné soutěže</p>
                <button
                  onClick={() => router.push("/settings")}
                  className="mt-2 text-sm text-accentPrimary"
                >
                  Vytvořit soutěž →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => handleCompetitionChange(null)}
                  className={`w-full rounded-lg px-3 py-3 text-left ${
                    !match.competitionId
                      ? "bg-accentPrimary/20 text-accentPrimary"
                      : "bg-slate-800 text-slate-200"
                  }`}
                >
                  <div className="font-medium">Nepřiřazeno</div>
                  <div className="text-xs text-slate-400">Zápas nebude filtrován</div>
                </button>
                {userCompetitions.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => handleCompetitionChange(comp.id)}
                    className={`w-full rounded-lg px-3 py-3 text-left ${
                      match.competitionId === comp.id
                        ? "bg-accentPrimary/20 text-accentPrimary"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="font-medium">{comp.name}</div>
                    {comp.category && (
                      <div className="text-xs text-slate-400">{comp.category}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowCompetitionSelect(false)}
              className="mt-4 w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300"
            >
              Zrušit
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
          if (!match) return;

          const refreshed = await dataService.getEvents(match.id);
          setEvents(refreshed.filter((e) => e.status !== "deleted"));
          setAllEvents(refreshed);
        }}
        matchClosed={isMatchClosed}
        goalieCatchHand={goalie?.catchHand || "L"}
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

            dataService.saveEvent(newEvent).then(async () => {
              const refreshed = await dataService.getEvents(match.id);
              setEvents(refreshed.filter((e) => e.status !== "deleted"));
              setAllEvents(refreshed);

              syncNow().catch(err => {
                console.error('[MatchPage] Background sync failed:', err);
              });
            });
            setCurrentSituation(situation);
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
              
              {/* Close match button */}
              <div className="border-t border-borderSoft bg-bgSurfaceSoft/50 px-4 py-2">
                <button
                  onClick={async () => {
                    if (!match) return;
                    if (!confirm("Opravdu ukončit tento zápas? Zápas bude přesunut do odehraných s dnešním datumem.")) return;
                    
                    const now = new Date();
                    const todayISO = now.toISOString();
                    const originalDatetime = match.datetime; // Save original datetime
                    
                    // Store original datetime in localStorage separately for reopening
                    const matchMetadata = JSON.parse(localStorage.getItem('match-metadata') || '{}');
                    matchMetadata[match.id] = { originalDatetime };
                    localStorage.setItem('match-metadata', JSON.stringify(matchMetadata));
                    
                    // Save original datetime to a metadata field (we'll use a custom field in match)
                    const updatedMatch: Match = {
                      ...match,
                      status: "completed" as MatchStatus,
                      completed: true,
                      datetime: todayISO, // Move to today
                    };

                    const saved = await dataService.saveMatch(updatedMatch);
                    setMatch(saved);
                    
                    // Trigger sync to Supabase (background)
                    syncNow().catch(err => {
                      console.error('[MatchPage] Background sync failed:', err);
                    });
                    
                    // Navigate back to home
                    router.push('/');
                  }}
                  className="w-full rounded-lg bg-accentDanger/20 py-2 text-xs font-medium text-accentDanger"
                >
                  ✓ Ukončit zápas
                </button>
              </div>
            </>
          )}
          
          {isMatchClosed && (
            <div className="border-t border-borderSoft bg-bgSurfaceSoft/50 px-4 py-2 space-y-2">
              <button
                onClick={async () => {
                  if (!match) return;
                  
                  const hasGoalie = !!match.goalieId;
                  const hasEvents = events.length > 0;
                  
                  // Restore original datetime if available
                  const matchMetadata = JSON.parse(localStorage.getItem('match-metadata') || '{}');
                  const metadata = matchMetadata[match.id];
                  const originalDatetime = metadata?.originalDatetime || match.datetime;
                  
                  // If match has no goalie and no events, revert to upcoming (scheduled)
                  // Otherwise just reopen it (in_progress)
                  const newStatus: MatchStatus = (!hasGoalie && !hasEvents) ? "scheduled" : "in_progress";
                  
                  const updatedMatch: Match = {
                    ...match,
                    status: newStatus,
                    completed: false,
                    datetime: originalDatetime, // Always restore original datetime
                  };

                  const saved = await dataService.saveMatch(updatedMatch);
                  setMatch(saved);
                  
                  // Trigger sync to Supabase (background)
                  syncNow().catch(err => {
                    console.error('[MatchPage] Background sync failed:', err);
                  });
                  
                  // Navigate back to home
                  router.push('/');
                }}
                className="w-full rounded-lg bg-accentSuccess/20 py-2 text-xs font-medium text-accentSuccess"
              >
                ↻ Znovuotevřít zápas
                {(!match.goalieId && events.length === 0) && " (vrátit mezi nadcházející)"}
              </button>
              
              {/* Info about auto-revert */}
              {!match.goalieId && events.length === 0 && (
                <p className="text-center text-[10px] text-slate-500">
                  Zápas bez brankáře a událostí bude automaticky vrácen mezi nadcházející s původním datem
                </p>
              )}
            </div>
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

          await dataService.saveEvent(newEvent);
          const refreshed = await dataService.getEvents(match.id);
          setEvents(refreshed.filter((e) => e.status !== "deleted"));
          setAllEvents(refreshed);
          setCurrentSituation(situation ?? "even");

          syncNow().catch(err => {
            console.error('[MatchPage] Background sync failed:', err);
          });
          
          setModalOpen(false);
          setPendingCoords(null);
        }}
      />
    </div>
  );
}
