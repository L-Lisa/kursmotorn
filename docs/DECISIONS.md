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
