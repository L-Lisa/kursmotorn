"use client";

import { useState, useTransition } from "react";
import { FFMQ_ITEMS, FFMQ_SCALE, FFMQ_INSTRUCTION } from "@/lib/tenant/ffmq";
import { submitFfmq } from "./actions";

/** FFMQ-formuläret: 39 påståenden, skala 1–5 (originalets lydelser, ordagrant). */
export function FfmqForm({
  tenant,
  cohortId,
  lockDate,
  hasExisting,
}: {
  tenant: string;
  cohortId: string;
  lockDate: string | null;
  hasExisting: boolean;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(Array(FFMQ_ITEMS.length).fill(null));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answered = answers.filter((a) => a !== null).length;
  const complete = answered === FFMQ_ITEMS.length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!complete) {
          setError("Alla påståenden behöver ett svar.");
          return;
        }
        start(async () => {
          setError(null);
          const res = await submitFfmq(tenant, cohortId, answers as number[]);
          if (!res.ok) setError(res.error ?? "kunde inte spara");
        });
      }}
    >
      <p className="mb-4 max-w-prose text-sm italic text-[var(--t-muted)]">{FFMQ_INSTRUCTION}</p>
      <div className="mb-6 rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-4 text-xs text-[var(--t-muted)]">
        {FFMQ_SCALE.map((s) => (
          <span key={s.value} className="mr-4 inline-block">
            <strong className="text-[var(--t-text)]">{s.value}</strong> = {s.label}
          </span>
        ))}
      </div>

      <ol className="flex flex-col gap-5">
        {FFMQ_ITEMS.map((item, i) => (
          <li key={i} className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-4">
            <p className="mb-3 text-[15px] text-[var(--t-text)]">
              <span className="mr-2 font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
                {i + 1}.
              </span>
              {item}
            </p>
            <div className="flex gap-2" role="radiogroup" aria-label={`Påstående ${i + 1}`}>
              {FFMQ_SCALE.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={answers[i] === s.value}
                  title={s.label}
                  onClick={() =>
                    setAnswers((prev) => prev.map((v, j) => (j === i ? s.value : v)))
                  }
                  className={`h-9 w-9 rounded-md border text-sm ${
                    answers[i] === s.value
                      ? "border-[var(--t-primary)] bg-[var(--t-primary)] text-white"
                      : "border-[var(--t-soft)] text-[var(--t-text)] hover:border-[var(--t-primary)]"
                  }`}
                >
                  {s.value}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 mt-8 flex items-center gap-4 border-t border-[var(--t-soft)] bg-[var(--t-bg)] py-4">
        <button
          type="submit"
          disabled={pending || !complete}
          className="rounded-md bg-[var(--t-primary)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sparar …" : hasExisting ? "Uppdatera förmätningen" : "Spara förmätningen"}
        </button>
        <span className="text-sm text-[var(--t-muted)]">
          {answered}/{FFMQ_ITEMS.length} besvarade
          {lockDate ? ` · kan ändras t.o.m. ${lockDate}` : ""}
        </span>
      </div>
      {error && <p className="pb-4 text-sm text-[var(--t-muted)]">{error}</p>}
    </form>
  );
}
