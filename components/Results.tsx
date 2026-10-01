"use client"

import { useMemo } from "react"
import type { Bundle, Contest, Dimension } from "@/lib/bundle"
import { contestsFor, type PrecinctAttributes } from "@/lib/districts"
import {
  matchCandidate,
  matchMeasure,
  recommendCandidate,
  recommendMeasure,
  type CandidateMatch,
  type MeasureMatch,
  type Profile,
  type Recommendation,
} from "@/lib/match"

type Props = {
  bundle: Bundle
  profile: Profile
  precinct: { attrs: PrecinctAttributes; address: string }
  onEditQuiz: () => void
  onEditAddress: () => void
}

// Roughly the order contests appear on an LA County ballot.
const SECTIONS: { title: string; test: (c: Contest) => boolean }[] = [
  { title: "Federal", test: (c) => c.level === "federal" },
  { title: "State offices", test: (c) => c.level === "state" && c.kind === "candidate" },
  { title: "County offices", test: (c) => c.level === "county" && c.kind === "candidate" },
  { title: "Judicial", test: (c) => c.level === "judicial" },
  { title: "School and college districts", test: (c) => (c.level === "school" || c.jurisdiction.type.includes("college") || c.jurisdiction.type === "school") && c.kind === "candidate" },
  { title: "City", test: (c) => c.level === "city" && c.kind === "candidate" },
  { title: "Special districts", test: (c) => c.level === "special" && c.kind === "candidate" },
  { title: "State measures", test: (c) => c.level === "state" && c.kind === "measure" },
  { title: "County measures", test: (c) => c.level === "county" && c.kind === "measure" },
  { title: "Local measures", test: (c) => c.kind === "measure" },
]

export default function Results({ bundle, profile, precinct, onEditQuiz, onEditAddress }: Props) {
  const dims = useMemo(() => Object.fromEntries(bundle.dimensions.map((d) => [d.id, d])), [bundle])
  const contests = useMemo(() => contestsFor(bundle.contests, precinct.attrs), [bundle, precinct])

  const sections = useMemo(() => {
    const seen = new Set<string>()
    return SECTIONS.map((s) => {
      const list = contests.filter((c) => !seen.has(c.id) && s.test(c))
      list.forEach((c) => seen.add(c.id))
      return { title: s.title, list }
    }).filter((s) => s.list.length > 0)
  }, [contests])

  return (
    <>
      <section className="card">
        <div className="bar">Your matches</div>
        <div className="body">
          <p>
            {contests.length} contests for <strong>{precinct.address}</strong>
            {precinct.attrs.PRECINCT ? <span className="meta"> · precinct {String(precinct.attrs.PRECINCT)}</span> : null}
          </p>
          <div className="legend">
            <span>
              <span className="oval filled" /> best match for your answers
            </span>
            <span>
              <span className="oval half" /> toss-up
            </span>
            <span>
              <span className="oval" /> no match
            </span>
          </div>
          <p className="meta" style={{ marginTop: 10 }}>
            Some contests may not be listed. Compare with your official sample ballot at{" "}
            <a href="https://www.lavote.gov/isb" target="_blank" rel="noreferrer">
              lavote.gov
            </a>
            .
          </p>
          <div className="btns">
            <button className="btn" onClick={onEditQuiz}>
              Change answers
            </button>
            <button className="btn" onClick={onEditAddress}>
              Change address
            </button>
            <button className="btn" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>
      </section>

      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="section-title">{s.title}</h2>
          {s.list.map((c) => (
            <ContestCard key={c.id} contest={c} profile={profile} dims={dims} />
          ))}
        </section>
      ))}
    </>
  )
}

function ContestCard({ contest: c, profile, dims }: { contest: Contest; profile: Profile; dims: Record<string, Dimension> }) {
  const result = useMemo(() => {
    if (c.kind === "measure") {
      const m = c.measureScores ? matchMeasure(profile, c.measureScores) : null
      return { measure: m, rec: m ? recommendMeasure(m) : ({ kind: "not-enough-info" } as Recommendation) }
    }
    if (c.kind === "candidate") {
      const matches = c.options.map((o) => matchCandidate(profile, o.scores ?? {}, o.id))
      return { matches, rec: recommendCandidate(matches, c.voteFor) }
    }
    return { rec: { kind: "not-enough-info" } as Recommendation }
  }, [c, profile])

  const rec = result.rec
  const picked = new Set(rec.kind === "pick" ? rec.optionIds : [])
  const tossed = new Set(rec.kind === "toss-up" ? rec.optionIds : [])
  const byId = Object.fromEntries((result.matches ?? []).map((m) => [m.optionId, m]))
  const name = (id: string) => c.options.find((o) => o.id === id)?.name ?? id

  return (
    <article className="card">
      <div className="bar">{c.title}</div>
      <div className="subbar">
        {c.jurisdiction.name}
        {c.kind !== "measure" && <> · Vote for {c.voteFor === 1 ? "one" : c.voteFor}</>}
      </div>
      {c.summary && (
        <div className="body">
          <p style={{ margin: 0, fontSize: 14 }}>{c.summary}</p>
        </div>
      )}

      {c.options.map((o) => {
        const m = byId[o.id]
        return (
          <div key={o.id} className="row">
            <span className={`oval${picked.has(o.id) ? " filled" : tossed.has(o.id) ? " half" : ""}`} aria-hidden />
            <span>
              <span className="name">{o.name}</span>
              {picked.has(o.id) && <span className="tag match">Best match</span>}
              {tossed.has(o.id) && <span className="tag">Toss-up</span>}
              <br />
              <span className="meta">
                {[o.party, o.ballotDesignation].filter(Boolean).join(" · ")}
                {m && m.coverage > 0 && (
                  <>
                    {(o.party || o.ballotDesignation) && " · "}
                    {Math.round(m.alignment * 100)}% aligned on {m.byDimension.length} of your issues
                  </>
                )}
              </span>
            </span>
          </div>
        )
      })}

      <Verdict contest={c} rec={rec} name={name} measure={result.measure} />

      {(c.kind === "candidate" || c.kind === "measure") && (
        <details>
          <summary>Why, and sources</summary>
          <div className="inner">
            {c.kind === "measure" && result.measure && <MeasureWhy m={result.measure} profile={profile} dims={dims} />}
            {c.kind === "candidate" && <CandidateWhy contest={c} matches={result.matches!} profile={profile} dims={dims} />}
            <Sources contest={c} />
          </div>
        </details>
      )}
    </article>
  )
}

