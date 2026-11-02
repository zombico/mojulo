### The feature style, tuned: each animal's sizes and details by hand, and a seventh-generation detail tier

The feature style's animals (the mascot's `style: 'feature'`, docs/feature-style.md) take a `tune`: the operator's hand
on a model sheet, dialled by the style's own two halves, plus how much detail the model is made at. It rides the mascot
sheet, so every door that compiles a sheet carries it (`create_character({ as: 'mascot', spec: { tune } })`, a cast's
member, a quick game's hero). Code: `control/lib/graph/egocube/feature-tune.js`.

- **Structure.** `tune.structure` sizes the masses, each a multiplier on the species' designed size: `head`, `girth`,
  `legs`, `arms`, `hands`, `feet`, `tail`, `ears`, `muzzle`, `eyes`, `neck`.
  - The head grows about its own seat, its jaw kept on the neck. Its muzzle, its ears and its tufts grow with it.
  - The girth widens and deepens the trunk about its axis. The shoulders, the hips and the limbs' radii follow it.
  - The tail, the ears and the muzzle each grow as a module from their roots.
  - The function still holds. A quadruped's `legs` and `arms` are asks the all-fours fit honours as far as the floor
    allows. Where it keeps one longer, the mint says so (`mascot.tune.notes`).
- **Decoration.** `tune.decoration` sets the decoration dials (`tufts`, `crown`, `markings`, `horns`, `spines`, `mane`,
  `fins`): 0 to 3, where 1 is the designed amount and 0 leaves the structure bare. A dial never moves a mass.
- **Detail.** `tune.detail: 'gen7'` makes a hero model of the seventh console generation's HD era (`'game'` is the
  default game model):
  - a denser skin (about 21 to 27 thousand triangles, against 13 to 17 thousand; budget 34,000);
  - the fur's secondary clumps: a fuller cheek fan, a crown's two more locks, tufts at the shoulders, the elbows and
    the haunches, a ruff under a visible neck, a brush tail's fanned tip;
  - a wing's coverts, and a scaled back's second row of spines;
  - its light baked into its corners by the bake stack (`bake`, inline finishes): occlusion, a sky light, warm fur, wet
    eyes and nose, polished horns, hooves and beaks. Every lit export carries it as vertex colour.
- **Words.** A brief says the tune too: `big ears`, `big head`, `long legs`, `lanky`, `chubby`, `bushy tail`, `long
  snout`, `fluffy`, `shaggy`, `sleek`, `plain coat` and the rest of `TUNE_LEXICON`. Its tier is said with `7th gen`,
  `ps3`, `xbox 360`, `hd era` or `hero model`.
  - The words are read only in the feature style. A tier's word asks for the style; elsewhere a brief reads as it
    always has.
  - An explicit `tune` asks for the style too, and is refused under another named style.
