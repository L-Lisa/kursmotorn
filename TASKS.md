# TASKS — Kursmotorn v1 (fasindelad, med grindar)

*2026-07-11 · Kör faserna i ordning. En **GRIND** måste passeras (och kvitteras i docs/DECISIONS.md eller commit-meddelande) innan nästa fas börjar. Acceptanskriterierna per fas: `ACCEPTANCE_CRITERIA.md`. Reglerna: `CLAUDE.md`. Vad + varför: `SPEC.md`.*

**Kostnadsdisciplin:** v1 använder inga betal-API:er utöver Supabase-projektet (~10 USD/mån, Lisas OK finns — eu-north-1). Inga nya betaltjänster, API-nycklar eller planuppgraderingar utan Lisas uttryckliga OK. Skarpa AI-anrop förekommer inte i v1 (AI-assistenten är fas 2).

**[L] = väntar på Lisa** — blockerar bara sitt eget moment, inte fasen.

---

## Fas 0 — Repo & fundament
- [ ] `git init` på `main` i denna mapp; `.gitignore` med `.env*` från första commit; `.env.example` med tomma nycklar (aldrig riktiga värden).
- [ ] **Agent-git-config-check:** commit-författare = Lisas identitet (`Lisa <lisaojeland@gmail.com>`). [Trolig] Vercels git-integration byggde inte Jobbresan-commits med okänd författare förrän commiten amend:ades till Lisas identitet (lärdom 2026-07-05, system/memory.md) — verifiera INNAN första commit i stället för att upptäcka det vid första preview-deployen.
- [ ] Next.js-scaffold (App Router) + Tailwind + shadcn/ui; `docs/DECISIONS.md` skapas.
- [ ] Supabase-projekt skapas (eu-north-1, eget projekt, ~10 USD/mån — **Lisas stående OK 2026-07-05, skapa direkt**; meddela henne att månadskostnaden startat). Migrations-mekanik på plats (supabase CLI).

**GRIND 0:** repo bygger lokalt · `.env*` ignorerad · `git log -p -- . ':(exclude)package-lock.json' | grep -cE "sk-ant-[A-Za-z0-9]|sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}"` = 0.

## Fas 1 — Datamodell + RLS
- [ ] Samtliga tabeller ur `../datamodell.md` (inkl. 2026-07-11-tilläggen: cohorts, enrollments, log_type_defs, activity_logs, course_certificate_requirements, approvals, mg_-tabellerna) som migrationer.
- [ ] RLS-policies: tenant-isolation på allt; deltagare läser bara sitt eget; storage-RLS på path-prefix.
- [ ] Partiellt unikt index på activity_logs (practice_day-dagsunikhet).
- [ ] Seed-skript med FIKTIVA deltagare (två tenants, en kohort, testmönster för loggar/prov).

**GRIND 1:** RLS-testerna i ACCEPTANCE_CRITERIA §Genomgående passerar (deltagare A ≠ B; tenant A ≠ B) — kör dem som automatiska tester, inte manuell koll.

## Fas 2 — Context-lagret + tenant-rendering
- [ ] Tenant-context-lagret: ALLT tenant-specifikt (brand-tokens, namn, certifikattitel, UI-texter) läses genom det. Detta är eject-snittet — inga genvägar förbi det.
- [ ] Motor-chrome enligt `../brand.md` (tokens, Inter/JetBrains Mono, komponentform).
- [ ] `/{tenant-slug}/…`-routning (host-mappning förberedd; beslut loggas i DECISIONS).
- [ ] Båda demo-brandsen renderas ur DB: Andningskursen (palett A) + Mindfulnessguiden (Editorial Lugn, exakt).

**GRIND 2:** skärmdumpar av samma vy i båda tenants + motor-admin jämförda mot styleprovet `../../../outputs/kursmotorn/moodboard/riktning-ab-kombinerad.html` och brand.md-tokens. WCAG AA-kontroll på nya kombinationer.

## Fas 3 — Kursimport + kursvy + gating
- [ ] Markdown-parser enligt formatkontraktet (`../kurs/kursplan.md`); import av breathworks modul 1–9 (innehållet ordagrant — aldrig omskrivet).
- [ ] Kursvy: moduler, sektioner, avbockning, progress; motor-röst i systemtexter ("Din inspelning är uppladdad. Nästa modul är upplåst.").
- [ ] Gating som serverfunktion: self_paced + scheduled (kohortankrat), kombinerbara sektionsvillkor, provregeln.

**GRIND 3:** gating-kriterierna i ACCEPTANCE §Fas 3 passerar, inkl. provregeln i båda lägena.

## Fas 4 — Prov-motor + MP4-uppladdning
- [ ] Quizzes/attempts: 80 %-default konfigurerbar, omtag konfigurerbara, admin kan nollställa; slutprov.
- [ ] TUS-uppladdning (stora MP4), maxstorlek konfigval, signerade URL:er kort TTL. Verifiera skarpt med stor fil — detta gick inte att testa i Cowork.

