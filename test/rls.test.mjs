// RLS-isolationssvit (content-agnostisk, självseedande). Kör: npm run test:rls:local
// Hämtar riktiga id:n vid körning och städar upp egna rader — bryts inte när
// kursimporten byter innehåll. Tenant-isolation är det enda oförhandlingsbara.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(URL && ANON, "NEXT_PUBLIC_SUPABASE_URL/ANON_KEY saknas (kör med --env-file)");

const PW = "Testlosen123!";
const T2 = "20000000-0000-0000-0000-000000000002";
const A = "aaaaaaaa-0000-0000-0000-000000000001"; // Anna, tenant1
const B = "bbbbbbbb-0000-0000-0000-000000000002"; // Bengt, tenant1

const mk = () =>
  createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  });
async function signIn(email) {
  const c = mk();
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  assert.ok(!error && data.session, `login ${email}: ${error?.message}`);
  return c;
}
// Hämtar ett riktigt (course, section, quiz) som användaren får se.
async function anchors(client) {
  const course = (await client.from("courses").select("id, tenant_id").limit(1).single()).data;
  const section = (await client.from("sections").select("id").limit(1).single()).data;
  const quiz = (await client.from("quizzes").select("id").limit(1).single()).data;
  return { course, section, quiz };
}

test("anon kan inte läsa kurser/sektioner", async () => {
  const c = mk();
  const courses = await c.from("courses").select("id");
  assert.ok(courses.error || courses.data.length === 0, "anon fick kursdata");
  const secs = await c.from("sections").select("id");
  assert.ok(secs.error || secs.data.length === 0, "anon fick sektionsdata");
});

test("Anna ser bara sin tenant; inget av tenant2", async () => {
  const a = await signIn("anna@andning.test");
  const courses = await a.from("courses").select("id, tenant_id");
  assert.ok(!courses.error && courses.data.length > 0, "Anna borde se sin kurs");
  assert.ok(courses.data.every((r) => r.tenant_id !== T2), "Anna såg en tenant2-kurs");
  const ffmq = await a.from("mg_ffmq_responses").select("id");
  assert.equal(ffmq.data.length, 0, "Anna såg tenant2:s FFMQ");
});

test("Deltagardata isoleras A↔B (försök via rättningsfunktionen, städas)", async () => {
  const a = await signIn("anna@andning.test");
  const { quiz } = await anchors(a);
  // Anna seedar ett eget försök via den enda tillåtna vägen (server-side rättning).
  const sub = await a.rpc("submit_quiz_attempt", { p_quiz_id: quiz.id, p_answers: {} });
  assert.ok(!sub.error, `submit_quiz_attempt: ${sub.error?.message}`);

  const b = await signIn("bengt@andning.test");
  const bAtt = await b.from("quiz_attempts").select("user_id");
  assert.ok(bAtt.data.every((r) => r.user_id === B), "Bengt såg Annas försök");

  const admin = await signIn("admin1@andning.test"); // admin städar (deltagare får ej radera försök)
  await admin.from("quiz_attempts").delete().eq("user_id", A);
});

test("Provintegritet: deltagare kan inte själv-inserta försök eller läsa facit", async () => {
  const a = await signIn("anna@andning.test");
  const { quiz } = await anchors(a);
  // Direkt-insert av ett försök ska nekas (bara submit_quiz_attempt skriver → passed kan ej fejkas).
  const ins = await a.from("quiz_attempts").insert({
    tenant_id: "10000000-0000-0000-0000-000000000001",
    quiz_id: quiz.id, user_id: A, answers: {}, score: 100, passed: true,
  });
  assert.ok(ins.error, "deltagare kunde själv-inserta ett (fejkat) försök");
  // Facit (correct_index) ska inte gå att läsa direkt.
  const facit = await a.from("quiz_questions").select("correct_index").eq("quiz_id", quiz.id);
  assert.equal(facit.data?.length ?? 0, 0, "deltagare kunde läsa facit direkt");
});

