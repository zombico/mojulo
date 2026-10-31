### The muscle shirt: a flat body puts it on and its muscles show up (the Saikyo body)

A muscle depiction study on the anime frame. The muscles are a wearable layer, the fourth wearable library beside
footwear, handwear and plating (`control/lib/graph/musculature/`: card → passes → laws → adapter): a tree of muscle
masses authored on the wearer's joints, seated on the wearer's own skin, and the skin carried out to their smooth union.
The wearer keeps its frame and proportions; where no muscle reaches, its skin does not move. One dial runs from FORM
exaggeration (a few key shapes in bodybuilder proportions, as the 3D bodies of David Production's JoJo openings) to
DETAIL exaggeration (every muscle separated, the harmony made by the shadows they collect, as Tekken's), through a
fractal articulation of the big groups. The eyes gate is the operator's.

- **The hero door's `muscleShirt`** (a card word, `'saikyo'`, or `{ card, definition, groups }`): on the lofted body
  (the tiered hero, the anime head's among them); refused on the realistic body, whose muscles are its physique. Stored
  as given; a hero without one is as it was, byte for byte.
- **The Saikyo card** (`cards.js`): hulking but lean on the anime frame, first on the large cast (Z-Fighter's male).
  Thirteen groups (the chest, the core, the flank, the back, the trapezius, the seat, the deltoid, the biceps, the
  triceps, the forearm, the quadriceps, the hamstrings, the calf), each by level: 0 its silhouette in a few shapes, 1 its
  muscles, 2 their heads (the pectoral's fans, the eight blocks of the rectus, the serratus's fingers, the deltoid's
  three heads, the biceps' two, the triceps' horseshoe, the teardrop over the knee, the calf's diamond). A trunk mass is
  seated by its height up the torso bone and its azimuth, a limb's by its share down the bone and its azimuth round it;
  each stands `proud` of the skin, in the wearer's half biacromial.
- **The definition dial** (`definition`, 0 … 1; `principles.js`): level 0 grown at the form end; level 1 rising out of
  its parent over the first half, level 2 over the second, each parent sunk under its children as they come, so the
  silhouette holds; every level's blend tighter toward the detail end, the finest a little prouder. A group may be held
  at its own definition (`groups: { core: 1 }`).
- **The passes** (`passes.js`): each body shell re-sampled at the shirt's grain (about a centimetre) on its own smooth
  cage, its bind's shares carried as the form field's re-sampling carries them, the left limbs mirrored from the right;
  each mass seated where a ray from the bone leaves the skin; each point carried out along its ring's ray to the smooth
  union of the skin and the masses its part wears (a compact smooth minimum: past every mass's reach, exactly the skin).
  The pectoral layer is taken off (the chest group is the chest). The whole shirt costs well under a second.
- **Shells that overlap** (`adapters/loft.js`): where two shells land on the same muscle, the one that should not show
  is tucked a few millimetres in, as far as the shirt moved it (the torso and the limbs show; the neck, the pelvis, the
  thigh and the joints' bridging shells under them), and every shell's ends dive under their neighbours: the two had
  z-fought in stripes, and each shell's end stood as a rim. A limb's muscles are worn by the segment across its joint
  too, so both sides of the elbow and the knee follow one bulge.
- **The shoulder's top closed in a dome**: the shoulder's drum, its web and the arm's top ended in flat fans the shirt
  never moved, a box under the deltoid; the ends that show are closed in rings to the pole (along the part's axis, to
  70°, since the compiler winds a shell by its first band) and worn like the sides.
- **The hands follow the arms** (the operator's): each hand, its digits and their joints scaled about the wrist by three
  quarters of the forearm's growth in girth (about 1.3 on the Saikyo body), so the fingers still turn in their knuckles;
  the wrist's bridge eased from the forearm's scale to the hand's (grown whole, it stood as a cuff). A card may name its
  own scale (`hands`).
- **The chest at the detail end, rounded** (the operator's): the pectoral's heads at level 2 are a full belly low and
  in, a lower border that curves up gently and ends short of the armpit, an upper band and a round outer corner; the
  fans that had reached out to the armpit converged there in a triangle.
- **Nipples, a setting** (`nipples: true`, off by default): marks on the chest the muscles made, seated where a ray
  from the trunk's axis leaves the displaced chest and worn after the muscles, an areola and a papilla under their own
  tight blend, sized to read at the shirt's grain (one under it barely moved a point).
- **The feet follow the legs**: each foot (the shoe's two boxes, or the bare foot and its toes) and the toes' joints
  scaled about the ground under the ankle by three fifths of the shank's growth in girth (about 1.18 on the Saikyo
  body), so the sole stays on the ground. A card may name its own scale (`feet`).
- **The shoulder's cap** (with the anime frame's clavicle below, the shoulder's drums stood above the shoulder's line):
  the deltoid's crown seated above the joint on a steep ray, so the arm's dome is carried up over the shoulder as a
  round cap, its heads seated higher so no waist shows under it; the web's and the drum's tucks taken whole (they lie
  under the arm's skin, and still bridge the armpit as the arm rises); a dome's points take their tuck whole (the
  dome is the shirt's surface, none of the wearer's), and a domed end no end tuck (it had cut a groove under the dome).
- **Squash and stretch** (a group's `act`, `principles.js` `ACTIVITY` and `ACTIVITY_JOINTS`; `activity: false` holds the
  muscles as at rest): as a joint closes its flexors bunch (shorter along the fibre, fuller and deeper, prouder, the
  belly sliding toward its origin: the biceps' peak rising as the elbow closes) and its extensors stretch (longer,
  narrower, flatter: the triceps drawn long, the quadriceps over the bent knee), each about as much muscle as it was.
  The elbow (the biceps and the triceps), the knee (the hamstrings and the quadriceps) and the shoulder's raise (the
  deltoid bunching, the chest and the lats drawn long). Per joint the right side's masses are made active and the parts
  they are worn by displaced again; the difference is a CORRECTIVE on the rest (`muscleElbowR` …), the left side's its
  mirror, driven by the joint, so it rides into an export's clips as the realistic body's pauldron does. Zero at rest.
- **A bend driver** for a corrective (`driver.bend`, the joint before: `station-loft-rig.js` `correctiveWeight`,
  `body-relational-correctives.js` `correctiveRest`, the pack's driver joints): its weight the joint's flexion, the
  angle between the bone into it and the bone out of it, 0 straight. A driver without one reads the raise as before;
  the glTF's corrective note says how an engine reads it only where a target names it.
- **The skin's guards** (they came out of the raised arm): a ray that leaves no surface within its reach, or one carried
  past 6.5 cm (a ray grazing along a mass), is held at that cap (7 cm for a dome on a shell that shows); such a point
  takes no part in the elbow's or the knee's corrective (hidden in another shell at rest, posed it swung out in
  shards); the shoulder's cone and web wear only the arm's groups; a corrective's point past 8 cm, or far past its
  neighbours, left out or eased to them.
- **The form end without plates** (definition 0 had shown flat plates on the back, the thighs, the arms and the hips):
  three faults. A point carried past the cap had been put back on the skin, a patch sunk flat under the muscles round
  it, about 1,400 points at the form end, where the level-0 shapes stand furthest out; it is now held at the cap, and the
  cap is 6.5 cm, not 4.5 (the torso's, the thigh's and the shank's muscles stand a smooth 5 to 6 cm out there; the
  stray rays run on to 16). A right limb's shells had worn every group's masses, the chest's and the back's among
  them, where its squash and stretch wore only its own; they wear only their own. And where a mass meets the skin
  square on, two neighbouring points had stood centimetres apart (34 mm over one slot on the back): the skin now climbs
  onto a mass in a ramp, each point's move raised (never lowered) to its neighbours' less `SLOPE` (0.8) times their
  distance, a point held at the cap raising none. The elbow's and the knee's correctives leave the shoulder's domes
  alone (the elbow's biceps, slid toward its origin, had grazed the arm's dome and lifted it 7 cm).
- **The shoulder's cap without its rim**: the shoulder's drum and web, under the arm's skin, are tucked 2.5 cm (1 cm
  had let their domes stand through the top of the arm's dome at rest, a crisp rim round the deltoid's crown); raised,
  they still bridge the armpit as before.
- **The shoulder in a raise** (the operator's: overhead the shoulder's top opened in holes and the armpit frayed):
  measured as folded faces (a face turned past a right angle from its neighbours), the shirt's skin never folded; its
  faults were the bridging shells passing through the arm and a few grazing rays. A dome's rings ride as its end ring
  does (eased toward the cap's shares, the collarbone's fifth, they sheared into flaps); a dome's point is carried at
  most 7 cm (`DOME_MOST`: an inner ray grazing the deltoid's crown had run 10 cm out in a fin); a point carried far past
  its grid neighbours takes their mean (`FIN`); a shell no group wears keeps its authored rings (the cone, folded by
  the smooth cage over its turning rings); and the shoulder's raise REVERTS (`ACTIVITY_JOINTS.shoulder.revert`): near
  the joint its corrective eases the skin back to the wearer's own, wholly within half the half biacromial and none
  past 1.1 of it, so raised overhead, held out or forward, the shoulder bridges as the flat body's does, the deltoid's
  bunch kept further down the arm. The shoulder's driver from 20° to whole at 120°, so a raise to the side takes most
  of it.
- **The nipples on the mid-clavicular line** (the operator's: from the front they sat by the sternum, 7 cm apart): seated
  by a ray forward from 0.47 of the half biacromial out, low on the chest (`NIPPLE.on`).
- **Held** (`musculature.test.js`): the dial's laws; absence adds nothing (a skin no mass reaches keeps every point);
  every mass seated; the skin carried out; the left the right's mirror; every shell wound outward; the hands and their
  joints scaled about the wrist; the soles on the ground as the feet grow; the nipples only when asked; a bend driver none straight and
  whole at full; a corrective a side per acting joint, the left the right's mirror, nothing at rest, each joint its own;
  the biceps' front bunched; none with the activity off; raised overhead, held out and forward, the shoulder's
  shells folding no more than the flat body's; the cone as it was; the nipples on the mid-clavicular line; a mass meeting the skin square on climbed in a ramp; a point past the cap held at it; a limb's shells worn by its own groups only; deterministic; the door stores the word and refuses it by name.

#### The anime frame (hero laws 21): the wrist, the shoe's heel and the clavicle

The body the anime head wears (the anime proportions on the structured core), refined where a fuller body read it thin
or as boxes; the muscle shirt worn over it takes each with it. Hero laws 21 (`hero-form.js` `ANIME_FRAME`); a hero
minted under laws 1 to 20 keeps its body, and the landmark head's is untouched.

- **The wrist from the front**: the hand's section at the wrist and its palm's first ring 1.35 deeper through the hand
  (the second by half as much), the forearm's tendon ring with it (`hero-hand.js` `wristDepth`). With the palm facing
  the thigh, the front sees the wrist's depth, and it had read as a stalk; the side, across the hand, read right.
- **The shoe's heel**: ten points a ring and a rounder section (six at a box's superellipse had read as a hexagon from
  behind), a heel ring a little full and low a third of the way back from the ankle, the back ring a little in under a
  round cap, so the heel reads as a rounded bulb behind the ankle.
- **The clavicle**: the shoulder's cone held under the torso's skin at the shoulder's top and front (`tiered-form.js`
  `tieredSockets` `clavicle`, `SHOULDER_CONE.clavicleSink`), where since laws 9 its middle rings rode over it and stood
  through it in angular plates; the collarbone's run from the neck to the shoulder is the torso's own surface.
- **Held** (`anime-frame.test.js`): minted at laws 21 on the anime proportions only; the wrist deeper through, the
  same across; the shoe round with a heel ring under 21 and the box under 20; only the cone's riding rings move; the
  landmark head's body as laws 20 built it.

#### Z-Fighter's neck thinner

Z-Fighter's male tune (`anime-styles.js` `HEAVY_HERO`) carries a neck of 1.1, where 1.25 stood as wide as the jaw from
the front. A cast is stored as its resolved stamp, so a hero minted before keeps its neck.
