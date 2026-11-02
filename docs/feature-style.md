# The feature style: the principles and the converter

Code: [control/lib/graph/egocube/feature-grammar.js](../control/lib/graph/egocube/feature-grammar.js) (the principles as
numbers, the body plans, the kit modules, the decoration dials: a species' card in, a build out),
[feature-body.js](../control/lib/graph/egocube/feature-body.js) (the build made one skin of eggs),
[feature-face.js](../control/lib/graph/egocube/feature-face.js) (the eyes, lids, brows and mouth),
[feature-coat.js](../control/lib/graph/egocube/feature-coat.js) (the markings),
[feature-silhouettes.js](../control/lib/graph/egocube/feature-silhouettes.js) (the structure's shapes and the bellies,
read from each species' body), [feature-function.js](../control/lib/graph/egocube/feature-function.js) (the limbs fitted
so a quadruped drops onto all fours), [feature-birds.js](../control/lib/graph/egocube/feature-birds.js) (a bird's beak,
head, plumage and golden side silhouette). The style draws no fish (`FEATURE_EXCLUDES`): one asked for is drawn in the
toon, and the sheet says so. The style is the mascot's third
(`style: 'feature'`, [mascot.md](mascot.md)): feature animation's animals, cartoon realism.

The raccoon was designed by hand against a reference sheet. These are the principles that made it work, written so a
machine can apply them to any animal in the fauna roster: a species' card (its family and its kit) goes in, a build
comes out, and the eyes gate judges the whole roster at once.

## Structure and decoration

Every build has two halves. They are designed separately and dialled separately.

- **Structure** is the masses: the body, the head, the limbs, the tail's mass. It carries the proportions and the
  silhouette, it is rigged, and it is never optional.
- **Decoration** is everything laid on the structure to tell the species and the character: the fur's tufts, the
  crown, the markings, the horns, the spines, the rings. Each kind has a dial (`FEATURE_DECOR`): 1 is the designed
  amount, 0 leaves the structure bare, more is bolder. A dial never moves a mass.

## The principles

1. **The animal's own body, one mass, in its own silhouette.** The body is the dominant mass, and its shape is the
   species' (see Silhouettes): the raccoon's is a pear, wider than the head (about 2.4 heads across and 2.2 tall),
   sitting low on small feet, about 3.3 heads tall, the legs all but hidden under the haunches, the arms short and
   chunky. A cast never repeats one figure eight for every animal.
2. **One skin of eggs.** Every mass is an egg (its eggliness the share of its fat end) or a round cone, blended into
   one closed skin. Weights come from the blend: a joint bends where its eggs meet.
3. **The head stands apart (the silhouette).** The cranium is a football, long front to back. Its lower volume (the
   jaw, the jowls) is filled out round, and the jowls angle out and a little up, never drooping. Where a head shape
   meets a body shape the blend is a tight SEAM, a crease under the jaw. The neck is only the pinch where the head's
   ball meets the body's. In profile that reads as a figure eight; from the front, as an hourglass.
4. **Round blobs, pointy details.** The masses are round. Whatever stands off them ends in points: tufts of fur,
   feathers, spines, horns, fins. Their RHYTHM is a fan of falling lengths (three locks: long, middle, short), each
   melted into its mass at the root only so its point stays sharp. The cheeks end in a fan that hangs over the
   shoulders; the crown has a smaller fan, asymmetric and swept one way; the tail ends in a point.
5. **Harmonious markings, not ink blots.** A marking is designed with the head and its points: its round parts follow
   the masses (a zone: the territory of the eggs, or a region egg that colours without shaping), and its points echo
   the tufts (a stroke aimed the way the nearest lock points). A figure has a stroke budget.
6. **Thin layers, like clothes.** A detail marking is a layer of its own over the skin, its edge its own geometry with
   a thickness, its points on the skin's own faces. A big zone is cut into the skin along its exact edge.
7. **The face acts as an animated face.** The eyes are globes turned front, a white sclera, a dark iris, a catchlight.
   The lids are shells that turn about each globe's centre; the brow is attached to the eye and turns about it too.
   The mouth is part of the muzzle: a smile line whose corners lift, an open mouth that opens down into an oval.
8. **Streamlined limbs, articulate hands, round legs.** A limb is two round cones meeting at the joint. Hands that grip
   have fingers, two bones each, fanned across the palm. In motion the arms are splayed out of the body they would sink
   into. A leg that shows is a mascot's, round and full (`FEATURE_PROPORTION.leg`; a bird's thinner, still round), never
   a stick.
