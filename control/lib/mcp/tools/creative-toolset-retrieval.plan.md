# Creative-toolset retrieval — closing the intent → form → tools loop

Status: IMPLEMENTED (Approach A, 2026-07-13). See "Executed" at bottom.
Sequel to: `creative-toolsets.plan.md` (Ring 10 → 10 form drawers behind `get_creative_toolset`).
Owner seams: `lib/mcp/routing-cards/`, `lib/db/repositories/embeddings.js`, `lib/mcp/tools/context.js`.

## The instinct, corrected

The prompt was "use the freed tool-index space to make semantic_search more prominent." The freed
space is **pull-only** (`get_tool_index`); prominence is an **always-paid** property (the
`forward_context` body, already pinned at 11,000 with ~0 headroom). Those budgets don't transfer, so
this plan spends **no always-paid budget**. It makes semantic_search more *powerful* (what it can
find), not more *prominent* (prose real estate) — the on-philosophy lever.

The power-up that uses what we just built: `get_creative_toolset({ form })` is a **deterministic enum
reader** — exact once you know the form, but invisible to intent. The intent→entry-tool hop already
rides **routing cards** (`semantic_search({ kinds:['routing'] })`). This plan bridges the two so the
full loop works:

    intent  →  semantic_search(routing)  →  entry tool + `form`  →  get_creative_toolset({form})
             (fuzzy locate)                                          (deterministic read the family)

## What the audit found

17 routing cards exist. Mapped against the 10 toolset forms:

| form | routing card(s) → entry | status |
|---|---|---|
| diagram | `diagram-chart` → create_sketch | ✓ |
| illustration | `scene-illustration` → sketch_what_possible · `human-figure` → create_figure | ✓ |
| reference | `photo-reference` → reference_protocol | ✓ |
| **image-render** | — | **✗ NO CARD** |
| object | `carved-wordmark` · `workbench-object` · `assemble-parts` | ✓ (3 of 6 tools carded) |
| world | `world` → compose_world | ✓ |
| view | `study-view` → create_view | ✓ |
| motion | `motion-camera/deck/traversal/waypoints` · `stitch-film` | ✓ |
| audio | `audio-beats` → create_beats | ✓ |
| game | `game` → create_game | ✓ |

Two concrete gaps:

1. **`image-render` is unreachable by intent.** An 8-tool family (comic pages, AI-painted
   illustrations, the worker/audit-gate pipeline) has zero routing coverage — `"make a comic page"`,
   `"an AI-painted portrait"`, `"direct an image render"` surface nothing. This is the single biggest
   retrieval hole and the clearest thing to fix.
2. **No `form` linkage.** Every card's `form` frontmatter is absent (—). There's no machine link from
   a routing card to the toolset drawer it belongs to, so nothing can (a) point the agent from the
   entry tool to the full family, or (b) lint that every form is covered.

## Approach A (recommended) — routing-card coverage + `form` linkage

Reuses the existing machinery entirely: the routing-card loader, the `routing` source kind, the
1,100-char body ceiling, and the `routing-eval.integration.test.js` harness. No new kind, no DB
schema change, no always-paid growth.

### A1. Single source of truth for the form enum

`CREATIVE_FORMS` currently lives in `context.js`. To let the routing-card loader validate `form`
without a context.js ↔ loader import cycle, extract the list into a tiny shared module:

```js
// lib/mcp/creative-forms.js
export const CREATIVE_FORMS = ['diagram','illustration','reference','image-render','object','world','view','motion','audio','game'];
```

`context.js` imports it (and a test asserts `Object.keys(FORM_TOOLSETS)` deep-equals it — the
partition test already half-does this). The loader imports it for validation.

### A2. Add a `form` field to routing cards

- Loader (`routing-cards/loader.js`): add `form` to `REQUIRED_FIELDS`; validate `form ∈ CREATIVE_FORMS`
  (throw with file + field, like the other loader faults — curated library, fail loud on a bad PR).
- Backfill `form` on all 17 existing cards (mechanical: the table above is the mapping; the motion
  cards → `motion`, the three object cards → `object`, etc.).

### A3. Author the missing `image-render` card

`lib/mcp/routing-cards/image-render.md`, `form: 'image-render'`, `entry: 'create_sketch'` (the mint —
`"make a comic"` / `"an AI illustration"` calls `create_sketch` with kind `image-outcome` /
`sequential-art` first; the render pipeline is downstream). Recognizers: "make a comic page / graphic
novel panel", "an AI-generated / AI-painted image", "direct a render I'll paint externally", "a
character sheet for consistent casting". Body names the downstream pipeline in one fork sentence and
points at `get_creative_toolset({ form: 'image-render' })` for the full 8-tool family. Keep < 1,100.

