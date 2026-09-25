---
{
  "id": "layered",
  "name": "Layered solid (stations, slots, pins, dials)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Mint a solid born layered: the primary form is named rings along a spine (stations × slots), details are pinned to named faces and carry their geometry as local offsets, and dials regenerate the whole thing — so `update_sketch` patching `/dials/<name>` reshapes the object in place. Renders its compiled mesh on every read: World turntable (a rigged recipe plays its clips there), `measure_solid`, GLB/STL export at true size, skinned GLB with clips.",
  "when": "Reach for this on 'a creature / a dragon / a monster / an invented animal / a character that is not a person / a body I can rig and animate / a head or character piece I want to keep editing by dials / widen the skull, lengthen the snout, open the jaw / a family of casts from one recipe / the same details riding a reshaped form'. A one-off measured part with no dials is a plain workbench spec; a real animal with a real skeleton is kind `animal`; a person is kind `figure`."
}
---

A solid whose recipe is a **station/slot construction**, not a coordinate list.

- **L1, the form.** Each primary part names its `slots` (an even list: a midline slot, the right half, a
  midline slot, the left half, so slot *j* mirrors slot *(n − j) mod n*) and its `stations` along the
  spine, each station giving one point per slot. Two cap points close the ends. Every point is
  `<part>/<station>.<slot>`, every face `<part>/<stA>-<stB>.k<slot>.<a|b>`; the right half is generated
  and the left half mirrored **by name**, so identity survives every dial.
- **L2 / L3, the details.** A detail is pinned to a named L1 face (`pin: { parent, face, weights,
  tangentEdge, handedness }`, `mirror` for a symmetric midline pin) and stores its geometry as local
  offsets in that frame. `stretch` scales it along its own axis under a dial. Closed details declare a
  `loft` so the workbench lowering can express them; open patches declare their boundary and stay out
  of the solid.
- **Dials.** `scale` (an axis, a pivot, per-station blends), `offset` (an axis, named slots, blends),
  `hinge` (a rigid rotation of a part, or of a `parts` chain, about a named point), `chain` (sequential
  hinges off one dial, each link's pivot riding the links before it: a tail, a finger, a spine), `stretch` (a detail's own axis). Ranges are
  declared; out-of-range and unknown dials refuse.

Spec: `{ title?, recipe, dials?, channels?, units? ('m'), facing? ('+y'), seat? (true: lowest point on
the grid), grid?, toon? }`. The stored manifest is the recipe plus dial values; the World, `measure_solid`
and `export_model` see the compiled mesh itself (every closed part exact, whatever its shape; a recipe
`palette: { <group>: '#hex' }` colours faces by group, else the part's `tint`). Patch a dial:
`update_sketch { ref, patch: [{ op: 'set', path: '/dials/jawOpen', value: 30 }] }`.

- **Rig (optional).** `rig: { joints: { name: { at, rides? } }, bones: [{ id, head, tail, aux? }], chains:
  { channel: { axis, sign?, links: [{ pivot, joints }] } }, legs: { L|R: { hip, knee, hock, toeBase, toeTip,
  pole } }, reach? }` — rest joints must include the vajra core names (pelvisHub, navel, neckHub, headBase,
  headTop, shoulder/elbow/wrist/hip/knee/ankle L+R). Every L1 part then declares `bind: 'bone' | { bone,
  blend: { station: { bone: w } } }` (the overshoot ring at a joint shared with the neighbour); a pinned
  detail inherits its face. `clips: { name: [keyposes] }` are `resolvePose` words for the core (`armL:
  'forward'`, `elbowR: 'half'`, `spine: { arch: 0.4 }`, `head: {x,y,z}`) plus `crouch` (0–1, toes planted),
  `heelL/R` (metatarsus degrees), `lift`, `support`, and every chain channel. Legs solve to PLANTED toes;
  an unreachable pose refuses with the numbers (`reach: 'clamp'` to accept a reported error). The mint
  pays the rig gates (valid weights, rest identity, planted drift). `export_model({ format: 'glb', clips:
  '_all', skinned: true })` writes the skinned GLB with authored weights; `scripts/export-wire-svg.mjs --ref
  <ref> --clip crouch --phase 0.5` draws a posed frame. The World page plays the clips in place (`?clip=<name>`,
  or the selector in the corner; "rest" shows the solid).

- **Plan (the compact door).** `mint_solid({ kind: 'layered', via: 'plan', spec: { plan } })` — a RING PLAN
  is what the seeds write by hand: `{ schema: 'layered-plan-v1', frame, joints: { name: [x, y, z] } (the right
  side), segments: [ { name, kind: 'trunk', stations: [{ z, r, yc?, e? }], caps, mirror: 'plane' } | { name, kind:
  'segment', from, to, rA, rB, e?, over?, mirror: 'plane' | 'name', bind: { bone, prev?, next? } } | { name, kind:
  'chain', joints, r, over?, bind: { root } } ], details: [{ name, kind: 'claw', base, dir, length, radius, pin,
  stretch?, mirror? }], include: [{ name, parts, dials?, creases?, palette?, shift, bind? }] (a baked head worn at
  a shift), dials (an entry `{ op: 'include', name }` splices an include's dials there), rig, clips }`. Slot
  families `ring8` and `limb6`; `$S` in a name stands for its R and L twins (dial parts, rig joints, a `perSide`
  bone block). `expandPlan` makes superellipse rings perpendicular to each segment's axis, overshoots the joints so
  neighbours fuse, mirrors by name, places claws as local offsets on their faces, and builds segment bindings
  (shared overshoot rings). The recipe is stored beside the plan; a patch under `/plan` re-expands it, a patch
  under `/dials` or `/recipe` edits as before. Refusals name the plan field.

- **Exposure (advisory).** `measure_solid` on a layered sketch carries an exposure ledger: for every pinned
  part, how much of it is seen from six named views (frontal, three-quarter, three-quarter-left, lateral, left,
  back) through a z-buffer, flagged `reads` / `faint` / `buried`; a buried detail (a claw that never leaves its
  toe) is named in `warnings`, never refused. `exposure: false` skips it.
- **Compare (matched azimuth).** `scripts/export-wire-svg.mjs --ref <ref> --compare frontal=ref.png,lateral=side.png`
  draws the solid's silhouette at the reference's named azimuth and reports `iou`, `aspect` and the centroid
  offset per view (shape only, both normalised to their boxes), plus a sheet (reference | silhouette | overlap).
  The reference picture is never persisted; the numbers are the record.

Worked plans: `docs/examples/ring-plans/` (a bare quadruped) and the rigged dragon body's `seed-recipe.mjs` (it exports `plan`); the
`creature-from-plan` catalyst carries the spec forms a worker fills. Worked recipes: `docs/examples/dragon-layered/` (the dragon head: cranium and jaw as station lofts;
horns, eyes, teeth and crest spikes pinned; seven dials; six casts), `docs/examples/dragon-body/` (the
rigged body wearing the detailed head from `docs/examples/head-detail/`, baked through `bakeLayered`). Its `seed-recipe.mjs` is the
authoring record: the species rules live there, not in core. `scripts/export-wire-svg.mjs --ref`
draws any cast as a hidden-line wire SVG.
