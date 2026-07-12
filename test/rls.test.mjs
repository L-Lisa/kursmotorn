// GRIND 1 — RLS-isolationssvit. Kör: npm run test:rls
// Loggar in som riktiga seedade deltagare och bevisar att ingen kan läsa någon annans data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws'; // Node 20 saknar global WebSocket (supabase-js realtime kräver den)

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(URL && ANON, 'NEXT_PUBLIC_SUPABASE_URL/ANON_KEY saknas (kör med --env-file=.env.local)');

const PW = 'Testlosen123!';
const T1 = '10000000-0000-0000-0000-000000000001';
const T2 = '20000000-0000-0000-0000-000000000002';
const A = 'aaaaaaaa-0000-0000-0000-000000000001'; // Anna, tenant1
const B = 'bbbbbbbb-0000-0000-0000-000000000002'; // Bengt, tenant1
const C = 'cccccccc-0000-0000-0000-000000000003'; // Cecilia, tenant2
const T1_COURSE = '1c000000-0000-0000-0000-000000000001';
const T2_COURSE = '2c000000-0000-0000-0000-000000000002';
const QUIZ = '19000000-0000-0000-0000-000000000001';

const mk = () => createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});
async function signIn(email) {
  const c = mk();
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  assert.ok(!error, `login ${email}: ${error?.message}`);
  assert.ok(data.session, `ingen session för ${email}`);
  return c;
}

test('anon kan inte läsa kurser', async () => {
  const { data, error } = await mk().from('courses').select('id');
  assert.ok(error || (data && data.length === 0), 'anon fick kursdata utan inloggning');
});

test('Anna: bara egen tenant + egen deltagardata', async () => {
  const a = await signIn('anna@andning.test');
  const courses = await a.from('courses').select('id');
  assert.ok(!courses.error, courses.error?.message);
  assert.deepEqual(courses.data.map(r => r.id), [T1_COURSE]);

  const att = await a.from('quiz_attempts').select('user_id');
  assert.equal(att.data.length, 1, 'Anna ska bara se sitt eget försök');
  assert.ok(att.data.every(r => r.user_id === A));

  const up = await a.from('uploads').select('user_id');
  assert.ok(up.data.every(r => r.user_id === A));

  const ffmq = await a.from('mg_ffmq_responses').select('id');
  assert.equal(ffmq.data.length, 0, 'Anna ska inte se tenant2:s FFMQ');
});

test('Bengt ser inte Annas försök', async () => {
  const b = await signIn('bengt@andning.test');
  const att = await b.from('quiz_attempts').select('user_id');
  assert.equal(att.data.length, 1);
  assert.equal(att.data[0].user_id, B);
});

test('Anna kan inte skapa försök i Bengts namn (WITH CHECK)', async () => {
  const a = await signIn('anna@andning.test');
  const r = await a.from('quiz_attempts')
    .insert({ tenant_id: T1, quiz_id: QUIZ, user_id: B, answers: [0, 0], score: 0, passed: false });
  assert.ok(r.error, 'insert i annans namn borde blockeras av RLS WITH CHECK');
});

test('Tenant1-admin (ej plattformsadmin) ser tenant1, aldrig tenant2', async () => {
  const d = await signIn('admin1@andning.test');
  const att = await d.from('quiz_attempts').select('user_id');
  assert.equal(att.data.length, 2, 'tenant1-admin ser båda deltagarnas försök');
  const courses = await d.from('courses').select('id');
  assert.deepEqual(courses.data.map(r => r.id), [T1_COURSE]);
  const ffmq = await d.from('mg_ffmq_responses').select('id');
  assert.equal(ffmq.data.length, 0, 'tenant1-admin ser inget av tenant2');
  const certs = await d.from('certificates').select('id');
  assert.equal(certs.data.length, 1, 'tenant1-admin ser tenantens certifikat');
});

test('Cecilia ser bara tenant2', async () => {
  const c = await signIn('cecilia@mind.test');
  const courses = await c.from('courses').select('id');
  assert.deepEqual(courses.data.map(r => r.id), [T2_COURSE]);
  const att = await c.from('quiz_attempts').select('id');
  assert.equal(att.data.length, 0, 'Cecilia ser inget av tenant1');
  const ffmq = await c.from('mg_ffmq_responses').select('id');
  assert.equal(ffmq.data.length, 1);
});

test('practice_day dagsunik; guide_session inte', async () => {
  const a = await signIn('anna@andning.test');
  const admin = await signIn('admin1@andning.test'); // städar tenant1-loggar
  await admin.from('activity_logs').delete().eq('user_id', A).eq('logged_date', '2026-06-05');

  const pd = { tenant_id: T1, user_id: A, course_id: T1_COURSE, log_type: 'practice_day', logged_date: '2026-06-05', source: 'manual' };
  const first = await a.from('activity_logs').insert(pd);
  assert.ok(!first.error, `första practice_day borde gå: ${first.error?.message}`);
  const second = await a.from('activity_logs').insert(pd);
  assert.ok(second.error, 'andra practice_day samma dag borde avvisas av partiellt unikt index');
  await admin.from('activity_logs').delete().eq('user_id', A).eq('logged_date', '2026-06-05');

  const c = await signIn('cecilia@mind.test');
  const lisa = await signIn('lisa@kursmotorn.test'); // plattformsadmin, städar tenant2
  await lisa.from('activity_logs').delete().eq('user_id', C).eq('logged_date', '2026-06-10');
  const gs = { tenant_id: T2, user_id: C, course_id: T2_COURSE, log_type: 'guide_session', logged_date: '2026-06-10', source: 'manual' };
  const g1 = await c.from('activity_logs').insert(gs);
  const g2 = await c.from('activity_logs').insert(gs);
  assert.ok(!g1.error && !g2.error, `två guide_session samma dag borde tillåtas: ${g1.error?.message || g2.error?.message}`);
  await lisa.from('activity_logs').delete().eq('user_id', C).eq('logged_date', '2026-06-10');
});
