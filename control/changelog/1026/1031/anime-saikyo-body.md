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
- **Held** (`musculature.test.js`): the dial's laws; absence adds nothing (a skin no mass reaches keeps every point);
  every mass seated; the skin carried out; the left the right's mirror; every shell wound outward; the hands and their
  joints scaled about the wrist; deterministic; the door stores the word and refuses it by name.
