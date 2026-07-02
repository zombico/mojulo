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

Skin material metadata now rides on each archetype as a text tag (`skin.tag`), for
later material/texture passes without changing geometry: `fur` (rodent, canine,
feline, ursine), `hide` (stumpy, equine, gazelle), `scale` (sauropod, theropod),
and `feather` (raptor, avian).

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

### Proto-feet — ONE primitive, a preset per family (done) — `protoFoot(end, cfg)`

The limbs end at a rounded stub; the foot continues to the ground and forward into
toes (figure-animal-foot.js). One primitive switched by `kind`, a preset per family:
**paw** (sole pad + short toes — rodent/canine/feline/ursine), **hoof** (tapered solid
to a flat sole, single or `cloven` — equine/gazelle), **pad** (broad columnar
graviportal foot — stumpy/sauropod), **talon** (slim metatarsus + 3 forward toes + a
hallux — theropod/raptor/avian). Built at the limb's distal node, sole on the ground
(z=0), toes forward (+y). `groundedFeet(foreMode)` picks which limbs touch down — all
four for quadrupeds (`ground`), the two hind for bipeds/birds (`tuck`/`wing`). Studies:
`foot-lineup` (all 11), and feet ride the bodies in `flesh-lineup` + `skin-canine-*`.

### Assembly + grounding (done) — `buildAnimal(name, opts)` / figure-animal-ground.js

ONE front door: `buildAnimal(name, {skin?, fleshCfg?, skullCfg?, footCfg?})` wires the
whole stack — armature → balance → chains → skull → feet → body (overlap flesh or
welded skin) → plant — and returns grounded STAND-space parts (+ nodes/COM/feet).
The renderer just lifts to world.

Grounding mirrors figure-balance.js: (1) PLANT — `plantParts` translates the assembled
figure so its lowest contact sits on z=0 (feet on the floor, nothing floats/sinks);
(2) BALANCE — `animalCOM` (segment masses + chains as lumped counterweights) + 
`balanceFeet` slide a BIPED's two feet under the COM so it stands like a humanoid (the
tail pulls the COM back toward the hips — the counterweight, so the feet barely move
once a tail is present); a quadruped's four-foot base is stable, so it's a no-op.
Study: `standing-on-floor` (canine/theropod/avian planted + balanced); the whole
`flesh-lineup` now goes through `buildAnimal`.

## The hair / face / markings layer — the mammalian skin (done)

This is the layer that turns the armature+flesh into a *species*. It is the same
discipline as the rest of the substrate: ONE primitive, named uses; presets per family;
recipes (colour swaps) per species. The whole layer is wired through `buildAnimal` opts
(`mane` / `coat` / `face` / `tailRings` / `facePaint`) so a species is data, not code.

### DECISION (current): colour over fur — bodies are PAINTED, not furred

