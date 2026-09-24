# Dragon body: a hulking humanoid with lizard legs, wearing the dragon head

The second `layered` recipe. Where [dragon-layered](../dragon-layered/README.md) is a head, this is
the whole figure: the same station/slot grammar with more parts, and the head recipe merged onto the
neck so one sketch carries the figure and every head dial keeps working.

## Layers

| Layer | Here |
| --- | --- |
| L0 | `+z` up, `+y` front, mirror plane `x = 0`, metres, soles on `z = 0` |
| L1 midline | `pelvis`, `torso`, `neck`: 8-slot superellipse rings along `+z` (the chest boxier than the waist) |
| L1 limbs | right side authored, left mirrored by name: `thigh`, `shin`, `meta` (metatarsus, hock to toe base), `toes`; `upperArm`, `foreArm`, `hand` (the palm), three fingers of two segments each (`fingerA1`, `fingerA2`, …). Each is one straight 6-slot loft whose end rings overshoot the joint so neighbours fuse across the bend |
| L1 tail | `tail0` … `tail4`: five midline segments along a curve from the pelvis back, tapering to the tip |
| L2 | a claw on every toe and finger tip, pinned to the tip band of its segment, stretched by `clawLength` |
| Head | every part of the dragon recipe, its L1 points translated by `HEAD_SHIFT` (0.1 m forward, 0.2 m up); its pinned details, creases and dials come along unchanged but for the shifted scale pivot |

The leg follows the construction rule in `docs/planar-drawing.md`: hip → knee → ankle/hock → toe base →
toe tip as explicit segments, the metatarsal segment being what makes the heel read as raised. There
are no posing dials on the legs on purpose: posing is contact-aware work for a rig, not a shape dial
that would silently re-seat the sole.

Naming: a limb point is `thighR/st1.frontR`; its mirror is `thighL/st1.frontL` (both suffixes flip).
A midline point mirrors as in the head, `torso/st3.sideR` ↔ `torso/st3.sideL`.

## Dials

Body: `bulk` (torso and arms x-scale about the mirror plane), `gut` (belly front slots forward),
`stance` (legs x-scale about the mirror plane), `lean` (torso, arms, neck and head hinge forward about
the pelvis tip; the legs stay planted), `clawLength`. Chains, one dial driving sequential hinges whose
pivots ride the links before them: `tailCurl` and `tailSway` (degrees per tail joint about x and z),
`grip` (degrees per finger joint, both hands, toward the palm). Head: the seven from the head recipe.
Dials apply in recipe order, every scale and offset before any hinge or chain, so a hinged part is never
sheared by a later axis scale. Ranges are in `recipe.json`; out-of-range and unknown dials throw.
`casts.json` holds the dial sets.

## Where the code lives

`seed-recipe.mjs` is the authoring record (joint table, ring rules, claw geometry, dial semantics) and
writes `recipe.json` byte for byte; the grammar and the lowering are core
(`control/lib/graph/polygonizer/station-loft.js`, `station-loft-workbench.js`). Mint it as
`mint_solid { kind: 'layered', spec: { recipe, units: 'm' } }`; a dial is then an `update_sketch`
patch on `/dials/<name>`. Renders land in the gitignored
`lite-template/integration/<MMDD>/spike-output/dragon-body/`, never here.

```sh
node --test docs/examples/dragon-body/test-body.mjs
node docs/examples/dragon-body/seed-recipe.mjs                       # recipe.json, byte-identical
cd control && node scripts/export-wire-svg.mjs --ref <ref> --views 150,180,90,0 --out <dir>
```

## Checks

Machine, in `test-body.mjs`: every part passes the closure audit at rest and at every dial extreme;
point and face ids are dial-invariant; the whole figure mirrors by name; every part lowers to one
closed loft that bakes with positive signed volume, L1 and claws exact to the micrometre; the rest
pose sits on the grid; the head equals the dragon recipe translated; `lean` is rigid about the pelvis
tip and leaves the legs alone; `stance`, `bulk` and `clawLength` do what they say; the tail chains keep
every joint joined and every segment rigid, curl lifts the tip, sway is antisymmetric; `grip` curls every
finger of both hands and the claws ride along; the seed is byte-reproducible.

Measured on the minted sketch through `measure_solid { union: true }`: closed, no non-manifold edges;
the union has handles where overlapping segments meet (a valid manifold, not certified for print).
Not certified: self-intersection, inter-part clearance, printability. No rig or weights.

Eyes: the agent looked at the wire views. Human acceptance on the World page is separate.
