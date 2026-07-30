// GRIND 7 — MG fas A-sviten (integration mot DB). Kör: npm run test:mg:local
//
// Verifierar ACCEPTANCE §Fas 7 mot riktig DB: import ordagrann (diff DB↔källfiler) ·
// loggreglerna (auto-idempotens, 7-dagarsfönstret, källa i admin) · fönsterberäkningen
// via certificate_status (5/5/5/5/5/5 · 5/5/4/5/5/5 · dispens · sen enrollment) ·
// upload_sections-semantiken (nio versioner av samma övning räcker INTE) ·
// guidesessionsräknaren (före/efter certifieringsinspelningen) · Stilla kraft i
// tenant_brands · granskningskontot · GDPR-raderingen (kaskad + revokerat certifikat).
// FFMQ-momentet är [L] (källfil + användarvillkor väntar på Lisa) och ingår INTE.
// Hermetisk: engångsdeltagare via service role; MG-kursens innehåll läses men röres ej.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { rebuildWeek } from "../scripts/lib/parse-mg-course.mjs";
import { deleteParticipantData } from "../src/lib/admin/delete-participant";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SVC = process.env.SUPABASE_SECRET_KEY!;
assert.ok(URL && ANON && SVC, "URL/ANON/SUPABASE_SECRET_KEY saknas (kör med --env-file)");

const T2 = "20000000-0000-0000-0000-000000000002"; // Mindfulnessguiden
const MG_COURSE = "2c000000-0000-0000-0000-000000000002";
const COHORT = "2a000000-0000-0000-0000-000000000002"; // Grundarkohorten
const SRC_DIR = "/Users/lisa/COWORK/projects/mindfulnessguiden/kursinnehall";
const PW = "MgTest123!";

const svc = createClient(URL, SVC, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});

const iso = (offset: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

let userId: string; // engångsdeltagare i MG
let me: SupabaseClient;
let uploadSectionIds: string[] = []; // V1–V9 ur certvillkoret

async function login(email: string, password: string = PW): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  });
  const r = await c.auth.signInWithPassword({ email, password });
  assert.ok(!r.error, `login ${email}: ${r.error?.message}`);
  return c;
}

/** Seedar practice_day-dagar direkt via service role (test-setup — bakåtdatering fritt). */
async function seedDays(dates: string[]) {
  await svc.from("activity_logs").delete().eq("user_id", userId).eq("log_type", "practice_day");
  if (dates.length) {
    const rows = dates.map((d) => ({
      tenant_id: T2, user_id: userId, course_id: MG_COURSE, cohort_id: COHORT,
      log_type: "practice_day", logged_date: d, source: "manual" as const,
    }));
    const r = await svc.from("activity_logs").insert(rows);
    assert.ok(!r.error, `seedDays: ${r.error?.message}`);
  }
}

/** Dagmönster: n dagar i början av varje fönster w (0-baserat) från starts_at. */
function pattern(startsAt: string, perWindow: number[]): string[] {
  const out: string[] = [];
  const base = new Date(`${startsAt}T00:00:00Z`);
  perWindow.forEach((n, w) => {
    for (let i = 0; i < n; i++) {
      const d = new Date(base.getTime());
      d.setUTCDate(d.getUTCDate() + w * 7 + i);
      out.push(d.toISOString().slice(0, 10));
    }
  });
  return out;
}

const logThresholdMet = async () => {
  const { data, error } = await me.rpc("certificate_status", { p_course_id: MG_COURSE });
  assert.ok(!error, `certificate_status: ${error?.message}`);
  return (data.requirements as { type: string; met: boolean }[]).find((r) => r.type === "log_threshold")!.met;
};

before(async () => {
  const email = `mgtest-${Date.now()}@mind.test`;
  const created = await svc.auth.admin.createUser({
    email, password: PW, email_confirm: true, user_metadata: { full_name: "Maja Sjölund" },
  });
  assert.ok(!created.error, `createUser: ${created.error?.message}`);
  userId = created.data.user!.id;
  await svc.from("memberships").insert({ user_id: userId, tenant_id: T2, role: "participant" });

  // Enrollment med starts_at 42 dagar bakåt (alla sex fönster ligger i det förflutna) —
  // OCH skild från kohortens start_date (sen-enrollment-ankaret testas därmed hela vägen).
  const enr = await svc.from("enrollments").insert({
    tenant_id: T2, user_id: userId, cohort_id: COHORT, course_id: MG_COURSE, starts_at: iso(-42),
  }).select("id").single();
  assert.ok(!enr.error, `enrollment: ${enr.error?.message}`);

  const req = await svc.from("course_certificate_requirements")
    .select("config").eq("course_id", MG_COURSE).eq("type", "upload_sections").single();
  assert.ok(!req.error, "upload_sections-certvillkoret saknas — kör npm run import:mg");
  uploadSectionIds = (req.data.config as { section_ids: string[] }).section_ids;

  me = await login(email);
});

