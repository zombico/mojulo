# Dream-architecture — the metaprinciple as a bespoke-building tool

Status: EDIFICE TRACK E0–E5 LANDED (2026-07-15, working tree) — the bespoke
inhabitable-building tool is end-to-end: `create_edifice` mints a graph of masses +
concourses → walkable `edifice` WORLD_KIND + `.glb`, and the `dream-edifice` catalyst
drives the dream loop. Advisory-not-gated throughout (operator's building, operator's
call). Remaining: E6 (richer interior kernels + the other advisory checks + theme
reach) and the sibling MONUMENT track (Tool A). D3 resolved (real assembler, not
sculpture-via-workbench); D-mint resolved (dedicated `create_edifice` tool). Two
parallel dream tools for authoring *new, bespoke* 3D buildings out of the substrate's
own building grammar. Siblings to the figure/object dream loops
([character-from-dream.plan.md](../polygonizer/character-from-dream.plan.md),
`reconstruct-from-dream` / `mobile-suit-builder` catalysts,
[shape-from-dream.plan.md](../polygonizer/shape-from-dream.plan.md)) — same
dream→decompose→compose→render→compare loop, but the monomers are ARCHITECTURAL.

## What this is (and is not)

`fractal-city`, `fractal-school`, `transportation-hub`, `subway-building` are each
a **finished product** — someone applied the building method by hand and froze it
into a generator with its own closed dials. Those are done; dream-architecture is
NOT a driver for them.

Dream-architecture is for applying **the method itself** — the metaprinciple that
produced those generators — to dream up a *bespoke* building no existing generator
mints. It is the "make adjacent things outside the default settings" tool.

Two tools, because the substrate itself draws a clean seam between how a **monument**
and a **complex** are put together. They rhyme heavily (shared metaprinciple) but
must not conflate (you orbit one, you inhabit the other).

## The shared metaprinciple (why the two tools rhyme)

Every building in the substrate — a lattice-pylon landmark AND a fractal condo
complex — is built the same seven ways. This is the medium both tools compose in:

1. **One scale unit + one ground datum.** `side = min(w,d)`, `z0`. Every dimension
   is a multiple of `side` → the building is scale-invariant to its lot; one number
   resizes the whole thing.
2. **Recipe → plan → baked flat-Lambert faces.** Nothing stores a mesh. A face is
   `{ corners:[absolute world xyz], fill: pre-shaded hex }`. Smoothness is shading
   (`scaleHex(role, litFactor(normal, L))`), never polygon count.
3. **A closed generator vocabulary, never freehand.** Leaf atoms (`box`/`quad`/`tri`)
   + mid generators (`frustum` / `revolve(profile[])` / `prism(poly)` / `member` /
   `arch`). A dome IS a revolve of a `[height,radius]` table; a tower IS a z-stack of
   frusta; a cylinder IS a band between two equal rings.
4. **Placement by relation, not coordinates.** Radial array (angle loop), mirror
   (sign list `[[1,0],[0,1],…]`), z-stack (a named elevation table), or graph-edge
   (a concourse joining two masses). A part is a parametric closure applied at each
   placement — one level up from `create_workbench`'s `assembly:{on,gap,offset,radial,mirror}`.
5. **Role→hex palette, merged with an override, auto-shaded.** Recolor any
   architectural role without touching geometry.
6. **Curves are silhouettes faked with CSS `radius`/`clip`** where only the outline
   matters (arches, onion domes, clock faces); real sampled strips only where the
   profile matters (barrel vaults, catenaries).
7. **Determinism via labelled RNG sub-streams** (`stream(seed, ...labels)`), resolved
   enums recorded back into the plan, unimplemented names throw loudly.

## The fork (why they must not conflate)

