---
{
  "id": "mobile-suit-builder",
  "name": "Reconstruct a dreamed mech as an articulated hardware character",
  "summary": "Use an image worker as the model's EYES to design a MECHANICAL character — a mech, robot, worker bot, android, or power-armored figure — then rebuild it as a deterministic hardware assembly: NOT the organic figure protoform. Lock a ≤5-trait identity, dream and build each SUBSYSTEM (arm / leg / torso / head) as its own iterated segment sheet (whole-body-first is always mushy), compose them into ONE workbench with the right limb MIRRORED, then bake a prop skin (panel seams / bolts / lens glow) over the flat scaffold. Boxy industrial hardware is IMPLIED from rounded monomers (lathe/extrude/sweep/manji) via repetition, tint, scale contrast, and overlap. The dream sheets are discarded on lock; only the assembly recipe (optionally wearing a skin) persists, and it lowers to /world + .glb for free.",
  "valueHook": "Dream a mech or worker-bot and rebuild it as a real turnable hardware character — armored, articulated, skinnable, drops straight into a world — instead of a paragraph of description and a one-off picture.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": [
    {
      "name": "intent",
      "description": "The mechanical character to reconstruct, in words (e.g. 'a stocky safety-yellow worker bot with massive practical limbs', 'a lanky recon mech with a single-lens head', 'a heavy black-and-orange loader android'). Articulated hardware characters only — an organic body goes through character-from-dream, a piece of furniture / a vessel / a relic goes through reconstruct-from-dream. Omit to ask the operator."
    }
  ],
  "mcpTools": { "mojulo": ["create_sketch", "get_image_render_packet", "create_workbench", "create_manji_tree", "semantic_search", "get_sketch_vocab", "get_skin_packet", "skin_polygomer"] }
}
---

# Reconstruct a dreamed mech — operating instructions

You are the mech-fitter. The LLM cannot draw, but it can *see*. An image worker
dreams the machine you imagine — its subsystems and how they bolt together — and
you rebuild it out of the substrate's deterministic 3D parts. **The dreamed
sheets are a reasoning aid, never the artifact.** The sovereign output is a pure
hardware-assembly recipe (and, optionally, a bound skin); the sheets are
discarded once the `/world` render reads as the machine.

This is the ARTICULATED-HARDWARE-CHARACTER register — it sits on the seam
between the figure family (organic bodies) and the object family (furniture,
vessels). A mech is a character (it has an identity and a silhouette to protect)
built like an assembly (surfaces of revolution + prisms + tubes). Neither
neighbour serves it: the figure protoform reads too fleshy, and the plain object
loop has no identity-lock or bilateral discipline.

Design + doctrine: `mobile-suit-builder.plan.md` (archived under
`lite-template/integration/archive-mobile-suit/plans/`, untracked).
The hardware IDIOM (identity lock · boxiness-from-rounded · palette-as-taxonomy ·
the lathe grammar) is the `mobile-suit` sketch-vocab card — pull it in step 2.
Substrate: `docs/POLYGONIZER-SYNTHESIS.md`; assembler
`control/lib/graph/polygonizer/workbench-assembly.js`.

## The invariants — read first

- **The mech IS the recipe.** The assembly recipe (and optional skin) is the
  sovereign artifact. Do not persist or bind the dream sheets, do not wrap them
  onto geometry. A claimed build with no `/world` render beside the dream is
  invalid.
- **NOT the figure protoform — and kill it fast.** A mech reads as *layered
  armor over a dark frame*, not a tuned body. If you catch yourself reaching for
  `create_figure` / the protoform, stop — a four-minute rejection is a win, not a
  failure (this is the exact detour the reference build discarded). An
  organic-bodied character is `character-from-dream`'s job; if the target is
  really a person, say so and switch loops.
- **Segment-first — the whole body last.** Do NOT dream or build one whole-body
  sheet; the first whole-body pass is ALWAYS mushy. Decompose along real seams —
  **arm / leg / torso / head** — dream and iterate each subsystem in isolation,
  then compose. The assembly inherits better limb logic from focused passes.
- **Identity lock, restated every pass.** Fix a ≤5-trait thesis (color · core ·
  accent · silhouette · mass) before any part, and repeat it on every subsystem.
  This is the anti-drift device — a simple thesis kept in view is what stops the
  build sliding into generic-robot territory.
- **Build only what three.js can draw.** Every part resolves to ONE buildable
  monomer — `lathe` (round masses: barrels, drums, pistons, domes), `extrude`
  (slabs/plates: armor panels, brackets), `sweep` (tubes: cables, rails, limb
  spars), or a `manji` face for rectilinear structure. Boxy industrial hardware
  is an ILLUSION built from rounded monomers via **repetition** (rows read as
  louvers/knuckles/treads), **tint** (near-neighbour grays read as panel breaks),
  **scale contrast** (a fat drum beside thin struts reads as a housing), and
  **overlap**. A part that fits no monomer is a vocabulary gap to name, not to
  fake.
