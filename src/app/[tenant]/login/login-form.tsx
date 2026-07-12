"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Demo-login (v1). Enkla konton mot Supabase Auth. Före riktiga deltagare härdas
 * detta i go-live-grinden (auth-granskning) — se TASKS.md.
 */
export function LoginForm({ tenant }: { tenant: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Fel e-post eller lösenord.");
      setLoading(false);
      return;
    }
    router.push(`/${tenant}/kurs`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.1em] text-[var(--t-muted)]">
          E-post
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-[var(--t-soft)] bg-[var(--t-card)] px-3 py-2.5 text-[var(--t-text)] outline-none focus:border-[var(--t-primary)]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.1em] text-[var(--t-muted)]">
          Lösenord
        </span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-[var(--t-soft)] bg-[var(--t-card)] px-3 py-2.5 text-[var(--t-text)] outline-none focus:border-[var(--t-primary)]"
        />
      </label>

      {error && <p className="text-sm text-[#b3261e]">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-[var(--t-primary)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}
