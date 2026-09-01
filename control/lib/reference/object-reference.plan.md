# Object reference — reading a photo into a superposed block-out

Status: rev 4 (2026-08-31). The `object` target ships one-shot AND segment-first, multi-pass
now FUSES, and the lowering is under test (§11). The first §10 proof subject is RUN against a
real photo — Boars Head Lighthouse, three fused passes, and it taught four things the
synthetic runs could not (§12). Owed: the second proof subject, and the turntable eyes gate.

> **rev 2 supersedes rev 1.** Rev 1 planned a fresh decomposition protocol
> built on a CLEAN PART PARTITION, scored by absolute-z proportions, and
> named "no boolean subtraction" as the headline ceiling. All three are
> wrong against house doctrine. Superposition is not a tolerance the
> substrate grants — it is the construction METHOD
> ([mobile-suit.md](../graph/sketch-vocab/mobile-suit.md)), and the method
> for photo→recipe already largely exists as the
> [reconstruct-from-dream](../mcp/catalysts/reconstruct-from-dream.md)
> catalyst. See §2.

## 1. The gap (unchanged, still the real one)

`lib/reference/` knows three targets — `scene`, `pose`, `landscape`
([index.js:70](index.js)) — and has **zero** references to `workbench` or
`assembler`. There is no `object` target. That much rev 1 got right.

## 2. What superposition changes

### 2a. Boxiness is IMPLIED, not cut

[mobile-suit.md:30-38](../graph/sketch-vocab/mobile-suit.md) — "Lathes
want tubes / barrels / drums / beads. Don't fight them into cubes. Boxy
industrial hardware is an *illusion* built with four moves":

- **repetition** — rows of identical short lathes read as louvers/treads
- **tint** — near-neighbour greys read as panel breaks
- **scale contrast** — one fat drum beside thin struts reads as a housing
- **overlap (superposition)** — "let parts interpenetrate; overlap reads
  as plating over a frame. **Do NOT demand clean separation** — that's
  where the construction-machine look comes from."

And the closing rule: "**DON'T separate every part cleanly —
superposition is the armor.**"

**Consequence for rev 1's headline.** I named the lighthouse's arched
doorway and windows as recesses requiring boolean subtraction, and
routed them to Blender. Wrong. You do not cut a recess — you **superpose
a dark-tinted inset mass**. The z-series vocab does exactly this
throughout: *"gaiter fill: superposes a shell-colored truncated cone plus
dark seam"*, *"let the superposition"* carry the read rather than adding
backing plates ([z-series.md](../graph/mobile-suit/vocab/z-series.md)).
Tint + overlap does the work cutting would. **The boolean ceiling is not
on the critical path for this subject class**, and the Blender step is
for finish and fidelity, not for making the block-out legible.

### 2b-pre. Not a contest — ONE vocabulary, three moves

Rev 2 (and the first pass of §6) framed this as superposition VS clean
separation, winner take all. That framing is wrong and is retired. Both are
first-class MOVES in one composition vocabulary, chosen per junction:

- **stack** — seat B on A's top. Exact, cheap, no z-fight risk. Coaxial
  masses: tower → deck → lantern → dome.
- **jut(f)** — sink X into Y so only a fraction `f` protrudes. **`f` is a
  DIAL, not a binary**: f≈0.25 a boss/rivet/recessed frame, f≈0.5 a sill or
  ledge, f≈0.9 a shelf. This is the move that expresses "X on a Y, jutting
  out just enough."
- **composite outline** — union several primitives to author a SILHOUETTE no
  single primitive has. Irregular natural masses: rock, foliage, terrain.

A protocol that picks one policy globally is the error. The reading step
should CLASSIFY each junction into one of these three.

### 2b. Overlapping parts are the goal, so a partition-shaped protocol is wrong

Rev 1's read protocol asked for a clean decomposition with per-part
disjoint extents, and a gate that measured those extents. Under
superposition, parts are EXPECTED to interpenetrate — a gate premised on
disjointness would fire false warnings on correct work. The reading
question is not "what are the object's disjoint pieces" but "**what
masses, overlapped, read as this thing**". Fewer, fatter, deliberately
overlapping monomers beat a faithful partition.

### 2c. Compose by relation, not coordinates — so the rev 1 gate scored the wrong number

The catalyst's invariant: *"Compose by RELATION, not coordinates. Declare
each part's SIZE and how it CONNECTS (`on`/`gap`/`offset`/`radial`/
`mirror`), never a hand-computed z."*

Rev 1's proportion ledger scored absolute `zBase`/`zTop` drift. But under
relational `assembly.parts`, running z is **computed for you** — it
structurally cannot drift, so the ledger would mostly measure zero and
call it success. The number relational composition does NOT fix is
**size**: each monomer's height and radius are still declared by hand and
are exactly where a read goes wrong. Retarget the gate to size RATIOS
(§4).

### 2d. Segment-first is the proven path, and one-shot is the proven failure

*"don't one-shot a complex whole — the whole-body blockout was the proven
failure mode."* The lighthouse is a **complex** target by the catalyst's
own test (distinct seams: tower / island+stairs / water base / props), so
it goes segment-first: each segment its own workbench sketch judged in
isolation, composed last with `create_assembler`. Rev 1 filed that as
"P2 diorama mode". It is P0.

### 2e. Identity lock was missing entirely

