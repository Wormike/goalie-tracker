"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Goalie, Match, MatchType, Season } from "@/lib/types";
import { getGoalies, getSeasons, getActiveSeason, saveMatch } from "@/lib/storage";

export default function NewMatchPage() {
  const router = useRouter();
  const [goalies, setGoalies] = useState<Goalie[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [form, setForm] = useState({
    home: "",
    away: "",
    category: "",
    datetime: "",
    venue: "",
    matchType: "friendly" as MatchType,
    goalieId: "",
    seasonId: "",
  });

  useEffect(() => {
    setGoalies(getGoalies());
    const allSeasons = getSeasons();
    setSeasons(allSeasons);
    const activeSeason = getActiveSeason();
    setForm((f) => ({ ...f, seasonId: activeSeason.id }));
    
    // Set default datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setForm((f) => ({
      ...f,
      datetime: now.toISOString().slice(0, 16),
    }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const match: Match = {
      id: `match-${Date.now()}`,
      home: form.home,
      away: form.away,
      category: form.category || "Přátelský zápas",
      datetime: new Date(form.datetime).toISOString(),
      venue: form.venue || undefined,
      matchType: form.matchType,
      goalieId: form.goalieId || undefined,
      seasonId: form.seasonId,
      completed: false,
    };

    saveMatch(match);
    router.push(`/match/${match.id}`);
  };

  const matchTypes: { value: MatchType; label: string }[] = [
    { value: "friendly", label: "Přátelský" },
    { value: "league", label: "Soutěžní" },
    { value: "tournament", label: "Turnaj" },
    { value: "cup", label: "Pohár" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bgMain">
      <div className="flex items-center justify-between border-b border-borderSoft bg-bgSurfaceSoft px-4 py-3">
        <button onClick={() => router.back()} className="text-sm text-slate-300">
          ← Zpět
        </button>
        <h1 className="text-sm font-semibold">Nový zápas</h1>
        <div className="w-12" />
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-4">
        <div className="space-y-4">
          {/* Match type */}
          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Typ zápasu
            </label>
            <div className="grid grid-cols-4 gap-2">
              {matchTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm({ ...form, matchType: type.value })}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                    form.matchType === type.value
                      ? "border-accentPrimary bg-accentPrimary/20 text-accentPrimary"
                      : "border-borderSoft bg-slate-800 text-slate-300"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Teams */}
          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Domácí tým *
            </label>
            <input
              type="text"
              placeholder="např. HC Slovan Ústí n.L."
              value={form.home}
              onChange={(e) => setForm({ ...form, home: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Hostující tým *
            </label>
            <input
              type="text"
              placeholder="např. HC Litvínov"
              value={form.away}
              onChange={(e) => setForm({ ...form, away: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Kategorie / Třída
            </label>
            <input
              type="text"
              placeholder="např. 7. třída, U13, starší žáci..."
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>

          {/* Date and time */}
          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Datum a čas *
            </label>
            <input
              type="datetime-local"
              value={form.datetime}
              onChange={(e) => setForm({ ...form, datetime: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100"
              required
            />
          </div>

          {/* Venue */}
          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Místo konání
            </label>
            <input
              type="text"
              placeholder="např. ZS Ústí nad Labem"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>

          {/* Goalie */}
          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Přiřadit brankáře
            </label>
            {goalies.length === 0 ? (
              <div className="rounded-lg bg-slate-800/50 p-3 text-center">
                <p className="text-xs text-slate-500">
                  Zatím nemáte žádné brankáře
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/goalies")}
                  className="mt-2 text-xs text-accentPrimary"
                >
                  Vytvořit brankáře →
                </button>
              </div>
            ) : (
              <select
                value={form.goalieId}
                onChange={(e) => setForm({ ...form, goalieId: e.target.value })}
                className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100"
              >
                <option value="">-- Vybrat brankáře --</option>
                {goalies.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.firstName} {g.lastName} ({g.team})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Season */}
          <div>
            <label className="mb-2 block text-xs text-slate-400">Sezóna</label>
            <select
              value={form.seasonId}
              onChange={(e) => setForm({ ...form, seasonId: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? "(aktivní)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-xl bg-slate-800 py-3 text-sm text-slate-300"
          >
            Zrušit
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white"
          >
            Vytvořit a začít tracking
          </button>
        </div>
      </form>
    </div>
  );
}

