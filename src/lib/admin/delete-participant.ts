import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * GDPR-radering av deltagare (fas 7, SPEC §2.12). Kräver service-klient — detta är
 * appens ENDA användning av service-nyckeln utanför tester, och den sker i en
 * admin-serveråtgärd (aldrig i renderingsvägen; fas 2-principen står kvar).
 *
 * Ordningen är viktig:
 *  1. Certifikat REVOKERAS + anonymiseras (raden består som återkallad handling —
 *     user_id blir null via FK:n on delete set null; verify-sidan visar "återkallat"
 *     utan persondata).
 *  2. Storage-objekten under deltagarens prefix raderas (DB-kaskaden når dem inte).
 *  3. Auth-användaren raderas ⇒ DB-kaskaden tar allt övrigt (progress, försök,
 *     uploads-rader, loggar, FFMQ, enrollments, approvals, attestations, memberships).
 *
 * Obs: raderingen gäller PERSONEN (auth-kontot) — är kontot medlem i flera tenants
 * försvinner det överallt. Rätt för GDPR-radering; loggat i DECISIONS.
 */
export async function deleteParticipantData(
  svc: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string; removedFiles: number }> {
  // 1. Certifikat: anonymisera + revokera.
  const anon = await svc
    .from("certificates")
    .update({ holder_name: "Raderad deltagare" })
    .eq("user_id", userId);
  if (anon.error) return { ok: false, error: `certifikat: ${anon.error.message}`, removedFiles: 0 };
  const revoke = await svc
    .from("certificates")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (revoke.error) return { ok: false, error: `revokering: ${revoke.error.message}`, removedFiles: 0 };

  // 2. Storage: allt under <tenant>/<user>/ i recordings-bucketen.
  const prefix = `${tenantId}/${userId}`;
  const paths: string[] = [];
  const { data: sectionDirs } = await svc.storage.from("recordings").list(prefix, { limit: 1000 });
  for (const dir of sectionDirs ?? []) {
    if (dir.id) {
      paths.push(`${prefix}/${dir.name}`); // fil direkt under user-mappen
      continue;
    }
    const { data: files } = await svc.storage
      .from("recordings")
      .list(`${prefix}/${dir.name}`, { limit: 1000 });
    for (const f of files ?? []) paths.push(`${prefix}/${dir.name}/${f.name}`);
  }
  if (paths.length > 0) {
    const rm = await svc.storage.from("recordings").remove(paths);
    if (rm.error) return { ok: false, error: `storage: ${rm.error.message}`, removedFiles: 0 };
  }

  // 3. Auth-användaren ⇒ kaskad tar resterande rader.
  const del = await svc.auth.admin.deleteUser(userId);
  if (del.error) return { ok: false, error: `auth: ${del.error.message}`, removedFiles: paths.length };

  return { ok: true, removedFiles: paths.length };
}
