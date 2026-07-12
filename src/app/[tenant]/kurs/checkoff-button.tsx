"use client";

import { useState, useTransition } from "react";
import { toggleSection } from "./actions";

/**
 * Avbockningsknapp. Anropar serveråtgärden (som enforce:ar gating). Klienten
 * visar bara tillstånd — den avgör aldrig upplåsning.
 */
export function CheckoffButton({
  tenant,
  sectionId,
  complete,
  locked,
}: {
  tenant: string;
  sectionId: string;
  complete: boolean;
  locked: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (locked) {
    return (
      <span className="font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-muted)]">
        Låst
      </span>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          setError(null);
          const r = await toggleSection(tenant, sectionId);
          if (!r.ok) setError(r.error ?? "fel");
        })
      }
      className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors disabled:opacity-50 ${
        complete
          ? "border-[var(--t-primary)] bg-[var(--t-primary)] text-white"
          : "border-[var(--t-muted)] bg-transparent text-transparent hover:border-[var(--t-primary)]"
      }`}
      title={error ?? (complete ? "Bocka ur" : "Bocka av")}
      aria-label={complete ? "Bockad" : "Bocka av sektionen"}
    >
      ✓
    </button>
  );
}
