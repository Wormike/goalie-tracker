"use client";

type ActionBarProps = {
  onSave: () => void;
  onGoal: () => void;
  onMiss: () => void;
};

export function ActionBar({ onSave, onGoal, onMiss }: ActionBarProps) {
  return (
    <div className="border-t border-borderSoft bg-bgSurfaceSoft px-4 pb-4 pt-2">
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={onSave}
          className="rounded-xl border-2 border-accentSuccess bg-accentSuccess/15 py-3 text-sm font-bold text-accentSuccess active:scale-95"
        >
          ✓ ZÁKROK
        </button>
        <button
          onClick={onGoal}
          className="rounded-xl border-2 border-accentDanger bg-accentDanger/15 py-3 text-sm font-bold text-accentDanger active:scale-95"
        >
          ✕ GÓL
        </button>
        <button
          onClick={onMiss}
          className="rounded-xl border-2 border-borderSoft bg-slate-700/40 py-3 text-sm font-bold text-slate-200 active:scale-95"
        >
          ○ MIMO
        </button>
      </div>
    </div>
  );
}