test("Tenant1-admin ser tenant1, aldrig tenant2", async () => {
  const d = await signIn("admin1@andning.test");
  const courses = await d.from("courses").select("tenant_id");
  assert.ok(courses.data.every((r) => r.tenant_id !== T2), "admin1 såg tenant2-kurs");
  const ffmq = await d.from("mg_ffmq_responses").select("id");
  assert.equal(ffmq.data.length, 0, "admin1 såg tenant2:s FFMQ");
});

test("Cecilia ser bara tenant2", async () => {
  const c = await signIn("cecilia@mind.test");
  const courses = await c.from("courses").select("tenant_id");
  assert.ok(courses.data.length > 0 && courses.data.every((r) => r.tenant_id === T2), "Cecilia såg fel tenant");
  const att = await c.from("quiz_attempts").select("id");
  assert.equal(att.data.length, 0, "Cecilia såg tenant1:s försök");
});

test("Deltagare kan inte skriva config eller höja sin roll", async () => {
  const a = await signIn("anna@andning.test");
  const { section } = await anchors(a);
  const insCourse = await a.from("courses").insert({
    tenant_id: "10000000-0000-0000-0000-000000000001", work_name: "hack", display_name: "hack",
  });
  assert.ok(insCourse.error, "deltagare kunde skapa kurs");
  const updSec = await a.from("sections").update({ title: "hack" }).eq("id", section.id).select();
  assert.equal(updSec.data?.length ?? 0, 0, "deltagare kunde uppdatera sektion");
  const role = await a.from("memberships").update({ role: "admin" }).eq("user_id", A).select();
  assert.equal(role.data?.length ?? 0, 0, "deltagare kunde göra sig till admin");
});

test("Cross-tenant: tenant1-admin kan inte skriva in i tenant2", async () => {
  const d = await signIn("admin1@andning.test");
  const ins = await d.from("courses").insert({ tenant_id: T2, work_name: "x", display_name: "x" });
  assert.ok(ins.error, "tenant1-admin kunde skapa kurs i tenant2");
});

test("Storage path-prefix: egen mapp OK, annans nekad", async () => {
  const a = await signIn("anna@andning.test");
  const buf = Buffer.from("t");
  const opts = { upsert: true, contentType: "video/mp4" }; // bucketen tillåter bara video
  const T1 = "10000000-0000-0000-0000-000000000001";
  const bad = await a.storage.from("recordings").upload(`${T1}/${B}/x/x.mp4`, buf, opts);
  assert.ok(bad.error, "Anna kunde ladda upp till Bengts prefix");
  const own = `${T1}/${A}/x/x.mp4`;
  const good = await a.storage.from("recordings").upload(own, buf, opts);
  assert.ok(!good.error, `Anna kunde inte ladda upp till eget prefix: ${good.error?.message}`);
  await a.storage.from("recordings").remove([own]);
});

test("practice_day dagsunik; guide_session inte (via log_activity — direktinsert nekas)", async () => {
  const a = await signIn("anna@andning.test");
  const T1 = "10000000-0000-0000-0000-000000000001";
  const course = (await a.from("courses").select("id").limit(1).single()).data;
  const admin = await signIn("admin1@andning.test");
  const day = new Date().toISOString().slice(0, 10); // idag — 7-dagarsregeln (fas 7) gäller manuell loggning
  await admin.from("activity_logs").delete().eq("user_id", A).eq("logged_date", day);

  // Fas 6: log_activity är deltagarens ENDA skrivväg (typregistret kan inte kringgås).
  const direct = await a.from("activity_logs").insert({
    tenant_id: T1, user_id: A, course_id: course.id, log_type: "practice_day", logged_date: day, source: "manual",
  });
  assert.ok(direct.error, "deltagare kunde direkt-inserta i activity_logs (policyn skulle vara borttagen)");

  const call = (log_type) => a.rpc("log_activity", {
    p_course_id: course.id, p_log_type: log_type, p_logged_date: day,
  });
  const first = await call("practice_day");
  assert.ok(!first.error, `första practice_day: ${first.error?.message}`);
  const second = await call("practice_day");
  assert.ok(second.error, "andra practice_day samma dag borde avvisas");
  const unknown = await call("finns_inte");
  assert.ok(unknown.error, "okänd loggtyp borde avvisas (typregistret)");
  await admin.from("activity_logs").delete().eq("user_id", A).eq("logged_date", day);
});

