# Shape-from-dream — image-gen as the polygonizer's eyes, IKEA-style

Status: **PARTIALLY BUILT** (updated 2026-07-14). D0 landed (the
`reconstruct-from-dream` catalyst + the polygomerization object-register proof —
see plan-archive/polygomerization.plan.md, angler-knight / metal-fly). DF's hard
prerequisite #1 — "fluff is not MCP-wired" — is now RESOLVED: `create_figure`
accepts a validated `fluffs` register (working tree). Still unbuilt: D1
(mugen-general), D2 (blobPla-3D), D3 (compare gate), and the DF register seam
(D1+D2). Original design (2026-07-12) follows. A design for a vision-in-the-loop
authoring path where an image worker draws an **exploded parts sheet + an
assembly sheet** (IKEA-style) that the LLM reconstructs as **3D buildable
parts composed into one artifact** — never as the artifact itself. Sits on the
render-worker seam (docs/local-image-worker.md, image-outcomes.plan.md), the
workbench monomers + assembler (workbench-assembly.js), and the composition-
operator family (assembler / mugen / blobPla). Gated on operator review.

## The idea

The LLM is blind at authoring time — it reasons about form in symbol-space and
can't see whether the parts it declares actually build the object it intends.
It *can* see (it reads PNGs natively). So use an image worker as its **eyes**,
and — crucially — not for one finished picture but for the **construction
plan**: the way an IKEA manual works.

- Sheet A — **exploded parts.** Every piece drawn in isolation, labeled,
  orthographic. "Here are the boards, the dowels, the shelf, the cap."
- Sheet B — **assembly.** How the pieces connect / stack / seat / float. "Peg
  2 into board 1; the top plate rests on the four legs; the shade floats over
  the bulb."

The LLM reads both, builds each part in the **3D buildable vocabulary**, and
composes them with the operator family. **The dreamed sheets are discarded on
lock; the sovereign output is a pure workbench/manji recipe** that lowers
through the existing mesh pipeline into `/world` and `.glb`.

This is the constructive-synthesis counterpart to the image-outcomes seam:
there the polygonizer emits a scaffold and the worker paints the deliverable;
here the worker emits the *construction plan* and the polygonizer builds it.

## The buildable vocabulary is bounded by three.js — say so

What can be built is exactly what lowers to `{ corners:[[x,y,z]×4], fill }`
faces that `emitThreeWorld` (scene/scene-three.js) consumes. That bound is the
honest constraint, and it defines the decomposition target. Each dreamed part
maps onto **one** of:

- **`lathe`** — a surface of revolution (profile × harmonics): vases, legs,
  bulbs, shades, columns, domes, knobs, round masses.
- **`extrude`** — a prism/slab from a 2D outline: boards, panels, plates,
  brackets, slabs.
- **`sweep`** — a tube along a path: handles, rails, spokes, cables, arms.
- **manji faces** — a cardinal structural frame for anything the three
  monomers don't cover (rectilinear armatures, framed structure).

If a dreamed part fits none of these, that is a **vocabulary gap to name**, not
a shape to force. The loop's honesty depends on refusing to fake unbuildable
parts.

Superposition and fractal still apply, but as *arraying + modulation* rather
than silhouette-fitting: `radial`/`mirror` array a part into rings/corner-sets
(fractal repetition), `scaleStep` tapers a replicated stack, and `sum` fields
+ `harmonics` modulate a monomer's profile. Complexity from normal shapes,
repeated and modulated.

## The composition-operator family (the IKEA hardware kit)

Three ways parts relate. Today they live in three different representations —
unifying them for the 3D buildable path is part of this plan's work.

| Operator | Relation | Today | For this loop |
|----------|----------|-------|---------------|
| **assembler** (`assembly.parts`) | CONTACT — sits on / stacks / arrays | 3D-buildable (faces) — `on`/`gap`/`offset`/`radial`/`mirror` | ready; the backbone of Sheet B |
| **mugen** | NON-CONTACT — floats atop, conforms to the hull beneath at a clearance, never clips | 3D, but welded into apparel samplers (figure-garments.js P1–P5) | needs lifting into a general assembler placement mode (D1) |
| **blobPla** | JOINERY — a peg/ball/socket/stem/seat BETWEEN two masses, distorting neither | 2D sketch marks only (blob-pla.md) | needs a 3D monomer expression (D2) |

