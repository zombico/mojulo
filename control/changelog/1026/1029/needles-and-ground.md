### Needles and ground drawn by parallax

- **A needled crown's needles in sleeves** (`form/tree-form.js` `SLEEVE`, `scene/channels/form-flora.js` `NEEDLE_LOOK`).
  A pine's, a spruce's or a fir's leafy shoots are no longer clumps and sprays: each run of them along an axis is one
  smooth five-sided sleeve, the needles' reach round it, narrowing at the run's tip, and the needles are found in it by
  the page. A pixel of the sleeve marches into it along the view, measuring its true distance from the shoot's axis, and
  meets needles as strands out from the axis, leaning toward the tip; a ray that meets none is dropped, so the sleeve's
  edge stays a bristle and the crown's outline is spiky, not a tube. Far off, where a strand is under a pixel or so, the
  sleeve is drawn whole with a feathered edge. Its shadow is the sleeve's.
- **The ground's own parallax kinds** (`scene/channels/form-land.js` `GROUND_PARALLAX`), procedural, no texture:
  pebbles strewn over the soil in a stone's own colour, cracked earth (dry mud in plates whose cracks wander and narrow),
  and fractured plates of a second rock. Bare soil, where no grass covers it, takes pebbles where it is damp and cracks
  where it is dry, by a field over the land; the scree's fines between its stones take pebbles; rock takes plates in
  patches. The trail varies by stretches: its powder, a pebbled stretch and a cracked one. Each kind is marched along
  the view within 30 m and fades by its cells' size on the screen, so nothing sparkles far off. It adds no draw, no
  triangle and no byte to the page: it is the ground's own shader.
