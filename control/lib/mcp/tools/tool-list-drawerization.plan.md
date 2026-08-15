# tool-list drawerization — shrinking `tools/list` without shrinking the substrate

## Status: LANDED (phases 1–4; phase 5 remains open)

Measured on the working tree (vitest registry probe, `JSON.stringify(listTools())`):

- **Listed tools: 189 → 143** (50 retired names remain callable as unlisted aliases; 193 total registered).
- **tools/list payload: 481,192 → 296,136 bytes (−38.5%).**
- 50 view-vocab cards shipped (43 `create_view` kinds + 7 `compose_world` bases), indexed as
  `view_vocab`, read via `get_view_vocab`.
- The registry-sweep test in `context.test.js` now enforces the golden rule; it caught 8 MORE
  pre-existing index gaps beyond the views (`export_model`, `translate_modeler_lingo`,
  `measure_view`, `create_assembler`, `preview_vehicle_instance`, `create_dna_process`,
  `create_energy_cycle`, `verify_machina`) — all given rows.
- Follow-up candidates: `create_dna_process` / `create_energy_cycle` are view-shaped and could
  fold into `create_view` kinds next pass; phase 5 (description budget on cook/stash) untouched.

## Why this exists

`tools/list` is the one surface that can't be drawerized from inside: on hosts without deferred
tool loading, every registered tool's name + description + inputSchema rides into the model's
context whether or not the session ever touches it. The ring model, `forward_context`, and the
drawer directory keep *orientation* cheap — but the registry itself has outgrown that discipline:

- **~190 registered tools**, of which the visual family is roughly half.
- **43 `*-view.js` files**, one closed `create_*_view` tool each, carrying **~470 description
  strings** between them (every inputSchema property has its own prose paragraph).
- The per-view descriptions are essays (see `create_fission_view` — ~200 words) because they're
  doing three jobs at once: routing hook, physics lesson, and parameter manual. Only the first
  belongs in `tools/list`.

`compose_world` (last major commit) already proved the fix on the worlds: **one entry tool with
orthogonal axes × a vocab drawer, replacing closed per-type tools**. This plan finishes that move
for the worlds and applies the same pattern to the views.

Target: **~190 → ~140 tool names**, and a much larger cut in `tools/list` payload bytes (the view
schemas are the description-heaviest in the registry).

## The pattern (named once, reused everywhere)

Three pieces, all with in-repo precedent:

1. **Entry tool with a kind enum.** One tool per family; the closed set of kinds lives in the
   inputSchema as an `enum` (43 short strings ≈ 150 tokens). The enum preserves self-routing —
   "show my student nuclear fission" still pattern-matches *inside* the one tool — without a
   drawer roundtrip. Per-kind parameters travel in a loose `params: object`.
2. **Vocab drawer, retrieved not memorized.** The per-kind prose (what it depicts, routing
   phrases, parameter manual, defaults) moves into repo-curated markdown cards indexed as an
   embedding source kind — exactly the `sketch_vocab` mechanism: `semantic_search({ kinds:
   ['view_vocab'] })` to find, a structured reader to pull the full card.
3. **Error-as-drawer.** Unknown kind → the error lists known kinds (as `compose_world` and
   `resolveTheme` already do). Bad/missing params → the error embeds that kind's parameter spec
   from its vocab card. MCP tool failures return `isError:true` into the model's loop, so a blind
   call is a teaching call.

## The semantic assistant layer — extended, and kept honest

The visual surface already has a retrieval-mediated assistant layer, and it is *the reason this
consolidation is safe*: fat tool descriptions were doing routing work that the layer already does
better. Four card rails ride `semantic_search` today (`sketch_vocab`, `sketch_method`,
`manji_program`, `painted_landscape`); `sketch_what_possible` runs the knob-resolution loop over
`sketch_method` into `create_sketch`; `translate_modeler_lingo` is the curated modeler-lexicon
router. This plan's `view_vocab` is the **fifth rail on that existing layer**, not a new
mechanism — same embedding sidecar, same retrieve-don't-resolve posture, same structured-reader
pairing.

