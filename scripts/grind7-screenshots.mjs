// GRIND 7 — klickbar verifiering + skärmdumpar (MG fas A i Stilla kraft).
// Granskningskontot läser kursen vecka för vecka (ordagrannheten bevisas av
// test:mg:s tecken-för-tecken-diff — stickprovet här är den visuella noteringen);
// Cecilia (deltagare) loggar praxisdag + guidesession; Lisa ser admin-kolumnen.
// Kör: node scripts/grind7-screenshots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/Users/lisa/COWORK/outputs/kursmotorn/grind7";
mkdirSync(OUT, { recursive: true });

const PW = "Testlosen123!";
const browser = await chromium.launch();

async function loginPage(email, path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  return page;
}
async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`✓ ${name}`);
}
async function shotFull(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`✓ ${name}`);
}

// 1. Granskningskontot: kursvyn + vecka 1 + vecka 9 i Stilla kraft (granskningsläge).
const g = await loginPage("granskning@mind.test", "/mindfulnessguiden/login");
await g.goto(`${BASE}/mindfulnessguiden/kurs`, { waitUntil: "networkidle" });
await shot(g, "01-granskning-kursvy-stilla-kraft");
const weekLinks = await g.$$eval('a[href*="/kurs/vecka/"]', (as) => as.map((a) => a.href));
await g.goto(weekLinks[0], { waitUntil: "networkidle" });
await shot(g, "02-granskning-vecka1-lasvy");
await g.goto(weekLinks[weekLinks.length - 1], { waitUntil: "networkidle" });
await shot(g, "03-granskning-vecka9-lasvy");

// 2. Cecilia (deltagare): praxislogg — logga dagens dag; guideresa — logga en session.
const c = await loginPage("cecilia@mind.test", "/mindfulnessguiden/login");
await c.goto(`${BASE}/mindfulnessguiden/kurs`, { waitUntil: "networkidle" });
await shot(c, "04-cecilia-kursvy-deltagare");
await c.goto(`${BASE}/mindfulnessguiden/kurs/logg`, { waitUntil: "networkidle" });
await shotFull(c, "05-cecilia-praxislogg");
const logBtn = c.locator("button", { hasText: /Logga dagen|Idag är loggad/ });
if ((await logBtn.textContent())?.includes("Logga dagen")) {
  await logBtn.click();
  await c.waitForTimeout(1200);
}
await shotFull(c, "06-cecilia-praxislogg-loggad");
await c.goto(`${BASE}/mindfulnessguiden/kurs/guideresa`, { waitUntil: "networkidle" });
await c.locator('select[name="format"]').selectOption("A");
await c.fill('input[name="context"]', "Testkontoret");
await c.locator("button", { hasText: "Logga sessionen" }).click();
await c.waitForTimeout(1200);
await shotFull(c, "07-cecilia-guideresa");

// 3. Lisa: admin-deltagarlistan för MG med guidesessionskolumnen.
const l = await loginPage("lisa@kursmotorn.test", "/login");
await l.goto(`${BASE}/admin/mindfulnessguiden`, { waitUntil: "networkidle" });
await shot(l, "08-admin-mg-deltagare-guidekolumn");

// 4. Tenant #1 opåverkad: Annas kursvy ser ut som i GRIND 3/5.
const a = await loginPage("anna@andning.test", "/andningskursen/login");
await a.goto(`${BASE}/andningskursen/kurs`, { waitUntil: "networkidle" });
await shot(a, "09-andningskursen-oforandrad");

await browser.close();
console.log("\nKlart. PNG:er i", OUT);