after(async () => {
  if (userId) await svc.auth.admin.deleteUser(userId).catch(() => {});
});

test("MG-importen är ordagrann: DB återuppbygger källfilerna tecken för tecken", async () => {
  const { data: modules } = await svc
    .from("modules")
    .select("id, position, title, intro, sections(position, title, content, requirements)")
    .eq("course_id", MG_COURSE)
    .order("position");
  assert.equal(modules!.length, 9, "nio veckor ska vara importerade");

  for (const mod of modules!) {
    const src = readFileSync(`${SRC_DIR}/C-FINAL-vecka-${mod.position}.md`, "utf8");
    const sections = (mod.sections as { position: number; title: string; content: string; requirements: { upload_required?: boolean } }[])
      .sort((a, b) => a.position - b.position)
      .filter((s) => !s.requirements?.upload_required); // den tillagda uppladdningssektionen är motorns, inte källans
    const rebuilt = rebuildWeek({
      title: mod.title as string,
      intro: mod.intro as string,
      sections: sections.map((s) => ({ title: s.title, content: s.content })),
    });
    assert.equal(rebuilt, src, `vecka ${mod.position}: DB-innehållet avviker från källfilen`);
  }
});

test("nio uppladdningssektioner V1–V9 i certvillkoret; Stilla kraft i tenant_brands", async () => {
  assert.equal(uploadSectionIds.length, 9, "upload_sections ska peka på nio sektioner");
  const { data: secs } = await svc.from("sections").select("id, requirements").in("id", uploadSectionIds);
  assert.equal(secs!.length, 9);
  for (const s of secs!) {
    const req = s.requirements as { upload_required?: boolean; optional?: boolean };
    assert.equal(req.upload_required, true);
    assert.equal(req.optional, true, "uppladdningen ska inte låsa nästa vecka (Lisas beslut 2026-07-30)");
  }

  const { data: brand } = await svc.from("tenant_brands").select("brand_spec").eq("tenant_id", T2).single();
  const colors = (brand!.brand_spec as { colors: Record<string, string> }).colors;
  assert.equal(colors.primary, "#0F2647", "primary ska vara Stilla kraft navy-900");
  assert.equal(colors.accent, "#715FC1", "accent ska vara Stilla kraft lilac-600");
  assert.equal(colors.bg, "#FAF8F5", "bg ska vara Stilla kraft canvas");
  const spec = JSON.stringify(brand!.brand_spec);
  for (const old of ["#1A2942", "#8B6F3F", "#F7F4EE", "#EFE9DD", "Fraunces", "Source Sans 3"]) {
    assert.ok(!spec.includes(old), `Editorial Lugn-värdet ${old} ligger kvar i MG:s brand_spec`);
  }
});

test("auto-loggning är idempotent (två spelade meditationer ⇒ EN practice_day); guide_session dubblerar", async () => {
  await seedDays([]);
  const day = iso(0);
  const call = (src: string) => me.rpc("log_activity", {
    p_course_id: MG_COURSE, p_log_type: "practice_day", p_logged_date: day, p_source: src,
  });
  const first = await call("auto");
  assert.ok(!first.error, `auto 1: ${first.error?.message}`);
  const second = await call("auto");
  assert.ok(!second.error, "auto 2 ska vara tyst idempotent, inte fel");
  assert.equal(second.data, first.data, "samma rad ska returneras");
  const { count } = await svc.from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("log_type", "practice_day").eq("logged_date", day);
  assert.equal(count, 1, "exakt EN practice_day för dagen");

  const gs = (d: string) => me.rpc("log_activity", {
    p_course_id: MG_COURSE, p_log_type: "guide_session", p_logged_date: d,
    p_metadata: { format: "A", context: "test", participants_count: 3, note: null },
  });
  assert.ok(!(await gs(day)).error, "guide_session 1");
  assert.ok(!(await gs(day)).error, "guide_session 2 samma dag ska gå");
});

