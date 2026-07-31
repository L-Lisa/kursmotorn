/**
 * Typade brand-formen. Schemat kommer från system/templates/brand-spec.md
 * (mallen ÄR tenant_brands-schemat). ALLT tenant-specifikt bor här — inget
 * varumärkesbundet får hårdkodas någon annanstans i koden.
 */
export type BrandColors = {
  bg: string;
  card: string;
  primary: string;
  primary_dark: string;
  text: string;
  muted: string;
  accent: string;
  soft: string;
};

export type BrandFonts = {
  serif: string;
  sans: string;
  mono: string;
};

export type BrandVoice = {
  toneWords: string[];
  address: string;
  language: string;
  sampleLines: string[];
  avoid: string[];
};

export type Brand = {
  displayName: string;
  courseName: string;
  certificateTitle: string;
  tagline: string;
  colors: BrandColors;
  fonts: BrandFonts;
  voice: BrandVoice;
  logoUrl: string | null;
  /** Tenantens app-ikon som inline-SVG (valfri) — renderas alltid som <img data:>-URI, aldrig som rå DOM. */
  markSvg: string | null;
};

export type TenantContext = {
  tenantId: string;
  slug: string;
  status: string;
  brand: Brand;
};
