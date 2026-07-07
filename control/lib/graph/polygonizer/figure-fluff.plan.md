# figure-fluff — zdog-principled volume vocabulary + mugen scores for rich characters

Status: **spikes 1–2 landed** — [figure-fluff.js](figure-fluff.js) (the closed
shape table, `validateFluffs`, `buildFluffs`) + unit tests + the study-sheet
spike ([figure-fluff.spike.gen.test.js](figure-fluff.spike.gen.test.js),
output `lite-template/integration/0706/spike-output/figure-fluff/`). The
sketch acceptance silhouettes (arm: thin upper → truncated football → bead
fist / open cannon; leg: thin thigh → flared boot → slab foot) reproduce, and
a whole minimal mega-boy stands from a fluff manifest alone. What the spike
settled, beyond the original design:

- **End caps are part of the primitive.** An open-ended profile tube
  back-face-culls into a hollow "fin" read; every segment fluff now closes
  with `FLUFF_CAP_RINGS` quarter-round cap rings per end. The one deliberate
  opening: a mouth-truncated football's distal end (the cuff / arm-cannon).
- **Every shape is a polar radius function** of ring azimuth (slab's
  superellipse included), so azimuth-aware smooth-max is the single
  superposition rule — no per-shape merge cases.
- **Joints seal the zdog way**: a small `bead` at the shared node (elbow/knee
  caps) — confirmed sufficient; no cross-segment field math needed.

Remaining: garment-over-fluff (spike 3), the true mega-boy round-trip vs the
hand-lifted radii file (spike 4), MUGEN_SCORES (5), `create_figure` wiring +
vocab card. Distilled from the mega-boy iteration
(hand-tuned `MEGABOY_RADII` in
[character-megaboy-vajra.js](../figures/character-megaboy-vajra.js)) and the
garment canon ([figure-garments.js](figure-garments.js) P1–P5). Goal: move
"fluff out this section" and "dress it at this looseness" from hand-edited JS
into a small authored vocabulary reachable through `create_figure`.

## The gap this closes

The figure substrate has three ways to shape a body today, and none of them is
a shape *vocabulary*:

- **Node radii** — `FIGURE_RADII` overrides ([figure-vajra.js](figure-vajra.js)).
  Only dial: sphere radius per landmark. Mega-boy proved proportions move without
  touching the armature, but a radii map can make a thigh FAT, not make it a CONE.
  Iterating mega-boy meant manually nudging bead numbers and re-rendering.
- **Proto flesh** — `buildProtoform` ([figure-proto.js](figure-proto.js)).
  Anatomical and rich, but the shapes (bicep lobe, pec plate, glute bun) are
  hand-sculpted ring math IN CODE; `proto` knobs are multipliers on those baked
  forms. You cannot author a NEW form through it.
- **Garments** — offset shells over the flesh. Shape vocabulary exists here
  (basin/tube/crown-fan) but only as CLOTH; it cannot add body mass.

So there is no middle layer where an agent says "cone legs, football forearms,
bell chest" as DATA. That layer is the **fluff**.

## Terms (canon)

- **fluff** — a named simple volume bound to an armature segment, sampled into
  the same tagged ring-stacks (`{ id, rings: [{ center, polyline }] }`) that
  `buildProtoform` emits. The zdog principle: rich, appealing volume from a
  tiny set of chunky primitives with soft unions — composition of named solids,
  not sculpted surfaces. A fluff is a wave-space citizen (manji = the armature
  it binds; wave = its ring-form; world = renderer-owned skin), same as the
  vajra it fattens.
- **superposition** — how fluffs compose: a smooth-max on the radius field
  where volumes overlap. Same move as the vajra's smooth-min bulb↔neck union
  and `componentSuperposition` (figure-garments.js). Order-independent:
  a football forearm superposed on the base vajra neck swells the rings only
  where the football wins.
- **mugen score** — a garment's numbers, separated from its machine. The
  garment canon already states it: *slim vs baggy is ONLY the mugen — same
  components, different numbers* (`trousersSlim` vs `trousersBaggy`,
  `fittedShirt` vs `jacket` vs `oversizedShirt`). The components
  (basin + tubes + crown-fans) are the INSTRUMENT; a named table of per-component
  standoffs is the SCORE played over it. Today the numbers are inlined per
  `GARMENTS` entry; the score factors them out so one silhouette plays at many
  altitudes.

## Design

### 1. The fluff layer (`figure-fluff.js`, this dir)

`buildFluffs(positions, fluffs)` → tagged ring-stacks. Pure; positions are the
articulated landmarks (`articulate(dof)` output), so fluffs pose for free —
a cone leg bends at the knee because its two segments each bind posed nodes.

A fluff spec is data:

```js
{ segment: ['hipL', 'kneeL'], shape: 'cone', girth: 0.046, taper: 0.55 }
{ segment: ['elbowR', 'wristR'], shape: 'football', belly: 0.034, peak: 0.42 }
{ node: 'headTop', shape: 'bead', r: 0.082 }                        // node fluffs too
{ segment: ['neckHub', 'navel'], shape: 'bell', mouth: 0.09, bias: { y: 0.4 } }
```

