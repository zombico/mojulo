# world-scene registry — collapse the kind ternary + side tables into one descriptor per kind

Status: LANDED. Notes vs. the design below: build phases 2 and 3 were combined into one pass
(the characterization snapshots in [world-scene.kinds.test.js](world-scene.kinds.test.js) pin
per-arm `{ title, hash }`, `WALK_KINDS` as a literal set, and fog capability behaviorally, so
the split lost nothing); `resolveWrapTextures` moved into [world-kinds.js](world-kinds.js) with
the workbench descriptor (re-exported from world-scene.js, though nothing external imported it);
the room fallback carries `walk: true` and `WALK_KINDS` derives from registry flags + that
fallback, preserving the original ten-kind set bit-for-bit.

Files: [world-scene.js](world-scene.js) (the seam being refactored), new `world-kinds.js`
(the registry), [world-scene.test.js](world-scene.test.js) (gains the characterization layer).

## The problem, precisely

`resolveWorldScene` is the single kind → `assemble*Scene` dispatch seam — by design. But the
dispatch has outgrown its shape:

1. **A ~60-arm nested ternary** ([world-scene.js:140-266](world-scene.js)) fed by a ~60-line
   import block. Every new kind grows both.
2. **Per-kind knowledge is fragmenting into side tables.** `WALK_KINDS` (which kinds get
   first-person traverse by default) and `FOG_OCCLUDER_BOXES` (which kinds can carry fog, and
   how to extract their occluder boxes) each hold a piece of what a kind IS, in a different
   place from its dispatch arm. Adding an outdoor walkable kind today means touching three
   spots in one file and remembering that the other two exist.
3. **The dispatch arms have zero test coverage.** [world-scene.test.js](world-scene.test.js)
   covers the opt-in channels (motion / controllable / events / fog / raymarch) well, but no
   test pins any of the ~60 per-kind arms — not the title fallback, not the manifest-vs-spread
   calling convention. A mechanical refactor of exactly this code has nothing to catch a
   transcription slip.

The file's own header promises "adding a new world kind in one place keeps both surfaces in
sync." The registry is what makes that sentence true: one descriptor per kind, holding
everything world-scene knows about it.

## Target shape

New sibling module `world-kinds.js` owns the imports and a declarative map. `world-scene.js`
keeps `resolveWorldScene` — context normalization, registry lookup + room fallback, and the
opt-in channel layering — and shrinks to roughly the channel half of its current size.

```js
// world-kinds.js — one descriptor per kind. `resolve(manifest, ctx)` → payload.
// ctx = { title, time, sky, groundShadows, view, render, textures? } (built once by world-scene).

// The two dominant calling conventions become helpers; odd kinds write their lambda inline.
const view   = (assemble, title) => ({ title, resolve: (m, ctx) => assemble(m, { title: ctx.title }) });
const spread = (assemble, title) => ({ title, resolve: (m, ctx) => assemble({ ...m, title: ctx.title }) });

export const WORLD_KINDS = {
  'galaxy-view':  view(assembleGalaxyScene, 'mojulo galaxy'),
  'orbit-view':   view(assembleOrbitScene, 'mojulo orbit'),
  // … every pattern-A kind is one line …

  'fractal-city': {
    title: 'mojulo city',
    walk: true,
    fogBoxes: (m) => planFractalCity(m).boxes
      .filter((b) => FOG_KINDS.has(b.kind) && b.z1 > (b.z0 || 0) && b.w > 0 && b.d > 0)
      .map((b) => boxFromFootprint(b, { up: 'z' })),
    resolve: (m, ctx) => assembleFractalCityScene({ ...m, time: ctx.time, sky: ctx.sky, groundShadows: ctx.groundShadows, title: ctx.title }),
  },
  'floorplan': {
    title: 'mojulo house',
    walk: true,
    resolve: (m, ctx) => assembleFloorWorldScene(m, { ...m, view: ctx.view ?? m.view, walk: m.walk ?? true, title: ctx.title }),
  },
  // … vehicle-instance, workbench (async textures), subway-building (explode) keep bespoke lambdas …
};

// Derived exports — the route keeps importing WALK_KINDS from world-scene unchanged.
export const WALK_KINDS = new Set(Object.keys(WORLD_KINDS).filter((k) => WORLD_KINDS[k].walk));
```

Notes on the shape:

- **`resolve` may be async** (workbench resolves wrap textures). `resolveWorldScene` already
  awaits, so descriptors returning promises cost nothing.
- **`walk: true` replaces membership in `WALK_KINDS`**; the exported Set is derived, so
  [/world route](../../../app/api/sketches/[ref]/world/route.js) semantics
  (`payload.walk || WALK_KINDS.has(kind)`) are untouched.
- **`fogBoxes` replaces `FOG_OCCLUDER_BOXES`** — same function, moved into the descriptor.
  The fog gate in world-scene becomes `registry[kind]?.fogBoxes`.
- **The room fallback stays a fallback**, not a registry entry: `assembleRoomScene` returns
  null for non-room manifests, which is the "no traversable form" contract callers rely on.
  `resolveWorldScene` keeps `(WORLD_KINDS[kind] ?? ROOM_FALLBACK).resolve(...)`.
- **The raymarch swap for painted-landscape** (`viewOpts.render === 'raymarch'`) stays in
  world-scene beside the channels — it is a payload *replacement* keyed on a render option,
  not a kind identity fact.