**GRIND 4:** prov + uppladdningskrav låser/öppnar sektioner korrekt (ACCEPTANCE §Fas 4).

## Fas 5 — Certifiering (breathworks-beviset)
- [ ] course_certificate_requirements + utfärdande-serverfunktionen som läser typade krav.
- [ ] Attestation (heder-och-samvete, versionerad lydelse + tidsstämpel).
- [ ] Certifikat-PDF ur tenant-brand (verktygsval → DECISIONS; å/ä/ö-test) + verifieringssidan `/verify/<slug>` (publik, tenant-brandad, inga persondata utöver namn).

**GRIND 5 (kritisk):** breathworks-regressionen — villkorstrion (sections + slutprov 80 % + attestation) ger exakt det beteende briefen låst. Hela tenant #1-flödet klickbart: login → kurs → prov → intyg → PDF → verify-sida.

## Fas 6 — Kohorter, aktivitetslogg, admin
- [ ] Kohort-CRUD i admin; enrollments inkl. flytt (ny rad + moved_from, bekräftelsedialog med fönstervarning); eftersläntrar-starts_at.
- [ ] Aktivitetsloggens skrivfunktion (läser log_type_defs, avvisar dagtypsdubbletter).
- [ ] Admin-dashboard med kohortfilter; kohortunderlaget (effektivt pris, manuell fakturerad/betald, CSV + print-HTML).
- [ ] Brand-wizard (admin-UI över tenant_brands enligt brand-spec-mallen).

**GRIND 6:** kohort-kriterierna (ACCEPTANCE §Fas 6) + omkörd GRIND 1-RLS-svit (nya tabeller täckta) + **breathworks-regressionen (fas 5-sviten)** — det är grinden mellan motorkärnan och MG-tillägget som den godkända specen kräver (§9): kohortfälten får inte ha ändrat tenant #1:s beteende.

## Fas 7 — MG-tenanten, fas A
- [ ] MG onboardas: **Stilla kraft**-brand ur DB (ersatte Editorial Lugn 2026-07-24, Lisas beslut — tokens ur `../../../outputs/design-system/mindfulnessguiden/stilla-kraft/01-DESIGN-SYSTEM.md` + `assets/`; läggs in via tenant_brands/brand-wizard) + import av C-FINAL v1–9 (`/Users/lisa/COWORK/projects/mindfulnessguiden/kursinnehall/`; parsern anpassas till veckoformatet, innehållet röres ej).
- [ ] Praxislogg: auto vid ≥90 % uppspelning + manuell (7 dagar bakåt, manuella räknas fullt — Lisas beslut); fönsterberäkningen (6×7 dagar från enrollment.starts_at) som serverfunktion/vy. **MG:s meditationsljudfiler (Lisas besked 2026-07-29): bygg med PLACEHOLDERS nu** (tysta/korta dummyfiler per sektion, media_duration_sec sätts till placeholder-värden; mätmetoden loggas i DECISIONS). Auto-loggningen byggs och testas mot placeholders; riktiga filer byts in i ett senare steg [L] utan schemaändring.
- [ ] Deltagarvyn: veckovy + certstatus per krav — Stilla kraft-ton, aldrig streak-ångest (docs/SPEC-guide-funktioner.md §3.1).
- [ ] Guidesessionsformuläret (format A/B/C/annat, flera per dag OK) + deltagarvyn **"Min guideresa"** (egna sessioner, räknare mot 10, certstatus, nivå — godkända specen §3.2).
- [ ] FFMQ-15 pre med tidslås. **[L] Lisa pekar ut källfilen i mindfulnessguiden.se-kodbasen — kopiera items/scoring ordagrant; bygg ALDRIG egna items.** Blockerar endast FFMQ-momentet. **FFMQ-användarvillkoren: researchläge 2026-07-29** (Cowork, `projects/mindfulnessguiden/research/ffmq-rattigheter-2026-07-29.md`): FFMQ-15 publicerad i öppen artikel (Gu m.fl. 2016) som enligt sekundärkälla är CC BY (kommersiellt OK med attribution) [Trolig]; Mindfulnesscenter kör svensk FFMQ öppet kommersiellt utan licensnotis. KVAR [L]: Lisa öppnar PMC-artikeln och verifierar licensraden ordagrant (2 min, blockerad för Cowork av captcha). Bygg med attributionsrad (Baer 2006; Gu 2016; sv. övers. efter Lilja) — färdigbygge-flaggan kvarstår tills licensraden är kvitterad.
- [ ] Grundarkohorten som kohort #1 (placeholder-pris 11 500 kr, sold_by/delivered_by = platform, ingen split-rad).
- [ ] MG:s certvillkors-konfiguration läggs in (utfärdande-UI:t är fas B — villkoren ska bara stå rätt i DB).

