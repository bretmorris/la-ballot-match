// Merge contests + Jev scores + evidence into the static bundle the site loads.
//   npx tsx scripts/build-bundle.ts   (runs automatically before `next build`)

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dirname, "..")
const DATA = join(ROOT, "data")
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"))
const maybe = (p: string) => (existsSync(p) ? read(p) : null)
const r2 = (n: number) => Math.round(n * 100) / 100

type Src = { url: string; title: string }

const contests = readdirSync(join(DATA, "contests"))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => read(join(DATA, "contests", f)))
  .map((c) => {
    const score = maybe(join(DATA, "scores", `${c.id}.json`))
    const evidence = maybe(join(DATA, "evidence", `${c.id}.json`))
    const out: Record<string, unknown> = {
      id: c.id,
      title: c.title,
      level: c.level,
      jurisdiction: c.jurisdiction,
      kind: c.kind,
      voteFor: c.voteFor,
      summary: c.summary,
      notes: c.notes,
      rrcc: c.rrcc,
      sources: (c.sources ?? []).map((s: Src) => ({ url: s.url, title: s.title })),
    }
    out.options = c.options.map((o: Record<string, unknown>) => {
      const opt: Record<string, unknown> = { id: o.id, name: o.name, party: o.party, ballotDesignation: o.ballotDesignation, incumbent: o.incumbent }
      const s = score?.options?.[o.id as string]
      if (s) opt.scores = Object.fromEntries(Object.entries(s).map(([d, v]: [string, any]) => [d, { position: r2(v.position), evidence: r2(v.evidence) }]))
      const ev = evidence?.options?.[o.id as string]
      if (ev?.length) opt.evidence = ev.map((e: { text: string; source: Src }) => ({ text: e.text, url: e.source.url, title: e.source.title }))
      return opt
    })
    if (score?.measure) {
      out.measureScores = Object.fromEntries(
        Object.entries(score.measure).map(([d, v]: [string, any]) => [d, { direction: r2(v.direction), relevance: r2(v.relevance) }]),
      )
    }
    return out
  })

const bundle = {
  election: "November 3, 2026 General Election",
  builtAt: new Date().toISOString(),
  dimensions: read(join(DATA, "dimensions.json")),
  quiz: read(join(DATA, "quiz.json")),
  contests,
}

mkdirSync(join(ROOT, "public", "data"), { recursive: true })
const file = join(ROOT, "public", "data", "ballot.json")
writeFileSync(file, JSON.stringify(bundle))
console.log(`wrote ${file}: ${contests.length} contests, ${(JSON.stringify(bundle).length / 1024).toFixed(0)} KB`)
