### Military fatigues: the soldier from the boots up, and camouflage

Operator: "lets do military fatigues: start with boots, add military ones if we dont have those yet and pants of various
traditions. then various camouflage patterns. lets build soldier from bottom up literally", then "wrap the pockets
around the cargo pants instead of them just hanging".

- **Military boots** (`footwear/styles.js`, a new `military` family): `jungleBoots` (olive canvas with leather panels),
  `desertBoots`, `jumpBoots`, `jackboots`, `kirzaBoots` and `putteeBoots` (an ammunition boot under puttees, nine turns up
  the shin). An outfit card's `feet` now takes any footwear card by name (it took four words), on both bodies.
- **Trousers by tradition** (`language.bottom`): `into: 'boots'` ends the leg just below the top of what covers the shin
  (a boot's shaft, a puttee's wrap) and blouses its last band over the edge; `cut: 'breeches'` is full down the upper
  thigh and close from the knee; `pockets: 'cargo'` puts a bellows pocket on each thigh.
- **Cargo pockets wrap round the leg** (`body-relational-kit.js` `pocketOn`, on both bodies): each row of the bag is an
  arc of the trousers' outermost surface round the thigh's axis. The bag swells at its middle and lies flush at its
  edges, and its flap with a button is laid on the bag's own face. Both are bound to the thigh. Before this, a pocket was
  the adornment kernel's soft pack, which hung off the leg like a box.
- **A garment's `swell`** (`body-garment.js`, `[at, by]`): extra ease that peaks partway down a piece and eases to none
  at both ends; the realistic tailor reads it too (`swellRun`, beside `flareRun`). Breeches use it, so their fullness sits
  on the thigh, not at the crotch (`BREECHES_SWELL`). Without it a piece is unchanged.
- **Camouflage** (`outfit/camouflage.js`; `pattern` on the top, the bottom, the outer or the waistcoat): woodland,
  desert, DPM, tiger stripe, flecktarn, digital, splinter, multicam, urban and snow, each a ground and its colours in
  kinds of mark: blobs, brush strokes, stripes, dot clusters, pixel clumps, splinters, rain.
  - The ground is the layer's suggested tone (`outfitTones`), and the operator's palette goes over it.
  - The marks are field paint derived at read time, next to the hero's emblem (`heroFieldPaint`), so they show on the
    game body, the World page and every export.
  - The marks are shared across the layers in one pattern and run on between them. On the game body that includes the
    skin painted as cloth (the shirt's chest is the pectorals).
  - Each colour paints over the ground and the colours before it.
  - The words are `PATTERN_WORDS`, now the weaves (`WEAVE_WORDS`) plus the camouflages (`CAMO_WORDS`).
- **The soldier cards** (`outfit/styles.js`, by tradition, from the boots up): `jungle` (plain jungle fatigues, cargo,
  jungle boots), `bdu`, `desertbdu` and `dpm` (woodland, desert and DPM camouflage, cargo, bloused into boots), `galife`
  (a band-collared gymnastyorka over breeches in kirza boots), `feldgrau` (a field-grey tunic over trousers into
  jackboots), `battledress` (a waist-length blouse over trousers into puttees). The manual (`solid-vocab/layered.md`)
  names the boots, the trouser words and the camouflages.
- Field paint: a `polys` shape may carry as many pieces as a `path` mark cuts to (600, from 64), since a pattern's marks
  run to hundreds.
- Not yet:
  - On the realistic body's lit export, a camouflaged face sits on the white texel and loses its cloth relief under the
    marks.
  - There is no headgear (helmet, cap) or webbing set: the soldier stops at the collar.
