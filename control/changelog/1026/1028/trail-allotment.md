### The trail's ground allotted

- **Grass in sections** (`form/land-read.js`, `scene/channels/form-grass.js`). The sward has three lengths, each in
  areas of its own: tall, medium and short. Near the eye the medium grass was drawn under the tall grass; now each
  length draws only where the sward is that length. The near tier is the medium one, the same clump lower on a finer
  grid. A long sward (`'tall'`, the default) lays a share of its grass
  medium (`SWARD_MEDIUM`, 45%, a field of stretches about 11 m across) between its tall ones. A biocube names its own
  shares with `flora.grass.sward: { short?, medium? }`.
- **The far grass in patches** (`scene/channels/form-grass.js` `PATCHES`). The carpet is gone (it drew the grass as
  stacked horizontal shells, which read as flecks from a few metres out), and so are the far tufts that took its place.
  Past the near blades the grass is patches about 2 m across, fitted to one another along a warped grid so no edge runs
  straight. A patch stands at three quarters of the grass it stands for, its height the grass map's at each point, so
  neighbours meet at one height. Far off a patch is its green alone: a top and, on a side no patch borders, a backing.
  Within 36 m of the eye it is dressed in the real clump of its section: a few tufts through its top, and on each open
  side a wall of the blades at full height, two rows deep on the sides facing the eye. Where the near blades take over,
  the inner sides facing the eye carry a wall too, so the patches blend into the live grass. The near dressing is chosen
  again each time the eye crosses a patch. The hand-over is timed so nothing grows as the eye walks (`HANDOVER`):
  the real grass reaches to the horizon of the eye's attention (the tall to 42 m, the medium to 20, the short to 18), the
  patches rise under it while it still stands full, and then it thins, each clump gone whole at a distance of its own,
  so the further off the fewer, its last clumps standing among the patches' own blades. Its far reach costs what it
  shows (`GRASS_RINGS`): past about half its reach it is drawn from a grid twice as coarse, past three quarters from
  one twice as coarse again, each keeping a fixed one of the four cells under it, so a clump crossing into the next
  ring changes grids and not form. The blend rims, the near dressing at its edge, the wheat and
  the flowers come and go the same way, each piece whole at its own distance; nothing is dithered. Where the ground drops steeply a patch
  goes under it, so none bridges a cliff's edge. The shade follows the blades' rule: root to tip, the ground's tone and
  a blade's dice. The patches cost about half what the carpet's first patches did.
- **Nothing through anything** (`era/isekai.js` `ALLOT`, `form/land-read.js`, `form/land-stones.js`). In the form
  render each thing on a trail claims its ground: a stone its footprint, a trunk its foot, a bush or an arrangement its
  reach. No grass grows in a claim, thinning and shortening toward it so no blade leans into a boulder or a trunk, and
  no ground stone lies in one. No tree stands in a stone's ground. The plants carry their claims (`plants.clear`).
- **A clear overlook** (`form/flora-read.js` `viewHeld`). A raised view, a camera whose eye stands 5 m or more over
  what it looks at, claims what it looks over: a crown rising over its eye within 25 m ahead of it is held back. The
  trail's cliff-top view sees the trail again past the taller trees. The rest of the trees keep the heights they had.
- The gen-6 renders are unchanged: the claims, the sections and the held trees are the form render's alone.
