// Stateless proxy to the US Census geocoder (it doesn't allow browser CORS).
// POST keeps the address out of URLs and request logs. Nothing is stored or logged.

import { clientIp, createRateLimiter } from "@/lib/rate-limit"

const CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
const rateLimited = createRateLimiter({ windowMs: 10 * 60_000, max: 30 })

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

  const params = new URLSearchParams({ address, benchmark: "Public_AR_Current", format: "json" })
  try {
    const res = await fetch(`${CENSUS}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    const match = data?.result?.addressMatches?.[0]
    if (!match) return Response.json({ error: "We couldn't find that address. Try including the city and ZIP code." }, { status: 404 })
    return Response.json(
      { lat: match.coordinates.y, lng: match.coordinates.x, matched: match.matchedAddress },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return Response.json({ error: "The address lookup service is unavailable. Try again shortly." }, { status: 502 })
  }
}