10. **Equivalently functional.** The animal moves as its animal does: a quadruped stands up for the acting and drops
   onto all fours to move, so its limbs keep the species' own proportions (big hind legs stay big, an ape's arms stay
   long) and its body fits over them. See Function.
11. **Everything is attached.** Every shape (a mass, a tuft, a limb, a horn, a spine, a tail) is attached to the body
   or to something attached to it: two shapes are one where the gap between their surfaces is narrower than the skin's
   blend can bridge (`FEATURE_ATTACH.bridge` of the softer join; the seam's where a head shape meets a body shape). Once
   the build is laid out, a piece apart (a tail behind the rump, a dorsal spine above the back) is moved, whole, to the
   nearest attached shape and set into it by a margin: its design kept, only its place corrected
   ([feature-attach.js](../control/lib/graph/egocube/feature-attach.js); the plan records what moved, `mascot.attached`).
   The minted skin is one piece.
9. **A default game model.** One smooth skin, a few layers and parts, a triangle budget (FEATURE_TRIANGLES), the
   whole shaded smooth by the field's normals. The skin is CLOSED: where two sheets of the surface pass within a net cell
   (a crease under the jaw, a wing on its flank, an arm against the body) the net pinches, the pinch is let go and the
   hole it leaves is fanned shut on the surface (skin-net.js closeHoles), so no slit shows through.

## Silhouettes

The structure's shape is read from the species' own body in the fauna roster (`speciesMetrics`: the torso's length
against its girth, whether its girth peaks at the front or the back, the legs' and the neck's lengths against the
girth, whether it has legs at all), so a cast varies by data, not by hand. The order of the rules in `silhouetteOf` is
the decision. Each silhouette is its own set of masses, its neck, its legs, its arms' direction, its tail's anchor, the
line of its back (where spines run) and the shapes a belly takes on it.

| Silhouette | Read from | The shape |
|---|---|---|
| **pear** | girth peaking at the back (a raccoon, a squirrel, a rabbit) | the body the dominant mass, low and rear-heavy; the head a ball on it, a figure eight |
| **wedge** | girth peaking at the front (a gorilla, a boar, a moose) | the chest and shoulders the mass, small hips, thick arms, the head forward and low |
| **barrel** | even girth (a bear, a bull, a hippo, a turtle) | one round mass, short thick legs showing, broad shoulders |
| **noodle** | long and low, or upright already (an otter, a rat, a meerkat, a crocodile) | a tall slim tube, a visible slender neck, a small head, short limbs |
| **leggy** | long legs (a fox, a deer, a horse, a cat) | a compact body raised high on two-cone legs, a visible neck, slender arms |
| **teardrop** | an upright bird, a pinniped (an owl, a penguin, a seal) | one egg fat at its foot, the head merged into its top, short wings or flippers at the sides |
| **perch** | a standing bird (a pigeon, a crow, an eagle) | the body tilted forward, the breast puffed, a visible neck, wings folded on the sides, thin legs and toes |
| **wader** | a long-legged or long-necked bird (a flamingo, an ostrich) | a small body high on stilts, a long neck |
| **squat** | an anuran (a frog, a toad) | a SITTER: a wide pear on its folded hind legs (each thigh forward along the side, the shin back under it, the long webbed foot forward from the ankle, its toes ending in round pads), the head wide, flat and merged into the top, big eyes bulging on domes on it, the mouth's line right across the face over a pale throat, thin arms with padded fingers planted in front. Its sitting pose is its own all fours: it is not fitted to drop onto them |
| **orb** | a whale, a dolphin (fish are not drawn in the style) | one egg, the face on its front, fins for limbs |
| **coil** | no legs (a snake) | a ring of loops on the ground, the body an S rising out of it, the head held out front |

**From the front a standing animal reads THIGH : BODY : THIGH as 1 : 4 : 1** (`fronted`, `FRONT_RATIO`), within the
width its body had: the body narrows to four sixths of it (across only; never widened), each thigh takes a sixth (never
thinner than a round full leg, `FRONT_RATIO.least`: a slim body keeps that floor), tucked against the body: its middle
at the body's side (`overlap`), half of it over the belly, so the legs fall partly in front of the body, never from
inside its outline. The legs are TOED IN, `\| |/`: each tapers to `ankle` of its thigh with its inner edge straight
down, so it leans in toward the other, and the feet still point straight ahead. The family's breadth (`FAMILY_TUNE` `body`) is counted.

**Every silhouette is rounded** (`rounded`, `FEATURE_ROUND`): the style's animals are bottom-heavy and round, so the
lower masses (the belly, a pear's front, the haunches, a snake's coils) are fuller across and deep, the chest a little
slimmer, a leg that shows full at the thigh, every mass rounder (less pointed) and blended softer. The belly's shapes
follow. It is applied before the function fits the body, so the all-fours fit still holds.

**Birds stand as birds** (see Birds): the wings folded and prominent, round legs in their own colour, three toes
forward and one back; the head smooth unless its kit names a crest.

## Function

**Side hips (as designed; `tune.hips: 'below'` for the old way).** A round animal (the pear, the barrel) on legs from
the bottom of its ball pivots the whole ball about a point near the floor when it drops onto all fours: it swings forward
and down, and the fit must lengthen the legs to clear it. Its hips are on the SIDES of the ball at its centre's height
instead (`sideHips`), so the ball pitches about its own centre and rolls in place: the fit raises the legs about a third
as much, the trunk's centre travels about half as far, and the belly sits low, about half as high off the ground. From
the side each thigh is a DRUMSTICK (`SIDE_HIP_DRUM`): much deeper than it is broad (the front's 1 : 4 : 1 untouched),
round at the hip, tapering to a low knee, so its round end shows under the ball.

**Standing straight, on all fours bent.** Standing, the legs are straight: the knee and the ankle under the hip
(`SIDE_HIP_REACH` 0), and the standing clips (the idle, the blink, the wave, the faces) bend no knee and keep the feet
under the hips (`straightened`).
On all fours the hind legs keep their natural bend (`FEATURE_FOURS.natural`): the fours pose starts at that crouch, and
the fit counts the hips that much lower when it clears the trunk.

The fauna roster's skeleton gives each species its limbs (`speciesLimbs`: the fore and hind legs' chained lengths, the
hind against the fore, the hind foot against the hind leg). `functional` fits the silhouette to them:

1. **The species' proportions.** Big hind legs (the hind more than `FEATURE_FOURS.big` times the fore: a rabbit, a
   kangaroo, a frog) grow their haunches, their legs' girth and their feet, and stand a little taller; a fore longer
   than the hind (an ape's) lengthens the arms.
2. **The trunk clears the floor.** Hinged level over the hips, the trunk's lowest point may brush the floor by
   `FEATURE_FOURS.brush` at most. The body's depth (front to back only, never its width: the front view keeps its round
   read) is eased first, then the legs are lengthened to the hip height it needs.
