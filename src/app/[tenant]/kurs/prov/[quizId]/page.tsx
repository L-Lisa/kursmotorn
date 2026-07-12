import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { createClient } from "@/lib/supabase/server";
import { QuizForm } from "./quiz-form";

export default async function ProvPage({
  params,
}: {
  params: Promise<{ tenant: string; quizId: string }>;
}) {
  const { tenant, quizId } = await params;
  const { brand } = await getTenantContext(tenant);

  const user = await getCurrentUser();
  if (!user) redirect(`/${tenant}/login`);

  const supabase = await createClient();
  const { data: quiz } = await supabase.rpc("get_quiz", { p_quiz_id: quizId });
  if (!quiz) notFound();

  const { count } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quizId)
    .eq("user_id", user.id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--t-soft)] px-6 py-4">
        <Link
          href={`/${tenant}/kurs`}
          className="font-[family-name:var(--t-serif)] text-lg text-[var(--t-text)]"
        >
          {brand.displayName}
        </Link>
        <Link
          href={`/${tenant}/kurs`}
          className="font-[family-name:var(--t-mono)] text-xs uppercase tracking-[0.1em] text-[var(--t-muted)] hover:text-[var(--t-text)]"
        >
          Avbryt
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="mb-8 font-[family-name:var(--t-serif)] text-3xl text-[var(--t-text)]">
          {quiz.title}
        </h1>
        <QuizForm tenant={tenant} quiz={quiz} attemptsUsed={count ?? 0} />
      </main>
    </div>
  );
}
