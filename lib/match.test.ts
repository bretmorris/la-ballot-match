import { describe, expect, it } from "vitest"
import {
  buildProfile,
  matchCandidate,
  matchMeasure,
  recommendCandidate,
  recommendMeasure,
  type QuizItem,
} from "./match"

const items: QuizItem[] = [
  { id: "a1", dimension: "a", agreeMeans: "plus" },
  { id: "a2", dimension: "a", agreeMeans: "minus" },
  { id: "b1", dimension: "b", agreeMeans: "plus" },
]

describe("buildProfile", () => {
  it("averages items, flipping minus-direction items, onto -1..1", () => {
    const p = buildProfile(items, { answers: { a1: 2, a2: -2, b1: -1 }, importance: { a: 3 } })
    expect(p.a).toEqual({ position: 1, weight: 3 })
    expect(p.b).toEqual({ position: -0.5, weight: 2 }) // default importance
  })

  it("gives zero weight to dimensions with no answers", () => {
    const p = buildProfile(items, { answers: { a1: 1 }, importance: {} })
    expect(p.b.weight).toBe(0)
  })
})

describe("candidates", () => {
  const profile = { a: { position: 1, weight: 3 }, b: { position: -1, weight: 1 } }

  it("prefers the closer candidate", () => {
    const near = matchCandidate(profile, { a: { position: 0.8, evidence: 1 }, b: { position: -0.6, evidence: 1 } }, "near")
    const far = matchCandidate(profile, { a: { position: -0.8, evidence: 1 }, b: { position: 0.6, evidence: 1 } }, "far")
    expect(near.alignment).toBeGreaterThan(far.alignment)
    expect(recommendCandidate([near, far])).toEqual({ kind: "pick", optionId: "near" })
  })

  it("weights by importance", () => {
    // x matches on the important dimension, y on the unimportant one
    const x = matchCandidate(profile, { a: { position: 1, evidence: 1 }, b: { position: 1, evidence: 1 } }, "x")
    const y = matchCandidate(profile, { a: { position: -1, evidence: 1 }, b: { position: -1, evidence: 1 } }, "y")
    expect(recommendCandidate([x, y])).toEqual({ kind: "pick", optionId: "x" })
  })

  it("reports not-enough-info when evidence is thin", () => {
    const x = matchCandidate(profile, { a: { position: 1, evidence: 0.1 } }, "x")
    const y = matchCandidate(profile, {}, "y")
    expect(x.coverage).toBeLessThan(0.35)
    expect(recommendCandidate([x, y])).toEqual({ kind: "not-enough-info" })
  })

  it("calls near-identical candidates a toss-up", () => {
    const s = { a: { position: 0.5, evidence: 1 }, b: { position: 0, evidence: 1 } }
    expect(recommendCandidate([matchCandidate(profile, s, "x"), matchCandidate(profile, s, "y")]).kind).toBe("toss-up")
  })
})

describe("measures", () => {
  const profile = { a: { position: 0.8, weight: 3 }, b: { position: -1, weight: 2 } }

  it("recommends yes when YES moves toward the voter", () => {
    const m = matchMeasure(profile, { a: { direction: 1, relevance: 1 } })
    expect(recommendMeasure(m)).toEqual({ kind: "pick", optionId: "yes" })
  })

  it("recommends no when YES moves away", () => {
    const m = matchMeasure(profile, { b: { direction: 1, relevance: 1 } })
    expect(recommendMeasure(m)).toEqual({ kind: "pick", optionId: "no" })
  })

  it("skips measures irrelevant to the voter's priorities", () => {
    const m = matchMeasure(profile, { c: { direction: 1, relevance: 1 }, a: { direction: 1, relevance: 0.1 } })
    expect(recommendMeasure(m)).toEqual({ kind: "not-enough-info" })
  })
})
