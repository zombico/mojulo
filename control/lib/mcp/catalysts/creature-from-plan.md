---
{
  "id": "creature-from-plan",
  "name": "Build a creature from a ring plan — a worker prints the spec, mojulo draws the body",
  "summary": "The creature register of the dream loop, landing in the LAYERED grammar: issue a species-free SPEC FORM (a ring plan: joints, segments with ring radii, chains, claws by address, a head worn at a shift, dials / rig / clips as data), have a worker fill it (a text model, fast; or an image model dreaming a clay blockout you read rings off), mint it through `mint_solid { kind: 'layered', via: 'plan' }`, draw the wire at the reference's named azimuths, score the silhouette and the exposure ledger, fix by number, lock. The reference is scaffolding; the plan and its recipe are the artifact, and the body arrives posable and exportable.",
  "valueHook": "Turn a sentence into a rigged, watertight creature — a dragon, a monster, an invented animal — that plays its clips on the World page and exports to the engines, by having a worker print a numeric ring plan mojulo draws, instead of a paragraph and a one-off picture.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": [
    {
      "name": "intent",
      "description": "The creature in words (e.g. 'a hulking dragon with lizard legs and a detailed head', 'a lean four-legged swamp hound', 'a squat armoured beetle-bear'). Invented or organic bodies only — a person is character-from-dream, a real species with a real skeleton is mint_solid kind 'animal', a lamp or a machine is reconstruct-from-dream. Omit to ask the operator."
    }
  ],
  "mcpTools": { "mojulo": ["get_solid_vocab", "mint_solid", "update_sketch", "measure_solid", "export_model", "semantic_search", "get_image_render_packet"] }
}
---

# Build a creature from a ring plan — operating instructions

You are the body-planner. The LLM cannot sculpt, but it can write a plan and it can see. A RING
PLAN is the compact authoring form of a `layered` solid: a joint table, segments along the joints
with ring radii, chains, claws placed by address, a head worn at a shift, dials, a rig and clips —
all data. `expandPlan` turns it into a watertight recipe deterministically; the recipe is the
compatibility promise and the plan is the authoring record, stored beside it. **Whatever printed
the numbers is scaffolding**: a text worker's answer, an image worker's clay blockout, your own
reading. The sovereign output is the plan + recipe row, which poses, animates, measures and exports.

Grammar: `get_solid_vocab({ id: 'layered' })` (the Plan section names every field). Worked plan:
`docs/examples/dragon-body/seed-recipe.mjs` (a rigged biped wearing a detailed head); a bare
quadruped in `docs/examples/ring-plans/`.

## The invariants — read first

- **The plan IS the artifact.** Do not persist the worker's text or pictures; do not bind a dream
  image. A creature with no plan row is a paragraph, not a creature.
- **Numbers, not pixels.** The fast path asks a TEXT worker for the plan JSON in the slot names
  mojulo issued. The image path exists for a form you cannot imagine: dream ONE segment at a
  time as a clay blockout in the CCA frame, read its rings at the issued stations, and write the
  numbers yourself. Either way the plan validates or refuses with the field named.
- **Matched azimuth or no compare.** A render beside a reference means nothing unless they share
  a camera. Draw the wire at the reference's NAMED view (frontal / three-quarter /
  three-quarter-left / lateral / left / back) and read `--compare`'s numbers; a picture read at a
  guessed angle is not a comparison.
- **A body is not done at its silhouette.** The form gives you a blob that reads from a distance.
  Detail is added in PASSES per segment, each pass a layer that rides the one below by address (see
  "Detail passes"). Stop after the form only if the operator asked for a blockout; otherwise keep
  working the segments and report which passes each one has had.
- **Every fix is a number.** A shoulder too narrow is a ring radius; a snout too long is a station's
  `t`; an arm too low is a joint. Patch `/plan/...` and re-read. Never re-mint for a change.
