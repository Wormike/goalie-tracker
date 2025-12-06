"use client";

import React from "react";
import type { ShotPosition, ShotZone } from "@/lib/types";

interface MiniRinkSelectorProps {
  position?: ShotPosition;
  onSelect: (position: ShotPosition) => void;
  className?: string;
}

function getZoneFromCoords(x: number, y: number): ShotZone {
  if (y < 30) return "blue_line";
  if (y > 85) return "behind_goal";
  if (x < 30) return "left_wing";
  if (x > 70) return "right_wing";
  return "slot";
}

export function MiniRinkSelector({ position, onSelect, className = "" }: MiniRinkSelectorProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const zone = getZoneFromCoords(x, y);
    onSelect({ x, y, zone });
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className="relative cursor-crosshair overflow-hidden rounded-xl border-2 border-accentPrimary/40 bg-gradient-to-b from-blue-900/30 to-blue-950/60"
        style={{ aspectRatio: "1.2/1" }}
        onClick={handleClick}
      >
        {/* Ice rink markings */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
        >
          {/* Blue line */}
          <line
            x1="0"
            y1="25"
            x2="100"
            y2="25"
            stroke="rgba(59,130,246,0.5)"
            strokeWidth="1.5"
          />

          {/* Center line (red) */}
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="rgba(239,68,68,0.3)"
            strokeWidth="1"
          />

          {/* Center faceoff circle */}
          <circle
            cx="50"
            cy="50"
            r="8"
            fill="none"
            stroke="rgba(239,68,68,0.4)"
            strokeWidth="0.8"
          />

          {/* Zone labels (subtle) */}
          <text x="50" y="15" textAnchor="middle" fill="rgba(148,163,184,0.4)" fontSize="4">
            modrá čára
          </text>
          <text x="12" y="55" textAnchor="middle" fill="rgba(148,163,184,0.4)" fontSize="4" transform="rotate(-90 12 55)">
            levé křídlo
          </text>
          <text x="88" y="55" textAnchor="middle" fill="rgba(148,163,184,0.4)" fontSize="4" transform="rotate(90 88 55)">
            pravé křídlo
          </text>
          <text x="50" y="72" textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="5">
            slot
          </text>

          {/* Goal crease */}
          <path
            d="M 35 95 Q 50 78 65 95"
            fill="rgba(59,130,246,0.15)"
            stroke="rgba(59,130,246,0.4)"
            strokeWidth="1"
          />

          {/* Goal line */}
          <line
            x1="30"
            y1="95"
            x2="70"
            y2="95"
            stroke="rgba(239,68,68,0.4)"
            strokeWidth="1"
          />

          {/* Goal */}
          <rect
            x="40"
            y="96"
            width="20"
            height="4"
            rx="1"
            fill="rgba(239,68,68,0.5)"
            stroke="rgba(239,68,68,0.7)"
            strokeWidth="0.5"
          />
        </svg>

        {/* Selected position marker */}
        {position && (
          <div
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accentPrimary ring-2 ring-white shadow-lg"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
          >
            <div className="absolute inset-0 animate-ping rounded-full bg-accentPrimary/50" />
          </div>
        )}

        {/* Goalie indicator */}
        <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-xl">
          🥅
        </div>
      </div>

      {/* Zone indicator */}
      {position && (
        <div className="mt-2 text-center text-xs text-slate-400">
          Zóna: <span className="font-medium text-accentPrimary">{getZoneLabel(position.zone)}</span>
        </div>
      )}
      
      <p className="mt-1 text-center text-[10px] text-slate-500">
        Klepni na místo, odkud přišla střela
      </p>
    </div>
  );
}

function getZoneLabel(zone: ShotZone): string {
  const labels: Record<ShotZone, string> = {
    slot: "Slot",
    left_wing: "Levé křídlo",
    right_wing: "Pravé křídlo",
    blue_line: "Modrá čára",
    behind_goal: "Za brankou",
  };
  return labels[zone] || zone;
}

