import { FFMQ_QUESTIONS, type FfmqFacet } from "./ffmq";

/**
 * Sajtens scoring, porterad ORDAGRANT ur `lib/ffmqScore.ts` (evaluateFFMQAnswers):
 * adjusted = reverseScored ? 6 − raw : raw · total = summan · facetter med
 * score/min/max/average (2 decimaler). Detta är FACIT — DB-funktionen submit_ffmq
 * (migration ..14) speglar den, och testsviten kör båda mot samma tre kända fall
 * (ACCEPTANCE §Fas 7: identisk scoring som sajtens självtest).
 */

export type AnswerMap = Record<string, number>;

export type FacetScore = {
  facet: FfmqFacet;
  score: number;
  min: number;
  max: number;
  average: number;
};

export type FFMQEvaluation = {
  total: number;
  details: { id: string; raw: number; adjusted: number; facet: FfmqFacet }[];
  facets: FacetScore[];
};

export function evaluateFFMQAnswers(answers: AnswerMap): FFMQEvaluation {
  const facetMap = new Map<FfmqFacet, { sum: number; count: number }>();
  const details: FFMQEvaluation["details"] = [];
  let total = 0;

  for (const question of FFMQ_QUESTIONS) {
    const raw = answers[question.id];
    if (typeof raw !== "number") {
      continue;
    }
    const adjusted = question.reverseScored ? 6 - raw : raw;
    total += adjusted;
    details.push({ id: question.id, raw, adjusted, facet: question.facet });

    const facetEntry = facetMap.get(question.facet) ?? { sum: 0, count: 0 };
    facetEntry.sum += adjusted;
    facetEntry.count += 1;
    facetMap.set(question.facet, facetEntry);
  }

  const facets: FacetScore[] = Array.from(facetMap.entries()).map(([facet, { sum, count }]) => {
    const max = count * 5;
    const min = count * 1;
    return {
      facet,
      score: sum,
      min,
      max,
      average: Number((sum / count).toFixed(2)),
    };
  });

  return { total, details, facets };
}
