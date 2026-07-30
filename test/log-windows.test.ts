// Fas 6 — fönsterberäkningen + kohortunderlaget (rena enhetstester).
// Kör: npm run test:windows
//
// ACCEPTANCE §Fas 6/7-semantiken: fönstren är weeks×7 dagar från enrollment.starts_at;
// 5/5/5/5/5/5 uppfyller, 5/5/4/5/5/5 inte; dispens {window_index} lyfter sitt fönster;
// en FLYTT (= ny starts_at) räknar om fönstren — loggdagar räknas bara i de nya fönstren.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLogWindows } from "../src/lib/tenant/log-windows";
import { buildUnderlag, underlagToCsv, type UnderlagEnrollment } from "../src/lib/tenant/underlag";

const iso = (base: string, offset: number): string => {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** n loggdagar i början av fönster w (0-baserat) räknat från starts_at. */
function daysIn(startsAt: string, w: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => iso(startsAt, w * 7 + i));
}

const START = "2026-06-01";
const MG = { weeks: 6, minDaysPerWeek: 5 };

test("5/5/5/5/5/5 ⇒ alla fönster uppfyllda", () => {
  const logged = [0, 1, 2, 3, 4, 5].flatMap((w) => daysIn(START, w, 5));
  const r = computeLogWindows({ startsAt: START, ...MG, loggedDates: logged });
  assert.equal(r.windows.length, 6);
  assert.ok(r.windows.every((w) => w.daysLogged === 5 && w.met));
  assert.equal(r.allMet, true);
});

test("5/5/4/5/5/5 ⇒ ej uppfyllt (fönster 3 fattas en dag)", () => {
  const logged = [0, 1, 2, 3, 4, 5].flatMap((w) => daysIn(START, w, w === 2 ? 4 : 5));
  const r = computeLogWindows({ startsAt: START, ...MG, loggedDates: logged });
  assert.equal(r.windows[2].daysLogged, 4);
  assert.equal(r.windows[2].met, false);
  assert.equal(r.allMet, false);
});

test("dispens {window_index: 3} lyfter exakt fönster 3", () => {
  const logged = [0, 1, 2, 3, 4, 5].flatMap((w) => daysIn(START, w, w === 2 ? 4 : 5));
  const r = computeLogWindows({ startsAt: START, ...MG, loggedDates: logged, dispensedWindows: [3] });
  assert.equal(r.windows[2].met, true);
  assert.equal(r.windows[2].dispensed, true);
  assert.equal(r.allMet, true);
});

test("eftersläntrare: fönstren följer starts_at, inte kohortstarten", () => {
  const late = iso(START, 10);
  const logged = daysIn(late, 0, 5);
  const fromCohortStart = computeLogWindows({ startsAt: START, ...MG, loggedDates: logged });
  const fromOwnStart = computeLogWindows({ startsAt: late, ...MG, loggedDates: logged });
  assert.equal(fromOwnStart.windows[0].met, true, "eftersläntrarens fönster 1 ska vara nåbart");
  assert.notEqual(
    fromCohortStart.windows[0].daysLogged,
    fromOwnStart.windows[0].daysLogged,
    "fönstren måste ankras i starts_at för att eftersläntraren inte ska förlora fönster 1",
  );
});

test("flytt räknar om fönstren: loggdagar före nya starts_at räknas inte", () => {
  // Före flytten: 5 dagar i fönster 1 ⇒ uppfyllt.
  const logged = daysIn(START, 0, 5);
  const before = computeLogWindows({ startsAt: START, ...MG, loggedDates: logged });
  assert.equal(before.windows[0].met, true);

  // Flytt till kohort som startar 14 dagar senare ⇒ samma loggdagar faller utanför.
  const newStart = iso(START, 14);
  const after = computeLogWindows({ startsAt: newStart, ...MG, loggedDates: logged });
  assert.equal(after.windows[0].daysLogged, 0, "gamla loggdagar ska inte räknas i nya fönster");
  assert.equal(after.windows[0].met, false);

  // Loggdagar EFTER flytten räknas i de nya fönstren.
  const newLogged = [...logged, ...daysIn(newStart, 0, 5)];
  const after2 = computeLogWindows({ startsAt: newStart, ...MG, loggedDates: newLogged });
  assert.equal(after2.windows[0].daysLogged, 5);
  assert.equal(after2.windows[0].met, true);
});

// ── Kohortunderlaget (ACCEPTANCE §Fas 6) ──

function enr(i: number, override: number | null = null, status = "active"): UnderlagEnrollment {
  return {
    enrollmentId: `e${i}`,
    fullName: `Deltagare ${i}`,
    company: i % 2 ? `Bolag ${i} AB` : null,
    status,
    startsAt: START,
    priceOverrideSek: override,
    invoicedAt: null,
    paidAt: null,
  };
}

test("underlag: 8 deltagare varav en med price_override ⇒ rätt radpris + summa", () => {
  const rows = [...Array.from({ length: 7 }, (_, i) => enr(i + 1)), enr(8, 9900)];
  const u = buildUnderlag(11500, rows);
  assert.equal(u.rows.filter((r) => r.effectivePriceSek === 11500).length, 7);
  assert.equal(u.rows.find((r) => r.enrollmentId === "e8")?.effectivePriceSek, 9900);
  assert.equal(u.totalSek, 7 * 11500 + 9900);
  assert.equal(u.countedRows, 8);
});

test("underlag: dropped visas men summeras inte; CSV = vyn (samma rader + summa)", () => {
  const rows = [enr(1), enr(2, null, "dropped"), enr(3, 5000)];
  const u = buildUnderlag(10000, rows);
  assert.equal(u.totalSek, 10000 + 5000);
  assert.equal(u.countedRows, 2);
  assert.equal(u.rows.length, 3, "dropped-raden ska synas (historik)");

  const csv = underlagToCsv("Testkohorten", u);
  for (const r of u.rows) {
    assert.ok(csv.includes(r.fullName), `CSV saknar ${r.fullName}`);
    assert.ok(csv.includes(String(r.effectivePriceSek)), `CSV saknar radpris ${r.effectivePriceSek}`);
  }
  assert.ok(csv.includes(`Summa;;;;${u.totalSek};;`), "CSV saknar summaraden ur vyn");
  // Motorkärnan är avgiftsfri: inget delningsavsnitt någonsin i underlaget.
  assert.ok(!/andel|delning|split|%/i.test(csv), "underlaget får inte innehålla delningsfält");
});
