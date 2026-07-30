// GRIND 3 — gating-logikens kärnfall. Kör: npm run test:gating
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGating, isSectionComplete, type SectionRequirements } from "../src/lib/tenant/gating";

const empty = () => ({
  completedSectionIds: new Set<string>(),
  passedQuizIds: new Set<string>(),
  uploadedSectionIds: new Set<string>(),
});

const secs = (defs: { id: string; req?: SectionRequirements; drip?: number }[]) =>
  defs.map((d) => ({ id: d.id, requirements: d.req ?? { checkoff: true }, dripOffsetDays: d.drip ?? null }));

test("self_paced: sektion 1 öppen, 2 låst tills 1 klar", () => {
  const sections = secs([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
  const p = empty();
  let g = computeGating({ unlockMode: "self_paced", sections, progress: p });
  assert.equal(g[0].unlocked, true, "s1 ska vara öppen");
  assert.equal(g[1].unlocked, false, "s2 låst innan s1 klar");

  p.completedSectionIds.add("s1");
  g = computeGating({ unlockMode: "self_paced", sections, progress: p });
  assert.equal(g[1].unlocked, true, "s2 öppnas när s1 avbockad");
  assert.equal(g[2].unlocked, false, "s3 fortfarande låst");
});

test("scheduled: drip dag 7 öppnas dag 7, inte dag 6", () => {
  const cohortStart = new Date("2026-06-01T00:00:00Z");
  const sections = secs([
    { id: "s1", drip: 0 },
    { id: "s2", drip: 7 },
  ]);
  const day6 = computeGating({ unlockMode: "scheduled", sections, cohortStart, today: new Date("2026-06-07T00:00:00Z"), progress: empty() });
  assert.equal(day6[1].unlocked, false, "dag 6 (efter 6 dygn) → s2 låst");
  const day7 = computeGating({ unlockMode: "scheduled", sections, cohortStart, today: new Date("2026-06-08T00:00:00Z"), progress: empty() });
  assert.equal(day7[1].unlocked, true, "dag 7 → s2 öppen");
});

test("kombinerade villkor: checkoff + prov + upload kräver alla tre", () => {
  const s = { id: "sx", requirements: { checkoff: true, quiz_id: "q1", upload_required: true } };
  const p = empty();
  assert.equal(isSectionComplete(s, p), false, "inget uppfyllt");
  p.completedSectionIds.add("sx");
  assert.equal(isSectionComplete(s, p), false, "bara checkoff");
  p.passedQuizIds.add("q1");
  assert.equal(isSectionComplete(s, p), false, "checkoff + prov men ej upload");
  p.uploadedSectionIds.add("sx");
  assert.equal(isSectionComplete(s, p), true, "alla tre → klar");
});

test("PROVREGELN self_paced: underkänt/oavklarat prov låser nästa trots avbockning", () => {
  const sections = secs([
    { id: "s1", req: { checkoff: true, quiz_id: "q1" } },
    { id: "s2" },
  ]);
  const p = empty();
  p.completedSectionIds.add("s1"); // avbockad men provet EJ godkänt
  const g = computeGating({ unlockMode: "self_paced", sections, progress: p });
  assert.equal(g[1].unlocked, false, "s2 låst — provregeln överskrider avbockning");
  p.passedQuizIds.add("q1");
  const g2 = computeGating({ unlockMode: "self_paced", sections, progress: p });
  assert.equal(g2[1].unlocked, true, "s2 öppnas när provet godkänts");
});

test("PROVREGELN scheduled: tid låser aldrig upp förbi underkänt prov", () => {
  const cohortStart = new Date("2026-06-01T00:00:00Z");
  const sections = secs([
    { id: "s1", req: { checkoff: true, quiz_id: "q1" }, drip: 0 },
    { id: "s2", drip: 3 },
  ]);
  const p = empty();
  // Långt efter drip-datumet, men provet ej godkänt:
  const late = computeGating({ unlockMode: "scheduled", sections, cohortStart, today: new Date("2026-07-01T00:00:00Z"), progress: p });
  assert.equal(late[1].unlocked, false, "s2 låst trots att tiden gått — underkänt prov");
  p.passedQuizIds.add("q1");
  const ok = computeGating({ unlockMode: "scheduled", sections, cohortStart, today: new Date("2026-07-01T00:00:00Z"), progress: p });
  assert.equal(ok[1].unlocked, true, "s2 öppen när provet godkänts och tiden gått");
});

test("valfri sektion (optional) blockerar inte nästa i self_paced men förblir oavslutad", () => {
  const sections = secs([
    { id: "a" },
    { id: "b", req: { upload_required: true, optional: true } },
    { id: "c" },
  ]);
  const state = computeGating({
    unlockMode: "self_paced",
    sections,
    progress: { completedSectionIds: new Set(["a"]), passedQuizIds: new Set(), uploadedSectionIds: new Set() },
  });
  const byId = new Map(state.map((s) => [s.id, s]));
  assert.equal(byId.get("b")!.unlocked, true);
  assert.equal(byId.get("b")!.complete, false, "valfri utan uppladdning är fortfarande oavslutad");
  assert.equal(byId.get("c")!.unlocked, true, "valfri sektion släpper förbi sekvensen");
});
