// MG-parsern (fas 7): C-FINAL-veckoformatet → modul + sektioner. Innehållet är
// LÅST och faktagranskat — parsern delar bara upp, skriver ALDRIG om (repo-CLAUDE.md #6).
// Verbatim-garantin är inbyggd: rebuildWeek(parseWeek(md)) === md, annars kastar parsern.
//
// Format (C-FINAL-vecka-N.md): `# Vecka N: Titel` följt av `## `-sektioner.
// Allt mellan rubrikraden och första `## ` blir modulens intro (t.ex. `---`-avdelare);
// varje `## `-block blir en sektion (rubrik utan prefix, innehållet ordagrant inkl.
// efterföljande `---`-avdelare fram till nästa `## `).

/** @returns {{ position: number, title: string, intro: string, sections: {title: string, content: string}[] }} */
export function parseWeek(md, weekNumber) {
  const titleMatch = md.match(/^# (.+)\n/);
  if (!titleMatch) throw new Error(`vecka ${weekNumber}: ingen H1-rubrik`);
  const title = titleMatch[1];
  const afterTitle = md.slice(titleMatch[0].length);

  // Hitta alla '## '-rubrikstarter (radbörjan).
  const headingRe = /^## (.+)$/gm;
  const marks = [];
  let m;
  while ((m = headingRe.exec(afterTitle)) !== null) {
    marks.push({ index: m.index, headingLine: m[0], title: m[1] });
  }
  if (marks.length === 0) throw new Error(`vecka ${weekNumber}: inga ##-sektioner`);

  const intro = afterTitle.slice(0, marks[0].index);
  const sections = marks.map((mark, i) => {
    const start = mark.index + mark.headingLine.length;
    const end = i + 1 < marks.length ? marks[i + 1].index : afterTitle.length;
    return { title: mark.title, content: afterTitle.slice(start, end) };
  });

  const week = { position: weekNumber, title, intro, sections };

  // Verbatim-garantin: återuppbyggd fil måste vara tecken-identisk med källan.
  if (rebuildWeek(week) !== md) {
    throw new Error(`vecka ${weekNumber}: verbatim-kontrollen föll — parsern tappar tecken`);
  }
  return week;
}

/** Återuppbygger källfilen ur parse-resultatet (verbatim-kontrollen + diff-testet). */
export function rebuildWeek(week) {
  return (
    `# ${week.title}\n` +
    week.intro +
    week.sections.map((s) => `## ${s.title}${s.content}`).join("")
  );
}
