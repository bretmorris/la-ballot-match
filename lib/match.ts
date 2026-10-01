// Pure matching logic. Runs in the browser; never sends quiz answers anywhere.
//
// Positions are on [-1, 1]: -1 = the dimension's "minus" pole, +1 = its "plus" pole.

export type QuizItem = {
  id: string
  dimension: string
  agreeMeans: "minus" | "plus"
}

/** answers: item id -> -2..2 (strongly disagree..strongly agree). importance: dimension id -> 0..3 */
export type QuizResponse = {
  answers: Record<string, number>
  importance: Record<string, number>
}

export type Profile = Record<string, { position: number; weight: number }>

/** Jev output for a candidate: where they sit, and how much evidence there was to place them. */
export type CandidateScores = Record<string, { position: number; evidence: number }>

/** Jev output for a measure: which way a YES vote moves policy, and how relevant the measure is. */
export type MeasureScores = Record<string, { direction: number; relevance: number }>

export const DEFAULT_IMPORTANCE = 2
/** Below this share of your weighted priorities covered by evidence, we don't recommend. */
export const MIN_COVERAGE = 0.35
/** Candidate alignment gap (0..1) below which the top two are called a toss-up. */
export const MIN_CANDIDATE_MARGIN = 0.05
/** Measure lean (|score| on -1..1) below which we call it a toss-up. */
export const MIN_MEASURE_LEAN = 0.1
/** Measure must touch at least this much of your importance-weighted relevance. */
export const MIN_MEASURE_RELEVANCE = 0.5

export function buildProfile(items: QuizItem[], response: QuizResponse): Profile {
  const sums: Record<string, { total: number; n: number }> = {}
  for (const item of items) {
    const answer = response.answers[item.id]
    const s = (sums[item.dimension] ??= { total: 0, n: 0 })
    if (answer === undefined) continue
    s.total += (item.agreeMeans === "plus" ? 1 : -1) * answer
    s.n += 1
  }
  const profile: Profile = {}
  for (const [dim, { total, n }] of Object.entries(sums)) {
    profile[dim] = {
      position: n === 0 ? 0 : total / n / 2,
      weight: n === 0 ? 0 : response.importance[dim] ?? DEFAULT_IMPORTANCE,
    }
  }
  return profile
}

export type CandidateMatch = {
  optionId: string
  alignment: number // 0..1, 1 = identical on every scored dimension
  coverage: number // 0..1, share of your weighted priorities we had evidence for
  byDimension: { dimension: string; alignment: number; weight: number }[]
}

export function matchCandidate(profile: Profile, scores: CandidateScores, optionId: string): CandidateMatch {
  let num = 0
  let den = 0
  let totalWeight = 0
  const byDimension: CandidateMatch["byDimension"] = []
  for (const [dim, { position: u, weight: w }] of Object.entries(profile)) {
    if (w <= 0) continue
    totalWeight += w
    const s = scores[dim]
    if (!s || s.evidence <= 0) continue
    const a = 1 - Math.abs(u - s.position) / 2
    num += w * s.evidence * a
    den += w * s.evidence
    byDimension.push({ dimension: dim, alignment: a, weight: w * s.evidence })
  }
  return {
    optionId,
    alignment: den === 0 ? 0 : num / den,
    coverage: totalWeight === 0 ? 0 : den / totalWeight,
    byDimension: byDimension.sort((x, y) => y.weight - x.weight),
  }
}

export type Recommendation =
  | { kind: "pick"; optionId: string }
  | { kind: "toss-up"; optionIds: string[] }
  | { kind: "not-enough-info" }

export function recommendCandidate(matches: CandidateMatch[]): Recommendation {
  const covered = matches.filter((m) => m.coverage >= MIN_COVERAGE).sort((a, b) => b.alignment - a.alignment)
  if (covered.length === 0 || covered.length < Math.min(2, matches.length)) return { kind: "not-enough-info" }
  if (covered.length >= 2 && covered[0].alignment - covered[1].alignment < MIN_CANDIDATE_MARGIN) {
    return { kind: "toss-up", optionIds: [covered[0].optionId, covered[1].optionId] }
  }
  return { kind: "pick", optionId: covered[0].optionId }
}

export type MeasureMatch = {
  lean: number // -1..1, positive = YES matches your views
  relevance: number // importance-weighted relevance of the measure to you
  byDimension: { dimension: string; agreement: number; weight: number }[]
}

export function matchMeasure(profile: Profile, scores: MeasureScores): MeasureMatch {
  let num = 0
  let den = 0
  const byDimension: MeasureMatch["byDimension"] = []
  for (const [dim, { position: u, weight: w }] of Object.entries(profile)) {
    const s = scores[dim]
    if (w <= 0 || !s || s.relevance <= 0) continue
    const agreement = u * s.direction
    num += w * s.relevance * agreement
    den += w * s.relevance
    byDimension.push({ dimension: dim, agreement, weight: w * s.relevance })
  }
  return {
    lean: den === 0 ? 0 : num / den,
    relevance: den,
    byDimension: byDimension.sort((x, y) => y.weight - x.weight),
  }
}

export function recommendMeasure(m: MeasureMatch): Recommendation {
  if (m.relevance < MIN_MEASURE_RELEVANCE) return { kind: "not-enough-info" }
  if (Math.abs(m.lean) < MIN_MEASURE_LEAN) return { kind: "toss-up", optionIds: ["yes", "no"] }
  return { kind: "pick", optionId: m.lean > 0 ? "yes" : "no" }
}
