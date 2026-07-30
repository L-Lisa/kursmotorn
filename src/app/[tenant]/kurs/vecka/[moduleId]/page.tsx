import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { getCourseForTenant, getGatingState } from "@/lib/tenant/course";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { CheckoffButton } from "../../checkoff-button";
import { UploadControl } from "../../upload-control";

/**
 * Läsvyn (fas 7): en moduls/veckas innehåll i löpande text, tenant-brandad.
 * Innehållet renderas ORDAGRANT ur DB (markdown → HTML, ingen omskrivning).
 * Gating: deltagare ser bara upplåsta sektioner; en tenant-ADMIN förhandsgranskar
 * allt (granskningskontot — kursen är deras att granska, gating gäller deltagare).
 */
export default async function WeekReader({
  params,
}: {
  params: Promise<{ tenant: string; moduleId: string }>;
}) {
  const { tenant, moduleId } = await params;
  const { tenantId, brand } = await getTenantContext(tenant);

  const user = await getCurrentUser();
  if (!user) redirect(`/${tenant}/login`);

  const course = await getCourseForTenant(tenantId);
  if (!course) notFound();
  const moduleIndex = course.modules.findIndex((m) => m.id === moduleId);
  if (moduleIndex === -1) notFound();
  const mod = course.modules[moduleIndex];

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_tenant_admin", { tid: tenantId });
  const gating = isAdmin ? null : await getGatingState(course, user.id);

  const prev = moduleIndex > 0 ? course.modules[moduleIndex - 1] : null;
  const next = moduleIndex + 1 < course.modules.length ? course.modules[moduleIndex + 1] : null;

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
          {course.displayName}
          {isAdmin ? " · granskningsläge" : ""}
        </p>
        <h1 className="mb-10 font-[family-name:var(--t-serif)] text-3xl leading-snug text-[var(--t-text)]">
          {mod.title.replace(/^Modul\s+\d+\s+—\s+/, "")}
        </h1>

        <div className="flex flex-col gap-10">
          {mod.sections.map((s) => {
            const g = gating?.get(s.id);
            const unlocked = isAdmin || !!g?.unlocked;
            const req = s.requirements ?? {};
            if (!unlocked) {
              return (
                <section key={s.id} className="border-t border-[var(--t-soft)] pt-6">
                  <h2 className="font-[family-name:var(--t-serif)] text-xl text-[var(--t-muted)]">
                    {s.title}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--t-muted)]">
                    Den här delen öppnas när du är framme vid den.
                  </p>
                </section>
              );
            }
            return (
              <section key={s.id} className="border-t border-[var(--t-soft)] pt-6">
                <h2 className="mb-4 font-[family-name:var(--t-serif)] text-2xl text-[var(--t-text)]">
                  {s.title}
                </h2>
                {s.content && (
                  <div className="prose-t">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                  </div>
                )}
                {!isAdmin && (req.checkoff || req.upload_required) && (
                  <div className="mt-5 flex items-center gap-3">
                    {req.checkoff && (
                      <>
                        <CheckoffButton
                          tenant={tenant}
                          sectionId={s.id}
                          complete={!!g?.complete}
                          locked={!unlocked}
                        />
                        <span className="text-sm text-[var(--t-muted)]">
                          {g?.complete ? "Avbockad." : "Bocka av när du är klar."}
                        </span>
                      </>
                    )}
                    {req.upload_required && (
                      <UploadControl
                        tenant={tenant}
                        tenantId={tenantId}
                        sectionId={s.id}
                        complete={!!g?.complete}
                        locked={!unlocked}
                      />
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <nav className="mt-14 flex items-center justify-between border-t border-[var(--t-soft)] pt-6">
          {prev ? (
            <Link
              href={`/${tenant}/kurs/vecka/${prev.id}`}
              className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-primary)] hover:underline"
            >
              ← Föregående
            </Link>
          ) : (
            <span />
          )}
          <Link
            href={`/${tenant}/kurs`}
            className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)] hover:underline"
          >
            Översikt
          </Link>
          {next ? (
            <Link
              href={`/${tenant}/kurs/vecka/${next.id}`}
              className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-primary)] hover:underline"
            >
              Nästa →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>
    </div>
  );
}
