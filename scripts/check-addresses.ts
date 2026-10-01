// Run sample addresses through the live geocoder + RR/CC precinct lookup and sanity-check the resulting ballots.
//   npx tsx scripts/check-addresses.ts [baseUrl]
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { contestsFor, precinctQueryUrl, districtsOf } from "../lib/districts"

const BASE = process.argv[2] ?? "https://la-ballot-match.vercel.app"
const bundle = JSON.parse(readFileSync(join(import.meta.dirname, "..", "public", "data", "ballot.json"), "utf8"))

const ADDRESSES = [
  "200 N Spring St, Los Angeles, CA 90012", // LA City Hall
  "333 W Ocean Blvd, Long Beach, CA 90802", // Long Beach City Hall
  "44933 Fern Ave, Lancaster, CA 93534", // Lancaster City Hall
  "38300 Sierra Hwy, Palmdale, CA 93550", // Palmdale City Hall
  "23920 Valencia Blvd, Santa Clarita, CA 91355", // Santa Clarita City Hall
  "23825 Stuart Ranch Rd, Malibu, CA 90265", // Malibu City Hall
  "4801 E 3rd St, Los Angeles, CA 90022", // East LA Civic Center (unincorporated)
  "505 S Garey Ave, Pomona, CA 91766", // Pomona City Hall
  "1685 Main St, Santa Monica, CA 90401", // Santa Monica City Hall
  "275 E Olive Ave, Burbank, CA 91502", // Burbank City Hall
  "8300 Santa Monica Blvd, West Hollywood, CA 90069", // WeHo City Hall
  "9770 Culver Blvd, Culver City, CA 90232", // Culver City City Hall
  "1 W Manchester Blvd, Inglewood, CA 90301", // Inglewood City Hall
  "3031 Torrance Blvd, Torrance, CA 90503", // Torrance City Hall
  "11333 Valley Blvd, El Monte, CA 91731", // El Monte City Hall
  "1444 W Garvey Ave S, West Covina, CA 91790", // West Covina City Hall
  "11111 Brookshire Ave, Downey, CA 90241", // Downey City Hall
  "205 S Willowbrook Ave, Compton, CA 90220", // Compton City Hall
  "100 N Garfield Ave, Pasadena, CA 91101", // Pasadena City Hall
  "6262 Van Nuys Blvd, Van Nuys, CA 91401", // Van Nuys (LA City, Valley)
]

async function main() {
  for (const address of ADDRESSES) {
    const g = await fetch(`${BASE}/api/geocode`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) })
    const geo = await g.json()
    if (!g.ok) { console.log(`✗ ${address}: geocode ${g.status} ${geo.error}`); continue }
    const p = await (await fetch(precinctQueryUrl(geo.lat, geo.lng))).json()
    const attrs = p.features?.[0]?.attributes
    if (!attrs) { console.log(`✗ ${address}: no precinct (${p.error?.message ?? "outside county?"})`); continue }
    const cs = contestsFor(bundle.contests, attrs)
    const count = (t: string) => cs.filter((c: any) => c.jurisdiction.type === t).length
    const local = cs.filter((c: any) => c.rrcc)
    const ids = cs.map((c: any) => c.id)
    const warn: string[] = []
    if (count("congressional") !== 1) warn.push(`congress=${count("congressional")}`)
    if (count("assembly") !== 1) warn.push(`assembly=${count("assembly")}`)
    if (count("board-of-equalization") !== 1) warn.push(`boe=${count("board-of-equalization")}`)
    if (count("state-senate") > 1) warn.push(`senate=${count("state-senate")}`)
    if (new Set(ids).size !== ids.length) warn.push("duplicate contests")
    const d = districtsOf(attrs)
    if (count("state-senate") === 0 && Number(d["state-senate"]) % 2 === 0) warn.push(`even SD${d["state-senate"]} but no senate contest`)
    const city = String(attrs.DST_CITY ?? "").trim()
    console.log(
      `${warn.length ? "⚠" : "✓"} ${address.split(",")[0].padEnd(24)} → ${String(geo.matched).slice(0, 38).padEnd(38)} ${String(attrs.PRECINCT).padEnd(9)} ` +
        `CD${d.congressional} SD${d["state-senate"]} AD${d.assembly} | ${cs.length} contests, ${local.length} local (${city || "unincorp"}) ${warn.join(", ")}`,
    )
  }
}
main()
