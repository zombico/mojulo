# Terrain-plan — top-down region map → grounded composed terrain

Status: design + first slice (2026-06-09). Builds on the scene-fill work
([scene-fill.plan.md](./scene-fill.plan.md)) and the composed-field proof
in `lite-template/integration/0609/spike-output/terrain-plan/`.

## Goal

Construct natural landscapes the way cityscapes are constructed: a
top-down region plan blocked out over the world-XY ground, each region
contributing to **one composed elevation field** and **manifesting its
own biome** (forest / water / rock) on top. The heartbeat stops being
*the* ground and becomes *one region's waveform among many*.

## Invariants (operator rules — do not violate)

1. **Each terrain type carries its own waveform.** A region's local
   texture is driven by the biome's own heartbeat (forest rolls,
   rocky-ridge jags, water chops). The waveform belongs to the terrain
   type, not to the scene. A biome card binds `{ landform, waveform,
   scatter }` together.

2. **Every region tapers to the z=0 baseline at its border.** A region's
   elevation contribution reaches exactly 0 at its footprint radius, with
   a *smooth* (C1) falloff — not linear (a linear edge creases). The
   composed terrain is therefore continuous and grounded: no fold-ups,
   no overhangs at seams. The terrain is a **grounding for the scene**,
   the stage the scene sits on — not the art itself.

Consequence: **terrain = Σ region fields over baseline 0.** Each region
is a compactly-supported bump/dip (0 outside its radius), so the sum of
any number of overlapping regions is continuous by construction. Fold-ups
are structurally impossible, and overlap blends naturally.

## The mechanism: a `terrain-region` field kind

A single new field kind encodes both invariants:

```jsonc
{
  "kind": "terrain-region",
  "center": { "x": -6, "y": -4, "z": 0 },   // path or inline
  "radius": 14,            // footprint radius; field = 0 at and beyond this
  "peak": 6,               // landform amplitude at center (+ hill, − basin)
  "falloff": "smooth",     // 'smooth' (smootherstep, default) | 'linear'
  "waves": [               // the region's OWN waveform (heartbeat), windowed
    { "amplitude": 0.8, "cycles": { "u": 1.4, "v": 1.1 } },
    { "amplitude": 0.35, "cycles": { "u": 2.8, "v": 2.2 } }
  ]
}
```

Evaluation at world point `p`:

```
r = |p.xy − center.xy|
if r ≥ radius: return 0                       // invariant 2: grounded border
w = falloff === 'linear' ? (1 − r/radius)
                          : 1 − smootherstep(r/radius)   // C1, flat at both ends
(u, v) = local footprint coords ∈ [0,1]²
tex = Σ amp · sin(2π(cu·u + cv·v) + phase)    // invariant 1: own waveform
return w · (peak + tex)                        // window scales BOTH landform + waves
```

The window multiplies the waveform too — so ripples die at the border
exactly like the landform does. That is the part the linear `sum` layer
could not express (it can add fields but not multiply a window into a
wave); baking it into one field kind is the clean fix.

## How the layers stack

- **`terrain-region` fields** (one per region) → summed into `elevation`.
- **`elevation`** drives the visible surface (`heightField`) AND scatter
  placement (`anchor.z: { field: 'elevation' }`) — coherent by sharing
  one field (the landscape-coherent pattern).
- **Biome** (per region) drives manifestation: forest → scene-fill
  scatter; water → a ripple plane clipped to the basin; rock → bare.
- **Rivers** → `curve-distance` incision, itself windowed so the channel
  returns to baseline at its banks (same taper rule).

## Build order

1. ✅ `terrain-region` field kind in fields.js (validator + compiler) + test.
2. ✅ Proved the no-fold-up property: overlapping regions, distinct
   waveforms, continuous grounded seams
   (`spike-output/terrain-regions/`).
