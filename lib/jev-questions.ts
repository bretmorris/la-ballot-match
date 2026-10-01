// The exact questions sent to Jev. Shared by scripts/score.ts and the "How it works" page,
// so what the site says it asks is literally what it asks.

export type Dim = { id: string; label: string; minus: string; plus: string }

export const JEV_MODEL = "jev-1.13.0"

export function positionLevels(d: Dim): [string, string, string, string, string] {
  return [
    `Strongly and consistently favors: ${d.minus}`,
    `Leans toward: ${d.minus}`,
    `Mixed, moderate, or balanced between "${d.minus}" and "${d.plus}"`,
    `Leans toward: ${d.plus}`,
    `Strongly and consistently favors: ${d.plus}`,
  ]
}

export function directionLevels(d: Dim): [string, string, string, string, string] {
  return [
    `A YES vote moves policy substantially toward: ${d.minus}`,
    `A YES vote moves policy somewhat toward: ${d.minus}`,
    `A YES vote has no meaningful effect on this issue, or effects in both directions cancel out`,
    `A YES vote moves policy somewhat toward: ${d.plus}`,
    `A YES vote moves policy substantially toward: ${d.plus}`,
  ]
}

export const candidatePositionInstructions = (d: Dim) =>
  `Based on \`evidence\` about \`candidate\` (their own statements, voting record, policy record, and endorsements), where does the candidate stand on ${d.label}?`

export const candidateEvidenceInstructions = (d: Dim) =>
  `Does \`evidence\` contain specific information about \`candidate\`'s own position, votes, or record on ${d.label}? Party affiliation alone does not count.`

export const candidateEvidenceCriteria = (d: Dim) => ({
  true: `The evidence states or clearly shows the candidate's position, votes, or actions on ${d.label}`,
  false: `The evidence is silent, off-topic, or too vague to tell where the candidate stands on ${d.label}`,
})

export const measureDirectionInstructions = (d: Dim) =>
  `Based on \`measure\` and \`evidence\`, which way does a YES vote move policy on ${d.label}?`

export const measureRelevanceInstructions = (d: Dim) =>
  `Does a YES vote on \`measure\` directly change policy on ${d.label} (${d.minus} vs. ${d.plus})?`

export const measureRelevanceCriteria = (d: Dim) => ({
  true: `Passing the measure directly changes policy, funding, or rules on ${d.label}`,
  false: `The measure does not meaningfully affect ${d.label}`,
})
