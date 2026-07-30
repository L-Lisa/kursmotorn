"use client";

import { useState, useTransition } from "react";
import { logGuideSession } from "../logg/actions";
import type { GuideFormat } from "@/lib/tenant/logg";

/** Guidesessionsformuläret (§3.2): datum, format, sammanhang, antal, anteckning. */
export function GuideSessionForm({
  tenant,
  formats,
}: {
  tenant: string;
  formats: GuideFormat[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const field =
    "rounded-md border border-[var(--t-soft)] bg-[var(--t-card)] px-3 py-2 text-sm text-[var(--t-text)]";
  const label =
    "font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-muted)]";

  return (
    <form
      className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5"
      action={(form) =>
        start(async () => {
          setMsg(null);
          const res = await logGuideSession(tenant, form);
          setMsg(
            res.ok
              ? { ok: true, text: "Sessionen är loggad." }
              : { ok: false, text: res.error ?? "kunde inte logga" },
          );
        })
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="gs-date" className={label}>
            Datum
          </label>
          <input id="gs-date" name="logged_date" type="date" defaultValue={today} max={today} required className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="gs-format" className={label}>
            Format
          </label>
          <select id="gs-format" name="format" className={field}>
            {formats.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-36 flex-1 flex-col gap-1">
          <label htmlFor="gs-context" className={label}>
            Sammanhang (valfritt)
          </label>
          <input id="gs-context" name="context" placeholder="t.ex. arbetsplatsen" className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="gs-count" className={label}>
            Antal (valfritt)
          </label>
          <input id="gs-count" name="participants_count" type="number" min="0" className={`${field} w-24`} />
        </div>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="gs-note" className={label}>
            Anteckning (valfri)
          </label>
          <input id="gs-note" name="note" className={field} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--t-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Loggar …" : "Logga sessionen"}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-[var(--t-primary)]" : "text-[var(--t-muted)]"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
