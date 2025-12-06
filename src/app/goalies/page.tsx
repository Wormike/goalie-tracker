"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Goalie } from "@/lib/types";
import { getGoalies, saveGoalie, deleteGoalie, calculateGoalieStats } from "@/lib/storage";

export default function GoaliesPage() {
  const router = useRouter();
  const [goalies, setGoalies] = useState<Goalie[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGoalie, setEditingGoalie] = useState<Goalie | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    birthYear: new Date().getFullYear() - 10,
    team: "",
    jerseyNumber: "",
  });

  useEffect(() => {
    setGoalies(getGoalies());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const goalie: Goalie = {
      id: editingGoalie?.id || `goalie-${Date.now()}`,
      firstName: form.firstName,
      lastName: form.lastName,
      birthYear: form.birthYear,
      team: form.team,
      jerseyNumber: form.jerseyNumber ? parseInt(form.jerseyNumber) : undefined,
      createdAt: editingGoalie?.createdAt || new Date().toISOString(),
    };
    saveGoalie(goalie);
    setGoalies(getGoalies());
    resetForm();
  };

  const resetForm = () => {
    setForm({
      firstName: "",
      lastName: "",
      birthYear: new Date().getFullYear() - 10,
      team: "",
      jerseyNumber: "",
    });
    setEditingGoalie(null);
    setShowForm(false);
  };

  const handleEdit = (goalie: Goalie) => {
    setForm({
      firstName: goalie.firstName,
      lastName: goalie.lastName,
      birthYear: goalie.birthYear,
      team: goalie.team,
      jerseyNumber: goalie.jerseyNumber?.toString() || "",
    });
    setEditingGoalie(goalie);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Opravdu smazat tohoto brankáře?")) {
      deleteGoalie(id);
      setGoalies(getGoalies());
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bgMain">
      <div className="flex items-center justify-between border-b border-borderSoft bg-bgSurfaceSoft px-4 py-3">
        <button onClick={() => router.back()} className="text-sm text-slate-300">
          ← Zpět
        </button>
        <h1 className="text-sm font-semibold">Brankáři</h1>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs text-accentPrimary"
        >
          + Přidat
        </button>
      </div>

      {showForm && (
        <div className="border-b border-borderSoft bg-bgSurfaceSoft p-4">
          <h2 className="mb-4 text-sm font-semibold">
            {editingGoalie ? "Upravit brankáře" : "Nový brankář"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Jméno"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                required
              />
              <input
                type="text"
                placeholder="Příjmení"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Rok narození"
                value={form.birthYear}
                onChange={(e) =>
                  setForm({ ...form, birthYear: parseInt(e.target.value) })
                }
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                required
              />
              <input
                type="text"
                placeholder="Číslo dresu"
                value={form.jerseyNumber}
                onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <input
              type="text"
              placeholder="Tým (např. HC Slovan Ústí n.L.)"
              value={form.team}
              onChange={(e) => setForm({ ...form, team: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              required
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-lg bg-slate-700 py-2 text-sm text-slate-300"
              >
                Zrušit
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-accentPrimary py-2 text-sm font-semibold text-white"
              >
                {editingGoalie ? "Uložit" : "Vytvořit"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 p-4">
        {goalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 text-4xl">🥅</div>
            <p className="text-sm text-slate-400">Zatím žádní brankáři</p>
            <p className="mt-1 text-xs text-slate-500">
              Přidejte prvního brankáře pomocí tlačítka nahoře
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {goalies.map((goalie) => {
              const stats = calculateGoalieStats(goalie.id);
              return (
                <div
                  key={goalie.id}
                  className="rounded-2xl bg-bgSurfaceSoft p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accentPrimary/20 text-lg font-bold text-accentPrimary">
                        {goalie.jerseyNumber || goalie.firstName[0]}
                      </div>
                      <div>
                        <div className="font-semibold">
                          {goalie.firstName} {goalie.lastName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {goalie.team} • nar. {goalie.birthYear}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(goalie)}
                        className="text-xs text-slate-400"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(goalie.id)}
                        className="text-xs text-accentDanger"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="font-bold text-slate-50">{stats.gamesPlayed}</div>
                      <div className="text-slate-500">Zápasů</div>
                    </div>
                    <div>
                      <div className="font-bold text-accentSuccess">{stats.totalSaves}</div>
                      <div className="text-slate-500">Zákroků</div>
                    </div>
                    <div>
                      <div className="font-bold text-accentDanger">{stats.totalGoals}</div>
                      <div className="text-slate-500">Gólů</div>
                    </div>
                    <div>
                      <div className="font-bold text-accentPrimary">
                        {stats.savePercentage.toFixed(1).replace(".", ",")}%
                      </div>
                      <div className="text-slate-500">Úsp.</div>
                    </div>
                  </div>

                  <Link
                    href={`/goalies/${goalie.id}`}
                    className="mt-3 block text-center text-xs text-accentPrimary"
                  >
                    Zobrazit detail a statistiky →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

