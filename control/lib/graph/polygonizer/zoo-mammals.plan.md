# zoo-mammals — filling the animal-realm with recognizable mammals (+ marsupials)

Builds on [figure-animal.plan.md](./figure-animal.plan.md). That plan proved the KIT
(armature + chains + skull/foot/face presets + coat/markings). This plan is the
ROADMAP for using the kit to mint the recognizable zoo mammals, the ABSTRACTION that
governs it, and the loop that executes it. The thesis of this plan is a single
question: **how far can decoration carry recognition before the form has to change —
and where does decoration have to cheat the form entirely?**

## How bear / raccoon / lion were actually done

Read two ways — by the final render, and by the taxonomy.

### In final-output terms (what geometry each part contributes)

A built animal is `buildAnimal(archetype, recipe)` → grounded STAND parts. Every
species is the SAME assembly; only the inputs differ. The parts, by who owns the read:

- **Silhouette (the FORM)** — owned by `archetype` proportions (girth × region,
  stature, fore/hind balance) + the `tail`/`neck` CHAINS + the `skull` preset +
  the `foot` preset. This is the part a blind man would feel: a heavy barrel on
  pillar legs vs a low supple tube on a long tail. It is real geometry; changing it
  moves vertices.
- **Surface read (the DECORATION)** — owned by `coat` (whole-body PAINT), `facePaint`
  (head-axis colour zones), `tailRings` (banded fur on the tail rings), `mane` (a
  collar of lock blades), and `face` (eye/ear/nose decorator balls). These ride the
  form that already exists; most add no silhouette at all.

The three locked species, decomposed:

| species | FORM (geometry) | DECORATION (rides the form) |
|---|---|---|
| **bear** (`BEAR_VARIANTS.brown`) | `ursine` archetype — bulky barrel, robust forequarter-heavy limbs, boxy `ursine` skull (boxy 0.85), `paw` feet, stub tail | whole-body coat paint `#5e4127`, `MAMMAL_FACE` (small close eyes, bold nose, round wide ears), boxy muzzle |
| **polar / panda bear** | **identical** `ursine` geometry + seed | pure colour swap: coat `#e9e6df` / `#efece6`; panda adds black ears + big black eye-patches via the `face` cfg only |
| **raccoon** (`RACCOON_BUILD`) | `raccoon` archetype = the ursine plan SCALED DOWN (plantigrade, hunched back, pear-shaped haunch, long thick tail), `raccoon` skull (pointier, less boxy 0.45), `paw` | grizzled coat `#6b6258`; **ringtail** (dark/tan bands fur-tiled into the tail rings); **bandit mask** = LIGHTEN the snout+jaw so the dark base around the dark eyes reads as a mask by contrast; bigger pointier `RACCOON_FACE` ears |
| **lion** (`feline` + `mane`) | `feline` archetype (lower/suppler than canine, long tail), short feline skull, `paw` | the **mane**: a collar of bold tapered lock-blades around the neck (pushed forward + big radius + blunt overlapping lobes → a ruff framing the face) |

### In family-taxonomy terms (the phylogeny the kit already encodes)

The archetypes ARE a coarse cladogram, and the species reuse is phylogenetically
honest, not just convenient:

- **Carnivora / Caniformia** — one body package, scaled:
  - *Ursidae* → `ursine`. *Procyonidae* (raccoon) is bear-kin, so `raccoon` is
    `ursine` scaled down, NOT the rodent. *Canidae / Mustelidae* reach off the same
    caniform plan (`canine`; weasel/otter = elongated small ursine).
  - **The lesson:** a clade = one archetype + a scale/stature edit. Siblings share
    skull/foot kind; you swap proportions, not primitives.
- **Carnivora / Feliformia** — `feline`; lion = `feline` + mane (a male-lion sex
  trait carried entirely by decoration).
- **Color-morph vs species** — brown/polar/panda are ONE species' geometry recoloured.
  This is the floor of the abstraction: **a recolour is a different animal to the eye.**

## The abstraction (nail this, the loop depends on it)

Two strata, and the whole game is keeping them apart:

```
FORM         = archetype proportions + chains + skull + foot + FLUFFS + ANTLERS   (moves vertices)
DECORATION   = coat paint + facePaint + tailRings + mane + face                   (rides the vertices)
```

(FLUFFS — named added volumes from figure-fluff.js: the camel hump `bead`, the kangaroo
haunch `football`. The FORM lever for a body mass that is neither a proportion dial nor an
appendage. Added minting camel + kangaroo. ANTLERS — a BRANCHED cranial appendage from
figure-animal-antler.js: the buck's rack, and the whole horned set by cfg. Both are FORM: they
move the silhouette. See the build log.)

A new recognizable mammal is, in priority order:
1. **pick the nearest archetype** (the clade skeleton) — never invent a new one if a
   scale edit of an existing one reaches it;
2. **scale/bias it** (girth, stature, fore/hind, back arch) toward the target;
3. **pick skull + foot presets** (the family tell — muzzle length/boxiness, paw/hoof/pad);
4. **paint + decorate** (coat colour, face cfg, and any mask/bands/mane/tuft).

Steps 1–3 are FORM and are bounded by the archetype set. Step 4 is DECORATION and is
where most of the recognition actually lives.

### Where decoration CHEATS the form (the key insight)

"Cheat" = make the eye read a species without paying for the geometry. Ranked by how
much recognition they buy per polygon:

1. **Colour swap (free).** Repaints existing surfaces. Buys: every colour-morph
   (polar/panda/brown), fox red, black panther, the *base* of every species. The
   single cheapest differentiator and it does enormous work — a polar bear is a
   brown bear with one hex changed.
2. **`facePaint` zones (free).** Lighten/darken along the head axis. The raccoon mask
   is made by LIGHTENING the snout, not painting a band — contrast does the work.
   Buys: bandit mask, light muzzle, white chin, dark socks (same trick on a limb).
3. **`tailRings` banding (free, geometry reused).** Colours the EXISTING tail rings
   in bands. Buys: raccoon, lemur, civet — any ringed tail.
4. **`mane`/tuft locks (cheap, additive).** A cluster of blade primitives anchored at
   ANY armature node. Buys: lion mane, horse mane/forelock, bison cape, goat beard,
   crests. Adds a little silhouette but is pure decoration over the shared form.
5. **`face` decorator sizing (cheap).** Ear size/shape + eye size by skull-fraction.
   Buys: the elephant-ear vs mouse-ear vs fennec read, all on the same head.

**Decoration comes in THREE registers** (a tell picks whichever is cheapest that reads):
1. **PAINT** — colour zones over existing surface (items 1–3 above): morphs, masks, bands.
2. **ADDED DECORATORS** — small extra primitives riding armature nodes (items 4–5): mane
   locks, eye/ear/nose balls.
3. **VOLUMIZED SHAPE** — *reshape an existing volume* into the iconic form, rather than
   paint or add. The fox tail is the proof: its recognition is a SHAPE (a teardrop brush),
   so we gave the tail chain a `bulgeR`/`bulgeAt` radius profile (narrow attach → fat belly
   → point) + a 2-tone tip — a 3D volumized interpretation of an iconic decorative point, no
   new geometry primitive, just a richer profile on the chain it already had. Reach here when
   the tell is a silhouette of an appendage (fox/squirrel brush, the lion's tufted tail-tip,
   a fan, a crest) that flat colour can't carry.

**COUNTERSHADING — cracking the ventral case of the wall.** The white belly most mammals
carry (throat→chest→belly) is a localized patch, which the wall says we can't zone. But the
ventral surface has a clean GEOMETRIC signature: its faces point DOWN. So `underHex`/`underCut`
(render-time, in `renderAnimalToSvg`) recolours every body face whose outward normal points
below `underCut` to the underside colour — gated to the coat hex so feet / tail-tip / face
zones are untouched — and shades those faces with the z-FLIPPED normal so the belly reads
WHITE, not muddy grey (down-faces get no overhead light otherwise). This is a NORMAL-RULE
zone, not an arbitrary patch: it solves countershading (fox, deer, rabbit, most mammals) but
NOT stripes/spots/eye-patches, which have no geometric signature and still need the real
patch-colour primitive. One more case off the wall; the wall itself stands. (The MIRROR case —
`overHex`, the UP-normal dorsal stripe — was later added the same way and renders the skunk; see
"Volumized tells — the tail & mark catalog" below for the generalized shape/normal-signature method.)

