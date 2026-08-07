---
{
  "id": "reconstruct-from-dream",
  "name": "Reconstruct a dreamed object as a 3D assembly, segment by segment",
  "summary": "Use an image worker as the model's EYES: dream a complex real object in a flat, decomposable register, then rebuild it SEGMENT BY SEGMENT in the buildable monomer vocabulary (lathe / extrude / sweep / manji — everything that lowers to three.js faces). Simple targets fit one workbench; complex targets (a drafting lamp, a bicycle, an espresso machine, a typewriter) get per-segment dreams + per-segment workbench sketches iterated in isolation, composed with create_assembler, optionally finished with a skin bake. The dream images are discarded on lock; only the recipe persists, and it lowers to /world + .glb for free.",
  "valueHook": "Point the dream loop at a complex real object — dream it, decompose it along its natural seams, rebuild each segment as a workbench part, and assemble a real 3D model that drops straight into a world.",
  "version": 2,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": [
    {
      "name": "intent",
      "description": "The 3D object to reconstruct, in words (e.g. 'a three-legged bar stool', 'a drafting lamp', 'a bicycle', 'an espresso machine'). Best on part-decomposable objects — furniture, vessels, lamps, tools, machines, props, vehicles. Omit to ask the operator."
    }
  ],
  "mcpTools": { "mojulo": ["create_sketch", "get_image_render_packet", "bind_image_render", "create_workbench", "create_assembler", "get_skin_packet", "skin_polygomer", "semantic_search"] }
}
---

# Reconstruct a dreamed object — operating instructions

You are the shape-fitter. The LLM cannot draw, but it can *see*. An image
worker draws the object you imagine — and, for a complex object, each of its
segments — and you rebuild them out of the substrate's deterministic 3D parts.
**The dreamed images are a reasoning aid, never the artifact.** The sovereign
output is a pure `workbench` / `assembler` recipe; the dreams are discarded
once its `/world` render reads as the object.

Design + doctrine: `control/lib/graph/polygonizer/shape-from-dream.plan.md`;
the segment-first method (proven on four build lines) is
`control/lib/graph/polygonizer/mobile-suit-builder.plan.md`. Substrate:
`docs/POLYGONIZER-SYNTHESIS.md`; in-workbench relational composition
`control/lib/graph/polygonizer/workbench-assembly.js`; multi-part composition
`control/lib/graph/worlds/workbench-assembler.js`.

## The invariants — read first

- **The raster is discarded scaffolding.** Do not `bind_image_render` the dream
  images as deliverables, do not wrap them onto geometry, do not persist them
  into the recipe. They exist only so you can look at them and rebuild. (The
  optional skin bake at the end is a DIFFERENT image — painted over the minted
  scaffold via the skin seam — not the dream.)
- **Diffusion cannot draw an exploded parts sheet** (proven 2026-07-12:
  prompting for one returns grid paper + scattered blobs — an image model is a
  single-subject painter). Get pieces two reliable ways instead: (a) dream the
  WHOLE in a register simple enough that the pieces read off it, or (b) dream
  EACH SEGMENT as its own targeted single-subject generation. The object's
  simplicity does the exploding, not the prompt.
- **Build only what three.js can draw.** Every part resolves to ONE buildable
  monomer — `lathe` (surface of revolution: legs, bulbs, shades, columns,
  knobs, round masses), `extrude` (prism/slab: boards, panels, plates,
  brackets), `sweep` (tube: handles, rails, spokes, arms) — or a manji face for
  rectilinear structure the monomers don't cover. A part that fits none is a
  **vocabulary gap to name, not a part to fake.**
- **Compose by RELATION, not coordinates.** Use the assembler: declare each
  part's SIZE and how it CONNECTS (`on` / `gap` / `offset` / `radial` /
  `mirror`), never a hand-computed z. Complexity comes from arraying (`radial`/
  `mirror` = fractal repetition, `scaleStep` = taper) and profile modulation
  (`harmonics`), not from more coordinates.
- **Convergence is domain-bounded.** This fits CONSTRUCTED, part-decomposable
  objects — furniture, vessels, lamps, tools, props, vehicles, architecture —
  because those genuinely are assemblies of surfaces-of-revolution + prisms +
  tubes. Organic single-mass forms (a running animal, a face) are the figure
  family's job. If the target isn't an assembly, say so and stop.

## Capability ladder — resolve ONCE

Drawing the sheets needs an image worker (same ladder as
`render-image-outcome-locally`):
1. Native image generation in your harness? Use it directly.
2. Else probe the local backend: `GET http://127.0.0.1:8188/system_stats`.
3. Neither? Stop and point the operator at `docs/local-image-worker.md`. No
   eyes, no loop.

## Route by complexity — decide BEFORE you build

- **Simple target** (≲10 parts, one visual mass — a stool, a chalice, a table
  lamp): ONE `create_workbench` with relational `assembly.parts`. Run the loop
  below with a single dream of the whole.
- **Complex target** (distinct sub-assemblies with natural seams — a drafting
  lamp, a bicycle, an espresso machine, a typewriter, a clock): go
  **SEGMENT-FIRST**. Lock an identity, dream + build each segment as its OWN
  workbench sketch judged in isolation, then compose the frozen parts with
  `create_assembler`. This is the proven mobile-suit method aimed at the
  object register; don't one-shot a complex whole — the whole-body blockout
  was the proven failure mode.

### The segment discipline (complex targets)

1. **Identity lock, FIRST and restated every pass** — one sentence, ≤5 named
   repeatable traits (color, material, silhouette, mass, signature detail).
   The anti-drift device. If you can't say it in a sentence, don't build yet.
