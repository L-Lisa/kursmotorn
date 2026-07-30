import { notFound } from "next/navigation";
import { requireTenantAdmin, getCohortUnderlag } from "@/lib/admin/data";
import { statusLabel } from "@/lib/tenant/underlag";
import { PrintButton } from "./print-button";

/**
 * Utskriftsvänligt kohortunderlag (PDF via webbläsarens print — ingen PDF-motor;
 * certifikatet är v1:s enda genererade PDF, SPEC §2.9). Samma buildUnderlag som
 * vyn och CSV:n. Inga delningsavsnitt i motorkärnan.
 */
export default async function UnderlagPrintPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { tenantId, brand } = await requireTenantAdmin(slug);
  const cu = await getCohortUnderlag(tenantId, id);
  if (!cu) notFound();

  const { cohort, underlag } = cu;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-[#1a1a1a] print:p-0">
      <div className="mb-2 flex items-baseline justify-between print:hidden">
        <PrintButton />
      </div>

      <h1 className="mb-1 text-xl font-semibold">Kohortunderlag — {cohort.name}</h1>
      <p className="mb-6 text-sm text-[#555]">
        {brand.displayName} · start {cohort.startDate} · pris{" "}
        {cohort.priceSek.toLocaleString("sv-SE")} kr/deltagare
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-[#1a1a1a] text-left">
            {["Namn", "Företag", "Status", "Start", "Pris (kr)", "Fakturerad", "Betald"].map((h) => (
              <th key={h} className="py-2 pr-3 text-xs font-semibold uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {underlag.rows.map((r) => (
            <tr key={r.enrollmentId} className="border-b border-[#ddd]">
              <td className="py-2 pr-3">{r.fullName}</td>
              <td className="py-2 pr-3">{r.company ?? ""}</td>
              <td className="py-2 pr-3">{statusLabel(r.status)}</td>
              <td className="py-2 pr-3">{r.startsAt}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {r.effectivePriceSek.toLocaleString("sv-SE")}
              </td>
              <td className="py-2 pr-3">{r.invoicedAt ? r.invoicedAt.slice(0, 10) : ""}</td>
              <td className="py-2 pr-3">{r.paidAt ? r.paidAt.slice(0, 10) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#1a1a1a] font-semibold">
            <td className="py-2 pr-3">Summa ({underlag.countedRows} deltagare)</td>
            <td colSpan={3} />
            <td className="py-2 pr-3 text-right tabular-nums">
              {underlag.totalSek.toLocaleString("sv-SE")}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
