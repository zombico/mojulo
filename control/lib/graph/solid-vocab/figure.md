---
{
  "id": "figure",
  "name": "Figure",
  "family": "figure",
  "entry": "mint_solid",
  "summary": "Mint a POSED human figure — a sculpted vexar-lit male/female protoform over a manji armature, put into a pose and rendered.",
  "when": "Reach for this on framing like 'pose a figure / a person reaching / a walking figure / a male|female body in a stance / a figure wearing X'."
}
---

Mint a POSED human figure — the protoform (a sculpted, vexar-lit male/female body over a manji armature) put into a pose and rendered to a sketch. Reach for this on framing like "pose a figure / show a person reaching / a walking figure / male|female body in a stance / a figure wearing X". The figure is a PURE FUNCTION of its dials, so posing = choosing values; joint LIMITS + spine caps clamp every value so a pose can never break the form. Persisted with kind `figure`; the render is a still SVG, plus a looping GIF when a motion is set. This is a render — mint it, open the URL (or rasterize the SVG) to SEE the pose, then adjust the dials and re-mint.

Five independent dial-sets, all optional (omit → canonical male, neutral stance, three-quarter view): the POSE, the PROPORTIONS (`cast`), the BODY (`proto` or the stylized `fluffs`), the `garment`, and the studio `setup`.

## Spec shape

`title`, `ref`, and `folder_ref` are passed at the mint's top level. Everything below goes in `spec`.

```
spec: {
  pose?:    { …per-joint DOF },
  cast?:    '<preset>' | { …length multipliers } | [ … ],   // PROPORTION (armature-level)
  proto?:   { sex, height, stockiness, headScale, …region multipliers },
  fluffs?:  [ { shape, segment|node, … }, … ],   // replaces proto when present
  garment?: '<key>' | { …inline piece } | [ … layered ] | null,
  view?:    'frontal'|'three-quarter'|'lateral'|'left'|'back' | <azimuth°>,
  motion?:  'walk'|'sprint'|'wave' | '<emote>' | { walk|sprint|keyframes … },
  setup?:   'studio-grey'|'white-cyc'|'blueprint-wire' | null,
  toon?:    true | { bands?: <tones ≥ 2>, ink?: true | { color, width, crease } },
  background?: <boolean>,
  animate?: <boolean> | { frames, fps },
  dream_audit?: { source, invoked_generator, prompt, <generation id> }
}
```

### pose — the POSE

Per-joint degrees of freedom. Joint limits and spine caps clamp every value.

- arms: `shL`/`shR` `{ yaw, pitch, roll }` (shoulder swing; roll = axial/external rotation — e.g. rolls a bent forearm UP for a wave), `elbowL`/`elbowR` (bend, 0-150°).
- legs: `hipL`/`hipR` `{ yaw, pitch, roll }` (thigh swing + axial external/internal rotation — rolls a bent knee/foot out, e.g. to step around), `kneeL`/`kneeR` (bend, 0-150°), `ankleL`/`ankleR` (+ dorsiflex/toe-up … − plantarflex/toe-down, ≈ ±40), `toeL`/`toeR` (MTP/ball joint, 0-55, + = toes bend up over the ball for toe-off).
- hands: `wristL`/`wristR` `{ flex (±75, the hand bends at the wrist — the arm-mirror of the ankle), deviation (±30, radial/ulnar tilt) }`, `fingersL`/`fingersR` (knuckle/MCP curl, 0-90, + = fingers close toward the palm — the hand-mirror of the toe).
- girdles: `pelvis` (number — transverse pelvic rotation, deg; + = right hip forward), `shoulders` (number — transverse shoulder-girdle rotation, deg; + = right shoulder forward, the upper mirror of pelvis).
- head: `head` `{ yaw, pitch }`; `face` `{ jaw, mouth, brow }` — the head FIELD's dials, not a joint: `jaw` (deg, 0-30) opens the jaw about a hinge through the condyles so the chin swings down and back and re-fuses into the cheeks; `mouth` (0-1, default follows the jaw) is the lip slot; `brow` (−1..1) lowers/raises the brow ridge. Emotes/keyframes drive `face` like any dial (a talk = a jaw oscillation). Shows in SVG/GIF/world frames; the skinned GLB bakes the head as one rigid bone.
- SPINE: `spine` `{ sagittal, lateral, axial }` each ∈ [-1,+1] — sagittal + = flex/curl forward, − = arch back; lateral = side-bend; axial = twist. This is what makes a pose read alive (contrapposto, slump, recoil) instead of rigid-vertical. The bend is distributed across the trunk by its natural mobility (lumbar flexes, thoracic rotates).

