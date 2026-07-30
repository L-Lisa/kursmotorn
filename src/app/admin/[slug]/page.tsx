import Link from "next/link";
import { requireTenantAdmin, listParticipants, listCohorts } from "@/lib/admin/data";
import { DeleteParticipantDialog } from "./delete-participant-dialog";

/**
 * Admin-dashboard: deltagarlistan med kohortfilter (ACCEPTANCE §Fas 6).
 * Progress %, senast aktiv, provstatus och härledd status (aktiv/fast/klar).
 */
export default async function ParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kohort?: string }>;
}) {
  const { slug } = await params;
  const { kohort } = await searchParams;
  const { tenantId } = await requireTenantAdmin(slug);

  const [cohorts, rows] = await Promise.all([
    listCohorts(tenantId),
    listParticipants(tenantId, kohort || undefined),
  ]);
  const hasGuideCol = rows.some((r) => r.guideSessions !== null);

  const derivedBadge: Record<string, string> = {
    klar: "bg-primary/10 text-primary",
    aktiv: "bg-secondary text-secondary-foreground",
    fast: "bg-destructive/10 text-destructive",
  };

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Deltagare</h1>
        <span className="m-label">{rows.length} st</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="m-label">Kohort:</span>
        <Link
          href={`/admin/${slug}`}
          className={`rounded-full border border-border px-3 py-1 text-xs ${
            !kohort ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Alla
        </Link>
        {cohorts.map((c) => (
          <Link
            key={c.id}
            href={`/admin/${slug}?kohort=${c.id}`}
            className={`rounded-full border border-border px-3 py-1 text-xs ${
              kohort === c.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Namn", "Kohort", "Progress", "Senast aktiv", "Slutprov", ...(hasGuideCol ? ["Guidesessioner"] : []), "Status", ""].map((h, i) => (
                <th
                  key={i}
                  className="px-5 py-3 text-xs font-normal uppercase tracking-[0.06em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-b border-border last:border-0">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-foreground">{r.fullName}</div>
                  <div className="font-[family-name:var(--font-mono)] text-[11px] text-muted-foreground">
                    {r.email}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{r.cohortName ?? "—"}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${r.progressPct}%` }}
                      />
                    </div>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                      {r.progressPct} %
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                  {r.lastActiveAt ? r.lastActiveAt.slice(0, 10) : "—"}
                </td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground">
                  {r.finalQuiz === "passed"
                    ? "Godkänt"
                    : r.finalQuiz === "attempted"
                      ? "Påbörjat"
                      : r.finalQuiz === "none"
                        ? "Ej påbörjat"
                        : "—"}
                </td>
                {hasGuideCol && (
                  <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                    {r.guideSessions ?? "—"}
                  </td>
                )}
                <td className="px-5 py-3.5">
                  <span
                    className={`rounded-full px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] ${derivedBadge[r.derived]}`}
                  >
                    {r.derived}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <DeleteParticipantDialog slug={slug} userId={r.userId} participantName={r.fullName} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={hasGuideCol ? 8 : 7} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Inga deltagare {kohort ? "i den kohorten" : "ännu"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
