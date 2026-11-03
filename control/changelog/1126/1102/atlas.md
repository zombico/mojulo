### The atlas: a gameworld drawn as an illustrated map

A gameworld's levels, trails and links can now be read as one illustrated map, at `/bible?book=atlas`
(`gameworld/atlas.js`, `gameworld/atlas-html.js`). The map is drawn from the world's own recipe:
- **The levels:** each is a province on one sheet, laid out from the hub (or the start) along its links, the first
  ways across the sheet and the rest round.
- **The ground:** grown as its land and words say: woods and hill bands massed from seeded noise, pines where its
  words are alpine, peaks where it climbs or a castle stands, a river from the heights to the sea.
- **The trails:** each level's trail winds through its stages, from where it is reached to where it leads. A stage
  shows as a dot, a climb as a wedge, a building as a square.
- **The places:** the hub ringed by its walls, its town, the castle.
- **The links:** each is drawn as its kind, a road a dashed track and a gate a dotted way with its arch, with a key
  where it is locked.
- **The sheet:** a cartouche, a compass and a scale.

The page is HTML and CSS alone, with no WebGL, canvas or library. The ground is SVG and the things on it are a layer of
sprites. Flat, it reads as a drawn map. On the table, a CSS-3D tilt lays the ground back, every sprite stands up off
it, and a drag turns the table.

Its looks are cards of paint only, and every look lays the same map:
- **painted:** the world's own solved colours on warm paper;
- **ink:** an engraving in one ink on cream;
- **night:** a star chart with glowing trails.

The world bible links it, and the next-moves card names it. The atlas is deterministic, from the world's seed alone.
