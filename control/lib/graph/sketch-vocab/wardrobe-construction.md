---
{ "id": "wardrobe-construction", "name": "wardrobe construction — dressing a figure body (instrument × mugen score × tailoring)", "summary": "author an outfit on a create_figure / character-sheet body from a CLOSED vocabulary. THREE garment families: (1) TAILORED SHELLS — an offset shell over the body's own flesh: pick an INSTRUMENT (tee/tank/dress/jacket/trousers/…), set its MUGEN SCORE (clearance = slim↔baggy, the ONLY looseness dial), then TAILOR with svgile-row cuts (wedge/band/neck/armhole) + recolour panels + color{cloth,under}. (2) HANGING SHEETS — a cape/cloak/tabard/cowl as a wave-field (fit:'wave-drape'): an open sheet pinned to a body anchor (shoulders/waist/neck) that sags + folds. (3) CUT-AND-SEWN PATTERNS (fit:'pattern'): flat pieces in cm with named edges, placed on a body CHART by anchor and sewn by SEAMS — the tailor's construction, with girths, seam ease and a printable sheet. All auto-track any proto/dimorph/fluff tuning — the same spec re-fits every body. Keys OR an inline { id, pieces, cuts, panels } spec; arrays LAYER (a cloak over a tee).", "when": "dress a character / figure body, design an outfit or wardrobe row, put clothes on a create_figure or character-sheet, make something 'oversized'/'cropped'/'open-front'/'baggy'/'fitted', add a cape / cloak / tabard / mantle / cowl / hanging drape, reconstruct a dreamed outfit as a garment spec, or layer garments (jacket over tank, cloak over tee), draft a garment from pattern pieces / a sewing pattern / measurements (bust, waist, hip), sew seams between pieces, read a body's girths. NOT textile prints (that is garment-pattern) and NOT the body itself (that is proto / figure-fluff).", "tier": "recipe", "marks": [], "phase": "p1" }
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

## 6. Cut and sewn — `fit: 'pattern'` (pieces in cm, seams, girths)

The third family is the tailor's own: a garment is FLAT PIECES in centimetres sewn together
on the body. The body supplies a **chart** per region (`trunk`, `armL/R`, `legL/R`, `neck`):
its posed rings as rows with arc-length tables, so a piece lands by arc length (no stretch
along its own axes) and the seams close where a tailor would put them. Nothing is simulated —
placement, stitching and hang are closed-form, like every other garment here.

```jsonc
{ "id": "shift", "color": { "cloth": "#b23a48" }, "stature_cm": 168, "ease_cm": 2,
  "pieces": [
    { "id": "front",   "fit": "pattern", "chart": "trunk",
      "outline": [[-24, 0], [24, 0], [24, 40], [-24, 40]],            // cm, counter-clockwise, +x = wearer's right, +y up
      "anchor": { "piece": [0, 40], "chart": { "u": "cf", "v": "collar" } } },
    { "id": "back",    "fit": "pattern", "chart": "trunk", "outline": [[-24, 0], [24, 0], [24, 40], [-24, 40]],
      "anchor": { "piece": [0, 40], "chart": { "u": "cb", "v": "collar" } } },
    { "id": "sleeveL", "fit": "pattern", "chart": "armL", "outline": [[-18, 0], [18, 0], [18, 25], [-18, 25]],
      "anchor": { "piece": [0, 25], "chart": { "u": "cf", "v": "shoulder" } }, "mirror": "sleeveR" } ],
  "seams": [
    { "a": { "piece": "front", "edge": "right" }, "b": { "piece": "back", "edge": "left" } },
    { "a": { "piece": "front", "edge": "left" },  "b": { "piece": "back", "edge": "right" } } ] }
```

