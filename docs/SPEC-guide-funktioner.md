<!-- FLYTTAD HIT PERMANENT 2026-07-11 (byggspec-sessionen). Detta är guide-funktionsspecens ENDA levande källa från och med nu — gränsdragningsbeslutets regel "en källa, ingen separat MG-app-spec vid sidan om". Originalet i outputs/mindfulnessguiden/guide-funktioner/ är FRUSET som Lisas godkända beslutsunderlag (2026-07-11) och bär en pekare hit. Innehållet nedan är bytevis identiskt med den godkända versionen. Ändringar görs endast här och loggas i docs/DECISIONS.md. -->

# SPEC — Guide-funktionerna: MG-tenanten + motortillägg i Kursmotorn

*2026-07-11 · Cowork (Fable) · **GODKÄND av Lisa 2026-07-11 (sen kväll)** — öppna frågorna 1–2+4 besvarade, se §11 · Skriven för den implementerande modellen (Cursor eller Claude Code — specen är motoroberoende). Läses tillsammans med: `gransdragning-kursmotorn-mg.md` (beslutet + principen), `projects/kursmotorn/datamodell.md` (basmodellen som utökas), `projects/kursmotorn/brief.md` (låsta arkitekturbeslut). Denna spec går in i Kursmotorns byggspec-paket (SPEC/TASKS/ACCEPTANCE + repo-CLAUDE.md) när det skrivs — den ska inte leva som separat sidospår efter det. Fientligt granskad 2026-07-11; 25 fynd åtgärdade (bl.a. datamodellens implementerbarhetshål §2, fönsterankaret §3.1, phase-härledningen §3.2).*

*Konfidens: [Säker] hård evidens · [Trolig] stark slutsats · [Gissning] hypotes/placeholder. Sessionsbeslut citeras ur chatten 2026-07-11 och är inte spårbara i fil — de skrivs därför ut ordagrant här.*

---

## 0. Den verkliga asken — och varför funktionerna finns

Lisas ask (chatten 2026-07-11): *"hjälp mig med Specarna för appens guide-funktioner (sessionslogg, multi-kohort, per-deltagare-fakturering + Kursmotorn-gränsdragningen) — Fable skriver specen, Cursor/svagare modeller bygger."*

Beslut fattade i samma session:

1. **Gränsen:** MG = tenant #2 på Kursmotorn; generiskt i kärnan, MG-specifikt i tenant-tillägg (se gränsdragningsdokumentet — inkl. det dokumenterade avsteget från briefens fas 2-placering).
2. **Fakturering:** underlag, ingen betalväxel — *"vi behöver inga live betalningslösningar just nu, vi fokuserar på betalning lite senare"* (Lisa, chatten).
3. **Multi-kohort:** kohortdatamodell från dag 1; kursledarens UI byggs fas 2 men specas färdigt här.
4. **Scope:** allt specas nu — även registersidan och FFMQ-kopplingen.

**Varför funktionerna finns (GTM-plan v2, 2026-07-11):** appen är kontrollpunkten — varje deltagare, även hos en licensierad kursledare, går genom den. Det ger kopieringsskydd, intäkt per deltagare och kvalitetsinsyn i samma mekanism. Sessionsloggen är samtidigt certifieringens kriteriedata (kursens eget krav) och licensstegen upp till kursledare. FFMQ parad med loggen är mätlöftet i säljargumentationen — GTM kallar dos-respons-redovisningen "starkare evidens, ärligare — och något ingen svensk konkurrent kan visa". En implementerande modell som "optimerar bort" någon av delarna bryter alltså affärsmodellen, inte bara en feature.

**Regler som rider med bygget** (samma leash som alla Lisas byggen): draft-only och inget outbound — appen skickar ingenting externt i dessa faser (mejl är fas 2 även i Kursmotorn) · hemligheter är Lisas att lägga in, aldrig påhittade, aldrig committade · produktions-DB-ändringar = Lisas uttryckliga per-åtgärds-OK · UI-copy följer Editorial Lugn + writing-rules för MG-tenantens vyer · beslut under bygget loggas i `docs/DECISIONS.md`.

---

## 1. Certifieringskraven — faktabasen allt bygger på

Ur kursmaterialet, ordagrant (C-FINAL vecka 9, "Certifieringsmomentet") [Säker — citerat 2026-07-11]:

> Du har nu:
> - Loggat fem dagars meditation per vecka under sex veckor ✓
> - Laddat upp sex MP4-inspelningar i deltagarrollen (V1–6) ✓
> - Laddat upp en 20-min session i guiderollen (V7) ✓
> - Laddat upp en 20-min emotionell session i guiderollen (V8) ✓
> - Laddat upp en komplett 30-min certifieringssession (V9) ✓

Och kursens löfte om loggen (C-FINAL vecka 1) [Säker — citerat]:

> "appen loggar varje genomförd meditation automatiskt, så du behöver inte föra egen bok. Loggen är också en del av vägen mot certifieringen — den kräver minst fem loggade meditationsdagar per vecka genom grundkursens sex veckor."

Licenskriterierna nivå 2 (GTM v2, utkast som skarpställs med kull 1) [Säker på att GTM säger det; nivåerna själva är utkast]:

