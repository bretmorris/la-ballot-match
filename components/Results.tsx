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
  MIN_EVIDENCE_WEIGHT,
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
      <div className="screen-only">
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
                <span className="oval lean" /> slight lean
              </span>
              <span>
                <span className="oval half" /> toss-up
              </span>
              <span>
                <span className="oval" /> no match
              </span>
            </div>
            <p className="meta" style={{ marginTop: 10 }}>
              New tool, so expect some rough edges. If something&apos;s missing or wrong,{" "}
              <a href="/contact" target="_blank" rel="noreferrer">
                report it
              </a>
              . Some contests may not be listed. Compare with your official sample ballot at{" "}
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
      </div>

      <PrintSheet sections={sections} profile={profile} precinct={precinct} />
    </>
  )
}

/** Compact summary used only when printing: each contest's match, in ballot order, to copy from. */
function PrintSheet({
  sections,
  profile,
  precinct,
}: {
  sections: { title: string; list: Contest[] }[]
  profile: Profile
  precinct: Props["precinct"]
}) {
  return (
    <div className="print-only print-sheet">
      <div className="print-head">
        <strong>LA Ballot Match · Nov 3, 2026</strong> · {precinct.address}
        {precinct.attrs.PRECINCT ? ` · precinct ${String(precinct.attrs.PRECINCT)}` : ""}
        <div>
          <span className="oval filled" /> best match for your answers <span className="oval lean" /> slight lean{" "}
          <span className="oval half" /> toss-up. Unofficial
          notes, not a ballot. Matches can be wrong; check your official sample ballot at lavote.gov.
        </div>
      </div>
      <div className="print-cols">
        {sections.map((s) => {
          const retention = s.list.filter((c) => c.kind === "retention")
          return (
            <section key={s.title}>
              <h2 className="print-section">{s.title}</h2>
              {s.list
                .filter((c) => c.kind !== "retention")
                .map((c) => (
                  <PrintContest key={c.id} contest={c} profile={profile} />
                ))}
              {retention.length > 0 && <PrintRetention contests={retention} />}
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** "Proposition 1: Authorizes Bonds…. Legislative Statute." → drop the trailing measure-type label. */
const shortTitle = (t: string) => t.replace(/\.\s+(Legislative|Initiative)\b[^.]*\.?$/, ".")

function PrintContest({ contest: c, profile }: { contest: Contest; profile: Profile }) {
  const { rec } = recommend(c, profile)
  const name = (id: string) => (c.kind === "measure" ? id.toUpperCase() : (c.options.find((o) => o.id === id)?.name ?? id))
  const picked = rec.kind === "pick" ? rec.optionIds : rec.kind === "toss-up" || rec.kind === "lean" ? (rec.alsoPick ?? []) : []
  const leaned = rec.kind === "lean" ? rec.optionIds : []
  const tossed = rec.kind === "toss-up" ? rec.optionIds : []
  // Statewide and countywide jurisdictions just repeat what the contest title already says.
  const showJurisdiction = !["federal", "state", "county", "judicial"].includes(c.level) && !c.title.includes(c.jurisdiction.name)

  return (
    <div className="print-contest">
      <div className="print-title">
        {shortTitle(c.title)}
        {c.kind !== "measure" && c.voteFor > 1 && <span className="meta"> · vote for {c.voteFor}</span>}
      </div>
      {showJurisdiction && <div className="meta">{c.jurisdiction.name}</div>}
      {picked.map((id) => (
        <div key={id} className="print-pick">
          <span className="oval filled" /> {name(id)}
        </div>
      ))}
      {leaned.map((id) => (
        <div key={id} className="print-pick">
          <span className="oval lean" /> {name(id)} <span className="meta">(slight lean)</span>
        </div>
      ))}
      {tossed.length > 0 && (
        <div className="print-pick">
          <span className="oval half" /> Toss-up: {list(tossed.map(name))}
        </div>
      )}
      {rec.kind === "uncontested" && <div className="meta">Uncontested</div>}
      {(rec.kind === "toss-up" || rec.kind === "not-enough-info") && (
        <div className="print-blank">{rec.kind === "not-enough-info" ? "No match (not enough info). Your choice:" : "Your choice:"}</div>
      )}
    </div>
  )
}

/** Retention votes have no match, so list the judges compactly with Yes/No ovals to mark by hand. */
function PrintRetention({ contests }: { contests: Contest[] }) {
  return (
    <div className="print-contest">
      <div className="print-title">Judges up for retention</div>
      <div className="meta">No match: judges don&apos;t campaign on policy. Mark your own choices.</div>
      {contests.map((c) => {
        const judge = c.title.match(/Shall (?:Associate |Presiding )?Justice (.+?) be elected/)?.[1] ?? c.title
        const court = c.title.split(":")[0].replace(/^(Associate|Presiding) Justice,?\s*(of the )?/, "")
          .replace(/ Second District, Division/, " Div.")
        return (
          <div key={c.id} className="print-retention">
            <span>
              <strong>{judge}</strong> <span className="meta">{court}</span>
            </span>
            <span className="print-yn">
              <span className="oval" /> Yes <span className="oval" /> No
            </span>
          </div>
        )
      })}
    </div>
  )
}

function recommend(c: Contest, profile: Profile): { rec: Recommendation; measure?: MeasureMatch | null; matches?: CandidateMatch[] } {
  if (c.kind === "measure") {
    const m = c.measureScores ? matchMeasure(profile, c.measureScores) : null
    return { measure: m, rec: m ? recommendMeasure(m) : { kind: "not-enough-info" } }
  }
  if (c.kind === "candidate") {
    const matches = c.options.map((o) => matchCandidate(profile, o.scores ?? {}, o.id))
    return { matches, rec: recommendCandidate(matches, c.voteFor) }
  }
  return { rec: { kind: "not-enough-info" } }
}

function ContestCard({ contest: c, profile, dims }: { contest: Contest; profile: Profile; dims: Record<string, Dimension> }) {
  const result = useMemo(() => recommend(c, profile), [c, profile])

  const rec = result.rec
  const picked = new Set(rec.kind === "pick" ? rec.optionIds : rec.kind === "toss-up" || rec.kind === "lean" ? (rec.alsoPick ?? []) : [])
  const leaned = new Set(rec.kind === "lean" ? rec.optionIds : [])
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
            <span className={`oval${picked.has(o.id) ? " filled" : leaned.has(o.id) ? " lean" : tossed.has(o.id) ? " half" : ""}`} aria-hidden />
            <span>
              <span className="name">{o.name}</span>
              {picked.has(o.id) && <span className="tag match">Best match</span>}
              {leaned.has(o.id) && <span className="tag match">Slight lean</span>}
              {tossed.has(o.id) && <span className="tag">Toss-up</span>}
              <br />
              <span className="meta">
                {[o.party, o.ballotDesignation].filter(Boolean).join(" · ")}
                {m && m.evidenceWeight >= MIN_EVIDENCE_WEIGHT && (
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

      <Verdict contest={c} rec={rec} name={name} measure={result.measure} profile={profile} dims={dims} />

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
      <a className="report" href={`/contact?contest=${encodeURIComponent(c.id)}`} target="_blank" rel="noreferrer">
        Something wrong here? Report it
      </a>
    </article>
  )
}

/** "A", "A and B", "A, B, and C" */
const list = (xs: string[]) => new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(xs)
/** Lowercase the first letter only, so "Abortion & LGBTQ+ rights" stays readable mid-sentence. */
const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function measureTossUpReason(m: MeasureMatch | null | undefined, profile: Profile, dims: Record<string, Dimension>): string {
  const top = m?.byDimension[0]
  if (top && Math.abs(profile[top.dimension]?.position ?? 0) < 0.15) {
    return `your quiz answers on ${lcFirst(dims[top.dimension].label)}, the main issue here, were balanced between the two sides`
  }
  return "this measure pulls both ways on the issues you care about"
}

function Verdict({
  contest: c,
  rec,
  name,
  measure,
  profile,
  dims,
}: {
  contest: Contest
  rec: Recommendation
  name: (id: string) => string
  measure?: MeasureMatch | null
  profile: Profile
  dims: Record<string, Dimension>
}) {
  if (c.kind === "retention") {
    return (
      <div className="verdict muted">
        No match. Judges facing retention votes don&apos;t campaign on policy positions. See the State Bar&apos;s evaluations
        and the official voter guide.
      </div>
    )
  }
  if (rec.kind === "pick") {
    const label = c.kind === "measure" ? `${rec.optionIds[0].toUpperCase()}` : list(rec.optionIds.map(name))
    return (
      <div className="verdict">
        Best match for your answers: <strong>{label}</strong>
        {measure && <span className="meta"> · lean {Math.round(Math.abs(measure.lean) * 100)}%</span>}
      </div>
    )
  }
  if (rec.kind === "lean") {
    const label = c.kind === "measure" ? rec.optionIds[0].toUpperCase() : list(rec.optionIds.map(name))
    return (
      <div className="verdict">
        {rec.alsoPick?.length ? (
          <>
            Best match for your answers: <strong>{list(rec.alsoPick.map(name))}</strong>. For the remaining seat
            {rec.optionIds.length > 1 ? "s" : ""}, a slight lean toward <strong>{label}</strong>.
          </>
        ) : (
          <>
            Slight lean for your answers: <strong>{label}</strong>
          </>
        )}
        {measure && <span className="meta"> · lean {Math.round(Math.abs(measure.lean) * 100)}%</span>}
        <span className="meta"> · It&apos;s close, so check the details.</span>
      </div>
    )
  }
  if (rec.kind === "toss-up") {
    return (
      <div className="verdict">
        {rec.alsoPick?.length ? (
          <>
            Best match for your answers: <strong>{list(rec.alsoPick.map(name))}</strong>. For the remaining seat
            {c.voteFor - rec.alsoPick.length > 1 ? "s" : ""}, it&apos;s a toss-up among {list(rec.optionIds.map(name))}.
          </>
        ) : (
          <>
            Toss-up:{" "}
            {c.kind === "measure"
              ? measureTossUpReason(measure, profile, dims)
              : `${list(rec.optionIds.map(name))} match you about equally`}
            .
          </>
        )}
      </div>
    )
  }
  if (rec.kind === "uncontested") {
    return <div className="verdict muted">Uncontested: there are no more candidates than seats, so there&apos;s nothing to compare.</div>
  }
  const someScored = rec.unscored && rec.unscored.length < c.options.length
  return (
    <div className="verdict muted">
      {c.kind === "measure"
        ? "This measure doesn't clearly touch the issues you rated as important. Read the summary and decide."
        : someScored
          ? `Not enough public information on ${list(rec.unscored!.map(name))} to compare all the candidates fairly. See "Why, and sources" for what was found.`
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
