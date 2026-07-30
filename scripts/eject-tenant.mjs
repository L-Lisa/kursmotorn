// Kursmotorn — eject-exporten (fas 8, SPEC §2.11). Friköpet: en tenant exporteras
// som fristående paket. Kör: npm run eject -- <tenant-slug>
//
// Paketet (eject-output/<slug>/):
//   data/*.json        innehållspaket + deltagardata (GDPR-portabelt) — inkl.
//                      2026-07-11-tabellerna (cohorts, enrollments, activity_logs,
//                      log_type_defs, approvals, certvillkor) och mg_-tabellerna.
//   brand_spec.json    tenantens brand (mallens schema).
//   seed/seed.sql      genererade INSERT:ar (FK-ordning) — återskapar tenantens data
//                      i en fristående Supabase/Postgres med motorns schema.
//   standalone/        fristående kursvisare: statiska HTML-sidor i tenantens brand
//                      + minimal server (node server.mjs) — INGA externa anrop,
//                      ingen tenant-context-kod (statisk config, inbakad vid export).
//
// Uppladdade mediafiler (Storage) ingår INTE i v1-paketet — uploads.json listar
// path:erna; filflytt är en driftåtgärd vid faktiskt friköp (DECISIONS fas 8).
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import WebSocket from "ws";
import { marked } from "marked";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) throw new Error("Saknar env (kör med --env-file=.env.development.local)");
const slug = process.argv[2];
if (!slug) throw new Error("Ange tenant-slug: npm run eject -- <slug>");

const supa = createClient(URL_, KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } });

const { data: tenant, error: tErr } = await supa.from("tenants").select("*").eq("slug", slug).single();
if (tErr || !tenant) throw new Error(`okänd tenant: ${slug}`);
const TID = tenant.id;

const OUT = `eject-output/${slug}`;
mkdirSync(`${OUT}/data`, { recursive: true });
mkdirSync(`${OUT}/seed`, { recursive: true });
mkdirSync(`${OUT}/standalone`, { recursive: true });

function die(ctx, error) {
  if (error) {
    console.error(`FEL (${ctx}):`, error.message || error);
    process.exit(1);
  }
}

// ── 1. Datapaketet: alla tenantens rader, tabell för tabell (FK-ordning för seed) ──
const TABLES = [
  "tenants", "tenant_brands", "memberships",
  "courses", "modules", "sections", "content_images",
  "quizzes", "quiz_questions",
  "course_certificate_requirements", "log_type_defs",
  "cohorts", "enrollments", "activity_logs",
  "section_progress", "quiz_attempts", "uploads",
  "attestations", "certificates", "approvals",
  "mg_guide_status", "mg_ffmq_responses", "mg_billing_splits",
];

const exported = {}; // tabell → rader
for (const table of TABLES) {
  const col = table === "tenants" ? "id" : "tenant_id";
  const { data, error } = await supa.from(table).select("*").eq(col, TID).order("created_at", { ascending: true, nullsFirst: true });
  if (error && /column .* does not exist/.test(error.message)) {
    // tabeller utan created_at — hämta utan ordning
    const retry = await supa.from(table).select("*").eq(col, TID);
    die(table, retry.error);
    exported[table] = retry.data;
  } else {
    die(table, error);
    exported[table] = data;
  }
  writeFileSync(`${OUT}/data/${table}.json`, JSON.stringify(exported[table], null, 2));
}

// Deltagaridentiteter (GDPR-portabelt: id + e-post + namn för tenantens medlemmar).
const memberIds = exported.memberships.map((m) => m.user_id);
const users = [];
for (const uid of memberIds) {
  const { data } = await supa.auth.admin.getUserById(uid);
  if (data?.user) {
    users.push({ id: data.user.id, email: data.user.email, full_name: data.user.user_metadata?.full_name ?? null });
  }
}
writeFileSync(`${OUT}/data/users.json`, JSON.stringify(users, null, 2));

// ── 2. brand_spec.json ──
const brandSpec = exported.tenant_brands[0]?.brand_spec ?? {};
writeFileSync(`${OUT}/brand_spec.json`, JSON.stringify(brandSpec, null, 2));

// ── 3. seed.sql (genererade INSERT:ar i FK-ordning) ──
function sqlVal(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}
let sql = `-- Eject-seed för tenant "${slug}" — genererad ${new Date().toISOString().slice(0, 10)}.\n` +
  `-- Körs mot en fristående Postgres/Supabase där motorns schema (migrationerna) redan är applicerat.\n` +
  `-- Deltagarkonton (auth.users) återskapas separat ur data/users.json — id:na nedan refererar dem.\n\n`;
for (const table of TABLES) {
  const rows = exported[table];
  if (!rows?.length) continue;
  const cols = Object.keys(rows[0]);
  sql += `-- ${table} (${rows.length} rader)\n`;
  for (const row of rows) {
    sql += `insert into public.${table} (${cols.join(", ")}) values (${cols.map((c) => sqlVal(row[c])).join(", ")});\n`;
  }
  sql += "\n";
}
writeFileSync(`${OUT}/seed/seed.sql`, sql);

// ── 4. Standalone-visaren: statiska sidor i tenantens brand (statisk config) ──
const b = brandSpec.colors ?? {};
const colors = {
  bg: b.bg ?? "#FBFAF7", card: b.card ?? "#FFFFFF", primary: b.primary ?? "#3D5A48",
  primaryDark: b.primary_dark ?? "#2A3F32", text: b.text ?? "#26241E",
  muted: b.muted ?? "#777266", soft: b.soft ?? "#EEF2EC",
};
const displayName = brandSpec.display_name ?? brandSpec.tenant_name ?? slug;
const course = exported.courses[0];
const modules = exported.modules
  .filter((m) => m.course_id === course.id)
  .sort((a, c) => a.position - c.position)
  .map((m) => ({
    ...m,
    sections: exported.sections
      .filter((s) => s.module_id === m.id)
      .sort((a, c) => a.position - c.position),
  }));

