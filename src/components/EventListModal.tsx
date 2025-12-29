"use client";

import React, { useState, useMemo } from "react";
import type { GoalieEvent, Period, ResultType, SituationType, ShotPosition, ShotTargetZone } from "@/lib/types";
import { saveEvent, softDeleteEvent, restoreEvent } from "@/lib/storage";
import { MiniRinkSelector } from "./MiniRinkSelector";
import { GoalTargetSelector, GoalTargetBadge } from "./GoalTargetSelector";

interface EventListModalProps {
  open: boolean;
  onClose: () => void;
  events: GoalieEvent[];
  onEventsChange: () => void;
  matchClosed?: boolean;
  goalieCatchHand?: "L" | "R";
}

type FilterType = "all" | "save" | "goal" | "miss" | "deleted";

export function EventListModal({
  open,
  onClose,
  events,
  onEventsChange,
  matchClosed = false,
  goalieCatchHand = "L",
}: EventListModalProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [editingEvent, setEditingEvent] = useState<GoalieEvent | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editTab, setEditTab] = useState<"basic" | "position" | "target">("basic");

  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (!showDeleted) {
      filtered = filtered.filter((e) => e.status !== "deleted");
    }

    if (filter !== "all") {
      if (filter === "deleted") {
        filtered = events.filter((e) => e.status === "deleted");
      } else {
        filtered = filtered.filter((e) => e.result === filter);
      }
    }

    // Sort by timestamp descending (newest first)
    return [...filtered].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [events, filter, showDeleted]);

  const stats = useMemo(() => {
    const active = events.filter((e) => e.status !== "deleted");
    return {
      total: active.length,
      saves: active.filter((e) => e.result === "save").length,
      goals: active.filter((e) => e.result === "goal").length,
      misses: active.filter((e) => e.result === "miss").length,
      deleted: events.filter((e) => e.status === "deleted").length,
    };
  }, [events]);

  if (!open) return null;

  const handleDelete = (event: GoalieEvent) => {
    if (confirm("Smazat tuto událost?")) {
      softDeleteEvent(event.id);
      // Force immediate update by calling onEventsChange asynchronously
      // This ensures storage is updated before we reload
      setTimeout(() => {
        onEventsChange();
      }, 50);
    }
  };

  const handleRestore = (event: GoalieEvent) => {
    restoreEvent(event.id);
    // Force immediate update
    setTimeout(() => {
      onEventsChange();
    }, 50);
  };

  const handleSaveEdit = () => {
    if (!editingEvent) return;
    saveEvent({ ...editingEvent, status: "edited", updatedAt: new Date().toISOString() });
    setEditingEvent(null);
    setEditTab("basic");
    // Force immediate update
    setTimeout(() => {
      onEventsChange();
    }, 50);
  };

  const handleShotPositionChange = (position: ShotPosition) => {
    if (!editingEvent) return;
    setEditingEvent({ ...editingEvent, shotPosition: position });
  };

  const handleShotTargetChange = (target: ShotTargetZone) => {
    if (!editingEvent) return;
    setEditingEvent({ ...editingEvent, shotTarget: target });
  };

  const getResultIcon = (result: ResultType) => {
    switch (result) {
      case "save":
        return "✓";
      case "goal":
        return "✕";
      case "miss":
        return "○";
    }
  };

  const getResultColor = (result: ResultType) => {
    switch (result) {
      case "save":
        return "bg-accentSuccess";
      case "goal":
        return "bg-accentDanger";
      case "miss":
        return "bg-slate-600";
    }
  };

  const periodLabel = (period: Period) =>
    period === "OT" ? "Prodloužení" : `${period}. třetina`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl bg-bgSurfaceSoft">
        {/* Header */}
        <div className="border-b border-borderSoft p-4">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-700" />
          <h2 className="text-center text-lg font-semibold">
            Seznam událostí ({stats.total})
          </h2>
        </div>

        {/* Stats bar */}
        <div className="flex justify-center gap-4 border-b border-borderSoft bg-slate-800/50 px-4 py-2 text-xs">
          <span className="text-accentSuccess">✓ {stats.saves} zákroků</span>
          <span className="text-accentDanger">✕ {stats.goals} gólů</span>
          <span className="text-slate-400">○ {stats.misses} mimo</span>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-1 overflow-x-auto border-b border-borderSoft px-4 py-2">
          {[
            { value: "all", label: "Vše" },
            { value: "save", label: "Zákroky" },
            { value: "goal", label: "Góly" },
            { value: "miss", label: "Mimo" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as FilterType)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                filter === f.value
                  ? "bg-accentPrimary text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
          {stats.deleted > 0 && (
            <button
              onClick={() => {
                setShowDeleted(!showDeleted);
                if (!showDeleted) setFilter("deleted");
                else setFilter("all");
              }}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                showDeleted
                  ? "bg-accentDanger/20 text-accentDanger"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              Smazané ({stats.deleted})
            </button>
          )}
        </div>

        {/* Event list */}
        <div className="max-h-[50vh] overflow-y-auto p-4">
          {filteredEvents.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Žádné události
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className={`rounded-lg p-3 ${
                    event.status === "deleted"
                      ? "bg-slate-800/30 opacity-50"
                      : "bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${getResultColor(
                          event.result
                        )}`}
                      >
                        {getResultIcon(event.result)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {event.result === "save"
                            ? "Zákrok"
                            : event.result === "goal"
                            ? "Gól"
                            : "Mimo"}
                          {event.situation && event.situation !== "even" && (
                            <span className="text-xs text-accentHighlight">
                              ({event.situation === "powerplay" ? "PP" : "SH"})
                            </span>
                          )}
                          {event.shotTarget && (
                            <GoalTargetBadge zone={event.shotTarget} size="sm" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {periodLabel(event.period)} • {event.gameTime}
                          {event.shotPosition && (
                            <span className="ml-1">
                              • {event.shotPosition.zone.replace("_", " ")}
                            </span>
                          )}
                        </div>
                        {event.status === "edited" && (
                          <div className="text-[10px] text-accentHighlight">
                            Upraveno
                          </div>
                        )}
                        {event.status === "deleted" && (
                          <div className="text-[10px] text-accentDanger">
                            Smazáno
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                      {event.status === "deleted" ? (
                        <button
                          onClick={() => handleRestore(event)}
                          className="rounded bg-accentSuccess/20 px-2 py-1 text-xs text-accentSuccess"
                        >
                          Obnovit
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingEvent(event);
                              setEditTab("basic");
                            }}
                            disabled={matchClosed}
                            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-50"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(event)}
                            disabled={matchClosed}
                            className="rounded bg-slate-700 px-2 py-1 text-xs text-accentDanger disabled:opacity-50"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-borderSoft p-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-800 py-3 text-sm font-medium text-slate-300"
          >
            Zavřít
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-bgSurfaceSoft sm:rounded-2xl">
            {/* Fixed header */}
            <div className="shrink-0 p-5 pb-0">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-700 sm:hidden" />
              <h3 className="mb-4 text-center font-semibold">Upravit událost</h3>

              {/* Tabs */}
              <div className="mb-4 flex gap-1 rounded-lg bg-slate-800 p-1">
                <button
                  onClick={() => setEditTab("basic")}
                  className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${
                    editTab === "basic"
                      ? "bg-accentPrimary text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Základní
                </button>
                <button
                  onClick={() => setEditTab("position")}
                  className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${
                    editTab === "position"
                      ? "bg-accentPrimary text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Pozice střely
                </button>
                <button
                  onClick={() => setEditTab("target")}
                  className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${
                    editTab === "target"
                      ? "bg-accentPrimary text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Umístění
                </button>
              </div>
            </div>

            {/* Scrollable content area */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {/* Basic tab */}
              {editTab === "basic" && (
                <>
                  {/* Result */}
                  <div className="mb-4">
                    <label className="mb-2 block text-xs text-slate-400">
                      Výsledek
                    </label>
                    <div className="flex gap-2">
                      {(["save", "goal", "miss"] as ResultType[]).map((r) => (
                        <button
                          key={r}
                          onClick={() =>
                            setEditingEvent({ ...editingEvent, result: r })
                          }
                          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                            editingEvent.result === r
                              ? r === "save"
                                ? "bg-accentSuccess text-white"
                                : r === "goal"
                                ? "bg-accentDanger text-white"
                                : "bg-slate-600 text-white"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {r === "save" ? "Zákrok" : r === "goal" ? "Gól" : "Mimo"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Situation */}
                  <div className="mb-4">
                    <label className="mb-2 block text-xs text-slate-400">
                      Situace
                    </label>
                    <div className="flex gap-2">
                      {(["even", "powerplay", "shorthanded"] as SituationType[]).map(
                        (s) => (
                          <button
                            key={s}
                            onClick={() =>
                              setEditingEvent({ ...editingEvent, situation: s })
                            }
                            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                              editingEvent.situation === s
                                ? "bg-accentPrimary text-white"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {s === "even" ? "5v5" : s === "powerplay" ? "PP" : "SH"}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Period */}
                  <div className="mb-4">
                    <label className="mb-2 block text-xs text-slate-400">
                      Třetina
                    </label>
                    <div className="flex gap-2">
                      {([1, 2, 3, "OT"] as Period[]).map((p) => (
                        <button
                          key={p}
                          onClick={() =>
                            setEditingEvent({ ...editingEvent, period: p })
                          }
                          className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                            editingEvent.period === p
                              ? "bg-accentPrimary text-white"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {p === "OT" ? "OT" : `${p}.`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Game time */}
                  <div className="mb-4">
                    <label className="mb-2 block text-xs text-slate-400">
                      Čas v zápase
                    </label>
                    <input
                      type="text"
                      value={editingEvent.gameTime}
                      onChange={(e) =>
                        setEditingEvent({ ...editingEvent, gameTime: e.target.value })
                      }
                      className="w-full rounded-xl border border-borderSoft bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-accentPrimary focus:outline-none focus:ring-2 focus:ring-accentPrimary/20"
                      placeholder="00:00"
                    />
                  </div>
                </>
              )}

              {/* Position tab */}
              {editTab === "position" && (
                <div className="mb-4">
                  <label className="mb-2 block text-xs text-slate-400">
                    Pozice střely na ledě
                  </label>
                  <MiniRinkSelector
                    position={editingEvent.shotPosition}
                    onSelect={handleShotPositionChange}
                  />
                </div>
              )}

              {/* Target tab */}
              {editTab === "target" && (
                <div className="mb-4 pb-4">
                  <label className="mb-2 block text-xs text-slate-400">
                    Umístění střely v brance
                  </label>
                  <GoalTargetSelector
                    selected={editingEvent.shotTarget}
                    onSelect={handleShotTargetChange}
                    catchHand={goalieCatchHand}
                  />
                </div>
              )}
            </div>

            {/* Fixed footer with actions */}
            <div className="shrink-0 border-t border-borderSoft bg-bgSurfaceSoft p-5 pb-8 sm:pb-5">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEditingEvent(null);
                    setEditTab("basic");
                  }}
                  className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-700"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 rounded-xl bg-accentPrimary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accentPrimary/90"
                >
                  Uložit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
