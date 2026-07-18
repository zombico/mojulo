start # Animal-from-dream — the parameterized-armature register of the dream loop

Status: proposed (2026-07-14). The THIRD register of the dream loop, sitting
between the human figure and the free polygomer. character-from-dream tunes a
FIXED humanoid armature; polygomerization bonds monomers on a FREE armature; the
animal kit is the missing rung — a **parameterized armature family** (the 12
quadruped archetypes) that dream tunes the same way it tunes a character. The
aim: make **dream the pipeline that generates new animals** — not just reproduce
the 16 curated species, but dream a novel / hybrid / mythical creature and
reconstruct it as a deterministic recipe.

## The register table (from shape-from-dream §10.1, completed)

The whole family is ONE loop split by **armature bind-freedom**:

| Register | Armature | What dream tunes | Entry |
|---|---|---|---|
| character-from-dream | FIXED humanoid | DIMORPH pole + proto multipliers + garment instruments | `create_figure` |
| **animal-from-dream** | **PARAMETERIZED (12 archetypes)** | **archetype + ~19 opts (skull/foot/fluff/antler/coat)** | **`create_animal` (ungraduated)** |
| shape/polygomerization | FREE (arbitrary manji-tree) | bond monomers | `create_manji_tree` |

The animal is neither the humanoid cage (which trapped fluff into always-
humanoid — the mega-boy wall) nor the fully-free object graph. The archetype is
a **lever, not a cage**, which is exactly why this register can author forms the
figure register structurally cannot.

## Why the substrate is already ~85% there

The animal kit (`figure-animal-*.js`) is a fully-built warp of the shared human
rig: same `figureJointGraph` / vajra specs, spine rotated vertical→horizontal,
four limb vajras → four legs, head re-seated (figure-animal.plan.md). It renders
through the **exact same vexar mesher** as `create_figure` and shares the fluff
register (`buildFluffs`). Three facts make it dream-ready:

1. **The dials are a closed, low-dimensional vocabulary an LLM can emit from
   looking.** `QUADRUPED_ARCHETYPES` (12, a coarse cladogram) + ~19 `buildAnimal`
   opts (skull/foot presets, fluffs, antlers, chains, coat/facePaint) — the same
   "tune, don't sculpt" surface that made character-from-dream converge in two
   passes. A body is an archetype + ~15 monotone numbers.
2. **`renderAnimalToSvg` is already manifest-shaped** (`{ archetype|species, opts,
   view, elev, crop, background }`) — it just has no non-test consumer. The
   render→Read→compare loop the dream needs is one call away.
3. **The manual zoo loop is already a dream loop run by hand.** zoo-mammals.plan.md's
   per-species method — *research photo → classify archetype → author ZOO_BUILDS
   data → render → self-judge → record lesson* — IS the dream loop's
   SEE→DECOMPOSE→BUILD→COMPARE, minus formalized eyes and minus a bindable
   output. This plan formalizes both.

## The two dream directions

**A. Dream → dials (eyes, the reconstruction move).** The worker dreams (or reads
a photo of) the animal in the **decomposable register** (flat, orthographic,
legible — never photoreal; the shape-from-dream constraint). The LLM does not
trace it — it TUNES: pick the archetype, set the opts, render `renderAnimalToSvg`,
compare, adjust (monotone dials — "longer neck / heavier haunch / add a hump"
are single moves). The dream sheet is discarded on lock; the ZOO_BUILDS-style
recipe is the sovereign artifact.

The **off-the-wall test** (zoo-mammals.plan.md) becomes the dream-read heuristic —
for each tell the agent sees in the dream:
- a **SHAPE signature** (a mass/silhouette feature) → volumize it (a dial, a
  fluff, an antler/tusk);
- a **NORMAL signature** (a marking that follows the surface) → recolor by face
  normal (countershading `underHex`/`overHex`);
- a **PATCH signature** (a localized mark — stripe/spot/mask that ignores the
  form) → **paint it** (direction B).

**B. Dials → dream (painter, the skin move — and the wall-breaker).** The animal
kit's named "single biggest gap" is **PATCH colour**: localized marks the
geometric coat can't do (tiger stripes, leopard spots, panda mask). That is
exactly what the skin-projection seam is for. The tuned animal renders as the
FILLED `?control=1` scaffold; the worker paints the stripes/spots/mask over it;
`skin_polygomer` projects the paint onto the faces from the shared camera — the
animal WEARS its pattern deterministically. **Dream-as-eyes (A) and dream-as-
painter (B) together close the kit's hardest wall without a new geometry
primitive.** The walls split cleanly: PATCH colour → paint; TUSK / wing-membrane →
small dream-driven geometry adds (like antler already is).

