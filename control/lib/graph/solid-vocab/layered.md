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
the grid), grid?, toon?, hullShade? }`. The stored manifest is the recipe plus dial values; the World, `measure_solid`
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
export as real geometry — the skinned figure's inverted hull rides the rig in-engine. All opt-in;
absent, every byte is identical.

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
  'chain', joints, r, over?, bind: { root } } | { name, kind: 'loft', stations: [{ at, r, e? }], caps?, mirror, bind } (explicit stations
  along a polyline, each ring ⟂ its local direction: a thigh from the hip crest) ], details: [{ name, kind: 'claw', base, dir, length, radius, pin,
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
  face?, hair?, expression?, detail?, adorn?, body?, girth?, headScale?, scale?, palette?, head?, title? } })` mints the HERO FORM (`control/lib/graph/polygonizer/hero-form.js`:
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
  `hip`, `hipDepth`, `thigh`, `calf`, `arm`, `forearm`, `neck`, `bust`); `head` wears a baked include (the blank trunk otherwise).
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
  THE DRESS. `detail` and `adorn` put the dragon's BODY DETAIL and ADORNMENT passes on the hero, the same operators with
  the hero's parameters (`hero-dress.js`). `detail: 'clothed'` is a garment read: elbows and knees refined, the masses a
  jerkin and trousers keep, soft sleeve folds at the elbows, a QUILTED jerkin (front panels either side of a bare placket,
  a back panel, grown only where the torso bone dominates) with a row of toggles, knee patches, cuffs and leg wraps.
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
- **Armour (an armour build on `adorn`).** `adorn: { type: 'armor', style, dials?, language? }` names a suit by intent and
  direction; the laws in `control/lib/graph/armor/` compose it on every read. The hero stores the words, stamped
  `laws: 1`. Restyle in place with `set /hero/adorn/dials/coverage 0.8`, `set /hero/adorn/style 'aka'` or
  `set /hero/adorn/language/crest 'sun'`.
  - `style`: `knight` (plate), or the samurai lamellar `kuro-kon` (black lacquer, navy lacing, a gold crescent), `aka`
    (red lacquer, gold horns) or `shiro` (white lacing, a sun disc). Or an inline card
    `{ family: 'plate' | 'lamellar', dials, language, tones }`: a new direction is a new card, not code.
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
    - lamellar: `crest` (`crescent` | `kuwagata` | `sun`).
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
    - `crest` `{ shape, w, z, r }`.
    An adornment with `stack: false` is never lifted under the ones worn after it.
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
  recorded on it, so it keeps its meaning after the form changes — then `{ op: 'solve', from: '/strokes/<id>' }`:
  a **silhouette** solves the continuous shape dials (`scale` / `offset` / `stretch`; `dials: [...]` narrows,
  `budget` caps the compiles) to match the outline in that camera and leaves `solved` on the stroke with `iou`,
  the **residual** (the share of the drawn area the dials could not reach, its box) and the dials that stopped on a
  bound — the grammar's edge, where it was drawn; a **contour** grows a closed ridge strip along its resolved
  `(part, s, t)` addresses (`height`, `width`, `group`; `mirror` adds the twin), pinned `follow` so it rides every
  dial, in the carrier's own tint, judged by exposure from its view; a **brush** becomes a `brush` dial (`amp`,
  `radius`, `direction`), a skin map at 1 that replays under any dial and turns down by name (`/dials/stroke.<id>`).
  Every op a stroke makes carries `from: <id>`, so a re-solve replaces exactly it; the stroke is the authoring record.
  `measure_solid` reads `strokes` back (`now.reached`, the residual box, hints); `export-wire-svg.mjs --stroke <id>`
  draws the stroke over the wire with the residual band; `channels: { strokes: true }` puts a drawing bar on the
  World page (`?draw=<view>`) that hands the patch to the agent — the page writes nothing. Absent, zero bytes.

Worked plans: `docs/examples/ring-plans/` (a bare quadruped; the hero form, a human on the vajra rest skeleton with a `style` register) and the rigged dragon body's `seed-recipe.mjs` (it exports `plan`); the
`creature-from-plan` catalyst carries the spec forms a worker fills; the `create-hero` catalyst is the human loop on the hero form
(`docs/examples/ring-plans/hero.plan.mjs`, a cast word → the vajra rest joints, a `style` register, the `docs/examples/hero-head/` head worn as an include). Worked recipes: `docs/examples/dragon-layered/` (the dragon head: cranium and jaw as station lofts;
horns, eyes, teeth and crest spikes pinned; seven dials; six casts), `docs/examples/dragon-body/` (the
rigged body wearing the dragon head plan from `docs/examples/head-detail/` by name, through `heads`). Its `seed-recipe.mjs` is the
authoring record: the species rules live there, not in core. `scripts/export-wire-svg.mjs --ref`
draws any cast as a hidden-line wire SVG.
