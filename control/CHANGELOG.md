# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `3.0.0` the media, game, connected-service and app loops and the recipe
format are the stable surface, and the chatbot factory is no longer part of
mojulo. From `3.1.0` the connected-service and app tools are no longer listed:
they still answer by name (the CLI, plan steps, skills that name them). The dashboard package, `mojulo-ui`, is released at the same version.
Releases up to 2.1.0, and the detailed log behind 3.0.0, are archived in
[CHANGELOG-2.x.md](CHANGELOG-2.x.md); the detailed log behind 3.1.1 is
[CHANGELOG-3.1.md](CHANGELOG-3.1.md).

## [Unreleased]

### The realistic hero's face: rolled, bounded, aimed

- A REALISTIC HERO WEARS A COMPOSED FACE (face-compose.js, from face harmony): `face: { seed?, ethnicity?, want?,
  character?, accent?, nose?, beauty?, age? }` on the realistic body's relational head. Minted with no face, it ROLLS
  one: the seed, the ethnicity (every base population and the mixed) and, with no `cast`, the sex, stamped into the
  record so it rebuilds as it was (layered.js `withRolledFace`). Named words BOUND the roll (an ethnicity, a list of
  them for a mix, a cast) and the rest TUNE it. The baseline is HEROIC (`HERO_FACE`): the face drawn toward its
  population's harmonious mean (beauty 0.75), at prime age. A remake keeps its stamped face unless the order names one.
- AIMED: `want: { feature: shape }` takes the shapes named in place of the roll's (composeFace's new `want`); every
  feature still rolls, so the rest of the face is the seed's and a face liked can be kept and aimed piece by piece.
- On every read the face's relations and eyes shape the relational head (on the pole's own tune: solving one per face
  costs most of a minute), and its skin lies under the hero's own `skin`: the ancestry's tone, undertone and hair
  colour, the hairline, marks, a beard, the years. The face rides `recipe.headFit`, so an export's skin charts the head
  the face shaped. The readout's `hero.realisticFace` says what was rolled (the picks, the character, the ancestry).
  The composed cut, brows, lashes and piercings are read there but not yet grown on the hero. A hero without a face, and
  every other form, is as it was.

### The tiered game body: the default at mint

- THE GAME BODY IS THE TIERED FORM: a hero minted with no `form` is stamped `form: 'tiered'` (motion-stamp.js
  `withDefaultForm`, beside the calibrated walk), at the door, on a design run's remake of a new figure, and on a world's
  new inline hero; every build and cast takes it (heroic, brute, lithe, stout, canonical, child, chibi, both poles). A
  hero stored without a form keeps the body it was minted on, byte for byte, and a remake keeps the stored hero's form.
  The body before it is a word now, `form: 'classic'`, and is deprecated with the streamlined core: still read, and a
  hero on it (named, or stored without a form) is told so on its readout's warnings.
