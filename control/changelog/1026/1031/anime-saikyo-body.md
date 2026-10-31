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
  Fourteen groups (the chest, the core, the flank, the back, the trapezius, the seat, the deltoid, the biceps, the
  triceps, the forearm, the elbow, the quadriceps, the hamstrings, the calf), each by level: 0 its silhouette in a few shapes, 1 its
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
- **The waist and the hip without their seams** (the operator's): the torso over the pelvis and the pelvis over the
  thighs are overlapping shells, and the shirt carries each onto the muscles along rays from its own axis, so in the
  overlap the two landed a millimetre or two apart and flickered through each other: a jagged line at the waist, the
  thigh's top in strips over the hip, the pelvis's brief outline torn. Now a shell that should not show is KEPT IN
  ORDER with the shell over it (`passes.js` `keptInOrder`): each of its points within 2 cm of that shell on the flat body
  takes the nearest place on it and sits under it there as the shirt carried it, its tuck's difference (at least 2 mm)
  below, eased to its own displacement further off; an end BURIED inside a shell that shows over it (the thigh's top in
  the pelvis, the pelvis's top in the torso, the bridges' ends) dives 8 mm over 2.5 cm (`BURIED_TUCK`), and an end that
  shows only 1.5 mm (`END_TUCK`, was 4: the torso's edge dived through the pelvis under it and crossed it in a dark
  band). The hip reads as one surface down to the pelvis's own end; a thin line stays where each shell ends.
- **The forearm's side profile, the elbow and the wrist** (the operator's): measured along the forearm's bone (front,
  back, out and in), the forearm flared 4 cm in its first 4 cm under the elbow and fell in a concave pinch to a wrist
  0.65 of the hand's width (the forearm's last ring the flat body's, the hand grown 1.3), and the elbow's bridge stood in
  a band between the upper arm and the forearm. Now: the forearm's bulk seated higher and longer; an ELBOW group of
  one level, so its landmarks hold at every definition (a level-0 mass in a deeper group sinks under its children
  toward the detail end): the brachioradialis's root rising out of the upper arm above the joint on the thumb's side, the
  olecranon the elbow's point at the back, the two epicondyles its width; the elbow's width 0.82 of the forearm's (was
  0.72), its back line from the triceps over the olecranon to the ulna without a dip. The forearm TAPERED out from its
  bone toward the hand's scale from 0.4 of the way down (`passes.js` `taperedTo`, `principles.js` `WRIST_FROM`), so the
  wrist meets the hand at 0.82 of its width; the wrist's bridge grown from its own rings' centres, its forearm end kept
  where it was along the arm (scaled about the wrist it slid over the forearm's end and flickered through it in teeth).
- **The joints' bridges welded** (`adapters/loft.js` `ABUT`, `passes.js` `welded`): the elbow's, the knee's and the wrist's
  bridges meet their neighbours ring to ring on the flat body, not overlapping; tucked under them, with their neighbours'
  ends diving, each joint showed a band and a crisp line at each ring. Now a bridge is not tucked, its neighbours' ends
  meeting it do not dive, and its end rings are carried to theirs (eased over 2.5 cm); the shells that show over others
  where they overlap are named (`OVER`: the torso over the neck and the pelvis, the pelvis over the thighs), not read
  off the tucks (by the tucks the elbow's bridge counted the pelvis it hangs beside as over it). An end counts as buried
  only 1 cm or more inside the shell over it.
- **The glutes rounded** (the operator's): the seat's side profile stood 1.7 cm off the flat body's in a flat slab from
  the hip joint's height to a ledge over the thigh. Now each cheek is a round mass, as deep as it is broad, its fibre
  slanting down and out as the gluteus maximus's does, with a lower cheek (`gluteLower`) that holds the fullest point just
  over the fold and turns the surface under into it: 4.6 cm past the lower back at the detail end, curving under over
  6 cm to the fold; the form end's one seat shape narrower and further out, so the two cheeks keep their cleft.
- **Posed: classical poses and wide stances** (the operator's): the front and back double biceps, most muscular, hands on
  hips, arms behind the head, side chest and contrapposto read clean at full figure; so do the athletic ready stance,
  the horse stance, the sumo squat, a fighting stance and a side lunge. Where the wide stances broke: the thigh's top,
  hidden under the pelvis, sheared out through the crotch and under the seat. The hidden shell had been set at the
  shell over it's offset both ways, so where the pelvis's own muscles carried it out, the thigh's top followed it out
  and, posed, came through the pelvis's hem. Now a hidden shell is only ever pulled IN (`keptInOrder`): a point the shirt
  left under the shell over it stays where it was; and away from that shell's open end it lies a further 6 mm under
  (`KEEP_DEEP`, eased in over 3 cm). Tried and set aside: giving the hidden points the outer shell's bind share
  (fewer points escaped by count, but those left tore in long shards across the groin) and fading the hold at the
  outer shell's open end (no better). Thigh points escaping the pelvis in the horse stance: about 280 → 180; the plain
  body has its own shards there, being two boxes at the crotch.
- **The hip joined** (the operator's; `passes.js` `hipWrapped`, `hipHidden`): the pelvis had been a brief over the
  thighs, each shell bound its own way (the pelvis rigid to its bone, the thigh ramping through the hip's fold to the
  femur), and in a wide stance the thighs' tops tore out through its leg openings, the plain body's as well. Now, as the
  realistic body hands its hip over, by one level: the pelvis's rings under the hip joint are re-laid round the union
  of itself and both thighs (each slot the farthest crossing along its azimuth from the trunk's axis), so the pelvis
  wraps the tops of both legs as one surface down to a level 1.2 cm over the crotch, where the thighs take the skin; its
  lowest ring goes on straight down a little inside them and its cap closes over the crotch (drawn sharply in, it had
  shaded the level's ring into a dark band). Out at the sides the wrap takes the weights of the thigh under it at its
  height (the hip's fold, then the femur), none on the midline (`HIP_SIDE`), so it moves with the legs. Each thigh is
  drawn 6 mm in from half a band under the level (hidden under the wrap, crossing it at a slope rather than lying on it
  in teeth), and under the level its skin facing out from the trunk is eased out to the wrap's lowest ring over 4 cm
  where that stands at most 2.5 cm further out (`HIP_DROP`, `HIP_REACH`: the cheek's underside running into the thigh;
  without the reach, the inner thigh's front was drawn out to the belly's front at the crotch and spiked posed). The
  thigh is no longer kept under the pelvis (`OVER`), the wrap does that. At rest the hip reads as one surface: the
  cheeks round under into the gluteal fold, a thin line where the shells meet; the ready, horse and sumo stances, the
  fighting stance and the side lunge hold at the crotch at both ends of the dial.
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
  shells folding no more than the flat body's; the cone as it was; the nipples on the mid-clavicular line; a mass meeting the skin square on climbed in a ramp; a point past the cap held at it; a limb's shells worn by its own groups only; a hidden shell kept under the one over it, only ever pulled in; the hip joined, the pelvis wrapping both thighs to the level, its sides bound as the thighs are; a joint's bridge welded ring to ring and the wrist most of the hand's width; deterministic; the door stores the word and refuses it by name.

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
