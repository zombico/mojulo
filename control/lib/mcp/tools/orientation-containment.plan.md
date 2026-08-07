# Orientation containment — Office and Studio forward contexts

Status: C1–C3 IMPLEMENTED (2026-08-06) — see "Executed" at bottom. C4 (schema diet) and C5
(dynamic-registration spike) remain open.
Owner seams: `control/lib/mcp/tools/context.js`, `control/lib/mcp/server.js` (SERVER_INSTRUCTIONS),
`control/lib/mcp/tools/context.test.js`, `control/lib/mcp/tools/tool-descriptions.test.js`,
`control/lib/mcp/routing-cards/routing-eval.integration.test.js`
Sibling plans: `creative-toolsets.plan.md` (Ring 10 → 10 form drawers behind `get_creative_toolset`),
`creative-toolset-retrieval.plan.md` (routing-card `form` linkage closing the intent → form → tools
loop), `tool-list-drawerization.plan.md` (40 view tools → `create_view`, the pattern precedent).

## Motivation

A fork/strip analysis of a "mojulo-lite" (operate-only edition) concluded the split isn't worth it:
the creative substrate costs ~10% of installed footprint and zero operate-code coupling. What the
ops-minded operator actually pays for the creative substrate is **orientation** — creative prose and
schemas loaded into every agent session regardless of intent.

So instead of forking the product, split the orientation: **the studio is separate from the
office.** `forward_context` grows a `mode` — `'office'` (default: bots, connected services, apps,
deliberation, operate-what-exists) and `'studio'` (the creative wing: the FORM recognizer rows,
creative identity, creative drawers). An ops session never reads studio prose; a creative session
pays one extra hop and then has full routing. The office body carries exactly one hook row teaching
the studio door.

Office/Studio is the user- and agent-facing vocabulary (it matches the existing **Studio** mode on
Workshop Home). Do NOT reuse "operations mode" — that was internal naming for the deprecated
Ring 11 surface (removed; `ops_tags` remnants remain in the DB) and would haunt the changelog.

## Problem (measured 2026-08-06, working tree)

Three always-paid surfaces still carry creative mass:

| Surface | Total | Creative share |
|---|---|---|
| `tools/list` payload (every session, at connect) | 374,692 bytes, 178 tools | **238,895 bytes / 64% (69 tools)** |
| `forward_context` body (BODY_CEILING 11,700) | ~11.6K chars/cell | ~4.9K (8 FORM rows + GAME row + opener + beats-edit row) |
| `SERVER_INSTRUCTIONS` preamble | ~2.4K chars | ~600 (Media/Game bullets) |

The tools/list mass is lopsided — top creative tools by JSON bytes:

| tool | bytes | note |
|---|---|---|
| `create_manji_tree` | 54,698 | **15% of the entire payload is one tool's inputSchema** |
| `forge_motion` | 19,695 | four families enumerated in-schema |
| `create_workbench` | 15,612 | |
| `create_sketch` | 14,693 | |
| `create_figure` | 14,293 | |

Top-5 sum: ~119K — a third of everything every connecting agent loads before any intent exists.

Pre-existing drift, not caused here but blocking the ratchets: the payload pin currently measures
**374,692 > PAYLOAD_CEILING 372,000** (tool-descriptions.test.js:159 should be failing), and the
creative-toolsets plan's Executed notes already flagged 4 per-description budget failures. Whoever
lands C4 inherits re-pinning; do not silently bless the overflow.

## Approach — three slices, independently landable

### C1. Split forward_context into Office and Studio bodies

`forward_context` takes `mode: 'office' | 'studio'` (default `'office'`), stateless per call like
the existing `register`/`disclosure` args — mode selects which body composes, never session state
(mode-as-state would fight host caching and MCP session semantics).

