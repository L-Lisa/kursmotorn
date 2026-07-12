import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderCertificatePdf } from "@/lib/certificate-pdf";

/**
 * Publik certifikat-PDF: /verify/<slug>/pdf. Läser samma smala, publika RPC som
 * verifieringssidan (verify_certificate) — inga persondata utöver namnet. Ett
 * återkallat certifikat ger ingen PDF (404), så en revokerad handling inte kan
 * spridas som giltig.
 */

const FALLBACK = {
  bg: "#FBFAF7",
  card: "#FFFFFF",
  primary: "#3D5A48",
  primary_dark: "#2A3F32",
  text: "#26241E",
  muted: "#777266",
  accent: "#3D5A48",
  soft: "#EEF2EC",
};

function pickColors(spec: unknown) {
  const colors = ((spec as Record<string, unknown>)?.colors ?? {}) as Record<string, string>;
  const out = { ...FALLBACK };
  for (const k of Object.keys(FALLBACK) as (keyof typeof FALLBACK)[]) {
    if (typeof colors[k] === "string" && colors[k]) out[k] = colors[k];
  }
  return out;
}

function issuerText(spec: unknown, fallback: string): string {
  const s = (spec ?? {}) as Record<string, unknown>;
  const cert = (s.certificate ?? {}) as Record<string, unknown>;
  const fromCert = typeof cert.issuer_text === "string" ? cert.issuer_text : "";
  const fromName = typeof s.tenant_name === "string" ? s.tenant_name : "";
  return fromCert || fromName || fallback;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_certificate", { p_slug: slug });

  const cert = data as {
    holder_name: string;
    course_name: string;
    certificate_title: string;
    issued_at: string;
    status: string;
    verify_slug: string;
    tenant_slug: string;
    brand_spec: unknown;
  } | null;

  if (error || !cert || cert.status !== "valid") {
    return new Response("Certifikatet hittades inte eller är återkallat.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const origin = request.nextUrl.origin;
  const buffer = await renderCertificatePdf({
    holderName: cert.holder_name,
    courseName: cert.course_name,
    certificateTitle: cert.certificate_title,
    issuerText: issuerText(cert.brand_spec, cert.course_name),
    issuedAt: cert.issued_at,
    verifySlug: cert.verify_slug,
    verifyUrl: `${origin}/verify/${cert.verify_slug}`,
    colors: pickColors(cert.brand_spec),
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="certifikat-${cert.verify_slug}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
