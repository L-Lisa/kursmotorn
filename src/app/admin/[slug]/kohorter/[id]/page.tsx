import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireTenantAdmin,
  listCohorts,
  listEnrollments,
  getMemberNames,
  getCohortUnderlag,
} from "@/lib/admin/data";
import { statusLabel } from "@/lib/tenant/underlag";
import { CohortEditForm } from "../cohort-forms";
import { AddEnrollmentForm, MarkToggle, MoveEnrollmentDialog } from "./enrollment-controls";

/**
 * Kohortdetalj: redigering, enrollments (inkl. flytt med bekräftelsedialog +
 * fönstervarning) och kohortunderlaget (effektivt pris, summa, CSV + print).
 */
export default async function CohortDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { tenantId } = await requireTenantAdmin(slug);

  const [cohorts, enrollments, members, cu] = await Promise.all([
    listCohorts(tenantId),
    listEnrollments(tenantId, id),
    getMemberNames(tenantId),
    getCohortUnderlag(tenantId, id),
  ]);
  const cohort = cohorts.find((c) => c.id === id);
  if (!cohort || !cu) notFound();

  const enrolledUserIds = new Set(
    enrollments.filter((e) => e.status === "active").map((e) => e.userId),
  );
  const addable = [...members.values()].filter(
    (m) => m.role === "participant" && !enrolledUserIds.has(m.userId),
  );
  const otherCohorts = cohorts.filter((c) => c.id !== id);
  const priceByRow = new Map(cu.underlag.rows.map((r) => [r.enrollmentId, r.effectivePriceSek]));

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-foreground">{cohort.name}</h1>
        <Link
          href={`/admin/${slug}/kohorter`}
          className="font-[family-name:var(--font-mono)] text-xs text-primary hover:underline"
        >
          ← Alla kohorter
        </Link>
      </div>

      <CohortEditForm slug={slug} cohort={cohort} />

      <div className="mt-10 mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Deltagare & underlag
        </h2>
        <span className="inline-flex gap-4">
          <a
            href={`/admin/${slug}/kohorter/${id}/csv`}
            className="font-[family-name:var(--font-mono)] text-xs text-primary hover:underline"
          >
            CSV ↓
          </a>
          <Link
            href={`/admin/${slug}/kohorter/${id}/print`}
            className="font-[family-name:var(--font-mono)] text-xs text-primary hover:underline"
          >
            Utskriftsvy →
          </Link>
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Namn", "Företag", "Start", "Pris (kr)", "Status", "Fakturerad", "Betald", ""].map(
                (h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-xs font-normal uppercase tracking-[0.06em] text-muted-foreground"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {enrollments.map((e) => (
              <tr
                key={e.id}
                className={`border-b border-border last:border-0 ${
                  e.status === "dropped" ? "opacity-50" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {e.fullName}
                  {e.movedFrom && (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-secondary-foreground">
                      flyttad hit
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.company ?? "—"}</td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                  {e.startsAt}
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                  {(priceByRow.get(e.id) ?? 0).toLocaleString("sv-SE")}
                  {e.priceOverrideSek !== null && (
                    <span className="ml-1 text-[10px]">(justerat)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-secondary-foreground">
                    {statusLabel(e.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <MarkToggle slug={slug} enrollmentId={e.id} field="invoiced_at" value={e.invoicedAt} />
                </td>
                <td className="px-4 py-3">
                  <MarkToggle slug={slug} enrollmentId={e.id} field="paid_at" value={e.paidAt} />
                </td>
                <td className="px-4 py-3 text-right">
                  {e.status === "active" && otherCohorts.length > 0 && (
                    <MoveEnrollmentDialog
                      slug={slug}
                      enrollmentId={e.id}
                      participantName={e.fullName}
                      cohorts={otherCohorts.map((c) => ({
                        id: c.id,
                        name: c.name,
                        startDate: c.startDate,
                      }))}
                    />
                  )}
                </td>
              </tr>
            ))}
            {enrollments.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Inga deltagare i kohorten ännu.
                </td>
              </tr>
            )}
          </tbody>
          {enrollments.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-secondary/40">
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  Summa ({cu.underlag.countedRows} deltagare)
                </td>
                <td colSpan={2} />
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs font-medium text-foreground">
                  {cu.underlag.totalSek.toLocaleString("sv-SE")} kr
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold text-foreground">Lägg till deltagare</h2>
      <AddEnrollmentForm
        slug={slug}
        cohortId={id}
        cohortStart={cohort.startDate}
        members={addable.map((m) => ({ userId: m.userId, label: `${m.fullName} (${m.email})` }))}
      />
    </>
  );
}