(Optional, lower value: thin recognizer cards for the un-carded tools — `create_solid_turntable`,
`emote_figure`, `create_dna_process`/`create_energy_cycle`, `verify_machina`. Defer unless the eval
shows their intents miss; their form's primary card covers them contextually today.)

### A4. Every card body ends with the family pointer

One trailing line per card: `Full family → \`get_creative_toolset({ form: '<form>' })\`.` This is the
bridge the agent follows from "which entry tool" to "the whole toolset" — and it's inside the
pull-only routing-card body, so it costs no always-paid budget.

### A5. Tests

- **Coverage lint** (new, in `routing-cards.test.js` or `context.test.js`): every `CREATIVE_FORM` has
  ≥1 routing card whose `form` matches; every card's `form ∈ CREATIVE_FORMS`. This is the pin that
  makes a future un-carded form fail loudly — the same "no capability flies dark" discipline as the
  registry sweep.
- **Enum single-source**: `Object.keys(FORM_TOOLSETS)` deep-equals `CREATIVE_FORMS` from the shared
  module.
- **Routing-eval fixture** (`routing-eval.integration.test.js`): add rows for the newly reachable
  intents — at minimum `['make a comic page of my hero', 'create_sketch']`, `['an AI-painted portrait
  I can render externally', 'create_sketch']`. These assert intent → entry tool survives in top-K
  against the REAL embedder, gating the new card's `when` anchors.

### A6. Reindex

Routing cards are filesystem markdown indexed by `embeddings.js` reindexAll under `source_kind:
'routing'`. After adding/editing cards, `node scripts/reindex-embeddings.js` (or the reindex runs on
next boot) picks them up. Note this in the card-authoring checklist — a new card not reindexed is
invisible to search.

## Approach B (deferred) — a `toolset` source kind

Index the 10 `FORM_TOOLSETS` bodies under a new `toolset` source kind so semantic_search returns the
*whole family list* directly (not just the entry tool). Mechanically straightforward — mirror the
`view_vocab` block in embeddings.js (add `'toolset'` to `SOURCE_KINDS`, a `BodyComposition.toolset`,
a reindex loop reading `FORM_TOOLSETS`) — but **redundant right now**:

- Routing cards already do intent → entry tool + forks (the thing you actually call next).
- `get_creative_toolset({ form })` already gives the whole family deterministically once the form is
  known (and A4 wires the pointer to it).

So B buys "browse the family by fuzzy intent" — a real but narrow case. **Defer** until telemetry
(the `get_tool_telemetry({ orientation: true })` cut — weak searches, drawer misses) shows
browse-the-family intents failing. If it does, B is a ~40-line addition and the A-work (the `form`
field, the shared enum) is exactly the scaffolding it builds on.

## Non-goals / guardrails

- **No always-paid body growth.** Nothing here touches the `forward_context` body or adds a
  `tools/list` description. The body is at its ceiling; keep it there.
- **Don't make semantic_search a mandatory front door.** The loop is *fuzzy-locate → deterministic-
  read*. Routing cards return the entry tool; the `get_*_vocab` / `get_creative_toolset` readers
  return exact bodies. Over-routing known lookups through the fuzzy hop adds an inference tax and
  inverts the contract. semantic_search gets more powerful by finding more, not by being called more.
- **Card bodies stay < 1,100 chars** (the routing-card ceiling — a card that outgrows it is a vocab
  card in disguise).

## Files touched (Approach A)

- `lib/mcp/creative-forms.js` (new — shared enum)
- `lib/mcp/tools/context.js` (import the shared enum; drop the local literal)
- `lib/mcp/routing-cards/loader.js` (`form` required + validated)
- `lib/mcp/routing-cards/*.md` (backfill `form` on 17; new `image-render.md`)
- `lib/mcp/routing-cards/routing-cards.test.js` + `.../routing-eval.integration.test.js` (coverage
  lint + fixture rows)
- reindex after (`scripts/reindex-embeddings.js`)

## Ordering

1. Shared enum module + context.js import + deep-equal test (pure refactor, green).
2. Loader `form` validation + backfill 17 cards + coverage lint.
3. Author `image-render.md` + fixture rows.
4. Reindex; run routing-eval (needs the ONNX model fetched — auto-skips otherwise).
5. STATUS.md branch-state note.

## Executed (Approach A, 2026-07-13)

- **Shared enum**: `lib/mcp/creative-forms.js` (`CREATIVE_FORMS`, canonical order). `context.js` now
  imports + re-exports it; `FORM_TOOLSETS` keys pinned deep-equal to it (context.test.js).
- **Loader**: `routing-cards/loader.js` gained an OPTIONAL, validated `form` field (throws on an
  invalid form; formless cards like publication-cook → mint_stash stay legal).
- **Backfill**: `form` added to 16 creative cards; `publication-cook` left formless (audit found it's
  the only non-Ring-10 card — entry `mint_stash`).
- **New card**: `routing-cards/image-render.md` (form `image-render`, entry `create_sketch`) — the one
  gap the audit found. An 8-tool family (comics, AI-painted images, worker/audit-gate pipeline) is now
  reachable by intent.
- **Family pointer**: every formful card body ends `Full family → get_creative_toolset({ form: '…' })`
  — the bridge from entry tool to the whole drawer, inside the pull-only card body (0 always-paid
  cost). Max card body 798 chars, all under the 1100 ceiling.
- **Tests**: form-coverage lint (every CREATIVE_FORM has ≥1 card) + form-validity/pointer lint
  (routing-cards.test.js); enum single-source deep-equal (context.test.js); FIXTURE rows + a new
  CARD_FIXTURE discrimination test (routing-eval.integration.test.js) that pins the *card* — not just
  the shared `create_sketch` entry — so comic intents must surface image-render, not diagram-chart.
- **Verification**: 47/47 unit tests green. Routing eval ran against the REAL ONNX embedder (model
  present) — **3/3 green**, including card-level discrimination. Reindexed the live DB: `routing: 18`
  cards, 0 failures.

Deviations from plan:
- `form` is **optional**, not required (the plan assumed all cards map to a form; the audit found
  publication-cook routes off-Ring-10). Coverage is enforced by the ≥1-card-per-form lint instead of
  a required field.

Not done / deferred: Approach B (a `toolset` source kind for browse-the-family-by-intent) — still
redundant with routing cards + `get_creative_toolset`; the `form` field + shared enum are its
scaffolding when telemetry justifies it. Thin per-tool cards for the un-carded stragglers
(`create_solid_turntable`, `emote_figure`, `create_dna_process`/`create_energy_cycle`,
`preview_vehicle_instance`, `verify_machina`, `measure_view`) — deferred; their form's primary card
covers them, and the eval passes without them.
