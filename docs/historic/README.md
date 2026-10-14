# Historic cultures: how a civilization is added and deepened

A historic culture is a real place at its period, drawn from a cited record and held to a style card. Each one
reaches the agent as a `historic` world (`create_sketch({ manifest: { kind: 'historic', culture, scene, focus?, form? } })`),
with a field guide (the mint's `guideUrl`), and as an encyclopedia entry (`get_view_vocab({ id })`, found through `semantic_search`). This page is the method; each
culture's own design language is in its folder here (`qin/`, `pompeii/`, `forum/`).

Every culture is a **general depiction** of its period, not one year's town: anachronisms are expected, and each
entry says so. The big read comes first: a culture is a palette plus a choice of shared visual patterns, so the
vocabulary stays composable across cultures.

Nothing about a town is laid by hand. The SOLVER (`solver/`) lays every culture's town from its FORM (`form/`: the
principles its town is laid out by, as data), seats its MONUMENT (`monuments/`: the one hand-authored building) and
reads what its builders had at its place and year from the LEDGER (`ledger/`: every cited record as one table). The
same form lays the town (`scene: 'city'`), the town in its land with its farms and crafts (`'region'`) and a slice of
life cut from the region round a focus (`'slice'`).

The solver is one module per layer, each a table keyed by the form's own words: `solver/armature.js` (`ARMATURES`),
`solver/enclosure.js` (`ENCLOSURES`), `solver/streets.js` (`STREETS`), `solver/placement.js` (`WHERE`) and
`solver/land.js` (`TREES`, `ACTIVITY_WHERE`). A town that needs a principle no culture has yet (a market place, a
bastioned wall, a river through the town) gets it as one entry in its layer's table; the form's schema takes the new
word from there.

## What a culture is made of

All under `control/lib/graph/historic/`:

