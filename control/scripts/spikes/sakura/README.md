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
- Blossom is drawn as the ladder's cluster blobs, in mojulo's low-poly style; there are no individual flowers.
- Petals are 4.5 cm, larger than real (about 1.5 cm), so they read at walking distance.

## Hero grove (`hero-grove.mjs`, `hero-grove.page.js`, `blossom.mjs`)

This is the close-up version. It is built from the ground up, the way the lignification spike built its hero oak, and is a small standalone scene rather than a terrain World page. Nothing in `lib/` changes for it.

- **Grown trees.** The trees are grown by the production engine (`cherry` species, K variants), then given a hand. Every internode's offset is turned:
  - about the vertical, a little more each internode (the same hand on every axis);
  - into a lean whose bearing winds round, so the leader corkscrews instead of standing as a rod;
  - with a zig-zag on thin shoots;
  - with an arch that grows toward a limb's end.

  Each internode is then split at its Catmull–Rom midpoint so limbs bend instead of kinking. The node order is kept, so the ladder and the pool read the result unchanged.
- **Blossom at the tips.** Every live axis ends in a bunch: three umbels at the tip, then spurs that thin back over its last 38 cm, and bare wood behind. An umbel is 3–5 flowers on pedicels.
- **The flower (`blossom.mjs`)** is built from its parts:
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

Run from `control/`:

```sh
node scripts/spikes/sakura/hero-grove.mjs /absolute/out.html [speed m/s = 6] [petals = 6000] [variants = 4]
```

The bookmarks are: the avenue, under the canopy, blossom close, into the sun, from the lawn.

**Machine checks:**
- The page is byte-identical across two runs.
- No page errors.
- 134 trees and about 1.1M flowers as discs; within 4.5 m, up to about 3,600 whole flowers.
- Frames rendered back to back in the browser pane: 16 ms (the avenue) to 37 ms (blossom close, inside a crown).
- About 18 MB of HTML.

The operator's eyes gate is open.

**What it does not do:**
- The hand is a spike-side step after growth. The growth engine has no chirality of its own.
- The disc level shimmers a little at middle distance.
- The trees' sway does not bend the shadows of the whole flowers.
- The page carries the whole wood geometry inline, which is why it is 18 MB.
