### Scenes in the seventh generation

- **A new scene is drawn in gen-7.** A walkable scene minted through `create_sketch`'s geocube kind (`words`, or `show:
  'path'` / `'trail'` written) has its cube's `era` stamped `gen-7` at mint (`era/geocube.js` stampSceneEra, beside the
  solid stamp in `lib/mcp/tools/sketch-mint.js`): its land, stones, grass, trees and bushes read as form under the cube's
  light, its plants in the wind. New is a scene with no seed yet (a path or a trail draws its seed at its first mint), so a
  row already minted, or one restored from its export through `create_sketch`, keeps the era it renders in; a cube that
  names its era keeps it (`cube.era: 'gen-6'` is the painted render). The `scene` routing card and the geocube manual say
  so. Of seventeen scene phrases from the card, fourteen land on island-noon (meadow, alpine, desert, grove flora) and
  draw wholly in gen-7; the three on jungle-haze ("a forest walk", "a jungle path", "a bamboo grove") wholly so too since
  bamboo has a form of its own (below).
- **Fixed on the way:** the form flora read a cube's whole `colour` as colours; a stamped cube carries its `shade` hue
  there too (`form/flora-read.js` reads only the colours it uses, as hex or bytes).
- **Gen-7 bamboo** (`form/bamboo-form.js`). A culm the vegetation library grows (vegetation/bamboo.js growCulm: jointed,
  tapering, nodding under its leaves, its branches alternating sides) read as form: its culm a tube through its nodes, a
  darker band at each (its colour its age's), its branches thin tubes; its leaves gathered into cells of 0.7 m, a clump of
  narrow `lance` leaves each facing out of the culm and up, and two sprays from each clump's heart inside its rim near the
  eye (the outline kept). A bamboo card's culms (era/isekai.js bambooItems) grow on the trail as Moso, the running grove's
  straight culm (`FLORA_BAMBOO`), three templates each a culm of its own at the clump's middle height, every culm turned
  to lean out of its clump's middle; its wood waxy and smooth in its own colours; in the wind it bends from its foot, more
  than a tree's limbs (`culmPhi`: it has no trunk, it flexes). Measured on a "bamboo grove in the morning" scene
  (jungle-haze): 53 plants, 0.21M to 0.25M triangles. A spray's twig strip now takes the leaf a shade darker (its brown
  over the leaf's green had tinted it pink).
- **The bamboo in the level's colours, and the painted copies gone.** A culm took its species' own green and stood out
  of the cube's palette (teal on jungle-haze's olive): it is now tinted 70% of the way to the level's foliage
  (`CULM_TO_LEAF`), and less glossy. The painted culms and leaf sprays still showed in the same places: a group drawn in
  several meshes (its faces split by their tiles) is one name in the page's `meshes`, and only the last was hidden; with
  the form's plants on the page every mesh of the groups it replaces is hidden (no plants: the page as it was).
