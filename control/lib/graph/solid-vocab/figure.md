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

Four independent dial-sets, all optional (omit → canonical male, neutral stance, three-quarter view): the POSE, the BODY (`proto` or the stylized `fluffs`), the `garment`, and the studio `setup`.

## Spec shape

`title`, `ref`, and `folder_ref` are passed at the mint's top level. Everything below goes in `spec`.

```
spec: {
  pose?:    { …per-joint DOF },
  proto?:   { sex, height, stockiness, headScale, …region multipliers },
  fluffs?:  [ { shape, segment|node, … }, … ],   // replaces proto when present
  garment?: '<key>' | { …inline piece } | [ … layered ] | null,
  view?:    'frontal'|'three-quarter'|'lateral'|'left'|'back' | <azimuth°>,
  motion?:  'walk'|'sprint'|'wave' | '<emote>' | { walk|sprint|keyframes … },
  setup?:   'studio-grey'|'white-cyc'|'blueprint-wire' | null,
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
- head: `head` `{ yaw, pitch }`.
- SPINE: `spine` `{ sagittal, lateral, axial }` each ∈ [-1,+1] — sagittal + = flex/curl forward, − = arch back; lateral = side-bend; axial = twist. This is what makes a pose read alive (contrapposto, slump, recoil) instead of rigid-vertical. The bend is distributed across the trunk by its natural mobility (lumbar flexes, thoracic rotates).

### proto — the BODY

Body tuning. `sex` (`'male'`|`'female'`); `height` (overall scale), `stockiness` (girth); `headScale` (skull size about the neck join — the dominant child↔adult cue: >1 enlarges the cranium so the body reads fewer "heads tall" = younger); per-region multipliers (1 = canonical): `chestWidth`, `pecProjection`, `waistTuck`, `bicep`, `forearm`, `quad`, `calf`, `gluteSize`, `scapulaBun`, `footLength`, `handSize`. The same dials morph a body lean↔heavy, male↔female, adult↔child.

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

Tracks the pose + body for free (svgile-row bespoke tailoring — the body's own geometry is the tape measure, so body-relative cuts/panels/seams fit any form). One of the wardrobe keys: `skinSuit`, `wetsuit`, `tee`, `tank`, `dress`, `vest`, `fittedShirt`, `oversizedShirt`, `trousers` (slim|baggy), `skirt`, `jacket` (cut|allCut|paneled) — or an INLINE wardrobe-piece spec `{ id, color?{cloth,under}, pieces:[{ fit: hug|hull|drape|radial|pelvis|torso|shoulders|sleeve|sash, coverage?, clearance?, thickness?, basin?, anchor? }], cuts?:[{ kind: wedge|band|capsule|hole|halfspace|neck|armhole, … }], panels? }` (the piece's mugen clearance IS its looseness — slim vs baggy is only the number) — or an ARRAY mixing keys and specs to LAYER them (e.g. `['tank', {…dreamPants}, 'jacketCut']`) — or `null` = bare.

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
