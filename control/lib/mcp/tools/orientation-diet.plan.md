# orientation diet — closing the fresh-agent struggle points

## Status: threads B–F LANDED this pass; thread A's ratchet landed, its prose-diet phases remain open

Sequel to [tool-list-drawerization.plan.md](tool-list-drawerization.plan.md) (which cut tool
*count*: 189 → 143 listed) and [orientation-ramp.plan.md](orientation-ramp.plan.md) (which built
the pulse / refusal legend / worked examples). This plan targets what a fresh-agent walkthrough of
STATUS.md + context.js (2026-07-06) surfaced as the remaining struggle points: description
*prose* weight, routing-row girth, glossary paradigm-parity, the composer fork, and hand-count
drift. The through-line is the repo's own signature move — **rules that live in prose (comments,
conventions, hand-counts) move into tests or registries**.

## Measured baseline (vitest registry probe, working tree 2026-07-06)

- **150 listed tools; `JSON.stringify(listTools())` = 313,973 bytes.**
- **60 descriptions exceed 700 chars** (~100 words); 40 exceed 1,000; 11 exceed 2,000.
- Worst offenders: `create_manji_tree` (19,844 desc + 32,086 schema ≈ **52KB — 1/6 of the whole
  payload in one tool**), `forge_motion` (12,999 desc), `create_sketch` (3,989 + 9,829 schema),
  `create_figure`, `create_workbench`, `cook` (12,884 schema).