- Godkänd certifieringssession av hög kvalitet (Lisas bedömning, dokumenterad)
- **Minst 10 dokumenterade sessioner ledda på egen arbetsplats efter examen (loggas i appen)**
- Egen aktiv praxis · **co-leder en hel kursomgång med Lisa** · undertecknat licensavtal

**Källkonflikten LÖST (Lisas beslut 2026-07-11 sen kväll):** kurstexten (C-FINAL v9) och GTM:s kriterielista sa olika saker om co-ledningen — v9 lovar *"en kursomgång ledd tillsammans med oss"*, GTM sa "de sista tre veckorna". Lisa valde kurstextens lydelse: **kriteriet är en hel kursomgång, 3-veckorsvarianten stryks ur GTM.** Kvar att bevaka: "efter examen" om de tio sessionerna står bara i GTM, inte i kurstexten — appens räkneregel hanteras i §3.2/§11.2. [Säker — beslutet gavs i denna session]

Appen måste alltså kunna: räkna loggade praxisdagar per vecka mot 5×6-kravet · ta emot och räkna en uppladdning i var och en av nio uppladdningssektioner · hålla en dokumenterad bedömning av certifieringssessionen · räkna guidesessioner efter examen mot 10 · och göra allt detta per kohort.

---

## 2. Datamodell — tillägg till `datamodell.md`

Basmodellen (tenants, memberships, courses/modules/sections, quizzes, uploads, section_progress, attestations, certificates) gäller oförändrad. Nedan är tilläggen. Principer som ärvs: tenant_id på allt + RLS; ingenting varumärkes- eller affärsbundet hårdkodas; allt tenant-specifikt genom context-lagret (eject-snittet).

### 2.1 Motor-kärna (generiskt — passerar andra-tenant-testet)

**cohorts** — id, tenant_id, course_id, name, leader_membership_id (nullable — null = plattformsägaren leder), start_date (date, NOT NULL), end_date (nullable), price_per_participant_sek (int, NOT NULL — sätts när kohorten skapas; basmodellens courses har inget prisfält, så kohorten är prisets hem tills betalfasen byggs), status (`planned`|`active`|`completed`|`cancelled`), **sold_by** (`platform`|`leader`), **delivered_by** (`platform`|`leader`), created_at.
*Varför sold_by/delivered_by som två fält:* GTM:s risk 2 kräver att "kohorter sålda av guider" och "kohorter levererade av guider" mäts separat — olika hälsomått för guide-motorn. [Säker på kravet] De är också enda sanningskällan för delningsflödet (§2.2 härleder ur dem — ingen dubbellagring).

**enrollments** — id, user_id, cohort_id, tenant_id, status (`active`|`paused`|`dropped`|`completed`), **starts_at** (date, default = kohortens start_date — sätts senare för eftersläntrare; ankaret för certfönstren, §3.1), company (text, nullable — fritext för fakturaunderlaget), price_override_sek (int, nullable — rabatterade platser, t.ex. grundarkohortens hälsostrateg-profiler per GTM), invoiced_at (nullable), paid_at (nullable), **moved_from_enrollment_id** (nullable — spårbarhet vid flytt), created_at.
Regler: unik (user_id, cohort_id) · **högst en aktiv enrollment per user och kurs** (kontrolleras i serverfunktionen som skapar/flyttar — inte enbart i klienten) · **flytt = ny rad** (gamla sätts `dropped`, nya får moved_from_enrollment_id) så historiken består. invoiced_at/paid_at är **manuella markeringar** — ingen betalväxel (Lisas beslut).

**Drip-ändring:** basmodellen saknar idag ankare för scheduled-läget (courses har inget datumfält; gating-logiken säger bara "drip_offset_days passerade" utan att säga från vad — en öppen lucka i skissen). Kohorten löser den: **scheduled-läge kräver enrollment i en kohort, och upplåsning räknas från kohortens start_date.** En kurs utan kohorter kan bara publiceras som self_paced (valideras vid publicering). Self-paced-läget oförändrat. **Provregeln orörd i båda lägena** (tid låser aldrig upp förbi underkänt prov — låst beslut, får inte regressa).

**log_type_defs** — id, tenant_id, course_id, log_type (text, t.ex. `practice_day`, `guide_session`), label, **daily_unique** (bool), created_at. Typregistret: definierar vilka loggtyper en kurs använder och om typen är en dagtyp (max en per dag).

**activity_logs** — id, tenant_id, user_id, course_id, cohort_id (nullable), log_type (text — måste finnas i log_type_defs), logged_date (date), source (`auto`|`manual`), metadata (jsonb), created_at.
Unikhet: **partiellt unikt index på (user_id, log_type, logged_date) WHERE log_type = 'practice_day'** — v1:s enda dagtyp. Serverfunktionen som skriver loggrader läser daily_unique ur typregistret och avvisar dubbletter för framtida dagtyper; nya dagtyper kräver migrering av indexet (dokumenterat, acceptabelt). *Varför inte ett generellt unikt index:* guidesessioner får förekomma flera gånger samma dag (mikropaus kl 9 + session kl 15 är normalfallet per v9:s format) — ett rakt unikt villkor hade dödat dem.
*Varför generisk:* dagloggning mot ett mål är standardmekanik för vanebyggande kurser — breathworks-kursen kan använda samma tabell för daglig andningspraktik utan ändring. MG:s regler ligger i typregistret + tillägget, inte i tabellen.

