# mint_solid consolidation — folding the figure/solid family behind one door

## Status: LANDED

Measured after the pass (vitest registry probe, `JSON.stringify(listTools())`):

- Family `tools/list` surface: **15 listed tools → 4** (`mint_solid`, `edit_solid`,
  `get_solid_vocab`, plus `export_model`/`bind_mesh_render`/`forge_motion`/`stitch_motion` kept).
  15 retired names (the 14 below + `preview_vehicle_instance`) stay callable as unlisted aliases.
- **`tools/list` payload: 267,614 bytes** (was under the 381,500 pin; the family essays —
  `create_manji_tree` alone was a 20,151-char allowlisted description — left the payload for the
  10 solid-vocab cards behind `semantic_search`/`get_solid_vocab`).
- 10 solid-vocab cards shipped (8 `mint_solid` kinds + 2 `edit_solid` ops), indexed as
  `solid_vocab`, read via `get_solid_vocab`. New DB migration `migrateEmbeddingsSolidVocabKind`
  widens the `meta_embeddings` CHECK constraint.
- Both OPEN decisions resolved: **edifice folded in** (`kind: 'edifice'`); **vehicle folded in
  last** (`kind: 'vehicle'` — `preview_vehicle_instance` retired).
- Full `lib/mcp` + `lib/db` suite green (1467 passed); new `mint-solid.test.js` proves the aliases
  resolve through the registry and `mint_solid` dispatches end-to-end.

### Follow-on passes (same session, same pattern)

- **Tier 1 — `forge_motion` description trim → `motion_vocab` drawer.** `forge_motion`'s
  12,999-char description (the heaviest left after `create_manji_tree`) split into 5
  `motion_vocab` cards (camera / deck / effect / world / stitch) behind a new `get_motion_vocab`
  reader + `semantic_search`. `forge_motion` 12,999 → **1,409**, `stitch_motion` 1,435 → **819**.
  New `motion_vocab` source-kind + loader + `migrateEmbeddingsMotionVocabKind`. No consolidation
  (both tools stay listed) — pure description-trim.
- **Tier 2 — science-process views folded into `create_view`.** `create_dna_process` +
  `create_energy_cycle` → `create_view` kinds `dna-process` / `energy-cycle` (family bio) with
  view-vocab cards; standalone registrations retired as unlisted aliases. VIEW_KINDS 45 → 47.

**Payload after all three passes: 250,370 bytes** (mint_solid 267,614 → Tier 1+2 250,370;
session baseline was ~296K). `PAYLOAD_CEILING` (381,500) now sits ~131KB above — a ratchet-down
candidate, still deferred (the pin was set the same day for `save_modular_bot`, and most of that
slack predates this work). `semantic_search`'s description allowlist re-pinned up twice
(1,768 → 1,909 → 2,049) to bless the `solid_vocab` + `motion_vocab` mentions.

---

### Original scope (as agreed)

