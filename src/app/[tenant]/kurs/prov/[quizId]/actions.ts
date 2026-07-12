"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type QuizResult = {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  attempts_used: number;
  max_attempts: number | null;
  pass_threshold: number;
};

/** Skickar in ett provförsök. All rättning sker i DB-funktionen (facit stannar server-side). */
export async function submitQuiz(
  tenant: string,
  quizId: string,
  answers: Record<string, number>,
): Promise<{ ok: boolean; error?: string; result?: QuizResult }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    p_quiz_id: quizId,
    p_answers: answers,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${tenant}/kurs`);
  return { ok: true, result: data as QuizResult };
}
