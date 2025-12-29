"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Goalie, Match, MatchType, MatchStatus, Season, Team, Competition } from "@/lib/types";
import {
  getGoalies,
  getSeasons,
  getCurrentSeason,
  getTeams,
  getCompetitions,
  saveMatch,
  saveTeam,
} from "@/lib/storage";
import { Select, Combobox } from "@/components/ui/Select";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { createMatch as createMatchSupabase } from "@/lib/repositories/matches";

// Default team name for quick-fill
const DEFAULT_HOME_TEAM = "HC Slovan Ústí n.L.";

export default function NewMatchPage() {
  const router = useRouter();
  const [goalies, setGoalies] = useState<Goalie[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  
  const [form, setForm] = useState({
    homeTeamId: "",
    homeTeamName: "",
    away: "",
    competitionId: "",
    category: "",
    datetime: "",
    venue: "",
    matchType: "league" as MatchType,
    goalieId: "",
    seasonId: "",
  });

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setGoalies(getGoalies());
    const allSeasons = getSeasons();
    setSeasons(allSeasons);
    const allTeams = getTeams();
    setTeams(allTeams);
    setCompetitions(getCompetitions());
    
    // Use getCurrentSeason() for proper current season
    const currentSeason = getCurrentSeason();
    
    // Set default datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    
    // Find default home team
    const defaultTeam = allTeams.find(t => 
      t.name.includes("Slovan") || t.shortName?.includes("Slovan")
    );
    
    setForm((f) => ({
      ...f,
      seasonId: currentSeason.id,
      datetime: now.toISOString().slice(0, 16),
      homeTeamId: defaultTeam?.id || "",
      homeTeamName: defaultTeam?.name || DEFAULT_HOME_TEAM,
    }));
  }, []);

  // Filter competitions by selected season
  const filteredCompetitions = useMemo(() => {
    return competitions.filter((c) => c.seasonId === form.seasonId);
  }, [competitions, form.seasonId]);

  // Get unique categories from competitions
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    competitions.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats).sort();
  }, [competitions]);

  // Auto-select category from competition
  const handleCompetitionChange = (compId: string) => {
    const comp = competitions.find((c) => c.id === compId);
    setForm({
      ...form,
      competitionId: compId,
      category: comp?.category || form.category,
    });
  };

  // Handle team selection
  const handleHomeTeamChange = (teamId: string) => {
    if (teamId === "__new__") {
      setShowAddTeam(true);
      return;
    }
    const team = teams.find((t) => t.id === teamId);
    setForm({
      ...form,
      homeTeamId: teamId,
      homeTeamName: team?.name || "",
    });
  };

  // Add new team
  const handleAddTeam = () => {
    if (!newTeamName.trim()) return;
    
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: newTeamName.trim(),
      createdAt: new Date().toISOString(),
    };
    
    saveTeam(newTeam);
    setTeams(getTeams());
    setForm({
      ...form,
      homeTeamId: newTeam.id,
      homeTeamName: newTeam.name,
    });
    setShowAddTeam(false);
    setNewTeamName("");
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!form.homeTeamName.trim()) {
      newErrors.home = "Zadejte domácí tým";
    }
    if (!form.away.trim()) {
      newErrors.away = "Zadejte hostující tým";
    }
    if (!form.datetime) {
      newErrors.datetime = "Zadejte datum a čas";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    const payload = {
      home_team_id: form.homeTeamId || undefined,
      away_team_name: form.away,
      datetime: new Date(form.datetime).toISOString(),
      competition_id: form.competitionId || undefined,
      season_id: form.seasonId,
      venue: form.venue || undefined,
      match_type: form.matchType as "friendly" | "league" | "tournament" | "playoff" | "cup",
      status: "in_progress" as MatchStatus,
      goalie_id: form.goalieId || undefined,
    };

    if (isSupabaseConfigured()) {
      const created = await createMatchSupabase(payload);
      if (created) {
        router.push(`/match/${created.id}`);
        return;
      }
      // If Supabase fails, fall back to local
    }

    // Fallback to localStorage for offline / legacy
    const match: Match = {
      id: `match-${Date.now()}`,
      home: form.homeTeamName,
      away: form.away,
      homeTeamId: form.homeTeamId || undefined,
      category: form.category || "Přátelský zápas",
      competitionId: form.competitionId || undefined,
      datetime: payload.datetime,
      venue: payload.venue,
      matchType: form.matchType,
      goalieId: form.goalieId || undefined,
      seasonId: form.seasonId,
      status: "in_progress",
      completed: false,
      source: "manual",
      createdAt: new Date().toISOString(),
    };

    saveMatch(match);
    router.push(`/match/${match.id}`);
  };

  // Quick fill presets
  const quickFills = [
    { label: "Domácí", home: DEFAULT_HOME_TEAM, away: "" },
    { label: "Hosté", home: "", away: DEFAULT_HOME_TEAM },
  ];

  const matchTypes: { value: MatchType; label: string }[] = [
    { value: "league", label: "Soutěžní" },
    { value: "friendly", label: "Přátelský" },
    { value: "tournament", label: "Turnaj" },
    { value: "cup", label: "Pohár" },
  ];

  // Season options for Select
  const seasonOptions = seasons.map((s) => ({
    value: s.id,
    label: `${s.label || s.name}${s.isCurrent ? " ✓" : ""}`,
  }));

  // Competition options for Select
  const competitionOptions = [
    { value: "", label: "-- Bez soutěže --" },
    ...filteredCompetitions.map((c) => ({
      value: c.id,
      label: c.category,
    })),
  ];

  // Home team options for Select
  const homeTeamOptions = [
    ...teams.map((t) => ({
      value: t.id,
      label: t.shortName || t.name,
    })),
    { value: "__new__", label: "+ Přidat nový tým..." },
  ];

  // Auto-select first goalie if only one exists
  useEffect(() => {
    if (goalies.length === 1 && !form.goalieId) {
      setForm((f) => ({ ...f, goalieId: goalies[0].id }));
    }
  }, [goalies, form.goalieId]);

  return (
    <div className="flex min-h-screen flex-col bg-bgMain">
      <div className="flex items-center justify-between border-b border-borderSoft bg-bgSurfaceSoft px-4 py-3">
        <button onClick={() => router.back()} className="text-sm text-slate-300">
          ← Zpět
        </button>
        <h1 className="text-sm font-semibold">Nový zápas</h1>
        <div className="w-12" />
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-4 p-4">
        {/* Quick fill buttons */}
        <div className="flex gap-2">
          <span className="text-xs text-slate-500">Rychlá volba:</span>
          {quickFills.map((qf, i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  homeTeamName: qf.home || form.homeTeamName,
                  away: qf.away || form.away,
                })
              }
              className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-accentPrimary"
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* Match type */}
        <div>
          <label className="mb-2 block text-xs text-slate-400">Typ zápasu</label>
          <div className="grid grid-cols-4 gap-2">
            {matchTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setForm({ ...form, matchType: type.value })}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition-all ${
                  form.matchType === type.value
                    ? "border-accentPrimary bg-accentPrimary/20 text-accentPrimary"
                    : "border-borderSoft bg-slate-800 text-slate-300 hover:border-slate-600"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Season & Competition */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Sezóna"
            value={form.seasonId}
            onChange={(value) => setForm({ ...form, seasonId: value })}
            options={seasonOptions}
          />
          
          <Select
            label="Soutěž"
            value={form.competitionId}
            onChange={handleCompetitionChange}
            options={competitionOptions}
            placeholder="-- Bez soutěže --"
          />
        </div>

        {/* Home Team */}
        <div>
          <label className="mb-2 block text-xs text-slate-400">
            Domácí tým *
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                value={form.homeTeamId || "__custom__"}
                onChange={handleHomeTeamChange}
                options={[
                  ...(!form.homeTeamId
                    ? [{ value: "__custom__", label: form.homeTeamName || "Vlastní název..." }]
                    : []),
                  ...homeTeamOptions,
                ]}
              />
            </div>
          </div>
          {/* Show text input for custom name */}
          {!form.homeTeamId && (
            <input
              type="text"
              placeholder="Zadejte název týmu"
              value={form.homeTeamName}
              onChange={(e) => setForm({ ...form, homeTeamName: e.target.value })}
              className="mt-2 w-full rounded-xl border border-borderSoft bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accentPrimary focus:outline-none focus:ring-2 focus:ring-accentPrimary/20"
            />
          )}
          {errors.home && (
            <p className="mt-1 text-xs text-accentDanger">{errors.home}</p>
          )}
        </div>

        {/* Away Team */}
        <div>
          <label className="mb-2 block text-xs text-slate-400">
            Hostující tým *
          </label>
          <Combobox
            value={form.away}
            onChange={(value) => setForm({ ...form, away: value })}
            options={teams.map((t) => t.shortName || t.name)}
            placeholder="např. HC Litvínov"
            allowCreate
            createLabel="+ Použít vlastní"
          />
          {errors.away && (
            <p className="mt-1 text-xs text-accentDanger">{errors.away}</p>
          )}
        </div>

        {/* Category dropdown */}
        <Combobox
          label="Kategorie / Třída"
          value={form.category}
          onChange={(value) => setForm({ ...form, category: value })}
          options={availableCategories}
          placeholder="např. Starší žáci A, U13..."
          allowCreate
          createLabel="+ Přidat kategorii"
          disabled={!!form.competitionId}
        />

        {/* Date and time */}
        <div>
          <label className="mb-2 block text-xs text-slate-400">
            Datum a čas *
          </label>
          <input
            type="datetime-local"
            value={form.datetime}
            onChange={(e) => setForm({ ...form, datetime: e.target.value })}
            className="w-full rounded-xl border border-borderSoft bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-accentPrimary focus:outline-none focus:ring-2 focus:ring-accentPrimary/20"
          />
          {errors.datetime && (
            <p className="mt-1 text-xs text-accentDanger">{errors.datetime}</p>
          )}
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
            className="w-full rounded-xl border border-borderSoft bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accentPrimary focus:outline-none focus:ring-2 focus:ring-accentPrimary/20"
          />
        </div>

        {/* Goalie */}
        <div>
          <label className="mb-2 block text-xs text-slate-400">
            Přiřadit brankáře
          </label>
          {goalies.length === 0 ? (
            <div className="rounded-xl bg-accentPrimary/10 p-3 text-center">
              <p className="text-xs text-slate-400">
                Zatím nemáte žádné brankáře
              </p>
              <button
                type="button"
                onClick={() => router.push("/goalies")}
                className="mt-2 text-xs font-medium text-accentPrimary"
              >
                + Vytvořit brankáře →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {goalies.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setForm({ ...form, goalieId: g.id })}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                    form.goalieId === g.id
                      ? "bg-accentPrimary/20 ring-2 ring-accentPrimary"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      form.goalieId === g.id
                        ? "bg-accentPrimary text-white"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {g.jerseyNumber || g.firstName[0]}
                  </span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-slate-100">
                      {g.firstName} {g.lastName}
                    </div>
                    <div className="text-xs text-slate-500">{g.team}</div>
                  </div>
                  {form.goalieId === g.id && (
                    <span className="ml-auto text-accentPrimary">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-xl bg-slate-800 py-3 text-sm text-slate-300 transition-colors hover:bg-slate-700"
          >
            Zrušit
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white transition-colors hover:bg-accentPrimary/90"
          >
            Vytvořit zápas →
          </button>
        </div>
      </form>

      {/* Add Team Modal */}
      {showAddTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-bgSurfaceSoft p-5">
            <h3 className="mb-4 text-center font-semibold">Přidat nový tým</h3>
            <input
              type="text"
              placeholder="Název týmu"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="mb-4 w-full rounded-xl border border-borderSoft bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-accentPrimary focus:outline-none focus:ring-2 focus:ring-accentPrimary/20"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddTeam(false);
                  setNewTeamName("");
                }}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm text-slate-300"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleAddTeam}
                disabled={!newTeamName.trim()}
                className="flex-1 rounded-xl bg-accentPrimary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Přidat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