The discipline: **reach for decoration before form, and within decoration reach paint →
decorator → volumized-shape in that order of cheapness.** If a colour swap or a face cfg
gets you the animal, you are done — do not sculpt geometry. The bear variants are the
proof: three recognizable bears, one mesh. The fox is the counter-proof: when the tell IS
a shape, volumize the existing volume rather than paint a flat hint of it.

### Where decoration CANNOT cheat — the form/primitive wall

Some animals are recognized by something neither paint nor the current decorators can
fake. These GATE the loop — it must stop and escalate rather than ship mush:

- **PATCH colour — a localized mark ON a surface** (not a head-axis zone, not a tail
  band). This is the biggest gap and it blocks the most-wanted zoo animals: **tiger
  stripes, zebra, giraffe reticulation, leopard/cheetah/jaguar spots, deer fawn
  spots, the *true* panda mask, tabby.** Until this primitive exists, every patterned
  mammal renders as "generic big cat / generic equine." THE loop's hard boundary.
- **Horns / antlers** — a tapered, optionally branched chain off the skull. ≈ reachable
  by reusing the branched `tailChain` anchored at the head (deer/antelope/cow/rhino-ish).
  Treat as "small new code," not a wall.
- **Tusks** — a curved solid cone off the jaw/skull (elephant/boar/walrus). Genuinely new.
- **Proboscis** — already covered: the elephant trunk is a long `neckChain`/`tailChain`.

So the only true walls for mammals are **PATCH colour** and **TUSK**; horns are a small
chain reuse.

## Volumized tells — the tail & mark catalog (the shape/normal-signature method)

The fox/raccoon/skunk iterations generalize into a METHOD for any tail or identifiable mark:
before calling something the patch-colour WALL, test it for a signature we CAN render.

### The off-the-wall test (the single rule)

A tell comes OFF the wall if it has EITHER:
1. **a SHAPE signature** → VOLUMIZE it: a radius profile + wave on the chain/appendage, or a
   mass dropped into the skin field. (fox brush, raccoon ringtail SHAPE, squirrel curl, mane, hump.)
2. **a NORMAL signature** → recolour faces by their outward normal (a "normal-rule zone"): the
   ventral belly is the DOWN-normal case (`underHex`), the dorsal stripe is the UP-normal case
   (`overHex`). Shaded with `abs(n_z)` so the zone reads BRIGHT either way.

Only a tell with NEITHER signature — an ARBITRARY patch on a flat flank (tiger stripes, leopard
spots, giraffe reticulation, a facial blaze) — is the true PATCH-colour wall. That set is now
small; most "markings" people name actually have one of the two signatures above.

### Tails = a SHAPE register × a COLOUR register (two independent axes)

A tail is one of a small set of SHAPES, painted by one of a small set of COLOUR treatments; the
two compose freely (proven: fox = bulge×tip, raccoon = bulge×bands, skunk = curl×dorsal-stripe).

SHAPE (chain knobs `rootR`/`bulgeR`/`bulgeAt`/`tipR`/`droop`/`length`/`wavePlane`/`waveAmp`/`waveN`):
- **thin rod** — linear taper, low radii (rat, big cat). ✓
- **teardrop brush** — `bulgeR`/`bulgeAt` mid (fox, raccoon, squirrel body-of-tail). ✓
- **curled-up plume** — negative `droop` + a `wavePlane:'vertical'` half-wave bow (squirrel, skunk). ✓ proven
- **stub** — short `length` (bear, rabbit). ✓
- **LIMIT (needs more than the chain):** terminal **tuft/pom** (lion) — the single smooth bulge
  can't make a sharp end-knob → an ADDED DECORATOR (a ball/lock at the tail-tip node, reuse the
  mane lock or face `ball`). Also **flat paddle** (beaver) → a flatten knob; **tight spiral** (pig)
  → a curl path the catmull core→root→tip→tip can't take. Flag, don't fake.

COLOUR (per-ring paint, or normal-rule):
- **solid** — body colour. ✓
- **2-tone tip** — `tailTip` (fox white, snow-leopard, lion dark tip). ✓
- **ringed bands** — `tailBands` (raccoon, lemur, civet). ✓
- **lengthwise dorsal stripe** — `overHex` normal-rule on the SOLID tail-top (skunk, badger). ✓ proven
- **fur plume** — `tailRings` — ONLY when genuinely shaggy; the volumized smooth tube reads cleaner.

### Identifiable marks — re-sorted by signature (not by body part)

- **SHAPE signature (volumize):** mane / cheek-ruff (lock), horns/antlers (`hornChain` ≈ a branched
  tail-chain at the skull), camel/bison **hump** (a dorsal mass in the skin field — the haunch trick
  moved to the back), throat **dewlap/wattle** (a hanging lobe), **crest**, elephant **ear** (a flat
  ear shell), **tusk** (a curved cone — genuinely new).
- **NORMAL signature (normal-rule recolour):** ventral countershading (`underHex`, done), dorsal
  stripe (`overHex`, done). Candidate extensions: a dark dorsal **saddle** (German-shepherd) is a
  softer up-normal zone; a pale **cheek/jaw** is partly the head-axis `facePaint` already.
- **TRUE WALL (no signature — caveat, never fake):** flank stripes, body spots, reticulation, a
  facial blaze. The eye-MASK is special: it has no normal signature but we cheat it as an ADDED
  DECORATOR (`eyePatchHex` + `eyePatchBridge`), not paint — a third way off the wall for compact
  facial patches.

### What this session PROVED by render (the method works)

- **`overHex`** (new lever, figure-render.js) — the UP-normal mirror of countershading; rendered a
  black body + white back-and-tail stripe → an unmistakable SKUNK. Cracks the dorsal-stripe wall case.
- **Squirrel curl-up** (no new code) — `droop:-62` + `wavePlane:'vertical'` half-wave → the tail
  arcs up over the back. The shape register reaches curled plumes.
- **Lion tuft** (boundary found) — a late bulge does NOT make a distinct pom; the tuft is an ADDED
  DECORATOR at the tip, not a chain shape. Recorded as the shape-register's limit.

Experiments live at `integration/0629/.../tail-{squirrel,lion,skunk}-*.svg`. These were rendered on
EXISTING archetypes (rodent/feline/canine) as tail/mark probes — not committed as species recipes.

## Target roster, sequenced by reachability

Phase ordering follows the abstraction: do everything decoration can carry FIRST,
hit the primitive wall LAST so the loop runs unattended longest before it needs you.

### Phase 1 — reachable NOW (solid colour + silhouette + existing decorators)

No new primitive. Each = archetype + presets + a paint/mask/mane recipe.

- **Canids:** wolf (`canine` solid), fox (`canine` + bushy tail + `facePaint` white
  muzzle/black socks), husky/shepherd (canine + facePaint).
- **Felids (solid):** cougar/panther (`feline` solid), lion (done).
- **Ursids:** brown/polar/panda (done).
- **Procyonids:** raccoon (done), red panda (`raccoon` + rust coat + INVERTED-dark `underHex`
  belly/legs + white `facePaint` + ringed `tailBands` — DONE).
- **Mustelids:** otter/weasel (elongated small `ursine`: ↑trunkLength, ↓backHeight).
- **Stumpy solids:** hippo (`stumpy` solid), rhino-body (stumpy; HORN deferred to P2).
- **Equine solids:** horse (`equine`, done-ish), donkey (equine variant), camel (`equine` +
  triangular-hump `fluff` (`bead` `peak`) — DONE).
