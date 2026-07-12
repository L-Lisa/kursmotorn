"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueCertificate } from "./actions";

/**
 * Utfärdar certifikatet. Server-fn re-verifierar alla krav — knappen visas bara
 * när allt är uppfyllt, men det är server-sidan som avgör.
 */
export function IssueButton({ tenant }: { tenant: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await issueCertificate(tenant);
            if (!r.ok) setError(r.error ?? "fel");
            else router.refresh();
          })
        }
        className="rounded-md bg-[var(--t-primary)] px-5 py-2.5 text-sm text-white transition-opacity disabled:opacity-40"
      >
        {pending ? "Utfärdar…" : "Utfärda mitt certifikat"}
      </button>
      {error && <p className="mt-3 text-sm text-[var(--t-muted)]">Kunde inte utfärda: {error}</p>}
    </div>
  );
}
