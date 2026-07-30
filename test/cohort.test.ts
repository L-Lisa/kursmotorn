// GRIND 6 — kohortsviten (integration mot DB). Kör: npm run test:cohort:local
//
// Verifierar ACCEPTANCE §Fas 6 mot riktig DB: två kohorter ⇒ olika drip-upplåsning ·
// flytt = ny rad + moved_from + dropped + admin-grindad + fönsteromräkning med
// loggdagar före/efter · dubblettaktiv avvisas i DB · log_activity-regler ·
// grundarkohorten korrekt seedad. Hermetisk: egen kurs + engångsdeltagare via
// service role, allt raderas efteråt (kaskad) — demo-tillståndet röres inte.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { computeGating } from "../src/lib/tenant/gating";
import { computeLogWindows } from "../src/lib/tenant/log-windows";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SVC = process.env.SUPABASE_SECRET_KEY!;
assert.ok(URL && ANON && SVC, "URL/ANON/SUPABASE_SECRET_KEY saknas (kör med --env-file)");

const T1 = "10000000-0000-0000-0000-000000000001";
const PW = "Kohorttest123!";
const svc = createClient(URL, SVC, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});

const iso = (offset: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

let courseId: string;
let s1: string, s2: string;
let k1: string, k2: string; // kohorter: start -10 resp. -5 dagar (bägge utan framtida drip-datum i fönstret)
let p1: string, p2: string; // engångsdeltagare
let admin: SupabaseClient, part1: SupabaseClient;
let e1: string, e2: string; // enrollments

async function login(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  });
  const r = await c.auth.signInWithPassword({ email, password });
  assert.ok(!r.error, `login ${email}: ${r.error?.message}`);
  return c;
}

before(async () => {
  // Hermetisk scheduled-kurs i tenant #1 med två sektioner (drip 0 + 7).
  const course = await svc
    .from("courses")
    .insert({ tenant_id: T1, work_name: `kohorttest-${Date.now()}`, display_name: "Kohorttest", unlock_mode: "scheduled", status: "draft" })
    .select("id").single();
  assert.ok(!course.error, `kurs: ${course.error?.message}`);
  courseId = course.data.id;

  const mod = await svc.from("modules")
    .insert({ tenant_id: T1, course_id: courseId, position: 1, title: "M1" })
    .select("id").single();
  const secs = await svc.from("sections").insert([
    { tenant_id: T1, module_id: mod.data!.id, position: 1, title: "S1", requirements: { checkoff: true }, drip_offset_days: 0 },
    { tenant_id: T1, module_id: mod.data!.id, position: 2, title: "S2", requirements: { checkoff: true }, drip_offset_days: 7 },
  ]).select("id, position");
  assert.ok(!secs.error, `sektioner: ${secs.error?.message}`);
  [s1, s2] = secs.data.sort((a, b) => a.position - b.position).map((s) => s.id);

  // Loggtyper för den hermetiska kursen.
  await svc.from("log_type_defs").insert([
    { tenant_id: T1, course_id: courseId, log_type: "practice_day", label: "Övningsdag", daily_unique: true },
    { tenant_id: T1, course_id: courseId, log_type: "guide_session", label: "Guidesession", daily_unique: false },
  ]);

  // Två kohorter med olika startdatum på SAMMA kurs.
  const cohorts = await svc.from("cohorts").insert([
    { tenant_id: T1, course_id: courseId, name: "Kull A", start_date: iso(-10), price_per_participant_sek: 4900, status: "active" },
    { tenant_id: T1, course_id: courseId, name: "Kull B", start_date: iso(-5), price_per_participant_sek: 4900, status: "active" },
  ]).select("id, start_date");
  assert.ok(!cohorts.error, `kohorter: ${cohorts.error?.message}`);
  const sorted = cohorts.data.sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  k1 = sorted[0].id; k2 = sorted[1].id;

  // Engångsdeltagare.
  const users = await Promise.all(
    ["p1", "p2"].map((n) =>
      svc.auth.admin.createUser({
        email: `kohort-${n}-${Date.now()}@andning.test`, password: PW, email_confirm: true,
        user_metadata: { full_name: n === "p1" ? "Pia Ekström" : "Per Åslund" },
      }),
    ),
  );
  for (const u of users) assert.ok(!u.error, `createUser: ${u.error?.message}`);
  [p1, p2] = users.map((u) => u.data.user!.id);
  await svc.from("memberships").insert([
    { user_id: p1, tenant_id: T1, role: "participant" },
    { user_id: p2, tenant_id: T1, role: "participant" },
  ]);

  admin = await login("admin1@andning.test", "Testlosen123!");
  part1 = await login(users[0].data.user!.email!, PW);
});

