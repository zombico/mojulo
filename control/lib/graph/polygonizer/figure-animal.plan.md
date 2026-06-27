# figure-animal — the 'animal-realm' concern

Warp the canonical vajra figure to fit non-human bodies, at the **manji / vajra
layer only** — the joint graph and the vajra ring-form, NOT the humanoid protoform
flesh (an animal does not wear the human fleshform). Spike thesis, status, and the
roadmap toward life forms that walk / crawl / slither / swim.

## Thesis (proven this spike)

A quadruped is the human armature with **one move**: the spine reoriented from
vertical to horizontal. The four limb vajras already carry the right curves (two
arms + two legs → four legs); we only

1. re-aim every limb vajra at the ground, and
2. re-place the head/neck vajra off the **front** of the now-horizontal spine.

No new primitives — just new landmark positions over the locked node set. The same
`figureJointGraph` / `figureVajraSpecs` (figure-vajra.js) that read the upright
figure read the quadruped unchanged.

## How it's built (figure-animal.js)

`quadrupedNodes(cfg)` → the reoriented armature `{node: {x,y,z}}` in STAND space:
spine laid along **+y** (hips rear, shoulder girdle front, gentle loin arch),
head/neck forward-and-up off the front, all four limbs dropped to the ground (z=0).
Node identities match `FIGURE_NODES`, so the manji/vajra readers consume it as-is.

Knobs: `QUADRUPED_DEFAULT` (backHeight, trunkLength, neck length/angle, head pitch,
per-pair knee/foot heights + fore/aft joint bend).

Study: `figure-animal.spike.gen.test.js` renders three azimuths (frontal /
three-quarter / lateral), each a 3-panel **manji | wave | world-vajra-mesh**
(renderer adapted from `figure-vajra-perspective.spike`, recentered on the
quadruped). →  `integration/0626/spike-output/figure-animal/`. Run:
`npx vitest run --config vitest.spike.config.js lib/graph/polygonizer/figure-animal.spike.gen.test.js`,
rasterize with `/view-svg`.

## Status

Generic mid-size (dog-ish) quadruped renders end-to-end as manji/vajra and reads as
a clean four-legged creature in all three reads — horizontal spine, four grounded
limb vajras, head/neck off the front. Proportions tune live via the knobs. No flesh.

### Chain appendage (done) — `chainAppendage(nodes, cfg, phase)`

The topology extension. A single vajra triple can only bow once, so a long
appendage is a tapering swept-vajra CHAIN, not one vajra. Its base centerline is a
Catmull-Rom anchored by **three control points — core, root, tip** — with the core
as the pre-root control so the curve leaves the root TANGENT to the spine (C1
continuity: no kink at the join). Radii taper root→tip (root ≈ the hub it joins).

Sine/cosine articulation: each sample is DISPLACED ⟂ to the curve by
`waveAmp · env(s) · sin(2π·waveN·s + phase)`, the envelope 0→1 root→tip so the root
stays welded and the tip swings most. `wavePlane` selects lateral (wag / swim) or
vertical (undulation); advancing `phase` sends a TRAVELING wave down the chain.
Emits all three reads (rings, manji spheres+links).

**ONE primitive, two named uses:** `tailChain` roots at the pelvis (core = navel,
behind); `neckChain` roots at the neck hub (core = navel, projecting forward-up).
The sauropod was the forcing function for this unification. The same chain also
serves an elephant trunk / giraffe neck, and — limbs dropped, length up — the
slither/swim spine (Tier 2).

Studies: `tail-rest`, `tail-wag-top` (lateral S, top-down), `tail-undulate-lateral`
(vertical), `tail-wave-frame-0..5` (phase sweep / traveling wave).

### Archetypes (done) — `quadrupedArmature(name)` / `QUADRUPED_ARCHETYPES`

Proportion presets over the shared knobs, along three axes: stature / leg-length,
body bulk (girth), and fore↔hind balance. Nine —

QUADRUPEDS (cursorial, straight-legged): **rodent** (small, hunched, big
hindquarters), **canine** (balanced walker), **feline** (lower/suppler/long-tail
sibling), **stumpy** (heavy barrel, wide track, thick pillar legs —
rhino/elephant/hippo), **equine** (tall, long legs+neck), **gazelle** (slender,
long thin legs), **sauropod** (stumpy derivative: graviportal + 'leg-weighted',
huge barrel on tall thick pillars, long `neckChain` + long `tailChain`, tiny head).