**course_certificate_requirements** — id, **tenant_id**, course_id, position, type (`sections_complete`|`final_quiz_pass`|`attestation`|`upload_sections`|`log_threshold`|`manual_approval`), config (jsonb), created_at.
*Varför:* basmodellens utfärdandevillkor är hårdkodat "alla sektioner + slutprov + attestation". MG-kursen har **inget slutprov** — certifieringen vilar på logg + nio inspelningar + bedömd certifieringssession (§1 [Säker]). I stället för ett MG-specialfall generaliseras villkoren till typade krav som utfärdandefunktionen läser. Utfärdandefunktionen förblir serverfunktion som endast Lisa ändrar (briefens beslut).
- Breathworks-konfig (identiskt beteende med idag — regressionstestas): `sections_complete` + `final_quiz_pass` {threshold: 80} + `attestation` {type: live_session_honor}.
- MG-konfig: `sections_complete` + `log_threshold` {log_type: practice_day, min_days_per_week: 5, weeks: 6, window_anchor: enrollment_starts_at} + `upload_sections` {section_ids: [de nio uppladdningssektionerna V1–V9], min_per_section: 1} + `manual_approval` {approval_type: certifieringssession}.
*Obs semantiken i upload_sections:* kravet är **minst en uppladdning i var och en av de nio sektionerna** — inte nio filer totalt. Kursen uppmuntrar uttryckligen flera versioner per övning; nio versioner av samma meditation uppfyller inte kravet.

**approvals** — id, tenant_id, user_id, course_id, **cohort_id** (nullable), approval_type (text), **target** (jsonb, nullable — vad beslutet pekar på, t.ex. {window_index: 3} för en dispenserad loggvecka eller {upload_id: …} för en bedömd inspelning), assessed_by (user_id), passed (bool, nullable — null = inlämnad/öppen, ej bedömd), rubric (jsonb — tenantens bedömningsmall; innehållet skrivs av Lisa separat, appen lagrar), notes (text), decided_at (nullable), created_at.
*Varför:* "Certifieringssessionens bedömning blir kommersiellt viktig (grund för licens) — kriterierna skrivs ner nu" (GTM). Bedömningen måste vara dokumenterad och sökbar, inte ett mejl. Generisk: vilken tenant som helst kan ha ett manuellt bedömningsmoment. Samma tabell bär dispenser (approval_type `log_threshold_dispens`, target = fönstret, notes obligatoriskt).

**Kohortunderlag (vy, ingen tabell):** per kohort — enrollments med namn, company, effektivt pris (**price_override_sek ?? cohort.price_per_participant_sek** — ingen tredje fallback; kurser har inget prisfält i basmodellen), status, invoiced_at/paid_at, summa. Export: CSV + utskriftsvänlig HTML. Ligger i motorns admin eftersom varje tenant med kohorter behöver den; **inga procentsatser eller delningar här** — det är tenant-tillägg.

### 2.2 MG-tenantens tillägg (bakom context-lagret; ingår i MG:s eject-export)

**mg_guide_status** — user_id, tenant_id, level (`deltagare`|`certifierad`|`licensierad`), certified_at (nullable), licensed_at (nullable), license_agreement_signed_at (nullable, manuellt fält), co_led_cohort_id (nullable, manuellt fält), register_active (bool, default false — manuell toggle i v1), register_consent_version (text, nullable), register_consent_at (nullable), notes.
*Varför manuella fält för avtal/co-ledning:* de är verkliga händelser utanför appen; automatisering vore fejkad precision.

**Guidesessioner** = rader i `activity_logs` med log_type `guide_session` (daily_unique = false) och metadata-schema: `{ format: "A"|"B"|"C"|"annat", context: text (sammanhang/arbetsplats — fritext, deltagaren väljer detaljnivå), participants_count: int|null, note: text|null }`. Formaten är kursens egna (v9): A Mikropausen · B Mindfulness-stunden · C Introduktionsföreläsningen; "annat" täcker resten — ingen egen "intro"-kategori, C är introduktionsformatet.
*Varför på kärnans loggmekanism:* samma tabell, ingen ny infrastruktur; MG-tillägget äger typens semantik och vyerna. Fasen (under kursen / efter examen) lagras **inte** — den härleds vid läsning, se §3.2.

**mg_ffmq_responses** — id, tenant_id, user_id, cohort_id, occasion (`pre`|`post`), answers (jsonb — 15 items), facet_scores (jsonb — FFMQ-15:s fem facetter), total_score (int), completed_at, **locked_at** (nullable — se §7).
*Iteminnehåll och scoring:* **återanvänd sajtens befintliga FFMQ-15-implementation ordagrant** — Lisa pekar ut källfilen i mindfulnessguiden.se-kodbasen. Skriv inte om och nyöversätt inte items; instrumentdrift förstör före/efter-jämförbarheten. (Designregel i denna spec — motiven är psykometriska, inte källbelagda här.)

