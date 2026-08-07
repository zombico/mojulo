---
{ "id": "wardrobe-construction", "name": "wardrobe construction — dressing a figure body (instrument × mugen score × tailoring)", "summary": "author an outfit on a create_figure / character-sheet body from a CLOSED vocabulary. TWO garment families: (1) TAILORED SHELLS — an offset shell over the body's own flesh: pick an INSTRUMENT (tee/tank/dress/jacket/trousers/…), set its MUGEN SCORE (clearance = slim↔baggy, the ONLY looseness dial), then TAILOR with svgile-row cuts (wedge/band/neck/armhole) + recolour panels + color{cloth,under}. (2) HANGING SHEETS — a cape/cloak/tabard/cowl as a wave-field (fit:'wave-drape'): an open sheet pinned to a body anchor (shoulders/waist/neck) that sags + folds. Both auto-track any proto/dimorph/fluff tuning — the same spec re-fits every body. Keys OR an inline { id, pieces, cuts, panels } spec; arrays LAYER (a cloak over a tee).", "when": "dress a character / figure body, design an outfit or wardrobe row, put clothes on a create_figure or character-sheet, make something 'oversized'/'cropped'/'open-front'/'baggy'/'fitted', add a cape / cloak / tabard / mantle / cowl / hanging drape, reconstruct a dreamed outfit as a garment spec, or layer garments (jacket over tank, cloak over tee). NOT textile prints (that is garment-pattern) and NOT the body itself (that is proto / figure-fluff).", "tier": "recipe", "marks": [], "phase": "p1" }
---

A wardrobe is authored in three layers, each a closed vocabulary an LLM can
emit *from looking at a dreamed character*. A garment is never sculpted — it is
an **offset shell over the figure's own flesh**, so it auto-tracks every
proto / dimorph / fluff tuning with zero garment-specific math (a tee on the
female pole follows the bust; on the male pole the pec plates). The same spec
re-tailors onto any body. Feed it to `create_figure.garment` or a
character-sheet `outfit.garment`.

## 0. Thesis first (before any dial)

Name the character in one line before dressing them — it makes the wardrobe
*read as designed*, not assembled:

- **role** — scout / shrine-keeper / courier / mechanic / relic-keeper
- **silhouette** — needle / bell / crescent / barrel / column (the outfit's
  overall mass; this is what the mugen score sculpts)
- **one iconic hook** — the single memorable garment beat (oversized hood,
  cropped jacket, floor-length gown, a sash)
- **material story** — a hierarchy, not a paint bucket: **dark body → one
  bright focus → one accent**. Map it to the tools below: `color.cloth` = body,
  a **panel** = accent, `color.under` = secondary/lining.

## 1. Instrument — the garment KEY (what it is)

Pass a wardrobe key (a string) for a ready garment:

- **base / underlayer** — `skinSuit`, `wetsuit` (hug the flesh; thickness only)
- **tops** — `tee`, `tank`, `tankStrapless`, `vest` (open front), `fittedShirt`
  (close-following, sleeved), `oversizedShirt`
- **dresses** — `dress` (shoulder drape to seat), `gown` (floor-length bell)
- **bottoms** — `trousers`, `trousersSlim`, `trousersBaggy` (per-leg wrap),
  `skirt` (single bell over both legs), `trousersRadial` / `skirtRadial`
  (pelvis-basin method)
- **outerwear** — `jacket` (open-front + full sleeves), `jacketCut`,
  `jacketAllCut`, `jacketPaneled` (see §4 for how these three differ)
- **hanging sheets** (`fit: 'wave-drape'`, see §5) — `cloak` (shoulder cape to
  the calf), `mantle` (short shoulder cape), `tabard` (waist-hung front panel),
  `cowl` (neck-hung, fanned across the shoulders)

`trousersSlim` vs `trousers` vs `trousersBaggy` differ ONLY in the mugen score
below — proof that looseness is a number, not a new instrument.

## 2. Mugen score — `clearance` (how loose)

`clearance` (a number in [0, 2], per piece) is the standoff of the shell from
the flesh — **the single looseness dial**. Small = fitted-but-not-skintight;
large = a loose outer layer that hangs off the body. Do not chase silhouette
bulk with the body dials (bicep/quad) — attribute an outfit's volume to the
garment's mugen score FIRST, the body second.

| feel | clearance (torso) |
|---|---|
| skintight (`hug` + `thickness`) | ~0.05 |
| fitted | ~0.10 |
| relaxed | ~0.14 |
| loose outer layer | ~0.21 |
| voluminous / gown | ~0.34+ |

"Oversized hoodie" = a jacket instrument at a fat score. Other per-piece knobs:
`thickness` (hug layers), `sag` (how far a drape falls), `term` (shoulder-cap
drape past the equator).

## 3. Tailoring — the svgile-row cuts & panels (how it's cut & sewn)

The image model's native construction register is CUT-AND-SEW panels, not ring
wireframes — so target this vocabulary directly when reading a dream. A garment
is **base cloth − cuts + panels**.

