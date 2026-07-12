import type { CSSProperties } from "react";
import { fontVar } from "@/lib/fonts";
import type { Brand } from "./types";

/**
 * Neutrala reservvärden = motorns egen yta (../brand.md "Varma maskinrummet").
 * En halvifylld brand-spec renderar ändå — men aldrig med ett annat varumärke,
 * bara med motorns neutrala default. Inga tenant-strängar här.
 */
const MOTOR_FALLBACK = {
  colors: {
    bg: "#FBFAF7",
    card: "#FFFFFF",
    primary: "#3D5A48",
    primary_dark: "#2A3F32",
    text: "#26241E",
    muted: "#777266",
    accent: "#3D5A48",
    soft: "#EEF2EC",
  },
  fonts: { serif: "Inter", sans: "Inter", mono: "JetBrains Mono" },
} as const;

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Parsar en brand_spec (jsonb) till den typade Brand-formen med säkra reserver.
 * Detta är enda stället en rå brand-spec tolkas — resten av appen får typad data.
 */
export function parseBrand(spec: unknown): Brand {
  const s = (spec ?? {}) as Record<string, unknown>;
  const colors = (s.colors ?? {}) as Record<string, unknown>;
  const fonts = (s.fonts ?? {}) as Record<string, unknown>;
  const voice = (s.voice ?? {}) as Record<string, unknown>;
  const c = MOTOR_FALLBACK.colors;
  const f = MOTOR_FALLBACK.fonts;

  return {
    displayName: str(s.display_name ?? s.tenant_name, "Kurs"),
    courseName: str(s.course_name, str(s.display_name, "Kurs")),
    certificateTitle: str(s.certificate_title, "Certifikat"),
    tagline: str(s.tagline, ""),
    colors: {
      bg: str(colors.bg, c.bg),
      card: str(colors.card, c.card),
      primary: str(colors.primary, c.primary),
      primary_dark: str(colors.primary_dark, c.primary_dark),
      text: str(colors.text, c.text),
      muted: str(colors.muted, c.muted),
      accent: str(colors.accent, c.accent),
      soft: str(colors.soft, c.soft),
    },
    fonts: {
      serif: str(fonts.serif, f.serif),
      sans: str(fonts.sans, f.sans),
      mono: str(fonts.mono, f.mono),
    },
    voice: {
      toneWords: strArray(voice.tone_words),
      address: str(voice.address, "du"),
      language: str(voice.language, "sv"),
      sampleLines: strArray(voice.sample_lines),
      avoid: strArray(voice.avoid),
    },
    logoUrl: typeof s.logo_url === "string" ? s.logo_url : null,
  };
}

/**
 * Brand-tokens → CSS-variabler (--t-*) som sätts inline på tenant-wrappern.
 * Att värdena kommer HÄR (ur DB) är exakt det som gör att ett ändrat brand-fält
 * slår igenom utan kodändring eller deploy (fas 2-acceptanskriteriet).
 */
export function brandCssVars(brand: Brand): CSSProperties {
  const { colors, fonts } = brand;
  return {
    "--t-bg": colors.bg,
    "--t-card": colors.card,
    "--t-primary": colors.primary,
    "--t-primary-dark": colors.primary_dark,
    "--t-text": colors.text,
    "--t-muted": colors.muted,
    "--t-accent": colors.accent,
    "--t-soft": colors.soft,
    "--t-serif": fontVar(fonts.serif, "var(--font-inter)"),
    "--t-sans": fontVar(fonts.sans, "var(--font-inter)"),
    "--t-mono": fontVar(fonts.mono, "var(--font-jetbrains-mono)"),
  } as CSSProperties;
}