Sequel to: `tool-list-drawerization.plan.md` (that plan drawerized the **view** family into
`create_view(kind, params)` + `view_vocab`, and listed the figure/solid family as a deferred
**non-goal**: *"revisit as `mint_solid(kind, spec)` once `create_view` has proven the vocab-card
ergonomics."* It has. This plan promotes that non-goal to planned work with a decided boundary.)

## Goal

The figure/solid family is ~15 listed tools carrying **~90–100KB of description prose** — the
description-heaviest cluster left in `tools/list` after the view pass (`create_manji_tree` +
`sketch_polygomer` alone are ~47KB of parameter essays). Collapse the family's *callable* surface
to **four listed tools**, park every per-kind manual in a vocab card pulled on demand, and keep
every recipe byte-identical.

Target: **~90–100KB → ~3KB listed**, a ~**30% cut to the current 296,136-byte `tools/list`
payload** — from one pass, concentrated because the essays are the parameter manuals, not the
routing hooks.

The doctrine is unchanged from the parent plan: a drawer is *read-only text*, so the family's
callability can't itself become a drawer — it collapses to a small set of `kind`/`op`-dispatch
tools, and all the *knowledge* parks in cards. This is the portable win (no dynamic
`tools/list_changed` — still a non-goal for the reasons in the parent plan).

## Decided boundary

**Fold into `mint_solid(kind, spec)`** — the "make a new 3D solid of kind X" tools:

| Retiring tool | `kind` | today's weight |
|---|---|---|
| `create_manji_tree` | `manji-tree` | ~30KB |
| `create_figure` | `figure` | ~9KB |
| `create_workbench` | `workbench` | ~9KB |
| `create_carved_solid` | `carved-solid` | ~4KB |
| `create_assembler` | `assembler` | ~2.7KB |
| `create_solid_turntable` | `solid-turntable` | ~1KB |
| `preview_vehicle_instance` | `vehicle` | ~0.9KB |
| `create_edifice` | `edifice` | **OPEN — see below** |

**Fold the authoring doors in as `via` modes** (Group 2 — same kinds, different input grammar):

- `sketch_polygomer` → `via: 'parts'` (parts-list door)
- `create_polygonized_sketch` → `via: 'prompt'` (keyed NL orchestration; keeps `mode:'one-trip'`)
- `get_polygonizer_packet` + `submit_polygonizer_manifest` → `via: 'packet'` (the key-free
  two-call handshake; `mint_solid` returns the packet, a second `mint_solid` call submits the
  authored manifest — same two-op shape agreed for skin below)

**Fold into `edit_solid(op, ref, spec)`** — verbs over an *already-minted* family solid:

- `skin` — `get_skin_packet` (op `skin`, phase `packet`) + `skin_polygomer` (op `skin`, phase
  `apply`); family-scoped (manji-tree / workbench / assembler / figure)
- `emote` — `emote_figure` (op `emote`); figure-scoped

**Reader:** `get_solid_vocab(kind)` — sibling of `get_view_vocab`; full card by id, or list
`{ id, family, label, summary }` rows.

### Explicitly OUT of this consolidation

- `export_model`, `bind_mesh_render` — **substrate-wide interchange**, not family verbs (they
  export/bind *any* world: cities, dungeons, views, controllable levels). They **stay listed** as
  their own pair. Optional prose-trim (Phase F) moves their manuals to a card, but the tools stay
  visible — burying a whole-substrate capability behind a family surface is the mis-scope this
  plan exists to avoid.
- `forge_motion`, `stitch_motion` — the standalone **motion FORM** over any subject → film.
  Untouched.
- Survivors from other families: `create_sketch` / `update_sketch` / `diff_sketches` (2D diagram
  entry), the image-render loop (`get_image_render_packet` / `bind_image_render` /
  `bind_character_sheet`), `create_view` (already consolidated). Untouched.

## OPEN decision — `edifice` in or out (lean: IN)

`create_edifice` is mint-a-3D-structure and fits the `mint_solid` shape, but it carries its own
*advisory livability* semantics (mass/concourse graph, never gated) and reads as a bespoke
building workbench rather than a solid kind. **Lean: fold in as `kind: 'edifice'`** — livability
is a spec+validation detail, not a reason to be a separate tool, and it keeps the building-scale
sibling beside the object-scale `workbench`. Flag for the operator to veto in review; if out, it
stays a standalone listed tool and the enum drops one row.

Same soft flag on `vehicle`: `preview_vehicle_instance` is a *preview*, not strictly a mint —
confirm it wants a `kind` row vs. staying a preview affordance.

## The four-tool end state

`tools/list` family entries: **~15 → 4**

- `mint_solid(kind, spec)` — kinds above; `via` for authoring modes
- `edit_solid(op, ref, spec)` — `op ∈ {skin, emote}`
- `export_model`, `bind_mesh_render` — slimmed, still listed (general-purpose)
- `get_solid_vocab(kind)` — the reader

Everything else — every kind manual, every op spec, the `via` mode docs — parks in
`lib/graph/**/solid-vocab/<kind>.md` cards, indexed as source kind `solid_vocab`, read on demand.

## Phases (mirror the `create_view` pass exactly)

### Phase A — `mint_solid(kind, spec)` + `solid_vocab`
- New `lib/mcp/tools/mint-solid.js`. `SOLID_KINDS = { 'figure': { mint: mintFigure }, ... }` —
  enum + dispatch derive from the map, exactly like `VIEW_KINDS`.
- inputSchema: `kind` (enum), `via` (enum, authoring-door modes), shared top-level `ref` /
  `folder_ref` / `title`, and `spec: object` (per-kind, documented in the card, validated by the
  mint). Description budget ≤ 80 words: compressed family line + retrieval pointer
  (`semantic_search` kinds `['solid_vocab']` → `get_solid_vocab`).
- Handler: look up `SOLID_KINDS[kind]`, dispatch by `via`, spread `spec` into the mint. Unknown
  kind → error listing known kinds. Mint throws → catch, append card's parameter section, rethrow.
- **Cards are harvested, not written fresh:** each retiring tool's `description` + inputSchema
  property descriptions + defaults → its card. Mechanical extraction, good subagent fan-out.
- Card frontmatter `{ id, family, label, summary }`. Add `'solid_vocab'` to `SOURCE_KINDS` +
  reindex block in `embeddings.js` (the `sketch_vocab`/`view_vocab` block is the template); wire
  `scripts/reindex-embeddings.js`; add `'solid_vocab'` to the `semantic_search` kind list.

### Phase B — `edit_solid(op, ref, spec)`
- `op ∈ {skin, emote}`; `skin` carries the packet→apply two-phase handshake as sub-ops. Reuses
  the existing skin/emote mint functions unchanged (imported directly).

### Phase C — retire the registrations (retired names still call, don't list)
- `listed: false` alias per retired name (`create_figure`, `create_manji_tree`, `sketch_polygomer`,
  `skin_polygomer`, `emote_figure`, `get_skin_packet`, `get_polygonizer_packet`,
  `submit_polygonizer_manifest`, …) forwarding to `mint_solid`/`edit_solid`. Keep `mint*`/handler
  exports — gen/spike tests import them directly.
- Blast radius (same as the view pass): compiled plans (`compile_plan`/`execute_plan` resolve via
  the registry Map — unlisted still executes), synthesized skills, catalyst bodies. Grep + update
  in place. `compile_plan` soft-warns on an unlisted-name reference. Drop aliases after one
  release cycle; note in `CHANGELOG.md` both times.

### Phase D — index + docs lockstep (golden rule)
- `TOOL_INDEX` / `ROUTING_INDEX` rows in `context.js`: remove the retired rows, add `mint_solid`
  / `edit_solid` / `get_solid_vocab`. The registry-sweep test in `context.test.js` enforces
  every listed tool has a row.
- Update `FORM_TOOLSETS` / `get_creative_toolset` for the affected forms, and the routing cards
  (`routing-cards/`) that pointed at the retired entry tools.
- `get_tool_index` rows; CLAUDE.md architecture-map references (figure / carved-solid / workbench
  / manji-tree rows).

### Phase E — measure
- `JSON.stringify(listTools())` byte count before/after; record in the PR. Expect the family
  cluster ~90–100KB → ~3KB, ~30% of total.

### Phase F (optional) — slim `export_model` / `bind_mesh_render`
- Trim to routing hook; park the import-notes manual in a card. Tools stay listed.

## Invariants

- **Recipes and rendering untouched.** The mint functions are imported directly by the gen/spike
  tests — they are the proof this pass doesn't touch geometry. Byte-identical renders.
- **Retired names stay callable** as unlisted aliases (registry-sweep test exempts unlisted).
- **No dynamic `tools/list_changed`** — still a non-goal (parent plan); the callable surface is
  the four static tools, all knowledge is in on-demand cards.
