### The trail's ground allotted

- **Grass in sections** (`form/land-read.js`, `scene/channels/form-grass.js`). The sward has three lengths, each in
  areas of its own: tall, medium and short. Near the eye the medium grass was drawn under the tall grass; now each
  length draws only where the sward is that length. The medium is the same clump lower on a finer grid. A long sward
  (`'tall'`, the default) lays a share of its grass medium (`SWARD_MEDIUM`, 45%, a field of stretches about 11 m across)
  between its tall ones. A biocube names its own shares with `flora.grass.sward: { short?, medium? }`.
- **Nothing through anything** (`era/isekai.js` `ALLOT`, `form/land-read.js`, `form/land-stones.js`). In the form
  render each thing on a trail claims its ground: a stone its footprint, a trunk its foot, a bush or an arrangement its
  reach. No grass grows in a claim, thinning and shortening toward it so no blade leans into a boulder or a trunk, and
  no ground stone lies in one. No tree stands in a stone's ground. The plants carry their claims (`plants.clear`).
- **A clear overlook** (`form/flora-read.js` `viewHeld`). A raised view, a camera whose eye stands 5 m or more over
  what it looks at, claims what it looks over: a crown rising over its eye within 25 m ahead of it is held back. The
  trail's cliff-top view sees the trail again past the taller trees. The rest of the trees keep the heights they had.
- The gen-6 renders are unchanged: the claims, the sections and the held trees are the form render's alone.
