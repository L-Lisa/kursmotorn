// GRIND 4 — driv prov-motorn i riktiga appen som Anna.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/Users/lisa/COWORK/outputs/kursmotorn/grind4";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 }).then((c) => c.newPage());

await page.goto(`${BASE}/andningskursen/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "anna@andning.test");
await page.fill('input[type="password"]', "Testlosen123!");
await page.click('button[type="submit"]');
await page.waitForURL("**/kurs", { timeout: 15000 });
await page.waitForTimeout(500);

// Prov-blocket syns?
await page.locator("text=Prov").first().scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/01-prov-block.png`, fullPage: true });
const provLinks = await page.locator('a:has-text("Ta provet")').count();
console.log(`✓ Prov-block · ${provLinks} prov att ta`);

// Ta ett modul-prov (första "Ta provet")
await page.locator('a:has-text("Ta provet")').first().click();
await page.waitForURL("**/prov/**", { timeout: 15000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/02-prov-fragor.png`, fullPage: true });

// Svara på alla frågor (första alternativet på varje) → lämna in
const fieldsets = await page.locator("fieldset").count();
for (let i = 0; i < fieldsets; i++) {
  await page.locator("fieldset").nth(i).locator('input[type="radio"]').first().check();
}
console.log(`✓ ${fieldsets} frågor besvarade`);
await page.click('button:has-text("Lämna in provet")');
await page.waitForSelector("text=Resultat", { timeout: 15000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/03-prov-resultat.png`, fullPage: true });

const resultText = await page.locator("text=Resultat").locator("..").innerText();
console.log("✓ Resultat visat:", resultText.replace(/\n/g, " ").slice(0, 80));

await browser.close();