after(async () => {
  if (courseId) await svc.from("courses").delete().eq("id", courseId); // kaskad: kohorter/enrollments/loggar/sektioner
  for (const id of [p1, p2].filter(Boolean)) await svc.auth.admin.deleteUser(id);
});

test("create_enrollment (admin): default-starts_at = kohortens start_date", async () => {
  const r1 = await admin.rpc("create_enrollment", { p_cohort_id: k1, p_user_id: p1 });
  assert.ok(!r1.error, `enrollment p1: ${r1.error?.message}`);
  e1 = r1.data as string;
  const r2 = await admin.rpc("create_enrollment", { p_cohort_id: k2, p_user_id: p2 });
  assert.ok(!r2.error, `enrollment p2: ${r2.error?.message}`);
  e2 = r2.data as string;

  const rows = await svc.from("enrollments").select("id, starts_at, course_id").in("id", [e1, e2]);
  const byId = new Map(rows.data!.map((r) => [r.id, r]));
  assert.equal(byId.get(e1)!.starts_at, iso(-10));
  assert.equal(byId.get(e2)!.starts_at, iso(-5));
  assert.equal(byId.get(e1)!.course_id, courseId, "course_id ska följa kohorten");
});

test("två kohorter, olika startdatum ⇒ olika drip-upplåsning, samma innehåll", async () => {
  // Samma fråga som appen (enrollment → kohortens start_date) + samma gating-kärna.
  const gateFor = async (uid: string) => {
    const enr = await svc.from("enrollments")
      .select("starts_at, cohorts!enrollments_cohort_id_fkey(start_date)")
      .eq("user_id", uid).eq("course_id", courseId).eq("status", "active").single();
    const coh = enr.data!.cohorts as unknown as { start_date: string };
    return computeGating({
      unlockMode: "scheduled",
      sections: [
        { id: s1, requirements: { checkoff: true }, dripOffsetDays: 0 },
        { id: s2, requirements: { checkoff: true }, dripOffsetDays: 7 },
      ],
      cohortStart: new Date(`${coh.start_date}T00:00:00Z`),
      progress: { completedSectionIds: new Set(), passedQuizIds: new Set(), uploadedSectionIds: new Set() },
    });
  };

  const g1 = await gateFor(p1); // kohortstart -10: dag 7 passerad
  const g2 = await gateFor(p2); // kohortstart -5: dag 7 ej nådd
  assert.equal(g1.find((s) => s.id === s2)!.unlocked, true, "Kull A (start -10) ska ha S2 öppen");
  assert.equal(g2.find((s) => s.id === s2)!.unlocked, false, "Kull B (start -5) ska ha S2 låst");
  assert.equal(g1.length, g2.length, "samma innehåll i båda kohorterna");
});

test("log_activity: okänd typ avvisas; dagtyp dedupas; guide_session får dubblera", async () => {
  const day = iso(-20); // före kohortstart — utanför fönstren, stör inte flytt-testet nedan
  const call = (t: string, d: string) =>
    part1.rpc("log_activity", { p_course_id: courseId, p_log_type: t, p_logged_date: d });

  assert.ok((await call("finns_inte", day)).error, "okänd loggtyp borde avvisas");
  assert.ok(!(await call("practice_day", day)).error, "första practice_day ska gå");
  const dup = await call("practice_day", day);
  assert.ok(dup.error && /redan loggad/.test(dup.error.message), "dagtypsdubblett borde avvisas");
  assert.ok(!(await call("guide_session", day)).error, "guide_session 1");
  assert.ok(!(await call("guide_session", day)).error, "guide_session 2 samma dag ska gå");

  // cohort_id härleds ur aktiv enrollment.
  const row = await svc.from("activity_logs").select("cohort_id, source")
    .eq("user_id", p1).eq("log_type", "practice_day").eq("logged_date", day).single();
  assert.equal(row.data!.cohort_id, k1);
  assert.equal(row.data!.source, "manual");
});

