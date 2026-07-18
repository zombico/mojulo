# Creative toolsets — drawerizing Ring 10 by FORM

Status: IMPLEMENTED (2026-07-12) — context.js + context.test.js. See "Executed" at bottom.
Owner seam: `control/lib/mcp/tools/context.js`
Sibling plans: `tool-list-drawerization.plan.md` (the 40 view-tools → `create_view` move that
proved the pattern), `orientation-diet.plan.md` (the body-ceiling ratchet + routing-card move).

## Problem

`TOOL_INDEX` (context.js:384–608) is a single flat drawer, ~69.8K chars (~17.4K tokens). Pulling
`get_tool_index` is all-or-nothing: the agent that needs to know which beats tool to call pays for
the whole fleet/deliberation/apps manual too. The mass is lopsided:

| Ring section | chars | share |
|---|---|---|
| **Ring 10 — Visualization** | 24,750 | **35.5%** |
| Ring 6 — Deliberation | 13,694 | 19.6% |
| Ring 7 — Apps | 6,905 | 9.9% |
| Ring 9 — Stash/Cook | 6,579 | 9.4% |
| Ring 8 — Plan | 4,440 | 6.4% |
| everything else | ~13,400 | ~19% |

Ring 10 alone is a third of the drawer. And it isn't one ring — it's **seven FORMs plus an AI-render
pipeline** filed under a "Visualization" label. Members like `create_game`, `compose_world`,
`create_view`, `create_beats`, and `forge_motion` are top-level paradigms/forms, not sketches. The
flat file isn't sustainable: every new creative capability appends another dense line and the drawer
grows unbounded. This plan re-cuts Ring 10 into ~10 FORM-scoped subdrawers reached through one
parameterized reader, so a lookup drops from 24.7K to a ~1.5K map + one 2–6K section, and the
subdrawer names reinforce the same FORM taxonomy the routing index already teaches.

Scope note: this plan does **only** Ring 10. Ring 6 (the next-heaviest block) is a candidate for the
same treatment later but is out of scope here — keep the change reviewable.

## The 10 main lines (the taxonomy)

Cluster by *what the operator is making* (the FORM axis), not by tool count. Clean partition of all
45 Ring-10 tools, no tool in two drawers:

| key | drawer | tools | n |
|---|---|---|---|
| `diagram` | **Diagrams & charts** (sketch core) | `create_sketch` `update_sketch` `get_sketch_vocab` `diff_sketches` `create_polygonized_sketch` | 5 |
| `illustration` | **Scene & figure illustration** | `sketch_what_possible` `create_figure` `emote_figure` `create_manji_tree` | 4 |
| `reference` | **Visual reference (from a photo)** | `reference_protocol` `capture_reference` | 2 |
| `image-render` | **AI-image render pipeline** | `get_image_render_packet` `bind_character_sheet` `bind_image_render` `request_image_render` `pull_image_render` `submit_image_render` `accept_image_render` `reject_image_render` | 8 |
| `object` | **Objects & products (literal scale)** | `create_carved_solid` `create_solid_turntable` `create_workbench` `create_assembler` `preview_vehicle_instance` `verify_machina` | 6 |
| `world` | **Worlds (traversable)** | `compose_world` `list_world_themes` `export_model` `translate_modeler_lingo` | 4 |
| `view` | **Views (science / math / bio study)** | `create_view` `get_view_vocab` `create_dna_process` `create_energy_cycle` `measure_view` | 5 |
| `motion` | **Motion & film** | `forge_motion` `stitch_motion` | 2 |
| `audio` | **Audio — Mojulo Beats** | `create_beats` `get_beats_vocab` `get_beats` `update_beats` `annotate_beats` `diff_beats` `export_beats` | 7 |
| `game` | **Game** | `create_game` `get_game_vocab` | 2 |

Sum = 45.

### Boundary reasoning (the parts a reviewer will question)

- **PICTURE splits four ways** (`diagram` / `illustration` / `reference` / `image-render`). The
  routing index's single PICTURE row would collapse to a ~10K, 19-tool drawer — defeats the purpose.
  The seam inside PICTURE is *workflow*, not subject.
