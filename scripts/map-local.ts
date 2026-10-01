// Link each local contest to the RR/CC precinct attribute that identifies its voters.
//
//   npx tsx --env-file=.env.local scripts/map-local.ts
//
// Code shortlists plausible field/value pairs (data/research/rrcc/<FIELD>.txt, pulled from the layer);
// Jev picks the one that matches the contest. Low-confidence picks are listed for manual review.

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { choice, TypeSafeClient } from "@typesafe-ai/sdk"

const ROOT = join(import.meta.dirname, "..")
const RRCC = join(ROOT, "data", "research", "rrcc")
const FILES = ["local-la-city", "local-la-schools", "local-other"]
const SHORTLIST = 30
const REVIEW_BELOW = 0.6

const FIELDS = readdirSync(RRCC).filter((f) => f.endsWith(".txt")).map((f) => f.replace(/\.txt$/, ""))

const values: Record<string, string[]> = {}
const valuesOf = (field: string) =>
  (values[field] ??= readFileSync(join(RRCC, `${field}.txt`), "utf8").split("\n").map((s) => s.trim()).filter(Boolean))

// Words that don't identify a specific jurisdiction.
const GENERIC = new Set([
  "CITY", "OF", "THE", "DISTRICT", "DIST", "MEMBER", "BOARD", "SCHOOL", "MEASURE", "COUNCIL", "AND", "COUNTY", "UNIFIED", "USD",
  "UNION", "ELEMENTARY", "ELEM", "HIGH", "JOINT", "COMMUNITY", "COLLEGE", "COLL", "MUNICIPAL", "MUNI", "WATER", "AGENCY",
  "GOVERNING", "TRUSTEE", "TRUSTEES", "AREA", "NO", "DIRECTORS", "DIVISION", "SEAT", "EDUCATION", "BD", "TA", "OFFICE",
  "UNEXPIRED", "TERM", "ENDING", "VALLEY", "VLY", "OF", "FOR", "MAYOR", "CLERK", "TREASURER",
])
const ORD: Record<string, string> = { FIRST: "1", SECOND: "2", THIRD: "3", FOURTH: "4", FIFTH: "5", SIXTH: "6", SEVENTH: "7", EIGHTH: "8", NINTH: "9", TENTH: "10" }
const ABBR: Record<string, string> = { VALLEY: "VLY", MUNICIPAL: "MUNI", COLLEGE: "COLL" }
function tokens(s: string): string[] {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).flatMap((t) => {
    if (ORD[t]) return [ORD[t]]
    const m = t.match(/^(?:TA|DIV)?(\d+)(?:ST|ND|RD|TH)?$/)
    if (m) return [String(Number(m[1]))]
    return ABBR[t] ? [t, ABBR[t]] : [t]
  })
}
const nameTokens = (s: string) => new Set(tokens(s).filter((t) => !GENERIC.has(t) && !/^\d+$/.test(t)))

type Contest = { id: string; title: string; jurisdiction: { type: string; district: string | null; name: string }; rrcc?: { field: string; value: string }[] }

const client = new TypeSafeClient({ defaultModel: "jev-1.13.0", timeout: 60_000 })

async function main() {
  const review: string[] = []
  for (const file of FILES) {
    const path = join(ROOT, "data", "contests", `${file}.json`)
    const contests: Contest[] = JSON.parse(readFileSync(path, "utf8"))
    await Promise.all(
      contests.map(async (c, i) => {
        await new Promise((r) => setTimeout(r, (i % 50) * 120)) // gentle pacing
        delete c.rrcc
        const names = nameTokens(c.jurisdiction.name)
        const all = new Set(tokens(`${c.jurisdiction.name} ${c.title}`))
        const shortlist = FIELDS.flatMap((field) => valuesOf(field).map((value) => ({ field, value })))
          .map((o) => {
            const vt = tokens(o.value)
            const nameHits = vt.filter((t) => names.has(t)).length
            return { ...o, nameHits, rank: nameHits * 10 + vt.filter((t) => all.has(t)).length }
          })
          .filter((o) => o.nameHits > 0)
          .sort((a, b) => b.rank - a.rank)
          .slice(0, SHORTLIST)
        if (shortlist.length === 0) {
          review.push(`${c.id}: no candidates`)
          return
        }
        const options: Record<string, string> = { NONE: "None of these values corresponds to this contest's electorate" }
        for (const o of shortlist) options[`${o.field}::${o.value}`] = `Precinct field ${o.field} = "${o.value}"`
        const res = await client.systemOne({
          state: {
            contest: { title: c.title, jurisdiction: c.jurisdiction.name, district: c.jurisdiction.district },
            glossary: "Precinct field values are LA County Registrar abbreviations: COLL=College, TA3=Trustee Area 3, ELEM/ELEMENTARY=Elementary School District, USD=Unified School District, VLY=Valley, MUNI=Municipal, 5TH COUNCIL=City Council District 5, DIV n or Nth DIV=Division n. DST_* fields name the whole district; DIV_* fields name a sub-district (council district or trustee area).",
          },
          questions: {
            match: choice(
              "Which precinct field value identifies exactly the voters eligible to vote in `contest`? For a by-district or trustee-area contest choose the sub-district (DIV_*) value; for an at-large or district-wide contest or measure choose the whole-district (DST_*) value.",
              options,
            ),
          },
        })
        const a = res.answers.match
        if (a.choice === "NONE") {
          review.push(`${c.id}: NONE (${a.confidence.toFixed(2)})`)
          delete c.rrcc
          return
        }
        const [field, value] = a.choice.split("::")
        c.rrcc = [{ field, value }]
        if (a.confidence < REVIEW_BELOW) review.push(`${c.id}: ${a.choice} (${a.confidence.toFixed(2)})`)
      }),
    )
    // Hand-verified fixes for contests Jev couldn't place confidently.
    const overrides: Record<string, [string, string]> = JSON.parse(readFileSync(join(ROOT, "data", "research", "rrcc-overrides.json"), "utf8"))
    for (const c of contests) if (overrides[c.id]) c.rrcc = [{ field: overrides[c.id][0], value: overrides[c.id][1] }]
    writeFileSync(path, JSON.stringify(contests, null, 2) + "\n")
    console.log(`${file}: ${contests.filter((c) => c.rrcc).length}/${contests.length} mapped`)
  }
  console.log(`\nReview (${review.length}):\n` + review.sort().join("\n"))
}

main()
