import Link from "next/link";
import { requireTenantAdmin, listCohorts } from "@/lib/admin/data";
import { statusLabel } from "@/lib/tenant/underlag";
import { CohortCreateForm } from "./cohort-forms";

/** Kohortlistan + skapa ny (fas 6: kohort-CRUD i admin). */
export default async function CohortsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tenantId } = await requireTenantAdmin(slug);
  const cohorts = await listCohorts(tenantId);

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Kohorter</h1>
        <span className="m-label">{cohorts.length} st</span>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Namn", "Start", "Pris/deltagare", "Aktiva", "Status", ""].map((h, i) => (
                <th
                  key={i}
                  className="px-5 py-3 text-xs font-normal uppercase tracking-[0.06em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3.5 font-medium text-foreground">{c.name}</td>
                <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                  {c.startDate}
                </td>
                <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                  {c.priceSek.toLocaleString("sv-SE")} kr
                </td>
                <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                  {c.enrollmentCount}
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded-full bg-secondary px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-secondary-foreground">
                    {statusLabel(c.status)}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/admin/${slug}/kohorter/${c.id}`}
                    className="font-[family-name:var(--font-mono)] text-xs text-primary hover:underline"
                  >
                    Öppna →
                  </Link>
                </td>
              </tr>
            ))}
            {cohorts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Inga kohorter ännu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-foreground">Ny kohort</h2>
      <CohortCreateForm slug={slug} />
    </>
  );
}
