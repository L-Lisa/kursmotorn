/**
 * Brand-wizardens schema (fas 6). Mallen ÄR schemat (SPEC §2.1):
 * system/templates/brand-spec.md → JSON-blocket sist i mallen. Wizarden bygger
 * exakt den strukturen — plus `colors.soft` som motorn använder sedan fas 2
 * (soft-badgen, GRIND 2-beslutet) och `display_name` som visningsalias.
 */

export const COLOR_KEYS = [
  "bg",
  "card",
  "primary",
  "primary_dark",
  "text",
  "muted",
  "accent",
  "soft",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const COLOR_LABELS: Record<ColorKey, string> = {
  bg: "Sidbakgrund",
  card: "Kort/paneler",
  primary: "Primärfärg",
  primary_dark: "Mörk variant",
  text: "Primärtext",
  muted: "Sekundärtext",
  accent: "Accent (sparsam)",
  soft: "Soft (badges/avdelare)",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export type BrandSpecInput = {
  tenant_name: string;
  course_name: string;
  certificate_title: string;
  tagline: string;
  org_legal_name: string;
  org_nr: string;
  org_website: string;
  org_contact: string;
  colors: Record<ColorKey, string>;
  font_serif: string;
  font_sans: string;
  font_mono: string;
  tone_words: string; // kommaseparerat i formuläret
  address: string;
  language: string;
  sample_line_1: string;
  sample_line_2: string;
  avoid: string; // kommaseparerat
  logo_url: string;
  cert_issuer_text: string;
  cert_signature_name: string;
  cert_signature_title: string;
  subdomain: string;
  custom_domain: string;
};

const splitList = (s: string): string[] =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Validerar och bygger brand_spec-jsonb enligt mallens schema. */
export function buildBrandSpec(
  input: BrandSpecInput,
): { ok: true; spec: Record<string, unknown> } | { ok: false; error: string } {
  if (!input.tenant_name.trim()) return { ok: false, error: "Namn krävs." };
  for (const k of COLOR_KEYS) {
    const v = input.colors[k]?.trim() ?? "";
    if (!HEX.test(v)) {
      return { ok: false, error: `Ogiltig hexfärg för ${COLOR_LABELS[k]} (${k}): "${v}" — ange #RRGGBB.` };
    }
  }

  const spec = {
    tenant_name: input.tenant_name.trim(),
    display_name: input.tenant_name.trim(),
    course_name: input.course_name.trim(),
    certificate_title: input.certificate_title.trim(),
    tagline: input.tagline.trim(),
    org_info: {
      legal_name: input.org_legal_name.trim(),
      org_nr: input.org_nr.trim(),
      website: input.org_website.trim(),
      contact: input.org_contact.trim(),
    },
    colors: Object.fromEntries(COLOR_KEYS.map((k) => [k, input.colors[k].trim()])),
    fonts: {
      serif: input.font_serif.trim(),
      sans: input.font_sans.trim(),
      mono: input.font_mono.trim(),
    },
    voice: {
      tone_words: splitList(input.tone_words),
      address: input.address.trim() || "du",
      language: input.language.trim() || "sv",
      sample_lines: [input.sample_line_1.trim(), input.sample_line_2.trim()].filter(Boolean),
      avoid: splitList(input.avoid),
    },
    logo_url: input.logo_url.trim() || null,
    certificate: {
      issuer_text: input.cert_issuer_text.trim(),
      signature_name: input.cert_signature_name.trim(),
      signature_title: input.cert_signature_title.trim(),
      expires: null,
    },
    domain: {
      subdomain: input.subdomain.trim(),
      custom_domain: input.custom_domain.trim() || null,
    },
  };
  return { ok: true, spec };
}

/** Plockar formulärvärden ur en befintlig brand_spec (prefill). */
export function specToInput(spec: unknown): BrandSpecInput {
  const s = (spec ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const list = (v: unknown): string =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").join(", ") : "";

  const colors = obj(s.colors);
  const fonts = obj(s.fonts);
  const voice = obj(s.voice);
  const org = obj(s.org_info);
  const cert = obj(s.certificate);
  const domain = obj(s.domain);
  const samples = Array.isArray(voice.sample_lines) ? (voice.sample_lines as unknown[]) : [];

  return {
    tenant_name: str(s.tenant_name) || str(s.display_name),
    course_name: str(s.course_name),
    certificate_title: str(s.certificate_title),
    tagline: str(s.tagline),
    org_legal_name: str(org.legal_name),
    org_nr: str(org.org_nr),
    org_website: str(org.website),
    org_contact: str(org.contact),
    colors: Object.fromEntries(COLOR_KEYS.map((k) => [k, str(colors[k])])) as Record<
      ColorKey,
      string
    >,
    font_serif: str(fonts.serif),
    font_sans: str(fonts.sans),
    font_mono: str(fonts.mono),
    tone_words: list(voice.tone_words),
    address: str(voice.address) || "du",
    language: str(voice.language) || "sv",
    sample_line_1: str(samples[0]),
    sample_line_2: str(samples[1]),
    avoid: list(voice.avoid),
    logo_url: str(s.logo_url),
    cert_issuer_text: str(cert.issuer_text),
    cert_signature_name: str(cert.signature_name),
    cert_signature_title: str(cert.signature_title),
    subdomain: str(domain.subdomain),
    custom_domain: str(domain.custom_domain),
  };
}