- **Superposition is the armor — don't separate cleanly.** Let parts
  interpenetrate; overlapping plates over a dark frame is exactly the
  construction-machine read. Chasing clean part separation flattens it.
- **Compose by RELATION, not coordinates.** Use the assembler: declare each
  part's SIZE and how it CONNECTS (`on` / `gap` / `offset` / `radial` /
  `mirror`), never a hand-computed z. Model ONE side of the machine and
  **mirror** it — half the work, free left/right consistency.

## Capability ladder — resolve ONCE

Dreaming the sheets needs an image worker (same ladder as
`reconstruct-from-dream`):
1. Native image generation in your harness? Use it directly.
2. Else probe the local backend: `GET http://127.0.0.1:8188/system_stats`.
3. Neither? Stop and point the operator at `docs/local-image-worker.md`. No
   eyes, no loop.

## The loop

```
0. IDENTITY  Name the machine in ONE line before any part: color · core ·
   LOCK      accent · silhouette · mass (e.g. "safety-yellow worker bot, black
             mechanical core, orange handles, compact head, massive practical
             limbs"). Restate it at the top of every subsystem pass.

1. DREAM     PER SUBSYSTEM, not whole-body. For each of arm / leg / torso /
   SHEETS    head, draw the DECOMPOSABLE REGISTER (flat, orthographic, labeled,
             exploded — presets ukiyo-e / art-nouveau / flat silver-age /
             ink-brush; NEVER photo-realism, which hides the seams). Mint
             image-outcome sketches only to LOOK at (create_sketch →
             get_image_render_packet → your worker → READ the PNGs). Don't bind.

2. SEE +     Count each subsystem's parts; name each part's buildable monomer
   IDIOM     (lathe/extrude/sweep/manji). Pull the hardware idiom:
             semantic_search({ kinds:['sketch_vocab'], query:'mech / mobile
             suit / worker bot hardware' }) → get_sketch_vocab('mobile-suit').
             Recall shelf help too: semantic_search({ kinds:['manji_program'] }).

3. BUILD     Author each subsystem's parts and iterate it IN ISOLATION (title
   SEGMENTS  carries the decision — "slab boot" → "flat tread boot"). Over-detail
             here on purpose; you're learning the shape language, not budgeting.
             Gate: the subsystem reads as the part head-on before it joins.

4. COMPOSE   create_workbench({ assembly: { parts: [ … ] }, sweeps: [ … ] }) —
   + MIRROR  ONE assembly holding all subsystems. Model the RIGHT arm + leg only
             and `mirror` them for the left. ACCEPT lower per-limb fidelity than
             the isolated sheets had — spend the part budget where it reads at
             body scale. Palette carries the taxonomy: identity color ×10-15,
             graphite frame ×~half (many near-tints for panel breaks), amber
             metal ×10-15, one saturated cyan ×2-3 for eyes/lenses.

5. RENDER    Open /api/sketches/<ref>/world — the three.js machine. (Validation
             is at mint; a bad assembly fails at create_workbench, not render.)

6. COMPARE   Read /world against the sheets. Judge STRUCTURE + SILHOUETTE +
             the identity thesis, not shading (/world is flat-lit). Fix if a
             part is missing / on the wrong support / clipping / off-proportion,
             or if the identity has drifted. One fix → back to step 4.

7. SKIN      (the coequal finish, not a garnish) Geometry gives mass +
   BAKE      turnability; the SKIN gives panel seams, bolts, scuffs, lens glow,
             grime — the finished-prop feel. get_skin_packet({ ref }) → paint
             over the ?control=1 scaffold with your worker → skin_polygomer({
             ref, image_path }) → /skin.png. KNOWN LIMITATION: single-view skin
             projection — front / three-quarter bake far stronger than side /
             back. Say so in your report; don't oversell "turnable" as skinned
             from every angle.

8. LOCK +    The assembly recipe (+ optional skin) is the artifact. DROP the
   DISCARD   dream sheets — do not reference or bind them. Report the ref. It
             already lowers to /world and the .glb export; the mech is done.
```

## Iteration is a feature — mint register variants

The deterministic refs make branching cheap. When the thesis is loose, mint 2–3
reads of the SAME machine at different registers — "worker" (blocky, practical
limbs, safety livery), "combat" (angular armor, dark palette), "scout" (lean,
single big lens) — read them side by side, then pick one to skin and finish. Say
which variants you tried and which you locked.

## What you DON'T do

- You don't bind, wrap, or persist the dream sheets — discarded on lock.
- You don't reach for the figure protoform — a mech is hardware; kill that
  detour fast and route true people to `character-from-dream`.
- You don't dream or build the whole body first — segment sheets, then compose.
- You don't fake an unbuildable part — name the vocabulary gap instead.
- You don't hand-compute coordinates or hand-duplicate the left side — declare
  relations and `mirror`.
- You don't force clean part separation — overlap is the armor.
- You don't skip the compare step, or oversell the skin — front/¾ reads; call
  out the weaker side/back bake honestly.
