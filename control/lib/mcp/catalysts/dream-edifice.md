---
{
  "id": "dream-edifice",
  "name": "Reconstruct a dreamed building as a bespoke walkable edifice",
  "summary": "Use an image worker as the model's EYES to design a NEW, bespoke building — a campus, a connected complex, a custom building type the frozen generators (fractal city/school/hub) don't make — then rebuild it as a deterministic edifice recipe: a GRAPH of MASSES (footprint + floors + facade + roof) connected by CONCOURSES (halls), placed by RELATION not coordinates. Dream the building flat + orthographic, read off the massing + facades + connections, mint with create_edifice, WALK it, compare, adjust one dial at a time. The dreamed reference is discarded; only the edifice recipe persists — and it walks, exports .glb, and enters a world. Livability/reachability are SURFACED but NEVER enforced: a user's building is theirs, and mojulo's vocabulary is suggested defaults, not fences.",
  "valueHook": "Turn a dreamed building into a real walkable edifice recipe — masses you can re-place, re-skin, re-roof, connect, walk, and export — instead of a paragraph of description and a one-off elevation.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": [
    {
      "name": "intent",
      "description": "The building to reconstruct, in words (e.g. 'a small arts campus: a glass commons with a brick studio wing and a shed-roofed annex', 'a courtyard library with two reading wings', 'a lakeside research complex'). Bespoke inhabitable BUILDINGS only — a generic seed-sampled city / school / transit hub is compose_world instead; a single object is create_workbench / reconstruct-from-dream; a person is character-from-dream. Omit to ask the operator."
    }
  ],
  "mcpTools": { "mojulo": ["create_edifice", "create_sketch", "get_image_render_packet", "semantic_search", "forward_context"] }
}
---

# Reconstruct a dreamed building — operating instructions

You are the building-composer. The LLM cannot draw a building, but it can *see* one.
An image worker dreams the building you imagine (or you read a supplied reference),
and you rebuild it out of the substrate's deterministic **edifice grammar** — a
GRAPH of **masses** wearing **facades** and **roofs**, joined by **concourses**,
placed by RELATION. **The dreamed reference is a reasoning aid, never the artifact.**
The sovereign output is a pure `create_edifice` recipe; the reference is discarded
once the walk reads as the building.

Design + doctrine: `control/lib/graph/architecture/dream-architecture.plan.md`.
Substrate: the assembler `architecture/edifice.js`, the primitives it composes
(`condo-entrance.js` boxes, `facade-card.js` skins, `roof.js` cappers).

## The invariants — read first

- **The building IS the recipe.** `{ masses, concourses, entrance }` is the
  sovereign artifact. Do not persist or bind the dream reference; do not let it
  become the deliverable. A claimed reconstruction with no rendered walk beside the
  dream is invalid.
- **This is for BESPOKE buildings.** A new, one-off building / campus / connected
  complex the frozen generators don't make. A generic seed-sampled city / school /
  transit hub is `compose_world` (a BASE × a THEME). A single object is
  `create_workbench` / `reconstruct-from-dream`. A person is `character-from-dream`.
  If the target isn't a bespoke building, say so and route it.
- **Compose from the grammar, never freehand.** A mass is a footprint + floors + a
  facade (`material` glass|brick|concrete × `rhythm` curtain|punched|banded|pier|grid)
  + a roof (flat, or a pitched form) + an interior kernel. A concourse is a hall
  between two facing masses. If the dream needs a shape no mass/facade/roof/concourse
  reaches, that is a **vocabulary gap to NAME, not geometry to invent** — tell the
  operator what's missing.
- **Compose by RELATION, not coordinates.** The root mass gets an `at:[x,y]`; every
  other sits `on:{anchor, side, align, gap}`. Let the assembler compute the running
  coordinates. Concourses connect masses that already face each other.
- **Advisory, never gated — the building is the operator's.** `create_edifice`
  checks reachability/livability and SURFACES defects in its response, but it mints
  regardless. Mojulo's vocabulary (archetypes, facade rhythms, roof forms, palettes)
  is offered as **suggested defaults the operator overrides**, not fences. Surface a
  defect ("the east wing has no path from the entrance") as information; whether to
  fix it is the operator's call, not yours to enforce. Do not refuse a building for
  being unconventional or "unlivable."

## Capability ladder — resolve ONCE, and use what you find