const css = `
:root { --bg:${colors.bg}; --card:${colors.card}; --primary:${colors.primary}; --primary-dark:${colors.primaryDark}; --text:${colors.text}; --muted:${colors.muted}; --soft:${colors.soft}; }
* { box-sizing: border-box; margin: 0; }
body { background: var(--bg); color: var(--text); font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; }
header { border-bottom: 1px solid var(--soft); padding: 1rem 1.5rem; font-size: 1.1rem; }
header a { color: var(--text); text-decoration: none; }
main { max-width: 42rem; margin: 0 auto; padding: 3rem 1.5rem; }
h1 { font-size: 2rem; line-height: 1.25; margin-bottom: 2rem; }
h2 { font-size: 1.4rem; margin: 2.2em 0 .6em; border-top: 1px solid var(--soft); padding-top: 1.2em; }
h3, h4 { margin: 1.6em 0 .5em; }
p, ul, ol, blockquote, table, pre { margin-bottom: 1.05em; }
ul, ol { padding-left: 1.4em; }
blockquote { border-left: 3px solid var(--soft); padding-left: 1em; color: var(--muted); font-style: italic; }
hr { border: 0; border-top: 1px solid var(--soft); margin: 2em 0; }
table { width: 100%; border-collapse: collapse; font-size: .95rem; }
th, td { border: 1px solid var(--soft); padding: .5em .7em; text-align: left; vertical-align: top; }
th { background: var(--soft); }
.eyebrow { font-size: .75rem; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: .5rem; }
.card { background: var(--card); border: 1px solid var(--soft); border-radius: .5rem; padding: 1rem 1.25rem; margin-bottom: .75rem; display: block; color: var(--text); text-decoration: none; }
.card:hover { border-color: var(--primary); }
.card .n { color: var(--muted); font-size: .8rem; margin-right: .75rem; }
nav.pager { display: flex; justify-content: space-between; border-top: 1px solid var(--soft); margin-top: 3rem; padding-top: 1.25rem; }
nav.pager a { color: var(--primary); text-decoration: none; font-size: .9rem; }
`;
writeFileSync(`${OUT}/standalone/style.css`, css);

const page = (title, body) => `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><link rel="stylesheet" href="style.css"></head>
<body><header><a href="index.html">${displayName}</a></header><main>${body}</main></body></html>`;

const indexBody =
  `<p class="eyebrow">${brandSpec.certificate_title ?? ""}</p><h1>${course.display_name}</h1>` +
  modules.map((m, i) => `<a class="card" href="vecka-${i + 1}.html"><span class="n">${String(m.position).padStart(2, "0")}</span>${m.title}</a>`).join("");
writeFileSync(`${OUT}/standalone/index.html`, page(displayName, indexBody));

modules.forEach((m, i) => {
  const body =
    `<p class="eyebrow">${course.display_name}</p><h1>${m.title}</h1>` +
    (m.intro && m.intro.trim() ? marked.parse(m.intro) : "") +
    m.sections.map((s) => `<h2>${s.title}</h2>\n${s.content ? marked.parse(s.content) : ""}`).join("\n") +
    `<nav class="pager"><span>${i > 0 ? `<a href="vecka-${i}.html">← Föregående</a>` : ""}</span>` +
    `<a href="index.html">Översikt</a>` +
    `<span>${i + 2 <= modules.length ? `<a href="vecka-${i + 2}.html">Nästa →</a>` : ""}</span></nav>`;
  writeFileSync(`${OUT}/standalone/vecka-${i + 1}.html`, page(m.title, body));
});

writeFileSync(`${OUT}/standalone/server.mjs`, `// Minimal statisk server — inga beroenden, inga externa anrop.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8" };
const PORT = process.env.PORT || 4173;
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^\\/+/, "") || "index.html";
  try {
    const file = await readFile(join(import.meta.dirname, path === "" ? "index.html" : path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404); res.end("finns inte");
  }
}).listen(PORT, () => console.log(\`Kursvisaren: http://localhost:\${PORT}\`));
`);
writeFileSync(`${OUT}/standalone/package.json`, JSON.stringify({
  name: `${slug}-standalone`, private: true, type: "module",
  scripts: { start: "node server.mjs" },
}, null, 2));

writeFileSync(`${OUT}/README.md`, `# Eject-paket: ${displayName} (${slug})

Genererat ${new Date().toISOString().slice(0, 10)} av Kursmotorns eject-skript (fas 8).

- \`data/\` — innehålls- och deltagardata som JSON (GDPR-portabelt). \`users.json\` = deltagaridentiteter.
- \`brand_spec.json\` — varumärket (brand-spec-mallens schema).
- \`seed/seed.sql\` — återskapar tenantens data i en fristående Postgres/Supabase med motorns schema.
- \`standalone/\` — fristående kursvisare: \`cd standalone && npm start\` → http://localhost:4173. Statisk, inga externa anrop.

Uppladdade mediafiler (inspelningar) ingår inte i paketet — \`data/uploads.json\` listar Storage-sökvägarna; filflytt görs vid faktiskt friköp.
`);

const counts = Object.fromEntries(Object.entries(exported).map(([t, r]) => [t, r.length]).filter(([, n]) => n > 0));
console.log(`✓ Eject: ${slug} → ${OUT}`);
console.log(`  ${modules.length} moduler, ${exported.sections.length} sektioner, ${users.length} användare`);
console.log("  tabeller:", JSON.stringify(counts));
