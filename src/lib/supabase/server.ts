import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase-klient (anon-nyckel + användarens session ur cookies).
 * RLS gäller: utan session = rollen `anon`, med session = `authenticated`.
 * Servern rör ALDRIG service-nyckeln här — tenant-isolationen vilar på RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // I Server Components går det inte att sätta cookies — proxy.ts sköter
          // sessionsförnyelsen. Vi sväljer felet så render inte kraschar.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* anropat från en Server Component — proxy.ts förnyar sessionen */
          }
        },
      },
    },
  );
}