- [ ] **Leveransformatet (Lisas produktbesked 2026-07-29; KURSFAKTA-sajten uppdaterad samma dag):** vecka 1–6 = online i egen takt, inga lärarledda inslag; vecka 7–9 = lärarledda gruppträffar. MG-kohortens gating konfigureras därefter (self_paced-villkor v1–6; scheduled-inslag hör till ledarfasen). Ev. uppstartsträff i fas 1 = [L] obekräftad — bygg inget som förutsätter en.
- [ ] **Lisas granskningsmål (detta pass syfte):** ett granskningskonto (fiktivt — go-live-grinden gäller oförändrat) där Lisa loggar in i MG-tenanten och läser hela kursen vecka för vecka. Lokal körning räcker; fjärr-DB-synk + preview-deploy endast på Lisas uttryckliga push-OK (fjärren ligger på fas 2-läget, se DECISIONS §Öppet in i fas 6).
- [ ] **Inloggningssömmen (beslut, kvitteras i DECISIONS):** deltagaridentiteten bor i Kursmotorn. Kursmotorn exponerar en stabil inloggnings-URL för MG-tenanten; när den är verifierad byter Lisa `NEXT_PUBLIC_KURSMILJO_URL` på nya sajten (Mindfulnessguiden.se-repot) till den, och sajtens egen Supabase-auth behålls enbart för självtestet.

**GRIND 7:** sessionslogg-kriterierna (ACCEPTANCE §Fas 7) + **breathworks-regressionen körs IGEN** (tenant #1 opåverkad av MG-onboardingen) + Lisas granskningskonto verifierat (v1–9 läsbara i Stilla kraft).

## Fas 8 — Eject-exporten
- [ ] Exportskript per tenant: innehållspaket + deltagardata + brand_spec.json + standalone-mall + seed. 2026-07-11-tabellerna ingår; MG-exporten inkluderar mg_-tabellerna.

**GRIND 8:** exporten för breathworks-tenanten producerar en standalone-app som startar lokalt och visar kursen (ACCEPTANCE §Fas 8).

## Fas 9 — Återvägen (ALLTID sist — hoppa aldrig över)
- [ ] Dagbok i `../memory.md` (projektets): datum, commits, vad som byggdes, buggar som fixades, **vilka av Coworks antaganden som var fel** (parserkontraktet? TUS? PDF-valet? routningen?).
- [ ] Varaktiga lärdomar → projektminnets Lessons.
- [ ] Driftdokument `docs/DRIFT.md`: hur Lisa startar/deployar/seedar, var nycklarna bor (utan värden), kostnadsläge.
- [ ] `docs/DECISIONS.md` komplett; öppna punkter till nästa Cowork-session listade.

## Go-live-grinden (MG grundarkohorten — SEPARAT pass efter fas 9, körs på Lisas ord)
Bygget ovan är klart med fiktiva deltagare. Innan en enda riktig deltagare får konto:
- [ ] Riktig auth-flödes-granskning (demo-login med enkla konton ersätts/härdas — briefens lanseringskrav).
- [ ] GDPR-texterna: raderings-/exportflödet verifierat i UI, integritetstext, biträdesavtal-mall till tenants.
- [ ] Lösenords-/kontorutin för deltagare (lärdom Jobbresan: dokumentera INNAN första riktiga kontot).
- [ ] **Lisas uttryckliga go-live-OK.** Utan alla fyra: fiktiva deltagare gäller, oavsett hur nära kohortstarten ligger.

---

## Fas B (MG — SPÄRRAD bakom egen grind)
**GRIND B (öppnas ENDAST av Lisas uttryckliga beslut; behövs i tid före grundarkohortens vecka 6):** FFMQ post + dos-respons-rapporten (aldrig FFMQ-vy utan följsamhetsgruppering) · approvals-UI (bedömning av certifieringssession, dispenser) · certifikatutfärdande med MG-villkoren · guidepipeline-vyn. Spec + acceptanskriterier: docs/SPEC-guide-funktioner.md §5–§8 + §9. Bygg ingenting av detta i förväg — men fas A-datainsamlingen måste vara rätt från dag 1 (därför vikten på fönsterberäkning, tidslås, loggkällor ovan).

## Fas C (MG — SPÄRRAD bakom egen grind)
**GRIND C (öppnas av Lisas beslut, mot första licensieringen ~månad 9):** kursledarbehörighet (härledd ur leader_membership_id, ingen ny roll) + kursledarvyn · split-visningen i underlaget · registersidan "Hitta en guide" + samtyckesflödet (samtyckestexten skrivs och godkänns av Lisa FÖRST). Spec: docs/SPEC-guide-funktioner.md §4.2, §6, §9.

## Utanför scope (byggs INTE — även om det "vore enkelt nu")
Stripe/betalväxel · mejl/notiser/allt outbound · självregistrering · AI-assistent · engelskt UI · självbetjänings-eject · egen-domän-självbetjäning · MG fas B/C i förväg (se grindarna ovan) · innehållsändringar i någon kurs · produktionsdeploy utan Lisas uttryckliga OK.
