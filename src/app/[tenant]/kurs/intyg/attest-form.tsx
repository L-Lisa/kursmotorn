"use client";

import { useState, useTransition } from "react";
import { submitAttestation } from "./actions";

/**
 * Heder-och-samvete-attestationen. Visar den ordagranna, versionerade lydelsen
 * (samma text som lagras). Kryssrutan är bara en spärr — server-fn skriver texten.
 */
export function AttestForm({ tenant, statement }: { tenant: string; statement: string }) {
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5">
      <p className="mb-4 text-[15px] leading-relaxed text-[var(--t-text)]">{statement}</p>
      <label className="mb-4 flex items-start gap-3 text-sm text-[var(--t-text)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--t-primary)]"
        />
        <span>Jag intygar att lydelsen ovan stämmer.</span>
      </label>
      <button
        disabled={!checked || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await submitAttestation(tenant);
            if (!r.ok) setError(r.error ?? "fel");
          })
        }
        className="rounded-md bg-[var(--t-primary)] px-4 py-2 text-sm text-white transition-opacity disabled:opacity-40"
      >
        {pending ? "Sparar…" : "Lämna intyg"}
      </button>
      {error && <p className="mt-3 text-sm text-[var(--t-muted)]">Kunde inte spara: {error}</p>}
    </div>
  );
}
