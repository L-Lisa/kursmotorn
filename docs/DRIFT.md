# DRIFT — Kursmotorn v1

*2026-07-30 · Fas 9. Hur Lisa startar, seedar, testar och (när hon säger till) deployar.
Inga nyckelvärden här — bara VAR de bor.*

## Snabbstart (lokalt)

```bash
cd ~/COWORK/projects/kursmotorn/app
open -a Docker              # om Docker Desktop inte redan kör (ingen inloggning behövs)
supabase start              # lokal Supabase-stack (containrar: supabase_*_kursmotorn)
supabase db reset           # alla migrationer + seed från noll
npm run import              # Andningskursen (kurs/modul-1..9.md → DB, ordagrant)
npm run import:mg           # MG-kursen (C-FINAL-vecka-1..9.md → DB, ordagrant)
npm run dev                 # appen på http://localhost:3000
```

**Testkonton** (alla lösenord `Testlosen123!` — fiktiva, byts vid go-live-grinden):
| Konto | Roll |
|---|---|
| `lisa@kursmotorn.test` | Plattformsadmin (allt) |
| `granskning@mind.test` | MG-admin — granskningsläget: läser hela kursen upplåst |
| `admin1@andning.test` | Tenant 1-admin (ej plattformsadmin) |
| `anna@andning.test`, `bengt@andning.test` | Deltagare, Andningskursen |
| `cecilia@mind.test` | Deltagare, Mindfulnessguiden |

**Ingångar:** `/login` (motor/admin) · `/admin` (tenantlista → Administrera) ·
`/andningskursen/login` · `/mindfulnessguiden/login` (= MG:s stabila inloggnings-URL
för sajtens `NEXT_PUBLIC_KURSMILJO_URL`).

## Nycklar (var de bor — aldrig värden)

- `.env.development.local` — LOKAL Supabase (URL + anon + secret från `supabase start`). Git-ignorerad.
- `.env.local` — FJÄRRPROJEKTET `lsqfsntwnvquakmqeryn` (eu-north-1). Git-ignorerad.
- `.env.example` — mallen (tomma värden), enda spårade env-filen.
- Service-nyckeln används av appen ENBART i GDPR-raderingens serveråtgärd — aldrig i renderingsvägen.

## Testsviterna (alla ska vara gröna före varje grind/commit)

```bash
npm run test:rls:local            # tenant-isolation, 11 fall — STÅENDE VAKT
npm run test:certification:local  # breathworks-regressionen, 7 fall — STÅENDE VAKT
npm run test:gating               # gating-kärnan (ren TS, ingen DB)
npm run test:windows              # fönsterberäkning + underlag (ren TS)
npm run test:cohort:local         # kohorter/flytt/loggregler mot DB
npm run test:mg:local             # MG fas A (import ordagrann, fönster, radering)
npm run lint && npm run build
```

Hemlighetsgrinden (ska ge exakt `0`):
```bash
git log -p -- . ':(exclude)package-lock.json' | grep -cE "sk-ant-[A-Za-z0-9]|sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}"
```

## Eject (friköpet)

```bash
npm run eject -- andningskursen      # eller mindfulnessguiden
cd eject-output/<slug>/standalone && npm start   # kursvisaren på :4173
node scripts/grind8-check.mjs        # verifierar paketet
```

## Fjärr-DB + deploy — LÄGET JUST NU (uppdaterat 2026-07-31)

- **Fjärrprojektet är I FAS med repot:** alla migrationer t.o.m. `..15`
  (granskningslägets läsläge) applicerade, båda kursimporterna + seeden synkade.
  Nya ändringar sker fortsatt på **Lisas OK, per gång**: migrationer FÖRE kod.
- **Vercel är git-kopplad:** push till `main` (github.com/L-Lisa/kursmotorn) ⇒
  produktionsdeploy av kursmotorn.vercel.app automatiskt. Sedan 2026-07-31 kör
  produktionen HELA bygget (fas 0–9 + FFMQ-15 + Stilla kraft); dessförinnan låg
  fas 5-koden där. Stående push-OK förutsätter körd testloop (Lisas regel).
- Kostnadsläge: Supabase-projektet (Pro, eu-north-1) är den enda betaltjänsten.
  Lokal utveckling är gratis (Docker).

## Skärmdumps-/verifieringsharnessar

`scripts/grind2|3|5|6|7-screenshots.mjs` (playwright, kräver `npm run dev` igång) →
`~/COWORK/outputs/kursmotorn/grind*/`. `scripts/grind8-check.mjs` är självförsörjande.

## Kända öppna punkter (fas 9-listan)

1. **[L] FFMQ:** källfil + användarvillkor → HELA FFMQ-momentet är obyggt (enda öppna fas 7-punkten).
2. **[L] MG:s meditationsljud:** spelare + auto-loggning ≥90 % väntar på filerna
   (`sections.media_path`/`media_duration_sec` är förberedda; log_activity-auto är testad).
3. Fjärr-synk + preview-deploy (Lisas OK) · host-/subdomänroutning (SPEC §5) ·
   kursens ~27k-ords kvalitetsgrind · go-live-grindens fyra krav (fiktiva deltagare tills dess) ·
   signerade URL:er för inspelningsgranskning i admin (fas B-nära) · mg_guide_status-hooken (fas B).