- **Not a person, not a real species, not a machine.** Those loops exist; use them. This loop is for
  invented organic bodies and detailed heads. A HUMAN character on this same grammar is `create-hero`
  (the hero form on the vajra rest skeleton, a style register, a face and hair as head data).
- **Provenance is signed, not proven.** Mojulo is loopback and cannot watch a worker. When a worker
  printed the plan, pass `plan_audit { source: 'text:<model>' | 'image:<worker>', prompt, id }` on
  the mint; `source: 'agent'` says you wrote the numbers yourself. A malformed audit refuses; a false
  one is a lie the operator's eyes will catch (a worked plan reads differently from an imagined one).

## Capability ladder — resolve ONCE

1. A text model you can call (your own reasoning counts, and is `source: 'agent'`): the FAST path.
2. An image worker (native generation, or ComfyUI at `127.0.0.1:8188`): the SLOW path, for
   a form you need to see. 8–14 minutes a view on a laptop; the front is the identity, side and back
   are hallucinated and advisory.
3. Neither? You still have the fast path with `source: 'agent'`. Say so.

## The loop

```
0. THESIS   One line, ≤ 5 traits: silhouette (needle / bell / barrel / column) · stance (biped,
            quadruped, digitigrade, plantigrade) · head (long snout / short muzzle / beak) · the one
            iconic feature · scale in metres. Restate it every pass.

1. FORM     Pick the form below (biped / quadruped / head-only) and fill the fixed names. Leave the
            numbers as `?`. The form fixes: frame (+z up, +y front, x = 0 mirror, metres, soles on
            z = 0), the joint names (RIGHT side; `$S` names both sides), the segments and their slot
            families, which chains exist, where claws pin.

2. FILL     Hand the form to the worker with the request template (below). Read the answer as JSON.
            The image path instead: dream one segment as a clay blockout (`clay-render`,
            `construction ≤ 0.3`, ONE subject, near-orthographic), read the ring radius at each
            station from the picture against the issued grid, and write the numbers.

3. MINT     mint_solid({ kind: 'layered', via: 'plan', spec: { plan, title, plan_audit? } }).
            Refusals name the plan field (a joint the table lacks, a midline part off x = 0, a claw
            on a face that is not there, a stretch dial not declared). Fix the plan, not the recipe.

4. LOOK     measure_solid({ ref }) → closure per part, size in metres, the EXPOSURE ledger (a
            detail flagged `buried` never leaves its host: move its base or lengthen it). Open
            /sketches/<ref> (the World page; a rigged plan plays its clips there).
            scripts/export-wire-svg.mjs --ref <ref> --views 180,150,90,0 draws the exact wire.

5. COMPARE  With a reference at a known view: export-wire-svg.mjs --ref <ref>
            --compare frontal=ref.png[,lateral=side.png]. Read compare.json: `iou` (shape
            overlap after both are fitted to their boxes), `aspect` (reference width/height over
            the source's: > 1 means the reference is broader), `centroid` (mass offset, fraction of
            height), `fill` (a line drawing scores a note — the compare wants a filled silhouette).
            The sheet shows reference | silhouette | overlap (red = reference only, blue = source only).

6. FIX      One number at a time: update_sketch({ ref, patch: [{ op: 'set', path:
            '/plan/segments/3/rA', value: 0.21 }] }) — the recipe re-expands. A dial is a live knob
            instead: patch '/dials/<name>'. Back to 4.

7. RIG      (biped form) declare `rig` + per-segment `bind` + `clips` in the plan; the mint pays the
            rig gates (valid weights, rest identity, planted toes). export_model({ ref, format:
            'glb', skinned: true, clips: '_all' }) ships it.

8. DETAIL   Per segment, the passes below, in order; a pass is a plan or recipe edit, never a
            re-mint. After each pass: closure (measure_solid), exposure (nothing new `buried`), the
            wire at the segment's best view. Keep a SEGMENT LEDGER: segment × pass → done / pending /
            not wanted, and say why a pass is not wanted (a smooth-skinned beast has no scales).

9. LOCK     Report the ref, the thesis, what the worker printed vs what you changed, the compare
            numbers at the views you had, the exposure flags, and the segment ledger. Discard the
            reference.
```

