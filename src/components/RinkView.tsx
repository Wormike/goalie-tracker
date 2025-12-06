"use client";

import React from "react";
import type { GoalieEvent, Period } from "@/lib/types";

type RinkViewProps = {
  period: Period;
  events: GoalieEvent[];
  onTap: (coords: { x: number; y: number }) => void;
  showHeatmap?: boolean;
};

export function RinkView({ period, events, onTap, showHeatmap = false }: RinkViewProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onTap({ x, y });
  };

  const getColor = (result: GoalieEvent["result"]) => {
    if (result === "save") return "bg-accentSuccess";
    if (result === "goal") return "bg-accentDanger";
    return "bg-accentNeutral";
  };

  const filteredEvents = events.filter(
    (e) => period === "OT" || e.period === period
  );

  // Calculate heatmap data
  const heatmapData = showHeatmap ? calculateHeatmap(filteredEvents) : null;

  return (
    <div className="px-4 py-4">
      <div
        className="relative cursor-crosshair overflow-hidden rounded-2xl border-2 border-accentPrimary/50 bg-gradient-to-b from-blue-900/30 to-blue-950/60"
        style={{ aspectRatio: "1.2/1" }}
        onClick={handleClick}
      >
        {/* Heatmap overlay */}
        {heatmapData && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <radialGradient id="heatGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(239, 68, 68, 0.6)" />
                <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
              </radialGradient>
            </defs>
            {heatmapData.map((point, i) => (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r={Math.max(5, point.intensity * 15)}
                fill={`rgba(239, 68, 68, ${Math.min(0.5, point.intensity * 0.3)})`}
              />
            ))}
          </svg>
        )}

        {/* Ice rink markings */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
        >
          {/* Center line (red) */}
          <line
            x1="0"
            y1="5"
            x2="100"
            y2="5"
            stroke="rgba(239,68,68,0.5)"
            strokeWidth="1.5"
          />

          {/* Center ice faceoff circle (partially visible at top) */}
          <circle
            cx="50"
            cy="5"
            r="12"
            fill="none"
            stroke="rgba(59,130,246,0.5)"
            strokeWidth="1"
          />
          <circle
            cx="50"
            cy="5"
            r="1"
            fill="rgba(59,130,246,0.7)"
          />

          {/* Blue line */}
          <line
            x1="0"
            y1="25"
            x2="100"
            y2="25"
            stroke="rgba(59,130,246,0.6)"
            strokeWidth="2"
          />

          {/* Neutral zone faceoff dots (no circles, just dots) */}
          <circle
            cx="20"
            cy="15"
            r="1.2"
            fill="rgba(239,68,68,0.7)"
          />
          <circle
            cx="80"
            cy="15"
            r="1.2"
            fill="rgba(239,68,68,0.7)"
          />

          {/* Defensive zone faceoff circles */}
          <circle
            cx="25"
            cy="55"
            r="12"
            fill="none"
            stroke="rgba(239,68,68,0.5)"
            strokeWidth="0.8"
          />
          <circle
            cx="25"
            cy="55"
            r="1"
            fill="rgba(239,68,68,0.7)"
          />
          {/* Hash marks for left circle */}
          <line x1="13" y1="50" x2="13" y2="54" stroke="rgba(239,68,68,0.4)" strokeWidth="0.5" />
          <line x1="13" y1="56" x2="13" y2="60" stroke="rgba(239,68,68,0.4)" strokeWidth="0.5" />
          <line x1="37" y1="50" x2="37" y2="54" stroke="rgba(239,68,68,0.4)" strokeWidth="0.5" />
          <line x1="37" y1="56" x2="37" y2="60" stroke="rgba(239,68,68,0.4)" strokeWidth="0.5" />

          <circle
            cx="75"
            cy="55"
            r="12"
            fill="none"
            stroke="rgba(239,68,68,0.5)"
            strokeWidth="0.8"
          />
          <circle
            cx="75"
            cy="55"
            r="1"
            fill="rgba(239,68,68,0.7)"
          />
          {/* Hash marks for right circle */}
          <line x1="63" y1="50" x2="63" y2="54" stroke="rgba(239,68,68,0.4)" strokeWidth="0.5" />
          <line x1="63" y1="56" x2="63" y2="60" stroke="rgba(239,68,68,0.4)" strokeWidth="0.5" />
          <line x1="87" y1="50" x2="87" y2="54" stroke="rgba(239,68,68,0.4)" strokeWidth="0.5" />
          <line x1="87" y1="56" x2="87" y2="60" stroke="rgba(239,68,68,0.4)" strokeWidth="0.5" />

          {/* Zone dividers (dashed) */}
          <line
            x1="30"
            y1="0"
            x2="30"
            y2="100"
            stroke="rgba(148,163,184,0.2)"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
          <line
            x1="70"
            y1="0"
            x2="70"
            y2="100"
            stroke="rgba(148,163,184,0.2)"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />

          {/* Goal crease */}
          <path
            d="M 35 95 Q 50 78 65 95"
            fill="rgba(59,130,246,0.15)"
            stroke="rgba(59,130,246,0.5)"
            strokeWidth="1"
          />

          {/* Goal line */}
          <line
            x1="30"
            y1="95"
            x2="70"
            y2="95"
            stroke="rgba(239,68,68,0.6)"
            strokeWidth="1"
          />

          {/* Goal */}
          <rect
            x="40"
            y="96"
            width="20"
            height="4"
            rx="1"
            fill="rgba(239,68,68,0.7)"
            stroke="rgba(239,68,68,0.9)"
            strokeWidth="0.5"
          />

          {/* Goal posts */}
          <line x1="40" y1="96" x2="40" y2="100" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
          <line x1="60" y1="96" x2="60" y2="100" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
        </svg>

        {/* Shot markers */}
        {filteredEvents.map((e) => (
          <div
            key={e.id}
            className={`pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${getColor(
              e.result
            )} ${e.result === "goal" ? "ring-2 ring-white/50" : ""}`}
            style={{
              left: `${e.shotPosition?.x ?? 50}%`,
              top: `${e.shotPosition?.y ?? 50}%`,
              opacity: 0.9,
            }}
          />
        ))}

        {/* Goalie emoji */}
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-3xl">
          🥅
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        Klepni na místo, odkud přišla střela
      </p>
    </div>
  );
}

function calculateHeatmap(events: GoalieEvent[]) {
  const gridSize = 10;
  const grid: { [key: string]: number } = {};

  events.forEach((e) => {
    if (!e.shotPosition) return;
    const gridX = Math.floor(e.shotPosition.x / gridSize) * gridSize + gridSize / 2;
    const gridY = Math.floor(e.shotPosition.y / gridSize) * gridSize + gridSize / 2;
    const key = `${gridX}-${gridY}`;
    grid[key] = (grid[key] || 0) + 1;
  });

  const maxCount = Math.max(...Object.values(grid), 1);

  return Object.entries(grid).map(([key, count]) => {
    const [x, y] = key.split("-").map(Number);
    return {
      x,
      y,
      count,
      intensity: count / maxCount,
    };
  });
}
