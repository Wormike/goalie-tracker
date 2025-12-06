/**
 * Scraper pro zápasy z ceskyhokej.cz
 * 
 * Spuštění:
 *   npx ts-node scripts/scrape-matches.ts
 * 
 * Nebo s konkrétní soutěží:
 *   npx ts-node scripts/scrape-matches.ts --competition 24
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Browser, Page } from 'puppeteer';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ScrapedMatch {
  externalId: string;
  externalUrl: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  datetime: string;
  venue: string;
  category: string;
  completed: boolean;
}

const COMPETITIONS = [
  { id: '23', name: 'Starší žáci A', clubId: '115' },
  { id: '24', name: 'Starší žáci B', clubId: '115' },
  { id: '25', name: 'Mladší žáci A', clubId: '115' },
  { id: '26', name: 'Mladší žáci B', clubId: '115' },
];

async function waitForCloudflare(page: Page, maxWait: number = 60000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const content = await page.content();
    
    // Check if we're past Cloudflare
    if (!content.includes('Just a moment') && 
        !content.includes('Okamžik') && 
        !content.includes('challenge-platform') &&
        content.includes('game') || content.includes('zapas')) {
      console.log('   ✓ Cloudflare úspěšně projit');
      return true;
    }
    
    // Check for actual page content
    if (content.includes('gameListWidget') || content.includes('competition/games')) {
      console.log('   ✓ Obsah stránky detekován');
      return true;
    }
    
    await new Promise(r => setTimeout(r, 2000));
    console.log('   ⏳ Čekám na Cloudflare...');
  }
  
  return false;
}

async function scrapeCompetition(
  browser: Browser,
  competitionId: string,
  clubId: string,
  categoryName: string
): Promise<ScrapedMatch[]> {
  const page = await browser.newPage();
  
  // Set more realistic viewport and user agent
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Add extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  });
  
  const url = `https://www.ceskyhokej.cz/competition/games/${competitionId}?gameListWidget-filter%5Bclub%5D=${clubId}`;
  
  console.log(`📋 Načítám: ${categoryName}`);
  console.log(`   URL: ${url}`);
  
  try {
    // Navigate
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    // Wait for Cloudflare to pass
    const passed = await waitForCloudflare(page, 60000);
    
    if (!passed) {
      console.log('   ⚠️ Cloudflare timeout - zkouším pokračovat');
    }
    
    // Wait a bit more for content
    await new Promise(r => setTimeout(r, 3000));
    
    // Take screenshot for debugging
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    await page.screenshot({ path: path.join(dataDir, `debug-${competitionId}.png`), fullPage: true });
    console.log(`   📸 Screenshot uložen`);
    
    // Save HTML for debugging
    const html = await page.content();
    fs.writeFileSync(path.join(dataDir, `debug-${competitionId}.html`), html);
    
    // Log what selectors we can find
    const selectorCheck = await page.evaluate(() => {
      const selectors = [
        'table',
        'table tbody tr',
        '.game-list',
        '.game-row',
        '[data-component]',
        'a[href*="/game/"]',
        'a[href*="/zapas/"]',
        '.snippet--gamesList',
      ];
      
      const results: Record<string, number> = {};
      selectors.forEach(sel => {
        results[sel] = document.querySelectorAll(sel).length;
      });
      return results;
    });
    
    console.log('   📊 Nalezené elementy:', JSON.stringify(selectorCheck));
    
    // Extract matches
    const matches = await page.evaluate((category: string) => {
      const results: ScrapedMatch[] = [];
      
      // Try to find game links
      const gameLinks = document.querySelectorAll('a[href*="/game/"], a[href*="/zapas/"]');
      
      // Find rows that contain game data
      const rows = document.querySelectorAll('table tbody tr, .game-row, .game-item');
      
      rows.forEach((row, index) => {
        try {
          const text = row.textContent || '';
          const links = row.querySelectorAll('a[href*="/game/"], a[href*="/zapas/"]');
          
          // Skip if no useful content
          if (text.length < 10) return;
          
          // Extract teams - look for patterns like "Team A 3:2 Team B" or "Team A - Team B 3:2"
          let homeTeam = '';
          let awayTeam = '';
          let homeScore: number | null = null;
          let awayScore: number | null = null;
          let datetime = '';
          const venue = '';
          
          // Try to find team names from links
          const teamLinks = row.querySelectorAll('a[href*="/team/"], a[href*="/tym/"]');
          if (teamLinks.length >= 2) {
            homeTeam = teamLinks[0]?.textContent?.trim() || '';
            awayTeam = teamLinks[1]?.textContent?.trim() || '';
          }
          
          // Try to extract from cell structure
          const cells = row.querySelectorAll('td');
          cells.forEach((cell, cellIndex) => {
            const cellText = cell.textContent?.trim() || '';
            
            // Score pattern
            const scoreMatch = cellText.match(/^(\d+)\s*[:\-]\s*(\d+)$/);
            if (scoreMatch) {
              homeScore = parseInt(scoreMatch[1]);
              awayScore = parseInt(scoreMatch[2]);
            }
            
            // Date pattern
            const dateMatch = cellText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            if (dateMatch) {
              const [, day, month, year] = dateMatch;
              const timeMatch = cellText.match(/(\d{1,2}):(\d{2})/);
              const time = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '00:00';
              datetime = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00`;
            }
          });
          
          // If no teams from links, try text parsing
          if (!homeTeam || !awayTeam) {
            // Look for "vs" or "-" separator
            const vsMatch = text.match(/([A-Za-zÀ-ž\s]+?)\s*(?:vs?\.?\s*|[-–])\s*([A-Za-zÀ-ž\s]+?)(?:\s*\d|$)/i);
            if (vsMatch) {
              homeTeam = vsMatch[1].trim();
              awayTeam = vsMatch[2].trim();
            }
          }
          
          // Get match link
          const matchLink = links[0]?.getAttribute('href') || '';
          const matchIdMatch = matchLink.match(/\/(?:game|zapas)\/(\d+)/);
          const externalId = matchIdMatch ? matchIdMatch[1] : `row-${index}`;
          
          // Clean team names
          homeTeam = homeTeam.replace(/\s+/g, ' ').replace(/\d+[:\-]\d+/g, '').trim();
          awayTeam = awayTeam.replace(/\s+/g, ' ').replace(/\d+[:\-]\d+/g, '').trim();
          
          if (homeTeam && awayTeam && homeTeam.length >= 3 && awayTeam.length >= 3) {
            results.push({
              externalId,
              externalUrl: matchLink.startsWith('http') ? matchLink : `https://www.ceskyhokej.cz${matchLink}`,
              home: homeTeam,
              away: awayTeam,
              homeScore,
              awayScore,
              datetime,
              venue,
              category,
              completed: homeScore !== null && awayScore !== null,
            });
          }
        } catch (e) {
          // Skip problematic rows
        }
      });
      
      return results;
    }, categoryName);
    
    console.log(`   ✓ Nalezeno ${matches.length} zápasů`);
    
    await page.close();
    return matches;
    
  } catch (error) {
    console.error(`   ✗ Chyba: ${error}`);
    await page.close();
    return [];
  }
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let competitionFilter: string | null = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--competition' && args[i + 1]) {
      competitionFilter = args[i + 1];
    }
  }
  
  console.log('🏒 Goalie Tracker - Scraper zápasů (se stealth pluginem)');
  console.log('=========================================================\n');
  
  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser to solve Cloudflare manually if needed
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: null,
  });
  
  const allMatches: ScrapedMatch[] = [];
  
  const competitions = competitionFilter
    ? COMPETITIONS.filter(c => c.id === competitionFilter)
    : COMPETITIONS;
  
  for (const comp of competitions) {
    const matches = await scrapeCompetition(browser, comp.id, comp.clubId, comp.name);
    allMatches.push(...matches);
  }
  
  await browser.close();
  
  // Convert to app format
  const appMatches = allMatches.map(m => ({
    id: `imported-${m.externalId}`,
    externalId: m.externalId,
    externalUrl: m.externalUrl,
    home: m.home,
    away: m.away,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    datetime: m.datetime,
    venue: m.venue || undefined,
    category: m.category,
    matchType: 'league' as const,
    source: 'ceskyhokej' as const,
    completed: m.completed,
    seasonId: '2024-2025',
    manualStats: m.completed ? { shots: 0, saves: 0, goals: 0 } : undefined,
  }));
  
  // Save to file
  const outputPath = path.join(dataDir, 'scraped-matches.json');
  fs.writeFileSync(outputPath, JSON.stringify(appMatches, null, 2));
  
  console.log('\n=========================================================');
  console.log(`✓ Celkem nalezeno: ${allMatches.length} zápasů`);
  console.log(`✓ Uloženo do: ${outputPath}`);
  
  if (allMatches.length > 0) {
    console.log('\nPro import do aplikace použijte JSON import v aplikaci');
    console.log('a vložte obsah souboru scraped-matches.json');
  } else {
    console.log('\n⚠️ Žádné zápasy nebyly nalezeny.');
    console.log('   Možné důvody:');
    console.log('   - Cloudflare blokuje požadavek');
    console.log('   - Struktura stránky se změnila');
    console.log('   Zkontrolujte debug-*.html a debug-*.png soubory v data/');
  }
}

main().catch(console.error);
