---
{
  "id": "reconstruct-from-dream",
  "name": "Reconstruct a dreamed object as a 3D workbench assembly",
  "summary": "Use an image worker as the model's EYES, IKEA-style: dream an exploded parts sheet + an assembly sheet for a 3D object, then rebuild each part in the buildable monomer vocabulary (lathe / extrude / sweep / manji — everything that lowers to three.js faces) and compose them with the assembler. The dream sheets are discarded on lock; only the workbench recipe persists, and it lowers to /world + .glb for free.",
  "valueHook": "Dream the IKEA manual for an object you can't hand-author — the exploded parts and how they bolt together — then rebuild it as a real 3D assembly that drops straight into a world.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": [
    {
      "name": "intent",
      "description": "The 3D object to reconstruct, in words (e.g. 'a three-legged bar stool', 'a table lamp with a drum shade', 'a footed chalice'). Best on part-decomposable objects — furniture, vessels, lamps, tools, props. Omit to ask the operator."
    }
  ],
  "mcpTools": { "mojulo": ["create_sketch", "get_image_render_packet", "bind_image_render", "create_workbench", "semantic_search"] }
}
---

# Reconstruct a dreamed object — operating instructions

You are the shape-fitter. The LLM cannot draw, but it can *see*. An image
worker draws the **construction plan** for the object you imagine — IKEA-style,
an exploded parts sheet and an assembly sheet — and you rebuild it out of the
substrate's deterministic 3D parts. **The dreamed sheets are a reasoning aid,
never the artifact.** The sovereign output is a pure `workbench` recipe; the
sheets are discarded once its `/world` render reads as the assembly.

Design + doctrine: `control/lib/graph/polygonizer/shape-from-dream.plan.md`.
Substrate: `docs/POLYGONIZER-SYNTHESIS.md`; assembler
`control/lib/graph/polygonizer/workbench-assembly.js`.

## The invariants — read first

- **The raster is discarded scaffolding.** Do not `bind_image_render` the dream
  sheets as deliverables, do not wrap them onto geometry, do not persist them
  into the recipe. They exist only so you can look at them and rebuild.
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

## The loop

```
1. INTEND   Fix the object in one clear sentence (the `intent` parameter).

2. DREAM    Draw TWO sheets, in the DECOMPOSABLE REGISTER (see below):
              (A) EXPLODED PARTS — each piece isolated, labeled, orthographic.
              (B) ASSEMBLY — how the pieces seat / stack / float / join.
            Mint image-outcome sketches only to LOOK at (create_sketch →
            get_image_render_packet → your image worker → READ the PNGs).
            Do NOT bind them.

3. SEE      Count the parts. For each, name its buildable kind
            (lathe/extrude/sweep/manji). Read Sheet B as edges: which parts
            CONTACT (→ assembler on/gap), which FLOAT over another (→ mugen,
            approximate with gap for now), which are JOINERY between two masses
            (→ blobPla, approximate with a small lathe for now).

4. DECOMPOSE  Recall shelf help FIRST — semantic_search (kinds
            ['manji_program']) and the furniture / workbench card banks — then
            compose the remainder. Arrayed repeats → radial/mirror; profile
            detail → harmonics.

5. BUILD    create_workbench({ assembly: { parts: [
              { kind:'lathe'|'extrude', height, profile|rect|points,
                id?, on?, gap?, offset?, radial?, mirror?, harmonics?,
                tint?, material? }, … ] }, sweeps: [ … ] })
            assembly.parts are lathe|extrude only (declare size + connection,
            not coordinates); SWEEPS (handles, rails, arms — intrinsically a
            curve) go in the explicit `sweeps` array and merge with the
            lowered assembly. For a float-atop part (a shade over a bulb, a
            cover over a base), seat it with an explicit `gap` above its
            support and note that it's a mugen approximation.

6. RENDER   Open /api/sketches/<ref>/world — the three.js reconstruction.
            (Validation is at mint; a bad assembly fails at create_workbench,
            not at render — fix and re-mint.)

7. COMPARE  Read the /world render against Sheet B. Fix and regenerate if:
              - a part is MISSING or the count in an array is wrong;
              - a part sits on the WRONG support (re-point `on`);
              - a float clips its support (raise `gap` / needs mugen, D1);
              - a joint looks fudged (needs blobPla, D2);
              - the silhouette or proportion is off (resize the monomer).
            Judge STRUCTURE + FIT, not shading — /world is flat-lit, the dream
            is drawn; you are matching how it goes together, not how it paints.

8. ITERATE  One fix at a time → back to step 5, until the assembly reads as the
            dream from a normal viewing distance.

9. LOCK + DISCARD  The workbench recipe is the artifact. Drop the dream sheets —
            do not reference or bind them. Report the sketch ref. It already
            lowers to /world and the .glb export, so the 3D object is done.
```

## The decomposable register (step 2 — the load-bearing constraint)

The scaffold-echo lesson RUN IN REVERSE. There, a wireframe leaking into art
was the failure; here you *want* a construction-legible drawing, because you're
going to rebuild it. A photoreal or moody dream is un-decomposable.

Prompt both sheets **flat, orthographic, labeled, exploded**:
- Prefer presets `ukiyo-e`, `art-nouveau`, flat `silver-age`, `ink-brush` —
  registered flat color, firm contour, legible separated forms.
- AVOID `photo-realism` and any painterly/optical preset — they hide the seams
  and part boundaries you need to see.
- Ask for: parts separated with clear gaps between them, one clean silhouette
  per piece, orthographic framing, seams and joints visible. An IKEA manual
  page, not a product photograph.

## What you DON'T do

- You don't bind, wrap, or persist the dream sheets — discarded on lock.
- You don't fake an unbuildable part — name the vocabulary gap instead.
- You don't hand-compute coordinates — declare relations via the assembler.
- You don't force an organic single-mass target through this loop — that's the
  figure family.
- You don't skip the compare step — a mint you didn't set beside Sheet B is not
  a reconstruction.
