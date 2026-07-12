import { getTenantContext } from "@/lib/tenant/context";
import { LoginForm } from "./login-form";

export default async function TenantLogin({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const { brand } = await getTenantContext(tenant);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <p className="mb-2 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
        {brand.courseName}
      </p>
      <h1 className="mb-8 font-[family-name:var(--t-serif)] text-3xl text-[var(--t-text)]">
        {brand.displayName}
      </h1>
      <LoginForm tenant={tenant} />
    </main>
  );
}
