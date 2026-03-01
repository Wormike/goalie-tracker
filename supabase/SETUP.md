# 🏒 Goalie Tracker - Nastavení Supabase

## Krok 1: Vytvoření projektu

1. Jdi na [supabase.com](https://supabase.com) a přihlas se (nebo vytvoř účet)
2. Klikni na **New Project**
3. Vyber organizaci a pojmenuj projekt (např. `goalie-tracker`)
4. Vyber region **EU (Frankfurt)** pro nejnižší latenci
5. Vytvoř **silné heslo** pro databázi (ulož si ho!)
6. Klikni **Create new project** a počkej ~2 minuty

## Krok 2: Vytvoření databázového schématu

1. V levém menu klikni na **SQL Editor**
2. Klikni na **New query**
3. Otevři soubor `supabase/schema.sql` z tohoto projektu
4. Zkopíruj celý obsah a vlož do SQL Editoru
5. Klikni **Run** (zelené tlačítko vpravo nahoře)
6. Mělo by se zobrazit "Success. No rows returned"

## Krok 3: Získání API klíčů

1. V levém menu jdi do **Project Settings** (ozubené kolečko dole)
2. Klikni na **API** (v sekci Configuration)
3. Najdi tyto hodnoty:
   - **Project URL** - např. `https://xyzabc123.supabase.co`
   - **anon public** key - dlouhý JWT token začínající `eyJhbGci...`

## Krok 4: Konfigurace aplikace

1. V kořenovém adresáři projektu vytvoř soubor `.env.local`:

```bash
# Zkopíruj hodnoty z Supabase Dashboard
NEXT_PUBLIC_SUPABASE_URL=https://xyzabc123.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...celý_token
```

2. Restartuj dev server:

```bash
# Ukonči běžící server (Ctrl+C) a spusť znovu
npm run dev
```

## Krok 5: Synchronizace dat

1. Otevři aplikaci v prohlížeči
2. Jdi do **Nastavení** (ozubené kolečko)
3. Najdi sekci **☁️ Cloudová databáze (Supabase)**
4. Klikni na **⬆️ Nahrát do cloudu**

Hotovo! 🎉 Tvá data jsou teď zálohovaná v cloudu.

---

## Troubleshooting

### "Supabase není nakonfigurován"
- Zkontroluj, že `.env.local` existuje v kořenu projektu
- Zkontroluj, že proměnné začínají `NEXT_PUBLIC_`
- Restartuj dev server po změně `.env.local`

### "Error: relation does not exist"
- Schema nebylo správně aplikováno - spusť znovu `schema.sql`

### "TypeError: Load failed"
- Zkontroluj připojení k internetu
- Ověř, že URL je správná (bez lomítka na konci)

---

## Struktura databáze

| Tabulka | Popis |
|---------|-------|
| `goalies` | Profily brankářů |
| `matches` | Zápasy |
| `goalie_events` | Střely, zákroky, góly |
| `teams` | Týmy |
| `competitions` | Soutěže |
| `seasons` | Sezóny |
| `goalie_stats` | Agregované statistiky (cache) |

---

## Bezpečnost

Pro jednoduchou aplikaci (jeden uživatel) můžeš nechat RLS vypnuté.

Pro multi-user aplikaci:
1. Povol Row Level Security na tabulkách
2. Přidej autentizaci (Supabase Auth)
3. Vytvoř policies pro řízení přístupu














