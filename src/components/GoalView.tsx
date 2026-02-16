"use client";

import React from "react";
import type { GoalPosition, GoalZone } from "@/lib/types";

type GoalViewProps = {
  onSelect: (position: GoalPosition) => void;
  selectedPosition?: GoalPosition | null;
  mode?: "select" | "display";
};

export function GoalView({ onSelect, selectedPosition, mode = "select" }: GoalViewProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "select") return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const zone = getZoneFromCoords(x, y);
    onSelect({ x, y, zone });
  };

  return (
    <div className="w-full">
      <div
        className={`relative overflow-hidden rounded-lg border-2 border-slate-600 bg-gradient-to-b from-slate-700 to-slate-800 ${
          mode === "select" ? "cursor-crosshair" : ""
        }`}
        style={{ aspectRatio: "1.8/1" }}
        onClick={handleClick}
      >
        {/* Goal frame */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 55"
        >
          {/* Goal posts and crossbar */}
          <rect
            x="2"
            y="2"
            width="96"
            height="51"
            fill="none"
            stroke="rgba(239,68,68,0.8)"
            strokeWidth="3"
            rx="2"
          />

          {/* Net pattern */}
          {[...Array(10)].map((_, i) => (
            <line
              key={`v${i}`}
              x1={10 + i * 9}
              y1="5"
              x2={10 + i * 9}
              y2="50"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.5"
            />
          ))}
          {[...Array(5)].map((_, i) => (
            <line
              key={`h${i}`}
              x1="5"
              y1={10 + i * 10}
              x2="95"
              y2={10 + i * 10}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.5"
            />
          ))}

          {/* Zone labels (subtle) */}
          <text x="17" y="18" fill="rgba(255,255,255,0.3)" fontSize="6" textAnchor="middle">↖</text>
          <text x="50" y="18" fill="rgba(255,255,255,0.3)" fontSize="6" textAnchor="middle">↑</text>
          <text x="83" y="18" fill="rgba(255,255,255,0.3)" fontSize="6" textAnchor="middle">↗</text>
          <text x="17" y="35" fill="rgba(255,255,255,0.3)" fontSize="6" textAnchor="middle">←</text>
          <text x="50" y="35" fill="rgba(255,255,255,0.3)" fontSize="6" textAnchor="middle">●</text>
          <text x="83" y="35" fill="rgba(255,255,255,0.3)" fontSize="6" textAnchor="middle">→</text>
          <text x="17" y="48" fill="rgba(255,255,255,0.3)" fontSize="6" textAnchor="middle">↙</text>
          <text x="50" y="48" fill="rgba(255,255,255,0.3)" fontSize="6" textAnchor="middle">↓</text>
          <text x="83" y="48" fill="rgba(255,255,255,0.3)" fontSize="6" textAnchor="middle">↘</text>
        </svg>

        {/* Selected position marker */}
        {selectedPosition && (
          <div
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accentPrimary ring-2 ring-white"
            style={{
              left: `${selectedPosition.x}%`,
              top: `${selectedPosition.y}%`,
            }}
          />
        )}
      </div>
      {mode === "select" && (
        <p className="mt-2 text-center text-xs text-slate-400">
          Klepni kam směřovala střela
        </p>
      )}
    </div>
  );
}

function getZoneFromCoords(x: number, y: number): GoalZone {
  // Five hole detection (center bottom)
  if (x > 40 && x < 60 && y > 70) return "five_hole";
  
  // Horizontal zones
  const col = x < 33 ? "left" : x > 67 ? "right" : "center";
  
  // Vertical zones
  const row = y < 33 ? "top" : y > 67 ? "bottom" : "middle";
  
  return `${row}_${col}` as GoalZone;
}

// Heatmap version for statistics
type GoalHeatmapProps = {
  events: Array<{
    result: "save" | "goal" | "miss";
    goalPosition?: { x: number; y: number; zone: GoalZone };
  }>;
  showGoalsOnly?: boolean;
  showSavesOnly?: boolean;
};

export function GoalHeatmap({ events, showGoalsOnly = false, showSavesOnly = false }: GoalHeatmapProps) {
  const filteredEvents = events.filter((e) => {
    if (!e.goalPosition) return false;
    if (showGoalsOnly) return e.result === "goal";
    if (showSavesOnly) return e.result === "save";
    return e.result === "save" || e.result === "goal";
  });

  // Calculate zone stats
  const zoneStats = filteredEvents.reduce((acc, e) => {
    const zone = e.goalPosition?.zone || "middle_center";
    if (!acc[zone]) {
      acc[zone] = { saves: 0, goals: 0 };
    }
    if (e.result === "save") acc[zone].saves++;
    if (e.result === "goal") acc[zone].goals++;
    return acc;
  }, {} as Record<string, { saves: number; goals: number }>);

  const maxCount = Math.max(
    ...Object.values(zoneStats).map((s) => s.saves + s.goals),
    1
  );

  const zones: { id: GoalZone; x: number; y: number; w: number; h: number }[] = [
    { id: "top_left", x: 2, y: 2, w: 32, h: 17 },
    { id: "top_center", x: 34, y: 2, w: 32, h: 17 },
    { id: "top_right", x: 66, y: 2, w: 32, h: 17 },
    { id: "middle_left", x: 2, y: 19, w: 32, h: 17 },
    { id: "middle_center", x: 34, y: 19, w: 32, h: 17 },
    { id: "middle_right", x: 66, y: 19, w: 32, h: 17 },
    { id: "bottom_left", x: 2, y: 36, w: 32, h: 17 },
    { id: "bottom_center", x: 34, y: 36, w: 32, h: 17 },
    { id: "bottom_right", x: 66, y: 36, w: 32, h: 17 },
  ];

  return (
    <div className="w-full">
      <div
        className="relative overflow-hidden rounded-lg border-2 border-slate-600 bg-slate-800"
        style={{ aspectRatio: "1.8/1" }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 55">
          {/* Goal frame */}
          <rect
            x="2"
            y="2"
            width="96"
            height="51"
            fill="none"
            stroke="rgba(239,68,68,0.6)"
            strokeWidth="2"
            rx="2"
          />

          {/* Zone heatmap */}
          {zones.map((zone) => {
            const stats = zoneStats[zone.id] || { saves: 0, goals: 0 };
            const total = stats.saves + stats.goals;
            const intensity = total / maxCount;
            const goalRate = total > 0 ? stats.goals / total : 0;

            // Color: green for saves, red for goals
            const color = showGoalsOnly
              ? `rgba(239, 68, 68, ${intensity * 0.7})`
              : showSavesOnly
              ? `rgba(34, 197, 94, ${intensity * 0.7})`
              : `rgba(${Math.round(goalRate * 239 + (1 - goalRate) * 34)}, ${Math.round(
                  (1 - goalRate) * 197 + goalRate * 68
                )}, ${Math.round((1 - goalRate) * 94 + goalRate * 68)}, ${intensity * 0.6})`;

            return (
              <g key={zone.id}>
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.w}
                  height={zone.h}
                  fill={color}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="0.5"
                />
                {total > 0 && (
                  <>
                    <text
                      x={zone.x + zone.w / 2}
                      y={zone.y + zone.h / 2 - 2}
                      fill="white"
                      fontSize="7"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {total}
                    </text>
                    <text
                      x={zone.x + zone.w / 2}
                      y={zone.y + zone.h / 2 + 6}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="5"
                      textAnchor="middle"
                    >
                      {((1 - goalRate) * 100).toFixed(0)}%
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
















