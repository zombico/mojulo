# Cherry grove in bloom: spike

Branch: `1004-wind-element`. The goal is a hanami grove: cherry trees in full bloom whose petals the wind strips in gusts, drifting down and carpeting the lawn, then lifting again. It widens what flies around in the wind from things lying on the ground (leaves, dust) to things a plant gives off.

## What it adds, and where

- **A cherry** (`vegetation/species.js` `cherry`, Prunus × yedoensis 'Somei-yoshino'). It is Rauh's upright trunk made decurrent through a new `over` on the species: apical control 0.50 → 0.44 and limbs set at 52/64/74°. It forks low into a dome. Measured over three seeds: about 5 m tall, crown radius 0.73–0.86 of the height, crown starting a third to halfway up.
  - Rauh as-is is an oak.
  - Troll grows a tall leader with tiered limbs, a pagoda.
  - Weaker apical control below about 0.46 gives a 3 m shrub.
  - Leeuwenberg dies back when its foliage is kept two years.
- **Bloom** (`bloom` on the species, `pool.js`): every leaf face is recoloured between a deep, a petal and a lit pink by its own baked leaf tone, so the crown's light carries over into the blossom. Green young shoots become dark twigs.
- **Blossom fill:** the cluster blobs conserve the leaves' coverage, which is right for leaves, but a sparse crown stays sparse. Two numbers fix it:
  - `bloom.fill: 3` (`ladder.js`, opt-in, default 1) multiplies the clusters' leaf area, because a flowering spur carries several flower clusters.
  - `leafLife: 2` keeps blossom along two years of spurs, not only at the shoot tips.
- **`plants.kinds`** (`terrain/terrain-plants.js`): a list of species that replaces the climate's trees, as `grass.kinds` does. The climate's shore (reeds) stays. The cherry's crown ratio is 1.0, so the grove stands about 6 m apart with lawn between.
- **Petals** (`debrisKernel`, kind 2): the page names the blossoming crowns near the camera from the plants' own tiles every half second (`setSources`).
  - A petal is held on its tree until the wind in a crown passes 3 m/s, then released at a rate that grows with the excess. A gust strips a tree; a lull lets it be.
  - It flutters down at about 0.5 m/s, swinging about its path.
  - It lands, lies 12–30 s, and is held again, so a crown in bloom always has petals to give.
  - Two in five petals are the carpet under the trees: never held, only lifted again by the wind.
  - Where nothing blooms, the page carries no petals (`petals: 0`).

Worlds without a cherry, or without `wind`, are byte-identical to `main`. This was checked by hash against a detached `main` checkout, and the plant characterization pins pass.

## Run from control/

```sh
node scripts/spikes/sakura/grove-page.mjs /absolute/out.html [speed m/s = 6] [petals = 4000]
```

Bookmarks:
- **under the trees:** the canopy overhead and petals falling around you.
- **grove edge:** standing back, the lawn carpeted.
- **downwind:** looking back into the wind as it carries petals toward you.

## Verification

Machine gate: `wind.test.js` 19 pass. They cover:
- Petals: none show without a crown in bloom; with one, the carpet is laid and a gust releases petals; φ = 0 holds every petal on its tree and the carpet exactly where it fell.
- The cherry's crown is blossom with no green faces.
- `plants.kinds` validates.
- A world grows cherry and reed, and the page gives petals only where a tree blooms.

The related suites (vegetation, terrain, scene channels, views, `compose_world` terrain) pass 847. In the browser pane the page renders without errors; the agent saw petals falling, lying on the lawn and lifting in gusts. The operator's eyes gate is open.

## What it does not do

- Petals don't collide with branches or grass, and they don't pile up.
- The carpet is a share of the pool, not an accumulation.
- One bloom stage only: no buds, no leaf-out, no season.
- From the grove edge a few variants still show a central stem.
- Near trees (L1, L2) draw their blossom flower by flower as discs, within a 1.2M-flower budget. Farther trees, and any past the budget, keep the ladder's cluster blobs. There are no whole flowers in the terrain world; those are the hero grove's.
- Petals are 4.5 cm, larger than real (about 1.5 cm), so they read at walking distance.

## Hero grove (`hero-grove.mjs`, `hero-grove.page.js`; the flower is `vegetation/blossom.js`)