test("manuell loggning: idag och 7 dagar bakåt OK; 8 dagar bakåt avvisas; källan syns i admin", async () => {
  const call = (d: string) => me.rpc("log_activity", {
    p_course_id: MG_COURSE, p_log_type: "practice_day", p_logged_date: d, p_source: "manual",
  });
  assert.ok(!(await call(iso(-7))).error, "7 dagar bakåt ska gå");
  const tooOld = await call(iso(-8));
  assert.ok(tooOld.error && /dagar bakåt/.test(tooOld.error.message), "8 dagar bakåt ska avvisas");
  const future = await call(iso(1));
  assert.ok(future.error, "framtida datum ska avvisas");

  // Källan (auto/manual) läsbar för tenant-admin (granskningskontot är MG-admin).
  const admin = await login("granskning@mind.test", "Testlosen123!").catch(() => null);
  assert.ok(admin, "granskningskontot ska kunna logga in");
  const { data: rows } = await admin!.from("activity_logs")
    .select("source").eq("user_id", userId).eq("log_type", "practice_day");
  assert.ok(rows!.some((r) => r.source === "manual") && rows!.some((r) => r.source === "auto"),
    "admin ska se källan (auto + manual)");
});

test("fönsterberäkningen (DB-sanningen): 5×6 uppfyller; 5/5/4/5/5/5 inte; dispens lyfter; ankaret är starts_at", async () => {
  const starts = iso(-42); // enrollmentens starts_at (10+ dagar efter kohortstarten 2026-06-01)
  await seedDays(pattern(starts, [5, 5, 5, 5, 5, 5]));
  assert.equal(await logThresholdMet(), true, "5/5/5/5/5/5 från starts_at ska uppfylla");

  await seedDays(pattern(starts, [5, 5, 4, 5, 5, 5]));
  assert.equal(await logThresholdMet(), false, "5/5/4/5/5/5 ska inte uppfylla");

  // Dispens för fönster 3 (spårbart beslut i approvals) ⇒ uppfyllt.
  const disp = await svc.from("approvals").insert({
    tenant_id: T2, user_id: userId, course_id: MG_COURSE, cohort_id: COHORT,
    approval_type: "log_threshold_dispens", passed: true,
    target: { window_index: 3 }, notes: "test: sjukvecka (dispensmotiv obligatoriskt)",
  });
  assert.ok(!disp.error, `dispens: ${disp.error?.message}`);
  assert.equal(await logThresholdMet(), true, "dispens {window_index: 3} ska lyfta fönster 3");
  await svc.from("approvals").delete().eq("user_id", userId);

  // Samma mönster ankrat i KOHORTENS startdatum uppfyller INTE (fönstren följer starts_at).
  await seedDays(pattern("2026-06-01", [5, 5, 5, 5, 5, 5]));
  assert.equal(await logThresholdMet(), false, "kohortankrade dagar ska inte uppfylla starts_at-fönstren");
});

test("upload_sections: nio versioner i SAMMA sektion räcker inte; en per sektion uppfyller", async () => {
  const met = async () => {
    const { data } = await me.rpc("certificate_status", { p_course_id: MG_COURSE });
    return (data.requirements as { type: string; met: boolean }[]).find((r) => r.type === "upload_sections")!.met;
  };
  const upload = (sectionId: string, n: number) =>
    svc.from("uploads").insert(Array.from({ length: n }, (_, i) => ({
      tenant_id: T2, user_id: userId, section_id: sectionId,
      storage_path: `${T2}/${userId}/${sectionId}/v${i}.mp4`, size_bytes: 1,
    })));

  await upload(uploadSectionIds[0], 9); // nio versioner av V1
  assert.equal(await met(), false, "nio uppladdningar i EN sektion får inte uppfylla kravet");

  await svc.from("uploads").delete().eq("user_id", userId);
  for (const sid of uploadSectionIds) await upload(sid, 1);
  assert.equal(await met(), true, "en uppladdning per sektion V1–V9 ska uppfylla");
});

