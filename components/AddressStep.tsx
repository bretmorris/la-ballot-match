"use client"

import { useState } from "react"
import { precinctQueryUrl, type PrecinctAttributes } from "@/lib/districts"

type Props = { onBack: () => void; onDone: (attrs: PrecinctAttributes, address: string) => void }
type Found = { lat: number; lng: number; matched: string }

export default function AddressStep({ onBack, onDone }: Props) {
  const [address, setAddress] = useState("")
  const [found, setFound] = useState<Found | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function geocode() {
    setBusy(true)
    setError("")
    setFound(null)
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Lookup failed.")
      setFound(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.")
    } finally {
      setBusy(false)
    }
  }

  function useLocation() {
    if (!navigator.geolocation) return setError("Your browser can't share its location.")
    setBusy(true)
    setError("")
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false)
        setFound({ lat: p.coords.latitude, lng: p.coords.longitude, matched: "Your current location" })
      },
      () => {
        setBusy(false)
        setError("Couldn't get your location. Enter your address instead.")
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  async function confirm() {
    if (!found) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(precinctQueryUrl(found.lat, found.lng))
      const data = res.ok ? await res.json() : null
      // ArcGIS reports errors as HTTP 200 with an `error` body.
      if (!data || data.error || !Array.isArray(data.features)) {
        throw new Error("LA County's precinct lookup isn't responding. Please try again in a minute.")
      }
      const attrs = data.features[0]?.attributes
      if (!attrs) throw new Error("That location isn't in an LA County voting precinct.")
      onDone(attrs, found.matched)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't look up your precinct.")
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <div className="bar">Where are you registered to vote?</div>
      <div className="body">
        <p className="meta">
          Your ballot depends on your address. It&apos;s used only to find your districts. It isn&apos;t stored.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (address.trim()) geocode()
          }}
        >
          <label htmlFor="addr" className="meta">
            Street address, city, ZIP
          </label>
          <input
            id="addr"
            type="text"
            autoComplete="street-address"
            placeholder="e.g. 1234 Main St, Pasadena, CA 91101"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="btns">
            <button className="btn" type="button" onClick={onBack}>
              Back
            </button>
            <button className="btn primary" type="submit" disabled={busy || !address.trim()}>
              Find my ballot
            </button>
            <button className="btn" type="button" onClick={useLocation} disabled={busy}>
              Use my location
            </button>
          </div>
        </form>

        {found && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>
            <p>
              Found: <strong>{found.matched}</strong>
            </p>
            <p className="meta">Is this right? If not, edit the address above and try again.</p>
            <div className="btns">
              <button className="btn primary" onClick={confirm} disabled={busy}>
                Yes, show my ballot
              </button>
            </div>
          </div>
        )}

        {busy && <p className="meta">Looking up…</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  )
}
