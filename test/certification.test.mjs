// GRIND 5 — breathworks-regressionen (STÅENDE regressionsvakt fr.o.m. fas 5).
// Kör: npm run test:certification:local
//
// Verifierar affärslöftet i certifieringen: villkorstrion (sections_complete +
// final_quiz_pass{80} + attestation{live_session_honor}) ger EXAKT det beteende briefen
// låst — certifikat utfärdas när alla tre är uppfyllda, ALDRIG när något saknas. Varje
// villkor testas som ENSAM blockerare. Dessutom: deltagaren kan inte fejka ett certifikat
// (RLS), publik /verify fungerar utan inloggning, och ett revokerat certifikat visas som
// revokerat. Hermetisk: skapar en engångsdeltagare via service role och raderar (kaskad)
// efteråt → rör aldrig demo-tillståndet (Anna m.fl.).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SECRET_KEY;
assert.ok(URL && ANON && SVC, "URL/ANON/SUPABASE_SECRET_KEY saknas (kör med --env-file)");

const PW = "Regresstest123!";
const svc = createClient(URL, SVC, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});

let userId, tenantId, courseId, finalQuizId;
let checkoffSecs = [], uploadSecs = [];
let userClient; // inloggad engångsdeltagare

before(async () => {
  // Ankare: tenant #1 (breathworks) + dess publicerade kurs.
  const course = (await svc.from("courses").select("id, tenant_id")
    .eq("status", "published").order("created_at").limit(1).single()).data;
  courseId = course.id;
  tenantId = course.tenant_id;

  const secs = (await svc.from("sections")
    .select("id, requirements, modules!inner(course_id)")
    .eq("modules.course_id", courseId)).data;
  checkoffSecs = secs.filter((s) => s.requirements?.checkoff).map((s) => s.id);
  uploadSecs = secs.filter((s) => s.requirements?.upload_required).map((s) => s.id);
  finalQuizId = (await svc.from("quizzes").select("id")
    .eq("course_id", courseId).eq("is_final", true).single()).data.id;

  // Engångsdeltagare (fiktiv), medlem i tenant #1.
  const email = `regress-${Date.now()}@andning.test`;
  const created = await svc.auth.admin.createUser({
    email, password: PW, email_confirm: true, user_metadata: { full_name: "Åsa Öhman" },
  });
  assert.ok(!created.error, `createUser: ${created.error?.message}`);
  userId = created.data.user.id;
  const mem = await svc.from("memberships").insert({ user_id: userId, tenant_id: tenantId, role: "participant" });
  assert.ok(!mem.error, `membership: ${mem.error?.message}`);

  userClient = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket },
  });
  const login = await userClient.auth.signInWithPassword({ email, password: PW });
  assert.ok(!login.error && login.data.session, `login: ${login.error?.message}`);
});

after(async () => {
  if (userId) await svc.auth.admin.deleteUser(userId); // kaskad rensar alla rader
});

// ── Villkorssättare (service role, kringgår RLS för test-setup) ──
async function setSections(on) {
  await svc.from("section_progress").delete().eq("user_id", userId);
  await svc.from("uploads").delete().eq("user_id", userId);
  if (on) {
    await svc.from("section_progress").insert(checkoffSecs.map((id) => ({ tenant_id: tenantId, user_id: userId, section_id: id })));
    await svc.from("uploads").insert(uploadSecs.map((id) => ({ tenant_id: tenantId, user_id: userId, section_id: id, storage_path: `${tenantId}/${userId}/${id}/v.mp4`, size_bytes: 1 })));
  }
}
async function setQuiz(on) {
  await svc.from("quiz_attempts").delete().eq("user_id", userId);
  if (on) await svc.from("quiz_attempts").insert({ tenant_id: tenantId, quiz_id: finalQuizId, user_id: userId, answers: {}, score: 90, passed: true });
}
async function setAttestation(on) {
  await svc.from("attestations").delete().eq("user_id", userId);
  if (on) await svc.from("attestations").insert({ tenant_id: tenantId, user_id: userId, course_id: courseId, type: "live_session_honor", statement_text: "test" });
}
const tryIssue = () => userClient.rpc("issue_certificate", { p_course_id: courseId });
const statusOf = async () => (await userClient.rpc("certificate_status", { p_course_id: courseId })).data;

