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
the grid), grid?, toon? (+ toon.light?), hullShade?, rim? }`. The stored manifest is the recipe plus dial values; the World, `measure_solid`
and `export_model` see the compiled mesh itself (every closed part exact, whatever its shape; a recipe
`palette: { <group>: '#hex' }` colours faces by group, else the part's `tint`). Patch a dial:
`update_sketch { ref, patch: [{ op: 'set', path: '/dials/jawOpen', value: 30 }] }`.
`hullShade: true | { except: ['<part>', …] }` (rigged recipes) bakes the rig figure's vertex-colour light
from the smooth L1 hull's normals instead of flat facets, so the light sweeps the underlying form while
grown detail keeps its silhouette — the toon read. `except` names focal parts (a horn, a ridge) that keep
their own faceted shading. Absent, the bake is unchanged.
`rim: [r, g, b, strength, power]` (rigged recipes) adds a cool/warm fresnel edge light to the figure's
clip preview on the World page (ms-contrast's rim, adopted); pairs with `hullShade` for the full toon
read. `toon: { ink: true, bake: true }` on the manifest additionally bakes the outline into the GLB
export as real geometry — the skinned figure's inverted hull rides the rig in-engine; `ink: { lines: false }` keeps the
silhouette hull alone (no crease or open-edge lines). All opt-in; absent, every byte is identical.
THE CHARACTER LIGHT. `toon.light` (beside `toon`'s other fields, so a light edit never regenerates the recipe): `{
toLight: [x, y, z]` (toward the key, in the figure's own frame, +y front, +z up; default front, above and from the
figure's right), `threshold` (the N·L step, 0), `thresholds: { <group>: t }` (Hair 0.40: about three quarters of the
hair lit at the three-quarter view, with shade shapes under the locks), `shade: { <group>: '#hex' }` (else derived from
the base: skin warm and the rest a cool neutral, about 10–13 L* darker; hair by value — L* × 0.52 but no darker than
L* 20.5 (about 15 above the World page's dark backdrop, and never within 10 of the lit tone), chroma × 0.75, the hue 20°
toward violet, so a brown's shade stays brown), `unlit: [groups]` (drawn at their colour: `Iris`, `Pupil`, `Sclera`,
`Ink`, `Mouth`), `highlight: { <group>: { kind: 'ring' | 'streak' | 'gloss', threshold?, band?, falloff?, parts? } | false }` (a
THIRD tone on the group's lit side, split along a second line: `ring` — N·L above `threshold` (0.3) inside its `band`
(a share of the head's height below the skull crown, [0.14, 0.22]) narrowed away from the key's side by `falloff` (1.4):
a crescent facing the key whose edges follow the position, so they run smooth across a lock, the sheen line; `streak`
— N·L above `threshold` (0.5) inside the band ([0, 0.4]) only; `gloss` — N·L above a high `threshold` (0.86) anywhere
on the group, no band: the moulded-plastic hot spot on each rounded form facing the key (a hero robot's armour); `parts: 'fringe'` keeps it to the fringe; its colour the
palette's `<group>Highlight`, else derived: a quarter of the way from the base's L* to white, chroma × 1.15 — always
lighter, and none on a base above about L* 84, whose lit side keeps one tone; `false` none), `strands: { <group>: {
count?, width?, reach?, below?, tone? } | true | false }` (LINES INSIDE the group's mass in its OWN tone darkened, never
the ink's black: `count` (22) lines about the head's vertical axis, each `width` (0.003 m), rising from the group's
lowest edge to a top staggered across `reach` ([0.15, 0.5] of the head's height below the crown), none below `below`
(1.15 head heights); the fill the face's lit or shade tone at `tone` (0.6) of its lightness, the hue kept and the
saturation lifted a little; a face the step splits or the highlight lights keeps its tones; absent, nothing) `}`.
The anime hero takes its base's hair highlight by default (the ring on the female, a fringe streak on the male) unless
its light says `highlight`. Each face steps to its lit or shade swatch, and a face the terminator crosses is split
along it (and its lit side again along the highlight's line), crisp in the World, the static GLB and the rig preview
alike (joints and weights interpolated at the split, and where the two lines cross inside a triangle by its corners'
weights). The shading normals are derived on read (smooth fans
split at 35°; on the anime head a capsule for the face and a cylinder for the neck; hair keeps its own). Under the
anime head the neck is always in shade (the head shadows it), one swatch, never split, and the hair's TOP PLANES take
the light from above as well as the key's (a hair corner's N·L gains 0.8 of its normal's upward share), so the crown
and the upper back read lit from behind while the undersides keep their shade shapes. A
character-lit figure wears a silhouette outline at a width set by its height (`toon: { ink: false }` drops it; its own
ink fields win); the drawn features take none. The anime hero wears it by default; `toon: { light: false }` opts out,
`light: true` gives any layered solid the default key; the unshaded export ignores it. An invalid light refuses by
field. THE DRAW LAYERS (derived on read, nothing stored): a part flagged `through` (the graphic face's brows and lids)
is drawn after everything else at its depth and shows through the part flagged `veil` (the fringe) — from the front and
the three-quarter view, never from behind (the skull hides it) nor through a side lock — and with the ink on the hair's
outline never draws over hair (no seam between locks; the line where hair meets the face or the background stays). The
World page does it with a stencil buffer, asked for only then; the clip preview does the same on the moving parts. The
GLB's baked ink (`bake: true`) cannot stencil: it leaves out only the outline of hair lying inside another hair part.

- **Rig (optional).** `rig: { joints: { name: { at, rides? } }, bones: [{ id, head, tail, aux?, align? }], chains:
  { channel: { axis, sign?, links: [{ pivot, joints }] } }, legs: { L|R: { hip, knee, hock, toeBase, toeTip,
  pole } }, reach? }` — rest joints must include the vajra core names (pelvisHub, navel, neckHub, headBase,
  headTop, shoulder/elbow/wrist/hip/knee/ankle L+R). Every L1 part then declares `bind: 'bone' | { bone,
  blend: { station: { bone: w }, 'station.slot': { bone: w } } }` (the overshoot ring at a joint shared with the
  neighbour; a `station.slot` entry weighs that one point over its station's, a form in a ring with its own bone); a pinned
  detail inherits its face. `clips: { name: [keyposes] }` are `resolvePose` words for the core (`armL:
  'forward'`, `elbowR: 'half'`, `spine: { arch: 0.4 }`, `head: {x,y,z}`) plus `crouch` (0–1, toes planted),
  `heelL/R` (metatarsus degrees about the toe base, − lifts the heel), `lift`, `support`, `stance` (the planted feet's spread, a multiple of
  the hip joints': 1 puts each ankle under its hip), `stagger` (+ the left foot forward, a share of the leg's height),
  and every chain channel. A rig's `hands: { R, L }` (carrier bone, wrist joint, `axes: { flex, deviation, twist }`, the
  hand's joints, per digit a hinge `axis` and `links: [{ pivot, joints, weight, axis? }]`, `poses`) turns those joints
  in the hand's rest frame before they ride the carrier: the channels `wristR` / `wristL` (flex degrees, or `{ flex,
  deviation, twist }`) and `fingersR` / `fingersL` (curl degrees, `{ <digit>: deg }` or a word of `poses`). Legs solve to PLANTED toes (at rest unless `stance` / `stagger` move them);
  an unreachable pose refuses with the numbers (`reach: 'clamp'` to accept a reported error). The mint
  pays the rig gates (valid weights, rest identity, planted drift). `export_model({ format: 'glb', clips:
  '_all', skinned: true })` writes the skinned GLB with authored weights; the Godot world pack
  (`scripts/export-godot.mjs --ref <ref>`, clips on, the default) ships that same skinned GLB for a rigged layered
  solid, imported with LOD generation off, in a scene that plays its `idle` (on a hero its ready loop, not the stand;
  else its first clip of more than one key) on a loop under the authored three-quarter view (else the score's first
  camera), with no walker. On the anime hero the skinned GLB also carries the face as blend shapes (the anime
  `expression`, below; `face_skipped` says why a row exports without it: a stored head the hero no longer builds,
  regenerated by any `/hero` edit, or a dial that moves the head), the clips play their designed durations (THE CLIPS,
  below), the view is re-placed to frame the figure over all its clips, and the scene (`figure_face.gd`, extending
  `figure.gd`) sets the authored face from the mesh extras on ready (Godot ignores the file's default weights) and,
  over a clip whose eyes hold the authored face (`extras.face.ambientOver`), layers `face:ambientBlink` through an
  AnimationTree filtered to the eye shapes; the machine gate's figure probe checks the blend shapes, the face at ready,
  the face tracks, the durations and the layer. In a source checkout (`docs/` is not in the npm package),
  `docs/examples/humanoid/view-animations.mjs` turns the skinned GLB into a page that plays it as an engine does, the
  face panel included; that page loads three.js from jsdelivr. `scripts/export-wire-svg.mjs --ref <ref> --clip
  crouch --phase 0.5` draws a posed frame.
  The World page plays the clips in place (`?clip=<name>`, or the selector in the corner; "rest" shows the solid). On
  a hero, a clip named `gesture` is the STAND (below): the World and the static exports show the solid skinned at its
  key, and the page opens on that solid; a plan's own clip of that name is an ordinary clip.

- **Plan (the compact door).** `mint_solid({ kind: 'layered', via: 'plan', spec: { plan } })` — a RING PLAN
  is what the seeds write by hand: `{ schema: 'layered-plan-v1', frame, joints: { name: [x, y, z] } (the right
  side), segments: [ { name, kind: 'trunk', stations: [{ z, r, yc?, e?, id?, u?, push? }], caps, mirror: 'plane' } (`u` a station's address
  parameter, default its index: a shaping ring between two addressed ones takes a fractional `u` and every address keeps its
  meaning; `push: { slot: [dx, dy, dz] }` moves a right-half or midline slot off the ring, the left mirrored) | { name, kind:
  'segment', from, to, rA, rB, e?, over?, mirror: 'plane' | 'name', bind: { bone, prev?, next? } } | { name, kind:
  'chain', joints, r, over?, bind: { root } } | { name, kind: 'loft', stations: [{ at, r, e? }], caps?, mirror, bind } (explicit stations
  along a polyline, each ring ⟂ its local direction: a thigh from the hip crest; `frame: 'keep'` holds each ring's front on
  the side of the last, for a loft running near level along y, a barrel, that would otherwise twist) | { name, kind: 'rings', slots, stations:
  [{ id?, points: { slot: [x, y, z] } }], caps, mirror: 'name', bind } (rings given point by point, every slot of the family
  in loop order: a layer that hugs another part's surface, a muscle over the chest; `ring20` a fine family for one) ]; any segment may name `slotT` (each
  right-half and midline slot's address parameter, rising from 0: a denser ring addressed on a sparser one's scale),
  `bandGroups: { '<station>-<station>': [a group per right-half band] }` and `capGroups: { back?, tip? }`; a point's blend
  `station.slot` mirrors with its slot, details: [{ name, kind: 'claw', base, dir, length, radius, pin,
  stretch?, mirror? }], heads: [{ name, plan, expression?, on: <joint> | shift, bind? }] (a detailed head as DATA, schema
  `layered-head-v1`: station tables, refine ops, skin maps by landmark, eye and regions, ornaments `sweep` /
  `teeth` / `disc`, midline pins; expanded at a preset expression (neutral, pant, flick, surprise, snarl) or
  control values; worn BY NAME: its `nape` landmark sits on the `on` joint, the segment ending there is fitted so it
  stays buried in the head at every head dial extreme, and rig joints may be `at: '<head>.<anchor>'`, the anchors read
  from the head: `cranium.tip`, `jaw.tip`, `<part>.back`, `jawOpen.pivot`, its landmarks), include: [{ name, parts,
  dials?, creases?, palette?, shift, bind? }] (a baked fragment worn at a shift), dials (an entry `{ op: 'include',
  name }` splices a head's or include's dials there), rig, clips, style? }`. Slot families `ring6` / `ring8` /
  `ring10` / `ring12` / `limb6`; `style: { slots, limbSlots, e }` is the ART STYLE, the ring family of every trunk and
  of every limb and the superellipse exponent of every ring that names none (2 round, 6 chamfered, 12 a box), so one
  edit changes the whole figure's register; `$S` in a name stands for its R and L twins (dial parts, rig joints, a
  `perSide` bone block). `expandPlan` makes superellipse rings perpendicular to each segment's axis, overshoots the joints so
  neighbours fuse, mirrors by name, places claws as local offsets on their faces, and builds segment bindings
  (shared overshoot rings). The recipe is stored beside the plan; a patch under `/plan` re-expands it, a patch
  under `/dials` or `/recipe` edits as before. Refusals name the plan field.

- **Hero door (a human by word and percentage).** `mint_solid({ kind: 'layered', via: 'hero', spec: { cast, register, tune,
  face?, hair?, expression?, sculpt?, detail?, adorn?, gesture?, clips?, blink?, body?, girth?, headScale?, scale?, palette?, head?, title? } })` mints the HERO FORM (`control/lib/graph/polygonizer/hero-form.js`:
  a human ring plan on the vajra rest skeleton, one style register for every ring, `idle` / `walk` / `wave`) from a CAST
  word — `male` / `female` (the hero's own: joints, girth, body radii) or a figure cast (`canonical`, `heroic`, `brute`,
  `lithe`, `stout`, `child`, `chibi`) — and a TUNE: proportion as PERCENTAGES OF THAT CAST'S BASELINE (1 = as cast), the
  body proportion lab's contract. Thirteen controls in five groups, each a ratio: `stature` (uniform); lengths `torso`,
  `neck`, `legs` (joints move, the soles stay on the ground); widths `shoulders` (the arm chain rides out, the yoke widens),
  `waist`, `hips` (the pelvis, not the stance), `depth` (front-to-back of the trunk and pelvis); `head` (uniform about the
  atlas); thicknesses `upperArm`, `forearm`, `thigh`, `calf` (rings scale about their own centres; joints, the yoke and the
  wrist ring stay). Group words expand first (`lengths`, `widths`, `limbs`, `arms`) and an explicit key in the same object
  wins. A tune is a MOVE word (`athletic` shoulders 118 % / waist 94 %; `long-legs` legs 112 %; `full-limbs` upperArm 130 %,
  forearm 120 %, thigh 120 %, calf 125 %), an object, or a LIST resolved left to right with ratios composing by PRODUCT:
  `['athletic', { shoulders: 1.05 }]` is broader still. Comfortable ranges (stature / lengths / head 0.85–1.15, shoulders
  0.8–1.25, waist 0.8–1.2, hips / depth 0.85–1.2, thicknesses 0.65–1.5) ADVISE in `warnings`; nothing refuses but an
  unknown control or a ratio that is not a positive number. `body` stays for radii in metres (`waist`, `chest`, `chestDepth`,
  `hip`, `hipDepth`, `thigh`, `calf`, `arm`, `forearm`, `neck`, `bust`; `bust` is at most 0.4 × the `chest` radius, and a
  child-coded figure, the `child` or `chibi` cast or the anime `kid` look, takes no `bust`); `head` wears a baked include
  (the blank trunk otherwise).
  The row stores `hero` (cast, register, the RESOLVED tune, the move trail) beside `plan` and `recipe`: patch
  `update_sketch { ref, patch: [{ op: 'set', path: '/hero/tune/shoulders', value: 1.1 }] }` and the plan and recipe regenerate;
  the readout's `hero` answers in metres (`height_m`, `shoulder_m` across the yoke, `hip_m` across the pelvis) with the tune
  and its advice. A `/plan` patch is honoured and kept until the next `/hero` edit, which regenerates and SAYS it replaced
  those hand edits (the archived revision keeps them). The live dials (`bulk`, `stance`, `lean`, a worn head's `jawOpen`)
  are post-expansion moves under `/dials`; a tune is authored proportion. The `create-hero` catalyst is the loop.
  THE FACE. A hero wears the fitted LANDMARK HEAD by default (`head: 'landmark'`; `'none'` is a blank head trunk; a
  baked include is worn as given). `face` is the face proportion lab's contract on the fitted head, ratios about the fit
  (1 = as fitted), in groups: `skull` (`skullWidth` the vault, `faceWidth` from the cheekbones forward, `faceLength` the
  face below the eyes, the chin drops), `brow` (`browHeight`, `browRidge`, `foreheadSlope`), `eyes` (`eyeSpacing`,
  `eyeSize`), `cheeks` (`cheekbone` the crest, `cheek` the soft cheek), `nose` (`noseWidth` the alae and with them the
  V3 mouth, `noseSize` the projection, `noseDroop`), `mouth` (`mouthWidth`), `jaw` (`jawWidth`, `chinProjection`,
  `chinPoint`), `ears` (`earSize`). Moves `broad-jaw` (jawWidth 118 %, chinProjection 108 %) and `large-eyes` (eyeSize
  115 %, eyeSpacing 105 %); a word, an object or a list composed by product like the tune; comfortable ranges advise
  (faceLength's floor is 0.92: below it the fitted jaw folds). `expression` (`neutral`, `smile`, `determined`,
  `surprised`; `jawOpen` stays a live dial) and `headPreset` (`male` / `female`, the head's pole and fit; a figure cast
  such as `chibi` wears the male by default) ride beside it. Patch `/hero/face/<control>`, `/hero/expression` and the
  head, the plan and the recipe regenerate; a face never moves a joint. The readout's `hero.face*` answers in metres off
  the head's landmarks (`head_m` crown to chin, `cheekbones_m`, `jaw_m`, `pupils_m`).
  THE HAIR. A LIBRARY of styles as closed masses whose perimeter follows the skull by address (they ride every face
  control and never sink into the skull), the hairstyle lab's words: the male collection `animeShort` (pointed locks:
  bangs, side locks to the cheek, crown spikes), `buzz`, `crew`, `taper`, `undercut`, `crop`, `quiff`, `swept`, `curtains`;
  the female `animeBob` (locks falling to the jaw), `pixie`, `bob`, `angled`, `layers`, `long`, `wavy`, `ponytail`, `bun`,
  `braid`; `none`; either head wears any. Nineteen controls as ratios about the style's preset, in groups `cap` (`volume`
  the lifts, `fringe` the front hairline down or up, never past the brow, `part` the groove sliding across the front with,
  on a female style, two lobes beside it and an open front, `fade` the sides and back up: a taper), `fall` (`length` the
  drop of a fall or a tail, `graduation` the angled bob's front, `wave` the hem's swing), `tails` (`tail` the ponytail's or
  bun's fullness, `tie` where it gathers on the occiput, `braid` the winding), `locks` (`lockWidth`, `taper` the tips,
  `bend` the sweep, `asymmetry` a deterministic offset per lock; 0 is an exact mirror), `form` (the barber's pass on the
  male caps: `corners` the parietal corners kept, `sideBulk` the lower sides, `topSlope` the front weight, `lineup` the
  hairline squared at the temples; 0 switches it off) and `definition` (every style's signature exaggerated or relaxed:
  the crew's flat top, the undercut's shelf, the quiff's lift, the female part's lobes, the long falls' separated panels,
  the gathered styles' crown ridges). On `crop`, `swept` and `bob` the form and definition are RELATIVE (1 changes
  nothing: they are the pinned read the head grew before the library). `hair` is a word, `{ style, length: 1.3 }` or
  `['ponytail', { length: 1.3 }]`; a control the style does not use ADVISES in `warnings`, never refuses. Stored resolved under `hero.hair`: patch `/hero/hair/style`
  or `/hero/hair/<control>`. The readout's `hero.hair`, `hairMoved` and `hairMeasures` (`top_m` above the crown, `hem_m`
  below the chin, negative when it hangs past it, `back_m` behind the occiput) answer in the operator's terms. Hair colour
  is the palette's `Hair`.
  THE ANIME HEAD. `head: 'anime'` wears the Anime Form Studio's head instead: an original anime construction (one
  designed surface, eye and mouth apertures, a tall iris clipped by the lids, a modelled upper lash and a thin lower rim,
  a brow ribbon, ears; clump hair along root → control → tip curves), ported from the studio bit for bit and registered
  where the landmark head sits (crown to chin, chin at the menton), every part closed and riding the head bone. It has
  no jaw: the studio opens the mouth as an aperture, so there is no `jawOpen`. Its words are the studio's. `headPreset`
  is the design base (`female` / `male`; a figure cast wears the male), the studio's with the chin set back (its
  `chinProjection` slider 0.2 lower on both). `face`: the studio's controls, 1 = the base,
  applied as its sliders — `skull` (`width`, `depth`, `backDepth`, `occiput`, `nape`), `brow` (`foreheadDepth`,
  `browDepth`), `cheeks` (`cheekVolume`, `lowerCheekVolume`), `jawline` (`jaw`, `jawAngle`, `jawDepth`), `chinShape`
  (`chin` breadth, `chinProjection`, `chinHeight`), `eyes` (`eyeWidth`, `eyeHeight`), and alone `lower` (the lower face's
  length), `nose` (projection), `spacing`, `iris`, `headPitch` (the rest carriage, chin up: 6° on the studio's and the female base, 3° on the male base), `tilt` (the outer-eye lift,
  an OFFSET about the base's own: positive lifts, negative droops). `hair`: a FAMILY (the studio's `bob`, `short`,
  `long`, and `hime`: a blunt fringe cut level at the brow, sidelocks squared at the jaw, a long straight back; the hair
  base's cut by default, below; `none`), the studio's controls (`volume`, `length`, `fringe`, `clump` width, `thickness`,
  `taper`; `sweep`, `part` and `ahoge` — one upright curl at the crown, 0 none — offsets) and `locks`: one clump directed by the studio's clump name (`fringe-1`…`7`,
  `left-temple-0`…`2`, `right-temple-0`…`2`, `back-1`…`11`, on short `crown-1-0`…`2` and `crown--1-0`…`2`, `ahoge`) as
  `{ cx, cy, cz, tx, ty, tz }`, its control point and tip moved in the studio's construction units (the head is about 2.2
  tall; ±0.2 is the studio's range, ±3 the most the door takes), its root held. `expression`: a pose (`neutral`, `blink`, `smile`, `open`) or the
  four amounts `{ blink, smile, open, brow }`; `['smile', { brow: -0.2 }]` adjusts a pose. Lists compose (ratios by
  product, offsets and lock edits by sum, a family or a pose last-wins); the studio's ranges advise, never refuse. In
  the skinned GLB (so in an engine) the expression travels as morph targets on the neutral head, each the difference of
  two builds of the head with only the expression changed: `blink`, `blinkLeft`, `blinkRight`, `smile`, `mouthOpen`,
  `browInnerRaise` (brow −1, the inner ends up), `browInnerLower` (brow +1) and the lid correctives `blinkFix10`, `12`,
  `18`, `20`, `50` per eye (`L` mesh −x, the figure's left); `mesh.weights` is the authored expression and
  `mesh.extras.face.words` holds every expression word's weights and `authored`. The lid crops the lenses nonlinearly,
  so eye closure is drawn only at the knots 0, 0.1, 0.12, 0.18, 0.2, 0.5 and 1, each with its corrective at weight 1,
  never tweened between them; a hero whose own `blink` sits between two knots (0.35, 0.6) is drawn at it too, one more
  corrective pair (`blinkFix35L`/`R`, named by the closure's decimals) after the others, so the default face is the
  stored one. Every word blends within 0.3 mm of a true build of it. Patch
  `/hero/face/<control>`, `/hero/hair/style`, `/hero/hair/<control>`, `/hero/hair/locks/<clump>` (a whole edit object),
  `/hero/expression`. The readout's `hero.faceMeasures` answer in metres (`head_m`, `face_m` across, `depth_m`,
  `pupils_m`, `eye_m` the opening), `hairMeasures` as above, `evidence` says the head is authored. THE HAIR SEATS ON THE
  HEAD: the cap is the head's own surface lifted off it down to the studio's hairline (the studio grew a fixed ellipsoid,
  and a fuller occiput showed through it), and every clump hangs outside the head's actual section at its height, so the
  hair follows every face control (a deeper face, fuller cheeks, a fuller occiput). `hero.hairCoverage` is the ledger:
  the share of the scalp that still shows from the back, the side, the rear three-quarter and above (0 is covered; the
  studio's own bob showed 28 % from the back on the female base, 47 % on the male); over 5 % advises in `warnings`.
  Its `face` reads the FACE ZONES from the front and both ¾: RED (each eye's iris; the nose and mouth) and YELLOW (the
  brows, lids, cheeks and jaw), the share the hair hides of each; the forehead above the brows is free. Hair over a red
  zone past 15 %, or curtaining the yellow past 75 %, advises. `hair.veil` (0 … 1, absent 0) is the MYSTERY AND ALLURE
  lever: it lets ONE eye go under the hair (to 75 % at 1) and the yellow to 95 %; the other eye and the mouth never.
  Advice only: the veil builds nothing.
  HAIR FORMS: the `bob`, `long` and `hime` families are a few consolidated SECTIONS, not a comb of strands — three bang
  sections, a side section each side, three back sections (parts `hairFormFringeL/C/R`, `hairFormSideL/R`,
  `hairFormBackL/C/R`), each one closed shell skinned across its member clumps and ending in ONE point (its hem a V;
  `taper` deepens it; the hime is cut straight). A clump's `locks` edit still moves the sections it belongs to.
  `strands: 1` builds the studio's separate clumps instead; `short` stays spiky strands.
  THE HAIR FORM (mojulo's words on `hair`, beside its controls; construction units, the head about 2.2 tall): `lift:
  { crown, temple, fringe, nape }` stands the mass off the skull by region (the cap and every clump's drape; while it
  is on the roots emerge from the cap, sunk and pinched, and a clump arching over the crown stays outside a dome) —
  keep `volume` at 1 beside it (volume pushes the fringe forward into a visor; advised); `section: 'round' | 'ridge'`
  (the studio's 8-sided lock, or a roof with a spine over a flatter underside, so a lock shades as two planes);
  `ridge` and `flute` (a spine along a consolidated section, and one per member lock); `crownAccents: 'grow' | 'tuck'
  | 'none'` (the short family's six crown clumps); and the cut's words: `sweepBack` (an amount, or `{ amount, keep,
  rise, riseFall, controlX, controlZ, spread, tipY, tipZ, stagger, rootY, rootZ }`: the fringe rising off the hairline
  over the crown and pointing back; `keep` names fringe clumps that still fall), `hairline: { front }` (the front
  hairline raised; the studio's 0.53; the coverage ledger follows it), `sweepSides` (an amount or `{ amount, from,
  controlY, tipX, tipY, tipZ }`: the temple clumps from `from` swept back over the ear), `fringeGroups` (the bang
  sections by member clump, e.g. `[[1, 2, 3, 4, 5], [5, 6, 7]]`, parts `hairFormFringeA`, `B`, …), `backNotch` (the
  back sections' hem, 1 straight), `fringeNotch` (the bang sections' hem, 1 a blunt fringe), `flip` (an amount or
  `{ amount, out, rise, hold }`: the side and back ends hang straight, then kick out and up), `spikes` (an amount or
  `{ amount, reach, width, up }`, the short family: the six crown accents as broad spikes from a fixed fan (front and
  side), each a CUT CONICAL CARROT (a round cone cut square at a wide base sunk into the mass, tapering to its point), the temples a rounded mass over the ears, the back one convex fall to a point at the nape, the fringe heavy bangs) and `sideTail` (an amount or `{ amount, side: 'left' | 'right', length, width, height }`: the back and
  that side gathered to a tie low behind the ear, one round clump `tail` (part `hairTail`) forward over the shoulder;
  each entry gives its `amount`), and `shapes` (`{ replace?: ['fringe', 'temple', 'back', 'crown'], peppers?,
  bananas?, carrots?, peels?, layers?, scale?, whorl? }`: a hairstyle composed from ONE family — CARROTS (cut conical carrots;
  `length`, `base`, `sink`, `curve`, `bend`), BANANAS (flat crescents; `length`, `width`, `flat`, `bend`, `dir`
  required), PEPPERS (chilis, thin strands; `length`, `width`, `bend`) or PEELS (layered banana peels: thin leaves
  cupped to the scalp; `length`, `width`, `flat`, `cup`, `bend`, `dir` required) — each piece `at: [azimuth°, elevation°]` on
  the cap and aimed by `dir: [x, y, z]`, or laid in `layers` (`{ shape, az, el, rows, count, length, width, droop,
  lift, cover, sprout, vary, bend, swirl, cap, fringe }` (at most 12; `swirl` turns the flow one way by degrees; `cap: 1`
  grows each lock along the dome and lets it fall only past the hairline, `length` then measured past it and `fringe`
  the length of the locks that leave over the face), or `around: [from°, to°]` for a rosette about the whorl) that flow from the
  `whorl` along the head, bananas and peppers tiling it (`cover`)
  and every piece sprouting along the surface before it arcs out (`sprout`); `scale` grows the style; parts `hairCarrot0`,
  `hairBanana0`, `hairPepper0` …), and `sideburns` (any style: `{ length, width, forward, shape?, at?, az? }`, two
  pieces before the ears in the style's family; the principles and recipes are in docs/examples/humanoid/DESIGNING.md).
  A word is stored only when given; lists compose it last-wins (an object key by key);
  `false` is the studio's construction for it; patch `/hero/hair/<word>` (`null` back to the base's).
  THE HAIR BASES: the anime hero's default hair per design base, read when the plan is generated, never stored. A FORM
  under every family — `lift` (male crown 0.12, temples 0.06, fringe 0.06, nape 0.05; female 0.13 / 0.06 / 0.05 / 0.07),
  `thickness` 1.5 / 1.4, the `ridge` section, `crownAccents: 'none'` — and a CUT worn while neither a look nor the
  operator names a family: `swept-back` on the male (the short family swept back off a raised hairline, the crest's
  tips laid onto the mass behind the crown, the sides swept over the ears, `clump` 1.12) and `side-parted` on the female (a long sheet off a side part: one dominant bang swept
  across the brow, sidelocks ending at the jaw, a blunt back, spines along the sections and their locks). Both cuts are
  hair words too, anywhere a hair word goes (`look: ['swept-back']`). Naming a family (`/hero/hair/style`, or a look
  that names one) wears that family as designed over the form. The hair colour defaults to the base's (`#644634` warm
  dark brown on the male, L* about 33; `#465365` blue-black on the female, L* about 35) under the operator's `palette`. The readout's `hairCut`
  names the cut worn (null when a family is named) and `hairMoved` what moved off the base; the hair advice reads past
  the words' own values (a cut's authored lock edits never warn).
  THE GRAPHIC FACE (`sculpt`, on by default; `sculpt: false` is the studio's face above, exactly). Each base wears its
  graphic base: a face layer under the `face` words (a smaller, lower opening, a smaller nose, a shorter lower face; the
  studio's slider advice reads the layer times the word) and a construction the studio does not have — the eye level;
  the nose placed (its tip, the pronasale, with its own projection, the nasal dorsum starting below the brow) and read by
  a short NOSE LINE down its shade side (away from the default key); the lip line (stomion) and the mouth width; the
  palpebral fissure as upper and lower lid curves (`round`, `almond`, `rect`, `tri`); the lateral canthus set back
  along the globe; the upper-lid BAND in place of the lash (its weight of the opening, a tail past the lateral canthus,
  an angle, a flick); the iris sized so the lid covers a share of it and clipped by the lid, a pupil, one catchlight in
  the same place in both eyes; the brow as a BLOCK (`block`: blunt at the inner end, thinning outward; `taper`: pointed
  at both ends); the ear raised from the studio's so it spans the eye level to the nose tip. The male base: a
  flat-lidded `rect` opening under a thick block brow, the inner end down, a heavy lid with an outer wing that shuts to
  one thinner lash line sagging at its middle, the brow relaxing up as it shuts; the female: an `almond` opening with a
  lid flick, a large oval iris, a thin tapered brow set high, a short hooked nose line.
  `sculpt` words: ratios about the base — `mouthWidth`, `tipProjection`, `dorsumProjection`, `noseLine` (0 off),
  `fissureHeight`, `canthusSetback`, `lidWeight`, `lidTail`, `lidCover`, `irisSize`, `irisOval`, `pupil`, `catchlight`
  (0 off), `browThick`, `browGap`, `browLength` — and OFFSETS about 0 — `eyeLevel`, `earLevel`, `pronasale`,
  `dorsumStart`, `stomion` (fractions of the head height, crown to chin), `lidAngle`, `lidFlick`, `browAngle` (degrees),
  `browArch`; the shape words `fissureShape`, `browShape`; moves `heavy-lid`, `brow-block`, `sharp-eyes`, `low-nose`;
  groups `placement`, `nose`, `fissure`, `lid`, `iris`, `brow`. The row stores only the words that differ from the base (the field absent
  when none) or `false`; set `/hero/sculpt` to an object (or a move, a list, `false`), then `/hero/sculpt/<word>`. The
  ink is named by key (`lashLowR/L` the lower rim, `lidR/L`, `browR/L`, `noseLine`; the catchlights `catchR/L` are
  lenses); every expression keeps the same parts and faces (at a blink the lenses sit behind the lid; as the lids
  shut, past a blink of 0.7, the sclera's dish flattens to a tenth of its depth and the lid band tucks further under
  the opening, so the female base's shut lid shows no white line — the male base's lid sags below the slit as it shuts
  and still leaves a thin one above it); `register: 'lowpoly'` takes lighter lenses; the brow and lid parts carry `through: 'fringe'` and the fringe's parts `veil:
  'fringe'` (the brows drawn through the fringe: THE DRAW LAYERS under the character light).
  `hero.faceMeasures.features` is the FEATURE SPACING at rest, in ratios of the head height H (crown to the front chin
  tip) and the face width W at the cheek outline: `eyeLevel`, `earLevel`, `pronasale`, `stomion`, `noseToMouth`,
  `noseProjection` of H, and `ear` (the ear's centre from midway between the eye level and the nose tip, of H);
  `eyeWidth`, `mouthWidth` of W; `fissure` (height over width); `browThick`, `browGap`, `lid` of the opening; `lidPast`
  (how far the lid's tail runs past the lateral canthus, of the opening's width); `browAngle`; `irisOfEye`,
  `pupilOfIris`. Each outside its base's band advises in `warnings`, naming the word that moves it (not under a look: a
  look is another character); a ratio the head does not allow measuring is null and says so. The table reads the face
  at the studio's carriage, so a `headPitch` word never moves it.
  THE CORE: every hero's midsection is built on the vajra core (`core: 'structured'`, the default): the `pelvis` bone is the basin, turned by the
  hip line alone, and a `lumbar` bone carries the pelvis hub to the navel, so a spine curl, arch or side bend (and the
  hinge) bends the lower back over a still pelvis; the hem and the top of the thighs blend the two, and a hip-slung blade
  rides the basin. Its midsection is BUILT on the vajra basket: a `pelvis` part from the crotch up into the hem, its back
  the seat, the hip one curve out from the waist (the female's widest at the trochanter, the male's straight), the front
  receding to the pubis, and the thigh rooted at the hip socket inside it, so it comes out of the pelvis along the groin's
  diagonal. Its TORSO is built on the vajra rib cage: a waist above the hem, the ribs widening to a lifted chest, the male's
  back widest under the arms, the shoulder ring over the arm's cap and a trapezius ring sloping to the neck; the new rings
  sit at fractional `u` between the five the dress addresses, so torso `s` 0 … 4 and a collar's station mean what they did.
  On the round register the torso and pelvis take ring12 addressed on ring8's scale (`slotT`), so every `t` lands where it
  did, and carry the forms a silhouette is marked by, pushed into their rings: the rectus and the navel's ring, the
  waist's taper, the lats, the scapulae and the spine groove, the clavicle and the jugular notch, the female's deeper waist
  and lower back, the seat's two masses and cleft on the pelvis. Over the rib cage lie the CHEST LAYERS, each its own part
  (`rings`, sampled off the torso so it hugs it): a PECTORAL per side (`pectoralR` / `pectoralL`, the lower border the most
  proud, the pair meeting at the sternum, the armpit end a share of the arm) and over it, on a figure with a bust, a
  BREAST per side (`bustR` / `bustL`, a bone each riding the torso for an engine's spring), sampled from the BREAST FIELD
  (`breast-field.js`: its height over the chest a function of the chest coordinate about the apex, the footprint and the
  poles' profiles as anatomy words, `breastGates` measuring the poles' split, the fold, the upper line, the lower pole,
  the margins, the cleft and the one peak). The field's `cleft` sets the apex off the midline and keeps the medial side
  full to it, so the pair meets there in a cleavage valley; each breast is cut at the midline. The NECK ROOT slopes: the sternal notch under the neck's base at the back, so the
  neck rises out of the chest; the trapezius slopes to the shoulder, and the upper arm's
  top is a deltoid's dome under the shoulder ring (a segment's `cap`: its caps' height, × radius). A bare belly (the swimsuit's, an adult's) carries a navel, about level with the elbow and a little under the narrowest waist. The adult female carries a bust by default
  (`body.bust` from 0.27 of the chest; 0 for none); a child-coded figure never does. The readout's `core` measures the midsection on every hero (waist to hip, where the hip peaks, the seat, the
  front below the waist, a pouch, a step in the outline, the legs) with advice against bands per body; on the structured
  core that advice is a warning. Its legs CONVERGE: the thigh slants in from the hip to the knee (more on the female), the ankle under
  the knee. Its stands own their base: `relaxed`, `hand-on-hip` and `guard` plant both feet where `stance` and `stagger`
  put them, the free side's heel up (the guard about twice the hip spread, bladed with the left leading); a swing word's
  keys stand on a base of their own. A gesture may say `stance`, `stagger`, `heelL` and `heelR` itself. Its HAND is a palm
  and five digits (the anime casts' smaller, the same shape) hanging relaxed toward the thigh, with fifteen finger bones a
  hand under their VRM names; a gesture or clip key may say `wristL` / `wristR` (flex ±70, or `{ flex, deviation ±30,
  twist ±90 }`; + the back of the hand up, toward the thumb, palm down) and `fingersL` / `fingersR` (`relaxed`, `open`,
  `fist`, `point`, `grip`, degrees of curl −25 … 100 over the relaxed hand, or `{ thumb, index, middle, ring, little }`);
  the guard closes the fists, a hand holding gear grips it in every key, the wave opens the hand palm to the front. A
  streamlined hero keeps its mitten and refuses those words. Hip armour hangs
  from the pelvis, and every piece that stands off the thighs stands off it too. `core: 'streamlined'` is the hero
  before it, byte for byte: one `pelvis` bone from the hub to the navel, the thigh lofts carrying the hips, the cast's
  legs, the five-ring torso, a bust only when the body names one (as two mounds). (A rig bone's `align` names two joints
  whose line orients it in place of head → tail; it still sits at its head.)
  ANIME PROPORTIONS: a hero wearing the anime head wears an anime body by default (`proportions: 'anime'`; `'hero'` keeps
  the realistic cast; `'herobot'` is the hero ROBOT's toy-hero body, about 4.4 heads tall — a big head, a short torso,
  short arms and neck, longer shins, big feet and bigger, puffed white cartoon gloves (`Glove`), the neck in the body stocking (`Top`); adult limbs, never
  child-coded): about 6.5 heads tall on the female and 7 on the male (the realistic casts are ~7.6), the inseam
  at about half the height, narrower shoulders, a slender neck, slimmer waist and limbs, smaller hands and feet, the
  overall height kept. A `tune` is a percentage of THAT baseline. The readout says `proportions` and `headsTall`. The
  anime casts wear a NECK FORM: the neck a ring loft that leans forward a little and whose back rises through a nape ring
  into the occiput (no shelf under the skull); the male's column is broader (about 0.75–0.8 of W) over a trapezius ring
  that breaks the shoulder line, the female's keeps her own radius (about 0.4 of W); `body.neck` still sizes both. The
  male base is carried at 3° chin up. The readout's `hero.neck` says the form, `width_m` across the middle of the visible
  neck and `ofW`. The anime head is
  denser than the landmark head (every studio vertex is a pinned offset; `register: 'lowpoly'` is the studio's coarse
  sampling).
  LOOKS (the anime head's presets). `look` is ONE list of words that compose, the conversational surface for a
  character: ARCHETYPES `heroine`, `lead`, `rival`, `princess`, `mentor`, `kid`, `stoic` (each a face, a family and hair
  traits, a pose, and where it needs one a body `tune`: a bigger head, a shorter stature — never palette, cast,
  register or head); face TRAITS `tsurime` (upturned outer corners), `tareme` (drooping), `large-eyes`, `narrow-eyes`,
  `soft`, `sharp`, `youthful`, `mature`, `button-nose`, `strong-chin`; graphic-face TRAITS `heavy-lid`, `brow-block`,
  `sharp-eyes`, `low-nose` (on the sculpt); hair TRAITS `spiky`, `sleek`, `messy`,
  `heavy-bangs`, `short-bangs`, `swept-bangs`, `voluminous`, `peekaboo` (one bang over the eye: a trait may direct
  clumps), the hair bases' cuts `swept-back` and `side-parted`, the sketch cuts `flipped-long` (curtain bangs, the ends
  flipped out), `blunt-bob` (a level split fringe, the left side long), `side-tail` (a low tail over the left shoulder)
  and the `shapes` characters `broku` (carrots only, classic shonen spikes), `jinto` (bananas only, comma hair over a soft two-block),
  `jingo` (bananas only, few, grown from the dome like a cap), `selene` (peels, long and heavy on her right, `veil: 0.9`), `sintia` (peel PETALS to the shoulder blades, their ends flicking out, curtain bangs), `frieda` (split bangs, ribbon sidelocks, the rest GATHERED into twin tails), `frieda-pony` (one high ponytail), `hiraku` (a blunt BOWL BOB cut on LEVEL lines, `hem`, `fringeHem`, `blunt`) and `miwako` (a blunt neck-length bob), `jona` (layered banana
  PEELS: leaf-shaped, thin, cupped; a side-swept swoop) and `kairo` (chili peppers only, a wolf cut), and the heroine `bidel` (bananas only, a short tomboy cut); shaped hair never
  cuts through the body it is worn on; every anime head with hair wears sideburn patches before the ears (`hairSideburnL`,
  `hairSideburnR`: no bare gap between the hair and the ear; a bald head shows its skin there), and the families; POSES `neutral`, `blink`, `smile`, `open`, `happy`, `determined`, `deadpan`, `angry`,
  `worried`, `surprised` (poses are `expression` words too). Left to right: ratios by product, offsets and clump edits by
  sum, a family and a pose last-wins; the own `face` / `sculpt` / `hair` / `expression` / `tune` apply ON TOP (`/hero/hair/length`
  1.1 is ten percent over the look). `look: ['rival', 'tareme']`, then `set /hero/look` to add or peel a word (a list is
  set whole). The row keeps the words and a resolved STAMP (`lookResolved`): a later re-tuning of a word never changes a
  stored hero until its list is edited. The readout says `look`, `lookFrom`, the effective head and tune, and the own
  layer apart. Every preset stays inside the studio's ranges on both bases.
  THE DRESS. `detail` and `adorn` put the dragon's BODY DETAIL and ADORNMENT passes on the hero, the same operators with
  the hero's parameters (`hero-dress.js`). `detail: 'clothed'` is a garment read: elbows and knees refined, the masses a
  jerkin and trousers keep, soft sleeve folds at the elbows, a QUILTED jerkin (front panels either side of a bare placket,
  a back panel, grown only where the torso bone dominates) with a row of toggles, knee patches, cuffs and leg wraps; the
  jerkin covers the pectorals (their layers are dropped under it). `detail: 'swimsuit'` shows the body BARE, to see its
  forms and mark its silhouette: every Top / Bottom / Shoes part is Skin and swimwear is painted on the trunk's own faces
  (the adult male's trunks, the adult female's two-piece with the breasts as its cups — on the structured core a speedo
  with a leg line rounded up the thigh, and a thong with a thin string rising over the hip and a V back narrowing into
  the cleft, lines cut across the faces so the studio light draws them too — a child-coded figure's rash vest and
  trunks), in a `Swim` tone the palette may name. The structured female's seat is fuller and set further back than the male's square, high one, under a lower
  back that curves in; both seats are two masses with a cleft, drawn on bare skin in a second, darker shade, as the
  thong's V in the swimsuit's tones, or as a crease in the speedo. Every piece worn on the torso stands off the chest layers too.
  SECOND SKIN. `paint` puts skintight garments on the body as colour on its own faces (`body-paint.js`; words in
  `hero-dress.js` PAINT_WORDS): no geometry, so a garment fits every cast, tune, core and pose and bends with the skin.
  A word (`tank`, `crop`, `sportsBra`, `tee`, `longSleeve`, `leotard`, `leggings`, `bikeShorts`, `tights`, `catsuit`,
  `socks`, `gloves`), an entry `{ part, u?, run?, t?, only?, group }` or a list of either, worn in order (a later one paints
  over; `Skin` cuts back). `part` is an L1 part, a base name both sides; `u` a window in the part's station parameter
  (torso: 0 hem, 1 navel, 2 chest, 3 shoulder, 4 collar), `run` a share of the part's span (0 its root, 1 its end), `t` a
  share of the ring half (0 front, 1 back); `only` repaints just the bands in those groups. Words wear the figure's Top,
  Bottom and Shoes tones and Glove; best over `detail: 'swimsuit'`, whose forms they keep (a word over the hips clears the
  swimwear beneath). Patch `/hero/paint`.
  OUTFIT. `outfit` puts on garments WITH VOLUME that follow the body's own geometry (`body-garment.js`; words in
  `hero-dress.js` OUTFIT_WORDS: `tee`, `shirt`, `trousers`, `shorts`, `boots`). Each piece copies its body part's rings
  over a window, carried out by its `ease` and lifted over the layers beneath it (the chest's, the garments already on
  that part), and copies the part's binding station by station: every garment vertex skins as the skin vertex under it,
  so sleeves and legs bend at the elbow and the knee with the body, every dial that moves the part moves the garment,
  and a cast, tune or core re-fits it on every read. Worn in order: trousers then a tee is a shirt worn out, a tee then
  trousers a shirt tucked in. A piece of your own: `{ id, part, u?, run?, ease, flare?: [start, end], over?, group }`
  (the part `<id>_<body part>`). Footwear is a piece of its own, `fit: 'shoe'` (the `boots` word's foot): two solids fitted
  to the foot and toes, a ROUND ELLIPSOID over the heel and a FLAT HALF-ELLIPSOID over the forefoot, each the smallest
  holding its share of their points with the ease, their sections superposed ring by ring and cut on one flat sole
  (`toe`: the toe box's height as a share, `heel`: metres over the heel cup). Best over `detail: 'swimsuit'`; paint and
  an outfit combine; under the studio light both shade smoothly as cloth (welded like the skin, a right angle kept
  sharp). Patch `/hero/outfit`.
  OUTFIT BUILD. `outfit: { type: 'outfit', style, dials?, language? }` is a styled look built the way an armour build is
  (`lib/graph/outfit/`): a seeded card (`casual`, `office`, `athlete`, `adventurer`, or an inline card: plain JSON) over
  laws (`principles.js`: silhouette by fit, cloth falling away to its free hems, hems on landmarks, layers nesting by
  ease and by one value step, one focal, the edge the ornament field, honest construction for knit and woven, stylize one
  curve), stamped with the laws version it was minted under. Dials `stylize`, `fit`, `coverage` (lengths step shorter by
  thirds), `ornament` 0–3; language `top { family, sleeve, hem, collar }`, `bottom { family, leg }`, `feet`, `tuck`,
  `focal`. Expanded on every read by its passes: CUT (pieces on landmarks), FIT (ease and hang), LAYER (tucked or worn
  out), CONSTRUCTION (a woven placket), ORNAMENT (from the focal out: collar or rib, buttons, belt; cuffs, hems,
  waistband; seams), TONE (the card's over derived Trim, Placket, Button, Seam, Waistband), LEDGER (the readout's
  `hero.dress.outfit`: lengths, pieces, edges spent, and warnings for what this body could not wear). Skirts and dresses:
  `bottom { kind: 'skirt', leg: micro | mini | knee | midi | maxi, cut: pencil | aline | full }` is one hull round the hips
  and both legs (garment `fit: 'skirt'`): each ring the support of everything at its height, never narrowing below the
  hips, flaring by its cut, two-faced (folded at the hem, so it is open beneath), each point skinned by nearness (the
  cloth over a leg follows that leg, the cloth between and behind the legs the pelvis); `dress: true` makes the skirt the
  top's own cloth. Tops DRAPE from what holds them out (the bust, the shoulder blades) instead of hugging back in under it.
  Seeded on the female cast: `sundress`, `blouse` (a pencil skirt), `athleisure`. Patch
  `/hero/outfit/dials/<dial>`, `/hero/outfit/style`, `/hero/outfit/language/top/sleeve`.
  STATUE. `statue: '<card>'` or `{ type: 'statue', style, material?, crop?, lose?, base?, dials: { wear }? }` carves the
  hero as sculpture (`lib/graph/statue/`), on the landmark head or `head: 'none'` (the anime head and held gear refuse by
  name; an armour build is carved with the figure). Period cards, plain JSON: `archaic` (kouros and kore), `classical`
  (contrapposto, bronze), `hellenistic` (the turning figure), `roman` (the address, tunic and long garment as the toga's
  stand-in), `roman-bust`, `egyptian` (striding, kilt or sheath), `sumerian` (the votive worshipper: the hands clasped at the chest, a flared
  skirt), `renaissance`. `stand: 'seated'` (build or card) sits any card on a block throne built with its base (the
  thighs level, the shins hanging, the hands on the knees; a long skirt cut at the knee; refused with a gesture or on a
  bust); `stand: 'mounted'` sets it astride a horse carved in its material (the horse ring plan, `horsePlan`, under the
  animal kind's statue filter), the right arm in address, both on an oblong block: an equestrian statue. A card's stand (a word, pose words, or `{ male, female }` of them), stillness (idle, walk and
  wave off) and drapery (an outfit card per silhouette) apply when the hero names none, and its hair at mint. Laws
  (`principles.js`): ONE MATERIAL over every group (`marble`, `limestone`, `sandstone`, `granite`, `basalt`, `bronze`,
  `gilt`, `painted`), the eyes blank, the hair a carved mass, the bare body's zones skin; a FORMAT is a cut (`full`;
  `bust`: below the chest, through the upper arms; `herm`: the bust on a tapering shaft; `torso`: no head, no arms, the
  thighs cut), each cut a sealed ring; a LOSS is whole parts (`head`, `handR`, `forearmL`, `armR`, `footL`, `shankR`,
  `legL`, …: the part and what it carries, closed in its own cap; no fracture surface); `painted` is RECONSTRUCTED
  polychromy over the card's stone and always says so; a statue stands on a BASE (`none`, `block`, `attic`, `drum`,
  `socle`, `herm`) of stone (a bronze, gilt or painted figure on limestone), built at read time under the posed figure,
  the figure lifted onto it; `wear` 0–1 dulls stone and ages bronze from its brown patina to verdigris. The faces carry
  the material's surface (`spec` and `pbr`: stone matte, a bronze or gilt figure metallic in its patina's or gilding's
  colour) for the World page and the exports. The
  readout's `hero.statue`: the card, period, material, format, the parts lost, base, wear, `basis` (`unverified`: drawn
  from the general record of the type) and the `caption` derived work carries ("inspired by …"). Patch `/hero/statue`,
  `/hero/statue/material`, `/hero/statue/crop`, `/hero/statue/lose`, `/hero/statue/dials/wear`.
  `adorn: 'ranger'` wears a belt (iron buckle), a baldric across the chest (iron buckle), an archer's bracer on the left
  forearm and ONE pauldron on the right shoulder with a bronze boss (the focal accent), stacked in that order, and suggests
  an earth palette beneath the operator's. Either is also DATA (the plan's `body` / `adorn` blocks below); `'none'` or
  absent adds nothing. Patch `/hero/detail`, `/hero/adorn`. The readout's `hero.dress` says the words, the parts each
  layer baked and the ADORNMENT LEDGER: every adornment's signature must read (exposed ≥ 0.25) and be a real share of its
  picture (≥ 0.08), else `warnings` says make it bolder or ask whether it is wanted; its `legibility` (the height each
  dress family reads from) and its `clearance` (the dress against the body at every dial extreme; the ranger's belt, worn
  over the thighs, is named at `stance` 1.35). `hero.evidence` says what the form rests on: the worn head's fit — the
  views observed (with their fitted yaw) and inferred (the male's front) — whether the face was authored off the fit,
  and that the body is authored from a cast and a tune. The ledger says an adornment is seen,
  not that it is wanted. Tones the detail needs (`TopFold`, `Quilt`, `Cuff`, `Patch`, …) derive from `Top` / `Bottom` /
  `Shoes`; any tone the operator names wins.
  THE STAND. `gesture` is the pose the figure holds, in the rig's own pose words: `relaxed` (weight on the left leg,
  hips and chest counter-turned, the shoulder line dropping to the support side, the head tilted toward the high
  shoulder, chin a little down; the far arm hanging, the near arm curved, its forearm carried forward), `hand-on-hip`
  (the mirror stance, the right hand at the waist) or `guard` (soft knees, bladed, the rear heel up with its knee over
  the foot, the fists up and apart either side of the chin); `rest` for none. Or an object of pose words (the refusal
  lists them; every number is range-checked), or a list composed left to right: `['relaxed', { head: { pitch: -12 } }]`
  is relaxed, chin down (the stand owns the head's pitch;
  the anime face's `headPitch` floors at level). The presets carry values per cast (the rig has no arm IK, so each hand
  and free foot was placed by a search over its channels); `relaxed` clears the body on every cast word, the others were
  placed on the anime male and female. The anime hero stands `relaxed` unless it says otherwise (a default read when the plan
  is generated, never stored, so it follows `/hero/head`; `rest` is the one opt-out); any other hero only when it says
  so. Stored as given; it rides as a one-key clip `gesture` listed FIRST (the rig gates check it at mint and name
  `/hero/gesture` when it cannot be solved; an engine export carries it). The World, the STL / 3MF and the static GLB
  show the solid skinned at it, lit on the posed figure with the head's parts in their own frame (a nodded head keeps
  its shadow shapes); `measure_solid` and the mint stats measure the rest pose. Patch `/hero/gesture`. The readout's
  `hero.gesture` says the word, the support, the hand and forearm against the torso, bust, thighs, neck and head
  (`clearance`, millimetres past their rest overlap) and the free sole against the floor; past 5 mm it advises, as does
  `lean` or `stance` off rest beside a stand (the rig poses the rest joints, so the dial is posed twice).
  THE CLIPS. `clips: { <name>: [keys] | false }` adds the operator's motion to the hero's own (`idle`, `walk`, `wave`;
  the stand first when it stands): each key an object of the rig's pose words — the stand's, every number
  range-checked, plus `head` / `neck` as a direction to aim, `heelL` / `heelR` (degrees, ±90), `lift` (metres, 0 … 1,
  both feet free), `support: 'none'`, and `jaw` (0 … 25°) on a head with a jaw bone (the landmark head, or an include
  with a `jawHinge` joint). Stored as given and merged when the plan is generated: a name the hero has replaces its
  clip in place, a new name follows the hero's own, `false` removes one of them; `gesture` is the stand's
  (`/hero/gesture`, `rest` for none) and refuses here. The keys are values placed on this body, not words resolved per
  cast: a `/hero/cast` or `/hero/tune` edit carries them unchanged. A word the rig does not know refuses naming the
  clip, the key and the word; a key or a blend the rig cannot solve refuses naming the clip and the key or phase. The
  clips ride the rig gates, the World's clip picker and every animated export. Set `/hero/clips` to an object first
  (a path under it needs the field), then `/hero/clips/<name>`; `remove /hero/clips/<name>` drops a door clip, and
  `false` removes one of the hero's own; any other `/hero` edit keeps them. The readout's `hero.clips` (on a hero with
  clips) lists what the figure plays, the door's clips and the removed ones.
  On the ANIME head a clip may be `{ seconds, keys }` and a key may carry `face`; any other head refuses both by name.
  The anime head waves its own way (`ANIME_WAVE`, whatever the proportions): the upper arm out to the side and about 27°
  down, the forearm upright, the hand beside the head, the forearm swinging 35° out and back twice on the elbow's hinge
  (the elbow still), the head tilted toward the hand; every other head keeps the form's.
  DURATIONS: every clip of the anime hero plays a designed duration — the door clip's `seconds` (0.25 … 60), else the
  hero's own clip's (`gesture` 1 s, a hold; `idle` 4 s, one breath; `walk` 1 s, two steps at 120 a minute; `wave` 2 s,
  raised, two strokes out and back, lowered, a third of a second a key), else half a second a key (a second at least)
  — on the World page's clip preview, in the GLB and in the Godot pack alike; any other hero's clips play three
  seconds on the page and one in an export. FACE KEYS: `face` is an expression word, `{ blink, smile, open, brow }`
  or a list, read as `expression` is;
  the rig never reads it (the plan's keys carry none), and the skinned GLB draws it as a STEP track of the face's morph
  targets on a 30-fps grid, keyed half a frame early: each key's face holds until the next key, a key without one holds
  the authored face. THE IN-BETWEENS: an eye that changes between keys passes through the knots strictly between, a
  frame each, right before the next key (closing, the half lid 0.5; opening, the half lid then 0.20), each eye its own,
  cut from the end when the keys are too close; the mouth and brows on those frames are already the next key's. THE
  AMBIENT BLINK: derived on read, seeded per hero and clip, never stored — blinks 2.5 … 5 s apart, a fifth of them
  doubles, each the half lid, shut for one or two frames more, the half lid, 0.20; none across a loop seam, and none
  on or beside a frame whose drawing shuts an eye or changes one (it never fights a closed-eye key; over a half lid the
  eye shuts from it and comes back to it). A clip of 2.5 s or more bakes its blinks in; the face-only clip `face:ambientBlink` (12 s) is the layer an engine plays over the clips
  whose eyes hold the authored face (`mesh.extras.face.ambientOver`), through a filter on the blink targets. `blink:
  false` turns it off (stored only when false; any other head refuses it). The drawings are a frame each at 30 fps:
  play the GLB at 30 fps or more (at 24, Blender's default scene rate, a one-frame drawing can fall between two
  samples). The readout's `hero.clips` adds `seconds` (every clip played) and `face` (the door clips carrying one).
  THE GEAR. `gear: { right?, left?, back?, hip? }`, each slot an item's build words, the same an equipment item takes
  (`{ item, style?, dials?, parts?, gem?, seed? }`, the equipment card): `gear: { right: { item: 'sword', style: 'dwarven' },
  left: { item: 'shield', style: 'dwarven' } }`. Stored with the laws stamped; patch `/hero/gear/right/dials/stylize`.
  Each item is placed by its sockets at true size (scaled with the figure's height) and held by its class: a blade
  through the fist, its tip forward and down (a raised forearm carries it upright: the hand has no roll, so the rest
  hold is the one the arm's swing reads best from); a staff or a bow near upright, its lower end just above the floor; a
  shield along the forearm, its face outward; `back` across the shoulder blades (a blade hilt-up over the right
  shoulder); `hip` at the left hip. The gear is rigid on its bone, so the stand, the clips, the preview and the skinned
  GLB carry it. An anime hero's gear takes `stylize: 0.7` unless its build says. The readout's `hero.gear` names each
  slot's item, hold, bone, length (m) and share of the figure's height.
  THE SWING. A swing word as the gesture: `chop`, `thrust`, `rising` (a low-to-high diagonal), `cleave` (two hands),
  `plant` (a staff driven down) swing the `right` hand's gear; `bash` the `left` (a shield). The hero stands in the
  swing's ready pose and the swing plays as its own looping clip (the World's clip picker, the skinned and engine
  exports). The body drives it: the shoulders and spine coil at the cock and uncoil through the strike, the trunk hinges
  over and the knees sink, both feet planted. The item sets the timing (law 8): a dagger strikes early from a small
  cock, a greatsword (or a `mass` ≥ 1.2, or an item past three quarters of the figure) strikes late from a held, higher
  cock. The readout's `hero.gear.<hand>.swing` gives the impact's phase, the contact `window`, `reachM` and `cone` for
  a game's hit test. No bow draw yet: the hand has no wrist, so a bow raised to draw would point at the archer.
  THE BUDGET. `hero.budget`, on every hero's readout: triangles and vertices per palette group, the plan and recipe in
  bytes.
- **Armour (an armour build on `adorn`).** `adorn: { type: 'armor', style, dials?, language? }` names a suit by intent and
  direction; the laws in `control/lib/graph/armor/` compose it on every read. The hero stores the words, stamped
  `laws: 1`. Restyle in place with `set /hero/adorn/dials/coverage 0.8`, `set /hero/adorn/style 'aka'` or
  `set /hero/adorn/language/crest 'sun'`.
  - `style`: `knight` (plate), or the samurai lamellar `kuro-kon` (black lacquer, navy lacing, a gold crescent), `aka`
    (red lacquer, gold horns) or `shiro` (white lacing, a sun disc); or the hard-suits `grim-scifi` (massive power
    armour, glowing lenses, a power pack), `fantasy-space` (minimal trooper plates, a T-visor helmet) or `armored-hero`
    (a segmented suit, a faceplate helm, a glowing chest reactor). Or an inline card
    `{ family: 'plate' | 'lamellar' | 'hardsuit', dials, language, tones, emissive? }`: a new direction is a new card,
    not code. A card's `emissive` groups render full-bright.
  - `dials`:
    - `stylize` 0 → 1 grows the focal piece fastest, stands plates further off the body, flares openings, and makes
      lames, rows and lacing fewer and bigger.
    - `coverage` 0 → 1 grows the suit out from its focal piece. Plate starts from one pauldron, then the breastplate,
      the bow-arm vambrace and the gorget; the partner pauldron arrives at 0.5 as a lesser piece; then greaves, cops,
      the fauld and tassets, cuisses, gauntlets and sabatons. Lamellar starts from the crested kabuto, then the dō, the
      sode, the kusazuri, the kote and the suneate.
    - `mass` sets heft.
    - `ornament` 0–3 is the edge budget, spent on the focal piece first.
  - `language`:
    - plate: `pauldron` (`spaulder` | `bell`), `focalSide`, `fnSide` (the arm that carries function takes the first
      bracer);
    - lamellar: `crest` (`crescent` | `kuwagata` | `sun`);
    - hardsuit: `helm` (`power` | `trooper` | `faceplate`), `pauldron` (`dome` | `cap` | `segmented`), `chest`
      (`plain` | `reactor`), `pack` (`power` | `none`), `segments` 1–3 (the panel lines), `focal`
      (`helm` | `pauldron` | `reactor`).
  - `theme` (plate suits): `death-knight`, `radiant`, or an inline card from `control/lib/graph/themes/`. A theme is a
    motif vocabulary carried down the suit, not a skin:
    - the primary motif (a skull, a sun boss) sits full size at the focal piece, then smaller at the partner, chest,
      belt and knees, as far as `ornament` reaches;
    - the secondary motif is the field's one line (ribs);
    - the edge verbs run the edges they name (a painted rim on every plate, fur at the cuffs);
    - the crest verb stands only on the crest line (spikes or wings on the pauldron tops, a crown on the helm);
    - glyphs mark the plain fields (runes).
    A theme may add a helm, a tabard and a belt. It leans the dials and language between the style's and the
    build's own, and its tones layer over the style's. Patch `set /hero/adorn/theme 'radiant'`.
  - The laws, as worn:
    - one focal piece per suit, every piece sized to its body part;
    - a plate never crosses a joint (each rides one bone, and cops cap a joint from one side);
    - plate stays off where two body parts touch at rest;
    - layers one clear value step apart;
    - the edge is the ornament field;
    - lamellar rows are a sawtooth held by lacing.
  - The card's tones sit beneath the operator's palette. A kabuto covers the head, so set `hair: 'none'` (the readout
    warns otherwise). `hero.dress.armor` reads out the style, the resolved dials, the pieces worn and the focal.
  - Adornment signatures this uses, open to any kit:
    - `facing` `{ dir, r, h }`: a disc on the piece's lifted outer skin, facing the eye;
    - `boards` `{ n, len, thick, tilt, stand?, dm?, bow?, widen?, wide?, bottom, cords?, cordR?, cordGroup? }`: flat
      laced rows hung from a piece's edge, with the cords in their own group;
    - `crest` `{ shape, w, z, r }`;
    - `helm` `{ pad, n?, flare?, muzzle?, crown?, visor?, visorGroup?, faceplate?, grille?, brow?, coronet?, parts?,
      window?, ears?, gem?, scale?, horns?, ponytail? }`: a smooth helmet sized to the head (`parts`, default cranium + jaw; `['face', 'earR',
      'earL']` on the anime head; `scale` grows it about its centre, its window and trim with it). `window` opens the face: `{ brow, w, bottom, nape?, rim?: { group }, jaw?: { drop,
      curl, wrap } (cheek guards curled under the jaw), back?: { tuck } (the back rounded to the nape), hug? (the lower helm's sides and back rounded in
      like an egg toward the face, a share of the half-width), v?: { apex,
      curve?, raise?, group, stripes?: { w?, t?, span?, group? } } (the window's top edge as a raised V from its top corners
      down to the bridge of the nose, its lines carried over the crown to the nape as embossed stripes; `frame` `{ cheek?:
      [tip, top], peak?: [rise, d], gem?: { corner: [rise, d], top, bottom } }` grows it into the visor's whole frame: wide
      cheek bands tapering to the jaw, a brow band, and two horns rising to points beside a diamond `gem` set in its notch) }`; `ears` `{ r?, h?, group, cap?: { group } }` domes at the
      ears; `horns` `{ u, a, len, r, out?, up?, back?, bend?, squash?, group }` a pair of tapering blades off the temples;
      `ponytail` `{ u, len, r, n?, spread?, back?, wild?, flick?, group, tie?: { group } }` wild flattened clumps out of the
      helm's back, scattered by a fixed pattern; `gem` `{ r?, group, shape?: 'diamond', tall?, wide?, fit?: 'v', top?, setting?: { group, w? } }` a jewel on the brow
      (`diamond` a faceted rhombus stone on a rhombus border plate `w` wider; `fit: 'v'` runs its lower edges parallel to
      the V's lines and keeps `top` (in r) above where they turn: a kite in the V);
    - `volume` `{ shape: 'football' | 'cone' | 'bell' | 'slab' | 'bead' | 'plate', girth, peak?, mouth?, taper?, n?, squash?,
      bias?, extend?, at?, point?, bore?: { group }, lip?: { group, at, w?, out? }, half?: { cut } }` (`half` a flat face `cut` radii
      below the axis, level along its length: a half-egg foot's sole; a `bead`'s `peak` points to the window's end, or its
      start with `point: 'start'`: a knee pad pointing up the thigh); `plate` `{ at, profile: [[along, radius]…], span?, facets?, thick? }` an angular plate arched over the carrier's
      outer side in flat facets: a pauldron over a ball: a free solid round a WRAPPED shell's
      carrier, sized from the carrier's own axis and radius (`girth` × it) and riding its bone — figure-fluff's girth
      contrast on the rig (a ball pauldron, a barrel chest plate, briefs, a football forearm, a flared boot cone, a
      block sole, a thigh rim, a knee pad); its carrying shell only sizes it and is worn as a slender core buried on the carrier's axis;
    - `pack` `{ w, h, d, vents? }`;
    - `plaque` `{ s, w, c?, lift?, thick?, bevel?, part? }`: a thick trapezoid plate on the carrier between stations `s`
      [bottom, top], centred on the front (or at ring offset `c`, negative on the L side: a pec plate), its half-width in ring units `w` [bottom, top], lifted `lift` off what lies
      beneath, its face narrowed to `bevel` (an embossed ab plate under a chest plate);
    - the theme motifs `skull` `{ r, horns?, socketGroup? }`, `spikes` `{ count, len, r, rise?, profile? }`, `ribs`
      `{ count, r }`, `fur` `{ r, tufts? }`, `tabard` `{ len, thick }` (on a strap) and `runes` `{ count, h, w }`.
    An adornment with `stack: false` is never lifted under the ones worn after it. A shell's `rim: { group, at?, w? }`
    paints a band along its own edges.
- **Body detail and adornment as plan data** (any plan, not only a hero: `docs/examples/ring-plans/flask.plan.json` is a
  wicker-wrapped flask — woven tiles, a lip ring, a band with a buckle — from 1.2 KB of plan). A plan may carry `body: { refine, volume, creases, tiles, pads, spurs, rows,
  collars, rigid? }` (`station-loft-body.js`, the head's detail principles one scale over: named density with parameters
  frozen first, `volumize` masses, bend CREASES either side of a joint rising with the bend read from the mesh above a
  `floor`, TILES grown only where one bone dominates the whole footprint (≥ `rigid`, 0.8) and seeded per tile id (two
  windows on one part each name an `id`), PADS on the side a joint flexes toward, a world direction or away from a bend,
  SPURS on the outside of a bend, ROWS on the midline (`shape: 'spur' | 'stud'`), COLLARS round a station) and `adorn: [{ id,
  mode: 'shell' | 'band' | 'strap', part, over?, side?, s, t: 'wrap' | [t0, t1] | path, mugen, thick, rad?, support?,
  ramp?, width?, rigid?, pin?: [s, t, side, part?], signature: { kind, group, … } }]` (`station-loft-adorn.js`: a point
  of an adornment is an address lifted by the smoothed hull of EVERYTHING beneath it plus its mugen, so adornments stack;
  signatures from the library `boss`, `spike`, `buckle`, `ring`, `medallion`, `plume`, `bell`, `studs`). `expandPlan`
  bakes both as pinned parts on the refined rest carrier (detail L2, adornment L3): they ride the dials and inherit their
  pin face's skin weights, and refinement extends the parts' bind blends so skinning is unchanged. An adornment and its
  signature share one pin, so a rigid adornment rides one bone (`pin` may name another carrier: a pauldron shaped over the
  deltoid rides the torso and the arm moves beneath it). Absent, zero bytes. Refusals name the pass and the part.
- **Exposure (advisory).** `measure_solid` on a layered sketch carries an exposure ledger: for every pinned
  part, how much of it is seen from six named views (frontal, three-quarter, three-quarter-left, lateral, left,
  back) through a z-buffer, flagged `reads` / `faint` / `buried`; a buried detail (a claw that never leaves its
  toe) is named in `warnings`, never refused. `exposure: false` skips it (and the two ledgers below).
- **Legibility (advisory).** Beside exposure, `legibility`: the CHARACTER HEIGHT (64 / 128 / 256 / 512 / 1024 px, the
  figure's height on screen) from which each detail FAMILY reads — at least half its parts own ≥ 4 px² and ≥ 1 px of
  thickness at their best view — and `shimmers`, the families that do not read at 256 px. "Protect the read at 128, 256
  and 512" as a number: a game-sized hero's pupils and mouth only shimmer; a face word (`eyeSize`) moves them.
- **Clearance (advisory).** When a recipe has worn parts (layer 3), `clearance`: the share of each adornment's points
  inside the body at rest and at every dial's min and max, the worst configuration and the parts it sinks into, named
  in `warnings`. Closure is per part; this is what it cannot see. `assembly` says what a layered solid is: closed parts
  joined by overlap and pins, not one welded solid.
- **Follow pins.** A pinned part with `follow: true` (on a layer-1 parent) moves with the dials as the surface under
  its pin moves — scaled and offset at its pin's own station weight, turned by a hinge that turns its parent — instead
  of riding the dialed pin frame rigidly, which translates but never scales. The `body` / `adorn` bake sets it, so a
  `bulk` that widens the chest widens the baldric with it. At rest the placement is the same; absent, zero bytes.
- **Compare (matched azimuth).** `scripts/export-wire-svg.mjs --ref <ref> --compare frontal=ref.png,lateral=side.png`
  draws the solid's silhouette at the reference's named azimuth and reports `iou`, `aspect` and the centroid
  offset per view (shape only, both normalised to their boxes), plus a sheet (reference | silhouette | overlap).
  The reference picture is never persisted; the numbers are the record.
- **Drawing on it (strokes).** For someone who thinks in lines, not station tables. A layered manifest may carry
  `strokes`: `{ id, view, intent, points: [[x, y, pressure], …], mirror?, closed? }` — `view` a named azimuth
  (`frontal`, `three-quarter`, `three-quarter-left`, `lateral`, `left`, `back`) or `{ azimuth, elevation }`, points
  normalized image coordinates in the wire's pinhole square, `intent` one of `silhouette` (a closed outline),
  `contour` (a line on the skin), `brush` (push the skin), `fold`, `landmark`. Store one with
  `update_sketch { patch: [{ op: 'set', path: '/strokes/-', value: stroke }] }` — the camera it was drawn against is
  recorded on it, so it keeps its meaning after the form changes — then `{ op: 'solve', from: '/strokes/<id>' }`
  (solve ops come last in a patch, and each takes only the keys its intent reads):
  a **silhouette** solves the continuous shape dials (`scale` / `offset` / `stretch`; `dials: [...]` narrows,
  `budget` caps the compiles) to match the outline of the WHOLE solid in that view — a drawing under a quarter of the
  solid's silhouette area, or overlapping under half its height (its width, when wider), is refused (a jaw, the head,
  the chest up; coarse checks, so trace the whole body); a local change is a contour or a brush — and leaves `solved`
  on the stroke with `iou`, the
  **residual** (the pixels the dials could not reach as a share of the drawn area, above 1 when the solid spills past
  the drawing, and its box), the dials that stopped on a bound — the grammar's edge, where it was drawn — and
  `dialsBefore`, the moved dials' earlier values; a **contour**
  grows a closed ridge strip along its resolved `(part, s, t)` addresses (`height`, `width`, `group`; `mirror: true`
  on the stroke adds the twin), pinned `follow` so it rides every dial, in the carrier's own tint, judged by exposure
  from its view; a **brush** becomes a `brush` dial (`amp`,
  `radius`, `direction`), a skin map at 1 that replays under any dial and turns down by name (`/dials/stroke.<id>`).
  Every op a stroke makes carries `from: <id>`, so a re-solve replaces exactly it; the stroke is the authoring record.
  A `/hero` or `/plan` edit regenerates the recipe and carries the strips and brush dials over where their carrier
  still is; what no longer lands is dropped by name in `stats.warnings` (re-solve it).
  `measure_solid` reads `strokes` back (`now.reached`, the residual box, hints); `export-wire-svg.mjs --stroke <id>`
  draws the stroke over the wire with the residual band; `channels: { strokes: true }` puts a drawing bar on the
  World page (`/api/sketches/<ref>/world?draw=<view>`) that hands the patch to the agent — the page writes nothing.
  Absent, zero bytes.

Worked plans: `docs/examples/ring-plans/` (a bare quadruped; the HORSE, a light riding horse at 1.6 m, core as
`polygonizer/horse-form.js` `horsePlan({ scale, palette })`; the SPHINX, a recumbent lion wearing the landmark head in
a nemes, `polygonizer/sphinx-form.js` `sphinxPlan({ preset, scale, palette })`, and Karnak's ram-headed
`criosphinxPlan()`; the BULL, `polygonizer/bull-form.js` `bullPlan({ scale, palette })`; a plan that is not a hero takes `statue`
(true or `{ type: 'statue', material, base, dials }`: carved in one material on an oblong base); the hero form, a human on the vajra rest skeleton with a `style` register) and the rigged dragon body's `seed-recipe.mjs` (it exports `plan`); the
`creature-from-plan` catalyst carries the spec forms a worker fills; the `create-hero` catalyst is the human loop on the hero form
(`docs/examples/ring-plans/hero.plan.mjs`, a cast word → the vajra rest joints, a `style` register, the `docs/examples/hero-head/` head worn as an include). Worked recipes: `docs/examples/dragon-layered/` (the dragon head: cranium and jaw as station lofts;
horns, eyes, teeth and crest spikes pinned; seven dials; six casts), `docs/examples/dragon-body/` (the
rigged body wearing the dragon head plan from `docs/examples/head-detail/` by name, through `heads`). Its `seed-recipe.mjs` is the
authoring record: the species rules live there, not in core. `scripts/export-wire-svg.mjs --ref`
draws any cast as a hidden-line wire SVG.
