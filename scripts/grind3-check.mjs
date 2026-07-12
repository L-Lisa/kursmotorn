// GRIND 3 — driv kursvyn som Anna: gating + avbockning i riktiga appen.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/Users/lisa/COWORK/outputs/kursmotorn/grind3";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1280, height: 1200 }, deviceScaleFactor: 2 }).then((c) => c.newPage());

// Login som Anna (deltagare, tenant 1)
await page.goto(`${BASE}/andningskursen/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "anna@andning.test");
await page.fill('input[type="password"]', "Testlosen123!");
await page.click('button[type="submit"]');
await page.waitForURL("**/kurs", { timeout: 15000 });
await page.waitForTimeout(600);

// Räkna låsta rader före
const lockedBefore = await page.locator("text=Låst").count();
await page.screenshot({ path: `${OUT}/01-kurs-start.png`, fullPage: true });
console.log(`✓ kursvy laddad · ${lockedBefore} låsta sektioner före avbockning`);

// Bocka av första sektionen (första aktiverbara ✓-knappen)
const firstCheck = page.locator('button[aria-label="Bocka av sektionen"]').first();
await firstCheck.click();
await page.waitForTimeout(900); // revalidate
const lockedAfter = await page.locator("text=Låst").count();
await page.screenshot({ path: `${OUT}/02-kurs-efter-avbockning.png`, fullPage: true });
console.log(`✓ efter avbockning · ${lockedAfter} låsta sektioner (ska vara EN färre = nästa öppnades)`);

console.log(lockedAfter === lockedBefore - 1 ? "\nGATING OK: avbockning öppnade exakt nästa sektion." : `\nOBS: låsta gick ${lockedBefore}→${lockedAfter}`);
await browser.close();
