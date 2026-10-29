### Clothes fitting: the realistic wardrobe's construction on the game body

The game body (the authored and the tiered hero) wears its kit as the realistic body does: each piece the thing it is,
fitted over what is worn under it (docs/garment-principles.md, the kit as pieces). Before, it laid the kit as slabs lifted
off the body's envelope, and its buckle was four bars round a point.

- **A belt is one mass, its buckle a frame** (`polygonizer/authored-kit.js`, run by `expandPlan`'s `kit` hook after the
  garments and before the adornment bake). A belt (a band wrapped round the trunk, or a skirt's waist, carrying a
  buckle or a boss) is one section read off everything worn at its height (`beltOn`, sampled round the body 24 ways,
  not the cloth's 12), the hollows spanned, its edges rounded; its buckle a frame with its tongue, the tail through it
  and a keeper (`frameBuckle`). Belts within a hand's width share a height, the later cinched over the earlier. Cloth
  worn over a belt (a jacket's or a tunic's) is carried out over it and eased back within 2 cm.
- **The kit's pieces** (`kitPieces`): a pouch is a body with a flap, a tab, a snap and seams, hung on its belt and riding
  it rigidly; a harness's straps are webbing on the outermost layer, fastened to the belt by a ladder lock and a tab,
  an X anchored to a waist strap; a gun harness carries its holster and pistol and its magazine pouches; a thigh rig's
  band is a belt on that leg's cloth. The kernel's shells for them are left off.
- Every piece takes the weights of the cloth under it, read by ring as the game body's weights are (`bindNearest`'s
  `rings`; `beltOn` and `kitPieces` take `{ around, rings }`), so the kit bends with the body as the realistic kit does.
- A pouch on a leg rides the leg (a belt slung on the hips above it is not its carrier) and hangs below a pouch already
  hung above it, never through it; a pouch finds its own belt (the duty belt its kit came with) up to 15 cm off, since a
  game body's short pelvis puts its window in from the belt (`kitPieces`, on both bodies). On the game body a belt rides
  no lower than the hips' widest and is fitted over the legs' tops it spans.
- **A waistband has no ease** (outfit law 2; docs/garment-principles.md). Trousers sat 2 to 3 cm off the body all round
  at the waist on both bodies, which read as bulk and put the belt on a ledge. Now the band sits on what it is worn over,
  a hair off the skin, and a tail tucked under it is pressed flat with it; the cloth takes its own ease back by the hips'
  widest. The game body's kernel takes it as a piece's `waistband` (the station its band starts at: body-garment.js),
  set by the expander on the trousers' seat; the realistic tailor as `waistbandOf` and `cinchWaist`
  (body-relational-tailor.js), the layers tucked under the band cinched first, in the order worn. Measured on the male
  tactical hero: the game body's waist from 2.8 cm to under 1 cm over the skin (a tucked shirt under it), the realistic
  body's untucked trousers from about 2.5 cm to 0.35 cm.
- **The kit follows the live dials** (`followDials`): each piece's stations take ids of their own and the piece joins
  every dial that moves the body part it lies on, weighted as that surface is at its height (a pouch, a holster, one
  weight: it moves whole). A belt widens with what it is round (`bulk`, `stance`) and never swings with a hinge (`lean`),
  spanning the hinge's pivot. The ranger's belt, pinned to the torso's hem, had sunk into the pelvis at `bulk` 0.8 (the
  door's warning); it no longer does.
- An armour build is the plate kernel's still: its straps and its ridge stack over its plates, and the kit hook leaves it.
- The door's dress readout counts the kit's pieces (`dress.parts.kit`), and a pouch made as pieces (`<id>Body_kit` …) is
  worn, never listed `unworn` (it was, on the realistic body too).
- Pins moved, each with its reason in its header: the outfit laws' pin (version 1 rewritten in place, unreleased, for
  the waistband), the statue characterization's draped and belted cases, the adult-form chibi's ranger recipe.
- **The jacket opens on the game body** (`polygonizer/authored-jacket.js`, from the kit hook, which now runs for a plan
  with a tailoring as well as one with adornments). An outfit naming a jacket's construction (`front: 'zip'`, `open`,
  `rib`, `pockets: 'flap'`, `epaulettes`, `collar: 'shirt'`: the `flight` card) was a closed tube on the game body with
  its opening painted on. Now its trunk pieces (`outer_torso`, `outerTail_pelvis`) and its collar are opened at the centre
  front in place (`openFront`, ten points a side: the game body's cloth is ring12), keeping their names and their
  stations, so what was placed on them and the dials still find them; their trims are carried across the opening. Its
  zip, rib waistband and cuffs, flapped pockets, collar points and epaulettes are laid on a view of the jacket as the
  realistic body makes it (its trunk one tube, `oneTube`), weighted by ring and following the dials (a zip and a rib
  waistband never swing with a hinge). The door no longer says the jacket's construction is the realistic body's.
- `jacketPieces` takes `{ rings, around }`, and its rib waistband lies on the first garment with a ring at the band's own
  height (on a game body the shirt's body ends above the band, its tail at it).
- **A pocket, a flap and a collar's point drew inside out** (`patchOn`, on both bodies): the compiler turns a part out by
  its first band face, which lay at the section's end, a pocket wide and 2.5 mm thick, and read either way, so they drew
  dark. The ring now starts at its outer face's middle.
- **The tailoring on the game body** (`polygonizer/authored-tailoring.js` over `polygonizer/tailored-front.js`). The
  realistic body's tailored front and shape (the V onto the shirt and tie, the lapels, the right front's edge and the
  quarters cut away below the last button, the buttons at the stance, a tie, a waistcoat's V, armholes and buttons,
  structured shoulders, a suppressed or a straight waist) moved out of `body-relational-wear.js` into
  `tailored-front.js`'s `tailorFronts`, every change made on each of a jacket's pieces and every read of one view of them;
  the realistic body calls it on its one tube and is byte for byte as it was. The game body calls it on its jacket's
  pieces densified IN PLACE (`densePiece`: 48 round, a ring every 1.5 cm, round the old ring's centre and never on its
  chords, keeping the pieces' names and their stations' ids, the new rings' dial blends, weights, trims and addresses
  mixed from their neighbours), what they are worn over read densified (`denseRead`). There a lapelled jacket is its
  lapels alone (`collars: false`: two bands to the gorge, none round the back of the neck), its stand collar and the
  shirt's under it taken off the recipe and the dials. The door no longer says the tailoring is the realistic body's.
- `tailored-front.js`: a surface with no cloth along a ray (a shirt's neckline cut lower at the front) is read at its
  ring's mean radius there (a tie's knot stood a metre out); the cut-away quarters show a skirt as they show trousers
  (they were painted skin on a skirt suit, on both bodies).
- **The jacket fitted on the game body** (`fitJacket`, operator: "tighten the fit on the jackets"): the outer layer's
  pieces on the trunk brought onto what they are worn over at a jacket's ease (`FIT`: 7.5 mm, a layer's step and about
  2.5 cm of girth), its sleeves square to the arm (6 mm), read densified; never let out. `cinchWaist` leaves a ray that
  reads nothing under it as it stands (it was drawn to the axis).
- **The shoulder under a jacket** (operator: "make the shoulder patches the same colour"): the tiered body's shoulder
  sockets (its ball, cone and web), which no garment covers and which are painted as the shirt, take the outermost
  sleeve's colour: the white patches at a suit's shoulders and the tee's green under a flight jacket are gone. A sleeve
  starting on the arm's first ring takes its shoulder cap out past the skin's by its own ease, and one worn under another
  the outer's colour on its cap and first bands (`sleeveSeams`).
