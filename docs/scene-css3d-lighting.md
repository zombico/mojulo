# CSS-3D lighting & atmosphere

Source of truth for how light, shadow, and sky behave in the CSS-3D scene backend
([scene-css3d.js](../control/lib/graph/scene-css3d.js)). All terms are **baked per
face from world geometry only → camera-independent**, which is what lets the scene
keep a movable camera (the SVG path cannot). A face's final fill is the composition
of the layers below.

The whole model is **one set of primitives that spans rooms → suites → cities →
sky**, because every scene is just world quads: the same `bakeSceneDiffusion` lights a
bedroom and a city block alike. A face's final look composes, in order: a base shade
(vexar + tint + gravity), an optional cool **moonlight** key, the **traced diffusion**
(soft pools + cast + contact shadows), and behind it all a CSS **sky**.

## When to light — the decision rule

Atmosphere is for evocation, not legibility. The handle is **intent, not subject**:
*is the light part of the message?*

> **Technical drawing / scientific explanation** (diagram, schematic, exploded view,
> data or process figure) → `scene.lighting: 'flat'` (or the SVG path). Even,
> form-legible shade with **no atmosphere** — shadows, pools, sky, and time-of-day
> only add ambiguity and imply a place/mood the figure isn't about.
>
> **Artistic depiction** (a room, a place, a city at night — where mood/time/depth are
> the point) → set a `time` and let the full stack run.

"Flat" is *not* zero shading — pure-flat 3D merges faces. It keeps a high-ambient
directional base (so form reads) and drops every atmospheric layer. The same geometry
is a blueprint or an evening render depending only on this one choice.

## The `lighting` object

One declarative object carries the whole stack. It is accepted by the room path
(`extractRoomSceneFaces`, `renderRoomSceneToHtml`), the shell builder
(`buildRoomShellFaces`), and — per volume — by the suite planner (`planSuite`).
`resolveLighting` normalizes it (and the legacy positional params) into resolved
terms.

```js
lighting: {
  vexar:   { direction, ambient, diffuse },   // OR a pre-made `light`
  tint:    [r, g, b],                          // per-room colour multipliers (~1)
  gravity: true,                               // contact-shadow on/off
  lamps:   [ { at|pos, color, intensity, k } ],            // direct, scoped point lights
  sources: [ { at|pos, height, dir, spread, color, intensity,
               rays, bounces, falloff, exposure, fixture, stem } ], // TRACED diffusion
  diffusion: { gain, reflectivity },           // global knobs for the traced pass
}
```

`at:[fx,fy]` / `height` are **fractions of the room footprint / ceiling** (explicit
`pos` wins) — a lamp or source is authored in the same mandala space as furniture.

## The layers (composition order)

| Layer | Models | How it bakes | Knobs |
|---|---|---|---|
| **vexar** | directional Lambert mood — `ambient + diffuse·max(0,N·L)` | one dot product per face | `vexar.direction/ambient/diffuse` |
| **tint** | per-room colour (vexar is colourless — one scalar) | RGB multiply on the lit factor | `tint:[r,g,b]` |
| **gravity** | contact-shadow — darken toward the scene base | `max(0, lambert − offset(z))`, world-z only (ported from `imperfect-cel.js`) | `gravity:bool` |
| **lamps** | local pools — positioned Lambert · inverse-square falloff | per face vs each lamp; **no shadow, no bounce, scoped to its room** | `lamps[].color/intensity/k` |
| **sources** | **traced** light — real occlusion + bounce + doorway spill | ray bake (below), added over the shaded fill | `sources[...]`, `diffusion.gain/reflectivity` |

vexar → tint → gravity → lamps are baked inside `makeShade` per face. Traced
`sources` are an additive pass on top (`bakeSceneDiffusion`).

## Traced diffusion — the ray model

`light-diffusion-3d.js` is the metamandala light-diffusion ray tracer
(`applyMetamandalaLightDiffusion`, [neo-rembrandt](../control/lib/graph/neo-rembrandt/index.js))
**re-homed from the 2D picture-plane into 3D world space**. The only change from the
2D original is dimensional (3D ray/quad intersection + 3D normals); the model is
intact:

- a source emits `rays` in a cone of half-angle `spread` about `dir` (Fibonacci-
  sampled → **deterministic**);
- each ray is traced against the world faces; on a hit it deposits
  `energy = power · cosθ · intensity` (ray-count-normalized);
- the ray **reflects** and continues, `power *= falloff · reflectivity`, up to
  `bounces`.

