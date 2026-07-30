"use client";

import { useState, useTransition } from "react";
import { deleteParticipant } from "./actions";

/**
 * GDPR-raderingen (fas 7): egen bekräftelsedialog med tydlig konsekvenstext.
 * Knappen visas för alla admins men servern kräver plattformsadmin.
 */
export function DeleteParticipantDialog({
  slug,
  userId,
  participantName,
}: {
  slug: string;
  userId: string;
  participantName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-[family-name:var(--font-mono)] text-xs text-destructive hover:underline"
      >
        Radera …
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-left shadow-lg">
        <h3 className="mb-1 text-lg font-semibold text-foreground">
          Radera {participantName}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Detta raderar kontot och ALL deltagardata: progress, provförsök, loggar,
          FFMQ-svar, inspelningar (även filerna). Certifikat återkallas och anonymiseras.
          Åtgärden kan inte ångras.
        </p>
        <label className="mb-1 block text-xs uppercase tracking-[0.06em] text-muted-foreground">
          Skriv RADERA för att bekräfta
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mb-4 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirmText("");
              setError(null);
            }}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={pending || confirmText !== "RADERA"}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await deleteParticipant(slug, userId);
                if (!res.ok) setError(res.error ?? "kunde inte radera");
                else setOpen(false);
              })
            }
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Raderar …" : "Radera permanent"}
          </button>
        </div>
      </div>
    </div>
  );
}
