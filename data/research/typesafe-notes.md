# TypeSafe / Jev implementation notes (offline scoring script)

Source: live docs at https://docs.typesafe.ai (index `llms.txt`, pages fetched as `.md`), read 2026-09-30. JS SDK `@typesafe-ai/sdk` v0.6.0 (installed from npm into a scratch dir; the example below type-checks with `tsc --strict` and its wire format was verified against a mock `fetch`; no real API call was made).

Pages read: introduction, quickstart, coding-agents, concepts/system-one, concepts/how-to-build-with-system-one, concepts/state, primitives (+score, noul, choice, advanced), confidence, api, models, model-jaggedness/jev-1.13, sdk/javascript (+changelog, all `sdk/javascript/api/*` pages relevant to calls/errors/retries), patterns/composite-scoring, patterns/fan-out, patterns/confidence-routing, agent-skill (+ upstream SKILL.md), cookbooks: parallel_questions, semantic_find, entity_alignment, classifying_rag_passages (skimmed), citation_check/rerank (skimmed via index).

---

## 1. Package, client, auth

```sh
npm install @typesafe-ai/sdk        # Node.js >= 20; ESM + CJS + .d.ts included
```

- Env var: `TYPESAFE_API_KEY` (required; `ENV.apiKey`). Other env vars: `TYPESAFE_BASE_URL` (default `https://api.typesafe.ai`), `TYPESAFE_DEFAULT_MODEL` (default `jev-latest`), `TYPESAFE_LOG_LEVEL` (default `warn`).
- Construction (docs quickstart, verbatim):

```ts
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
const client = new TypeSafeClient();            // reads TYPESAFE_API_KEY
const response = await client.systemOne({ state: {...}, questions: {...} });
console.log(response.answers.category.choice);
```

- `TypeSafeClientConfig`: `apiKey?`, `baseURL?`, `dangerouslyAllowBrowser?` (default false), `defaultHeaders?`, `defaultModel?` (falls back to env, then `jev-latest`), `fetch?`, `logger?`, `logLevel?`, `retry?: Partial<RetryPolicy>`, `timeout?` (ms, **per attempt**, default **10000**, no total retry budget). Constructor throws if the key is missing.
- Keys come from https://console.typesafe.ai/keys. Playground: https://console.typesafe.ai/playground (useful for hand-checking rubrics without code).
- HTTP: `POST https://api.typesafe.ai/v1/systemone`, headers `Authorization: Bearer <API_KEY>`, `Content-Type: application/json`.
- One method does everything: `client.systemOne(request, options?)` returns `APIPromise<SystemOneResult<Q>>`. Per-call `RequestOptions`: `headers?`, `retry?`, `signal?` (AbortSignal), `timeout?`.
- Helper constructors: `score(instructions, criteria)`, `noul(instructions?, criteria?)`, `choice(instructions, criteria)`. They just build the plain `{type, instructions, criteria}` objects, so you can also pass raw object literals.

## 2. Model id

- Jev 1.13 = `jev-1.13.0`. Aliases: `jev-latest` -> `jev-1.13.0` (stable; SDK default and what the examples use), `jev-preview` -> `jev-1.13.0` (no preview build exists now).
- Aliases move when a release ships, so answers can change under you. Response `model` field reports the versioned id. **For a reproducible offline run, pin `jev-1.13.0`** and store `result.model` with each score. The models page says versioned ids are accepted in `model` whether or not `GET /v1/models` lists them (`client.models.list()` currently lists aliases only).
- Text only (string / JSON object / array of text). English is best; other languages lower accuracy.

## 3. Request / response shapes (exact)

### Request body

```jsonc
{
  "state": "string | object | array",     // required; the content, sent once
  "model": "jev-latest",                   // required over raw HTTP; SDK fills it from defaultModel
  "questions": {                            // required, non-empty map; YOU choose the keys
    "<question id>": { "type": "score" | "noul" | "choice", "instructions": ..., "criteria": ... }
  }
}
```

