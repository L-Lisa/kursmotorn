// GRIND 5 — skärmdumpar av certifieringsflödet (breathworks-beviset).
// Fångar intyg-vyn (kravtrion + utfärdat certifikat) + den publika verifieringssidan,
// i Andningskursens varumärke. Kör EFTER att Anna har fullbordat + utfärdat sitt
// certifikat (regressionssviten test:certification är den reproducerbara proofen;
// dessa PNG:er är den visuella noteringen). Kör: node scripts/grind5-screenshots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/Users/lisa/COWORK/outputs/kursmotorn/grind5";
mkdirSync(OUT, { recursive: true });

const ANNA = { email: "anna@andning.test", password: "Testlosen123!" };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`✓ ${name}`);
}

// Logga in som Anna (deltagare, tenant #1).
await page.goto(`${BASE}/andningskursen/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', ANNA.email);
await page.fill('input[type="password"]', ANNA.password);
await page.click('button[type="submit"]');
await page.waitForURL("**/andningskursen/kurs", { timeout: 15000 });
console.log("✓ inloggad som Anna");

// Intyg-vyn (kravtrion + utfärdat certifikat i Andningskursens brand).
await page.goto(`${BASE}/andningskursen/kurs/intyg`, { waitUntil: "networkidle" });
await shot("01-intyg-utfardat");

// Publik verifieringssida — följ "Öppna verifieringssidan"-länken.
const href = await page.getAttribute('a[href^="/verify/"]:not([href$="/pdf"])', "href");
if (href) {
  await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await shot("02-verify-giltigt");
} else {
  console.log("⚠ hittade ingen verify-länk (har Anna ett utfärdat certifikat?)");
}

await browser.close();
console.log("\nKlart. PNG:er i", OUT);