**mg_billing_splits** — id, tenant_id, cohort_id (1:1), leader_share_pct (int, nullable), referral_amount_sek (int, nullable), agreement_ref (text, nullable — hänvisning till licensavtal), notes. **Flödestypen härleds ur cohorts.sold_by/delivered_by — den lagras inte igen här** (en sanningskälla). En kohort utan split-rad = ingen delning (Lisas egna kohorter, t.ex. grundarkohorten).
*Varför fält, inte konstanter:* 40 % (kursledare säljer + håller) och 20–25 % (Lisa säljer, kursledare håller) är GTM:s **utgångsbud [Gissning — förhandlas per licensavtal]**. Ingen procentsats hårdkodas någonstans.

### 2.3 RLS och eject

Alla nya tabeller — inklusive course_certificate_requirements och log_type_defs — har tenant_id + RLS enligt basmodellens mönster (även mg_-tabellerna, trots att bara MG använder dem: isolationen ska inte bero på att ingen annan råkar ha data). Eject-exporten utökas: mg_-tabellerna + activity_logs + log_type_defs + cohorts/enrollments/approvals + certifikatvillkoren ingår i MG-tenantens exportpaket (json + filer), så friköpskravet håller även för MG själv.

---

## 3. Funktion 1 — Sessionsloggen

### 3.1 Praxisloggen (grundkursens veckor 1–6, sedan frivillig vana)

- **Auto-loggning:** när deltagaren spelat en meditationsljudfil i appen till ≥90 % av dess längd skapas en `practice_day` för dagens datum (source `auto`), om ingen redan finns. *Varför 90 %:* kursens löfte är att appen loggar varje **genomförd** meditation automatiskt — genomförd, inte startad. Tröskeln är mätbar i spelaren och tål att någon hoppar sista sekundernas tystnad. [Trolig — tröskelvärdet är förslag, konfigval]
- **Manuell loggning:** deltagaren kan markera en dag som övad utanför appen (source `manual`), max **7 dagar bakåt**. **Manuella dagar räknas fullt ut mot certkravet — Lisas beslut 2026-07-11 (§11.1).** Ett tryck, valfri kort notering. *Varför:* kursen kräver praxis, inte app-uppspelning — tyst meditation och egna sessioner är fullvärdig praxis. Källan (auto/manuell) syns i Lisas admin, aldrig som misstroende i deltagarvyn.
- **Certberäkningen:** grundkursens sex veckor = sex på varandra följande 7-dagarsfönster från **enrollment.starts_at** (default = kohortens startdatum). *Varför enrollment-ankare, inte kohort-ankare:* eftersläntrare är normalfallet, inte undantaget — försäljning pågår fram till kohortstart och någon ansluter alltid i vecka 2. Med kohortankare hade de mekaniskt förlorat fönster 1 utan möjlighet att reparera (manuell loggning når bara 7 dagar bakåt). Admin sätter starts_at vid sen enrollment. Beräknas i en serverfunktion/vy (`log_threshold`-kravet läser den), aldrig i klienten.
- **Flytt mellan kohorter:** loggrader är daterade och följer användaren (de refererar kurs, inte bara kohort); fönstren räknas om från den nya enrollmentens starts_at. Dagar loggade före det nya ankaret hamnar utanför fönstren — kan repareras med dispens (nedan). Flytt efter kursstart är därför en admin-åtgärd med varning, inte vardag.
- **Dispens:** en missad vecka (sjukdom, kris) ska inte mekaniskt döda certifieringen. Lisa kan ge dokumenterad dispens = approvals-rad (approval_type `log_threshold_dispens`, cohort_id satt, target {window_index: N}, notes obligatoriskt) som utfärdandefunktionen räknar som uppfyllt fönster. *Varför via approvals:* beslutet ska vara spårbart, inte en osynlig datajustering.
- **Deltagarvyn:** veckovy med "X av 5 dagar den här veckan", de sex fönstren som stilla progressrad, aktuell certstatus per krav. Ton: Editorial Lugn — uppmuntran och kvitto, aldrig skam eller streak-ångest. Kursens egen formulering sätter tonen: *"det är regelbundenheten som bygger färdigheten, och loggen är kvittot på den"* (C-FINAL v1). Efter vecka 6: loggen lever kvar som frivillig vana (vecka 9 gör daglig praxis till "ett yrkesmässigt åtagande").
- **Dos-respons-rollen:** loggen är följsamhetsdatan som FFMQ-rapporten (funktion 5) kräver. logged_date + cohort_id räcker för "≥5 dagar/vecka"-grupperingen; bygg inget extra.

### 3.2 Guidesessionsloggen (vecka 7 och framåt)

- Formulär i deltagarvyn (MG-tenant): datum, format (A Mikropausen / B Mindfulness-stunden / C Introduktionsföreläsningen / annat), sammanhang (fritext), antal deltagare (valfritt), anteckning (valfri). Skapar activity_logs-rad med log_type `guide_session`. Flera per dag tillåtna.
- **Fasen härleds vid läsning, lagras aldrig:** en session räknas mot licenskriteriets 10 om `logged_date >` **datumet för deltagarens V9-uppladdning** (certifieringssessionens inlämning). *Varför inlämningsdatumet och inte certified_at:* Lisas bedömning kan dröja (approvals-flödet är fas B), och sessioner ledda i bedömningsglappet ska inte kosta guiden räknade sessioner. GTM säger "efter examen" utan att definiera examensögonblicket; inlämningen är den tolkning som inte straffar deltagaren. Härledning vid läsning = en sanningskälla, inga stämplar som blir fel retroaktivt. **Bekräftat av Lisa 2026-07-11 (§11.2).**
- Syns för deltagaren under "Min guideresa" (tillsammans med certstatus och nivå) och för Lisa i guidepipeline-vyn (§8).
- *Varför den finns:* licenskriteriet "minst 10 dokumenterade sessioner … (loggas i appen)" [Säker — GTM], registrets aktiv-status på sikt, och GTM-måtten för guide-aktivitet.

