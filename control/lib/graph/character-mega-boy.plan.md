# character-mega-boy

A humanoid character family built from **stacked cylinders** in the
"action-figure" / `Mega Man` register: readable, idealized proportion — a domed helmet,
a tapered torso, pure-cylinder biceps, thick thighs — without the muscle anatomy of the
protoform.

## Visual language: armour = superpositioned colour-shapes (decided 2026-07-01)

mega-boy's character design is NOT sculpted-in detail. Armour is a layer of **separate 3D
shapes in different colours, each sitting slightly PROUD of the body** so it overlaps and
occludes the capsule beneath — colour separation + overlap is what reads as "a plate."
This is the whole variety engine: one re-girthed figure-vajra body + a swappable
**armour piece-set** → a large roster of distinct silhouettes from a single model.

The character-creator spec:

```
character = {
  body:  { color, radii? },              // re-girthed figure-vajra (MEGABOY_RADII base)
  armor: [ { type, on?, color, r? } ],   // each piece = a proud colour-shape
}
```

Piece vocabulary (anchored to armature nodes/bones, each its own colour):
`helmet · crest · visor · pauldron · chestPlate · abPlate · belt · bracer · boot · kneepad`.
Each is a shape kernel (`sphere` / `tube`) offset proud of its anchor; the global depth
sort makes the overlap read. Adding a character = data (a piece list), not geometry.
Prototype + roster: `polygonizer/figure-megaboy-armor.spike.gen.test.js`.

Tuning open from the first roster: chestPlate/abPlate too small to read (enlarge, and give
the planar torso real front depth so plates have something to stand on); confirm front vs
back orientation for 3⁄4 shots; grow the vocabulary (backpack/thruster, shoulder spikes,
skirt/tassets, collar, shin-fins) since each new `type` multiplies the roster.

## Chosen substrate: a re-girthed figure-vajra (decided 2026-06-29)

mega-boy IS a [figure-vajra](../../../docs/figure-vajra.md) — the wave-form primitive —
with a mega-boy **`radii` override** (`MEGABOY_RADII`), the re-girth hook the module
documents (figure-vajra.js ~L98). `figureVajraSpecs(positions, radii)` → `sampleVajra`
gives the native vajra world-space look (ball-in-socket joints, lightbulb-prong capsules)
for free; mega-boy just thickens biceps/thighs, broadens shoulders, enlarges the helmet
head, lengthens the forearm, and adds ear-pods + a skin face. This SUPERSEDES both the
standalone workbench builder and the protoform warp below — they remain as the look-target
and an alternate study. Starting point: `polygonizer/figure-megaboy-vajra.spike.gen.test.js`.

Open levers from here: the figure-vajra torso is still **planar** (no chest/belly depth,
per the doc) — mega-boy wants torso width + AP depth; the helmet currently swallows the
face — needs a brow gap / smaller dome-vs-face ratio.

## (alt study) WARP the protoform (decided 2026-06-29)

mega-boy is **not** authored as a standalone armature-primitive builder. That path
(`character-mega-boy.js` + the workbench seam, like [character-lpgo.js](character-lpgo.js))
proved the target *look* and the proportions — keep it as the **reference target** — but
it duplicates a figure source of truth.

The production path is a **warp of the protoform**. `buildProtoform`
([polygonizer/figure-proto.js](polygonizer/figure-proto.js)) already emits the body as
tagged ring-stacks `[{ id, rings:[{center, polyline}] }]`, and already ends with a warp —
`stockiness` scales each ring's girth about its centerline (figure-proto.js ~L777). The
mega-boy warp is the same shape of transform, one notch further: a pure
`stacks → stacks` pass that **regularizes** each region's rings toward its primitive —

- circularize every ring (anatomical cross-section → clean circle in the ring plane),
- **bicep** (`upperArmL/R`) → **pure cylinder** — one constant radius up the whole bone
  (the user is happy with un-bulged biceps; no profile),