- Question ids are for your code only: "not sent to the underlying model and not used in inference". Put the complete question in `instructions` even if the id is self-explanatory.
- `instructions`, each Score level, and Noul `criteria.true/false` may each be a string, object, array, or `null` (type `EntryType` / `JsonValue`). Objects let you put data next to the question and reference it by name in backticks (e.g. "Is X the same as `potential_duplicate`?"). Nested state is referenced with backticked dot/index paths like `` `evidence[0].text` ``.

### Score question

```json
{ "type": "score",
  "instructions": "How severe is the reported issue?",
  "criteria": ["Cosmetic; ...", "Broken but workaround exists", "Blocking; no workaround"] }
```

- `criteria` = **ordered array** of level descriptions (index = level number, starting at 0). Min 2 levels; "the API accepts up to 10". Entries may be `null` (undescribed; bad idea). JS type: `ScoreCriteria = readonly [EntryType, EntryType, ...EntryType[]]` (must be a tuple with >= 2 entries; a plain `string[]` will not type-check, cast or declare as a tuple).
- JS SDK v0.6.0 breaking change: criteria is an ordered sequence, not a dict keyed by integers (older code/examples may differ).
- Level descriptions may be objects, e.g. `{ what: "...", examples: ["..."] }` (use identical field names on every level).

### Score answer

```json
{ "type": "score",
  "score": 1.43,                       // probability-weighted level number, can fall between levels
  "confidence": 0.35,                  // 0..1, derived from spread of probabilities
  "legend": { "0": "Cosmetic...", "1": "...", "2": "..." },   // level -> your description
  "probabilities": { "0": 0.0, "1": 0.57, "2": 0.43 } }       // string keys, sum to 1
```

`score = sum(level * probability)`. A score of 2.0 can be "all mass on level 2" OR "half on 0 and half on 4" - **always read `probabilities`/`confidence` with `score`**. TS type: `ScoreResponse { type, score, confidence, legend, probabilities }`.

### Noul question / answer

```json
{ "type": "noul",
  "instructions": "Does the evidence contain enough information to ...?",
  "criteria": { "true": "what a yes means", "false": "what a no means" } }   // criteria optional
```
```json
{ "type": "noul", "noul": 0.95 }       // P(yes), 0..1. NO confidence field on Noul.
```
TS: `NoulResponse { type: "noul", noul: number }`. JS `noul(instructions?, criteria?)` - instructions optional in the SDK, "required" per the HTTP API page (see contradictions).

### Choice (not needed here, for completeness)

Request `criteria` = map option -> description|null (max 255 options). Answer `{ type:"choice", choice, probabilities, confidence }`.

### Full response

```json
{ "model": "jev-1.13.0",
  "answers": { "<question id>": { ...answer... } },
  "usage": { "input_tokens": 468, "output_tokens": 43 } }
```
TS `SystemOneResult<Q> { answers; model; usage: Usage {input_tokens, output_tokens} }`; `answers` types are inferred from the questions you passed.

## 4. Batching many questions in one call

- `questions` is a map; put every question for the same state in one `systemOne` call. The model ingests `state` once and evaluates all questions **in parallel and independently** (one answer is never context for another). Adding questions "barely changes response time" and costs only the extra question tokens ("asking a question you might not need is close to free").
- Cookbook (parallel_questions, 13 questions over a ~54k-char article): batching vs one-question-per-call was ~12.2x cheaper and ~10x faster with no change in answers (run-to-run std dev same under both strategies).
- When a second request IS warranted: only if an earlier answer is needed to build the next state/questions. Not our case.
- Per-pair pattern from entity_alignment cookbook: one request per candidate pair, 1 Score + 3 Nouls riding along in the same request. That is the closest analogue to ours (Score placement + companion Noul).
- Question keys must be unique strings; use deterministic ids you can parse (e.g. `housing_growth__position`, `housing_growth__enough`).

## 5. Limits, rates, pricing

From the Models page (`jev-1.13.0`):