test("sole blocker: sections_complete saknas ⇒ utfärdande nekas", async () => {
  await setSections(false); await setQuiz(true); await setAttestation(true);
  const st = await statusOf();
  assert.equal(st.requirements.find((r) => r.type === "sections_complete").met, false);
  assert.equal(st.all_met, false);
  const r = await tryIssue();
  assert.ok(r.error, "utfärdande borde ha nekats");
  assert.match(r.error.message, /villkor ej uppfyllt/);
});

test("sole blocker: final_quiz_pass saknas ⇒ utfärdande nekas", async () => {
  await setSections(true); await setQuiz(false); await setAttestation(true);
  const st = await statusOf();
  assert.equal(st.requirements.find((r) => r.type === "final_quiz_pass").met, false);
  const r = await tryIssue();
  assert.ok(r.error, "utfärdande borde ha nekats");
});

test("sole blocker: attestation saknas ⇒ utfärdande nekas", async () => {
  await setSections(true); await setQuiz(true); await setAttestation(false);
  const st = await statusOf();
  assert.equal(st.requirements.find((r) => r.type === "attestation").met, false);
  const r = await tryIssue();
  assert.ok(r.error, "utfärdande borde ha nekats");
});

test("provregeln: 79 % på slutprovet räcker inte (tröskel 80)", async () => {
  await setSections(true); await setAttestation(true);
  await svc.from("quiz_attempts").delete().eq("user_id", userId);
  await svc.from("quiz_attempts").insert({ tenant_id: tenantId, quiz_id: finalQuizId, user_id: userId, answers: {}, score: 79, passed: false });
  assert.equal((await statusOf()).requirements.find((r) => r.type === "final_quiz_pass").met, false);
  assert.ok((await tryIssue()).error, "79 % borde inte ge certifikat");
});

test("alla tre uppfyllda ⇒ certifikat utfärdas (och är idempotent)", async () => {
  await setSections(true); await setQuiz(true); await setAttestation(true);
  assert.equal((await statusOf()).all_met, true);
  const r1 = await tryIssue();
  assert.ok(!r1.error && r1.data.verify_slug, `utfärdande: ${r1.error?.message}`);
  const r2 = await tryIssue();
  assert.ok(r2.data.reused && r2.data.verify_slug === r1.data.verify_slug, "andra utfärdandet borde återanvända samma certifikat");
});

test("deltagaren kan inte fejka ett certifikat (RLS nekar direkt-insert)", async () => {
  const forge = await userClient.from("certificates").insert({
    tenant_id: tenantId, user_id: userId, course_id: courseId, holder_name: "Fusk", verify_slug: "forge-" + Date.now(),
  });
  assert.ok(forge.error, "deltagare kunde själv-inserta ett certifikat");
});

test("publik /verify fungerar anonymt och visar rätt data; revokerat visas som revokerat", async () => {
  const slug = (await svc.from("certificates").select("verify_slug").eq("user_id", userId).is("revoked_at", null).single()).data.verify_slug;
  const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } });

  const v = (await anon.rpc("verify_certificate", { p_slug: slug })).data;
  assert.equal(v.holder_name, "Åsa Öhman", "holder_name (å/ä/ö) fel i publik verifiering");
  assert.equal(v.status, "valid");
  assert.equal(v.tenant_slug, "andningskursen");
  assert.ok(!("user_id" in v) && !("email" in v), "publik verifiering läckte persondata");

  // Revokera → publik verifiering visar revoked.
  await svc.from("certificates").update({ revoked_at: new Date().toISOString() }).eq("verify_slug", slug);
  const v2 = (await anon.rpc("verify_certificate", { p_slug: slug })).data;
  assert.equal(v2.status, "revoked");

  const bad = (await anon.rpc("verify_certificate", { p_slug: "finns-inte-xyz" })).data;
  assert.equal(bad, null, "okänd slug borde ge null");
});