Step 0 of the proven method, and the single most load-bearing one:
*"Reduce the target to ≤5 named, repeatable traits… restated on EVERY
subsystem. This one line is the anti-drift device."* Rev 1's nine-step
read protocol had no anti-drift device at all. For this image:
*"stylized isometric lighthouse diorama — cream tapered tower, red
cupola + collar bands, purple faceted rock island, pale stair flight,
round water tile."*

## 3. Therefore: the gap is an ENTRY POINT, not a method

The method exists and is proven. What does not exist is a **photo-fed
front door** to it, and **durable state** underneath it.

### 3a. The photo replaces the dream — the easier half

`reconstruct-from-dream`'s most fragile step is step 2 DREAM: it needs an
image worker (native image-gen, else a ComfyUI probe at `:8188`, else
stop — "no eyes, no loop"). That step exists solely because *"the LLM
cannot draw, but it can see."*

**With an operator photo, the whole capability ladder collapses.** The
image is given; nothing must be generated. Better still, the catalyst
tells the worker to dream in a *"decomposable register — an untextured
grey clay model, primitives with visible seams, honest proportion, no
colour or texture"*, because a photoreal reference is un-decomposable.
The lighthouse reference **already is** essentially that register: flat
stylized shading, visible primitive seams, honest proportion, clean 3/4
view. It is the ideal input, not a hard case.

So the new capability is `reconstruct-from-dream` **minus** its riskiest
dependency. That is a strong reason to build it.

### 3b. What the catalyst lacks: durable state

A catalyst is instructions — ephemeral. A segment-first build of ~6
segments across many turns has no anchor: lose context and the identity
lock, the part-graph, and which segments are locked are all gone. The
reference stash is exactly that anchor, and "resumable cold" is the
bicycle doctrine ([docs/bicycles.md](../../../docs/bicycles.md)).