BIPEDS (`foreMode: 'tuck'`): **theropod** (T. rex / allosaur — deep body balanced
over two strong bent hind legs, long heavy tail counterweight, tiny tucked
forelimbs, short thick neck + big head), **raptor** (velociraptor — lighter, longer
grasping forelimbs, small-headed S-neck, long stiff balance tail).

AVIAN (`foreMode: 'wing'`): **avian** (bird — the theropod carried to its
descendants: compact biped on digitigrade legs, forelimbs spread as the WING
skeleton, S-curved neck + small beaked head, short fan tail). `WINGS_SPREAD` is a
cfg patch that opens the folded wing out to the side (top-down view → the cruciform
bird silhouette).

URSINE: **ursine** (bear — heavy plantigrade quadruped: bulky barrel, robust
forequarter-heavy limbs, big head on a short thick neck, stub tail). It also REARS:
the `URSINE_REAR` cfg patch rocks the body upright on the planted hind legs
(`spineTilt`) and raises the forepaws to the chest (`foreMode:'tuck'`) — the
theropod biped primitives reused for an upright stance.

Presets, not hardcoded shapes — blend or interpolate for in-between builds.

`spineTilt` rocks the front of the body up about the hips (hind legs stay planted) —
the rear/upright lever, shared by the bear and any reared pose.

A long-necked archetype declares a `neck:` chain config (like `tail:`); the built-in
head triple is collapsed to a nub at the neck hub so the `neckChain` carries the
real reach. `foreMode` switches the forelimbs: `tuck` → small chest-held arms (biped),
`wing` → the spread wing skeleton (avian). The same armature now covers mammals,
sauropods, theropods, AND birds — the full archosaur line.

Girth is parametrized: `figureVajraSpecs` / `figureJointGraph` now take an optional
`radii` map (default = canonical `FIGURE_RADII`, so the human figure is unchanged);
`quadrupedRadii(cfg)` scales it by region (girthBody / girthFore / girthHind /
girthHead). Leg joint heights are fractions of `backHeight`, so leg length scales
with stature. Study: `archetype-<name>` three-panels + `archetype-lineup`
(shared-scale world-mesh row → true relative proportions). NOTE: elephant's trunk /
giraffe's neck are appendages, NOT body-plan params — reuse `tailChain` for them.

### Flesh — ONE shared model (done) — `animalBodyFlesh(nodes, radii, cfg)`

Not per-animal sculpts. Flesh is a generic wrap of the armature GRAPH every archetype
already emits: each bone → a rounded TUBE, each joint → a SPHERE, each chain → its own
swept tube, all overlapping into one body the renderer depth-sorts. Round cones (not
vajras) so joints do NOT pinch (the vajra screw is anti-flesh) — the body reads as
muscle/skin. Driven only by the graph → identical code for rodent, sauropod, theropod,
bird. (figure-animal-flesh.js.)

SHARED tuning knobs (FLESH_DEFAULT), one set for all animals, on top of per-region
`girth*`: `flesh` (global inflation, lean↔fat), `thorax` (chest barrel — radius × on
the neckHub→navel bone), `belly` (gut barrel — radius × on the navel→pelvisHub bone),
`bellyDrop` (the gut hangs below the spine), `rump` (hindquarter barrel — radius × on
the hip girdle + pelvis/hip joints), `bulge` (mid-bone muscle fullness), `jointFill`
(limb↔body meld), `taper` (extremity thinning). The trunk's mass lives in the torso,
not the spine joints, so thorax/belly/rump default ABOVE 1 → a deep-chested,
big-bellied baseline. The navel (waist) sphere scales with the torso so chest↔gut
bridge into a continuous trunk; `rump` sizes the haunch to the belly so the TOPLINE
hugs gut→rump as one curve (no saddle). Studies: `flesh-lineup` (all 11),
`flesh-knob-sweep` (one canine lean→default→fleshy).

Renderer note: the study mesher now orients face normals OUTWARD from the ring center
(`polyCenter`), so culling/shading is winding-independent across vajra rings, flesh
tubes, and chains. Flesh parts are STAND-space → lifted via `worldPart` before meshing.

