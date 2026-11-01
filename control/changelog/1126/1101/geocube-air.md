### The air of a gen-7 geocube

- **A fog by its visibility** (`scene/channels/atmosphere.js`, the recipe's `air` on the `geocube` kind, every gen-7 show:
  the path and trail, the geocity, a hall, a room, a cavern). `haze`, `mist`, `fog`, `true` (haze), or `{ kind, visibility,
  clear, height, glow, blur }` over a kind. Its extinction is Beer-Lambert's, set by a VISIBILITY in metres (where a dark
  thing's contrast against the air falls to 2%) past a clear distance at the eye. Outside it lies low: its density falls
  with height over the walk's ground by a scale height (`height`, false to lie even), each ray's optical depth integrated
  in closed form, so a mist sits at the walker's feet and a hill top stands over it; toward the sun it glows (`glow`).
  Each word has a trail's measures, a metro's (a geocity: the same haze seeing kilometres, in a deeper layer) and a room's;
  inside (no sun: a hall, a room, a cavern) it lies even, its colour a room's own light (its ambient and a share of its
  lamps over its void, `roomAirColour`), a cavern keeping its page's dark. It is three's own fog chunk, patched once
  before any material compiles, so every surface that took the page's fog takes it (the form's land, grass and far field,
  the trees and their cards, the far structures' tiles, a room's baked surfaces); its colour stays the page's (the form
  sky's haze, the city's air; a room's its own light, below), and `scene.fog.density` is its extinction, so the weather still
  thickens and thins it. A painted (gen-6) page and the unshaded export keep their haze; the word is read on any geocube.
- **The sky veiled to it**: the gen-7 dome takes the air at its horizon, in a band as thick as the air (`band`, the kind's),
  so the land and the sky meet in one colour where the fog swallows the land.
- **The far softened** (`blur`, css pixels at its most, 3 by default; false for none): the frame drawn to a target with its
  depth, then laid on the canvas with each pixel spread over a golden-angle disc by how much air lies between it and the
  eye (the same optical depth, rebuilt from the depth), only past the view cone's reach (where the impostors begin: the
  trees' and the buildings' cards, the far field's colour), never nearer than a fifth of the visibility. A near thing never spreads
  onto the far behind it, and nothing near is softened. The target holds what the canvas would (tone-mapped and encoded as
  on screen); a renderer without half-float targets, a non-perspective camera and an XR session keep the plain frame.
  `window.__mojAir` is the probe (`set({ blur })` live).
- An engine export draws its own fog (`godot-marks.js` `air`); absent `air`, the page is byte for byte as it was.
