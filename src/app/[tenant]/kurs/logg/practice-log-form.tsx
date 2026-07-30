"use client";

import { useState, useTransition } from "react";
import { logPracticeDay } from "./actions";

/**
 * Manuell dagsloggning: ett tryck för idag, eller välj en dag bakåt (fönstret
 * sätts av typregistret — servern avvisar för gamla datum oavsett). Lugn ton.
 */
export function PracticeLogForm({
  tenant,
  loggedToday,
  manualWindowDays,
}: {
  tenant: string;
  loggedToday: boolean;
  manualWindowDays: number | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const minDate = (() => {
    if (manualWindowDays === null) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - manualWindowDays);
    return d.toISOString().slice(0, 10);
  })();

  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setMsg(null);
      const res = await logPracticeDay(tenant, date, note);
      setMsg(
        res.ok
          ? { ok: true, text: date === today ? "Dagen är loggad." : `${date} är loggad.` }
          : { ok: false, text: res.error ?? "kunde inte logga" },
      );
      if (res.ok) setNote("");
    });

  return (
    <div className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="log-date"
            className="font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-muted)]"
          >
            Dag
          </label>
          <input
            id="log-date"
            type="date"
            value={date}
            min={minDate}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-[var(--t-soft)] bg-[var(--t-card)] px-3 py-2 text-sm text-[var(--t-text)]"
          />
        </div>
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <label
            htmlFor="log-note"
            className="font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-muted)]"
          >
            Anteckning (valfri)
          </label>
          <input
            id="log-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="t.ex. tyst sittande, 15 min"
            className="rounded-md border border-[var(--t-soft)] bg-[var(--t-card)] px-3 py-2 text-sm text-[var(--t-text)]"
          />
        </div>
        <button
          type="button"
          disabled={pending || (date === today && loggedToday)}
          onClick={submit}
          className="rounded-md bg-[var(--t-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Loggar …" : date === today && loggedToday ? "Idag är loggad" : "Logga dagen"}
        </button>
      </div>
      {manualWindowDays !== null && (
        <p className="mt-3 text-xs text-[var(--t-muted)]">
          Du kan logga upp till {manualWindowDays} dagar bakåt.
        </p>
      )}
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-[var(--t-primary)]" : "text-[var(--t-muted)]"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
