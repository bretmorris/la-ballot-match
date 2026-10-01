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
/**
 * Minimum evidence-weighted importance (sum of importance × evidence over a candidate's scored issues)
 * before we compare them. Importance is 0–3, so 2 ≈ one issue you care about with solid evidence.
 * Absolute rather than a share of all your issues: a Controller race never touches guns or immigration.
 */
export const MIN_EVIDENCE_WEIGHT = 2
/** Candidate alignment gap (0..1) at or above which the top pick is a clear best match. */
export const MIN_CANDIDATE_MARGIN = 0.05
/** Candidate alignment gap below which it's a toss-up. Between this and MIN_CANDIDATE_MARGIN it's a slight lean. */
export const MIN_CANDIDATE_LEAN_MARGIN = 0.02
/** Measure lean (|score| on -1..1) at or above which YES/NO is a clear best match. */
export const MIN_MEASURE_LEAN = 0.1
/** Measure lean below which it's a toss-up. Between this and MIN_MEASURE_LEAN it's a slight lean. */
export const MIN_MEASURE_SLIGHT_LEAN = 0.05
/** Measure must touch at least this much of your importance-weighted relevance. */
export const MIN_MEASURE_RELEVANCE = 0.5
/** Per-issue relevance below this is treated as "doesn't touch this issue" so small probabilities don't add up. */
export const MIN_ISSUE_RELEVANCE = 0.5

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
  evidenceWeight: number // sum of importance × evidence over scored issues
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
    evidenceWeight: den,
    byDimension: byDimension.sort((x, y) => y.weight - x.weight),
  }
}

export type Recommendation =
  | { kind: "pick"; optionIds: string[] }
  /** optionIds = the tied group at the last seat; alsoPick = clear winners above it (multi-seat only). */
  | { kind: "toss-up"; optionIds: string[]; alsoPick?: string[] }
  /** optionIds = close-call picks for the last seat(s); alsoPick = clear winners above them (multi-seat only). */
  | { kind: "lean"; optionIds: string[]; alsoPick?: string[] }
  /** unscored = candidates we couldn't place; when some were placed and some weren't, we don't compare. */
  | { kind: "not-enough-info"; unscored?: string[] }
  | { kind: "uncontested" }

/**
 * Picks the top `voteFor` candidates. Only compares when every candidate has enough evidence:
 * an unscored candidate might match better than any scored one.
 */
export function recommendCandidate(matches: CandidateMatch[], voteFor = 1): Recommendation {
  if (matches.length <= voteFor) return { kind: "uncontested" }
  const unscored = matches.filter((m) => m.evidenceWeight < MIN_EVIDENCE_WEIGHT).map((m) => m.optionId)
  if (unscored.length > 0) return { kind: "not-enough-info", unscored }
  const ranked = [...matches].sort((a, b) => b.alignment - a.alignment)
  const last = ranked[voteFor - 1]
  const next = ranked[voteFor]
  const gap = last.alignment - next.alignment
  if (gap < MIN_CANDIDATE_LEAN_MARGIN) {
    // Same bar as a clear pick, so nobody is a "best match" on a gap that would only be a slight lean elsewhere.
    const tied = ranked.filter((m) => Math.abs(last.alignment - m.alignment) < MIN_CANDIDATE_MARGIN)
    const clear = ranked.filter((m) => m.alignment - last.alignment >= MIN_CANDIDATE_MARGIN)
    return { kind: "toss-up", optionIds: tied.map((m) => m.optionId), alsoPick: clear.map((m) => m.optionId) }
  }
  const top = ranked.slice(0, voteFor)
  if (gap < MIN_CANDIDATE_MARGIN) {
    const clear = top.filter((m) => m.alignment - next.alignment >= MIN_CANDIDATE_MARGIN)
    const leaned = top.filter((m) => m.alignment - next.alignment < MIN_CANDIDATE_MARGIN)
    return { kind: "lean", optionIds: leaned.map((m) => m.optionId), alsoPick: clear.map((m) => m.optionId) }
  }
  return { kind: "pick", optionIds: top.map((m) => m.optionId) }
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
    if (w <= 0 || !s || s.relevance < MIN_ISSUE_RELEVANCE) continue
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
  if (Math.abs(m.lean) < MIN_MEASURE_SLIGHT_LEAN) return { kind: "toss-up", optionIds: ["yes", "no"] }
  const side = m.lean > 0 ? "yes" : "no"
  return { kind: Math.abs(m.lean) < MIN_MEASURE_LEAN ? "lean" : "pick", optionIds: [side] }
}
