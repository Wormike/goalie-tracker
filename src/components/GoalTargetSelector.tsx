"use client";

import React from "react";
import type { ShotTargetZone } from "@/lib/types";

interface GoalTargetSelectorProps {
  selected?: ShotTargetZone;
  onSelect: (zone: ShotTargetZone) => void;
  catchHand?: "L" | "R"; // Goalie's catching hand for correct labeling
  className?: string;
  showLabels?: boolean;
}

// Goal zones from goalie's perspective looking out at the shooter
// For right-handed goalie (catches with left hand):
//   Glove side = goalie's left = shooter's right
//   Blocker side = goalie's right = shooter's left
const ZONES: { zone: ShotTargetZone; labelShort: string; gridArea: string; labelFull: string }[] = [
  { zone: "high_glove", labelFull: "Horní lapačka", labelShort: "H-L", gridArea: "1 / 1" },
  { zone: "high_center", labelFull: "Horní střed", labelShort: "H-S", gridArea: "1 / 2" },
  { zone: "high_blocker", labelFull: "Horní vyrážečka", labelShort: "H-V", gridArea: "1 / 3" },
  { zone: "low_glove", labelFull: "Dolní lapačka", labelShort: "D-L", gridArea: "2 / 1" },
  { zone: "five_hole", labelFull: "Mezi betony", labelShort: "5H", gridArea: "2 / 2" },
  { zone: "low_blocker", labelFull: "Dolní vyrážečka", labelShort: "D-V", gridArea: "2 / 3" },
  { zone: "low_center", labelFull: "Spodní střed", labelShort: "D-S", gridArea: "3 / 2" },
];

export function GoalTargetSelector({
  selected,
  onSelect,
  catchHand = "L", // Default: left-handed catch (right-handed goalie)
  className = "",
  showLabels = true,
}: GoalTargetSelectorProps) {
  // Mirror zones if goalie is left-handed (catches with right hand)
  const zones = catchHand === "R" 
    ? ZONES.map(z => ({
        ...z,
        gridArea: z.gridArea.includes("/ 1") 
          ? z.gridArea.replace("/ 1", "/ 3")
          : z.gridArea.includes("/ 3")
          ? z.gridArea.replace("/ 3", "/ 1")
          : z.gridArea,
      }))
    : ZONES;

  return (
    <div className={`relative ${className}`}>
      {/* Goal frame */}
      <div className="relative rounded-lg border-4 border-red-600 bg-gradient-to-b from-slate-800 to-slate-900 p-1">
        {/* Cross bar */}
        <div className="absolute -top-1 left-0 right-0 h-2 rounded-t bg-red-600" />
        
        {/* Posts */}
        <div className="absolute -bottom-1 -left-1 top-0 w-2 rounded-l bg-red-600" />
        <div className="absolute -bottom-1 -right-1 top-0 w-2 rounded-r bg-red-600" />

        {/* Net pattern */}
        <div 
          className="absolute inset-2 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px),
              linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "12px 12px",
          }}
        />

        {/* Zone grid */}
        <div 
          className="relative grid gap-1"
          style={{
            gridTemplateColumns: "1fr 1fr 1fr",
            gridTemplateRows: "1fr 1fr 0.5fr",
            aspectRatio: "1.5/1",
            minHeight: "120px",
          }}
        >
          {zones.map(({ zone, labelShort, gridArea }) => (
            <button
              key={zone}
              type="button"
              onClick={() => onSelect(zone)}
              style={{ gridArea }}
              className={`
                relative flex flex-col items-center justify-center rounded-md 
                transition-all duration-150
                ${
                  selected === zone
                    ? "bg-accentPrimary/40 ring-2 ring-accentPrimary shadow-lg"
                    : "bg-slate-700/50 hover:bg-slate-600/50"
                }
              `}
            >
              {/* Zone marker */}
              <div
                className={`
                  h-3 w-3 rounded-full transition-all
                  ${
                    selected === zone
                      ? "bg-accentPrimary ring-2 ring-white"
                      : "bg-slate-500"
                  }
                `}
              />
              {showLabels && (
                <span className="mt-1 text-[8px] font-medium text-slate-300">
                  {labelShort}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Five hole emphasis */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] text-slate-500">
          ▼
        </div>
      </div>

      {/* Selected zone label */}
      {selected && showLabels && (
        <div className="mt-2 text-center text-xs text-slate-400">
          <span className="font-medium text-accentPrimary">
            {ZONES.find(z => z.zone === selected)?.labelFull || selected}
          </span>
        </div>
      )}

      {/* Off target option */}
      <button
        type="button"
        onClick={() => onSelect("off_target")}
        className={`
          mt-2 w-full rounded-lg border px-3 py-2 text-xs transition-all
          ${
            selected === "off_target"
              ? "border-accentNeutral bg-accentNeutral/20 text-accentNeutral"
              : "border-borderSoft bg-slate-800 text-slate-400 hover:bg-slate-700"
          }
        `}
      >
        ○ Mimo branku
      </button>
    </div>
  );
}

// Compact version for inline use
interface GoalTargetBadgeProps {
  zone?: ShotTargetZone;
  size?: "sm" | "md";
}

export function GoalTargetBadge({ zone, size = "sm" }: GoalTargetBadgeProps) {
  if (!zone) return null;

  const zoneInfo = ZONES.find(z => z.zone === zone);
  const label = zone === "off_target" ? "Mimo" : zoneInfo?.labelShort || zone;

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
  };

  return (
    <span
      className={`
        inline-flex items-center rounded font-medium
        ${sizeClasses[size]}
        ${zone === "off_target" ? "bg-slate-600 text-slate-300" : "bg-accentPrimary/20 text-accentPrimary"}
      `}
    >
      {label}
    </span>
  );
}

