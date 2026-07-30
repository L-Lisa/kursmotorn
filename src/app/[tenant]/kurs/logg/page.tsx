import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { getCourseForTenant } from "@/lib/tenant/course";
import { getPracticeLog, getCertRequirements, requirementLabel } from "@/lib/tenant/logg";
import { SignOutButton } from "@/components/sign-out-button";
import { PracticeLogForm } from "./practice-log-form";

/**
 * Praxisloggen (fas 7, godkända specen §3.1). Veckovy: "X av N dagar den här veckan",
 * fönstren som stilla progressrad, certstatus per krav. Tonen är kvitto och
 * uppmuntran — aldrig streaks, aldrig skam. "Loggen är kvittot, inte piskan."
 */
export default async function PracticeLogPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const { tenantId, brand } = await getTenantContext(tenant);
  const user = await getCurrentUser();
  if (!user) redirect(`/${tenant}/login`);

  const course = await getCourseForTenant(tenantId);
  if (!course) notFound();

  const [log, cert] = await Promise.all([
    getPracticeLog(course, user.id),
    getCertRequirements(course.id),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--t-soft)] px-6 py-4">
        <Link
          href={`/${tenant}/kurs`}
          className="font-[family-name:var(--t-serif)] text-lg text-[var(--t-text)] hover:underline"
        >
          {brand.displayName}
        </Link>
        <SignOutButton redirectTo={`/${tenant}/login`} />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="mb-2 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
          Praxislogg
        </p>
        <h1 className="mb-3 font-[family-name:var(--t-serif)] text-3xl text-[var(--t-text)]">
          Loggen är kvittot
        </h1>
        <p className="mb-10 max-w-prose text-[15px] leading-relaxed text-[var(--t-muted)]">
          Meditationer du spelar i appen loggas automatiskt när de är genomförda. Övar du
          utanför appen — tyst, på egen hand, var som helst — markerar du dagen här.
          Det räknas fullt ut.
        </p>

        {log.currentWindow && (
          <div className="mb-8 rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5">
            <p className="font-[family-name:var(--t-serif)] text-xl text-[var(--t-text)]">
              {log.currentWindow.daysLogged} av {log.currentWindow.target} dagar den här veckan
            </p>
            <p className="mt-1 text-sm text-[var(--t-muted)]">
              Vecka {log.currentWindow.index} av {log.weeks}.
            </p>
          </div>
        )}

        <PracticeLogForm
          tenant={tenant}
          loggedToday={log.loggedToday}
          manualWindowDays={log.manualWindowDays}
        />

        {log.windows && (
          <section className="mt-12">
            <h2 className="mb-4 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
              De {log.weeks} veckorna
            </h2>
            <ul className="flex flex-col gap-2">
              {log.windows.windows.map((w) => (
                <li
                  key={w.index}
                  className="flex items-center gap-4 rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] px-5 py-3"
                >
                  <span className="w-16 font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
                    Vecka {w.index}
                  </span>
                  <div className="flex gap-1.5">
                    {Array.from({ length: log.minDaysPerWeek }, (_, i) => (
                      <span
                        key={i}
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            i < w.daysLogged ? "var(--t-primary)" : "var(--t-soft)",
                        }}
                      />
                    ))}
                  </div>
                  <span className="ml-auto text-xs text-[var(--t-muted)]">
                    {w.dispensed
                      ? "Dispens"
                      : w.met
                        ? `${w.daysLogged} dagar`
                        : `${w.daysLogged} av ${log.minDaysPerWeek}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!log.startsAt && (
          <p className="mt-8 text-sm text-[var(--t-muted)]">
            Loggen öppnar när din kursplats är registrerad.
          </p>
        )}

        {cert && cert.requirements.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
              Mot certifieringen
            </h2>
            <ul className="flex flex-col divide-y divide-[var(--t-soft)] rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] px-5">
              {cert.requirements.map((r) => (
                <li key={r.type} className="flex items-center gap-3 py-3 text-sm">
                  <span
                    className={r.met ? "text-[var(--t-primary)]" : "text-[var(--t-muted)]"}
                    aria-hidden
                  >
                    {r.met ? "✓" : "•"}
                  </span>
                  <span className="text-[var(--t-text)]">{requirementLabel(r.type)}</span>
                  <span className="ml-auto font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--t-muted)]">
                    {r.met ? "Klart" : "Pågår"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
