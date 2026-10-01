"use client"

import { useEffect, useMemo, useState } from "react"
import type { Bundle } from "@/lib/bundle"
import type { PrecinctAttributes } from "@/lib/districts"
import { buildProfile, type QuizResponse } from "@/lib/match"
import Quiz from "./Quiz"
import AddressStep from "./AddressStep"
import Results from "./Results"

type Step = "intro" | "quiz" | "address" | "results"

export default function App() {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [step, setStep] = useState<Step>("intro")
  const [response, setResponse] = useState<QuizResponse>({ answers: {}, importance: {} })
  const [precinct, setPrecinct] = useState<{ attrs: PrecinctAttributes; address: string } | null>(null)

  const profile = useMemo(() => (bundle ? buildProfile(bundle.quiz.items, response) : {}), [bundle, response])

  useEffect(() => {
    fetch("/data/ballot.json")
      .then((r) => r.json())
      .then(setBundle)
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  return (
    <main className="wrap">
      <header className="masthead">
        <h1>LA Ballot Match</h1>
        <p>November 3, 2026 General Election · Los Angeles County</p>
        <nav className="nav">
          <a href="/how-it-works">How it works</a>
          <a href="/contact">Report a problem</a>
        </nav>
      </header>

      {loadError && <p className="error">Couldn&apos;t load ballot data. Refresh to try again.</p>}

      {step === "intro" && (
        <section className="card">
          <div className="bar">How this works</div>
          <div className="body">
            <p>
              <strong>1. Take a short quiz</strong>{" "}about where you stand on {bundle?.dimensions.length ?? 14} issues and how
              much each one matters to you.
            </p>
            <p>
              <strong>2. Enter your address</strong>{" "}so the site can find the contests on your ballot.
            </p>
            <p>
              <strong>3. See your matches.</strong>{" "}For each contest, the site shows which choice best lines up with your answers,
              based on the candidates&apos; own statements and records and the official text of each measure. Every match
              links to its sources.
            </p>
            <p className="meta">
              Your answers and address stay in your browser and are never stored. The address is sent once to LA County&apos;s
              address locator (through this site&apos;s server, without logging) to find your location. This is a tool for thinking
              things through, not an instruction on how to vote. Where there isn&apos;t enough information, it says so.
            </p>
            <div className="btns">
              <button className="btn primary" disabled={!bundle} onClick={() => setStep("quiz")}>
                Start the quiz
              </button>
            </div>
          </div>
        </section>
      )}

      {step === "quiz" && bundle && (
        <Quiz
          bundle={bundle}
          response={response}
          onChange={setResponse}
          onBack={() => setStep("intro")}
          onDone={() => setStep("address")}
        />
      )}

      {step === "address" && (
        <AddressStep
          onBack={() => setStep("quiz")}
          onDone={(attrs, address) => {
            setPrecinct({ attrs, address })
            setStep("results")
          }}
        />
      )}

      {step === "results" && bundle && precinct && (
        <Results
          bundle={bundle}
          profile={profile}
          precinct={precinct}
          onEditQuiz={() => setStep("quiz")}
          onEditAddress={() => setStep("address")}
        />
      )}

      <footer>
        Built by an LA County voter. Candidate positions are compiled from public statements, voting records, and
        questionnaires, then placed on each issue by a language model, so they can be wrong. Always check the official{" "}
        <a href="https://www.lavote.gov/" target="_blank" rel="noreferrer">
          lavote.gov
        </a>{" "}
        sample ballot and voter information guides. Found a problem?{" "}
        <a href="/contact">Let me know</a>.
      </footer>
    </main>
  )
}