The mapping from Sheet B is clean: a part that **sits on** another → assembler
`on`/`gap`; a part that **floats over / covers** another → mugen; a **dowel /
peg / socket** joining two masses → blobPla. The image model's assembly diagram
is, almost literally, a graph over these three edges.

## The figure register — fluff is the body-side monomer

The buildable vocabulary above is the OBJECT register. There is a second
register for stylized bodies, and the loop applies to it unchanged: the
**fluff** vocabulary (figure-fluff.js — `cone` / `football` / `bead` / `bell`
/ `slab`, each a radius profile bound to an armature segment, composed by
superposition). Fluff is to a body what the workbench monomer is to an object:
a tiny closed set of named simple volumes, complex form from repetition +
superposition. The registers pick the basis; the loop is the same.

The flagship fluff target — **mega-boy: action-figure girth contrast, huge
distal masses on skinny connectors** — is exactly a robot. So a robot with
action-figure proportions is the natural first FIGURE-register target.

### Dream vs. fluff: helps, does not supersede

- **The dream supersedes the operator-sketch step, not the fluff layer.**
  figure-fluff.plan.md §1a is literally titled "operator sketch, 2026-07-06":
  a human drew mega-boy's proportions to settle which segment is a cone vs a
  truncated football, and called that sketch "the acceptance reference for
  spikes 1–2." The dream loop AUTOMATES that: dream the robot exploded, read
  off the fluff assignment per segment, mint the fluff manifest, render,
  compare to the dream. It supersedes the hand-tuning of `MEGABOY_RADII` and
  the manual proportion iteration the fluff plan names as the pain — not the
  vocabulary.