test("Granskningsläget är läsläge: admin kan aldrig skriva egen progress", async () => {
  // Migration ..15: gransknings-/adminkonton (is_tenant_admin) skriver aldrig egen
  // progress — varken via RLS-vägarna eller SECURITY DEFINER-funktionerna.
  const admin = await signIn("admin1@andning.test");
  const { course, section, quiz } = await anchors(admin);
  const uid = (await admin.auth.getUser()).data.user.id;
  const day = new Date().toISOString().slice(0, 10);

  const checkoff = await admin.from("section_progress").insert({
    tenant_id: course.tenant_id, user_id: uid, section_id: section.id,
  });
  assert.ok(checkoff.error, "admin kunde bocka av en sektion åt sig själv");

  const upload = await admin.from("uploads").insert({
    tenant_id: course.tenant_id, user_id: uid, section_id: section.id,
    storage_path: `${course.tenant_id}/${uid}/${section.id}/x.mp4`, size_bytes: 1,
  });
  assert.ok(upload.error, "admin kunde registrera en egen uppladdning");

  const log = await admin.rpc("log_activity", {
    p_course_id: course.id, p_log_type: "practice_day", p_logged_date: day,
  });
  assert.ok(/läsläge/.test(log.error?.message ?? ""), "admin kunde logga egen aktivitet");

  const attempt = await admin.rpc("submit_quiz_attempt", { p_quiz_id: quiz.id, p_answers: {} });
  assert.ok(/läsläge/.test(attempt.error?.message ?? ""), "admin kunde skriva eget provförsök");

  const attest = await admin.rpc("submit_attestation", { p_course_id: course.id });
  assert.ok(/läsläge/.test(attest.error?.message ?? ""), "admin kunde lämna egen attestation");

  // Deltagarens väg är orörd: Anna kan fortfarande bocka av (och ångra).
  const a = await signIn("anna@andning.test");
  const first = (await a.from("sections").select("id, tenant_id").order("position").limit(1).single()).data;
  await a.from("section_progress").delete().eq("user_id", A).eq("section_id", first.id); // rent utgångsläge
  const own = await a.from("section_progress").insert({
    tenant_id: first.tenant_id, user_id: A, section_id: first.id,
  });
  assert.ok(!own.error, `Annas avbockning gick sönder: ${own.error?.message}`);
  const undo = await a.from("section_progress").delete().eq("user_id", A).eq("section_id", first.id).select();
  assert.equal(undo.data?.length ?? 0, 1, "Anna kunde inte ångra sin avbockning");
});

test("Enrollment-funktionerna är admin-grindade; dubblettaktiv avvisas i DB", async () => {
  const a = await signIn("anna@andning.test");
  const admin = await signIn("admin1@andning.test");
  const cohort = (await admin.from("cohorts").select("id, course_id, tenant_id").limit(1).single()).data;

  // Deltagare kan varken skapa eller flytta enrollments.
  const asPart = await a.rpc("create_enrollment", { p_cohort_id: cohort.id, p_user_id: A });
  assert.ok(asPart.error, "deltagare kunde skapa enrollment");
  const own = (await a.from("enrollments").select("id").eq("user_id", A).eq("status", "active").limit(1).single()).data;
  const mv = await a.rpc("move_enrollment", { p_enrollment_id: own.id, p_to_cohort_id: cohort.id });
  assert.ok(mv.error, "deltagare kunde flytta sin enrollment");

  // Admin-dubblett (Anna har redan aktiv plats på kursen) avvisas av det partiella indexet.
  const dup = await admin.from("enrollments").insert({
    tenant_id: cohort.tenant_id, user_id: A, cohort_id: cohort.id, course_id: cohort.course_id, starts_at: "2026-06-01",
  });
  assert.ok(dup.error, "andra aktiva enrollment på samma kurs borde avvisas");
});