## Detail passes — how a segment is worked after the form reads

The head-detail line (`docs/examples/head-detail`, grown on the `planar-detail` branch) is the
worked method for going from a ring loft to a detailed part. Its order is the order to follow on
ANY segment, and each pass is a named operator or a data entry, not sculpting:

| Pass | What it adds | How it is expressed | Rule it obeys |
| --- | --- | --- | --- |
| 1 Form | the ring loft itself | a plan segment: joints, `rA` / `rB`, `e`, stations | mirrored by name; overshoot fuses joints |
| 2 Density | more stations / slots where detail will sit | `refineStation` / `refineSlot` (addresses frozen first) | nothing renumbers; every address keeps its meaning |
| 3 Masses | a jowl, a chest swell, a haunch pushed out of its ring | `volumize` (slots × stations × amount), a `scale` / `offset` dial | before refinement, so inserts interpolate it |
| 4 Regions | the articulating parts: eye + surround + brow, nostril, fold, cheek web, tongue, mouth corner | regions placed by address, `bone` vs `skin` carrier declared | clearance (a lid never inside the eyeball, a tongue never below the jaw); each region claims a KEEP-OUT |
| 5 Ornaments | horns, teeth rows, crest spikes, ears, a nose pad, claws | `sweep` with `curl`, teeth rows by address, `claw` details, a `dish` (an ear bowl), a `collar` on a sweep's ring (horn ridges, knuckles) | built from the host's own points, so they ride a curl or a hinge |
| 6 Grown patches | scales, plates, tufts, fur | `tiles` over an (s, t) window: `sides`, `coverage` (shingles), `inset`, `height`, `lean`, `brick` | seeded per tile id; decided on the REST carrier; yield to keep-outs; `edgeFade` + `thin` so a patch has no hard border |
| 7 Correctives | wrinkles: nose-bridge ridges, a glabella line, crow's feet | driven strips: `h × (rest + Σ drive · control)` | always present at rest height, so the part set never depends on the expression |
| 8 Hair | barbels, vibrissae, a mane's guard hairs | `whiskers`: tapering sweeps rooted at addresses, drooping under world gravity read through the RIGHT frame | the left set mirrors by name |
| 9 Colour | groups → palette | `palette` by face group (Sclera / Iris / LidRim / Scales / …) | a material over a name, never geometry |