- **The dream CANNOT supersede fluff, because fluff is the necessary 3D
  target.** A 2D dream is not posable, not garment-trackable, not a world
  citizen. Fluff rings on the armature ARE — they pose for free (bind
  articulated nodes), garments auto-track them, they render through the same
  stack. The dream must decompose INTO something 3D; fluff is that something
  for bodies (proto can't author new forms; a radii map is too weak). Dream =
  eyes; fluff = hands. Superseding fluff would just rebuild it.
- **The dream drives the vocabulary's GROWTH.** The fluff table is closed at
  five shapes "until a character proves a sixth is needed." Decomposing real
  dreamed targets is how a character proves it — the loop is a vocabulary-
  discovery engine for the fluff table, not a replacement for it.

### The robot forces the two registers to meet

A robot is *mostly* fluff-shaped (chunky posable limbs, girth contrast = pure
mega-boy) but carries HARD-SURFACE features that are workbench-shaped (a boxy
chest = extrude/slab, cylindrical hydraulic joints = lathe, antennae = sweep).
So it sits on the SEAM of the figure register (fluff, posable) and the object
register (workbench, rigid) — and the bridge operators are exactly the family:

- an armor plate / pauldron / greave floating over a limb mass = **mugen**
  (the fluff plan already flags "a fluff superposed ONTO proto flesh (a
  pauldron mass)" and garment-over-fluff);
- a mechanical ball-joint / piston between two masses = **blobPla** (a
  peg/socket/stem joining two masses without distorting either — literally a
  mecha joint).

So the robot is the stress test that exercises the whole operator family at
once: fluff masses on the armature + workbench monomers for hard-surface
add-ons + mugen armor plates + blobPla joints, composed on one rig. It also
exposes the deeper question — that fluff and workbench are two halves of one
buildable-volume vocabulary split by register, and mugen/blobPla are the seams
(a `slab` fluff and an `extrude` monomer are nearly the same thing at the
boundary). The loop is how that unification question gets asked concretely.

## The loop (IKEA)

```
1. INTEND     Name the 3D object in one sentence.

2. DREAM      Image worker draws TWO sheets in the DECOMPOSABLE REGISTER:
              (A) EXPLODED PARTS — each piece isolated, labeled, orthographic.
              (B) ASSEMBLY — how pieces connect/seat/stack/float.
              Mint image-outcome sketches only to LOOK at; do not bind them.

3. SEE        Read both sheets. Count the parts; for each, name its buildable
              kind (lathe/extrude/sweep/manji). Read Sheet B as edges: which
              parts CONTACT, which FLOAT (mugen), which are JOINERY (blobPla).

4. DECOMPOSE  Each part → one monomer. Recall shelf help first: semantic_search
              (kinds ['manji_program']) and the furniture/workbench card banks.
              Arrayed repeats → radial/mirror. Profile detail → harmonics/sum.

5. BUILD      create_workbench({ assembly: { parts: [...] } }) — declare each
              part's SIZE + how it CONNECTS (on/gap/offset/radial/mirror), not
              coordinates. Float-atop layers ride mugen (D1); joints ride
              blobPla (D2). Until D1/D2 land, approximate float/joinery with
              contact + gap and note the gap.

6. RENDER     /api/sketches/<ref>/world (three.js mesh) — the reconstruction.
              Optionally the .glb export.

7. COMPARE    Read the /world render against Sheet B. Part missing? Mis-seated
              on the wrong support? Clipping where a float should hold clearance?
              Wrong count in an array? Judge STRUCTURE + FIT, not shading.

8. ITERATE    Fix a size / a support / a clearance / an array count → step 5.
              Stop when the assembly reads as the dream from a normal distance.

9. LOCK + DISCARD  The workbench recipe is the artifact. Drop the dream sheets.
              The recipe already lowers to /world + .glb — the 3D form is free.
```

Steps 1, 2, 3, 5 (contact-only), 6 exist today. Steps 4, 7 and the mugen/
blobPla edges of 5 are the work.

## Doctrine

- **The raster is discarded scaffolding.** The dream sheets are a reasoning
  aid; nothing binds or persists them into the recipe. This invariant is what
  keeps the path recipes-not-renders — guard it.
- **Dream a construction manual, not a beauty shot.** The scaffold-echo lesson
  in reverse: a photoreal render is un-decomposable. Prompt flat, orthographic,
  cel-legible (the image-outcomes flat presets — `ukiyo-e`, `art-nouveau`, flat
  `silver-age`, `ink-brush`; never `photo-realism`). Simplicity is the goal, not
  fidelity — a simple form wears its decomposition on its face.
- **"Pieces" is NOT one exploded image — diffusion can't draw one** (proven
  2026-07-12: prompting for an exploded parts sheet returns grid paper +
  scattered blobs; an image model is a single-subject painter). Realize the
  parts two reliable ways instead: (a) dream the WHOLE in a SIMPLE register so
  the LLM reads the pieces off a legibly-composed figure, or (b) dream each
  piece as its own targeted single-subject generation. Register simplicity is
  what makes the whole decomposable, which is what yields pieces — the object's
  simplicity does the exploding, not the prompt.
- **Match the register to the vocabulary.** A too-complex target (a Gundam)
  drags in angular hard-surface detail that the round fluff / lathe basis
  can't hold and forces the workbench/manji seam prematurely. Aim at the
  simplest form that still reads as the subject (Mega Man, not Gundam) — it
  decomposes cleanly into the closed vocabulary AND yields legible pieces.
- **Build only what three.js can draw.** Every part resolves to a monomer or a
  manji face. Unbuildable → a named vocabulary gap, never a faked part.
- **Composition is the operator family, not free coordinates.** Prefer
  assembler `on`/`gap` over hand-computed z; prefer mugen over eyeballed
  standoff; prefer blobPla over a fudged connector mass. Declaring relations
  (not coordinates) is what makes the reconstruction stable across re-mints.
- **The compare gate reads /world, not the sheet's pixels.** Convergence is
  3D fit — does the assembled mesh sit together right — judged against Sheet
  B's topology, not a pixel diff of a 2D dream.
- **Convergence is domain-bounded.** Constructed, part-decomposable objects
  (furniture, vessels, lamps, tools, props, vehicles, architecture) fit
  because they genuinely ARE assemblies of surfaces-of-revolution + prisms +
  tubes. Organic single-mass forms (a running animal, a face) are the figure
  family's job, not this loop's. Scope targets to assemblies.

## Why this elevates the three.js worlds

