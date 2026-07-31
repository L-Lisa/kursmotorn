/**
 * FFMQ-15 — svensk version ur sajtens självtest (Mindfulnessguiden.se-repots
 * FFMQ-svit, `data/testQuestions.ts`). Lisas beslut: items + scoring kopieras
 * ORDAGRANT (inkl. poängvändningen) — formuleringar och ordning ändras ALDRIG;
 * instrumentdrift förstör före/efter-jämförbarheten. Grund: FFMQ-15:s öppna
 * publicering + attribution (docs/DECISIONS 2026-07-31).
 *
 * Scoringen (sajtens evaluateFFMQAnswers) är porterad ordagrant i ffmq-score.ts;
 * DB-funktionen submit_ffmq (migration ..14) speglar samma logik — testerna kör
 * båda mot samma facit.
 */

export const FFMQ_TITLE = "FFMQ-15 – Five-Facet Mindfulness Questionnaire";
export const FFMQ_ATTRIBUTION =
  "FFMQ-15 efter Baer m.fl. (2006) och Gu m.fl. (2016). Svensk version finns validerad (Lilja m.fl.).";
export const FFMQ_AUTHOR_URL = "https://ruthbaer.com/academics/index.html";
export const FFMQ_SWEDISH_VERSION_URL =
  "https://www.lunduniversity.lu.se/publication/96f42e8f-d0ae-4b2e-b436-13b9e995fdeb";

export type FfmqFacet =
  | "Observera"
  | "Beskriva"
  | "Agera med medvetenhet"
  | "Icke-dömande"
  | "Icke-reaktivitet";

export type FfmqQuestion = {
  id: string;
  text: string;
  facet: FfmqFacet;
  reverseScored?: boolean;
};

/** Skalan — sajtens etiketter ordagrant. */
export const FFMQ_SCALE: { label: string; value: number }[] = [
  { label: "1. Aldrig eller nästan aldrig sant", value: 1 },
  { label: "2. Sällan sant", value: 2 },
  { label: "3. Ibland sant", value: 3 },
  { label: "4. Ofta sant", value: 4 },
  { label: "5. Väldigt ofta eller alltid sant", value: 5 },
];

/** De 15 påståendena — sajtens svenska lydelser ordagrant, samma id:n och ordning. */
export const FFMQ_QUESTIONS: FfmqQuestion[] = [
  {
    id: "q1",
    text: "När jag tar en dusch eller ett bad håller jag mig alert på hur vattnet känns mot min kropp.",
    facet: "Observera",
  },
  {
    id: "q2",
    text: "Jag är bra på att hitta ord som beskriver mina känslor.",
    facet: "Beskriva",
  },
  {
    id: "q3",
    text: "Jag är inte uppmärksam på vad jag gör eftersom jag dagdrömmer, oroar mig eller blir distraherad.",
    facet: "Agera med medvetenhet",
    reverseScored: true,
  },
  {
    id: "q4",
    text: "Jag tror att vissa av mina tankar är onormala eller dåliga och att jag inte borde tänka på det sättet.",
    facet: "Icke-dömande",
    reverseScored: true,
  },
  {
    id: "q5",
    text: "När jag har påfrestande tankar eller bilder ”kliver jag tillbaka” och är medveten om dem utan att bli uppslukad.",
    facet: "Icke-reaktivitet",
  },
  {
    id: "q6",
    text: "Jag lägger märke till hur mat och dryck påverkar mina tankar, kroppsliga förnimmelser och känslor.",
    facet: "Observera",
  },
  {
    id: "q7",
    text: "Jag har svårt att komma på rätt ord för att uttrycka hur jag känner inför saker.",
    facet: "Beskriva",
    reverseScored: true,
  },
  {
    id: "q8",
    text: "Jag gör jobb eller uppgifter automatiskt utan att vara medveten om vad jag gör.",
    facet: "Agera med medvetenhet",
    reverseScored: true,
  },
  {
    id: "q9",
    text: "Jag upplever att vissa av mina känslor är dåliga eller olämpliga och att jag inte borde känna så.",
    facet: "Icke-dömande",
    reverseScored: true,
  },
  {
    id: "q10",
    text: "När jag har påfrestande tankar eller bilder kan jag bara notera dem utan att reagera.",
    facet: "Icke-reaktivitet",
  },
  {
    id: "q11",
    text: "Jag uppmärksammar sinnesintryck som vinden i håret eller solen i ansiktet.",
    facet: "Observera",
  },
  {
    id: "q12",
    text: "Även när jag är fruktansvärt upprörd kan jag hitta ett sätt att sätta ord på det.",
    facet: "Beskriva",
  },
  {
    id: "q13",
    text: "Jag märker att jag gör saker utan att vara uppmärksam.",
    facet: "Agera med medvetenhet",
    reverseScored: true,
  },
  {
    id: "q14",
    text: "Jag säger till mig själv att jag inte borde känna på det här sättet.",
    facet: "Icke-dömande",
    reverseScored: true,
  },
  {
    id: "q15",
    text: "När jag har påfrestande tankar eller bilder noterar jag dem bara och låter dem gå.",
    facet: "Icke-reaktivitet",
  },
];

export const FFMQ_FACETS: FfmqFacet[] = [
  "Observera",
  "Beskriva",
  "Agera med medvetenhet",
  "Icke-dömande",
  "Icke-reaktivitet",
];

export const FFMQ_MIN_SCORE = FFMQ_QUESTIONS.length * 1; // 15 frågor, skala 1-5
export const FFMQ_MAX_SCORE = FFMQ_QUESTIONS.length * 5; // 75 poäng