- **The style's own words reach it.** `feature style`, `feature animation`, `stylized`, `stylised` and `cartoon
  realistic` now ask for the feature style. The brief reader did not know them before, though the style's first theme
  said it did.
- **Families' designed sizes.** `FAMILY_SIZES` sets five families' structure dials where the style's shared
  silhouettes misdrew them, multiplied under the operator's tune: a bear's head bigger, a canine's muzzle longer, a
  cat's shorter, a deer's and a horse's legs and necks longer.
- **Broader beaks.** Every bird's beak is broad at its root: side mandibles stand out from the middle of each mandible
  and converge on its tip. From the front it reads as a wedge, not a spike; in profile it keeps its species' shape (a
  hook, a needle, a deep beak). The breadth is capped by the beak's length, so an owl's short deep beak stays a beak. A
  bill is broadened too.
- **Wings that carry the profile.** A folded wing now reads as one bold shape on the bird's side:
  - it lies closer along the flank, and stands proud of it on thicker panels instead of sinking in;
  - its tone steps further from the body's (`WING_STEP`);
  - the hand turns at the wrist so its primaries lie back past the tail, in the hand panel's own plane. They no longer
    splay out sideways from the front, and no feather grazes the panel it springs from. That grazing tore the skin:
    on five birds measured, four carry fewer open edges in their skin (between 11 and 35% fewer), and the macaw 5% more.
    The open edges themselves are closed further down (Closed skins).
- **Birds rest bright, not droopy.** Every bird's default face read sad. Its eyes sit round the sides of its head, so
  the brow's outer end wrapped down over the eyeball, the upper lid sat heavy over the iris, and every bird's default
  sheet rolled `determined`. Now:
  - the bird plan has its own resting face (`BIRD_REST`): lids 12° more open, brows 12° higher off the lid, their outer
    ends lifted. It moves every expression alike, so the clips play the same and a blink still shuts;
  - a bird whose head is its own colour (an eagle's white, a mallard's green) wears that colour on its lids, instead of
    the body's dark bags under its eyes;
  - a feature bird whose face is not asked for rolls a bright one (`FEATURE_BIRD_LEAN`: mostly happy or grin); an asked
    face wins. Mammals roll as before.
- **Head tufts for every animal.** `tune.tuft` gives any feature-style animal a look for the top of its head, in place
  of its designed crown. That means furred, feathered, scaled and smooth animals alike: a crested pigeon, a spiky gecko, a
  frog with a topknot, a bear with a red mohawk.
  - The looks: `swept` (the designed fan), `cowlick`, `mohawk`, `spikes`, `crest`, `plume`, `fringe`, `mop`,
    `pompadour`, `none`.
  - Each look is a card of locks in `feature-tufts.js` (`HEAD_TUFTS`), placed on the skull by angle. It sits on any head
    and grows with a tuned head, and a new look is a card, not code.
  - Its colour is the coat's, pale, dark, the hair's, or any hex (a palette group `Tuft`); its `size` is a multiplier.
    The crown's decoration dial still rules it.
  - A brief says it too: `mohawk`, `cowlick`, `crested`, `topknot`, `bangs`, `pompadour`, `quiff`, `spiky hair`, `mop
    top`.
  - Untuned animals keep their designed crown.
- **Rounder, bottom-heavy animals.** Every silhouette is rounded (`FEATURE_ROUND` in `feature-silhouettes.js`):
  - the lower masses (the belly, a pear's front, the haunches, a snake's coils) are fuller across and deep, and the
    chest is a little slimmer;
  - a leg that shows is fuller at the thigh;
  - every mass is less pointed and blends softer;
  - the pale belly follows the body.
  It is applied before the all-fours fit, so the function still holds. A tuned girth now lets the legs rise as far as
  the arms grow.
- **The frog, redesigned.** The squat silhouette is now a sitter: a wide pear on folded hind legs, each thigh forward
  along the side and its shin back under it.
  - The head is wide and flat (a frog head shape), with big eyes bulging on domes on top of it.
  - A new frog muzzle draws the mouth's line right across the face, over a pale throat and two small nostrils.
  - The webbed feet now sit on the ankle, with three round-padded toes. Before, they were discs lying apart from the
    leg, a bug for any webbed-footed animal.
  - Its thin arms end in four padded fingers, planted on the floor in front.
  - Its sitting pose is its own all fours, so it is no longer fitted to drop face down onto them (the known "frog faces
    the floor" issue).
  - A frog rests open-eyed like a bird and rolls a bright face when none is asked for.
- **Closed skins.** The skin's net pinches wherever two sheets of the surface pass within a cell: a crease under the
  jaw, a wing on its flank, an arm against the body. The pinch was let go and its hole left open, the slits PR #30
  listed as known. Now the holes are fanned shut on the surface (`skin-net.js closeHoles`, as the realistic hero's
  skin already did). On nine animals measured, with their colour zones cut in, every skin is closed: 0 open edges,
  where the raccoon had 151.
- **The horse and the deer read as their animals.** They read as a bear and a fox: the horse's kit gave it a short
  round muzzle and a mane of a few stubby spikes, and the deer's horns were a single curl. Each family now has its own
  modules, reached through its tuning's kit (`FAMILY_TUNE` `kit`), so every animal of the family gets them:
  - the horses (`equine`): a long face sloping down to a soft round nose with dark nostrils, a longer and narrower
    head, a flowing mane falling to one side from the poll to the withers with a forelock over the brow (its own
    colour, the roster's mane), a long hair tail in the same colour, and a longer neck. The zebra and the donkey keep a
    short upright mane and a tufted tail (`SPECIES_KIT`);
  - the deer (`cervid`): antlers (a beam each side curving forward, with three tines), big ears set out to the sides,
    a narrow snout tapering to a black nose over a pale chin, and a longer neck. The elk, the reindeer and the moose
    wear them too;
  - no pale cheek discs on a hoofed face. The horns' and the mane's decoration dials still rule the antlers and the
    mane.
- **Everything is attached.** A new rule (`feature-attach.js`): every shape on a feature animal is attached to the body
  or to something attached to it.
  - Two shapes count as one where the gap between their surfaces is narrow enough for the skin's blend to bridge.
  - Once the build is laid out, a piece apart is moved, whole, to the nearest attached shape and set into it: its design
    kept, its place corrected. The plan records what moved (`mascot.attached`).
  - It caught 14 of 57 species sampled (one or two per family). Thin tails stood off the rump (a cougar's, a mouse's, a
    wombat's, a platypus's), and the reptiles' and dinosaurs' dorsal spines floated above their backs. Each moved 0.3
    to 4.5 cm.
  - Every family's shapes are now one piece, as designed and at the gen7 tier, and every plan's minted skin is a single
    connected piece.
- **The giraffe's neck and the zebra's stripes.**
  - The long neck is slim now. It was one fat mass as wide as the chest, so the giraffe read as a tall body. It rises
    further (`FEATURE_PROPORTION.longNeck`), tapers up to the head, and its base no wider than the shoulders.
  - A head raised well clear of its body on a neck (`FEATURE_NECK_PIVOT`: a giraffe's, a horse's) turns at the top of
    that neck: the rig's neck bone spans the neck (it was 2 cm at its base, so a nod swung the whole neck stiffly from
    the shoulders). Other mascots' rigs are as they were.
  - A `stripes` coat (the zebra's, the tiger's) was six thin strokes on the flanks: a few scratches on a white coat. It
    is now bold rings round the standing figure, from the feet up the neck to just under the head, never across the
    face (`FEATURE_STRIPES`). The widths fall in rhythm, each ring leans a little the other way from the last, and the
    edges are notched.
  - The stripes are cut into the skin as a zone along their exact edges, not laid over it as a layer. So a zebra stays
    within the game model's triangle budget: 17,434 triangles, where the layer would have taken it to 24,767.
- **Stripes as a body wears them, and the giraffe's patches.** The rings went all the way round. Real stripes start at
  the spine and end at the belly. Now:
  - each body stripe starts at the spine (on an animal standing up, the middle of its back) and runs round each flank,
    widest at the spine, holding its width and pinching late to a point at the belly (an `arc` on the coat's `band`);
  - a zebra's points meet under it in chevrons, and a cat's (the tiger's) stop short of its pale belly and are
    thinner (FAMILY_TUNE `stripes`);
  - over the legs a stripe stays a ring.
- **The giraffe's patches.** A new `reticulated` coat is a network of big rounded patches parted by thin lines of the
  coat (`FEATURE_NETWORK`, the coat's `cells`). The seeds sit on a jittered lattice from seeded dice, and the patches
  take the roster's own brown (`Spot`), over the body, legs and neck to under the head. It is cut into the skin as a
  zone, the patches sized to keep the giraffe within budget (17,831 triangles).
- **The moose's palms and the cats' noses.**
  - A new `palmate` antler (the moose's, `SPECIES_KIT`): a short beam out from each side of the head carrying a broad
    flat palm, held up and out like an open hand, its broad face to the front, with points along its outer and upper
    rim. The moose had worn the deer's branching antlers.
  - A new `moose` muzzle: a long face ending in a big bulbous nose that overhangs and droops past the lip, fat at its
    foot, its big dark nostrils on its front, a small lip tucked under it. The moose had the deer's narrow snout. Its
    bell is not drawn: its head sits low on its shoulders, where a flap under the throat would never show.
  - A new `feline` muzzle for the cat family (tiger, lion, house cat, cougar): a bridge down from the brow, two puffy
    pale whisker pads and a pale chin, and an inverted triangle of a nose at the top of the pads in the roster's nose
    colour. The cats had a `button` nose, a small dot the tiger's orange swallowed.
- **The chunky rodents: the groundhog, the capybara, the beaver and their kind.**
  - Two new species in the fauna roster's rodent family (`fauna/families/rodent.js`, with their search cards, and the
    generated behaviour table regenerated). The groundhog is the beaver's build smaller and stouter, with plain
    digging feet, a short bushy tail and cream incisors. The capybara is a guinea pig's build grown big on longer legs,
    with a long boxy head, its eyes and ears set high, and no tail. They mint on the realistic door too.
  - In the feature style every rodent has BUCK TEETH (a kit word on the family, `teeth: 'buck'`): two incisors under
    the mouth in the roster's own tooth colour, a beaver's orange. The hedgehog, filed with the rodents but no rodent,
    has none.
  - The chunky ones (the beaver, groundhog, guinea pig, hamster, and the wombat though it is no rodent) wear a new
    `blunt` muzzle: a broad snout, puffy pale whisker pads and a chin, a small nose at the top of the pads. The capybara
    wears its own `capybara` muzzle: a long deep boxy snout ending square, a wide flat nose high on its front.
  - Each wears its own tail where they all had a rat's. The beaver has a dark flat scaly paddle lying on the ground
    (`ground` tails rest on the floor however high the body stands) and webbed feet. The groundhog has a short bushy
    stub. The capybara, guinea pig, hamster and wombat have none.
  - `SPECIES_TUNE`: a species' own tuning over its family's. The capybara's long boxy head, high-set eyes and coarse
    short coat (no crown, short tufts); the hamster's cheek pouches. The wombat is drawn as the barrel it is
    (`SILHOUETTE_OF`: its long low roster body read as a noodle).
- **Side hips, the round animals' default** (`tune.hips: 'below'` for the old way). A round animal's legs (the pear and
  the barrel silhouettes) are set on the sides of its ball at its centre's height, in place of legs from the bottom of the
  ball (`sideHips` in `feature-silhouettes.js`). On all fours the ball pitches about its own centre and rolls in place,
  instead of swinging forward and down over hips at the floor. On six round animals, against legs from the bottom:
  - the fit raises the legs about 0.31 head units, where it raised them about 0.57 (on the bent all-fours pose);
  - the belly's bottom sits 0.28 to 0.39 head units off the ground, where it sat 0.69 to 0.80: the butt low;
  - the arms lengthen as before; the function holds.
  A prototype first (opt-in), it was made the default once the operator saw it.
  - From the side each thigh is a DRUMSTICK (`SIDE_HIP_DRUM`): 2.4 times as deep as it is broad (its front-view
    breadth, the 1 : 4 : 1, untouched), round at the hip and tapering to a low knee, a fifth of the way up the hip, so
    its round end shows under the ball.
- **Standing straight, on all fours bent.** Standing, the legs are straight: a side-hipped animal's knee and ankle fall
  straight under its hip (`SIDE_HIP_REACH` 0), and the standing clips (the idle, the blink, the wave, the faces) bend
  no knee and stand the feet under the hips (a sturdy idle's wide stance had splayed a bear's straight legs out), a motion clip starting and ending on a straight stand (`straightened` in `feature-body.js`; a hop's or a
  squat's own crouch kept). On all fours the hind legs keep their natural bend (`FEATURE_FOURS.natural`, 0.3): the
  fours pose starts there, and the fit counts the hips that much lower when it clears the trunk.
- **Two balls in the trunk.** The round animals (the pear and the barrel silhouettes) are drawn as a rib ball over the
  waist, riding the torso, superposed on a pelvis ball under it, riding the pelvis, in place of one ball with a cap on
  it. The wedge's big rib ball is kept over the waist too. So the trunk can bend at the waist.
- **On all fours as a regular animal.** The all-fours pose is no longer the whole trunk tipped stiffly over the hips:
  - the hips tip 70°, the spine curls (`FEATURE_FOURS.curl`, as the rig's spine bends) and the core bends at the waist
    (`waist`, 15°), so the spine runs level from the hips to the neck's root and the rib ball comes down in front;
  - the head is carried out in front of the chest, turned up to look ahead (the neck back `FEATURE_FOURS.neck`, 30°,
    the head as far as it goes);
  - the fit (`foursOf`, `functional`) models that bent trunk segment by segment, as the rig poses it.
  - The rig takes a new pose word for it, `waist` (degrees, + the chest forward over the navel), in `figure-posing.js`.
    Absent, nothing changes.
- **The walk on all fours, and running on them** (`FEATURE_GAIT`). The hind feet take the biped's walk paths, and each
  foreleg plays its own side's hind foot's cycle a quarter of a cycle later: where that foot is fore and aft its paw is
  (from under the chest, the elbow folded, to its full reach), and as that foot lifts so does the paw. The walk on all
  fours (`prowl`) is a four-beat lateral sequence, left hind, left fore, right hind, right fore; a paw in stance rests on
  the floor; the head looks ahead and the tail is carried. An animal that goes on all fours RUNS on them: its `run` clip
  is the gallop; upright it only walks, slowly (`walk`). (A first slow trot was dropped; the trot below replaces it.) The paws' solve had mixed
  a unitless share to the side with metres, so a paw in stance stood a few centimetres off the floor: the share is now
  taken of the target's own length (the gallop's paws, too, now rest exactly on it).
- **Keyed clips play their keys** (`station-loft-rig.js` `layeredClip`, every packed and exported clip). Two channels were
  lost between a clip's keys and its packed frames:
  - a `feet` target, an array, was blended into an object the rig reads as no target at all. So, played or exported,
    no keyed gait's feet stepped: the mascots' walk and run, the walk on all fours and the gallop. The legs held their
    rest while the body bobbed. Now a target blends as a point, and a key without one holds the other's;
  - the waist: `resolvePose` turns `waist` into the raw `bend`, and the packer resolves a key twice, the second time
    dropping it. On all fours the chest rode 5 to 11 cm higher than its keys and the paws left the floor. The raw
    bend now flows through, as the raw spine and swivels do.
  The laws and the solvers pose the keys themselves, so neither showed in a test. `station-loft-rig.clip.test.js` now
  plays them.
- **The trot on all fours, from the horse study's mechanics** (a `trot` clip, `FEATURE_TROT` in `feature-trot.js`;
  `run` stays the gallop). The slow trot dropped before was laid on the biped run's paths, and its forelegs copied the
  hind feet by a share of their reach. So its forepaws travelled about half as far as the hind feet in the same stance
  and skated. This one is laid out as the horse study solves its gaits (`mount/`, branch 1102-horse-study), made
  dimensionless:
  - THE BEAT: a two-beat diagonal, each hind a moment before its fore (HILDEBRAND 1965, BACK 1995);
  - THE STRIDE: the reference horse's trot (CLAYTON 1994, HEGLUND 1974) at one Froude number (`froude` 0.6, a jog),
    scaled to the hip by dynamic similarity (Alexander & Jayes 1983) and cut to what the shorter pair of legs reaches.
    A raccoon-sized mascot trots at about three strides a second;
  - ONE GROUND: every planted foot, fore and hind, slides back at the one ground speed, so nothing skates. The swing
    is laid between the stance it leaves and the one it lands in: a quintic C1 at both ends (the horse study's
    `swingPath`), lifted by a bump peaking at 0.40 of the swing, the paw swung back to meet the ground;
  - THE BOUNCE: the heave integrated from the feet's half-sine forces (z'' = g·(ΣF − 1), two dips a stride), the
    trunk twisting between its girdles as the diagonals take the weight;
  - FOLLOW-THROUGH: the nod and the tail's swish as damped pendulums driven by the heave (the horse study's `NECK`),
    their frequency scaled to the leg;
  - THE CARRIAGE, the legs apart from the side: these bodies' arms were lengthened to reach the floor ahead, so they
    are long for the shoulders' height. Tipping the trunk up to stand the foreleg straight (the first cut, a hinge of
    57 to 60°) drew the forelegs back over the hind legs: on the round bodies they crossed. Leaning the trunk barely
    moves the shoulders forward (the shoulder stays about 0.22 of the height ahead of the hip at any hinge). So the
    trunk is tipped forward, near the all-fours pose (66 to 67°), until a standing foreleg, a COLUMN of `column` (0.97)
    of its arm, rakes `rake` (30°) ahead to the floor, and the hind stance is centred `back` (0.3 of the hip's height)
    behind the hips. From the side the forelegs clear the hind legs by 13 to 17% of the height in every key, where the
    raccoon's, the bear's and the pig's had crossed;
  - THE VAULT (the horse study's: a girdle over a stiff standing leg falls toward the ends of its stance): the trunk
    holds its lean, and the body as a whole rides over the standing foreleg (both girdles stand together in a trot).
    Its height is solved on the rig, key by key, where that foreleg is its column (the shoulder moves with its own
    arm's aim, so the arm is posed inside the solve), eased across the moments no forepaw stands, smoothed to the
    stride's low harmonics (`trotVault`) and given the bounce on top (`bounce` 1: a stylised 2.5 folded the foreleg
    to 73° at mid-stance). A standing foreleg's elbow stays at 29 to 41°. Tipping the trunk instead to hold the column
    rocked it 10° each step;
  - keyed at the packer's samples (12), so every packed frame is a key and nothing is blended between two;
    `mascot.trot` carries the cycle's seconds, ground speed, stride and duty.
  Every animal that goes on all fours trots (the leggy, barrel, wedge, pear and noodle silhouettes).
- **The standing walk, from the same mechanics** (the `walk` clip of every feature animal whose legs reach a stance,
  `FEATURE_WALK` in `feature-walk.js`). In this design language a slow walk is done on two legs and the trot on all
  fours is faster, so the walk is held under 0.7 of the animal's own trot: 0.35 to 0.45 m/s against the trot's 0.50
  to 0.68. It replaces the mascot walk on the feature style, which had 8 keys, a smoothstep swing that popped at lift-off
  and touchdown, and an energy's bob. The new walk has:
  - THE BEAT: the feet half a stride apart, each down 0.6 of it, both down twice a stride;
  - THE STRIDE: a person's stroll (Froude 0.15) at a cadence scaled to the leg by dynamic similarity (0.85 strides a
    second at a 0.9 m leg: a raccoon-sized mascot takes about 1.45). The stance is cut to what a near-straight leg
    reaches and to the trot's speed;
  - ONE GROUND: every planted foot slides back at the one ground speed, and the swing is laid C1 between stances (the
    trot's `swingPath`);
  - THE VAULT: the standing leg kept straight, as the style stands (its knee 13 to 19°, breaking to about 32° only to
    push off), the body riding over it. Solved on the rig as the least sink each standing leg needs, smoothed to the
    stride's low harmonics, its dips exaggerated (`bob`);
  - THE WADDLE: the body swung over the foot that bears it, an inverted pendulum driven by the feet's double-hump forces
    (the horse study's sway, MERKENS 1993's walk), so the wide-hipped round bodies sway furthest (about 6% of the
    height). The trunk leans over the bearing foot, the pelvis turns with the reaching leg and the chest against it;
  - FOLLOW-THROUGH: the arms swing against the legs, a little late, each turned about its own side so it still clears
    the belly; the head nods after the bob. The tail is as designed, since standing it is not carried;
  - keyed at the packer's 12 samples. `mascot.walk` carries the cycle's seconds, ground speed, stride and duty. The
    walk on all fours (`prowl`) still takes the mascot walk's paths.
- **The downward dog, facing forward** (a `downDog` clip, `FEATURE_DOG`, `dogOf`): the hips high, the hind legs as
  straight as the forepaws allow (bent only as far as they need to reach the floor), the trunk tipped past level and
  bent down at the waist (the rib ball under the pelvis ball), the forepaws straight out in front on the floor, the face
  looking ahead. A quadruped's spine and neck bend further than the human ranges the rig's limits are set for, so the
  pose takes them 1.4 times (`unbound`): the waist bends 35°, and the neck and the head turn the face forward from a
  chest pitched down. The spine is not curled (a curl tips the neck's root down past where the head can look ahead).
  Every animal that goes on all fours takes it. Where a big rib ball on short legs cannot get under the pelvis ball (a
  gorilla's), the fit lengthens the legs until it does.
- **The gallop** (a `gallop` clip, `FEATURE_GALLOP`), the run on all fours, the forward-facing dog its base:
  - the hind feet take the biped run's paths as a half-bound, the left a key behind the right, its sink and lift kept;
  - the waist rounds as the hind feet come forward under the belly (the gather) and opens as they push (the extension);
  - each forepaw goes from under the chest (a quarter of its reach, the elbow folded, solved by the law of cosines) to
    its full reach (the arm straight): swung forward through the air, lifted most at mid-swing, STRIKING the floor at
    full reach, then swept back along it under the chest;
  - the hind legs are tilted back: their feet half the run's fore-aft span behind its paths, so they drive from behind
    the hips;
  - THE STRIKE: at full reach the trunk tips forward over the hips (up to 20° more, `FEATURE_GALLOP.pitch`, as far as
    the chest clears the floor: `dogOf` `strike`), easing in and out: the front low on both forepaws, the rump raised,
    the head ahead;
  - THE VAULT, a key of its own after the strike (`FEATURE_GALLOP.vault`): the trunk tipped 10° further (the spine 30°
    down to the front), the weight on both forepaws alone, the hind legs unsupported and stretched out behind, the head
    still looking ahead;
  - THE LANDING after it, the second impact (`FEATURE_GALLOP.land`): still on both forepaws, the elbows bent 35° their
    natural way to take the weight (the body lowered only where the bent forelegs would not reach the floor), the head
    ahead (the paws' solve keeps the landing's own elbow). The gallop is the run's keys, the vault and the landing;
  - at the gallop's most forward lean, the vault and the landing, every animal's hind legs are STRETCHED OUT BEHIND
    (a `feet` target each, 0.95 of the leg's length from its hip, 20° under level, never nearer the floor than the
    vault's clearance: `landed`, solved on the rig) with the feet POINTED BACK (the ankle turned −70°, the toes −160°),
    and the tail RAISED 30° (`FEATURE_CARRIAGE.leap`), so the hind legs show under it, not hidden along it. The tail's
    base is kept LOW ON THE RUMP: a `rump` chain turns the whole tail about the pelvis ball's middle (a round rump's
    rearmost point is behind its middle however it tips), so on all fours, walking, galloping and in the dog the root
    sits 25° under the rump's rearmost point (`FEATURE_TAIL_RUMP`), however far the hips tip (the strike's and the
    vault's tip had carried it 25 to 35° up the back). The skin about the root rides a `rump` bone (from the ball's
    middle to the root: wholly within 20°, none past 70°, `FEATURE_RUMP`): a ball turned about its middle maps onto
    itself, so the junction slides round the rump with the tail, never stretched into a web. The brush tail has a NECK
    (its base slim, the thick of it held out from the rump), so tail and body read as a figure eight, pinched where they
    meet, never a keel run on from the back. A tail is never dragged: carried low, it is lifted until its middle and
    its tip clear the floor by 0.12 of the height (`FEATURE_CARRIAGE.clear`, room for a brush's thickness). A tail's
    rings follow the skin's weights among the tail's own two bones (the rump's and the pelvis's dropped), so they bend
    with it and never tear at the middle joint. The thigh's
    skin blends into the pelvis's over a narrow hip (`FEATURE_SKIN.hip`, 0.4 of the usual width), so the haunch swings
    with its leg. A raccoon's hind leg is barely longer than its hip's reach to the rump, so its shin and pointed foot
    show past the rump and no more;
  - galloping, every tail is held back near level for balance (`FEATURE_CARRIAGE.run`, −25° to 10°), whatever its
    walking carriage: a cat's tail is up at a walk and back at a run;
  - and straightened: the tail rides two bones (`tail` from its root to its middle, `tailEnd` from there to its tip, each
    turned by its own chain; a tuft tail cut in two at its middle, `halved`, the halves continuing one another), and at
    a run the far half is turned in line with the near half, so a curled tip (a cat's) lies out straight behind.
    Standing and walking, the tail keeps its designed curl;
  - the raccoon's tail rings never stretch: the ring pattern, a layer over the skin, rides the tail's bones rigidly (each
    band the bone it sits on: a band's `bone`, feature-coat.js), where it had taken the skin's weights and smeared across
    the blend at the tail's root; and the tail's skin blends into the rump over a short collar (`FEATURE_SKIN.collar`, a
    third of the usual width), so the skin under a ring moves with it;
  - a zebra's and a tiger's stripes stretch less on the run. They are cut into the skin, so they stretch where it does:
    under a striped coat the skin is FIRM (`FEATURE_SKIN.firm`: the blend between any two bones half as wide, the stretch
    kept near the joints) and each stripe's points commit to the bones they ride (`FEATURE_SKIN.stripe`: their weights
    to the 4th power, renormalised), so the plain coat between the stripes takes the stretch. The stripe area stretched
    or shrunk past 1.5×, measured on the posed skin: the zebra's 4.2 / 8.7 / 6.5% (the gallop's strike, the walk on all
    fours, the downward dog) to 3.0 / 4.3 / 3.3%; the tiger's walk and dog 10.2 / 8.6% to 6.7 / 6.6%, its gallop 4.8 to
    5.7% (most of it the neck turned up to look ahead, stretching the stripes that run up it). Averaging each stripe's
    weights whole was tried and tore the mesh: a band is a cut across the whole standing figure, so one band spans legs,
    arms, trunk and tail;
  - the hips tip no further than 80° (`FEATURE_GALLOP.hinge`: the dog's tip past level carries the tail's root up the
    back), so running, the tail comes out of the rump;
  - the tail is carried as on all fours.
- **The head looking ahead on all fours** (`FEATURE_LOOK`): each key of the pose, the walk on it and the gallop turns the
  head up from the pitched trunk until its crown tips 15° ahead of upright (the face ahead, a little down), the head
  taking most of the turn and the neck the rest (a neck pulled far back tucked the head into the shoulders), solved on
  the rig. The gallop had taken the dog's full turn and pointed every face up.
- **The forepaws planted on the rig.** A clip's arm aim is read partly in the bent trunk's frame, so an aim written as
  a world direction landed the paws behind and above the floor, and splayed. Each key on all fours is now solved on the
  rig (`planted`, `FEATURE_PAWS`): the paw reaches the floor ahead, the arm straight forward in the downward dog and a
  little out round the belly on all fours, a walk's swing kept.
- **The tail carried as its animal carries it.** The tail rides its own bones (`tail` and `tailEnd`, chains turned from
  its root and its middle). On
  all fours, the walk on them and the downward dog, it is turned until its line rises at the species' carriage, read
  off the fauna roster's tail stations (`speciesTail`: a wolf's low, a cat's up; absent, −15°). It is carried a quarter
  of the way back toward where the mascot's own tail would point, a compromise between the regular animal and the
  mascot (`FEATURE_CARRIAGE`). Standing, the tail is as designed. Its root sits low on the round of the rump, 75° under
  the pelvis ball's middle, where the pelvis tipped on all fours turns it into the rump rather than up the back, and
  the tail is drooped back about it (`FEATURE_TAIL`), so standing it sweeps out behind.
- **A face worn from another species** (`face` in `SPECIES_KIT`): its nose and its pale muzzle and belly, the roster's
  colours, over the animal's own coat. The house cat wears the tiger's: a dark nose over bright whisker pads, where
  its own pink nose and dull pads blurred into its grey.
- **Thigh : body : thigh as 1 : 4 : 1 from the front.** A standing four-legged animal (the pear, barrel, wedge, leggy
  and noodle silhouettes) is proportioned across its hips within the width its body had (`fronted`, `FRONT_RATIO` in
  `feature-silhouettes.js`):
  - the body narrows to four sixths of that width (across only, its side view kept; never widened), the shoulders and
    the belly's shapes with it;
  - each thigh takes a sixth, never thinner than a round full leg (`FRONT_RATIO.least`: a body too slim for 1 : 4 keeps
    that floor and reads a little thicker), tucked against the body: its middle at the body's side, half of it over the
    belly (`FRONT_RATIO.overlap`);
  - the legs toed in, `\| |/` from the front: each tapers to 0.6 of its thigh at the ankle (`FRONT_RATIO.ankle`, was
    0.75) with its inner edge kept straight down, so it leans in toward the other; the feet still point ahead. Before, the
    thighs sat inside the body's outline, so from the front a wide body stood on thin legs; the legs' radius follows
    the thigh's;
  - the family's breadth is counted, so the ratio is the drawn one. Side hips keep the thigh's breadth.
  - A coat cut into the skin (stripes, the giraffe's patches) has the skin simplified further first
    (`FEATURE_CUT_SHARE`), so the figure stays within budget. The narrower giraffe had gone 151 triangles over.
- **QA.** `scripts/spikes/feature-roster.mjs` takes `--tune` (every species minted with it) and `--tunes` (each species
  once per tune, side by side).
- **Stored mascots keep their look.** A minted mascot stores its compiled plan. An untuned sheet compiles anew on
  a new mint: the five families above, the round animals' side hips, the front's proportion and the straight stand. A tuned mint records its tune in `plan.mascot.tune` and reads it back.

**Gates.**

- Machine: `feature-tune.test.js` holds these laws:
  - validation;
  - absent means nothing;
  - the words are read in the feature style alone;
  - no tuning phrase is a mascot lexicon phrase;
  - each structure dial moves its own mass;
  - on a tuned quadruped the paws still reach and the trunk still clears the floor;
  - decoration at 0 is bare;
  - the family sizes multiply;
  - gen7's clumps, coverts, denser skin within budget, and its bake (none on the game model);
  - and, in `feature-grammar.test.js`, a standing bird's wing panel out of its body, its primaries not splayed, its beak
    broader than deep; its default face rolled bright, its resting lids and brows higher, its brows' clips unchanged;
  - a frog sitting on its own all fours (hands planted, webbed feet on its ankles, eyes on domes, its own muzzle);
    every plan's minted skin closed and in one piece, and every family's shapes attached (`feature-body.test.js`);
  - under a striped coat, the stripe's points loose (no bone over 0.8) less than half as often as the plain coat's;
  - a long neck slim under its raised head and turning at its top; a striped coat's stripes from the feet to under
    the jaw (rings on the legs, arcs from the spine to the belly above them, a cat's stopping short), and a giraffe's
    seeded network of patches in its own colour, both cut into the skin within the budget, the markings' dial still
    ruling them;
  - thigh : body : thigh as 1 : 4 : 1 from the front for one species of each standing silhouette, the thighs alongside the
    body, never thinner than a full leg;
  - side hips as designed: a round animal's hips on its ball's sides at its centre, its legs straight and toed in
    (the inner edge straight, the ankle leaning in, the foot ahead), its thigh a drumstick (deeper than broad, its end under the ball), its belly lower than the legs-below build's, the fit's rise less than half and the trunk's travel under 0.7 of it, on
    all fours the natural bend, the function holding, a silhouette that is no ball untouched; no standing clip bends a
    knee or widens the stance and the fours clip bends one (`feature-body.test.js`);
  - everyone on all fours can downward dog (one species per silhouette, chosen in code): the rib ball at least
    `FEATURE_DOG.bow` under the pelvis ball, the trunk clear of the floor, the forepaws reaching it; on the rig the
    forepaws on the floor straight ahead (no share to the side), the hind feet planted, the chest under the hips, the
    face ahead (`feature-body.test.js`);
  - the walk on all fours on the rig: each foreleg lifted a quarter cycle after its own side's hind leg, a paw in stance
    on the floor; the `run` of an animal on all fours is its gallop;
  - the trot, PLAYED as packed: every foot on the floor in stance and clear of it in swing, sliding back at the one
    ground speed; each forepaw down with the other side's hind foot, the diagonals half a stride apart; a standing
    foreleg's elbow under 45°; the body bouncing and the head nodding; from the side, the forelegs clear in front of
    the hind legs in every key, the trunk's hinge held and within 6° of the all-fours pose's; and from the front, in every key, each foot on
    its own side under its girdle, the head on the middle, its crown ahead of upright and its eyes looking forward;
  - a keyed clip sampled at a key poses as the key (its feet's targets and its waist kept): `station-loft-rig.clip.test.js`;
  - the standing walk, PLAYED as packed: slower than the trot; each foot on the floor in stance, clear of it in swing,
    sliding back at the one ground speed; the feet half a stride apart, both down twice a stride; a leg bearing the
    weight alone near straight (its knee under 25°), every knee bent forward and never out; the body rising and falling
    a little; and from the front, the body over the foot that bears it alone and never past it, each foot on its own
    side, the eyes looking forward; the arms swinging; the tail as designed;
  - the gallop on the rig: the run's cycle, the waist working, the forepaw travelling fore and aft and reaching the
    floor in some keys and through the air in others, the hind feet behind the hips, the face ahead and a little down in
    every key (never up), the tail's root at the rump (never up the back) and the tail held back near level and
    straight (its two halves in line), the tail's ring layer each point on one tail bone, a strike key, the front
    tipped low on both forepaws, after it the vault, tipped further on the forepaws alone, and the landing, the elbows
    bent; in both the hind feet stretched out behind, off the floor and pointed back, the tail raised; the tail's root
    25° under the rump's rearmost point in every key on all fours, the skin about it on the `rump` bone, the tail clear
    of the floor;
  - on all fours on the rig: the spine level, the tail carried at the roster's carriage less the mascot's share, and no
    standing clip turning the tail;
  - a rodent's buck teeth (none on the hedgehog), a chunky rodent's blunt face on whisker pads, a beaver's flat paddle on
    the ground, a tailless rodent tailless, a capybara's longer head and short coat;
  - a moose's flat palms (broad face to the front, points on the rim, not the deer's tines) and its big droopy nose
    (past the end of its face and hanging below it, dark nostrils), and a cat's pointed nose
    on pale whisker pads;
  - a horse's long face, flowing mane, forelock and hair tail, and a deer's antlers, side-set ears and pale chin, with
    the dials still ruling them;
  - a head tuft worn by every plan in place of the crown, each card's locks rooted in the skull and standing out of it,
    its size and colour, `none` and the crown's dial at 0 bare, and the brief's word.
- Eyes: not passed. Sheets were shot for the operator: game against gen7, and one species tuned several ways.

**Known.**

- The gen7 look is vertex-baked light and denser geometry. The fur has no normal map yet: the skin has no UVs.