### 3.3 Integritetsnot

Sessionsloggen och FFMQ-svaren är persondata om deltagarens beteende. De stannar i appens DB (EU-region), omfattas av radering/export per basmodellens GDPR-design, och **refereras aldrig identifierbart i Notion-hubben eller briefingar** (CLAUDE.md #8 — använd kohortaggregat eller kodbeteckningar).

### 3.4 Acceptanskriterier — sessionsloggen

- [ ] Spelad meditation ≥90 % ⇒ exakt en practice_day för den dagen; två meditationer samma dag ⇒ fortfarande en. Två guidesessioner samma dag ⇒ två rader.
- [ ] Manuell loggning fungerar för idag och 7 dagar bakåt; 8 dagar bakåt avvisas.
- [ ] Testdeltagare med 5/5/5/5/5/5-mönster från sitt starts_at ⇒ log_threshold uppfyllt; 5/5/4/5/5/5 ⇒ ej uppfyllt; samma deltagare + dispens-approval med target {window_index: 3} ⇒ uppfyllt.
- [ ] Sen enrollment (starts_at 10 dagar efter kohortstart) ⇒ fönstren räknas från starts_at; deltagaren kan nå 6/6 fönster.
- [ ] Guidesession daterad före V9-uppladdningen ⇒ räknas inte mot 10; efter ⇒ räknas. Räknaren visar rätt i både deltagar- och adminvy.
- [ ] RLS: deltagare A kan aldrig läsa B:s logg; kursledarbehörighet (fas 2) når endast egna kohortens loggar.
- [ ] Radering av deltagare tar bort loggrader + FFMQ-svar (kaskaden verifierad).

---

## 4. Funktion 2 — Multi-kohort

### 4.1 V1 (byggs nu)

- Kohortmodellen per §2.1. **Grundarkohorten läggs in som kohort #1**: pris 11 500 kr [Gissning — GTM:s placeholder, sätts skarpt], sold_by/delivered_by `platform`, ingen split-rad, startdatum när Lisa sätter det.
- Admin (Lisa): skapa/redigera kohort, lägga till deltagare (enrollment), **flytta deltagare** (= ny enrollment-rad med moved_from_enrollment_id; gamla raden `dropped`; bekräftelsedialog med varning om fönsteromräkning), se progress/logg/provstatus **per kohort** — admin-dashboardens deltagarlista får kohortfilter.
- Drip ankras i kohortens startdatum; scheduled-läge kräver kohort (§2.1). Deltagare i olika kohorter på samma kurs ser olika upplåsningsläge — testa explicit.

### 4.2 Fas 2 (specas nu, byggs månad ~9 — Lisas beslut)

Kursledarbehörigheten: **härleds ur cohorts.leader_membership_id — ingen ny roll i memberships-enumen.** RLS-policies och vyer för kohortscopad data testar "är jag ledare för denna kohort", inte en global roll. *Varför:* en kursledare är ledare för sina kohorter, inte i hela tenanten; en global roll hade läckt behörighet till framtida kohorter automatiskt.

Kursledarvyn —

- Ser: egna kohortens deltagarlista (namn, progress %, senast aktiv, veckologg-status), sessionsöversikt, eget fakturaunderlag (§5) med sin andel.
- Ser INTE: kursinnehållets redigering, andra kohorter, plattformsadmin, FFMQ-individdata (endast kohortaggregat om Lisa aktiverar det — GDPR-flagga, §11.6), deltagarnas exportfunktioner.
- Gör INTE: ändrar priser, utfärdar certifikat, hanterar dispenser — allt sådant är Lisas.
- *Varför fas 2:* första licensierade kursledaren finns månad 9–12 (GTM:s ärliga tidslinje); grundarkohorten leds av Lisa via admin. Datan är kohortkorrekt från dag 1, så fas 2 är vyer + RLS-policies — ingen migrering. [Säker på tidslinjen i GTM; Trolig på "vyer + policies räcker"]

### 4.3 Acceptanskriterier — multi-kohort

- [ ] Två kohorter på samma kurs med olika startdatum ⇒ olika drip-upplåsning för respektive deltagare, samma kursinnehåll.
- [ ] Provregeln håller i kohortläge: passerat drip-datum + underkänt föregående prov ⇒ fortfarande låst.
- [ ] Scheduled-kurs kan inte publiceras utan kohort; self_paced-kurs fungerar utan kohorter (breathworks-demons konfiguration påverkas inte).
- [ ] Grundarkohorten inlagd med placeholder-pris, sold_by/delivered_by = platform, ingen split-rad.
- [ ] Deltagarflytt skapar ny enrollment med moved_from-referens, sätter gamla till dropped, kräver bekräftelse och räknar om certfönstren.
- [ ] Admin-deltagarlistan filtrerar på kohort.

---

## 5. Funktion 3 — Per-deltagare-fakturaunderlag

**Lisas beslut 2026-07-11: underlag, ingen betalväxel.** Appen räknar; Lisa fakturerar från sitt eget system och markerar status manuellt. Stripe/Swish är en senare fas (svenska betalvägar utreds i Kursmotorns fas 2 per benchmarken). Obs: GTM:s Plan B-scenario tidigarelägger betalfasen om grundarkohortens tröskel missas — se gränsdragningsdokumentet, Beroenden och risk.

- **Underlagsvyn per kohort (motor-kärna):** deltagarrad = namn, company, effektivt pris (price_override_sek ?? cohort.price_per_participant_sek), enrollmentstatus, fakturerad/betald-markering; summarad. Knapp: exportera CSV + utskriftsvänlig HTML (PDF via print). *Varför HTML-print och inte PDF-motor:* underlaget är internt; certifikat-PDF:en är den enda PDF som behöver genereringskedja i v1.
- **Manuell status:** invoiced_at/paid_at sätts av Lisa per enrollment (eller flera markerade samtidigt). Ingen automatik, inga påminnelser (inget outbound).
- **Delningsberäkningen (MG-tillägg):** om kohorten har en mg_billing_splits-rad visar MG-underlaget: bruttosumma, kursledarens andel (leader_share_pct eller referral_amount_sek, beroende på kohortens sold_by/delivered_by), plattformens andel. Beräkning, inte transaktion — **utbetalning till kursledare sker utanför appen** (form och moms/självfakturering = juristfråga i licensavtalet, redan flaggad i GTM; appen tar inte ställning).
- **Prisändringar:** effektivt pris fryses inte — underlaget läser alltid aktuella fält. Fakturerad rad visar varning om priset ändrats efter invoiced_at. [Trolig — enklaste ärliga modellen; prisfrysning per faktura byggs om Lisa vill]
- **Får inte regressa:** motorns position "inga transaktionsavgifter på kundens kursförsäljning" (brief) — inga avgiftsfält i kärnan; MG:s delningslogik stannar i mg_-tabellerna.

### Acceptanskriterier — fakturaunderlag

- [ ] Kohort med 8 deltagare, en med price_override ⇒ korrekt radpris och summa; CSV-exporten stämmer mot vyn.
- [ ] Split-exempel ur GTM räknar rätt: 8 × 15 700 kr, sold_by=leader + delivered_by=leader, leader_share_pct=40 ⇒ 50 240 kr kursledare / 75 360 kr plattform. [Säker — GTM:s eget räkneexempel som facit]
- [ ] Grundarkohorten (ingen split-rad) visar inget delningsavsnitt.
- [ ] invoiced_at/paid_at kan sättas och ångras; ingen extern effekt uppstår (inga mejl, inga anrop).
- [ ] Kursledarens fas 2-vy visar endast egen kohorts underlag och egen andel.

---

## 6. Funktion 4 — Registersidan "Hitta en guide"

Byggs **efter examen** (första namnen ~månad 5,5 — GTM: "registret publiceras när de första namnen finns"); specas nu så datamodellen är redo.

- **Publik route i appen** (MG-tenant, Editorial Lugn), t.ex. `/guider`; mindfulnessguiden.se länkar dit. Listar guider där `register_active = true` OCH samtycke finns.
- **Per guide visas:** namn, titel (Certifierad mindfulnessguide / Licensierad kursledare — härlett ur mg_guide_status.level), ort/region (valfritt fält), valfri kort rad (roll/arbetsplats — guiden skriver själv), valfri LinkedIn-länk, länk till certifikatets publika verifieringssida (motorns verify_slug — kopplar registret till det som gör titeln trovärdig).
- **Samtycke:** explicit opt-in i guidens egen vy, med versionerad samtyckestext (register_consent_version/at). Guiden kan avpublicera sig själv när som helst. **Samtyckestexten skrivs och godkänns av Lisa före publicering** — §11.5.
- **Aktiv-status:** manuell toggle (Lisa) i v1 — kriterieautomatik (t.ex. knuten till loggade sessioner eller företagsavtal) är ett senare beslut; bygg inte in en regel som affären inte fattat än.
- **Leadformulär:** besökare kan skicka förfrågan ("vill ni ha en guide/kurs?") → landar i Lisas admin-inkorg i appen. **Ingen mejlnotis i v1** (i linje med Kursmotorns mejlbeslut — Lisas aktiva val 2026-07-05), ingen direktkontakt till guiden utan Lisas förmedling. *Varför:* leads är GTM:s del av guide-erbjudandet ("register och leads"), och Lisa är säljstängaren år 1.

### Acceptanskriterier — registret

- [ ] Guide utan samtycke eller med register_active=false syns aldrig publikt, oavsett nivå.
- [ ] Avpublicering slår igenom direkt; verifieringslänken fungerar oberoende av registerstatus.
- [ ] Leadformulär skapar admin-post; inga externa anrop/mejl går ut.
- [ ] Sidan renderas i MG:s brand och är läsbar utan inloggning; inga andra persondata än de guiden godkänt exponeras.

---

## 7. Funktion 5 — FFMQ-15 + dos-respons

- **Instrument i kursflödet:** FFMQ-15 besvaras i appen vecka 1 (pre — kursflödet promptar vid start, innan praxisen etablerats) och vecka 6 (post, vid grundkursens slut). Items, svarsskala och scoring **kopieras från sajtens befintliga självtest** (Lisa pekar ut källfilen) — ingen omformulering. Sajtens publika, anonyma självtest ligger kvar som marknadsföring; kursens mätning måste vara per deltagare och kan därför inte ersättas av det.
- **Tidslås:** pre-svaret låses (locked_at) när deltagarens fönster 2 börjar — därefter kan det inte skrivas över av deltagaren (admin kan, med spårbarhet). Post kan bara lämnas från fönster 6 och framåt. *Varför:* en pre-mätning som kan skrivas över i vecka 6 förstör tyst exakt den före/efter-jämförbarhet som är rapportens värde; en bekräftelsedialog skyddar inte instrumentet.
- **Deltagaren ser** sitt eget pre/post-resultat, pedagogiskt hållet (facetter förklarade i lugn ton, ingen diagnostik — mätningen beskriver uppmärksamhetsfärdigheter, inte hälsa).
- **Rapportregeln (Lisas uttryckliga krav, GTM Mått):** FFMQ-resultat visas/exporteras **aldrig utan följsamhetsredovisning**. Kohortrapporten i admin grupperar per följsamhet: "övade ≥5 dagar/vecka" (ur praxisloggen) mot övriga — n, medelförändring per facett + totalt per grupp. Ingen gruppcell visas vid n < 5 [förslag — små grupper pekar ut individer; öppen fråga 3]. Rådataexport finns men bara som explicit admin-åtgärd, märkt att den innehåller persondata.
- *Varför regeln är hård:* "utan dosdata är effektdatan värdelös och kan skada trovärdigheten om den publiceras rakt av" — Lisas egen invändning, inbyggd i GTM. Rapporten som appen producerar ÄR det säljbara beviset; en genväg här förstör det.

### Acceptanskriterier — FFMQ

- [ ] Pre + post sparas per deltagare och kohort; pre är låst efter fönster 1 (deltagaren nekas, admin kan med logg); post nekas före fönster 6.
- [ ] Kohortrapporten visar följsamhetsgrupperna korrekt mot ett känt testdataset (fixture: 6 deltagare, 3 följsamma) och döljer grupper under n-tröskeln.
- [ ] Ingen FFMQ-vy existerar som visar kohortresultat utan följsamhetsuppdelningen.
- [ ] Facet-scoring ger identiskt resultat som sajtens självtest för samma svar (jämför mot 3 kända testfall).

---

## 8. Karriärstegen — guidepipeline (MG-tillägg, stödjer allt ovan)

- **mg_guide_status** per §2.2 driver: titeln i registret, guidesessionsräknarens gräns (§3.2), och Lisas överblick.
- **Admin-vyn "Guidepipeline":** alla certifierade med kolumner — certdatum, sessioner efter V9-inlämning (auto ur loggen, mot 10), co-ledning (manuell flagga), licensavtal signerat (manuellt datum), nivå. *Varför:* GTM:s milstolpe "licensiera 2–4 kursledare av de första ~15" behöver en arbetsyta, inte ett kalkylark vid sidan om.
- **Nivåbyte är alltid Lisas manuella beslut** — vyn visar kriterieläget, den beslutar inget. (Selektionen är affärsmodellens skydd; automatik vore fel även om den ginge att bygga.)
- Certifikatutfärdandet (motorn) sätter certified_at + level=certifierad via MG-tilläggets hook när villkoren i §2.1 är uppfyllda — inklusive Lisas godkännande av certifieringssessionen.

### Acceptanskriterier — karriärstegen

- [ ] Certifikat utfärdas endast när samtliga MG-villkor är uppfyllda (sections + logg/dispens + en uppladdning per uppladdningssektion + godkänd approval) — testa varje villkor som ensam blockerare.
- [ ] Breathworks-kursens utfärdande fungerar exakt som före ändringen (regressionstest med dess villkorstrio).
- [ ] Guidepipeline räknar sessioner efter V9-inlämning korrekt och uppdateras när en logg läggs till.
- [ ] Nivåbyte till licensierad kräver aktiv admin-handling; inget auto-byte vid uppfyllda kriterier.

---

## 9. Fasindelning och byggordning

| Fas | När | Innehåll | Varför gränsen går här |
|---|---|---|---|
| **A** | Kursmotorn v1-bygget | Motortilläggen (§2.1) + MG onboardas som tenant #2 med C-FINAL v1–9 + praxislogg (auto + manuell) + FFMQ pre (med tidslås) + kohort #1 + fakturaunderlag (utan split-vy) + guidesessionsformuläret | Allt en deltagare möter från dag 1 i grundarkohorten. Guidesessionsformuläret är billigt när loggmekaniken ändå byggs |
| **B** | Före examen (~månad 5,5) | FFMQ post + dos-respons-rapporten + approvals-flödet (bedömning av certifieringssession, dispenser) + certifikatutfärdande med MG-villkoren + guidepipeline-vyn | Behövs först när kohorten når vecka 6 resp. vecka 9 — men datainsamlingen (fas A) måste ha varit rätt hela vägen |
| **C** | Månad ~9, mot första licensieringen | Kursledarbehörigheten + kursledarvyn + split-visningen i underlaget + registersidan + samtyckesflödet | Första licensierade kursledaren och de första registernamnen finns då — och vyerna byggs med grundarkohortens lärdomar |

Byggordning inom Kursmotorns TASKS.md: motorkärnan (§2.1) före MG-tillägget, med breathworks-regressionstesterna som grind mellan dem. Fas B och C har egna grindar i TASKS.md och byggs inte i förväg utan Lisas beslut.

---

## 10. Vad som INTE får regressa

1. **Eject-snittet:** varje MG-tillägg går genom tenant-context-lagret; MG-tenantens eject-export inkluderar mg_-tabellerna + cohorts/enrollments/activity_logs/log_type_defs/approvals/certifikatvillkoren. Ett tillägg som inte kan exporteras är fel byggt.
2. **Provregeln:** tid låser aldrig upp förbi underkänt prov — även med kohort-drip.
3. **Breathworks-kursen:** certvillkors-generaliseringen och kohortfälten får inte ändra dess beteende (villkorstrio, self_paced-upplåsning, certifikat) — regressionstesta.
4. **Tenant-isolation:** RLS på alla nya tabeller, tenant_id överallt (inkl. certvillkor och typregister).
5. **Namnbytes-säkerheten:** inga MG-strängar, procentsatser eller priser hårdkodade; allt affärsspecifikt är fält.
6. **Inga transaktionsavgifter** i motorns kärna (Kursmotorns säljposition). Plan B:s Epassi-avgift är distributörens, utanför motorn — distinktionen står i gränsdragningsdokumentet.
7. **Inget outbound:** appen skickar inga mejl/notiser/externa anrop i fas A–B (mejl = Kursmotorns fas 2, aktiveras av Lisa).

---

## 11. Öppna frågor till Lisa (1–2+4 LÖSTA — inget blockerar bygget; 3, 5–8 tas i sina faser)

1. ~~Manuella loggdagar mot certkravet~~ **LÖST 2026-07-11: JA** — manuella dagar räknas fullt ut; 7 dagars bakåtfönster står som default (konfigval); källan (auto/manuell) syns i admin.
2. ~~"Efter examen"-gränsen~~ **LÖST 2026-07-11: JA** — gränsen dras vid V9-uppladdningens datum, inte vid Lisas godkännande (§3.2). Utfärdandegrinden står: certifikat kräver Lisas godkännande av certifieringssessionen; processen hålls som feedback + omlämning, aldrig "kuggad" (kursens ton i v9).
3. **FFMQ-rapportens n-tröskel** — förslag: ingen gruppcell under n=5. OK?
4. ~~Licenskriteriernas lydelse: kurstext ↔ GTM~~ **LÖST 2026-07-11 (sen kväll):** Lisa valde kurstextens lydelse — co-ledningskriteriet är **en hel kursomgång ledd tillsammans med Lisa**; GTM:s 3-veckorsvariant stryks (GTM-planen uppdaterad). Kurstexten v9 behöver inte ändras. Följd: licensieringen kan glida mot senare delen av GTM:s spann månad 9–12, eftersom kandidaten co-leder en full omgång efter examen. [Trolig på tidslinjeföljden]
5. **Registrets samtyckestext** — utkastas av Cowork före fas C, godkänns av dig. OK att vänta till fas C?
6. **Juristpunkterna som redan ligger i GTM** — licensavtalet (procentsatser, utbetalningsform för kursledare, FHL-sekretess) och biträdesavtal/personuppgiftsansvar när en kursledare leder kohort. Appen är byggd så att svaren är konfiguration, inte kodändring — men avtalen behövs före fas C.
7. **Bedömningsrubriken** för certifieringssessionen — skrivs som eget dokument ("kriterierna skrivs ner nu", GTM); appen lagrar den som rubric jsonb. Vem utkastar, när?
8. **FFMQ-15-användningen** — instrumentet används redan på sajten; att villkoren tillåter fortsatt användning i kommersiell kursapp har inte verifierats i denna session. [Gissning att det är oproblematiskt — forskningsinstrument i öppen användning; värt fem minuters kontroll mot instrumentets publicerade användarvillkor]

---

## Källor

- `projects/mindfulnessguiden/go-to-market-plan.md` (GTM v2, 2026-07-11) — guide-modellen, nivåkriterierna, ekonomiflödena, måtten, tidslinjen, Plan B.
- C-FINAL vecka 1 + vecka 9 (Claude-projektet + `projects/mindfulnessguiden/kursinnehall/`) — certifieringskraven och loggens lydelse, citerade i §1.
- `projects/kursmotorn/brief.md` + `datamodell.md` + `research/plattforms-benchmark.md` — basarkitekturen, låsta beslut, eject-kravet, fas 2-placeringen som gränsdragningsdokumentet ändrar.
- `projects/mindfulnessguiden/kursinnehall/granskning-2026-07-11/beslutsunderlag-flaggor.md` (C1) — logg-kravets införande i vecka 1.
- Lisas fyra beslut (chatten 2026-07-11, ej spårbara i fil — därför utskrivna ordagrant i §0): tenant-vägen, underlag utan betalväxel, kohortdata nu/kursledar-UI fas 2, allt specas nu.
