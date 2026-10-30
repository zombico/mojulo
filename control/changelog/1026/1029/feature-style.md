### The feature style: animals made as feature animation makes them

A new mascot style, `feature`, beside toon and anime: the cartoon realism of feature animation's animals. It stays true
to the species in its details (its ears, its markings, its feet, its tail) and pushes its proportions toward appeal: a
big head sunk into one pear-shaped mass, haunches as big eggs, short limbs, paws held at the chest. Only the face's acting
zones are human: front-facing globe eyes with a white sclera, lids that act, and a smile line across the muzzle. The
brow is the coat's marking over the eye. It is routed to by a facet or a brief word (feature, stylized, cartoon
realistic), never by a new tool argument. The raccoon is the prototype; the squirrel, the rat, the mouse and the pigeon
follow.

- **The body is one skin of eggs.** Relations place points in the animal's frame, and an egg sits on each, riding a rig
  bone, its eggliness the share of its fat end. The eggs blend smoothly into one skin, netted along its surface, its
  normals from the field. The skin's weights come from the blend: a point belongs to the bones of the eggs it is made of,
  so a joint bends where its eggs meet.
- **The raccoon's proportions are the reference's.** The body is the dominant mass, a round egg about 2.4 heads across
  and 2.2 tall, wider than the head, sitting low on small dark feet turned a little out; the arms are short and chunky,
  the tail as big as the body. The cream belly is a designed zone, from under the chin to near the groin and widest low:
  a REGION egg, which colours a zone and does not shape the body. The head stands a little apart from the body for its
  silhouette: its cranium is a football, long front to back, and its lower volume (the jaw and the cheeks) is filled out
  round, so the head is a ball whose underside curves into the body: in profile a figure eight, the neck no more than
  the pinch where the two balls meet, and from the front an hourglass whose head's underside is a football lying across,
  the jowls carrying its points out and a little up, never drooping; where a head shape meets the rest they blend no softer than a SEAM, a crease under
  the jaw; the shoulders sit low and narrow enough for the cheeks' tufts to hang over them.
- **Round blobs, pointy fur details.** The masses are round, and where fur stands off them it ends in tufts: locks drawn
  as the realistic hair draws one, a rounded body tapering to a rounded point along a bending spine, melted into the
  skin at the root only so the point stays sharp. The cheeks end in a fan of them and the tail's brush ends in one.
- **Harmonious fur shape patterns, laid as thin layers.** A marking is designed with the head and its tufts, not
  dropped as an ink blot: the raccoon's mask sweeps out and down to a point aimed as its cheek's lock is, the pale brow
  is an arc ending toward the outer lock, the forehead's stripe tapers to the crown. It is laid on the skin as a thin
  layer of its own, like clothes: the skin under it refined, clipped exactly along its edge, lifted a hair, its edge
  walled so it has a thickness; its points stay on the skin's own faces, so the skin never stands through it. Its shape
  is drawn in a few strokes the way hair is combed (a root, a flow, a point), and a figure has a stroke budget.
- **The mouth is part of the muzzle.** A thin dark smile line lies on the skin, running from the nose's foot as the
  philtrum and out to two corners on their own bones, which lift in a smile and drop in a frown. The open mouth is a
  dark patch on the muzzle under the line, with the tongue at its foot. It is shut under the line at rest and opens
  downward about a pivot in the muzzle, most in the middle, into an oval. Nothing stands off the face.
- **Streamlined limbs and articulated fingers.** An arm is two round cones, shoulder to elbow to wrist, their radii
  meeting at the elbow. The raccoon's hands have five fingers fanned across the palm, each two links on two bones, with
  rounded tips. A small crown of spikes on the head's dome repeats the cheeks' rhythm, smaller.
- **The eye is a globe, and everything about it turns about the globe's centre.** The iris and the pupil are rings about
  the gaze. Each lid is a shell a little larger than the globe, its edge arched and rolled, and it closes by turning
  round the globe rather than dropping in front of it. The brow is attached to the eye: it lifts and tilts about the same
  centre, so a brow pressing down rides the lid it presses on. A coat's markings (the raccoon's mask, its pale brows) are
  painted on the skin.
