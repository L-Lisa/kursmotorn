import { getTenantContext } from "@/lib/tenant/context";
import { brandCssVars } from "@/lib/tenant/brand";

/**
 * Tenant-lagret. Sätter brand-tokens ur DB som inline CSS-variabler (--t-*) på
 * wrappern. ALLT innanför denna wrapper renderas i tenantens varumärke; ändra
 * ett brand-fält i DB och det slår igenom här utan kodändring (fas 2-krav).
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const ctx = await getTenantContext(tenant);

  return (
    <div
      style={brandCssVars(ctx.brand)}
      className="flex min-h-full flex-1 flex-col bg-[var(--t-bg)] font-[family-name:var(--t-sans)] text-[var(--t-text)]"
    >
      {children}
    </div>
  );
}