What the plan grammar carries TODAY: passes 1, 3 (dials), 5 (`claw`), 9, and the whole head as an
`include` baked from the head-detail operators (`station-loft-detail.js`). Passes 2, 4, 6, 7, 8 are
authored through those operators (a head's data table names them) and bake into pinned parts; they
enter the plan form as `details` kinds as the planar-detail line lands. Do not fake a pass the grammar
lacks with hand-placed coordinates — name it pending in the ledger.

Rules that hold across every pass, whatever the segment:

- **By address, never by index.** A detail names the (s, t) it sits at; refinement, dials and
  expressions move the carrier under it and it rides.
- **Regions before growth.** Place what articulates first; grown detail (tiles, hair) yields to it.
- **Decide on the rest carrier.** Which tiles exist, which keep-outs hold, is read at rest, so an
  expression changes shapes, never the part set (ids stay dial-invariant; the rig binds once).
- **No hard borders.** A patch fades and thins at its window edge; a ridge tapers to the skin.
- **Two carriers.** Skin maps move the skin copy only; teeth, horns, eyes and the tongue ride the
  bone, so a lip can lift over a tooth.
- **Ornament on ornament is allowed** (a ridge on a horn, a bowl in an ear) when it is built from the
  host's points, so it follows the host.
- **A second body proves a pass.** A pass that only works on the dragon is data pretending to be an
  operator; the bear is the head-detail line's second head for that reason.

Working a body: after the form compares well at its views, take the segments in the order the eye
reads them (head, then hands and feet, then the torso's masses, then the limbs' patches, then the
tail), and at each segment run passes 2 → 8 as far as the thesis wants. A creature "done" with a
detailed head on a blank body is a head study, and the ledger should say so.

## Art direction — what the passes are FOR

Density is not the goal; a readable character is. Hold these while working the passes (they came from an
outside art review of the dragon and the vulture, and they held):

1. **Primary masses first.** Iterate three head/body ratios and shoulder widths in silhouette, front /
   profile / three-quarter, before any pass 2+. A head that reads small against the torso and wings is a
   proportion problem no scale pass fixes; a shoulder/neck junction that reads as assembled segments is a
   ring-radius problem. Use the style register and `e` to make long intentional planes, not merely fewer vertices.
2. **A hierarchy of detail.** As a composition exercise, not a metric: about 60 % quiet form, 30 % structural
   detail, 10 % focal accents. Concentrate contrast at the eyes, the mouth and ONE equipment signature; keep
   wing panels and the abdomen quiet. Several similar gold accents compete with the face.
3. **Patterns follow anatomy.** Chest scutes broaden over the rib cage, narrow at the waist, overlap downward,
   and vary their spacing on purpose; a perfectly regular ladder reads as a grille. Feathers organise into
   large overlapping groups before individual vanes. Seeded variation inside a designed rhythm, never noise everywhere.
4. **The face is a designed system.** Clarify brow → lid → cheek; set the pupil/iris aperture and the lid shadow
   at the real viewing distance; prefer one readable mouth corner and a few decisive teeth over a glittering
   uniform row. Check neutral, snarl and surprise at small size.
5. **Materials differ through SHAPE.** Bone: tapered sections, sparse ridges. Metal: broad stable planes,
   deliberate bevels. Leather: thickness, an attachment seam, controlled looseness. Membrane: root tension,
   restrained ribs. Do not give every material the same small triangular break-up.
6. **Asymmetry tells a story.** One defended shoulder, one bare arm, a repeated emblem, a limited accent palette.
   An adornment can pass the exposure ledger (it reads) and still be visually unnecessary; the ledger says it is
   seen, you decide whether it is wanted.
7. **Lighting is a separate comparison.** Judge form under a key and a fill with the SAME mesh and camera; never
   compensate for unclear form with surface noise.
8. **Protect the read in motion and at distance.** Look at ~128, 256 and 512 px character height and remove what
   only shimmers. The motion proof (turn the head, raise the armed arm, crouch, half-fold the wings) comes
   BEFORE the ornament library grows: movement exposes the construction.

The deliverable that proves the loop is one finished character, three views, three expressions and one short
motion test, with a deliberately limited vocabulary — not a denser static build.

## The request template (the fast path)

Send the worker exactly this, with the chosen form pasted in:

> You are filling a RING PLAN for a 3D creature compiler. Frame: metres, +z up, +y is the creature's
> front, x = 0 is its mirror plane, the soles rest on z = 0. Replace every `?` with a number. Keep
> every name exactly. `joints` are the RIGHT-side joint positions [x, y, z]. A segment runs from
> joint `from` to joint `to`; `rA` / `rB` are its ring radii at those joints, a number or
> `[across, front-to-back]`; `e` is the ring's squareness (2 = ellipse, 2.6 = boxy). A trunk lists
> stations `{ z, r: [across, front-to-back], yc? }` along +z. A chain lists radii, one per joint.
> Claws: `base` (world point, just inside the host), `dir`, `length`, `radius`. Thesis: <the thesis>.
> Return the JSON only.

## Forms

**Biped** (the dragon body's shape; the rig and clips come from the worked plan):

```json
{ "schema": "layered-plan-v1", "frame": { "up": "+z", "front": "+y" },
  "joints": { "hip": "?", "knee": "?", "hock": "?", "toeBase": "?", "toeTip": "?", "shoulder": "?", "elbow": "?", "wrist": "?", "knuckles": "?", "neckBase": "?", "neckTop": "?", "tail0": "?", "tail1": "?", "tail2": "?", "tail3": "?" },
  "segments": [
    { "name": "pelvis", "kind": "trunk", "stations": [{ "z": "?", "r": "?" }, { "z": "?", "r": "?" }, { "z": "?", "r": "?" }], "caps": { "back": "?", "tip": "?" }, "group": "Pelvis", "mirror": "plane" },
    { "name": "torso", "kind": "trunk", "stations": [{ "z": "?", "r": "?" }, { "z": "?", "r": "?", "e": 2.4 }, { "z": "?", "r": "?", "e": 2.6 }, { "z": "?", "r": "?" }], "caps": { "back": "?", "tip": "?" }, "group": "Torso", "mirror": "plane" },
    { "name": "neck", "kind": "segment", "from": "neckBase", "to": "neckTop", "rA": "?", "rB": "?", "slots": "ring8", "over": [0.3, 0.4], "group": "Neck", "mirror": "plane" },
    { "name": "tail", "kind": "chain", "joints": ["tail0", "tail1", "tail2", "tail3"], "r": ["?", "?", "?", "?"], "group": "Tail", "mirror": "plane" },
    { "name": "thighR", "kind": "segment", "from": "hip", "to": "knee", "rA": "?", "rB": "?", "e": 2.2, "over": [0.5, 0.6], "group": "Legs", "mirror": "name" },
    { "name": "shinR", "kind": "segment", "from": "knee", "to": "hock", "rA": "?", "rB": "?", "group": "Legs", "mirror": "name" },
    { "name": "metaR", "kind": "segment", "from": "hock", "to": "toeBase", "rA": "?", "rB": "?", "over": [0.6, 0.4], "group": "Legs", "mirror": "name" },
    { "name": "toesR", "kind": "segment", "from": "toeBase", "to": "toeTip", "rA": "?", "rB": "?", "over": [0.3, 0.3], "group": "Feet", "mirror": "name" },
    { "name": "upperArmR", "kind": "segment", "from": "shoulder", "to": "elbow", "rA": "?", "rB": "?", "group": "Arms", "mirror": "name" },
    { "name": "foreArmR", "kind": "segment", "from": "elbow", "to": "wrist", "rA": "?", "rB": "?", "group": "Arms", "mirror": "name" },
    { "name": "handR", "kind": "segment", "from": "wrist", "to": "knuckles", "rA": "?", "rB": "?", "over": [0.4, 0.3], "group": "Hands", "mirror": "name" }
  ],
  "dials": {
    "bulk": { "min": 0.85, "max": 1.3, "rest": 1, "doc": "x scale of the torso about the mirror plane", "op": "scale", "axis": "x", "pivot": 0, "parts": ["torso"], "blend": { "st0": 1, "st1": 1, "st2": 1, "st3": 1, "back": 1, "tip": 1 } },
    "tailCurl": { "min": -20, "max": 20, "rest": 0, "doc": "degrees per tail joint about x", "op": "chain", "axis": "x", "sign": -1, "links": [{ "pivot": "tail1/back", "parts": ["tail1", "tail2"] }, { "pivot": "tail2/back", "parts": ["tail2"] }] }
  } }
```

**Quadruped** (spine as a segment between rump and withers; four legs; a neck and a head segment):

```json
{ "schema": "layered-plan-v1", "frame": { "up": "+z", "front": "+y" },
  "joints": { "rump": "?", "withers": "?", "neckTop": "?", "snout": "?", "hip": "?", "stifle": "?", "hock": "?", "hindToe": "?", "shoulder": "?", "elbow": "?", "carpus": "?", "foreToe": "?", "tail0": "?", "tail1": "?", "tail2": "?" },
  "segments": [
    { "name": "spine", "kind": "segment", "from": "rump", "to": "withers", "rA": "?", "rB": "?", "slots": "ring8", "e": 2.3, "over": [0.5, 0.5], "group": "Body", "mirror": "plane" },
    { "name": "neck", "kind": "segment", "from": "withers", "to": "neckTop", "rA": "?", "rB": "?", "slots": "ring8", "over": [0.4, 0.4], "group": "Neck", "mirror": "plane" },
    { "name": "head", "kind": "segment", "from": "neckTop", "to": "snout", "rA": "?", "rB": "?", "slots": "ring8", "e": 2.4, "over": [0.5, 0.2], "group": "Head", "mirror": "plane" },
    { "name": "tail", "kind": "chain", "joints": ["tail0", "tail1", "tail2"], "r": ["?", "?", "?"], "group": "Tail", "mirror": "plane" },
    { "name": "thighR", "kind": "segment", "from": "hip", "to": "stifle", "rA": "?", "rB": "?", "group": "Legs", "mirror": "name" },
    { "name": "shinR", "kind": "segment", "from": "stifle", "to": "hock", "rA": "?", "rB": "?", "group": "Legs", "mirror": "name" },
    { "name": "hindFootR", "kind": "segment", "from": "hock", "to": "hindToe", "rA": "?", "rB": "?", "over": [0.6, 0.3], "group": "Feet", "mirror": "name" },
    { "name": "upperArmR", "kind": "segment", "from": "shoulder", "to": "elbow", "rA": "?", "rB": "?", "group": "Legs", "mirror": "name" },
    { "name": "foreArmR", "kind": "segment", "from": "elbow", "to": "carpus", "rA": "?", "rB": "?", "group": "Legs", "mirror": "name" },
    { "name": "foreFootR", "kind": "segment", "from": "carpus", "to": "foreToe", "rA": "?", "rB": "?", "over": [0.6, 0.3], "group": "Feet", "mirror": "name" }
  ],
  "dials": { "girth": { "min": 0.85, "max": 1.3, "rest": 1, "doc": "x scale of the body", "op": "scale", "axis": "x", "pivot": 0, "parts": ["spine"], "blend": { "st0": 1, "st1": 1, "st2": 1, "back": 1, "tip": 1 } } } }
```

**Head-only:** a head is its own recipe today (`docs/examples/dragon-layered` for the plain grammar,
`docs/examples/head-detail` for eyes / brows / nostrils / tongue / scales as data over the core
operators) and rides a body through `include` (a baked head worn at a `shift`). Ask for the
station table in the head's own form (`cranium` and `jaw` rows of `[id, y, { slot: value }]`).

## The image path (when you must see)

Dream ONE segment per picture, never a collage, as a clay blockout (`get_image_render_packet` →
your worker; `renderBrief.preset: 'clay-render'`, `construction: 0.3`, `finish: 'clay'`), framed
near-orthographic. Read the ring radius at each station as a fraction of the segment length, write
the number into the form, discard the picture. The whole-body dream is for the compare step only
(a filled clay silhouette at a named view), never for reading numbers off.

## What you DON'T do

- You don't persist or bind the worker's text or pictures — the plan row is the artifact.
- You don't hand-place a coordinate the plan can express as a joint plus a radius.
- You don't compare at a guessed angle — name the view, draw the wire there.
- You don't ship a `buried` detail without moving it, or a `faint` one without deciding it is meant.
- You don't force a person, a real animal or a machine through this loop.
- You don't sign a `plan_audit` for a worker that did not run.
- You don't add a pass because the operator lacks it: each pass answers a read (see Art direction).
- You don't stop at the blob. A segment with only pass 1 is a blockout; say so in the ledger, or keep
  working it.