- **The look is smooth and softly lit** by default: a warm key, a cool fill and a rim, a material per group and occlusion
  where masses meet. A faceted finish of the same skin is asked for. A creature takes `smooth: true` to be shaded as one
  smooth form on the page and in the lit export (absent, one shade per face as before); the plan takes a `mesh` part,
  given whole.

- **The principles are a converter.** `feature-grammar.js` holds them as numbers and applies them to any animal in the
  fauna roster: a species' mascot card in, a build out (docs/feature-style.md). Every build has STRUCTURE (the masses:
  the proportions and the silhouette, rigged) and DECORATION (the tufts, the crown, the markings, horns, spines, a mane,
  fins), each kind of decoration on a dial (`FEATURE_DECOR`: 1 the designed amount, 0 the structure bare) that never
  moves a mass. The 34 families fall into five BODY PLANS, each solving where the principles break: a stander (the
  raccoon's), hoofed (hooves for hands, a long face, horns as pointy details), bird (a beak, wings ending in a fan of
  primaries, feather crests), reptile (a dorsal row of spines in the tufts' rhythm, a heavy tail), orb (the head is the
  body; fins). A species' kit picks shared modules (ears, muzzle, tail, pattern, horns, mane, fin, shell, neck, eyes,
  feet), and its own measures from the roster size its ears, so a mouse's are big and round. The raccoon is one of its
  outputs. A roster sheet (`scripts/spikes/feature-roster.mjs`) mints one species per family, or a `--cast`, for the eyes
  gate.
- **Silhouettes vary across a cast, read from each species' body.** The fauna roster's realistic animal says how long
  its body is against its girth, whether the girth peaks in front or behind, how long its legs and neck are, and
  whether it has legs: from these a species is a pear (the raccoon), a wedge (a gorilla), a barrel (a bear), a noodle
  (an otter, a rat), leggy (a fox, a deer), a teardrop (an owl, a penguin), squat (a frog), a perch or a wader (a pigeon, a
  flamingo), an orb (a fish) or a coil (a snake rising from its loops), each its own masses, neck, legs and arms
  (docs/feature-style.md).
- **A belly is the species' own, never a default.** Where the roster's belly is the coat's colour there is none; where
  it is darker it is the same shape in its own colour; a family may name one the roster lacks (the raccoon's oval, a
  fox's bib). Its shape is the silhouette's: an oval, a bib, an underside strip, a bird's breast, a fish's
  countershading, a reptile's scutes, a penguin's tuxedo.
- **Birds stand as birds**: the wings folded on the sides as flat panels with the primaries fanned back along them,
  thin legs, three toes forward and one back, a smooth head unless the kit names a crest; in the clips the wings stay
  folded, stirring with the acting.

The aim is a good default game model: one smooth skin, a few layers and parts, and a silhouette and markings that read
at a distance, within a triangle budget (the raccoon is about 17,000 triangles, skin, coat and face together). The
mascot's clips play on it, each arm splayed out of the belly it would otherwise sink into.

New mascots made in the style take it. A stored mascot keeps its own look: a minted one stores its compiled plan, and a
stored sheet without the style reads as before.

- **Equivalently functional: a quadruped stands and drops onto all fours.** Its limbs keep the species' own proportions
  from the roster's skeleton (a rabbit's and a kangaroo's big hind legs stay big, an ape's arms stay long), its body's
  depth eases and its legs lengthen until its trunk clears the floor hinged level over its hips, and its arms reach the
  floor from there. Two clips play it: `fours` (onto all fours, the head up to look ahead) and `prowl` (the walk on all
  fours). A leg that shows is round and full, a mascot's, never a stick.
- **Each bird is its own bird.** Its beak is read from the roster's skull (a pigeon's point, an eagle's hook under a
  frowning brow, a parrot's deep beak, a hummingbird's needle, a toucan's huge one, a duck's bill) and its head matches
  it; its plumage is its own colours (a crown or a hood, a neck band, wing bars, dark flight feathers, its legs). Its
  wings carry its silhouette: big folded panels held a little out from the body, a scalloped trailing edge, long
  primaries past the tail, in their own tones, folded in every clip. Its side silhouette is golden: the tail, the head
  and the body as 1 : φ : φ².
- **No fish.** The style draws no fish: one asked for is drawn in the toon, and the sheet says so.

