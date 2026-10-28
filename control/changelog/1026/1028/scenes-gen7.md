### Scenes in the seventh generation

- **A new scene is drawn in gen-7.** A walkable scene minted through `create_sketch`'s geocube kind (`words`, or `show:
  'path'` / `'trail'` written) has its cube's `era` stamped `gen-7` at mint (`era/geocube.js` stampSceneEra, beside the
  solid stamp in `lib/mcp/tools/sketch-mint.js`): its land, stones, grass, trees and bushes read as form under the cube's
  light, its plants in the wind. New is a scene with no seed yet (a path or a trail draws its seed at its first mint), so a
  row already minted, or one restored from its export through `create_sketch`, keeps the era it renders in; a cube that
  names its era keeps it (`cube.era: 'gen-6'` is the painted render). The `scene` routing card and the geocube manual say
  so. Of seventeen scene phrases from the card, fourteen land on island-noon (meadow, alpine, desert, grove flora) and
  draw wholly in gen-7; the three on jungle-haze ("a forest walk", "a jungle path", "a bamboo grove") draw their land in
  gen-7 and keep the bamboo kit's painted trees until bamboo has a form of its own.
- **Fixed on the way:** the form flora read a cube's whole `colour` as colours; a stamped cube carries its `shade` hue
  there too (`form/flora-read.js` reads only the colours it uses, as hex or bytes).
