import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { getCourseForTenant } from "@/lib/tenant/course";
import { getGuideJourney } from "@/lib/tenant/logg";
import { SignOutButton } from "@/components/sign-out-button";
import { GuideSessionForm } from "./guide-session-form";

/**
 * "Min guideresa" (fas 7, godkända specen §3.2): egna guidesessioner, räknare mot
 * licensmålet (sessioner EFTER certifieringsinspelningens uppladdning räknas —
 * fasen härleds vid läsning, lagras aldrig), certnivå. Lugn ton, inget tävlande.
 */
export default async function GuideJourneyPage({
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

  const j = await getGuideJourney(course, user.id);
  const formatLabel = new Map(j.formats.map((f) => [f.key, f.label]));

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
          Min guideresa
        </p>
        <h1 className="mb-3 font-[family-name:var(--t-serif)] text-3xl text-[var(--t-text)]">
          Sessionerna du håller
        </h1>
        <p className="mb-8 max-w-prose text-[15px] leading-relaxed text-[var(--t-muted)]">
          Logga varje session du guidar — mikropauser, längre stunder, introduktioner.
          Flera samma dag går bra. Loggen är din egen dokumentation, och den bygger din
          väg vidare.
        </p>

        <div className="mb-8 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5">
            <p className="font-[family-name:var(--t-serif)] text-2xl text-[var(--t-text)]">
              {j.countedSessions} av {j.licenseTarget}
            </p>
            <p className="mt-1 text-xs text-[var(--t-muted)]">
              {j.finalUploadDate
                ? "sessioner efter din certifieringsinspelning"
                : "räknas efter din certifieringsinspelning"}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5">
            <p className="font-[family-name:var(--t-serif)] text-2xl text-[var(--t-text)]">
              {j.level === "certifierad" ? "Certifierad" : "Deltagare"}
            </p>
            <p className="mt-1 text-xs text-[var(--t-muted)]">nuvarande nivå</p>
          </div>
        </div>

        <GuideSessionForm tenant={tenant} formats={j.formats} />

        <section className="mt-12">
          <h2 className="mb-4 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
            Loggade sessioner {j.sessions.length > 0 && `(${j.sessions.length})`}
          </h2>
          {j.sessions.length === 0 ? (
            <p className="text-sm text-[var(--t-muted)]">
              Inga sessioner ännu. Den första kommer när den kommer.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--t-soft)] rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] px-5">
              {j.sessions.map((s) => (
                <li key={s.id} className="flex items-baseline gap-3 py-3 text-sm">
                  <span className="w-24 shrink-0 font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
                    {s.loggedDate}
                  </span>
                  <span className="text-[var(--t-text)]">
                    {formatLabel.get(s.format) ?? s.format}
                    {s.context ? ` · ${s.context}` : ""}
                    {s.participantsCount !== null ? ` · ${s.participantsCount} deltagare` : ""}
                  </span>
                  {j.finalUploadDate && s.loggedDate > j.finalUploadDate && (
                    <span className="ml-auto shrink-0 rounded-full bg-[var(--t-soft)] px-2 py-0.5 font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--t-primary-dark)]">
                      Räknas
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
