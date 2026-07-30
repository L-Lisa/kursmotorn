import { requireTenantAdmin } from "@/lib/admin/data";
import { createClient } from "@/lib/supabase/server";
import { specToInput } from "@/lib/admin/brand-spec";
import { BrandWizardForm } from "./brand-form";

/**
 * Brand-wizard (fas 6): admin-UI över tenant_brands enligt brand-spec-mallen —
 * mallen ÄR schemat (SPEC §2.1). Sparat spec renderas direkt i tenant-vyerna
 * (DB-läst per request, inget bygge/deploy).
 */
export default async function BrandWizardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tenantId } = await requireTenantAdmin(slug);

  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_brands")
    .select("brand_spec, version, updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const initial = specToInput(data?.brand_spec);

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Brand</h1>
        {data?.updated_at && (
          <span className="m-label">senast ändrad {String(data.updated_at).slice(0, 10)}</span>
        )}
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Fälten följer brand-spec-mallen och sparas som tenantens brand_spec. Ändringar slår
        igenom direkt i deltagarvyn — inga kodändringar. Designsystemet är låst: ändra bara
        på tenantens egen begäran/gradering.
      </p>
      <BrandWizardForm slug={slug} initial={initial} />
    </>
  );
}
