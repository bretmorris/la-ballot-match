"use client"

import { useEffect, useState } from "react"

const KINDS = ["Something's broken", "Wrong or missing contest", "Wrong info about a candidate or measure", "Question", "Other"]

export default function ContactForm({ contestId }: { contestId?: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)
  const [kind, setKind] = useState(contestId ? KINDS[2] : KINDS[0])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("") // honeypot
  const [includeContext, setIncludeContext] = useState(true)
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState("")

  // Tokens expire after 2 hours; fetch a fresh one on load and after any failed send.
  const refreshToken = () =>
    fetch("/api/contact")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured)
        setToken(d.token ?? null)
      })
      .catch(() => setConfigured(false))

  useEffect(() => {
    refreshToken()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    setError("")
    const context = includeContext
      ? [contestId && `contest=${contestId}`, `page=${location.pathname}`, `browser=${navigator.userAgent}`].filter(Boolean).join(" | ")
      : ""
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, name, email, message, website, token, context }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Couldn't send.")
      setStatus("sent")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send.")
      setStatus("idle")
      refreshToken()
    }
  }

  if (status === "sent") {
    return (
      <div className="body">
        <p>
          <strong>Thanks, message sent.</strong> If you left an email address, I&apos;ll do my best to reply.
        </p>
      </div>
    )
  }

  return (
    <form className="body" onSubmit={submit}>
      {!configured && (
        <p className="error">The contact form isn&apos;t switched on yet. Please check back soon.</p>
      )}

      <label className="meta" htmlFor="kind">
        What&apos;s this about?
      </label>
      <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="field">
        {KINDS.map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>

      <label className="meta" htmlFor="message">
        What happened? {contestId && "Which part of this contest looks wrong?"}
      </label>
      <textarea
        id="message"
        className="field"
        rows={6}
        required
        minLength={10}
        maxLength={5000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="For example: my address says it's not in LA County, but it is."
      />

      <label className="meta" htmlFor="email">
        Your email (optional, only if you&apos;d like a reply)
      </label>
      <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />

      <label className="meta" htmlFor="name">
        Your name (optional)
      </label>
      <input id="name" type="text" className="field" value={name} onChange={(e) => setName(e.target.value)} />

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <label className="meta" style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "12px 0" }}>
        <input type="checkbox" checked={includeContext} onChange={(e) => setIncludeContext(e.target.checked)} />
        <span>
          Include technical details (your browser{contestId ? " and which contest you were viewing" : ""}). Never includes
          your quiz answers or address.
        </span>
      </label>

      <div className="btns">
        <button className="btn primary" type="submit" disabled={!configured || !token || status === "sending"}>
          {status === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