This is the close-up version. It is built from the ground up, the way the lignification spike built its hero oak, and is a small standalone scene rather than a terrain World page. It grows on the production engine and draws its flowers with production `vegetation/blossom.js`.

- **Grown trees.** The trees are grown by the production engine (`cherry` species, K variants). The hand is now part of growth (`arch.hand`, see docs/vegetation.md):
  - each new internode turns about the vertical, the same way on every axis;
  - the leader leans toward a bearing that winds round, so it corkscrews;
  - laterals zig-zag.

  The axes are smoothed between nodes (`arch.smooth`).
- **Many ages.** The grove's six variants are grown at 7–21 years, two of them in a stand (the crown lifts to 1–2.5 m of clear trunk). Height (4.5–6.5 m) and girth (dbh 5–25 cm) come from growth; placement scales them only ±7%.
- **Blossom at the tips.** Every live axis ends in a bunch: three umbels at the tip, then spurs that thin back over its last 38 cm, and bare wood behind. An umbel is 3–5 flowers on pedicels.
- **The flower (`vegetation/blossom.js`, with the placement `bloomFlowers`)** is built from its parts:
  - five notched obovate petals with a fractal edge (midpoint displacement), cupped, pale pink to white, veined;
  - a red cup and sepals, about thirty stamens and the pistil, and a pedicel.
- **Levels follow the pool's rule** (distance from the eye):
  - Flowers are whole within 4.5 m. The full fractal edge is used only where a flower is over about 60 px; then one edge level, then plain outlines.
  - Past 4.5 m each flower is its footprint: one lit five-lobed disc, facing the eye. In the shadow pass it faces the sun, which gives dappled shade.
  - Trees past 14 m use the ladder's L2 wood. Past 46 m they use L1, the crown's clusters in bloom.
- **One wind:**
  - Each tree sways at its own first frequency, driven by a damped oscillator toward the elastica's small-load tip deflection with `WIND_TAKERS.tree`.
  - Flowers flutter, and the lawn (production lawn tufts) combs in the gusts.
  - Petals come from the debris kernel, released from the trees' own flowers near the eye.
- **Light:**
  - a low warm sun with shadows, plus sky light;
  - petals lit as thin sheets, so light comes through them when backlit;
  - the frame drawn in HDR, then bloom, ACES, a sun halo, a grade and a vignette.

- **Season dial** (on the page; `SEASON=0..1` sets the start):
  - Buds are deep pink and closed; flowers open each at its own time.
  - In petal fall, flowers go one by one, the held petals let go in waves, and the carpet thickens.
  - At leaf-out, true-size leaves grow from their bases (the far crowns' clusters too) and the carpet browns.
- **The petal carpet** is a 0.5 m grid of how many petals lie there:
  - It is laid at the start from the trees: under each crown, drifted downwind, deeper in the ground's hollows and along the path's edges.
  - It grows where each loose petal lands.
  - The ground draws it as a petal per 3.5 cm cell with the grid's odds, and as the odds themselves past a few pixels.
- **Lighting moods** (on the page; `MOOD=` sets the start): afternoon, golden hour (a low orange sun, long shadows, strong bloom), and overcast (soft sky light, faint shadows, no sun disc).
- **Cost:**
  - Every flower's shadow is its disc, facing the sun, within 28 m; whole flowers cast none.
  - The shadow map is 3072² and redrawn every other frame.
  - Geometry is sent as 16-bit positions, 8-bit normals and 8-bit sRGB colour, which brings the page to 8.5 MB.

Run from `control/`:

```sh
node scripts/spikes/sakura/hero-grove.mjs /absolute/out.html [speed m/s = 6] [petals = 6000] [variants = 4]
```

The bookmarks are: the avenue, under the canopy, blossom close, into the sun, from the lawn.

**Machine checks:**
- The page is byte-identical across two runs.
- No page errors.
- 134 trees and about 1.1M flowers as discs; within 4.5 m, up to about 3,600 whole flowers.
- Frames rendered back to back in the browser pane: about 15–28 ms by view (noisy in the pane; the shadow pass was about 13 ms of it before it ran every other frame).
- 8.5 MB of HTML.

The operator's eyes gate is open.

**What it does not do:**
- The disc level shimmers a little at middle distance.
- The trees' sway does not bend the shadows of the whole flowers.
- The far crowns (past 46 m) are still the pool's cluster blobs.
- The terrain World page draws the flowers as discs only, not whole flowers.
