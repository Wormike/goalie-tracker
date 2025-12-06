# 🥅 Goalie Tracker

Aplikace pro live tracking statistik hokejových brankářů během zápasu.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-cyan)

## ✨ Funkce

### 🎯 Live Tracking
- Zaznamenávání střel a zákroků v reálném čase
- Vizualizace místa střely na kluzišti
- Sledování místa zásahu na brance
- Rozlišení situací (5v5, přesilovka, oslabení)
- Podpora pro všechny třetiny včetně prodloužení

### 📊 Statistiky
- Automatický výpočet save % 
- Rozdělení podle třetin a situací
- Heatmapy střel na kluzišti
- Heatmapy zásahů na brance
- Porovnání více brankářů

### 📱 Mobile-First Design
- Optimalizováno pro použití během zápasu
- Landscape mód pro pohodlné ovládání palcem
- Velká dotyková tlačítka pro rychlé zadávání

### 🔄 Import & Export
- Import zápasů z ceskyhokej.cz
- Export/Import dat pro zálohu
- Podpora pro offline použití (localStorage)

## 🚀 Spuštění

```bash
# Instalace závislostí
npm install

# Spuštění vývojového serveru
npm run dev

# Build pro produkci
npm run build
```

Otevřete [http://localhost:3000](http://localhost:3000) v prohlížeči.

## 📖 Použití

### Vytvoření nového zápasu
1. Na hlavní stránce klikněte na **"+ Nový zápas"**
2. Vyplňte informace o zápase (týmy, datum, soutěž)
3. Přiřaďte brankáře
4. Klikněte na **"Vytvořit zápas"**

### Live Tracking
1. Otevřete zápas kliknutím na jeho kartu
2. Použijte rychlá tlačítka (Zákrok/Gól/Mimo) pro základní záznam
3. Nebo klikněte na kluziště pro přesné označení místa střely
4. V detailním dialogu vyberte:
   - Výsledek (zákrok/gól/mimo)
   - Typ zákroku/gólu
   - Situaci (5v5/PP/SH)
   - Místo na brance

### Landscape mód
Na mobilních zařízeních je dostupný speciální režim pro pohodlné ovládání na šířku:
1. Klikněte na tlačítko **"Otočit na šířku"**
2. Klepnutím na kluziště vyberte pozici střely
3. Velká tlačítka umožní rychlý výběr výsledku

### Import zápasů
Aplikace podporuje import zápasů z webu **ustecky.ceskyhokej.cz**:
1. Klikněte na **"Import z webu"**
2. Vyberte kategorii (Starší žáci A/B, Mladší žáci A/B)
3. Postupujte krokovým wizardem
4. Zápasy budou automaticky importovány

### Export & záloha dat
1. Přejděte do **Nastavení** (ikona ⚙️ v dolní části)
2. Klikněte na **"Export & Import"**
3. Stáhněte JSON soubor se všemi daty
4. Pro obnovení použijte záložku **Import**

### Sdílení statistik
Po zápase můžete sdílet statistiky:
1. V detailu zápasu (tracking tab)
2. Klikněte na **"Sdílet statistiky zápasu"**
3. Statistiky se zkopírují nebo sdílejí přes systémové sdílení

## 🏗️ Architektura

### Adresářová struktura
```
src/
├── app/                    # Next.js App Router stránky
│   ├── page.tsx           # Hlavní stránka (seznam zápasů)
│   ├── match/[id]/        # Detail zápasu + tracking
│   ├── matches/new/       # Vytvoření nového zápasu
│   ├── goalies/           # Správa brankářů
│   ├── stats/             # Porovnání brankářů
│   ├── settings/          # Nastavení aplikace
│   └── api/               # API routes
├── components/            # React komponenty
│   ├── RinkView.tsx       # Vizualizace kluziště
│   ├── ActionBar.tsx      # Rychlá tlačítka
│   ├── EventModal.tsx     # Dialog pro detaily události
│   ├── EventListModal.tsx # Seznam všech událostí
│   └── ...
├── lib/
│   ├── types.ts           # TypeScript definice
│   ├── storage.ts         # localStorage persistence
│   └── utils.ts           # Pomocné funkce
└── hooks/
    └── useOrientation.ts  # Hook pro detekci orientace
```

### Datový model

#### Match (Zápas)
- Domácí/hostující tým
- Datum, místo, kategorie
- Status (otevřený/uzavřený)
- Přiřazený brankář
- Skóre a manuální statistiky

#### GoalieEvent (Událost)
- Výsledek (zákrok/gól/mimo)
- Pozice na kluzišti
- Pozice na brance
- Třetina a herní čas
- Situace (5v5/PP/SH)

#### Goalie (Brankář)
- Jméno, číslo dresu
- Tým, ročník narození
- Statistiky za sezónu

## 🛠️ Technologie

- **Next.js 14** - React framework s App Router
- **TypeScript** - Typová bezpečnost
- **Tailwind CSS 4** - Utility-first CSS
- **Cheerio** - HTML parsing pro import
- **localStorage** - Offline persistence

## 📝 License

MIT

## 👥 Autoři

Vytvořeno pro sledování statistik mládežnických hokejových brankářů.
