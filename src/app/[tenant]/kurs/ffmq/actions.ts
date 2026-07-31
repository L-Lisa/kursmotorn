"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/tenant/context";

type Result = { ok: boolean; error?: string };

/**
 * FFMQ-inlämningen: tunn wrapper — scoring OCH tidslåset bor i DB-funktionen
 * submit_ffmq (kan inte kringgås; direktskrivning är borttagen i migration ..13).
 */
export async function submitFfmq(
  tenant: string,
  cohortId: string,
  answers: Record<string, number>, // sajtens AnswerMap: {"q1": 1..5, ...}
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ej inloggad" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_ffmq", {
    p_cohort_id: cohortId,
    p_occasion: "pre",
    p_answers: answers,
  });
  if (error) {
    if (/låst|fönster/.test(error.message)) return { ok: false, error: error.message };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/${tenant}/kurs/ffmq`);
  return { ok: true };
}