function Verdict({ contest: c, rec, name, measure }: { contest: Contest; rec: Recommendation; name: (id: string) => string; measure?: MeasureMatch | null }) {
  if (c.kind === "retention") {
    return (
      <div className="verdict muted">
        No match. Judges facing retention votes don&apos;t campaign on policy positions. See the State Bar&apos;s evaluations
        and the official voter guide.
      </div>
    )
  }
  if (rec.kind === "pick") {
    const label = c.kind === "measure" ? `${rec.optionIds[0].toUpperCase()}` : rec.optionIds.map(name).join(", ")
    return (
      <div className="verdict">
        Best match for your answers: <strong>{label}</strong>
        {measure && <span className="meta"> · lean {Math.round(Math.abs(measure.lean) * 100)}%</span>}
      </div>
    )
  }
  if (rec.kind === "toss-up") {
    return (
      <div className="verdict">
        Toss-up: {c.kind === "measure" ? "this measure pulls both ways on your issues" : `${rec.optionIds.map(name).join(" and ")} match you about equally`}.
      </div>
    )
  }
  return (
    <div className="verdict muted">
      {c.kind === "measure"
        ? "This measure doesn't clearly touch the issues you rated as important. Read the summary and decide."
        : "Not enough public information on these candidates' positions to match them to your answers."}
    </div>
  )
}

function Strip({ dim, you, them, themLabel }: { dim: Dimension; you: number; them: number; themLabel: string }) {
  const pct = (v: number) => `${((v + 1) / 2) * 100}%`
  return (
    <div className="strip">
      <div className="label">{dim.label}</div>
      <div className="track">
        <span className="dot you" style={{ left: pct(you) }} title="You" />
        <span className="dot them" style={{ left: pct(them) }} title={themLabel} />
      </div>
      <div className="ends">
        <span>{dim.minus}</span>
        <span>{dim.plus}</span>
      </div>
    </div>
  )
}

function CandidateWhy({ contest, matches, profile, dims }: { contest: Contest; matches: CandidateMatch[]; profile: Profile; dims: Record<string, Dimension> }) {
  return (
    <>
      <div className="legend" style={{ marginBottom: 8 }}>
        <span>
          <span className="strip">
            <span className="dot you" style={{ position: "static", display: "inline-block", transform: "none" }} />
          </span>
          You
        </span>
        <span>
          <span className="dot them" style={{ position: "static", display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: "var(--ink)" }} />
          Candidate
        </span>
      </div>
      {contest.options.map((o) => {
        const m = matches.find((x) => x.optionId === o.id)
        const top = (m?.byDimension ?? []).slice(0, 4)
        return (
          <div key={o.id} style={{ marginBottom: 16 }}>
            <div className="name">{o.name}</div>
            {top.length === 0 && <p className="meta">No positions found on the issues you rated.</p>}
            {top.map((d) => (
              <Strip key={d.dimension} dim={dims[d.dimension]} you={profile[d.dimension].position} them={o.scores![d.dimension].position} themLabel={o.name} />
            ))}
            {o.evidence && o.evidence.length > 0 && (
              <ul>
                {o.evidence.map((e, i) => (
                  <li key={i}>
                    {e.text}{" "}
                    <a href={e.url} target="_blank" rel="noreferrer">
                      {e.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </>
  )
}

function MeasureWhy({ m, profile, dims }: { m: MeasureMatch; profile: Profile; dims: Record<string, Dimension> }) {
  if (m.byDimension.length === 0) return <p className="meta">This measure doesn&apos;t map onto the quiz issues.</p>
  return (
    <ul style={{ marginBottom: 12 }}>
      {m.byDimension.slice(0, 4).map((d) => {
        const dim = dims[d.dimension]
        const you = profile[d.dimension].position
        return (
          <li key={d.dimension}>
            <strong>{dim.label}:</strong> {d.agreement > 0.05 ? "A YES vote moves in your direction" : d.agreement < -0.05 ? "A YES vote moves away from your view" : "Roughly neutral for you"}
            {" "}
            <span className="meta">(you lean {you < -0.15 ? `toward “${dim.minus}”` : you > 0.15 ? `toward “${dim.plus}”` : "neither way"})</span>
          </li>
        )
      })}
    </ul>
  )
}

function Sources({ contest }: { contest: Contest }) {
  if (!contest.sources.length) return null
  return (
    <p className="meta" style={{ marginTop: 8 }}>
      Contest sources:{" "}
      {contest.sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && " · "}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.title}
          </a>
        </span>
      ))}
    </p>
  )
}
