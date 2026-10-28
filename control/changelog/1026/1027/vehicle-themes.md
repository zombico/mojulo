### Vehicle themes: the family layer brought back for the race machines

The vehicle family layer (`meta-fabricator.js`) was built to fill airports and streets with variations of the old nets'
vehicles. Its ideas now serve the race machines: a family's types, its decoration as data, and how a series is sampled.
The cars and parts are templates. A THEME is how a user makes one their own: a card of what it is painted, finished and
dressed in, worn by a cartoon racer or a supercar alike, varied across a field, and lit by the seventh generation.
No release has carried the race machines, so their recipes took the new key freely. The old nets' families and their
`vehicle-instance` rows are as they were.

- **The theme card** (`car-designer/vehicle-theme.js`):
  - `palette`: by slot (body, skin, trim, accent, frame, glass, seat, tyre, the driver's suit and helmet).
  - `finish`: the form render's material rows.
    - The paint: gloss, satin, matte, metallic, pearl (three's iridescence) or candy.
    - The trim's metal: alloy, chrome, brass, gold, copper, gunmetal or black. It also colours the trim where the
      palette names none, and a gloss wheel's lip and boss.
    - The colours that glow (`glow: ['accent', 'skin']`), each in its own colour.
  - `livery`, and `shape`: the vehicle sheet's facets the racer is read with.
  - `prefer`: the parts a racer's solver reaches for, or null to leave an optional family off.
  - `supercar`: the supercar's own words (cabin, headlights, vents, spoiler, preset).
  - `vary`: how a series varies it.
  - **Written three ways:**
    - a starter's name: `candy`, `steampunk`, `neon`, `military`, `royal`, `heritage`, each a distinct look;
    - a card of the user's own;
    - a card over a starter: `{ from: 'steampunk', palette: { body: '#20304a' } }`.
    - Every word is checked, and an error names the known ones.
  - **A series:** the k-th car is the theme with its hues turned within the theme's spread. The same turn applies to
    every colour, so the harmony holds; the trim's metal never turns, and its liveries come in turn. Car 0 is the theme
    itself, and `{ from, variant }` names any other.
- **On a cartoon racer** (`racer.js`, `roster.js`; a recipe's `theme`):
  - **Reading:** the theme's shape and livery are read in place of the driver's, each with its reason.
  - **Parts:** the solver ranks the theme's parts ahead of the fits, and a pin still wins. The laws still judge and
    advise: a theme can leave one advised, and the readout says so.
  - **Paint:** the palette goes on the slots, over the outfit's.
  - **Finish:** the material rows the page lights it with. A colour that glows is its own material (`glow:accent`,
    `glow:skin`), shining as a lamp does, unshaded.
  - **A roster in a `series`:** each racer without its own theme wears the next variation. The balance lean swaps a
    family the theme names only for another of the theme's own parts.
- **On a supercar** (`supercar-figure.js` `supercarOfSpec`; a spec's `theme`):
  - The palette is its paint and its livery's second colour, under the spec's own surface words.
  - The trim's metal goes on its alloy.
  - A glowing skin lights its stripes in the form render.
- **In a quick race:**
  - `series` themes the whole field of racers or supercars, each car its own variation.
  - A supercar entry takes its own `theme`, and a themed car is painted by it, not by the solved liveries.
- **The family layer, version 2** (`meta-fabricator.js`):
  - **The families:** `racer` (the parts grammar; its types the driver archetypes) and `supercar` (the surface
    compiler; its types the library's cards) sit beside the nets' four. Their decoration kind is `theme`.
  - **Describing:** `describeFamily` gives an authoring surface the types, the starters, the finishes, a card's keys
    and (the racer's) the parts vocabulary a theme prefers from.
  - **Sampling:** draws a recipe on the dice it is given.
  - **Building:** loads the race machines only when one is built (`car-designer/race-families.js`), so it is
    asynchronous.
  - **Previewing:** a `vehicle-instance` takes `{ racer }` or `{ supercar }`, so `mint_solid { kind: 'vehicle' }`
    previews a themed race machine on the studio grid, with its light painted in.
  - **Docs:** the `vehicle` solid card and the `design-vehicle-family` catalyst say how a user writes a theme: no
    source edit, no registry row.
- **Held** (`vehicle-theme.test.js`, `meta-fabricator.test.js`). Each concept is tested on a starter chosen in code by
  what it carries:
  - the card read and refused;
  - a series' variation;
  - the finish's rows;
  - on a racer: the theme's shape, its preferred parts under a pin, a family left off, its palette, its finish and the
    glowing colours, and no key without a theme;
  - a roster in a series, and the lean keeping to the theme's parts;
  - on a supercar: paint, livery, the spec's surface over the theme's, the trim's metal and the glowing stripe;
  - the quick race's words;
  - the families described, sampled on the dice, built, previewed and refused.
  - No theme: every figure as it was.
- **Seen:** `scripts/render-themes.mjs` renders each starter on a racer, two of its series' variations and a supercar
  in the lit material review. The eyes gate is open.
- **Not built, said:**
  - A theme's own part (a block card in the user's recipe, beside the library's rows).
  - A race reading a user's previewed vehicle by its ref.
  - The studio grid drawing the form render: the preview paints its light in, and the finish shows in the race.
