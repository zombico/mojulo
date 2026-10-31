### The realistic wardrobe: the legendary merc

The realistic register's character and clothing raised toward the seventh generation at its best: a middle-aged
legendary mercenary in tactical gear, face and hair showing, as the game model (the skinned GLB an engine plays). Then
the same man in a leather jacket. The eyes gate is the operator's.

- **Hair as alpha cards** (realistic laws 7, `REALISTIC_LAWS_VERSION`). The scalp's blades and the beard's locks were
  opaque ribbons (the grass hat): up close they drew as shards. They are now cards that carry a strand texture.
  - A card runs full width to its end (`HAIR_CARD.tip` of its root, never a point), each point its place across and
    along it (`hair-depict.js` `stripMesh` `card`), carried through the pin and the compile to the mesh's provenance.
  - The texture (`epidermis/hair-strands.js` `strandPage`): fine white strands, each tapering, waving and ending at a
    length of its own, filled at the root, with alpha between them. A card draws one of its cells by its index.
  - The texture is a strip under the head's page on the skin's atlas (`dermal-hero.js` `heroSkinPaint` `cardUV`), so
    the figure stays one material; a card's colour is its band's, the root darker than the tip, as before.
  - The figure's material is alpha tested (`alphaMode: 'MASK'`, cutoff 0.4, double sided) when its atlas carries the
    strip, on the GLB (`scene-gltf.js`) and the World page.
  - The strands are the hero's own: most are its pigment, a share (its `grey`) the cards' mean colour, so a greying man
    reads salt and pepper. The mean alone washed every strand grey once the cards showed it lit.
  - A hero minted before keeps its grass hat: the cards are its laws'.
