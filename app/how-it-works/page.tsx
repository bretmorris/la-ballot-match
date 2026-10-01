import type { Metadata } from "next"
import Link from "next/link"
import dimensions from "@/data/dimensions.json"
import quiz from "@/data/quiz.json"
import * as J from "@/lib/jev-questions"
import { MIN_CANDIDATE_MARGIN, MIN_EVIDENCE_WEIGHT, MIN_MEASURE_LEAN, MIN_MEASURE_RELEVANCE } from "@/lib/match"

export const metadata: Metadata = { title: "How it works — LA Ballot Match" }

export default function HowItWorks() {
  const example = dimensions.find((d) => d.id === "housing-growth") ?? dimensions[0]
  return (
    <main className="wrap">
      <header className="masthead">
        <h1>How it works</h1>
        <p>
          <Link href="/">← Back to LA Ballot Match</Link>
        </p>
      </header>

      <section className="card">
        <div className="bar">In short</div>
        <div className="body prose">
          <p>
            You answer {quiz.items.length} statements about {dimensions.length} issues and say how much each issue matters to
            you. We look up the contests on your ballot from your address. Ahead of time, we collected what each
            candidate has said and done, with links, and used an AI model called <strong>Jev</strong> to place every
            candidate and measure on the same {dimensions.length} issues. Your browser then compares your answers to those
            placements with simple arithmetic and shows the closest match in each contest, or says there isn&apos;t enough
            information.
          </p>
          <p>
            This is a tool for thinking through your ballot. It is not voting advice, and it can be wrong. Every match
            shows its reasoning and sources so you can check it.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="bar">1. The quiz</div>
        <div className="body prose">
          <p>
            Each issue has two statements, written so that agreeing with one points the opposite way from agreeing with
            the other. This reduces the bias toward agreeing with whatever you read. Your answers (strongly disagree to
            strongly agree) average into a position from −1 to +1 on each issue. Your importance answer (0–3) sets that
            issue&apos;s weight. Issues you mark &quot;doesn&apos;t matter to me&quot; are ignored.
          </p>
          <p>The issues and the two ends of each:</p>
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>One end (−1)</th>
                <th>Other end (+1)</th>
              </tr>
            </thead>
            <tbody>
              {dimensions.map((d) => (
                <tr key={d.id}>
                  <td>{d.label}</td>
                  <td>{d.minus}</td>
                  <td>{d.plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="meta">
            The ends are labeled by policy, not by party. Many people mix positions across issues, and so do many
            candidates.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="bar">2. Finding your ballot</div>
        <div className="body prose">
          <p>
            Your address is sent once, inside the body of a request to our server, which passes it to the{" "}
            <a href="https://geocoding.geo.census.gov/" target="_blank" rel="noreferrer">
              US Census Bureau geocoder
            </a>{" "}
            to get latitude and longitude. (The Census service doesn&apos;t accept requests directly from browsers.) Our
            server doesn&apos;t store or log the address. You confirm the matched address, and then your browser sends only the
            coordinates to LA County Registrar-Recorder/County Clerk&apos;s public precinct map service. That service
            returns your precinct and every district it belongs to: congressional, state legislative, supervisorial, city
            council, school and college trustee areas, water and other special districts. Those districts determine
            which contests you see.
          </p>
          <p>
            Contest and candidate lists come from the California Secretary of State&apos;s certified list of candidates,
            the official state voter information guide, and the RR/CC&apos;s final lists of qualified candidates and
            measures for this election. Each contest links to its sources. Local district names were matched to county
            district codes partly with Jev and partly by hand. If a contest is missing or wrong for you, please{" "}
            <Link href="/contact">tell me</Link>.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="bar">3. What candidates have said and done</div>
        <div className="body prose">
          <p>
            For each candidate, AI research assistants (Claude, made by Anthropic) searched for the candidate&apos;s own
            words and actions: campaign issue pages, voting records, candidate questionnaires (CalMatters, League of
            Women Voters, local groups), reporting on what the candidate said, and issue-signaling endorsements. They
            were told to record only what the candidate said or did, not how others described them, to give each
            candidate in a race equal effort, and to leave a candidate blank rather than guess. Every item is a short
            quote or close paraphrase with a link, and you can read them all under &quot;Why, and sources&quot; on each
            contest.
          </p>
          <p>
            These notes have not been individually checked by a person. Coverage is uneven: incumbents
            and well-funded campaigns leave more of a record than first-time or local candidates, and some candidates
            have no public positions at all. Measures are evaluated from their official title and summary.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="bar">4. Placing candidates on issues with Jev</div>
        <div className="body prose">
          <p>
            <a href="https://typesafe.ai" target="_blank" rel="noreferrer">
              Jev
            </a>{" "}
            is a &quot;System One&quot; model from TypeSafe. It doesn&apos;t write text. It answers narrowly defined questions with
            probabilities. We use version <code>{J.JEV_MODEL}</code>. For each candidate and each issue, Jev receives the
            candidate&apos;s name, party, ballot designation and the collected notes, and answers two questions. Here are
            the exact questions for the &quot;{example.label}&quot; issue:
          </p>
          <p>
            <strong>Position</strong> (a score across five levels):
          </p>
          <pre>
            {J.candidatePositionInstructions(example)}
            {"\n\n"}
            {J.positionLevels(example)
              .map((l, i) => `${i}. ${l}`)
              .join("\n")}
          </pre>
          <p>
            <strong>Is there evidence?</strong> (a yes/no probability):
          </p>
          <pre>{J.candidateEvidenceInstructions(example)}</pre>
          <p>
            Jev returns a probability for each level. We use the probability-weighted average as the candidate&apos;s
            position (−1 to +1), and the yes-probability of the second question as how much evidence there is. An
            issue with no evidence counts for nothing, even if a party label might suggest a position.
          </p>
          <p>For measures, the questions ask which way a YES vote moves policy, and whether the measure touches the issue at all:</p>
          <pre>
            {J.measureDirectionInstructions(example)}
            {"\n\n"}
            {J.directionLevels(example)
              .map((l, i) => `${i}. ${l}`)
              .join("\n")}
            {"\n\n"}
            {J.measureRelevanceInstructions(example)}
          </pre>
          <p>
            All of this runs once, before the site is published, and the results ship with the site. No AI model runs
            while you use it, and your answers never reach one.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="bar">5. The match</div>
        <div className="body prose">
          <p>
            <strong>Candidates.</strong> On each issue where a candidate has evidence, closeness is 1 − |your position −
            their position| ÷ 2, from 0 (opposite ends) to 1 (identical). A candidate&apos;s alignment is the average closeness,
            weighted by how much you care about each issue × how much evidence there is. We only compare candidates
            whose evidence adds up to at least {MIN_EVIDENCE_WEIGHT} (importance × evidence, about two issues you care
            about). If the top two are within {Math.round(MIN_CANDIDATE_MARGIN * 100)} points, we call it a toss-up.
          </p>
          <p>
            <strong>Measures.</strong> For each issue, your position × the direction of a YES vote shows whether YES
            moves toward you or away, weighted by importance × relevance. If the measure barely touches the issues you
            care about (weight under {MIN_MEASURE_RELEVANCE}), or the overall lean is under{" "}
            {Math.round(MIN_MEASURE_LEAN * 100)}%, we don&apos;t pick a side.
          </p>
          <p>
            <strong>Known limits.</strong> Two candidates can be compared on different sets of issues. An incumbent
            with a long voting record may be placed on ten issues and a challenger on two. The &quot;Why&quot; panel shows
            which issues each comparison used. Jev sees each candidate&apos;s party label alongside the evidence. It
            can&apos;t place anyone on an issue from party alone, but on issues with thin evidence the label may still
            nudge the placement.
          </p>
          <p>
            <strong>What we don&apos;t do.</strong> The match itself never uses party. We make no recommendation in judicial retention
            elections, because judges don&apos;t campaign on policy. We don&apos;t weigh experience, character, competence,
            or anything else outside the quiz, and those may matter more to you.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="bar">Privacy</div>
        <div className="body prose">
          <p>
            There are no accounts, cookies, analytics or ads. Your quiz answers never leave your browser. Your address
            is sent to our server once, only to get coordinates, and isn&apos;t stored. Our host (Vercel) keeps standard
            request logs (such as IP address and the page requested), but the address travels in the request body,
            which isn&apos;t logged. Messages sent through the contact form are delivered by email (via Resend) and used only
            to reply and fix problems.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="bar">Problems or questions</div>
        <div className="body prose">
          <p>
            This is a brand-new, independent project, and some things will be wrong. Please{" "}
            <Link href="/contact">report anything that looks off</Link>, whether it&apos;s a broken address, a missing
            contest, or a candidate placed in the wrong spot. Every message is read by a person.
          </p>
        </div>
      </section>
    </main>
  )
}