|                | **Monument register** (landmarks)            | **Edifice register** (fractal complexes)                          |
|----------------|----------------------------------------------|-------------------------------------------------------------------|
| you…           | **orbit** it — a solid sculpted mass         | **inhabit** it — walkable                                         |
| IR             | a **DAG of placements** (symmetry-driven)    | a **plan graph**: mass-nodes `{rect,coreWall,openings,form,floors}` + edges `{concourse: from/to, hall, sides}` |
| skin           | per-part closures                            | **facade-cards + roof cappers**, fed once off `structureEnvelopes` |
| interior       | none                                         | chamber / hallway / unit-slot graph, furnished                     |
| generators     | frustum, dome, arch, lattice-beam, prism     | mass + facade + roof + interior-graph                              |
| correctness    | eyes only ("does it read as the monument")   | plan→defect assessments (flow / livability / egress / reachability) |
| rhymes with    | reconstruct-from-dream / mobile-suit         | (new) — the plan-is-truth discipline                               |

### Tool A — dream a bespoke MONUMENT / structure
The landmark register. Dream → decompose into the generator vocabulary → compose by
symmetry → render → compare → discard the dream. Eyes-only lock, discard-on-lock. No
assessments (nothing to inhabit). The 9 archetype recipes below are ready-made
templates the dream-read targets.

### Tool B — dream a bespoke INHABITABLE building (edifice)
The complex register. Dream → lay out the plan graph (masses + concourses) → skin
with facade-cards + roof → furnish → render walkable → compare. The four assessments
run and **report**; the operator locks regardless (see Doctrine).

## Doctrine — user control, advisory not gated

This is the load-bearing call (operator, 2026-07-15), and it aligns with the repo's
own golden rule ([responsibility-model](../../../docs/responsibility-model.md) /
[TERMS.md](../../../TERMS.md)): *capability/suitability judgments belong to the
operator, not mojulo.* A user's building is theirs.

