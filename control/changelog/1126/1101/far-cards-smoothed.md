### The far cards smoothed: one world past the reach, not a pixel asset in it

- **The cards smoothed** (`scene/channels/card-smooth.js`): the far trees' cards (`channels/form-flora.js`) and the far
  structures' tiles (`channels/far-structures.js`), baked point-sampled so they are no thicker than what they stand for,
  were drawn with nearest filtering and a hard alpha cut: past the view cone's reach a tree read as a pixel sprite that
  crawled as the eye moved, against the smooth 3D world round it. Now each atlas gets coverage at its edges (whole where
  the bake marked it, a share a texel out, within its own cell), its empty texels its own colour (so the mipmaps never
  blend toward black), and is mipmapped and filtered; its alpha is sharpened back to an edge a pixel wide (an
  anti-aliased alpha test, its edge a little under a half and lifted at each coarser mip level, so a crown of leaves
  smaller than a pixel keeps the weight the whole tree has at the swap) and drawn as coverage under the page's MSAA.
  A tree's wood is marked in its card's tone, so the alpha is coverage alone. The shadows keep the hard cut.
- A gen-7 page's far trees and tiles look different by this: softer, steadier, a little lighter than the hard dots
  (leaves under a pixel, averaged with the sky between them, as the near crown's MSAA shows them).
