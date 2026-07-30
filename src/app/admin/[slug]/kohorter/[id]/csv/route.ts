import { requireTenantAdmin, getCohortUnderlag } from "@/lib/admin/data";
import { underlagToCsv } from "@/lib/tenant/underlag";

/**
 * CSV-exporten av kohortunderlaget. Samma buildUnderlag som vyn och print-HTML:en
 * — "CSV = vyn" per konstruktion (ACCEPTANCE §Fas 6). BOM för svensk Excel.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const { tenantId } = await requireTenantAdmin(slug);
  const cu = await getCohortUnderlag(tenantId, id);
  if (!cu) return new Response("not found", { status: 404 });

  const csv = "﻿" + underlagToCsv(cu.cohort.name, cu.underlag);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kohortunderlag-${slug}-${cu.cohort.startDate}.csv"`,
    },
  });
}
