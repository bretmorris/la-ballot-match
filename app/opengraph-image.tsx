import { ImageResponse } from "next/og"

export const alt = "LA Ballot Match: see how your LA County ballot lines up with your views"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// A ballot-style card: black header bar, two option rows, one filled oval.
export default function Image() {
  const row = (label: string, filled: boolean) => (
    <div style={{ display: "flex", alignItems: "center", padding: "22px 36px", borderTop: "3px solid #111", fontSize: 40, fontWeight: 700 }}>
      <div style={{ width: 64, height: 38, borderRadius: "50%", border: "5px solid #111", background: filled ? "#111" : "#fff", marginRight: 28 }} />
      {label}
    </div>
  )
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "#ecebe6", padding: 64, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", background: "#fff", border: "5px solid #111" }}>
          <div style={{ display: "flex", background: "#111", color: "#fff", padding: "22px 36px", fontSize: 46, fontWeight: 700, letterSpacing: 2 }}>
            LA BALLOT MATCH
          </div>
          <div style={{ display: "flex", padding: "20px 36px", fontSize: 30, color: "#444" }}>
            November 3, 2026 · Los Angeles County · Unofficial
          </div>
          {row("Take a short quiz on the issues", true)}
          {row("See which choices match your views", false)}
        </div>
      </div>
    ),
    size,
  )
}
