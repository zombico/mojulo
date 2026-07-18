# Character-from-dream — the tuned protoform as the character creator's standard body

Status: IN PROGRESS — C0/C0b/C3 landed + C1 substantially landed (inline
garments + color + fluff MCP wiring in; the character-sheet `body` channel +
real turnaround cameras + per-outfit `wardrobe[]` LANDED & tested —
`character-sheet-body.test.js`, 11 green; only the two deferred C1 items remain:
wardrobe pieces as bindable refs + the `radii` override map) + C2 landed
(`wardrobe-construction` vocab card) + the `character-from-dream` catalyst landed
(the figure-register dream→dials loop, sibling to object-register
`reconstruct-from-dream`); C4 open. The
FIGURE register of the dream loop (sibling to
shape-from-dream's object register), aimed at the character creator: give
dreaming a **standard body shape** so a character stops being prose + a painted
sheet and becomes a **deterministic body recipe** — tuned protoform + svgile-row
wardrobe + bound skin — that every downstream surface (sheets, keyframe cels,
worlds, .glb) derives from.

## Why the substrate is already 90% of the way there

Three closed, enumerable dial-sets exist that an LLM can emit *from looking at
a dreamed character* — the same closed-vocabulary move that made image-outcomes
cameras/poses work:

1. **The body is tuned, not sculpted.** `DIMORPH` (figure-rig.js:26) is the
   m/f pole — seven numbers. `PROTO_DEFAULT` (figure-proto.js:34) is the
   bulk/proportion surface — `height`, `stockiness`, `headScale`, plus ~15
   per-region multipliers (`chestWidth`, `bicep`, `quad`, `waistTuck`,
   `gluteSize`, …). Mega-boy proved the precedent: a whole character register
   reached by a radii map, no armature change. **A body is ~20 monotone
   numbers.** Low-dimensional, self-correcting under render→Read→compare.
2. **Clothing is a spec resolved against ANY body.** The garment charter
   (figure-garments.js:1-31): offset shells over the figure's own flesh — a
   garment auto-tracks every proto/dimorph tuning with zero garment-specific
   math ("a tee on the female pole follows the bust; on the male pole the pec
   plates"). The dream never has to reconcile clothes with body tuning; the
   substrate does it by construction.
3. **The wardrobe language is dream-readable.**
   - *Instrument*: the `GARMENTS` table (tee/tank/gown/trousers/jacket/sash/…).
   - *Score* (the mugen): slim vs baggy is ONLY the clearance number
     (figure-fluff.plan.md's "mugen score" — factor standoffs into a named
     table). "Oversized hoodie" = jacket instrument + fat score.
   - *Tailoring*: svgile-row cuts (`wedge`/`band`/`capsule`/`hole`) at
     body-relative anchors (`collar`/`hem`/`waist`/`crotch`/`neck`/`armhole`)
     + `panels` (recolour dual). "Crop top, open front" = band cut at waist +
     front wedge. The red-line seam falls out as drawable structure.

## The two dream directions

**A. Dream → dials (reconstruction — the shape-from-dream move).** Worker
dreams the character concept (or reads a supplied reference). The LLM does not
trace it — it *tunes*: pick the `DIMORPH` pole, set proto multipliers, pick
garment instruments + mugen scores + cuts/panels, choose register
(`proto` | `fluff` for mascots/mechs). Render the tuned+dressed figure, compare
to the dream, adjust (the dials are monotone — "shoulders wider, hem lower" are
single-number moves). Dream discarded on lock / kept as provenance. The
sovereign output is the body recipe.

**B. Dials → dream (scaffold — the meru-guide move).** The tuned, dressed,
posed figure renders as the filled control scaffold the worker paints OVER —
exactly the keyframe-animation bicycle, upgraded: the guide is no longer the
generic mannequin but *this character's* body wearing *this character's*
silhouette. Applies to:
- **character-sheet/v2**: turnaround rows derived from the body recipe (front /
  three-quarter / side / back = four camera renders of ONE body — geometric
  identity lock, not prose), one row per outfit = same body, different garment
  spec. Pose rows via `sampleMotionPose` / emotes at a phase.
- **keyframe cels**: meru guides carry the tuned body + clothed silhouette →
  on-model silhouettes across cels for free.
- **skin**: paint over the character scaffold → camera-registration projection
  (the skin_polygomer move, applied to figure ring-stacks) → the figure WEARS
  the skin deterministically in stills/worlds/.glb.

## The manifest sketch

`character-sheet` (or a new `character-body` channel on it) gains:

```jsonc
{
  "body": {
    "register": "proto",              // proto | fluff
    "sex": "female",                 // DIMORPH pole
    "proto": { "height": 1.04, "stockiness": 0.92, "quad": 1.15, ... },
    "radii": null                     // optional mega-boy-style override map
  },
  "wardrobe": [                       // one entry per sheet row
    { "garment": "jacket", "score": { "clearance": 0.30 },
      "cuts": [{ "kind": "band", "at": "hem", ... }], "panels": [ ... ],
      "color": { "cloth": "#123", "under": "#456" } }
  ],
  "poses": [{ "motion": "walk", "phase": 0.25 }, { "emote": "think" }]
}
```

The render packet derives every guide from this; nothing baked. Existing
prose-only sheets keep working (body optional).

## Increments

1. **C0 — spike the loop by hand** (no new substrate): ✅ LANDED (2026-07-13).
   Dreamed a stocky female harbor mechanic; converged in TWO dial passes
   (`sk_c0_dream_mechanic` / `_p2`). Proof + retrospective:
   `lite-template/integration/0713/spike-output/character-from-dream/`.
   Key finding: the dream's silhouette bulk must be attributed to the garment's
   mugen score FIRST and the body second (pass 1 chased sleeve volume with the
   bicep dial — wrong register). Missing vocabulary surfaced: garment colors
   not threaded through create_figure, no mugen-score dial (looseness is baked
   into instrument names), no footwear/hair instruments, and vest+tank layering
   tears (pairing facts belong in the C2 cards).
1b. **C0b — wardrobe pieces as artifacts**: ✅ LANDED (2026-07-14, same spike
   dir). The course correction: C0 one-shotted the outfit through the baked
   GARMENTS enum; the substantial move is the IKEA doctrine applied to the
   wardrobe — dream an EXPLODED parts sheet (each piece alone + a construction
   read), reconstruct each piece as a STANDALONE garment spec, superpose over
   any figure with its own mugen score. Proven with `DREAM_PANTS(score)` +
   `DREAM_BOOTS` (footwear minted from primitives — the missing instrument was
   one spec away): same spec objects re-tailor onto the canonical female and
   the stocky mechanic; slim-vs-baggy is only the score. Two load-bearing
   findings: (a) `renderFigureToSvg` already accepts inline garment specs —
   only the MCP schema enum-gates them, so C1/C2 are mostly an unlocking, not
   a build; (b) the image model's native construction register is CUT-AND-SEW
   PANELS (Sheet B came back as sewing patterns, not ring wireframes) — the
   dream-read should target the svgile-row vocabulary directly.
2. **C1 — the body channel** on character-sheet + guide derivation (turnaround
   cameras over one tuned body; reuse figure-render). **The inline-garment
   unlock is FORMAL (2026-07-14):** `create_figure.garment` accepts inline
   wardrobe-piece specs (validated by `validateGarmentSpec` in
   figure-garments.js — closed fit/cut vocabularies refused at mint), mixed
   with wardrobe keys in one layering array; the human-figure routing card +
   illustration toolset drawer teach it and the skin flow; `sketch_polygomer`
   + `get_skin_packet` canonized into TOOL_INDEX/RING10 (they were registered
   but unindexed). Proven through the live MCP surface
   (`sk_inline_wardrobe_proof`). **The color dial landed too (working tree,
   2026-07-14):** the inline garment spec now threads `color:{cloth,under}`
   (hex, validated) — closing C0's "garment colors not threaded through
   create_figure" gap — and the `fluffs` register is now a first-class
   `create_figure` input (`validateFluffs`), which also satisfies
   shape-from-dream's DF fluff-wiring prerequisite. **The character-sheet `body`
   channel + real turnaround cameras + per-outfit `wardrobe[]` LANDED (working
   tree, 2026-07-14; `character-sheet-body.test.js`, 11 green)** — see the design
   section below. Still open in C1: wardrobe pieces as their own bindable refs +
   the `radii` override map (both deferred by design).
3. **C2 — wardrobe cards**: ✅ LANDED (2026-07-14). The GARMENTS instruments +
   mugen-score (`clearance`) table + svgile-row cut/panel vocabulary as one
   `sketch_vocab` card — `sketch-vocab/wardrobe-construction.md` (tier `recipe`,
   authored against the LIVE closed sets `GARMENT_FIT_KINDS` /
   `GARMENT_CUT_KINDS`, not the plan's approximation; indexed into
   meta_embeddings, retrievable via `semantic_search({kinds:['sketch_vocab']})`
   → `get_sketch_vocab`). Carries the pairing facts (jacketCut+tank composes;
   vest+tank tears) + panel/cut `on`-scoping. Also folds in the Codex
   dream-direction pass: a §0 **character thesis** (role / silhouette / one
   iconic hook) and the **material-story hierarchy** (dark body → bright focus →
   accent, mapped to `color.cloth` / panel / `color.under`).
4. **C3 — skin_figure**: ✅ LANDED (2026-07-14) — as a kind-dispatch on the
   existing seam, not a new tool: `renderFigureToSvg` grew a `control` mode
   (filled + per-face `data-shade`, the manji lit-face contract), and
   `skin_polygomer` / `get_skin_packet` / `?control=1` / `skin.png` accept
   `kind:'figure'`. Proven end-to-end on the C0 mechanic (scaffold → ControlNet
   paint → 24,299 faces wear it): spike dir `character-from-dream/`, test
   `figure-skin.test.js`. **The polygomer half of the 3D leg landed (working
   tree, 2026-07-14):** `manji-tree` is a live `WORLD_KIND`
   (`assembleManjiTreeWorld`) that bakes the bound skin onto its 3D faces
   (`loadBoundSkin` → `latestSkinInput`), so a skinned polygomer wears the paint
   in `/world` + `.glb` (the angler-knight / metal-fly path — see
   plan-archive/polygomerization.plan.md). Still deferred: the FIGURE 3D leg —
   baking the bound skin onto figure faces in worlds/.glb (`figure` is not yet a
   `WORLD_KIND`; follow the polygomer's `bakeSkinOntoFaces` through
   `renderFigureWorldFrames` + the figure camera/fit transform).
5. **C4 — thread into keyframe meru guides**: guides read the character's body
   recipe instead of the generic rig defaults. **Substrate piece landed (working
   tree, 2026-07-14):** `renderFigureWithArmature` renders the figure AND returns
   its armature nodes in final SVG pixel coordinates (the declared-coordinate
   seam of animation-cheats.plan.md) — pixel-aligned OpenPose skeletons / joint
   anchors the guides can read. Still open: the guides actually sourcing the
   character's body recipe.

## C1 body channel — the design (LANDED 2026-07-14; `character-sheet-body.test.js`)

The plan's headline `{ body, wardrobe, poses }` manifest is realized **on the
existing character model, not as a parallel top-level channel** — a deliberate
call so the identity-reuse seam (sequential-art / keyframe inline a `character`
block by ref) keeps flowing through one shape. The character-sheet already
carried `character.rig` (the shared body: proto/pose/motion/view/setup) and
`character.outfits[]` (the rows), and the scaffold already renders an
outfit×view figure strip from them. Two gaps made it fall short of a real
turnaround; C1 closes both plus the fluff register:

- **Real turnaround cameras.** `renderCharacterSheetSvg` labelled its four
  columns front / three-quarter / side / back but rendered every column at the
  *same* camera (the cell figure never received the column's view). Fix: a
  `SHEET_VIEW_CAMERA` map (`front→frontal`, `three-quarter→three-quarter`,
  `side→lateral`, `back→back`) drives each cell's `rig.view`, so the strip is
  four real cameras of ONE tuned body — the geometric identity lock the plan
  wants (not four repeats).
- **Per-outfit wardrobe (the `wardrobe[]` channel).** `rig.garment` was a single
  garment shared across every row. Now each `outfit` may carry its own figure
  dials — `garment` (a wardrobe key, an inline svgile-row spec, or an array that
  layers, validated by the shared `validateGarmentField`), plus optional
  `pose` / `motion`+`phase` / `proto` — merged OVER the shared `rig` body at
  render (`{ ...rig, ...outfitDials, view: camera }`). One row per outfit = same
  body, different garment spec, exactly as specified. An outfit carrying dials
  without a `character.rig` is refused (a wardrobe needs a body to hang on).
- **The fluff register.** `rig` (and per-outfit `proto`) validation gains
  `fluffs` (via `validateFluffs`), so a mascot/mech body works; `register` is
  implicit (fluffs present ⇒ fluff, mirroring `create_figure`). Also closes a
  real hole: `rig.garment` was passing through `normalizeRig` **unvalidated** —
  now gated by the same closed vocabulary as `create_figure`.

Nothing is baked: the guides derive from `{rig, outfits}` at scaffold/packet
time, and prose-only sheets (no `rig`) render the historical stick strip
unchanged. Still open after this slice: **wardrobe pieces as their own bindable
refs** (an outfit's inline spec is reusable data but not yet a first-class
artifact), and the `radii` mega-boy override map on the body (proto dials only
for now).

Housekeeping caveat carried on this branch (not C1 feature work): the
tool-description ratchet overruns on four of Codex's `create_figure`-adjacent
descriptions + the payload ceiling — the operator's to bless.

## Doctrine holds

- Recipes not renders: the character IS `{body, wardrobe, poses}`; sheets/cels/
  skins are bound derived renders with provenance.
- Dream sheets discarded on lock (figure-loop honesty rule: a claimed tune with
  no bound reference is invalid).
- Two gates: deterministic (garment superposition test, pose LIMITS clamps,
  MERU scale audit) vs the rider's eyes (does it read as the character).
- Closed vocabularies only — no freehand geometry from the dream; every dial
  already exists and is clamped.

## Out of scope

- New garment geometry (the GARMENTS table + cuts is the v1 wardrobe).
- Non-humanoid bodies (that's shape-from-dream / polygomerization's register —
  though fluff-as-monomer will eventually meet this from the other side).
- Character *acting* / voice (operator call 2026-07-13: out of scope).
