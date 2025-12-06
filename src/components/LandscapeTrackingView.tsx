"use client";

import React, { useState } from "react";
import type {
  Period,
  ResultType,
  SituationType,
  ShotZone,
  GoalieEvent,
} from "@/lib/types";

interface LandscapeTrackingViewProps {
  period: Period;
  gameTime: string;
  events: GoalieEvent[];
  onAddEvent: (event: {
    result: ResultType;
    situation: SituationType;
    shotPosition?: { x: number; y: number; zone: ShotZone };
  }) => void;
  onClose: () => void;
  totalStats: { shots: number; saves: number; goals: number };
}

type Phase = "position" | "result";

function getZoneFromCoords(x: number, y: number): ShotZone {
  if (y < 30) return "blue_line";
  if (y > 85) return "behind_goal";
  if (x < 30) return "left_wing";
  if (x > 70) return "right_wing";
  return "slot";
}

export function LandscapeTrackingView({
  period,
  gameTime,
  events,
  onAddEvent,
  onClose,
  totalStats,
}: LandscapeTrackingViewProps) {
  const [phase, setPhase] = useState<Phase>("position");
  const [selectedPosition, setSelectedPosition] = useState<{
    x: number;
    y: number;
    zone: ShotZone;
  } | null>(null);
  const [selectedSituation, setSelectedSituation] =
    useState<SituationType>("even");

  const handleRinkTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const zone = getZoneFromCoords(x, y);

    setSelectedPosition({ x, y, zone });
    setPhase("result");
  };

  const handleResult = (result: ResultType) => {
    onAddEvent({
      result,
      situation: selectedSituation,
      shotPosition: selectedPosition || { x: 50, y: 50, zone: "slot" },
    });
    // Reset for next event
    setSelectedPosition(null);
    setPhase("position");
  };

  const handleQuickResult = (result: ResultType) => {
    // Skip position selection, use default center
    onAddEvent({
      result,
      situation: selectedSituation,
      shotPosition: { x: 50, y: 50, zone: "slot" },
    });
  };

  const savePercentage =
    totalStats.shots > 0
      ? ((totalStats.saves / totalStats.shots) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="fixed inset-0 z-50 flex bg-bgMain">
      {/* Phase 1: Position Selection */}
      {phase === "position" && (
        <div className="flex h-full w-full">
          {/* Rink area - takes most of the screen */}
          <div className="relative flex-1">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute left-2 top-2 z-10 rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-slate-300"
            >
              ← Zavřít
            </button>

            {/* Period/Time display */}
            <div className="absolute right-2 top-2 z-10 rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-slate-300">
              {period}. třetina • {gameTime}
            </div>

            {/* Stats display */}
            <div className="absolute bottom-2 left-2 z-10 rounded-lg bg-slate-800/80 px-3 py-2 text-xs">
              <span className="text-accentSuccess">{totalStats.saves}</span>
              <span className="text-slate-400"> / </span>
              <span className="text-slate-50">{totalStats.shots}</span>
              <span className="ml-2 text-accentPrimary">{savePercentage}%</span>
            </div>

            {/* Rink */}
            <div
              className="h-full w-full cursor-crosshair bg-gradient-to-b from-blue-900/30 to-blue-950/60"
              onClick={handleRinkTap}
            >
              {/* Ice rink markings */}
              <svg
                className="pointer-events-none h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* Blue line */}
                <line
                  x1="0"
                  y1="25"
                  x2="100"
                  y2="25"
                  stroke="rgba(59,130,246,0.6)"
                  strokeWidth="1"
                />
                {/* Center line */}
                <line
                  x1="0"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke="rgba(239,68,68,0.4)"
                  strokeWidth="0.5"
                />
                {/* Center circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="8"
                  fill="none"
                  stroke="rgba(239,68,68,0.5)"
                  strokeWidth="0.5"
                />
                {/* Goal crease */}
                <path
                  d="M 35 95 Q 50 78 65 95"
                  fill="rgba(59,130,246,0.15)"
                  stroke="rgba(59,130,246,0.5)"
                  strokeWidth="0.5"
                />
                {/* Goal */}
                <rect
                  x="40"
                  y="96"
                  width="20"
                  height="4"
                  rx="1"
                  fill="rgba(239,68,68,0.7)"
                />
              </svg>

              {/* Shot markers */}
              {events.map((e) => (
                <div
                  key={e.id}
                  className={`pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    e.result === "save"
                      ? "bg-accentSuccess"
                      : e.result === "goal"
                      ? "bg-accentDanger"
                      : "bg-slate-500"
                  }`}
                  style={{
                    left: `${e.shotPosition?.x ?? 50}%`,
                    top: `${e.shotPosition?.y ?? 50}%`,
                  }}
                />
              ))}

              {/* Selection indicator */}
              {selectedPosition && (
                <div
                  className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accentHighlight bg-accentHighlight/30"
                  style={{
                    left: `${selectedPosition.x}%`,
                    top: `${selectedPosition.y}%`,
                  }}
                />
              )}
            </div>

            {/* Instruction */}
            <div className="absolute bottom-2 right-2 z-10 rounded-lg bg-accentPrimary/20 px-3 py-2 text-xs text-accentPrimary">
              Klepni na místo střely
            </div>
          </div>

          {/* Quick action panel - right side */}
          <div className="flex w-32 flex-col justify-center gap-3 bg-bgSurfaceSoft p-3">
            <p className="text-center text-[10px] text-slate-500">
              Rychlé přidání
            </p>

            {/* Situation selector */}
            <div className="flex justify-center gap-1">
              {(["even", "powerplay", "shorthanded"] as SituationType[]).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSituation(s)}
                    className={`rounded px-2 py-1 text-[10px] font-medium ${
                      selectedSituation === s
                        ? "bg-accentPrimary text-white"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {s === "even" ? "5v5" : s === "powerplay" ? "PP" : "SH"}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() => handleQuickResult("save")}
              className="h-14 rounded-xl bg-accentSuccess text-lg font-bold text-white active:opacity-80"
            >
              ✓
            </button>
            <button
              onClick={() => handleQuickResult("goal")}
              className="h-14 rounded-xl bg-accentDanger text-lg font-bold text-white active:opacity-80"
            >
              ✕
            </button>
            <button
              onClick={() => handleQuickResult("miss")}
              className="h-14 rounded-xl bg-slate-700 text-lg font-bold text-white active:opacity-80"
            >
              ○
            </button>
          </div>
        </div>
      )}

      {/* Phase 2: Result Selection (full screen buttons) */}
      {phase === "result" && (
        <div className="flex h-full w-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between bg-bgSurfaceSoft px-4 py-3">
            <button
              onClick={() => {
                setPhase("position");
                setSelectedPosition(null);
              }}
              className="text-sm text-slate-300"
            >
              ← Zpět
            </button>
            <div className="text-sm">
              <span className="text-slate-400">Pozice: </span>
              <span className="text-slate-200">
                {selectedPosition?.zone.replace("_", " ")}
              </span>
            </div>
            <div className="w-12" />
          </div>

          {/* Situation selector */}
          <div className="flex justify-center gap-2 bg-bgSurfaceSoft/50 py-3">
            {(["even", "powerplay", "shorthanded"] as SituationType[]).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSituation(s)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    selectedSituation === s
                      ? "bg-accentPrimary text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {s === "even" ? "5v5" : s === "powerplay" ? "PP" : "SH"}
                </button>
              )
            )}
          </div>

          {/* Large result buttons */}
          <div className="flex flex-1 gap-3 p-4">
            <button
              onClick={() => handleResult("save")}
              className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-accentSuccess text-white active:opacity-80"
              style={{ minHeight: "120px" }}
            >
              <span className="text-5xl font-bold">✓</span>
              <span className="mt-2 text-lg font-semibold">ZÁKROK</span>
            </button>
            <button
              onClick={() => handleResult("goal")}
              className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-accentDanger text-white active:opacity-80"
              style={{ minHeight: "120px" }}
            >
              <span className="text-5xl font-bold">✕</span>
              <span className="mt-2 text-lg font-semibold">GÓL</span>
            </button>
            <button
              onClick={() => handleResult("miss")}
              className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-slate-700 text-white active:opacity-80"
              style={{ minHeight: "120px" }}
            >
              <span className="text-5xl font-bold">○</span>
              <span className="mt-2 text-lg font-semibold">MIMO</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

