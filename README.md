# LA Ballot Match

A nonpartisan tool that helps Los Angeles County voters see how the contests on their
**November 3, 2026 General Election** ballot line up with their own stated political views.

Not affiliated with the LA County Registrar-Recorder/County Clerk, any candidate, campaign,
or party. Results show alignment with a voter's quiz answers — they are not instructions
on how to vote.

The code and data are open source (MIT) so anyone can check how matches are made, and so people in
other places can adapt it for their own elections. See [Adapting this for your election](#adapting-this-for-your-election).

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

Copy `.env.example` to `.env.local`. The site runs with no env vars at all using the data already in `data/`.
`TYPESAFE_API_KEY` is only used by `scripts/`; the `RESEND_*`/`CONTACT_*` vars enable the contact form.

## Adapting this for your election

Forks are welcome. Expect the data to be most of the work. The code is fairly small; researching every
contest and candidate is the hard part.

**Portable as-is (mostly):**

- `lib/match.ts`: the matching math and thresholds. Covered by `npm test`.
- `lib/jev-questions.ts`, `scripts/score.ts`: the Jev questions and the offline scoring run. Needs your own
  `TYPESAFE_API_KEY`. Responses are cached in `scripts/.cache`.
- `scripts/build-bundle.ts`: merges contests, evidence and scores into `public/data/ballot.json`.
- `data/dimensions.json`, `data/quiz.json`: the issues and quiz statements. Reasonable for most US elections,
  but review them for your area's issues.
- `components/`, `app/`: the UI, apart from the place names below.
- `scripts/check-evidence.ts`: spot-checks that evidence quotes appear on their source pages.

**Specific to LA County, so you'll need to replace it:**

- **Address → districts.** `app/api/geocode/route.ts` uses LA County's CAMS geocoder (falling back to the US
  Census geocoder, which works nationwide). `lib/districts.ts` queries the LA County RR/CC precinct layer
  and maps its `DIST_*`/`DST_*`/`DIV_*` fields to contests. Your county may publish a similar precinct or
  district GIS layer. If not, the Census geocoder returns congressional and state legislative districts but
  not most local ones. `data/research/address-lookup.md` records how the LA source was found and checked.
- **Local contest mapping.** `scripts/fetch-rrcc-values.ts`, `scripts/map-local.ts`, `data/research/rrcc/`
  and `data/research/rrcc-overrides.json` link local contests to RR/CC district codes.
- **All contest data.** `data/contests/`, `data/evidence/` and `data/scores/`. Formats are in
  `data/SCHEMA.md` and `data/EVIDENCE.md`, including the sourcing rules. Evidence here was gathered by AI
  research assistants following `data/EVIDENCE.md`, so treat it as a starting point that needs checking.
- **Names and dates.** "LA Ballot Match", "November 3, 2026" and "Los Angeles County" appear in
  `components/App.tsx`, `app/layout.tsx`, `app/how-it-works/page.tsx` and `app/opengraph-image.tsx`, along with
  links to lavote.gov. `scripts/check-addresses.ts` has LA sample addresses.
- **Your own contact details.** The contact form emails whoever is in `CONTACT_TO_EMAIL`, and the copy is in
  first person. Update it so reports reach you.

`@vercel/analytics` is optional; remove `<Analytics />` from `app/layout.tsx` if you don't deploy to Vercel.

If you build something with this, or fix something that would help the original, issues and pull requests
are welcome.

## License

[MIT](LICENSE). Evidence items are short quotes or paraphrases of public statements and records, each linked
to its source.
