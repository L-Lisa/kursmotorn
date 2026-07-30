/**
 * Fönsterberäkningen (fas 6, generisk motorkärna). Ren funktion — samma mönster
 * som gating.ts: DB-rader in, deterministiskt resultat ut, testbar utan server.
 *
 * Semantik (godkända specen §3.1 + datamodellen):
 *  - Fönstren är `weeks` × 7 dagar räknat från enrollment.starts_at (ANKARET —
 *    eftersläntrare får sina egna fönster; flytt = ny enrollment ⇒ fönstren
 *    räknas om från nya radens starts_at).
 *  - Ett fönster är uppfyllt när minst `minDaysPerWeek` unika loggdagar faller
 *    inom fönstret, ELLER när fönstret har dispens (approval, fas 7 kopplar).
 *  - Loggdagar utanför alla fönster räknas inte (varken före starts_at eller
 *    efter sista fönstret) — det är exakt därför en flytt "räknar om" kravet.
 */

export type LogWindow = {
  index: number; // 1-baserat (dispens-approvals pekar {window_index: n})
  start: string; // YYYY-MM-DD, inklusive
  end: string;   // YYYY-MM-DD, inklusive (start + 6 dagar)
  daysLogged: number;
  dispensed: boolean;
  met: boolean;
};

export type LogWindowResult = {
  windows: LogWindow[];
  allMet: boolean;
};

function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeLogWindows(input: {
  startsAt: string; // enrollment.starts_at (YYYY-MM-DD)
  weeks: number; // config.weeks (MG: 6)
  minDaysPerWeek: number; // config.min_days_per_week (MG: 5)
  loggedDates: string[]; // unika eller ej — dedupas här (dagsunikhet är kravets enhet)
  dispensedWindows?: number[]; // window_index ur approvals (log_threshold_dispens)
}): LogWindowResult {
  const { startsAt, weeks, minDaysPerWeek } = input;
  const days = new Set(input.loggedDates);
  const dispensed = new Set(input.dispensedWindows ?? []);

  const windows: LogWindow[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = isoAddDays(startsAt, i * 7);
    const end = isoAddDays(startsAt, i * 7 + 6);
    let n = 0;
    for (const d of days) {
      if (d >= start && d <= end) n++;
    }
    const hasDispens = dispensed.has(i + 1);
    windows.push({
      index: i + 1,
      start,
      end,
      daysLogged: n,
      dispensed: hasDispens,
      met: hasDispens || n >= minDaysPerWeek,
    });
  }

  return { windows, allMet: windows.every((w) => w.met) };
}
