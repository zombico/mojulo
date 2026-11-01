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
9. **A default game model.** One smooth skin, a few layers and parts, a triangle budget (FEATURE_TRIANGLES), the
   whole shaded smooth by the field's normals.

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
| **squat** | an anuran (a frog, a toad) | wide and low, the head merged into the front, the hind legs folded big at the sides, the feet splayed out in front |
| **orb** | a whale, a dolphin (fish are not drawn in the style) | one egg, the face on its front, fins for limbs |
| **coil** | no legs (a snake) | a ring of loops on the ground, the body an S rising out of it, the head held out front |

**Birds stand as birds** (see Birds): the wings folded and prominent, round legs in their own colour, three toes
forward and one back; the head smooth unless its kit names a crest.

## Function

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

The pose it reaches (`foursOf`: the hinge, the hind legs' crouch, the shoulder's height against the arm's reach, the
clearance) becomes two clips: `fours` (dropping onto all fours, held, the head turned up to look ahead) and `prowl` (the
walk on all fours: the hind legs' own walk under the hinged trunk, the arms swinging against them, each forepaw angled
forward where the arm is longer than the shoulder is high). Birds, snakes and the orb are not quadrupeds.

## Birds

A bird is told by its own beak, its plumage and its wings, all read from the roster's realistic bird:

- **The beak** (`beakOf`, from the cranium's rows: its length against the skull, its length against its depth, its
  width against its depth, how far its tip curves down, how far its upper tip overhangs) is made by `beakParts`: an upper
  mandible bent by the droop and aimed down by the depth, a lower one tucked under it (shorter under a hook), or a flat
  egg where it is wider than deep (a bill). So a pigeon's is a short point, an eagle's a hook, a parrot's deep, a
  hummingbird's a needle, a toucan's huge, a duck's a bill.
- **The head matches the beak** (`headOf`): a hooked beak's head long and low under a brow ridge (a raptor's frown), a
  deep beak's big and round, a needle's small and sleek, a bill's broad and low, a beak longer than the skull a small
  head behind it.
- **The plumage** (`plumageOf`): the colours that read apart from the coat become its pattern: a crown of the head's own
  colour (a hood down the neck where the neck shares it: an eagle's white, a mallard's green), a neck band (a pigeon's
  green), the tail's tip (and the primaries where that is darker), wing bars (a value step of the coat's own greys), the
  legs and the beak.
- **The wings carry the silhouette.** Folded along the body and held a little out from it, so they read from the front
  as from the side: big panels in the wing's own tone (a value step off the coat), a scalloped row of secondaries, long
  primaries in the flight feathers' tone reaching past the tail. In the clips they stay folded, the elbow straight.
- **The side silhouette is golden.** The tail, the head and the body (the beak apart) fall as 1 : φ : φ²: the head is
  sized to the body's length over φ, and the tail's fan reaches past the body by the head's length over φ.

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
| **stander** (the raccoon's: a furred animal standing) | procyonid, ursine, rodent, mustelid, primate, canine, feline, leporid, macropod, monotreme | a long snout (canine) fights the football head; tall ears (leporid) and big feet (leporid, macropod) are the name; a naked tail (rodent) has no fur | the muzzle a module of its own length, joined to the football; ears and feet sized by the kit; a thin tail a smooth tapering cone, no tuft |
| **hoofed** (an ungulate standing) | equine, cervid, bovid, suid, giraffid, pachyderm | no hands to grip; long faces; the neck is the giraffe's name; a trunk; horns | hooves end the arms and legs (no fingers); the muzzle long; the long neck is kept against principle 3 (the name outranks the figure eight); the trunk a long curling tuft; horns, antlers and ossicones are pointy details (principle 4) |
| **bird** (a feathered animal standing) | avian, pterosaur, chiropteran | no muzzle; wings for arms; feathers, not fur | a beak (a cone, the mouth along it); its own silhouettes (teardrop, perch, wader); the wings folded on the sides, panels and primaries (see Silhouettes); the tail a feather fan; thin legs and toes; the head smaller and smooth |
| **reptile** (a scaled animal standing) | crocodilian, squamate, theropod, ceratopsian, hadrosaur, sauropod, thyreophoran, testudine | scales, not fur: no cheek ruff, no tufts; a heavy tail; a long snout or a beak; plates, frills, a shell | the pointy details become a dorsal row of spines in the same falling rhythm (plates on a thyreophoran, horns on a ceratopsian); the tail a thick tapering mass; the belly's scutes a strip; a shell a dome over the back; a snake, with no legs, rises from its coils |
| **orb** (an animal whose head is its body) | anuran, cetacean, chondrichthyan, teleost, pinniped, plesiosaur, cephalopod | no neck to pinch (principle 3); fins or tentacles for limbs; smooth skin | the head and the body one egg, the face on its front; the arms flippers (flat cones); the pointy details become fins (a dorsal fin, a fluke) and tentacles; an anuran's eyes ride on top |

Within each plan the kit modules are shared: a pointed ear is the same module on a fox and a raccoon, a beak the same
on a pigeon and a pteranodon. A family adds dials to its plan (a canine's longer muzzle, a leporid's bigger feet), and a
species' coat sets its palette and its pattern. Nothing is crafted per species unless its name demands it.

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
the operator's.