- **`image-render` is the strongest standalone unit**: an 8-tool queue → worker → audit-gate
  lifecycle, half of which (`pull_/submit_/accept_/reject_`) a normal authoring session never
  touches. Best candidate to also self-advertise (see hybrid, below).
- **Two-tool drawers earn their line by being distinct FORMs/paradigms**, not by volume: `game` is a
  whole paradigm; `motion` is the form that *consumes* the other nine; `reference` is a
  self-contained two-step contract. Tool-count must not drive the taxonomy.
- **Oddballs folded, not orphaned**: `verify_machina` → `object` (mechanism feasibility);
  `translate_modeler_lingo` → `world` (it exists to explain the `export_model` handoff).

## Design decision: one parameterized reader, not ten tools

Ten discrete `get_*_tools` entries would each add a description to the always-paid `tools/list`
payload — the surface under the **314,028-byte pin** (tool-descriptions.test.js:143). Shrinking a
pull-only 70K by re-inflating the always-paid 314K is a bad trade. So:

- **One new tool**: `get_creative_toolset({ form })`, `form` an enum of the 10 keys above.
- **No-arg** → the 10-line FORM map (~1.5K): one row per form, `key — what it makes · n tools`.
- **`{ form }`** → that cluster's full per-tool lines (2–6K).

Net `tools/list` cost: +1 line. Every creative lookup: 24.7K → ~1.5K + one section.

**Optional hybrid** (defer unless review wants it): promote `image-render` and `audio` to their own
named tools (`get_render_pipeline`, `get_beats_tools`) because both carry lifecycles a create-tool
alone won't reveal (worker/gate; studio/annotations/diff). Costs +2 more `tools/list` lines but makes
those two self-discoverable. Keep the other eight parameterized. Start without it; add if the
telemetry orientation cut shows drawer-misses on those two families.

## Naming: match the routing index FORMs

The subdrawer keys are the **same FORM words** the routing index Create-things rows already use
(PICTURE / OBJECT / WORLD / VIEW / MOTION / AUDIO / GAME — context.js:619–624). One taxonomy across
both surfaces: the routing row becomes the pointer ("PICTURE → `get_creative_toolset({form:'diagram'|
'illustration'|'reference'|'image-render'})`"). This is the "guide the model into doing things
properly" win — do **not** invent a second grouping vocabulary.

## Implementation

### 1. Extract the data — `FORM_TOOLSETS`

Ring 10's per-tool lines currently live inline inside the `TOOL_INDEX` template literal (543–591).
Lift them into a keyed map so both the base index (if it still points here) and the new handler read
one source:

```js
// context.js — new module-level constant
const FORM_TOOLSETS = {
  diagram:       { title: 'Diagrams & charts', makes: 'flow charts + data charts you view in the dashboard', body: `...the 5 tool lines...` },
  illustration:  { title: 'Scene & figure illustration', makes: '...', body: `...4 lines...` },
  reference:     { title: 'Visual reference (from a photo)', makes: '...', body: `...2 lines...` },
  'image-render':{ title: 'AI-image render pipeline', makes: 'direct/queue/gate an externally-painted image or comic', body: `...8 lines...` },
  object:        { title: 'Objects & products', makes: '3D solids at literal scale', body: `...6 lines...` },
  world:         { title: 'Worlds (traversable)', makes: '...', body: `...4 lines...` },
  view:          { title: 'Views (science/math/bio)', makes: 'animated study objects', body: `...5 lines...` },
  motion:        { title: 'Motion & film', makes: 'adds time to a static subject', body: `...2 lines...` },
  audio:         { title: 'Audio — Mojulo Beats', makes: 'synthesized soundtracks/tunes/grooves/sfx', body: `...7 lines...` },
  game:          { title: 'Game', makes: 'a playable standalone artifact', body: `...2 lines...` },
};

const CREATIVE_FORMS = Object.keys(FORM_TOOLSETS); // enum source, single point of truth

