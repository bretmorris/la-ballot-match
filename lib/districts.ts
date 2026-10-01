// Map an LA County RR/CC precinct record to the contests on that voter's ballot.
// Layer: Registrar_Recorder_Precincts_with_District_Names/FeatureServer/2 (see data/research/address-lookup.md)

export const PRECINCT_LAYER =
  "https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Registrar_Recorder_Precincts_with_District_Names/FeatureServer/2/query"

export type PrecinctAttributes = Record<string, string | number | null>

export type Jurisdiction = { type: string; district: string | null; name: string }

/** Local contests carry the RR/CC attribute(s) that identify their voters; any match qualifies. */
export type RrccMatch = { field: string; value: string }

export type ContestLike = { id: string; jurisdiction: Jurisdiction; rrcc?: RrccMatch[] }

// Ordinal district fields → our jurisdiction.type. Values look like "34TH US CONGRESSIONAL".
const ORDINAL_FIELDS: Record<string, string> = {
  DIST_CONG: "congressional",
  DIST_STSEN: "state-senate",
  DIST_STASS: "assembly",
  DIST_BEQ: "board-of-equalization",
  DIST_SUP: "supervisorial",
}

// Contests every LA County voter sees.
const EVERYONE = new Set(["statewide", "county", "judicial"])

function ordinal(value: unknown): string | null {
  const m = typeof value === "string" ? value.match(/^(\d+)(ST|ND|RD|TH)\b/) : null
  return m ? String(Number(m[1])) : null
}

export function districtsOf(attrs: PrecinctAttributes): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [field, type] of Object.entries(ORDINAL_FIELDS)) {
    const n = ordinal(attrs[field])
    if (n) out[type] = n
  }
  return out
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : "")

export function contestsFor<C extends ContestLike>(contests: C[], attrs: PrecinctAttributes): C[] {
  const districts = districtsOf(attrs)
  return contests.filter((c) => {
    if (c.rrcc?.length) return c.rrcc.some((m) => norm(attrs[m.field]) === norm(m.value))
    const { type, district } = c.jurisdiction
    if (EVERYONE.has(type)) return true
    return district !== null && districts[type] === String(Number(district))
  })
}

export function precinctQueryUrl(lat: number, lng: number): string {
  const p = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*", // ~90 short string fields; no geometry
    returnGeometry: "false",
    f: "json",
  })
  return `${PRECINCT_LAYER}?${p}`
}
