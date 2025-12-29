"use client";

interface LiveStatsBarProps {
  shots: number;
  saves: number;
  goals: number;
}

export function LiveStatsBar({ shots, saves, goals }: LiveStatsBarProps) {
  const savePct =
    shots > 0 ? ((saves / shots) * 100).toFixed(1).replace(".", ",") : "0,0";

  return (
    <div className="border-b border-borderSoft bg-bgSurfaceSoft px-4 py-3">
      <div className="grid grid-cols-4 gap-2 text-center text-xs text-slate-400">
        <div>
          <div className="text-lg font-bold text-slate-50">{shots}</div>
          <div>Střely</div>
        </div>
        <div>
          <div className="text-lg font-bold text-accentSuccess">{saves}</div>
          <div>Zákroky</div>
        </div>
        <div>
          <div className="text-lg font-bold text-accentDanger">{goals}</div>
          <div>Góly</div>
        </div>
        <div>
          <div className="text-lg font-bold text-accentPrimary">
            {savePct}%
          </div>
          <div>Úspěšnost</div>
        </div>
      </div>
    </div>
  );
}