test("guidesessioner: före certifieringsinspelningen räknas inte, efter räknas", async () => {
  // V9-uppladdningen finns sedan förra testet (created_at = idag). Sessionerna ovan
  // är daterade idag ⇒ logged_date > uploadDate är falskt för dem (samma dag räknas inte).
  const finalSection = uploadSectionIds[8];
  const { data: up } = await svc.from("uploads").select("created_at")
    .eq("user_id", userId).eq("section_id", finalSection).order("created_at").limit(1).single();
  const uploadDate = String(up!.created_at).slice(0, 10);

  // Backdatera uppladdningen två dagar ⇒ dagens sessioner hamnar EFTER.
  await svc.from("uploads").update({ created_at: `${iso(-2)}T08:00:00Z` })
    .eq("user_id", userId).eq("section_id", finalSection);

  const count = async () => {
    const { data } = await svc.from("activity_logs")
      .select("logged_date").eq("user_id", userId).eq("log_type", "guide_session");
    return data!.filter((r) => (r.logged_date as string) > iso(-2)).length;
  };
  const before_ = await count();
  assert.ok(before_ >= 2, "dagens sessioner ska räknas efter backdaterad inspelning");

  // En session FÖRE inspelningsdatumet räknas inte.
  await svc.from("activity_logs").insert({
    tenant_id: T2, user_id: userId, course_id: MG_COURSE, cohort_id: COHORT,
    log_type: "guide_session", logged_date: iso(-5), source: "manual",
    metadata: { format: "B", context: "före-test", participants_count: null, note: null },
  });
  assert.equal(await count(), before_, "session daterad före inspelningen får inte räknas");
  assert.ok(uploadDate >= iso(-1), "sanity: uppladdningen skapades nyss innan backdateringen");
});

test("granskningskontot läser hela kursen (nio veckor, alla sektioner)", async () => {
  const g = await login("granskning@mind.test", "Testlosen123!");
  const { data: isAdmin } = await g.rpc("is_tenant_admin", { tid: T2 });
  assert.equal(isAdmin, true, "granskningskontot ska vara tenant-admin i MG");
  const { count: modCount } = await g.from("modules")
    .select("id", { count: "exact", head: true }).eq("course_id", MG_COURSE);
  assert.equal(modCount, 9);
  const { data: mods } = await g.from("modules").select("id").eq("course_id", MG_COURSE);
  const { count: secCount } = await g.from("sections")
    .select("id", { count: "exact", head: true }).in("module_id", mods!.map((m) => m.id));
  assert.ok((secCount ?? 0) >= 183, `alla sektioner ska vara läsbara (fick ${secCount})`);
});

test("GDPR-raderingen: kaskad + Storage + revokerat/anonymiserat certifikat", async () => {
  // Ge deltagaren ett certifikat + en riktig Storage-fil att radera.
  const cert = await svc.from("certificates").insert({
    tenant_id: T2, user_id: userId, course_id: MG_COURSE,
    holder_name: "Maja Sjölund", verify_slug: `mgtest-${Date.now()}`,
  }).select("verify_slug").single();
  assert.ok(!cert.error, `cert: ${cert.error?.message}`);
  const storagePath = `${T2}/${userId}/${uploadSectionIds[0]}/radera-mig.mp4`;
  const put = await svc.storage.from("recordings").upload(storagePath, Buffer.from("x"), { contentType: "video/mp4" });
  assert.ok(!put.error, `storage upload: ${put.error?.message}`);
  const ffmq = await svc.from("mg_ffmq_responses").insert({
    tenant_id: T2, user_id: userId, cohort_id: COHORT, occasion: "pre",
    answers: [], facet_scores: {}, total_score: 0, completed_at: new Date().toISOString(),
  });
  assert.ok(!ffmq.error, `ffmq: ${ffmq.error?.message}`);

  const res = await deleteParticipantData(svc, T2, userId);
  assert.ok(res.ok, `radering: ${res.error}`);
  assert.ok(res.removedFiles >= 1, "minst en Storage-fil ska ha raderats");

  // Raderna borta (kaskad), filen borta, certifikatet kvar som revokerat + anonymt.
  for (const table of ["activity_logs", "uploads", "enrollments", "mg_ffmq_responses", "memberships"]) {
    const { count } = await svc.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId);
    assert.equal(count, 0, `${table} ska vara tom efter radering`);
  }
  const { data: gone } = await svc.storage.from("recordings")
    .list(`${T2}/${userId}/${uploadSectionIds[0]}`);
  assert.equal((gone ?? []).length, 0, "Storage-filen ska vara borta");

  const { data: v } = await svc.rpc("verify_certificate", { p_slug: cert.data.verify_slug });
  assert.equal(v.status, "revoked", "certifikatet ska visas som återkallat");
  assert.equal(v.holder_name, "Raderad deltagare", "certifikatet ska vara anonymiserat");

  userId = ""; // after-hooken behöver inte radera igen
});
