# SPEC — Kursmotorn v1

*2026-07-11 · Cowork → Claude Code (build-handover). Läses tillsammans med `CLAUDE.md` (reglerna), `TASKS.md` (ordningen + grindarna), `ACCEPTANCE_CRITERIA.md` (kontrollerna) och `docs/SPEC-guide-funktioner.md` (guide-funktionernas detaljspec, godkänd av Lisa 2026-07-11). Källdokumenten ligger en nivå upp i projektmappen: `../brief.md` (låsta beslut), `../datamodell.md` (hela datamodellen, uppdaterad 2026-07-11), `../brand.md` (LÅST design), `../kurs/` (kursinnehållet), `../research/plattforms-benchmark.md` (marknadsfakta). Vid konflikt: brief + datamodell + brand.md gäller; denna SPEC sammanfattar och pekar.*

*Konfidens: [Säker] hård evidens/beslut · [Trolig] stark slutsats · [Gissning] placeholder.*

---

## 0. Den verkliga asken

Lisas uppdrag, i hennes egna beslut (2026-07-05 + 2026-07-11):

> En multi-tenant plattform som förvandlar en kurs i markdown + varumärkesinfo till en färdig kursapp — med login, avbockning, gating, prov, certifikat och admin-redigering — där Lisas breathworks-certifiering är första kunden och whitelabel-försäljning är affären. (`../brief.md`, "En mening")

**v1 bevisar TVÅ saker på samma motor:**

