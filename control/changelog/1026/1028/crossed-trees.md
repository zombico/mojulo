### Trees of leaves in hands

- **A broadleaf's crown as crossed bundles** (`vegetation/twigs.js`, the operator's designs). Each leaf is a few
  triangles of its outline (`LEAF_TRIS`): a maple's four (two big triangles facing each other, their slopes crossing to
  its two middle points, a pointed one on each slope), an oak's four (a tall kite in two halves, two wide triangles across
  it whose corners are the lobes), a willow's three (long narrow blades fanned from one base), a beech's or cherry's
  pointed oval, a broad leaf's round one. A clump is a HAND of them (`CROSS.bundle`: 21 maple leaves; by outline as many
  as hold the maple's cover), one card a leaf, each its own finger: its tip 25–70° out of the crown, round it as its
  place in the bundle is, its face the one most out of the crown, rolled up to 60° askew and tipped a little to the sun.
  Two leaves crossed on one midrib covered little more than one; turned each its own way, two thirds of the cards hold
  the crossed bundle's cover (0.91–1.0 of it seen from round the crown's outside, its worst view 0.85–1.06), each leaf
  8% larger. None spills past the clump's room. A new species, the maple (Rauh's
  rhythm, its limbs sweeping round and a little crooked), joins beech and oak among the trail's defaults.
- **Leaves where the branches are** (`form/tree-form.js`, `twigs`). A crossed crown's bundles sit on its shoots, not in
  its envelope: one a cell of the crown (`SHOOTS.cell`, set so a crown draws a fifth fewer twigs, each bundle a few
  leaves fuller), on the leafy node standing furthest out in it, facing out from the crown and
  along its twig (`crossClumps`). The twig a bundle sits on is drawn, and so are the limbs it grows on, three-sided when
  thin; a twig carrying no bundle is not drawn. A sparse crown's cell narrows until it carries at least forty bundles
  (`SHOOTS.least`), so a thin tree is leafed along its twigs rather than only at their ends. Leaves point outward and
  sideways, not down; every triangle of a leaf winds the same way, so overlapping pieces no longer flicker. A species can
  name the seed its trail tree grows from (`specimen`: beech and willow 5, a full crown where seed 1 grows a thin one).
- **A grown tree's stance** (`form/tree-form.js`). A broadleaf now stands as a grown tree: its limbs below a quarter
  of its height shed (20–30% by its seed), its leaves from 30% up, drawn in to 80% of its spread, and each tree its own
  spread, bare stem and lean by its seed. Its near leaves are its crosses (no sprays); a needled crown keeps its clumps
  and sprays. A weeping crown keeps its curtains, and a bundle standing alone (a dangler) is dropped.
- **Far off, the same tree** (`form/flora-read.js`, `scene/channels/form-flora.js`). A crossed crown's far level keeps
  its near wood, every branch and the trunk as they were, and every bundle where it stands with half its leaves, larger
  (`FLORA_LOD.half`): the switch changes neither the branches nor the outline (held at about 0.9 of the near one). Up
  close, at 12 m, an oak is about 4.9k wood and 7k leaf triangles, a maple 3.1k and 3.9k, a beech 2.1k and 10k; the
  forest trail's trailhead view draws about 460k flora triangles.
- **To scale on the trail** (`form/flora-read.js`). A crossed broadleaf on a trail grows at its species' own heights
  and a quarter more (`FLORA_TALL`: beech 12.5–22.5 m, oak 14–25, maple 12.5–22.5), each tree where it ranks among the
  level's heights, its first limbs past two people's heights (4.3–5.2 m at the level's middle tree), so its crown
  stands over a walker's head as a grown tree's does; the painted level's heights (a forest's 8–14 m) put its lowest
  leaves at eye height. Needled crowns, bamboo and bushes keep the level's heights.
- **No ghost leaves** (`scene/channels/creases.js`, `scene/channels/form-flora.js`). The contact occlusion's prepass drew
  every plant where it would stand without wind, so a pale copy of each swaying leaf and twig showed beside it against the
  sky. A material that moves its vertices now names its own vertex shader for the prepass (`userData.prepass`), and the
  plants' bark, leaves, culms and blossom name their wind and a spray's growth: the occlusion falls where the frame
  draws them. A page without such a material draws every mesh in the prepass as before.
