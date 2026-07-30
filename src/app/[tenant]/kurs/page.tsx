import { redirect } from "next/navigation";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import Link from "next/link";
import { getCourseForTenant, getGatingState, getCourseQuizzes, getCourseLogTypes } from "@/lib/tenant/course";
import { SignOutButton } from "@/components/sign-out-button";
import { CheckoffButton } from "./checkoff-button";
import { UploadControl } from "./upload-control";

/**
 * Inloggad, tenant-brandad kursvy (fas 3). Renderar strukturen + avbockning +
 * progress + gating (upplåst/låst) i tenantens varumärke — samma komponent, två brands.
 * RLS gatar allt: en icke-medlem får ingen kurs (course === null).
 */
export default async function TenantCourse({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const { tenantId, brand } = await getTenantContext(tenant);

  const user = await getCurrentUser();
  if (!user) redirect(`/${tenant}/login`);

  const course = await getCourseForTenant(tenantId);
  const gating = course ? await getGatingState(course, user.id) : null;
  const quizzes = course ? await getCourseQuizzes(course.id, user.id) : [];
  const logTypes = course ? await getCourseLogTypes(course.id) : [];
  const hasPracticeLog = logTypes.some((t) => t.logType === "practice_day");
  const hasGuideLog = logTypes.some((t) => t.logType === "guide_session");

  const totalSections = course?.modules.reduce((n, m) => n + m.sections.length, 0) ?? 0;
  const doneSections =
    course && gating
      ? course.modules.reduce(
          (n, m) => n + m.sections.filter((s) => gating.get(s.id)?.complete).length,
          0,
        )
      : 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--t-soft)] px-6 py-4">
        <span className="font-[family-name:var(--t-serif)] text-lg text-[var(--t-text)]">
          {brand.displayName}
        </span>
        <SignOutButton redirectTo={`/${tenant}/login`} />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        {!course ? (
          <p className="text-[var(--t-muted)]">
            Ingen publicerad kurs för det här kontot ännu.
          </p>
        ) : (
          <>
            <p className="mb-2 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
              {brand.certificateTitle}
            </p>
            <h1 className="mb-3 font-[family-name:var(--t-serif)] text-4xl text-[var(--t-text)]">
              {course.displayName}
            </h1>
            <p className="mb-4 font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
              {doneSections}/{totalSections} avbockade ·{" "}
              {course.unlockMode === "scheduled" ? "schemalagd" : "egen takt"}
            </p>
            {(hasPracticeLog || hasGuideLog) && (
              <p className="mb-10 flex gap-5">
                {hasPracticeLog && (
                  <Link
                    href={`/${tenant}/kurs/logg`}
                    className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-primary)] hover:underline"
                  >
                    Praxislogg →
                  </Link>
                )}
                {hasGuideLog && (
                  <Link
                    href={`/${tenant}/kurs/guideresa`}
                    className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-primary)] hover:underline"
                  >
                    Min guideresa →
                  </Link>
                )}
              </p>
            )}
            {!hasPracticeLog && !hasGuideLog && <div className="mb-6" />}

            <ol className="flex flex-col gap-4">
              {course.modules.map((m) => {
                const done = m.sections.filter((s) => gating?.get(s.id)?.complete).length;
                return (
                  <li
                    key={m.id}
                    className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
                        {String(m.position).padStart(2, "0")}
                      </span>
                      <h2 className="font-[family-name:var(--t-serif)] text-xl text-[var(--t-text)]">
                        <Link href={`/${tenant}/kurs/vecka/${m.id}`} className="hover:underline">
                          {m.title.replace(/^Modul\s+\d+\s+—\s+/, "")}
                        </Link>
                      </h2>
                      <span className="ml-auto font-[family-name:var(--t-mono)] text-[10px] text-[var(--t-muted)]">
                        {done}/{m.sections.length}
                      </span>
                    </div>

                    <ul className="mt-4 flex flex-col divide-y divide-[var(--t-soft)]">
                      {m.sections.map((s) => {
                        const g = gating?.get(s.id);
                        const locked = !g?.unlocked;
                        const req = s.requirements ?? {};
                        return (
                          <li
                            key={s.id}
                            className={`flex items-center gap-3 py-2.5 text-sm ${
                              locked ? "text-[var(--t-muted)]" : "text-[var(--t-text)]"
                            }`}
                          >
                            {req.checkoff ? (
                              <CheckoffButton
                                tenant={tenant}
                                sectionId={s.id}
                                complete={!!g?.complete}
                                locked={locked}
                              />
                            ) : (
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] ${
                                  g?.complete ? "text-[var(--t-primary)]" : "text-[var(--t-muted)]"
                                }`}
                                aria-hidden
                              >
                                {g?.complete ? "✓" : "•"}
                              </span>
                            )}
                            <span>{s.title.replace(/^Sektion\s+\S+\s+/, "")}</span>
                            {req.upload_required && (
                              <span className="ml-auto">
                                <UploadControl
                                  tenant={tenant}
                                  tenantId={tenantId}
                                  sectionId={s.id}
                                  complete={!!g?.complete}
                                  locked={locked}
                                />
                              </span>
                            )}
                            {req.quiz_id && (
                              <span className="ml-auto rounded-full bg-[var(--t-soft)] px-2 py-0.5 font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-primary-dark)]">
                                Prov
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>

            {quizzes.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-4 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
                  Prov
                </h2>
                <ul className="flex flex-col gap-2">
                  {quizzes.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-3 rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] px-5 py-3 text-sm"
                    >
                      <span
                        className={`text-[13px] ${q.passed ? "text-[var(--t-primary)]" : "text-[var(--t-muted)]"}`}
                        aria-hidden
                      >
                        {q.passed ? "✓" : "•"}
                      </span>
                      <span className="text-[var(--t-text)]">{q.title}</span>
                      {q.isFinal && (
                        <span className="rounded-full bg-[var(--t-soft)] px-2 py-0.5 font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-primary-dark)]">
                          Slutprov
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-3">
                        {q.attempts > 0 && (
                          <span className="font-[family-name:var(--t-mono)] text-[10px] text-[var(--t-muted)]">
                            {q.passed ? "Godkänt" : `${q.attempts}${q.maxAttempts ? `/${q.maxAttempts}` : ""} försök`}
                          </span>
                        )}
                        {!q.passed && !(q.maxAttempts !== null && q.attempts >= q.maxAttempts) && (
                          <Link
                            href={`/${tenant}/kurs/prov/${q.id}`}
                            className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-primary)] hover:underline"
                          >
                            {q.attempts > 0 ? "Gör om →" : "Ta provet →"}
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-10 flex items-center justify-between rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] px-5 py-4">
              <div>
                <p className="font-[family-name:var(--t-serif)] text-[15px] text-[var(--t-text)]">
                  Certifiering
                </p>
                <p className="font-[family-name:var(--t-mono)] text-[11px] text-[var(--t-muted)]">
                  Krav, intyg och ditt certifikat
                </p>
              </div>
              <Link
                href={`/${tenant}/kurs/intyg`}
                className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-primary)] hover:underline"
              >
                Gå till certifiering →
              </Link>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
