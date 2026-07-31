"use client";

import { useState, useTransition } from "react";
import { FFMQ_QUESTIONS, FFMQ_SCALE } from "@/lib/tenant/ffmq";
import { submitFfmq } from "./actions";

/** FFMQ-15-formuläret: sajtens 15 svenska påståenden, skala 1–5 (lydelser ordagrant). */
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
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answered = Object.keys(answers).length;
  const complete = answered === FFMQ_QUESTIONS.length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!complete) {
          setError("Besvara alla påståenden innan du sparar.");
          return;
        }
        start(async () => {
          setError(null);
          const res = await submitFfmq(tenant, cohortId, answers);
          if (!res.ok) setError(res.error ?? "kunde inte spara");
        });
      }}
    >
      <div className="mb-6 rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-4 text-xs text-[var(--t-muted)]">
        <p className="mb-1 text-[var(--t-text)]">
          Välj hur sanna påståendena känns för dig just nu.
        </p>
        {FFMQ_SCALE.map((s) => (
          <span key={s.value} className="mr-4 inline-block">
            {s.label}
          </span>
        ))}
      </div>

      <ol className="flex flex-col gap-5">
        {FFMQ_QUESTIONS.map((q, i) => (
          <li key={q.id} className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-4">
            <p className="mb-1 font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-muted)]">
              {q.facet}
            </p>
            <p className="mb-3 text-[15px] text-[var(--t-text)]">
              <span className="mr-2 font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
                {i + 1}.
              </span>
              {q.text}
            </p>
            <div className="flex gap-2" role="radiogroup" aria-label={`Påstående ${i + 1}`}>
              {FFMQ_SCALE.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={answers[q.id] === s.value}
                  title={s.label}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: s.value }))}
                  className={`h-9 w-9 rounded-md border text-sm ${
                    answers[q.id] === s.value
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
          {answered}/{FFMQ_QUESTIONS.length} besvarade
          {lockDate ? ` · kan ändras t.o.m. ${lockDate}` : ""}
        </span>
      </div>
      {error && <p className="pb-4 text-sm text-[var(--t-muted)]">{error}</p>}
    </form>
  );
}
