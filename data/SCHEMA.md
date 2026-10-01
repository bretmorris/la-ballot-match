# Data schema

All contest files live in `data/contests/*.json`. Each file is a JSON array of `Contest`.

```ts
type Source = { url: string; title: string; retrieved: string } // retrieved = "YYYY-MM-DD"

type Contest = {
  id: string                 // stable kebab id, e.g. "ca-governor", "us-house-ca-34", "la-city-measure-ulA"
  title: string              // as printed on the ballot, e.g. "Governor", "United States Representative, 34th District"
  level: "federal" | "state" | "county" | "city" | "school" | "special" | "judicial"
  jurisdiction: {
    type: "statewide" | "county" | "congressional" | "state-senate" | "assembly"
        | "board-of-equalization" | "supervisorial" | "city" | "city-council"
        | "school" | "community-college" | "special" | "judicial"
    district: string | null  // "34", "3", null for at-large/statewide/countywide
    name: string             // "California", "Los Angeles County", "City of Los Angeles", "LAUSD Board District 3"
  }
  kind: "candidate" | "measure" | "retention"
  voteFor: number            // seats / "vote for N"; 1 for measures
  summary?: string           // measures: neutral 1–3 sentence summary of what YES does (from official sources)
  options: Option[]          // candidates, or for measures exactly [{id:"yes",name:"Yes"},{id:"no",name:"No"}]
  notes?: string             // anything uncertain, e.g. "candidate list not yet certified"
  sources: Source[]          // official sources first (sos.ca.gov, lavote.gov, city clerk), then others
}

type Option = {
  id: string                 // kebab of name, e.g. "jane-doe"; "yes"/"no" for measures
  name: string
  party?: string | null      // as on ballot: "Democratic", "Republican", "No Party Preference", ... null if nonpartisan
  ballotDesignation?: string // occupation designation printed on ballot
  incumbent?: boolean
  website?: string           // official campaign site, if readily found
}
```

Rules:
- Only include facts verified from a source fetched during research. Never fill from memory.
- If something is not yet certified or can't be found, include what is verified and explain in `notes`.
- Keep descriptions neutral; no editorializing.
