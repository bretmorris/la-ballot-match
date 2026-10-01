// Pull every distinct DST_*/DIV_* value from the RR/CC precinct layer into data/research/rrcc/<FIELD>.txt.
//   npx tsx scripts/fetch-rrcc-values.ts
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const LAYER = "https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Registrar_Recorder_Precincts_with_District_Names/FeatureServer/2"
const OUT = join(import.meta.dirname, "..", "data", "research", "rrcc")
const SKIP = /^(DST|DIV)_(MISC5|MISC6)$/ // 2010 supervisorial/BOE lines

async function main() {
  mkdirSync(OUT, { recursive: true })
  const meta = await (await fetch(`${LAYER}?f=json`)).json()
  const fields: string[] = meta.fields.map((f: { name: string }) => f.name).filter((n: string) => /^(DST|DIV)_/.test(n) && !SKIP.test(n))
  for (const field of fields) {
    const values = new Set<string>()
    for (let offset = 0; ; ) {
      const q = new URLSearchParams({ where: "1=1", outFields: field, returnDistinctValues: "true", returnGeometry: "false", orderByFields: field, resultOffset: String(offset), resultRecordCount: "2000", f: "json" })
      const d = await (await fetch(`${LAYER}/query?${q}`)).json()
      const feats = d.features ?? []
      for (const f of feats) values.add(String(f.attributes[field] ?? "").trim())
      if (!d.exceededTransferLimit || feats.length === 0) break
      offset += feats.length
    }
    values.delete(""); values.delete("0")
    if (values.size) {
      writeFileSync(join(OUT, `${field}.txt`), [...values].sort().join("\n") + "\n")
      console.log(field, values.size)
    }
  }
}
main()
