import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { getCourseForTenant } from "@/lib/tenant/course";
import {
  getCertificateStatus,
  getAttestationStatement,
  hasAttested,
  requirementLabel,
} from "@/lib/tenant/certificate";
import { AttestForm } from "./attest-form";
import { IssueButton } from "./issue-button";

/**
 * Certifieringsvyn (fas 5). Visar kravtrion, attestationssteget och utfärdandet i
 * tenantens varumärke. Utfärdande gatas server-side (issue_certificate) — den här
 * vyn visar bara tillstånd.
 */
export default async function IntygPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const { tenantId, brand } = await getTenantContext(tenant);

  const user = await getCurrentUser();
  if (!user) redirect(`/${tenant}/login`);

  const course = await getCourseForTenant(tenantId);
  if (!course) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <p className="text-[var(--t-muted)]">Ingen publicerad kurs för det här kontot ännu.</p>
      </div>
    );
  }

  const status = await getCertificateStatus(course.id);
  const attestReq = status?.requirements.find((r) => r.type === "attestation");
  const attested = attestReq ? await hasAttested(course.id, user.id) : false;
  const statement =
    attestReq && !attested
      ? await getAttestationStatement((attestReq.config.type as string) ?? "live_session_honor")
      : null;

  const cert = status?.certificate ?? null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--t-soft)] px-6 py-4">
        <span className="font-[family-name:var(--t-serif)] text-lg text-[var(--t-text)]">
          {brand.displayName}
        </span>
        <Link
          href={`/${tenant}/kurs`}
          className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-primary)] hover:underline"
        >
          ← Tillbaka till kursen
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="mb-2 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
          {brand.certificateTitle}
        </p>
        <h1 className="mb-8 font-[family-name:var(--t-serif)] text-4xl text-[var(--t-text)]">
          Certifiering
        </h1>

        {/* Kravlista */}
        <section className="mb-10">
          <h2 className="mb-4 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
            Krav för intyg
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--t-soft)] rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)]">
            {(status?.requirements ?? []).map((r) => (
              <li key={r.position} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    r.met
                      ? "bg-[var(--t-primary)] text-white"
                      : "border border-[var(--t-muted)] text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className={r.met ? "text-[var(--t-text)]" : "text-[var(--t-muted)]"}>
                  {requirementLabel(r.type, r.config)}
                </span>
                <span className="ml-auto font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-muted)]">
                  {r.met ? "Klart" : "Kvarstår"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Attestation */}
        {attestReq && (
          <section className="mb-10">
            <h2 className="mb-4 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
              Heder och samvete
            </h2>
            {attested ? (
              <p className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-soft)] px-5 py-3.5 text-sm text-[var(--t-primary-dark)]">
                Ditt intyg är lämnat.
              </p>
            ) : statement ? (
              <AttestForm tenant={tenant} statement={statement} />
            ) : null}
          </section>
        )}

        {/* Utfärdande / utfärdat certifikat */}
        <section>
          {cert ? (
            <div className="rounded-lg border border-[var(--t-primary)] bg-[var(--t-card)] p-6">
              <p className="mb-1 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-primary)]">
                Certifikat utfärdat
              </p>
              <p className="mb-1 font-[family-name:var(--t-serif)] text-2xl text-[var(--t-text)]">
                {cert.holderName}
              </p>
              <p className="mb-5 font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
                {brand.certificateTitle} · utfärdat{" "}
                {new Date(cert.issuedAt).toLocaleDateString("sv-SE")}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`/verify/${cert.verifySlug}/pdf`}
                  className="rounded-md bg-[var(--t-primary)] px-4 py-2 text-sm text-white"
                >
                  Ladda ner PDF
                </a>
                <Link
                  href={`/verify/${cert.verifySlug}`}
                  className="rounded-md border border-[var(--t-soft)] px-4 py-2 text-sm text-[var(--t-primary)]"
                >
                  Öppna verifieringssidan
                </Link>
              </div>
            </div>
          ) : status?.allMet ? (
            <>
              <p className="mb-4 text-sm text-[var(--t-text)]">
                Alla krav är uppfyllda. Du kan utfärda ditt certifikat.
              </p>
              <IssueButton tenant={tenant} />
            </>
          ) : (
            <p className="text-sm text-[var(--t-muted)]">
              När alla krav ovan är uppfyllda kan du utfärda ditt certifikat här.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