## The generative payoff — new animals, not just known ones

Because archetype + opts are continuous and composable (and `foreMode: tuck|wing`
already blends body plans), dream is not limited to the 16-species `ZOO_BUILDS`
roster. Tuning off a dreamed reference yields **novel / hybrid / mythical
creatures**: a griffin = avian fore + feline rear; a dreamed beast from a concept
sheet reconstructed archetype-first. Every dreamed animal that does NOT decompose
into the current dials **names the next dial to add** — the vocabulary-growth
flywheel zoo-mammals already runs, now driven by dream instead of by hand.

## Increments

1. **A0 — spike the loop by hand (no new substrate).** Drive the existing spike
   harness: dream a target animal (start with one in-cladogram, then one hybrid),
   tune `archetype`+`opts`, `renderAnimalToSvg` → `/view-svg` → compare, converge,
   record. Proves the character-from-dream convergence transfers to the animal
   dial-set BEFORE any graduation. Exit: two animals (one known-clade, one novel
   hybrid) reconstructed from a dream in ≤3 dial passes each, sheets discarded.
   Deliberately mirrors character-from-dream C0.
2. **A1 — graduate the animal to an asset (the PREREQUISITE).** The dream loop's
   honesty rule — *a claimed tune with no bound reference is invalid; the recipe
   is the sovereign output* — requires a persistable artifact. Fold in
   figure-animal-graduation.plan.md: `create_animal` MCP tool (a `species` enum
   over `ZOO_BUILDS` + an `archetype`+`opts` escape hatch; fail-loud at mint, no
   silent dog fallback), an `animal` branch in stored-sketch-svg.js, the PNG route
   (free), and `TOOL_INDEX`/`ROUTING_INDEX` rows so `forward_context` routes "draw
   me a deer / a creature." Same shape as `create_figure`. Fix the stale
   "dispatches kind:'animal'" comment in figure-render.js. **Nothing downstream is
   real until A1 lands.**
3. **A2 — the skin seam for animals (patch colour by paint).** Add a `control`
   mode to `renderAnimalToSvg` (filled + per-face `data-shade`, the manji lit-face
   contract — the same add C3 made to `renderFigureToSvg`), and kind-dispatch
   `kind:'animal'` in `get_skin_packet` / `skin_polygomer` / `?control=1` /
   `skin.png` (they already dispatch `figure` + `manji-tree`). Exit: a tiger's
   stripes / a panda's mask painted as a bound skin, worn deterministically — the
   PATCH-colour wall broken without new geometry.
