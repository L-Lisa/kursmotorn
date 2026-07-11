# ACCEPTANCE_CRITERIA — Kursmotorn v1

*2026-07-11 · Varje kriterium är maskin-kontrollerbart (automatiskt test eller skript) eller Lisa-kontrollerbart (klickbart i UI / synligt i skärmdump). Guide-funktionernas kriterier härrör ur den godkända `docs/SPEC-guide-funktioner.md` (§3.4, §4.3, §5, §7, §8) — ändra inte semantiken. Fas B/C-kriterier står sist, markerade: de byggs INTE nu men får inte göras omöjliga.*

## Genomgående (körs om vid varje grind)

- [ ] **RLS:** deltagare A kan aldrig läsa B:s data (progress, loggar, uploads, FFMQ, attempts); tenant A:s admin ser inget av tenant B. Automatisk testsvit, inte manuell koll.
- [ ] **Provregeln:** i self_paced OCH scheduled: underkänt prov i tidigare sektion ⇒ nästa förblir låst, oavsett tid/avbockning.
- [ ] **Eject-snittet:** ingen komponent läser tenant-data förbi context-lagret (kodgranskningsregel: grep efter direkta tenant-konstanter ger noll).
- [ ] **Namnbytes-säkerhet:** `grep -ri "mindfulnessguiden\|andningskursen\|respira" src/` ger noll träffar utanför seed/test-fixturer; inga priser/procentsatser i kod.
- [ ] **Inget outbound:** inga mejl-/notis-/externa anrop i kodbasen (nätverksanrop endast Supabase/Vercel-interna).
- [ ] **Hemligheter:** `git log -p -- . ':(exclude)package-lock.json' | grep -cE "sk-ant-[A-Za-z0-9]|sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}"` = 0; `.env*` git-ignorerad.
- [ ] **Brand:** ingen dark mode i deltagarvyn; motor-chrome + tenant-tokens matchar `../brand.md` exakt (skärmdumpsjämförelse).
- [ ] **Breathworks-regressionen** (fas 5-sviten: villkorstrion + self_paced + certifikat) körs om vid varje grind från och med GRIND 5 och är grön — den är paketets viktigaste regressionsvakt (godkända specen §9: regressionen är grinden mellan motorkärna och MG-tillägg).

## Fas 0–1 — Fundament + datamodell
- [ ] Migrationerna skapar samtliga tabeller ur `../datamodell.md`; `supabase db reset` + seed går igenom rent.
- [ ] Partiellt unikt index: två `practice_day` samma dag för samma user avvisas; två `guide_session` samma dag accepteras.
- [ ] Seed innehåller ENDAST fiktiva deltagare.

## Fas 2 — Tenant-rendering
- [ ] Samma kursvy renderad för tenant #1 och #2 visar respektive brand (skärmdumpar); Mindfulnessguidens tokens är identiska med Editorial Lugn-spec:en i `../brand.md`.
- [ ] Byte av ett brand-fält i DB (t.ex. accentfärg) slår igenom utan kodändring eller deploy.
- [ ] Motor-admin ser ut som "Varma maskinrummet"-styleprovet; WCAG AA på text.

## Fas 3 — Import + gating
- [ ] Breathworks-importen: 9 moduler, alla sektioner, provfrågor med rätt svar + motiveringar — diff mot källfilerna visar att texten är ordagrann.
- [ ] Self_paced: avbockning av sektion N öppnar N+1; ej avbockad ⇒ låst.
- [ ] Scheduled: sektion med drip_offset_days=7 öppnas dag 7 räknat från kohortens start_date; utan kohort kan kursen inte publiceras som scheduled.
- [ ] Kombinerade villkor: sektion med checkoff+quiz+upload kräver alla tre.

## Fas 4 — Prov + uppladdning
- [ ] Prov med threshold 80: 16/20 ⇒ godkänt; 15/20 ⇒ underkänt; max_attempts=2 ⇒ tredje försöket avvisas; admin-nollställning öppnar igen.
- [ ] MP4-uppladdning ≥1 GB lyckas via TUS (skarp verifiering); fil hamnar på rätt path-prefix; annan users path avvisas.
- [ ] Uppladdningskrav: sektion med upload_required öppnar nästa först efter lyckad uppladdning.

## Fas 5 — Certifiering (breathworks-regressionen = grind)
- [ ] **Regression:** med konfigurationen `sections_complete` + `final_quiz_pass{80}` + `attestation{live_session_honor}`: certifikat utfärdas när alla tre uppfyllda, aldrig när någon saknas — testa varje villkor som ensam blockerare.
- [ ] Attestationen lagrar versionerad ordagrann lydelse + tidsstämpel.
- [ ] PDF:n renderar tenant-brand + certificate_title + å/ä/ö korrekt (okulär + teststräng "Åsa Öhman, Märsta").
- [ ] `/verify/<slug>`: publik utan inloggning, visar innehav/kurs/utfärdare/status i tenant-brand, inga persondata utöver namn; revokerat certifikat visas som revokerat.

