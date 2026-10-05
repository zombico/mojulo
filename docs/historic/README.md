# Historic cultures: how a civilization is added and deepened

A historic culture is a real place at its period, drawn from a cited record and held to a style card. Each one
reaches the agent as a `historic` world (`create_sketch({ manifest: { kind: 'historic', culture, scene } })`) and as
an encyclopedia entry (`get_view_vocab({ id })`, found through `semantic_search`). This page is the method; each
culture's own design language is in its folder here (`qin/`, `pompeii/`, `forum/`).

Every culture is a **general depiction** of its period, not one year's town: anachronisms are expected, and each
entry says so. The big read comes first: a culture is a palette plus a choice of shared visual patterns, so the
vocabulary stays composable across cultures.

## What a culture is made of

All under `control/lib/graph/historic/`:

| Part | File | Registered in |
|---|---|---|
| The card: palette, skins, patterns, the entry's contract lines | `cultures/<id>.js` | `cultures/index.js` |
| The record: materials, methods, types, forms, each cited with a confidence | `record/<id>.js` | the card's `record` |
| The style card: principles, each with a machine check in `style.test.js` | `style/<id>.js` | `style/index.js` |
| The assets: the culture's forms, built in a canonical frame from shared parts | `assets/<id>.js` | the card's `assets` |
| The layout: the plan that claims ground and emits slots | `layouts/<id>.js` | `layouts/index.js` |
| Its region: a label and the words people search with | `regions.js` | a row per region |
| Farm and works scenes: an estate, the industries | `farmstead.js`, `workshops.js` | the card's `land` |

Each registry is one line per culture, layout or region, so two cultures built at once merge with a "keep both".

## Depth: enter shallow, deepen in order

| Depth | It has | It borrows | Its entry says |
|---|---|---|---|
| 0 | a card in its own colours | another culture's kit and layout | "no record yet: read every part as CONJECTURAL" |
| 1 | + its record and style card | the kit and layout | the record's share: ATTESTED / RECONSTRUCTED / CONJECTURAL |
| 2 | + its own assets | the layout | |
| 3 | + its own layout (terrain, World page) | nothing | |

Depth is found, never claimed (`depth.js`): what a culture shares with one registered before it, by identity. The
entry's DEPTH line says it ("0 of 3: its card only; assets and layout from thebes"). A generic variant (the `polis`,
spread from Lindos) may keep its parent's record; a new culture never inherits another's record as its basis.

### Depth 0: scaffold it

```bash
cd control
node scripts/new-culture.mjs <id> --like <culture> --label "<label>" --years <from>,<to> --period "<name>" \
  (--place "<where>" | --invented) --region <region> --aliases "<word>,<word>" [--read-at <year>] [--dry]
```

Pick `--like` by the SHAPE of the town (its layout), not its look. The palette is what changes first:

| Layout | Culture | Shape |
|---|---|---|
| `ring-canal` | sumer | a walled ring cut by a canal, the precinct at the heart |
| `river-axis` | thebes | a river along the town, a temple on an axis from its quay |
| `plateau` | giza | a monument plateau over a valley town |
| `acropolis` | lindos, polis | a sanctuary on a rock over a terraced town |
| `wei-wards` | qin | walled wards on an axis from a palace to a river |
| `lava-spur` | pompeii | a gridded town round a forum on a spur |
| `forum` | forum | one civic space at measured positions |

The scaffold writes the card, its registry line and `docs/historic/<id>/README.md`. On the first run the culture
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

Do not one-shot the town. For each asset the layout calls for:

1. LAYOUT emits slots (`{ asset, rect, facing }`), not geometry. `assetCall(plan)` lists the distinct assets
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

### Depth 3: its own place

`layouts/<id>.js` on `layout-kit.js` (claim grid, split seeded streams so a dressing dial never moves a street),
registered in `layouts/index.js`; terrain and water on the World page where the site needs them. Views the layout
names render at eye level unless the scale table in `historic-city.js` says otherwise.

## Scenes beyond the town

`historic-kind.js` serves `city` for every culture; `region` (the town in its land) for the cultures in
`historic-region.js`; `farm` and `works` for a culture whose card names a `land` in `farmstead.js` /
`workshops.js` (none for a scaffolded culture until its own). A new scene is a row in `HISTORIC_SCENES`.

## Segments: new parts of the world

A region (the Indus, Mesoamerica, medieval Europe, the steppe …) is a row in `regions.js`: its label and search
words. Its first culture names it; a second makes it a hub that lists its entries in time order. Shared vocabulary
grows in `patterns.js` (a pattern seen across cultures, recorded once) and wall skins in `ground.js`.

## The gates

Machine, before a culture lands:

```bash
npx vitest run lib/graph/historic/cultures.test.js lib/graph/historic/entries.test.js lib/graph/historic/<id>.test.js
```

- The card contract (`entries.test.js`) lists any line a card still needs: `years`, `period`, `readAt` (or
  null), `place` (or null when invented), `region`, `aliases`, `record` (or null).
- The checklist (`cultures.test.js`): layout registered, style card owned, depth on the entry.
- Every other culture's pages byte-identical before and after (CSS and World): a shared change is a promise
  over already-minted recipes.

Eyes: the operator reads the town at street level and from the air, stage by stage. An agent never marks the
eyes gate passed.

## Landing a culture on the release-candidate trunk

1. Merge the trunk into the culture's branch first, so it builds on the current registries and contract.
2. Resolve: registries and the changelog keep both sides.
3. Run the gates above, and the page hashes of the other cultures.
4. The trunk merges the branch; no side branch remains.