| Item | Value |
| - | - |
| Price | **$42 per billion input tokens ($0.042 / Mtok)**. Output tokens are **free**. |
| Rate limit | 100K tokens/s and 40 requests/s; exceeding either -> 429 |
| Context | 64k tokens per request total; **32k tokens for `state` + the longest single question** |
| Input | text only |

- **Rate limits are explicitly "adjusting dynamically ... can change without notice"**; higher limits via sales@typesafe.ai. Entity-alignment cookbook comment: "the public endpoint rate-limits above roughly eight [concurrent workers]" (it used 6) - treat 40 req/s as an upper bound, start with ~4-6 concurrent requests.
- **Not documented anywhere I found**: a hard cap on number of questions per request (only context budget bounds it), max question-id length, max size of a single criteria string, daily quotas, free tier / credits. Per-request question-count cap: unknown; the 64k budget is the only stated bound. Choice has a 255-option cap; Score has 10 levels max.
- Cost sanity: 1,000 requests x 3k input tokens = 3M tokens = ~$0.13.
- Speed: "most queries complete in about 100 ms" (how-to-build page); SDK default timeout 10 s per attempt is plenty unless the state is big (cookbooks use 120 s for 54k-char documents).
- Accuracy degrades with irrelevant state ("context rot"): send only the evidence for that option and that dimension.

## 6. Errors and retries

HTTP (API page): `401` bad/missing key; `422` validation failure (body names the field); `429` rate limit; `529` overloaded. Retry 429/529 with exponential backoff (SDK does it by default).

JS SDK error classes (all extend `TypeSafeError`; HTTP ones extend `APIError {status, body, headers, requestId}`):
`AuthenticationError` (401), `BadRequestError`, `NotFoundError`, `PermissionDeniedError`, `UnprocessableEntityError` (422), `RateLimitError` (429; has `retryAfterMs`), `InternalServerError` (5xx), plus `APIConnectionError`, `APITimeoutError`, `APIUserAbortError`. `requestId` comes from header `x-typesafe-request-id` (log it).

`RetryPolicy` defaults: `maxRetries: 2` (after the first attempt; 0 disables), `httpStatuses`: 408, 429, 500-599 (so 529 is retried), `apiConnectionError: true`, `apiTimeoutError: true`, `backoffInitialMs: 500` (doubles), `backoffMaxMs: 5000`, `backoffJitter: 0.25`, `respectRetryAfter: true` (honors `Retry-After` and `retry-after-ms`), `maxRetryAfterMs: 60000`. Override per client (`retry`) or per call (`options.retry`).

`systemOne` throws synchronously-ish (rejected promise) for: empty `questions`; Score criteria that is not a list of >= 2 entries; non-2xx after retries; connect/timeout after retries; abort.

Offline-script advice: cache every response (JSON on disk keyed by hash of state+questions+model) so reruns replay; write after each call; log `requestId`, `model`, `usage`; do not re-pay for misses on retry.

## 7. Writing Score levels and criteria (guidance from the docs)

