---
name: historic-culture
description: Add or deepen a historic culture (a real city or civilization at its period) in the historic-city generator — scaffold a new one at depth 0 on an existing layout, take one to its record and style card, its own assets or its own layout, add a region for a new part of the world, or land a culture branch on the release-candidate trunk. Use when asked to "add a civilization / city / culture", "start the Indus / Maya / Babylon …", "deepen <culture>", "give <culture> its own record / assets / layout", or "land / merge <culture>". Invoke as `/historic-culture <ask>`.
---

# /historic-culture

Read the guide first, every time: [docs/historic/README.md](../../../docs/historic/README.md). It is the method
(depths, the asset loop, the card contract, the registries, the gates, landing on the trunk). This skill is the
order of moves.

## 1. Where is it now?

```bash
cd control
npx vitest run lib/graph/historic/cultures.test.js lib/graph/historic/entries.test.js
```

For an existing culture, read its entry's DEPTH and BASIS lines (`lib/graph/historic/entries.js` `entryCard('<id>')`,
or `get_view_vocab({ id: '<id>' })` through the MCP). The next step is the next depth, never a skip.

## 2. A new culture: depth 0

1. Settle with the operator: the place, the period and a read-at year (or none: a general depiction of the
   span), the region (a new row in `lib/graph/historic/regions.js` if it is a new part of the world), and which
   existing layout has the town's SHAPE (the guide's table).
2. Dry run, then write:
   ```bash
   node scripts/new-culture.mjs <id> --like <culture> --label "…" --years <from>,<to> --period "…" \
     --place "…" --region <region> --aliases "…" --dry
   ```
3. Run the gates (step 1). Mint it: `create_sketch({ title, manifest: { kind: 'historic', culture: '<id>' } })`.
4. Tell the operator plainly: at depth 0 it is the parent's town in the parent's colours; the palette is next.

## 3. Deepen

- Palette and skins from reference images (indexed in `docs/historic/<id>/`).
- Depth 1: `record/<id>.js` (cited; confidence read / secondary / unverified; disputes; anachronisms held at their
  dates) and `style/<id>.js` (a machine check per principle in `style.test.js`); `record` on the card.
- Depth 2: the asset loop, one asset at a time (layout slots → `assetCall` → sheet → `assetBlueprint` → kit →
  place → review). Never one-shot the town.
- Depth 3: `layouts/<id>.js` on `layout-kit.js`, registered in `layouts/index.js`; `layout` on the card.

Each step: write its plan and its CHANGELOG `###` section first (CLAUDE.md), keep every other culture's pages
byte-identical, and stop at the eyes gate for the operator. Never claim the eyes gate passed.

## 4. Land it on the trunk

Merge the release-candidate trunk into the culture's branch first; registries and the changelog keep both sides;
run the gates and the other cultures' page hashes; then the trunk merges the branch (no side branch left).
