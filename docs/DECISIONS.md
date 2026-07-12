# DECISIONS — Kursmotorn-bygget

> Varje val som inte står i SPEC/datamodell loggas här med datum + motiv (CLAUDE.md #7).
> Grindkvittenser loggas också här.

## 2026-07-12 — Fas 0: verktygsval vid scaffold
- **Next.js 16.2.10 (App Router) + React 19 + Tailwind 4** — `create-next-app@latest` med `--src-dir`, import-alias `@/*`. Motiv: Lisas beprövade mönster (Jobbresan kör Next 16); senaste stabila.
- **shadcn/ui init: `-b radix`, preset `nova`, css-variables.** Motiv: radix = etablerade primitives (Jobbresan-mönstret); nova-presetens palett är bara startvärde — motor-chromens tokens ur `../brand.md` ersätter den i fas 2. Nya CLI:t (v4.x) har inte kvar `--base-color`-flaggan.
- **AGENTS.md (autogenererad av create-next-app) behållen** — generisk Next 16-vägledning. Vid konflikt vinner repo-CLAUDE.md (dess uttryckliga regel).
- **Supabase-projekt:** `kursmotorn`, ref `lsqfsntwnvquakmqeryn`, eu-north-1, skapat 2026-07-12 via MCP med Lisas stående OK (10 USD/mån — kostnaden har startat, Lisa meddelad i sessionen).
- **Git:** nested repo i `projects/kursmotorn/app/` (repo-roten per byggspec-paketet); yttre COWORK-repot spårar inte hit in. Författare verifierad FÖRE första commit: `Lisa <lisaojeland@gmail.com>` (global config — Vercel-författarlärdomen 2026-07-05).
- **Env-namn `SUPABASE_SECRET_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`:** app-koden följer Supabases nyckelterminologi. RLS-policies skrivs mot `authenticated`/`anon`; serverfunktioner som måste kringgå RLS (utfärdande, loggskrivning) körs `SECURITY DEFINER`. Migrationerna nämner Postgres-rollen `service_role` legitimt i GRANT/policy-rader — därför är hemlighetsgrinden värdeorienterad (se GRIND 0-beslutet nedan), inte ordbaserad.
- **Modellnot:** fas 0 påbörjad av Fable 5; Lisa bytte till **Opus 4.8** efter uppsättningen → resten av bygget följer `system/model-notes.md`-protokollet (mer mekaniskt, verifiera oftare, färsk verifieringssubagent på high-stakes-faser, eskalera hellre än gissa).

## 2026-07-12 — GRIND 0 kvitto
- **repo bygger lokalt:** `npm run build` grönt (`/` + `/_not-found` prerendered). ✓
- **`.env*` git-ignorerad:** `.env`, `.env.local`, `.env.production` fångas av `.gitignore`; `.env.example` (endast tomma värden) är den enda spårade env-filen. ✓
- **författare:** `Lisa <lisaojeland@gmail.com>` verifierad på HEAD FÖRE (och efter amend) allt arbete. ✓
- **hemligheter = 0 (binär grind, pass).** Se beslutet nedan.

### Beslut: hemlighetsgrinden värdeorienterad (Lisas order 2026-07-12)
Den ursprungliga grinden (`grep -ci` på ett rått ordmönster) hade två fel: (1) mönstertexten matchade sig själv där grinden citeras i spec-filerna → falska träffar utan att någon hemlighet läckt; (2) den skulle dessutom falsklarma på **legitim `service_role`-SQL i RLS-migrationerna** — GRANT- och policy-rader nämner Postgres-rollen med rätta. Ett kortlivat "lämna som känd artefakt"-utfall revs upp: en säkerhetsgrind ska vara **binär** (0 = pass, allt annat = stopp).

**Fix:** grindens kommando byttes i `TASKS.md` (GRIND 0), `ACCEPTANCE_CRITERIA.md` (§Genomgående) och `CLAUDE.md` (§Git) till att matcha faktiska hemlighets*värden* och utesluta lockfilen:
```
git log -p -- . ':(exclude)package-lock.json' | grep -cE "sk-ant-[A-Za-z0-9]|sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}"
```
Mönstret träffar en riktig Anthropic-nyckel, en Supabase-secret och en JWT, men varken sin egen regex-text (hakparenteserna bryter självträffen) eller ordet `service_role` i SQL. `package-lock.json` utesluts så integrity-hasharnas `eyJ…`-slump inte räknas.

**Historik:** repot var nytt (en commit) → fas 0-commiten amend:ades (+ `reflog expire`/`gc`) så tidigare klartext-markörer försvann ur den nåbara historiken. **Verifierat: kommandot ger exakt `0`.** Grinden körs oförändrad vid varje efterföljande fas.

### Incident: repo-CLAUDE.md klobbrades av scaffold-rsyncen (åtgärdad samma commit)
`create-next-app` genererar en egen `CLAUDE.md` som bara innehåller `@AGENTS.md`. När scaffolden `rsync`:ades in i `app/` skrev den över byggspecens repo-regelfil (`CLAUDE.md`, 5,5 kB) — och den stubben (11 B) hann committas i fas 0. Upptäckt när §Git-editen slog fel ("shorter than offset"). **Åtgärd:** byggspecens `CLAUDE.md` återställd ordagrant ur sessionskontexten (lästes vid sessionsstart), med `@AGENTS.md`-importen tillagd sist så Next 16-vägledningen behålls; repo-reglerna vinner vid konflikt. Ingår i den amend:ade fas 0-commiten. **Lärdom (till fas 9 + projektminnet):** scaffold-verktyg kan generera egna `CLAUDE.md`/`AGENTS.md` — rsynca ALDRIG rått över en repo-rot som redan bär byggspec-filer; exkludera `CLAUDE.md`/`AGENTS.md` eller diffa efter kopiering.

## 2026-07-12 — Fas 1: datamodell + RLS + seed
- **Migrationer (supabase/migrations/):** `..01_schema` (24 tabeller ur datamodell.md + guide-spec §2; tenant_id på ALLT; partiellt unikt index `activity_logs_practice_day_unique`; partiellt unikt `enrollments_one_active_per_course` som backar server-regeln på DB-nivå), `..02_rls` (3 SECURITY DEFINER-hjälpfn + RLS på alla 24 + policies), `..03_storage` (privat bucket `recordings` + path-prefix-policies `<tenant>/<user>/<section>`), `..04_hardening` (search_path-fix). **Applicerade på fjärrprojektet via MCP** (tomt projekt = provisionering; samma SQL som filerna).
- **Beslut — enum vs CHECK:** alla värdemängder som `text` + `CHECK` (lättare att evolvera än Postgres-enum).
- **Beslut — `enrollments.course_id` denormaliserad:** krävs för det partiella unika indexet "en aktiv enrollment per user+kurs" (kurs nås annars bara via cohort). Serverfunktionen i fas 6 håller det konsistent med cohort.course_id.
- **Beslut — RLS-mönster:** hjälpfn är SECURITY DEFINER (ägs av postgres → kringgår RLS på memberships → ingen policy-rekursion). Config/innehåll = medlem läser, admin skriver. Deltagardata = egen rad (`user_id = auth.uid()` i USING + WITH CHECK), admin ser/hanterar tenantens. Admin-hanterad deltagardata (enrollments/certificates/approvals/mg_guide_status) = ingen deltagar-insert. `certificates` privat i fas 1 — publika `/verify`-sidan får egen SECURITY DEFINER-läsfunktion i fas 5 (inte öppen RLS).
- **Advisor-WARN som ACCEPTERAS (dokumenteras, ej åtgärdas i v1):** de tre hjälpfn:erna är RPC-exponerade för anon/authenticated. Ofarligt — varje funktion avslöjar bara ANROPARENS egen status, aldrig annans, och RLS kräver att de är anropbara. `auth_leaked_password_protection` (HaveIBeenPwned) avstängt = auth-konfig till go-live-grinden (riktiga lösenord), inte v1 med fiktiva konton.
- **Seed (supabase/seed.sql):** ENDAST fiktiva deltagare — 2 tenants, 5 login-kapabla konton (auth.users + auth.identities, lösenord `Testlosen123!`), Lisa = plattformsadmin + owner båda, en tenant1-admin som INTE är plattformsadmin (för admin-isolationstestet), Anna/Bengt (tenant1), Cecilia (tenant2) + kurser/moduler/sektioner/prov/kohorter/enrollments/loggar/certifikat. Login-konton via direkt SQL (ingen secret key behövdes).

### GRIND 1 kvitto — RLS-isolationssviten (7/7 PASS)
`npm run test:rls` (node:test + supabase-js, riktiga inloggningar): 1. anon kan inte läsa kurser · 2. Anna ser bara egen tenant + egen data · 3. Bengt ser inte Annas försök · 4. Anna kan inte skapa försök i Bengts namn (WITH CHECK) · 5. tenant1-admin (ej plattformsadmin) ser tenant1 aldrig tenant2 · 6. Cecilia ser bara tenant2 · 7. `practice_day` dagsunik, `guide_session` ej.
- **Node 20-fix:** supabase-js realtime kräver WebSocket som Node 20 saknar → `ws` injiceras som `realtime.transport` (dev-dep). Bekräftar minnesnoten "supabase-js kräver Node 22"; PostgREST-vägen funkar på 20 med ws-shim.
- **Hemlighetsgrind fortsatt 0** (`.env.local` med anon-JWT:n är git-ignorerad).
- **RESIDUAL (ej blockerande):** lokal `supabase db reset` kunde inte köras (ingen Docker i miljön) → reproducerbarhet verifierad via lyckad fjärrapplicering + passerande RLS-svit mot det applicerade schemat, inte via ren lokal reset. Kör i Docker-miljö före go-live (ACCEPTANCE fas 0–1).

## 2026-07-12 — Adversariell review av fas 0–1 (Opus, före fas 2) + två härdningar
Lisa bad om en granskning av fundamentet före fas 2. Grindarna omkördes skarpt mot live-DB (inte från loggen): **RLS-svit 7/7**, RLS på 24/24 tabeller, 0 tabeller utan policy, 55 policies, 3 SECURITY DEFINER-fn:er alla `search_path=public`, hemlighetsgrind 0, `.env*` ospårad, inga hårdkodade brand/priser i `src/`, säkerhetsadvisors = enbart de 6 accepterade + leaked-password (→ go-live). Fundamentet bedömt **solitt** — fynden nedan är härdnings-/täckningsluckor, inga brott. Två åtgärdade nu; fyra loggade som öppna.

**Fynd 1 (åtgärdat) — RLS-regressionsvakten testade nästan bara läsning.** `test/rls.test.mjs` utökad från 7 → 12 fall med negativa skrivvägar: deltagare kan inte skriva config (courses/sections), inte höja egen membership-roll, inte skapa upload/attempt i annans namn eller radera annans progress; tenant1-admin kan inte skriva in i tenant2 (cross-tenant WITH CHECK); **storage path-prefix-policyn testas nu skarpt** (egen mapp OK, annans nekad — tidigare 0 % täckt). Regel: INSERT-nekande ger error, UPDATE/DELETE-nekande via USING ger 0 rader — sviten kollar rätt sak per verb. **12/12 grönt.**

**Fynd 2 (åtgärdat) — `enrollments.course_id` denormaliserad utan DB-garanti.** Kunde driva från `cohorts.course_id` (RLS tillåter admin-skrivning) → "en aktiv per kurs"-indexet + certfönstren hade räknat tyst fel. Migration `..05_enrollment_integrity.sql`: `cohorts unique(id, course_id)` + composite-FK `enrollments(cohort_id, course_id) → cohorts(id, course_id) on delete cascade`. **Applicerad mot fjärr-DB på Lisas OK (`apply_migration`); bett verifierat** (mismatchad insert avvisas med foreign_key_violation; 3 befintliga enrollments intakta). DB:n garanterar nu det fas 6-serverfunktionen annars bara lovade.

**Öppna fynd (loggade, ej åtgärdade — Lisas beslut: fixa 1+2 nu):**
- **Fynd 3 [Medium, känd]:** `supabase db reset` + seed aldrig körd rent (ingen Docker) — uttryckligt Fas 0–1-kriterium. Live-schemat styrker filerna men är inte en ren reset. **Håll ACCEPTANCE fas 0–1 synligt öppen tills körd i Docker; blockerande före eject (fas 8)/go-live.**
- **Fynd 4 [Låg–Medium, framåtvakt]:** anon har noll läsning på `tenants`/`tenant_brands`. Fas 2:s publika tenant-brandade landnings-/login-sida + `/verify/<slug>` (fas 5) kräver en **smal SECURITY DEFINER-lookup (slug + brand-tokens)** — luckra ALDRIG upp RLS med bred anon-SELECT.
- **Fynd 5 [Låg]:** `practice_day`-unikheten är global per user (user_id, log_type, logged_date), inte per kurs — bekräfta avsikt före fas 7:s MG-fönster (deltagare i två kurser skulle annars blockeras).
- **Fynd 6 [Låg]:** endast `recordings`-bucketen finns; bild-/kursmedia-buckets + path-prefix-policyer byggs i fas 2/3 med samma rigor.

## 2026-07-12 — Fas 2: context-lager + tenant-rendering (commit `8ca0bbf`)

### Arkitekturbeslut
- **Eject-snittet realiserat som `src/lib/tenant/`.** All tenant-data läses genom `getTenantContext(slug)` → `parseBrand()` (enda stället en rå brand_spec tolkas). Brand-tokens blir inline `--t-*`-CSS-variabler via `brandCssVars()`, satta på tenant-layoutens wrapper. Komponenterna läser bara `var(--t-*)` — ingen komponent känner till en specifik tenant. Det är detta som gör exporten (fas 8) möjlig: byt datakällan, behåll komponenterna.
- **@supabase/ssr + `proxy.ts` (Next 16).** `middleware` heter `proxy` från v16 (Node-runtime default). Tre klienter: `server.ts` (RSC, anon-nyckel + session ur cookies), `client.ts` (browser, för login), `proxy.ts` (sessionsförnyelse; ingen auktoriseringslogik — RLS + per-route-kontroller gatar). Motorn rör **aldrig** service-nyckeln i renderingsvägen — tenant-isolationen vilar på RLS hela vägen.
- **Fynd 4 åtgärdat — smal publik brand-lookup.** Migration `..06`: `tenant_public_brand(slug)` SECURITY DEFINER returnerar EN tenants slug + brand_spec, `grant execute … to anon`. Ingen bred anon-SELECT på tenants/tenant_brands. Samma funktion används av login-/landningssidan (anon) OCH av inloggade vyer — ett context-lager oavsett rollen.
- **Routning: path-baserad `/{tenant-slug}/…`** i demon. Host-/subdomän-mappning kräver wildcard-DNS + Vercel-domän → **fortsatt öppen** (SPEC §5), avgörs mot Vercel-uppsättningen; path-vägen räcker för v1-demon och exporten.
- **Motor-namnet = konfigvariabel.** `NEXT_PUBLIC_APP_NAME` (default "Kursmotorn") i `src/lib/config.ts` — namnbytes-säkert.
- **Fonter self-hostas via `next/font/google`** (Inter, JetBrains Mono, Lora, Fraunces, Source Sans 3, Geist Mono). Namn i brand_spec → CSS-variabel via en registry. **v1-begränsning:** next/font kräver statiska importer, så en tenant kan bara välja bland de laddade familjerna; okänt fontnamn → sans-fallback. Ny kundfont = en importrad + deploy (självbetjäning senare). Loggat som medvetet avsteg.
- **MG `primary_dark` = `#0F1B30`** är en härledd mörkare Ink-nyans (MG:s brand.md anger inget primary_dark; Ink `#1A2942` är primär). Används bara på certifikatytor (fas 5). [Gissning] — bekräftas när certifikatet byggs.

### GRIND 2 kvitto (skärmdumpsloop + WCAG)
- **Skärmdumpar:** `outputs/kursmotorn/grind2/` (01 motor-login · 02–03 publika landningar · 04 motor-admin · 05–06 kursvyn i BÅDA tenants). Harness: `scripts/grind2-screenshots.mjs` (playwright, dev-dep — projektets stående skärmdumps-grind). **Samma komponent, två varumärken:** Andningskursen (sand/petrol/Lora/JetBrains) vs Mindfulnessguiden (Vellum/Ink-navy/Fraunces/Geist Mono) — MG:s tokens återgivna exakt mot Editorial Lugn. Motor-admin matchar "Varma maskinrummet"-styleprovet.
- **Acceptans #2 bevisad skarpt:** ändrade `andningskursen` primary i DB (#1F5F5B→#0B5563), `--t-primary` i renderad publik HTML följde med **utan kodändring, deploy eller omstart**; återställd exakt till #1F5F5B.
- **WCAG AA (script, kontrastberäkning):** motor + MG passerar allt (brödtext 13–15:1, muted 4.6–5.6:1, knappar 7–15:1). Andningskursen: brödtext 12.3:1, vit/petrol-knapp 7.4:1 = OK.
  - **Åtgärdat:** "Inspelning"-etiketten var accent-guld som text (2.99:1, FAIL) → gjord till **soft badge** (`--t-soft`-bg + `--t-primary-dark`-text), 8.9:1 (andning) / 14.2:1 (MG). Guld/mässing används inte längre som brödtext någonstans — matchar brand.md:s "accent = badges/detaljer, sparsamt".
  - **ÖPPET (Lisas call):** andning `muted #6E7A76` på bg `#F6F3ED` = **4.03:1**, 0.47 under AA för liten sekundärtext (eyebrow-etiketter, modul-intro). Det är en **låst demo-brand-token** (palett A, graderad i moodboard-rundan) → jag ändrar den inte utan Lisas nya gradering. Tre vägar: (a) acceptera 4.03 (marginellt; MG:s muted #5A6273 = 5.58 passerar), (b) mörka andning-muted en aning till ≥4.5, (c) begränsa muted till stor text. MG mässing `#8B6F3F` på bg = 4.31:1 men används bara som liten facilitations-etikett; samma badge-mönster löser det om/när det används.

### Standing regressionsvakter (grind före commit)
- RLS-sviten **12/12** grön mot live-DB · hemlighetsgrind **0** · build grön · namnbytes-grep (`mindfulnessguiden|andningskursen|respira` i `src/`) = **0** · inga priser/procent i `src/`.

### Öppet in i fas 3
- Host-/subdomän-routning (öppen sedan fas 0) · fynd 5 (practice_day-unikhet, före fas 7) · fynd 6 (bild-/kursmedia-buckets — byggs i fas 3 med kursimporten) · fynd 3 (ren `supabase db reset` — Docker, blockerande före eject/go-live, **fortsatt synligt öppet**) · WCAG-punkten ovan väntar Lisas beslut.