### cast — the PROPORTIONS

Rest limb and segment LENGTHS, cast at the armature level before anything is built. Where `proto`
changes girth about a frozen skeleton and `proto.height` is one uniform scale, `cast` changes the
skeleton's proportions — what makes a figure long-limbed, stubby, broad-shouldered, an ape-index
brute or a mascot. Everything downstream follows on its own: the flesh, the balance IK's bone
lengths, the walk's stride-to-hip-angle solve, the garments (the body is its own tape measure) and
the exported rig.

Length and span dials are multipliers on the canonical value, 1 = canonical, unbounded above —
taste is yours; only a non-positive or non-finite one is refused. `shoulderDrop` is an ANGLE in
degrees added to the rest, 0 = canonical, and is bounded both ways.

The arms' ~11° rest abduction is NOT a cast dial — it is authored into the armature so the arms
clear the hips frontally, and it is already a pose: `pose: { shL: { yaw: -7 }, shR: { yaw: 7 } }`
brings them in to ~5° and hangs the hands by the thighs. Reach for that when a figure should look
at ease rather than at attention.

- limbs: `upperArm` (shoulder→elbow), `forearm` (elbow→wrist), `thigh` (hip→knee), `shank` (knee→ankle).
- trunk: `lumbar` (pelvis→navel), `thoracic` (navel→neck — carries the shoulder girdle, arms and
  head), `neck` (neck→skull base), `skull` (the head BONE; for head SIZE reach for `proto.headScale`).
- girdles: `shoulderSpan`, `hipSpan` — half-widths about the midline. The arm rides its shoulder
  whole; the leg follows the pelvis only partway, so a wide pelvis angles the thighs inward.
- carriage: `shoulderDrop` — how the shoulders SIT, in DEGREES (not a multiplier; 0 = canonical,
  range −20..30). The canonical armature puts the neck root and both shoulders at the same
  height, so the clavicle line runs dead level out to the acromion — anatomically a permanent
  shrug, and why a neutral figure reads stiff through the girdle. + declines that line so the
  acromion drops (relaxed, and the neck reads longer); − rides it up into a real shrug, which is
  what armour and tension want. The arm translates with the acromion rather than rotating, so its
  hang is unchanged. **Known limit:** past ~5° the trunk chart's cap footprint collapses, which
  misplaces a garment piece anchored to the shoulder crest — i.e. one with a SHOULDER SEAM. Shells
  and side-seam garments are unaffected at any drop.
- groups (expanded before anything else sees them, an explicit dial wins): `arm`, `leg`, `limb`, `torso`.

The joint graph, the joint LIMITS and the kinematics are untouched — a cast moves rest lengths and
spans, never a joint's range. The figure re-seats on the floor afterwards, so a longer leg grows the
figure upward instead of through the ground.

**Presets** — a named point in the dial space, nothing more. They RESOLVE BY VALUE at mint: the
stored manifest carries the numbers plus `from`, so re-tuning a preset later can never change an
already-minted figure, and your next move is to read the manifest and nudge one dial.

| preset | the read | pair with |
|---|---|---|
| `canonical` | identity | — |
| `heroic` | comic proportions: long legs, broad shoulders, narrow hips | `proto.headScale` ≈ 0.90 |
| `brute` | the heavy: ape index up, legs short, no neck | `proto.stockiness` ≈ 1.35 + `chestWidth` / `tankVee` / `bicep` |
| `lithe` | long-limbed and narrow | `proto.stockiness` ≈ 0.90 |
| `stout` | short strong limbs, long trunk, wide pelvis | — |
| `child` | shorter limbs against a full-size skull | `proto.headScale` ≈ 1.18 |
| `chibi` | the mascot: the skeleton compresses, the skull does not | `proto.headScale` ≥ 1.3 |

A preset is a STARTER. `cast: ['brute', { forearm: 1.3, neck: 0.55 }]` is the preset with two dials
moved; the array merges left → right. The proportion is the cast, the mass is `proto` — a hulk is
both: `cast: 'brute'` with `proto: { stockiness: 1.35, chestWidth: 1.5, tankVee: 1.7, bicep: 1.6 }`.

### proto — the BODY

