// Offline Jev scoring. Places every ballot option on every issue dimension.
//
//   npx tsx --env-file=.env.local scripts/score.ts [contestIdPrefix...]
//
// Measures are scored from their official summary (+ any evidence file).
// Candidates are scored only from data/evidence/<contestId>.json; with no evidence they're skipped.
// Responses are cached in scripts/.cache so reruns are free and reproducible.

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { noul, score, TypeSafeClient, type ScoreCriteria } from "@typesafe-ai/sdk"

const MODEL = "jev-1.13.0"
const ROOT = join(import.meta.dirname, "..")
const DATA = join(ROOT, "data")
const CACHE = join(ROOT, "scripts", ".cache")
const OUT = join(DATA, "scores")
const CONCURRENCY = 5

type Dimension = { id: string; label: string; minus: string; plus: string }
type Source = { url: string; title: string; retrieved: string }
type Option = { id: string; name: string; party?: string | null; ballotDesignation?: string; incumbent?: boolean }
type Contest = {
  id: string
  title: string
  kind: "candidate" | "measure" | "retention"
  summary?: string
  options: Option[]
  jurisdiction: { name: string }
}
type EvidenceItem = { text: string; kind?: string; source: Source }
type EvidenceFile = { contestId: string; measure?: EvidenceItem[]; options?: Record<string, EvidenceItem[]> }

const dimensions: Dimension[] = JSON.parse(readFileSync(join(DATA, "dimensions.json"), "utf8"))

// Five stand-alone levels from the "minus" pole to the "plus" pole.
function positionLevels(d: Dimension): ScoreCriteria {
  return [
    `Strongly and consistently favors: ${d.minus}`,
    `Leans toward: ${d.minus}`,
    `Mixed, moderate, or balanced between "${d.minus}" and "${d.plus}"`,
    `Leans toward: ${d.plus}`,
    `Strongly and consistently favors: ${d.plus}`,
  ]
}

function directionLevels(d: Dimension): ScoreCriteria {
  return [
    `A YES vote moves policy substantially toward: ${d.minus}`,
    `A YES vote moves policy somewhat toward: ${d.minus}`,
    `A YES vote has no meaningful effect on this issue, or effects in both directions cancel out`,
    `A YES vote moves policy somewhat toward: ${d.plus}`,
    `A YES vote moves policy substantially toward: ${d.plus}`,
  ]
}

function candidateQuestions() {
  const q: Record<string, ReturnType<typeof score> | ReturnType<typeof noul>> = {}
  for (const d of dimensions) {
    q[`${d.id}__position`] = score(
      `Based on \`evidence\` about \`candidate\` (their own statements, voting record, policy record, and endorsements), where does the candidate stand on ${d.label}?`,
      positionLevels(d),
    )
    q[`${d.id}__evidence`] = noul(
      `Does \`evidence\` contain specific information about \`candidate\`'s own position, votes, or record on ${d.label}? Party affiliation alone does not count.`,
      {
        true: `The evidence states or clearly shows the candidate's position, votes, or actions on ${d.label}`,
        false: `The evidence is silent, off-topic, or too vague to tell where the candidate stands on ${d.label}`,
      },
    )
  }
  return q
}

function measureQuestions() {
  const q: Record<string, ReturnType<typeof score> | ReturnType<typeof noul>> = {}
  for (const d of dimensions) {
    q[`${d.id}__direction`] = score(
      `Based on \`measure\` and \`evidence\`, which way does a YES vote move policy on ${d.label}?`,
      directionLevels(d),
    )
    q[`${d.id}__relevance`] = noul(
      `Does a YES vote on \`measure\` directly change policy on ${d.label} (${d.minus} vs. ${d.plus})?`,
      {
        true: `Passing the measure directly changes policy, funding, or rules on ${d.label}`,
        false: `The measure does not meaningfully affect ${d.label}`,
      },
    )
  }
  return q
}

const client = new TypeSafeClient({ defaultModel: MODEL, timeout: 60_000, retry: { maxRetries: 4 } })

