// Kursmotorn — kursimport (fas 3). Parsar kurs/modul-N.md → DB för Andningskursen.
// Kör: npm run import   (mot lokal Docker-DB; env ur .env.development.local)
// Idempotent: rensar kursens innehåll och importerar om. Innehållet skrivs ORDAGRANT.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import WebSocket from "ws"; // Node 20 saknar global WebSocket (supabase-js realtime)
import { parseModule } from "./lib/parse-course.mjs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) throw new Error("Saknar env (kör med --env-file=.env.development.local)");

const supa = createClient(URL, KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket },
});

const TENANT = "10000000-0000-0000-0000-000000000001"; // Andningskursen
const COURSE = "1c000000-0000-0000-0000-000000000001";
const KURS_DIR = "/Users/lisa/COWORK/projects/kursmotorn/kurs";

const DEFAULT_REQ = { checkoff: true, quiz_id: null, upload_required: false };
const UPLOAD_REQ = { checkoff: false, quiz_id: null, upload_required: true };

function die(ctx, error) {
  if (error) {
    console.error(`FEL (${ctx}):`, error.message || error);
    process.exit(1);
  }
}

// 1. Rensa kursens befintliga innehåll (cascade tar sektioner/frågor)
die("radera modules", (await supa.from("modules").delete().eq("course_id", COURSE)).error);
die("radera quizzes", (await supa.from("quizzes").delete().eq("course_id", COURSE)).error);

let secCount = 0;
let qCount = 0;

for (let n = 1; n <= 9; n++) {
  const md = readFileSync(`${KURS_DIR}/modul-${n}.md`, "utf8");
  const m = parseModule(md);

  const { data: mod, error: modErr } = await supa
    .from("modules")
    .insert({ tenant_id: TENANT, course_id: COURSE, position: m.position, title: m.title, intro: m.intro })
    .select("id")
    .single();
  die(`modul ${n}`, modErr);

  // Sektioner: innehållssektioner ur filen + (för 🎥-moduler) en dedikerad
  // inlämningssektion sist (SPEC §2.2: "modulen låser nästa" = sista sektionens upload-krav).
  const rows = m.sections.map((s, i) => ({
    tenant_id: TENANT,
    module_id: mod.id,
    position: i + 1,
    title: s.title,
    content: s.content,
    requirements: DEFAULT_REQ,
  }));
  if (m.uploadRequired) {
    rows.push({
      tenant_id: TENANT,
      module_id: mod.id,
      position: rows.length + 1,
      title: "Inlämning (inspelning)",
      content: "Ladda upp din inspelade guidning (MP4) för den här modulen. Uppladdningen låser upp nästa modul.",
      requirements: UPLOAD_REQ,
    });
  }
  const { error: secErr } = await supa.from("sections").insert(rows);
  die(`sektioner modul ${n}`, secErr);
  secCount += rows.length;

  // Prov: per-modul (självkoll, is_final=false) eller slutprov (modul 9, is_final=true).
  if (m.quiz && m.quiz.questions.length) {
    const { data: quiz, error: qErr } = await supa
      .from("quizzes")
      .insert({
        tenant_id: TENANT,
        course_id: COURSE,
        section_id: null,
        title: m.quiz.isFinal ? "Slutprov" : `Prov — modul ${m.position}`,
        pass_threshold: 80,
        max_attempts: m.quiz.isFinal ? 3 : null,
        is_final: m.quiz.isFinal,
      })
      .select("id")
      .single();
    die(`prov modul ${n}`, qErr);

    const qRows = m.quiz.questions.map((q, i) => ({
      tenant_id: TENANT,
      quiz_id: quiz.id,
      position: i + 1,
      question: q.question,
      options: q.options,
      correct_index: q.correctIndex,
      explanation: q.explanation,
    }));
    die(`frågor modul ${n}`, (await supa.from("quiz_questions").insert(qRows)).error);
    qCount += qRows.length;
  }

  console.log(`✓ Modul ${m.position}: ${rows.length} sektioner${m.quiz?.questions.length ? `, ${m.quiz.questions.length} frågor${m.quiz.isFinal ? " (slutprov)" : ""}` : ""}`);
}

console.log(`\nKlart. ${secCount} sektioner, ${qCount} provfrågor importerade till Andningskursen.`);
