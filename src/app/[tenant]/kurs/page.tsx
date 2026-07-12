import { redirect } from "next/navigation";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { getCourseForTenant } from "@/lib/tenant/course";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Inloggad, tenant-brandad kursvy. Fas 2 renderar STRUKTUREN (moduler + sektioner)
 * i tenantens varumärke — samma komponent, två brands. Avbockning/gating/prov är fas 3–4.
 * RLS gatar allt: en icke-medlem får ingen kurs (course === null) → isolationen håller.
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
            <h1 className="mb-10 font-[family-name:var(--t-serif)] text-4xl text-[var(--t-text)]">
              {course.displayName}
            </h1>

            <ol className="flex flex-col gap-4">
              {course.modules.map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
                      {String(m.position).padStart(2, "0")}
                    </span>
                    <h2 className="font-[family-name:var(--t-serif)] text-xl text-[var(--t-text)]">
                      {m.title}
                    </h2>
                  </div>
                  {m.intro && (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--t-muted)]">
                      {m.intro}
                    </p>
                  )}
                  {m.sections.length > 0 && (
                    <ul className="mt-4 flex flex-col divide-y divide-[var(--t-soft)]">
                      {m.sections.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-3 py-2.5 text-sm text-[var(--t-text)]"
                        >
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: "var(--t-primary)" }}
                            aria-hidden
                          />
                          <span>{s.title}</span>
                          {s.requirements?.upload_required && (
                            <span className="ml-auto rounded-full bg-[var(--t-soft)] px-2 py-0.5 font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-primary-dark)]">
                              Inspelning
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}