**Division of labour:**
- **catalyst** = the method (how to look, how to build) — exists.
- **`capture_reference({ target:'object' })`** = the state (identity
  lock, part-graph, per-segment refs, what's locked, caveats) — the gap.

## 4. The machine gate, retargeted

Not absolute z (§2c) and not disjointness (§2b). Score **size ratios**,
which relational composition does not fix and a read gets wrong:

```
ledger: [
  { id:'tower',  declared:{ heightFrac:0.52, aspect:2.9 },
                 measured:{ heightFrac:0.49, aspect:3.1 }, ok:true },
  { id:'cupola', declared:{ heightFrac:0.12, aspect:1.1 },
                 measured:{ heightFrac:0.19, aspect:0.7 }, flag:'heightFrac +0.07' },
]
```

`heightFrac` = the part's height over the assembly's total; `aspect` =
height over max radius. Both are read off an image reliably, both survive
overlap (a ratio does not care that neighbours interpenetrate), and both
are computable from `stats.parts[]`, which already reports per-part size
and base/top z. Advisory, never gating; rides out in `stats.warnings`
beside the existing float/sink and closure warnings.

Also drop rev 1's implied "parts should not overlap" check before it is
written. **Overlap is correct output.** If anything is worth flagging it
is the opposite — a part touching nothing, floating free of every
neighbour.

## 5. Sequence (revised)

1. **P0 — `object` target as the durable anchor.** Protocol content
   (identity lock + superposition-aware reading order + the four
   boxiness moves) and a lowering that mints per-segment workbench
   sketches plus the composing assembler. Segment-first from the start.
   No new geometry, no migration.
2. **P1 — the ratio ledger** (§4).
3. **P2 — catalyst v4**, or a `reconstruct-from-photo` sibling: same
   method, step 2 swapped from DREAM to READ THE OPERATOR'S IMAGE, and
   step 10 LOCK writing through to the `object` stash so the build is
   resumable.
4. **P3 — reference-matched camera.** Honour a declared `view:{az,el}`
   so the compare step puts two comparable images side by side.
5. **P4 — `creature` sibling target** aimed at the manji-tree, for the
   organic class the workbench does not serve.

Blender stays where the doctrine puts it: downstream finish and fidelity
via `export_model` → GLB/STL, reached once the block-out reads. It is not
needed to make the block-out legible (§2a).

## 6. The A/B/C test — RUN 2026-08-31

Rev 2 argued superposition from doctrine. Doctrine is not evidence, so the
lighthouse was built BOTH ways from one generator whose only variable is
superposition policy — then a THIRD time (C) using both moves deliberately (`scratchpad/lighthouse/gen.mjs`; refs `lh2_a_sup` /
`lh2_b_sep` head-on, `lh3_a_sup` / `lh3_b_sep` at the reference's 3/4).
A = 52 monomers, B = 49. Same skeleton, same tints, same camera.

| # | junction | A superpose | B separate | winner |
|---|---|---|---|---|
| 1 | rock island | 3 overlapping tapered masses → irregular silhouette | 1 prism → reads as a **hexagonal block** | **A, decisive** |
| 2 | stairs → island | upper treads drive 1.8 into the rock face → "cut into the rock" | flight shifts out 3.1 to clear it → **detached, parked in front** | **A, decisive** |
| 3 | doorway | stone surround + dark mass sunk into the wall → real depth | frame proud of the wall → flat applied badge | **A, clear** |
| 4 | windows | sunk navy insets → read as openings | proud outlines → read as decals | **A, clear** |
| 5 | tower→deck→lantern→dome | fine | **equally fine**, 3 monomers cheaper | **tie / B** |

### The quantitative result — clean separation over-constrains the height budget

The decisive finding is not aesthetic. Every joint A overlapped, B had to
stack, and the denied overlap accumulates monotonically up the stack:

```
A superpose  total h = 62.8   tower base 19.6   dome base 54.8
B separate   total h = 67.8   tower base 24.0   dome base 59.0   (+8.0% / +4.2)
```

Under clean separation `total = Σ part heights` — an **over-constrained**
system. A reference image gives you BOTH the part proportions AND the
total, and clean separation cannot satisfy both: you must either shrink
parts away from what you read, or accept the total drifting. Under
superposition the overlaps are **free variables that absorb the slack**,
so the read proportions can be honoured literally.

**This retroactively justifies §4's ratio ledger — and only under
superposition.** Run the ledger against a clean-separation build and it is
unsatisfiable by construction; the agent would chase it forever.

### C — the mixed build (`lh5_c_mix`), and what it taught

Neither A nor B is the answer; the vocabulary of §2b-pre is. C applies all
three moves per junction — stack for the lantern column, jut(f) for
plinth / door / windows / deck / foliage, composite outline for the rock —
and reads better than either pure policy at 58 monomers.

Two rules fell out of building it, both learned by getting them WRONG first:

**RULE 1 — a superposed mass only reads if it breaks the host's
silhouette.** C's first pass buried five secondary rock masses inside the
primary cone. Result: the rock got *smoother* than A's, not more irregular.
Every one of those monomers cost budget and contributed exactly nothing.
The fix was to push each outcrop's centre out until `dist + r_outcrop`
exceeded the primary's radius at that height by ~3 (≈20–25% of host
radius). "Juts out just ENOUGH" is a real lower bound, not a stylistic note.

**RULE 2 — jut, don't touch.** C's water plate was seated exactly on the
tray's floor top; coplanar faces z-fight and the floor won, so the water
vanished. A jut of 0.12 fixed it. Clean separation's hidden cost is that
*flush* and *coplanar* are the same number.

### The new gate this suggests — a contribution check

Rule 1 is cheap to approximate and worth more than the float/sink warning:
**flag any monomer whose bounding volume lies entirely inside the union of
the others.** It contributes no silhouette and no visible surface, so it is
dead weight in the recipe and a sign the author meant it to jut. Composes
with the §4 ratio ledger; advisory, never gating.

### Honest residual

Faceted lathes (`harmonics` + low `crossSections`) are the right constituent
for rock — far better than the tapered hex prisms of A. The remaining
softness is the grass cap, which the outcrops now pierce so it reads as
scattered tufts rather than a cap. Tunable, not structural. Nothing about
the boolean ceiling showed up as a limitation anywhere in the test — §2a
holds.

## 7. Blender pass + evaluation vs the reference (2026-08-31)

Ran two DIFFERENT loops that both count as "through Blender":

**(a) The GI-bake bicycle** (`bake-world-gi.mjs`) — bake light into the recipe's
own vertex colours. Two blockers, both fixable, neither fatal:
- no adapter matches `kind:'workbench'` (`GENERATED_KINDS` has no entry);
  forced with `--adapter generated-mesh` and it ran.
- **MACHINE GATE FAILED**: *"41% of lit-paint floor faces received almost no
  light."* Cause is the workbench's measured STUDIO GRID, which `export_model`
  ships inside the GLB — 62 large dark quads a terrain-calibrated gate reads as
  unlit floor. The gate behaved correctly; it is miscalibrated for object
  studies. **Fix: exclude the studio grid from `export_model`** (it is
  authoring scaffolding, and it would also be sliced on a print handoff), or
  give the bake an object-study adapter that ignores it.

**(b) Blender as renderer** — `export_model` → GLB → vertex colours wired to
Principled → sun + sky fill → camera at the reference's 3/4. This works and is
the honest way to see the block-out finished.

### Evaluation vs the reference image

| # | finding | status |
|---|---|---|
| 1 | proportions: island too short, shaft too tall | **PREDICTED by §4's ledger, then FIXED** (see below) |
| 2 | lantern renders dark navy, not bright glass | **root-caused + fixed** — see the material finding |
| 3 | door/windows dissolve into grey smudges once lit | **root-caused** — the jut dial is renderer-dependent |
| 4 | missing props (brass lamp, observation post, foam ring, corner tabs) | authoring budget, no capability gap |

### The material finding (new, verified, highest-value)

`material` presets bake a Blinn-Phong response (`glass` is
`{ambient:0.30, diffuse:0.42, opacity:0.5}`) INTO the exported vertex colours,
because the runtime is unlit. Re-lighting in a DCC **double-shades**. Verified
by A/B (`lh6_d_prop` → `lh7_e_flat`): identical geometry, identical lighting,
`material:'glass'` removed → dark navy band became bright pale. **For a lit
external destination, use plain `tint`.** Recorded in the workbench card as a
handoff caveat, and it belongs in the honest-loss ledger of any DCC handoff.

### What the proportion fix actually taught — P1 is a LOWERING, not a checker

`lh6_d_prop` authored the z bands FROM the target fractions (fix `H`, express
each band as a fraction, compute running z). The ledger then read **0.000
delta on all five bands** — trivially, because drift cannot occur when z is
derived from the proportions rather than accumulated.

That is the real lesson, and it downgrades the ledger-as-checker:
**the value of §4 is as a LOWERING DISCIPLINE, not as a gate.** Author from
proportions and the failure mode disappears; the residual gate only needs to
catch hand-placed monomers that bypass the lowering. Build P1 as the lowering
first, the check second.

The fix was also visibly right in the lit render — the island reads chunky and
the tower stubby, matching the reference's mass distribution, which the
pre-fix build did not.

### Corrections to earlier passes of this plan

- Rev 1's "no boolean subtraction" ceiling never once bit across five builds.
  Recesses are `jut(f)` with a dark tint. §2a stands.
- I briefly recorded that 77% of the GLB was studio grid. **Wrong** — an
  artifact of culling in glTF-local (Y-up) coordinates against world-space
  thresholds. The true figure is 62 faces. The grid is still worth excluding
  (it fails the bake gate and would be sliced), but it is not bulk.

## 8. Generalising to arbitrary images (objects first, then scenes)

Goal: any image → block-out, not just an already-decomposable one. The framing
"blenderify the PNG, then run the loop" assumes REGISTER is the blocker. It is
one of three gates, and not the one most likely to bite.

### 8.1 Three gates, checked in this order

1. **Domain gate — is the subject an assembly of primitives?** Furniture,
   vessels, tools, machines, props, vehicles, architecture: yes. An organic
   single mass (a running animal, a face) is the figure family's job. **No
   image conversion changes this answer**, so ask it first and stop early.
2. **Perspective gate — see §8.2. The real new risk.**
3. **Legibility gate — can silhouette, part seams and part count be read?**
   This is the only gate the conversion ladder (§8.3) addresses.

### 8.2 Perspective — the risk is real, but the capability is ALREADY SHIPPED

Everything §7 established rests on authoring z FROM proportions read off the
image. That works on the lighthouse because it is **near-orthographic** — the
`clay-render` preset explicitly locks *"near-orthographic framing, minimal
perspective distortion"*, which is exactly why dreamed references are readable.

A general photo is not orthographic. Near parts subtend more pixels, verticals
converge, and a pixel-space `heightFrac` is simply wrong. **Both P1's lowering
and P1's ledger degrade silently** — they will converge on wrong proportions
and report a clean 0.000 delta. Confident and wrong is the worst failure mode.

**Do not build anything for this.** Perspective matching from a photo is a
shipped capability, discoverable as the `photo-reference` routing entry
("Build from a photo you can see") and enumerated by
`get_creative_toolset({ form: 'reference' })`:

- `reference_protocol({ target:'scene' })` — the extraction protocol: horizon,
  the two vanishing points, floor convergence, depth falloff, relative scale.
- `capture_reference({ target:'scene' })` — files the read and mints a
  two-point camera CAGE (preloadable, re-camerable) into a stash.

The object path CONSUMES this; it does not reimplement it. The output that
matters is already the right shape:

| scene dial | what it does for the object read |
|---|---|
| `roomBasis.verticalUnit` | **px per world-height unit — the pixel→world scale bar.** Compute band heights as `pixels / verticalUnit`, then take fractions of THAT. This is the whole fix. |
| `roomBasis.depthReach` | depth falloff, for parts at different depths |
| `camera.horizonY`, `vanishingPoints` | the frame the read is made in |
| `roomBasis.worldExtent` | absolute units, when the operator grounds a real dimension |

So the rule for the object protocol is a ROUTING rule, not new machinery:

> If the image is not near-orthographic, run the `scene` pass FIRST and read
> proportions in world units (`px / verticalUnit`), never in raw pixels.

And the two passes share one anchor for free: `capture_reference` already takes
`stash_ref`, so the scene camera and the object part-graph file into the SAME
stash. The durable anchor of §3b is therefore already the right container for
both — no new state shape.

Inherited ceiling, already stated in the scene protocol: affine two-point only,
no lens intrinsics, wide-angle barrel distortion is FLATTENED. Practical rule —
a stepped-back long-lens shot reads well; a close-up phone wide-angle is the
worst case. Say so rather than emitting a confident wrong ledger.

### 8.3 The conversion ladder — a rung, not a stage

- **Rung 0 — read the ORIGINAL directly.** Zero dependency, zero invention.
  Always try first; for a clean product shot it is usually enough. The
  lighthouse was done this way.
- **Rung 1 — deterministic de-texture** (`clayify.mjs`: luminance → auto-level
  → edge-preserving smooth → posterise to N bands → sobel seam overlay).
  `sharp` only, already a dependency. **Cannot hallucinate** — every pixel is
  derived from the original. Verified working.
  *Honest limit, observed:* posterising luminance **conflates dark albedo with
  shadow** — the purple rock collapsed to near-black and lost its internal
  form. A deterministic pass cannot separate albedo from illumination.
- **Rung 2 — generative clay conversion** (ComfyUI img2img/ControlNet with a
  structure-preserving conditioning + the `clay-render` preset). Best
  legibility, and the only rung that solves rung 1's albedo/shadow conflation.
  **It INVENTS geometry.** Currently unavailable — the local worker is down
  (`:8188` refused).

### 8.4 The guard that makes rung 2 safe

**The converted image may inform the READ. The ORIGINAL is the only valid EYES
GATE.** Never compare a block-out against the clay intermediate — you would
faithfully reconstruct a hallucination and the ledger would applaud. This is
the existing catalyst invariant ("the raster is discarded scaffolding") applied
to conversion rather than to dreaming, and it is why rung 2 is safe to use at
all despite inventing.

### 8.5 Then scenes

Deliberately after objects. The composition is already implied by §8.2: the
`scene` target recovers the camera and room basis, N `object` reads recover
each subject, and placement is the assembler / world layout. Objects first is
the right order because the scene case needs the object case to be reliable
before it can be evaluated at all.

## 9. First execution on a real photo — moka pot (2026-08-31)

Subject found by web search, not supplied: a CC BY-SA stainless moka pot photo
from Wikimedia Commons (`Moka pot components assembled.png`). Deliberately NOT
the near-orthographic register the lighthouse had — a close 3/4 elevated
product shot, specular metal, lid open.

**The whole path ran:** `reference_protocol({target:'object'})` →
`capture_reference({target:'object'})` → a `kind:'workbench'` recipe (9
monomers, 2 stack / 7 jut) → gates → `/world` render → `export_model` GLB →
Blender. Cage `sk_9qvy6t5789`, stash `st_fd3afeb089fc`. The block-out is
recognisably a moka pot: conical boiler, gasket band, straight upper chamber,
flared rim with a dark open mouth, hooked handle, valve nub.

### 9.1 The perspective conclusion — §8.2 was PARTLY WRONG

Three corrections, in increasing order of importance:

1. **The `scene` target does not apply to the common object case.** A product
   shot on a seamless backdrop has no horizon, no floor quad and no vanishing
   points — `scene` has nothing to recover. The §8.2 routing rule ("run the
   scene pass first") is right for an object sitting IN a room and useless for
   an object on a backdrop, which is most reference photography.
2. **The right cue for a standalone object is a known-circular feature's
   ELLIPSE.** `minor/major = sin(elevation)`. The pot's rim gave ≈0.32 →
   el ≈ 20°. No scene, no second tool, no dependency — and it is available on
   almost any manufactured object (a rim, a base, a bore, a wheel).
3. **Uniform vertical foreshortening CANCELS in band fractions.** This is the
   one that matters. Because P1 reads every height as a FRACTION of the total,
   a uniform vertical compression divides out of both numerator and
   denominator. The proportion discipline is therefore far more robust to
   perspective than §8.2 feared.

   What does NOT cancel: (a) the RADIUS-to-height ratio, because horizontal and
   vertical scales differ by `cos(el)` — radii must be divided by the
   ellipse-corrected horizontal scale; and (b) genuine perspective divergence
   (near parts vs far parts), which stays small for a stepped-back shot.

   So perspective correction is needed for RADII, not for the band fractions.
   §8.2's framing of perspective as "the headline problem" is downgraded: it is
   a radius-scale problem, not a proportion problem.

### 9.2 Result vs the photo

Right: silhouette, band proportions, the gasket, the open mouth, handle hook,
valve. Wrong:

| # | finding |
|---|---|
| 1 | **~19% too slender** — model height/max-diameter 2.38 vs a real moka pot's ≈2.0. A radius-scale error, exactly the residual §9.1(a) predicts. Needs a second view or one grounded dimension. |
| 2 | **The lid flap vanished** and the contribution check did NOT catch it (see 9.3). |
| 3 | Handle is a round tube, not the flattened wedge — declared in caveats, still visibly wrong. Sweep has no cross-section control. |
| 4 | Stainless reads as flat grey. The subject's identity is largely SPECULAR, and a tint-only recipe cannot carry that. |

### 9.3 The contribution check is too conservative — demonstrated

`buried: []` while the lid flap was in fact swallowed. The check tests AABB
containment against a SINGLE other part; the flap was enclosed by the UNION of
rim + upper + cavity. Fix: test against the union (voxel or occupancy
approximation), or at minimum against the union of parts that overlap it. The
conservative version under-reports exactly the case it exists to catch.

### 9.4 Two protocol lines earned

- **State the view so the identifying feature is in PROFILE, not pointing at
  camera.** Pass 1 set `view.az` to the wrong quadrant and the handle — the
  most identifying feature — foreshortened into a vertical strip on the body.
  Cheap to fix, easy to miss, and it makes the eyes gate useless when wrong.
- **A lathe is a SOLID of revolution and cannot be hollow.** An open vessel
  reads only if a dark mass caps the mouth at or just above the rim top. There
  is no shelling on the lathe monomer (`extrude` has `wallThickness`; `lathe`
  does not).

### 9.5 The contribution check took three tries — and the third is a DIFFERENT check

| version | result on the moka pot | why |
|---|---|---|
| AABB containment vs a SINGLE other part | `buried: []` — missed the swallowed lid flap | the flap was enclosed by the UNION of rim + upper + cavity, not by any one |
| occupancy sampling vs the UNION of AABBs | flagged `gasket`, `cavity`, `valve` — all plainly visible | an AABB uses a lathe's MAX radius at EVERY height, so a taper "contains" its whole bounding column |
| **point-in-solid vs the union** | `boiler`/`upper` 0%, `cavity` 94% — ranks correctly | tests the actual swept solid: radius-at-t for lathes, distance-to-polyline for sweeps |

**But coverage alone is the wrong question.** `cavity` sits at 94% enclosed and
is CORRECT — a vessel mouth is *supposed* to be mostly sunk. `lid-flap` at 79%
was invisible. Coverage ranks contribution; it does not predict legibility.

The sharper gate compares outcome against the author's own DECLARATION:

> **jut shortfall** — a `jut` part declared what fraction of it should
> protrude. Measure what actually does. `lid-flap` declared `jut: 0.75` and was
> 21% exposed; `lid-hinge` declared `0.55` and was 22%. Both flagged; `gasket`
> (70% enclosed) and `valve` (62%) correctly were not.

This is the better pattern generally: **gate the declaration against the
measurement, not the measurement against a constant.** The vocabulary already
carries the author's intent — use it as the expectation.

Proven end to end: gate flagged → anchors moved onto the host surface (they had
been seated INSIDE it, so the declared jut protruded from within the rim) →
`shortfall: []` → the flap and hinge visibly read in the re-render. Passes 2
and 3 rode the same stash (`st_fd3afeb089fc`), cage `sk_yn22jis7fi`.

### 9.6 CORRECTION — the "19% too slender" defect was not real

§9.2 recorded the reconstruction as ~19% too slender. **That was a benchmark
error, not a reconstruction error.** I compared against a remembered "typical
moka pot ratio ≈ 2.0" instead of measuring the photographed subject. Measured
from the photo: body height/max-width ≈ 2.2 in-image, ≈ 2.36 un-foreshortened.
The reconstruction is 2.38 — within a few percent. This pot is a genuinely
slender stainless model, not the squat classic Bialetti.

The lesson is about the EYES GATE: compare against the reference image, never
against a remembered archetype of the object class. A remembered prior is not
ground truth, and it manufactures defects that are not there.

### 9.7 Do NOT build computer vision into the substrate

Chasing §9.6 I wrote a silhouette extractor (per-row background, longest-run,
occupancy) and spent three attempts fighting an uncontrolled backdrop gradient
and cast shadow before stopping. That was the wrong move, and it was wrong on
POSTURE, not just on effort:

> the harness IS the vision adapter — "no vision key, no vision API call, and
> no pixels-for-understanding crossing the MCP boundary, only the model's
> structured read" ([visual-reference.js](../mcp/tools/visual-reference.js))

Automating silhouette measurement inside the substrate inverts exactly that.
Reading the image is the harness's job, by looking. The deterministic
`clayify` rung of §8.3 is still fine — it is an image-to-image AID the harness
then looks at, not the substrate extracting meaning. The boundary is:
**transform pixels for a human/model to read = allowed; derive measurements
from pixels = the harness's job.**

## 10. Proof obligation

The lighthouse end to end, segment-first: identity lock → 4–6 segment
workbenches → assembler → ratio ledger clean → eyes gate against the
photo → GLB. Then a second subject that is hard in a DIFFERENT way — a
subject whose read genuinely needs superposed tint-and-overlap to imply a
form no single monomer has (a panelled machine housing), to show the
protocol teaches the method and not just the vocabulary.


---

## 11. Rev 3 — what shipped, what was cut, what is left (2026-08-31)

Rev 2 planned P0–P4 (§5). §9 then executed the moka pot end to end and taught
enough to re-scope. This section is the decided sequence and its outcome.

### 11.1 What shipped in this pass

**P0 completed — segment-first is now the path for a complex subject.** §2d
called one-shot "the proven failure mode" and §5 promoted segment-first to P0,
but the first cut of `object-lower.js` shipped one-shot only (the moka pot's 9
monomers never tested the gap). Now:

- `insights.segments[]` is the alternative to `insights.parts` — never both.
  Each segment declares `heightFrac` (its share of `unitHeight`) and its own
  parts are fractions of **that segment's** height, so the no-absolute-z
  discipline holds at both altitudes.
- Segments compose by RELATION (§2c): `on: 'ground' | <earlier segment id>` +
  `gap`, gravity-seated by the assembler, which computes the running z. A
  segment authoring a z is a hard error, not a warning.
- Lowering returns `{ manifest: kind:'assembler', ledger, segments:[…] }`, and
  `capture_reference` mints **one workbench sketch per segment** alongside the
  assembler cage — the isolation §2d demanded. Segment sketches are tagged
  `reference_role:'segment'` so they don't inflate the pass counter.
- The gates run at both altitudes: contribution / jut-shortfall / height /
  junction-monoculture per segment, then `planAssembler` plus a composed-height
  check on the whole. The workbench's float/sink-on-the-grid warning is
  **filtered per segment** — a segment is authored at its own origin and seated
  by the assembler, so every non-base segment would fire it falsely; the
  composition still gets the real check from `planAssembler`.
- Implicit seating (no `on` given) defaults to the previous segment and is
  reported in the ledger as a warning. Naming the relation is the same
  discipline as naming the junction (§2b-pre); defaulting silently is what it
  exists to prevent.

**Multi-pass FUSION — the promise the tool had been making without code.**
`stash_ref` previously only counted passes: pass 2 lowered a fresh full
re-authoring into an independent cage and nothing from pass 1 survived, while
the tool description advertised "multi-pass triangulation". `fuseObjectInsights`
now merges parts and segments **by id** onto the filed read:

| move | effect |
|---|---|
| re-send a part | shallow field override — `{ id, radius }` fixes one radius |
| omit a part | carried forward untouched |
| new id | added |
| `drop:['id']` | removed (a later view disproved it) |
| `parts` ⇄ `segments` | a re-authoring, not a refinement — fusion is skipped |

The response reports `fusion:{ carried, updated, added, dropped }`, so the pass
says what it actually changed. `replace:true` opts out. The stored insights are
the MERGED read, so pass 3 fuses onto pass 2's state; the stale `__ledger` is
stripped on the way in.

**Tests — `object-lower.test.js`, 17 cases.** The lowering had none. Covers the
fraction discipline (an absolute z throws), the identity lock, junction
classification, the jut-shortfall gate, segment scoping (a part fraction is of
its own segment, not the whole), gravity seating through `planAssembler`, the
parts/segments exclusivity, and every fusion rule.

**Core bug fixed on the path:** `planAssembler`'s "no renderable part" check
listed `lathes/extrudes/sweeps/reliefs` but not `shells` or `drapes`, both of
which `lowerObjectFaces` renders fine. A shell-only segment — the lighthouse's
faceted rock island, exactly the §10 subject — was rejected by the gate that is
supposed to precede rendering. The check now derives from the full monomer list.

**Tool surface:** `object` had never appeared in `reference_protocol`'s target
enum or `capture_reference`'s description at all. It does now. Both descriptions
stayed UNDER their allowlist snapshots in `tool-descriptions.test.js` (route in
the description, teach in the drawer — the segment and fusion contracts live in
`OBJECT_PROTOCOL`, which rides the protocol RESULT, not tools/list). The payload
pin was consciously re-pinned 256_000 → 256_500 for the ~300-byte input-schema
residue.

### 11.2 What was cut, and why

- **§4's per-part ratio ledger (declared vs measured `heightFrac`/`aspect`).**
  §310 already concluded P1's value is as a LOWERING discipline, not a checker:
  author z from proportions and the drift cannot occur. The shipped gates are
  the sharper pattern — **gate the declaration against the measurement**
  (jut-shortfall), not the measurement against a constant. Building the ratio
  table would mostly measure zero.
- **P2 (`reconstruct-from-photo` catalyst).** The protocol carries the method
  and the stash carries the state; a catalyst would restate both. Revisit if the
  proof run shows the method does not survive contact without one.
- **P4 (`creature` target).** Different family (manji-tree, not workbench),
  orthogonal to the scene question.
- **Sweep cross-sections and specular materials** (§9.2 #3, #4). Real, still
  unfixed, and **not reference-path defects** — they are `workbench` vocabulary
  gaps that will be fixed for their own reasons.

### 11.3 What is left before the scene target

1. **The §10 proof run, on real photos.** Everything above is verified by unit
   tests plus an end-to-end smoke of a synthetic lighthouse read (3 segments →
   assembler; a fused second pass that added a dome, corrected two radii and
   carried the rest, clearing all four warnings). That proves the MACHINERY. It
   does not prove the METHOD, which needs an operator photo and the eyes gate.
   Two subjects, per §10: the lighthouse segment-first, then one hard in a
   different way (a panelled machine housing, where superposed tint-and-overlap
   must imply a form no single monomer has).
2. **P3 — reference-matched camera.** `view.az` rides into the manifest as
   `facing`; `el` is still dropped, so the eyes-gate render is not at the
   elevation the read was made at. Small, and it makes §9.4's failure mode
   ("state the view so the identifying feature is in PROFILE") cheaper to obey.
3. **Consider a turntable eyes gate.** §9.4 showed a single-`az` compare is
   useless when the azimuth is wrong, and the back is invented anyway. A
   multi-view contact sheet (the `/skull-study` pattern) would SHOW the invented
   side rather than hiding it. Not required for scene; cheap and high-yield.

### 11.4 Why fusion and segment-first were the blockers, specifically

Both are the machinery the SCENE target inherits, not object-local polish:

- A scene is N subjects composed into a frame — composition-of-
  independently-judged-parts is the scene case one level up. §8.5's argument for
  objects-first is precisely that the scene case cannot be evaluated until the
  object case is reliable; shipping scene over an unproven composition path
  would pay for the same lesson twice.
- Triangulating across viewpoints is the scene target's whole value
  proposition. Shipping it over a pass-counter would have put the same hollow
  "multi-pass triangulation" claim into a second tool description.

Note that §9.1's finding stands and is not in tension with this: scene and
object are DECOUPLED on perspective (a scene pass is useless for a product shot
on a backdrop) and COUPLED on composition. Composition was the unbuilt half.


---

## 12. First segment-first run on a real photo — Boars Head Lighthouse (2026-08-31)

Subject found by web search, not supplied: [Boars Head Lighthouse](https://commons.wikimedia.org/wiki/File:Boars_Head_Lighthouse_(1).jpg)
on Wikimedia Commons. A white shingled SQUARE tapered tower — deliberately boxy,
where §9's moka pot was entirely rotational. Three-quarter view, mild upward
perspective, distinct seams (plinth / shaft / gallery / lantern / roof), so it
routes SEGMENT-FIRST by the §11.1 rule and exercises the new path for real.

Stash `st_0a1f8a9ed0d3`; cages `sk_37ufbgkvb6` (p1) → `sk_441gwriloj` (p2) →
`sk_5732vu2va0` (p3). Five segments, 11 parts, 1 stack / 4 jut in the shaft.

### 12.1 Two gate bugs a rotational subject could never expose

Both are PRE-EXISTING (inherited from the one-shot lowering) and both fired as a
wall of false positives on the first boxy read. Every height check screamed and
all four wall features reported 100% buried.

| bug | effect | fix |
|---|---|---|
| `aabb` added the extrude's profile reach to ALL THREE axes | a 39-wide, 2.8-tall plinth measured **42.2 tall**; five of seven warnings were this | project the reach onto each world axis via the axis unit vector — the profile sweeps PERPENDICULAR to the axis |
| `containsPoint` tested a prism as a cylinder of its CIRCUMRADIUS, and ignored `endProfile` | a square tower of half-width *a* was tested at radius *a*√2, so it "contained" every door and window mounted on its own face; the taper was tested at base width all the way up | inscribed cylinder (inradius), radius interpolated along the taper |

The lathe branch never had either bug — a circle's inradius, circumradius and
half-extent are the same number. **A gate validated only on rotational subjects
is not validated.**

### 12.2 A new gate earned — the RATIO is blind to SCALE

With the containment fixed, the ledger went clean. The render did not: the door
and window were simply not there. Measured:

> door: wall at 16.7, outer face at 17.9 → **1.11 units proud of a 100-unit tower**

The jut-shortfall check (§9.5) reported `door: 53% exposed` against a declared
`jut: 0.45` and passed it happily. It was right — and useless. **A ratio cannot
see scale.** A feature that clears its host by a hair is geometrically correct
and visually absent.

Added: an absolute-scale check that measures the intended protrusion against the
OBJECT's height and flags anything under ~2%. It named all three offenders
immediately, and matches what the eyes saw:

    shaft: 3 jut part(s) protrude too little to READ at this object's scale:
    door (1.35 units proud, needs ~2+), window (0.9), window-hood (1.68).

The general form, again: **gate the declaration against the measurement — and
then gate the measurement against the object's own scale.**

### 12.3 §9.4's view line cost a whole pass, and argues for the turntable

Pass 2 deepened the juts. The block-out's depth grew 39.4 → 42.3, so the geometry
definitely changed — and the render still showed nothing. Both machine gates were
clean. Only orbiting the camera by hand found the door and window, sitting on the
two faces `view.az: 45` does not show.

This is exactly §9.4's "state the view so the identifying feature is in PROFILE"
— restated, and it cost a full pass anyway because **nothing in the loop can tell
"the feature is missing" from "the feature is behind"**. A single-azimuth eyes
gate is not a gate; it is one sample. This promotes §11.3's turntable contact
sheet from "cheap and high-yield" to the next thing to build.

Pass 3 was a single field (`view.az: 225`) and fixed it.

### 12.4 What fusion actually bought

| pass | sent | carried |
|---|---|---|
| 2 | 4 part corrections (depth / jut / anchor) | plinth, shaft/tower, gallery, lantern, roof |
| 3 | one field (`view`) | all five segments, untouched |

Under the old behaviour each of those would have meant re-authoring all 11 parts
across 5 segments from scratch, with a fresh chance to drift on every one. The
identity lock held across three passes because there was nothing to re-type.

### 12.5 Perspective — §9.1(3) held on a square subject

The photo is a three-quarter view with mild convergence. Band fractions were read
off pixel bands and the composed height landed at **exactly 100.0** — uniform
vertical foreshortening divided out, as §9.1(3) predicted.

The square-tower analogue of §9.1(2)'s ellipse trick: **the apparent silhouette
width of a square prism seen near its corner is the face DIAGONAL, so face width
= apparent × 0.707.** Same shape of fix as the ellipse (a known-geometry cue
recovers the horizontal scale the photo distorts), and worth a protocol line.

### 12.6 Unrelated finding — triangular shells do not render at all

Chasing a missing rock island in the §11 smoke run: `faceListToMesh` skips any
face with fewer than 4 corners ([face-mesh.js](../graph/figures/face-mesh.js)),
and shell monomers are polyhedra. Icosahedron / octahedron / tetrahedron produce
**zero** mesh vertices; cube renders; dodecahedron renders with its fifth corner
dropped. This is a CORE renderer gap, not a reference-path one — it affects any
shell anywhere, including `mint_solid`.

Note the §11 `planAssembler` fix made this WORSE before it was understood: shells
now pass validation and then silently draw nothing, where before they threw. The
honest fix is fan-triangulation of n-gons in `faceListToMesh`. Not attempted here.

### 12.7 Residual, against the photo

Right: silhouette, all five band proportions, the taper, the gallery overhang,
the red railing / white lantern / red roof sequence, the door and window with
their hoods.

Wrong or absent: the railing is a solid band where the photo has open balusters
(declared, blocky fidelity); the shingle lap is flat tint (no vocabulary for it);
the roof finial is omitted; the door and window surrounds are deepened BEYOND the
photo so they read at this scale — a legibility choice, now in the caveats rather
than pretending to be a measurement.

### 12.8 Still owed on §10

The second subject, hard in a different way: a panelled machine housing, where
superposed tint-and-overlap must imply a form no single monomer has. This run
proved the segment/junction vocabulary on ARCHITECTURE, which is the easy end of
the boxy class — every junction here was a clean stack or a face-mounted jut.
Nothing yet has tested `composite`.