test("flytt: ny rad + moved_from, gamla dropped; fönstren räknas om (loggdagar före/efter)", async () => {
  // P1 loggar 5 dagar i sitt första fönster (start -10 … -6).
  for (let i = 0; i < 5; i++) {
    const r = await part1.rpc("log_activity", { p_course_id: courseId, p_log_type: "practice_day", p_logged_date: iso(-10 + i) });
    assert.ok(!r.error, `loggdag ${i}: ${r.error?.message}`);
  }
  const datesOf = async () =>
    (await svc.from("activity_logs").select("logged_date").eq("user_id", p1).eq("log_type", "practice_day")).data!.map((r) => r.logged_date as string);

  const cfg = { weeks: 6, minDaysPerWeek: 5 };
  const before_ = computeLogWindows({ startsAt: iso(-10), ...cfg, loggedDates: await datesOf() });
  assert.equal(before_.windows[0].daysLogged, 5);
  assert.equal(before_.windows[0].met, true, "fönster 1 uppfyllt före flytten");

  // Deltagare får inte flytta sig själv.
  const asPart = await part1.rpc("move_enrollment", { p_enrollment_id: e1, p_to_cohort_id: k2 });
  assert.ok(asPart.error, "deltagare kunde flytta sin egen enrollment");

  // Admin flyttar P1 → Kull B.
  const mv = await admin.rpc("move_enrollment", { p_enrollment_id: e1, p_to_cohort_id: k2 });
  assert.ok(!mv.error, `flytt: ${mv.error?.message}`);
  const newId = mv.data as string;

  const oldRow = await svc.from("enrollments").select("status").eq("id", e1).single();
  assert.equal(oldRow.data!.status, "dropped", "gamla raden ska vara dropped");
  const newRow = await svc.from("enrollments")
    .select("status, starts_at, cohort_id, moved_from_enrollment_id").eq("id", newId).single();
  assert.equal(newRow.data!.status, "active");
  assert.equal(newRow.data!.cohort_id, k2);
  assert.equal(newRow.data!.moved_from_enrollment_id, e1, "spårbarheten (moved_from) saknas");
  assert.equal(newRow.data!.starts_at, iso(-5), "nya starts_at = målkohortens start_date");

  // Omräkningen: samma loggdagar, nytt ankare ⇒ fönster 1 inte längre uppfyllt.
  const afterMove = computeLogWindows({ startsAt: newRow.data!.starts_at, ...cfg, loggedDates: await datesOf() });
  assert.equal(afterMove.windows[0].met, false, "gamla loggdagar ska falla utanför de nya fönstren");

  // Loggdagar EFTER flytten räknas i de nya fönstren (kravet förblir nåbart).
  for (let i = 0; i < 5; i++) {
    const r = await part1.rpc("log_activity", { p_course_id: courseId, p_log_type: "practice_day", p_logged_date: iso(-5 + i) });
    assert.ok(!r.error, `ny loggdag ${i}: ${r.error?.message}`);
  }
  const after2 = computeLogWindows({ startsAt: newRow.data!.starts_at, ...cfg, loggedDates: await datesOf() });
  assert.equal(after2.windows[0].met, true, "nya loggdagar ska uppfylla det omräknade fönstret");

  e1 = newId; // för dubblettestet nedan
});

test("högst en aktiv enrollment per user+kurs upprätthålls i DB (direkt-API avvisas)", async () => {
  // Admin försöker ge P1 en andra aktiv plats (nu i Kull A) via direkt insert.
  const dup = await admin.from("enrollments").insert({
    tenant_id: T1, user_id: p1, cohort_id: k1, course_id: courseId, starts_at: iso(-10),
  });
  assert.ok(dup.error, "andra aktiva enrollment på samma kurs borde avvisas av indexet");
  // Även via serverfunktionen.
  const dupFn = await admin.rpc("create_enrollment", { p_cohort_id: k1, p_user_id: p1 });
  assert.ok(dupFn.error, "create_enrollment borde också avvisa dubblettaktiv");
});

test("fakturerad/betald kan sättas och ångras (manuell markering, ingen extern effekt)", async () => {
  const ts = new Date().toISOString();
  const set = await admin.from("enrollments").update({ invoiced_at: ts, paid_at: ts }).eq("id", e2).select("invoiced_at, paid_at").single();
  assert.ok(!set.error && set.data.invoiced_at && set.data.paid_at, `markering: ${set.error?.message}`);
  const undo = await admin.from("enrollments").update({ invoiced_at: null, paid_at: null }).eq("id", e2).select("invoiced_at, paid_at").single();
  assert.ok(!undo.error && !undo.data.invoiced_at && !undo.data.paid_at, "ångra-vägen ska nollställa");
});

test("grundarkohorten seedad rätt: 11 500 kr, platform/platform, ingen split-rad", async () => {
  const g = await svc.from("cohorts").select("id, price_per_participant_sek, sold_by, delivered_by")
    .eq("name", "Grundarkohorten").single();
  assert.ok(!g.error, "grundarkohorten saknas i seed");
  assert.equal(g.data.price_per_participant_sek, 11500);
  assert.equal(g.data.sold_by, "platform");
  assert.equal(g.data.delivered_by, "platform");
  const split = await svc.from("mg_billing_splits").select("id").eq("cohort_id", g.data.id);
  assert.equal(split.data!.length, 0, "grundarkohorten ska inte ha någon split-rad");
});