From primitives/score ("Writing good levels"):
- **Describe situations, not degrees.** "Broken or degraded feature, but workaround exists" works; "moderately severe" does not. Concrete descriptions give the model something to match the state against.
- **Each level is judged separately against the state. The model does not see the level number or its neighbours.** "Worse than the previous level" means nothing; numbers in descriptions/instructions don't help. Doc experiment: numeric-only levels `["0","1","2"]` with "rate 0 to 2" gave score 0.55 / confidence 0.33 on a case that descriptive levels scored 0.0 / confidence 1.0.
- So every level must **stand alone** (agent skill: "Score levels must describe concrete situations and stand on their own").
- Use as many levels as you can describe distinctly, up to 10 (3 is fine). Don't add levels you can't describe distinctly. 5 is what composite-scoring uses.
- **One dimension per Score question**; if a description is "A and B and C" the question measures three things, confidence drops and the score means less. Split it and combine in code.
- If the extreme end contains a rare case you must treat differently, give it its own level.
- Optional structured levels (`{what, examples}`) can sharpen neighbouring-level boundaries; a matching example moved a split score (1.43 @ 0.35 conf) to 1.03 @ 0.96 conf, an unrelated example changed nothing. "Higher confidence alone does not show that a description is better"; check against known examples and test on separate inputs.
- Instructions and criteria must not contradict (jaggedness #7); write them as plainly as possible; Jev reads literally (#1): put boundary cases in the criteria.
- Don't interpolate between levels for exact magnitudes ("Math using score": use scores for thresholds/ranking, not as a calibrated number).
- Low Score confidence usually means: levels overlap for this state, question measures more than one thing, or state doesn't say enough to place it.
- Normalize before combining scales: divide by `len(criteria)-1`. Use the same number of levels per dimension if you want to compare directly.
- Composite-scoring cookbook example levels begin with an explicit "No X mentioned" level 0 (absence of evidence is a level there). For us, absence is better handled by the separate sufficiency Noul so "no evidence" does not get conflated with the "minus" end of an ideological scale (do NOT make a "no info" level; it is not on the spectrum).

Writing the sufficiency Noul (primitives/noul):
- Phrase so a **high value means yes**; one condition per Noul; make the yes/no boundary unambiguous; a statement works as well as a question. Add `criteria.true/false` when the boundary is subtle; try with and without and keep whichever is better on your docs.
- A Noul near 0.5 means "yes and no about equally likely", NOT "partial information". If you want "how much information" as a spectrum, use a Score. If you want a clear gate, define the condition tightly ("states a position, vote, policy, or what the measure does on this dimension").
- Semantic_find cookbook uses exactly this idea: a Choice ranks where the answer is (always sums to 1, so something always ranks first), plus a companion `Noul` "does any line of the document address ..." with explicit true/false criteria, because the Noul can fall near 0 when nothing answers. Their result: top-line prob 0.86 but exists 0.14 -> "not in the document".
- Noul has no `confidence`. Threshold `noul` directly (cookbooks use e.g. 0.8/0.2 bands with a middle band routed to review; 0.5 when yes/no are equally costly). Pick thresholds by testing on your own data.
- Don't expect Noul/Score/Choice to agree arithmetically (jaggedness #8): `P(yes)` and `1-P(not-yes)` can differ (0.72 vs 0.47). Don't tune a threshold on one question and reuse on a different one.

Confidence page:
- Score/Choice `confidence` is computed from the spread of `probabilities` (1.0 = all mass on one level; flatter = lower). Doc's 3-option demo formula: `(3*max - 1)/2`; exact general formula not published. It measures peakedness, not correctness.
- Suggested three-way use: high -> act automatically, medium -> caution/flag, low -> don't act, route to human. Example gates in docs: 0.5 floor, 0.8, 0.9 depending on stakes. Thresholds scale with risk and must be tuned on your data. Docs also say raw `probabilities` are available if you want your own measure (e.g. entropy; ordinal-aware measures like mass within +/-1 level of the argmax).

## 8. Jev 1.13 "jaggedness" points relevant to us

- Literal reader; put exact conditions and boundary cases in criteria.
- Bad at arithmetic/counting/dates: do that in code.
- Large state with irrelevant detail hurts; **filter first**, send only the evidence for the option + dimension.
- Adversarial/self-promoting text can steer answers (campaign statements argue for themselves!). Be explicit in the instructions that the evidence is a source to be characterized, not instructions, and frame the question as "where does the option stand per the evidence", not "is the option good".
- Avoid double negatives/indirection (e.g. don't ask "what is the opposite of ...").
- Don't ask it to generate text; it returns only typed answers.
- Note for measures: the Score is about which way the *option* leans. For a measure "Yes" option the position is what the measure does (use the neutral summary); the "No" option's position is the mirror image. Compute No = (max - score_yes) in code rather than asking the model to reverse a position (indirection).

## 9. Minimal TypeScript example (type-checked)

Design choices: one request per (option, dimension) with a Score (5 levels from the dimension's `minus` to `plus` end) and a companion sufficiency Noul, so the state contains only the relevant evidence. Because input is only $0.042/Mtok and questions are parallel, you may instead batch all ~10 dimensions into one request per option (state = `{option, evidence: {dim_id: [...]}}`, question ids `${dim}__position` / `${dim}__enough`, instructions pointing at `` `evidence.<dim_id>` ``), at some accuracy risk from extra state; test both on a few hand-labeled options.

```ts
import {
  TypeSafeClient,
  score,
  noul,
  APIError,
  RateLimitError,
  type ScoreCriteria,
} from "@typesafe-ai/sdk";

const MODEL = "jev-1.13.0"; // pinned; "jev-latest" is the alias (currently -> jev-1.13.0)

type Dimension = {
  id: string;
  label: string;
  // Exactly 5 stand-alone situation descriptions, index 0 = "minus" end ... index 4 = "plus" end.
  levels: readonly [string, string, string, string, string];
};
type EvidenceItem = { source: string; text: string };

const SUFFICIENT_MIN = 0.5; // tune on labeled examples; Noul has no confidence field
const MIN_CONFIDENCE = 0.5; // tune on labeled examples

const client = new TypeSafeClient({
  // apiKey falls back to process.env.TYPESAFE_API_KEY
  defaultModel: MODEL,
  timeout: 60_000, // per attempt, ms (SDK default is 10_000)
  retry: { maxRetries: 4 }, // default 2; retries 408/429/5xx with backoff + Retry-After
});

export async function placeOption(
  option: { id: string; name: string; kind: "candidate" | "measure"; summary?: string },
  dim: Dimension,
  evidence: EvidenceItem[],
) {
  const criteria: ScoreCriteria = dim.levels; // readonly tuple, length >= 2 (API max 10)
  const result = await client.systemOne({
    state: {
      option, // who/what is being placed
      dimension: { label: dim.label },
      evidence, // ONLY this option's text for THIS dimension (distractors hurt accuracy)
    },
    questions: {
      position: score(
        "Based only on `evidence`, where does `option` stand on the policy dimension `dimension.label`?",
        criteria,
      ),
      enough_info: noul(
        "Does `evidence` contain enough information to place `option` on the policy dimension `dimension.label`?",
        {
          true: "The evidence states a position, a vote, a policy, or what the measure does on this dimension",
          false: "The evidence is silent, off-topic, or too vague to tell where the option stands on this dimension",
        },
      ),
    },
  });
  const pos = result.answers.position;
  const enough = result.answers.enough_info.noul;
  return {
    optionId: option.id,
    dimId: dim.id,
    rawScore: pos.score, // 0..4 (float), 0 = minus end
    signed: pos.score - 2, // -2..+2
    confidence: pos.confidence,
    probabilities: pos.probabilities, // keys "0".."4"
    enoughInfo: enough, // P(yes)
    placed: enough >= SUFFICIENT_MIN && pos.confidence >= MIN_CONFIDENCE,
    model: result.model,
    usage: result.usage,
  };
}

export async function safePlace(...args: Parameters<typeof placeOption>) {
  try {
    return await placeOption(...args);
  } catch (e) {
    if (e instanceof RateLimitError) console.error("429 after retries", e.retryAfterMs, e.requestId);
    else if (e instanceof APIError) console.error(e.status, e.requestId, e.body);
    throw e;
  }
}
```

Wire format the SDK actually sends for the above (verified with a mock fetch): `{"state":{...},"questions":{"position":{"type":"score","instructions":"...","criteria":[...5 strings]},"enough_info":{"type":"noul","instructions":"...","criteria":{"true":"...","false":"..."}}},"model":"jev-1.13.0"}` with `Authorization: Bearer ...`.

Driver notes: run with a small pool (4-6 workers), cache results to disk, treat `placed === false` as "insufficient evidence / low certainty" (leave unplaced or flag for human review) rather than using the raw score; keep `probabilities` so you can later change the confidence rule without re-calling.

### Example 5-level rubric (from `data/dimensions.json`, `housing-growth`)

Levels are each independent, concrete situations (the model never sees the index or neighbours). Minus = preserve local control; plus = build much more housing.

```ts
const housingGrowth: Dimension = {
  id: "housing-growth",
  label: "Housing growth & land use",
  levels: [
    "Actively opposes new housing or density: backs down-zoning, moratoria, or blocking large developments to preserve neighborhood character",
    "Prefers limited growth: supports local control over zoning and approvals, accepts only modest or targeted new housing",
    "Mixed or moderate: supports some new housing but also keeps significant local restrictions, with no clear lean toward either more or less building",
    "Supports substantially more housing: favors upzoning near transit or jobs, faster permitting, or fewer local barriers, with some limits retained",
    "Strongly pro-building: calls for broad zoning reform, much higher density, and removing most local zoning limits and permit delays",
  ],
};
```

(The 'mixed' middle level is for evidence that genuinely describes a middle position. A low-confidence score of ~2.0 with probability split between levels 0 and 4 is a different thing: that is "unclear / conflicting", visible in `probabilities`.)

## 10. Contradictions and oddities between pages

1. **`model` required vs optional.** API page marks `model` as required; the JS/Python SDKs default it (`jev-latest` / `defaultModel`). Fine with the SDK; required over raw HTTP.
2. **Noul `instructions`.** API page says required; JS `noul(instructions?, criteria?)` defaults `null`. Always supply it.
3. **Batching speedup numbers.** `primitives.md` says 13 questions in one call is "11.5x cheaper and 9.6x faster"; the cookbook page, its description, and `llms.txt` say 12.2x / 10.0x. Same cookbook, different run/version; irrelevant to design.
4. **Stale Python snippet in jaggedness page**: uses `TypeSafeClient(model="jev-1.13")`, positional `client.system_one({"items": ...}, {...})`, and `result.nouls[...]`. Everywhere else: `client.system_one(state=..., questions=..., model=...)` and `response.answers[...]`. JS uses `systemOne({state, questions, model?})` -> `.answers`. Ignore `.nouls`. The page also uses the id `jev-1.13` (no patch) vs the canonical `jev-1.13.0`.
5. **Cookbooks run `jev-1.12`** (pricing note says $0.042/Mtok for jev-1.12 as of 2026-09, same as 1.13's published price); the models page lists only 1.13. Cookbook numbers (confidence examples, thresholds) are examples, not guarantees for 1.13.
6. **Rate limit.** Models page: 40 req/s and 100K tok/s; entity-alignment cookbook comment: public endpoint rate-limits above ~8 concurrent workers. Plus the page's own warning that limits change dynamically. Plan for 429s.
7. **Timeouts.** JS SDK default is 10 s per attempt (ms units); cookbooks use `timeout=120.0` (Python, seconds) for big documents. Docs claim ~100 ms typical latency.
8. **Score "at least two levels; API accepts up to 10"** (API/Score pages) vs JS types that only enforce >= 2 (no max in types); client throws on < 2. The 10 cap is enforced server-side (422 presumably; not documented).
9. **Error table is short** (401/422/429/529) while the JS SDK also defines BadRequest, NotFound, PermissionDenied, InternalServer; the default retry set (408, 429, 5xx) covers 529.
10. **Python `probabilities` keyed by int vs string**: Score page says Python SDK keys `probabilities`/`legend` by integer; HTTP returns string keys. The JS type is `{[score in number | `${number}`]: number}`; at runtime (JSON) they are string keys `"0"`..`"4"`.
11. **Confidence formula** only given for a 3-option demo; general definition unpublished ("a separate cookbook" promised, not linked).
12. **Hard limits unpublished**: max questions/request, max id length, free tier/quotas (see section 5).
13. Quickstart has Python/cURL only; JS usage lives on the `sdk/javascript` page (short; defers to GitHub README for details: github.com/typesafe-ai/typesafe-sdk-js).