So it has the three things a direct lamp cannot: **occlusion** (a wall stops the
ray), **bounce** (light reaches a ceiling off the floor), and **spill** (a ray
through a doorway opening continues into the next room). A face can also **transmit**
(`transmit: 0..1`, or `skinTransparency ≥ 1`): a ray marches *through* it to the
opaque surface behind, attenuated by `transmit` and tinted by `glassTint` — a closed
**glass window** casts a (dimmer, cooler) light patch inside without being an open
hole. Lowering a source and
narrowing its `spread` makes a downward pendant: the cone only lights below, the
ceiling/upper walls fall to ambient + attenuated bounce, the pool below sharpens.
`stem` (a ceiling z) draws a cord so a lowered source reads as a hanging lamp.

These behaviours are pinned in [light-diffusion-3d.test.js](../control/lib/graph/light-diffusion-3d.test.js).

### Hard vs. soft render

The ray bake gives each face one energy value (and, for soft, *where* the rays
landed). Two ways to paint it (`diffusion.soft`):

- **flat (default)** — add the energy to the face's fill: one uniform brightness per
  face. Crisp, cheap, but pools are flat and lit/unlit transitions are hard.
- **soft** (`diffusion: { soft: true, softness, maxAlpha }`) — paint a translucent
  **radial-gradient pool** (`rgba → transparent`) into the face's `bg`, centred on the
  energy-weighted hit centroid with radius from the hit spread. Soft edges, smooth
  spread, the light reads as a field rather than a ray hit. Still per-face and
  camera-independent — the gradient lives in the div's own plane and transforms with
  it. Occlusion/bounce still decide which faces light and where the pool sits
  (`bakeDiffusionField` → `applyDiffusionSoft`).

### Cast shadows — the inverse (`diffusion.shadows`)

The soft pool is light *where a ray landed*; the shadow is its **inverse** — light
*where a ray was blocked*. On a ray's first hit of an **elevated** object, the hit is
projected DOWN ALONG THE LIGHT to the floor; that spot — the one the occluder stole
from the floor — accumulates a shadow field (same u,v centroid + spread machinery).
`applyDiffusionSoft` paints it as a **dark** radial pool that rides **on top** of the
light layer (a cast shadow must darken even a lit area, since it falls exactly where
the light would have gone). Knobs: `shadowStrength`, `shadowMaxAlpha`, `shadowColor`.
Projecting to the floor (rather than tracing through the occluder) keeps it robust for
solid furniture — the shadow never lands inside the box's own back faces.

### Contact shadows — underneath objects (`diffusion.contact`)