- Total: 144,057 description chars + 160,672 schema chars.
- Routing index: 23 rows, 16,159 chars; top three rows are 3,032 / 1,938 / 1,885 chars ("Mint a
  visual", "Make a GAME", "Put info in motion") — an index violating its own "index, not
  glossary" editing rule.
- Register-kit glossary: covers the bot/service/app arm only — **no Game entry, no
  stash/gather/cook, no sketch/view/world/motion/beats** in any register variant. The plain
  register (user-facing phrasing) is exactly where the creative arm needs it.
- Drift found by hand: `get_substrate`'s registered description said "the **three** artifacts"
  (pre-game), the `LEAN_OPENER` comment said "the three creatable artifacts". The registry-sweep
  test can't catch this class — nothing derives or sweeps paradigm mentions.

## Success metric

`get_tool_telemetry({ orientation: true })` — the orientation-gap cut (weak searches, drawer
misses, oriented-then-abandoned sessions), before vs after. The instrument already exists; this
plan is what it was built to measure.

---

## Thread A — description budget: the tools/list prose diet (ratchet LANDED; diet phases open)

`tools/list` is the one surface that can't be drawerized from inside; drawerization cut the tool
*count*, but the surviving descriptions are essays doing three jobs (routing hook, lesson,
parameter manual) when only the first belongs in the list. Principle: **route in the description,
teach in the drawer.**

- **A0 (landed): the ratchet.** `tool-descriptions.test.js` — every listed tool's description
  must fit `DESCRIPTION_CEILING` (700 chars) unless it has an entry in
  `DESCRIPTION_ALLOWLIST` (a name → current-length snapshot of the 60 offenders); an allowlisted
  tool may shrink but never grow, and dropping under the ceiling removes it from the allowlist
  (the test fails on stale entries, so the list only ratchets down). A second pin holds total
  `tools/list` payload bytes under a deliberate ceiling — growth is a conscious re-pin, same
  contract as the emit char-net.
- **A1 (open): motion vocab cards.** `forge_motion` (12,999) + `stitch_motion` are the one big
  family with no card rail. Ship `motion_vocab` cards (camera / deck / traversal / waypoints /
  stitch — the description's own section breaks), indexed like `view_vocab`, read via a
  `get_motion_vocab` or folded into `get_view_vocab` family `motion`. Then cut `forge_motion`'s
  description to routing phrases + card pointer.
- **A2 (open): `create_manji_tree` schema drawerization.** 52KB in one tool. The inputSchema's
  per-property essays move to `manji_program` cards (the rail already exists); the schema keeps
  types + one-liners. Same treatment for `create_sketch` / `cook` schema prose if the payload pin
  still hurts.
- **A3 (open): fold the view-shaped stragglers.** `create_dna_process` / `create_energy_cycle` →
  `create_view` kinds; `create_solid_turntable` → a sketch/view kind; `preview_vehicle_instance`
  → a workbench affordance. Retired names stay callable via `listed:false` aliases; the
  `translate_modeler_lingo` lexicon + TOOL_INDEX/ROUTING_INDEX rows move in the same commit
  (the named blast-radius rule from drawerization phase 5).

## Thread B — routing-row girth (LANDED)

The "Mint a visual" mega-row (3,032 chars, a dozen bolded sub-routes in one bullet) split into
per-verb rows — diagram / figure / carved solid / object / world / study object — each one or two
lines: framing → entry tool → one vocab-card pointer. The "Make a GAME" and deck-motion rows
trimmed to routing + pointers (their detail already lives in the tool descriptions and vocab
cards). Enforced: `context.test.js` lints that no routing bullet exceeds `ROUTING_ROW_CEILING`
(1,000 chars) — the file-header editing rule ("index, not glossary") converted from comment to
test.

## Thread C — register-kit paradigm parity (LANDED)

Glossary entries added across all three register variants for the game paradigm (**Game**, store
slice, level) and the creative arm (**Stash / Gather / Cook / Outcome**, **Sketch / View / World /
Motion / Beats** as one recipe-artifacts entry). The plain register carries the civilian phrasing
("cook" → "turn your gathered material into a finished document or page"). Enforced: the
concept-names-invariant test now sweeps `PARADIGMS` + the creative nouns across every register
cell.

## Thread D — the composer fork (LANDED)

`bind_primitives` vs `recommend_mcp_orbit_compositions` was the one genuinely ambiguous routing
decision. Two moves:

- The routing row now states the decision rule in one sentence: **schemas declared
  (richer-snapshot inventory) → `bind_primitives`; first encounter, no schema knowledge → the
  orbit composer.**
- Response-layer redirect (the substrate's existing pattern — composer warning tags route
  remediation): `recommend_mcp_orbit_compositions` now returns `bindPrimitivesHint` when the
  declared inventory carries introspected `inputSchema`s — the agent that picked the wrong door
  gets redirected by the door itself.

## Thread E — drift-proofing enumerations (LANDED)

- Fixed the two stale "three artifacts" spots (`LEAN_OPENER` comment, `get_substrate`
  description).
- `PARADIGMS` exported from context.js as the single source; `SERVER_INSTRUCTIONS` exported from
  server.js. A sweep test asserts every paradigm is named in: the initialize preamble, the lean
  opener, `get_substrate`'s description AND body, and every register variant of the glossary.
  The "three vs four" bug class can no longer recur silently.
- Hand-counts derived or pinned: the "45 kinds" claims for `create_view` (tool description,
  TOOL_INDEX row, routing row) are tested against `Object.keys(VIEW_KINDS).length` — a new view
  kind now fails the test until the counts are updated (or the strings stop hand-counting).

## Thread F — STATUS.md rot ritual (LANDED)

The regeneration trigger is now written down where agents read: CLAUDE.md's release-notes section
says committing a staged batch supersedes STATUS.md §6 and rewriting it is part of the commit;
STATUS.md's own header states the same contract.

## Deferred / explicitly not done

- The A1–A3 prose-diet phases (vocab cards + schema drawerization + view folds) — each is its own
  sitting with its own blast-radius sweep; the A0 ratchet holds the line meanwhile.
- No change to tool *behavior* anywhere in this plan — orientation surfaces, tests, and one
  additive response field only.
- Telemetry-driven pruning of routing rows that never route (needs a few weeks of
  `get_tool_telemetry` data first).
