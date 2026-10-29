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
