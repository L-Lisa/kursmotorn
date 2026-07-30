"use client";

import { useState, useTransition } from "react";
import { addEnrollment, moveEnrollment, setEnrollmentMark } from "../../actions";

const field =
  "rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const label = "text-xs uppercase tracking-[0.06em] text-muted-foreground";
const button =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50";

export function AddEnrollmentForm({
  slug,
  cohortId,
  cohortStart,
  members,
}: {
  slug: string;
  cohortId: string;
  cohortStart: string;
  members: { userId: string; label: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        Alla deltagarkonton har redan en aktiv plats.
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-5"
      action={(form) =>
        start(async () => {
          setError(null);
          const res = await addEnrollment(slug, cohortId, form);
          if (!res.ok) setError(res.error ?? "kunde inte lägga till");
        })
      }
    >
      <div className="flex flex-col gap-1">
        <label className={label}>Deltagare</label>
        <select name="user_id" required className={field}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Startdatum (eftersläntrare)</label>
        <input name="starts_at" type="date" defaultValue={cohortStart} className={field} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Företag (valfritt)</label>
        <input name="company" className={field} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Prisjustering kr (valfritt)</label>
        <input name="price_override_sek" type="number" min="0" className={field} />
      </div>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Lägger till …" : "Lägg till"}
      </button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

/** Fakturerad/betald — manuell markering som kan sättas och ångras (ingen extern effekt). */
export function MarkToggle({
  slug,
  enrollmentId,
  field: fieldName,
  value,
}: {
  slug: string;
  enrollmentId: string;
  field: "invoiced_at" | "paid_at";
  value: string | null;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setEnrollmentMark(slug, enrollmentId, fieldName, !value)))}
      className={`rounded-full border px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] ${
        value
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      } disabled:opacity-50`}
      title={value ? `Satt ${value.slice(0, 10)} — klicka för att ångra` : "Klicka för att markera"}
    >
      {value ? value.slice(0, 10) : "—"}
    </button>
  );
}

/**
 * Flytt av deltagare: bekräftelsedialog med FÖNSTERVARNING (godkända specen §4.3 —
 * certfönstren räknas om från nya enrollmentens starts_at). Egen dialog i sidan,
 * ingen browser-confirm.
 */
export function MoveEnrollmentDialog({
  slug,
  enrollmentId,
  participantName,
  cohorts,
}: {
  slug: string;
  enrollmentId: string;
  participantName: string;
  cohorts: { id: string; name: string; startDate: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [toCohort, setToCohort] = useState(cohorts[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const target = cohorts.find((c) => c.id === toCohort);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-[family-name:var(--font-mono)] text-xs text-primary hover:underline"
      >
        Flytta …
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-left shadow-lg">
        <h3 className="mb-1 text-lg font-semibold text-foreground">
          Flytta {participantName}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Flytten skapar en ny plats i målkohorten och markerar den nuvarande som avslutad
          (historiken består).
        </p>

        <div className="mb-3 flex flex-col gap-1">
          <label className={label}>Till kohort</label>
          <select value={toCohort} onChange={(e) => setToCohort(e.target.value)} className={field}>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (start {c.startDate})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4 flex flex-col gap-1">
          <label className={label}>Nytt startdatum (tomt = kohortens start)</label>
          <input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={field}
          />
        </div>

        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
          <strong>Obs — certfönstren räknas om.</strong> Loggfönstren (t.ex. kravet på
          övningsdagar per vecka) utgår från det nya startdatumet
          {target ? ` (${startsAt || target.startDate})` : ""}. Dagar som deltagaren redan
          loggat räknas bara om de faller inom de nya fönstren.
        </div>

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={pending || !toCohort}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await moveEnrollment(slug, enrollmentId, toCohort, startsAt || null);
                if (!res.ok) setError(res.error ?? "kunde inte flytta");
                else setOpen(false);
              })
            }
            className={button}
          >
            {pending ? "Flyttar …" : "Bekräfta flytt"}
          </button>
        </div>
      </div>
    </div>
  );
}