- **`fit`** (a piece's silhouette method, closed): `hug` (skintight offset) ·
  `hull` (smoothed convex shell) · `drape` (hangs from an anchor, sags) ·
  `wave-drape` (an OPEN hanging sheet — cape/cloak/tabard; see §5) · `radial` ·
  `pelvis` (pelvis basin) · `torso` (torso basin) · `shoulders` (crown-fan
  shoulder cap closing the torso→sleeve seam) · `sleeve` · `sash` (diagonal
  one-shoulder drape with fold ridges).
- **`cuts`** — the red-line cutter, action = DELETE fabric. `kind` (closed):
  `wedge` · `band` · `capsule` · `hole` · `halfspace` · `all` · `neck` ·
  `armhole`. Placed at body-relative anchors (`from`/`to`: `collar` / `hem` /
  `waist`; scope with `on: 'torso'` so an armhole never eats the sleeve).
  "Crop top" = `band` at the waist. "Open front" = `wedge` from collar to hem.
- **`panels`** — the DUAL of a cut, action = RECOLOUR (a contrast material):
  `{ region, … }`. Contrast yoke, contrast sleeves, a `band` cuff. This is
  where the material-story **accent** lives.

## 4. Inline spec & layering (the IKEA-parts move)

Instead of a key, pass an inline spec object (validated at mint against the
closed fit/cut vocabularies) — a wardrobe piece minted from primitives, re-usable
across bodies:

```jsonc
{ "id": "workJacket",
  "color": { "cloth": "#2b2f36", "under": "#a05a3a" },  // body + lining/secondary
  "pieces": [
    { "fit": "torso",     "clearance": 0.21, "coverage": ["torso"] },
    { "fit": "shoulders", "seamGap": 0.21, "term": 1.5 },
    { "fit": "sleeve",    "thickness": 0.20 } ],
  "cuts":   [{ "kind": "wedge", "from": "collar", "to": "hem", "on": "torso" }],  // open front
  "panels": [{ "region": "sleeve", "kind": "band" }] }                            // contrast cuff (accent)
```

**Layering** — pass an ARRAY; order is layering order (base → outer):
`garment: ["tank", "workJacket"]`.

### Pairing facts (deterministic, learned)

- ✅ `jacketCut` (or an open `jacket`) **over** `tank` — composes: the outer
  layer's higher clearance clears the base.
- ✅ `fittedShirt` + `trousersSlim` — the fitted registers agree.
- ❌ `vest` **+** `tank` — TEARS: two torso basins at similar clearance clip
  each other. Layer a torso piece only over a `hug`/`hull` base, not another
  basin.
- The three `jacket*` keys are one garment at three build methods: `jacket`
  (openings via basin superposition) → `jacketCut` (front opened by ONE `wedge`
  cut) → `jacketAllCut` (front + neck + armholes ALL as cuts, one cutter) →
  `jacketPaneled` (adds recolour panels). Prefer the cut/panel forms when a
  dream shows clear seams.

## 5. Hanging sheets — `fit: 'wave-drape'` (capes, cloaks, tabards)

A cape is NOT a tailored shell — it is an **open cloth SHEET** hung off the body,
so it is a different primitive: a **wave-field** (the same `wave-field` mesh mark
the polygonizer already mints). That is what makes a drape *provably* creatable
(see the gate below), not just plausible. A `wave-drape` piece:

- **`anchor`** — where the sheet's top edge pins (body-relative): `shoulders`
  (a cape/cloak/mantle), `waist` (a tabard/apron front panel), `neck` (a
  cowl/hood). The edge is read off the body's own parts, so one spec drapes any
  figure.
- **`hang`** — `back` (default) or `front` (a tabard drops down the chest).
- **`drop`** — how far the hem falls · **`flare`** — how much the hem widens ·
  **`back`** — how far behind (or in front of) the body it stands off.
- **`spread`** — widen/narrow the pinned top edge about its midpoint, so a narrow
  anchor (the neck) can fan into a shoulder-spanning cowl.
- **`waves`** — the rest folds, a superposition of plane waves (default = vertical
  pleats). **`pinToFree`** — the fold envelope grows 0 at the pinned edge → 1 at
  the free hem (a cape is still at the collar, billows at the hem).

Sheets render TWO-SIDED and still take svgile-row `cuts` (a neck yoke) + `panels`.
Compose several in one spec (a back cape + a front tabard + a collar) and LAYER
over a tailored base: `garment: ["tee", "trousers", "cloak"]`.

### The creatability gate (dreaming a NEW drape)

When a dream shows a cape whose fold pattern isn't a preset, DON'T sculpt it — 
**fit it**. `fitWaveDrape(foldField)` (lib/graph/polygonizer/wave-drape-fit.js)
asks whether a bounded superposition of plane waves reproduces the dreamed folds:

- **creatable** → the fitted `waves` ARE the recipe — drop them into a
  `wave-drape` piece. Proof and author are the same step.
- **not creatable** → the fold pattern is OUTSIDE the wave-field's reach: report
  it as a **named vocabulary gap**, do not invent geometry for it.

## Doctrine

Closed vocabularies only — every dial already exists and is clamped; no freehand
geometry from a dream. The garment spec is the sovereign recipe; a painted sheet
or skin is a bound derived render. Slim-vs-baggy is the score, not a new
instrument — grow the instrument table only when a character proves a piece the
cuts+panels can't already tailor. For a DRAPE, that proof is mechanical: the
`fitWaveDrape` gate either reaches the dreamed folds (and hands you the waves) or
names the gap.