Body tuning. `sex` (`'male'`|`'female'`); `height` (overall scale), `weight` (see below), `stockiness` (uniform girth); `headScale` (skull size about the neck join — the dominant child↔adult cue: >1 enlarges the cranium so the body reads fewer "heads tall" = younger); per-region multipliers (1 = canonical): `chestWidth`, `chestDepth`, `pelvisDepth`, `pecProjection`, `waistTuck`, `dantien`, `bellyDepth`, `bellyDrop` (0 = canonical), `bicep`, `forearm`, `quad`, `calf`, `armWidth`, `thighWidth`, `tricep`, `hamstring`, `adductor`, `deltoid`, `elbowCap`, `forearmDrop`, `wristGirth`, `calfDrop`, `ankleGirth`, `gluteSize`, `gluteRear`, `hipFlare`, `scapulaBun`, `footLength`, `handSize`; head: `browRidge`, `jawWidth`, `chinPoint`, `noseSize` (bridge, tip and projection), `noseWidth` (the alae), `noseDroop` (the hook — how far the tip hangs below the dorsum), `cheekbone` (zygomatic width), `cheek` (the soft cheek under it — rounds the face), `foreheadSlope`, `earSize` (the ear in its own plane and its rim thickness — the standoff is fixed, because head width is ear-driven), `eyeSize` (the eyeball and the palpebral fissure it shows through, together), `neckGirth` (multipliers on the sex pole's skull — the female basis is a rounder cranium, vertical forehead, smooth brow, narrower jaw, pointed chin, smaller nose, fuller cheeks, thinner neck). The same dials morph a body lean↔heavy, male↔female, adult↔child.

**`weight` — one dial for how heavy the figure reads.** Mass does not go on evenly, so this is not
`stockiness`. One number distributes across the region dials the way a body actually carries it:
the abdomen takes the most and takes it FORWARD, the hips and thighs next, the waist un-tucks, the
V-taper flattens, and the forearms and calves barely move. Measured at `weight: 1.6` — waist
×1.24, hip ×1.23, bust ×1.20, upper arm ×1.12, thigh ×1.11, wrist ×1.09.

- It is a **global gain, not a group alias**: every region dial you set multiplies on top, so
  `{ weight: 1.5, gluteSize: 1.3 }` is a heavy figure who also carries more behind. (Contrast the
  cast's `arm` / `leg` / `limb` groups, where an explicit dial *wins* instead of multiplying.)
- It is **relative to the frame**, because every gain is a multiplier: the same `weight` buys the
  same proportional gain on a broad torso and a narrow one. It shifts a little when a frame change
  re-orders which stack the trunk's hull reads from (a much wider ribcage puts the waist reading on
  the ribs rather than the belly), which is measured and bounded rather than exact.
- `stockiness` is still there and still means what it meant: girth about every centerline, evenly.
  Reach for it when a figure should be uniformly thicker; reach for `weight` when it should read
  heavier.
- Above about `1.8` the belly starts to read as a mass attached to the trunk rather than part of
  it — the limit noted under the stomach dials, not a limit of `weight` itself.

**Careful:** `pose.weight` is an entirely different dial — which foot the figure's weight is over
(−1 left … +1 right). This one is the body; that one is balance. They can appear in the same recipe.

**The torso's depth.** `chestWidth` scales the ribcage's whole CROSS-SECTION — breadth and depth by
the same number, as it always has — so a deep-chested or slab-flat trunk was unreachable at any
setting. `chestDepth` and `pelvisDepth` trim the fore/aft alone, on top of it:

- `{ chestWidth: 1.4 }` — a uniformly bigger ribcage (unchanged behaviour).
- `{ chestWidth: 1.4, chestDepth: 0.71 }` — broad AND flat: a swimmer's shelf.
- `{ chestWidth: 0.8, chestDepth: 1.6 }` — narrow and deep: a barrel on a small frame.
- `{ pelvisDepth: 1.4 }` — a deeper seat through the hips.

The waist between them needs no dial of its own: its depth is the interpolation of the two, so it
follows whatever the chest and the pelvis are doing. Each dial dominates its own end — `pelvisDepth`
does not reach the chest at all, and `chestDepth` bleeds only slightly into the hip, which is what
makes the trunk read as one form instead of two stacked tubes.

**The limbs' own axes.** The same gap again, and it hid in the two dials that sound least like
they have one. `bicep` scales the anterior AND posterior upper-arm lobes; `quad` scales the thigh's
front lobe. Both add into the limb's FORE/AFT radius and neither touches the lateral one, so
head-on a heavy arm and a lean arm measured the same — only the profile ever moved. (`forearm` and
`calf` never had this problem: they ride the ring radius itself and scale both axes.)

- `armWidth` / `thighWidth` — the LATERAL breadth, on top of `bicep` / `quad`. This is the axis the
  front view reads. `armWidth` eases along the lobe profile so the deltoid and elbow caps still
  cover the ends; `thighWidth` is localized to the thigh band and leaves the calf to `calf`.
- `tricep` — the posterior upper-arm lobe alone, on top of `bicep`. Muscle reads anterior; gained
  weight reads posterior. Welded to one dial, an arm could only ever be a bigger bicep.
- `hamstring` / `adductor` — the thigh's posterior and medial lobes, which carried no dial at all.
  `adductor` is what closes a heavy leg at the top; `thighWidth` opens it outward.
- `deltoid` / `elbowCap` — the joint caps. They were the joints with no dial, so a limb could
  inflate while the joint it hangs from held still: balloons strung on pins. (The hip already had
  `hipFlare`.)

**The distal limb has the opposite gap.** `forearm` and `calf` ride the ring radius itself, so they
scale both axes and never needed a width dial. What they could not say is WHERE the mass sits, or
how thick the joint under it is — the forearm's belly was pinned at 0.40 of the segment and the
calf's crest at 0.488 (against a knee trough at 0.442), for every dial and every weight.

- `forearmDrop` / `calfDrop` — slide that belly along its own segment (0 = canonical). This is the
  axis a calf is actually read on: a long low calf tapering into the ankle is a different leg from a
  short high one at the same volume. `calfDrop` travels DOWN freely and is bounded going UP by the
  knee — a gastroc does not sit above the joint, so negative values concentrate the mass and read
  as a shorter, tighter calf rather than moving it.
- `wristGirth` / `ankleGirth` — the terminal joints' own thickness. `wristTaper` FLATTENS the wrist
  (it is the flipper dial) and only ever moved girth as a side effect; the ankle answered to nothing
  at all. Bone-thin wrists and thick ankles are both now reachable, and each stays out of the belly
  above it.

`weight` does NOT drive any of these four, and that is measured rather than an omission: `forearm`
and `calf` already carry gains, and at `weight: 2` the wrist measures ×1.151 and the ankle ×1.148,
which is about what a real one does. The distal gap was expressive, not relational.

So the fat↔muscle axis is now a choice rather than a side effect: `{ bicep: 1.5, armWidth: 1.2 }`
is a developed arm, `{ tricep: 1.5, armWidth: 1.35 }` is a heavy one, and they are different shapes
at the same circumference.

**The stomach and the hips.** Same shape of gap as the chest: `dantien` and `gluteSize` scale their
mass uniformly, so the axis that actually reads was unreachable.

- `bellyFill` — **the belly you usually want** (0 = canonical). It swells the TRUNK's own section
  around the navel, so a heavy middle is one continuous profile. `dantien` is a separate ellipsoid
  unioned onto the torso, so growing *that* enlarges a ball whose own silhouette reads as an object
  stuck to the body — which is why `weight` drives `bellyFill` and barely touches `dantien`.
- `dantien` / `bellyDepth` — the separate lower-belly MASS and its fore/aft. Both are bounded by
  the proportional seat below, so past a point more depth just buries the mass in the torso rather
  than pushing it further out. Reach for them when you want that distinct rounded form.
- `bellyDrop` — where that mass sits, as a fraction of its own height (**0 = canonical**, not 1):
  + sits it lower (a low-slung gut), − rides it higher (a barrel stomach).
- `gluteRear` — the buttock's REAR projection alone, on top of `gluteSize`: the shelf↔flat axis
  that reads in the lateral view, with no change to width or height. It multiplies the sex pole's
  own rear scale rather than replacing it, so a female figure stays proportionally flatter at the
  same dial.
- `hipFlare` — the hip cap's mass over the ball joint. This was the one body mass in the figure
  with no dial at all; every other (glute, scapula bun, deltoid) already had one.

The side profile is held CONVEX as weight goes on: the belly swell reaches the ribcage rather than
dying at the waist, and the waist's depth pinch relaxes with `waistTuck` along with its width. A
lean figure still has a waist — a narrowing between the hip flare and the ribs is a waist, not a
concavity — but a heavy one no longer keeps a groove across its middle.

**The proportional seat.** The belly and the seat are separate ring-stacks unioned onto the trunk,
and each grows twice over: the dial scales its radius AND slides its centre away from the body.
Nothing bounded that, so a heavy figure grew spheres bolted to a torso — the seat reached 80 % of
the trunk's own depth behind it against a canonical 55 %. Every superposed mass is now seated back
until its reach is the proportion of the trunk it has at canonical, whatever the dials say. It is
self-limiting, so a hand-set `gluteSize: 3` is bounded too, not only a heavy `weight`.

The waist deliberately has no depth dial of its own: its fore/aft is the interpolation of the
chest's and the pelvis's, so lowering both narrows it. It is not an unreachable axis, and a knob
that fights its neighbours would only make the trunk read as stacked tubes.

### fluffs — the STYLIZED body register

REPLACES `proto` when present. A chunky zdog-style body built from a CLOSED set of named simple volumes bound to armature segments/nodes, composed by superposition (girth contrast by default: huge distal masses on thin connectors — the action-figure / mega-boy / mecha read). Garments still track it. Each entry: `{ shape, segment|node, id?, bias?{x,y,z}, hex?, …dials }`.

Shapes (cone | football | bead | bell | slab):

- `cone` — binds a segment `[proximal, distal]`; dials `girth` + `taper` (taper>1 = FLARE, a boot).
- `football` — binds a segment; dials `girth` + `peak` (belly position) + `mouth` (distal flat truncation 0-0.95, the cuff / OPEN arm-cannon).
- `bead` — binds a node; dials `r` + `peak` (0 = sphere → 1 = cone/crest) + `squash`.
- `bell` — binds a segment; dials `girth` + `mouth` (wide distal radius, chest/skirt).
- `slab` — binds a segment; dials `girth` + `depth` + `n` (superellipse, ↑ = boxier) + `taper` (torso plate, foot).

Segments/nodes name two/one of the 17 LANDMARKS: `headTop`, `headBase`, `neckHub`, `navel`, `pelvisHub`, `shoulderL`/`R`, `elbowL`/`R`, `wristL`/`R`, `hipL`/`R`, `kneeL`/`R`, `ankleL`/`R`. Example Mega-Man arm: `{ shape:'football', segment:['elbowR','wristR'], girth:0.05, peak:0.7, mouth:0.5 }` (open buster). Omit `fluffs` → the anatomical proto body.

### garment — clothing over the body

Tracks the pose + body for free (svgile-row bespoke tailoring — the body's own geometry is the tape measure, so body-relative cuts/panels/seams fit any form). One of the wardrobe keys: `skinSuit`, `wetsuit`, `tee`, `tank`, `dress`, `vest`, `fittedShirt`, `oversizedShirt`, `trousers` (slim|baggy), `skirt`, `jacket` (cut|allCut|paneled) — or an INLINE wardrobe-piece spec `{ id, color?{cloth,under}, pieces:[{ fit: hug|hull|drape|radial|pelvis|torso|shoulders|sleeve|sash|pattern, coverage?, clearance?, thickness?, basin?, anchor? }], cuts?:[{ kind: wedge|band|capsule|hole|halfspace|neck|armhole, … }], panels?, seams? }` (the piece's mugen clearance IS its looseness — slim vs baggy is only the number; `fit:'pattern'` is the CUT-AND-SEWN family — flat pieces in cm with an `outline`, a body `chart` and `anchor`, sewn by `seams` and reporting girths, strain and seam ease — see the `wardrobe-construction` card §6) — or an ARRAY mixing keys and specs to LAYER them (e.g. `['tank', {…dreamPants}, 'jacketCut']`) — or `null` = bare.

Skin seam: the figure's filled control scaffold can be painted and bound so the figure then WEARS the paint deterministically at its `/skin.png`.

### view — the camera

`'frontal'` | `'three-quarter'` | `'lateral'` | `'left'` | `'back'`, or a number (azimuth degrees; 0 = front).

### motion — optional, renders a looping GIF

One vocabulary (the phase→dof analog of `pose`):

- `'walk'` — the default parameterized walk cycle (a real weight-shifting gait: the stance foot plants, the COM transfers over it, with a live spine counter-rotation).
- `'sprint'` (alias `'run'`) — a sprinter's stride: a flight phase (both feet airborne), single-foot contact, hard forward lean, high knee drive, 90° arm pump.
- `'wave'` — a tilt then a right-hand wave.
- `{ walk: { strideLength, cross, stepFlare, stepRoll, pelvisRot, shoulderRot, stanceKnee, swingLift, armSwing, elbowBase, elbowSwing, handCurl, wristGive, hipSway, spineTwist, weightShift, headLevel, lean, headTilt, cadence } }` — tune the walk dials (handCurl = relaxed finger curl so the hands aren't flat boards; wristGive = the wrist flexes with the arm swing; pelvisRot = transverse pelvic rotation, the swing-side hip leads each step, on by default; shoulderRot = the upper mirror, the shoulder girdle contra-rotates against the pelvis; weightShift = how much the body lists onto the bearing leg; lean = forward trunk slouch; headTilt = forward head — lean+headTilt+loose limbs reads as a 'shaggy' amble; cross = lateral crossover, 0 = normal hip-width sagittal walk, ≈0.10 lands on the centerline, >0.10 scissors past for a catwalk crossover; stepFlare/stepRoll = crossover CLEARANCE, the swinging back foot circumducts around the planted ankle, auto-gated so a plain walk is untouched; omit any → its default).
- `{ sprint: { strideLength, hipDrive, swingTuck, armSwing, armBack, elbowBend, lean, dutyFactor, flightLift, … } }` — tune the run (hipDrive = thigh/high-knee lift, armBack = backward arm drive, dutyFactor < 0.5 → longer flight, flightLift = airborne rise).
- `{ keyframes: [pose, …], loop }` — author a CUSTOM motion as a list of poses; each `pose` is exactly a `pose` spec (same dials), eased between in order.
- a named EMOTE (nod / headshake / bow / shrug / cheer / point / clap / think), or `{ emote, intensity }` — the body-language layer (see the emote card).

Any form may add `{ perform: { exaggerate, anticipation, followThrough, idle } }` to overlay the animation principles (limb lag, wind-up, breathing).

### setup — the STUDIO

Backdrop + material + lighting + render mode, separate from the body dials:

- `'studio-grey'` — neutral grey, lit (the default look).
- `'white-cyc'` — high-key seamless white, lit.
- `'blueprint-wire'` — deep blue ground, cyan ring-wave WIREFRAME (a construction/verification view, no fill — verify a region before trusting the filled render).

Omit → the default lit studio look (≈ studio-grey).

`toon` (beside `setup`, not inside it) cel-shades the figure: `true` = three tones + ink outlines
in the World, `{ bands: N }` = tones only. The bands are baked into the fills, so the SVG still,
the World and the `.glb` agree; `ink` is World-only (silhouette hull + crease lines).

### remaining fields

- `background` (boolean) — light backdrop (default true; false → transparent). A setup supplies its own ground; `background:false` still forces transparency for the still SVG.
- `animate` — motion GIF control. Omit → auto (GIF when motion is set); `false` → still only; `{ frames, fps }` → tune.
- `dream_audit` — character-from-dream PROVENANCE (the machine gate). Provide ONLY when this figure was reconstructed from an image worker's dreamed reference (a character sheet / exploded garment pieces actually generated and READ). Attests the dream really happened: `{ source: 'native' | 'local:<detail>', invoked_generator: true (REQUIRED — a figure tuned from imagination must NOT set this), prompt: '<the brief dreamed>', and one generation id: job_id | image_sha256 | seed | token }`; optional `notes`. A malformed audit or `invoked_generator≠true` is REFUSED. Omit for an ordinary (imagined) figure — the dreamed pixels are discarded either way; only this attestation persists as provenance.

## Worked example

A female figure in contrapposto — weight on the right leg, a hand raised, in a fitted shirt on a white cyc.

```
{
  title: 'reaching study',
  spec: {
    proto: { sex: 'female', height: 1.0, waistTuck: 1.1 },
    pose: {
      spine: { lateral: 0.25, axial: 0.15 },
      pelvis: 8,
      hipR: { pitch: -4 }, kneeL: 18,
      shR: { pitch: 95, yaw: 10 }, elbowR: 40,
      wristR: { flex: -10 },
      head: { yaw: -12, pitch: 4 }
    },
    garment: 'fittedShirt',
    view: 'three-quarter',
    setup: 'white-cyc'
  }
}
```

Returns `{ ok, ref, url, svgUrl, gifUrl? }` — open the `url` (or rasterize the `svgUrl`) to see the pose, then adjust the dials and re-mint.