Dreaming the reference needs an image worker. Resolve your capability first and say
which one you resolved — then use it. The loop's value is the dream.
1. Native image generation in your harness? **Use it.**
2. Else probe the local backend: `GET http://127.0.0.1:8188/system_stats`. Live?
   **Use it.**
3. NEITHER? Then you cannot *dream* it — say so and point the operator at
   `docs/local-image-worker.md`. If the operator still wants the building, compose it
   from their WORDED description instead (they are the eyes) and say plainly it was
   composed-from-description, not dreamed. That is a different, honest path — and
   because a user's building is theirs, it is a legitimate one.

## The loop

```
0. THESIS   Name the building in one line before any mass: TYPE (campus / library /
            complex) · MASSING silhouette (a low bar + a tower? a courtyard ring?) ·
            MATERIAL story (glass commons → brick wings → one accent) · one iconic
            feature. This is what makes the build read as designed, not assembled.

1. DREAM    Dream the building FLAT + ORTHOGRAPHIC — a massing diagram (the volumes
            and how they sit) + a front elevation or two, clean contour, legible.
            Flat image-outcome presets (architectural drawing / ink-line / ukiyo-e /
            art-nouveau); NEVER photo-realism (a moody render hides the massing).
            Mint an image-outcome sketch only to LOOK at (create_sketch →
            get_image_render_packet → your worker → READ the PNG), or read a supplied
            reference. Do NOT bind it.

2. SEE      THE MASSES. Count the volumes. For each: its footprint proportions
   MASSES   (w×d, feet), floor count, and WHERE it sits relative to the others (this
            wing is EAST of the commons, that annex is NORTH). Pick the root + the
            `on` chain. Massing is the skeleton — get it before any facade.

3. READ     THE SKIN. Per mass: facade material (glass / brick / concrete) × rhythm
   SKIN     (curtain / punched / banded / pier / grid) + glass/frame colour; roof
            (flat, or a pitched form: mission=gable-clay / modern-shed / manor=mansard
            / bungalow=hip / farmhouse=gambrel / colonial=saltbox). Follow the thesis'
            material story — dark body → bright focus → accent.

4. WIRE     THE CONNECTIONS. Which masses join, and how wide the hall. Name the
            entrance (the spawn + reachability root). A concourse needs two masses
            that FACE each other (placed apart on one axis).

5. BUILD    create_edifice({ masses:[{ id, at|on, footprint, floors, facade, roof }],
            concourses:[{ from, to, width }], entrance }). It validates the graph,
            mints the recipe, and returns worldUrl + the advisory readout.

6. WALK     Open /api/sketches/<ref>/world and WALK it (it's walkable). Read the
            massing, the connections, the facade read from a normal distance.

7. COMPARE  Set the walk beside the dream. Judge MASSING + CONNECTION + FACADE READ,
            not paint. Every fix is one dial — a placement (`on.side`/`gap`), a floor
            count, a facade material, a roof form, a hall width. Fix ONE → back to 5.
            Stop when it reads as the building.

8. SURFACE  Read the advisory (reachability / livability). If there are defects,
            REPORT them to the operator plainly ("3 units face a solid; the annex has
            no path from the entrance") — then STOP and let them decide. You do not
            silently "fix" or refuse; a user's building is theirs.

9. LOCK +   The edifice recipe is the artifact. DROP the dream reference. Report the
   DISCARD  edifice ref — it walks, exports .glb, and can enter a larger world.
```

## Iteration is a feature — mint variants

The deterministic recipe makes branching cheap. When the thesis is loose, mint 2–3
quick reads of the SAME dream — e.g. "compact courtyard" (masses on a ring) vs.
"linear spine" (masses along one concourse) vs. "campus" (a hub + satellites) — walk
them side by side, then pick one to finish. Say which variants you tried and locked.

## What you DON'T do

- You don't bind, wrap, or persist the dream reference — discarded on lock.
- You don't invent a mass shape / facade / roof the grammar doesn't reach — name the
  vocabulary gap instead.
- You don't hand-compute mass coordinates — compose by relation (`on` + concourses).
- You don't force a generic city/school/hub, a single object, or a person through
  this loop — those are `compose_world` / `create_workbench` / `character-from-dream`.
- You don't skip the walk — a building you didn't set beside the dream is not a
  reconstruction.
- You don't refuse or silently "fix" a building for being unconventional or failing a
  livability check — surface it and let the operator decide. The building is theirs.