- **Assessments are advisory, never a fence.** The four edifice checks (flow /
  livability = windows face open air / egress-stair fits / graph reachability) still
  run — but as feedback. A building with windowless units or an unreachable wing
  **still locks**. Mojulo surfaces the defects ("3 units face a solid; east wing has
  no path from the entrance") and the operator decides. This is the OPPOSITE of the
  game-completability gate, and correctly so: a broken game is non-functional, a
  "bad" building is still the building the user chose.
- **Suggestions vs. the medium.** Mojulo's kit is offered as DEFAULTS, freely
  overridden: archetype recipes, theme packs, facade rhythms, roof forms, palettes,
  livability conventions. What is NOT a preference is that the artifact stays a
  **deterministic recipe of generators** (boxes/frusta/revolves/facade-cards/roof/
  interior-graph), not a freehand mesh — that is the medium (recipes-not-renders),
  what makes it walkable, re-themeable, `.glb`-exportable. "Put whatever they want" =
  compose the generators however they like, including combinations no default would
  pick — NOT paste arbitrary geometry.
- **The one honest signal survives.** A form no generator reaches is a **named
  vocabulary gap** (a new generator to add), not a silent fake. Everything short of
  that — proportion, layout, palette, grafting a monument dome onto a walkable
  complex — is theirs.
- **Light loop, no gate ceremony (proposed).** Because the user owns the output, both
  tools lean toward `reconstruct-from-dream`'s discard-on-lock model — the dream is a
  reasoning aid, the recipe is the artifact — rather than character-from-dream's
  `dream_audit` + draft/approve split. (OPEN — see decisions.)

## The generator vocabulary (the medium, from the substrate)

### Monument generators (landmarks/index.js)
- Atoms: `lit(corners, tint)`, `tri(A,B,apex,tint)`, `cityBox(rect, z0, z1, colors, L, camHint)`.
- Radial/lathe family: `ring(r,z)`, `band(lo,hi)` (cylinder/frustum), `taper(r0,z0,r1,z1)`
  (cone), `drum`, `revolve(profile[])` → dome/onion (`[hf,rf]` table), `cap`/`fan` (close to apex).
- Prism/extrude: `prism(poly, za, zb)`, `star(r,lobe,points)`, hex family.
- Members: `strut`/`beam` (crossed billboard — the lattice trick) / `rod` / `rib` /
  `brace` / `spoke`.
- Arches: cheap (flat quad + CSS `radius`) or real (sampled strip around a semicircle/catenary).
- Massing post-pass: `inkConcaveSeams(boxes)` for free contact shadows.
- **9 archetype recipes** (the templates): lattice-pylon · drum-stack tower ·
  podium-body-spire (obelisk / setback-ziggurat) · domed-monument-with-radial-copies ·
  elliptical-bowl venue · pyramid · triumphal-arch/gateway · clock/gothic tower ·
  figure-on-pedestal.

### Edifice primitive kit (condo-entrance.js / facade-card.js / roof.js)
- Mass atom: `boxFaces(x0,x1,y0,y1,z0,z1,tint,light,{top,bottom})`.
- Placement oracles (split from emission, shared by plan/render/checks):
  `unitSlots(...)` (where units sit on a hall), `coreBankLayout(...)` (lift bank facing/offset).
- Emitters: `chamberFaces`, `hallwayFaces`, `curtainWallFaces`, `facadeColumnFaces`.
- Facade-as-card: `buildFacadeCard(facade, floors, bays)` → unit-square mark-card
  (`material {glass,brick,concrete}` × `rhythm {curtain,punched,banded,pier,grid,balcony}`);
  `projectCardOntoQuad` / `expandSurfaceCards` realize it as inset PROUD window geometry
  on any wall quad, `lit` applied at projection.
- Roof capper: `buildRoof(footprint, opts)`, FORMS = `hip · gable · pyramid · gambrel ·
  mansard · saltbox · shed · butterfly · flat-deck · stacked-room`, written once in
  canonical orientation via `orient()` + a `P(along,across,z)` mapper.
- Interior topology (three kernels to choose from): condo-entrance chamber+hallway+unit
  graph; `suite-layout` volume-chain (rooms + connector halls, doorways snapped to shared
  walls, per-volume lighting — the cleanest "allocate on an axis budget, then lock" example);
  `dungeon-designer` `{chambers,tunnels}` (organic, floor+ceiling, nothing flat).
- Furnish: room-parts / room-assets / kitchen-run.

## The plan-is-truth discipline (the edifice backbone)

The transferable skeleton for Tool B's assembler (from fractal-condo):
1. **Plan = a graph of typed mass-nodes + typed concourse-edges + recorded enum
   choices + bounds/spawn/entranceId.** One `plan(spec)` producer; `asPlan` guard.
   Both the renderer and the (advisory) assessments read this one object — geometry
   and checks provably cannot drift.
2. **Determinism = one labelled RNG sub-stream per knob**; resolved enums recorded back.
3. **Primitive kit = pure `(descriptor, o) → faces[]`** on an `axis`+`cAt` wall
   convention; placement oracles split out.
4. **Derive `structureEnvelopes` once**, feed every skin (facade columns, roof) from it.
5. **Detail-as-card**: author facades as unit-square cards, project onto quads.
6. **Cap via a form-dispatched roof capper** in canonical orientation.
7. **Assessments are pure plan→defect functions** re-deriving geometry through the
   SHARED oracles, returning `{necessary, preferential, impairment, ok}` — surfaced,
   not enforced.

## Open decisions (before build)

- **D1 — tool naming.** `dream-monument` / `dream-edifice`? Or `dream-architecture`
  as the umbrella over both, with two sub-modes? User called the overall thing
  "dream architecture."
- **D2 — provenance ceremony.** Discard-on-lock (light, proposed) vs. keep the
  `dream_audit` attestation for the trail. Leaning light per the user-control call.
- **D3 — the compositional target for Tool B.** There is NO architectural assembler
  today; each generator bakes its own plan→faces. Tool B's real substrate ask is a
  new "workbench-for-buildings" recipe grammar + a `WORLD_KIND` (e.g. `edifice`) over
  the plan-graph. Confirm we're building that, not riding `create_workbench` at
  architectural scale (which would throw away facade-card fidelity, roofs, walkable
  interiors, and the assessments — a sculpture of a building, not a building).
- **D4 — condo entry gap.** `condo-complex` exists as a walkable `WORLD_KIND` but has
  NO mint tool. Tool B naturally closes this (and generalizes past condos).
- **D5 — "outside the default" reach.** Theme packs only fully lower onto the `city`
  base today; no material/palette axis on most bases (the `mars-colony` honest limit).
  How far does v1 push new-theme authoring vs. staying in the generator kit?

## The edifice assembler — the design (D3 resolved)

The core artifact is a **bespoke inhabitable building authored as a graph**, not
seed-sampled. It composes by RELATION (mass B sits east of mass A), the way a
designer thinks and the way `create_workbench`'s assembly composes parts — one
level up. Nothing is hand-placed in absolute coordinates except the root.

### The recipe (what the user / dream authors)

```jsonc
{
  "kind": "edifice",
  "seed": 1,
  "units": "ft",
  "theme": "earth-temperate",          // suggested defaults; every field overridable
  "masses": [
    { "id": "commons", "at": [0, 0], "footprint": { "w": 60, "d": 44 }, "floors": 2,
      "form": "rect",                  // rect | round
      "facade": { "material": "glass", "rhythm": "curtain", "glass": "steel" },
      "roof": "flat",                  // a roof.js FORM | "flat" (commercial capper)
      "interior": { "kernel": "open" } // open | suite | chambers  (opt-in walkable inside)
    },
    { "id": "wing", "on": { "anchor": "commons", "side": "E", "align": "S", "gap": 10 },
      "footprint": { "w": 30, "d": 80 }, "floors": 3,
      "facade": { "material": "brick", "rhythm": "punched" },
      "roof": { "style": "gable" },
      "interior": { "kernel": "suite", "volumes": [ /* room chain */ ] } }
  ],
  "concourses": [
    { "from": "commons", "to": "wing", "width": 12, "kind": "hall", "sides": "both" }
  ],
  "entrance": "commons"                 // BFS root for reachability + spawn
}
```

- **Relative placement** (`on: {anchor, side:N|S|E|W, align:start|center|end, gap}`)
  is the "compose by relation" move — resolved topologically to absolute rects
  (root mass at `at`, each `on` snapped against its anchor's facing wall). This is
  the edifice analogue of workbench `assembly.on/gap/offset`.
- **Concourses** span the gap between two placed masses: the hall rect is DERIVED
  from the two facing walls + gap, and doorways/openings are punched into both
  (fractal-condo's `passageWalls` rule). `sides` picks single- vs double-loaded.
- **Interior is opt-in per mass.** Start with two kernels: `open` (empty walkable
  shell) and `suite` (the `suite-layout` linear volume-chain — cleanest, already
  does doorway-snapping). `chambers` (condo-entrance graph) and `dungeon` land later.
- **Facade / roof** default from the theme + mass height, fully overridable — a tall
  mass caps flat-commercial (parapet + bulkhead), a dwelling mass caps pitched.

### The plan-is-truth IR (`planEdifice(recipe)` → this; renderer + assessments read it)

```jsonc
{
  "kind": "edifice", "seed", "theme", "palette",
  "masses": [{ "id", "rect": {x,y,w,d}, "z0", "z1", "floors", "form",
               "facade": <resolved>, "roof": <resolved>, "interior": <resolved>,
               "openings": [ /* punched by concourses */ ] }],
  "concourses": [{ "id", "from", "to", "hall": {axis, rect, z0, z1}, "sides", "doorways" }],
  "envelopes": <structureEnvelopes>,   // derived ONCE; feeds facade columns, roof, fog, livability
  "bounds", "spawn", "entranceId"
}
```

### The build (all pure `plan → faces`)

1. `mass shells` — `boxFaces` per mass per floor stack (round → `roundTowerShellFaces`).
2. `facade` — `buildFacadeCard(mass.facade, floors, bays)` → `projectCardOntoQuad` on
   each EXTERIOR wall quad (walls touched by a concourse opening are skipped/cut).
3. `roof` — `buildRoof(footprint, roof)` (pitched) or the flat-commercial capper
   (parapet ring + bulkhead), dispatched off mass height / explicit `roof`.
4. `concourses` — hall floor + side walls (storefront gaps where `sides` carries
   units) + doorways snapped to the shared openings.
5. `interior` — per opted-in mass: `open` (nothing) / `suite` (`buildSuiteFaces`) /
   `chambers` (`chamberFaces`+`hallwayFaces`). Furniture via room-assets.

### The world seam

- New `WORLD_KIND` `edifice`: `{ walk: true, resolve: (m,ctx) => assembleEdificeScene(m,ctx),
  fogBoxes: (m) => planEdifice(m).envelopes.map(boxFromFootprint) }`. `ao` opt-in
  (interior-heavy). Payload carries `faces, cameras, walk, spawn, edifice: plan` +
  the assessment results.
- Advisory assessments (reuse the fractal-condo shapes, SURFACED not enforced):
  `assessEdificeReachability` (BFS over concourse graph from `entranceId`),
  `assessEdificeLivability` (each room/unit window probe faces open air = outside every
  envelope), `assessEdificeEgress` (each mass fits a stair), `assessEdificeFlow`
  (entrance/passage doesn't fire into a lift bank).

### The mint surface (D-mint, open)

Lean: a dedicated `create_edifice` MCP tool (the recipe is AUTHORED, like
`create_workbench` — not seed-sampled like the `compose_world` bases). Alternative:
`compose_world base:'edifice'`. Decision below.

## Increments (edifice track)

**Edifice first (the chosen track):**
- **E0 — hand-spike the recipe grammar (no new substrate).** ✅ LANDED (2026-07-15).
  `edifice.spike.gen.test.js` hand-authors a 3-mass campus (glass commons + brick wing
  placed E + glass annex placed N, 2 concourses) via an inline `planEdifice` resolver
  and builds it from `boxFaces` + `buildFacadeCard`/`projectCardOntoQuad` + `buildRoof`,
  emitting a walkable World + PNG. Proof:
  `lite-template/integration/0715/spike-output/edifice/`. **Every novel piece held:**
  relative-placement resolver (`on:{anchor,side,align,gap}` → absolute rects, verified
  wing E of commons), concourse derivation (hall rect from the two facing walls + gap),
  facade-card projection (glass curtain-wall AND brick-punched both read), three roof
  cappers (flat-deck / clay gable / shed), and the plan-is-truth seam (advisory
  reachability BFS reads the SAME plan — passed). Gaps surfaced for E1: (a) a concourse
  opens the WHOLE facing wall — needs a real doorway PUNCH keeping the wall above; (b)
  masses are hollow exterior shells — no per-floor slabs, no `open/suite/chambers`
  walkable interior kernel yet; (c) opened walls lose their facade; (d) round masses +
  theme-driven facade defaults unexercised.
- **E1 — `planEdifice` + `buildEdificeFaces` (the assembler core).** ✅ LANDED
  (2026-07-15). Real module `architecture/edifice.js` + `edifice.test.js` (15 green):
  the relative-placement resolver (topological, order-independent) → plan-is-truth IR
  (masses + concourses + envelopes + bounds + spawn) → mass shells + facade-card skin +
  roof cappers + concourse corridors. **Gaps (a) + (c) closed:** a concourse now cuts a
  real DOORWAY PUNCH (left pier / lintel / right pier; the door span stays a walk-through
  gap and the connecting wall keeps its facade above), not a whole-wall opening. Advisory
  `assessEdifice` ships reachability (SURFACED, never enforced — an unreachable mass is
  reported but the edifice still builds). Interior: the `open` kernel (walkable hollow
  shell on grade). The spike (`edifice.spike.gen.test.js`) is now the visual harness over
  the module. Still open: `suite`/`chambers` kernels + per-floor slabs (E6).
- **E2 — the `edifice` WORLD_KIND + `assembleEdificeScene`.** ✅ LANDED (2026-07-15).
  `assembleEdificeScene(manifest, ctx)` in `edifice.js` funnels the plan through
  `assembleBoxCityScene` (ground + soft diffusion + sky) and returns a walkable payload
  (`faces, cameras, walk:{eye,spawn}, edifice: plan, reachability`). Registered as
  `edifice` in `world-kinds.js` — `walk:true`, `fogBoxes` clipping against the
  mass/hall envelopes, honors `walk:false`. `WALK_KINDS` pin updated. Tests:
  `edifice.world.test.js` (3 green). (Pre-existing on-branch `workbench` snapshot drift
  in `world-scene.kinds.test.js` is unrelated — `workbench.js` was already modified on
  this branch; left for its owner.)
- **E3 — advisory assessments.** `assessEdifice{Reachability,Livability,Egress,Flow}`
  as pure plan→defect functions, attached to the payload, SURFACED not enforced.
- **E4 — `create_edifice` mint tool.** ✅ LANDED (2026-07-15). **D-mint resolved:** a
  dedicated `create_edifice` tool (`tools/edifice.js`), not a `compose_world` base —
  the recipe is AUTHORED (a graph), like `create_workbench`, not seed-sampled.
  Validates by planning at mint (bad placement / non-facing concourse throws), persists
  `kind:'edifice'`, warms the preview, returns `worldUrl` + `stats` + the advisory
  reachability (SURFACED with a `note`, never gated). Registered in `server.js` after
  `create_workbench`; indexed into `forward_context` (`context.js` TOOL_INDEX entry +
  a BUILDING routing row); tool description trimmed to 671 chars (under the 700
  ratchet — NOT a new offender). Tests: `tools/edifice.test.js` (4 green). (Pre-existing
  on-branch payload-pin overrun + 4 Codex description offenders remain the operator's to
  bless — plan.md housekeeping caveat.)
- **E5 — `dream-edifice` catalyst.** ✅ LANDED (2026-07-15).
  `catalysts/dream-edifice.md` — the dream loop over `create_edifice` (THESIS → DREAM
  flat/orthographic → SEE masses → READ skin → WIRE concourses → BUILD → WALK → COMPARE
  → SURFACE advisory → LOCK+DISCARD). **Discard-on-lock, NO dream_audit gate** (per the
  user-control doctrine — a user's building is theirs; the sibling `reconstruct-from-dream`
  model, not the gated `character-from-dream` one). Invariants encode advisory-not-gated
  + compose-by-relation + name-the-gap-don't-fake + bespoke-buildings-only. Auto-loaded
  by the catalyst loader (frontmatter valid; 21 loader tests green).
- **E6 — richer interiors + more advisory checks.** ◑ PARTIAL (2026-07-15). Landed:
  the **`suite` interior kernel** (`buildEdificeFaces` drops a `suite-layout` volume-chain
  of walkable rooms INSIDE a mass, inset from the facade which stays the outer shell;
  author via `mass.interior.volumes` or a synthesized default room chain) + the
  **livability (daylight) advisory check** (`assessEdifice` now returns
  `{reachability, livability}` — a mass boxed in on all four sides is surfaced as
  `no-daylight`, never gated). `create_edifice` surfaces defects across ALL checks in
  its `note`. Tests: +4 in `edifice.test.js` (26 total across the 3 files). Still open:
  `chambers`/`dungeon` interior kernels, per-floor slabs + stairs (multi-storey walkable
  interiors), the `egress`/`flow` advisory checks (they want the interior kernels), and
  theme/material reach (D5).

**Monument track (later — Tool A):**
- **M1 — monument catalyst** over `create_workbench` + the landmark generators, with
  the 9 archetypes as a vocab card. Eyes-only, discard-on-lock.

## Doctrine holds (inherited from the dream family)

- Recipes not renders: the building IS the recipe; renders are derived + discardable.
- Dream discarded on lock (dream is a reasoning aid, not the artifact).
- Two judges: the deterministic checks (advisory here) vs. the operator's eyes.
- Compose from generators, never freehand — a gap is NAMED, not faked.
- Closed vocabularies are DEFAULTS the user overrides, not fences.

## Out of scope (v1)

- Rewiring the finished generators (city/school/hub) — they are their own thing.
- Structural engineering / code compliance simulation (livability is affordance-level,
  and advisory).
- Per-building material physics beyond the existing vexar/facade-card shading.
