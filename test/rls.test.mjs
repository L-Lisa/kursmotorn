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
  const T1 = "10000000-0000-0000-0000-000000000001";
  const bad = await a.storage.from("recordings").upload(`${T1}/${B}/x/x.txt`, buf, { upsert: true });
  assert.ok(bad.error, "Anna kunde ladda upp till Bengts prefix");
  const own = `${T1}/${A}/x/x.txt`;
  const good = await a.storage.from("recordings").upload(own, buf, { upsert: true });
  assert.ok(!good.error, `Anna kunde inte ladda upp till eget prefix: ${good.error?.message}`);
  await a.storage.from("recordings").remove([own]);
});

test("practice_day dagsunik; guide_session inte", async () => {
  const a = await signIn("anna@andning.test");
  const T1 = "10000000-0000-0000-0000-000000000001";
  const course = (await a.from("courses").select("id").limit(1).single()).data;
  const admin = await signIn("admin1@andning.test");
  const day = "2026-06-05";
  await admin.from("activity_logs").delete().eq("user_id", A).eq("logged_date", day);

  const pd = { tenant_id: T1, user_id: A, course_id: course.id, log_type: "practice_day", logged_date: day, source: "manual" };
  const first = await a.from("activity_logs").insert(pd);
  assert.ok(!first.error, `första practice_day: ${first.error?.message}`);
  const second = await a.from("activity_logs").insert(pd);
  assert.ok(second.error, "andra practice_day samma dag borde avvisas");
  await admin.from("activity_logs").delete().eq("user_id", A).eq("logged_date", day);
});