## Decision: central registry file, NOT colocated descriptors

Considered pushing each descriptor into its view module (`galaxy-view.js` exports its own
entry) with a thin central index. Rejected: the import list would still exist, every kind
would gain a second registration touch point, and the registry's value is precisely that a
kind's world-facing facts (title, walk, fog) are readable in one screen. Central file, one
line per simple kind. New-kind merge friction drops from three edit sites to one table row.

## Decision: characterization BEFORE refactor (the transcription-error net)

The refactor is mechanical, so the realistic failure mode is a per-arm slip: a title typo, a
dropped `{ ...manifest }` spread, `time`/`sky` not forwarded. Payloads are deterministic by
the substrate's own invariant (recipe → regenerated geometry, no RNG, no clock), so a full
content hash per kind is cheap and airtight:

1. Build a **fixture table**: `kind → minimal manifest`. Start every kind at `{ kind }`; where
   an assembler needs more to produce a payload (e.g. `vehicle-instance` wants type/family,
   `operator-world` wants nodes/edges), add the smallest fields that yield a non-null payload.
   The fixture table is itself documentation of each kind's minimum viable recipe.
2. Snapshot, per kind: `{ title, hash: fnv(stableStringify(payload)) }` (sorted-key stringify,
   same discipline as event-bus `ss`). Vitest snapshot file, one entry per kind.
3. Land the characterization test on the CURRENT ternary first. Then refactor. The snapshots
   must not change — any diff is a transcription error by construction.
4. Keep the test after the refactor (drop nothing): it becomes the standing guard that a new
   kind's registry row actually renders, and that edits to shared assemblers change payloads
   *consciously* (snapshot update = explicit acknowledgment).

Time-dependent kinds: none expected (frames are baked from the manifest, not the wall clock),
but if a kind hashes unstably across runs, pin whatever input drifts in its fixture rather
than weakening the hash.

## Build phases

1. **Characterization harness.** `world-scene.kinds.test.js`: fixture table + per-kind
   `{ title, payloadHash }` snapshots against the existing ternary. Also assert
   `WALK_KINDS` and the fog-capable kind set as literal snapshots (they must survive the
   derivation change bit-for-bit).
2. **Extract `world-kinds.js`.** Move the imports + arms into the descriptor map (helpers
   `view`/`spread` for the two dominant conventions; bespoke lambdas for planetary,
   fractal-city, transportation-hub, subway-building, floorplan, restaurant,
   vehicle-instance, workbench, assembler, controllable, operator-world).
   `resolveWorldScene` becomes: normalize ctx → lookup → resolve → channel layering
   (channel blocks byte-identical). Snapshots green.
3. **Fold the side tables.** `walk: true` flags on the nine spatial kinds → derived
   `WALK_KINDS` export; `fogBoxes` onto fractal-city → delete `FOG_OCCLUDER_BOXES`.
   Snapshots + the literal set snapshots green. No route changes.
4. **Docs + drift cleanup.** Update the world-scene header comment (the "one place" claim now
   names the registry), the CLAUDE.md architecture-map line if wording references the ternary,
   and the line-number references into world-scene.js from
   [action-world-mcp.plan.md](../action-world-mcp.plan.md) (`:317`, `:327` will drift).
5. **Verify.** `npx vitest run` on: the new kinds test, world-scene.test.js,
   education-module.test.js, actions-world.test.js, restaurant-world-scene.test.js,
   painted-landscape-world.test.js, plus the two route consumers' tests if any. `node --check`
   on both files.

## Non-goals

- **Abstracting the opt-in channel blocks** (motion/signage/physics/controllable/events/walk/
  fog) into a pipeline. Seven blocks, each genuinely different, each well-commented — a
  channel framework would trade readable specifics for indirection. They stay as-is.
- **Changing /world route walk semantics** (`payload.walk` vs kind default). Derived-Set
  export keeps the route untouched.
- **The mint-side triple-touch** (new MCP view tool → server.js registration → context.js
  TOOL_INDEX/ROUTING_INDEX). Real friction, different seam — if it gets a registry treatment
  later it should mirror this one, but it is out of scope here.
- **Colocating descriptors into view modules** (see decision above).
- **/svg and /scene dispatch.** stored-sketch-svg.js has its own small kind switches; those
  paths route per-kind differently enough that forcing them through WORLD_KINDS would smear
  the descriptor. Revisit only if a real sync bug between surfaces shows up.

## Risks

- **Fixture dead-ends**: a few kinds may not produce a payload from any small manifest
  (deep required structure). Acceptable escape: characterize those arms with
  `{ title, payloadIsNull: true }` or a slightly larger fixture lifted from that kind's own
  test file. Do not skip the kind silently — every ternary arm gets a snapshot row.
- **Hash brittleness vs shared-assembler churn**: edits to a shared helper (e.g. a palette
  tweak in scene-css3d) will touch many snapshots at once. That is signal, not noise — the
  update is one `vitest -u` reviewed in the diff — but batch such refactors separately from
  this one so the parity proof stays clean.
- **`viewOpts` forwarding**: only floorplan/restaurant read `viewOpts.view` and only
  painted-landscape reads `viewOpts.render`. ctx carries both; the characterization fixtures
  should include one floorplan case with an explicit `view` to pin the forwarding.
