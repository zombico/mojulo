### The biped's coat: patterns solved in an upright body's anatomy, painted into an atlas

The animal door's markings are windows in a quadruped's frame, and on the tiered body's rings they read inside out (the
previous theme withdrew them). This theme gives the biped a pattern solver of its own and a texture to paint it in.

- **The solver** (`beast/pattern.js`; `beast.pattern`: a list of layers, a later one over an earlier). Each layer is a
  field over the body's rest surface in metres, read in the biped's anatomy:
  - a point's region (trunk, neck, arm, leg, tail, coil);
  - its dorsality: the trunk's and the neck's back against their front, a limb's outer face against its inner one, a
    tail's top against its underside;
  - its angle round from the spine, its height on the trunk, and its distance down its limb, in metres from the
    limb's root so a band runs on across the knee.

  The layers:
  - `countershade`: the light underside (throat, chest and belly, the inner arms and thighs, under the tail);
  - `stripes`: chevrons swept down and forward from the spine round the flanks, thinning and stopping short of the
    front, a wobble of their own; bands across the limbs' outer faces; rings round the tail;
  - `spots` and `rosettes` (a broken dark ring round a darkened centre) on a jittered lattice in metres, fewer toward
    the front;
  - `points` (the extremities darkened), `socks`, `saddle` (a dark field over the back), `dorsal` (a line down the
    spine).

  Colours are hex or the coat's own words (suit, armor, seam, accent, opposite); lengths scale with the body; the
  fields are mirror-symmetric and deterministic. The door refuses a layer or a word by name.
- **The coat as an atlas** (`beast/coat-atlas.js` `beastCoatPaint`). The pattern is painted in colour into one texture
  over the coat, at texel density (240 a metre at a 1.8 m figure), so a stripe is as fine as it is drawn, never a
  ring's: a thigh has six rings, a neck three. It is laid out as the hide atlas is (`skin-paint.js`: every coat part
  its own rectangle, the UV of a vertex read off its id) and lit as the realistic skin is (`heroSkinPaint`: the texel
  carries the colour, the face's light divided by the coat's colour lights it, so it is never tinted twice), so the
  World page draws it and the skinned GLB carries it by the same path (`world-kinds.js`). A beast with no pattern:
  none, as before.
- **The cover's relief on the atlas** (`coatRelief`). One UV set carries the paint, so the cover's tiling map gave way
  to it. Instead, the cover tile's normals (the cover's kind and its qualities) are laid into each part's rectangle in
  metres, at twice the atlas's density, box-filtered to the map's texel, each painted corner its tangent on the atlas's
  UVs; the pack carries it as the realistic skin's relief (`normalTex`). Not carried yet on a patterned coat: the
  cover's occlusion, roughness and metal (its sheen) and its tipped crests, which ride the tiling map only.
- **The hero viewer's cameras** (`.claude/skills/hero-live`): a full-body side view and a back view (`vBodySide`,
  `vBack`), for a coat's back and a tail.

Machine gate (`beast/pattern.test.js`): each layer's law on samples (the front lightened and the back not, stripes
from
the spine and none at the front, a limb's outer face only, the tail ringed, points toward a limb's end, the spine alone,
mirror symmetry), the refusals; the atlas absent without a pattern, deterministic, the coat's faces alone, a stripe
finer than a leg's rings; the relief at its scale with a tangent on every painted corner. Eyes: a tabby cat-kin, a
rosetted cat-kin and a saddled wolf-kin, front, back, side and bust, in the exported GLB (the operator's to judge).
