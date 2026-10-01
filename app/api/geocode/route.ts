// Stateless geocoding proxy. Tries LA County's public address locator (CAMS) first, which knows county
// addresses best, then falls back to the US Census geocoder. Neither allows browser CORS, hence the proxy.
// POST keeps the address out of URLs and request logs. Nothing is stored or logged.

import { ADDRESS_TYPES, plausibleMatch } from "@/lib/geocode"
import { clientIp, createRateLimiter } from "@/lib/rate-limit"

const CAMS = "https://geocode.gis.lacounty.gov/geocode/rest/services/CAMS_Locator/GeocodeServer/findAddressCandidates"
const CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
const MIN_CAMS_SCORE = 85
const rateLimited = createRateLimiter({ windowMs: 10 * 60_000, max: 30 })

type Found = { lat: number; lng: number; matched: string }

async function cams(address: string): Promise<Found | null> {
  const params = new URLSearchParams({ SingleLine: address, outSR: "4326", maxLocations: "1", outFields: "Addr_type", f: "json" })
  const res = await fetch(`${CAMS}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) })
  if (!res.ok) return null
  const c = (await res.json())?.candidates?.[0]
  if (!c || c.score < MIN_CAMS_SCORE || !ADDRESS_TYPES.has(c.attributes?.Addr_type)) return null
  // CAMS prefixes the address with an internal id: "5161005906, 200 N SPRING ST, LOS ANGELES CA, 90012"
  const matched = String(c.address).replace(/^\d+,\s*/, "")
  if (!plausibleMatch(address, matched)) return null
  return { lat: c.location.y, lng: c.location.x, matched }
}

async function census(address: string): Promise<Found | null> {
  const params = new URLSearchParams({ address, benchmark: "Public_AR_Current", format: "json" })
  const res = await fetch(`${CENSUS}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(String(res.status))
  const m = (await res.json())?.result?.addressMatches?.[0]
  return m ? { lat: m.coordinates.y, lng: m.coordinates.x, matched: m.matchedAddress } : null
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return Response.json({ error: "Too many lookups. Please wait a few minutes and try again." }, { status: 429 })
  }
  let address = ""
  try {
    address = String((await request.json())?.address ?? "").trim()
  } catch {}
  if (address.length < 5 || address.length > 200) {
    return Response.json({ error: "Enter a street address." }, { status: 400 })
  }

  let found: Found | null = null
  try {
    found = await cams(address)
  } catch {}
  try {
    found ??= await census(address)
  } catch {
    if (!found) return Response.json({ error: "The address lookup service is unavailable. Try again shortly." }, { status: 502 })
  }
  if (!found) return Response.json({ error: "That address wasn't found. Try including the city and ZIP code." }, { status: 404 })
  return Response.json(found, { headers: { "Cache-Control": "no-store" } })
}
