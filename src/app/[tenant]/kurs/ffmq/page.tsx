import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { getCourseForTenant } from "@/lib/tenant/course";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import {
  FFMQ_TITLE,
  FFMQ_ATTRIBUTION,
  FFMQ_AUTHOR_URL,
  FFMQ_SWEDISH_VERSION_URL,
  FFMQ_MAX_SCORE,
} from "@/lib/tenant/ffmq";
import type { FacetScore } from "@/lib/tenant/ffmq-score";
import { FfmqForm } from "./ffmq-form";

/**
 * FFMQ-förmätningen (fas 7-komplettering 2026-07-31). Instrumentet återges
 * ordagrant med attribution (Baer); UI-ramen är svensk. Tidslåset enforce:as i
 * submit_ffmq — sidan visar bara läget ärligt. Visas för kurser med
 * log_threshold-certvillkor (fönstermekaniken = mätperioderna).
 */
export default async function FfmqPage({
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

  const supabase = await createClient();
  const [reqRes, enrollRes, respRes] = await Promise.all([
    supabase
      .from("course_certificate_requirements")
      .select("id")
      .eq("course_id", course.id)
      .eq("type", "log_threshold")
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select("cohort_id, starts_at")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("mg_ffmq_responses")
      .select("occasion, facet_scores, total_score, completed_at")
      .eq("user_id", user.id),
  ]);
  if (!reqRes.data) notFound(); // kursen använder inte mätfönster ⇒ ingen FFMQ

  const enrollment = enrollRes.data;
  const pre = (respRes.data ?? []).find((r) => r.occasion === "pre");

  const startsAt = enrollment?.starts_at as string | undefined;
  const lockDate = startsAt
    ? new Date(new Date(`${startsAt}T00:00:00Z`).getTime() + 7 * 86400_000)
        .toISOString()
        .slice(0, 10)
    : null;
  const preLocked = lockDate ? new Date().toISOString().slice(0, 10) >= lockDate : true;

  const facetScores = (pre?.facet_scores ?? null) as FacetScore[] | null;

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
          Förmätning
        </p>
        <h1 className="mb-3 font-[family-name:var(--t-serif)] text-3xl text-[var(--t-text)]">
          {FFMQ_TITLE}
        </h1>
        <p className="mb-2 max-w-prose text-[15px] leading-relaxed text-[var(--t-muted)]">
          En självskattning av fem sidor av mindfulness: Observera, Beskriva, Agera med
          medvetenhet, Icke-dömande och Icke-reaktivitet. Du fyller i den i början av kursen
          och igen mot slutet — jämförelsen är din egen. Det finns inga rätt eller fel svar.
        </p>
        <p className="mb-8 max-w-prose text-sm text-[var(--t-muted)]">
          {FFMQ_ATTRIBUTION}{" "}
          <a
            href={FFMQ_AUTHOR_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--t-primary)] underline"
          >
            Ruth Baer
          </a>{" "}
          ·{" "}
          <a
            href={FFMQ_SWEDISH_VERSION_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--t-primary)] underline"
          >
            Lunds universitet
          </a>
        </p>

        {pre && facetScores && (
          <section className="mb-10 rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5">
            <h2 className="mb-3 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
              Din förmätning {pre.completed_at ? `· ${String(pre.completed_at).slice(0, 10)}` : ""}
            </h2>
            <ul className="flex flex-col gap-2">
              {facetScores.map((f) => (
                <li key={f.facet} className="flex items-center gap-3 text-sm">
                  <span className="w-64 text-[var(--t-text)]">{f.facet}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--t-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--t-primary)]"
                      style={{ width: `${Math.round((100 * f.score) / f.max)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
                    {f.score}/{f.max} · ⌀{f.average}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-[var(--t-muted)]">
              Totalpoäng: {pre.total_score}/{FFMQ_MAX_SCORE}. Siffrorna är en ögonblicksbild,
              inte ett betyg — de blir intressanta först i jämförelsen med eftermätningen.
            </p>
          </section>
        )}

        {!enrollment ? (
          <p className="text-sm text-[var(--t-muted)]">
            Förmätningen öppnar när din kursplats är registrerad.
          </p>
        ) : preLocked ? (
          !pre && (
            <p className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5 text-sm text-[var(--t-muted)]">
              Förmätningens fönster har passerat (första kursveckan). Det är helt okej —
              kursen står inte och faller med den. Eftermätningen öppnar mot slutet av kursen.
            </p>
          )
        ) : (
          <FfmqForm
            tenant={tenant}
            cohortId={enrollment.cohort_id as string}
            lockDate={lockDate}
            hasExisting={!!pre}
          />
        )}
      </main>
    </div>
  );
}