- **Cervids / small bovids (`gazelle` archetype):** deer/doe + buck (antlers), gazelle (tineless
  antler = horn) — all DONE. The horned Phase-2 set (ram/bull/antelope) reuses the same antler cfg.
- **Primates (posture edit, no new primitive):** gorilla (heavy `ursine`-ish,
  knuckle-stance via fore tuck-ish), chimp/monkey (lighter, long-arm) — verify these
  read; they may want a stance knob, flag if so.

### Phase 1 — marsupials (the user's "related-skeleton" set)

Marsupials reuse EXISTING archetypes — the framing is exactly right:

- **Kangaroo** ≈ `theropod` balance (biped hopper: huge hind legs, heavy balance tail,
  tucked forelimbs, small head) + `spineTilt` upright + haunch `fluff` — solid rusty coat. DONE.
- **Koala** ≈ small `ursine` (stout, big round `face` ears, stub tail) — grey coat.
- **Wombat** ≈ small `stumpy` (barrel, short pillar legs) — solid brown.
- **Tasmanian devil** ≈ small `canine`/`ursine`, black coat (+ white chest = small
  `facePaint`/patch — borderline; may slip to P2).
- **Opossum** ≈ `rodent` + bare (un-furred) ringtail-shaped tail — grey/white.

### Phase 2 — the HORN/ANTLER primitive (DONE) → the horned set is now loopable

The primitive landed: `antlers()` in [figure-animal-antler.js](figure-animal-antler.js) — a
branched cranial appendage (main beam + tines, mirrored L/R), seated on the crown from the head
frame, wired as the defaults-off `antlers` opt on `buildAnimal`. Built the first two cervids:
- **deer** (hornless DOE) + **buck** (deer body + the antler rack) — DONE.

The rest of the horned set is now "turn the knobs on the same primitive" (each is a body recipe +
an `antlers`/horn cfg): antelope, cattle/bull, bison (+ cape mane), goat/ram (high `curl` → a
curled horn), rhino (nasal horn = a single beam, no tines, rooted forward on the muzzle). A single
undecorated beam (`tines: []`) is a HORN; the same beam with a high `curl` is a ram's curl — so the
whole Phase-2 set is one primitive, as the roadmap predicted.

### Phase 3 — BLOCKED on PATCH colour (the wall; escalate to user)

tiger, zebra, giraffe, leopard, cheetah, jaguar, true panda mask, fawn-spotted deer,
tabby cat. Do NOT attempt with paint — they will read generic. The loop STOPS here and
hands back: "PATCH-colour primitive needed; here are the N species it unlocks."

### Phase 4 — needs TUSK (+ trunk already covered)

elephant (trunk = `neckChain` ✓ + TUSK), boar (stumpy + tusk), walrus (tusk).

## The single-animal builder (playbook)

The canonical procedure for building ONE animal, as it stands after the substrate work this
session. `buildAnimal(archetype, opts)` is the front door; the loop just runs this per species.

### The pipeline (what `buildAnimal` assembles, in order)

armature (archetype proportions, **4-foot stance** auto-correct) → balance (quadruped no-op;
biped feet under COM) → chains (tail/neck) → **welded skull** (jaw wrapped into the head) →
feet → **welded body skin** (+ **head bridge** neck→cranium, + **haunch** ham) → coat paint +
markings → plant on the floor. Returns grounded STAND parts the renderer lifts to world.

### The steps (per animal)

1. **RESEARCH** — pull a real SIDE + HEAD photo (Wikimedia), `curl`, Read it; extract the
   renderable tells, classify each by primitive vs the patch/tusk WALL (caveat, never fake).
2. **FACE STUDY** — pull a FACE-ON + 3q head ref; read the face SILHOUETTE (head outline) and
   the MARKING ZONES separately; render `renderAnimalToSvg({…, crop:'head'})` to compare.
3. **CLASSIFY** — nearest archetype + skull/foot presets + the decoration recipe.
4. **AUTHOR** the recipe as DATA in `ZOO_BUILDS` (`{ archetype, opts }`); no new geometry primitives.
5. **RENDER through the character builder** — `renderAnimalToSvg` (figure-render.js), 3q+lateral+
   head-on into the dated integration folder; rasterize with `/view-svg`; READ the PNGs.
6. **SELF-JUDGE** (binary: reads as the species?) → accept, or enter the fine-tuning ladder.
7. **RECORD the lesson** (the generalizable rule + any new lever) in this plan.

### The lever inventory (by tier — reach for the lowest that does the job)

