---
name: figure-study
description: Render the protoform human figure (male/female) as multi-view vexar studies — the whole body, or a focused piece like the bust — for visual analysis. Two modes: filled (lit mesh) and golden-ratio ring-wave wireframe (verify a region's construction before filling it). Use when asked to "render/view/analyze the figure", "show the female form", "study the bust / <region>", to compare male|female, or after editing the figure builders. Invoke as `/figure-study <study-name>`.
---

# figure-study

Look at the protoform figure — as a whole or piece by piece — to analyze and tune
its form. The figure is sculpted in the study spike and emitted as multi-view SVGs;
this skill regenerates those and rasterizes the one you want so you can Read it.

## Use it

```bash
node .claude/skills/figure-study/study.mjs <study> [<study>...] [--no-gen]
```

Runs the figure gen test (writes all study SVGs), rasterizes the named study(ies),
and prints PNG paths. **Then Read the printed PNGs** — that's the analysis. Pass
`--no-gen` to skip regen and just re-rasterize existing SVGs.

Examples:
- `… study.mjs 8a-stitched-vexar` — the canonical male, frontal·¾·lateral.
- `… study.mjs 14-female-vexar` — the female pole.
- `… study.mjs 13-dimorphism-pair` — male | female side by side (the dimorphism axis).
- `… study.mjs 15-female-vexar-bust-study` — a focused piece (wireframe wave-build).
- `… study.mjs 12-proto-sweep` — the stockiness tuning sweep.

## The studies (outputs)

All under `lite-template/integration/0609/spike-output/figure-readable-envelope/`,
each a 3-view contact sheet (frontal · three-quarter · lateral) unless noted.

| study | what it shows |
|---|---|
| `8-vexar` / `8a-stitched-vexar` | canonical male — basket vs stitched (pelvis folded, side/pec/scapula) |
| `12-proto-sweep` | one figure at `stockiness` 0.82 / 1.0 / 1.22 (girth tuning) |
| `13-dimorphism-pair` | male \| female (4 panels) — the sex axis from one generator |
| `14-female-vexar` | the female pole alone |
| `15-female-vexar-bust-study` | **piece study**: golden-ratio breast ring-waves, wireframe |
| `48-human-builds` | somatotype taxonomy — ecto / meso / endo × male / female (auto-fit → shape) |
| `49-human-sizes` | stature lineup on a **shared scale** + common ground line (toddler→tall ♂); `height` reads true |
| `50-child-head-ratio` | `headScale` 1.0 / 1.4 / 1.8 ages one figure adult→child→toddler (heads-tall) |

## Two study modes

The figure is `litFigureFaces(cam, positions, {stitched})` in the spike
([figure-readable-envelope.spike.gen.test.js](../../../control/lib/graph/polygonizer/figure-readable-envelope.spike.gen.test.js)),
posed neutral, rendered through the orbit camera. **Front is `az = Math.PI`** (the
`az=0` camera looks at the back — always label/aim from `Math.PI`).

1. **Filled (lit mesh)** — `litFacesFromRings(cam, ringStack, FLESH_HEX)`, vexar
   Lambert-shaded, back-face culled, depth-sorted. The whole body or a region.
   `drawLitPanel` auto-fits, so a panel fed only a region's rings zooms to it.
2. **Wave wireframe (verify before fill)** — draw a region's surface as **golden-
   ratio concentric ring-waves** via `projectLines` + `drawPanel` (auto-fits → a
   zoomed piece study). Verify the wave layout *closes the form* and terminates at
   the right edge, then fill (mesh the same rings). This is how `15-bust-study` works.

## Recipe — add a focused piece study

To study a new region (e.g. a shoulder, glute, knee) the way the bust was done:

1. Factor the region's surface into a **point function** in STAND space:
   `regionPt(p, sgn, rr, a) → {x,y,z}` — `rr` = footprint radius (0 = apex/centre →
   1 = the terminator/outer edge), `a` = around-angle. (See `breastPt`.)
2. **Fill** builder: `regionRings` stacks rings at uniform `rr` (each point
   `toWorld(regionPt(...))`), fed to `litFacesFromRings`.
3. **Verify** builder: `regionWaveLines` emits concentric rings at golden-ratio
   `rr` (`rr /= 1.618` each step from the terminator inward) as `{pts, stroke}`
   lines (STAND space — `projectLines` applies `toWorld`), plus faint radial spokes.
4. New output: 3 orbit views (`Math.PI`, `Math.PI+Math.PI/4`, `Math.PI+Math.PI/2`),
   `drawPanel([], projectLines(cam, lines), label, i*PANEL_W)` — auto-zoomed.
   `await fs.writeFile(path.join(OUTPUT_DIR, '<n>-<region>-study.svg'), …)`.
5. Run this skill on `<n>-<region>-study`, Read it, tune, then fill.

## Sex / tuning

`DIM = DIMORPH.male | .female` (set before a render) drives the dimorphic pole;
`GIRTH` (stockiness), `PROTO.height`, and `PROTO.headScale` (skull size — the
child↔adult lever) are the global knobs. See
[figure-proto-params.plan.md](../../../lite-template/integration/0610/figure-proto-params.plan.md)
and [figure-dimorphism.plan.md](../../../lite-template/integration/0610/figure-dimorphism.plan.md).
The rig/metadata is [figure-rig.js](../../../control/lib/graph/polygonizer/figure-rig.js).