3. **The forepaws reach the floor.** The arms are lengthened until they reach it from the shoulders: over a level back
   on straight hind legs, or, on big hind legs, with the hind legs folded under it.

The pose it reaches (`foursOf`: the hinge, the spine's curl and the waist's bend, the hind legs' crouch, the shoulder's
height against the arm's reach, the clearance) becomes two clips: `fours` (dropping onto all fours, held) and `prowl`
(the walk on all fours: the hind legs' own walk, the arms swinging against them). Birds, snakes and the orb are not
quadrupeds.

**On all fours as a regular animal.** The trunk is TWO BALLS, a rib ball over the waist on the torso and a pelvis ball
under it on the pelvis, so it bends at the waist as an animal's does: the hips tip (`FEATURE_FOURS.hinges`), the spine
curls and the core bends at the waist (`curl`, `waist`: the rig's `waist` pose word), so the spine runs level from the
hips to the neck's root, and the head is carried out in front of the chest looking ahead. The forepaws are solved on
the rig itself (`FEATURE_PAWS`): the paw on the floor ahead of the shoulder. The tail rides two bones (root to middle, middle to tip) and is CARRIED
as its animal carries it (`FEATURE_CARRIAGE`): turned on all fours until its line rises at the species' carriage off
the fauna roster, a quarter of the way back toward the mascot's own; standing, it is as designed.

**The walk on all fours, and running on them** (`FEATURE_GAIT`): each foreleg plays its own side's hind foot's cycle a
quarter of a cycle later (`prowl`: a four-beat lateral sequence, left hind, left fore, right hind, right fore); a paw in
stance on the floor, in swing lifted; the head ahead, the tail carried. An animal that goes on all fours runs on them:
its `run` is the gallop; upright it only walks, slowly.

**The trot** (`trot`, `FEATURE_TROT` in `egocube/feature-trot.js`) is laid out as the horse study solves its gaits, made
dimensionless so a round body on short legs trots as its own legs let it. The beat is a two-beat diagonal (each hind a
moment before its fore). The stride is the reference horse's trot at one Froude number (`froude`), scaled to this hip
by dynamic similarity and cut to what the shorter pair of legs reaches: short legs take short, quick steps. Every
planted foot, fore and hind, slides back at ONE ground speed, so nothing skates. The swing is laid C1 between the
stance it leaves and the one it lands in (a quintic, plus the stance's own speed at each end), lifted by a bump that
peaks early. The body's bounce is integrated from the feet's forces (`bounce` its exaggeration), and the trunk twists
between its girdles. The head nods and the tail swishes after the bounce, as damped pendulums. From the side, the legs stand apart. The trunk is tipped forward (near the all-fours pose) until a standing foreleg, a
COLUMN `column` of its arm, rakes `rake` degrees ahead to the floor. The hind feet stand `back` behind the hips, and
the trunk holds that lean. The body as a whole VAULTS over the standing foreleg (the horse study's vault: both girdles
stand together in a trot), solved on the rig and smoothed to the stride's low harmonics, so the elbow never folds
under the weight and the trunk never rocks. Keyed at the packer's samples, so every packed frame is a key. `mascot.trot` carries its cycle's seconds
and ground speed.

**A keyed clip plays its keys.** Packed, a clip is blended between its keys (`layeredClip`). A `feet` target is
blended as a point and the waist's bend survives the second resolve. Before, played or exported, a keyed gait's feet
never stepped and a pose on all fours lost its waist.

**Everyone can downward dog, facing forward** (`downDog`, `FEATURE_DOG`): the hips high, the hind legs as straight as
the forepaws allow, the trunk bent down at the waist (the rib ball under the pelvis ball), the forepaws straight out in
front on the floor, the face looking ahead. A quadruped's spine and neck bend further than the human ranges the rig's
limits are set for, so the pose takes them `unbound`. It is the two-ball trunk's test, and the GALLOP's base
(`gallop`, `FEATURE_GALLOP`): the hind feet take the biped run's paths as a half-bound, the waist rounds at the gather
and opens at the extension, each forepaw swings forward through the air from under the chest (the elbow folded),
strikes the floor at its full reach (straight) and sweeps back along it, the hind legs tilted back to drive from behind
the hips, the face ahead, the tail held back near level for balance and straightened (its far half, on its own bone
from the tail's middle, turned in line with the near half). At the strike the trunk tips forward over the
hips: the front low on both forepaws, the rump raised. Then the VAULT (`FEATURE_GALLOP.vault`): tipped further, on the
forepaws alone, the head still ahead. Then the LANDING (`FEATURE_GALLOP.land`): still on the forepaws, the elbows bent
their natural way to take the weight. In both the hind legs are stretched out behind with the feet pointed back and the
tail raised, so the legs show under it; the haunch swings with its leg (`FEATURE_SKIN.hip`). On all fours, however far the hips tip,
the tail leaves the LOWER RUMP (`FEATURE_TAIL_RUMP` under its rearmost point): a `rump` chain turns the whole tail about
the pelvis ball's middle and the skin about the root rides the `rump` bone, so the junction slides round the ball. The
brush tail has a neck, so tail and body read as a figure eight, never a keel off the back; no tail drags on the floor. Running, the hips tip no further than `FEATURE_GALLOP.hinge`, so the tail comes out of the
rump. On all fours, walking and running, the head is turned up until its crown tips `FEATURE_LOOK.tilt` ahead of upright,
the head taking most of the turn so it is never tucked into the shoulders.

## Birds

A bird is told by its own beak, its plumage and its wings, all read from the roster's realistic bird:

- **The beak** (`beakOf`, from the cranium's rows: its length against the skull, its length against its depth, its
  width against its depth, how far its tip curves down, how far its upper tip overhangs) is made by `beakParts`: an upper
  mandible bent by the droop and aimed down by the depth, a lower one tucked under it (shorter under a hook), or a flat
  egg where it is wider than deep (a bill). So a pigeon's is a short point, an eagle's a hook, a parrot's deep, a
  hummingbird's a needle, a toucan's huge, a duck's a bill. Every beak is BROAD at its root (`FEATURE_BEAK.broad`): a pair
  of side mandibles stands out from the middle of each mandible and converges on its tip, so from the front a beak reads
  as a wedge and never a spike, and in profile it keeps its own shape. The breadth is capped by the beak's length
  (`broadOfLen`), so a short deep beak (an owl's) stays a beak and never a band across the face; a bill is broadened too.
- **The head matches the beak** (`headOf`): a hooked beak's head long and low under a brow ridge (a raptor's frown), a
  deep beak's big and round, a needle's small and sleek, a bill's broad and low, a beak longer than the skull a small
  head behind it.
- **The plumage** (`plumageOf`): the colours that read apart from the coat become its pattern: a crown of the head's own
  colour (a hood down the neck where the neck shares it: an eagle's white, a mallard's green), a neck band (a pigeon's
  green), the tail's tip (and the primaries where that is darker), wing bars (a value step of the coat's own greys), the
  legs and the beak.
- **The wings carry the silhouette, in profile above all.** Folded close along the flank and STANDING PROUD of it
  (`FEATURE_PROPORTION.wingProud`, thick panels: `wingThick`), so the folded wing is a broad shape of its own on the
  body's side, its edge shadowed, never a patch sunk into the flank: big panels in the wing's own tone (a wide value step
  off the coat, `WING_STEP`), a scalloped row of secondaries, and long primaries in the flight feathers' tone reaching
  past the tail. The hand turns at the wrist to lie back along the body (`tipLean`: the primaries keep little of the
  fold's outward lean), its panel and its primaries in one plane, so the tip never splays sideways from the front and no
  feather grazes the panel it springs from (a feather passing within a net cell of a panel tears the skin). In the clips
  the wings stay folded, the elbow straight.
- **A bird rests open and bright.** Its face is its eyes and brows alone (a beak has no smile), and its eyes sit round
  the sides of its head, where a brow laid as a mammal's wraps down and back over the globe and the lid sits heavy: any
  face reads sad and droopy. So the bird plan has its own resting face (`BIRD_REST`, the eye's `rest`: feature-face.js):
  the upper lid's open edge higher, the brow higher off the lid and its outer end lifted, moved for every expression alike
  (the channels are differences from the rest, so the clips play the same; the lid's shut edge is kept, so a blink still
  meets the lower lid). Its lids take its head's colour where its head is a crown of its own (no dark bags under an
  eagle's eyes). And a feature bird whose face is not asked for rolls a bright one (`FEATURE_BIRD_LEAN` in mascot.js:
  happy and grin, rarely determined, sad or sleepy); an asked face wins.
- **The side silhouette is golden.** The tail, the head and the body (the beak apart) fall as 1 : φ : φ²: the head is
  sized to the body's length over φ, and the tail's fan reaches past the body by the head's length over φ.

## Stripes and patches

A `stripes` coat (a zebra's, a tiger's) is worn as a body wears it (`FEATURE_STRIPES`). Each stripe starts at the SPINE
(on an animal standing up, the middle of its back), runs round each flank and ends in a point at the belly: widest at the
spine, holding its width down the flank and pinching late (`taper`). A zebra's points meet under it in chevrons
(`end` 180°); a cat's stop short of its pale belly (FAMILY_TUNE `stripes`: end 140°, thinner). Over the legs a stripe is
a ring round them. The stripes go from the feet up the neck to just under the head, never across the face; their widths
fall in rhythm, each leans a little the other way from the last, and their edges are notched.

A `reticulated` coat (a giraffe's) is a NETWORK of patches (`FEATURE_NETWORK`): seeds on a jittered lattice (seeded
dice), each point of the skin the patch of its nearest seed, the patches parted by thin lines of the coat. The patches
are in the coat's own darker colour from the roster (the `Spot` group), never a mask's near-black; they cover the body,
the legs and the neck to under the head.

Both are CUT into the skin as zones (a big marking is: principle 6), so they cost only the faces their edges split, and
their sizes are set so a striped or patched animal stays within the triangle budget.

## Bellies

A pale belly is a species' feature, never a default. The roster's belly colour against its coat decides
(`BELLY_CONTRAST`): an animal whose belly is its coat's colour has none (a bear, a horse, a crow); a belly darker than
the coat is the same shape in its own colour (a badger, an elk); a family may name a belly the roster lacks (the
raccoon's oval, a fox's white bib, a cat's underside). Its shape is the silhouette's (`BELLIES`):

- **oval**: a designed egg low on the front (the pear, the barrel, the teardrop);
- **bib**: the chest alone (the wedge, a fox);
- **underside**: a strip from the groin up the front to a bib under the chin (the noodle, the leggy);
- **breast**: a bird's puffed breast (the perch, the wader);
- **countershade**: the whole underside (the orb);
- **scutes**: a reptile's belly strip;
- **tuxedo**: the whole front (a penguin's pattern).

## How the families break the principles, and what solves it

The roster has 34 families. They fall into five BODY PLANS; within a plan, a family is a few dials and its species'
kit chooses the decoration modules (ears, muzzle, tail, pattern, horns, mane, spines, shell, fin, neck, eyes, arms,
feet). The principles hold everywhere; what breaks is named here with its solution.

| Plan | Families | What breaks | The solution |
|---|---|---|---|
| **stander** (the raccoon's: a furred animal standing) | procyonid, ursine, rodent, mustelid, primate, canine, feline, leporid, macropod, monotreme | a long snout (canine) fights the football head; tall ears (leporid) and big feet (leporid, macropod) are the name; a naked tail (rodent) has no fur | the muzzle a module of its own length, joined to the football; ears and feet sized by the kit; a thin tail a smooth tapering cone, no tuft; a cat's `feline` muzzle: a bridge from the brow, pale whisker pads and chin, an inverted triangle of a nose; a rodent's buck teeth (`teeth: 'buck'`, the roster's tooth colour); a chunky rodent's `blunt` muzzle (a broad snout, pale whisker pads, a small nose), a capybara's boxy `capybara` muzzle, a beaver's `paddle` tail lying on the ground, a groundhog's bushy `stub`; a species' own tuning in `SPECIES_TUNE` |
| **hoofed** (an ungulate standing) | equine, cervid, bovid, suid, giraffid, pachyderm | no hands to grip; long faces; the neck is the giraffe's name; a trunk; horns; a horse is its face, mane and tail, a deer its antlers and ears | hooves end the arms and legs (no fingers); the muzzle long; the long neck is kept against principle 3 (the name outranks the figure eight): slim, tapering up to the raised head, its base no wider than the shoulders, the head turning at its top (the rig's neck bone spans it); the trunk a long curling tuft; horns, antlers and ossicones are pointy details (principle 4). A family's own modules come through its tuning's kit (`FAMILY_TUNE` `kit`): a horse's `equine` muzzle (a long face down to a soft nose, dark nostrils), its `flow` mane (locks from the poll to the withers falling to one side, a forelock) and `horse` tail (long hair in the mane's colour); a deer's `antlers` (a beam curving forward, three tines), `deer` ears (big, out to the sides) and `cervid` muzzle (a narrow snout, a black nose, a pale chin); a moose's `palmate` antlers (a broad flat palm each side held up like an open hand, its face to the front, points on its rim) and `moose` muzzle (a long face ending in a big bulbous nose drooping past the lip, dark nostrils on its front) |
| **bird** (a feathered animal standing) | avian, pterosaur, chiropteran | no muzzle; wings for arms; feathers, not fur | a beak (a cone, the mouth along it); its own silhouettes (teardrop, perch, wader); the wings folded on the sides, panels and primaries (see Silhouettes); the tail a feather fan; thin legs and toes; the head smaller and smooth |
| **reptile** (a scaled animal standing) | crocodilian, squamate, theropod, ceratopsian, hadrosaur, sauropod, thyreophoran, testudine | scales, not fur: no cheek ruff, no tufts; a heavy tail; a long snout or a beak; plates, frills, a shell | the pointy details become a dorsal row of spines in the same falling rhythm (plates on a thyreophoran, horns on a ceratopsian); the tail a thick tapering mass; the belly's scutes a strip; a shell a dome over the back; a snake, with no legs, rises from its coils |
| **orb** (an animal whose head is its body) | anuran, cetacean, chondrichthyan, teleost, pinniped, plesiosaur, cephalopod | no neck to pinch (principle 3); fins or tentacles for limbs; smooth skin | the head and the body one egg, the face on its front; the arms flippers (flat cones); the pointy details become fins (a dorsal fin, a fluke) and tentacles; an anuran's eyes ride on top |

Within each plan the kit modules are shared: a pointed ear is the same module on a fox and a raccoon, a beak the same
on a pigeon and a pteranodon. A family adds dials to its plan (a canine's longer muzzle, a leporid's bigger feet), and a
species' coat sets its palette and its pattern. Nothing is crafted per species unless its name demands it.

## Tuning

The grammar makes each species as designed; the TUNE ([feature-tune.js](../control/lib/graph/egocube/feature-tune.js))
is the operator's hand on that model sheet, by the two halves above and a detail tier. It rides the mascot sheet
(`rollMascot({ tune })`, `create_character({ as: 'mascot', spec: { facets: { style: 'feature', animal }, tune } })`), so
every door that compiles a sheet carries it. Absent, nothing runs: the sheet carries no tune and the build is the
designed one.

```js
tune: {
  structure: { head, girth, legs, arms, hands, feet, tail, ears, muzzle, eyes, neck },   // multipliers, 1 as designed (FEATURE_TUNE: each one's range)
  decoration: { tufts, crown, markings, horns, spines, mane, fins },                     // 0 – 3, 1 the designed amount, 0 bare
  tuft: 'mohawk' | { style, colour?: 'coat' | 'pale' | 'dark' | 'hair' | '#rrggbb', size? },  // the head's tuft (HEAD_TUFTS)
  detail: 'game' | 'gen7',                                                                // FEATURE_DETAIL
}
```

- **Structure moves masses by their own rule.** The head grows about its seat (its jaw kept on the neck), its muzzle,
  ears and tufts with it. The girth widens and deepens the trunk about its axis, the shoulders, the hips and the limbs'
  radii following. The tail, the ears and the muzzle grow as modules from their roots. The neck raises the head over a
  stretched neck; a head merged into its body has none to stretch.
- **The function outranks an ask.** A quadruped's `legs` and `arms` are handed to the all-fours fit (Function) as asks:
  the hips at that share of the height the fit made them, the arms at that share of their reach, as far as the floor
  allows. Shorter than the floor allows, the fit keeps them, and the build says which (`tune.notes`). A tuned girth
  (a deeper trunk standing higher) lets the arms grow as far as reaching the floor needs.
- **Decoration never moves a mass** (Structure and decoration, above).
- **The head's tuft** ([feature-tufts.js](../control/lib/graph/egocube/feature-tufts.js)): a look for the top of the head,
  the most personal touch a cast has, worn by ANY animal of the style (furred, feathered, scaled or smooth) in place of
  its designed crown: `swept` (the designed fan), `cowlick`, `mohawk`, `spikes`, `crest`, `plume` (a quail's topknot),
  `fringe`, `mop`, `pompadour`, or `none` (bare). A look is a CARD of locks placed on the skull by angle (θ down from the
  top, φ round from the front), so it sits on any head the grammar makes and grows with a tuned head; a new look is a
  card, not code. Its colour is the coat's, its pale, its dark, its hair's, or a hex of its own; its size a multiplier;
  the crown's decoration dial still rules it (0: none).
- **The words.** A brief says the same: `big ears`, `big head`, `long legs`, `lanky`, `chubby`, `bushy tail`, `long
  snout`, `fluffy`, `shaggy`, `sleek`, `plain coat`, and the tufts' `mohawk`, `cowlick`, `crested`, `topknot`, `bangs`,
  `pompadour`, `quiff`, `spiky hair`, `mop top` (`TUNE_LEXICON`); the tier `7th gen`, `ps3`, `xbox 360`, `hd era`,
  `hero model` (`DETAIL_WORDS`). They are read only in the feature style; a tier's word asks for the style, and so does an
  explicit `tune` (refused under another named style). No tuning phrase is one the mascot's own lexicon owns.
- **The families' designed sizes** (`FAMILY_SIZES`): where a family's animals read off on the shared silhouettes (a
  bear's head lost on its barrel, a canine's face too short for its name), its structure dials are set as designed, and
  the operator's multiply over them.

### The detail tiers

| Tier | The skin | The decoration | The light |
|---|---|---|---|
| **game** | a default game model: net cell 7.5 mm, 8,500 faces simplified, the figure within 18,000 triangles | as designed | the lit export's own |
| **gen7** | a hero model of the seventh console generation's HD era: cell 5.8 mm, 16,000 faces, the figure within 34,000 triangles | the secondary clumps: a fuller cheek fan, two more crown locks, tufts at the shoulders, elbows and haunches, a ruff under a visible neck, a brush tail's fanned tip; a wing's coverts; a scaled back's second row | baked into the corners (surface-bake.js, inline finishes `DETAIL_FINISH`): occlusion, a sky light, warm fur, wet eyes and nose, polished horns, hooves and beaks; every lit export carries it |

The tier's clumps are pointed details like the designed ones (round blobs, pointy details), so the decoration dials
rule them too: `tufts: 0` leaves a gen7 model's fur as bare as a game model's. What the tier does not do yet: a normal map
for the fur (the skin has no UVs to carry one).

## QA

The converter is judged by the whole roster, not one species at a time: `control/scripts/spikes/feature-roster.mjs`
mints one species per family (or a `--cast` of species, one per silhouette) and lays the front and the side of each out
on one sheet, each labelled with its silhouette. The machine gate is the laws
in `feature-body.test.js` (one species per plan: one skin, within the budget, the decoration dials at 0 leaving the
structure bare, the arms clear of the body) and `feature-grammar.test.js` (one species per silhouette: every
silhouette cast from the roster and each a different set of masses; a belly only where the species has one; a standing
bird with folded prominent wings, toes and round legs; a quadruped's all-fours pose for one species per silhouette,
the paws reaching and the trunk clearing, big hind legs kept big; a bird's φ side silhouette, its own beak, its
plumage; no fish). `feature-roster.mjs --takes idle,fours` shoots the cast standing and on all fours. The eyes gate is
the operator's. `--tune '<json>'` mints the whole cast with one tune, and `--tunes '[{"label":"game"},{"label":"gen7","tune":{"detail":"gen7"}}]'`
shoots each species once per tune, side by side. The tune's laws are `feature-tune.test.js`.