3. ✅ The `terrain-plan` authoring surface ([terrain-plan.js](./terrain-plan.js)):
   a region map `[{ role, center, radius, biome, peak, waveform? }]` +
   `rivers[]` compiles to `terrain-region` fields + biome manifestation.
   `BIOMES` table binds landform + waveform + scatter (forest/meadow/rock/
   water). Proof: `spike-output/terrain-plan-authored/river-valley.svg`.
4. ✅ Renderer convergence ([painted-landscape.js](./painted-landscape.js)):
   an optional `elevation: { fields, field, waterLevel?, samples? }` block
   makes the painted renderer read a composed `sum` field (Lambert from
   central-difference slopes) instead of a heartbeat — so an authored
   terrain-plan renders as a *painting*, full-frame (the painted bg fills,
   no white spots). Proof: `spike-output/terrain-plan-painted/`.

### Sky — derived backdrop + atmospheric haze (opt-in)

`sky: true` (or `{ hazeStrength }`) on a painted-landscape manifest adds a
sky with **no new authoring** — both jobs derive from the existing splatch
palette + light:

1. **Backdrop** — a vertical zenith→horizon gradient. Zenith = the palette's
   bright tone darkened toward shadow (more at a low sun) with a cool bias;
   horizon = the bright tone lifted toward white and warmed by how low the
   sun sits. So a low `light.z` glows the horizon into a dark zenith (dusk),
   an overhead sun gives a flat bright sky — coherent with mood for free.
2. **Atmospheric haze** — every terrain/water cell fades toward the horizon
   color by its `depthT`. This dissolves the hard far edge (the long-standing
   "floating lozenge" problem) — distant ground meets the sky in the same
   tone. Water hazes a touch harder, reading as a sky reflection.

Sky is **not geometry** — a 2D backdrop + a per-cell blend, never a dome.
**ON BY DEFAULT** (locked in 2026-06-09): every painted landscape gets sky
unless `sky: false` is passed; `sky: { hazeStrength }` tunes the depth
fade; wireframe renderStyle is always sky-less. Exposed on the
`create_painted_landscape` MCP tool as the `sky` param. Named/embellished
skies (clouds, sun disc, stars) belong on a future `sky` card family.
Proof: `spike-output/terrain-plan-sky/` (day / dusk / glacier + a
sky-off before/after).

**Full diurnal arc off `light.z` (locked in as the sky primitive).** The
sun ELEVATION may go negative — the sun below the horizon is night. Three
regimes blend continuously off that one number: `day` (1 up, 0 deep night),
`glow` (warm horizon band that PEAKS at the horizon and fades both as the
sun climbs and as it sinks), and a deep-indigo night gradient. At night the
ground takes a cool moonlit tint (so it reads moonlit, not flatly lit) and
water keeps reflecting the dim sky. day → dusk → twilight → night is one
continuous sweep, no night mode to toggle. Proof:
`spike-output/terrain-plan-night/` (noon → night + a moonlit-glacier).

### Waterline — water spread alongside earth

`elevation.waterLevel` floods the scene: the displayed surface is
`max(terrain, waterLevel)`, so water is one flat sheet clamped up into
every basin, meeting land exactly at the shoreline contour (no seams),
depth-shaded shallow→deep. One knob slides the whole scene from
"river + lake" to "flooded archipelago"; earth biomes rise out of the
water as islands. This is the cheap answer to the water-clipping gap —
no clamp field op needed, the clamp lives in the renderer's surface
function.

## River grounding (resolved)

A raw `curve-distance` incision term grows without bound away from the
river and lifts the whole map off the baseline — it violates invariant 2
(the compile test caught exactly this: far-corner elevation = +11, not 0).
Fix: a river compiles to a **chain of small negative `terrain-region`
dips** along its densified path. Each dip is grounded (0 beyond its
radius), so the union carves a continuous channel that returns to baseline
at its banks — the river obeys the same rule as every region, and it no
longer needs a clamp op.

## Open substrate gaps

- Clipping a water surface to "only below the waterline" still wants a
  clamp/mask transform; rivers no longer need it (dip chain), but water
  planes are still rectangular quads. Track a `clamp`/`mask` field op.
- Renderer convergence (step 4) — the painterly look.
