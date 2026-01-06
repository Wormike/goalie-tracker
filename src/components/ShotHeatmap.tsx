"use client";

import React, { useState } from "react";
import type { GoalieEvent } from "@/lib/types";

type ShotHeatmapProps = {
  events: GoalieEvent[];
  title?: string;
};

export function ShotHeatmap({ events, title }: ShotHeatmapProps) {
  const [filter, setFilter] = useState<"all" | "saves" | "goals">("all");

  const filteredEvents = events.filter((e) => {
    if (!e.shotPosition) return false;
    if (filter === "saves") return e.result === "save";
    if (filter === "goals") return e.result === "goal";
    return e.result === "save" || e.result === "goal";
  });

  const heatmapData = calculateHeatmap(filteredEvents, filter);

  const totalShots = events.filter(
    (e) => e.result === "save" || e.result === "goal"
  ).length;
  const totalGoals = events.filter((e) => e.result === "goal").length;

  return (
    <div className="rounded-2xl bg-bgSurfaceSoft p-4">
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-slate-200">{title}</h3>
      )}

      {/* Filter buttons */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
            filter === "all"
              ? "bg-accentPrimary text-white"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          Vše ({totalShots})
        </button>
        <button
          onClick={() => setFilter("saves")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
            filter === "saves"
              ? "bg-accentSuccess text-white"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          Zákroky
        </button>
        <button
          onClick={() => setFilter("goals")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
            filter === "goals"
              ? "bg-accentDanger text-white"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          Góly ({totalGoals})
        </button>
      </div>

      {/* Heatmap */}
      <div
        className="relative overflow-hidden rounded-xl border-2 border-accentPrimary/30 bg-gradient-to-b from-blue-900/40 to-blue-950/70"
        style={{ aspectRatio: "1.2/1" }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          {/* Heatmap cells */}
          {heatmapData.map((cell, i) => (
            <rect
              key={i}
              x={cell.x - 5}
              y={cell.y - 5}
              width="10"
              height="10"
              fill={
                filter === "goals"
                  ? `rgba(239, 68, 68, ${cell.intensity * 0.8})`
                  : filter === "saves"
                  ? `rgba(34, 197, 94, ${cell.intensity * 0.8})`
                  : `rgba(${Math.round(cell.goalRate * 239)}, ${Math.round(
                      (1 - cell.goalRate) * 197
                    )}, ${Math.round((1 - cell.goalRate) * 94)}, ${cell.intensity * 0.7})`
              }
              rx="2"
            />
          ))}

          {/* Ice markings */}
          <line
            x1="0"
            y1="25"
            x2="100"
            y2="25"
            stroke="rgba(59,130,246,0.4)"
            strokeWidth="1"
          />

          {/* Faceoff circles */}
          <circle
            cx="25"
            cy="55"
            r="12"
            fill="none"
            stroke="rgba(239,68,68,0.3)"
            strokeWidth="0.5"
          />
          <circle
            cx="75"
            cy="55"
            r="12"
            fill="none"
            stroke="rgba(239,68,68,0.3)"
            strokeWidth="0.5"
          />

          {/* Goal crease */}
          <path
            d="M 35 95 Q 50 78 65 95"
            fill="rgba(59,130,246,0.1)"
            stroke="rgba(59,130,246,0.4)"
            strokeWidth="0.8"
          />

          {/* Goal */}
          <rect
            x="40"
            y="96"
            width="20"
            height="4"
            rx="1"
            fill="rgba(239,68,68,0.5)"
          />
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2 rounded bg-black/50 px-2 py-1 text-[10px]">
          <span className="text-slate-400">Málo</span>
          <div className="flex h-2 w-16 overflow-hidden rounded">
            <div className="flex-1 bg-blue-900/50" />
            <div className="flex-1 bg-yellow-500/50" />
            <div className="flex-1 bg-orange-500/50" />
            <div className="flex-1 bg-red-500/70" />
          </div>
          <span className="text-slate-400">Hodně</span>
        </div>
      </div>

      {/* Zone breakdown */}
      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[10px]">
        {[
          { zone: "blue_line", label: "Modrá" },
          { zone: "left_wing", label: "Levé kř." },
          { zone: "slot", label: "Slot" },
          { zone: "right_wing", label: "Pravé kř." },
          { zone: "behind_goal", label: "Za br." },
        ].map(({ zone, label }) => {
          const zoneEvents = filteredEvents.filter(
            (e) => e.shotPosition?.zone === zone
          );
          const count = zoneEvents.length;
          const goals = zoneEvents.filter((e) => e.result === "goal").length;
          const pct = count > 0 ? ((count - goals) / count) * 100 : 0;

          return (
            <div key={zone} className="rounded bg-slate-800/50 px-1 py-1.5">
              <div className="font-bold text-slate-200">{count}</div>
              <div className="text-slate-500">{label}</div>
              {count > 0 && (
                <div
                  className={`text-[9px] ${
                    pct >= 90
                      ? "text-accentSuccess"
                      : pct >= 80
                      ? "text-accentPrimary"
                      : "text-accentDanger"
                  }`}
                >
                  {pct.toFixed(0)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function calculateHeatmap(
  events: GoalieEvent[],
  filter: "all" | "saves" | "goals"
) {
  const gridSize = 10;
  const grid: {
    [key: string]: { total: number; goals: number };
  } = {};

  events.forEach((e) => {
    if (!e.shotPosition) return;
    const gridX =
      Math.floor(e.shotPosition.x / gridSize) * gridSize + gridSize / 2;
    const gridY =
      Math.floor(e.shotPosition.y / gridSize) * gridSize + gridSize / 2;
    const key = `${gridX}-${gridY}`;

    if (!grid[key]) {
      grid[key] = { total: 0, goals: 0 };
    }
    grid[key].total++;
    if (e.result === "goal") grid[key].goals++;
  });

  const maxCount = Math.max(...Object.values(grid).map((g) => g.total), 1);

  return Object.entries(grid).map(([key, data]) => {
    const [x, y] = key.split("-").map(Number);
    return {
      x,
      y,
      count: data.total,
      goals: data.goals,
      intensity: data.total / maxCount,
      goalRate: data.total > 0 ? data.goals / data.total : 0,
    };
  });
}










