"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitQuiz, type QuizResult } from "./actions";

type Question = { id: string; position: number; question: string; options: string[] };
type Quiz = {
  id: string;
  title: string;
  pass_threshold: number;
  max_attempts: number | null;
  is_final: boolean;
  questions: Question[];
};

export function QuizForm({
  tenant,
  quiz,
  attemptsUsed,
}: {
  tenant: string;
  quiz: Quiz;
  attemptsUsed: number;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);
  const outOfAttempts =
    quiz.max_attempts !== null && attemptsUsed >= quiz.max_attempts;

  if (result) {
    return (
      <div className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-6">
        <p className="font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.12em] text-[var(--t-muted)]">
          Resultat
        </p>
        <p className="mt-2 font-[family-name:var(--t-serif)] text-3xl text-[var(--t-text)]">
          {result.score}%{" "}
          <span className={result.passed ? "text-[var(--t-primary)]" : "text-[#b3261e]"}>
            {result.passed ? "Godkänt" : "Underkänt"}
          </span>
        </p>
        <p className="mt-2 text-sm text-[var(--t-muted)]">
          {result.correct} av {result.total} rätt · gräns {result.pass_threshold}% ·
          försök {result.attempts_used}
          {result.max_attempts ? ` / ${result.max_attempts}` : ""}
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            href={`/${tenant}/kurs`}
            className="rounded-md bg-[var(--t-primary)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Till kursen
          </Link>
          {!result.passed &&
            (result.max_attempts === null || result.attempts_used < result.max_attempts) && (
              <button
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
                className="rounded-md border border-[var(--t-soft)] px-5 py-2.5 text-sm text-[var(--t-text)]"
              >
                Gör om provet
              </button>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
        {quiz.questions.length} frågor · gräns {quiz.pass_threshold}%
        {quiz.max_attempts ? ` · försök ${attemptsUsed}/${quiz.max_attempts}` : ""}
      </p>

      {outOfAttempts ? (
        <p className="text-[#b3261e]">Du har använt alla försök på det här provet.</p>
      ) : (
        <>
          {quiz.questions.map((q, i) => (
            <fieldset
              key={q.id}
              className="rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-5"
            >
              <legend className="mb-3 text-[var(--t-text)]">
                <span className="font-[family-name:var(--t-mono)] text-xs text-[var(--t-muted)]">
                  {i + 1}.
                </span>{" "}
                {q.question}
              </legend>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--t-text)]"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === oi}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      className="accent-[var(--t-primary)]"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {error && <p className="text-sm text-[#b3261e]">{error}</p>}

          <button
            disabled={!allAnswered || pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await submitQuiz(tenant, quiz.id, answers);
                if (!r.ok) setError(r.error ?? "fel");
                else setResult(r.result!);
              })
            }
            className="self-start rounded-md bg-[var(--t-primary)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Rättar…" : "Lämna in provet"}
          </button>
        </>
      )}
    </div>
  );
}
