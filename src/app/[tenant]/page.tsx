import Link from "next/link";
import { getTenantContext } from "@/lib/tenant/context";

/**
 * Publik, tenant-brandad landningssida. Renderas utan inloggning via den smala
 * publika brand-lookupen (fynd 4). Bevis: samma komponent, två varumärken.
 */
export default async function TenantLanding({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const { brand } = await getTenantContext(tenant);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
      <p className="mb-4 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
        {brand.courseName}
      </p>
      <h1 className="font-[family-name:var(--t-serif)] text-4xl leading-tight text-[var(--t-text)] sm:text-5xl">
        {brand.displayName}
      </h1>
      {brand.tagline && (
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--t-muted)]">
          {brand.tagline}
        </p>
      )}

      <div className="mt-10 flex items-center gap-4">
        <Link
          href={`/${tenant}/login`}
          className="rounded-md bg-[var(--t-primary)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Logga in
        </Link>
        <span className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
          {brand.certificateTitle}
        </span>
      </div>
    </main>
  );
}
