"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCohort, updateCohort } from "../actions";
import type { CohortRow } from "@/lib/admin/data";

const field =
  "rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const label = "text-xs uppercase tracking-[0.06em] text-muted-foreground";
const button =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50";

export function CohortCreateForm({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-5"
      action={(form) =>
        start(async () => {
          setError(null);
          const res = await createCohort(slug, form);
          if (!res.ok) setError(res.error ?? "kunde inte skapa");
          else router.push(`/admin/${slug}/kohorter/${res.id}`);
        })
      }
    >
      <div className="flex flex-col gap-1">
        <label className={label}>Namn</label>
        <input name="name" required className={field} placeholder="Kull 2" />
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Startdatum</label>
        <input name="start_date" type="date" required className={field} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Slutdatum (valfritt)</label>
        <input name="end_date" type="date" className={field} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Pris/deltagare (kr)</label>
        <input name="price_per_participant_sek" type="number" min="0" required className={field} />
      </div>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Skapar …" : "Skapa kohort"}
      </button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

export function CohortEditForm({ slug, cohort }: { slug: string; cohort: CohortRow }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-5"
      action={(form) =>
        start(async () => {
          const res = await updateCohort(slug, cohort.id, form);
          setMsg(res.ok ? "Sparat." : (res.error ?? "kunde inte spara"));
        })
      }
    >
      <div className="flex flex-col gap-1">
        <label className={label}>Namn</label>
        <input name="name" defaultValue={cohort.name} required className={field} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Startdatum</label>
        <input name="start_date" type="date" defaultValue={cohort.startDate} required className={field} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Slutdatum</label>
        <input name="end_date" type="date" defaultValue={cohort.endDate ?? ""} className={field} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Pris/deltagare (kr)</label>
        <input
          name="price_per_participant_sek"
          type="number"
          min="0"
          defaultValue={cohort.priceSek}
          required
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Status</label>
        <select name="status" defaultValue={cohort.status} className={field}>
          <option value="planned">planerad</option>
          <option value="active">aktiv</option>
          <option value="completed">avslutad</option>
          <option value="cancelled">inställd</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Såld av</label>
        <select name="sold_by" defaultValue={cohort.soldBy} className={field}>
          <option value="platform">plattformen</option>
          <option value="leader">kursledare</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={label}>Levereras av</label>
        <select name="delivered_by" defaultValue={cohort.deliveredBy} className={field}>
          <option value="platform">plattformen</option>
          <option value="leader">kursledare</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Sparar …" : "Spara"}
      </button>
      {msg && <p className="w-full text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}
