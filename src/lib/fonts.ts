import {
  Inter,
  JetBrains_Mono,
  Lora,
  Fraunces,
  Source_Sans_3,
  Geist_Mono,
  Newsreader,
  Manrope,
} from "next/font/google";

/**
 * Alla teckensnitt self-hostas via next/font (inga externa anrop i drift).
 * Motorns yta: Inter + JetBrains Mono (../brand.md "Varma maskinrummet").
 * Tenant-serifer (laddade för demo-brandsen): Lora · Fraunces · Source Sans 3 · Geist Mono ·
 * Newsreader + Manrope (tillagda för tenant-brands i fas 7).
 *
 * v1-begränsning (loggad i DECISIONS): next/font kräver statiska importer, så
 * en tenant kan bara välja bland de laddade familjerna. Okänt fontnamn faller
 * tillbaka på sans. Ny kundfont = en importrad + deploy (fas 2-självbetjäning senare).
 */
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
export const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
export const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
export const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
export const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

/** Alla font-variabler i en className för <html>. */
export const fontClassNames = [inter, jetbrainsMono, lora, fraunces, sourceSans, geistMono, newsreader, manrope]
  .map((f) => f.variable)
  .join(" ");

/** Fontnamn i brand_spec → CSS-variabel. */
const FONT_VAR_BY_NAME: Record<string, string> = {
  Inter: "var(--font-inter)",
  "JetBrains Mono": "var(--font-jetbrains-mono)",
  Lora: "var(--font-lora)",
  Fraunces: "var(--font-fraunces)",
  "Source Sans 3": "var(--font-source-sans)",
  "Geist Mono": "var(--font-geist-mono)",
  Newsreader: "var(--font-newsreader)",
  Manrope: "var(--font-manrope)",
};

export function fontVar(name: string | undefined, fallback: string): string {
  return (name ? FONT_VAR_BY_NAME[name] : undefined) ?? fallback;
}