## Fas 6 — Kohorter + admin
- [ ] Två kohorter på samma kurs med olika startdatum ⇒ olika drip-upplåsning, samma innehåll.
- [ ] Deltagarflytt: ny enrollment med moved_from_enrollment_id, gamla `dropped`, bekräftelsedialog med fönstervarning; högst en aktiv enrollment per user+kurs upprätthålls server-side (direkt-API-försök att skapa dubblett avvisas); **certfönstren räknas om från den nya enrollmentens starts_at — testa med loggdagar före/efter flytten** (godkända specens §4.3-krav, inte bara varningsdialogen).
- [ ] Kohortunderlaget: 8 deltagare varav en med price_override ⇒ korrekt radpris + summa; CSV = vyn; invoiced_at/paid_at kan sättas och ångras utan extern effekt.
- [ ] Underlag utan split-rad visar inget delningsavsnitt (grundarkohorten).
- [ ] Admin-deltagarlistan filtrerar på kohort.
- [ ] Brand-wizard: nytt brand-spec sparat via UI ⇒ jsonb enligt mallens schema; renderas direkt.

## Fas 7 — MG fas A (sessionsloggen — ur godkänd spec §3.4)
- [ ] Spelad meditation ≥90 % ⇒ exakt en practice_day den dagen; två meditationer samma dag ⇒ fortfarande en; två guidesessioner samma dag ⇒ två rader.
- [ ] Manuell loggning: idag och 7 dagar bakåt OK; 8 dagar bakåt avvisas; manuell dag räknas mot certkravet precis som auto; källan syns i admin, inte som misstroende i deltagarvyn.
- [ ] Fönsterberäkningen: 5/5/5/5/5/5 från starts_at ⇒ log_threshold uppfyllt; 5/5/4/5/5/5 ⇒ ej; + dispens-approval {window_index: 3} ⇒ uppfyllt.
- [ ] Sen enrollment (starts_at 10 dagar efter kohortstart) ⇒ fönstren räknas från starts_at; 6/6 nåbart.
- [ ] Guidesession daterad före deltagarens V9-uppladdning räknas inte mot 10; efter ⇒ räknas. **Räknaren visar rätt i både deltagarvyn ("Min guideresa") och adminvyn** (godkända specens §3.4-lydelse). Adminvyn i fas A = kolumn i deltagarlistan (guidepipeline-vyn är fas B) — logga placeringen i docs/DECISIONS.md.
- [ ] FFMQ pre: sparas per deltagare + kohort; deltagaren nekas ändra efter att fönster 2 börjat (admin kan, med logg); post nekas före fönster 6 (post-FLÖDET byggs i fas B — regeln gäller redan).
- [ ] FFMQ-scoring ger identiskt resultat som sajtens självtest för 3 kända testfall (efter att Lisa pekat ut källfilen).
- [ ] MG-import: C-FINAL v1–9 ordagrant (diff mot källfiler); nio uppladdningssektioner V1–V9 identifierade och konfigurerade i certvillkoren (min_per_section: 1 — nio versioner av samma övning uppfyller INTE kravet).
- [ ] Radering av deltagare kaskaderar (loggar, FFMQ, uploads inkl. Storage, attempts; certifikat revokeras).
- [ ] **Breathworks-regressionen (fas 5-sviten) passerar igen oförändrad.**

## Fas 8 — Eject
- [ ] Export av breathworks-tenanten ⇒ standalone-app som startar lokalt med seedat innehåll + brand; ingen tenant-context-kod kvar (statisk config).
- [ ] MG-exporten inkluderar mg_-tabellerna + cohorts/enrollments/activity_logs/log_type_defs/approvals/certvillkor (filaudit mot tabellista).

## Fas 9 — Återvägen
- [ ] `../memory.md` har dagboksentry (commits, byggt, buggar, felaktiga antaganden); `docs/DRIFT.md` + `docs/DECISIONS.md` finns och är aktuella.

---

## Fas B/C — byggs INTE nu; kriterierna står i docs/SPEC-guide-funktioner.md (§5, §6, §7, §8)
Bevaras här som spärr: inget i v1 får göra dem omöjliga (t.ex. fasen för guidesessioner lagras aldrig — härleds ur V9-uppladdningsdatum; FFMQ-rapporten kräver följsamhetsgruppering — bygg ingen FFMQ-vy utan den).
