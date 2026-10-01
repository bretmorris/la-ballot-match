# LA Ballot Match

A nonpartisan tool that helps Los Angeles County voters see how the contests on their
**November 3, 2026 General Election** ballot line up with their own stated political views.

Not affiliated with the LA County Registrar-Recorder/County Clerk, any candidate, campaign,
or party. Results show alignment with a voter's quiz answers — they are not instructions
on how to vote.

## How it works

1. **Ideology quiz.** The voter answers a broad, balanced set of questions. Answers map to
   a position and an importance weight on ~10 issue dimensions (see `data/dimensions.json`).
2. **Ballot lookup.** The voter's districts (Congressional, State Senate, Assembly,
   Supervisorial, city, school, etc.) determine which contests appear on their ballot.
3. **Matching.** Each candidate and measure has precomputed scores on the same dimensions.
   Code computes a weighted alignment between the voter and each option and shows the best
   match per contest, with the reasoning and sources behind it.

## Where Jev (TypeSafe) fits

Jev runs **offline, once**, in `scripts/` — never per visitor:

- Each candidate/measure's sourced position statements are scored on every issue dimension
  with Jev `Score` questions (and `Noul` for "is there enough evidence to place this
  option on this dimension?").
- Results are written to `data/` as JSON with the source URLs and retrieval dates.
- The deployed site does pure arithmetic over that data. No API key is deployed, and no
  per-visitor model calls are made.

Contests or dimensions with thin evidence (e.g. judicial races) are reported as
**"not enough information"** rather than guessed.

## Privacy

Quiz answers and addresses are never stored or logged server-side. Matching runs in the
browser.

## Scope

Every contest on LA County ballots for Nov 3, 2026: statewide offices and propositions,
county offices and measures, Congress, State Senate, Assembly, city offices and measures,
and school/special districts.

## Layout

```
app/        Next.js App Router UI (quiz, ballot, results)
lib/        Pure matching logic (unit-tested with vitest)
data/       Dimensions, quiz, contests, candidates, scores (JSON, sourced)
scripts/    Offline research + Jev scoring pipeline (needs TYPESAFE_API_KEY locally)
```

## Development

```
nvm use          # Node 22
npm install
npm run dev
npm test
```

`TYPESAFE_API_KEY` goes in `.env.local` and is only used by `scripts/`.
