### The arms library: modern and future guns and knives, drawn for the seventh generation

The equipment kernel gains an arms library (`control/lib/graph/equipment/arms/`): pistols (service, compact, heavy,
revolver), the carbine, rifles (assault, marksman, bullpup), the submachine gun, shotguns (pump, tactical) and knives
(combat, tanto, dagger, karambit), each in the modern, the future or the near line and a finish card, every part tunable by word.
Generic forms, no make or model. They are drawn by eight laws for the gen-7 look (a live key over materials told apart
by how they reflect): every major part a side outline pushed through its width; every edge chamfered to its part's
thickness so the key draws a highlight along it; bare or coated metal, a finish and the grip as three responses, a
future arm's one glow hue; the bore one line with the grip raked 18°; detail in three tiers, fewer and bigger as it
stylizes; a trigger guard's finger opening; the future line a transform of the same mechanics (facets, a shell gap, a
lit conduit, an emitter, a cell), so a blaster is held as a pistol; a blade read by its grind and a brighter edge bevel.
The machine gate (`stats.equipment.arms`) reads the laws back; the eyes gate is the operator's.

- **The build** (`mint_solid` workbench `build`, a hero's `gear`): `{ item, model?, line?, style?, parts?, dials? }`.
  Items `pistol`, `carbine`, `shotgun`, and the new `rifle`, `smg`, `knife`. Parts: `barrel` (a word or cm), `stock`,
  `magazine`, `optic` (irons, red dot, holographic, scope), `muzzle` (crown, flash hider, brake, suppressor, emitter),
  `rail`, `underbarrel` (foregrip, light, bipod), a shotgun's `grip`; a knife's `blade`, `length`, `guard`, `handle`,
  `serrations`. Finishes: black, fde, od, stainless, walnut (modern); white, gunship, titan, hazard (future); the
  firearm samples' `service` and `future` read as black and white.
- **Opt-in, byte for byte.** A `pistol`, `carbine` or `shotgun` build naming none of model, line, parts or an arms finish
  is the earlier firearm proxy, unchanged; the workbench mint and the hero's gear record stamp the item's default model
  on a new one, so rows minted before keep their bytes and new guns are the library's.
- **The hero holds them.** A rifle and an smg at low ready or slung like the carbine (no hip); a knife as a blade, on the
  hip at the left side.
- **Review:** `node scripts/render-arms.mjs <dir> [presets]` draws each arm side-on and from the front three-quarter
  with its triangles and its laws readout (a third-person pistol about 1.7k triangles, a marksman rifle about 7k).
- **The near line** (law 9: futuristic, styled real; `line: 'near'`): each new part shows what it does in a form a
  factory could make, shells are moulded and read by their parting lines and vent rows, and light appears only on a
  display. Its own models, each inspired by a modern design: the `smart` pistol (a moulded shroud, a recessed crown, an
  ammo counter), the `pdw` (a top-fed translucent magazine, a thumbhole), the `caseless` rifle (a monolithic shell, a
  top-loaded cassette, a sight on posts), the `coilgun` (countable copper coils in a skeleton of rails, a capacitor bank
  with its cells bare, a cable) and the `breacher` (a drum-fed shotgun). Any model takes the line (a smart sight, a
  seam, a round counter), every gun's optic takes `smart`, and four finishes carry it: slate, sand, ranger, arctic.
- Manual: the equipment card's modern and future arms section; the hero card's gear line.
