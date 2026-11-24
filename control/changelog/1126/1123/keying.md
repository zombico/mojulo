### Keying in play: characters on twos, the camera on ones

- **A level's bodies drawn on twos or threes** (`worlds/controllable/keying.js`, a level's `keying`). Limited animation
  in play: each animated body (a rig or a baked figure) is posed on its key and holds that pose between keys, at 24
  drawings a second's grain (twos: 12 poses a second; threes: 8), while the world steps, the bodies move through the
  level and the camera turns on every frame. Its clips keep their time: a held key catches up with the time it held.
  `keying: 'twos' | 'threes'`, or a layer each: `{ hero, cast, fps?, root? }` (the hero the player pilots, the cast
  every other body; `ones | twos | threes`). `root: 'held'` steps a body's place with its pose, the old cartoon's
  stride; absent, the place and the heading run on ones. A level without `keying` draws every frame, every byte as it
  was.
- **A game says it once** (`gameworld/keying.js`, a world's `keying`, laid on every level as its `tempo` is).
  `'auto'` reads the juice: the cel look (the anime fighter's and the brawler's, its effects already drawn on twos)
  keys its bodies on twos; the anime isekai look and the western register draw every frame. Read in the motion chapter.
- **The registry**: the time map's grain on twos, on threes and mixed (each layer its own) is built in play; the
  `sound` values are marked built (the sound sheet on every level and the score by request, 11-13; a played city's,
  11-16), where the registry had them waiting.
