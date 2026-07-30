/**
 * Kohortunderlaget (fas 6, motorkärna). Ren beräkning + CSV-byggare — vyn,
 * print-HTML:en och CSV-exporten läser ALLA från samma funktion, så "CSV = vyn"
 * håller per konstruktion (ACCEPTANCE §Fas 6).
 *
 * Effektivt pris = price_override_sek ?? cohort.price_per_participant_sek —
 * ingen tredje fallback (datamodellen). Inga procentsatser eller delningar här:
 * motorns kärna är avgiftsfri (SPEC §4.6); MG:s delning bor i mg_billing_splits
 * och visas först i MG:s egen fas.
 */

export type UnderlagEnrollment = {
  enrollmentId: string;
  fullName: string;
  company: string | null;
  status: string;
  startsAt: string;
  priceOverrideSek: number | null;
  invoicedAt: string | null;
  paidAt: string | null;
};

export type UnderlagRow = UnderlagEnrollment & { effectivePriceSek: number };

export type Underlag = {
  rows: UnderlagRow[];
  /** Summan över raderna som fakturaunderlaget avser: aktiva/pausade/klara — inte dropped. */
  totalSek: number;
  countedRows: number;
};

/** Svenska statusetiketter för UI + export (naturlig svenska — repo-CLAUDE.md §UI-copy). */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "aktiv",
    paused: "pausad",
    dropped: "avslutad",
    completed: "klar",
    planned: "planerad",
    cancelled: "inställd",
  };
  return map[status] ?? status;
}

/** Rader som räknas i summan. Dropped visas (historik) men summeras inte. */
export function countsTowardTotal(status: string): boolean {
  return status !== "dropped";
}

export function buildUnderlag(
  cohortPriceSek: number,
  enrollments: UnderlagEnrollment[],
): Underlag {
  const rows = enrollments.map((e) => ({
    ...e,
    effectivePriceSek: e.priceOverrideSek ?? cohortPriceSek,
  }));
  const counted = rows.filter((r) => countsTowardTotal(r.status));
  return {
    rows,
    totalSek: counted.reduce((s, r) => s + r.effectivePriceSek, 0),
    countedRows: counted.length,
  };
}

function csvField(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV med semikolon (svensk Excel-konvention) — samma rader + summa som vyn. */
export function underlagToCsv(cohortName: string, u: Underlag): string {
  const lines = [
    ["Kohort", cohortName, "", "", "", "", ""],
    ["Namn", "Företag", "Status", "Startdatum", "Pris (kr)", "Fakturerad", "Betald"],
    ...u.rows.map((r) => [
      r.fullName,
      r.company ?? "",
      statusLabel(r.status),
      r.startsAt,
      r.effectivePriceSek,
      r.invoicedAt ? r.invoicedAt.slice(0, 10) : "",
      r.paidAt ? r.paidAt.slice(0, 10) : "",
    ]),
    ["Summa", "", "", "", u.totalSek, "", ""],
  ];
  return lines.map((l) => l.map(csvField).join(";")).join("\n") + "\n";
}