function buildCreativeToolsetMap() {
  return `## Creative toolsets — pick a FORM, pull its tools\n\n` +
    CREATIVE_FORMS.map((k) => `- \`${k}\` — ${FORM_TOOLSETS[k].title}: ${FORM_TOOLSETS[k].makes} (${countTools(FORM_TOOLSETS[k].body)} tools)`).join('\n') +
    `\n\nCall \`get_creative_toolset({ form })\` for one form's full tool list.`;
}
```

### 2. Handler

```js
export async function creativeToolsetHandler(input, _ctx) {
  const form = input?.form;
  if (form === undefined) {
    return { content: [{ type: 'text', text: buildCreativeToolsetMap() }] };
  }
  if (!CREATIVE_FORMS.includes(form)) {
    throw new Error(`\`form\` must be one of: ${CREATIVE_FORMS.join(', ')} (got '${form}')`);
  }
  const t = FORM_TOOLSETS[form];
  return { content: [{ type: 'text', text: `## ${t.title}\n\n${t.body}` }] };
}
```

### 3. Register (mirror the `get_tool_index` block at context.js:1230)

```js
registerTool({
  name: 'get_creative_toolset',
  description:
    "Return the tool list for ONE creative FORM — diagram · illustration · reference · image-render · object · world · view · motion · audio · game. No arg → the FORM map (which form makes what). Pull this instead of `get_tool_index` when the task is to MAKE something visual/audible/playable; the routing index's Create-things rows point here. Read-only, idempotent.",
  inputSchema: {
    type: 'object',
    properties: {
      form: { type: 'string', enum: CREATIVE_FORMS,
        description: 'Which creative form. Omit to list all forms with a one-line description of each.' },
    },
  },
  handler: creativeToolsetHandler,
});
```

### 4. Base `TOOL_INDEX`: replace the Ring 10 block with a pointer

Swap lines 543–591 for a short stub so the base index shrinks ~24.7K → ~1.5K here:

```
### Ring 10 — Creative mints (make a picture / object / world / view / motion / audio / game)
The FORM families. Per-tool lists live behind `get_creative_toolset({ form })` — call it no-arg for
the form map. Forms: diagram · illustration · reference · image-render · object · world · view ·
motion · audio · game.
```

(Rename the ring header from "Visualization" — it was always a mislabel; several members are
paradigms, not sketches.)

### 5. Routing index rewrite (context.js:619–624)

Point each Create-things FORM row at the drawer as the "when a row isn't enough" step, alongside the
existing routing-card retrieval. Example for PICTURE:

```
- PICTURE — diagram/chart → `create_sketch`; scene/figure → `sketch_what_possible`; posed figure →
  `create_figure`; from a PHOTO → `reference_protocol`; AI-painted image/comic → `create_sketch`
  kind 'image-outcome'/'sequential-art'. Full tool list per sub-form: `get_creative_toolset`.
