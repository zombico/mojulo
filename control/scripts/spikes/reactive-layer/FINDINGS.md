# The reactive top layer (a spike)

Confetti (mana-ui's `effect`) put pieces over the picture. This spike asks the bigger question: can a layer of CSS act
on the picture itself, the world's own pixels, to give games the screen effects they are made of (a hurt's red edge, a
blackout, an impact, a gather, a status), without the game knowing? It answers in Chrome, not from memory: a small
world drawn by the World page's own emitter, each effect laid over it after it draws.

```bash
node scripts/spikes/reactive-layer/probe.mjs [--out <dir>] [--only hurt,xray] [--isolate]
```

`layer-effects.js` holds the effects as data; the probe writes one picture each, a contact sheet, Chrome's support for
each technique and a frame rate under each.

## Can CSS reach what is on the screen?

**Its pixels, yes, in four ways. Its things, only where the game says.** Chrome (the build Playwright drives here)
supports every technique tried (`mix-blend-mode`, `backdrop-filter`, `filter: url()`, container units, conic
gradients, masks).

| way | what it does to the picture | used by |
|---|---|---|
| **blend** | an overlay mixed into the pixels under it: multiply darkens, screen lights, `color` takes its hue and keeps the world's light, difference inverts | hurt, poison, water, night vision, lightning, level up |
| **backdrop** | the pixels under ONE element filtered (blur, grayscale, invert, brightness): the layer acting on part of the screen | scope, x-ray lens, shock ring |
| **canvas** | the world's canvas element itself filtered (desaturate, grade) or moved (shake, punch); an SVG filter on it (noise displacement, a channel split) | hurt, slow motion, frozen, chroma, poison's swim, water's ripple, impact's knock |
| **anchor** | where on the screen: a point the game already projects, as the HUD's anchors do (x, y 0..1) | impact, gather, iris, lens, level up |

CSS cannot see inside the WebGL canvas: it cannot find a foe, outline a body, or know that the sky is behind a tree.
What it can target is a **place the game names** (an anchor: a hit, the hero, a pickup, a projected bounding circle)
and **all the pixels in a region** (backdrop, mask). A silhouette (an outline round one body, an x-ray of one wall)
would need the game to draw that body's mask, which is the WebGL side's work and not this layer's.

## The finding that decides the design: the layer must not be isolated