Two realizations: this overlap-union (cheap, for lineups/iteration) and the WELDED
single skin below (the hero path).

### Welded single skin (v2, tried on canine) — `animalSkin(nodes, radii, chains, skull, cfg)`

Wraps the WHOLE figure (skull + legs + body) in ONE coherent surface
(figure-animal-skin.js). Assemble a global signed-distance FIELD — every bone a
`sdRoundCone`, every joint/torso-mass a sphere, the skull a few cones — `smin`'d so
junctions get CONCAVE fillets; then surface it by marching each long axis's
cross-sections (spine, limbs, neck, skull) out to the iso-surface, so every ring sits
on the one global surface → limbs melt into the body. Knobs = the flesh set + `blend`
(fillet softness), `bound` (march cap), N/M (skin res). KEY: the lateral girdle
connectors stay in the field (shoulder/hip width) but are NOT surfaced along — marching
*through* the torso balloons (that was the rump-loop artifact). Study: `skin-canine-*`.
Limits: per-axis patches, so a few seam slivers + non-watertight leg/body gaps remain
(true watertight = marching-cubes); ~1s/family (ray-march) → keep the overlap model
for fast lineups, this for hero renders. Next: roll out to all families; close seams.

### Proto-skulls — ONE primitive, a preset per family (done) — `protoSkull(anchor, dir, cfg)`

The head is the family tell, so it gets the shared treatment too (figure-animal-skull.js):
one parametric skull built along a head axis — a domed CRANIUM tapering through a
brow/stop into a MUZZLE that drops to the nose, a lower JAW slung beneath, and an
optional BEAK cone (avian). Knobs: `length`, `width` (cranium breadth), `dome`,
`muzzle` (snout fraction), `snout` (nose radius), `muzzleDrop`, `jaw`, `beak`.
`SKULL_PRESETS` carries one read per family (long equine, short feline, beaked avian,
deep-jawed theropod, …). The head axis is the neck-CHAIN tip (chain archetypes) or
the built-in head bone (`headFrame`); the flesh model omits its cranium blob
(`skull:true` skips the headTop bone + sphere) so the skull stands in. Studies:
`skull-lineup` (all 11 in profile), and the skulls ride the bodies in `flesh-lineup`.

## Follow-ups

1. **Limb joint bridging** — each limb is ONE vajra over a bent triple, and a sharp
   fore/aft REVERSAL (knee one way, foot the other) bows the vajra's quadratic spine
   and breaks it on a long thin limb. Resolved for the archetypes by giving them
   near-straight, single-direction (no-reversal) legs — accurate for cursorial
   animals anyway. A per-segment limb vajra (upper + lower sharing the joint bead) is
   still the deeper fix IF we later need sharply-bent stances (a crouch, a gait).
2. **Wing membrane (the avian surface gap)** — `foreMode:'wing'` gives the wing
   SKELETON, but the round vajra is radially symmetric so wings render as stick-bones,
   not flat feathered surfaces. The wing membrane (and tail-feather fan) is the one
   new primitive needed: a flat sheet spanning the leading edge (shoulder→elbow→wrist)
   to a trailing edge near the body — the same flat-cross-section gap that limits rays,
   bat wings, fins, and turtle shells. This is the avian/chiropteran/piscine unlock.
3. **Head/neck vajra** — currently the human head triple reoriented; an animal head
   may want its own short muzzle vajra and a tapering neck (reuse `tailChain`).
3. **Articulation / gait** — a quadruped `articulate`-equivalent (walk/trot/gallop)
   over the reoriented armature, once the static stance is right. Each archetype's
   gait differs (equine gallop, gazelle hop) — the user's movement axis.

## Beyond quadrupeds (the broader concern)

The reorientation generalizes; the spine curve is the carrier.
- **crawl** — low horizontal spine, limbs splayed lateral (sprawling gait).
- **slither** — limbless; the spine *is* the body — a long multi-segment spine,
  girth tapering to a tail, no limb vajras.
- **swim** — horizontal spine + tail oscillation; limb vajras → fins or dropped.
All are spine-orientation + limb-presence variations on the same armature move.