type Answers = Record<string, { score?: number; confidence?: number; probabilities?: Record<string, number>; noul?: number }>

async function ask(state: unknown, questions: Record<string, unknown>): Promise<{ answers: Answers; model: string }> {
  mkdirSync(CACHE, { recursive: true })
  const key = createHash("sha256").update(JSON.stringify({ MODEL, state, questions })).digest("hex")
  const file = join(CACHE, `${key}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await client.systemOne({ state: state as any, questions: questions as any })
  const out = { answers: res.answers as Answers, model: res.model }
  writeFileSync(file, JSON.stringify(out))
  return out
}

const round = (n: number) => Math.round(n * 1000) / 1000
const signed = (s: number) => round((s - 2) / 2) // 0..4 → -1..1

async function scoreContest(c: Contest) {
  const evPath = join(DATA, "evidence", `${c.id}.json`)
  const ev: EvidenceFile | null = existsSync(evPath) ? JSON.parse(readFileSync(evPath, "utf8")) : null
  const result: Record<string, unknown> = { contestId: c.id, kind: c.kind, model: MODEL, scoredAt: new Date().toISOString() }

  if (c.kind === "measure") {
    const state = {
      measure: { title: c.title, jurisdiction: c.jurisdiction.name, summary: c.summary },
      evidence: (ev?.measure ?? []).map((e) => ({ text: e.text, kind: e.kind })),
    }
    const { answers } = await ask(state, measureQuestions())
    const scores: Record<string, unknown> = {}
    for (const d of dimensions) {
      const dir = answers[`${d.id}__direction`]
      scores[d.id] = {
        direction: signed(dir.score!),
        relevance: round(answers[`${d.id}__relevance`].noul!),
        confidence: round(dir.confidence!),
        probabilities: dir.probabilities,
      }
    }
    result.measure = scores
    return result
  }

  if (c.kind === "candidate") {
    const options: Record<string, unknown> = {}
    for (const o of c.options) {
      const items = ev?.options?.[o.id] ?? []
      if (items.length === 0) continue
      const state = {
        office: `${c.title} (${c.jurisdiction.name})`,
        candidate: { name: o.name, party: o.party ?? "nonpartisan office", ballotDesignation: o.ballotDesignation },
        evidence: items.map((e) => ({ text: e.text, kind: e.kind })),
      }
      const { answers } = await ask(state, candidateQuestions())
      const scores: Record<string, unknown> = {}
      for (const d of dimensions) {
        const pos = answers[`${d.id}__position`]
        scores[d.id] = {
          position: signed(pos.score!),
          evidence: round(answers[`${d.id}__evidence`].noul!),
          confidence: round(pos.confidence!),
          probabilities: pos.probabilities,
        }
      }
      options[o.id] = scores
    }
    result.options = options
    return result
  }

  return null // retention: handled later
}

async function main() {
  // Args: contest id prefixes, or "file:<name>" to score every contest in data/contests/<name>.json
  const args = process.argv.slice(2)
  const files = args.filter((a) => a.startsWith("file:")).map((a) => `${a.slice(5)}.json`)
  const prefixes = args.filter((a) => !a.startsWith("file:"))
  const contests: Contest[] = readdirSync(join(DATA, "contests"))
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) =>
      (JSON.parse(readFileSync(join(DATA, "contests", f), "utf8")) as Contest[]).filter(
        (c) => args.length === 0 || files.includes(f) || prefixes.some((p) => c.id.startsWith(p)),
      ),
    )

  mkdirSync(OUT, { recursive: true })
  let done = 0
  const queue = [...contests]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        try {
          const r = await scoreContest(c)
          if (r) writeFileSync(join(OUT, `${c.id}.json`), JSON.stringify(r, null, 1) + "\n")
          console.log(`[${++done}/${contests.length}] ${c.id}${r ? "" : " (skipped)"}`)
        } catch (e) {
          console.error(`FAILED ${c.id}:`, e instanceof Error ? e.message : e)
        }
      }
    }),
  )
}

main()
