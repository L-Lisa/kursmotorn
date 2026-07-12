// Kursmotorn — markdown-parser (kurs/modul-N.md → strukturerad kursdata).
// Formatkontrakt: ../../../kurs/kursplan.md ("Format per modulfil") + faktisk struktur i modul-1..9.
// Regel: prosan importeras ORDAGRANT. Parsern strippar bara strukturmarkörer (rubriker,
// källkommentarer) — den skriver ALDRIG om text. Vid osäkerhet: kasta, gissa aldrig.

const H2 = /^##\s+(.+?)\s*$/;

/** Delar en modulfil i intro + block per `## rubrik`. */
function splitBlocks(md) {
  const lines = md.split("\n");
  const preamble = [];
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(H2);
    if (m) {
      if (cur) blocks.push(cur);
      cur = { heading: m[1], body: [] };
    } else if (cur) {
      cur.body.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (cur) blocks.push(cur);
  return { preamble: preamble.join("\n"), blocks: blocks.map((b) => ({ heading: b.heading, body: b.body.join("\n") })) };
}

/** Tar bort HTML-kommentarer (källhänvisningar = byggmetadata, inte deltagarinnehåll) och trimmar. */
function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Parsar ett provfråge-block. Hanterar tre format i kursen:
 *  1) `**Fråga N.**` + `A)`/`a)` + `**Rätt svar: X.**` + Motivering        (modul 1–3)
 *  2) `**N. frågetext?**` + `a)` + `**Rätt svar: x.**` + motivering          (modul 4–6)
 *  3) `**Fråga N.**` + `a)` med inline `✔` + `*Motivering: …*` (ingen Rätt svar-rad) (modul 7–8)
 * Facit tas i första hand från `**Rätt svar: X.**`, annars från ✔-markören.
 */
export function parseQuestions(body) {
  const qFraga = /^\*\*Fråga\s+\d+\.\*\*\s*(.*)$/;
  const qNum = /^\*\*(\d+)\.\s+(.+?)\*\*\s*$/;
  const optRe = /^([A-Da-d])\)\s*(.+?)\s*(✔)?\s*$/;
  const ansRe = /^\*\*R[äa]tt svar:\s*([A-Da-d])\.?\*\*\s*(.*)$/;

  const out = [];
  let cur = null;

  const finalize = () => {
    if (!cur || !cur.question) {
      cur = null;
      return;
    }
    let idx = null;
    if (cur.correctLetter) {
      idx = cur.correctLetter.charCodeAt(0) - 65;
    } else {
      const checked = cur.options.findIndex((o) => o.check);
      idx = checked;
    }
    const options = cur.options.map((o) => o.text);
    if (options.length < 2 || idx == null || idx < 0 || idx >= options.length) {
      throw new Error(`Ofullständig fråga (alt=${options.length}, facit=${idx}): "${cur.question.slice(0, 50)}"`);
    }
    const explanation = cur.expl
      .replace(/\*/g, "")
      .replace(/^Motivering:\s*/i, "")
      .trim();
    out.push({ question: cur.question.trim(), options, correctIndex: idx, explanation });
    cur = null;
  };

  for (const raw of body.split("\n")) {
    const line = raw.trim();
    let m;
    if ((m = line.match(qFraga))) {
      finalize();
      cur = { question: m[1] || "", options: [], correctLetter: null, expl: "" };
      continue;
    }
    if ((m = line.match(qNum))) {
      finalize();
      cur = { question: m[2].trim(), options: [], correctLetter: null, expl: "" };
      continue;
    }
    if (!cur) continue;
    if ((m = line.match(ansRe))) {
      cur.correctLetter = m[1].toUpperCase();
      cur.expl += (cur.expl ? " " : "") + (m[2] || "");
      continue;
    }
    if ((m = line.match(optRe))) {
      cur.options.push({ letter: m[1].toUpperCase(), text: m[2].trim(), check: !!m[3] });
      continue;
    }
    if (!line) continue;
    // efter alternativ: motivering; annars frågetext på flera rader
    if (cur.options.length || /^\*?Motivering/i.test(line)) {
      cur.expl += (cur.expl ? " " : "") + line;
    } else {
      cur.question += (cur.question ? " " : "") + line;
    }
  }
  finalize();
  return out;
}

/** Parsar en hel modulfil. */
export function parseModule(md) {
  const titleLine = (md.match(/^#\s+(.+)$/m) || [])[1];
  if (!titleLine) throw new Error("saknar # Modul-rubrik");
  const posMatch = titleLine.match(/Modul\s+(\d+)/i);
  const position = posMatch ? parseInt(posMatch[1], 10) : null;

  const syfte = (md.match(/^>\s*Syfte:.*$/m) || [])[0] || "";
  const uploadRequired = /🎥/.test(syfte);

  const { preamble, blocks } = splitBlocks(md);
  // intro = preamble minus titel + syfte-blockquote
  const intro = stripComments(
    preamble
      .split("\n")
      .filter((l) => !l.startsWith("# ") && !l.startsWith("> "))
      .join("\n"),
  );

  const sections = [];
  let quiz = null;
  let isFinalExam = false;

  for (const b of blocks) {
    const h = b.heading;
    if (/^Provfrågor/i.test(h)) {
      quiz = { title: "Prov", questions: parseQuestions(b.body), isFinal: false };
    } else if (/Slutprovet/i.test(h)) {
      // Modul 9 §9.4: slutprovet — final quiz, INTE en innehållssektion
      quiz = { title: "Slutprov", questions: parseQuestions(b.body), isFinal: true };
      isFinalExam = true;
    } else {
      sections.push({ title: h.trim(), content: stripComments(b.body) });
    }
  }

  return { position, title: titleLine.trim(), intro, uploadRequired, sections, quiz, isFinalExam };
}