4. **A3 — the animal-from-dream register (the driving loop).** A
   `reconstruct-from-dream`/character-from-dream sibling: the doctrine + the
   off-the-wall dream-read (§A/§B above) as an operator-drivable catalyst and/or
   the human-figure routing card's animal cousin. Teaches: dream in the
   decomposable register → classify archetype → tune opts → `create_animal` →
   render→Read→compare → paint patches via the skin seam → lock, sheet discarded.
   Include a `semantic_search` vocab card listing the archetypes (clade skeletons)
   + the `ZOO_BUILDS` roster (per the graduation plan's optional card), so the
   dream-read has a retrievable closed vocabulary.
5. **A4 — hybrids + vocabulary growth (the generative frontier).** Archetype
   BLEND for chimeras (front/rear body-plan mix beyond the existing
   `foreMode`), and the two named SHAPE-signature walls as small dream-driven
   adds: **TUSK** (a volumize sibling of `antlers`) and **wing/fin membrane** (the
   flat-sheet primitive the round vajra can't make — shared with shape-from-dream's
   membrane gap). Each dreamed animal that misses names the next dial; the flywheel
   grows the kit's vocabulary the way `structure` grows the scene vocabulary.

## A0 findings — the dream-read method (learned, 2026-07-14, squirrel)

First A0 run: a grey squirrel reconstructed off `rodent` in **two dial passes**,
sheet discarded. It confirmed the thesis (the character-from-dream loop transfers
unchanged to the animal dial-set) and, as designed, named the first gap. The
method that converged, codified so the next run doesn't re-derive it:

1. **Stay in form manipulation; never construct polygons.** The whole run tuned
   the parameterized armature (archetype + monotone opts) and let the shared vexar
   mesher build the mesh. We never touched the FREE register (manji-tree / monomer
   bonding). "Tune, don't trace" is literal: if a tell isn't reachable by a dial,
   that names a gap — it is NOT a licence to start sculpting geometry.
2. **Pick the nearest archetype, then scale via `armatureCfg`.** Never mint a new
   archetype for a species; the species stays DATA (`{archetype, opts}`).
3. **Dream-read = sort the tells into three signatures before touching a dial**
   (the off-the-wall test as a triage): SHAPE (silhouette/mass → a dial, fluff, or
   a named geometry add) · NORMAL (a mark that follows the surface → `underHex`/
   `overHex` countershade) · PATCH (a localized mark that ignores the form → paint
   via the skin seam, A2 — not faked in geometry).
4. **Pass discipline — change a SMALL, attributable set per pass.** Pass 1 =
   archetype + gross proportion + the single biggest tell. Pass 2 = fix only the
   two biggest read-breakers. Effects stay legible; ≤3 passes is realistic. (P1 →
   chunky bushy-tailed rodent with a beachball haunch + a down-drooping tail; P2 →
   negative-droop raised tail + `girthHind` 1.55→1.18 landed the read.)
5. **Judge on the 3-view render, weight the ¾.** Render lateral + three-quarter +
   one high-elevation; the ¾ carries the recognizability verdict, the high view
   reads dorsal features (tail-over-back, spine).
6. **Hard region → go head-first, and check the skull on a TURNTABLE.** For a region
   we've historically struggled with (the cat face), settle the skull/face fit against
   reference BEFORE the body — the body is the comfortable part. The head is also the
   part a SINGLE view lies about most: on the leopard, the hollow open-tube face only
   showed head-on, the pale interior scoop only at ¾, symmetry only from the top. So
   heads get their own check pass — the **`/skull-study`** skill renders any head
   (`ZOO_BUILDS` species, a bare archetype, or a `--recipe head.json` under tuning) as
   an azimuth turntable + top + under, cropped to the skull. Run it before/after tuning
   a head and after editing the skull builders. Its SKILL.md carries the **skull dial
   map** (length/width/dome/muzzle/snout/muzzleDrop/jaw/boxy + the welded-head-only
   `pad`/`bridge`/`capDepth`) so a turntable finding maps straight to a dial.

**Named-gap ledger (the flywheel's output — each miss names the next dial):**
- **tail carry-over-back** — the chain tail is a near-straight `core→root→tip`
  Catmull tilted by `droop` (vertical plane); negative droop RAISES it as a ray and
  a vertical wave bows it, but nothing biases the tip up-AND-forward, so the iconic
  squirrel/husky question-mark hook that curls over the spine is unreachable. The
  fix (a chain `carry`/arch: a forward-up tip anchor giving a real `core→root→mid→
  tip` hook) is not squirrel-only — it's any over-the-back curl. First library-add
  candidate.
- **feline body proportions + tail-at-sacrum** — ENCODED into the base feline protoform
  (2026-07-14, leopard tuning). Lessons from tuning the leopard body to the cougar
  reference: (1) don't over-bulk girths chasing "muscular" — feline defaults are ~0.95
  and real cats are LEAN; add depth via `thorax`/`belly` (chest), not by inflating every
  girth. (2) `thorax` sets BOTH chest depth and neck-root thickness — a slender neck with
  a deep chest = keep `thorax` up, pull `girthFore` DOWN (it scales the neckHub/throat
  radii). (3) the default `rump` 1.9 humps bear-like — cats want ~1.55. (4) `rumpCap`↑
  closes the skin over the haunch/tail root (no rump gap). (5) a felid tail roots at the
  SACRUM (top of the back), not mid-rump → new chain dial **`rootRise`** (lifts the chain
  root up the spine in STAND z; default 0, opt-in). All folded into `QUADRUPED_ARCHETYPES.
  feline` (leaner girthFore, compact trunk, tail `rootRise`+vertical wave); it merges under
  species overrides, so lion + cougar inherit the sacrum-attach for free (verified, improved).
- **seated (bipedal rock-up) posture** — the nut-holding upright squirrel needs a
  `spineTilt` rock-up on a quadruped archetype (as `kangaroo` did on `theropod`);
  the current rodent stays horizontal. Lower priority than the tail.
- **felid face is an open-ended tube (no face cap)** — RESOLVED (2026-07-14). The
  welded skull (`weldedSkull`, figure-animal-skin.js) is a `marchAxis` LATHE TUBE
  with no end faces: a long muzzle (wolf/bear) shrinks the front opening to nothing
  and hides it, but the short cat muzzle leaves it gaping, so from the FRONT you see
  into the head (hollow ring: brow arch + floating nose + see-through throat) and
  from ¾ you see its pale interior wall (a grey scoop). Confirmed a geometry gap,
  not a dial miss — a `plateMuzzle` slab, a big-head fuller cone, and a forward
  face-cap OVERLAY all failed (a forward disc is edge-on from ¾; an overlay z-fights
  and shows the interior between the two surfaces).
  **The fix that landed:** a self-scaling **front cap in `weldedSkull`** — after the
  march, close the frontmost ring with a rounded cap fan (front ring → forward apex,
  hemispherical profile, depth = the opening's mean radius). It follows whatever
  outline the muzzle+jaw opening has, so it caps every family's head; long muzzles
  get a negligible cap (wolf verified unchanged), short muzzles get a real closure.
  One shared ~12-line change fixed leopard AND the existing cougar (its hollow face
  closed for free), no regressions. Recipe side for a cat: omit `facePaint.snoutHex`
  (→ coat-tan upper muzzle, the cap inherits coat), keep `mouthHex` pale (chin), and
  push `noseFwd`≈0.3 so the nose seats on the capped muzzle front. The separate
  face-cap overlay primitive I first tried was removed as redundant — the source-level
  cap is the clean fix. **Lesson: an open marched tube is closed AT THE MARCH, not by
  overlaying a second surface.** Follow-on muzzle-SHAPE dials then landed in `weldedSkull`
  (opt-in, default-neutral so long muzzles are untouched): `pad` (whisker-pad masses →
  a wider squared front — keep small, the cap radius tracks the opening), `bridge` (a
  raised nasal ridge between the eyes), `capDepth` (`<1` = flatter/shorter/squarer front).
  Verify heads on the `/skull-study` turntable.

## Doctrine holds

- Recipes not renders: the animal IS `{ archetype, opts, skin? }`; the sheet /
  skin are bound derived renders with provenance. Dream sheet discarded on lock.
- Tune, don't trace: closed vocabularies only — no freehand geometry from the
  dream; every dial already exists (archetype + opts) and is clamped.
- Two gates: deterministic (valid archetype/opts at mint; the render succeeds) vs
  the rider's eyes (does it read as the creature).
- The skin is albedo, the kit is form: patch colour is PAINT over a deterministic
  body, never a stored raster standing in for the recipe.
- Same armature, different bind-freedom: this register reuses the human rig +
  vexar mesher + fluff + skin seam unchanged; only the archetype warp and the
  opt vocabulary differ. Do not fork the mesher or the skin projection.

## Out of scope

- 3D exports (`/model.glb` · `/world`) for animals — SVG-first, like figure;
  the manji-tree/figure 3D-skin leg is a later, separate lowering.
- Gait / motion GIFs — animals have no quadruped walk substrate yet (its own
  effort); ship stills first (graduation plan non-goal).
- A curated preset gallery UI — the `/sketches` listing already surfaces minted
  assets.
- Non-quadruped bodies (crawl / slither / swim) beyond what the archetypes +
  chains already cover — a figure-animal.plan.md direction, folded in only as the
  dream surfaces demand for it.
- Automatic image→mesh reconstruction / photogrammetry — violates recipes-not-
  renders; the LLM eye + the closed dial vocabulary is the reconstructor.

## Relationship to the other registers

- **character-from-dream.plan.md** — the sibling FIXED-armature register; A2 reuses
  its C3 skin control-mode add verbatim, one kind over.
- **shape-from-dream.plan.md §10.1** — the bind-freedom framing this plan completes
  (animal = the middle rung). shape-from-dream's DF (fluff robot) and this plan
  both prove the same thesis: the armature is a choice, and dream tunes it.
- **figure-animal-graduation.plan.md** — folded into A1 (the asset graduation is the
  prerequisite, not a parallel effort).
- **zoo-mammals.plan.md** — the FORM/DECORATION strata + the off-the-wall test this
  plan turns into the dream-read heuristic; its PATCH-colour + TUSK walls are A2 /
  A4 targets.
