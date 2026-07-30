import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { parseBrand, brandCssVars } from "@/lib/tenant/brand";

/**
 * Publik verifieringssida: /verify/<slug>. Ingen inloggning. Renderas i utfärdarens
 * varumärke via den smala publika RPC:n (verify_certificate) — visar innehav, kurs,
 * utfärdare och status, inga persondata utöver namnet. Ett återkallat certifikat
 * visas uttryckligen som återkallat.
 */

type VerifyData = {
  holder_name: string;
  course_name: string;
  certificate_title: string;
  issued_at: string;
  revoked_at: string | null;
  status: string;
  verify_slug: string;
  tenant_slug: string;
  brand_spec: unknown;
};

async function fetchCert(slug: string): Promise<VerifyData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_certificate", { p_slug: slug });
  if (error || !data) return null;
  return data as VerifyData;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cert = await fetchCert(slug);
  if (!cert) return { title: "Certifikat kunde inte verifieras" };
  return { title: `${cert.certificate_title} — ${cert.holder_name}` };
}

function issuerText(spec: unknown, fallback: string): string {
  const s = (spec ?? {}) as Record<string, unknown>;
  const cert = (s.certificate ?? {}) as Record<string, unknown>;
  const fromCert = typeof cert.issuer_text === "string" ? cert.issuer_text : "";
  const fromName = typeof s.tenant_name === "string" ? s.tenant_name : "";
  return fromCert || fromName || fallback;
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cert = await fetchCert(slug);

  if (!cert) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-[#FBFAF7] px-6 py-16">
        <div className="w-full max-w-md rounded-xl border border-[#EEE9DF] bg-white p-8 text-center">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-[#777266]">
            Verifiering
          </p>
          <h1 className="mb-3 text-2xl text-[#26241E]">Certifikatet hittades inte</h1>
          <p className="text-sm text-[#777266]">
            Kontrollera länken eller certifikat-ID:t. Ett giltigt certifikat visar
            innehavare, kurs och utfärdare här.
          </p>
        </div>
      </div>
    );
  }

  const brand = parseBrand(cert.brand_spec);
  const revoked = cert.status === "revoked";
  const issuer = issuerText(cert.brand_spec, brand.displayName);

  return (
    <div
      style={brandCssVars(brand)}
      className="flex min-h-full flex-1 items-center justify-center bg-[var(--t-bg)] px-6 py-16 font-[family-name:var(--t-sans)]"
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--t-soft)] bg-[var(--t-card)] p-8 sm:p-10">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-[family-name:var(--t-serif)] text-lg text-[var(--t-text)]">
            {issuer}
          </span>
          <span
            className={`rounded-full px-3 py-1 font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.1em] ${
              revoked
                ? "bg-[var(--t-soft)] text-[var(--t-muted)]"
                : "bg-[var(--t-primary)] text-white"
            }`}
          >
            {revoked ? "Återkallat" : "Giltigt"}
          </span>
        </div>

        <p className="mb-2 font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.14em] text-[var(--t-muted)]">
          {cert.certificate_title}
        </p>
        <h1 className="mb-1 font-[family-name:var(--t-serif)] text-4xl text-[var(--t-text)]">
          {cert.holder_name}
        </h1>
        <p className="mb-6 text-[15px] text-[var(--t-text)]">{cert.course_name}</p>

        <dl className="flex flex-col gap-2.5 border-t border-[var(--t-soft)] pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--t-muted)]">Utfärdare</dt>
            <dd className="text-[var(--t-text)]">{issuer}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--t-muted)]">Utfärdat</dt>
            <dd className="text-[var(--t-text)]">
              {new Date(cert.issued_at).toLocaleDateString("sv-SE")}
            </dd>
          </div>
          {revoked && cert.revoked_at && (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--t-muted)]">Återkallat</dt>
              <dd className="text-[var(--t-text)]">
                {new Date(cert.revoked_at).toLocaleDateString("sv-SE")}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--t-muted)]">Certifikat-ID</dt>
            <dd className="font-[family-name:var(--t-mono)] text-[13px] text-[var(--t-text)]">
              {cert.verify_slug}
            </dd>
          </div>
        </dl>

        {!revoked && (
          <div className="mt-8">
            <a
              href={`/verify/${cert.verify_slug}/pdf`}
              className="inline-block rounded-md bg-[var(--t-primary)] px-4 py-2 text-sm text-white"
            >
              Ladda ner PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
