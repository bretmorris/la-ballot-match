// Shape of public/data/ballot.json (built by scripts/build-bundle.ts).

import type { Jurisdiction, RrccMatch } from "./districts"
import type { CandidateScores, MeasureScores, QuizItem } from "./match"

export type Dimension = { id: string; label: string; minus: string; plus: string }

export type Option = {
  id: string
  name: string
  party?: string | null
  ballotDesignation?: string
  incumbent?: boolean
  scores?: CandidateScores
  evidence?: { text: string; url: string; title: string }[]
}

export type Contest = {
  id: string
  title: string
  level: "federal" | "state" | "county" | "city" | "school" | "special" | "judicial"
  jurisdiction: Jurisdiction
  kind: "candidate" | "measure" | "retention"
  voteFor: number
  summary?: string
  notes?: string
  rrcc?: RrccMatch[]
  sources: { url: string; title: string }[]
  options: Option[]
  measureScores?: MeasureScores
}

export type Bundle = {
  election: string
  builtAt: string
  dimensions: Dimension[]
  quiz: {
    scale: { value: number; label: string }[]
    importance: { value: number; label: string }[]
    items: (QuizItem & { text: string; learnMore?: { url: string; title: string } })[]
  }
  contests: Contest[]
}
