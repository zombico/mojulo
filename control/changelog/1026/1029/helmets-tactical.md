### Helmets by tradition, and the outermost shirt fitted

Operator: "do helmets next, then create 'more upscaled gear' for tactical / armored teams"; then "is it just me or are the
chest fits too wide? can we verify that we are using the corrected method".

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
- Not yet:
  - The realistic head wears no helmet: the cowl reads the landmark head's cranium. It is left off there, and the
    readout says so (`gameOnly`).
  - A helmet costs about 23k faces on the game body (the cowl's grid).
