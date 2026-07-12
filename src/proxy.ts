import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (f.d. middleware, Next 16). Enda jobbet: förnya Supabase-sessionen så
 * cookies hålls färska mellan Server Components. Ingen auktoriseringslogik här —
 * åtkomst gatas av RLS i databasen + kontroller i varje route (data-security).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Läser (och förnyar vid behov) sessionen. Får inte tas bort — annars kan
  // token-refresh sluta fungera i Server Components.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Kör på allt utom statiska filer och bilder.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