1. **Breathworks-demon (tenant #1):** hela flödet login → kursvy → avbockning/uppladdning → prov → heder-och-samvete-intyg → certifikat-PDF med publik verifieringssida. Det är säljbeviset för whitelabel-affären.
2. **Mindfulnessguiden som riktig tenant #2 (flyttad från fas 2 till v1 — Lisas beslut 2026-07-11):** MG:s riktiga kurs (C-FINAL v1–9) onboardas med praxislogg, kohort, FFMQ-pre och fakturaunderlag — det är appen grundarkohorten SKA levereras i. **Men v1-bygget körs hela vägen med fiktiva deltagare:** riktiga deltagare först efter go-live-grinden (TASKS.md, efter fas 9: auth-granskning, GDPR-texter, lösenordsrutin, Lisas uttryckliga OK). Avsteget från briefens ursprungliga fasindelning är dokumenterat i `../../../outputs/mindfulnessguiden/guide-funktioner/gransdragning-kursmotorn-mg.md`.

**Varför två tenants i v1 inte är dubbelt jobb:** MG:s behov drev fram sex *generiska* motortillägg (kohorter, enrollments, aktivitetslogg, typade certifikatvillkor, approvals, kohortunderlag) som varje framtida kund kan använda — och demon med två olika brands på samma motor är själva beviset för "ingenting varumärkesbundet hårdkodas". En implementerande modell som "förenklar" bort någon av delarna bryter affärsmodellen, inte bara en feature (GTM-planens kontrollpunktslogik — se docs/SPEC-guide-funktioner.md §0).

## 1. Arkitekturen — vad och varför [Säker — låsta beslut i brief]

| Beslut | Vad | Varför (får inte "optimeras" bort) |
|---|---|---|
| Multi-tenant | En kodbas, en DB; tenant_id på ALLT + RLS | Ny kund utan ny deploy — affärsmodellen |
| Context-lagret | Appen läser ALLT tenant-specifikt (brand, namn, texter, villkor) genom ett context-lager | Det lagret ÄR eject-snittet: friköpsaffären kräver export till fristående app. Kod som går förbi lagret gör tenanten osäljbar som friköp |
| Ingenting hårdkodat | Tenantens namn, brand, röst, certifikatdesign, domän, priser, procentsatser = DB-fält | Kund ska kunna rebranda utan kodändring; "Kursmotorn" själv är arbetstitel (namnet = konfigvariabel) |
| Innehåll i DB | Kursinnehåll importeras från markdown till DB | Krav för admin-redigering (köparen ändrar text/ordval/bilder; struktur + logik ändras endast av Lisa) |
| Stack | Next.js + Supabase (Postgres, eu-north-1, EGET projekt — Lisas OK finns) + Vercel | Lisas beprövade mönster (JobMatch, Jobbresan); GDPR: EU-region |
| Demo-login | Enkla konton, köpflöde simulerat | v1 är demo + grundarkohort; Stripe/självregistrering = fas 2 |

Routning i demon: `/{tenant-slug}/…` + host-mappning förberedd (wildcard-DNS kräver domän — avgörs mot Vercel-uppsättningen). [Trolig — öppen punkt ur datamodellen]

## 2. Delarna, med sina varför

Datamodellen för allt nedan: `../datamodell.md` (komplett, inkl. 2026-07-11-tilläggen). Bygg mot den — hitta inte på egna tabeller.

### 2.1 Tenancy, brand-wizard, två demo-brands
Brand-spec lagras som jsonb enligt mallen `../../../system/templates/brand-spec.md` — **mallen ÄR schemat** (samma struktur är kundens intake-dokument, moodboard-struktur och wizardens DB-schema). Brand-wizard = admin-UI som fyller den. Motorns egen yta följer `../brand.md` "Varma maskinrummet" (LÅST — ändringar kräver Lisas nya gradering). Tenant #1 Andningskursen (palett A) och tenant #2 Mindfulnessguiden (Editorial Lugn — **återges exakt**, MG i demon är beviset att motorn renderar en extern brand-spec troget). Ingen dark mode i deltagarvyn.

### 2.2 Kursimport + admin-redigering
Parser: `kurs/*.md` → courses/modules/sections/quizzes. Formatkontraktet står i `../kurs/kursplan.md` ("Format per modulfil"). **Kursinnehållet är färdigskrivet, faktagranskat och LÅST — bygget importerar det ordagrant och ändrar aldrig text.** Breathworks: `../kurs/modul-1..9.md`. MG: `/Users/lisa/COWORK/projects/mindfulnessguiden/kursinnehall/C-FINAL-vecka-1..9.md` (filernas existens kontrollerad på disk 2026-07-11 i byggspec-sessionen; MG-filerna följer eget veckoformat — parsern anpassas, innehållet röres ej). Admin-redigering: text, ordval, bilder per modul — spårbart (updated_by). **Mappningsregel modul→sektion (parserns kontrakt):** kursplanen anger 🎥-inlämning per MODUL ("låser nästa modul"); i datamodellen ligger kravet per SEKTION. Parsern skapar en dedikerad inlämningssektion sist i varje 🎥-modul (upload_required: true) — så blir "modulen låser nästa" = modulens sista sektionskrav. Avvikelser loggas i docs/DECISIONS.md.

### 2.3 Upplåsning & gating (Lisas modell — låst)
Per kurs: **self_paced** (avbockning öppnar nästa) eller **scheduled** (drip X dagar, räknat från **kohortens start_date** — omankringen 2026-07-11 som stängde skissens ankarlucka; scheduled kräver kohort). Villkorstyper per sektion, kombinerbara: avbockning / godkänt prov / MP4-uppladdning. **Provregeln, båda lägena: tid låser aldrig upp förbi underkänt prov.** Gating = vy/serverfunktion, aldrig klientlogik.

### 2.4 Kohorter, enrollments, aktivitetslogg (motorkärna, generisk)
Se `../datamodell.md` + docs/SPEC-guide-funktioner.md §2.1. Kärnpunkter som inte får tappas: enrollment.starts_at är certfönstrens ankare (eftersläntrare är normalfallet — de får inte mekaniskt förlora fönster 1) · flytt = ny enrollment-rad med spårbarhet · practice_day är dagsunik (partiellt index), guide_session är det inte · invoiced_at/paid_at är manuella markeringar — **ingen betalväxel i v1** (Lisas beslut).

### 2.5 Prov-motorn
Flervalsfrågor per kurs; godkänt-gräns default 80 %, konfigurerbar per prov; omtag konfigurerbara (null = obegränsat); slutprov = is_final. Provfrågorna står färdigskrivna i modulfilerna (breathworks: 5–8 per modul + slutprov 20 med tyngd på säkerhet) — importeras, skrivs inte om.

### 2.6 MP4-uppladdningar
Deltagarens egna inspelningar (breathworks 5 sektioner, MG nio V1–V9). Supabase Storage, bucket `recordings`, path `tenant_id/user_id/section_id/…`, RLS på path-prefix, resumable uploads (TUS) för stora filer — **marknadens tak är 10–100 MB och riktiga storlekar är motorns särskiljare** (benchmarken) — teknisk maxstorlek konfigval (förslag 2 GB). Signerade URL:er med kort TTL (inspelningar = känsliga persondata).

### 2.7 Certifiering — typade villkor (generaliseringen)
`course_certificate_requirements` ersätter det hårdkodade utfärdandevillkoret. Utfärdandefunktionen (serverfunktion, ändras endast av Lisa) läser kraven; alla uppfyllda → PDF ur tenant_brands + certificate_title + unikt ID + publik verifieringssida `/verify/<slug>` i tenant-brand. **Breathworks-konfigurationen ger exakt samma beteende som det gamla villkoret — regressionstestas** (grind i TASKS.md). MG-konfigen (sections_complete + loggtröskel + nio uppladdningssektioner + manuell bedömning — fyra krav, inget slutprov) står i datamodellen. PDF server-side; **å/ä/ö testas explicit** (benchmarkfyndet om Thinkific-konkurrenten).

### 2.8 Approvals (generiskt arbetsflöde)
Inlämning → bedömning → beslut, med rubric (jsonb — innehållet skriver Lisa, appen lagrar) och dispenser (spårbara, notes obligatoriskt). Datamodellen byggs i v1; **bedömnings-UI:t är MG fas B** (grind — byggs inte utan Lisas beslut).

### 2.9 Admin-dashboard + kohortunderlag
Deltagarlista per tenant med kohortfilter: progress %, senast aktiv, provstatus, härledd status (aktiv/fast/klar). Kohortunderlag: deltagare × effektivt pris, manuell fakturerad/betald-markering, CSV + utskriftsvänlig HTML (ingen PDF-motor — certifikatet är v1:s enda genererade PDF). **Inga procentsatser/delningar i kärnan** — motorns säljposition är "inga transaktionsavgifter"; MG:s delning bor i mg_billing_splits.

### 2.10 MG-tenantens tillägg — fas A-scope i detta bygge
Detaljspec + varför: docs/SPEC-guide-funktioner.md §3–§9 (läs den — beteendedetaljer som 90 %-tröskeln, 7-dagarsfönstret, fönsterberäkningen och FFMQ-tidslåset står DÄR, inte här). Fas A = det en deltagare möter från dag 1 i grundarkohorten: praxislogg (auto ≥90 % uppspelning + manuell 7 dagar bakåt — **manuella dagar räknas fullt ut**, Lisas beslut) · FFMQ-15 pre med tidslås (items + scoring **kopieras ordagrant från sajtens självtest** — Lisa pekar ut källfilen; [L]-beroende i TASKS) · kohort #1 (grundarkohorten, placeholder-pris 11 500 kr [Gissning]) · guidesessionsformuläret · fakturaunderlag utan split-vy. **Fas B och C är specade men SPÄRRADE bakom grindar i TASKS.md.**

### 2.11 Eject-exporten (dag ett-krav i arkitekturen, skript i v1)
Export per tenant: innehållspaket + deltagardata (GDPR-portabelt) + brand_spec.json + standalone-mall + seed-skript. Kravet i v1: **fungerar när Lisa kör den** (skript), inte självbetjäning. Exporten inkluderar 2026-07-11-tabellerna (kohorter, loggar, approvals, certvillkor, mg_-tabellerna för MG). Varför detta inte kan skjutas upp: friköpsaffären är halva affärsmodellen, och eject-snittet måste tvinga context-lagret från början — i efterhand är det orimligt dyrt.

### 2.12 GDPR (design nu, texter före lansering)
Radering med kaskad (inkl. Storage-objekt; certifikat revokeras) · "ladda ner min data" per deltagare · EU-region ✓ · demon körs med **fiktiva deltagare** · biträdesavtal-mall = före lansering, inte i bygget. Sessionslogg + FFMQ är beteende-persondata — aldrig identifierbart utanför appen.

## 3. Vad som INTE byggs (utanför scope — rör inte)

Stripe/betalväxel (underlag utan växel = Lisas beslut; Plan B-scenariot kan tidigarelägga betalfasen — då fattar Lisa det beslutet, inte bygget) · mejl/notiser/allt outbound (Lisas aktiva val 2026-07-05) · självregistrering + e-postverifiering · AI-kursassistent · engelskt UI (i18n-nycklar förbereds, byggs inte) · självbetjänings-eject · egen-domän-självbetjäning (v1: fält + Lisa aktiverar DNS) · **MG fas B** (FFMQ post, dos-respons-rapport, bedömnings-UI, certifikatutfärdande med MG-villkor, guidepipeline-vyn) · **MG fas C** (kursledarbehörighet + vy, split-visning, registersidan "Hitta en guide", samtyckesflöde) · nya kurser/innehållsändringar.

## 4. Vad som INTE får regressa (kontrolleras i varje fas)

1. **Eject-snittet:** allt tenant-specifikt genom context-lagret; allt exporterbart.
2. **Provregeln:** tid låser aldrig upp förbi underkänt prov — även med kohort-drip.
3. **Breathworks-beteendet:** certvillkors-generaliseringen och kohortfälten ändrar ingenting för tenant #1 (villkorstrio, self_paced, certifikat) — regressionstest är grind.
4. **Tenant-isolation:** RLS på alla tabeller, tenant_id överallt.
5. **Namnbytes-säkerheten:** inga tenant-strängar, procentsatser eller priser i kod.
6. **Inga transaktionsavgifter** i motorns kärna.
7. **Inget outbound:** appen skickar inga mejl/notiser/externa anrop.
8. **Brand-trohet:** motor-chrome + tenant-tokens exakt enligt `../brand.md`; MG:s Editorial Lugn återges utan avvikelse; ingen dark mode i deltagarvyn.

## 5. Kända öppna punkter (ur källdokumenten — lös i bygget, gissa inte)

- Subdomän-routning vs path-routning i demon — avgörs mot Vercel-uppsättningen. [Trolig]
- PDF-generering: react-pdf eller Playwright-print — välj, logga i docs/DECISIONS.md, testa å/ä/ö.
- TUS-uppladdning av stora MP4 — verifieras skarpt här (kunde inte testas i Cowork).
- FFMQ-källfilen: **väntar på Lisa** (pekar ut filen i mindfulnessguiden.se-kodbasen). Bygg inte FFMQ-items själv.
- FFMQ-15-villkoren: att instrumentet får användas i kommersiell kursapp är INTE verifierat ([Gissning] i godkända specen §11.8 — "värt fem minuters kontroll mot instrumentets publicerade användarvillkor"). Flagga till Lisa innan FFMQ-momentet byggs klart.
- MG:s meditationsljud: var filerna bor + hur ≥90 %-uppspelningen mäts (spelaren rapporterar andel av media_duration_sec) designas i bygget → docs/DECISIONS.md. **[L] Lisa pekar ut/levererar ljudfilerna** — utan dem kan auto-loggningen inte byggas klart.
- MG-modulfilernas exakta struktur mot parserns formatkontrakt — anpassa parsern, aldrig innehållet.