A blend mixes with what is beneath it **in its own stacking context**. The first run put the layer in its own
(`contain: strict` and a `z-index`, as the confetti layer and the HUD's root have): every blend then mixed with nothing.
Lightning came out solid white instead of the picture's negative, and poison was a green wash over the world instead of
the world gone green (`--isolate` shows it). With the layer left un-isolated (no `contain`, no `z-index`, no opacity or
transform on it, laid above the canvas by document order), every blend reaches the world.

So **a reactive layer cannot live inside the HUD's root** (`#moj-mana-hud`, z-index 30) or the confetti's contained
layer. It is a sibling of the canvas, beneath the HUD. A backdrop filter is not affected (it reads through to the
canvas from inside a stacking context), which is why the scope worked in both runs.

## What did not work

- **A ring of real refraction (a shockwave):** an SVG displacement whose map is an image (`feImage`) is not drawn into a
  filter on the canvas: nothing bends. Displacement from noise (`feTurbulence`) works, which gives poison its swim and
  water its ripple, but noise has no centre. The stand-in that works is a **ring-shaped backdrop** (blur and lighten a
  band round the point): it reads as bent air at a glance. True refraction round a point is the WebGL post's work.
- **First tries overexposed or crushed:** night vision over-bright, the x-ray's negative crushed to black by contrast.
  Tuning, not limits: the numbers are a theme's.

## Cost (relative: a software renderer here, so only the ratio means anything)

The bare page drew 41 frames a second.

| effect | fps |
|---|---|
| an anchored region's backdrop (x-ray: the element is only the lens) | 41, free |
| a plain overlay (blackout, lightning) | 37 |
| overlays with gradients and blends (impact, gather, level up) | 30–33 |
| a CSS filter on the whole canvas (hurt, slow motion, frozen, night vision) | 23–25 |
| an SVG filter on the canvas (chroma, poison's noise, water) | 20–24 |
| a full-screen backdrop, masked to a region (scope, shock ring) | 17–19 |

A backdrop costs by its element's area, not its mask's, so a lens should be an element the lens's size. A full-screen
canvas filter or SVG filter roughly halves the rate in software. On a GPU it is far less, but it is per frame for as long
as it is up: they suit moments and states, not a whole level.

## Effects a game is made of, by family (each on the sheet)

| family | effects | ways |
|---|---|---|
| harm | hurt (a hit's red edge, colour drained), low health (the candidate's `peril`) | blend + canvas |
| impact | a blow at a point (flash, rays, the screen knocked), chroma (a glitch), a shock ring, lightning | blend, backdrop, canvas, anchor |
| power | gather (motes drawn in to the hero, the world dimmed toward them), level up (rays from the hero) | anchor + blend |
| state | blackout (an iris closing on the hero) | anchor + mask |
| status | poison (green, swimming), frozen (cold, frost at the edge) | blend + canvas |
| place | under water (blue-green, rippling) | blend + canvas |
| time | slow motion (drained, the edge pressed in) | canvas + blend |
| focus | scope (all but a circle blurred), x-ray lens (one place's negative), night vision | backdrop, canvas, blend |

## Built from it: the lens and its strike

The first of the primitive argued for below is built: mana-ui's `lens` (`docs/mana-ui.md`, "The lens"), the screen
layer as a part of its own beside the canvas, and its `strike`, an effect in the air round a figure that never draws
over its body.

It is for **still figures**. A region is drawn where the page last projected its figure, so a figure that stands while
the round plays is where its region says, and one that runs outruns it. An action level's hits are answered by the
world already (the body's flash, its sparks, the tempo's moments). So the lens is a turn-based fight's: a juice step in
the RPG's battles (`lens: ring | lift | shade | ink`), yielding to the beat's own flash, puff or beam.
`lens-proof.mjs` shows it in Chrome in a party fight.

## If we fork from here: what I think

**Yes, as a second layer of mana-ui, a screen layer beside the HUD.** It is a high-leverage primitive:
- **Every genre gets a screen grammar for free.** An action game's hurt, a horror game's blackout, a shooter's scope,
  an RPG's poison and level up, a platformer's gather: one primitive, set by words.
- **It is safe to give to an agent.** It is pure presentation, so the worst a wrong word does is look wrong. It never
  changes a rule, catches a pointer or asks for a frame.
- **It is testable as laws:** a flash rate under three a second, an area budget for backdrops, a cap on SVG filters, and
  reduced motion and flash honoured.

Its shape, from what the spike found:
- **A sibling of the world's canvas, never isolated, under the HUD.** The HUD and confetti stay contained; this cannot.
- **Driven by the state the page already keeps:** a `level` 0..1 for what lasts (harm, a status, slow motion: as
  `peril` takes it), and a trigger for what is a moment (an impact, a level up, a blackout: as `effect`'s `on`). And an
  anchor for where: the HUD's own projected x, y.
- **A few closed words, each a technique held to its cost:** `grade` (the canvas's colour), `tint` (a blend), `veil`
  (black, an iris), `lens` (a backdrop region at an anchor), `knock` (the canvas moved), `burst` (rays and a flash at an
  anchor), `gather`, `warp` (noise displacement). A theme dresses each in its colours.
- **It folds in what exists:** `peril` is the first `tint` by level, and confetti stays the HUD's `effect`.

What it is not:
- **Not the world's effects.** Light, fire and smoke in the scene are the 3D side's. This is the camera's lens, not the
  world.
- **Not targeting by itself.** It knows only the places the game projects; a silhouette needs the WebGL side to draw it.
- **Not free on a phone.** Full-screen filters are moments, sized by the quality tier the page already has (`light.tier`).

Two cautions when building it:
- **Moving the canvas:** a knock (a transform on the canvas) moves where the canvas sits, so a mouse aim read from it
  shifts a few pixels for its frames. It should be brief, or move a wrapper the input does not read.
- **The pins:** emitting the layer only where a world asks for it keeps every other page byte-identical.