Every shape is just a **radius profile `r(t)` along the segment axis** (t=0
proximal → t=1 distal), sampled into rings, plus an optional radial `bias`
(anterior/posterior/lateral offset of ring centers — the femoral-neck move,
for masses that sit off-axis). The inaugural vocabulary is CLOSED and small:

| shape      | profile                                                | reads as |
|------------|--------------------------------------------------------|----------|
| `cone`     | linear `girth → girth·taper` (`taper` > 1 = FLARE — the boot) | cone legs, boots, tapering tails |
| `football` | vesica: `girth·sin(π·t)` variant, `peak` slides the belly, `mouth` truncates the distal end flat (the cuff) | forearms, biceps, calves |
| `bead`     | sphere at a node (the radii-map move, but composable)  | helmet head, ear-pods, knuckles |
| `bell`     | flared cosine, `mouth` at the wide end                 | chest, skirt-like hips, cuffs |
| `slab`     | superellipse ring cross-section (the one non-round)    | torso plates, feet |

Five shapes, no more, until a character proves a sixth is needed. Everything
else is superposition.

### 1a. The mega-boy limb answer (operator sketch, 2026-07-06)

The operator's sketch settles what mega-boy's arms and legs ARE in this
vocabulary, and it bends two shape dials:

- **Arm** — a THIN upper arm (the bare vajra neck, no fluff) feeding an
  OVERSIZED `football` forearm with the belly slid distal (`peak` high), and
  the football is **truncated at the wrist**: it ends in a flat MOUTH (the
  sketch's cuff), not a taper to a point. Inside/below the mouth sits a small
  `bead` fist — or the mouth is left open (the arm-cannon read: fist omitted,
  cuff exposed). So `football` gains a `mouth` dial (truncation fraction,
  0 = closed vesica, >0 = flat-ended with an opening radius).
- **Leg** — a THIN thigh feeding a `cone` lower leg that **flares DOWNWARD**
  (narrow at the knee, wide at the ankle — the boot), hemmed by a big rounded
  foot (`slab`/`bead` merged at the cone's mouth). So `cone`'s `taper` must
  admit values > 1 (flare); the boot is a reverse cone, not a special shape.
- **The character read is girth CONTRAST** — huge distal masses hanging off
  skinny connectors. Superposition supports this natively: the base vajra
  stays thin where no fluff wins, so contrast is the DEFAULT, not something
  to fight for. (This is also why fluffform must be a proto sibling — proto
  would fill the thin segments back in.)

The sketch is the acceptance reference for spikes 1–2: a solo flared cone
with a slab foot, and a solo truncated football with a bead fist, must
reproduce those silhouettes before the full mega-boy round-trip is attempted.

### 2. Superposition (the composition rule)

Fluffs targeting the same or overlapping regions merge by smooth-max of their
radius fields about the shared axis-neighborhood, with one `blend` in the
spirit of the armature's single `BLEND` (figure-vajra.js): one softness across
the whole character, not per-pair fiddling. Where fluff rings and the base
vajra rings coexist on a segment, the SAME rule applies — the base armature is
just the zeroth fluff. Implementation detail to spike: per-ring radial max in
a shared frame vs. true field union; start with per-ring smooth-max (cheap,
ring-native) and only reach for fields if seams show.

### 3. Pipeline seam — fluffform is a SIBLING of protoform

Decision: fluffs replace proto as the flesh source for stylized characters,
they do not stack on top of it.

```
articulate(dof) ─┬─ buildProtoform(pos, proto)   → anatomical flesh   (human register)
                 └─ buildFluffs(pos, fluffs)     → chunky zdog flesh  (stylized register)
                                    │
                              (either one)
                                    ▼
                      buildGarment(body, spec)   → wardrobe, unchanged
                                    ▼
                        vexar renderer, unchanged
```

Rationale: mega-boy under proto's anatomical lobes fights the chunky read —
a football forearm PLUS a hand-sculpted forearm belly is mud. The registers
are alternatives, chosen per character. Because `buildFluffs` emits the exact
`buildProtoform` stack shape (tagged ids, ordered rings), **garments auto-track
fluffs with zero garment math** — a jacket over football forearms follows the
football, exactly as it follows the bust on the female pole today. Piece ids
reuse the proto id vocabulary (`upperArmL`, `forearmL`, `torso`, …) so garment
`coverage` selectors and the shoulder/pelvis mass-gathering keep working.

Later (not this plan): a fluff superposed ONTO proto flesh (a pauldron mass,
a beer belly) — the composition rule already permits it; the register question
is aesthetic, not mechanical.

### 4. Mugen scores (`figure-garments.js`, additive)

Factor the numbers out of `GARMENTS` entries into named scores:

```js
export const MUGEN_SCORES = {
  skintight: { torso: 0.05, cap: { crownGap: 0.03, seamGap: 0.05 }, sleeve: 0.05, leg: 0.05 },
  fitted:    { torso: 0.10, cap: { crownGap: 0.04, seamGap: 0.10 }, sleeve: 0.10, leg: 0.06 },
  loose:     { torso: 0.21, cap: { crownGap: 0.05, seamGap: 0.21 }, sleeve: 0.20, leg: 0.16 },
  oversized: { torso: 0.28, cap: { crownGap: 0.07, seamGap: 0.28 }, sleeve: 0.26, leg: 0.26 },
  armor:     { torso: 0.16, cap: { crownGap: 0.06, seamGap: 0.16 }, sleeve: 0.14, leg: 0.12, rigidity: 'shell' },
};
```

`buildGarment(body, spec, score?)` applies a score by ROLE (torso basin, cap,
sleeve, leg tube) over the spec's own numbers; an explicit number in the spec
wins (the score is the baseline, the spec is the exception). The flush recipe
(torso clearance == cap seamGap == sleeve thickness) becomes a property of
well-formed scores instead of a per-garment comment. Existing `GARMENTS`
entries keep their inline numbers — no regression; scores are a new axis:
`{ garment: 'jacket', score: 'oversized' }` is the authored form.

Not in scope: fluffs carrying their own mugen against the armature. P1's
shrink-to-fit/grow-to-mugen convergence hints fluff and garment could be one
offset principle at different supports — revisit only if the fluff spike's
`bias` proves insufficient for standoff-like masses.

### 5. MCP authoring surface

Following the drawer pattern (`get_sketch_vocab` / `get_view_vocab` /
kit-cards):

- **`create_figure` manifest** grows `fluffs: [...]` (validated against the
  closed shape table, same mint-time render-once validation) and garment
  `score` (a `MUGEN_SCORES` key, or an inline role-table). Manifest stays a
  pure function: `(pose, proto | fluffs, garment × score, view, motion)`.
- **Vocab card** — a `figure-fluff` card the agent pulls on demand: the five
  shapes with their dials, the superposition rule, the score table, and 2–3
  worked characters. Mega-boy re-authored as a manifest is the acceptance
  test AND the flagship card example: if mega-boy round-trips (fluff manifest
  ≈ the hand-lifted `character-megaboy-vajra.js` silhouette), the vocabulary
  is sufficient.
- Existing motions apply unchanged (fluffs ride `articulate`), so an authored
  character walks/sprints on day one.

## Deliverables

1. **`figure-fluff.js`** — `FLUFF_SHAPES` (the closed table), `validateFluffs`,
   `buildFluffs(positions, fluffs)` emitting proto-shaped tagged ring-stacks.
   Pure, renderer-free.
2. **Spike** (`figure-fluff.spike.gen.test.js`) — study sheets: each shape
   solo on a segment; superposition pairs (cone thigh + football calf at the
   knee); the mega-boy round-trip vs. `character-megaboy-vajra.js`.
3. **`MUGEN_SCORES`** + score application in `buildGarment` — spike sheet: one
   garment (jacket) played at all five scores; trousers likewise.
4. **`create_figure`** manifest extension (`fluffs`, `score`) + validation.
5. **Vocab card** + tool-description routing so the authoring agent discovers
   the vocabulary without a full briefing.
6. **Doc** — promote to `docs/figure-fluff.md` once the canonical sheets exist
   (the figure-vajra.md pattern: locked reference images committed).

## Spike order

1. Shapes solo (profiles read correctly on a posed limb, ring seams clean at
   joints).
2. Superposition (knee/elbow junctions — does per-ring smooth-max hide the seam
   or does it terrace like the crown-fan did pre cross-band smoothing? borrow
   that fix if so).
3. Garment-over-fluff (jacket on football arms — coverage selectors and the
   shoulder mass-gather against fluff ids).
4. Mega-boy round-trip (the acceptance test).
5. Scores (pure numbers, lowest risk — can land in parallel any time).

## Open questions

- **Hands/feet/face** — proto's paddles and the skin face are sculpted, not
  fluffable. First stylized characters likely take `bead` hands and `slab`
  feet (very zdog); a face vocabulary is its own future plan.
- **Fluff × animal** — the animal side already has its **structurally
  accurate register**: the fox/wolf (canid) work in
  [figure-animal.plan.md](figure-animal.plan.md) / zoo-mammals — anatomical
  skull/foot/coat over the animal armature, the animal analogue of proto.
  The fluff layer slots in as the animal's STYLIZED register — the same
  sibling split as proto/fluffform on the human (a `cone` snout, `football`
  haunches, flared-cone paws). No animal work in this plan; the split just
  has to survive it (nothing human-specific in `buildFluffs`' segment
  binding).
- **Score naming** — five names above are placeholders; lock them when the
  spike sheets show which altitudes actually read distinctly.
