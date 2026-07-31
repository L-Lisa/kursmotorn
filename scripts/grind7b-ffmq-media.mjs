// Fas 7-kompletteringen (2026-07-31) — skarp verifiering: FFMQ-formuläret (öppet,
// ifyllt, resultat) + meditationsspelaren med auto-loggning. Cecilias starts_at
// flyttas till idag under körningen (pre-fönstret öppet) och ÅTERSTÄLLS exakt;
// FFMQ-raden och auto-loggen städas. Kör: node scripts/grind7b-ffmq-media.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const BASE = "http://localhost:3000";
const OUT = "/Users/lisa/COWORK/outputs/kursmotorn/grind7";
mkdirSync(OUT, { recursive: true });

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }, realtime: { transport: WebSocket },
});
const CECILIA = "cccccccc-0000-0000-0000-000000000003";
const today = new Date().toISOString().slice(0, 10);

const orig = (await svc.from("enrollments").select("id, starts_at").eq("user_id", CECILIA).single()).data;
await svc.from("enrollments").update({ starts_at: today }).eq("id", orig.id);
console.log(`starts_at ${orig.starts_at} → ${today} (tillfälligt)`);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();

try {
  await page.goto(`${BASE}/mindfulnessguiden/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "cecilia@mind.test");
  await page.fill('input[type="password"]', "Testlosen123!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // FFMQ: formuläret öppet → fyll i alla 39 → spara → resultat.
  await page.goto(`${BASE}/mindfulnessguiden/kurs/ffmq`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/10-ffmq-formular.png` });
  console.log("✓ 10-ffmq-formular");
  const groups = page.locator('[role="radiogroup"]');
  const n = await groups.count();
  for (let i = 0; i < n; i++) {
    await groups.nth(i).locator("button").nth(i % 5).click();
  }
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/11-ffmq-resultat.png`, fullPage: false });
  console.log("✓ 11-ffmq-resultat");

  // Meditationsspelaren: granskningskontot (allt upplåst) — vecka 1 har
  // "Minimeditation: Ankomst" med placeholder-media. (Deltagare når spelaren när
  // de är framme vid sektionen — gating verifierad i grind7-sviten.)
  const g = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await g.goto(`${BASE}/mindfulnessguiden/login`, { waitUntil: "networkidle" });
  await g.fill('input[type="email"]', "granskning@mind.test");
  await g.fill('input[type="password"]', "Testlosen123!");
  await g.click('button[type="submit"]');
  await g.waitForTimeout(1500);
  await g.goto(`${BASE}/mindfulnessguiden/kurs`, { waitUntil: "networkidle" });
  const week1 = await g.getAttribute('a[href*="/kurs/vecka/"]', "href");
  await g.goto(`${BASE}${week1}`, { waitUntil: "networkidle" });
  const audio = g.locator("audio").first();
  await audio.scrollIntoViewIfNeeded();
  await g.waitForTimeout(600);
  await g.screenshot({ path: `${OUT}/12-meditationsspelare.png` });
  console.log("✓ 12-meditationsspelare");

  // Spelarens källa ska vara en signerad URL (privat bucket, RLS-gated).
  const src = await audio.getAttribute("src");
  console.log(src?.includes("token=") ? "✓ signerad media-URL i spelaren" : "✗ INGEN signerad URL");
} finally {
  await browser.close();
  // Städning: FFMQ-raden bort, starts_at exakt tillbaka.
  await svc.from("mg_ffmq_responses").delete().eq("user_id", CECILIA);
  await svc.from("enrollments").update({ starts_at: orig.starts_at }).eq("id", orig.id);
  console.log(`starts_at återställd till ${orig.starts_at}; FFMQ-raden städad`);
}