Per-strand body fur was explored fully (below) and then RETIRED from the default builds
for simplicity and polygon reduction: a furred bear/raccoon is tens of thousands of
ring-stack strands (~2s render); the flat-coloured version is ~5× faster and the SHAPE
reads on its own (the low-fur study confirmed it). So `coat` now means a coloured coat
(PAINT): it colorizes the body + skull to `coat.color`; there are no body/head fur
strands. Markings are colour-only (`facePaint` zones). The hair-lock primitive is NOT
deleted — it survives in the two SPECIAL TREATMENTS that keep their geometry: the **mane**
and the **ringtail** (the raccoon tail's furry banded plume). The fur machinery
(`coatBlades`, head-fur zones, wet-paint under-colour) remains in the code as a primitive
if a furred render is ever wanted again; it is just off the default path. The subsections
below document the fur layer as built (history + the still-live mane/ringtail uses).

### The hair lock — ONE primitive, two named uses (mane = long, pelage = short)

The keeper after fur-as-strokes failed (those read as leaf canopy). The hair lock is a
tapered ring-stack blade (belly → tip) so it shades / depth-sorts with the body. Two
shape knobs proven on the lion: `tip` (tip bluntness — sharp needle → round soft lobe)
and gravity along the lock. Two uses of the SAME lock:

- **mane** — `lionMane(nodes, head, cfg)` (figure-animal-mane.js): long locks tiled in a
  COLLAR around the neck axis (`anchorT`/`radius`). `hang` droops each lock down its
  length under gravity (a curve, not an aim — drapes vs spikes). The lion face-frame is
  this collar pushed forward + big radius + fat blunt overlapping lobes → a fluffy ruff
  ringing the face (studies `lion-face-front`/`-3q`). Still the tuft basis (forelock,
  fetlock, crest) — a small cluster anywhere on the armature.
- **pelage / fur** — `coatBlades(parts, cfg)` (figure-animal-pelage.js): the SAME lock
  made SHORT and tiled over EVERY body cross-section RING — a strand grows off each ring
  point, combed rear+down into a coat. Auto-scales to ring radius, so the small leg
  rings get fine leg fur for free. A `mask(rootPoint)` predicate skips regions. Studies
  `bear-fur-*`. THE CONVERGENCE: long-hair (mane) and full-body fur are one primitive —
  long+collar vs short+body-tiled.

### Wet paint underneath — the coverage rule (`coatUnderHex`)

Lifted from figure-garments' under-colour: every body part the coat covers is repainted
to the fur's DARKENED hue (`darkenHex`/`coatUnderHex`) so the skin tone never shows
through the strand gaps; the coat reads as one pelt with shadow in the gaps. When
furred, the SKULL is repainted too (the head matches the coat); feet keep skin (bare
pads). `coatHex` exposes the strand colour for matching ears.

### Three-zone head fur

Fur over the head splits by `s` along the head axis: COARSE fur on the back cranium, a
FINE short-haired fuzz over the forehead + muzzle sides (the leg-fineness applied to the
face — thin `widthFrac`, short `lenFrac`), and BARE at the nose pad. The split tracks
the skull's own `muzzle` fraction, so it's automatic per family.

### Face decorators + the MAMMAL_FACE primitive (figure-animal-face.js)

`faceDecor(anchor, dir, cfg)` hangs eyes (balls), ears (flat tapered paddles), and a
nose (ball, or flat `sticker`) off the skull landmarks — placement as fractions of the
skull's own length/width so one preset rides any head at the right scale. `MAMMAL_FACE`
(small close-set eyes, bold nose, short round wide ears) is the shared mammal read, in
`FACE_PRESETS` keyed per archetype exactly like `SKULL_PRESETS`/`FOOT_PRESETS`; the
seven mammals share it, `RACCOON_FACE` overrides bigger pointier ears. Reptile/avian
faces (slit eyes, no pinna, beak) are a TODO preset.

### Boxy mammalian snout — the skull `boxy` knob

`protoSkull` gained `boxy` (0 = conical/round → 1 = a squared block): the cross-section
morphs ellipse → SUPERELLIPSE ramped toward the front (corners fill flat) and the muzzle
stays broad to a BLUNT end instead of taper-to-a-point. Set per family on the mammal
skulls (ursine 0.85, stumpy 0.8 … equine 0.45, gazelle 0.35); reptiles/birds stay 0.
"Mammal = boxy muzzle" is now in the presets, the carnivoran-block vs avian-beam split.

### Region colouring — two of the three modes (markings)

Markings reuse the geometry rather than new meshes:
1. **along-tube bands** — `bandTube` / `ringTail` (figure-animal-build.js): colour a chain
   tube in alternating bands along its length. `ringTail` does it FURRED — the rings live
   in the fur (a furry plume harmonious with the body), not a bare tube. → the raccoon
   ringtail (`tailRings` opt).
2. **head-axis zones** — `facePaint` opt: LIGHTEN the muzzle (`snoutHex`) + lower jaw
   (`mouthHex`) along the head axis so the darker base around the dark eyes reads as a
   MASK by contrast (the raccoon bandit mask — made by lightening, not a painted band).
3. **(missing) patch colouring** — a localized spot ON a surface. Needed for panda eye
   patches, a true wrap-around mask, spots/stripes. The one region-colour mode we lack.

### Species = a recipe over the kit (`BEAR_VARIANTS` / `RACCOON_BUILD`)

The bear is locked in: `BEAR_BASE_COAT` + `face` + boxy muzzle. `BEAR_VARIANTS`
(brown/polar/panda) are pure COLOUR SWAPS on the SAME geometry + seed — panda adds black
ears + big black eye patches via the face cfg. The raccoon is the first cross-archetype
reuse: the `raccoon` archetype (the ursine plan scaled down — plantigrade, hunched,
pear-shaped, with a long thick tail) + `RACCOON_BUILD` (grizzled coat, furry ringtail,
bandit mask). A shared `RACCOON_*` palette ties the tail's light ring to the face's light
so the markings harmonise. (Procyonids ARE caniform carnivorans — bear kin, not rodents —
so deriving raccoon from ursine is phylogenetically right, not just convenient.)

### Building a NEW mammalian — the kit (what the primitives enable)

A new mammal = an ARCHETYPE (proportions + tail) + three landmark PRESETS (skull, foot,
face) + a BUILD recipe (coat colour + markings). The reusable primitives, by file:

- **armature + girth** (figure-animal.js) — stature/bulk/balance knobs, plantigrade vs
  cursorial legs (joint frac + reversal), and the `tail`/`neck` CHAIN config.
- **proto-skull + `boxy`** (figure-animal-skull.js) — muzzle length/breadth/boxiness.
- **proto-foot** (figure-animal-foot.js) — `paw`/`hoof`/`pad`/`talon`.
- **face** (figure-animal-face.js) — `faceDecor` + a `FACE_PRESETS` entry.
- **coat + wet-paint + head-fur zones** (figure-animal-pelage.js) — the pelt.
- **markings** — `ringTail` (banded tube) + `facePaint` (head zones).

ALREADY reachable by just picking presets + colours (no new primitive):
- **canids** (dog/wolf/fox) — `canine` skull/foot + coat; a fox is canine + a bushy
  (un-banded) `tailFur` tail + `facePaint` for the white muzzle/black socks.
- **felids** (cat → lion) — `feline` + the mane; tabby stripes await patch colour.
- **musteloids / procyonids** — raccoon done; weasel/otter = an elongated small ursine
  (longer `trunkLength`, lower `backHeight`); red panda = raccoon palette swap.
- **ursids** (bear) — done, + variants.
- **most ungulates** — `equine`/`gazelle`/`stumpy` skull+hoof+hide already; pig = stumpy
  + boxy snout.

Needs a NEW primitive (the next mammal-unlocks):
- **PATCH colouring** — eye patches, spots (leopard/deer-fawn), stripes (tiger/zebra/
  tabby), the panda mask. The single biggest gap; unlocks the most species.
- **HORNS / antlers** — a tapered, optionally BRANCHED chain off the skull; reuse the
  `tailChain` swept-chain, branched, anchored at the head (cow/deer/antelope/rhino).
- **TUSKS** — a curved solid cone off the jaw/skull (elephant/boar/walrus).
- **PROBOSCIS** — already covered: the elephant trunk is a long `neckChain`/`tailChain`.
- **horns ≈ tail-chain reuse**, so only PATCH colour and TUSK are genuinely new.

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
