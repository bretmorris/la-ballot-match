# Candidate evidence

One file per candidate contest: `data/evidence/<contestId>.json` (contestId from `data/contests/*.json`).

```ts
type EvidenceFile = {
  contestId: string
  options: Record<string, EvidenceItem[]>   // key = option id from the contest file
  notes?: string                            // e.g. "No public positions found for jane-doe"
}
type EvidenceItem = {
  text: string      // ≤ 60 words: a direct quote, or a close factual paraphrase, of the candidate's OWN position/vote/action
  kind: "own-statement" | "voting-record" | "official-action" | "endorsement" | "questionnaire"
  dimension?: string  // optional hint: an id from data/dimensions.json
  source: { url: string; title: string; retrieved: string }   // retrieved = "YYYY-MM-DD"
}
```

The scoring dimensions are in `data/dimensions.json`. Aim for evidence touching as many of them as the
candidate has actually addressed — typically 6–15 items per candidate.

Rules:
- Every item must come from a page you actually fetched; quote or paraphrase it faithfully. Never fill from memory.
- Good sources: candidate's campaign site (issues page), official legislative vote records (leginfo.legislature.ca.gov,
  congress.gov, govtrack), CalMatters / LAist / Ballotpedia / Vote Smart candidate questionnaires, League of Women
  Voters Votes411, reputable news reporting of what the candidate said or did.
- Record what the candidate said or did — not a journalist's or opponent's characterization of them.
- Endorsements: only notable, issue-signaling ones (e.g. unions, police associations, Sierra Club, NRA, Planned
  Parenthood, CA YIMBY, Howard Jarvis Taxpayers Assn), stated as "Endorsed by X".
- Treat both candidates in a contest with equal effort. If a candidate has no findable positions, give an empty
  array and say so in `notes` — do not pad.
- Validate JSON: `node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" <file>`.
