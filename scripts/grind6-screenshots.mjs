// GRIND 6 — klickbar verifiering + skärmdumpar av kohort-admin (fas 6).
// Loggar in som Lisa (plattformsadmin) och går igenom: tenants → deltagarlista
// (kohortfilter) → kohortlista → skapa kohort → kohortdetalj → flytt-dialog
// (fönstervarning) → fakturerad-markering → utskriftsvy → brand-wizard.
// Kohortsviten (test:cohort) är den reproducerbara proofen; PNG:erna är den
// visuella noteringen. Kör: node scripts/grind6-screenshots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/Users/lisa/COWORK/outputs/kursmotorn/grind6";
mkdirSync(OUT, { recursive: true });

const LISA = { email: "lisa@kursmotorn.test", password: "Testlosen123!" };
const SLUG = "andningskursen";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`✓ ${name}`);
}

// Motor-login som Lisa.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', LISA.email);
await page.fill('input[type="password"]', LISA.password);
await page.click('button[type="submit"]');
await page.waitForURL("**/admin", { timeout: 15000 });
await shot("01-motor-admin-tenants");

// Deltagarlistan + kohortfilter.
await page.goto(`${BASE}/admin/${SLUG}`, { waitUntil: "networkidle" });
await shot("02-deltagarlista-alla");
const filterLink = page.locator('a[href*="?kohort="]').first();
await filterLink.click();
await page.waitForLoadState("networkidle");
await shot("03-deltagarlista-kohortfilter");

// Kohortlistan + skapa ny kohort.
await page.goto(`${BASE}/admin/${SLUG}/kohorter`, { waitUntil: "networkidle" });
await shot("04-kohortlista");
await page.fill('input[name="name"]', "Andning kull 2 (grind6-demo)");
await page.fill('input[name="start_date"]', "2026-09-01");
await page.fill('input[name="price_per_participant_sek"]', "5900");
await page.click('button[type="submit"]');
await page.waitForURL("**/kohorter/**", { timeout: 15000 });
await shot("05-ny-kohort-skapad");

// Tillbaka till kull 1: enrollments + flytt-dialogen (fönstervarningen).
await page.goto(`${BASE}/admin/${SLUG}/kohorter`, { waitUntil: "networkidle" });
await page.locator("tr", { hasText: "Andning kull 1" }).locator("a").click();
await page.waitForLoadState("networkidle");
await shot("06-kohortdetalj-underlag");
await page.locator("button", { hasText: "Flytta" }).first().click();
await page.waitForTimeout(300);
await shot("07-flytt-dialog-fonstervarning");
await page.locator("button", { hasText: "Avbryt" }).click();

// Fakturerad-markering: sätt + ångra (kvar i o-markerat läge efteråt).
const invoiceBtn = page.locator("tbody tr").first().locator("button[title]").first();
await invoiceBtn.click();
await page.waitForTimeout(800);
await shot("08-fakturerad-markerad");
await page.locator("tbody tr").first().locator("button[title]").first().click();
await page.waitForTimeout(800);

// Utskriftsvyn.
await page.goto(`${BASE}/admin/${SLUG}/kohorter`, { waitUntil: "networkidle" });
await page.locator("tr", { hasText: "Andning kull 1" }).locator("a").click();
await page.waitForLoadState("networkidle");
const printHref = await page.getAttribute('a[href$="/print"]', "href");
await page.goto(`${BASE}${printHref}`, { waitUntil: "networkidle" });
await shot("09-underlag-print");

// Brand-wizarden.
await page.goto(`${BASE}/admin/${SLUG}/brand`, { waitUntil: "networkidle" });
await shot("10-brand-wizard");

// Städa: ta bort demo-kohorten som skapades ovan (via UI finns ingen delete — det
// är medvetet v1-scope; städningen sker i DB av köraren efteråt om så önskas).
await browser.close();
console.log("\nKlart. PNG:er i", OUT);