- **`outline`** — a closed polyline in cm. Every piece has four runs, `top` / `right` /
  `bottom` / `left`, found at the outline's diagonal extremes (override with `corners:
  [tl, tr, br, bl]` vertex indices on a shaped piece); name finer edges with
  `edges: { shoulder: [i0, i1], armhole: [i1, i2] }` (outline vertex indices, in outline order).
- **`chart` + `anchor`** — where the piece sits: `anchor.piece` is the cm point on the
  piece that lands at `anchor.chart`, whose `u` is a girth fraction from centre-front
  clockwise from above (`cf` 0 · `sideR` 0.25 · `cb` 0.5 · `sideL` 0.75) and whose `v` is a
  landmark (`collar` / `bust` / `waist` / `hip` / `crotch` on the trunk; `shoulder` /
  `elbow` / `wrist` on an arm; `thigh` / `knee` / `ankle` on a leg) or a 0–1 fraction from the top.
- **`seams`** — pairs of `{ piece, edge }`. Each side is walked top → bottom by default
  (`reverse: true` flips one); `ease_to: 'a' | 'b' | 'split'` says which side the other is
  eased onto (the sleeve cap onto the armhole: `ease_to: 'a'` with the bodice as `a`).
  A dart is a seam whose two edges belong to the same piece.
- **`stature_cm`** (default 170) converts the figure to cm; **`ease_cm`** (default 1.5) is
  the stand-off from the skin; **`stitch_cm`** (default 2) the mesh cell; `mirror: '<id>'`
  clones a piece across the midline (chart and `u` swap L/R); `under: false` skips the
  under-colour shells; `cloth` per piece recolours it.
- **The hang rule.** Cloth wider than the body's girth cannot compress: it stands off by the
  ratio and keeps hanging below its widest row (`hang_sag`, cm of circumference per cm of
  drop, default 0.5). A straight shift bags out at the waist and hangs from the bust line.
  Cloth NARROWER than the girth is not stretched silently: it reads as **strain** and as a
  **seam gap**.
- **The readout** (`buildPatternGarment(body, spec).report`): the body's girths per chart
  landmark in cm; per piece `rows × cols`, `area_cm2`, `strain { max, mean }` (placed
  grid-edge length vs flat, the dart-need signal), `clipped`; per seam `len_a_cm`, `len_b_cm`,
  `ease_cm` with the tailor's label (`flat` ≤ 0.5 · `eased` ≤ 3 · `gathered`), and `gap_cm`
  (how far apart the two edges sat before the stitch closed them); `hang` per chart. All
  advisory — nothing refuses.
- **Girths without a garment:** `bodyGirths(body, { stature_cm })` reads bust / waist /
  hip / neck / upperArm / wrist / thigh / ankle, nape-to-waist, arm length and inseam off
  any figure. The natural waist is the smallest row between bust and hip and the hip the
  fullest row between waist and crotch — the tailor's rules, not a bone's centre.

### Slopers — blocks drafted from the body's own tape

Instead of an `outline`, a piece can name a **`sloper`** (`bodice-front` · `bodice-back` ·
`sleeve` · `skirt-front` · `skirt-back`) and `dials`; the block is drafted at BUILD time from
the chart it sits on (quarter bust plus half the ease at the bust line, the shoulder tip at
the crest's end — the acromion — with the crest's measured slope, the neck opening a quarter of
the neck's base girth where it rises through the crest, the sleeve cap no taller than the room above the armscye), so the same
recipe re-drafts on every body. Explicit fields (`outline`, `anchor`, `edges`,
`corners`) override the block's. Named edges a block gives you: bodice `hem · sideR ·
armholeR · shoulderR · neck · shoulderL · armholeL · sideL`; sleeve `hem · underarmR · cap ·
underarmL`; skirt `hem · sideR · waist · sideL`. Dials: bodice `hem` (`waist | hip | crotch |
knee | <cm>`), `ease_bust_cm` (6), `ease_waist_cm`, `ease_hip_cm`, `neck_drop_cm`,
`neck_width_cm`, `shoulder_cm`, `shoulder_drop_cm` (the crest's own slope), `flare_cm`; sleeve `length` (`short | three-quarter | long |
<cm>`), `ease_cm` (4), `ease_wrist_cm` (6), `cap_height_cm`; skirt `length` (`mini | knee |
midi | <cm>`), `ease_waist_cm` (2), `ease_hip_cm` (4), `flare_cm` (4).

A **shoulder seam** is an `over: true` seam: it lies OVER the body between its two edges. The
trunk chart is closed over the top by a CAP — rows over the yoke up to the CREST, the line from
the neck base to the acromion measured off the flesh, every row carrying the neck's base so cloth
near the centre lands around the neck by arc — so both shoulder edges lie on that line,
the stitched seam IS the crest, and cloth there rests a centimetre off the shoulder
(`crest_rest_cm`, never more than the ease) instead of standing an ease out sideways. An `over`
seam is never allowed through the flesh: whatever outline it is given, its stitched point is
raised to the crest. Its `gap_cm` is the true residual (≈ 0 for a block).

Pairing fact (deterministic, learned): a bodice whose hem reaches the hip **over** an
`aLineSkirt` interleaves with the skirt's waistband at the hip — two pattern layers at the same
stand-off, the same tear as `vest` + `tank`. Hem the bodice at the waist, or give the outer
layer more `ease_cm`.

Whole pattern garments are REPERTOIRE and live in the recipe book's `wardrobe` chapter (see §7),
not in core: core carries the blocks (`bodice-front/back · sleeve · skirt-front/back ·
trouser-front/back`), the book carries `shift-dress`, `a-line-skirt`, `straight-trousers` and the
outfit `shift-and-trousers` as `garment.json` / `outfit.json` — dials over blocks, data only.

**Trousers** are one piece on TWO charts: above the crotch a trouser block lies on the trunk (a
quarter of the trunk from the centre line to the side, its `cf` / `cb` edge straight on the body's
centre line where it is sewn to the other leg's piece), below the crotch on the leg (the front or
back half of the leg's tube), joined at the crotch with a FORK (the jut that carries the cloth
under the body, hip/16 in front and hip/8 behind). Any piece may declare `join: { chart, y,
anchor? }`: below piece height `y` it continues on `chart`, anchored there at the matching height
(or a named `v`), the two placements blended over `join.blend_cm` (8) so the piece crosses without a
step. Edges: `hem · inseam · fork · cf|cb · waist · outseam`; seams `front.inseam ↔ back.inseam`,
`front.outseam ↔ back.outseam`, `front.cf ↔ frontR.cf`, `back.cb ↔ backR.cb`. A MIRRORED piece keeps
its edge names on the same physical edge, so the right leg's seams read exactly like the left's.
Trouser dials: `length` (`ankle | knee | <cm>`), `ease_cm` (6), `ease_hem_cm` (16), `ease_waist_cm`
(2), `fork_cm`.

`create_figure` returns a **`pattern`** readout for a figure wearing one: the girths, every
seam's ease and gap, every piece's strain — read it before you look at the render.

The printable sheet is `GET /api/sketches/<ref>/pattern.svg` (`create_figure` returns it as
`patternSvgUrl`): the pieces flat at true scale with seam allowance, grain, notches and cut counts,
drafted on the STAND whatever pose the figure holds — the designer's rule: a pattern is drafted on
the dress form and worn on the pose, so the sheet never changes because the figure moved, while the
readout's strain and seam gaps are the posed body's. An outline authored in cm — from a drawing, a
book, or a dream read as pieces — is the door that stays open beside the blocks.

## 7. Outfits — the tiers, and the book's wardrobe

`garment` is the LOWERED form (and the compatibility promise: a minted row keeps rendering
byte-identical). `outfit` is the authoring form above it — a ladder where every rung is the rung
below with fewer decisions made. Pass ONE of the two to `create_figure`:

```jsonc
"outfit": "shift-and-trousers"                       // tier 1: a named outfit from the attached book
"outfit": { "fit": "relaxed",                        // tier 2: layers inner → outer, one global ease dial
  "layers": [
    "tee",                                            //   a garment NAME — a core shell, or a book garment
    { "garment": "a-line-skirt", "dials": { "length": "midi" }, "cloth": "#2f4a6d" },   // tier 3: name + dials
    { "id": "cape", "pieces": [ … ], "seams": [ … ] } //   tier 5: the craft tier, an inline spec
  ] }