- **forearm** (`forearmL/R`) → tapered cylinder, **lengthened a bit** (extend the stack
  along elbow→wrist; carry the hand out with it),
- **thigh/leg** (`legL/R`) → tapered cylinder (split at the knee later),
- **helmet** (`headEgg`) → dome of revolution,
- **torso** (`trunk` + pec/core/scapula details) → tapered barrel.

It injects exactly where stockiness does — between `buildProtoform` and the mesher
`litFaces` (figure-render.js ~L154/L225) — so mega-boy inherits the protoform's rig,
garments, balance, and (later) articulation **for free**. One figure; mega-boy is a
render-time stylization, not a second body.

**Articulation is deferred** — neutral stand only for now.

## Reference target (standalone builder)

Below is the standalone builder's design — the look we are warping the protoform *toward*.
It is the spec for what the warp must reproduce, not the production code path.

A humanoid built from **stacked, profiled cylinders** anchored to the
vajra armature and rendered through the workbench seam (`kind:'workbench'`).
Sibling of [character-lpgo.js](character-lpgo.js).

## Why it's its own family (vs. LPGO and protoform)

The figure substrate already has two poles:

- **LPGO** ([character-lpgo.js](character-lpgo.js)) — a minifig: noodle **capsules**
  shoulder→wrist and hip→ankle (straight, constant-radius), a **box** torso, a cylinder
  head. Maximally abstract. Flesh *is* workbench primitives, so the body rides the same
  world seam as the workbench/assembler and re-poses for free off the armature.
- **protoform** ([polygonizer/figure-proto.js](polygonizer/figure-proto.js)) — the
  anatomical human: vajra ring-stacks with eased lobes (bicep/tricep, quad/ham/calf,
  breast, glute), built on a per-region multiplier `proto` and lit through the figure's
  own SVG path. Maximally literal.

**mega-boy sits between them, on the LPGO side of the seam.** It keeps everything that
makes LPGO cheap — armature-anchored primitives, workbench rendering, free re-pose — and
changes exactly **one thing**: limb and torso segments are **lathes with a radius
profile** instead of constant-radius capsules. A bicep is a cylinder that bulges; a
torso is a cylinder that tapers; a thigh swells then pinches at the knee. That single
substitution (constant radius → `profile:[{t,radius}]`, which `cyl()` already supports)
buys the entire humanoid read, with no new geometry kernel.

The family invariant: **every piece is a profiled solid of revolution (or a short bead)
on a bone or joint of the armature.** No welded skin, no muscle eases, no second SVG
path. If a form can't be a stacked cylinder + a bead, it doesn't belong in mega-boy — it
belongs in protoform.

## Model

The family is a **proportion record** over the armature — like `proto`, but its knobs
are segment radii and the helmet, not anatomical lobes. `1.0` is the canonical mega-boy.

```
megaBoy = {
  scale,                    // armatureNodes scale (LPGO uses 40)
  colors: { skin, suit, trim, helmet, visor, joint, boot },

  // ── HELMET — the signature. Built on the head bone (headBase→headTop). ──
  helmet: {
    dome,        // crown radius over the cranium (1 = snug skull cap)
    drop,        // how far down the back/sides the shell comes (ear line → jaw)
    brow,        // forehead visor ridge — depth it juts forward over the face gap
    earPods,     // temple discs: radius (the Mega Man side-cans); 0 = none
    crest,       // dorsal fin/center ridge height; 0 = smooth dome
    faceGap,     // frontal opening angle left for the skin face (so the head reads human)
  },

  // ── TORSO — inverted trapezoid (chest wide, waist pinched). ──
  torso: {
    chest,       // top radius at the shoulder yoke (neckHub end)
    waist,       // bottom radius at the belt (pelvisHub end)
    depth,       // front-back flatten (1 = round; <1 = slab chest plate)
    chestPlate,  // raised pec/abdomen relief on the front face; 0 = smooth
  },
  pelvis: { width, drop },  // the hip block beneath pelvisHub (briefs/belt mass)

  // ── ARMS — two stacked profiled cylinders + a joint bead. ──
  shoulderBead,             // deltoid cap radius at the shoulder node (seals the pit)
  bicep:   { rootR, midR, elbowR, bulge },   // shoulder→elbow, mid swell = bulge
  elbowBead,                // small bead at the elbow node (hinge cover)
  forearm: { elbowR, wristR },               // elbow→wrist, gentle taper to wrist
  hand:    { kind:'mitt'|'cannon', radius }, // bead, or the Mega-Buster barrel

  // ── LEGS — two stacked profiled cylinders + boot. ──
  thigh:   { hipR, midR, kneeR, bulge },     // hip→knee, mid swell
  kneeBead,
  shin:    { kneeR, ankleR },                // knee→ankle, taper to ankle
  boot:    { rise, toe, width },             // the foot block (LPGO has a plain ankle box)
}
```