- **ARMATURE** (bone positions; `armatureCfg` merges over the archetype): `backHeight`,
  `trunkLength`, `girthBody/Fore/Hind/Head`, `neckLength/Angle`, `backArch`. Hind-leg stance is
  now CORRECT by default (femur vertical, hock back ~7 o'clock, foot under the rump) — don't
  re-fight it per species; only `hindFootBack` may need dialing DOWN on a small animal (absolute
  offset). `tailCfg`/`neckCfg` reshape the chains (`rootR`/`tipR`/`bulgeR`/`bulgeAt`/`droop`/`length`).
- **FLESH** (the wrap; `fleshCfg`): `flesh` (global), `thorax`/`belly`/`bellyDrop`/`rump`
  (torso masses — **lean clade vs heavy clade**: canids/cats/gazelle get a tucked low-belly thin
  profile, bears/stumpy stay deep), `taper` (limb thinness), `jointFill`, `blend`/`bound` (weld
  fillet/reach), `haunch`/`haunchAt`/`haunchBack` (the ham). Head: `skullCfg`
  (`length`/`width`/`muzzle`/`snout`/`boxy`); the jaw welds in + neck bridges automatically.
- **DECORATION** (rides the surface, cheapest → dearest): `coat.color`; `underHex`/`underCut`
  (ventral countershading — DOWN-normal zone) + `overHex`/`overCut` (dorsal stripe — UP-normal zone,
  catches the back AND a solid tail-top; the skunk/badger stripe), both shaded-as-lit so they read bright; `facePaint` (`snoutHex`/`mouthHex`
  head-axis zones); `footCfg.stroke` (foot/sock colour); `face` (`earTip`/`earLen`/`earHex`/
  `eyeHex`/`eyeR`/`noseHex`; `eyePatchHex`/`eyePatchR`/`eyePatchAspect` diamond eye-patches +
  `eyePatchBridge` to LINK them into one continuous band — the bandit mask); `tailTip` (2-tone
  tip); `tailRings` (banded FUR plume); `tailBands` (alternating colour rings on the SMOOTH
  volumized tail tube — the ringtail-by-paint, raccoon/lemur, no fur); `mane` (lock
  cluster — collar OR, not-yet-wired, a CHEEK-RUFF tuft for the wolf/lynx/lion face).
- **WALL** (needs a NEW primitive — caveat, don't fake): PATCH colour (stripes/spots/eye-mask/
  forehead blaze/belly patch), TUSK. HORNS ≈ a branched `tailChain` at the skull (small new code).

### Tier diagnosis — which tier owns the symptom (the session's hardest-won rule)

- "**wrong shape / too fat / too thin / not lean**" → **FLESH** (girth/taper/belly), NOT bones.
- "**limb sits wrong**" → decompose: attachment POSITION, segment ANGLE (clock), segment-length
  RATIO, or THICKNESS (flesh) — fix the right one; anatomical reference ("femur at 4 o'clock")
  is a literal tier pointer.
- "**a localized mark / pattern**" → DECORATION (if a colour zone) or the WALL (if an arbitrary patch).
- "**I changed the knob and nothing moved / it's still wrong**" → STOP tuning and INSTRUMENT a
  downstream stage; a bug may be overriding the input (the biped-balance trap). Confirm a change
  actually CHANGES THE RENDER before believing it.
- "**defect across many species**" → fix at the ARMATURE/flesh DEFAULT, not per-recipe; propagate
  by anatomical CLASS (digitigrade/plantigrade/unguligrade; lean/heavy), not uniformly.

### Substrate invariants now solid (don't re-derive these per animal)

4-foot stance + hind-leg angulation · welded body skin · neck→head bridge · welded skull (jaw
wrapped) · the haunch ham · per-archetype sized skulls · countershading · the teardrop/bushy tail
profile. These were hard-won this session; a new species inherits them for free.

## The loop

### Unit of work (one iteration = one species)

1. **Pick** the next species from the Phase-1 roster (top of the un-built list).
1a. **REFERENCE** (do not one-shot from the model's mental image): WebSearch a real
   photo (prefer commons.wikimedia.org side + head views), get the direct
   upload.wikimedia.org URL via WebFetch, `curl` it to /tmp, and **Read the image**.
   Extract the RENDERABLE TELLS and classify each by primitive (see the fox table in
   "Reference-grounded extraction" below) — explicitly separating what the kit can do
   from the patch-colour/tusk WALL items (which become caveats, never faked). The recipe
   is authored FROM the reference, not from intuition — this is what caught the fox's
   over-long muzzle and drove the white tail-tip.
1b. **FACE STUDY** (the face carries most species identity — do this every animal): pull a
   FACE-ON + 3q HEAD reference and read TWO things separately — (i) the face SILHOUETTE
   (the head OUTLINE: wolf = a cheek-ruff diamond; fox = a sharp narrow triangle; cat =
   round flat face; bear = broad blunt) and (ii) the MARKING PATTERN (where the fur colour
   ZONES sit on the face: muzzle/lips, eye-mask, forehead blaze, cheek, ear-backs). Render
   OUR face study to compare: `renderAnimalToSvg({ archetype, opts, view:180|150, crop:'head' })`
   (front + 3q head crop). Map each face tell to a primitive: SILHOUETTE → `skullCfg`
   (length/width/muzzle/boxy) + `face` ears (earTip/earLen) + a CHEEK-RUFF tuft (the
   `mane`/lock primitive as a small cheek cluster — reachable, not yet wired); MARKINGS →
   `facePaint` head-axis zones (muzzle/jaw) + `face` earHex/eyeHex/noseHex; the LOCALIZED
   facial patches (eye-mask, forehead blaze, cheek spot) are the patch-colour WALL → caveat.
2. **Classify**: nearest archetype + skull/foot presets + the decoration recipe. If
   the species' defining tell is a Phase-3/4 wall (pattern/tusk), SKIP it, log
   "blocked on <primitive>", and continue — do not fake it.
3. **Author** the recipe as DATA in the `ZOO_BUILDS` table (mirroring `BEAR_VARIANTS` /
   `RACCOON_BUILD`) — `{ archetype, opts }` for `buildAnimal`. No new geometry primitives.
4. **Render through the CHARACTER BUILDER**: `renderAnimalToSvg({ archetype, opts, view })`
   (figure-render.js — it reuses the figure mesher; do NOT write a bespoke renderer or lean
   on the spike `it()`). Emit 3q + lateral + head-on into the dated integration folder
   (`lite-template/integration/<date>/spike-output/figure-animal/`), rasterize with
   `/view-svg`, and READ the PNGs.
5. **Self-judge (binary): does it read as the species to a naive viewer?** If yes → lock,
   record the LESSON (step 6), move on. If no → enter the FINE-TUNING LADDER below.

### The fine-tuning ladder (how to close a gap to the reference)

A correction is a NAMED visual deviation ("muzzle too long", "tail wrong shape", "belly
should be white"). For each, find the ONE responsible lever and take the LOWEST rung that
reaches it — climb only when the rung below cannot.

ALTITUDE CHECK FIRST: is this deviation specific to THIS species, or does it show up across
many? A cross-species defect is an ARMATURE-tier bug — fix it once in `QUADRUPED_DEFAULT` /
the archetype class (see "Hind-leg angulation" below), NOT in the recipe. Per-species recipes
only carry what is genuinely that species' own. Then, for a species-specific tell, the ladder:

1. **Existing knob** — `skullCfg` (muzzle), `armatureCfg` (proportions/girth), `face`
   (`earTip` pointy↔blunt, ear/eye size), `footCfg.stroke` (foot colour). Just turn it.
2. **Existing data-override** — `tailCfg`/`neckCfg` (chain shape), `tailTip` (2-tone tip),
   `facePaint` (head zones), `underHex`/`underCut` (ventral countershading), `tailRings`.
3. **A NEW *general* lever** — only when no knob/override reaches the tell. Add it
   defaults-OFF so every other animal is byte-unchanged, and make it REUSABLE, never a
   one-off hardcoded shape. Precedents: the teardrop `bulgeR`/`bulgeAt` chain profile (fox
   brush), the countershading recolor (white belly). A shape tell → a 3D VOLUMIZED profile
   on the existing volume, not a flat painted hint.
4. **The wall** — an arbitrary patch (stripes/spots/eye-patch: no geometric signature) →
   caveat, do NOT fake. (Ventral white is OFF the wall now — it has a down-normal signature.)

After EVERY tune: re-render and **verify the WHOLE, not just the fixed part** — a change can
regress elsewhere (the gap-closing skin pass over-thickened the body AND dropped the front
feet, and was reverted). Accept a tune only if the whole still reads; **revert any change
that costs more than it gives.** Retry cap ~3 per deviation; then log "needs attention".

6. **Record the LESSON (the iteration's real output).** The built species is a byproduct;
   the durable yield is the GENERALIZABLE rule + any new lever, written to this plan's build
   log + abstraction (e.g. "volumized-shape register", "countershading cracks the ventral
   wall-case"). The next species inherits the lever, so the loop gets cheaper over time.

### Why this is a safe loop (the teaching point)

- The PATTERN is proven three times (bear/raccoon/lion) — step 3 is "do the known-good
  thing again," not novel work. This is the "proven work, no fresh evaluation" case.
- The eval is bounded and self-contained: render → look → binary read. The model can
  run its own acceptance check via `/view-svg` + Read.
- It is SEQUENTIAL and in-context (no parallel fan-out, no concurrent file writes) — low
  blast radius; everything lands in `ZOO_BUILDS` + study cases.
- It has THREE honest exits: roster exhausted, retry-cap hit on one species (log + skip),
  and the primitive WALL (Phase 3/4 — escalate to the user). The wall is the natural
  hand-back: the loop runs P1 unattended, then asks for the patch-colour primitive.

### Stop / escalate conditions (write these into the loop prompt)

- A species needs PATCH colour or TUSK → skip + log, never fake.
- Retry cap (e.g. 3) reached without a clean read → log "needs attention", move on.
- Roster exhausted → stop, report the built set + the blocked set.

## Reference-grounded extraction (the `animal` reference target)

The per-iteration "classify" step is itself an instance of mojulo's **Visual Reference**
concern (`control/lib/mcp/tools/visual-reference.js` + `control/lib/reference/index.js`):
the harness IS the vision adapter — it reads a photo it can see and decomposes it into a
target's dials. Ships `scene` / `pose` / `landscape`; the natural extension is an
**`animal`** target (NOT a child concern — the machinery is already target-polymorphic).

### The mapping (proven manually on the fox)

Read off the photo → write into the `buildAnimal` dials:

| what to read in the photo | primitive dial |
|---|---|
| body proportion (tall/low, leg length, bulk) | `armatureCfg` (scale over nearest archetype) |
| muzzle length / breadth / pointiness | `skullCfg` (length / width / muzzle / boxy) |
| ear size / shape / set | `face` (earLen / earW / earTip / earUp / earSide) |
| base coat colour | `coat.color` |
| lengthwise light/dark zones (muzzle, throat) | `facePaint` (snoutHex / mouthHex) |
| tail volume + carry + a tipped/ringed tail | `tailCfg` (radii/taper/droop/length) + `tailTip` / `tailRings` |
| eye / nose colour + size | `face` (eyeHex / noseHex / eyeR) |
| **localized patches: spots, stripes, socks, belly, eye-patch** | **— WALL — caveat (patch-colour primitive)** |

### Expressive ceiling (the target's `caveats`)

What the `animal` target CANNOT represent and must declare per species: patch colour
(stripes/spots/socks/belly/eye-patch), horns/antlers (until `hornChain`), tusks, wing/fin
membranes. The protocol's job is to make the harness SEE these and log them, not fake them.

### Build status of the target

- **Protocol** (`ANIMAL_PROTOCOL`: summary / key_lines / dial_schema / ceiling /
  multipass_hint / capture_call) — DESIGNED above; ready to write into `lib/reference`.
- **Lowering** (`lowerAnimalCage`: insights → a rendered animal study cage in a stash) —
  blocked on ONE dependency: a **reusable animal renderer**. Today the render
  (renderLineup / worldPart / orbitCamera) lives inside
  `figure-animal.spike.gen.test.js`; the target needs it extracted into an importable
  module (e.g. `figure-animal-render.js`, paralleling `figure-render.js` for pose).
- Until then the loop runs the protocol MANUALLY (WebSearch → curl → Read → recipe),
  which is exactly what minted the fox.

## Kit extensions made while minting wolf + fox (front-door overrides)

`buildAnimal` gained three DATA overrides so a species stays a recipe (no new archetypes,
no new geometry primitives):
- `armatureCfg` — merge proportion knobs over the named archetype ("pick nearest, scale it").
- `tailCfg` / `neckCfg` — reshape the chain (bushy canid brush vs thin rod).
- `tailTip` — `{ color, frac }` paints the last `frac` of the tail rings a second colour
  (the fox white tip / snow-leopard tip) — a bare colour-zone over existing tail rings, no fur.

Then, minting camel + kangaroo + red panda, a FOURTH override — the FORM one:
- `fluffs` — a list of `figure-fluff.js` volume specs (`bead` / `football` / `cone` / `bell` /
  `slab`) bound to the ANIMAL armature nodes, built at `scale:1` (STAND) and folded into the
  parts painted the coat colour (or a spec's own `hex`). This is the first lever that adds a
  NAMED body volume that is neither an appendage (chain) nor a proportion dial — the zdog
  register pointed at animals. Debut tells: the camel HUMP (a `bead` at `navel`, biased up) and
  the kangaroo HAUNCH (a `football` per hip→knee thigh). Defaults-off: every prior species is
  byte-unchanged. See figure-fluff.plan.md for the shape table.

Then, on the kangaroo (nape/knee/hands) and the deer/buck (antlers), five more, all defaults-off:
- `forepaws` — a small `protoFoot` paw at each wrist for a tuck-biped (a HAND, by anchoring the
  foot's ground plane just below the wrist).
- `neckBridge` / `kneeBridge` (`figure-animal-skin.js`) — the `spineBridge` joint-seam fix at the
  NAPE and the KNEE (a bridge axis marched across the bend through the smooth field).
- `antlers` — the BRANCHED cranial appendage (`figure-animal-antler.js`): a beam + tines, mirrored
  L/R, seated on the crown. `antlers:true` = the default rack; a cfg tunes the sweep/tines, and by
  cfg the same primitive is a horn (`tines:[]`) or a ram's curl (high `curl`) — the whole Phase-2
  horned set.

## Build log

- **camel hump → triangular + gazelle (the horn = tineless antler proof).** Two small follow-ups:
  - **camel hump was too CIRCULAR.** The hump was a spherical `bead` fluff (a dome). Added a `peak`
    dial to the `bead` shape (figure-fluff.js): 0 = sphere, 1 = a base-down/apex-up CONE (straight
    sides → a triangular profile), blended per-ring, plus a `squash` vertical scale. The camel hump
    is now `peak: 0.55` — a proper triangular dromedary hump. **LESSON — extend a shape's DIALS
    before adding a new shape.** The closed 5-shape table stays closed; hump-vs-dome is a profile
    knob on the existing `bead`, not a 6th primitive. Gotcha: a cone's widest ring is its BASE, so
    lift the bead (`bias.z`) enough that the base stays buried in the barrel and only the triangle
    shows — else the wide base pokes out below the belly.
  - **gazelle — the HORN is an ANTLER with no tines.** Rounds out the deer family off the same
    `gazelle` archetype, and validates the Phase-2 claim on the FIRST reuse: `antlers: { tines: [],
    … }` with high `back` + small `out` + low forward `curl` gives thin dark horns swept up-and-back
    with a hook — no horn-specific code, just the antler cfg. Confirms the whole horned set (ram
    curl, bull, rhino nasal spike) is knob-turning over the one primitive, as predicted.

- **deer + buck (the ANTLER primitive — Phase-2 unlock).** Two cervids off the `gazelle`
  archetype (a deer is a large gazelle: slender, long thin legs, cloven hooves, small tapered
  head, big ears): **deer** = the hornless doe (tan coat, white countershade throat/belly, dark
  hooves), built + judged FIRST as the Phase-1 checkpoint; **buck** = the SAME body (shared
  `DEER_OPTS`) + the new `antlers` opt. Reference-grounded (red stag + white-tailed buck,
  Wikimedia). The primitive: `antlers()` (figure-animal-antler.js) builds a main BEAM sweeping
  up-back-out off the crown with TINES branching off, as a set of tapered tubes, mirrored L/R —
  the roadmap's "branched tailChain at the skull," realized as tubes because an antler is a TREE
  (many branch points) and a chain can only bow once. **LESSONS:**
  - **antlers are GRAVITY-oriented, not head-oriented** — the frame is {worldUp, horizontal
    head-heading, lateral}, NOT the skull's dir frame, so the rack rises vertical regardless of
    head pitch. (First render seated the rack on the head-dir frame and it tipped forward with the
    craned neck.) 1 tune: eased the shared neck (angle 52→42, headPitch −20→−26) so the doe stops
    craning AND the buck's crown faces up for the rack; 1 tune: `pedFwd` 0.28→0.16 to seat the
    pedicle back on the crown (behind the eyes), not over the nose.
  - **one primitive spans the whole Phase-2 set by cfg** — `tines:[]` → a HORN (single beam);
    high `curl` → a ram's curl; rooted forward with no tines → a rhino nasal horn. So the horned
    clade is now a knob-turning sub-loop, not new geometry per species (the fluff lesson again:
    add ONE general, reusable FORM primitive, then every relative is data).
  - **share the body, vary the tell** — `DEER_OPTS` is spread by both doe and buck; the buck adds
    only `antlers` + a slightly darker coat. The doe↔buck pair is the sexual-dimorphism analog of
    the brown↔polar colour-morph: same geometry, one appendage's worth of difference.

- **camel / kangaroo / red panda (the fluff + inverted-countershade iteration).** Three species,
  each proving one durable point:
  - **camel** (`equine` + hump `fluff`) — ACCEPTED (1 tune: coat lifted; the lit mesh renders a
    sandy swatch down to camel-brown, the known "judge from the render" rule). The single dorsal
    hump is a `bead` fluff at `navel` biased +z, so it mounds above the topline. **LESSON — the
    fluff is a FORM lever, not decoration.** It moves the silhouette (a blind man feels the hump),
    so it belongs beside archetype/chain/skull/foot in the FORM stratum, not beside paint/mask.
    The abstraction's FORM line is now "archetype proportions + chains + skull + foot + FLUFFS."
  - **kangaroo** (`theropod` biped + haunch `fluff` + `spineTilt`) — ACCEPTED (1 tune: neck
    `droop`). The massive thigh is a `football` fluff on each hip→knee (a volume the round
    leg-vajra can't bulge to); the trunk is rocked upright with `spineTilt` (the bear-rear knob
    reused for the sitting hopper). Confirms the fluff superposes cleanly onto a limb the skin
    already covers. **LESSON — for a chain-headed animal the muzzle direction IS the neck's end
    tangent (`headFrameFrom`), and neck `droop` COMPOUNDS with `spineTilt`.** A high droop meant
    to "lift the head" (74) rotated the already-tilted neck base past vertical, so the face aimed
    up-and-BACK over the shoulder. There is no separate head-pitch knob here, so a forward gaze is
    a LOW droop (22) that lands the neck forward-and-up. Rule: when the trunk is tilted, budget the
    neck droop against that tilt — the face points where the LAST neck segment points.
    Then a second pass (nape / knees / hands) added three general levers, all defaults-off:
    - **`neckBridge`** (`figure-animal-skin.js`) — the SPINE-SEAM fix at the NAPE. A neck CHAIN
      roots at neckHub and projects away, but the thorax tube ends there perpendicular to its own
      axis, so the dorsal wedge behind the neck is left open. A span marched from inside the thorax
      across the corner to an early neck center (through the smooth field) closes it — the exact
      `spineBridge` move, one joint over. Fires only for chain-necked builds (identifies the neck
      chain by its root sitting on neckHub), so quadrupeds are untouched.
    - **`kneeBridge`** (`figure-animal-skin.js`) — the SAME seam on the LEG. The thigh (hip→knee)
      and shank (knee→ankle) tubes each march perpendicular to their own axis, so a sharply bent
      knee leaves a hole on the outside of the bend (visible as background THROUGH the joint once
      the countershade was stripped for the diagnosis). A span across the joint wraps it.
    - **`forepaws`** (`figure-animal-build.js`) — a tuck-biped stands on its hind feet, so
      `groundedFeet` gives the forelimbs no foot and they end in blunt stubs. `forepaws` seats a
      small `protoFoot` paw at each wrist with `sole` anchored just BELOW the wrist (protoFoot
      reaches down to `sole`, so a near-wrist sole makes a hanging HAND, not a floor-reaching foot).
    **LESSON — the joint seam is ONE defect with ONE fix, wherever two marched tubes meet at an
    angle** (navel, nape, knee). Each new bend is a `lerp3(a,joint,1−f)→lerp3(joint,b,f)` bridge
    axis through the field, gated defaults-off so it only touches builds that ask. And a "foot"
    primitive becomes a "hand" purely by where you anchor its ground plane — no new geometry.
  - **red panda** (`raccoon`, decoration-only) — ACCEPTED (1 tune: `underCut` −0.12 → −0.32). No
    new form; the ailurid read is all levers that already existed — rust coat, white-muzzle
    `facePaint`, ringed bushy `tailBands` over the fox-brush chain, and the key one: **an INVERTED
    countershade.** **LESSON — `underHex` is a two-way lever.** The wolf/fox used it for a PALE
    belly; the red panda uses a DARK `underHex` for its BLACK belly + legs. Same down-normal
    signature, opposite colour — so "dark-bellied" animals (red panda, some squirrels, ring-tailed
    cats) are OFF the wall too, not just white-bellied ones. The tune taught the second half: keep
    `underCut` TIGHT (steeply-down faces only) or the zone speckles onto side-facing flank faces.
    Wall caveats logged: the red panda's white eyebrow/ear spots + dark "tear-track" cheek stripes
    are localized patches with no geometric signature — not faked.

- **raccoon (REVISITED).** The "locked" raccoon was re-judged and FAILED a hard look: near-black
  body, a dorsal back-cleft, bear-sized bloat with a tiny head, and an eye-mask that read as two
  floating diamonds. Three tiers of fix, sequenced cheap→dear:
  (1) **the back-cleft → the SPINE BRIDGE** (systemic skin fix, see below — the highest-value fix,
  it helps every species);
  (2) **bloat + darkness → DECORATION/FLESH recipe knobs**: the raccoon carried NO `fleshCfg`, so it
  inherited SKIN_DEFAULT's BEAR-weight thorax/belly (1.9/2.1) on top of its own girths → bear-bulky.
  Added `fleshCfg {thorax:1.86, belly:1.98, bellyDrop:0.48, taper:0.38}` (a ROUND two-lobe "gourd"
  body — a fuller chest bulb + a round hanging belly so the midsection isn't a cylinder between the
  round rump and the chest; `bellyDrop` rounds the belly DOWNWARD without widening it laterally, the
  right knob when the front view is already wide enough) + `armatureCfg {girthHead:1.18,
  girthBody:1.1, girthFore:0.95}`, and lifted the coat `#6b6258 → #9b9078` (it renders DARK, so the
  base must start light to land as grizzled grey, not black);
  (3) **the mask → a new face lever `eyePatchBridge`**: a wide short diamond on the midline seated on
  the nose bridge that LINKS the two eye diamonds into one continuous bandit band (was two patches).
  ACCEPTED — reads clearly as a raccoon face-on (hunched grey body, ringtail, connected mask).
  Then two follow-ups: (4) **the body → a two-lobe "gourd"** (round chest bulb + round hanging belly,
  not a cylinder between rump and chest — `bellyDrop` rounds the belly DOWN without widening it); and
  (5) **the tail → the FOX's tail shape with raccoon colour**: swapped the furry `tailRings` plume for
  the volumized SMOOTH chain (the fox's `tailCfg` bulge profile, blunter tip) banded by a NEW
  `tailBands` lever — alternating dark/tan rings down the tube, ordered so the tip lands dark. A
  ringtail by PAINT over a volumized shape, far cleaner than the bottle-brush fur.

  **LESSON (tail) — separate the tail's SHAPE register from its COLOUR register.** The fox taught
  "volumized shape" (a bulge profile on the chain); the raccoon now shows the same shape can carry a
  different COLOUR treatment. `tailBands` is the smooth-tube sibling of `tailRings` (fur) and `tailTip`
  (one band): all three paint the EXISTING tail rings, so shape and marking compose freely — a fox
  brush with a white tip, or a raccoon ringtail with N dark/tan bands, are the same volumized chain
  plus a different colour lever. Reach for fur (`tailRings`) only when the tell is genuinely shaggy.

  **LESSON — "locked" is not "good"; re-judge old species against the bar the kit can now hit.** Two
  generalizable yields: (a) **a recipe that sets no `fleshCfg` silently inherits the bear-weight
  default** — every non-bear clade should declare its flesh weight (lean canid/cat/procyonid vs heavy
  ursine/stumpy), or it reads bulky; this is the flesh-tier sibling of "pick the nearest archetype
  and SCALE it." (b) **dark coats render near-black** — the lit-mesh shading darkens the base hex a
  lot, so a mid-grey animal needs a LIGHT base hex; judge the coat from the RENDER, not the swatch.

- **wolf** — RETRIED reference-grounded (Eurasian + Kolmården views) after the fox built the
  levers. `canine` scaled tall/deep-chested + big broad `skullCfg`, grizzled grey-tan coat,
  PALE countershaded underside (`underHex`), pale muzzle (`facePaint`), ROUNDED ears
  (high `earTip`), muted feet, bushy LOW tail with a DARK `tailTip`. ACCEPTED (1 tune: coat
  too dark + muzzle too long). **LESSON — the kit COMPOUNDS:** the 2nd species needed ZERO
  new primitives; every fox lever transferred and just took wolf values (cream not white belly,
  dark not white tail-tip, rounded not pointy ears). After a species or two of building levers,
  later species collapse to "turn the knobs" — the loop gets cheaper, which is the whole point
  of recording lessons + adding only GENERAL levers.
- **fox** — `canine` + `armatureCfg` (vulpine scale) + short pointed `skullCfg` + rusty coat
  + white-muzzle `facePaint` + big dark-backed ears + bushy low tail + **white `tailTip`**.
  ACCEPTED. Reference-grounded (Wikimedia side + head views). Rendered through the CHARACTER
  BUILDER (`renderAnimalToSvg` in figure-render.js reuses the figure mesher — no 2nd renderer).
  Later added: POINTY ears (low `face.earTip`), DARK feet (`footCfg.stroke`), and a WHITE
  underside throat→chest→belly via COUNTERSHADING (see below). Remaining wall caveat: the
  socks don't run up the lower leg (feet only), and any true PATCH pattern (stripes/spots).

  **THE LESSON (the loop's single output for this iteration):** the fox's iconic feature is
  its TAIL, and we carried it as a **3D VOLUMIZED SHAPE interpretation of an iconic decorative
  point** — not a flat colour marking. Concretely: a low-poly **teardrop brush** (the chain's
  new `bulgeR`/`bulgeAt` radius profile — narrow attach → fat belly → pointed tip, tapering
  into the rear) + a 2-tone `tailTip` for the white tip, all over the EXISTING tail chain.
  This adds a THIRD decoration register to the abstraction below: alongside (paint) and
  (locks/decorators), an iconic tell can be a **reshaping of an existing volume**.
  NOTE: a gap-closing welded-skin pass (raised `blend`/`bound`/resolution/`jointFill`) was
  tried and REVERTED — it over-inflated the body and the wider `bound` swallowed the front
  feet. Closing the `animalSkin` limb↔body gaps cleanly needs the real fix (marching-cubes
  watertight; see figure-animal.plan.md), not knob-cranking. The default skin stands.

## Build log — systemic fixes (not per-species)

- **The DORSAL NAVEL SEAM — the spine bridge (DONE; the open seam from the neck-bridge log).**
  The welded body skin surfaces the torso as TWO independently-marched tubes — the thorax axis
  (`neckHub→navel`) and the belly axis (`navel→pelvisHub`) — each laying cross-section rings
  perpendicular to its OWN direction. Where they meet at the navel they are ANGLED (back-arch /
  belly-drop), so on the convex dorsal side each tube's rings curve AWAY from the corner → a
  NOTCH in the topline. Faint on the bear; on the raccoon's hunched back it split the body into
  two masses. Root cause = a SURFACING artifact, NOT a field hole: the SDF (smin-unioned) is
  smooth there. Fix: a `spineBridge` axis (figure-animal-skin.js) marched ACROSS the junction
  through the SAME smooth field — its continuous rings wrap the kink and close the cleft. Default
  ON (it's a fix, not a species lever); verified it CLOSES the seam on raccoon and LEAVES bear /
  fox / wolf toplines clean (no regression).

  **LESSON — a clean field can still surface dirty at a kink; the fix is a spanning axis, not a
  bigger fillet.** When two independently-marched axes meet at an angle, the gap lives in the
  PARAMETERIZATION (each ring ⟂ its own axis), not the geometry. Cranking `blend`/`jointFill`
  inflates the whole junction (the reverted fox skin-pass trap); the right move is one more axis
  laid THROUGH the join, re-surfacing the same field continuously. Same move as the neck→head
  bridge and the rump cap — a spanning axis closes a join the per-segment tubes leave open.

- **Hind-leg angulation (shared armature fix).** A deviation seen across MANY mammals — hind
  limbs sat too far forward (near-straight posts, foot pushed forward by the paw) with an
  over-long lower segment — because the archetypes had near-zero `hindFootBack` (a holdover
  from protecting the vajra read, moot now the body renders as SKIN). Fixed at the SHARED
  level (`QUADRUPED_DEFAULT`), then refined against a reference sketch: the thigh must drop
  from the RUMP and the foot sit UNDER/behind the hip — NOT splay forward under the belly. Final
  digitigrade default: only a MODEST stifle-forward (`hindKneeFwd` 0.03 — keep the thigh against
  the rump), hock pulled well BACK (`hindFootBack` 0.12 — foot trails under the hip), moderate
  hock height (`hindFootFrac` 0.16). (First attempt over-did stifle-forward 0.07 + a high hock
  0.20 → the leg splayed forward off the rump; the fix was LESS forward, MORE back.) A second
  pass tried `hindBack` (shift the hind-leg GROUP rearward) but that pulls the hip off the fixed
  pelvis and STRETCHES the thigh connector — capped ~0.04. Then `pelvisBack` (move the whole
  hindquarter back together) — which turned out CAMERA-INVISIBLE: translating pelvis+hip+tail+foot
  as a unit just shifts the whole shape, and the self-framing camera re-centers it → "looks the
  same." Reverted to 0. The angulation tweaks (modest stifle-forward `hindKneeFwd` 0.03, hock
  back `hindFootBack` 0.12, `hindFootFrac` 0.16) stay — they DO change the leg shape. Propagated
  by ANATOMICAL CLASS, not uniformly: **digitigrade** (canine/feline) take the strong default;
  **plantigrade** (ursine/raccoon/rodent) get a MILD hock-back (0.04, heel stays low —
  flat-footed); **unguligrade** (equine) pinned to a moderate 0.05.

  **LESSON — locate the fix at the right ALTITUDE, and respect anatomical CLASSES.** A defect
  that shows up across many species is an ARMATURE-default bug, fixed ONCE in
  `QUADRUPED_DEFAULT`, not patched per-recipe (per-recipe would be N copies of the same fix
  that drift). But "shared" ≠ "uniform": propagate along the natural classes
  (digitigrade / plantigrade / unguligrade), since the right value differs by class. This is
  the armature-tier sibling of the decoration-tier "add only general levers" rule — both keep
  the fix DRY and let later species inherit it.

- **Hind-leg SEGMENT geometry — the femur clock-angle + femur:tibia ratio (the actual fix).**
  A hind leg "sitting wrong" was chased through THREE wrong tiers before landing: (1) leg-group
  POSITION (`hindBack`/`pelvisBack` — the latter a camera-invisible no-op), (2) body FLESH (a
  "lean canid" profile — also wrong; the operator wanted the OLD fuller body), and finally (3)
  the LEG's own SEGMENT geometry, which was it. The operator's anatomical read nailed it: the
  FEMUR (hip→knee) was angled FORWARD (~4 o'clock) and too LONG relative to the tibia. Fix:
  femur VERTICAL (`hindKneeFwd` 0 → ~6 o'clock) and SHORTER by raising the stifle
  (`hindKneeFrac` 0.55→0.62 → short femur, long tibia, the canid ratio) — a vertical femur forces
  the tibia to angle BACK to a low hock → the natural sigmoid.

  **LESSON — a limb is FOUR separable things; diagnose which one.** (a) attachment POSITION,
  (b) segment ANGLES (clock o'clock), (c) segment-length RATIOS, (d) THICKNESS (flesh). "Leg
  looks wrong" is ambiguous across all four; we burned passes guessing (a) and (d) when the
  answer was (b)+(c). When the operator speaks in anatomical reference ("femur at 4 o'clock",
  "femur:tibia ratio too extreme"), that IS the tier pointer — take it literally. Corollary
  still stands: confirm a change actually CHANGES THE RENDER (the `pelvisBack` translate-trap).

  Final tuning (operator drew the target leg as a green overlay): hock pulled back so the foot
  lands UNDER the rump (`hindFootBack` 0.16 default). CAVEAT — these joint offsets are ABSOLUTE
  STAND units, so the SAME value is proportionally bigger on a small animal: 0.16 over-kicked the
  fox (backHeight 0.34) while reading right on the wolf (0.46). Fox dials its own down
  (`armatureCfg.hindFootBack` 0.11). LATENT FIX (deferred): make the joint-bend offsets fractions
  of backHeight so they scale with size and stop needing per-small-species correction.

- **The HAUNCH — the protoform's one structural blind spot (and why it's NOT a mistake).**
  The operator flagged a persistent "secondary rear": the rump sat as a separate mass behind a
  thin hind leg, with no back-extension. Root cause, confirmed in the code: the animal armature
  inherits the HUMAN per-node radii (`pelvisHub` 0.043, hip ≈0.05, knee 0.024) — a *discrete thin
  limb off a compact pelvis*, the human topology. A quadruped's hindquarter is the OPPOSITE: one
  continuous BACK-SWEPT haunch (the "ham") where the femur is buried in muscle and the mass flows
  spine→rump→thigh→knee with no seam. We never modelled that mass → rump-cap + leg-tube read as
  two things. Fix (targeted, kept the protoform): a `haunch` primitive in the welded skin
  (`figure-animal-skin.js`) — a big sphere per hind side over the upper femur, biased REARWARD
  (`haunchBack`) + up (`haunchRise`), sized off the rump radius, dropped into the SDF field so the
  femur axis + rump cap surface it as one continuous ham. Verified lean (fox) + heavy (bear).

  **LESSON — the bootstrap (human protoform) was right to keep; patch the ONE place it fights the
  target, don't rewrite.** Deriving the quadruped from the human protoform bought the entire
  substrate (spine reorientation, fore limbs, head/skull/foot/face, the flesh+skin renderer) — all
  correct and reused. It has exactly ONE structural blind spot: the hindquarter, the one region
  where quadrupeds are radically un-human (integrated haunch vs discrete leg). The right move was a
  targeted quadruped-native ADDITION there, not discarding the bootstrap. Also note this explains
  why the long hind-leg saga (femur angle/ratio/hock, §"Hind-leg") only ever half-worked: those
  were BONE-tier tweaks to a problem whose missing piece was a FLESH-tier MASS (the ham). When
  several tweaks at one tier each half-help, suspect the real fix is a missing thing at another tier.

- **THE ROOT-CAUSE BUG — quadrupeds were balanced as bipeds (hind legs slid forward).** The
  entire multi-pass hind-leg saga above (femur angle, ratio, hock, haunch, pelvis shift — each
  only ever half-working) had ONE cause: `groundedFeet(foreMode)` returned the 2-foot BIPED set
  whenever `foreMode` was unset, and the resolved cfg from a string/merged archetype does NOT carry
  the DEFAULT `'ground'` → `cfg.foreMode === undefined` for EVERY quadruped. With a 2-foot base,
  `balanceFeet` (figure-animal-ground.js) slid the hind feet + knees FORWARD under the COM (which
  sits forward, in the chest/head) — so the armature's correct vertical-femur/back-hock was
  overridden and the legs jutted forward of the rump. Fix: `groundedFeet` treats ONLY explicit
  `tuck`/`wing` as biped; everything else (incl. undefined) is a quadruped on all fours. Instantly
  fixed fox/wolf/bear/raccoon — the hind legs now sit exactly where the armature puts them.

  **LESSON — when N parameter tweaks each only HALF-work, stop tuning and INSTRUMENT the pipeline;
  a downstream stage is overriding your input.** The tell was unmistakable in hindsight: every
  change moved the leg a little but never to where the math said it should be — because a later
  stage (`balanceFeet`) was silently rewriting the node positions. Printing the actual PROJECTED
  joint coordinates (a 15-line debug probe) found it in one shot, after ~8 visual-tuning passes
  failed. Guessing at knobs can't find a bug that lives between the knob and the pixels; measure
  the value at the stage you suspect. Also: a default that only applies via one code path
  (`quadrupedNodes` merges `QUADRUPED_DEFAULT`; the returned `cfg` does not) is a latent trap —
  `undefined` silently took the wrong branch. Defaults should resolve once, at the source.

- **Skull-size pass (SKULL_PRESETS, relative to the default body).** The head is the `protoSkull`,
  sized by `SKULL_PRESETS[name].length/width` INDEPENDENT of the body, so it drifts. Rendered all
  12 archetypes on their current bodies and enlarged the ones reading too small for their build:
  rodent (0.12→0.155, big-headed), feline (0.12→0.145), theropod (0.27→0.31 — the massive-head
  tell), ursine (0.18→0.195, broader), equine (widened 0.046→0.054), raccoon (0.13→0.14). Left the
  correctly-small heads (avian/sauropod/gazelle/raptor beak/tiny-head) and the proportioned ones
  (stumpy, canine). fox/wolf carry their own `skullCfg` so they're unaffected. NOTE for later: a
  separate issue surfaced — the welded skin doesn't bridge NECK→HEAD on the built-in head-bone
  archetypes, so the muzzle reads slightly DETACHED (a gap at the throat). That's a skin-connection
  fix (extend the neck/throat field or surface the neck axis to the skull), NOT a skull-size knob.

- **Neck→head bridge (DONE — detached-muzzle fix).** The welded skin covers neck+body but passed
  `skull=null`, so the neck tube ended at `headBase` while the `protoSkull` cranium sat forward →
  a gap at the throat. Fix: `buildAnimal` now passes a `headBridge` (cranium centre + radius from
  the resolved skull) into `animalSkin`; `buildField` drops the cranium sphere into the SDF and
  SURFACES a throat cone from `neckHub` up to it, so the neck skin sweeps into the head and meets
  the protoSkull (still the visible head). Gated to `skin && !neckCfg` — chain-neck archetypes
  (sauropod/theropod/raptor/avian) already root their neck tube in the field, so they skip it.
  Verified across feline/ursine/equine + fox/wolf. (Remaining: a faint DORSAL seam at the navel
  where the thorax/belly axes meet — a different welded-skin patch seam, still open.)

- **Face study — capability + first findings (fox/wolf).** Added `crop:'head'` to
  `renderAnimalToSvg` (filters the assembled parts to the upper-forward head region, frames a
  face close-up). Studies live at `integration/0629/.../face-<species>-{front,3q}.svg`. Read
  against real face refs (Wikimedia), the defining FACE tells split into SILHOUETTE vs MARKINGS:
  - **wolf:** silhouette = a CHEEK-RUFF diamond (fur flares at the jaw, face wider at the cheeks
    than the cranium — the #1 wolf-face tell); markings = pale muzzle/chin + a subtle dark
    eye-mask + a pale forehead blaze. OURS has the pale muzzle but is a smooth grey oval — MISSING
    the cheek ruff and the eye/forehead pattern.
  - **fox:** silhouette = a SHARP NARROW TRIANGLE (pointed muzzle, big pointed dark-backed ears);
    markings = rusty crown/cheeks + clean white muzzle→under-eye. OURS reads too ROUND (skull
    needs narrowing) though the white muzzle + dark ears land.

  **What the face study unlocks (the gap it exposes):** two reachable face primitives we don't yet
  wire — (a) a CHEEK-RUFF / facial tuft (the `mane` lock primitive as a small cheek cluster: gives
  the wolf/lynx/lion face its frame and is the single biggest face-silhouette lever), and (b)
  sharper face SILHOUETTE via per-species `skullCfg` (narrow the fox). The fine facial PATCHES
  (eye-mask, forehead blaze, cheek spot) are the patch-colour WALL. **LESSON — study the face as
  its own object (silhouette + marking-zones), not as a byproduct of the body render;** the
  full-body view hides exactly the cues (cheek ruff, mask) that say "wolf" vs "generic canid."

- **Welded skull — the jaw wraps into the face (DONE).** protoSkull emitted the lower jaw as a
  SEPARATE swept cone slung below the muzzle → it read as a loose floating bar with an open gap
  (a detached jaw). Fix: a `weldedSkull` (figure-animal-skin.js) — cranium + muzzle + jaw (+ beak)
  built as ONE SDF and marched along the head axis into a single wrapped head skin, with the jaw
  RAISED to overlap the muzzle (so the down-march reads continuous) + a cheek cone fusing the
  hinge. The mouth becomes a crease, not a gap. Returns ONE ring-stack (cranium→nose order), so
  the existing `facePaint` s-split colours it unchanged. Used on the hero `skin:true` path;
  overlap-flesh keeps the cheap separate-part protoSkull. TRADE-OFF: the weld marches ROUND
  cross-sections, so protoSkull's superellipse `boxy` snout flattens to a rounder muzzle — the
  price of one welded head; revisit with a boxy SDF section if a square snout matters for a species.
  Verified: canine/ursine/equine head crops + fox/wolf full + the face studies — solid cohesive
  heads, no loose jaw. (Same welded-vs-separate-parts move as the body skin and the neck bridge.)

## Open questions for the operator

1. Roster scope — is the Phase-1 list above the right "most recognizable" set, or
   trim/extend it?
2. Acceptance bar — who judges "reads as the species": the loop self-judges via
   view-svg, or every species pauses for your eye? (Self-judge = real loop; pause =
   assisted.)
3. When the loop hits the PATCH-colour wall, stop and build that primitive together
   first, or keep deferring patterned animals to a later batch?
</content>
</invoke>
