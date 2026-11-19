#!/usr/bin/env node
/**
 * Erzeugt Screenshots der laufenden App (docs/screenshots/).
 * Voraussetzung: `npm run build` + `npx vite preview --port 4818` läuft (oder BASE_URL setzen).
 *
 * Im Sandbox ohne Root: Chromium-Deps + Fonts via LD_LIBRARY_PATH/FONTCONFIG_FILE (siehe README "Screenshots").
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4818';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--force-color-profile=srgb'] });

async function newAppPage(viewport, dsf = 2) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.task-row', { timeout: 15000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}

// 1) Desktop hell: Mein Tag (Seed-Daten)
{
  const { ctx, page } = await newAppPage({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(OUT, 'desktop-myday.png') });
  console.log('desktop-myday.png');
  await ctx.close();
}

// 2) Desktop hell: Aufgaben-Detail geöffnet
{
  const { ctx, page } = await newAppPage({ width: 1440, height: 900 });
  await page.click('.task-row');
  await page.waitForSelector('.detail');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'desktop-detail.png') });
  console.log('desktop-detail.png');
  await ctx.close();
}

// 3) Desktop dunkel: Alle Aufgaben, eine Aufgabe abgehakt, Erledigt aufgeklappt
{
  const { ctx, page } = await newAppPage({ width: 1440, height: 900 });
  await page.click('.sidebar-head .icon-btn[title="Einstellungen"]');
  await page.waitForSelector('.modal select');
  await page.selectOption('.modal select', 'dark');
  await page.click('.modal button:has-text("Fertig")');
  await page.waitForTimeout(250);
  await page.click('button.nav-item:has-text("Alle Aufgaben")');
  await page.waitForTimeout(200);
  await page.click('.task-row .check');
  await page.waitForTimeout(200);
  await page.click('button.completed-toggle');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'desktop-dark.png') });
  console.log('desktop-dark.png');
  await ctx.close();
}

// 4) Mobile (iPhone-ähnlich): Mein Tag
{
  const { ctx, page } = await newAppPage({ width: 390, height: 844 }, 3);
  await page.screenshot({ path: path.join(OUT, 'mobile-myday.png') });
  console.log('mobile-myday.png');
  await ctx.close();
}

await browser.close();
console.log('Fertig:', OUT);
