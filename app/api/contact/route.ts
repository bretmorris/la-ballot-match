// Contact form → email via Resend. No database; nothing stored.
//
// Env (set in Vercel): RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL (a Resend-verified sender,
// or "LA Ballot Match <onboarding@resend.dev>" while testing), CONTACT_SECRET (any random string).
//
// Spam defenses, no third-party captcha:
//  - GET issues an HMAC-signed timestamp; POST must return it, at least MIN_AGE_MS old and not expired.
//  - Hidden honeypot field must stay empty.
//  - Length and link-count limits.
//  - Best-effort per-IP rate limit (per serverless instance).

import { createHmac, timingSafeEqual } from "node:crypto"

const MIN_AGE_MS = 4_000
const MAX_AGE_MS = 2 * 60 * 60_000
const MAX_LINKS = 3
const RATE = { windowMs: 10 * 60_000, max: 5 }
const hits = new Map<string, number[]>()

const secret = () => process.env.CONTACT_SECRET || process.env.RESEND_API_KEY || ""
const sign = (ts: string) => createHmac("sha256", secret()).update(ts).digest("hex")

function validToken(token: unknown): boolean {
  if (typeof token !== "string" || !secret()) return false
  const [ts, sig] = token.split(".")
  if (!ts || !sig) return false
  const expected = Buffer.from(sign(ts))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
  const age = Date.now() - Number(ts)
  return age >= MIN_AGE_MS && age <= MAX_AGE_MS
}

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE.windowMs)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > RATE.max
}

const configured = () => Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL && process.env.CONTACT_FROM_EMAIL)

export async function GET() {
  if (!configured()) return Response.json({ configured: false }, { headers: { "Cache-Control": "no-store" } })
  const ts = String(Date.now())
  return Response.json({ configured: true, token: `${ts}.${sign(ts)}` }, { headers: { "Cache-Control": "no-store" } })
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export async function POST(request: Request) {
  if (!configured()) return Response.json({ error: "The contact form isn't set up yet." }, { status: 503 })

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {}

  // Bots: pretend success so they don't adapt.
  if (clean(body.website, 200) !== "") return Response.json({ ok: true })
  if (!validToken(body.token)) return Response.json({ error: "Please wait a few seconds and try again." }, { status: 400 })

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (rateLimited(ip)) return Response.json({ error: "Too many messages. Try again later." }, { status: 429 })

  const kind = clean(body.kind, 40) || "Other"
  const name = clean(body.name, 100)
  const email = clean(body.email, 200)
  const message = clean(body.message, 5000)
  const context = clean(body.context, 1000)

  if (message.length < 10) return Response.json({ error: "Please write a bit more about the issue." }, { status: 400 })
  if (email && !isEmail(email)) return Response.json({ error: "That email address doesn't look right." }, { status: 400 })
  if ((message.match(/https?:\/\//g) ?? []).length > MAX_LINKS) {
    return Response.json({ error: "Please include fewer links." }, { status: 400 })
  }

  const text = [
    `Type: ${kind}`,
    `From: ${name || "(no name)"} <${email || "no email given"}>`,
    "",
    message,
    "",
    context ? `---\nContext (sent by the form): ${context}` : "",
  ].join("\n")

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL,
      to: [process.env.CONTACT_TO_EMAIL],
      reply_to: email || undefined,
      subject: `[LA Ballot Match] ${kind}: ${message.slice(0, 60).replace(/\s+/g, " ")}`,
      text,
    }),
  })
  if (!res.ok) return Response.json({ error: "Couldn't send right now. Please try again later." }, { status: 502 })
  return Response.json({ ok: true })
}
