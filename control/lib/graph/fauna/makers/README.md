# Fauna makers

A **maker** is a species-free body generator: a function from a small, documented parameter object to the
fauna params `buildFauna` accepts once merged over its family's table (`mergeParams(FAMILIES[p.family], p)`).
Families own the shared tables (palette, eye, skin controls); makers own the geometry that parameterizes to
many animals. Each file's header lists every parameter with units and ranges.

- `fish.js` — `fish({ skeleton: 'bony' | 'cartilage', length, … })`, over the teleost / chondrichthyan tables.
  The original generators `fishMaker` (bony) and `cartilageFish` (cartilage) are exported unchanged.
- `serpent.js` — `serpent({ path, girth, profile, head, … })` / `serpentMaker`, plus the path helpers
  (`path3`, `sinuous`, `spiral`), over the squamate table.
- `wing.js` — `featherWing(...)` and `membraneWing(...)`, wing data for `../wing.js`.

## Adding a species as a maker call

In the family file (`families/<family>.js`), add one entry to `species` that is just the maker call, with the
usual thesis comment (what makes it read as that animal, and the published size with a source):

```js
import { serpent } from '../makers/serpent.js';
export const species = {
  // GREEN ANACONDA (Eunectes murinus). Thesis: … ~5 m long (source).
  anaconda: serpent({ name: 'a green anaconda', girth: [0.15, 0.13], path: { kind: 'coil', … }, head: { … } }),
};
```

Then check it: `node scripts/fauna-fit.mjs --species <id> [--pose swim] --targets '{"length":…}' --out <dir>`
(the closed / attached / size gates), and render a card. The same params mint directly, without a species
entry: `mint_solid({ kind: 'animal', spec: { maker: 'fish' | 'serpent', params } })`.

**Changing a maker changes every species built on it.** Snapshot `JSON.stringify(speciesPlan(id))` for all
species before the change and compare after; existing species must stay byte-identical unless the change
says otherwise (recipes, not renders).
