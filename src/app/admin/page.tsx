import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBrand } from "@/lib/tenant/brand";
import { APP_NAME } from "@/lib/config";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Motor-admin (neutral "Varma maskinrummet"-yta). Listar de tenants den inloggade
 * ser via RLS — plattformsägaren ser alla, en tenant-admin bara sin egen.
 * Motorns yta ska kännas som verktyget, inte som något varumärke.
 */
export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, slug, status, tenant_brands(brand_spec)")
    .order("slug");

  const rows = (tenants ?? []).map((t) => {
    const tb = t.tenant_brands as
      | { brand_spec: unknown }
      | { brand_spec: unknown }[]
      | null;
    const spec = Array.isArray(tb) ? tb[0]?.brand_spec : tb?.brand_spec;
    return { id: t.id as string, slug: t.slug as string, status: t.status as string, brand: parseBrand(spec) };
  });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold text-foreground">{APP_NAME}</span>
          <span className="m-label">Admin</span>
        </div>
        <SignOutButton
          redirectTo="/login"
          className="m-label hover:text-foreground"
        />
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-8 py-10">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Tenants</h1>
          <span className="m-label">{rows.length} st</span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-xs font-normal uppercase tracking-[0.06em] text-muted-foreground">
                  Varumärke
                </th>
                <th className="px-5 py-3 text-xs font-normal uppercase tracking-[0.06em] text-muted-foreground">
                  Slug
                </th>
                <th className="px-5 py-3 text-xs font-normal uppercase tracking-[0.06em] text-muted-foreground">
                  Palett
                </th>
                <th className="px-5 py-3 text-xs font-normal uppercase tracking-[0.06em] text-muted-foreground">
                  Status
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-4 font-medium text-foreground">
                    {t.brand.displayName}
                  </td>
                  <td className="px-5 py-4 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                    {t.slug}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1.5">
                      {[
                        t.brand.colors.bg,
                        t.brand.colors.primary,
                        t.brand.colors.accent,
                        t.brand.colors.text,
                      ].map((hex, i) => (
                        <span
                          key={i}
                          title={hex}
                          className="inline-block h-5 w-5 rounded border border-border"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-secondary px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-secondary-foreground">
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="inline-flex gap-4">
                      <Link
                        href={`/admin/${t.slug}`}
                        className="font-[family-name:var(--font-mono)] text-xs text-primary hover:underline"
                      >
                        Administrera →
                      </Link>
                      <Link
                        href={`/${t.slug}`}
                        className="font-[family-name:var(--font-mono)] text-xs text-primary hover:underline"
                      >
                        Öppna →
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