```

- **`fit`** — `slim | regular | relaxed`: the stand-off of every pattern layer (`ease_cm` 0.75 /
  1.5 / 3) and a clearance scale on every shell (× 0.75 / 1 / 1.4). A layer's own `ease_cm` wins.
- **`dials`** merge into every `sloper` piece of that garment; a key that names a piece (`back`,
  `sleeveL`) scopes its object to that piece. Dials need a cut-and-sewn garment — on a shell they
  are refused at the door. `cloth` recolours the layer.
- **The layering rule.** Layers are worn inner → outer and an outer PATTERN layer is placed on the
  inner layer's hang, not on the skin: every stack already worn (shells included) lifts the chart
  rows it covers by its stand-off, and the hang rule runs over that. A bodice over a skirt no longer
  interleaves; the readout's `under` per chart says how much the inner layers lifted it.
- **The designer's rule.** A pattern is drafted on the STAND and worn on the pose: the sheet never
  changes because the figure moved; strain and seam gaps are the posed body's.

**The book's wardrobe.** Named garments and outfits are repertoire and live in the recipe book (or
the operator's cookbook) as data-only entries — `chapters/wardrobe/<id>/card.md` + `garment.json`
(a wardrobe spec) or `outfit.json` (`{ fit?, layers }`), rows `{ type: "garment" | "outfit",
chapter, dir, id }` in `manifest.json`. A book name is resolved BY VALUE at mint and stamped
`from: "book:<id>"` in the stored recipe, so the recipe never depends on the book again and book
drift never changes a minted figure; core names stay names. A core wardrobe key wins over a book
garment of the same id. Their cards join this catalog by their `when`, so an ask like "dress her
head to toe" recalls the outfit. Draft once in centimetres, `save_recipe` it to the cookbook, and
from then on "put my red shift on this figure" is a name.

`create_figure` answers with `patternSvgUrl` (the sheet) and the `pattern` readout whenever a
pattern layer is worn.
