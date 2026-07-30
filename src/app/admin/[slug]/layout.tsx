import Link from "next/link";
import { requireTenantAdmin } from "@/lib/admin/data";
import { APP_NAME } from "@/lib/config";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Tenant-admin under motor-admin. Motorns "Varma maskinrummet"-chrome — ALDRIG
 * tenantens brand (admin är verktyget; tenantens varumärke hör till deltagarytan).
 * Guarden ger 404 för icke-admin (RLS skyddar datan oavsett).
 */
export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { brand } = await requireTenantAdmin(slug);

  const nav = [
    { href: `/admin/${slug}`, label: "Deltagare" },
    { href: `/admin/${slug}/kohorter`, label: "Kohorter" },
    { href: `/admin/${slug}/brand`, label: "Brand" },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-8 py-5 print:hidden">
        <div className="flex items-baseline gap-3">
          <Link href="/admin" className="text-lg font-semibold text-foreground hover:underline">
            {APP_NAME}
          </Link>
          <span className="m-label">Admin</span>
          <span className="text-sm text-muted-foreground">/ {brand.displayName}</span>
        </div>
        <nav className="flex items-center gap-5">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="m-label hover:text-foreground">
              {n.label}
            </Link>
          ))}
          <SignOutButton redirectTo="/login" className="m-label hover:text-foreground" />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