Today the mesh worlds (`resolveWorldScene` → `emitThreeWorld`) are fed by what
a human hand-authored into shelf cards and recipe families — every world form
is a hand-crafted fractal. This loop widens the intake: **any part-decomposable
object the LLM can dream and rebuild becomes a recipe**, and because the recipe
lowers through the same face→mesh pipeline, the reconstructed object arrives in
`/world` and `.glb` for free. The dream is 2D; the thing it yields is the
substrate's existing 3D. No new render path — the worlds stop being capped at
the hand-crafted shelf and start absorbing dreamed-then-decomposed assemblies
through the door they already have.

## Phases

### D0 — the loop protocol, contact-only (no new tools)

A catalyst (`reconstruct-from-dream`) wiring the existing tools into the
nine-step loop, restricted to the ASSEMBLER's contact composition (the part of
the operator family that is already 3D-buildable). Float/joinery are
approximated with `gap` and flagged. Exit: the driving agent takes one
part-decomposable target (a stool, a table lamp, a chalice) from intent → two
dreamed sheets → a `create_workbench` recipe whose `/world` render reads as the
assembly, dreams discarded — proving the eyes→parts→assemble→compare loop
converges on the ready operator.

### D1 — mugen as a general assembler placement mode

Lift mugen out of the apparel samplers into an assembler placement:
`{ floats: { over: <partId|'hull'>, clearance } }` on a part → the part
conforms to its support's hull at `clearance` and never intersects, instead of
seating on its top face. The offset-from-hull machinery exists in
figure-garments (P1 ONE OP); the work is exposing it as a monomer placement in
lowerAssembly, not re-deriving it. Exit: a lampshade floating over a bulb, or a
cover hovering over a base, minted as a float part — no clip, no hand-tuned z.
Gated on D0 telling us float actually recurs (it will).

### D2 — blobPla as a 3D joinery monomer

Give blobPla a face-emitting expression (a small lathe ball/socket/stem between
two named part anchors) so a joint is a real 3D adapter, not a 2D mark. The
metadata contract (sourceRole/receiverRole/joint/socket/stem) ports; the
lowering changes from sketch marks to monomer faces. Exit: two masses joined by
a minted peg-in-socket that reads in `/world`. Gated on D1.

### D3 — the compare gate as a real signal (later)

A deterministic /world-vs-dream structural read (part-count check, per-part
seating/containment check against Sheet B's declared edges) so "close enough to
lock" has a basis beyond the eye. Gated on D0/D1 showing which divergences
recur (missing part, wrong support, clip, wrong array count).

### DF — the figure register (the robot)

The loop over the FLUFF basis instead of the workbench basis: dream an
action-figure robot exploded, decompose each segment into a fluff
(`cone`/`football`/`bead`/`bell`/`slab`), mint a fluff manifest, render, compare
to the dream. Two hard dependencies this surfaces, both currently unbuilt:
1. **Fluff is not MCP-wired.** `create_figure` has no `fluffs`/`score` input
   yet (figure-fluff.plan.md spikes 4–5 unbuilt); today fluff lives only in
   `buildFluffs` + the animal builder + spikes. The loop needs the
   `create_figure` fluff manifest before it can mint a robot without a spike
   harness. This is the gating prerequisite for DF.
2. **The register seam.** A robot needs fluff limbs + workbench hard-surface
   add-ons + mugen armor + blobPla joints on one rig — so DF depends on D1
   (mugen-general) and D2 (blobPla-3D), and is the natural forcing case for
   both. Exit: an action-figure robot minted from a dreamed exploded sheet as
   a posable figure whose /world render reads as the dream — the mega-boy
   round-trip, but sourced from the dream instead of a hand-tuned radii file.
Gated on the fluff wiring landing and on D0 proving the object-register loop.

## Out of scope

- Any automatic image→mesh reconstruction / photogrammetry (violates recipes-
  not-renders; the LLM eye + the monomer vocabulary is the reconstructor).
- Binding or persisting the dream sheets (discarded on lock, always).
- Organic single-mass targets (figure family's domain, not this loop's).
- Photoreal / un-exploded dream imagery (un-decomposable by construction).
- The texture/skin direction (image-gen painting a skin onto geometry) — a
  separate, orthogonal idea; keep it out so the raster-is-discarded invariant
  stays clean.