- **`face.scalp`**: the realistic face's cut by word (a style such as `long`, `ponytail` or `crop`, `{ style, …its
  groom }`, or `'none'`) in place of the one its ancestry rolls. Before, the cut could not be named.
- **The kit as pieces** (realistic laws 8, `polygonizer/body-relational-kit.js`). The authored kernel made each piece
  a slab lifted off the skin's envelope. It never saw the tailor's cloth (it looked for a garment by a name the tailor
  no longer gives), so straps and pouches sat inside the shirt, and the belt was two of the cloth's rings copied, so it
  rippled with them. Now each is made as the thing it is, on what the body wears:
  - **A belt is one mass** (`beltOn`): its section read off everything worn at its height across its whole width,
    the hollows spanned as a cinched belt spans them (the section's hull), the same section top to bottom, its edges
    rounded. Its buckle is a frame (`frameBuckle`: four bars, a tongue, the belt's tail through it, a keeper loop).
    It is fitted over what is under it (the piece it is on, the trunk's cloth inside that, the belts before it, the
    skin): a garment wider than it there is worn over it and clears it, as before, and a sleeve hanging beside the waist
    is no girth. A belt within a hand's width of one already made shares its height, cinched over it: a duty belt rides
    over the trousers' belt, never a band of its own above it.
  - **A pouch is a piece** (`pouchOn`): a body with rounded corners and a bevelled front, its back pressed flat to
    whatever stands out most under its footprint, a lid flap over its top with a rounded fold, a closure tab and its
    snap, a seam bead down each front edge. It hangs on its own belt (its top a little over the belt's) and rides it
    rigidly. A thigh rig hangs from the belt above it by a strap down the hip.
  - **Webbing lies on the cloth** (`webbingOn`): along its path, each point lifted over the farthest thing worn within
    the strap's width, the lift eased along, so it lies on the outermost layer (the shirt, a belt) and never stands off
    or sinks. An end that runs to a belt is fastened to it: carried down the body to just over the belt, a ladder lock
    there and a tab over the belt's face. A strap along a path one is already laid on is that strap (a rig's shoulder
    straps and a harness worn with it).
  - **A rig's X is anchored to a waist strap**: straps whose two ends meet at the waist (a harness's) end on a band of
    the same webbing round the body just over the belt, made once for every strap that ends at its height. Each strap
    is cut where it first comes down to the band (never run along it), set onto it and locked there. Its ends had hung
    open at the sides.
  - **A gun harness** (an outfit's vest `cut: 'holster'`, `outfit-plan.js`): the harness's straps, a pistol holstered
    level under the off arm and a double magazine carrier level under the draw arm (`side` the draw hand's), in place
    of the rig's magazine pouches across the chest. On the realistic body the pieces (`holsterOn`: the holster tapering
    to the muzzle's end, the pistol's slide and its grip raked down and forward out of its mouth, a retention strap and
    its snap, a hanger up to the harness; the magazines two pouches turned level, flaps forward); elsewhere the authored
    kernel's boxes. A piece on the trunk lies on the trunk: an arm hanging beside it is no surface (a holster pressed
    to it had ridden on the arm).
  - Each frame a piece is laid by is read out from its part's own axis: an address's normal comes from its neighbours'
    handedness, which a reshaped part can turn over, and a pouch laid along it went into the body.
  - A band round a thigh is a belt on that leg's cloth, read off that leg alone, no higher than a hand under the crotch.
- **The cloth's folds** (realistic laws 8, `polygonizer/body-relational-folds.js`): the folds a game draws, not a
  simulation's, a few broad ridges that keep reading as the body moves (each rides the cloth's own weights, so a bend
  closes the crescents it shows). Crescents inside the elbows and behind the knees, stacked rolls over the boots and at
  the cuffs, the shirt bloused over its belt with gathers under it and flat where the belt cinches. A ridge only ever
  stands out from the cloth, its crease side sharp and its other side soft, its size the cloth's weight by the
  garment's role (`FOLD_CLOTH`: a knit small, canvas sharper, a heavy layer broad, leather broadest). The cloth is
  refined where a fold lies, its new rings' weights mixed from their neighbours; a piece a garment is worn over is left.
- **The man's hips** (realistic laws 9, `body-relational-builds.js` `MALE_HIPS`). The male build narrowed the
  shoulders (its tune, 0.8) but stood on the heroic cast's hip joints, 22 cm apart, the pelvis's skin carried out to
  them. So every male physique had a pinched waist over wide hips, waist to hip 0.76 … 0.79, inside the female band
  (`hero-core-measures.js` `CORE_BANDS`), and from behind and in profile a turntable read a woman. The door warned "the
  waist is narrow for the hips" on every male realistic hero. The hip sockets now come in with the narrowed frame
  (`hipSpan` 0.78, about 17 cm apart), the knees under them as they were, before the slice reads the rig: waist to hip
  0.85 … 0.91 across the physiques (athletic 0.88), the hips 4 to 5 cm narrower. The female build is as it was. The
  hero's `tune.hips` widens the pelvis's girth only, never the sockets.
- **A man's run** (`hero-gaits.js` `HERO_RUN_POLE`): the jog and the sprint as stamped for a man land on a wider base
  (feet about 9 cm apart, legs never crossing), the pelvis turning and swaying less, the shoulders more against it. The
  run as minted (feet nearly on one line, the pelvis turning 8°) read as a woman's on
  a man. The woman keeps it. Stamped where a hero is written, as the walk's pole is: a hero stored before keeps its run.
- **The jacket as built** (`polygonizer/body-relational-jacket.js`), from an outfit's outer garment words, on the
  realistic body. The tailor's jacket was a closed tube whose opening was painted on it (the cloth taken in and coloured
  as what shows there), so an open jacket did not open and its collar stayed a closed ring round the neck.
  - **A real opening** (`openFront`): each ring of the jacket's body a C in section, the inner face round to a front
    edge, the edge turned, the outer face back a leather's thickness out, so the two fronts are edges with a real gap
    between them; the ends turned in and drawn small inside the body, where the tube's caps close them. Its collar is
    opened with it. Each new point carries the weights of the cloth point it was made from.
  - **The construction words** on `language.outer`: `front: 'zip'` (closed on a zip in the gap: its tape behind the
    edges, its teeth, its pull; no V, no lapels, no buttons), `collar: 'shirt'` (the collar's points snapped to the
    chest), `rib: 'cuffs' | 'waist' | 'both'` (knit bands cinched round what is under them, the body and the sleeves
    bloused over them, the card's `Rib` tone), `pockets: 'flap'` (a patch pocket low on each front under a flap with a
    snap, each inside its own front), `epaulettes: true` (a strap over each shoulder, laid by the shoulder's own slope,
    buttoned at the collar), `cloth: 'leather'` or a cloth word (how it folds). `open: true` hangs the fronts apart.
  - Its pieces lie on its own outer face (`faceAt`, `patchOn`: a slab following the curve, not a flat box).
  - **A flight jacket**: the `flight` style card (the A-2), brown leather to the belt on rib bands.
- The principles of the kit and the folds are written down: [garment-principles.md](../docs/garment-principles.md) has
  them as rules, the realistic body's contract points at them, and `/garment-design` reads a piece against them.
- **The lids rest on the eyes** (realistic laws 11, `head-relational-eye.js` `SEAT`). The one skin's opening was a
  tunnel cut straight back to the globe through skin that stood proud of it: the lower lid was the cheek's shelf, 16 to
  17 mm ahead of the globe just under the margin, and toward the corners the upper lid stood out as a thin plate where
  its lid space is shallow. Every realistic face showed a dark void between the lids and the eye. Now the skin within a
  reach of each margin is cut back to the lid shell and rises out of it with the distance from the margin, cut with a
  wide blend so the lid rolls into the cheek rather than kinking. The lower lid stands as far off the globe as the
  upper (about 6 mm with its thickness, where it stood 16), and its margin is rounded by its rim as the upper's is.
  Above the crease the fold now rises to the brow as a pad (`SEAT.fold`): forward out of the crease, which keeps its
  shadow, then near upright under the brow, the brow's underside trimmed to it and the cap at its top blended rather
  than cut hard. It used to stand at the lid's depth well up under the brow, a cove facing down that read near-black
  under any light from above; a straight lean faced it down its whole height. Its ends rise toward the nose and the
  temple. The fit keeps `seat`, so the skin's bake, the hair, the jewellery and the face rig rebuild the same seated
  head.
- **The brow lower, the eye forward** (realistic laws 11, `SEAT.brow`, `SEAT.forward`). The brow's arc hangs 3.7 mm
  lower and the brow's ties 2.8 mm lower, so the eyebrows come down with the fold's arch. A deep-set eye (its globe,
  lids and lashes; the socket and the skin about it stay) comes forward a third of the way from the cornea toward the
  nose's tip, its cornea kept at least 6 mm behind the glabella: about 7 mm on the male pole, none on the female,
  whose eye already sits near the brow's line and would stand proud of her face at the full share.
- **The lower lashes on a seated lid** (`epidermis.js` `SEATED_LOWER`). Out of the tunnel that cut most of their length
  off, they hung from under the lid's band as a long fringe. On a seated lid they root up the margin's front, just
  under the eye, a quarter shorter, nearer level and curled less. A head that is not seated grows them as before.
- A hero minted before keeps what its laws made; a hero minted now is stamped laws 11 (`REALISTIC_LAWS_VERSION`): laws 10 is the hair as its main shapes (`1028-realistic-hair`), the seat after it.