**Office body** (the new default — what today's body becomes):
- `ROUTING_INDEX` "Create things" keeps the operate paradigm rows (CHATBOT :712, CONNECTED
  SERVICE :713, APP :714) and replaces the GAME row (:715) + the eight FORM rows (PICTURE :716
  through PUBLICATION :723) with **one hook row**, on the shape:
  > **STUDIO — create something media-shaped** (Media: picture / object / world / building /
  > motion / audio / voice / publication — or a Game) → `forward_context({mode:'studio'})` for the
  > studio routing index; fastest path if you already know the form:
  > `get_creative_toolset({form})`.
- `LEAN_OPENER` (:113): trim the creative enumeration ("worlds, views, films, games, audio,
  publications") to a clause naming Media/Game + the studio door. Creative identity prose
  (recipes-not-renders, proves-before-promotion) moves to the studio opener.
- The beats-edit row in **Operate what exists** (:730) → one clause pointing at the studio /
  `audio` drawer instead of the four-tool inline flow.
- `DRAWER_DIRECTORY` gains no creative entries; `get_creative_toolset` reachability rides the hook
  row + its own tools/list description (names all 10 forms, seen every session).

**Studio body** (new — assembled almost entirely from existing material):
- A short studio opener carrying the creative identity prose relocated from the shared opener.
- The eight FORM recognizer rows + the GAME row, verbatim-relocated from today's `ROUTING_INDEX`
  (recognition quality is preserved by relocation, not re-derivation).
- A creative drawer directory: `get_creative_toolset({form})`, the vocab kinds
  (`semantic_search({kinds:['routing'|'sketch_vocab'|'view_vocab'|'beats_vocab'|'game_vocab'|…]})`),
  `get_worked_example({paradigm:'media'|'game'})`.
- **Standalone, not a delta:** the shared spine (communication-settings notice, standing-rule
  floor + disclosure directive, safety one-liners) appears in the studio body too, so an agent that
  jumps straight to studio mode is never missing the standing rules. Cost: a session that reads
  both bodies pays the spine (~1.5K) twice — accepted; a delta body breaks under host caching or
  an agent skipping the office read.
- One line pointing back: "bots / connected services / apps / deliberation → the office body
  (`forward_context()`)."

**Constraints:**
- **Paradigm coverage** (context.test.js:502 — every `PARADIGMS` member named on every orientation
  surface): both bodies satisfy it cheaply — office names Media/Game in the hook row; studio names
  Bot/Connected Service/App in the pointer-back line. Extend the test's surface map to both modes.
- **Row lint** (ROUTING_ROW_CEILING 1,000, context.test.js:534): runs over both bodies.
- **Ceilings:** retire the single `BODY_CEILING` (11,700) for two pins — `OFFICE_BODY_CEILING`
  (measure post-split; estimate ~7,000 + headroom) and `STUDIO_BODY_CEILING` (estimate ~8,000 +
  headroom; the relocated rows + spine + drawer directory). Measure every register × disclosure
  cell per mode, pin the max. The creative-toolsets plan's Executed notes record the body jammed
  at ceiling — this slice is where that pressure finally vents.
- `buildForwardContextBody` stays pure (module-load export, never touches the DB); mode is one
  more pure parameter. Export both bodies for the tests.

Cost accepted: creative asks pay one extra hop (the studio read) before routing. That is the
point — the hop is paid *on creative intent*, not by every session.

### C2. SERVER_INSTRUCTIONS: Media/Game bullets → one line each, teach the two modes

server.js SERVER_INSTRUCTIONS keeps naming all five paradigms (coverage test), but Media's bullet
drops the four entry tools and the artifact enumeration: "**Media** — creative artifacts minted as
deterministic recipes. Entry: `forward_context({mode:'studio'})`." Game similarly keeps
`create_game` only. The closing routing paragraph names the two modes explicitly: office is the
default `forward_context`; studio is the creative wing. Budget note at server.js:50 says ~230–260
words; this slice should bring it back under after the bullet growth.

### C3. Guards — hook-row recognition + studio completeness

The FORM rows relocate rather than die, so the rev-1 "did the diet orphan an intent?" eval
shrinks to two cheap guards:
- **Hook-row recognition:** extend `routing-cards/routing-eval.integration.test.js` with a handful
  of creative-ask queries ("draw me a chart", "a drivable city", "a soundtrack", "design a bespoke
  building", "a picture book from this material") asserting the routing cards still land top-k over
  real ONNX embeddings — the safety net for an agent that skips the studio read and goes straight
  to `semantic_search`. (Routing cards are untouched by this plan; this pins that fact.)
- **Studio completeness lint:** every `CREATIVE_FORMS` member is named in the studio body; every
  form row names its entry tool; no tool named in the studio body is absent from the registry
  (reuse the existing registry-sweep pattern from the creative-toolsets work).

### C4. Schema diet on the top offenders — schema-by-reference

Independent of the mode split; this is where most of the bytes are. Same pattern that turned 40
view tools into `create_view` + vocab cards, applied to the two worst schemas:
- `create_manji_tree` (54.7K): collapse the enumerated program/field/palette structures to loose
  `object`/`string` params; the full parameter manual moves to (or already lives in) the
  `manji_program` vocab kind — description says "read the card first" and points at
  `semantic_search({kinds:['manji_program']})` / the illustration drawer.
- `forge_motion` (19.7K): the four families' per-family knobs move behind the motion routing cards
  (already exist: motion-camera/deck/traversal/waypoints); schema keeps the family enum + a loose
  `spec` object.

Then re-pin `PAYLOAD_CEILING` **downward** to the new measurement (+ small headroom) so the ~100K
win ratchets. Resolve the pre-existing 374,692 > 372,000 overflow in the same commit — measure,
attribute, and either fix or explicitly re-pin with justification per the ratchet's own rules.
Candidates after the top two if more is wanted: `create_workbench`, `create_sketch`,
`create_figure` (all ~14–16K, all with vocab kinds already).

Risk to hold: loose schemas trade connect-time bytes for call-time validation. The mint tools
already validate server-side (schema is not the only gate), and the vocab-card flow is the
established authoring path for exactly these tools — but expect a tail of agents that used to
lean on inline schema enums now needing the card. Watch `get_tool_telemetry` error rates on the
two tools after landing.

### C5 — SUPERSEDED by `tool-packs.plan.md` (2026-08-06)

Studio-gated dynamic registration generalized: two wings were the coarsest possible packs. The
successor plan re-cuts the whole tools/list surface into ~19 result-shaped PACKS (spine + pack
tools at connect ≈ 6–9K tokens, from ~93K; members register on unveil via
`notifications/tools/list_changed`), with self-routing promoted to the pack-description level.
The host-support spike this section called for is that plan's P0. C4 remains open here but is
demoted to per-pack schema hygiene once packs land.

## Boundary reasoning

- **Why a mode split instead of the rev-1 single-body diet?** Rev 1 deleted the recognizer rows
  and bet on one compact row + semantic retrieval carrying recognition. The mode split relocates
  the rows instead — recognition quality is preserved, the always-paid office body gets the same
  diet, and the creative wing gains a real front desk instead of only an enum reader
  (`get_creative_toolset` tells you the tools once you know the form; the studio body tells you
  what your ask maps to). Rev 1's rejection of a `facet` arg is reversed for the same reason.
- **Why not intent-sniffing in the handler?** `forwardContextHandler` never sees the user's ask —
  "when creative is shown" is enacted by the *agent* recognizing a creative-shaped request from
  the hook row and pulling the studio body. Static hook + mode arg is the deterministic version;
  no new mechanism.
- **Why keep one STUDIO hook row at all?** Zero mention = zero discoverability; agents can't open
  a door they've never heard of. One hook row (+ `get_creative_toolset`'s tools/list description)
  is the floor.
- **Two modes, not three.** Workshop Home's nav has Ideate/Operate/Studio, but Ideate
  (plan/research/stash) orients fine from the office body — its rows already live in "Reason about
  structure". Office/studio is the right cut for orientation.
- **`get_creative_toolset` is unchanged.** The studio body carries recognizer rows and points at
  it; the per-form tool bodies stay behind the drawer. No duplication: rows route, drawers
  enumerate.
- **Ordering:** C1+C3 together (guarded split), C2 rides along, C4 independent. C4 is where most
  of the bytes are; C1 is where the philosophy lands. Either order works; don't couple them in one
  commit — each moves a different pinned test.

## Success criteria

- Office body ≤ ~7K per cell (from 11.7K), studio body ≤ ~8K, each pinned by its own ratchet.
- tools/list payload ≤ ~275K (from 374.7K), pinned downward, pre-existing overflow resolved.
- Routing eval green including the creative-ask queries; studio completeness lint green.
- Paradigm coverage (both modes), row lint (both bodies), description ratchet: green.
- No operate-surface behavior change; creative mint flows unchanged beyond the studio hop.

## Executed (2026-08-06) — C1 + C2 + C3

Landed in `context.js`, `server.js`, `context.test.js`, `routing-cards.test.js`,
`routing-eval.integration.test.js`:

- **C1.** `forward_context` takes `mode: 'office' | 'studio'` (default office), stateless per
  call, validated in the handler; `FORWARD_CONTEXT_MODES` exported. Office body: opener re-cut to
  the two-wings sentence, GAME + the eight FORM rows replaced by ONE STUDIO hook row, beats-edit
  row re-pointed at the audio drawer. Studio body (new, standalone): `STUDIO_OPENER` (creative
  identity + office pointer-back naming Bot/Connected Service/App), `STUDIO_ROUTING_INDEX` (the
  nine rows relocated **verbatim**, plus the beats-edit clauses folded into AUDIO),
  `STUDIO_DRAWER_DIRECTORY` (form enum + routing cards + vocab kinds + worked examples), and the
  shared spine (settings notice, standing rules + disclosure, safety one-liners). Studio body is
  pulseless. `forward_context`'s tools/list description re-cut to teach both wings (1,023 chars,
  under its 1,081 allowlist snapshot); `mode` added to its inputSchema; the TOOL_INDEX
  forward_context row names both wings.
- **C2.** SERVER_INSTRUCTIONS: Media bullet → one line ending in
  `forward_context({mode:'studio'})`; Game bullet trimmed to `create_game` + studio pointer; the
  closing routing paragraph teaches office-default + studio mode.
- **C3.** context.test.js: per-mode ceilings replace `BODY_CEILING` — **office pinned 9,600
  (measured 9,435; was 11,623 single-body), studio pinned 7,400 (measured 7,169)**, both at
  mojulo+pedagogical; paradigm coverage sweeps both bodies; row lint runs both wings; new
  containment describe (office names NO creative entry tool + carries the hook row; studio spine
  floor+safety in every cell; studio completeness — all 11 forms + 19 entry tools named and
  registered); handler mode test (office/studio/invalid). routing-cards.test.js reachability sweep
  re-defined to the office∪studio union (one named hop). routing-eval: +2 voice fixtures (voice
  had zero coverage). **Eval green on the real embedder; context 44/44; lib/mcp 1,030/1,032.**

Deviations from plan:
- **Office landed at 9.4K, not the ~7K estimate.** The estimate under-counted the spine +
  operate/deliberation rows that stay. Still a 2.2K/19% diet, and the structural win holds: a new
  creative FORM now grows only the studio pin.
- **The two pre-existing tool-descriptions failures remain** (list_catalysts/mint_catalyst/
  custom_catalyst over the 700 ceiling; payload 374,692 → 374,898 with the mode schema's +206
  bytes, both over the stale 372,000 pin). Verified identical failures on the pre-change tree.
  C4 owns the re-pin, per this plan.

Not done (open): C4 schema diet (`create_manji_tree` 54.7K, `forge_motion` 19.7K → vocab-card
schema-by-reference + downward payload re-pin), C5 dynamic-registration spike.