Defaults reproduce the canonical proportions below; every field is a multiplier so a
heavier/lighter build, a bigger helmet, or a child variant is one record edit — never a
geometry edit (same discipline as `proto`/`PROTO_DEFAULT`).

## The four focus proportions (this pass)

The build target for now is **helmet, torso, bicep, thigh** — the silhouette-defining
masses. Hands, boots, face, and props are stubs (reuse LPGO's bead/box) until these read.

### 1. Helmet — built on the head bone, four parts

`headBase → headTop` is the bone (from `armatureNodes`). The helmet is:

1. **dome** — a lathe over the cranium, radius `helmet.dome`, swept top-of-skull down to
   the ear line (`helmet.drop`). Slightly ovoid (taller than wide) for the heroic read.
2. **brow visor** — a short forward-jutting ridge (extrude or a flattened lathe segment)
   across the forehead, depth `helmet.brow`. This is what frames the face and reads as
   "helmet" rather than "bald head."
3. **ear-pods** — two short cylinders (lathes) at the temple nodes, axis lateral, radius
   `helmet.earPods`. The single most recognizable Mega Man / Astro Boy cue.
4. **crest** — optional center ridge (thin extrude along the sagittal line).

The **face gap** (`helmet.faceGap`) leaves a frontal arc open; the skin face is a short
skin-tint cylinder/bead on the front of the head bone (as LPGO does the head, but smaller
and seated inside the shell). Head reads human; everything around it is armor.

### 2. Torso — inverted trapezoid, not a box

LPGO uses one `boxBetween(pelvisHub, neckHub, …)`. mega-boy replaces it with a **profiled
lathe** `pelvisHub → neckHub`:

```
profile: [{ t:0 (belt),  radius: torso.waist },
          { t:0.55,      radius: lerp(waist,chest, .7) },   // ribcage swell
          { t:1 (yoke),  radius: torso.chest }]
```

`chest > waist` gives the V-taper (the action-figure silhouette). `torso.depth < 1`
flattens it front-to-back into a **chest plate** rather than a barrel (apply by scaling
the lathe's y-extent, or by an elliptical profile). `chestPlate` adds a raised front
relief (pecs + abdominal split) using the workbench `relief` monomer — optional, off by
default this pass.

A short **shoulder yoke** lathe across `shoulderL → neckHub → shoulderR` (LPGO has none)
broadens the top and seats the deltoid beads — this is what makes the figure read
*broad-shouldered* rather than tubular.

### 3. Bicep — a profiled cylinder, the LPGO→mega-boy proof

LPGO arm: `capsule(shoulderL, wristL, 1.7)` — one straight tube, shoulder to wrist.
mega-boy arm: **split at the elbow into two profiled cylinders.**

```
shoulderBead   = cyl bead at shoulderL                      // deltoid cap
bicep          = cyl(shoulderL, elbowL,
                     profile:[{0, rootR}, {bulge_t, midR}, {1, elbowR}])
elbowBead      = small bead at elbowL
forearm        = cyl(elbowL, wristL, profile:[{0, elbowR}, {1, wristR}])
```

`bicep.bulge` raises `midR` above the endpoints → the upper-arm swell. `bulge_t` ≈ 0.42
(belly sits proximal). The bead at the shoulder seals the armpit gap that a bare tube
leaves; the elbow bead covers the hinge. This is the canonical limb recipe — the leg is
the same shape one girdle down.

### 4. Thigh — same recipe, heavier

```
thigh = cyl(hipL, kneeL, profile:[{0, hipR}, {0.4, midR}, {1, kneeR}])
kneeBead = bead at kneeL
shin  = cyl(kneeL, ankleL, profile:[{0, kneeR}, {1, ankleR}])
```

`thigh.midR > hipR,kneeR` for the quad swell; the thigh is visibly thicker than the
bicep (`hipR ≈ 1.4 × bicep.rootR`) and the swell more pronounced — that ratio is most of
what separates the upper and lower body read. `shin` tapers to a slim ankle that the
boot then re-widens.

## Canonical proportions (first numbers, in armature/scale units)

Heroic 7½-heads-tall, broad-shouldered, slim-waisted. Tune against renders.

| part            | value                                  | note                         |
|-----------------|----------------------------------------|------------------------------|
| helmet.dome     | 5.0                                    | wider than LPGO head (4.6)   |
| helmet.earPods  | 1.4                                    | temple discs                 |
| helmet.brow     | 1.2 forward                            | visor jut                    |
| torso.chest     | shoulderSpan/2 + 1.0                    | meets the yoke               |
| torso.waist     | 0.62 × chest                           | the V                        |
| torso.depth     | 0.78                                   | chest-plate flatten          |
| bicep.rootR     | 1.8                                    | ~LPGO arm (1.7)              |
| bicep.midR      | 2.2 (bulge)                            | upper-arm swell              |
| bicep.elbowR    | 1.5                                    |                              |
| forearm.wristR  | 1.2                                    | taper to wrist              |
| thigh.hipR      | 2.6                                    | ~1.45 × bicep.rootR          |
| thigh.midR      | 3.0 (bulge)                            | quad                         |
| thigh.kneeR     | 1.9                                    |                              |
| shin.ankleR     | 1.3                                    |                              |

## Build & seam

New file `character-mega-boy.js`, modeled on `character-lpgo.js`:

```
buildMegaBoy(dof = {}, opts = {}) -> { kind:'workbench', lathes, extrudes, sweeps, reliefs }
```

- reuse `armatureNodes(dof, { scale })` verbatim — same posed node map.
- emit each segment with the `cyl(a, b, radius | profile)` helper, extended to pass a
  `profile` array straight through to the lathe monomer (LPGO's `cyl` hardcodes a flat
  `[{t:0,radius},{t:1,radius}]`; mega-boy wants the caller to supply the bulge/taper).
- attachments ride nodes exactly as LPGO's `opts.attachments` do (`on:'wristR'`, …) — the
  Mega-Buster cannon is just a `handAt(at)` builder, the sibling of `swordAt`.
- renders through `workbench.js` → `lowerObjectFaces` → `assembleBoxCityScene`, the same
  seam LPGO uses. No new render path, no figure-SVG involvement.

Re-pose, gait, and motion come for free because every primitive is anchored to a posed
armature node — the whole reason the family lives on the workbench seam and not the
protoform's.

## Not in this pass

- Hands beyond a mitt bead / cannon barrel; articulated fingers.
- Boots beyond a re-widening block; ankle hinge.
- Face beyond a seated skin bead inside the helmet gap; eyes/expression.
- Chest-plate / ab relief (`torso.chestPlate`), pelvis trim detailing.
- Female / child / heavy variants (all are proportion-record edits, deferred until the
  canonical male silhouette reads).
- An MCP entry tool. Like LPGO, mega-boy starts as a JS builder + spike render; a
  `create_character` tool over the workbench seam can come once the family is proven.
```
