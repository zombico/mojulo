### Helmets by tradition, the outermost shirt fitted, and the dressing progression

Operator: "do helmets next, then create 'more upscaled gear' for tactical / armored teams"; then "is it just me or are the
chest fits too wide? can we verify that we are using the corrected method"; then "lets do a dressing progression:
Civilian Security -> Private Security, Mercenary -> PMC Squad Member, Soldiers -> Special Forces gear … this is a depiction
layer".

- **The helmet library** (`headgear/helmets.js`, a card each, lowered onto the cowl): `m1` (the steel pot), `stahlhelm`
  (the coal scuttle, its skirt flared), `brodie` (the soup bowl), `ssh40`, `adrian` (crested, peaked front and back),
  `pasgt` (the K-pot), `ach` (the mid cut, an NVG shroud) and `highcut` (rails, the ears free).
  - Worn from an outfit's `language.head`: a helmet's name, or `{ helmet, cover?, band?, net?, nvg? }`. `cover` is a
    camouflage, or true for the top's; `band` a scrim band; `net` a net; `nvg` a night-vision mount, the goggle stowed up.
  - The hair is dropped and the ears pressed under it.
  - A camouflaged cover takes the pattern's ground as the helmet's tone, and its marks are painted with the outfit's,
    from above too.
  - The soldier cards wear theirs: `jungle` the steel pot with a band, `bdu`, `desertbdu` and `dpm` the K-pot in their
    camouflage, `galife` the SSh-40, `feldgrau` the Stahlhelm, `battledress` the Brodie with its net.
- **The cowl's `brim` along its own edge** (`station-loft-adorn.js`, `edge` and `up`): a flange that follows the shell's
  rim round the head, so a helmet's skirt and its peaks sit where the shell ends. Without `edge`, a brim is unchanged.
- **Camouflage from above**: the marks are painted from a fifth side (`top`), the shoulders' tops and a helmet's crown.
- **The outermost shirt fitted** (`authored-jacket.js` `fitShirt`, the expander's `tailoring.shirt`): a collared woven top
  worn with no jacket over it, not a dress and not `fit: 'loose'`, is brought in onto what it is worn over as a jacket is,
  9 mm past it on the trunk and 7 mm on the sleeves; it is never let out. A field shirt stood 2.2 cm a side off the chest
  (46.5 cm wide over a 42.1 cm trunk) and now stands 0.8 cm (43.7 cm). Knit tops, collarless woven tops (a tunic, a
  blouse, a statue's drape) and shirts under a jacket are unchanged. Pins moved, with the reason in their header: the
  outfit laws' tucked case.
- **The dressing progression** (`outfit/styles.js`, each rung the one before and its gear; no service told apart):
  `guard` (civilian security: a short-sleeved uniform shirt, a duty belt and its pouches), `security` (private security:
  a fitted top, a low-profile plate, a holster on the thigh), `mercenary` (a field shirt, a chest rig, a thigh pouch),
  `pmc` (a squad member: a plate carrier, the high-cut helmet with its headset, kneepads), the soldier (`bdu` and the
  traditions' cards), `specops` (multicam, the carrier, the high-cut with its NVG and headset, knee and elbow pads).
  - **A card carries its gear** (`pieces` on the card, outfit-plan.js OUTFIT_KINDS), worn under a build's own
    (`outfitPieces`).
  - **The plate carrier** (`vest` cut `plate`): the plate high on the chest, three magazine pouches a side on the flap
    under it, a cummerbund each side round to the back panel.
  - **Elbow pads** (`elbowpads`), and **a headset** on the helmet (`head.headset`: an earcup over each ear and a boom
    mic).
- **A vest's back panel lies on the back** (every vest cut): it hung from the duty belt at the hip, at the side on the
  game body. Its window is now by shares, high on the back. Two words were added to a kit pack: `hang: false` hangs it
  on no belt, and `lean` lays it along the body's slope (`body-relational-kit.js`).
- Not yet:
  - The realistic head wears no helmet: the cowl reads the landmark head's cranium. It is left off there, and the
    readout says so (`gameOnly`).
  - A helmet costs about 23k faces on the game body (the cowl's grid).
