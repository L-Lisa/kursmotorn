// GRIND 2 — skärmdumpsloop (../brand.md-processen). Fångar samma vy i båda
// tenants + motor-admin/login för jämförelse mot styleprovet riktning-ab-kombinerad.html.
// Kör: node scripts/grind2-screenshots.mjs   (kräver dev-servern på :3000)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT =
  "/Users/lisa/COWORK/outputs/kursmotorn/grind2";
mkdirSync(OUT, { recursive: true });

const LISA = { email: "lisa@kursmotorn.test", password: "Testlosen123!" };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

async function shot(path, name) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600); // fontladdning
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`✓ ${name}  (${path})`);
}

// ── Utloggat: motor-login + båda publika landningssidorna ──
await shot("/login", "01-motor-login");
await shot("/andningskursen", "02-andning-landing");
await shot("/mindfulnessguiden", "03-mg-landing");

// ── Logga in som Lisa (plattformsadmin, medlem i båda) ──
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', LISA.email);
await page.fill('input[type="password"]', LISA.password);
await page.click('button[type="submit"]');
await page.waitForURL("**/admin", { timeout: 15000 });
console.log("✓ inloggad som Lisa");

// ── Inloggat: motor-admin + samma kursvy i båda tenants ──
await shot("/admin", "04-motor-admin");
await shot("/andningskursen/kurs", "05-andning-kurs");
await shot("/mindfulnessguiden/kurs", "06-mg-kurs");

await browser.close();
console.log("\nKlart. PNG:er i", OUT);