- THE TIERED BODY IS SHADED SMOOTH wherever it is drawn: under the character light too (the anime head's look), at the
  tiered crease (`TIERED_SMOOTH_CREASE`: the skin and the body's colour groups blend across 70°) where it took the
  35° default and showed its limbs' eight facets; one helper (tiered-form.js `heroShade`) gives the World and the body
  study the same crease and head ellipsoid. The anime head's body is the tiered form at mint, as every new hero's is.
- THE ROUND CHILD (hero laws 14, anime-looks.js `CHILD_FACE.round`, tiered-form.js `CHILD_SHADE`): the child's
  jaw and chin rounder, and its figure shaded round so its facets don't read as folds. The chin is broader, shorter
  and set back, the jaw broad with its corner high, and the lower cheeks full over the jaw line. The boy's chin is no
  longer narrowed, which drew it to a point under laws 13. Its body and clothes blend across 85° (the tiered body's
  70°), and its anime face leans 0.85 of the way toward the head's capsule (0.5 on any other face), so the cheeks and
  the jaw take the light as one round form. Laws 13 children are as they were. The body study frames a large head
  (the chibi's or the child's) by its own height.
- THE CHILD FORM (hero laws 13, hero-form.js `CHILD_FORM`; anime-looks.js `CHILD_FACE`): the child drawn as the anime
  child reads, on the chibi form's base. Its limbs are cylinders, it has no pectoral, mitten hands, round shoes and a
  short neck. It is rounder: a barrel torso (the waist as wide as the chest, each section toward round) and fuller
  arms. Its shoulders are narrower, and with a larger head on shorter legs it stands about three and three-quarter
  heads tall. Its anime face is the child's, under any look or the hero's own words: a short lower face, full cheeks,
  a small set-back chin, a button nose, a broader head, and eyes set lower, opened taller and with larger irises, a
  narrower mouth and a thinner brow. On the boy, the male base's long jaw and forward chin are brought toward the
  female base's. The bare `child` word is now the child build, as `chibi` became the chibi build under laws 6, and a
  child minted without a head wears the anime head, as a chibi does. Its dress is the chibi's few pieces.
- THE ADULT-FORM CHIBI, PINNED (`chibi-adult-form.char.test.js`): the laws 12 chibi's record, plan and recipe, bare,
  in the ranger kit and in the knight's plate, byte for byte; laws 13 builds it the same.
- THE CHIBI FORM (hero laws 12, hero-form.js `CHIBI_FORM`): the chibi reads as simple solids, not a small adult.
  Its limbs are cylinders: no muscle shaping, each limb's rings drawn most of the way to their mean radius, the ankle
  as full as the calf and the knee as full as the thigh. Its chest has no pectoral layer. Its head is larger and its
  legs, arms and neck shorter, so it stands about two and a half heads tall with its hands at its hips. Its hands are
  small mittens and its shoes short and round. Another cast is as it was.
- THE CHIBI'S DRESS (hero laws 12, hero-dress.js `CHIBI_DRESS`): a body that small cannot carry every piece, so the
  chibi wears only the pieces that say what it is. The ranger kit is its belt and its bossed pauldron, drawn bolder
  and thicker. An armour build keeps each family's own few pieces (plate: the pauldrons, the breastplate, the greaves;
  lamellar: the dō and the greaves; the hard-suit: the cuirass, the pauldrons, the boots), never a helm over the face,
  with fewer, larger lames and no ornament. The build's own dials still win. The plan says `style.body: 'chibi'`, so
  what it wears reads it; no other plan says it, and every other kit and suit is as it was.
- THE CHIBI'S CHEST (hero laws 11, hero-form.js `CHIBI_CHEST`): the chibi's chest is wider (×1.25 over the build's)
  and deeper (×1.3). It meets the shoulder's ring, which the shoulders' span sets, where laws 6 to 10 stepped out to
  it in a shelf two centimetres tall, front and back. It stands as deep as the belly under it, where it was pinched
  behind the shelf. Another cast is as it was.
- A CHIBI WEARS THE ANIME HEAD at mint (motion-stamp.js `withDefaultForm`): a chibi minted on the tiered body without
  a head of its own is stamped `head: 'anime'`. It keeps the landmark head when it says a word only that head reads
  (`face`, `hair`, `expression`, `headPreset`, a clip's `face`). A stored chibi keeps its head.
- THE WEB'S ARMPIT (hero laws 10, tiered-form.js `WEB_ARMPIT`): the fold under a raised arm closed. The web's
  under-arm slots (its side, back and front toward the trunk) follow the arm more than the rest of their ring, so a
  raised arm stretches that side instead of folding it back behind the armpit. The cone's slots turn half a slot, off the fold's own axis, where its front and
  back slots creased. It reaches less far toward the neck, and its weights hand the collarbone to the fold over its
  length rather than at once. Its rings past the ball turn the in-ball ring onto the arm's way, so it does not twist
  where it enters the arm, and sit a little inside the arm. Its upper slots stay with the trunk over the chest, and
  its base sits deeper in the torso. Measured on the male with both arms up and forward: no face of the cone or the
  web folds over, where laws 9 folded one. Laws 9 rows are as they were.
- THE SHOULDER CONE (hero laws 9, tiered-form.js `SHOULDER_CONE`): the web's inner fairing, in its group and skinned as
  it is (the collarbone at its base, the fold at the ball), its rings square to the way from the ball toward the neck's
  root: from one hidden in the ball to a wide, flattened base held inside the torso's own section. Its upper half rides
  just over the torso's skin where it would sink under it, so the torso's faceted shoulder corner (the pectoral's top,
  the trapezius' slope, the shoulder blade) runs into the ball closed; its sides stay under the skin and its underside
  draws in toward its centre, so it never spans the armpit. Past the ball it runs on INTO THE ARM, round the arm's own
  axis inside the web at rest, to inside the arm's belly ring, its weights handing the fold to the arm more slowly than
  the web's: a raised arm's root, which pulled away from the torso's shoulder corner in a V, stays joined to it. The
  ball is drawn in under the web and the cone (its centre kept), so a raised arm no longer shows it as a jagged band;
  and the web hugs the arm before it ends (its last ring before the arm's on the arm's own way down) where it met the
  arm at an angle and showed the meeting as a crease. A small fold remains behind a raised arm's armpit.
- THE SHOULDER WEB (hero laws 8, tiered-form.js `SHOULDER_WEB`): a sleeve of skin in the arm's own colour group (the
  top's tone under a shirt, the skin on a bare arm) over the tiered shoulder's ball, from inside the torso's shoulder
  through the ball's equator to the arm's own belly ring, where it ends on the arm's points and welds into one surface
  with it. It rides the collarbone, the shoulder's fold and the arm by ring, so it stretches as the arm swings, and it
  splits with the arm's chain at a target that splits the arm. The ball reads as the deltoid's swell instead of a knob;
  a tiered hero stamped before keeps its ball bare.
- THE TIERED LIMB END (hero laws 7, tiered-form.js `tieredJoints` `respace`): a lofted limb stopped short of its bridge
  (the thigh, at the knee) carries its shaping rings with its end, each by its share of the run, so its last span keeps
  its length. Laws 1 to 6 left them, and the man's thigh ended in a centimetre-long span: a knight's knee guard built
  over it splayed past half a metre on the default body. A tiered hero stamped before keeps its thigh.
- THE TIERED FORM HOLDS THE BUST'S CEILING (hero-form.js `bustCeilingError`): it builds its plan bare and profiles the
  bust after, so a runaway `body.bust` passed it silently; it is refused by the same words heroPlan says. And its plan
  carries no −0 (a stored plan reads it back as 0, so a regenerated plan matched the stored one only by its bytes).
- `core: 'streamlined'` IS DEPRECATED: still read on a hero that names it (the classic body carries it; a new hero that
  names it is not stamped tiered), and said on its readout's warnings; drop `/hero/core` for the game body.
- A FLAT CAP CLOSES ITS PART (station-loft.js): each cap now winds against the ring edges it shares with the bands, the
  bands alone judged by their geometry. A cap whose point sits on its ring's own plane (the tiered form's joints and
  bridges, where each limb ends on the ring the bridge begins on) had been wound by a coin toss, eight to sixteen faces
  wound against their neighbours on the upper arms, forearms, thighs, hands and every bridge; every pointed cap winds as
  it did.
- A HEELED STANCE PASSES THE RIG GATE (station-loft-rig.js `auditRig`): the planted toe is read on the shoe's forepart
  sole, `stance.toe` up, where the solver stands it; a footwear card with a heel on the game body (pumps, stilettos)
  was refused at mint with a planted drift of exactly that lift.
- THE CHIBI (hero laws 6, hero-form.js `CHIBI`, `lawCast`): the bare `chibi` word reads as the chibi build on the male
  pole (its child radii), with the head larger (`headScale` × 1.15 over the build's), the arms thinner (× 0.9 over the
  build's radius) and the neck that carries the head fuller (× 1.45). Laws 1 to 5 stood the bare word on the adult
  radii, a man's arms and a head no bigger than his; a chibi stamped under them keeps it.

### Realistic catch-up: adults only, one set of primitives, the realistic body's gaps

The realistic body depicts adults; the wearable libraries and the tailor share one set of primitives; the realistic
body catches up to what the authored one wears, and its principles are shared back.

- ADULTS ONLY: a child-coded hero asked of the realistic body (a child or chibi figure cast, or the anime 'kid' look)
  is that cast's stylized western figure instead (`adultsOnly`, the first step of `validateHeroSpec` and `heroRecord`):
  its colours keyed the same (the realistic skin's colour, as the dermis reads its tone, the palette's `Skin` unless the
  palette names one; every palette key as given), the realistic body's own keys left off, its dress as asked.
- ONE SET OF PRIMITIVES: the tailor re-exports the footwear library's `soleSlab`, `strapBand`, `buckleOn` and
  `bindNearest` (its own copies had drifted from them; the library's are the superset, its `buckleOn` now taking a
  slot's name as the tailor's did); both byte pins unchanged.
- docs/realistic-body.md says what the body wears and still refuses as the tree has it.
- HANGING PIECES OVER THE TAILOR'S CLOTH: a panel (coat-tails, a tabard's apron), a cape and a hood on the realistic body
  hang over the cloth the tailor made, not the skin under it. A hull piece takes `over` (more parts it hangs over beside
  what is worn on its body parts; absent, as before): the realistic path hands a panel the trunk's and the legs' cloth,
  a cape and a hood the sleeves' too, and keeps those names where it had filtered `over` to the skin's parts (a cloak had
  shown the jacket through at the shoulder and the elbow). A jacket cut at the waist (a tailcoat's, a spencer's) raises
  its stance till its last button is 3 cm over the hem: below the cloth the front had no surface, and its lapel and
  button were thrown a metre out. The authored pins unchanged.
- THE WAISTCOAT: the outfit language's `waistcoat: true | { front: single | double, buttons: 3–6 }` puts a waistcoat
  between the shirt (and its tie) and the jacket, from the chest to below the waist, the jacket eased over it, worn
  without a belt; a `Waistcoat` tone (the jacket's unless the card names one). On the realistic body the tailor gives it
  its V (narrower than a jacket's, so it shows between the lapels), its buttons down the middle (two rows,
  double-breasted) and its ARMHOLES, painted the shirt's and laid on the shirt slot by slot (`armholes`): taken in under
  the shirt they had stood out as shards, laid on a reach measured over a window of heights they had creased the jacket
  over them. The jacket's V walls over it read as the waistcoat. A seeded card `threepiece`. Cards without the word
  byte-identical (both pins unchanged).
- STATUES ON THE REALISTIC BODY: `statue` is no longer refused there. Every card and format carves: one material over
  every group, no dermis (stone is not skin), a lost head (and a torso study) taking the realistic head's own parts with
  it (the face and the nose, bound to the head beside the plan's head parts), a bust without the upper arms' stumps
  (the torso carries the shoulder; a stump cut from the deltoid's rings stood out as a disc). `detail` stays refused,
  its refusal now saying an outfit dresses this body. The authored statues unchanged.
- docs/realistic-body.md said no exporter carried the correctives and the body had no UVs; both have been in place
  (the skinned GLB's corrective morph targets with their weights baked per clip key, the skin's UV atlas). It says so
  now, and what is still missing: an engine-side driver, so a pose the engine makes itself gets the correctives.
- THE OUTLINE READ ON BOTH BODIES: the dressed outline (dress-outline.js: the family against the bare body's, each half's
  fit, the returns, the divisions, the flair, the advice in each canon) is read for the authored game body's heroes too,
  in the hero's readout beside its ring-for-ring silhouette; a figure it cannot read goes without it, never refused.
- THE LANDINGS MEASURED ON THE GAME BODY: the stylism's proportion stage judged every length word by where it lands on
  the realistic body. Measured on the authored game body (`GAME_LANDINGS`), a top's and a coat's hems from the waist to
  the tunic land 4 to 5 hundredths lower (its trunk is longer for its height), enough that under the anime canon's leg
  line a top worn out at the hip, kept on the realistic body, is moved on the game body; the stage now judges by the
  body the hero is on. Down the leg the bodies agree within about two hundredths. The measuring found a cropped woven
  top refused on the game body (its buttons placed below its window); its row now starts on it.
- ONE CANON ACROSS THE WEARABLES: the footwear, handwear and plating libraries' principles each end on the same law, the
  canon is the outfit's (the dressed outline's western | anime): no library carries a canon of its own, and what each
  canon asks of its pieces is the garment principles' (a boot, a gauntlet's cuff, plates standing out among the anime
  flair pieces; the feet in the value gradient). The outline read measures that gradient now (`values: { chest,
  feet }`, the shoe's L* against the chest's front) and the anime canon reads it (`gradient`: dark shoes under a light
  chest).
- WHAT THE GAME BODY WEARS, SAID: the authored body wears the handwear library's gloves (its own adapter) and every
  footwear card as plain boots, shoes or sandals; the tailoring words, the plated suits and the footwear cards' own cut
  are the realistic body's. The hero readout now says so (`realisticOnly`) where it had worn them plain or dropped them
  in silence; nothing refused.
- FOOTWEAR CARDS ON THE GAME BODY: every footwear library card past the plain boots, shoes and sandals is the library's
  on the authored body's structured core too, through an authored foot adapter (`footwear/adapters/authored.js`). The
  plan keeps the bare foot (hero-foot.js, the same proportions) under the card (`heroPlan({ feet: 'bare' })`); the
  library reads it up to the toe base, the five toes as one block from that ring on, the leather stood off past the bare
  foot near each ring; a heeled card stands the rig in its stance, as on the realistic body. A closed shoe's foot is not
  drawn (the game foot's boxy sections stood past the toe cap the library tucks the leather under); a sandal's straps and
  sole are on the bare foot. The library takes an adapter's `facets` (a share of its reference resolution: sole and
  heel outlines, the toe cap, the wraps), the game body's half; absent, as drawn, the realistic pins unchanged. The
  plain words and the outfit cards' `feet` keep the kernel's shoe, byte for byte; the streamlined core keeps the plain
  base, said in the readout.

### Unified character: the face harmony's work in the realistic character depictor

- PIERCINGS ON THE HERO (polygonizer/hero-head-layers.js `heroJewellery`): a realistic hero's composed face's piercings
  (face-compose.js's roll) are grown on its head: the head rebuilt from its fit, pierced on its own chart
  (epidermis/dermal-jewel.js), mapped into the hero's frame and carried as a pinned part on the visage (`jewel`; the
  lower lip's labret and lip ring `jewelJaw`, on a face the jaw alone carries, so they follow it), each piece's group its
  metal's or its gem's (`JewelGold`, `GemRuby` …) with its colour in the palette under the hero's own. A hero with no
  face, or a face that rolled none, wears none. The readout's `realisticFace.notYet` no longer lists them.
- THE SCALP ON THE HERO, A GRASS HAT (hero-head-layers.js `heroHair`; dermal-hair.js `grassHat`, `bladeOf`,
  `GRASS_HAT`): the stylized meadow's way (vegetation/grass.js) on a head. The scalp is planted as a lawn, a blade from
  a root every few millimetres (growScalp's strands at that gap: combed down the head, cut by the stylist, hung by
  their weight, a curl's wound by the lock's keratin hand), each blade a wedge tapering to a point that keeps its
  strand's shape over the top of the skull and thins along its fall. Dense at the roots, the blades overlap into one
  dark mass, and their ends read as the strands; coloured up a ramp root to tip (`HairRoot`, `HairShade`, `Hair`,
  `HairTip` from the hair's colour as the eye averages it), a streak's blades `HairStreak`. Open, double-sided strips,
  pinned to the visage where the head alone carries it. The cut the face rolled, else its ancestry's with the face's
  hint over it; a buzz grows none (the painted scalp is the hair). A hero with no face wears none.
- THE TUFT'S BASE, A COAT (hero-head-layers.js `HAT_CAP`; dermal-hair.js `partDistance`): under the blades, the skin
  coated half a millimetre deep in the hair's root colour wherever the dermis grows scalp hair (`hairCap`, `HairRoot`:
  the hairline, a peak and a loss its edge, a bald crown left bare), the groom's part left open so it reads; under a
  styled beard the same where its locks grow (`hairBeardCoat`, the chin's `hairBeardCoatJaw`, `BeardRoot`). As a
  tuft's base reads solid, no scalp shows between the blades on a head that has not lost its hair, on any renderer
  (the World page colours by the palette and wears no skin texture).
- THE HAIR'S DEPICTION AND ITS SCORE (new epidermis/hair-depict.js `depictHair`, `stripMesh`, `capMesh`; new
  epidermis/hair-score.js `scoreHair`, `rasterize`, `strandMesh`): the grass hat's blades and its coat as plain meshes
  in the chart's frame, which the hero pins (hero-head-layers.js `pinMesh`) and the depiction solver measures: on the
  head it grows on, from the front, the lateral, the back and the top, its COVERAGE (the hair-bearing scalp seen bare),
  its BLADES' own cover (where the coat alone shows, the hair reads painted), its OUTLINE against the study's strands
  (IoU) and its faces. A buzz is now the coat (it grew nothing on the hero before). The dermis study's
  `hair-sweep.mjs` scores every style and draws them as a contact sheet.
- THE HAT'S LADDER, THE GRASS'S TRICK (dermal-hair.js `HAIR_LADDER`, `hairLevel`; layered.js `heroHairLevel`): fewer
  blades the smaller the head stands on screen, the survivors wider so the cover holds, as a tuft thins: `L2` every
  blade (a close-up), `L1` a third of them rooted 1/√⅓ as far apart and wider again (a sixth of L2's faces, the
  default), `L0` one broad wedge a comb guide (the outline). The rung is the head's height in pixels under the hero's
  `target` (era/target.js), L1 for a hero drawn for none; the beard a rung finer than the scalp. The readout's
  `realisticFace.hairLevel` says which.
- THE FACE'S HAIR ON THE HERO (hero-head-layers.js `heroFaceHair`): a styled beard's locks (dermal-hair.js
  growBodyHair) as a lawn as the scalp's, a wedge a few millimetres apart (`BeardRoot`, `Beard`), those under the lip
  line on a face the jaw alone carries (`hairBeardJaw`), the moustache's and the cheeks' the head's (`hairBeard`); the
  brows (a few hairs a card) and the lashes (a card a hair) from the epidermis, its grooms the ancestry's with the
  composed face's over them; `Beard` (its grey a third again), `Brow`, `Lash`. Stubble stays the skin's paint. The
  layers' colours lie over the plan's defaults and under the hero's own `palette` (a named `Hair` wins).
- THE FACE'S OWN FIT (layered.js `withFaceFit`, the mint's; hero-relational-head.js `relationalHeadRecipe`'s `tune`):
  the mint solves the realistic face's own tune for its composed relations (head-relational.js `solveTune`, ~45 s,
  once) and stamps it beside its words, `face.fit: { tune, of }` (`of` the relations' fingerprint), so the hero's head
  is the face the studies show, not the face on its pole's tune. It rides `headFit.tune`, so the skin (dermal-hero.js),
  the piercings and the hair chart the same head. A face whose words change since reads a stamp not its own and wears
  the pole's tune until it is minted again (the readout's `realisticFace.fit` says which). A hero minted before keeps
  the pole's tune, byte for byte, until reminted.
- dermal-hair.js `growScalp`'s `strands: false`: the guides and their cards alone, without the strands a render draws
  (the ladder's outline rung).
- dermal-jewel.js: each face of the mesh names its piece (`mesh.piece`); the wires are capped and the balls fanned to a
  single pole point, so every piece is a closed solid with no collapsed face (the hero's audit).
- dermal-hero.js: what the head wears of its own (`jewel`, `jewelJaw`, the hair to come) never counts as a garment over
  the body's skin.

### Face harmony: the female differentiated, the look standard, the lips' grain

- The dermis study's lineup takes subjects of its own (`--faces '[{ label, sex, relations, eyes }]'`, the wave's tune
  solved for each relation set), so a spike's relation sets read side by side, textured and lit; `--lineup-crop face`
  frames the face from the brow to the chin. The first study: the relational head's female pole differs from the male
  in the jaw's width and little else (the nose's root and dorsum, the chin's shape, the eyes' size are the male's), and
  relations alone move the eyes, the lips and the brow but cannot reach the nose's width, the chin's point or the lower
  face's taper.
- The relational head's HARMONIC SHAPES, relations the canon's ratios did not reach (head-relational.js `RELATIONS`):
  `chinWidth` and `chinRound` (the chin's width and its point), `dorsum` (the nose's bridge and root), `gonionDrop`
  (the jaw's corner), `cheeks` (the cheek's fullness), `lowerCheek` (the lower cheek bowed out over the jaw's body: a softer outline from
  the cheekbone to the chin), `masseter` (the jaw's muscle), `forehead` (the frontal bulb).
  Each is an offset from the canon, 0 the canon's own: a face moves from a natural one and never starts from a carved
  one (no hollowed cheek by default), and both poles' heads are byte for byte as pinned.
- face-harmony.js: `dimorphRelations(d)`, the relations `d` of the way from the male canon (0) to the female pole (1),
  −0.25 … 1.5 (a Nordic heroine's bone part of the way, her features the female's); `harmonyMeasures(head)`, calipers
  on the skin for the chin's width and its fall 10 mm out, the bridge's and the root's width, and the lower face's
  taper (the width at the mouth and at the gonions over the zygions'). A reading, never a refusal.
- THE FEMALE POLE moved (approved on the eyes gate): beyond the canon's sex cues, a shorter, less projected nose with a
  finer bridge and a narrower base, larger eyes, fuller and more forward lips over a finer philtrum, a lighter brow, a
  narrower jaw and a narrower, pointed chin that no longer recedes, the cheeks fuller and the lower cheek bowed out (a
  soft outline). Its tune re-solved; the female head re-pinned, the male's unmoved. The hero's eye part closes its
  outer rings in where they would cast past the face's side (a wider eye on a narrower face), eased over its neighbours.
- THE FACE COMPOSER (face-compose.js `composeFace({ sex, bucket, seed, character?, accent? })`): many faces that each
  hold together, never one face under different hair. Per harmonic feature (the chin, the nose, the lips, the cheeks,
  the outline, the eyes) a few named shapes (`FACE_SHAPES`), each offsets to the relations over the sex's pole and a
  point on two character axes (soft ↔ angular, delicate ↔ strong); a face rolls its point and takes the shapes near it,
  each pushed a seeded share, and may carry one accent taken from far off (a strong jaw under fine features). A bucket
  (`FACE_BUCKETS`) names the egocube ancestries its tone and hair are rolled from; `western` first. The dermis study's
  `--faces` subjects may name an ancestry and a seed.
- The composer's PROPORTIONS (`FACE_PROPORTIONS`): what differs person to person whatever the character, rolled after the
  shapes about the face's own values: the skull's length and breadth, the vault's height (the face's share of the head),
  the face's, the jaw's and the mouth's widths.
- The composer's EYE REGION: the eyes' shapes carry the lids (the eye rig's channels: open, large, almond, deep, hooded,
  soft), a brows feature takes the epidermis cube's groom words (natural, straight, arched, thick, thin), and the eyes'
  spacing, height, size and tilt are rolled per face; `composeFace` returns `eyes` and `epidermis` with its relations.
- THE ASIAN BUCKET (East and Southeast Asian ancestry): a bucket's `base` is the population's mean morphology, set before
  the rolls and measured against what the pole already does (after published East Asian anthropometry: a rounder vault,
  the inner canthi wider apart, a wider nasal base, a lower and flatter root, a broader bridge, a lighter brow ridge, a
  rounder forehead, the cheekbones forward). Its LID COVER is rolled per face (monolid, in-fold, parallel, hooded, by the
  egocube's weights) and owns the fold's channels (`LID_FOLD`) over the character's eye shape; never a slant. Shapes
  weigh per bucket. `FACE_LIMITS` holds a composed face inside the head's working range, measured by the tune's solve
  (the nose's projection, the cephalic index): a face asked past it is drawn at it.
- The composer's GROOMS (`FACE_GROOMS`): the brows' thickness and density and the lashes' density and length rolled per
  face as shares of their shape's numbers, after its face (a seed keeps its relations); a bucket may carry its own.
- THE NOSE'S AXIS (`FACE_NOSE`): one roll per face from a short, flat nose (less projected, shorter, smaller, its root
  lower, its base wider) to a long, pointed one, each bucket setting where its people sit on it and how widely they spread
  (`nose: { mean, spread }`: the western a little toward long, the asian toward short and flat, both reaching both
  ends); `composeFace`'s `nose` sets it. The relational head's `noseSize` (0 the canon's) scales the nose's own parts and
  their places with it, so a small nose is a smaller nose, not the canon's parts crowded; `TUNE_LIMITS` holds the tune's
  subnasale lift to the poles' own range (chased further, the nose's base rose ~18 mm and drew the upper lip into a snout;
  the miss is reported instead). Both poles' heads and tunes are unchanged; the head's floor on the nose's projection
  falls from ~0.265 to 0.2.
- MORE BUCKETS, from the same principles: `east-asian` (the bucket first built as `asian`), `south-asian` (a longer
  vault and a narrower face, the root higher than the East Asian, the base moderately wide, the eyes a little larger, the
  rig's creased lid or a hooded one, the brows and lashes rolled heavier), `southeast-asian` (Filipino and maritime
  Southeast Asian: a rounder vault, a low broad root and a wider base, the nose leaning short and flat, fuller lips, the
  lid a parallel crease or the rig's), `latin` (Mexican mestizo: a broader face, high forward cheekbones, the nose spread
  wide on its axis), `african` (sub-Saharan: a longer vault, a rounder forehead, a much wider base on a low broad root,
  fuller, taller, more forward lips). A BLEND bucket is one of its buckets per face (`asian`: East or South Asian); a MIX
  bucket is one, or one with a share of a second, their bases and leanings mixed by the share (`equatorial`: South Asian,
  Southeast Asian and Mexican, and the faces between them; `mixed` names both and the share). A lid roll may name `none`,
  the rig's own lid; a bucket may carry its grooms' ranges and hold its TONES to its intent within its ancestries'
  (`tones`, on the Monk scale: `equatorial` is brown, MST 6–8), the ancestry still giving the hair, the undertone and the eyes.
- THE GEO-ETHNIC CATALOGUE widened: `north-asian` (Mongolia, Korea, northern China, Siberia: a broad round short vault,
  high flat forward cheekbones, the eyes wide apart under a low flat root, a light brow, thinner lips, the lid most often
  a monolid or an in-fold), and `asian` the asiatic look pinned on it (North 2 : East 1); `east-asian` East Asian alone.
  South Asia as its cline: `indo-aryan` (northern India and Pakistan: a long narrow face, a high root, the nose leaning
  long and aquiline, large deep-set eyes, MST 3–7) and `dravidian` (southern India and Sri Lanka: a wider base, fuller
  lips, MST 5–9), `south-asian` the mix along it. MENA: `levantine` (a long oval face, a long high-bridged nose, large
  deep-set eyes, MST 2–6) and `south-mediterranean` (the Maghreb and coastal Egypt: a long narrow face, a straight to
  aquiline nose, almond eyes, fuller lips, MST 3–7), `mena` the mix between them. A mix may hold its own tones over its
  buckets' (the equatorial's brown is the mix's, its buckets keep their own).
- THE HAIR'S CUTS by region (`FACE_HAIR`): a woman's hair texture is rolled from her ancestry's and cut from her bucket's
  pool for it, as a stylist there would cut it (the Levant and the Maghreb: long blow-dried waves, long defined curls,
  layered curls, half-up; South Asia: long hair, braided, put up; Mexico: layered curls, a curly crop, a high bun;
  sub-Saharan Africa: the short afro, the high bun, braids, the bun, the curly crop, the big round afro rare); a texture a
  pool leaves out keeps the ancestry's own style. The widow's peak's centre part goes only on cuts it suits (a part, no
  ties, to the shoulder or longer). New cuts (dermal-hair.js): `curly-crop` (~9 cm on top, tapered at the nape and round the ears) and `high-bun` (the hair
  smoothed up into a top-knot high on the crown).
- HYBRIDS (`hybridOf`, `HYBRID_TRAITS`): a person of two lineages composed trait by trait, not averaged. Each trait group
  (the skull, the eyes with their lid cover, the nose with its axis, the cheeks, the lips, the skin's tone, the hair's
  ancestry and its region's cuts) comes from one parent (the likelier the larger its share) or is blended between them;
  the face names its sources (`hybrid: { of, with, share, traits }`). `mixed` seeds one from any two base buckets;
  `composeFace({ parents: { a: w, b: w } })` makes any face one. A cline (`mix`: the South Asian, the equatorial, MENA)
  still interpolates its neighbours.
- THE HAIRLINE as dermis dials (dermal-map.js, each absent 0, every map as it was): `round` (the front straight across …
  rounded), `temples` (the corners fuller … receded), `peak` (a widow's peak), `sideburn` (its foot), `nape` (the line
  behind), and `bald`, 0 … 1, hair loss by the sex's pattern (a man's temples, then the crown from the back, then the
  front, to the horseshoe; a woman's front kept, the crown and the part thinned): the scalp's region, so the skin and the
  hair it grows follow together. The composer rolls them last of every face (`FACE_HAIRLINE`), a man's loss far more
  often than a woman's and scaled by the bucket's prevalence (`bald`); `composeFace({ bald })` sets it. A face rolled a
  widow's peak (nearly half) carries its groom's hint, `scalp`: a centre part over any style that has a
  part (the peak is where the hair parts of itself), with the groom's `framed-layers` move (dermal-hair.js, the
  Rachel's principles): a smooth crown, the front cut shortest and layered longer toward the back, the ends flipped out so
  the width sits at the sides at mid-length (the back hanging straight: the groom's `flipBack`, the flip's share behind
  the ears, absent the whole flip all round), in pieces, within the style's own length. A `blowout` move (the roots lifted
  well off the scalp, the sides held out, the ends turned out) is there to ask for; the rolls do not. The dermis study's `--lineup-all` adds the lateral and the back.
- THE MALE POLE (head-relational.js `RELATION_POLES.male`, empty until now; approved by the operator's eyes): the
  female's principles at the male's character. The cheeks full and the lower cheek filled (volume, never a hollowed
  default), a broader, rounder chin that no longer recedes over a wider jaw and a heavier masseter, a shorter nose with a
  finer bridge and a wider base, fuller lips, the eyes a little more open; `HEAD_TUNES.male` re-solved for it and the
  male head re-pinned. The male dermis's hairline sits lower (0.88) with a widow's peak (5 mm). The sex axis
  (`dimorphRelations`) now runs between the two poles. The composer rolls a man about his pole: his hairline lower, the
  widow's peak more often and more marked and without the women's centre-parted groom, his brows taller and fuller
  (`FACE_GROOM_SEX`); a woman's rolls are byte-identical.
- PAINTED SHADING, opt-in (dermal-map.js `shade`, 0 … 1, absent nothing): the occlusion read at a face's reach (the
  sockets, the hollow under the cheekbone, beside the nose, under the lip and the jaw), multiplied into the colour as a
  game paints its light in (dermal-texture.js `finishPages`; the head chart's `occlusionAt`). For targets without their
  own occlusion; an engine that adds its own wants it absent.
- THE SKIN IN A GAME'S ART DIRECTION (color-theorist/adapters.js `skinDirection(contract, shading)`): the game's solved
  palette and a shading word (`SKIN_SHADINGS`: painted, cel, graphic, none) read into the character's `shade` (as deep as
  the key is low and the palette heavy, its colour the palette's fill, banded by the shading) and a light (the palette's
  key, fill and rim, an exposure by the key). `shade` takes `{ amount, colour, steps }` as well as a number. The dermis
  study lights a subject by its `light`, so one face reads in each game's light and shade.
- THE DEEP CURVE (`shade.curve: 'deep'`, the `chiaroscuro` shading): the shade as before until the skin is enclosed
  deepest, then a near-black in the shade's hue: the nostrils, the mouth's line, the sockets' inner corners, the ear's
  folds (the knee at 0.9 of the occlusion, the darkest a tenth of the shade's colour: a tight band, tightened at the
  operator's ask). A near-black only that deep, and only by asking for it.
- THE WORLD'S SKIN, as data (gameworld/hero-looks.js `worldSkin`): a world with a palette hands its characters the shade
  its art direction paints (`skinDirection`, the default light kept), `characters.direction.shading` naming how
  (painted when absent). The composed hero carries it as `skin`; the mint takes it only on a realistic hero, under its
  own shade, so every hero a world mints today mints as it did.
- The dermis study's sheen reads the relief layer: each relief class's slopes (its pores and grain, finer than a pixel)
  widen the highlight, Toksvig's way, so the skin reads satin rather than plastic (`--flat-sheen` for the old lobe).
- THE SCALP'S STRANDS, finer (dermal-hair.js; the operator's eyes): a drawn strand stands for a ribbon `strandGap` wide,
  `strandWidth` of it drawn; by the hair's type now (`HAIR_TYPES` `strand`): straight and wavy 1.5 mm and 0.4 (~4.5 hairs a
  strand, between a lash and a card; were 3 mm and 0.75, ~18), curly 2 mm and 0.5, coily 2.5 mm and 0.6 (a curl keeps its
  locks' weight). Every scalp's strands change; a groom's own `strandGap` / `strandWidth` still wins.
- A CURL'S KERATIN (`HAIR_TYPES` `chiral`, hair-spine.js `coilOffsets` `flips` / `taper` / `scale`): curly and coily locks
  twist each their own way: a share left-handed, the radius ± per lock, the twist reversing along the lock (a kink, as a
  phone cord's: a few a metre in curls, many in coils), and the hair's weight drawing the coil open toward the root. A
  coil that names none of these is as it was.
- THE BEARD'S STYLES (dermal-map.js `beardStyle`, `BEARD_STYLES`: stubble, short-boxed, full, goatee, van-dyke,
  chin-strap, moustache): a barber's lines over the beard tract (which zones grow: the moustache, the corners, the chin, a
  soul patch, the cheeks or a strap along the jaw; the cheek line lowered; the neckline under the jaw) and a length a zone.
  A beard of 6 mm and more grows as LOCKS (dermal-hair.js): ribbons of hair at the hair type's strand, a little coarser,
  falling under their weight and curling by the man's hair type a step tighter (a coil curling back toward the skin), each
  lock its own keratin twist (`growBodyHair`'s `type`). Absent, the tract and `stubble` as they were.
- The beard grows on the whole upper lip (dermal-map.js): the nose's region, whose reach round the columella spans the
  philtrum, cleared the beard there, so every moustache and every stubble bared the upper lip's middle; the nose now clears
  the beard only on itself, above its base. Every male skin's upper lip changes.
- The moustache is trimmed at the lip line, as it usually is: a hair above the upper lip grows no longer than its way down
  to the lip's border, so none hangs over the lip (a beard of strands, 1.5 mm and longer; the painted shadow as it was);
  a style may let it over (`overLip`, none does yet).
- A styled beard is fuller (dermal-map.js `BEARD_ZONES`, the operator's eyes): denser and lifted off the skin by zone, the
  moustache thickest (2.4 × the tract's hairs, lifted most), the chin and the cheeks full; its locks closer and a little
  wider where it is denser, and a style long anywhere grows all of itself as locks (its trimmed moustache among them).
- Under a styled beard the skin is painted in the hair's colour (dermal-texture.js), as the scalp's is under its groom, as
  much as the hair covers it (the longer and the denser, the more; faded in with the beard's region, so no line marks the
  style's edge): the gaps between locks foreshortened toward the eye read as beard, not as the shaven shadow's grey. The
  dermis study shades a beard matte and darker within (coarse hair), and sizes its views with a loop (a head's hair now
  runs to more points than a call's arguments hold).
- THE MEN'S PARITY across the buckets (face-compose.js): a man draws his cut from his region's barbers
  (`FACE_HAIR_MALE`: a default pool for every texture, the MENA, South Asian, Latin and African pools; a curly-haired
  western man no longer rolls a TWA), his facial hair (`FACE_BEARD`: a style by the bucket's weights, clean the shaven
  shadow, and the tract's fullness in the bucket's range; East and Southeast Asian beards sparser and more often shaven,
  after published density; every style reachable everywhere), and the shapes by his sex's weights
  (`FACE_SEX_WEIGHTS`: the thin and high-arched brow, large eyes, the heart's chin and outline rarer on a man) with
  shorter lashes. A woman's every roll is byte for byte as it was.
- A man's loss ends in a HORSESHOE (dermal-map.js): as the front's recession meets the crown's, what is left is a band round
  the sides and the back, its top level about the parietal ridge and dipping to the sideburn in front; no wedge left at the
  temple, and no island of hair left by a widow's peak once the front has receded. What the loss leaves a barber keeps
  short (dermal-hair.js): no lock from the band's top laid over the bald crown. The MENA men's wavy pool crops instead of
  standing in a curly crop's spikes.
- THE MEN'S CUTS by culture (dermal-hair.js `SCALP_STYLES`, the cuts a barber in each place would name): the fade, the
  Caesar, the French crop, the two-block, the pompadour, the slick-back, the high-top, the top-knot; drawn by region
  (face-compose.js `FACE_HAIR_MALE`: East Asia's two-block and French crop, the Levant's slick-back, the Latin and the
  Black barbershop's fade and Caesar, South Asia's neat side part; a bucket's `hairMale`). A cut from 2 cm is grown as a
  cut (its taper, shelf and fringe shape it: a fade fades, a crop is no bowl; a buzz still lies as body hair), and a
  style may carry its own lock edits.
- THE BEARD'S GROWTH DIRECTION (dermal-map.js `beardFlow`): the sideburn straight down, the cheek down and toward the chin
  (the more the lower), the chin down and gathering, the moustache out from the philtrum (flatter toward the corners),
  under the jaw back toward the throat, the neck down toward its middle about a whorl either side. The beard WRAPS the
  jaw: under the ear's lobe it reaches back past the sideburn's line, and the neck's top carries it on round.
- The dermis study's SPLAT (`.claude/skills/dermis-study/splat.mjs`): the skin map's regions as points on the head's
  surface net, orthographic from any azimuth, the far side culled by the normals, a pale grey where no region weighs;
  where a region lies, in seconds, before a lit render's minutes.
- LOCS and CORNROWS, anyone's (dermal-hair.js, the tie's new tails `loc` and `row`): locs, the hair matted into ropes, one
  from each section of a grid over the scalp, twisting round its rope and hanging to the shoulder; cornrows, plaited flat
  in rows from the hairline over the crown to the nape (a root joins its nearest row where it is nearest, the scalp parted
  bare between), a short braid on past it. In the women's and the men's pools of the African groups, and the Latin coily.
- THE ERAS' CUTS: the mohawk, the fauxhawk (a `strip` cut: the band down the middle kept and standing, the rest clipped),
  the broccoli (the 2020s' perm), the mullet, the '90s curtains and bowl, the 2000s' emo fringe; some in the men's pools
  now and then. A style with ties is grown with its ties at any length. The fauxhawk is the 2000s–2010s gelled one:
  textured spikes worked up, back and in to a ridge (a groom's `gel`, 0 … 1: what stands is turned from the scalp's
  normal toward that ridge, not fanned out); `spiky` its whole-top variation (a Kisame's), and the SPIKED FADE family:
  the spiked fade, the high one, the spiked quiff fade and the burst fade's band of spikes. The bowl is clipped short
  beneath (a root a shelf or a strip clips stays clipped under a line cut).
- ASYMMETRY (head-relational.js, 0-centred, absent byte-identical): the left eye's, brow's and mouth corner's height, the
  nose's lean, the left jaw's and cheekbone's width. The composer rolls each face its own (`FACE_ASYMMETRY`, ~1–1.5 mm),
  never none: a mirror reads uncanny.
- BEAUTY (face-compose.js `composeFace`'s `beauty`, 0 … 1, `FACE_BEAUTY`): averageness and symmetry, the attractiveness
  research's steadiest findings: the proportions' and the nose's reach and the shapes' spread drawn toward the bucket's
  mean, the asymmetry toward slight. The default (0.5) leans to it: most faces typical, the median rather than the
  extremes; every composed face, women's and men's, changes with it.
- THE SKIN'S MARKS (dermal-map.js `marks`, `MARK_KINDS`): moles, a beauty mark, birthmarks (a café-au-lait patch, a
  port-wine stain) at mm on the head, painted into the skin's colour, a stain's edge wandering; the composer rolls up to
  three moles a face, a beauty mark in its classic places now and then, a birthmark rarely (`FACE_MARKS`).
- HAIR STREAKS (dermal-hair.js scalp key `streaks`, `STREAK_KINDS`, `STREAK_DYES`): the money pieces framing the face,
  a chunk at a clump's seat, the under layer, the tips (ombré, from a share along the strand), a scatter of babylights;
  each strand and card in one carries its `streak` (the dye, linear, and where along it the dye starts). The hair grows
  exactly as without; absent, no field. A buzz under 2 cm takes none.
- PIERCINGS (new epidermis/dermal-jewel.js `pierce`, `readPiercings`, `PIERCING_SITES`): the lobe and the upper lobe, the
  helix, the tragus, the nostril, the septum, the brow, the bridge, the labret, a lip ring, the monroe and the medusa,
  each placed from the head's landmarks and settled on its surface by the field (the ear's sites from the ear's own
  samples), in a kind the site takes (stud, a gem set; hoop through its hole, hanging off the tissue's edge; barbell;
  drop) and a metal; out, the pieces and one mesh (balls, rings, wires) in the chart's frame with its materials.
- ADORNMENTS in the composer (`FACE_ADORN`), rolled after the marks: each site at its chance by sex (the lobes on most
  women, few men, every other site rare; a nose stud common in the South Asian buckets), one metal a face; now and then
  streaks, mostly the salon's lightened dyes, sometimes a fashion colour, as a scalp hint. The rolls before them keep
  their dice.
- THE YEARS ON THE SAME ROLL (face-compose.js `composeFace`'s `age`, years 16 … 85, `FACE_AGE`): the rolled face is the
  person at their prime (28; absent or 28, the face as rolled, byte for byte); other ages keep every roll and the
  person's styling (the cut, the streaks, the piercings, the marks, the beard's style) and move the years' signs. Older:
  the soft tissue descends (the jowl and the fold, the cheek's fat from the cheekbone to the jaw, thinner lips set back,
  a longer nose and ear, hooded lids, the outer canthus down), the skin's `age` and `lines` rise, the hair greys from
  its onset, a man's temples recede and his loss advances by its destiny, a woman's crown thins late. Younger, to 16:
  fuller cheeks and lips, a smaller nose, a softer jaw, a man's brow ridge not yet grown, the skin younger. Its own dice
  (`face-age`): the rate the person ages at, the greying's onset by the ancestry's mean, the loss's destiny, the same at
  every age of one seed.
- THE FACE'S LINES AS FOLDS (dermal-map.js `dermalDetail`, dermal-texture.js `FOLD_INK`): each line a tapered polyline
  painted at two scales, a thin dark core inside a broad smooth shade (`crease`, `soft`), with a faint lift on the roll's
  lit lip (`lift`), in the skin's own warm shadow rather than grey; broken along its length, wider as it deepens, the
  crow's feet curved and more of them with depth. The lines no longer read as pencil strokes. Absent `lines`, nothing.
- THE WRINKLE MAP (dermal-texture.js the FOLD page, `FOLD_SLOPE`; dermal-map.js `FOLD`, `dermalDetail`'s `slope`): the
  same folds as SHAPE, a narrow valley and the broad roll of skin on its lit side, baked as the height's slope over the
  head's mm (R toward the figure's right along the chart's `tr`, G up the head along its `ta`, 128 flat; B the valley's
  cavity), so the light draws a fold and it answers the light's direction: an engine's wrinkle normal map. Only where
  the face has lines (absent, no page). The dermis study bends its shading by it; `--key` moves the key light (a raking
  side light shows the folds turn with it). A normal map shades; it casts no shadow and leaves the silhouette smooth.
- THE FOREHEAD'S FURROWS AS SHAPE (head-relational.js `furrows`, 0 … 1, absent byte-identical): an old forehead's three
  deep folds cut into the skin, each a tube laid along the forehead by the landmarks, sunk along the skin's normal so a
  shallow sliver cuts (~0.8 mm at 1), thinning to nothing at its ends, its edge blended soft: real shape, so an engine's
  light casts it and the profile carries it, under the same lines the paint and the wrinkle map draw. The composer cuts
  them from the late fifties at the person's rate.
- THE FOLDS' PAINT BY THE ART DIRECTION (dermal-texture.js `FOLD_INK.lit`): where the light draws a fold (the realistic
  register, no painted `shade`), the painted core and shade at a little over half; whole where an art direction paints
  its light in.
- THE CLOSED MOUTH'S SEAM, EVEN (head-relational.js `SEAM`; the relational head re-pinned): a closed mouth's lip line
  is cut to one depth all along the lips (~1 mm under the less prominent lip's front, the lips' fronts probed across
  the mouth, fading at the corners) in place of the lip-line carve, whose depth swung from ~0.6 to ~2.4 mm and, where
  thin lips parted from it, left a groove under the surface net's cell: drawn as a row of dark notches along the lips,
  plainest on the men and the old. An open mouth keeps its carve.
- THE LIP LINE PAINTED (dermal-texture.js `LIP_LINE`): a closed mouth's seam painted as one even line (a thin dark core
  in a soft edge, a little deeper at the corners), an arc from corner to corner through the stomion at the seam's
  measured height; an open mouth (`marks.open`, dermal-head.js) none.
- GREY BROWS AND LASHES (epidermis.js `hair.grey`): the brows' hairs silver at 0.7 of the scalp's share, the lashes' at
  0.3, each by its own die; the composer passes the years' `grey` on. Absent, none.
- GREY HAIR (dermal-map.js `grey`, 0 … 1, `GREY_HAIR`, `hairMeanOf`): a share of the strands silver, each by its own die
  (salt and pepper, not a tint), the beard's sooner and the body's later, carried as a strand's `streak` (`grey: true`);
  the texture's painted hair at the mean colour. A dyed strand keeps its dye. Absent, the hair as it was.
- THE LOWER LASHES over a full cheek (epidermis.js): a lash heading down onto skin that faces up is pushed forward off it,
  not up, so the lower lashes point down on the full-cheeked poles (both had them tipping up since the cheeks filled).
- THE DEEP TONES' ALBEDO (dermal-map.js `toneAlbedo`, which `dermisAt` and `skinBase` now read): an MST swatch is skin
  as a camera saw it, and the deepest two photograph near-black and grey (less red over blue than MST 6), so MST 9 and 10
  rendered as dark grey under a white sheen. Below MST 8's luminance a tone is lifted (by a square root under that knee,
  its order kept) and holds MST 8's red slope, the way measured deep skin stays a red-sloped few percent; the melanin
  measure (the blood shown, the palms) still reads the swatch. MST 1 … 8, and any hex tone at or above the knee, are
  byte-identical.

### Body-part map: dress tailored to the body, not the segment

- The realistic body's skin labelled by BODY PART (chest, abdomen, flank, upper and lower back, seat, hip, groin, neck,
  shoulder cap, armpit, upper arm, elbow, forearm, thigh, knee, shin, calf …) and by the MUSCLE most under each point,
  from the form field's own blend (each mass's share of the skin there), the deep base masses read by position:
  `bodyPartMap(recipe, R, build)` (body-relational-map.js); body-study `--map` colours the skin by part. The ground for
  dress tailored to the parts it covers, one piece across segments.
- Under the iliac crest (a hand over the hip's joint) the trunk is the seat behind, the hip at the side, the groin in
  front; a limb's bands by where a point lies down its bone (the shoulder's cap over the upper arm's top, the elbow, the
  knee, the wrist, the ankle about their joints); the armpit's fill above the hollow the shoulder's cap. A point inside
  another part's skin (the pelvis under the crotch, the arm's top under the cap) is `hidden`, for dress to leave alone.
  The labels eased over each grid (a point of a part fewer than three of its eight neighbours share takes theirs).
- THE FIELD GARMENT, the tee first (body-relational-garment.js `fieldGarment`, `FIELD_GARMENTS`): a piece names the body
  parts it covers, and on each segment that carries them the rings they mostly cover are its (down a limb to its
  `limit`); its surface one CLOTH FIELD, the body's own blended three times looser and eased out, each point cast onto
  it along the skin's own ray, then pulled TAUT along the piece (each slot's distance over the piece's length raised to
  its upper hull: from the bust's apex straight down, no ledge) and over its rings' hollows, at most 40 mm off. On the
  skin's grid, so it takes the skin's bind and correctives; its ends closed beyond its end rings. A realistic hero's
  `outfit: ['tee']` wears it in place of the segment tee. The envelope gains `taut`.
- SKIN-FITTING SHIRTS, outfit words `fittedTee` and `fittedShirt` (its sleeves to the wrist): close to the skin yet
  hiding the musculature and the joints' formations as a shirt does, cloth under tension spanning the GROOVES (the
  abdomen's lines, the cleft between the pecs, the deltoid's border, the spine's furrow, the elbow's hollows) and
  following the FORMS (the chest, the waist's taper, the arm's swell). On the realistic body a field garment: the cloth
  field blended half again looser, eased 2.5 mm, over each ring's hollows and pulled straight over any dip shorter than
  9 cm along the piece (the envelope's `span`: the grooves, the fold under the bust, not the waist's taper), by a SOFT
  cap (the envelope's `soft`: the lift saturating toward 45 mm, no ledge where it binds). Half of it lies within a
  centimetre of the skin (the tee: four). On every other body, segment pieces eased 3 mm. A field garment takes its
  envelope from its word (`looser`, `ease`, `reach`, `taut`, `span`, `along`, `soft`); the tee's as it was. body-study
  `--dress` draws the garments in cloth blue over the clay body.
- TROUSERS on the realistic body as a field garment, at the skin-fitting shirt's thickness (its cloth, so a shirt and
  trousers read as one fidelity): the waist, the hip, the groin, the seat, the thighs, the knees, the shins and the
  calves (`on`: the abdomen's and the back's names counted on the pelvis alone, so the trousers reach the waist and stop
  there). The seat starts where the pelvis's rings rise (`floor`: its lowest rings lie flat at the crotch, widening at
  one height, and cloth copied from them wound inside out), its cap closing between the legs; the trunk's cloth takes
  the thighs in (`join`), so the seat wraps their tops; the seat and the legs CROSS a few centimetres over the crotch
  (under it the seat let down under the legs, over it the legs under the seat), so the seat's edge leaves no lip.

### The tailored suit: a jacket's front and lapels

A suit read as a suit on the realistic body: its front, its lapels and its buttons as words on the outfit card, made
by the tailor. Cards without them unchanged, byte for byte.

- THE WORDS (`outfit/styles.js`): `outer.front` `single` | `double`, `outer.lapel` `notch` | `peak` | `shawl` | `none`,
  `outer.buttons` 1–3; any of them gives the jacket a tailored front (single with a notch lapel and two buttons, double
  with a peak and three rows, unless named). The expander carries them as the build's `tailoring`, beside its pieces;
  the lapel's facing a `Lapel` tone (the card's, else a shade off the jacket's). The authored game body's jacket is
  unchanged by them.
- THE FRONT (`body-relational-tailor.js`): `cutV`, the jacket's V from its top button up to the collar, taken in under
  the shirt, its edge carried onto the roll lines and its walls painted as the shirt (on cloth whose points sit 2 cm
  apart a V cut by them alone is a ragged slit); `lapelBand`, the lapels and the collar one band along the roll lines
  and round the back of the neck, its width the lapel's shape (the notch's step at the gorge, the peak's corner carried
  up and out, the shawl's one curve), the collar falling down over the shoulders, its inner edge rolled over the V's;
  `buttonOn`, a disc on the cloth. The wear adapter places them: the stance by the button count (two a little above the
  waist, one under it, three higher), the roll lines to the side of the neck, one row of buttons or two; a lapelled
  jacket wears no stand collar. Each part closed and wound once; a stride stretches no edge of it past 5 mm.
- CLOSED, ONE SIDE OVER THE OTHER: a closed tailored jacket's right front lies over the left, its edge a band standing
  on the left front from the top button to the hem. A single front is cut away below its last button (the quarters,
  `cutOpening`, opening on the trousers, the left front's edge come out from under the right); a double front is square
  to the hem, its edge past the left row of buttons, its left lapel going down under the right front so the two cross
  above the buttons.
- THE TIE (`language.tie: true`): a blade on the shirt from its collar to the belt (`bladeOn`: the knot a block, the
  blade widening to its point), the jacket carried out over it (`clearOver`) and showing it in the V; a card's `Tie`
  tone, else a deep red.
- Two business cards: `business` (navy, single-breasted, two buttons, notch lapels, a burgundy tie) and
  `doublebreasted` (charcoal, peak lapels, three rows of buttons, a navy tie over a pale blue shirt).
- OPEN, THE LAPELS TO THE HEM: an unbuttoned jacket's fronts hang a little apart from the top button down, its lapels
  carried on down each front's edge to the hem as the facing turned back (its buttons on the front under's edge).
- A WOMAN'S SUIT closes her way, left front over right (the hero's sex handed to the tailor with the front's words),
  every overlap, edge, crossing and button mirrored. A skirt's waistband is a layer under a jacket worn over it, and
  the jacket is carried out over the skirt at its own height (the skirt's rings filled in between, so a ring reads the
  skirt where it is, not 2 cm lower); every garment's trunk clears the trunks worn before it below the waist (close cloth
  over a woman's hips had lain inside the trousers' seat, which bridges from hip to hip, showing them through a
  jacket). Two cards: `skirtsuit` (navy, one button, notch lapels, a pencil skirt to the knee, a white blouse) and
  `trousersuit` (black, double-breasted, peak lapels, gold buttons, wide trousers, an ivory blouse).
- THE SHOULDER AND THE WAIST: `outer.shoulder` `natural` | `structured` and `outer.waist` `suppressed` | `straight`,
  alone or beside the front's words. Structured, the jacket's shoulders squared on a pad (`squareShoulders`: above its
  widest ring each ring's reach to the side carried out to the straight line from the neck's point at 18°, 4 mm past
  the widest, square from there down to it; a centimetre had stood the shoulder out past the sleeve's head). Suppressed,
  the waist drawn in toward what the jacket is worn over (`takeIn`, eased over 11 cm either side); straight, a sack's
  fall from the chest to the hip, the waist's hollow bridged (`fallStraight`). The collar now falls at the back and
  not at the sides of the neck, where over a squared shoulder it had stood out as wings, and is a little narrower. The
  suits wear them: `business`, `doublebreasted` and `trousersuit` structured, `skirtsuit` natural, all suppressed.
- THE LAPEL ALONG THE CLOTH: its outer edge measured along the jacket (`clothWalker`: round the ring at its height, up
  or down the cloth), not stepped out sideways and dropped back onto it, which had stood its top out off the shoulder
  in the air; its section six points across, so over a bust no chord of it dips under the cloth, and its rings twice as
  close along the roll line. A closed front's V is off the middle and a face's paint is mirrored, so the cut's walls
  are painted as the shirt only where both sides are cut (a one-sided wall's paint had laid a strip of white shirt on
  the jacket beyond the lapel); the quarters' paint the same. The belt is made before the jacket's front, the waist
  suppressed onto it and the ridge it leaves eased into the cloth 6 cm above and below (`bridgeRun` now takes a range,
  along the run only, and points to hold); a skirt reads what is under it within 1 cm of each ring (`clearanceOver`
  takes its window), so it no longer flares out too soon into a shelf under a jacket.

### The garment designer: silhouette principles over tailoring primitives

Garments on the realistic body as data over a small set of construction primitives, and the principles
that make a silhouette read as measures with bands, so a garment is chosen and checked rather than designed by hand.

- THE TAILOR (`polygonizer/body-relational-tailor.js`): the realistic body's construction in one place, each a pure
  function that knows no garment: runs (`oneTube`), profiles (`drapeRun`, `clearanceOver`), edges (`fallToFloor`,
  `turnHemIn`), trims (`bandAt`, `strapBand`, `sashOn`, `strip`, `ribbon`, `soleSlab`, `buckleOn`) and binds
  (`bindNearest`, `bindRibbon`, `ringW`). The trousers, the gi and the footwear are each their choice of them. Moved byte
  for byte (`body-relational-tailored.char.test.js`, out of the critical tier: each case mints a realistic body), but
  for one fix: a strap is now the one band, its caps riding with their ring as a cuff's do.
- THE PRINCIPLES (`docs/garment-principles.md`): what makes a dressed silhouette read, each as a measure of the dressed
  figure with a starting band in two styles, western (fashion and tailoring) and anime/game (character costume):
  silhouette families and their shift from the bare body, waist suppression, fit class, return points for loose cloth,
  the dominant division on thirds and never at halves, the leg line, a hem off the limb's widest, the shoulder line,
  fabric stiffness, the flair budget, readability at a thumbnail, and rules for dressing each body type. Every source
  so far seen only in search results, and said so.
- THE DRESSED OUTLINE READ (`polygonizer/dress-outline.js`): the realistic body's outline sliced off the compiled mesh
  against the bare body under it (a tenth of a second): the family, each half's fit, where loose cloth returns to the
  body (by its standoff each side, so layers at a belt count as a return), the divisions (only where a garment spans the
  body and does not go on below), the leg line, a hem's place on the limb, the flair pieces, and advice in each style.
  In the realistic hero's readout as `dress.outline`; `/body-study --outline` draws it. It found the gi's belt a cone up
  to its blouse (the gi now cinched past the belt) and advises the gi's skirt off the thigh's widest.
- OUTFIT CARDS ON THE REALISTIC BODY (`polygonizer/body-relational-wear.js`): the outfit expander's pieces (a card's,
  a stylism's, an outfit word's) worn by the tailor instead of the authored body's ring copies baked on the realistic
  envelope (a cropped top, rippled shoulders, belt shards). The expander still makes every design choice; the adapter
  only makes them: each garment one cloth block over its windows (the trunk's `u`, a limb's `run`), each layer standing
  off the one under it, a limb's two pieces one tube faired over the elbow or the knee, a top's tail and body one; a
  knit or fitted top's second-skin paint made close cloth worn first; a sleeve or leg stopping short of the hand or the
  foot turned back in to the limb; a collar a stand collar up the neck (`collarOn`); boots and shoes the footwear
  primitive; the belt a band with its buckle at the front. Each authored part name a worn piece had is an ALIAS for the
  cloth it became (its `u` shifted where pieces were merged), and the cloth is in the body the dress is made on, so
  what the expander placed on a piece lands on it: trims and an open front painted on its faces, rows of buttons,
  embroidered emblems, pauldrons. Still the authored kernel's: hanging panels, capes, hoods. New tailor primitives:
  `flareRun`, `fairRun`, `collarOn`, a buckle at a named slot.
- STYLISM ON THE REALISTIC BODY: no longer refused. A genre, a register and a target outline lower to an outfit build,
  worn as above. `/body-study --palette` shows a figure in its palette's colours, face by face.
- THE DESIGNER: the stylism given the principles (`stylism/proportion.js`), opt-in, nothing moving without it.
  `stylism.canon: 'western' | 'anime'` names the principles an outfit is designed to: the lengths the solver chose (a
  coat's, a top worn out, a skirt's, a trouser leg's) are judged where they land on the figure, measured on the
  realistic body for each length word, and moved to the nearest word that lands well (never at halves, never on the
  thigh's top or the calf's belly, the leg line kept), the hero's own lengths and a card it named standing; each move a
  note in the stylism's ledger, and the outline read advises in that canon. `stylism.silhouette: 'balance'` picks the
  outline the figure is dressed toward by the canon's rules for its cast and physique (a jacked western male a column, no
  padding; a heavy figure one long vertical run; a drawn female an X), with why. The outline read's calf is the bare
  leg's now, the knee not counted.
- THE PROOF, by data alone: a long coat, a gown, a structured jacket and `balance`, each a stylism with a canon, on
  male and female, athletic and heavyset; every one made without new garment code. What the run found and fixed: a waist
  wrap built for the authored body's girth cut through a heavy figure's coat (now a band, or a sash, made by the tailor
  on the outermost cloth at its height); loose sleeves swelled into balloons (loose cloth past 14 mm of ease now hangs,
  the tailor's fall down the limb, a sleeve narrowing to its cuff); the read judged a hem just under the knee as on the
  calf (now a good landing, as the stage holds); the family cut-offs re-centred on this body as it is read (a gi and a
  straight coat H, a long coat and a gown A, a cinched bodice over a flared skirt X).
- THE REALISTIC REGISTER: the realistic body's cloth cut as a character designer of the seventh console generation
  cuts it (close, with a real wearing ease; the silhouette from the cut, the belt, the coat's skirt and the layers, not
  from volume), where the expander's eases were tuned on the game body. Every garment the close cloth now, its ease
  compressed toward its role's ceiling (a shirt 12 mm, trousers 14, a coat 22: a coat still looser than a jacket, a
  jacket than a shirt) and held no farther than 15 mm past it (`fieldGarment`'s new `stand`: the trunk's cloth no longer
  carried out over the arms at the armpit). A COAT'S SKIRT, or a skirt's own, is the tailor's now (`carrySkirt`): carried
  down from the garment's body, close at the waist, falling from the hips' widest without following the legs back in,
  the hollows bridged, an A by the expander's flare over its drop compressed the same way, its hem turned up inside so
  it opens beneath; a skirt with no body hangs from a waistband of the close cloth, its belt on that. The authored skirt's
  name is an alias for it (turned: its hem the lowest `u`), so a trim painted on its hem lands there. Measured per side
  over the bare body: a long coat's chest about 10 cm → 6, its waist 9–12 → 4, its knee 11 → 7. Also fixed: a stand
  collar with no neck above the garment's top (a heavy figure's shirt) is left off instead of built inside out; the
  martial trousers' shin piece no longer carries a negative flare the authored body refused. SLEEVES are their own
  now: at their own pieces' ease, closer than the body's, a layer out only over the sleeves under them (not the
  trousers), bridged over the arm's hollows (the tailor's `bridgeRun`), and hanging only when the cut itself is loose,
  where every jacket's sleeve used to fall straight from the shoulder (a jacket sleeve 2.4 cm off the arm → 1.0–2.0). A
  jacket worn over the trousers' belt clears it; an open front painted on a jacket whose body and tail are one tube
  is each piece's own again (the tail's paint, in the trousers' colour, had covered the whole front).
- `/garment-design <brief>`: the designer as a skill. The brief in stylism words or a card, the rationale principle by
  principle, the mint and the read, the words adjusted at most three times, the sheet shown; the eyes gate the
  operator's.

### The gi: a wrapped jacket over the martial artist's trousers

A jacket that goes over the wide trousers, on the outfit word `gi` (`polygonizer/body-relational-gi.js`; the authored
body wears a wide top, sleeves to the forearm and a hem over the hips):

- The BODY one tube from the collar to its hem: close over the shoulders, hanging below the chest (the slack eased in,
  so the back has no step), BLOUSED over the belt it is cinched under, then a SKIRT carried straight down past the hip,
  every ring clear of the trousers under it; the skirt's weights the pelvis's, the thigh's shared in toward each side.
- The WRAP: a V from the collar to the crossing, the cloth inside it taken under the skin, which shows; one COLLAR band
  lying on the cloth, up the right edge, standing round the back of the neck, down the left edge and over the crossing to
  the right waist (left over right); the over-panel's edge on down the skirt. Both in `TopFold`, the jacket's own shade.
- WIDE SLEEVES draped as the trousers' legs are, one tube from the shoulder to the forearm, flaring to the hem.
- TURNED HEMS: the skirt's and the sleeves' cloth folded back up inside, so they open as cloth does instead of closing
  with a lid (the loft winds such a tube only from the collar down, its cap's pole back toward the opening).
- The BELT is the jacket's (band, knot, tails); the trousers' sash is left off under a gi. The drape's sash takes a
  station and a name, and its legs an optional `flare` (absent, the trousers are unchanged).
- Machine gate (`body-relational-gi.test.js`): closed and wound once, the skirt outside the trousers from the belt to the
  hem, no jacket over the chest's middle in the V, each sleeve wider than the arm and its hem turned in, no edge grown
  more than 3 cm in a stride or a sprint (a ribbon's corners take one station's weights).

### Loose cloth that falls: the martial artist's wide trousers

Everything the realistic body wore was FITTED: the cloth field close over the forms. Loose cloth now hangs
(`polygonizer/body-relational-drape.js`), on the outfit words `martialPants` and `wideTrousers`:

- The DRAPE: the trousers' leg rings re-made hanging, each slot's radius the widest of its own (and a slack) and the
  ring above's let down slowly (`taper`), so the cloth falls from the seat and the thigh past the knee instead of
  following it in; vertical folds round the ring, deeper toward the hem.
- ONE TUBE A LEG: the thigh's and the shank's rings one piece (no edge across the knee), the shank's taken round at the
  thigh's slots, every point's weights mixed from its own piece's, so a stride carries the cloth with the leg.
- The MIDLINE: each leg's inner side held off the body's middle plane, so the two legs never cross (at the crotch,
  where the thigh's skin reaches the plane, the plane wins).
- The HEM: `martialPants` blouses over a cuff gathered at the ankle (a wrapped band, its caps weighted as its rings,
  so a bent knee carries the whole cuff); `wideTrousers` falls open to just above the ground, over the foot.
- A SASH at the waist, a knot at the front and two tails hanging. Tones `Sash` and `Cuff`.
- Machine gate: closed and wound once, the legs apart at the midline, wider than the calf, the cuff with the ankle in a
  stride and whole on its ring, the open hem never under the ground (`body-relational-drape.test.js`).

### Armour fitted to the realistic body

In progress. An armour build (`adorn: { type: 'armor', style }`) on `form: 'realistic'` was the authored body's kit baked
on the realistic body's envelope: plates sampled 6 × 4, the breast and back windows open at the flanks, the fauld two
coarse wraps crumpling over the belly, the pauldron's anchor folding over the shoulder's turns. Now
(`polygonizer/body-relational-armour.js`, the style still naming every piece, its window and its ornament):

- Every plate sampled as densely as the realistic skin under it and made the kit's own hollow plate (a wall rolled at
  its edges, faired over the forms beneath: `fitPlates`).
- The CUIRASS (the kit's breast and back plates) and the FAULD made field shells round the trunk over their windows
  (a field garment at a plate's clearance, taut over the forms; `fieldGarment` takes a `window` in the segment's
  stations), worn on the body the rest of the kit is baked over, so a tasset or a strap stacks over them.
- The PAULDRONS a JOINT CAP each (`jointCap`): a dome over the shoulder from a centre deep in it, the farthest of the
  skin and the cuirass under each direction faired and held clear, its outer and inner walls rolled at the rim,
  carried by the clavicle; the kit's lames down the arm under it.
- The GORGET optional: the realistic body wears it only when the build names it (`wear: ['gorget']`, armor/expand.js
  validates the word). The authored body's armour byte for byte.
- By ROLE, not by name (`roleOf`: a piece's carrier, its window, whether it wraps, what it spans), so every family is
  fitted alike and a style the fit has never seen is fitted by what its pieces cover: the trunk's panels front and
  back one CUIRASS (the knight's breast and back, the hardsuit's chest, back and abdomen plates); every wrap round the
  trunk a field HOOP over its window, each over the one before in the kit's stacking (a fauld's lames, a belt, the
  lamellar rows), the lowest carried down to a skirt's hanging plates when no cuirass meets them; a pinned panel hangs
  (the lamellar skirt) and keeps its kit shape; a shoulder's anchor a CAP; a foot's wrap a BOOT; a neck's wrap the
  optional gorget; the HEAD's pieces (a helm, a neck guard hung from it) left off, not fitted to the relational head
  yet. A strap hugs what lies under it (its lift read within 2 cm). Plate, lamellar and hardsuit styles mint on the
  realistic body (a lamellar suit refused before: its neck guard's address fell off the realistic neck).
- The SABATONS boots (the realistic foot turns from the ankle to the sole, which folds a plate): the footwear
  primitive's, below. The realistic foot's rings carry the authored foot's `u` (a share of its span), so an address
  made for the authored foot lands on the same share of the realistic one.

### Footwear: a solver library, an adapter per body's foot

In progress (the library and the realistic body's adapter first; heels, laces and the other bodies' feet next).
`lib/graph/footwear/`, on the armour and outfit pattern: footwear in THREE LAYERS (`principles.js`), the SOCK (the
protosock, the shoe's close outer layer and its bottom colour: a height and a thickness, none for a sandal), the SOLE
(its layers stacked from the floor up, each with its own thickness, welt and group: an outsole, a midsole, a stripe; a
layer's patterns: `pod` an air window at the heel, proud of its wall; `heel` a block under the print's rear, a dress
heel on the still-flat foot; `lugs` tread round its edge) and the ADORNMENT the solver lays over them
(`ADORN_PRIMS`: `strap` with a `buckle`, `band` (gilding), `cuff` at the sock's collar, `toeCap` (a quarter egg over the
toes, mapped from the toe base to the frontmost toe with a toe allowance past it (`room`), the leather under it tucked
inside, `rivets` round its back edge, small and dark a brogue's perforations; in the leather's own group a sleek toe);
`panel`, a pattern piece on the upper as a cobbler cuts it (`cobbler.js` COBBLER_REGIONS in the sock's own
coordinates, along the foot and round from the instep's centre line: the `tongue` (standing above the collar by its
`rise`), the `eyestay`s, the `vamp`, the `quarter`s, the `counter`, the `foxing`; or an inline region), a MATCHING PAIR,
lateral and medial, where the piece has two sides; `laces` criss-cross between the eyestays over the tongue; any of
them in a `group` of its own). Composed by CARDS (`styles.js`, pure data: a new look is a card), each annotated
with its `family` (shoe, boot, sandal, sneaker, dress); a card EXTENDS another (`from`: its sock merged, `adornPlus`
appended, its tones merged), and wears any COLOURWAY (`skin`: `SKINS` tripleBlack, tripleWhite, volt, navy, oxblood,
tan, or its own tones by group), the pieces' groups being roles (Overlay, Counter, Eyestay, Midsole …); by passes in a fixed order (`expand.js`: sock, sole, adorn, tone; tones
only for the groups laid), refused by name (`validateFootwear`). Worn on any body through its FOOT ADAPTER (`adapters/`:
which parts are the foot, the toes and the shank, the rig's ankle, toe base and toe tip, the bare skin a sandal is worn
on, the body's own way to lay the sock, and how a share along a segment names its stations): a card's places are shares
of a segment, so it reads on any body. `wearFootwear(adapter, card)`.
The realistic body (`adapters/realistic.js`; `polygonizer/body-relational-footwear.js` re-exports it): the sock a field
garment, close over the foot's forms (`boot`: up the shank as a shaft, the foot's leather tucked under it round the
ankle; `shoe`: from a collar below the ankle; its `thick` the leather's ease). The words on the realistic body: `boots`,
`shoes` (new), `sandals` (new; on the authored body a low close shoe), `workBoots` (a steel toe, riveted),
`adventurerBoots` (a thicker sock, a deep sole, a cuff, a gilt band, a buckled strap), `sneakers` (a court shoe: a white
cupsole on a gum outsole, a rubber toe bumper) and `runners` (a foam midsole with an air pod, a contrast stripe), both
cut as sneakers are: tongue, eyestays, laces, matching quarter overlays, the heel counter. SPORTS varieties over them:
`highTops` (over the ankle, a padded collar, an ankle strap, a deep cupsole on air), `skateShoes` (a vulcanized sole, a
suede vamp, a side stripe), `trailRunners` (a lugged outsole, a toe guard). DRESS shoes (a sleek sock, a leather sole on
a welt, a stacked heel): `oxfords` (cap toe, closed lacing), `brogues` (perforated round the cap), `derbies` (open
lacing over a tongue), `loafers` (a saddle strap), `monkStraps` (two buckled straps), `chelseaBoots` (elastic gussets,
a pull tab). BOOTS cut as a cobbler cuts them: a region's `shaft` carries its piece on up a boot's shank (the quarters past the
ankle, wrapping round to meet at a back seam; the tongue up the front, standing above the top; the eyestays beside it,
the laces on up between them, `shaftRows`; where the foot's piece begins below the ankle, a bridge on the foot's
leather cut round as the shaft's, so no plain leather shows between them), so any boot-height card is cut up the leg
and a shoe is not. Cards
`hikingBoots` (lugged, a padded collar, a toe guard), `combatBoots` (laced to mid-calf), `chukkas` (suede, a crepe
sole), `cowboyBoots` (pull tabs, a stitched band, a cuban heel the body stands on, a long toe), `ridingBoots` (a tall
plain shaft, a low heel); `workBoots` laced. FANTASY, DRAMA AND HISTORY (`fantasy.js`): primitives the cobbler's pieces do not make, composed by cards like any
other: `toePoint` (the toe drawn out past the toes, tapering, curled up by its degrees, a `bell` on its tip), `wrap` (a
ribbon spiralled up the leg, on the leather or the bare leg above a short boot; `cross` a second the other way),
`flare` (a funnel rising from a boot's top and opening out), `buttons` (a row up a boot's side), `spur` (a neck from the
heel and a star rowel), `wings` (a fan of feathers at each side of the ankle), `jewel` (a stone on the toe, the instep or
the ankle), `fur` (a shaggy ruff round the collar, or round the leg at a share: tufts and a drooping fringe of seeded
lengths); the heel kind `teeth` (a board on two teeth, the foot raised level when the toes stand as high as the heel).
Families `historic` and `fantasy`. Cards `poulaines`, `jesterShoes`, `persianSlippers`, `romanCaligae` (hobnailed),
`gladiatorSandals`, `vikingWraps`, `cavalierBoots`, `buttonBoots`, `geta`, `elvenBoots`, `talaria`, `furBoots`, `barbarianBoots`. On the authored body
a card wears its boot, sandal or shoe by its sock. HEELS (`heels: { height, toe, shank, kind: stiletto | kitten | block | wedge }`) change the mechanics: the foot is
tipped about the toe base and the body risen on them, as the RIG'S STANCE (`rig.stance: { rise, toe, pitch }`,
`station-loft-rig.js`: every pose stands in it, the root `rise` higher, each planted foot's toes `toe` up and its
metatarsus `pitch` degrees heel-up, or the pose's own heel where it lifts further, a free foot's toes turned down by the
pitch; absent, nothing changes), solved from the foot's own heel-to-ball length so the legs keep their length; the soles
and the heel cut against where the ground will be under that pose, rigid on the foot's and the toes' bones, the heel
leaned in the bind so it stands plumb when worn, a slender heel's foot under the back of the seat. Cards `pumps`,
`blockHeels`, `wedges`, `platforms`; `chelseaBoots` on a low block heel. A tone may be `{ of: <group>, shade }` (that
group's colour darkened or lightened, read after the palette: `readTones`), so recolouring `Shoes` carries the pieces
cut from it; the dress cards use it. A card's or its skin's named tones stand over the palette's defaults, the
operator's palette over all. body-study `--dress` paints the shoes in their own colours; a rig with a stance stands the
bind in it; `--crop shin` frames a tall boot whole. On the
authored body the library's other words are its boot, its sandal or its shoe by the card's family, for now. `boots`, `shoes` and `sandals` are pinned byte for
byte as the primitive first made them (`footwear.char.test.js`). `fieldGarment` takes `covers: null` (every ring of the
segments it is `on`). body-study `--dress` colours each footwear group by its tone.

### Handwear: a solver library, an adapter per body's hand

The footwear library's sibling for the hands (lib/graph/handwear): a CARD (pure data, a family, `from` its kin, `skin` a
colourway, `adornPlus`) worn through a HAND ADAPTER by passes under laws, the gloves the way the shoes are made.
- THE PROTOGLOVE: the palm's and the digits' own rings stood off by the leather's thickness, a digit cut at its middle
  joint or at its knuckle where the card's `fingers` (and `thumb`) say, its end closed inside the finger; the cuff up
  the forearm by its share (the realistic adapter's close leather, a field garment); a glove with no cuff tucks its
  first ring under the forearm's skin. `glove: false` lays the adornment on the bare hand.
- THE GLOVER'S CUT (cutter.js): pieces in the hand's design coordinates (the plating library's fitted shell: along the
  segment, round it from the back of the hand, the thumb's side +, the palm ±1), named `back`, `palm`, `heel`,
  `knuckles`, `fingerBacks`, `fingerPads`, `thumb`, or `{ seg, t, s }`.
- ADORNMENT PRIMITIVES (`ADORN_PRIMS`): a piece, the points stitched down a dress glove's back, a cuff, a strap (a snap
  or a buckle on its back), a flared gauntlet cuff from the wrist, a hard knuckle guard, studs, a knight's lames, rings
  with stones, a stone on the back or the knuckles, claws curled toward the palm (each rigid on its last phalanx), fur, a
  fighter's crossed wraps. Each takes its surface's weights.
- CARDS by family: glove (`gloves`, `suitGloves`, `fingerless`, `mitts`), dress (`dressGloves`, `operaGloves`,
  `drivingGloves`), work (`workGloves`, `weldingGloves`, `gardenGloves`), sport (`bikerGloves`, `cyclingGloves`,
  `goalkeeperGloves`, `fightGloves`, `skiGloves`, `handWraps`), historic (`cavalierGloves`, `falconryGlove`,
  `knightGauntlets`, `bishopGloves`), fantasy (`clawGloves`, `sorcererGloves`, `furGloves`, `gemGauntlet`); colourways in
  `SKINS`; a piece's tone may be OF the leather's.
- SPORT AND DRESS VARIETIES, skinnable as the shoes are: sport `battingGloves`, `golfGloves`, `liftingGloves`,
  `receiverGloves`, `racingGloves`, `hockeyGloves`, `tacticalGloves`; dress `kidGloves`, `walkingGloves`, `winterGloves`, `eveningGloves`, `mousquetaireGloves`,
  `bridalGloves`, `ceremonialGloves`, `perforatedDrivers`, most a variety of their kin (`from`). Primitives `buttons`
  (a row at the wrist's opening, up the inner forearm along a long cuff) and `perf` (a grid of perforation over a
  region, on each digit of a digits one). Colourways for sport (`tripleWhite`, `infrared`, `royal`, `hiVis`, with
  `volt`, `navy`) and for leather (`cognac`, `chocolate`, `dove`, `burgundy`, `ivory`, with `tan`, `oxblood`): a
  leather colourway carries every piece whose tone is OF the leather. The knight's and the stone gauntlet are the
  `gauntlet` family's.
- THE MITTEN SHELL (a card's `mitten: { pad, grip, thumb }`): one closed padded form over the palm and the four fingers
  in place of their gloves, made round the gloved hand as spheres (the palm's surface, each digit's bones sampled
  along) sliced from the wrist on past the fingers, each slice read out from its middle, its front rounding off where
  the spheres end. With a `grip` (a hand word: a boxing glove's `fist`) the shell is made round the closed hand, rigid
  on the hand bone, and the body HOLDS THE GRIP AT REST (station-loft-rig.js `holdGrip`: the hand's joints and every
  part riding the digits' bones turned into it by the rig's own curl), so the bind, every pose and an export keep the
  fist inside it; without one the shell bends with the fingers inside it, each point taking its nearest skin's
  weights. `thumb: 'apart'` keeps the thumb in its own sheath. Words `boxingGloves` and `sparringGloves` (a fist, its
  thumb sewn to its side), `mittens` (knit, the thumb apart).
- FANTASY AND HISTORIC MITTENS on the shell. `mitten.free` leaves any digits outside it in their own sheaths (a
  trigger finger); a piece aimed at a digit inside the shell skips it, and claws grow from the bare tips through it. The
  primitive `ribs` lays bands across the shell, spaced by its length (lames, scales, trim, cracks). Historic
  `mailMittens` (a mail muffler), `mittenGauntlets` (Gothic, steel lames to the fingertips, the thumb's own),
  `lobsterGauntlets` (blued, lames from the back of the hand), `triggerMittens`, `arcticMittens` (sealskin, trim, fur);
  fantasy `bearPaws`, `pincerGauntlets`, `golemFists` (a stone fist held closed), `dragonClaws`.
- Every card is an outfit word, worn on either body through its adapter (its parts riding their segments' dials, its
  tones under the operator's palette). THE AUTHORED BODY wears them too (adapters/authored.js): the same hand as the
  realistic body's, its glove's cuff new rings sampled round up the authored forearm's few coarse ones, their weights
  mixed from the rings either side. A mitten's grip marks the hand `held` (station-loft-rig.js): a pose's own fingers
  no longer curl it on past its glove's fist (a guard's fist had curled the thumb out through the shell); its wrist
  still turns. body-study paints its groups, a palette's colour
  first.
- The fitted shell reads a coarse ring (the hand's eight points, a digit's six) as it is, unsmoothed: easing toward
  neighbours that far round had lifted the flat back of the hand about 7 mm off it.

### Wearables sized to the body: no one wears the same size shoe

The footwear and the handwear libraries' cards were drawn on the realistic man (every sole, heel, welt, strap, cuff,
claw and mitten's padding in his metres), so the realistic woman, the tall and the short builds wore his sizes. Now each
is worn at the body's size: an adapter reports its body's foot (heel to toe tip along the foot: `footLength`) or hand
(the wrist to the middle finger's tip: `handLength`), and where it differs from the reference the cards were drawn for
(`FOOT_REFERENCE`, `HAND_REFERENCE`, the realistic man's), the body is carried to the reference's size, the card worn
there unchanged (its lengths, the library's defaults and its tolerances alike), and every piece carried back, a heel's
stance with them; the adapter's own close-fit distances (the leather's ease, the envelope's reach) take the scale too.
The reference body is worn as it was, byte for byte (its pins hold). Both libraries' realistic adapters and the
authored hand adapter report their size; the plated suit's feet and hands, being these libraries' cards, follow.

### Plating: segment-paneled armour on the realistic body

In progress (the realistic body first; joint caps, glow seams and the other bodies next). `lib/graph/plating/`, a module
of its own beside the armour (it leaves `armor/` and the realistic fit untouched; the hard-suit can adopt it): a powered
suit as TWO LAYERS, an undersuit (a close field garment over the trunk and the limbs) and PLATES over it, each a REGION
of one segment in that segment's own coordinates (`regions.js` PLATE_REGIONS: along it, round from its front line;
chest, abs, flank, back, lumbar, belt, hip, shoulder, bicep, triceps, gauntlet, thigh, thighOuter, hamstring, shin,
calf; or an inline region), cut from the suit's own grid and standing off it by its `lift` (footwear/cobbler.js
`panelOn`), never across a joint; split into `rows` whose gaps are the PANEL LINES; a matched pair where the region has
two sides; a REACTOR disc on the sternum in a rim, its group rendered full-bright (`emissive`). Composed by SUIT cards
(`styles.js`, pure data; `from`, `platesPlus`, a `skin` colourway), refused by name (`validatePlating`). Outfit words on
the realistic body: `powerSuit` (red and gold), `stealthSuit` (black, wide panel lines), `heavySuit` (gunmetal, far
standoff, more rows), `sleekSuit` (white, few plates); on the authored body none yet. body-study `--dress` paints a
suit's groups in their own colours.
FITTED SHELLS (the layout of a powered suit as a supercar's body is laid out, `shell.js`, `layouts.js`): a segment faired
into one smooth shell (`fairShell`: its grooves bridged), cut along DESIGN LINES in its own coordinates (`t` down it,
`s` round it, + its lateral side) into panels (`shellPanel`) fitted across narrow seams, bevelled down into them, domed
where they cap, stacked by LAYER (an underplate, a trim strip, the overplate, a cap, a light), so the overplates'
windows show the metal beneath; a mirrored panel's pair on the other side. Its lines run STRAIGHT and JOG (`stepped`:
straight runs joined by short straight diagonals, neighbours sharing their jogs so they fit along them), each kink a
sharp corner (a panel takes a section at every kink of its edges).
MUSCLE-MAPPED SHELLS (`muscles.js`): on a muscled segment the body draws the lines. The realistic body's muscle map
(body-relational-map.js) gathered into PLATE GROUPS per segment (`MUSCLE_GROUPS`: the pectoral, the sternum, the collar,
each row of the rectus, the oblique, the lat, the trapezius, the spine; the deltoid, the biceps, the triceps; the
brachioradialis, the extensors, the flexors; the rectus femoris, the vasti, the adductors, the hamstrings, the knee),
each plate's edges the boundaries between its muscle and its neighbours' (at the half-slot between them, so neighbours
share them), STRAIGHTENED (`straighten`: held straight, jogging only where the groove moves and holds), so the seams fall
in the grooves in the stepped style; each group its layer and colour role, an underplate under each segment. A suit's
`muscles: { on, only?, bulk?, seam? }`. The suit `markSuit`: the trunk, the arms and the thighs cut by their muscles, the
greaves, knee caps and sabatons below, a reactor on the sternum. The JOINTS banded (`joints`: two narrow articulated
bands at the shoulder, the elbow, the wrist, the waist, the hip and the groin, the back of the knee; the armpit a banded
group), the grooves wider (14 mm), the calf cut by its muscles (the gastrocnemius's two heads and the soleus, under the
greave's front, `greaveFront`); the labels eased before the cut (a point takes the group most of its neighbours share);
a point inside another part's skin (`hidden`) left out, and each segment's underplate and joint bands kept to the stretch
of it that shows, so the inner of two overlapping skins does not poke through. Where the muscles interleave too finely
to cut by (the lower back, the pelvis, the thigh toward the groin), a DESIGNED cut instead: `spine` (a dark channel down the back, a column of
vertebrae, a sacrum ending in a chevron; a design line may run through the back, `s` past ±1), `lumbar` (stepped plates
either side of the spine), `hips` (seat and hip plates, a codpiece, a low-abdominal plate), `thighs` (a quadriceps plate narrowing to the knee in a chevron, a
trim strip down the outside, a side plate, an adductor plate inside, a teardrop over the vastus medialis, hamstring plates
either side of a back seam); and SERVOS (`servos`: a hub at
the outer and the inner side of each knee and elbow, a disc, a domed core and a light; a panel may be a `circle` sized in
metres). `markSuit` cut by its muscles where they are clear and by design where they are not. Layouts `greave` (a chevron shin plate, side
plates sweeping to the ankle, windows with trim strips, calf plates over them, a cuff, vents), `kneeCap`, `sabaton`. A
suit names its `shells` (with a `bulk`), its undersuit's segments (`suit.on`) and its `feet` (a footwear card: its sole,
its quarter-egg toe). The suit `markBoots`. The footwear library's toe cap is allowed on a bare foot.
GAUNTLETS: the hand and its digits are plating segments (a layout panel's `seg: 'fingers'` lays it on the four), and a
suit names its `hands` (a handwear card: the glove the hand's plates are laid on, in the suit's group). Layouts
`vambrace` (the forearm by design: a top plate over the extensors with a vent, a trim strip down the radius, a flexor
plate, an ulnar plate across the back line, a cuff proud over the wrist), `gauntlet` (an underplate, a stepped back
plate, a blade down the little finger's edge, a domed knuckle cap, a repulsor in the palm, a lame a phalanx on each
finger and the thumb, low), `gauntletHeavy` (a studded knuckle bar, a thumb guard), `gauntletSleek` (one plate with a
light line), `vambraceHeavy` (a ridge, a flared cuff). A shell may be laid on some of its segments (`{ layout, on }`).
Suits `markGauntlets`, `heavyGauntlets`, `sleekGauntlets`, `bracers`; `markSuit` wears the vambraces and the gauntlets.
A plate takes the weights of its surface's nearest point or, where the surface blends by ring (a digit's), its ring's,
so a finger's lames curl with it.
THE PARADIGM CLOSED OUT: a layout is data a card can carry. A shell entry is a layout's name or `{ layout | panels,
drop?, plus?, name?, on?, bulk? }` (a layout of its own, named; or a named one with panels dropped by id and others
added), a variety adds shells to its kin's (`shellsPlus`), and every panel is checked by name (`validatePanel`) before
it is cut. The laws carry it (a layout is data; the extremities are their own libraries' cards), and docs/plating.md
sets out the card, the passes, the laws and the adapter the three wearable libraries share.

### The hero's skin: a part of the character, shown where it shows

- `skin` on the hero door (`form: 'realistic'`): the dermis's dials (dermal-map.js DERMIS_DIALS but `sex`, the cast's:
  tone as an MST swatch or a hex, undertone, age, flush, freckles, oil, lines, dirt, war paint, hair colour …),
  refused by name. `palette.Skin` is its tone when `skin` names none (both, differing: refused). The recipe carries the
  resolved dermis (`recipe.dermis`), which the export paints, and the palette's Skin becomes its base colour
  (dermal-map.js `skinBase`), so the page, a face no texture covers and the texture agree.
- An OUTFIT takes the realistic body's suit off: the trunk and the limbs (painted Top and Bottom) are Skin under a
  garment, so what it leaves bare is skin; the feet keep their shoes. Undressed, the suit as before.
- COVERED skin off the atlas (epidermis/dermal-hero.js `coveredSkin`): a body skin point under a garment or an armour
  (a ray out along its normal meets one carried by its bone or one within two joints, so a hand at the thigh is not
  covered by the trousers). The body's islands (dermal-body.js `bodyChart` `shown`) are each part's runs of rings that
  show (a sixteenth of a ring at least, a ring either side), each ring addressed on its whole part; a face off them,
  and a part painted another group (the suit, the shoes), takes the base colour, no texel. Dressed in the fitted shirt
  and the trousers the atlas went from 2048 × 3072 to 2048 × 2048 and the lit export from 33 s to 17 s.
- The skin in the UNLIT export too (an export asks; the World page does not): its texel times the corner's baked light.
- The BAKE (surface-bake.js, opt-in `bake`) on the realistic hero: its head's layers let down under one another and its
  eyes' globes cast no occlusion (dermal-hero.js `heroHidden`; `bakeChannels` `hidden`), its surface's normals the
  field's (`normals`), so a seam between two parts of one skin reads as none; the globes wear a new `eye` finish (a
  wet, lit globe: the socket's shadow falls above the eye, on the lids, not in it) unless the bake names them. Every
  other figure's bake as before.
- The realistic hero's unlit GLB welded as its lit one is (the figure's `weld`): 17.4 MB → 4.0 MB, drawn the same.

### The realistic hero at the door

- `form: 'realistic'` on the hero door (`create_character`, `mint_solid` via 'hero'): the hero's body re-sampled onto
  the form field (body-relational.js `formSlice`) once its plan is a recipe, the build by the cast's pole (male: norrin,
  female: shalla), with a `physique` (a word, `athletic | skinny | heavyset | jacked`, or `{ from?, bulk, tone, weight,
  height }`), stored with the slice's laws. Absent `form`, every hero as it was.
- The plan is laid out with the hero's tune times the build's (the build's shoulders, the physique's stature and
  shoulders), so the door's athletic Norrin is the body study's slice byte for byte. A slice takes 6 s (male) to 10 s
  (female, jacked) on the first expansion; slices are kept by their inputs (the expanded recipe and the build), so the
  same body again (a world's inline hero each render, an edit that leaves the body) is a tenth of a second.
- What the realistic body does not wear yet refuses by name: `outfit`, `adorn`, `paint`, `detail`, `statue`, `stylism`
  (fitted to the authored body's rings, which the slice re-samples), `body` and `girth` (the physique dials those), a
  cast other than 'male' / 'female', a head other than landmark or none, the streamlined core. The words agents guess
  (`bulk`, `muscle`, `tone`, `weight`, `fat`) point to `physique`; the layered card teaches it.
- The form field split by job, the slice byte for byte: `body-relational-builds.js` (the builds, the physique),
  `-field.js` (the distances, the fields, the crossing and the projection), `-resample.js` (a part re-sampled),
  `-correctives.js` (`correctiveRest`, the shoulder's blend), `-vec.js`; `body-relational.js` keeps `formSlice` and
  re-exports the rest. The sliced recipe's contract (its parts, station ids, slots, rig additions and correctives) is
  `docs/realistic-body.md`, held by hero-realistic.test.js.
- Dress on the realistic body (in progress): the bare body is sliced (kept by what the slice reads, so a dress edit never
  re-slices), the plan expanded again on it (`expandPlan`'s `body`), the outfit, the kits, the armour and the paint made
  on its ENVELOPE (body-relational-envelope.js: each ring over its convex hull, the hollows along the part filled, at
  most 15 mm off the skin) and the skin put back under them, a pinned piece's offsets carried into the skin's frame; a
  garment's points take the body's correctives. The sliced parts keep a `slotT` in the authored part's terms and their
  band paint by position. `detail`, `statue` and `stylism` still refuse. Open: on a physique the pelvis's rings hidden
  under the crotch's level are drawn in to a cone, and a trouser seat fitted on them folds (the male skinny and heavyset,
  the female heavyset); body-study `--hero` renders the door's own hero.
- The female's WAIST drawn in against her hips (body-relational-field.js `waist`, the build's `{ t, w, pinch }`: the
  trunk's field read narrower across about a height on the torso bone, eased out either side, its depth as built). On
  the hero's masses her waist measured 0.67 of her hips' width from the front and his 0.72, so the two read alike; with
  a tenth's pinch hers is 0.61 (21.8 cm against 23.8). His, and every build without `waist`, byte for byte.
- The realistic hero's head is the RELATIONAL head by default (`head` absent on `form: 'realistic'`; `'landmark'` and
  `'none'` still name theirs; a record stores its head, so a hero minted before keeps its own). The hero routing card
  names the realistic form (`form: 'realistic'`, `physique`, the fitted outfit words) and a phrasing that reaches it;
  the layered vocab card's paragraph says what the realistic body now wears.
- The whole loop under test (export-model.realistic.test.js, the E2E tier): a realistic hero minted by the character
  door with the fitted shirt and the trousers, exported as the lit skinned GLB, read back by glTF-Transform: one skinned
  mesh on the rig's joints, the idle, walk and wave clips, the correctives as morph targets by name, the normals, the
  weights summing to one, and the skin: a texture coordinate on every corner and the dermis's atlas as the base colour,
  the head's page in it.
- Fixed: a DRESSED realistic hero lost its face. The plan's body hook (station-loft-plan.js) took in only the parts the
  plan had a name for, so the relational head's visage and nose (the face's own parts) were dropped and the cranium,
  let down under them, showed as a smoothed mask. The hook now takes every part the body brings. An undressed hero is
  byte for byte as it was.
- The realistic hero's GLB WELDED: its pack writes a corner a triangle, so a grid point went out once per face round
  it; corners alike in every attribute and every target's row are now one vertex (scene-gltf.js `weldCorners`, under the
  lit export of a pack carrying its normals), a UV seam's or a crease's two sides apart. The dressed female's lit GLB
  went from 304k vertices and 23.7 MB to 51k and 5.2 MB (16-bit indices), drawn the same. Every other figure's export
  byte for byte.
- The realistic FEET lighter: the foot 36 rings × 48 round (was 45 × 72), the toes 21 × 48 (was 31 × 64), about 5.3k
  triangles a side for 10.4k; the toes, the heel and the ankle read as before (the operator's eyes), the sole's flat
  cut a little coarser.
- The relational head's FIT on the recipe (`recipe.headFit`: `{ sex, k, ty, men }`, the scale and the offsets that seat
  the head on the neck), so an export can read the hero's head back into the head's own frame and chart it.

### Realistic body: correctives posed and exported

In progress. The realistic body's correctives (`recipe.correctives`, docs/realistic-body.md) outside the body study:
- Posed: `poseLayered` (hero-gesture.js) skins the rest with the correctives the pose drives (`correctiveRest`), so a
  standing hero's solid and the door's gesture gates carry them. A recipe without correctives poses byte for byte.
- Packed: `packLayeredRig({ correctives })` (station-loft-rig.js) carries each corner's rows as the face's are
  (`corrective` on a part), the pack's `correctives` (each target's id, driver and weight at rest; each driver joint as
  the bone carrying it and its offset from that bone's head) and every clip's `cw` (each key's weights, by
  `correctiveWeight`, correctiveRest's formula). The layered world resolve asks for them only when the export asks for
  blend shapes (`ctx.face`: the skinned GLB, the Godot pack's figure); the World page's payload is as before.
- Exported: the skinned GLB writes one sparse POSITION target per corrective after the face's, named by its id, its rest
  weight in `mesh.weights`, `mesh.extras.correctives` the drivers and joints for an engine that drives them, and every
  clip a LINEAR weights channel with the weights its poses drive (merged with the face's STEP track, each drawing held
  to a millisecond before the next), so Godot, Blender and Unity play them with the clips. The T-pose (engine skeleton)
  export leaves them out. Without correctives every byte is as before.
- Lit: under the lit GLB (`lit: true`) the realistic body's pack carries the studio weld's normals per corner and no
  baked shade (`packLayeredRig({ engineLit })`), and the skinned writer writes those normals, so the engine shades one
  smooth skin, once (it had the facets' normals and the bake's shade under its own). Every other figure as before.

### Realistic body: the feet on the form field

- The realistic body's feet (`footR/L`, `toesR/L`) re-sampled onto the form field: the foot and the toes are limbs of
  the builds (body-relational-builds.js `foot`, `toes`: the heel, the arch's two columns, the midfoot and the instep,
  the ankle's two bones, the ball; the big toe and the four), on one field with the shank's own skin, so the ankle
  flows out of the shank's last skin with no step. New module `body-relational-feet.js`.
- The sole is flat on the ground the authored shoe stood on (the masses set so their lowest sinks past the rim's
  rounding, then cut), so the gaits plant it where they did; the medial arch stands off it.
- The foot is re-sampled as a SOCK: level rings round the ankle turning down the instep to stand square to the foot,
  the heel the bend's outside; the toes in planes along the toe line, the big toe's tip on the field. The shank's skin
  shows over a level `0.25 W` over the ankle's joint, the foot's under it, crossing there as the knee's chain does.
- The bind: the foot's points near the shank's skin, or over the level, carry the shank's own shares at their height,
  so the two skins move as one through a gait; the toe base is a hinge band (the foot's bone and the toes').
- The physique reaches the feet barely: bulk and weight grow the foot's soft masses by a twenty-fifth at the dials'
  ends; height scales them with the rest.
- Every other part of the slice is byte for byte as before (norrin and shalla, athletic and jacked); the dials gain the
  feet's new station ids. A slice costs about 2 s more.

### Realistic body: the relational head

- `head: 'relational'` on the realistic hero (`form: 'realistic'` only): the relational head (head-relational.js) worn
  as recipe content, fitted to the landmark head it replaces (vertex to menton, the ear canal at its depth), sampled by
  rays from one centre into two parts that share the mouth's ring (`jaw` and `cranium`, their caps the mouth), sealed
  to the neck: the neck ends on a ring wholly under the head and the jaw part starts on that ring. The lower face is
  bound to the rig's jaw bone, its hinge moved to the head's condyles, so the mouth opens. Bald.
- The face sampled from its own direction: rays from one centre grazed the nose, the lips and the lids, and the face
  read stair-stepped. The cranium and the jaw are now sampled on the head's BARE field (head-relational.js `bare`: the
  skin wave without the nose, the lips, the eyes or the ears), let down under the face. The face is parts cast along
  its own look onto the whole field (the dermis study's graft read through the same grid): the `visage`, rings about
  the mouth (the lips run along them); the `nose` and the eyes (`eyeR/L`), rings following the nose's outline and each
  eye's opening, so the wings' creases and the lids' margins run along the rings, not across them; each sunk under the
  next where they hand over (the body's handover), the eyes painted. The ears are their own parts, a tube up each ear
  on the ear's field (`earFields`). About 19k vertices for the head; the swap takes about 50 s once (then kept).
- The head shades by its FIELD, not its facets: each part's stations carry `normals` (every point's unit gradient of the
  field it was sampled from), and the shading takes a part's authored normals where it has them, carried onto a posed
  face by that face's own rotation (station-loft-shade.js `authoredNormals`; the world, the lit export and the lit
  pieces all read `layeredShadingNormals`). Where the parts hand over, each let down under the other by a slope, they
  shade as one skin (the lines round the nose and under the eyes read as wrinkles at full-figure scale); the lids' and
  the nose's wings' blends, finer than the rings, read smooth. A part without `normals` shades as before, every byte.

### Realistic body: the dermal skin on the body

The lit GLB of a realistic hero (`export_model`, `format: 'glb'`, `lit: true`) carries its albedo as the base colour;
the other maps (roughness, translucency, hair) stay on the dev path.
The dermal texturizer's maps on the realistic body (`form: 'realistic'`, docs/realistic-body.md), so its head and its body
wear one skin. `epidermis/dermal-body.js`:

- The body's UVs from its own grids: each skin part (the re-sampled torso, neck, pelvis and limbs; the authored hands,
  fingers, feet and toes) unrolled from its stations × slots into an island at its true size, one texel density over the
  body, v down the rings' centroids (the caps' poles past the ends), u the arc round each ring from its SEAM, where an
  artist cuts: the trunk, the neck and the pelvis down the back, the arms and the legs down the inside, the hands and
  the feet along the inner edge. Each grid point's address is its slot's turn (`front` anterior, the left limb the
  right's mirror, slot for slot) and its station's run; packed by the head's packer (`packRects`, shared out of
  `layoutDermis`).
- The maps painted by the head's painter (`paintIsland`, shared out of `paintDermis`, the head's maps byte for byte):
  albedo, roughness, translucency, hair density and flow, fuzz, the relief tiles' index and the occlusion each part's
  own folds cast (broad, gentle and eased over each point's neighbours, the cage being coarse), written by
  `dermalPngs`. The inner arm's pale skin turns from anteromedial to the forearm's flexor side across the elbow, so the
  two parts meet in one colour. The palms and soles glabrous; the body's terminal hair sparse by default (the
  male's at half the preset's), its tracts the pole's (the forearms, the shins, the chest, the axillae); the neck's
  beard, the chest's patch and the belly's trail fade in with their regions instead of starting at a line, and a body's terminal tract blends across its edge.
- The neck meets the head: its top eased over its upper third toward the tone of the relational head's lowest skin
  (`neckTone`).
- The body-part map (body-relational-map.js) read in: each point of the chart carries its `bodyPart`
  (`bodyDermis`'s `partMap`), and the limbs' seams run through its `hidden` patches (the skin inside the trunk's), so
  the cut is where nothing shows; the study draws the parts on the skin.
- For the export: `bodyDermis(mesh, recipe, { dermis, sex, page, neck, partMap })` → `{ chart, layout, uv: { faceUV, corners,
  vertex }, maps, dermis }`, and `unweldSeams(faces, corners)` to split the seams into one UV a vertex.
- In the export (`epidermis/dermal-hero.js`): `heroDermis(mesh, recipe)` charts the hero's whole skin, the body's
  page and the head's, the minted head read back by `recipe.headFit` and charted on its sphere with its marks
  (`dermal-head.js` `headChartOf`, whose `shownAt` keeps the layers let down under the face from casting occlusion);
  `heroSkinPaint` composes the two albedos on one atlas, the body's over the head's, and hands the figure's pack the
  paint skin-paint.js hands it (each skin face's corners on the atlas, every other face on a white texel, its colour as
  before). The world kind wears it on the realistic hero's lit pack. A garment, an eye's globe and the mouth keep their
  colours.
- The eyes lane: `/dermis-study --body [male] [female] [--physique <word|json>] [--body-page N]`: the realistic body
  textured and lit with the relational head grafted on it (its own atlas and hair), its map's kinds, its channels on the
  shape, the neck close, and the body's atlas pages.

### Dermal texturizer: skin and hair laid out on the realistic register's body

In progress (a dev path: no minted hero changes, no tool surface). The epidermis cube carried from the head to the
body: the skin's layout and the hair it grows, read from an ADDRESS so the shape stays separate. `epidermis/dermal-chart.js`
is the shape's contract (a canonical part, `along`, `around` anatomical, the tangents), with the hero's cage and any
ring-stack body as adapters; `dermal-map.js` lays regions, the painter's colour zones, roughness, translucency, Langer's
lines and hair tracts by a few dials over the egocube's tones; `dermal-texture.js` bakes them to a per-part atlas (seams
on the hidden side, the face weighted up, the scalp paint and the stubble's follicles) with tileable relief tiles;
`dermal-hair.js` grows body hair lying on the skin and scalp locks as clumps on the elastica's guides (curl types
straight to coily, the coil's shrinkage, frizz, ragged tips, flyaways, cards). The realistic head is its shape:
`dermal-head.js` charts the relational head (its field surface-netted and welded, the globes off the skin) and hands
its relations to the map as marks, so the hairline, the nose, the lids, the cheeks, the lips and the beard's line are
laid from the trichion, the nasion and pronasale, the canthi, the cheek points, the stomion and the porion. The ear is its own feature: no beard or hair
grows on it. The scalp is COMBED: one smooth comb over the head (never across the part, which runs over the top only),
guides walked along it lifted off the skull for volume and hung by the elastica where the head turns away, waved in
phase along the flow so a type's crests run across neighbouring locks as bands, and every strand interpolated from its
nearest guides on its own side of the part, so strands run parallel. The CUT is the stylist's: a perimeter line (a
level the head's relations name, the jaw, the shoulder, the collarbone, cut blunt, a-line, stacked, v or u) where each
lock is combed down, cut where it crosses, regrown at that length and cut again so its end lands on the line; a clipper's
taper by the root's rise over the hairline; a shelf (an undercut); layers (no lock longer than this from its root);
point cutting off the line. The library's cuts: buzz, crop, short (tapered), undercut, bob, angled, shoulder, long,
layers. EDITS BY CLUMP NAME: the anime figure's clumps (fringe-1…7, the temples, back-1…11, the crown) as addresses on
the scalp, each edit (`length`, `sweep`, `lift`, `over`, `stand`) reaching the guides about its seat with a soft falloff
so the comb stays one field; the anime traits ported as MOVES over a groom (sleek, voluminous, messy, heavy-, short- and
swept-bangs with the fringe's own cut line, peekaboo, side-parted, flipped, ahoge, chunky). CREATOR LOOKS (`dermal-looks.js`): the realistic head stylized as
a game's character creator draws one, as data over the existing readers: `GAME_FACE` relations (a firmer skin wave, a
heavier brow, cheekbones forward, a squarer jaw, deeper-set eyes) and archetype presets (warrior, shieldmaiden, scholar,
rogue, elder). The dermis takes the creator's sliders: `lines` (the forehead's, the frown, crow's feet, the nasolabial
fold, under the eyes), `dirt` (grime in the cavities and in blotches) and `paint` (war paint: eyes, stripes, band, chin,
mask, in woad, soot, ochre, chalk or blood), painted per texel from the face's landmarks. The atlas bakes OCCLUSION read
from the mesh (`meshOcclusion`, any shape) into the skin's colour. The relational head's chart is spherical about a
centre at the ear's height (`headSphere`), so its undersides keep texels of their own, and what the head closes over (the
teeth, a nostril's inside) is marked `enclosed`: no hair, no bake. PEOPLE OF THE EGOCUBE'S ANCESTRIES
(`readAncestry`): rolled inside each ancestry's own ranges (tone, undertone, hair colour, texture), the texture worn as
the scalp's type in a style that suits it, the eye note through the ancestry's own derive (`sculpt.lidCover +`: the
lid's cover, rolled among `EYE_SHAPES`: an in-fold crease tapering into the inner corner, a monolid, a parallel crease, a
hooded lid; never a slant), the face's structure the
individual's. AFROS: a `stand` dial (the root leaves the scalp toward its normal) with coily hair's spring and shrinkage,
an `envelope` cut rounding it to an ellipsoid, a nape taper; `twa` close to the head; `curls` hanging in ringlets. The hair
shader's highlight scatters with a coil's roughness and its mass shadows itself (a coil's interior dark); the skin
reflects 4 % at every tone, so a deep skin's sheen carries its form. TIES: a tie anchored on a clump's seat (or an azimuth
and a rise) gathers every root, the top section or those within a radius of it; each gathered lock is combed taut over
the head to the tie and arrives at its own slot round the band (the side it came from), so nothing crosses; one bundle
hangs from the tie (the elastica's lock, flaring then tapering, its ends ragged), a bun coils it about the tie, a braid
plaits it in three (each bundle a figure of eight across the braid a third of a turn apart, bound, a brush past the
band). Styles: ponytail, high-ponytail, bun, braid, half-up; the move `temple-braids` (the Nordic braids). The relational eye rig takes
the eye's cover as channels: `creaseHeight`, `creaseShape` (parallel … tapered into the inner corner), `epicanthus` (the
upper lid's skin laid over the inner corner) and `fullness`; each at rest leaves the eye as it was. THE EYES' BASELINE re-measured against the adult norms
(Farkas; MRD1, MRD2): they sat close (the inner canthi 27 mm apart, the pupils 55) and stared (the upper lash line 7.9 mm
over the pupil, 2 mm of white above the iris, the lower lid over its foot). The rule of fifths now reads against the face's
width (`fifths` 0.215) with the inner canthi a little wider apart than an eye (`intercanthal` 1.12): en-en 33.0 / 32.3 mm,
ex-ex 92 / 90, the pupils 62.6 / 61.2, an eye 31 mm wide. The fissure is split at the pupil by a relation (`lidSplit`
0.32 of `fissure` 0.036 above it), so the upper lash line rests 4.4 to 5 mm over the pupil, over the iris's top, and the
lower 5.3 mm under it at its foot: a neutral eye. The relational head is a dev path (no minted row reads it); a lash whose
root cannot be laid within 2 mm of its lash line is dropped. The bands
are returned for drawing. Seen through `/dermis-study --look`, `--ancestry` and `--lineup`.

### Realistic register: a stronger body for the hero

The third point on the hero's style gradient (anime → cartoon → realistic), as western games draw a person: accurate
shape generated relationally (the relational head's method carried to the body), depicted through the hero's cage so
every reader of its stations, slots and body chart keeps working, with the relational head joined on at the neck.
Opt-in and versioned: a default hero keeps its bytes.

- **The stretch audit** (`hero-stretch.js`, `scripts/hero-stretch.mjs`). The hero's shell read ring by ring through
  the studied gaits (walk, jog and sprint over their cycles) and the stand's gestures, against its bind: each closed
  part's station is a ring of its slots, measured for its area and its narrowest slot (a joint's collapse), its twist
  away from its heaviest bone (the blend lagging the bone), and the BAND of skin from it to the next ring, slot by slot
  (a crease's compression, the far side's stretch, folds through itself). Each ring keeps its worst frame, and the knee,
  elbow, hip and shoulder are gathered as regions. The bands carry the read: the hero binds its knee and elbow rings
  rigidly to fold bones, so a ring keeps its area however far the joint bends, and the joint gives in the skin between
  rings. The baseline, male (female alike within a few hundredths), on the gaits as minted now (the swing foot
  following its leg, below): the hip's band stretches to 2.5× its rest length in the sprint and compresses to 0.67 in
  the walk, the knee's to 2.15× and 0.65, the elbow's to 1.6× and 0.75 in the guard; the shoulder's top ring loses a
  quarter of its area in the sprint and twists 9° off its bone in the relaxed stand; the foot's rings keep a third of
  their area and the ankle's ring twists 21° (male) to 39° (female) off the shank at the sprint's curled foot. The SEAMS, where one part's tube is tucked into the
  next (the groin, the armpit, the elbow, the knee, the neck), read whether the child's end ring stays inside its
  parent: the groin and the armpit hold through every frame (the hip's and the shoulder's give is all in their bands),
  while the elbow's and the knee's open: at the hand-on-hip's bent elbow the forearm's tucked slots come 41 mm out of
  the upper arm, and at the sprint's knee, folded as far as the gait means it to (130°), the shank's top comes 41 mm
  out of the thigh.
- **The swing foot follows its leg.** In a hero's walk, jog and sprint the foot in its swing was held level with the
  floor (the toe placed, the ankle rebuilt at the standing heel), so as a run's recovery folded the knee the toes
  pointed forward, and as the knee drove through they were pulled up against the shin. With the hero dial `swingFoot`
  (stamped on every hero gait minted now, the walk's `HERO_WALK` and the run's new `HERO_RUN`; a hero stored before keeps
  its level foot, byte for byte) the swing foot rides its shank at the ankle's standing angle, square to it, eased in
  over the first 30% of the swing and handed back to the flat landing over the last quarter: the tucked foot points out
  behind, and comes round under the knee as it drives through. The rig takes a new channel, `toeTurnL` / `toeTurnR`
  (degrees the toes turn about the ball with a targeted foot; absent, level as a push-off needs), so the swing foot's
  toes turn with it, never hooked back level, cut short where their tip would dip under the floor. The recovery now
  folds as far as the gait means it to (the sprint's `swingTuck`: the level foot had held the knee shallower). Through
  the sprint and the jog the swing ankle stays within 3° of its standing angle; no toe goes through the floor, and each
  gait's speed is unchanged.
- **The shoulder line, hero laws 2.** The hero's shoulders read shrugged: its girdle already declines (8° male, 11°
  female, the casts' `shoulderDrop`), but the trapezius met the neck's side 8 cm over the shoulder joint and the neck rose
  out of it like a post, plainest from behind. Hero laws 2 (`HERO_LAWS_VERSION` 2, hero-form.js `SHOULDER_LINE`) lifts
  the torso's top ring, the neck's root, at its sides and back (its front stays at the sternal notch; the top cap's tip
  rises with it, the cage staying closed on every cast), so the trapezius
  climbs the neck in a concave curve and falls to the acromion at about 27° (male) and 34° (female) from the neck's side.
  Every hero on the structured core reads it, so every one minted now is stamped `laws: 2`; a row minted before (stamped
  laws 1, or unstamped, as a world's inline hero re-recorded on each render is) builds its plan and recipe byte for
  byte, pinned. Garments that reach the shoulders follow the new line on a hero minted now (the outfit laws' ring pins
  re-pinned as a body change; their expansions unchanged). The legacy vajra figure's girdle (figure-vajra.js `CLAVICLE_DECLINE`) and its body chart are left as
  they are: the hero reads neither. `body-study` takes `--laws` to render a hero as minted under an earlier version.
- **The leg set, hero laws 3.** In profile the hero's thighs stood forward of the trunk and its seat out behind: the hip's
  joint sat 2 cm under the groin's skin (the femur's head sits 5 to 6 cm deep, a little forward of the pelvis's middle).
  Hero laws 3 (`HERO_LAWS_VERSION` 3, hero-form.js `LEG_SET`) turns the leg back about the ankle: the hip's joint set back
  into the pelvis by 3.5 % of its height (3 cm on the male) and the knee by its share of that, so the knee keeps its bend
  off the line from the hip to the ankle. The bend stays because the motion reads it as the leg's slack: set straighter
  (the knee to the line's share of a plumb thigh), the leg came within 1 mm of its full reach and the feet's IK clamped,
  planted feet slid in the jumps and rolls, a stop overran, a cloak met an arm. Every hero on the structured core is now
  stamped `laws: 3`; a row stamped 2 or 1 builds byte for byte, pinned (the gesture, the shading and the anime pins each
  keep their laws-2 values beside the new ones); the outfit laws' rings and the statues re-pinned as a body change.
- **The leg length, hero laws 4.** Measured against the body's own ratios (ANSUR II), the hero's hip's joint stood at
  0.49 of its stature (the body's 0.52), the femur at 0.23 (0.245) and the trunk from the shoulder's joint to the hip's
  at 0.30 (0.28): short legs under a long lower trunk. Hero laws 4 (`HERO_LAWS_VERSION` 4, hero-form.js `LEG_LENGTH`)
  lengthens the leg by 5.5 % of the hip's height over the ankle (55 % of it in the femur, the rest in the shank) and
  shortens the lumbar by the same run, so the hip's joint comes up 4 to 5 cm while the navel joint, the shoulders, the
  neck, the head and the stature stay. On the hero proportions' adult casts only: a child's and the anime and herobot
  casts' proportions are their own. Every structured-core hero is now stamped `laws: 4`; a row stamped 3, 2 or 1 builds
  byte for byte.
- **The arm length, hero laws 5.** Read in Leonardo's figures (the body lane's `--vitruvian`), the hero reached 1.08 to
  1.09 of its stature fingertip to fingertip (Leonardo's 1, the body's about 1.03) and its fingertips passed his circle by
  7 to 10 cm. Not the trunk's breadth nor the thighs (the shoulder's joints 0.20 of the stature apart, the femur 0.245,
  as the body's): the humerus stood at 0.189 of the stature from the shoulder's joint to the elbow (the body's about
  0.165) and the forearm at 0.161 (0.146). Hero laws 5 (`HERO_LAWS_VERSION` 5, hero-form.js `ARM_LENGTH`) shortens the
  upper arm's dial by 0.88 and the forearm's by 0.91 on the casts the leg length takes: the span 1.01 and 0.99 of the
  stature on the realistic slice's builds, the middle fingertips on the circle with the arms raised to the head's top.
  A row stamped 4 or before builds byte for byte; the anime wave's raised elbow reads its drop as a share of the humerus.
- **A boot under a skirt.** A garment piece is lifted over every garment already worn on its part, and a skirt (a hull
  round the hips and both legs) counts as worn on the shank: a boot's shaft worn after it was lifted round the skirt's
  whole hem, a ring 21 cm across round both legs (the operative's card read as a bell for it). A piece on a shank, a foot,
  a forearm or a hand now goes under a hull hung round several parts (body-garment.js); a piece on the trunk still
  clears it.
- **The body lane** (the `body-study` skill). The hero's body as an engine gets it, the skinned cage shaded smooth,
  from the front, the front ¾, the lateral, the back and below; rows posed at the bind, a gait at a phase, a stand
  gesture or a raw rig pose; crops at the torso, shoulder, hip, knee, hand, foot and the neck's seam, framed on the
  posed joints; and at the bind a sections panel (the trunk cut level at the neck, chest, waist and seat, the right
  limbs square to their bones) with each girth as a tape reads it, and a measures table (stature, heads tall, the
  shoulders' and hips' breadths, the girths). `--tint` colours each part its own (which shell shows where two hand
  over), `--parts` keeps only the parts a pattern names, and `--vitruvian` adds Leonardo's two figures, the front large
  in its square (the arms level: the span against the stature) and its circle as his note sets it on the figure's own
  joints (the legs opened to an equilateral triangle, the figure lowered his 1/14, the arms raised till the middle
  fingertips are level with the head's top; the circle on the navel, its radius the standing navel's height), with what
  each reads in the margin. The eyes gate beside the stretch audit's numbers: the sprint's knee crop
  shows the shank's top out of the thigh where the audit measures it. Baseline, male and female: stature 1753 and
  1664 mm, 7.15 and 6.79 heads tall; chest 107 and 88 cm, waist 84 and 64, seat 86 and 90.
- **The form field, a vertical slice** (`body-relational.js`; seen through `body-study --form`, not yet on the door).
  The body read the way the relational head is: bone where it shows (the ribcage's egg, the clavicles, the spine's
  column) and the muscle masses (trapezius, deltoid's three heads, pectoral, rectus abdominis in its segments, the
  obliques, serratus, latissimus, infraspinatus, erector spinae, sternocleidomastoid; biceps, brachialis, triceps,
  the forearm's flexors and extensors) placed from the hero's REST JOINTS in units of its half biacromial, so the field
  rides any cast and tune, summed into one skin (log-sum-exp: where two masses meet, a groove). The torso, the neck and
  the arms are re-sampled onto it, denser than authored (the torso 48 slots round, 37 rings), each slot on a ray through
  the authored cage's point, then relaxed onto the field (the neighbours' mean, projected back down its gradient) where
  a ray crossed a pocket; the bind follows the authored shares (per slot, and by zone on a hard limb), so the rig poses
  it unchanged, and the pectoral and bust parts give way to the field. The armpit is filled (the hanging arm covers it);
  the deltoid is shared by the torso and the arm and handed over along one cone above the armpit (the torso's skin the
  shoulder's cap, the arm's below it, set a few millimetres under the cap where it reaches in), so the arm grows out of
  the shoulder with no ledge; under the bust the rays come down from above to meet the fold. Two builds, a Silver Surfer-like body: `norrin` (male, lean and sculpted, the
  shoulders 10 % closer by the hero's own tune, the neck thin and flaring into the trapezius, the pectorals defined: the
  sternal head thickest at its lower border under its own tight blend, meeting its partner over the sternum) and `shalla`
  (female, the definition softer; the bust the hero's own breast field laid over the summed skin as a displacement, so
  its upper pole is the pectoral's slope, read as the Female Titan's in Attack on Titan: firm and high, set apart over
  the sternum, the apex rounded, the lower pole full over a clean fold; her torso on a finer cage, 64 by 49, for it). Every re-sampled part closes on both builds; deterministic. The lane wears
  the RELATIONAL head on it (head-relational.js, meshed and fitted vertex to menton, carried by the head bone), bald, in
  a matte silver-grey. The pelvis and the legs are on the field too: the SEAT, one mass round the pelvis (the operator's
  upside-down heart, seen from the front and from behind; a teardrop from the side): two lobes low on the hip's joints
  wrapping the hip from the front round to the glutes, the cleft and the crotch the dip between them, and a taper up
  the middle to the heart's point under the navel and on the sacrum, squashed front to back to the belly's depth, so
  the trunk is widest at the hip's joints and narrows steadily to the waist (a basin, a flank and separate glutes had
  made a shelf at the iliac crest); and the pubis. The SPINE'S CURVE (a build's `spine`): the back's surface carried
  forward at the lumbar curve and back at the thoracic, a warp of the field over the back half only, so in profile the
  lower back sinks in above the seat and the upper back rounds out (the trunk had stood as a straight column). The
  thigh (rectus femoris, vastus lateralis and the medialis's teardrop, the adductors, the hamstrings, the
  patella, and the SWEEP, the operator's: one mass spiralling round the femur from the hip's side under the glute, down
  behind the thigh and in to the knee's inside, the hamstrings and the adductor magnus as one form, so the thigh's back
  rises into the seat in profile and its inside reads full and tapering from the front; a limb's mass may be a `chain`
  of round cones bead to bead) and the shank (both heads of the gastrocnemius, the soleus, the tibialis anterior, the Achilles, the ankle).
  A limb's two segments share one field and hand over by the plane through the joint (each segment's own knee had met
  the other's in a step); the torso and the pelvis hand over by height. THE HIP'S JOIN: the pelvis ends at the crotch,
  and about one level a little over it the thigh samples the pelvis's own field (the body with the thighs' masses, cut
  at the midline), so the two skins meet on one surface; under the level the thighs take the seat's fold, the crotch
  and the groin, and the seat runs on round into the thigh (it had ended at the fold in a flat ring over the narrower
  thigh, and the seam had wandered in teeth across the thigh's front and hemmed the seat in a jagged line). Every
  handover is one crossing: each skin fades in from its line, a ring or so, with no gap between the two fades (a gap
  had left both on one skin, in a sawtooth at the waist, the elbow and the knee). The thigh is rounder and finer than
  the other limbs (32 round, 33 rings). THE LOWER TRUNK ON THE ANATOMY (a build's `lower` frame, bodyFrame): the
  rig's navel joint is a joint of the spine at the ribs' lower edge, and the slice had hung the belly from it, so the
  navel stood 7 to 9 cm high and the crotch hung 11 cm under the hip's joint: navel to crotch ran 0.225 of the stature,
  the body's own 0.125 (ANSUR II). Under the chest's middle every height is now laid by three knots, the navel 30 % of
  the way from the hip's joint to the shoulder's and the seat carried over the hip's joint, so the lower trunk rides
  the leg wherever it is; a mass's height stretches with the frame. The rectus abdominis re-laid for it, three
  segments down to the navel and one long sheet under it to the pubis. Navel to crotch is now 0.139 and 0.134 of the
  stature (norrin, shalla), the crotch 8 cm under the hip's joint. THE LIMBS' VOLUME (a build limb's `thick`): every
  girth had stood 10 to 28 % under ANSUR II's means (the calf and the upper arm most), the bellies ballooned off a slim
  bone; each limb is thickened across, not lengthened (the bone's cone and the bellies' round and out radii, the joints
  as they were, which thickened stood out as knobs), so the upper arm, forearm, thigh, knee and calf read 0.188, 0.167,
  0.335, 0.222 and 0.210 of the stature on norrin and 0.177, 0.147, 0.340, 0.216 and 0.207 on shalla. THE DELTOID RIDES
  THE ARM: the torso's cap over the deltoid had been bound to the trunk and the collarbone and the arm's top half to the
  collarbone, so a raised arm swung up out from under its own deltoid and left the cap hanging at the side like a pad.
  A point's share of the upper arm's bone is now how near it lies to the deltoid's heads, read the same by the cap and
  by the arm's top under it, so the two move as one; none under the armpit, whose folds follow the arm and whose flank
  does not. THE GIRDLE RIDES THE COLLARBONE: the rig lifts the collarbone with a raised arm (the shoulder's joint 5 cm up
  at the arm level, 6.4 overhead), but the torso had given it half a share or less in one band of rings, so the joint
  rose under a shoulder that stayed down. The skin over the girdle (the collarbone, the acromion, the trapezius's fall,
  the scapula's top) is now bound to it by its nearness to the bone, none inside the bone's sternal pivot (rising, it
  turns that side down, and the neck's root split): a raised arm levels the shoulder's top from the neck to the arm.
  The deltoid's share of the arm's bone runs by how far down the humerus a point lies too, none above the joint (the
  deltoid's origin on the acromion and the collarbone stays with the girdle): the whole cap on the arm's bone had swung
  its top in and down about the joint and its side up, a trough over the collarbone and a hump over the arm, against
  the level line of Leonardo's figure. THE ARM IN: the body's breadth is the build's own (`frame`), so the hero's
  `shoulders` tune brings the arm in over a body that stays, the masses it hangs from (the girdle, the collarbone, the
  trapezius's fall, the armpit, the pectoral's tendon: `joint`) drawn in with it. Norrin's arms 20 % in over a body 10 %
  narrower than the hero's, shalla's 8 % over her own: the shoulder's joints 0.205 and 0.194 of the stature apart
  (0.231 and 0.211 before; the body's about 0.20), the deltoids 0.283 and 0.269 across, the pectoral running into the
  shoulder with no ledge between. THE GROIN STRETCHES: a point's share of the thigh's bone by how far down the femur
  it lies (none at the hip's joint, the groin, the crotch and the seat's fold; through the rig's hip fold bone, which
  turns half the leg's swing; wholly a hand's breadth down), read the same by the pelvis and the thigh's top, so an
  opened leg stretches one skin (the thigh's top had been its bone's from the first rings: opened, its root swung away
  from the pelvis in a notch at the crotch, the seat's edge left a shelf); and the adductors' origin, a mass high on
  the thigh's inside, gives the stretch its stuff (the inner thigh's top had pulled across the crotch in a thin web).
  THE KNEE AND THE ELBOW BEND AS ONE SKIN: across a band either side of the joint, the upper segment's and the lower's
  points alike take the upper bone, the rig's fold (turned half the bend) and the lower bone by where they lie, so the
  two shells handed over at the joint's plane move together (the sprint's deep knee had swung the thigh's end out from
  under the shank behind the knee, a lobe with an edge); the shoulder's share of the arm's bone eases over a wider
  band (one narrower folded a ring at the joint's height in the arm's fore-and-aft swing) and the collarbone's fades in
  further off the neck (a swinging arm opened a notch at the neck's root). Read by the stretch audit (hero-stretch.mjs
  `--form`) against the authored hero over the stand, the gaits and the gestures: the elbow's seam opens 11 to 15 mm at
  worst (the authored 20 to 41), the groin's not at all; the knee's back pinches to 0.6 of its ring in the sprint, where
  the authored hero's seam opened 36 mm. THE DEEP HINGE'S CORRECTIVE: beside each knee's and elbow's fold, which pushes
  its head to the bend's outside to keep the kneecap's and the elbow's point, a crease bone turned the same half the
  bend and pushed not at all takes the bend's inside (a point's middle share split between the two by its side of the
  limb, eased round it), where the fold's push had drawn the skin in toward the bone: the sprint's knee pinches to 0.82
  of its ring at worst, and the bent elbow's inside stays full. The rig carries the two helpers (`kneeCrease<S>`,
  `elbowCrease<S>`) as bones an engine skins with. THE NECK STANDS ON THE SHOULDERS, not on a pyramid: the core's
  column and the ribcage's dome had reached 6 cm up inside the neck, and the base's wide blend filled from them to the
  neck in a tent, the neck's silhouette widening from under the jaw straight down to the shoulder at 40 degrees; the
  column now ends at the thoracic inlet and the dome under it, and the upper trapezius leaves the neck's side lower
  (it had begun at the jaw's height), so the neck is a column to its root and the trapezius falls from it at about 30
  degrees to a shoulder that stands where it stood (the collarbone was already nearly level: the slope was the fill).
  THE RAISED ARM LEAVES THE SHOULDER ROUND: a fold at the shoulder (the rig's helper turned half the arm's swing, as the
  hip's, `shoulderFold<S>`) carries the arm's own top from the collarbone to the arm's bone, where it had gone straight
  from one to the other and a raised arm's root pinched to a point at the armpit (its ring 0.55 of its rest, now 0.84;
  its band 0.09, now 0.53; its folds gone); and a skin share that would make a fifth bone on a vertex now drops the
  weakest instead of the share, which had vanished for one ring of the torso under the arm and come back on the next,
  a step where the deltoid's ramp was meant. Hands behind the head is hittable: the forearms reach behind the skull
  on the shoulder's roll (the elbow's hinge alone folds them forward, across the face). The stretch audit takes
  `--poses` (rig poses, `--only` for those alone). THE ELBOW NEVER TWISTS: the forearm is framed from the upper arm's
  frame by the elbow's bend alone (a rig bone's `parent`: its frame the parent's, then the shortest turn from its rest
  line carried there to its posed line), where each had taken the shortest turn to its own line and the two disagreed
  about their roll by as much as the arm had swung: forearms behind the head wrung the elbow 47 degrees (now 14) and
  pinched its ring to 0.51 (now 0.59, the deep bend's own), the arm's creased edges in that pose 306, now 162. Framing
  the arm by the shoulder's roll instead was tried and left: blended skin could only lose a roll of up to 110 degrees
  in a candy wrapper at the shoulder or a spiral down the humerus. THE SHOULDER ROUNDS INTO A RAISED ARM: the torso's
  cap over the deltoid follows the arm's own top (from the collarbone through the shoulder's fold to the arm, by how far
  down the humerus it lies), where it had gone to the arm's bone outright and a raised arm folded it up beside the arm's
  root in a horn, the shoulders square with both arms overhead. THE BICEPS AND THE TRICEPS LINK INTO THE SHOULDER AND
  THE ELBOW: each a chain where each had been an egg at mid-arm, the biceps from the socket's front under the deltoid to
  its peak low on the arm and its tendon into the elbow's crease, the triceps' long head from the shoulder blade behind
  the joint, fullest high on the arm's back, to its tendon at the elbow's point (the arm's front had dipped under the
  deltoid and the back fallen away from mid-arm; the girth now 31.8 cm a tenth down the arm, 29.4 before, the most 33.7).
  THE SHOULDER GIRDLE IS A MECHANISM: a scapula (the acromion and the blade's two angles, `scapula<S>`) the vajra turns
  upward by the scapulohumeral rhythm (past the first 30 degrees of raise one degree to the humerus's two and a half, at
  most 60, about the blade's own normal through the middle of its spine; `SCAPULA_POINTS`), the glenoid riding it, so the
  shoulder rises because the blade turns and the collarbone's lift follows; a rig without a blade lifts the shoulder by
  the collarbone alone, as before, to the byte. At 170 degrees of raise the humerus stands 115 in its socket (the body's
  most is about 120), where it had stood the whole 170 in a socket that never turned. The arm's root and the shoulder's
  fold turn from the blade, over a band 8 cm down the humerus (16 before): raised overhead, the arm's upper third had
  sagged off its bone by up to 4.5 cm, now 1.0; the arm's root ring 0.84 of its rest, now 0.93. body-study `--bones` draws
  the spine, the collarbones, the blades, the humeri and the forearms over the shell. THE PAULDRON: what a raised arm
  bunches over the shoulder, masses of the form field like the rest (the build's `pauldron`, in stages: a water bag
  over the blade, narrow at its top and full at its foot, so it hangs as the trunk stands; the trapezius's cap over the
  shoulder's top, a plate a third as deep as it is wide, so the front and the back see it and the profile hardly does;
  the deltoid's top bunched over the joint, late in the raise, sampled into the arm's top too, the corner a raised arm
  leaves by the head), never in the bind: the torso (and the arm) sampled again with each, the same rings and slots, the
  difference a corrective per side (`recipe.correctives`, an offset per point at full weight, the weight by the arm's
  raise between the stage's own degrees) that `correctiveRest` adds to the rest
  before the skin poses it, an engine's morph target (its export to come); the body study and the stretch audit pose
  through it. The skin over the shoulder's point and over the blade rides the blade, the collarbone its own inner run
  in front: all of it on the collarbone, a raised arm's shoulder top had floated over the acromion under it. Shalla
  wears the hero's pauldron, its masses 0.85 of his; her bust's fold is filleted in the field (`fold`, bust radii: the
  height eases in from flat, the apex kept at its projection), the fold's wall a corner the rings crossed on the slant
  in stair-steps. Only the feet are still the authored cage. THE PHYSIQUE: four dials over a build, each −1 to 1, 0 the
  build as authored (the athletic base, the build itself to the byte): `bulk` the muscles across and how proud they
  stand (the bones and the joints as they are; on the plus side the arms set out with the shoulders' muscle, the
  pauldron grown faster, the calf fuller, longer and higher over a soleus hardly grown (a high diamond over a long taper to a slim ankle), the thigh eased off toward the knee and its front and outer heads set higher (widest up top, not a barrel over the knee), the forearm full down to a wrist the size of hands a tenth bigger),
  `tone` the blends tighter or looser and the abdomen's and the serratus's relief, `weight` a layer of fat over the
  whole skin (thinning down the limbs to none at the wrist, the ankle and the head's base, and eased out between the
  legs, where it fused the thighs), the belly forward, the flanks, the seat behind, the neck; `height` the stature a
  tenth either way, by the hero's own tune. Words for points in it (`PHYSIQUES`): athletic, skinny, heavyset, jacked;
  `physique(build, word | dials)`, body-study `--physique`. Under a physique the crotch is sought no lower than 0.6 W
  under the hip's joint and the pelvis's rings hidden inside the thighs drawn in to a cone round it (thighs that nearly
  meet had folded them in a zigzag). Shalla's calf bellies run a third longer, one form from behind where they had stood
  as two beads. THE SHOULDER BLENDED OVERHEAD, with the pauldron: a raised arm had crumpled the torso's skin round its
  root into folds, and the torso's cap, a few millimetres over the arm's top at rest, stood through the arm's skin in a
  sawtooth of spikes. The slice is posed in two stages, the arms level and the arms overhead, each over the one before:
  there the torso's skin round the shoulder (by its share of the arm's and the girdle's bones, or its nearness to the
  arm) is smoothed over its grid (Taubin's two steps, no shrinking), a point on or through the arm's skin sunk under it,
  and the change carried back to the rest through each point's own skinning map (linear blend skinning is linear in the
  rest point), a corrective per side and stage (`shoulderLevel`, `shoulderOverhead`) over the raise. The shares round
  the arm's root are eased over the grid as well. The edge where the arm leaves the torso is one curve now; a few slivers
  stay deep in the overhead armpit, and the level arm's own root still pinches to a point under it. THE SLICE FASTER, to
  the byte: an athletic slice took 54 s (Norrin) and 94 s (Shalla), now 9.4 s and 12 s, the recipe the same byte for
  byte. The field's masses read without arrays (the same arithmetic in the same order; the allocations were most of the
  cost); the march reads a sample only where the field has not settled it (a sample `f` leaves the skin at least
  |f| / 8 away, so the nearer samples' signs are known: the same samples decide); the crossing within the step found
  by false position (Illinois), a handful of reads where halving took thirty; and a pauldron's stage casts again only
  the rays its mass reaches, the relaxing run over them and a margin round them (`resamplePart` `reuse`); the shoulder's
  blend finds the arm's nearest vertex from a grid, not every vertex; the field's sums read into kept buffers. Then
  faster again, a few points moving: 5 s (Norrin) and 7.7 s (Shalla). The relaxing's projections read the field's
  gradient forward from the value, three reads where centred took six (centred still for a ray's fallback and the
  pelvis, where at the crotch's level the skin's two walls stand close and the cheaper read settled rings on the other
  wall); the march's slope bound 4 (at 2 the shank's masses broke it); a pauldron's stage relaxes a band narrower each
  iteration; the shoulder's blend compiles the torso and the upper arms alone. Of Norrin's 9,428 points 4 moved over
  0.1 mm (0.11 the most); of Shalla's 11,316, 22, and 2 over a millimetre, in the fold under the bust, where a point
  settles a few millimetres along the crease either way (the fold reads the same).

### Epidermis cube: skin and hair as a recipe

- **Brows.** An epidermis cube (`epidermis/epidermis.js`) is a character's surface as a small recipe, as the geocube
  is a level's look: its first groom is the brows, grown as strands on the relational head by its relations (the
  head over the inner canthus, the arch's peak over the outer edge of the iris, the tail on the line from the nose's
  wing through the outer canthus), in three regions (the head's hairs up, the body's out and up, the tail's out and
  down) with the herringbone along the spine, laid on the skin. The brow hangs on the brow bridge's strings with the
  fold under it: its head is tied on the medial string, its tail on the lateral string (which runs on the line from
  the nose's wing through the outer canthus), and its peak rides the fold's arc. A raised or lowered brow pulls the
  strings, so the hairs and the fold move together, and the same hairs are carried rather than regrown. The field
  lane draws them (`--epidermis`).
- **Lashes.** The cube's second groom roots on the eye rig's lid margins, which the rig now exposes as lash lines.
  The upper lashes are longest centre-lateral and curl up; the lower are shorter and sparser and curl down; the
  lateral lashes flare outward. Each leaves the margin at an elevation set by where the margin sits on the globe and
  the lid's roll, so the lashes ride the openness, a squint, the gaze and a blink, and a shut lid's lashes hang.
  Every lash is grown step by step: a step that would sink into the skin bends off it with its length kept, and a
  lash that cannot clear the skin ends there. Shape words: `natural`, `long`, `curled`, `straight`, `sparse`, `full`,
  each with numbers over it (`length`, `curl`, `density`, `flare`, `lower`, `seed`); `lashes: false` grows none.

- **Skin relief, studied on swatches.** The cube's skin (`epidermis/skin-relief.js`) conveys keratin rather than
  simulating it: a few numbers in, and a height and a roughness out at any point of a flat chart, gray. It has four
  fidelity tiers, each adding to the last: `form` (nothing), `creases`, `keratin` and `micro`.
  - **Creases** are thin lines at the bone/skin connections. They fan from a point (crow's feet across the lateral
    orbital rim) or run beside a tether (under-eye, forehead), each a wavy, tapered, sometimes forked groove with
    the skin bunched beside it.
  - **Keratin** is the primary lines: two crossing families of long, wandering furrows about the skin's tension
    direction, deep in stretches and fading in others, with a weaker family across. Round pores sit near their
    crossings (and scatter between them on the nose), and a faint minor net turns to follow a crease.
  - **Micro** adds the finest net, the keratin grain and its sheen.

  The dials are the region (forehead, cheek, nose, eyelid, chin), age, squint, and the pore and crease scales.
  `/head-study --skin` renders the swatch sheet. The cube reads `skin` (`fidelity`, `age`, `pores`, `creases`,
  `seed`).
- **Skin on the head, by zoom.** The relief lies on the relational head as a shading layer (`epidermis/skin-head.js`):
  a perturbed normal and a cavity darkening per point, never geometry. Each layer shows over its own range of
  millimetres per pixel (`SKIN_ZOOM`): keratin lines and pores from a close-up, the micro layer in a macro shot.
  Coarser than its range a layer is held back rather than aliased, so a whole-head or portrait view is untouched.
  - **Where it lies:** a millimetre chart runs around the head's vertical axis. The regions come from the relations
    (nose, eyelids, forehead, chin, cheek), blended where they meet and with the tension mirrored left to right.
  - **No creases:** the head carries no crow's feet or wrinkles, which read as incongruous with its design. The
    creases tier stays in the swatch study, and lines along a tether are staggered pieces there.
  - **Field lane:** `--skin` shades the field lane with it, and each panel names its zoom and the layers it shows.
    `--crop macro` frames the outer canthus, and a row of `--acts` may carry its own `crop`, which makes a zoom strip.

### Relational head: the face as superposed vajras

- **The head field, seen as it is.** `/head-study --field` meshes the protoform head's field with surface nets
  instead of the latitude rings, so the turntable shows what the field holds. It overlays the head's landmarks, cuts
  sections through the head (the profile, and across at the brow, the nose base and the mouth), and prints caliper
  measurements read off the field itself: head length and breadth, face and jaw width, face and nose height, nose width
  and protrusion, mouth width, and their indices.
- **A head of relations.** `--source relational` reads a second head (`head-relational.js`): named proportions (the
  facial thirds, the eye line, head length and breadth, face and jaw width, the rule of fifths, nasion depth, nose
  projection) place its points, vajras strung between them make the skull (`--layer skull`), and its skin is every
  vajra's wave summed, the bones offset by the forensic soft-tissue depths and the muscles and fat pads at rest. The
  relations are on the skin; the wave's internal points are solved until the skin's calipers meet them, so each
  relation reads its own target (`--untuned` shows the head as authored).
- **The face's actions.** The relational head takes `actions`: `jaw` (the mandible rotates about the condyles and
  glides forward, and the mouth opens between the lips), `smile` (zygomaticus major draws the corners toward the
  cheekbones and lifts the cheeks), `browRaise`, `browLower`, `blink`, and a side alone (`smileL`, `blinkR`). Each
  drives named beads of the vajra graph; their displacements add, so actions compose. `--acts` renders an action strip
  with what each moved from rest.
- **Eyes and mouth.** The eye's opening is an almond read back from the lid margins (the canthi, the lids' apexes,
  `fissure` and `canthalTilt`), cut through the skin to a globe with its cornea: a blink brings the upper lid down to
  the lower and the opening closes; a smile lifts the lower lid. Each lip is two vajras, corner to cupid's bow peak to
  centre, the lower the fuller (`upperVermilion`, `lowerVermilion`), with the lip line, the philtrum and the
  mentolabial sulcus carved. The skin's wavelength shortens near the eyes and the mouth (`featureWave`), so features
  smaller than the wave keep their edges. `--crop face` frames the face.
- **The nose's pyramid and the cheek's balloon.** The nose's base width follows its length (`nasalIndex`, al-al over
  n-sn, tuned like the other relations), and two sidewalls rise from the wings to the mid-bridge, so the nose is a
  ridge with two walls and the wings read as wings. Straight out from the mid-bridge to under the eye's centre is the
  cheek's control point: a cheek balloon is anchored at the jaw's corner (pinned to it, so the cheek's wall follows
  an opening jaw), bulges there, and tapers to the mouth's corner above and below. A balloon keeps its volume, so a
  smile that shortens it bulges the cheek; the zygomaticus thickens the same way.
- **A closed head.** The cheek's side is walled by the buccinator (upper molars, lower molars riding the jaw, the
  raphe between) and sealed to the chin by the depressor anguli oris; the parotid fills behind the ramus, a fill sits
  before the ear, the upper lip's body meets the nose's base and a columella closes the nose beneath. The field
  lane reports `through-holes` (`throughHoles`, lines straight across the head that meet no skin though skin closes
  round them): none at rest, smiling, or with the jaw open to its limit, on either pole. The philtrum is its columns
  alone (the carved groove read as a line). The al-al caliper reads the wing's knee when there is no groove.
- **The nose's base and its nostrils.** Each nostril is its own vajra (the wing's base, the alar lobule, the soft
  triangle beside the tip), placed from the nose's bottom by `nostrilRise` and `nostrilSet`; the alar bar joins the two
  lobules under the subnasale, so the wing's outer side is the alare and al-al meets its target again. The upper lip's
  body is two cones, one per side, from under the wing to the cupid's bow peak, meeting on the midline: the lip slopes
  forward from the subnasale and the nose sits on it, raised from it (one span across had risen over the subnasale and
  melted the nose's base into a bulb). The nose's flesh is a cone down the middle, narrow at the bridge and widening to
  the base over the wings, closing the grooves beside the ridge; a second cone across it, low beside the tip, closes
  the window in each side between the wing, its wall and the tip. Both take their radius from `noseFat`, how fleshy
  the nose is: wider and fuller, never longer (the tip's projection and the wings' width stay their own relations).
  The al-al caliper reads the wing's knee when the tip's slope leaves the wing no crest.
- **The jaw's limit.** `jawOpen` is how far the incisors part at full (`jaw: 1`, ~39 mm male, ~37 mm female: a full,
  comfortable opening), `condyleGlide` how far the condyle glides forward and down the articular eminence. The jaw
  opens by rotation alone at first and glides as it opens wide; the hinge's angle at full is solved so the opening
  meets `jawOpen` (`jawPose`), so the opening grows evenly with the activation and stops at the limit. The head returns
  `jaw` (the angle, the glide, the opening and the limit) and the field lane prints it. The open mouth is an oval that
  rounds into its corners (it was a diamond).
- **The lips stand forward.** Seven masses end beside the mouth's corner, and their summed waves had swelled it ~12 mm
  proud of the cheilion, with the alveolar arch's ends on the corners besides: the mouth sat flat in a trough between
  two mounds. The masses now end at the modiolus, which the tune sets back until the skin at the corner is on the
  cheilion (`mod`), and the arch curves back behind the corners, so the lips stand on a ~12 mm arc in front of the
  cheeks.
- **The lips' bodies and the cheek's fold.** The upper lip is the philtrum's body under the nose, set behind the
  philtral columns, and a thin plate each side out to just above the mouth's corner; the lower lip is a body from corner
  to corner behind its vermilion, riding the jaw, standing forward down to the mentolabial fold. They are their own
  group (`lipBody`), joined to the skin by a smooth minimum like the nose and the vermilion rather than summed with the
  cheeks, so they keep their shapes and do not swell the corners or fill the fold. The cheek takes a fold: a thin roll
  from beside the wing's base, past the mouth's corner, down to the jowl, summed into the cheek as the edge where its fat
  stops against the lip; it rides the cheek's bulge, so a smile deepens it, and the jaw at its foot. The upper lip's top
  sits back under the nose, so the nostrils' base stands off it in an angle, and the lip slopes forward to its peak at
  the vermilion. An alar crease is carved round the back and the bottom of each wing, where it meets the cheek and the
  lip, and the fold begins there; under each wing a sill (the lip's top edge, from the philtrum out to the wing's base)
  tucks under the nostril, so the wing sits on the lip in a crease, not over a slot. `philtrumVolume` is the
  philtrum's fullness: its body's radius down to the bow, the columns growing with it. The upper lip's plates and sills
  taper (each centre bead on the line between its ends, its radius between theirs), so the lip falls off evenly from
  the philtrum to the corner with no terrace for the light to read as a lump. The al-al caliper takes a groove the wing
  runs straight down into, near its edge, as the alar-facial groove even with no crest before it.
- **Lip fullness and the jowl.** `lipFullness` is the vermilion's volume: its beads' radii about their fixed centres
  (the corners stay fine), so fuller lips stand further forward and grow taller and rounder; 1.25 by default, 1.3 on
  the female pole, and the lip line parts them as far forward and as deep as their fullness carries them. The cheek's
  fold ends in the jowl: `jowl` is its roll's radius at the foot (0.012, flatter than before) and `foldReach` how far
  below the mouth's corner it runs (0.05, to the lower lip's edge; ~0.12 carries it past below the lip toward the jaw).
  The fold's top is anchored on the cheek behind the wing, level with the alar crease, so it has a broad base and sits
  back from the lip; its middle rides the zygomaticus up and back as the cheek bunches over it in a smile.
- **The teeth.** The incisal point (`inc`, where the incisors meet behind the stomion, `incisorShow` below it: ~7.4 mm,
  ~6.4 mm female, so ~4 mm of the male's central incisors and ~3 of the female's show under the full upper lip as the
  mouth opens) anchors the dental arches and is where the
  jaw's opening is measured. The upper arch is seven crowns a side on a curved arch (`DENTITION`: central and lateral
  incisors, canine, two premolars, two molars, each placed out from the midline and back from the incisors' faces, the
  arch narrowing into its curve at the front and running nearly straight back along the molars; `archWidth` scales
  it), each crown its own upright vajra from the cervix to its edge or cusps on the occlusal plane, the incisors
  leaning forward and thin at the edge. The lower arch is the upper's mirror across that plane, a touch narrower and
  `overjet` (~3 mm) behind, riding the jaw. The crowns join each other with an all but hard edge, so they read as
  teeth, not a band. The tongue is its own mass on the floor inside the lower arch, apart from the teeth: its stations
  are placed from the lower crowns themselves (the tip a gap behind the incisors, each half's side a gap inside the
  premolars and the first molar, 1 to 3 mm all round), its dorsum a hair under the lower teeth's edges. The palate
  roofs the mouth on the midline above the upper teeth (the cavity had opened into a hollow there). As the jaw opens an oral cavity is carved behind the lips along the arch
  (each side through the incisors, the canine and the first premolar, down the middle and across the back, reaching
  both arches' edges, narrowing inside the cheeks; beside the incisors each station is two beads up and down the line
  between the crowns' edges, since one round bead tilted by the open jaw reached forward through the skin under the
  lower lip's ends), and the teeth and the tongue, joined after it and clipped to its
  neighbourhood (another carve never bares them), line it: the open mouth shows the upper incisors under the lip, the
  lower row and the tongue. A septum fills the nose's midline (a
  pocket there opened to a line seen through from the side as the cheek moved). The through-hole lane finds none over
  the jaw's range in tenths, plain and smiling.
- **A rounder chin.** The mental tubercles (the chin's corners) sit closer in, lower and smaller (the mandible's front
  ends follow them in), so the chin's front rounds off from the midline instead of standing flat between two balls:
  12 mm out it falls 0.7 to 1.1 mm behind the pogonion and 18 mm out 1.5 to 2.3 mm (both were flat to 0.2 mm). The
  jaw's width and the face's height are unchanged. `head-study --field` gains `--crop chin`.
- **The female face's proportions.** Read as ratios (both poles are drawn at one head height, so millimetres against
  adult norms mostly show the female head's smaller size), her face was as long as his for a narrower width and her
  skull too broad: her facial index stood above the male's where the norm (Farkas) sets it ~2.4 below. Her thirds
  shorten (`third` 0.28, the eye line following to 0.49 so the brow keeps its height over the eye) and her vault
  narrows (`cephalic` 0.79): facial index 87.2 → 84.7 (male 86.3), n-gn/g-op 0.615 → 0.592 (male 0.608), n-sn/g-op
  0.291 → 0.280 (male 0.285), eu/g-op 0.802 → 0.790 (male 0.781). The face sits lower on a relatively larger, rounder
  vault; the tune meets every relation as before.
- **The wings' bases.** Each wing meets the face in one crease: the alar crease runs behind the wing's root, clear of
  it, its edge blended, so the root's round end is the wing's heel (cut across the wing in front of the root, it left a
  curled flap outside the groove; cut into the root's back, a point), the root sits just inside the alare so the
  lobule alone is the wing's widest, and the sill under the
  wing sinks its outer end into the cheek (it stood a round knob 7 mm proud of the cheek beside each wing). The
  calipers (al-al, n-sn, sn-prn) are unchanged.
- **A soft mentolabial fold.** The fold between the lower lip and the chin is a broad, shallow hollow curving with the
  lip and thinning away at its ends, its edge blended over ~3 mm (carves take their own edge: the lip line stays crisp).
  Cut as a thin tube with the lip line's sharp edge, it read as a chevron scored into the skin.
- **The lower lip and its fold as the jaw opens.** The fold flattens as the mouth opens (its carve rides the jaw and
  lifts forward out of the skin), and the lower lip stretches down over the lower incisors and settles back (its body
  and centre by up to 6 mm at the limit, its fullest beads by less), so it no longer rolls out over a deep crescent:
  at jaw 0.6 the male's midline reads lip 2 mm ahead of the chin and the fold 2 mm behind it (was 4 mm ahead and 4 mm
  behind), at the limit lip to chin is one line. The tissue over the mandible (the chin's, the angle's, half the
  masseter's and the buccal's) now rides the jaw, so a swung chin keeps its own tissue depth.
- **Ears.** The relational head wears ears in the shape of the operator's sketch (`head-ear.js` `EAR_OUTLINE`, now
  exported): the helix rolled along the outline into the lobule and curling into its root, the antihelix's Y, the
  tragus raised into the notch over the lobe, the concha's bowl and a blind canal. Their place is relational: the top
  at the brow (`earTop`), the lobule level with the nose's base (`earBottom`), the long axis leaning back from
  vertical by `earTilt` degrees, the hinge on the head's own skin, found by probing the field. The concha stands a little
  off the head with its back welded to the skin, and the outer ear folds off it at the antihelix (`earProtrusion`).
  `earlobe` sets the lobule from free (0, tilted off the head) to attached (1, tilted into the cheek, where it fuses).
  `--crop ear` frames the right ear.
- **Expressive eyes.** The relational head's eyes are a rig of their own (`head-relational-eye.js`): a globe whose
  cornea, iris and pupil turn with the gaze; the lids as a skin shell over the globe and its cornea (a shut lid shows
  the gaze), the opening carved between two lid curves, each with its own height, peak (inner to outer) and shape
  (flat and tense to peaked); the upper lid following the gaze's pitch; a crease, a hood and a pretarsal roll that swells
  in a squint. `eyes` takes a word (`neutral`, `wide`, `angry`, `sad`, `sleepy`, `happy`,
  `suspicious`, `focused`, `closed`), channels over it and a side's own; blink, a smile's squint and the brows drive
  the same channels. The field lane paints the sclera, iris and pupil, takes `--eyes` and rows with their own `eyes`,
  and frames `--crop eyes` and `--crop eye`; a crop meshes only its own box.
- **A gaze target.** `eyes: { look: { x, y, z } }` (metres from between the eyes: +x the figure's right, +y ahead,
  +z up) aims each eye from its own centre, so a near target converges them and a far one leaves them parallel; the
  lids follow, and a word or a side's own gaze composes with it. The head reports its `vergence`.
- **The eye's depth.** The eye was set deep in a walled socket: it read from the front but sank from ¾. The skin
  over the lateral orbital rim stood 6–8 mm ahead of the cornea, where it belongs about 10 mm behind, and the brow
  stood 19–22 mm ahead. The cause was the orbit's frame: it was anchored to the glabella, not to the eye.
  - **New relations:** the eye hangs off the nasion by `radix` (11 mm). The brow's outer end sits `orbitRim` behind
    the cornea and the cheekbone's front sits `malarDepth` behind it. A `lateralOrbit` tissue marker gives that rim
    forensic skin.
  - **The brow** is an arch each side, the glabella over a supraorbital peak (`browProjection`, flatter on the
    female pole) to the outer end. It replaces a straight bar, which ran in front of the eyes.
  - **The skull** gains its lateral orbital rim, the zygoma's frontal process (skull only: the skin over it is
    already the wave of its neighbours). Its orbit becomes a cone that holds the globe clear of bone.
  - **Measured** in mm ahead of the cornea, male / female: radix 11 / 11, brow over the pupil 11.6 / 9.3, skin
    over the lateral rim −9.6 / −9.5, the skull's rim −16.1 / −16.1 (Hertel's 12–20). The wave still meets every
    relation within 0.4 mm, with no through-holes.
- **Upright ears.** `earTilt` is now degrees from vertical, not a share of the nose's dorsum. Through the dorsum the
  ears read about 18° along the long axis (helix top to lobule bottom), too angled. At 6° they read about 10°, the
  clinic's floor. The ear still turns about its hinge with its top at the brow and its lobule at the nose's base. The
  tragion moved 0.4 mm and the outer canthus to tragion stays about 76 mm. The attached lobule still fuses, with no
  through-holes.
- **The outer canthus, closed cleanly.** With the outer wall gone, a slab showed at the outer eye corner. The lid
  space's floor ran level past the canthus to the arc's foot, and both it and the opening's sliver end cut back to
  the globe's centre, where the globe no longer reaches, leaving a shelf and a slot.
  - **The lid space:** its floor now rises to the arc's foot, and its cut has a depth floor, shallowing toward the
    feet and past the canthi.
  - **The opening:** it keeps its deep corner pockets where it is open, and grows shallow only where it thins to a
    sliver.
  - **The cut's blend** is softer, so its fold edge is smoother.
- **The iris, patterned.** The iris carries a light pattern: radial fibres, a wavy collarette ring parting a lighter
  pupillary zone from the ciliary, darker crypts, a dark limbal ring and a thin pupillary ruff. It is a tone over its
  colour (`irisTone`, the head's `paintTone`), periodic round the iris, seeded per eye and paint only, with no
  relief. The field lane shades it per pixel.
- **The brow's bridge, and the lid space hung from it.** An invisible bridge runs across the forehead (`browBridge`)
  with four strings hanging from it: two medial strings down beside the nose's root, and two lateral strings down the
  temples. Each eye's arc, the edge of its fold under the brow, hangs between its two strings' feet just past the
  canthi, and the brow is tied on the same strings. The brow pad's action pulls the strings, so a raised brow lifts the arc and a lowered one drops it. The
  upper lid now drapes the globe from its margin to the crease. The fold rolls out of the crease and rises forward
  to the brow at the arc, and the lid space closes where the arc's feet meet the canthi. Before this, the brow's skin
  stood about 19 mm proud of the cornea right down to the lid margin, which hid the lid, the crease and the hood. The
  `hood` channel lowers the crease and draws the fold down, and the crease is a groove along it. `--rig` draws the
  bridge, the strings and the arcs in red on the skin.
### Engine legs: the engines as translations, declared

Every engine pack is a translation of the web game. Which engines exist, what each one carries, and how each is
held equal to the web are now said once, in an engine registry, instead of in a Godot-shaped column threaded
through the code. Roblox joins as the second engine with a runtime kernel.

- **The engine registry** (`lib/graph/scene/engines/registry.js`): one row per engine (Godot, Roblox, Unity, Unreal,
  Blender), its kind (a runtime kernel, a scene project, an art pass), its marks module and the folder its pack lands
  in. The desktop packager's ignore list reads the folders, so a Roblox pack beside a desktop app stays out of it.
- **Marks per engine.** A mark row is keyed by its engine (`{ godot: 'built', how }`, `{ roblox: 'absent', how }`),
  every table in one vocabulary (built, approximated, absent), the bus rows among them. Each engine with a runtime
  kernel has its own marks module over the same closed keys (`godot-marks.js`, new `roblox-marks.js`); what no engine
  owns (the camera and traversal rules, the drawing options, the ledger's information rows) is in
  `scene/engines/marks.js`. `bus-abi.js` is the contract alone: which rows an engine performs is its marks' `BUS_MARKS`.
- **The score reads the engine it is for.** `extractEngineScore(…, { engine })` reads the level against that engine's
  marks; Godot packs are byte-identical. Unity and Unreal packs no longer carry Godot's reading rows, Godot's bus
  column, or a flag naming "the Godot kernel": their kernels run no bus, and their portability reads as before.
- **The cosmos counts every engine.** A facet value carries its mark in each engine (a sourced setting's `marks`
  reader runs once per engine; a value no one marked for Roblox reads as absent, while Godot still throws).
  `dryRun` returns `engines: { godot, roblox }`; the sweep, its CLI and the hillclimb page give each engine its
  column and its scoreboard. Roblox starts at zero worlds, and its scoreboard ranks what to build first.
- **The ratchet, per engine** (`scene/engines/marks.test.js`): every engine's tables are closed against the same
  sources (`scene/engines/mark-sources.js`), the cosmos registry agrees with each engine's export tables, and a young
  kernel marks a row only with the part of the place that carries it: a Roblox row not absent says how, and a built one
  names the kernel module or place file that performs it, which must be there.
- **One conformance protocol.** `scene/engines/conformance.js` says what each corpus holds equal (bus, combat, mind,
  rules, scenes: its scenarios, the kernel modules it needs by module id, the web's runs) and compares any engine's
  output to the web's frame by frame; `scene/engines/runners.js` says how each engine's kernel is laid out and run
  headless. `node scripts/conformance.mjs --engine godot|roblox --corpus <name>` replaces the five
  `godot-*-conformance.mjs` scripts (their Godot runners moved to `scripts/conformance/godot/`); it refuses, naming
  the module, a corpus the engine's kernel does not have yet. The sound meter's corpus keeps its own runner.
- **The Roblox kernel's first modules**, in Luau (`scene/roblox-kernel/`): the event bus, the stats and the game store,
  ported from the web runtime and laid out as the Godot kernel's modules, with `js.luau` saying once how JS reads a
  value (null and undefined, an empty array and an empty object, numbers printed as JSON prints them, UTF-16 hashing and
  order) and `json.luau` reading JSON as JSON.parse does. Pure Luau with no host API: the same modules run under Lune
  and in a place. The bus corpus runs equal to the web on them, frame by frame, stats and store scenarios included,
  and every planted bug is caught (`MOJULO_LUNE`, `scene/engines/conformance.test.js`). Lune and Rojo join the
  optional workers (`lib/workers/find.js`: `MOJULO_LUNE`, `MOJULO_ROJO`, a Roblox toolchain manager's or cargo's bin).
- The bus corpus gains words beyond ASCII (`text`: a spawn id hashed over UTF-16 code units, accented and astral words
  matched and stored) and the one place UTF-16 order and code point order part (`text-order`).
- **One pack pipeline.** `scene/engines/pack.js` holds what every pack is built from: the row and its pixelizer
  refusal, the recipe's hash, the level seam (resolveWorldScene → facesToGlb → the engine's score, the bus, the
  level's sound), a game's levels and posture, the music beds, and the clean emit that keeps the developer's folder.
  The Godot, Unity and Unreal legs compose it and keep only their own layout, sidecars and music policy; Blender and
  the arcade leg take its front. Every pack is byte-identical but one: a Unity game whose menu music is also a
  level's now ships `audio/menu.wav` (the importer probes it; the old dedupe dropped it, as Unreal's already did not).
- **`export_game { target: 'roblox' }`**: a game as a Roblox place, written as a Rojo project under `<ref>/roblox/`
  (`rojo build default.project.json -o game.rbxl`, then Play in Studio). The place carries the Roblox kernel as
  ModuleScripts; each level's bus.json and contract.json as the exact JSON text the kernel decodes; a greybox per level
  (every upward face of the level's mesh rastered into floor slabs, each box collider a wall); and a thin server that
  plays the levels in order, one player driving (set Max Players to 1: a script cannot). A Roblox Humanoid walks the
  player, its pace, jump and pull from the pilot's rule; the HUD is drawn as words (readouts in their slots, banners
  and toasts as moments); the bus's own entities are drawn as the page draws them; a key reaches the bus by the page's
  name for it; the outcome is applied to the store and the next open level starts. The level's look rides beside the
  project as `model.glb` for Studio's 3D Importer. What does not travel (menus, the web's walk feel, link travel, saves
  between sessions; a cast, its fight and its scenes since the whole level, below) is the portability report's, with
  each value's Roblox mark.
- **The level step and the game channel, in Luau** (`roblox-kernel/level.luau`, `game.luau`): where the bodies stand
  becomes zone facts, the bus runs in the page's frame order, its warps are handed back, and the page's game channel
  hears the log (the first pattern as written maps an event; an emit gathered and its `{event}` named, an end and its
  exit, a door left by once, the kept numbers rounded as the page rounds them). Held equal by a new **level corpus**
  (`scene/level-conformance.js`): real levels composed from their mechanics (pickups, hazards, a death, doors and named
  exits, a carried chapter, a kept score, laps on foot, a fall off the ground's edge and its warp back), walked in the
  web runtime and replayed under Lune frame by frame, its planted bugs caught. `json.luau` now keeps the order an
  object's keys were written in (`js.keys`), which the channel's first-match reading needs.
- **The Roblox gate** (`node scripts/export-roblox.mjs --ref <game>`, `scene/roblox-gate.js`): Rojo builds the place
  and Lune opens it, checks its tree, compiles its scripts and plays every level from the place's own kernel and data
  over the track the web recorded for it, frame by frame against the web, and checks the kernel it carries is the one
  the corpora hold equal. Advisory: without `MOJULO_ROJO` and `MOJULO_LUNE` the pack is emitted and the gate says why
  it skipped. The eyes gate is the operator's, in Studio.
- **Roblox marks, the first ones flipped**: the bus's logic, guards, warps, zones, timers, start and stats, the game
  channel and the colliders built; the walk and platform rules, the follow and eye cameras, the faces (as the greybox),
  the HUD (as words), key inputs and the play shell's level list approximated. Mechanics follow from the bus rows they
  use: reach-exit, fail-on-death and win-when built; collect, survive, hazard-damage, laps, score, clock and the rest
  of the zone family approximated; a door, a use and a beat absent (a cast, hits and sight came with the whole level,
  below). The hillclimb page's Roblox scoreboard ranks the rest.

- **The Godot kernel, principled** (kernel 0.29.0). Every step below is held by Godot 4.7.2 headless: the five corpora
  and the level corpus equal to the web, every planted bug caught.
  - `kernel/js.gd` says JS value semantics once (truthiness, `===`, ToNumber, the relational operators, String(v),
    numbers as JSON prints them, the deterministic stringify, FNV-1a over UTF-16, the glob, Math.imul and
    Math.round, a heading's vectors, a segment against a box); the copies in the bus, the minds, the fight, the
    rules, the nav and the game shell are gone, and every module calls it.
  - Two JS rules the old copies missed: dictionary keys sort by UTF-16 code units (an astral word before a fullwidth
    one, the bus corpus's `text-order`, now equal), and a glob's `*` stops at line terminators and matches to the
    very end, as a JS regex does (new scenario `glob-lines`). A string compared with `<` compares code units too.
  - `kernel/game_channel.gd`: the page's game channel, out of `level.gd` and held equal by the level corpus (now run
    on Godot too, with its own plants). It settles three ways Godot's outcome drifted from the page's: a level's
    `initial` events are not mapped through the contract (the page's channel listens only once the bus has
    started), a kept number's `scale: 0` is no scale, and a var holding a number's text is kept as its number.
  - `kernel/beat.gd`: the music's beat clock, out of `level.gd`.
  - One frame, live and in the harness (`level.gd _frame`, its order written beside it): the frame's presses, the
    beat, the bus and the fight's first half, then the drivers, the pilot by its rule and the fight's second half.
    Live play steps it on the physics tick with the keys as the pilot's input, where it used to step the pilot on its
    own tick before the bus heard where it stood; a ruled walker no longer steps itself.
  - The cast's edge-detected facts remember the last read in the cast's state, not in the module.
  - One input a frame, for the pilot's rule and the fight: A / D turn and Q / E strafe as the page binds them (the
    fight read A / D as a strafe, so a swing picked a side the page would not), and a recorded `fire` and `aiToggle`
    now reach the fight in the harness; G toggles the AI live.
- **The web harness freezes as the page does.** The level sim (`game/level-sim.js`, the truth the engine harnesses play
  against) walked the pilot on under a menu: it read the menus one step late, and its frozen step passed a zero `dt`,
  which the world's step reads as 1/60. The page steps no world while a menu is up, from the step right after the bus
  that opened it; the sim now does too, and a level that opens a menu under a held key plays equal in both engines
  frame by frame (`godot-frame.test.js`).

- **The Roblox kernel, whole** (`scene/roblox-kernel/`): the motion and camera rules (`rules.luau`), the cast, the fight,
  navigation, the minds and their groups (`cast.luau`, `combat.luau`, `nav.luau`, `mind.luau`, `group.luau`), and the
  scene runner and quest journal (`scenes.luau`, `quests.luau`), ported from the Godot kernel and held equal to the web
  under Lune by the same corpora (rules, combat, mind, scenes), default and seeded, with planted bugs in every module
  (`engines/roblox-rules.test.js`, `roblox-combat.test.js`, `roblox-scenes.test.js`); the corpus holes the plants found
  are listed in those tests as survivors, so a scenario that closes one says so. Every corpus now has its kernel in
  both engines.
- **A whole level in the Roblox place.** `level.luau` builds a level's cast, fight, minds, scenes and journal from its
  bus.json and steps them in the page's frame order, with the Humanoid's pose as the pilot (a Humanoid has moved by the
  time the server steps, so the fight runs in one call where Godot splits it round its own pilot). A new **levelcast
  corpus** (`level-conformance.js castCorpus`) plays real composed levels on the web (guards that spot the pilot, a
  melee fight, an ambush that bites, a cast cued by the bus and a scene) and feeds Lune only the pilot's pose: the bus
  and every other body equal frame by frame, with plants for the order (`engines/roblox-levelcast.test.js`; the
  corpus has no Godot runner, `runCorpus` says so). The place ships every kernel module; the server draws each body as
  an anchored box (downed laid flat, sent away hidden), the left mouse button is the fight's fire, G the minds' world
  switch, and a scene's line and choices show in a box at the bottom. The place gate plays a cast level whole from the
  place's own kernel (`sneak-game` equal to the web). Marks flipped with it: the `ai` rule, the world switch and the
  tier, the cast's facts, hits, beams and sightings, the rearm and the cast rows built; the cast's effects (a box
  each, its moments undrawn), the bodies, scenes (words, no bars or shots) and quests (a word, no journal)
  approximated; the platform rule's strike runs in the fight. hp-pool, defeat-all and unseen now travel.
- **Where the Roblox ports found Godot off the web** (each now a scenario, with a plant per engine). A swing or a
  round spends the hero's guard (`guard-and-overdrive`, `guard-spent-by-a-swing`: a spawn guard held the hero
  unhittable for its whole clock); an overdrive's rounds hit 1.5 times as hard; a respawned mind is a fresh life, its
  last sighting forgotten (`respawn-forgets`; the mind corpus now takes cast ops as the combat corpus does); a scene's
  condition compares as JS does, a number's text as its number (`scenes-text-var`). Below what a corpus can see, the
  same port: a walk's turn in the web's `((x % τ) + τ) % τ` (Godot's `fposmod` parts by an ulp on about one heading in
  sixteen), the spawn's `among` measured in doubles (not a float32 `Vector2`), an empty `land` lands never, a null
  wait time or beat read as the web reads it.
- **A target, as advice** (`intent.target: 'roblox' | 'godot'` on a gameworld). The world names the engine the game is
  meant for, alone or beside its genre and cube; `design_game`'s readout (`intent.target`, a `target` next step) and
  the game bible then say which of the cube's values that engine does not carry and which it carries in part, read
  from the same marks the export reads. Nothing is refused and nothing rewritten: the game still makes and exports
  whatever it holds, and dropping the target drops the advice. An engine without marks is refused as a target, naming
  the engines it can be.
- **The Roblox marks made true across the registry.** A facet value marked inline for Godot read as absent on Roblox
  (its young kernel's default), so the 3D medium, a linear game, a stage kit or melee read as lost: the advice and the
  hillclimb page's Roblox scoreboard said so. Each is now marked for Roblox as the place carries it (the voxel look
  and coloured floors for kits, looks and level forms; the Humanoid for the hero, its walk, jump and stop; the fight
  for melee, ranged and gear; the stats kernel's own table; scenes, quests and talk as words; links, traversal and
  systems by what the greybox and the kernel do), and what the place does not do stays absent (pixel, weather, the
  top-down, side and fixed cameras, hubs and doors between levels, drive and fly, runs, the shot camera).
- **A Roblox place that looks like its level** (`scene/roblox-look.js`), built from the recipe on the operator's machine:
  nothing is uploaded and no account is needed. The floor slabs wear their faces' colours, each a Roblox material its
  texture or group names (grass, rock, bark, brick, slate, soil…), or else what the material shelf stamped on it (a
  metal surface or metal row Metal, mill scale CorrodedMetal, the glass row Glass), a textured face its tint times its
  texture's mean colour, a blend tile's over the ground it lies on where the tile shows (a meadow's grass, the trail's soil through
  it); a slab splits where the look changes, but the grid coarsens on the slabs merged by height alone, so the look
  never changes what the player stands on; a face too small to cover a cell's centre (a lane's dash) colours it only
  where nothing covering it lies near. The floor grid starts no finer than its area allows, so a road world kilometres
  long exports instead of overflowing. The rest of the
  level (walls, rocks, trees, props) is voxelized into boxes of one colour and material each, the voxel coarsening to
  fit a part budget, and the level's instanced repeats (a wall laid in bricks with `instance`, a stand of trees, a
  road's furniture) join it, each instance placed and tinted as the page places it, so they no longer go missing in
  the place, within a box budget of their own so a forest never coarsens the level; ground cover the page draws as cards, ground shadows, blend tiles and a backdrop are left to the
  slabs and the sky. The look is decoration only: no body collides with it and no ray meets it, which the place gate
  now checks part by part. Colliders become unseen, as on the page. The cast stands as block figures (a mind in red,
  the rest in blue) instead of boxes. Marks: the faces, textures and figures approximated; colliders built.
- **The harness stands where the page stands.** The level harness (`game/level-equivalence.js`, the web side of every
  engine comparison) raycast the recipe's raw faces, while the page meshes them first: surface cards realized, then
  de-collided, which lifts a patch stacked on coplanar ground a step for every face under it. A kart track's patch
  sits 1.27 cm above its raw height on the page, and so in Godot, whose land is the GLB the same pass wrote; the
  harness read the raw 0.05, so the fixture matrix blamed Godot. `pageGroundFaces` gives the harness, the level
  corpus's fall and the levelcast corpus's land the page's faces. The kart racers now hold equal for their first
  thirty seconds where they parted in one, and the supercar race is frame-equal start to finish.
- **A walk stands on the ground, on both engines.** The cast's walk (`cast.gd`, `cast.luau`) is pushed out of the
  level's boxes and stood on its land as the web's `stepRoute` does, at the body's own eye, height, radius and step
  (a cast row carries them as `walk` where the rule is not the walk's default). A farmhand minted below the ground
  stood there in Godot; the farming fixture is now frame-equal. The combat corpus prints where each body stands, and
  a scenario walks a body up from below the ground and round a box (`walk-on-the-ground`), with plants per engine.
- **A round's hit says what it dealt, on both engines.** The web's `hit:<id>` fact carries `dmg`, `harm` and `head` for
  a ranged hit (a round or its splash) so the bus can take it from an hp of its own; `cast.gd` and `cast.luau` dropped
  them. The combat corpus's snapshot now prints them (every ranged scenario carries them), and both kernels are equal
  again.
- **Every events key the page reads is marked, on both engines.** The marks ratchet reads the keys the World page's
  events channel takes (`mark-sources.js` `pageEventKeys`) and holds each engine's `EVENT_MARKS` to them, as it holds
  `PAGE_MARKS` to the page's inputs. The party's battles (`rpg`), the effect light and style floor (`fxLight`,
  `fxStyle`) and the minigames (`minigames`) are marked absent in Godot and Roblox, so an export says why each stays
  the page's. What 3.1.1 added is marked too: `versus` absent in both; `vertexContrast` approximated in Godot (shaped
  into the GLB, no Godot leg plays a geocube world yet), absent in Roblox; turn-based combat, now the party's rounds,
  approximated in Godot (the one-on-one battle travels); and the `party` mechanic, whose slice the web's `play.rpg`
  loads and writes, absent in both.

### Godot plays what the web plays

If Godot can run it, the export runs it; what Godot cannot run is named in the export, never dropped silently. The
JS runtime is the truth, and the Godot export is held to it by playing both.

- **One portability source.** `lib/graph/scene/godot-marks.js` marks every World page input, controllable rule,
  events key, gait, system, traversal entry, link and mind value `built`, `approximated` or `absent`; the export
  (`engine-portability.js`, the score's ledger) and the cosmos registry read the same marks, and a mechanic's mark is
  found by lowering it and reading the bus rows it uses (`laps` and `score` travel, keeping no best; `unseen`,
  `on-beat`, `push`, `crops` and `supplies` name the row they lack). Every cosmos value now carries a mark, and a
  value the web builds that Godot loses is what fails a world.
- **The ratchet** (`godot-marks.test.js`, no Godot needed): an unmarked page input, rule, events key, bus verb, cast
  op, ledger row, mechanic or cosmos value fails; so does a cosmos mark that disagrees with the export's tables, and
  a `built` mark that names no Godot leg proving it. `bus-abi.js` reads its verbs from the bus, the cast and the stats
  kernel themselves (a stat cue now counts as `level-up`, which the hand list missed), and gains the `entities`
  (markers) and `shot` rows.
- **The export says what it is.** The score's ledger reads the rules a level runs (its camera's included), the page
  channels and events keys that do not travel whole; `assessPortability` flags them, and `export-godot.mjs` and
  `export_game` stamp `verdict: plays | plays-partly | hollow` with its lost list beside an unchanged `ok`. The pack
  README gains a Portability section. It stamps; it never refuses. Unity and Unreal read as before.
- **The level-equivalence harness.** `lib/graph/game/level-equivalence.js` plays a level in the web runtime from a
  win script (steered toward the contract's audits, recorded as input) and a stay-put control; kernel 0.21.0's level
  replays the same input at the same fixed step (`scripts/godot-level-sim.gd`) and both print one key a frame (the
  bus's `hashState` and the entities, quantized to 5 cm). `scripts/godot-fixture-matrix.mjs` makes every cosmos
  fixture a game through the quick path, exports, imports and plays it in both; `npm run test:godot` runs every
  Godot leg and the matrix, and fails without `MOJULO_GODOT`.
- **The scoreboard.** `docs/tool-surface/hillclimb.md` gains a Godot section: the fixtures' lost lists, the ladders
  and the values that would free the most worlds.
- **The beat travels** (kernel 0.22.0). A level's `audio.beat` rides `score.beat`, and the kernel says each beat on
  the bus from its music player's clock as the page does from its AudioContext: one function, `beats/beat-clock.js`,
  held equal at seeded jumpy clock readings, and an on-beat level is equal on its bus frame by frame. On-beat travels.
  The web's `level-sim.js` keeps the beat too, and the harness's input frames press keys.
- **Rounds and their reserve travel** (kernel 0.22.0): `kernel/cast.gd` performs `rearm` and `kernel/combat.gd`'s
  reload draws from the weapon's reserve, dry when both are out, held equal by the combat corpus.
- **The bus's own entities are drawn** (kernel 0.22.0): `level.gd` draws each as the page does (an unlit sphere, its
  radius and colour, where the bus puts it, shown while on), so a pushed boulder, a growing crop and a supply travel;
  a pick or a shot (`inputs` on `pick` / `fire`) names the marker its ray meets (`fact:aim`, approximated: the ray
  meets the markers and the box colliders, not the GLB's meshes). Push, crops and supplies travel.
- **Turn-based battles and routines travel**, proved equal frame by frame (`godot-story-rows.test.js`): a battle's
  menu, its guarded vars and the foe's answer; a routine's hour cues and the cast's walk. On the way, two kernel
  divergences the harness found are fixed: a menu up now freezes the world and its clock as the page's does (the bus's
  timers and sagas, the cast, the fight; `level-sim.js` models it too), and the cast and the fight step after the bus's
  ops, as the page's world steps after its events (a walk ordered this frame moves this frame).
- **The clock dial travels** (`weather/clock-dial.js`, held equal to the page's own emitted night): a level's clock
  darkens the Godot sky at night and its season swaps the climate (`score.weather.clock`, each season's schedule);
  day-night and seasons travel as the weather does (approximated: fog, colour and light), and growth with them.
- **Planted bugs are a standing test** (`godot-plants.test.js`): mutants per kernel script (a flipped comparison, a
  reserved key dropped, a timer a tick late, a reserve ignored …), each of which must make its corpus fail. Three
  found holes in the corpus (an emit carrying reserved words, a heal past hpMax, a level past its max), now closed.
- **The bus corpus plays every mechanic that travels** (`bus-conformance.js` `mechanic-<kind>`), held equal in Godot;
  the ratchet asks for each by id. **The harness has planted bugs**: `godot-harness.js` `mutate` edits a copy of the
  kernel, and each plant must break an equality.
- **The honest baseline.** The sweep's Godot survivors fall from 56 to 8 of 500 (21 to 0 near the probes): the mind,
  the gaits, the story and the cameras were counted as travelling and do not. The walker's ground is a flat plane
  under a hilly trail (marked approximated, found by the matrix).
- **The pilot walks and runs by the web's own rules** (kernel 0.23.0). `kernel/rules.gd` ports the walk rule and the
  ground half of the platform rule (run; tank, look, world and lane turning; the jump with its cut, buffer, coyote
  time, wind-up, air jumps and glide; boost and its gauge; the colliders slid along), and the pilot stands on the
  level's own faces (the GLB's triangles, as the page's ground raycast meets them), not on a flat plane. The score
  carries the pilot's rule (`score.pilot`, recipe units). A rules corpus (`rules-conformance.js`,
  `scripts/godot-rules-conformance.mjs`) holds it equal to the web's frame by frame, and a whole level climbs a ramp
  and jumps a ledge key for key in both engines, the pilot included. A power's move (`game.powers`) merges into the
  rule when the bus hears it picked up, as the page grants it (`level-sim.js` models it too). The platform rule's
  opt-in moves the kernel does not run (space, the boost hover and slide, the charged jump, the kneel, the dodge, the
  tackle, a loadout) are named per level (`PLATFORM_KEYS`), and a walker besides the pilot is flagged as standing.
  Walk, platform, the platformer kit, unlock, the gap link and the metroidvania idiom are built.
- **The page's cameras travel** (kernel 0.23.0): follow, eye, overhead, side and fixed run in `kernel/rules.gd` after
  the pilot, held equal by the same corpus, and drive the level's own Camera3D as the page's `__driveCamera` drives
  its camera (a whole level checks the pose every frame against the page's own driver, lifted out of its source).
  The score carries the page's camera (`score.camera`). A camera that watches anything but a pilot the kernel walks,
  and a follow camera's lock tracking, are flagged. The page pulls its chase camera in by its 3-unit stand-off even
  with no wall between (a twin bug, named by a failing test in `godot-rules.test.js`); Godot matches it.
- **Travel travels** (kernel 0.23.0). `store.gd` gains the web store's item gate, a door's transit, and a map's
  reachable levels and exits (held equal by the store corpus). `game.gd` goes on through the exit a level was won by
  (telling the next where it came from), takes a door into the linked level by its own door with the session carried,
  draws a run with the web shell's own roll (lifted from `play-shell.js` and held equal) and keeps the deepest, and
  keeps each kept number's best in `user://`; the menu shows a run's title and a map's found levels. A level ends
  through its named exit, leaves by a door once, hears `arrive:<ref>`, stands at the door it came in by, and sends its
  kept numbers, as the page's game channel does (`level-equivalence.js gameChannel` models it for the harness;
  `godot-travel.test.js`, `godot-game-shell.test.js`, each with plants). A level with no faces stands on the score's
  implicit plane; a script that moves the walker's node moves its rule's pose. Interconnected, building, buildings,
  street, runs, doors, links and kept bests are built.
- **Scenes and quests travel** (kernel 0.23.0). `bus.json` carries the scenes' program and the quests' journal;
  `kernel/scenes.gd` ports the page's scene runner (beats, typed lines, presses, holds and skips, choices) and
  `kernel/quests.gd` its journal and news, held equal step by step by a corpus (`scenes-conformance.js`,
  `scripts/godot-scenes-conformance.mjs`, with plants). The level steps the runner where the page does (after the
  bus's ops): its beats go back to the bus, its shots set `kernel/rules.gd`'s new shot rule (frames, moves, the side
  of the line, the clear view) aside the page's camera, a skip lands the walks (`cast.gd finish`), the pilot's input
  is held while one plays, and the bars, the text box and the choices are drawn; J opens the journal and a word shows
  as a quest moves on. `level-sim.js` plays scenes too, so a whole level (a scene watched, answered and skipped) is
  equal key for key with its directed camera. A twin quirk is named (`godot-scenes.test.js`): the page draws half of
  an emoji for a frame as a line types on; Godot keeps the half back. Talk, the shots, framing, steps and quests are
  built.
- **Vehicles travel** (kernel 0.23.0). `kernel/rules.gd` ports the drive rule (its power curve, brakes and reverse,
  the slewed bicycle steer, drag and rolling, the classes' opt-in grip, the ground followed down at a fall rate,
  walls, and flight off a ramp's lip or a crest with `air`), the racer (a rival driving its line: bends braked
  into, laps counted, a lane, a grip-bound speed plan, ramps lifted for, backing off when held up) and fixed-wing
  flight (taxi, takeoff, banked turns, stall, touchdown), held equal by the rules corpus (51 scenarios). A car or a
  plane pilot is walked by its rule with its own node riding the pose; the score carries the rivals
  (`score.drivers`) and the kernel drives them; the chase camera follows the car. A whole race (the car flown off a
  lip, the rival round its loop, the camera) is equal key for key. The ground's surface grip under a car stays the
  web's (`driveSurface`, approximated), and solid bodies that push walkers out on the web are named
  (`bodies_solid`). Drive, racer, fly, the vehicle hero and the circuit are built.
- **The look travels further** (kernel 0.24.0). Game packs ship their rigged figures skinned, as world packs do (one
  mesh, its clips, its face and ink: game-pack emission changes); the skinned suit follows the walker. The score
  carries the page's background colour, its sky dome, its distance haze and its pixel medium (`bg`, `skyDome`,
  `haze`, `pixel`), and `kernel/level.gd` builds them: a sky shader with the dome's gradient, stars, moon and sun
  (`kernel/sky.gdshader`), exponential fog in the horizon colour, the 3D drawn at 1/scale with nearest scaling; a
  toned stage is graded by `kernel/tone.gdshader` (the page's ramps, bands and detail); a metal reflects the sky, or a
  plain studio sky. A blend tile (the two-tile vertex blend) leaves the GLB as the page draws it, faded in per corner
  (COLOR_0 RGBA under a BLEND material, a cut layer masked) instead of an opaque tile over the ground. The figures,
  the background, the tone and the pixel medium are built; the dome and the haze are approximated (hashed stars, an unphased moon, Godot's fog curve); the backdrop image stays the
  web's. Under `--lit` a skinned figure carries smooth rest normals, so an engine light shades it (the default unlit
  export is byte-identical). Machine-held by `godot-look.test.js`; how it looks is the eyes gate.
- **The export's ground is the page's.** The GLB de-collided its blend tiles together with the ground they lie on,
  lifting the ground itself a fraction of a millimetre where the page leaves it; blend faces now go last (the page
  draws them in their own pass), and `score.blendNodes` names their nodes so the kernel's land leaves them out. The
  harness steps the world in the frame a level ends, as the page does. The fixture matrix reports how far a run
  drifts (`keyDrift`: the bus frames that part, the largest gap in quanta) and keeps both engines' keys beside the
  pack.
- **Clips play the page's keys.** Godot's scene importer bakes every clip at 30 fps, cutting across a key that falls
  between two samples (a figure's keys come every twelfth of a second: at a key, the hand of the hero's wave sat
  2.6 cm off the page's). A pack now writes, for each GLB whose keys miss that grid, the lowest rate from 30 up that lands on all of
  them (`animation/fps` in its `.import`; `godot-bake.js`). Pack emission changes for those GLBs only.
- **Worlds that are not games** (kernel 0.25.0). A world with no one to play (no seat, no pilot) opens on its
  authored view, as the page opens on its camera; 0 hands the view to the walker and back. A world's shoot plan plays
  its edit on P: the program camera the GLB carries, cut for cut, its lens frame by frame from `score.shoot` (a glTF
  camera keys no field of view); the set pieces, the transitions and the world's clock stay the page's (`shoot`,
  approximated; the `shoot_edit` ledger row). `--humanoid` (`export-godot.mjs`) ships a humanoid figure's world pack
  on the engine humanoid skeleton (the T-pose rest, VRM names, nested) with Godot's BoneMap named on it, so the
  importer makes it `%GeneralSkeleton` and any humanoid clip retargets onto it; the scene turns it from the VRM
  facing back to the world's. It holds the page's pose at every key; between keys each joint turns against its
  parent, so a fast move strays from the page's path (6 cm at the hand of the wave, between two keys), which is why it is opt-in and the
  default pack's `figure_humanoid` row says how to ask for it. Machine-held by `godot-edit.test.js` and
  `godot-humanoid-pack.test.js`.
- **The supercars and the race moods, named in Godot** (kernel 0.28.0). Every body the world moves now stands in the
  zones in Godot as on the page (the drivers and the cast beside the pilot): a rival that starts on its last checkpoint,
  or crosses one, counts its laps and its place as the web's does, where before only the pilot entered a zone. The
  flight games' chase camera banks with the craft in Godot too (`rollFollow`, a new rules scenario holds it equal). A
  supercar field ships skinned like a racer's, the moods' relit faces and sky with it; what the page alone lays on a
  car is now said per level (`figures_carried`,
  `FIGURE_MARKS`: the live overlay's steer and lean, the juice, a dark mood's headlamp pool and tail-lamp ribbons), as
  is the wet road's film (`PAGE_MARKS.wetRoad`). The fixture matrix gains variants past the cosmos fixtures: a field of
  supercars on a wet night, and an airspace in a palette.
- **The new games, swept** (kernel 0.27.0). On the rebase onto the flight and shooter games, the fly rule's dials run in
  `kernel/rules.gd` (a glider, the throttle lever, space without gravity or lift, the boost and its charge, the barrel
  roll, the arcade and sim assists, the map's bound), held equal by seven new rules scenarios; the space shooter and air
  combat now play key for key, the flight sim to a quantum. The new mechanics (respawn, frags, control, regen,
  abilities) carry their marks, and the arena shooter's match player and the minds' new moves (peek, floors, items, the
  gun for the range, perches, objectives, a flier's clearance) are named per level (`AI_LOST`), as are the guns' new
  ways (spread, recoil, falloff, headshots, the gun's hand, the round to the crosshair, homing missiles: `WEAPON_LOST`),
  until the kernel runs them. The fixture matrix mints the four new games.
- **The mind travels** (kernel 0.26.0). Bodies on the web's `ai` rule decide in `kernel/mind.gd`, a port of the web's
  mind: every motivation (hunt, guard, escort, territorial, wander, forage, flee, sentry), sight and memory with the
  search, cover from the one it fights, the blade with its combo and give-up, the roll off a stagger, the loadout's
  rotation, a world's tier and a body's own tuning, a boss's phases and adapting, the boost juke and space. It paths
  round walls on the web's grid (`kernel/nav.gd`), moves in groups (`kernel/group.gd`: packs, squads, herds, attack
  tokens) and fights with the kernel's trigger, blade and charge (`kernel/combat.gd`; a semi or lob weapon holds fire
  mid-thrust, as on the web). `bus.json` carries the minds (`minds`: each body's rule, the minds' weapons, the tier,
  the walls), the bus hears `seen`, and a level whose minds hit nothing still runs them. The mind corpus
  (`mind-conformance.js`, its first scenarios the cover law) is equal frame by frame at five seeds, and every planted
  bug is caught (`godot-mind.test.js`). The shooter and stealth fixtures now play their levels key for key. What
  stays the page's: the commander, and the shove-down set piece when an opportunist's counter-charge catches the
  pilot (the kernel plays the plain counter).

### Effects noise: flames and lightning, spell circles, a hex shield, an itano circus

- **Noise on the World page.** The terrain's gradient noise reaches the page twice: its own source for strand spines,
  and a GLSL twin on the same integer hash for effect shaders. Nothing carries either unless an attack or a look asks.
- **Lightning and flame.** A strand's `jag` throws lightning across its spine (noise, ends pinned), re-struck `flicker`
  times a second with `forks` branches. Its `fire` draws its head as flame: noise turbulence torn back from its
  flight, white to yellow to red. New presets `lightning` and `fireball`. Under `fxStyle` the attack's colour picks the
  material by rule: a warm bolt burns (its echoes a trail of smaller flames), a pale ray crackles.
- **Spell circles.** `charge.form: 'circle'` opens a sigil square to the target: rings, a rune band turning one way,
  a hexagram turning the other, an overshoot as it opens. The strands leave from it, so a wall or a floating caster can
  fire from a circle (preset `sigil`).
- **A hex shield.** A look's `shield { r, cells }` raises a half-sphere of hex cells round the feet, with a fresnel rim
  and a noise shimmer, and a ripple runs out from wherever a beam lands on it (preset look `ward`).
- **An itano circus.** A strand's `fan` launches each copy its own seeded way round the line, then curves it back in to
  land together. Presets `itano` (missiles with smoke trails) and `itano-laser` (homing rays).

### Effects: light and a style floor, by rule

- **`fxLight: true`.** On a world whose cues fire beams, puffs or explosions, every effect lights what is round it,
  the way fire already did: a strand's head, a ray's body and a charging orb throw the attack's colour as strong and as
  soft as the strand is wide, and a moment its own declared light, tinted by its colour or its kind (a strike cold
  white, a blast warm). Live steel, baked stone, the anime character light and creatures all take it. A night world
  takes it fully, a noon one a quarter. Nothing is authored per effect.
- **`fxStyle: true`.** Every attack is raised to a style floor by rule: no simple shape unless it is a line (a bolt
  trails fading echoes, a ray carries pulse bands and rings, every attack sprays sparks), layered colour (two companion
  strands in an analogous hue), chirality (the companions braid one way, the hand seeded by the attack; an explosion's
  sprays swirl with it), and the principles of animation (a charge before release, a head stretched along its flight,
  a gentle arc, echoes that lag, a flash where it lands, an explosion's ground ring echoed). An ink edge takes the
  attack's own darkened colour instead of black. A laser may stay one beam. An attack that already does a thing keeps
  its own.

### Level age and crystals: a cube's metal tells its age, its land grows crystals

- **`materials: { age }`.** A cube's materials take an age, `new`, `worn`, `old` or `ancient`: copper, brass and bronze
  tarnish brown and then turn verdigris green by their measured film law, and steel dulls and then blackens to forged
  scale. The painted tone of each aged group follows, so the toon light, the paint and the live metal agree. A group the
  cube names ages too, unless it names its own film or finish. Gold does not age. Absent, metal is bright, as before.
- **Armour cards name their materials.** A style card's `materials` says what its pieces are made of where its
  family's table would be wrong: `grim-scifi`'s trim is blasted steel, `armored-hero`'s faceplate brushed stainless, the
  rest of a hardsuit painted. They are worn only on a level that names `materials`, under the level's own overrides and
  age, so sci-fi heroes now take live metal, the cube's light and its age where their designer said metal.
- **Creatures wear their level's materials.** A creature names its level beside its plan (`spec: { plan, geocube }`, or
  `update_character { geocube }`). Where the cube names `materials`, its horn, hoof, beak and shell take a satin gloss,
  its outfit's metal and leather theirs, and its plan's own `materials` (as an armour card's) say the rest, all at the
  cube's age. A creature keeps its character light, so its materials are drawn: a metal steps higher, shades darker
  and glints. A creature's tones are its parts' tints. Absent a level, a creature is as before.
- **A level's cloth and leather are painted.** On a level that names `materials`, a figure's cloth (its top and
  trousers, its outfit's cloth roles, a stylist's garments) takes the bake's painted `cloth` finish, deep in its folds
  and darker toward its hem, and its leather the `leather` finish, a low sheen with its edges rubbed lighter. A group a
  material dresses (metal, satin, glass, rubber) is left to it, and so is every other group. A figure with its own
  `bake` keeps it; the character light keeps its own look. A plain hero is dressed too.
- **Cloths.** `linen`, `cotton`, `canvas`, `wool`, `felt`, `denim`, `silk`, `velvet`, `nylon`, `polymer`, `carbon weave`,
  `ballistic nylon` and the alien `membrane`, `spun filament`, `resin weave` are materials. On a figure each is painted
  its own way: wool soft with no ridge, denim faded pale at its ridges, silk a sheen band toward the sky, velvet dark in
  its body and bright at its rims. Under the character light they are drawn: silk a soft sheen, velvet deep and more in
  shade, wool a soft step, denim a cool shade, the synthetics a small sheen. A stylist's hero wears its genre's cloths
  on its top, trousers and outer layer (fantasy linen and wool, modern cotton, denim and nylon), and a cube names one
  for a group (`materials: { Top: 'velvet', Outer: 'silk' }`). Anywhere a material is taken, a cloth word now resolves
  to its shelf row.
- **`outside.crystals`.** A cube's island grows crystals: `'amethyst'`, or `{ gem, where: 'crags' | 'hollows', count,
  size, glow, seed }`. Seeded clusters stand out of the cliff faces or sit in the land's hollows, off the trail and the
  seam. They are real gems (the crystal channel shades them live, each throwing its own light, and the GLB carries them
  as see-through). Absent, the land is as before.

### Look materials: armour as material, metal in the cube's light

- **`materials` on a geocube.** A hero whose `geocube` names a cube with `materials` wears real materials on its armour,
  outfit and dress: plate as brushed steel, a lamellar's kanamono as gold, leather as leather, a hardsuit as painted
  satin, each metal group's metal read from the tone its card already wrote. `materials: { <group>: <material> }`
  overrides one. Plate then shades as live metal on the World page, in its clips too (the rig pack carries the metal
  channel per part), and exports as PBR. Absent, every hero is as before.
- **Anime heroes draw their materials.** Under the character light (an anime hero whose manifest names `toon.light`)
  the materials are drawn, not reflected: metal steps higher and shades darker (gold leaning red-orange, steel blue)
  with a small gloss tinted by the metal's measured colour, lacquer takes a small sharp gloss, leather a warm shade and
  a dull band, glass a white glint, rubber a deeper shade (`materials/toon-materials.js`). Such a hero wears no live
  metal. An anime hero in the cube's cast light wears the live metal as any hero does.
- **`contrast.metal`: metal in the cube's light.** Metal faces take the cube's occlusion (the foot of a wall, a crease,
  contact) as a multiplier the live metal shader and the GLB carry, and the live metal reflects the cube's own world
  (its sky over a daylit dome, its ground leaned toward grey) instead of the studio's dim room. A hero on such a cube
  takes it on its metal alone. Absent, metal is shaded as it was. `upland-morning` turns both on.

### Sixth-gen land: ground, mix, facets, valley

Four opt-in words on a local meru (and a geocube's outside), each absent unless asked, so every cube and stage
renders byte-identically without them.

- **`ground`: a terrain world under the level.** `meru.ground` / geocube `outside.ground` takes a painted scene
  (`{ from: { heartbeat, splatch, seed }, span, height, at }`) through the `terrain` kind's field (its landform,
  erosion and fracture detail) and lays it under the plain: its lowest point under the level is the datum, its range
  scaled to `height`, eased in from the seam. The island's geology still reads only the mounds and the high shore as
  raised land.
- **`shading.mix`: surfaces mixed per corner.** Each corner takes rock, grass and sand by how much of each lies round
  it, spread `mix` metres and drawn back to a soft, noisy edge, on both sides of a seam: grass meets rock in a curve,
  not in the grid's steps.
- **`shading.facet`: rock in planes.** The rock's grid heights are drawn onto facet planes about `facet` metres wide
  before the land is lit, so a cliff reads as planes of stone instead of a checkerboard of half-metre quads; the
  grass's corners stay where they are.
- **`island.seabed: 'merged'`: the flat seabed in large quads.** Past the beach an island's floor is one plane under
  deep water, yet it was drawn in the land's half-metre quads and was most of the faces. Merged, it is a few dozen
  quads: the upland island goes from 31,944 faces to 10,395 and builds in under half the time, its renders matching the
  grid's to within 13/255 on 0.04% of pixels. `'grid'` (the default) draws it as before.
- **`upland-morning`, a geocube preset with them on.** Valley-morning's look (its colours, light and contrast) on a
  rocky upland: a `rocky-irregular` ground at 45 m and 3.5 m, mix, facet and valley. Its island merges its seabed. The shipped presets are unchanged.
  The geocube card took an `outside` line naming relief, ground and the land words (its ceiling re-pinned 4000 → 4600).
- **`shading.valley`: the sky a hollow loses.** The foot of a slope, a hollow and a gully darken toward the shade by
  how much sky the land round them hides, read over tens of metres and beyond what an even slope of the same grade
  hides.

### Perlin spike: relief for the geocube land

- **One noise module.** `lib/graph/noise/noise.js`: 2D gradient noise on the terrain kernel's integer hash and
  8-direction table (the same values as `terrain-kernel.js gn`), its analytic gradient, fractal sums in four flavours
  (`fbm`, `ridged`, `billow`, `damped`: detail suppressed where the slope is already steep, the eroded look) with
  octaves rotated off the lattice, domain warp and terraces. Only + − × ÷, floor and imul on the height path, so a
  field is the same in every engine.
- **`relief` on a geocube's outside.** `outside.relief` (and `outside.terrains.<name>.relief`) names a relief card
  (`rolling`, `craggy`, `eroded`, `terraced`, `dune`) or `{ from, …changes }`; the stage's meru carries it and the
  local meru lays it on the plain under the seam fade. On an island it only lifts the plain (a hollow would drown the
  grass in beach), and where the island draws its mountain as land (`walk: 'base'`) it runs up the mounds too, so the
  geology breaks already-broken ground. Octaves are set in metres, not by the mesh. A cube without relief lowers and
  renders byte-identically. The geocube routing card names the word.
- **Grain in the vertex.** The relief's octaves finer than the land's cells go to colour only, filtered over each
  corner's footprint (`relief.grain`), so the polygon land's light carries detail its geometry cannot.

### RPG improvements: a cast rolled for the game, familiars that fight on their own, moves per character, minigames

- **The cast roller** (`lib/graph/egocube/cast.js`, `rollCast`): an anchor Egocube and the people rolled against it,
  as docs/egocube.md designs it. Relations (shadow, rival, foil, mentor, party, familiar, lieutenant, mastermind, rank,
  and the journey's herald, threshold guardian, trickster, shapeshifter, ally) aim a target distance from the anchor on
  the archetype wheel, the role, the build and the age, and pull motivation and order; `complement` proposes the roles
  and archetypes a party lacks. The laws are checked as each member is rolled (party silhouettes distinct, a shadow in
  its anchor's shape and a rival in another, the size ladder, the bookends on motivation); a broken law draws the later
  member again, never the anchor nor an ask, and one still broken is kept and named. Seeds are keyed by path and members
  roll in order, so a cast only grows. `castOfScale` is the completeness ladder: hero, rival, party, journey.
- **Beasts, beast-kin and mascots in a cast.** `bond: 'party'` is first party (Kimahri, Red XIII); `bond: 'familiar'`
  is second party, kept by its parent and wearing its accent (a stand, a summon, a poke-companion). A body is a person,
  beast-kin (a beast lineage), a beast (a real species, through the animal door) or a mascot (chibi); unasked, a party
  member's and a familiar's body is thrown on the setting's odds (a myth has beast-kin at its fires), `bodies` leans them.
- **`rollEgocube` takes `lean`, `pull` and `redraw`**: a relation's multipliers on the priors, motivation and order drawn
  near a target on each attempt's own die (never an ask), and the attempts a cast's re-draw starts at. Absent, every
  sheet is byte-identical.
- **A cast is a cube**: `create_sketch({ kind: 'egocube', cast: { anchor, cast, factions, setting, bodies, seed } })`
  rolls and keeps the cast (`castSheet`); its preview is the members standing in a line, a beast among them as the animal
  kind makes it. `create_character({ egocube, member: 'hero/rival' })` makes one member through its door (a beast through
  the animal door); the character records the member it was made from. New routing card `cast`.
- **The casting page** (`lib/graph/gameworld/casting.js`, `characters.casting`): the book's people rolled for the game in
  its setting (a turn-based world reads as a battle), as many as it asks for: `scale` hero | rival | party | journey, or,
  absent, the world's prompt words (saga, a party of four, rival, familiar, chibi, beastfolk), else a party for a world
  that fights turn by turn. The run writes one egocube row (`<ref>-casting`) and makes each member from it
  (`<ref>-cast-<id>`); a journey cast's members wait on the new `characters:cast` review part (the sheets are the
  proposal). The first party fights in the battle party from the start, and the hero with it, each in the class its sheet
  reads as (`classOf`) instead of the rotation; a `joins` flag on a member brings it to the field as a written companion.
  The story, the bible and the field party read the rolled members as cast members. A book without the page is untouched.
- **Familiars that fight on their own** (`play.rpg` party `auto: true | { keeper }`): a second-party member picks for
  itself when its turn comes, from the field as it stands and never on the dice: it mends the hurt (its keeper first),
  raises the fallen, strikes a weakness, finishes the weakest foe, else hits the one that hits hardest. The page asks no
  command of it, on rounds or on the timeline, and it takes no place of the party's `size`. A casting page's familiar
  of the hero or of a first-party member fights beside its keeper. The kernel and the rpg channel are emitted into every
  page with `play.rpg`, so those pages' text moves; a party with no `auto` member plays the same battles.
- **Reactions for every hero, lifted from the versus fighter** (`lib/graph/polygonizer/hero-react.js`): new motion words
  `hitHigh`, `hitBody`, `hitLow` and `stagger`, a `react` move family. The fight's own impact poses and its stagger
  (`versus/versus-react.js`) are read onto the hero's rig through `planeToVajra` (the fight plane's segment angles as
  the hero's joints), not copied: struck fast, held through the blow, given back slowly, the feet planted, home on the
  stand. With the rest `knockedOut` (the topple and the rise) a hero can now take a hit, fall and get up.
- **A cast member is made with its moves** (`lib/graph/egocube/moves.js`, `moveSetOf`): its ready stance and its attack
  by its role, its reactions, and its win by its archetype, as hero motion words, so its page's clip picker plays them;
  `create_character` says which (`egocube.moves`). One character from a single egocube is made as before.
- **The combat states play a hero's own reactions** (`playscape/player.js` `playerStates`): `stagger`, `topple` and
  `getup` map to its `stagger` (or `hitHigh`), `knockedOutDown` and `knockedOutUp` when it has them.
- **The level map plays each member's own moves.** A casting page's member carries its `field`: the runtime states its
  own moves play (`egocube/moves.js` `fieldStatesOf`: the hit's lurch, the topple and the rise, a swing as its attack).
  A figures-map hero takes `moves` beside `clips` (`worlds/world-scene.js`): each state plays the hero's own clip over
  the library's when it has it, and keeps the library's when not. Its first party and its familiars walk beside the hero
  from the start (`play.party` members may now leave out `joins`: woken as the level starts, no flag carried). A level
  with no casting page is byte-identical.
- **Beasts, mascots and beast-kin walk the level map too.** A cast's beast is made with its two gaits rigged
  (`moves.js` `beastGaitsOf`: the wolf's walk and trot, a bird's walk and hop), and a beast-kin below the hero door with a
  walk, a jog and the moves its creature rig solves (`creatureMovesOf`: a stance, a strike, the reactions and the fall;
  a showcase pose is a person's). On the field each walks on its own clips with no library (casting.js `fieldOf`): the
  mascot its run, walk and idle, the creature its jog and its moves, the beast its gaits. A figures-map entry marked
  `walker: true` (it follows or stands, never pilots) may be any rigged character (`heroRefError`'s `walker`).
- **A beast takes a blow** (`lib/graph/fauna/behavior/react.js`): new animal motion words `flinch` (dropped low, the
  head thrown up, back to the stand), `fall` (onto its side, gathering speed) and `rise` (back up), each a one-shot
  between poses the behavior solver already solves for its own body (every bone slerped between them), on any body
  with legs (`{ reactions: 'all' }`, or the words in a motion list). A cast's beast is made with them, and on the level
  map its hit, topple and get-up play them. An animal without them builds byte-identically.
- **Legless beasts and mascots take a blow too.** A snake or an octopus flinches by rearing back from its coil into its
  strike coil and falls laid out flat (the flatter of on its belly or on its side for that body); a swimmer has none
  yet. A cast's mascot is made with `flinch` (squashed down, the arms thrown up, the surprised face), `fall` (tipped
  over its feet onto its back, eyes shut, its head on the floor) and `rise` (back up through a crouch), and plays them
  on the field (`mascotPlan`'s `reactions`; every other mascot is minted as it was).
- **Keyed one-shots and a body tipped over its feet** (`polygonizer/station-loft-rig.js`): a plan clip may be
  `{ once: true, keys }`, packed 0 … 1 inclusive as a function clip with `once` is (a fall that ends lying down); a key's
  `body: { pitch?, roll?, up? }` without `at` turns the figure about the floor under its feet. Clips that use neither
  are byte-identical.
- **Minigames: the games inside the game** (`playscape/ui/minigames.js`, `scene/channels/minigame-channel.js`).
  `play.minigames: [{ id, game, at?, prompt?, goal?, gold?, purse?, prize?, flag? }]`: interact at its place (or emit
  `minigame:<id>`) and a round comes up in a pixel window over the field, the world held still as in a battle; `blocks`
  and `match` are the arcade cabinet's own reducers (brickster, the philosopher's stone trial), `fishing` a new one
  (`pixelizer/fishing-core.js`, `fishing-skin.js`: hold the line over a darting fish until it is landed, a few casts a
  round, five fish from minnow to golden koi). Its score pays gold into the party's purse (a bag transfer when the purse
  is the bag's, so it is carried), keeps `minigame-best-<id>`, and says `minigame-won:<id>` or `minigame-lost:<id>`; the
  first win gives its prize and sets its flag. The page inlines only the games a level plays; a level without one
  carries not a byte of them.
- **Minigames in the game book** (`gameworld/minigames.js`): `minigames: true | false | [game | { game, … }]`, or heard
  in the prompt (minigames, carnival, fishing, arcade, match-3). A keeper (one figure, made as the foe is) stands at each,
  spread across the game; the winnings go into the carried bag (the battles' bag, or its own). A world that asks for
  none makes the same steps it did.
- **An arcade in the inn.** A game's `where: 'inside' | 'trail'` (blocks and match inside by default, fishing on a
  trail, each on the other when the world has none of its kind) puts its keeper in a building's room: a tavern's snug
  or taproom, a hall's hall, a shop's floor, a library's reading room (`ROOMS_KEPT`), in the corner farthest from the
  way in, a building level or the inside of one entered by its door alike. A building level now takes a stage's extra
  (its rooms and use on its ends, its mechanics the level's); a building without one is the level it was.
- **One way to stand people on a stage** (`gameworld/stage-figures.js`): a figure on the shared library or on its own
  clips, a person's body numbers, the entity of one who stands, and a stage's extras composed, where battles, minigames,
  the story's cast, guards and every quick goal's figures each wrote their own. Every run's orders are unchanged.
- **A quick game's cast** (quick.js `cast`, casting.js `castingPage`): any quick goal on foot takes the casting page
  (less the journey; `true` a party of one), rolled in the game's setting and made as the book makes it (one cast row,
  each member by path). Its party and familiars walk beside the hero from the start on the escort motive and fight what
  it fights, on the pilot's side in a team game; a rival with a person's body stands as the first foe in a battle, a
  shooter or a deathmatch; the readout says where each went. A quick game without one makes the steps it did.
- **Every person a run makes can take a blow on its own rig** (a world's `moves: true`, a quick game's lever; egocube/moves.js
  `REACT_MOTION`, `reactStatesOf`): the hero (through its motion page), the battles' foe, a keeper, and every quick
  figure (foes, guards, towers, farmhands) are made with their own hit, stagger, fall and rise, and each figure standing
  for one plays them over the library's (levels.js stageLevelOrder `moves`); a mascot hero its own flinch, fall and rise.
- **Beast foes** (`foe: { species }` on the book's battles, a quick battle or a defence; stage-figures.js `foeFigure`): the
  foe is made through the animal door with its two gaits and its reactions (design_game realizes an `animal` order) and
  stands, walks and takes a blow on its own body; a shooter's or a deathmatch's foes keep a person's hands.

### README demo: a floor plan to rooms you can live in

- The README and the npm page lead with `docs/images/decor-demo.gif` in place of `lounge-handoff-demo.gif` (which
  the long tour keeps). It is one real Claude Code session, recorded rather than staged: a homeowner uploads their
  floor plan as a picture and asks, in their own words, for ideas for living in it (warm, natural, a bit cozy: the
  living room, the dining room and the big bedroom), then for sage green living-room walls and the sofa turned to the
  windows, then for a walkthrough video. The agent reads the plan, builds the house with `mint_building`, designs and
  then repaints and rearranges the rooms with `design_interior`, and films and stitches the walkthrough itself. The
  change is shown from eye level, aimed at what moved, as a before and after swept in by a glowing line; the last
  slide is the session's own working time, tokens and cost at API list price. README section 2 walks through it.
- `docs/images/src/decor-demo/` re-runs it end to end: `plan.mjs` draws the uploaded plan (`house.json` as its own
  A-101 sheet), `run.mjs` drives `claude -p` (`--resume` per ask, the plan as an image in the first message) with
  mojulo as the only tool server, `capture.mjs` films from a replay of the session's calls, checked against the
  recipes it stored, so a kernel fix re-shoots the same session, and `compose.mjs` sets it in a generic chat and
  encodes the GIF. `session.json` is the record of the session the GIF shows: every call, reply, token count and the
  recipes it left. The media helpers launch Chromium without its sandbox when they run as root, as in a Linux
  container.
- `docs/tech-requirements.md` is measured for 3.1.1 (Linux x64, 2026-10-18: an 11.6 MB tarball, 251 MB installed
  across 130 packages, the per-dependency sizes again, and what the measurement turned up), records the Linux runs
  behind the demo (Claude Code driving the stdio server, Chrome for Testing baking without its sandbox as root), and
  names `stitch_motion`'s MP4 decode. The READMEs carry the 3.1.1 install size and name the ChatGPT plugin
  ([plugins/mojulo-chatgpt](../plugins/mojulo-chatgpt/README.md)) beside the Claude one.
- `design_interior`'s reply says where each piece stands: `at` (its centre, mm from the room's corner) and `facing`
  beside its id and size, so the next call can move a piece by id knowing where it is, and a reader can tell what a
  revision moved.
- `design_interior`: a dining room has its chairs. They tuck a little under the table, and the placement check
  counted the table they tuck under as in their way, so every chair was left out ("collides with dining.table") and a
  dining room was a table, a rug and a sideboard. `brief.seats` now seats that many where the room fits them.
- `design_interior`: a plain cloth asked by name on a piece (`finish: { fabric: 'velvet' }`, also linen, canvas,
  bouclé, twill) changes the cloth and keeps the scheme's colour. It used to drop the colour, so the piece wore the
  preset's own (velvet's emerald): "make the sofa velvet" turned the sofa green. A room that names such a fabric
  renders in its scheme's colour now; a patterned cloth (tartan, ticking …) and a full fabric spec are as they were.
- `stitch_motion` joins World clips (a furnished room, a city, a level), which it used to refuse. A World clip its
  forge baked to MP4 is decoded from that video, so a stitch of three room clips takes seconds rather than a fresh
  headless render of every frame; one without an MP4 is rendered again from its recipe.

### Test tiers: the e2e suites run once, in their own CI job

- `npm test` leaves out the e2e tier: the whole worlds made through the real handlers and the games whose audit walks
  each level in headless Chrome (the `E2E` list, now in `vitest.config.js`). Measured on one full run, they were a
  third of the suite's time, and CI ran them on every leg of its matrix. CI runs them once now, in an `e2e` job on
  Ubuntu with Node 22 (`npm run test:e2e`); the byte pins they rest on still run on every leg.
- `lib/mcp/test-tiers.test.js` holds the new shape: the e2e suites run in `test:e2e` and in neither `npm test` nor
  `test:critical`. CLAUDE.md and CONTRIBUTING.md say when to run the tier.

### Claude plugin: the server installs from a lockfile the plugin ships

- The plugin no longer runs `npx -y mojulo@<version>`. Its server is `node ${CLAUDE_PLUGIN_ROOT}/server/launch.mjs`,
  which runs `npm ci` against `plugins/mojulo/server/package-lock.json` once per version, into
  `~/.mojulo/plugin/<version>-<lock hash>/`, then starts the installed server. The lockfile names mojulo and every
  package under it by exact version, registry.npmjs.org source and integrity hash, which npm checks on install; the
  Claude plugin directory held a plugin that ran an npm package without one. A later start runs at once.
- The install is built in a temporary folder and renamed into place when `npm ci` finishes, so two sessions starting
  together share one install, and a start Claude Code cuts short leaves nothing half-built (the next clears it). npm
  writes to stderr: stdout stays the MCP channel.
- `control/scripts/plugin-lock.mjs` writes the launcher's `package.json` and lockfile for the version
  `control/package.json` carries, once it is on npm (`--check` resolves again and compares).
  `check-plugin-version.mjs` now holds the plugin to the launcher: `node` on `launch.mjs`, the distribution flag, a
  `package.json` on exactly the version, and a lockfile that locks it, every entry hashed and from npm.

### Fractal structures

- **Towers for any world, from a few words.** A new kind-generic `structures` channel grows landmark towers from
  four words: a plan (square, turned squares, a star, a stepped circle, offset faces cut again to a depth), a rise
  (how the plan narrows, turns and is banded as it climbs, r(f) = top + (1 − top)(1 − f^p)), a crown (a ribbed disc,
  a dome or a finial) and an echo (smaller copies of the whole against its own flanks, each echoing again: a tower of
  towers). The principles are the Indian temple builders', lifted off the temple. Presets (`PRESETS` in
  `fractal-structure/presets.js`) and a seeded `auto` that rolls a varied skyline.
- Pass them to `compose_world` as `overrides.structures` on any base, or set `structures` on a stored world and
  patch it in place. The faces join before the material, texture and shadow passes; an entity world also gets a box
  collider for each tier and plinth step, so a stepped rise's terraces stand a walker. A face budget trims the
  deepest copies first, never the tower. Absent, every world is byte-identical. Manual: the `structures` view-vocab
  card; kernel: `lib/graph/fractal-structure/`.
- **A structure made of structures.** A `colonnade` stands any structure's words (a fluted `column` by default)
  round the plan, spaced evenly along its perimeter, or on a grid, under an entablature that can roof a walk to the
  wall, or carrying the body on top; a `hollow` body is a wall round open ground whose edge can step out as it rises
  (a seating bowl); `stretch` makes a plan oval; a `top` echo stands a lantern on the crown. New presets come of
  it: `column`, `rotunda` (a tholos with its lantern), `cloister`, `hall` (a pillared hall under a stepped roof) and
  `arena` (an oval bowl behind a storeyed, columned wall). The stepped-circle spire is now `beehive`.

## [3.1.1] - 2026-10-16

The first published release of the 3.1 line. `mojulo` 3.1.0 reached npm from a stale build of 2026-10-10 and is
deprecated (npm refuses to unpublish a package others depend on); no `mojulo-ui` 3.1.0 exists. Where this changelog
and the code say 3.1.0 for a change, it first ships here.

3.1 turns mojulo toward games: a sentence becomes a playable game in a named genre, with its own world, its own
people and its own look, played in the browser, shipped as a desktop app or exported to an engine. The detailed
log behind this summary, theme by theme, is [CHANGELOG-3.1.md](CHANGELOG-3.1.md).

### Upgrading from 3.0

- **Update the Claude plugin.** It runs `npx -y mojulo@3.1.1`; an unpinned `npx -y mojulo` moves to 3.1.1 once it
  is npm `latest`. `mojulo-ui` 3.1.1 is the matching dashboard. No new Node requirement and no new dependency.
- **Retired from the tool list, still callable by name**, so a plan step, script or skill that names one keeps
  working:
  - the office wing: apps, runtime daemons, the contextmap, mcp-orbit, triggers and primitive binding
    (`pack_runtime`, `pack_connected_services`; see `RETIRED_PACKS` in `lib/mcp/packs.js`);
  - game projects (`create_game_project` and its siblings): a game's home is its gameworld, through `design_game`;
  - `create_shoot_plan` and `update_shoot_plan`: a shoot plan is `forge_motion({ shoot })`.
- **The dashboard is view-only.** The copy-prompt buttons and the in-page edits (folders, gallery, stash) are gone;
  `/apps`, `/mcp-skills`, `/map` and `/graph` are removed, and `/maker` redirects home. Sign-in and Settings stay.
- **Stored rows that render differently** (the exceptions to byte-identical re-render):
  - **Heroes** get a structured midsection by default; `core: 'streamlined'` restores the 3.0 body byte for byte.
  - **Houses, stores, restaurants and malls** were the mirror image of their plans in the World and every export;
    they are now built the way the plan reads. House floors are muted. SVG stills were mirrored too and are now
    right-handed.
  - **The default animals'** silhouettes and proportions are retuned; a minted animal redraws on its next read.
- **The recipe book ships inside the package.** `MOJULO_RECIPE_BOOK` and the separate `mojulo-recipe-book` repo are
  deprecated: a clone still loads and warns at boot, until 4.0. `MOJULO_BUNDLED_BOOK=off` detaches the bundled book.
- **Every recipe records the mojulo version** that minted it and that last edited it.

### Games

- **The doors.** `design_game` makes a game: `quick: { goal }` for a genre in one call, `compose: { prompt }` for a
  whole gameworld from a sentence, or the full gameworld (world bible, character book, levels). `create_game`
  audits it; `export_game` ships it.
- **Genres** (`quick.goal`):
  - **Fighting game:** a side-view one-on-one fighter, local two-player, on 3D arena stages; every fighter is a
    character the character loop designs.
  - **RPG battles:** turn-based fights, a party of up to four switchable classes against groups of foes, with
    battle effects.
  - **Arena shooter:** deathmatch and team deathmatch against bots, first person or over the shoulder; the arena is
    made from words and one dial runs from realistic to stylized. Also a cover shooter along a trail.
  - **Racing:** a kart racer on a loop against rival drivers, and supercars on the grid (any paint, liveries, race
    moods, night driving). A true-scale divided freeway is the first piece of a driving world.
  - **Flight:** a flight sim (fly the ring gates and land), and air combat or a space shooter (`shoot` with a
    `craft`), on one flight model; craft are assembled from a shelf of aircraft and spacecraft parts.
  - **Also:** reach, collect, survive, avoid, sneak (guards and sightlines), rhythm, defend (tower defence), puzzle
    (block pushing) and farm.
- **Levels and places.** Buildings and room kits play as levels (a house, a store, a school, a crypt); a city is
  planned on a board and played as levels; towns, fixed-camera walkmesh scenes, and chapters of the same world over
  time.
- **What a game carries:** stats, inventory and shops, front menus, a cover and credits, scenes and two characters
  talking, a story bound to its world, weather, destruction, beams and explosions, and a soundtrack scored per level
  with action sounds.
- **Where it plays.** A browser shell runs title, levels and result. `export_game({ target: 'desktop' })` packs it
  as a desktop app with one seam for a store (Steam, GOG, Epic); mojulo ships no store SDK and uploads nothing.
  The Godot pack carries the event bus, combat and looks, and is the most complete engine translation.
- **What can be made next.** The cosmos cube describes a game as six facets, and its sweep measures what the builder
  can and cannot make yet ([docs/tool-surface/hillclimb.md](../docs/tool-surface/hillclimb.md)).

### Characters

- **`create_character`** (`as: 'hero' | 'creature' | 'animal'`) is the first door; `update_character` revises any
  part.
- **Each game's own people.** The Egocube rolls a cast from a game's setting and era: modern and future gear,
  mascots that walk as well as drive, and a palette that keeps its world's era.
- **The look.** An anime hero can be drawn painterly, with a painted face that animates. A stylism solver works
  silhouette, then value, then detail. Clothes fit the body, armour and creature apparel read as what they are,
  hair grows as locks, and light is painted onto the surface. Each character is drawn for its target screen.
- **Motion.** Showcase poses, ready stances, strikes, sitting and rising, vaults and carrying on the hero door, and
  a walk calibrated against measured human gait.
- **Animals.** Sea creatures, insects and other arthropods that move, behaviours said once and done per species,
  and an encyclopedia entry per species.

### Worlds and the look

- **The geocube** is a level's look as data. The color theorist solves its palette from what the world is
  for (land, sky, HUD and cover from one solve), and vertex contrast lights the whole world.
- **Stage kits** in the sixth-gen manner: an isekai meadow, bamboo and sakura groves, a research lab and night, with
  live grass, wind, fire and water.
- **Historic cultures** as walkable `historic` worlds from cited records, with period music and people: Sumer,
  Hellenistic Lindos, Qin Xianyang, Pompeii and Giza. Later eras through the same historic solver.
- **Buildings.** The `interior` kind furnishes one room of a house; houses gain finishes and composed or true-size
  furniture; a structure book documents a house, store, restaurant, mall or school.

### Making things

- **Solids.** The fabricator resolves a part's job from a shelf of standard parts and sizes it; `measure_solid`
  reads strength (bending, tension, print infill); mechanisms move with mass and friction; the `scad` kind gains a
  pinned library for threads, gears and text, and warns where they used to fail silently. Exploded views and teardowns.
- **Asset receipts.** `sign_asset` and `verify_asset` sign an exported file with a per-install creator key.
- **Audio, film and diagrams.** Orchestral strings and brass, a robot-rock style card; a world's shoot plan and a
  Blender film pack from `forge_motion`; flow charts lay themselves out.

### The agent's surface

- **One door per intent.** A new capability is an argument and a routing card on the tool that owns its intent,
  not a new listed tool. A pack opens to a menu; `create_sketch` and `cook` list routing only and read their manuals
  on demand. A routing eval with a held-out set measures where requests land.
- **Model tiering.** An agent task names how much judgment it needs (`ride`, `fill`, `judge`, `design`), never a
  model.
- **Self-description.** Mojulo describes itself by what it makes: things to Play, Print, Read, Hear and Observe.

### For contributors

- Test tiers: `test:critical` is quick again, the game and world suites that walk levels in headless Chrome are
  `test:e2e`, and range sweeps are `*.deep.test.js`. A test picks one case per procedure, never a whole catalog.

## [3.0.0] - 2026-10-01

### Upgrading from 2.x

- **3.0.0 is the release after 2.1.0.** A 2.2 was prepared and never published; everything it carried
  is in this release. Removing the chatbot factory is why this is a major version.
- **Node 22.14 or newer.** 2.x asked for 22.12, but on Node 22.12 and 22.13 the database library
  (better-sqlite3) crashes the process the first time it opens the database, with no message; 2.1.0
  crashes the same way. 3.0 checks the version at start-up and says which Node to install.
- **The 2.x line is unmaintained.** No 2.x release will be patched, and running one is not
  recommended. 2.1.0 and the bot image it deploys (`mojulo-bot` 0.5.1) have known security issues: an
  open relay on deployed bots (`/api/send-webhook`), SSRF in `upload_document_from_url`, path
  traversal in the Office-document parser, Fly credentials in the machine environment, dashboard DNS
  rebinding and cross-site writes, a revoked delegate's dashboard session that outlives the
  revocation, a delegate's dashboard session that holds the operator's authority, and an
  `update_sketch` patch that reaches the prototype chain
  ([SECURITY.md](https://github.com/zombico/mojulo/blob/v3.0.0/SECURITY.md#known-issues-in-2x)). Bots
  already deployed from 2.x run on their own, on that image, until you take them down.
- **Unpinned installs move to 3.0 on their next start once 3.0.0 is npm `latest`.** A host that runs
  `npx -y mojulo` (every config 2.x `mojulo init` wrote, the README's manual lines, and the Claude
  plugin up to 2.0.1) installs 3.0.0 on its next start, whether or not the plugin was updated. The
  3.0 plugin runs `npx -y mojulo@3.0.0`; update it, and remove any `mojulo init` or `claude mcp add`
  registration beside it (two registrations run two servers). Exact pins and a global
  `npm i -g mojulo` stay on their version until you change them. The first start downloads about
  79 MB (the package and its dependencies); if the host gives up, start Claude Code with
  `MCP_TIMEOUT=60000`, or run `npx -y mojulo@3.0.0 --help` once in a terminal. Restart every host
  afterwards so no 2.x server keeps running against the same `~/.mojulo`.
- **Saved provider keys become unreadable to 2.x.** With `API_KEY_ENCRYPTION_KEY` unset (the
  default), the first time a 3.0 process reads saved keys (`mojulo-config`, `list` included;
  `mojulo init`'s key prompt; the dashboard's key settings; `mint_solid` `via:'prompt'` without an
  inline `apiKey`), it re-encrypts every key a 2.x install saved, the Fly token included, under a
  per-install key at `$MOJULO_HOME/secret.key`. 2.x cannot decrypt them after that; the change is
  one way. **Back up `secret.key` together with the database:** without it 3.0 cannot read the keys
  either.
- **What left, and what it left behind.** The chatbot factory is no longer part of mojulo as of 3.0
  and is moving to its own project. Earlier 2.x versions that include it are unmaintained and have
  known security issues. Its tools, packs and dashboard pages are not in 3.0; calling one of its
  tools, `mojulo install chatbot` or an `artifact_materialization` commit does nothing and answers
  with that notice. Its tables (`deployments`, `modular_sessions`, `mcp_jobs`) and their rows, and the
  `packs/chatbot` marker, stay in `~/.mojulo`, inert: 3.0 does not use them, and you may delete them.
  **`~/.mojulo/data/artifacts/` holds each old bot's `.env` with its provider key in plain text:
  delete it.**
- **Downloaded helpers and draft figure specs move out of the npx cache.** 2.1.0 kept Chrome for
  Testing, ffmpeg, gallery stills, turntable strips and draft figure specs inside its package folder;
  3.0 keeps them under `$MOJULO_HOME`. An unpinned upgrade replaces that folder, so they are not
  carried over; pending figure specs are lost unless another version's npx folder still holds them
  (3.0 copies those across once). The browser (now build 154) is no longer fetched in the
  background: with no browser installed, gallery thumbnails stay blank until one is available (an
  installed one, `MOJULO_CHROMIUM`, or, outside the Claude plugin build, an explicit render's
  download).
  @puppeteer/browsers 3 has no proxy support, so a host behind an HTTP proxy sets `MOJULO_CHROMIUM`.
- **Other changes a 2.x setup can notice.**
  - `mojulo init` changes nothing without `--yes` when stdin is not a terminal: it prints its plan and
    exits 2. With the Claude plugin installed it leaves Claude Code to the plugin.
  - The dashboard is its own package, `mojulo-ui` (`npx -y mojulo-ui`); `npx -y -p mojulo mojulo-ui`
    downloads the matching version on first use (`MOJULO_UI_NO_FETCH=1` refuses). It answers 403 to
    a `Host` other than loopback, `MOJULO_UI_HOST` or a name in `MOJULO_UI_ALLOWED_HOSTS`, and to a
    cross-site write, so a LAN, proxy or tunnel setup needs `MOJULO_UI_ALLOWED_HOSTS`.
  - `mint_solid` `via:'prompt'` requires `provider`: nothing chooses the provider for you any more.
    The key is `apiKey`, the saved key named by `apiKeyId`, or else your saved key for the provider
    you name.
  - Exported World pages are self-contained by default again (`world.html`, no third-party fetch);
    `cdn: true` writes `world.cdn.html`, and `world.offline.html` is no longer written.
  - Stored `floorplan` and `condo-complex` rows that relied on the old room defaults re-render
    roomier, and the furnish pass doors sealed rooms, parks interior doors open against the wall and
    moves wall pieces out of a door's way
    ([Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
    [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
  - `chatbot` or `ops` in `MOJULO_PACKS` is ignored, so `MOJULO_PACKS=chatbot` alone now leaves the
    creative tools on.
  - `MOJULO_MCP_TELEMETRY=off` stops only the local tool-call log, no longer the tool timeout, and
    `MOJULO_MCP_TOOL_TIMEOUT_MS` can raise a tool's budget but not lower it. Render tools get 600 s.
  - `mojulo install creative` installs nothing (the creative pack always ships), and
    `mojulo install recall` now works from npm and npx. With the runtime already installed and the
    search model missing, it fetches the model instead of reporting nothing to do.
  - A delegate (roles pack) signed in to the dashboard reads and no longer writes (below).
  - A city minted from now on wears the round street kit (below); stored cities are unchanged, and
    `elements: { roundKit: false }` keeps the block kit.
  - A material object whose `metal` is a name (`{ metal: 'steel', finish: 'brushed' }`) is a metal
    surface (below); beside `base` or `preset` it is refused. The shelf's numeric `metal: 1` is
    unchanged.

### What 3.0 is

- **A 3D compiler for agents.** Your agent builds objects, walkable worlds and games by conversation
  as small deterministic recipes on your machine, compiled back to the same geometry (byte for byte on
  the same platform) and exported to STL / 3MF, glTF, OpenUSD, IFC4, self-contained HTML, Godot,
  Blender, Unity and Unreal. The bot factory, which never fit that, is gone.

### Determinism

- **What "the same geometry" means.** A recipe compiles to the same geometry every time: byte for byte
  on the same platform (OS, CPU and Node version), and to within floating-point rounding on any other.
  V8's `Math` is not one function everywhere: its arm64 builds round `sin`, `cos`, `exp`, `atan2` and the
  rest differently from x64, and since Node 24 `Math.pow` and `**` call the platform's C library. An
  embedded texture PNG can also differ in its compressed bytes between Node builds (Homebrew's Node links
  a different zlib), never in its pixels.
- **3.0's generators go further.** The vegetation engine, terrain worlds, the anime head and hero, stores
  and construction, metro and canal cities, the metro refacade and the Tian Tan Buddha take their
  transcendental functions from a deterministic math module (fdlibm in plain double arithmetic), so their
  pinned outputs are the same bytes on Linux and macOS, x64 and arm64, Node 22 and 24, and CI checks them
  on every runner. The older helpers they reach switch to it only inside a 3.0 build, so nothing minted
  with 2.x changes. A few older helpers still use the engine's `Math` (specular shading, sRGB conversion,
  some textures, roads, the metro World's walkers and cars).

### Lean install

- **3.0.0 against the published 2.1.0, one method.** A cold start with an empty npm cache and a
  fresh `HOME` and `MOJULO_HOME` (`npm exec --package=<tarball> -- mojulo`) through a local registry
  stand-in, timed from spawn to the `initialize` answer, on one macOS arm64 machine (M1 Max). Sizes
  are decimal MB; the installed and downloaded rows include the package itself, and "downloaded" is
  the unique tarballs plus the package metadata, estimated gzipped.

  | | 2.1.0 | 3.0.0 |
  |---|---|---|
  | npm tarball | 31.2 MB | 6.7 MB |
  | Unpacked package | 121.7 MB | 21.3 MB |
  | Installed, package and dependencies | 539 MB, 426 packages | 227 MB, 153 packages |
  | Downloaded on a cold start, package included | about 182 MB | about 79 MB |
  | Cold start to `initialize`, median (p90) | 12.7 s (15.7 s), 14 runs | 4.5 s (4.6 s), 6 runs |

- **Machine caveat.** The two timings come from separate sessions on a busy machine: 2.1.0 on
  2026-09-27 (load average 3 to 12), 3.0.0 on 2026-09-30 (7 to 11). In the 3.0.0 session, runs of a
  pre-release 3.0 candidate interleaved with the release's took a median 6.1 s: the release installs
  one copy of sharp instead of two, 26 packages fewer. Trust the sizes more than the seconds, and
  expect the real registry to be slower than the stand-in. npm also keeps the downloaded tarballs in
  its cache, about 140 MB for 3.0.0. 2.1.0's package carried the dashboard build; 3.0.0's dashboard
  is `mojulo-ui` (12.7 MB packed, 57.0 MB unpacked), fetched only when it is opened.
- **The package never carries a local content pack.** A tarball or `mojulo-ui` build made from a
  checkout holding the operator-local mobile-suit content pack carried it; the package file list
  leaves it out, a test fails any tarball carrying a gitignored file, and the dashboard build refuses
  such a checkout. A clean install no longer prints warnings about that absent pack.
- **What left the install:** the dashboard build, `@swc/core`, `three`, the dashboard-only libraries,
  `dotenv`, and the chatbot factory's `officeparser` and `pdf2json`. puppeteer-core, archiver and
  react load on first use, so the stdio server boots without them. Details:
  [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/v3.0.0/docs/tech-requirements.md),
  [Lean cold start](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#lean-cold-start).

### Security and consent

- Saved provider keys are encrypted under a random per-install key (`$MOJULO_HOME/secret.key`, mode
  0600) instead of a constant in the source. The dashboard refuses DNS-rebinding and cross-site
  requests. `mint_solid` `via:'prompt'` never chooses the LLM provider for the caller: `provider` is
  required, and the key is `apiKey`, the saved key `apiKeyId` names, or the caller's saved key for
  that provider.
- Chrome for Testing downloads only for an explicit render and says so (never under the Claude
  plugin, below); headless Chromium keeps its sandbox (on Linux it falls back only on Chrome's
  sandbox errors or as root); the ffmpeg download is SHA-256 pinned; everything mojulo writes lazily
  lands under `~/.mojulo`.
- `mojulo init` needs `--yes` when nobody is at a keyboard. "No telemetry" is now "no external
  telemetry", with the local tool-call log described. Core has no Docker, Fly, GHCR, webhook or
  uploaded-document code path.
  ([Security hardening](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#security-hardening),
  [Runtime footprint and consent](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#runtime-footprint-and-consent))
- **Revoking a delegate's key now ends their dashboard session on their next request.** Before, the
  dashboard checked only a session's signature and 7-day cookie expiry. A delegate (roles pack) whose
  key was revoked with `revoke_role_key`, had expired, or had its token epoch bumped could keep using
  the dashboard until the cookie ran out, even though their MCP bearer had already stopped working.
  Such a session now gets the same 401 on `/api/*` and redirect to `/login` as no session, and with
  the roles pack off a delegate session is refused outright. The dashboard middleware now runs on the
  Node runtime so it can make this check. The operator's own session, installs with login off, and
  installs without the roles pack make no database read.
- **A delegate's dashboard session is read-only.** No dashboard route checks a role, a grant or a
  flag, so on 2.x a signed-in delegate held the operator's authority there, whatever the role
  granted: deleting the operator's saved keys, writing an app's `.env` and starting the app, deleting
  sketches. A live delegate session now reads pages and the API, and gets 403 (`DELEGATE_READ_ONLY`)
  on every write and on the settings API. The roles pack's grants still bind the delegate's MCP key;
  the operator's session is unchanged.

- **sharp 0.35.5.** The image library moves past high-severity advisories in its bundled libvips and
  libheif (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c), and `mojulo-ui` no longer carries the older copy
  Next.js keeps for `next/image`, which the dashboard never imports. An image submitted for a render
  that does not decode is refused at submit.
- **A patch cannot reach the prototype chain.** An `update_sketch` patch path through `__proto__` or
  `constructor/prototype` set or deleted a property on every object in the server process until it
  restarted. Such a path, or the same key in a set-by-id merge, now refuses by name.

### Claude plugin and directory readiness

- Every tool carries a `title` and behavior `annotations`, `initialize` negotiates `2025-06-18`,
  `2025-03-26` or `2024-11-05`, and the Claude plugin pins `npx -y mojulo@3.0.0`
  ([annotations](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#mcp-tool-annotations-and-protocol-negotiation),
  [disclosure](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#directory-listing-and-disclosure)).
- **The Claude plugin build.** When the Claude plugin starts mojulo, it leaves out the handoff tools
  for AI image, voice and mesh generators. That covers the image-render and mesh handoffs, the voice
  registers, sprite sheets, style presets, the skin op, the painted sketch kinds, the painted cover
  title, `forge_motion`'s scene and cel sources, the character-from-dream figure specs and a
  figure's `dream_audit`, and the image-driven catalysts. The vocab cards and catalysts it keeps are
  served without their lines about those loops. It also leaves out the keyed
  `mint_solid via:'prompt'` door (use `via:'packet'`) and every automatic download:
  - renders use a Chrome, Chromium, Edge or Brave you already have, or `MOJULO_CHROMIUM`;
  - MP4 encodes use an ffmpeg you already have, or `MOJULO_FFMPEG`;
  - the search model arrives only through `install recall`.

  Exported World and game pages are always self-contained there: `cdn: true` is ignored, and the
  result says so. The host adapter cards are served without their image-generator and CDN lines, and
  the MCP Apps preview is not offered. A call to a tool the plugin build leaves out answers in-band.
  Installs from npm or a checkout are unchanged.
- **The plugin listing.** It is rewritten for 3.0 with three example prompts that work in the plugin
  build, a table of what it installs, fetches, runs and writes, a privacy policy link, an "Upgrading
  from 2.x" note, and an icon.

### Hosts

- **ChatGPT.** Its own adapter card (`get_adapter({ id: 'chatgpt' })`) and handoff profile, for
  connected MCP and for a shell-enabled Work box. A separate ChatGPT skills package
  ([plugins/mojulo-chatgpt](https://github.com/zombico/mojulo/blob/v3.0.0/plugins/mojulo-chatgpt/README.md))
  prefers connected MCP and otherwise sets up a pinned, workspace-local CLI in the box. Handoff notes
  keep a file on the MCP server apart from a file in the session, and promise no attachment or inline
  preview the session has not shown. Codex is no longer recognized by the bare OpenAI vendor name.
- **Meta Muse.** A host profile and adapter card for the shell-only agent on its own persistent Linux
  VM, where `npx mojulo call` is the whole surface and `MOJULO_HOST=muse` names its doors: pages leave
  through its Artifacts, files through its Library. A bundle export's `<ref>.courier.html` lists the
  export's files under `outcomes/<ref>/`, each with a Save where the viewer allows it, so one HTML page
  can deliver any of them. A host profile
  may name its own page words (`pageVerb`, `pageTool`, `pageOpensIn`), what its page door does with
  inline scripts (`inlinePage`), and a `drop-folder` file door.
- **`MOJULO_HOST`** picks the adapter card on the CLI, for `get_adapter`, catalyst composition and
  recommendations, when no client identity says which host is calling. An explicit adapter id or a
  recognized client still wins.
- **Recipe recovery.** `create_sketch` accepts an exported world recipe and passes it through the same
  validation and ledger stamp as `update_sketch`, so a recipe carried out of a temporary box comes back
  as it left, a hero with its hand edits. A duplicate ref refuses, and referenced assets must already
  exist.
- **MCP Apps preview, opt-in.** With `MOJULO_MCP_APPS=1`, `preview_world` shows an inline mesh
  snapshot of a stored ref in a host that supports MCP Apps; the exported HTML stays the full world.
  Nothing is hosted publicly.

### Dashboard package

- **The dashboard is its own npm package, `mojulo-ui`,** published at the same version as `mojulo`
  and depending on exactly that version. `npx -y mojulo-ui` starts it; core's `mojulo-ui` command
  runs the matching package or downloads it after saying so. It has no bot pages. Both packages
  carry LICENSE and NOTICE, and the dashboard lists every package it redistributes in
  `THIRD_PARTY_NOTICES.md`
  ([Dashboard package](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#dashboard-package)).

### Creative work

- **Characters and heroes:** the hero as a core form with a create-hero loop and tunes kept as the
  record, fitted landmark heads with a face tune and a hair library, the ring plan and creature loop,
  planar humanoids, and worn things that follow the dials
  ([Create hero](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#create-hero),
  [Hero detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-detail),
  [Hero tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-tune),
  [Fitted heads](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#fitted-heads),
  [Face tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#face-tune),
  [Hair library](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hair-library),
  [Ring plan](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#ring-plan),
  [Planar detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-detail),
  [Planar humanoid](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-humanoid),
  [Read and attach](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#read-and-attach)).
  The hero also wears the Anime Form Studio's head (`head: 'anime'`) on anime proportions, with
  fitted hair forms, looks as composable words, a graphic face and neck, a character light with
  designed shadow shapes, draw layers and clips at the door; its skinned GLB and Godot pack carry the
  face. Worn armour (plate, samurai lamellar and hard-suits, with themes carried down a suit) and held
  gear with swings ride the hero door
  ([layered manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/layered.md),
  [designing a hero](https://github.com/zombico/mojulo/blob/v3.0.0/docs/examples/humanoid/DESIGNING.md)).
- **Arms, metal and gems:** swords, daggers, greatswords, staves, bows and shields composed from a few
  dials and laws, pattern-welded blades included (`mint_solid` kind `equipment`); metal as a surface
  any part, facade, roof or trim can wear (a metal, a finish and an oxide film), reflected on the World
  page and kept in glTF and USD; gems with their optics and exact light prints, and crystals as light
  operators in worlds, performed in Godot
  ([equipment manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/equipment.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Cities and worlds:** metro and canal profiles for the fractal city, redrawn landmarks and sacred
  buildings, stores and malls from concept cards, and large cities streamed by tile
  ([City scale](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#city-scale),
  [Canal city](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#canal-city),
  [Local city refacade](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#local-city-refacade),
  [Retail concept cards](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#retail-concept-cards),
  [World streaming](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#world-streaming)).
  New cities wear a round street kit: lamps, poles, bins, bollards, piers, playground frames and
  rooftop equipment drawn round, a few of them in metal.
- **Interiors:** houses minted in a style, livable default room sizes, and a furniture audit that
  gives every room a way in
  ([House styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#house-styles),
  [Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
  [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
- **Buildings and furniture:** timber from a synthetic log, steel sections, reinforced concrete and
  masonry, joined by Western and Japanese joinery through the exact kernel and checked, never refused;
  houses framed, lined and wired by their building tradition, carrying a building model with a
  takeoff; tile roofs and drainage; houses exported as IFC4 (`export_model` `format: 'ifc'`); house
  design checks that measure the walkways, with a repair; furniture built from sheet goods and
  fittings (carcasses, tables, chairs, sofas with upholstery and cloth from a weave draft), checked for
  sag, racking and tipping, with wordless assembly manuals; and the built pieces placed in rooms and
  condos ([floor plan manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/sketch-vocab/floor-plan.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Terrain and nature:** a painted landscape made real-scale ground you walk, fly and orbit, up to a
  small planet, or a world composed from features (a river, a range, a lake, a volcano, a coast) sized
  on real-world bands, with fractal cities sited on its hills; plants grown rather than drawn (trees by
  their architecture, palms, bamboo, figs and conifers), standing as forests where the ground is
  painted wood, and grass; rocks built from their minerals, and landforms and erosion on painted
  landscapes ([terrain manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/views/view-vocab/terrain.md),
  [vegetation](https://github.com/zombico/mojulo/blob/v3.0.0/docs/vegetation.md)).
- **Look and drawing:** shading normals from the hull, outlines and rims carried into Godot, Unity
  and Unreal, key-and-fill art direction, and the `layered` kind drawn from its compiled mesh, with
  rigs and clips
  ([Shader look](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#shader-look),
  [Art direction](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#art-direction),
  [Planar drawing](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-drawing)).
  A line drawn on a `layered` solid becomes a recipe op (a silhouette solves the shape dials, a
  contour becomes a ridge strip, a brush a dial), with the share of the line it could not hold.
- **Audio:** stereo and per-hit variation, tuned strings, orchestral scoring and era synths, and
  anthem and roots song styles, all synthesized from formulas and opt-in
  ([Audio fidelity](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#audio-fidelity),
  [Orchestra and era synthesis](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#orchestra-and-era-synthesis),
  [Anthem styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#anthem-styles),
  [Roots styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#roots-styles)).

2.1.0 and earlier releases, and the detailed log behind this release, are in
[CHANGELOG-2.x.md](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md).