| Part | File | Registered in |
|---|---|---|
| The card: palette, skins, patterns, the entry's contract lines | `cultures/<id>.js` | `cultures/index.js` |
| The record: materials, methods, types, forms, each cited with a confidence | `record/<id>.js` | the card's `record` |
| The style card: principles, each with a machine check in `style.test.js` | `style/<id>.js` | `style/index.js` |
| The assets: the culture's forms, built in a canonical frame from shared parts | `assets/<id>.js` | the card's `assets` |
| The form: site, water, armature, enclosure, streets, density, placement, hinterland, activities, each citing its record | `form/towns.js` | a row per culture (or the card's `form`) |
| The monument: one building, at the record's size, in its own frame | `monuments/index.js` | the form's `armature.monument` |
| Its region: a label and the words people search with | `regions.js` | a row per region |
| The land's kits: the farm's and the works' assets, laid as the form's activities | `land-kits.js` | the card's `land` |
| Its period music: a synthesized mood, opt-in on a world (`audio.soundtrack: 'default'`) | `soundtrack.js` (`MOODS`) | the card's `soundtrack` |

Each registry is one line per culture, form, monument or region, so two cultures built at once merge with a "keep both".

## Lineage: start from what history carried into it

Cultures draw on cultures. A culture card's `draws` names the earlier cultures it builds on and what each relation
carries (`lineage.js`); the encyclopedia shows it on each entry (LINEAGE) and as the tree (`historic-lineage`).

| Kind | Means | Its record carries |
|---|---|---|
| `continues` | the same land, a later period (Ptolemaic Thebes ← New Kingdom Thebes) | materials, methods, buildings, the town's form |
| `inherits` | a tradition carried to another place (Byzantium ← Rome) | materials and methods |
| `contact` | forms taken across cultures, by trade or rule (Hellenistic Egypt ← Greece) | materials and methods |
| `contemporary` | the same culture at the same time, elsewhere (the Forum ↔ Pompeii) | materials and methods |
| `variant` | a generic or sibling version (the polis ← Lindos) | everything |

A relation's `parts` are what it carries: `palette`, `skins`, `patterns`, `assets`, `form`, `record`. Before
scaffolding a culture, name its relations: `--draws thebes:continues,lindos:contact` writes them on the card, joins
the patterns they carry, and writes a BRIEF into its README: from each source, the patterns, skins, assets and the
record entries in use at the new culture's year. Those record entries are the source's own: a PARALLEL to verify,
never the new culture's basis until its own record cites them.

Relations are history, held to it by `lineage.test.js`: a source is registered, never the culture itself, never an
ancestor of itself; it begins before the culture drawing on it ends; a continuation begins earlier; a variant shares
its form. What a culture shares in code is its depth, a separate thing.

## Styles: build in a tradition, compose from the inventory

A way of building that spread over many places (timber framing, later brick gables or Baroque fronts) is a TRADITION
record (`record/<tradition>.js`, registered in `ledger/records.js` with `tradition: true`): its materials, methods,
house types and forms, each cited, each row dated for the tradition at large and, where it came later or ended
earlier somewhere, by region (`spread: { germany: { from: 1300 } }`, read up `regions.js`'s `within` chain). A card
names the traditions it builds in (`styles: ['timber-frame']`, or `--styles` on the scaffold); the ledger reaches
their rows at the card's region and year, house types included.

The buildings come from the INVENTORY (`inventory/`): a style is a building language as data (`inventory/styles.js`:
walls storey by storey, the cap's form, pitch and covering, the lights, the door, the ornaments, in the era library's
element-set shape) naming its tradition record and the rows it stands on; spoken as a use (dwelling, shop, workshop,
barn, hall, tower) it is a kit asset (`inventoryKit({ house: { style: 'fachwerk', use: 'dwelling' } })`), painted from
the card's palette. A culture in a tradition the inventory already speaks starts with houses, not boxes: its kit is
inventory assets beside its own monuments, and the anachronism check reads the style's rows wherever it is built.

Rothenburg (`cultures/rothenburg.js`, `assets/rothenburg.js`) is the worked example: a card that names `styles`, a
kit whose houses are `inventoryKit` entries (`terrace: true`, `storeys` from the record's house types), a church from
the landmark library (`landmarkAsset`), and hand-built pieces only where the town is its own (its wall, its town hall's
tower). Its form uses the later-town rules: the `market` armature, an `off-square` second anchor, frontage plots.

## Depth: enter shallow, deepen in order

| Depth | It has | It borrows | Its entry says |
|---|---|---|---|
| 0 | a card in its own colours | another culture's kit and form | "no record yet: read every part as CONJECTURAL" |
| 1 | + its record and style card | the kit and form | the record's share: ATTESTED / RECONSTRUCTED / CONJECTURAL |
| 2 | + its own assets | the form | |
| 3 | + its own form and monument | nothing | |

Depth is found, never claimed (`depth.js`): what a culture shares with one registered before it, by identity. The
entry's DEPTH line says it ("0 of 3: its card only; assets and form from thebes"). A generic variant (the `polis`,
spread from Lindos) may keep its parent's record; a new culture never inherits another's record as its basis.

### Depth 0: scaffold it

```bash
cd control
node scripts/new-culture.mjs <id> --like <culture> --label "<label>" --years <from>,<to> --period "<name>" \
  (--place "<where>" | --invented) --region <region> --aliases "<word>,<word>" [--read-at <year>] \
  [--draws <culture>:<kind>[:<part>+<part>],…] [--dry]
```

Pick `--like` by the SHAPE of the town (its form), not its look. The palette is what changes first:

| Culture | Site and water | Armature | Streets |
|---|---|---|---|
| sumer | flat, a canal through a ring-walled town | the ziggurat at the heart | a meander from the gates |
| thebes | a river along the town | the temple at the end of an axis from its quay | a lattice |
| giza | a plateau over the floodplain, a canal below | the pyramid on the high ground, a causeway down | a grid of workers' blocks |
| lindos, polis | a hill in terraces, the sea | the temple on the summit rock, the climb | streets along the contours, stairs |
| qin | a bluff over a river | the palace on the tableland, an avenue to the bridge | walled wards on a grid |
| pompeii | a spur, a ring wall on its lip | the temple at a forum's head | a grid |
| forum | flat | the temple at a forum's head | a grid |

The scaffold writes the card (with `form: '<like>'`: the form its town is laid out by until its own), its registry
line and `docs/historic/<id>/README.md`. On the first run the culture
renders, mints and is an entry. Then set its `palette` (and `skins`) from reference images: at depth 0 it is still
its parent's town in its parent's colours, and the DEPTH line says so.

### Depth 1: the record and the style card

- `record/<id>.js` in the format of `record.js`: each entry `{ id, name, kind, confidence, sources, disputes? }`.
  `confidence` is `read` (a source stating it was read), `secondary` (through a page naming the source) or
  `unverified` (a snippet or the standard account). The entry maps them to ATTESTED, RECONSTRUCTED, CONJECTURAL.
  Carry the disputes and hold anachronisms at their dates (a later form is named as an analogue, never as fact).
- `style/<id>.js`: principles as sentences, the numbers the light and sky read, and a machine check per principle
  in `style.test.js`. Register it in `style/index.js`.
- Set `record` on the card. Optionally a `readAt` year from the record (a constant there, as `QIN_READ_AT`).

### Depth 2: its own forms (the asset loop)

Do not one-shot the town. For each asset the solver calls for:

1. The SOLVER emits slots (`{ asset, rect, facing }`), not geometry. `assetCall(plan)` lists the distinct assets
   with counts and size envelopes: the design brief.
2. DESIGN: a reference sheet per asset (a clay massing sheet from the optional local image worker, or the
   operator's drawings, indexed in this folder). A sheet is a reasoning aid, never the artifact.
3. BLUEPRINT: `assetBlueprint` draws the asset from its own parts (elevations, plan, parts table, its `read` and
   `notes`). Check the sheet against the blueprint before rendering.
4. KIT: build it in `assets/<id>.js` in the canonical frame (front = −y, metres) from shared pattern parts
   (`assets/kit.js`, `patterns.js`); it fits its slot's rect and turns to its facing.
5. PLACE and REVIEW: render beside the sheets. A missing read is a kit change or a new sheet, not a planner hack.

Art (statuary, stelae, reliefs) stands at thresholds and on the sacred axis; street structures (wells, kilns,
granaries, boats) where they are needed. Placement is by meaning, never scatter.

### Depth 3: its own form and monument

A row in `form/towns.js`, held to `form/schema.js` (`{ from: '<culture>', …changes }` to start from another's):

- `site` (landform, which side is high, how high), `water` (none, canal, river, sea), `armature` (heart, axis,
  summit, forum: where the monument stands and how it is approached, its precinct), `enclosure` (ring, wards, none),
  `streets` (meander, lattice, grid, contour; widths, block spacing, jog), `density`, `houses`, `walls`, `placement`
  (by meaning: crossings, the precinct's gate, before the monument, the wall's strip, the water …), `hinterland`,
  `activities` (the farm's and the works' assets, by need), `borrow` (another culture's kit where this has none).
- `cites`: the record's rows each principle stands on. The field guide shows them, with their dates and basis.
- Its monument in `monuments/index.js`: one building, its parts in its own frame (front −y) from the kit, at the
  record's size, citing what it stands on. Everything round it is the solver's.

Then drop `form` from the card. The anachronism check (`ledger/`) runs on every solve: a skin, a monument or a
principle whose rows are not in reach at the town's year is a finding, and an activity whose `cites` are not yet in
reach is left out (Sumer at 3175 BCE has no kar). The walk laws (`fronts`, `connected`, `monument-fits`) advise.

## Scenes and the field guide

`historic-kind.js` serves `city`, `region` and `slice` for every culture: one solve at three frames. A slice is cut
round a `focus` (an activity's id, or `street`, `monument`, `water`, `gate`, `market`; `sliceFoci` lists them). A
manifest's `form` rewrites any part of the culture's form, refused by name. `/api/sketches/<ref>/bible` serves the
scene's field guide (`field-guide.js`): every choice, the knob that changes it, the record behind it.

## Statues on a city's slots

A city's statue slots are the places the solver already set a statue: a monument built outside a kit with the forum
asset's `figure()` (its masses carry `building: <monument id>`, so the slot is the monument's id), or a statue asset's slot (`ln-statue`, `pp-statue`, Sumer's `votive-row`: one figure
per plinth; Thebes's `eg-colossus`: a seated king, his throne coming down with him), addressed `<asset>:<n>`. A `historic` manifest's `statues: [{ ref, at, figure?, height? }]` stands a stored statue (a hero carved
with `/hero/statue`, `lib/graph/statue/`) on a slot in the World: the stand-in figure's masses come down, its base
stays, and the World resolver fits the statue's own faces there at the stand-in's height and facing, baked under the
city's sun (`historic/statues.js`). The entry card's `STATUES` line lists the slots. For a new culture's statues to take
one, build the stand-in with `figure()` inside a `mark()`, or as a statue asset's slot. An equestrian stand-in (a
`horseman()`, Pompeii's `pp-equestrian`) takes a mounted statue (`stand: 'mounted'`), facing as its horse did. An entry
may name a library form instead of a stored statue (`form: 'sphinx'`, `control/lib/graph/statue/forms.js`): Giza's
`gz-sphinx:0` takes the carved sphinx, Thebes's sphinx rows the criosphinx, Sumer's guardians the bull. A new form
is a ring plan in `polygonizer/` and a row in `STATUE_FORMS`. `statues: "carved"` carves every slot at once
(`carvedEntries`: a slot asset's own form or build, a horseman on an equestrian slot only, else the culture's card in
`CARVED_CARD`); a new culture with slots adds its card there.
A stand-in inside an instanced template (a `place()`d building's repeated part) cannot come down yet.

## Segments: new parts of the world

A region (the Indus, Mesoamerica, medieval Europe, the steppe …) is a row in `regions.js`: its label and search
words, and the larger region it lies `within`, if any. Its first culture names it; a second makes it a hub that lists
its entries in time order. Shared vocabulary
grows in `patterns.js` (a pattern seen across cultures, recorded once) and wall skins in `ground.js`.

## The gates

Machine, before a culture lands:

```bash
npx vitest run lib/graph/historic/cultures.test.js lib/graph/historic/entries.test.js lib/graph/historic/lineage.test.js lib/graph/historic/<id>.test.js
```

- The card contract (`entries.test.js`) lists any line a card still needs: `years`, `period`, `readAt` (or
  null), `place` (or null when invented), `region`, `aliases`, `record` (or null).
- The checklist (`cultures.test.js`): a form (its own or its card's), style card owned, depth on the entry.
- The lineage (`lineage.test.js`): relations registered, in time, without cycles.
- Every other culture's pages byte-identical before and after (CSS and World): a shared change is a promise
  over already-minted recipes.

Eyes: the operator reads the town at street level and from the air, stage by stage. An agent never marks the
eyes gate passed.

## Landing a culture on the release-candidate trunk

1. Merge the trunk into the culture's branch first, so it builds on the current registries and contract.
2. Resolve: registries and the changelog keep both sides.
3. Run the gates above, and the page hashes of the other cultures.
4. The trunk merges the branch; no side branch remains.
