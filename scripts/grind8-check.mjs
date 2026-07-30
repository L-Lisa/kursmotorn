// GRIND 8 — verifiering av eject-exporten (ACCEPTANCE §Fas 8).
// 1) Breathworks-exporten ⇒ standalone-app som STARTAR lokalt och VISAR kursen
//    (riktig HTTP-server + innehållskontroll mot källfilen, ordagrant stickprov).
// 2) MG-exporten ⇒ filaudit mot tabellistan (mg_-tabellerna + 2026-07-11-tabellerna).
// 3) Ingen tenant-context-kod i standalone (statisk config — inga Supabase-anrop).
// Kör: node scripts/grind8-check.mjs   (efter npm run eject -- <slug> för båda)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failures++;
    console.error(`✗ ${name}: ${e.message}`);
  }
};

// ── 2. Filaudit: MG-exporten innehåller ALLA tabeller ur datamodellen ──
const REQUIRED = [
  "tenants", "tenant_brands", "memberships", "courses", "modules", "sections",
  "quizzes", "quiz_questions", "course_certificate_requirements", "log_type_defs",
  "cohorts", "enrollments", "activity_logs", "section_progress", "quiz_attempts",
  "uploads", "attestations", "certificates", "approvals",
  "mg_guide_status", "mg_ffmq_responses", "mg_billing_splits",
];
for (const slugDir of ["andningskursen", "mindfulnessguiden"]) {
  check(`${slugDir}: datafiler för samtliga tabeller + users + brand_spec + seed`, () => {
    for (const t of REQUIRED) {
      assert.ok(existsSync(`eject-output/${slugDir}/data/${t}.json`), `data/${t}.json saknas`);
    }
    assert.ok(existsSync(`eject-output/${slugDir}/data/users.json`), "users.json saknas");
    assert.ok(existsSync(`eject-output/${slugDir}/brand_spec.json`), "brand_spec.json saknas");
    const seed = readFileSync(`eject-output/${slugDir}/seed/seed.sql`, "utf8");
    assert.ok(seed.includes("insert into public.sections"), "seed.sql saknar sektioner");
    assert.ok(seed.includes("insert into public.course_certificate_requirements"), "seed.sql saknar certvillkor");
  });
}

check("MG: certvillkoren (4 st inkl. log_threshold + upload_sections) i exporten", () => {
  const reqs = JSON.parse(readFileSync("eject-output/mindfulnessguiden/data/course_certificate_requirements.json", "utf8"));
  assert.equal(reqs.length, 4);
  const types = reqs.map((r) => r.type).sort();
  assert.deepEqual(types, ["log_threshold", "manual_approval", "sections_complete", "upload_sections"]);
});

// ── 3. Ingen tenant-context-kod i standalone (statisk config) ──
check("standalone är statisk: inga Supabase-/context-referenser, ingen nätverkskod", () => {
  for (const slugDir of ["andningskursen", "mindfulnessguiden"]) {
    for (const f of readdirSync(`eject-output/${slugDir}/standalone`)) {
      const body = readFileSync(`eject-output/${slugDir}/standalone/${f}`, "utf8");
      // KOD-referenser förbjudna; kursINNEHÅLLET får förstås innehålla länkar (verbatim).
      for (const forbidden of ["supabase", "tenant_public_brand", "NEXT_PUBLIC", "fetch("]) {
        assert.ok(!body.includes(forbidden), `${f} innehåller "${forbidden}"`);
      }
    }
    // Serverkoden specifikt: ingen utåtriktad anropskod alls.
    const server = readFileSync(`eject-output/${slugDir}/standalone/server.mjs`, "utf8");
    for (const forbidden of ["https://", "fetch(", "request("]) {
      assert.ok(!server.includes(forbidden), `server.mjs innehåller "${forbidden}"`);
    }
  }
});

// ── 1. Standalone-appen startar och visar kursen (breathworks) ──
const server = spawn("node", ["server.mjs"], {
  cwd: "eject-output/andningskursen/standalone",
  env: { ...process.env, PORT: "4179" },
});
await new Promise((r) => setTimeout(r, 1200));

try {
  const index = await (await fetch("http://localhost:4179/")).text();
  check("standalone startar och visar kursöversikten", () => {
    assert.ok(index.includes("Andningskursen"), "kursnamnet saknas");
    assert.ok(index.includes("vecka-9.html"), "modullänkarna saknas");
  });

  const week1 = await (await fetch("http://localhost:4179/vecka-1.html")).text();
  check("modul 1 renderas med ordagrant innehåll + brand-tokens", () => {
    // Ordagrant stickprov: en mening ur kurs/modul-1.md ska finnas i renderad HTML.
    const src = readFileSync("/Users/lisa/COWORK/projects/kursmotorn/kurs/modul-1.md", "utf8");
    const sentence = src
      .split("\n")
      .find((l) => l.length > 80 && /^[A-ZÅÄÖ]/.test(l) && !l.includes("**") && !l.includes("["));
    const plain = (h) => h.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, (m) => ({ "&amp;": "&", "&quot;": '"', "&#39;": "'" }[m] ?? m));
    assert.ok(sentence, "hittade ingen provmening i källfilen");
    assert.ok(plain(week1).includes(plain(sentence.trim())), `provmeningen saknas i vecka-1.html: "${sentence.slice(0, 60)}…"`);
    // Brand: palett A:s primärfärg ska ligga i CSS:en (statiskt inbakad).
    const css = readFileSync("eject-output/andningskursen/standalone/style.css", "utf8");
    assert.ok(css.includes("#1F5F5B"), "brandens primärfärg saknas i standalone-CSS");
  });
} finally {
  server.kill();
}

console.log(failures === 0 ? "\nGRIND 8-kontrollen: ALLT GRÖNT" : `\nGRIND 8: ${failures} FEL`);
process.exit(failures === 0 ? 0 : 1);