```

Keep it under the 1000-char routing-row ceiling (context.test.js:465).

### 6. Completeness test — make it union-aware (the one required test change)

The registry sweep (context.test.js:349–365) calls `toolIndexHandler({})` and asserts every listed
tool name appears in that ONE string. After the move, ~45 names leave the base index — the sweep must
now check the **union** of the base index + every form drawer:

```js
const { content } = await toolIndexHandler({});
let corpus = content[0].text;
for (const form of CREATIVE_FORMS) {
  corpus += (await creativeToolsetHandler({ form })).content[0].text;
}
const missing = listTools().map((t) => t.name).filter((n) => !corpus.includes(`\`${n}\``));
expect(missing).toEqual([]);
```

This preserves the golden-rule guarantee (no listed tool flies dark — the failure mode called out at
context.test.js:351–354) while allowing the split.

### 7. New tests to add

- **Partition test**: the 45 tool names are covered by exactly one form drawer each (no name in two
  bodies, union == the Ring-10 set). Guards against a tool silently landing in two drawers on edit.
- **`create_view` count claim** (context.test.js:503) currently asserts the "N kinds" string on the
  TOOL_INDEX surface; retarget it to the `view` form drawer.
- **Enum-validation test**: unknown `form` throws; no-arg returns the map containing all 10 keys.
- **Form-map budget**: the no-arg map stays under a small ceiling (~2K) so it's cheap to pull.

## Char budget expectations

- Base `TOOL_INDEX`: ~69.8K → **~46.5K** (Ring 10 body removed, ~1.5K stub left).
- `get_creative_toolset` no-arg: ~1.5K. Per-form: 2–6K (biggest = `image-render` ~8 lines, `audio`
  ~7 lines).
- `tools/list` payload: +1 tool description (~0.4K) — well inside the 314,028-byte pin; re-pin the
  baseline number in tool-descriptions.test.js in the same commit.
- Always-paid `forward_context` body: unchanged (Ring 10 was never in it).

## Ordering

1. Lift Ring 10 lines into `FORM_TOOLSETS` verbatim (no prose edits) — pure refactor, tests green.
2. Add handler + registration + the base-index stub + routing-row pointers.
3. Make the sweep union-aware; add partition + enum + budget tests; retarget the view-count test.
4. Re-pin `tools/list` payload baseline. Update `forward_context`'s drawer directory (context.js:643)
   and `get_tool_index`'s own description to name `get_creative_toolset`.
5. STATUS.md branch-state note.

## Risks / open questions

- **Discoverability of the parameterized reader.** A model that never reads the routing row won't know
  `get_creative_toolset` exists beyond its one `tools/list` line. Mitigation: the routing-row pointers
  (step 5) + the base-index stub both name it. If telemetry still shows creative drawer-misses,
  promote `image-render` + `audio` per the hybrid.
- **`export_model` / `measure_view` live in two mental homes** (a world author and an object author
  both want `export_model`). The partition puts each in one drawer (`world`, `view`); the routing rows
  can mention them from more than one FORM row without duplicating the tool BODY. Keep bodies
  single-homed; let routing rows cross-reference.
- **Later: do Ring 6 the same way?** Deliberation is the next 19.6%. Same pattern (a `get_deliberation_
  toolset({ surface })`) but out of scope here — revisit after this lands and the pattern is proven a
  second time.

## Executed (2026-07-12)

Landed in `context.js` + `context.test.js`:
- `FORM_TOOLSETS` (10 forms, all 45 Ring-10 tools, clean partition) + `CREATIVE_FORMS` +
  `buildCreativeToolsetMap()` + `creativeToolsetHandler` + the `get_creative_toolset` registration.
- `TOOL_INDEX` Ring 10 block replaced by the pointer stub. Base index **69,784 → 45,783 chars**
  (−34%). Per-form drawers: diagram 1.8K · illustration 2.9K · reference 1.2K · image-render 2.4K ·
  object 3.2K · world 2.1K · view 1.8K · motion 2.7K · audio 3.5K · game 2.0K. A creative lookup is
  now the ~1.5K form map + one 1.2–3.5K section instead of the flat 24.7K Ring 10.
- Registry sweep made union-aware; added the partition test, no-arg-map test, enum-validation test,
  form-map budget test; retargeted the create_view "N kinds" claim onto the `view` drawer.
- context.test.js: **39/39 green.**

Deviations from plan:
- **No forward_context body changes.** The always-paid body was already jammed at the 11,000-char
  ceiling by prior uncommitted branch work (backup measured ~10,999). Any addition (drawer-directory
  bullet, routing-intro pointer) tipped it over. Rather than raise the ceiling to absorb pre-existing
  overflow, the body was left byte-neutral. Discoverability instead rides surfaces that cost no
  always-paid budget: `get_creative_toolset`'s own `tools/list` description (names all 10 forms, seen
  every session), the `get_tool_index` description mention, and the base tool-index Orientation line.
  If a body pointer is wanted later, do it in a commit that also trims ~150 chars of body fat or bumps
  BODY_CEILING with justification.
- **Payload pin fine, but note pre-existing ratchet drift.** Adding `get_creative_toolset` stayed
  under the tools/list payload pin and the ratchet-down check. However, tool-descriptions.test.js's
  per-description budget test fails on 4 tools — `create_figure` (3934>3525), `create_beats`
  (1150>1142), `export_beats` (1124>700), `get_image_render_packet` (708>700) — all pre-existing
  uncommitted branch drift (identical failures on the pre-change backup), none touched here. Out of
  scope for this change; flagged for whoever owns those tool descriptions.

Not done (deferred): the optional hybrid (promoting image-render + beats to self-advertised tools),
and applying the same pattern to Ring 6 (Deliberation, 19.6%).