But the layer also **hard-codes tool names**, and those references must move in the SAME commit
as each retirement — not in the Phase-3 grep sweep. These surfaces are deterministic and curated
precisely so routing is "never a model's guess" (`modeler-lingo.js` header); a route naming a
tool absent from `tools/list` breaks that contract even though the unlisted alias still executes.

Measured references to retiring names (as of writing):

- **`translate_modeler_lingo` lexicon** — 3× `create_fractal_city`, 1× `create_painted_landscape`
  (both Phase 1). Rewrite those routes to `compose_world` with the base named in `args`
  (`{ base: 'city', ... }`). The other route targets (`create_polygonized_sketch`,
  `create_figure`, `create_workbench`, `create_solid_turntable`, `create_assembler`,
  `preview_vehicle_instance`, `forge_motion`, `create_sketch`, `export_model`) are the deferred
  solid/figure family — untouched here, but this lexicon is a named blast-radius surface for
  that future migration too.
- **`semantic_search` description + `embeddings.js` comments** — the `painted_landscape` rail's
  usage prose says "pass the card's id as a named glyph to `create_painted_landscape`"; becomes
  "…to `compose_world` (base `painted-landscape`, via `overrides`)".
- **Card bodies are clean** — no tool names inside `lib/graph/sketch-vocab/`,
  `painted-landscape-cards/`, or `manji-programs/`; keep it that way in the new `view_vocab`
  cards (cards describe kinds and knobs; the entry tool is named once, in the reader/tool
  descriptions).
- **Unaffected:** `sketch_what_possible` (feeds `create_sketch`, which survives);
  `recommend_kind` (cooks); the app-creation `creation-map` (its validator checks the live
  registry, and unlisted aliases still resolve — but no app-lane tool retires anyway).

Interplay note for `create_view`: the views are deliberately *simpler* than the
`sketch_what_possible` families — a card is a complete per-kind manual, no multi-turn knob loop
needed. If a view family ever grows knob-shaped (many interacting params), graduating it into
the `sketch_method` catalog is the escape path; don't build a second knob-loop tool.

## Invariant: recipes and rendering are untouched

This is a **tools-surface migration only**. Stored sketch manifests keep their `kind:
'<x>-view'` recipes; the render-on-view path (`/api/sketches/<ref>/world`, `/scene`), the
assemblers, `WALK_KINDS`, and every `plan*Scene` in `lib/graph/views/` are out of scope. A sketch
minted before the migration renders identically after it. The `mint*` functions stay where they
are; only their `registerTool` blocks retire.

## Phase 1 — fold the remaining world creators into `compose_world` bases

`compose-world.js` says it itself: "adding one is: import its mint + adapter and add a row."

| retiring tool | base id | adapter |
| --- | --- | --- |
| `create_fractal_city` | `city` | already wired (`cityThemeAdapter`) |
| `create_transportation_hub` | `transport-hub` | identity for MVP |
| `create_controllable_world` | `controllable` | identity for MVP |
| `create_action_world` | `action` | identity for MVP |
| `create_operator_world` | `operator` | identity for MVP |
| `create_planetary` | `planetary` | identity for MVP |
| `create_painted_landscape` | `painted-landscape` | identity for MVP |

- **Identity adapter** = theme slots pass through untouched except shared `context` slots (time
  of day, palette) where the base already has a knob; full theme lowering per base is roadmap,
  not a blocker. `compose_world` throws with known ids on a base/theme miss — keep that.
- Per-base `params` still reach the mint via `overrides` (they already deep-merge over the theme
  pack) — the escape hatch is the existing one, no new surface.
- `create_operator_world` is snapshot-at-mint (reads `listConnectedServices()` inside the mint);
  that behavior rides along unchanged — the base's mint is the same function.
- **Same-commit assistant-layer updates** (see the semantic-assistant section): rewrite the
  `translate_modeler_lingo` routes and the `painted_landscape` rail prose that name
  `create_fractal_city` / `create_painted_landscape`.

## Phase 2 — `create_view(kind, params)` + `view_vocab`

### 2a. The entry tool

New `lib/mcp/tools/create-view.js`:

