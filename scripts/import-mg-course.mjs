// Kursmotorn — MG-importen (fas 7). C-FINAL-vecka-1..9.md → DB för Mindfulnessguiden.
// Kör: npm run import:mg   (lokal Docker-DB; env ur .env.development.local)
// Idempotent: rensar kursens innehåll och importerar om. Innehållet skrivs ORDAGRANT
// (parserns verbatim-garanti) — ändringar i kursen är Lisas, aldrig byggets.
//
// Modul→sektion-mappning: en vecka = en modul; varje ##-rubrik = en sektion
// (checkoff). Sist i varje vecka läggs en dedikerad uppladdningssektion (V1–V9).
// Lisas beslut 2026-07-30: uppladdningen LÅSER INTE nästa vecka (optional: true) —
// certvillkoret upload_sections (min 1 per sektion) spärrar certifikatet i stället.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import WebSocket from "ws";
import { parseWeek } from "./lib/parse-mg-course.mjs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) throw new Error("Saknar env (kör med --env-file=.env.development.local)");

const supa = createClient(URL, KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket },
});

const TENANT = "20000000-0000-0000-0000-000000000002"; // Mindfulnessguiden
const COURSE = "2c000000-0000-0000-0000-000000000002";
const SRC_DIR = "/Users/lisa/COWORK/projects/mindfulnessguiden/kursinnehall";

const READ_REQ = { checkoff: true, quiz_id: null, upload_required: false };
const UPLOAD_REQ = { checkoff: false, quiz_id: null, upload_required: true, optional: true };

function die(ctx, error) {
  if (error) {
    console.error(`FEL (${ctx}):`, error.message || error);
    process.exit(1);
  }
}

die("radera modules", (await supa.from("modules").delete().eq("course_id", COURSE)).error);

let secCount = 0;
const uploadSectionIds = []; // V1–V9, i veckoordning — blir upload_sections-config

for (let n = 1; n <= 9; n++) {
  const md = readFileSync(`${SRC_DIR}/C-FINAL-vecka-${n}.md`, "utf8");
  const w = parseWeek(md, n); // kastar om verbatim-kontrollen faller

  const { data: mod, error: modErr } = await supa
    .from("modules")
    .insert({ tenant_id: TENANT, course_id: COURSE, position: w.position, title: w.title, intro: w.intro })
    .select("id")
    .single();
  die(`vecka ${n}`, modErr);

  const rows = w.sections.map((s, i) => ({
    tenant_id: TENANT,
    module_id: mod.id,
    position: i + 1,
    title: s.title,
    content: s.content,
    requirements: READ_REQ,
  }));
  rows.push({
    tenant_id: TENANT,
    module_id: mod.id,
    position: rows.length + 1,
    title: `Ladda upp din inspelning (V${n})`,
    content:
      "Ladda upp veckans inspelning som MP4. Du kan ladda upp flera versioner — " +
      "minst en behövs för certifieringen. Läsningen fortsätter i din egen takt.",
    requirements: UPLOAD_REQ,
  });

  const { data: inserted, error: secErr } = await supa
    .from("sections")
    .insert(rows)
    .select("id, position");
  die(`sektioner vecka ${n}`, secErr);
  uploadSectionIds.push(inserted.sort((a, b) => a.position - b.position).at(-1).id);
  secCount += rows.length;

  console.log(`✓ Vecka ${w.position}: ${rows.length} sektioner (varav 1 uppladdning V${n})`);
}

// MG:s certvillkor (fyra typade krav — datamodellens MG-konfig; utfärdande-UI är fas B,
// villkoren ska bara stå RÄTT i DB). upload_sections-id:na kommer från importen ovan.
die("radera certvillkor", (await supa.from("course_certificate_requirements").delete().eq("course_id", COURSE)).error);
die("certvillkor", (await supa.from("course_certificate_requirements").insert([
  { tenant_id: TENANT, course_id: COURSE, position: 1, type: "sections_complete", config: {} },
  {
    tenant_id: TENANT, course_id: COURSE, position: 2, type: "log_threshold",
    config: { log_type: "practice_day", min_days_per_week: 5, weeks: 6, window_anchor: "enrollment_starts_at" },
  },
  {
    tenant_id: TENANT, course_id: COURSE, position: 3, type: "upload_sections",
    config: { section_ids: uploadSectionIds, min_per_section: 1 },
  },
  {
    tenant_id: TENANT, course_id: COURSE, position: 4, type: "manual_approval",
    config: { approval_type: "certifieringssession" },
  },
])).error);

console.log(`\nKlart. ${secCount} sektioner (9 uppladdningssektioner V1–V9) + 4 certvillkor importerade till Mindfulnessguiden.`);
