// Spot-check evidence: fetch a random sample of source URLs and see whether a distinctive phrase from each item appears.
//   npx tsx scripts/check-evidence.ts [sampleSize]
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const DIR = join(import.meta.dirname, "..", "data", "evidence")
const n = Number(process.argv[2] ?? 20)
type Item = { text: string; kind?: string; source: { url: string; title: string } }

const items: { contest: string; option: string; item: Item }[] = []
for (const f of readdirSync(DIR)) {
  const ev = JSON.parse(readFileSync(join(DIR, f), "utf8"))
  for (const [option, list] of Object.entries(ev.options ?? {})) for (const item of list as Item[]) items.push({ contest: ev.contestId, option, item })
}
const sample = items.sort(() => Math.random() - 0.5).slice(0, n)

const words = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 4)

async function main() {
  console.log(`${items.length} evidence items; checking ${sample.length}\n`)
  for (const { option, item } of sample) {
    let status = "ERR", overlap = 0
    try {
      const res = await fetch(item.source.url, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0 (evidence check)" } })
      status = String(res.status)
      const page = new Set(words(await res.text()))
      const w = [...new Set(words(item.text))]
      overlap = w.length ? w.filter((x) => page.has(x)).length / w.length : 0
    } catch {}
    console.log(`${status.padEnd(4)} ${(overlap * 100).toFixed(0).padStart(3)}%  ${option.padEnd(24)} ${item.text.slice(0, 70)}  <${item.source.url.slice(0, 70)}>`)
  }
}
main()