The cast shadow lands *beside/past* an object; the **contact** (ambient-occlusion)
shadow is the dark patch *directly under* it — there regardless of any light, because
the seat/top occludes the ambient hemisphere from the floor beneath. `contactShadowDecals`
lays one soft dark radial blob on the floor per elevated piece (sized to its footprint,
fainter as it sits higher). One **decal per object** — so several pieces keep distinct
under-shadows instead of blending into a single per-face pool. Defaults on with
`shadows`; `contactStrength` tunes it. Emitted after the diffusion bake (single room) or
after the suite-wide bake (from each room's returned `contactFootprints`).

## Single room vs. suite

- **One room** bakes its own sources locally — `extractRoomSceneFaces({ lighting })`.
- **A suite** bakes **once across all volumes** so light spills between rooms:
  each room is built with `deferDiffusion: true`, then `buildSuiteFaces` runs one
  `bakeSceneDiffusion` over the whole face set with the suite-wide `plan.sources`.

Both paths call the same `bakeSceneDiffusion` / `resolveLighting`, so the model is
shared, not duplicated.

## Beyond rooms — cities & scenes

`bakeSceneDiffusion(faces, sources, diffusion)` is **face-based and generic** — it
doesn't care whether the faces are room walls or building facades. So the city
renderer ([renderBoxCityToHtml](../control/lib/graph/scene-css3d.js), used by
[fractal-city.js](../control/lib/graph/fractal-city.js)) takes the same `sources` +
`diffusion` and runs the bake before emitting. Two enablers made the lift complete:
the soft renderer lights a face with a hex `fill` **or** a CSS `bg` (city facades use
`bg`), and the city renderer threads `sources`/`moonlight`/`sky` through.

**Streetlamps as sources.** The fractal city already places lamps (pole + warm head);
`planFractalCity` reads those heads back as downward warm sources, and
`renderFractalCityToHtml({ night: true })` flips on a dark base + the lamp sources +
the night diffusion preset + a night sky. `maxLamps` samples the lamp set down so the
bake stays bounded on dense cities (the one real scaling concern — a spatial grid is
the eventual fix).

**Time of day — the model-facing setting.** `renderFractalCityToHtml({ time })` (or
`day` / `night`) selects a whole atmosphere:
- `night` → dark base + streetlamp sources + moonlight + a starry/moon sky.
- `day` → one external **sun** (high + to the side, aimed at the city centre, casting
  rooftop light + building shadows) + a bright vexar base + a day sky.

External/**window** light is the same source pointed *in*: a sun outside a room, aimed
through an opening (a `doorways` cut with a sill `v0 > 0`) or a closed glass pane
(`transmit`), lands as a sun-patch with furniture shadows — a terrace is just a room
with a wall omitted, lit from outside.

## Moonlight (`applyMoonlight`)

The warm pools' cool counterpart: a **directional** key from the moon. For each face,
a cool-blue contribution scaled by `N · toMoon`, so **rooftops and moon-facing walls**
catch a silver sheen while the rest stays dark. Hex-fill faces gain the colour; CSS-
`bg` facades get a translucent cool wash at the same strength. Applied as the **base**
layer (before the diffusion bake), so warm streetlamp pools sit on top → the warm/cool
contrast that reads as night. The moon's sky position and the moonlight `dir` are kept
consistent.

## Sky (`skyCss`)

The painted-landscape **sky** concept, rendered as a CSS backdrop rather than SVG.
[sky-css.js](../control/lib/graph/sky-css.js)'s `skyCss(spec)` reuses the landscape's
own `deriveSky` (exported from [painted-landscape.js](../control/lib/graph/polygonizer/painted-landscape.js))
for the horizon→zenith gradient, then layers the rest as CSS: a radial **sun** glow at
the derived sun position (day/dusk), a glowing **moon** disc (night), and deterministic
**star** dots. Presets `day` · `dusk` · `dawn` · `night` · `midnight`, or pass
`sunElev`/`azimuth`/`sun`/`moon`/`stars`. The emitter takes a `sky` option and uses it
as the viewport background, so **any** scene (room, suite, city) gets a sky with one
field — it sits behind the geometry, which composes in front of it.

## Authoring it (the model-facing dials)

The model never names the engine — it sets **fields on the scene manifest**, resolved
with defaults by `resolveSceneLighting`:

```js
manifest.scene = {
  time: 'day' | 'dawn' | 'dusk' | 'night',   // ARTISTIC intent dial → vexar mood + tint + sky
  lighting: 'flat'                            // TECHNICAL mode → even, no atmosphere
          | { vexar, tint, sources, lamps, diffusion, gravity }, // advanced override
  sky: 'dusk' | { preset, sun, moon, stars }, // overrides the preset sky
}
```

Per the decision rule above: `lighting: 'flat'` for technical figures; a `time` for
artistic scenes. `time` is the one handle that matters for most lit scenes — it picks
the directional mood, colour, and sky together. The object form of `lighting` is the
escape hatch for hand-placed sources/lamps (`at:[fx,fy]` mandala coords). Nothing
declared → the default look is kept. Both the
room renderer (`renderRoomManifestToHtml` → `extractRoomFacesFromManifest`) and the city
(`renderFractalCityToHtml`) read these, and the `/api/sketches/[ref]/scene` route wires
them through — so a stored sketch authored `{ scene: { time: 'night' } }` renders lit,
and the engine name (`vexar-diffusion`) stays an implementation detail.

## Boundary

CSS preserve-3d has **no z-buffer**, so this is the planar/separated eligible class
(rooms, furniture, buildings, cities). Not modelled: global illumination beyond the
specular bounce + glass transmission, participating media (no visible beam / god-rays
— you see where the cone *lands*, not the beam), and shadows cast by thin decals.
Organic / interpenetrating geometry belongs on the baked `forge_motion` path. The
city day sun is a single point source (roughly-radial shadows) rather than a parallel
directional light, and the ray bake is brute-force (a spatial grid is the scaling fix).

## Map

- Model + composition: [scene-css3d.js](../control/lib/graph/scene-css3d.js) —
  `resolveLighting`, `makeShade`, `bakeSceneDiffusion`, `applyMoonlight`,
  `contactShadowDecals`, `extractRoomSceneFaces`, `buildRoomShellFaces`,
  `renderBoxCityToHtml`, `emitPreserve3dScene` (the `sky` field).
- Ray tracer: [light-diffusion-3d.js](../control/lib/graph/light-diffusion-3d.js).
- Suite composition: [suite-layout.js](../control/lib/graph/suite-layout.js).
- City + streetlamp sources: [fractal-city.js](../control/lib/graph/fractal-city.js).
- Sky: [sky-css.js](../control/lib/graph/sky-css.js) (+ `deriveSky` in painted-landscape).
- Tests: [light-diffusion-3d.test.js](../control/lib/graph/light-diffusion-3d.test.js),
  [scene-css3d-lighting.test.js](../control/lib/graph/scene-css3d-lighting.test.js),
  [sky-css.test.js](../control/lib/graph/sky-css.test.js).
