"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  redirectTo,
  className = "font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.1em] text-[var(--t-muted)] hover:text-[var(--t-text)]",
}: {
  redirectTo: string;
  className?: string;
}) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push(redirectTo);
    router.refresh();
  }
  return (
    <button onClick={signOut} className={className}>
      Logga ut
    </button>
  );
}
