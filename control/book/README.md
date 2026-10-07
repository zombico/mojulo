# The recipe book

The catalog of mintable recipes that ships with mojulo: chapters of study objects, math, worlds,
loops, solids, shots and a wardrobe, each a folder of plain text and JSON that a host agent mints
through mojulo's own tools. It loads on every install with no setup; `MOJULO_BUNDLED_BOOK=off` leaves
it unattached.

Until mojulo 3.1.0 this was the separate `mojulo-recipe-book` repo, attached by cloning it and setting
`MOJULO_RECIPE_BOOK`. That repo is frozen at 0.8.0 and the variable is deprecated.

- `manifest.json` declares every entry; bump `bookVersion` when you add one.
- `chapters/<chapter>/<entry>/` holds `card.md` plus `recipe.json` (data), `builder.js` (a new view
  kind), or `garment.json` / `outfit.json` (wardrobe).
- `tools/validate.js` checks the book. Run `npm run test:book` from `control/`.

How to write an entry, the builder contract and the review bar: [CONTRIBUTING.md](../../CONTRIBUTING.md#the-recipe-book).