```js
// kind → { mint }  — one row per view; enum + dispatch derive from this map.
const VIEW_KINDS = {
  'fission':      { mint: mintFissionView },
  'double-slit':  { mint: mintDoubleSlitView },
  // ... all 43, grouped science / math / bio in source order
};
```

- **inputSchema:** `kind` (enum from `Object.keys(VIEW_KINDS)`), shared top-level `title`,
  `ref`, `folder_ref`, `viewBox`, `scene`, and `params: object` (per-kind knobs, documented in
  the vocab card, validated by the mint).
- **Description budget:** ≤ 80 words. The routing hook is a compressed family line ("animated
  science/math/bio study objects: fission, double-slit, orbit, galaxy, DNA, derivative, …") plus
  the retrieval pointer ("query `semantic_search` kinds `['view_vocab']`, read the card via
  `get_view_vocab` before passing `params`"). The enum carries the rest of the routing.
- **Handler:** look up `VIEW_KINDS[kind]`, spread `{...params, title, viewBox, scene, ref,
  folderRef}` into the mint. Unknown kind → error listing known kinds. Mint throws on bad
  params → catch, append the card's parameter section, rethrow.

### 2b. The vocab cards

- New `lib/graph/views/view-vocab/<kind>.md`, one card per kind, sibling convention to
  `lib/graph/sketch-vocab/`.
- **Card content is harvested, not written fresh:** each retiring tool's `description` string
  (the depiction prose + the "reach for this on framing like…" phrases) + its inputSchema
  property descriptions (the parameter manual) + defaults + which URL form it returns
  (`worldUrl`-only vs `/scene`). This is mechanical extraction — good subagent fan-out work.
- Card frontmatter: `{ id, family: 'science'|'math'|'bio', label, summary }` so the reader can
  list-by-family.

### 2c. The retrieval plumbing (mirror `sketch_vocab` exactly)

- Add `'view_vocab'` to `SOURCE_KINDS` and a reindex block in
  `lib/db/repositories/embeddings.js` (the `sketch_vocab` block at ~L849 is the template);
  wire into `scripts/reindex-embeddings.js`.
- Add a `get_view_vocab` structured reader (sibling of `get_sketch_vocab` in `sketches.js`;
  lives in `create-view.js`): full card by id, or list `{ id, family, label, summary }` rows,
  optional family filter.
- Update the `semantic_search` tool description's kind list.

### 2d. Retire the registrations

- Delete the 43 `register*ViewTools` exports and their import/call lines in `server.js`.
- Keep `mint*` + `create*Handler` exports — the gen/spike tests import them directly, and the
  handlers become the alias targets (Phase 3).
- Register `create_view` + `get_view_vocab` where the view block sits today in `server.js` —
  the registration order is deliberate (natural reading order); the visual family keeps its slot.

## Phase 3 — retired names still call, but don't list

The blast radius of renaming is anything that persisted a tool *name*: compiled plans
(`compile_plan` validates manifests against the live registry; `execute_plan` resolves via
`invokeRegisteredTool`), synthesized skills, catalyst bodies.

- Add a `listed: false` flag: `registerTool` stores it, `listTools()` filters on it.
  `handleToolCall` and `invokeRegisteredTool` resolve from the same Map, so unlisted tools
  still execute. (`hasRegisteredTool` also still answers true — which is what plan compilation
  should see.)
- Register each retired name (`create_fission_view`, `create_fractal_city`, …) as
  `{ listed: false, handler: → create_view / compose_world forwarding shim, description:
  'Deprecated alias for …' }`.
- `compile_plan` gains a soft deprecation warning when a manifest references an unlisted tool
  (compiles fine; nudges the plan author toward the new name).
- Grep the catalyst library and shipped skill bodies for retired names; update in place. (The
  curated assistant-layer surfaces — `translate_modeler_lingo`, the `semantic_search`
  description, `embeddings.js` rail comments — are NOT deferred to this sweep; they move in the
  same commit as the retirement they reference, per the semantic-assistant section.)
- Drop the aliases after one release cycle; note it in `control/CHANGELOG.md` both times.

## Phase 4 — index + docs lockstep (golden rule)

Audit finding that reshapes this phase: **the 43 view tools were never in `context.js` at all** —
no `TOOL_INDEX` rows (so `get_tool_index` doesn't cover them either), no routing row, not in the
header's keep-in-sync file list. They route purely via their `tools/list` essays today, which is
why those essays are essays. And **`compose_world` / `list_world_themes` are also missing** —
the world-composer commit didn't add its index rows. So this phase is mostly *adding coverage
that never existed*, not collapsing rows:

- `TOOL_INDEX`: replace the seven world-creator rows (`create_fractal_city` …
  `create_operator_world`) with `compose_world` + `list_world_themes` rows (fixing the existing
  gap); **add** `create_view` + `get_view_vocab` rows — two rows now cover a 43-kind family that
  was flying dark, restoring the "no tool missing from the index" invariant.
- Routing index: rewrite the "Mint a visual" row — it currently names all seven retiring world
  tools inline; it should route to `compose_world` (worlds) and `create_view` (study objects),
  with the vocab-retrieval pointers.
- Header keep-in-sync list: add `create-view.js` and `compose-world.js` (neither the view files
  nor compose-world are listed today).
- `context.test.js` did not catch either gap — add a registry-sweep assertion (every listed tool
  name appears in `TOOL_INDEX`) so the invariant is enforced, not aspirational. Unlisted aliases
  are exempt by construction.
- `docs/MCP-ARCHITECTURE.md`: nothing structural changes (rings hold), but the "when you add a
  tool" note should mention the vocab-card step for view kinds.
- `README.md` "Sketches & worlds" bay: name the two entry tools instead of the `create_*` family.
- `.claude/skills`: `figure-study` (figure tools) and `sketch` (`create_sketch`) are untouched.

## Phase 5 (optional, separate pass) — description budget on the survivors

`cook` (17 tools) and `stash-mode` (11) look heavy by count but are CRUD verbs that self-route
cheaply — don't consolidate them; trim prose instead. House rule going forward: a main-flow
tool description carries the routing hook; teaching prose lives in a drawer or vocab card.
`compose_world`'s own description (~120 words) is a candidate for its own rule.

## Verification

- **Payload metric, before/after:** `JSON.stringify(listTools())` byte count (one-liner via
  `node -e` against a warmed registry). Record both numbers in the PR; expect > 50% cut.
- **Registry-driven tests** in `create-view.test.js`: every `VIEW_KINDS` entry has a vocab card
  and the card's `id` matches; `create_view` smoke-mints one kind per family; unknown-kind and
  bad-params errors contain the teaching payload.
- **Alias tests:** a retired name executes via `handleToolCall`, is absent from `listTools()`,
  and a plan manifest referencing it compiles with a warning.
- Existing gen/spike tests keep importing the mints directly — they are the proof that Phase 2
  didn't touch geometry.

## Non-goals

- **Per-session tool packs via `tools/list_changed`.** We advertise `listChanged: false`; the
  registry is a process-global Map; client support is uneven; and dynamic lists would break the
  deliberate registration reading order. The compose-tool pattern is strictly better here.
- **A second MCP endpoint for the visual family.** Fragments the one-substrate story and doubles
  operator wiring.
- **The figure/solid family** (`create_figure`, `create_carved_solid`, `create_solid_turntable`,
  `create_manji_tree`, `create_polygonized_sketch`, `create_workbench`,
  `preview_vehicle_instance`, motion tools). More heterogeneous, smaller dividend — roadmap:
  revisit as `mint_solid(kind, spec)` once `create_view` has proven the vocab-card ergonomics.
  **PROMOTED** — scoped with a decided boundary in `mint-solid-consolidation.plan.md`
  (figure/manji/workbench/carved/assembler/turntable/vehicle → `mint_solid`; skin + emote →
  `edit_solid`; `export_model`/`bind_mesh_render`/`forge_motion`/`stitch_motion` stay listed).
- Theme lowering for the new Phase-1 bases (identity adapters are fine until a base wants
  flavor packs).