2. **Decompose along real seams** — how the object actually factors (base /
   arm / shade; frame / wheels / drivetrain; body / group head / portafilter).
   Each segment gets its own dream, its own workbench sketch, its own origin,
   iterated v1→v2→v3 with the design decision IN the version title.
3. **Exploit repetition + symmetry** — model one spoke, `repeat` the wheel;
   model one side, `flip` the other. Replication with pose variance beats
   sculpting unique parts.
4. **Assemble last, expect fidelity to drop** — study high in the sheets,
   spend the part budget where it reads at object scale.

## The loop

```
1. INTEND   Fix the object in one clear sentence (the `intent` parameter).

2. DREAM    In the DECOMPOSABLE REGISTER (see below): dream the WHOLE object
            flat + simple (your assembly reference), and — for a complex
            target — each SEGMENT as its own single-subject image (your part
            sheets). NEVER prompt for an exploded sheet (see invariants).
            Mint image-outcome sketches only to LOOK at (create_sketch →
            get_image_render_packet → your image worker → READ the PNGs).
            Do NOT bind them.

3. SEE      Count the parts. For each, name its buildable kind
            (lathe/extrude/sweep/manji). Read the whole-object dream as edges:
            which parts CONTACT (→ on/gap), which FLOAT over another (→ mugen,
            approximate with gap for now), which are JOINERY between two masses
            (→ blobPla, approximate with a small lathe for now).

4. DECOMPOSE  Recall shelf help FIRST — semantic_search (kinds
            ['manji_program']) and the furniture / workbench card banks — then
            compose the remainder. Arrayed repeats → radial/mirror; profile
            detail → harmonics.

5. BUILD    Per segment: create_workbench({ assembly: { parts: [
              { kind:'lathe'|'extrude', height, profile|rect|points,
                id?, on?, gap?, offset?, radial?, mirror?, harmonics?,
                tint?, material? }, … ] }, sweeps: [ … ] })
            assembly.parts are lathe|extrude only (declare size + connection,
            not coordinates); SWEEPS (handles, rails, arms — intrinsically a
            curve) go in the explicit `sweeps` array and merge with the
            lowered assembly. For a float-atop part (a shade over a bulb),
            seat it with an explicit `gap` above its support and note that
            it's a mugen approximation.

6. COMPOSE  (complex targets) create_assembler({ items: [ { source:{ref},
            id?, on?/'ground', gap?, at?, rotate?, flip?, scale?,
            repeat?:{count, step} }, … ] }) — sources are FROZEN at import.
            GRAVITY SEATING (on/gap) is standard; absolute `at` z is the
            superposition fallback for bridging parts (a bed between wheels).
            `repeat` arrays one part; `flip` mirrors it.

7. RENDER   Open /api/sketches/<ref>/world — the three.js reconstruction.
            (Validation is at mint; a bad assembly fails at mint time,
            not at render — fix and re-mint.)

8. COMPARE  Read the /world render against the whole-object dream. Fix if:
              - a part is MISSING or the count in an array is wrong;
              - a part sits on the WRONG support (re-point `on`);
              - a float clips its support (raise `gap` / needs mugen, D1);
              - a joint looks fudged (needs blobPla, D2);
              - the silhouette or proportion is off (resize the monomer).
            Judge STRUCTURE + FIT, not shading — /world is flat-lit, the dream
            is drawn; you are matching how it goes together, not how it paints.

9. ITERATE  One fix at a time → back to step 5/6, until the assembly reads as
            the dream from a normal viewing distance.

10. LOCK + DISCARD  The recipe is the artifact. Drop the dream images — do not
            reference or bind them. Report the sketch ref. It already lowers
            to /world and the .glb export, so the 3D object is done.

11. SKIN (optional)  Fine finish the geometry can't carry — labels, dials,
            wood grain, panel seams, grime — via the skin seam:
            get_skin_packet → paint → skin_polygomer (works on workbench AND
            assembler units). Single-view limitation: front/¾ strong,
            side/back weak — note it on the artifact so "turnable" isn't
            oversold.
```

## The decomposable register (step 2 — the load-bearing constraint)

The scaffold-echo lesson RUN IN REVERSE. There, a wireframe leaking into art
was the failure; here you *want* a construction-legible drawing, because you're
going to rebuild it. A photoreal or moody dream is un-decomposable.

Prompt every dream **flat, orthographic, one clean subject**:
- Prefer presets `ukiyo-e`, `art-nouveau`, flat `silver-age`, `ink-brush` —
  registered flat color, firm contour, legible separated forms.
- AVOID `photo-realism` and any painterly/optical preset — they hide the seams
  and part boundaries you need to see.
- Ask for: one clean silhouette, orthographic framing, seams and joints
  visible, flat registered color. A technical drawing, not a product
  photograph. For a segment dream, frame the segment ALONE — one
  single-subject image per part, never an exploded collage.

## What you DON'T do

- You don't bind, wrap, or persist the dream images — discarded on lock.
- You don't prompt for an exploded parts sheet — diffusion can't draw one;
  dream the whole simply, or dream each segment alone.
- You don't one-shot a complex target as a single blockout — segment sheets
  first, assemble last.
- You don't fake an unbuildable part — name the vocabulary gap instead.
- You don't hand-compute coordinates — declare relations (`on`/`gap`) and use
  gravity seating; absolute z only for bridging superposition.
- You don't force an organic single-mass target through this loop — that's the
  figure family.
- You don't skip the compare step — a mint you didn't set beside the dream is
  not a reconstruction.
