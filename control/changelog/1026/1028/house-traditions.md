### Townhouse traditions: contemporary brownstone, London terrace, Dutch canal and Japanese small houses

The house library grows by four contemporary street-house traditions, each a style family (`floorplan-styles.js`),
a roofline (`architecture/roof.js`), its home windows per region and its furniture language (`furnishings/languages.js`):

- **brownstone** (North American rowhouse): coursed brown sandstone, a flat roof behind a deep projecting cornice
  (`roof: 'cornice'`), tall sashes, a dark lacquered door; parlour walnut, velvet and bouclé.
- **terrace** (London): yellow-grey stock brick or white stucco, slate with its ridge parallel to the street and its
  gables on the party walls (`roof: 'terrace-slate'`), six-over-six and two-over-two sashes, a navy, green or black
  door; roll arms, linen and tartan.
- **canal** (Dutch canal and infill houses): dark manganese or warm brick, a steep gable flush to the street
  (`roof: 'canal-gable'`) or a flat roof, tall tilt-turn and French windows in anthracite; low, spare, pale oak.
- **kyosho** (the Japanese small house): white render, charred cedar boards or corrugated galvalume, a galvalume
  mono-pitch (`roof: 'galvalume-shed'`) or a flat roof, aluminium sliders; hinoki floors, low and plain.

New facades: `facadeStyle: 'stone'` (coursed ashlar), `'render'` (smooth stucco at any storey height) and `'boards'`
(vertical timber on an open joint, charred cedar by default). A gable roof takes `ridge: 'short'` to turn its ridge
across the long way. A house of `houseLook: 2` rolls its family from its `form` and `design.tradition` (a townhouse
its tradition's street house, a block a modern one, a Japanese house kyosho); a house of the first look rolls from
the first five families, as always.
