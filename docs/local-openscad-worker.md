# Local OpenSCAD worker — the `.scad` export and its machine gate

Status: phase 3 of the openscad leg, landed 2026-09-11 and verified the same day
against OpenSCAD snapshot 2026.09.10. Optional, operator-hosted, produces a
**measured stamp** beside the exported program — the same posture as the [local
slicer worker](local-slicer-worker.md), the [local Blender
worker](local-blender-worker.md), and the [local mesh worker](local-mesh-worker.md).
Mojulo holds no OpenSCAD, no state for it, and never calls it while rendering a
recipe; it is a seam, not a dependency.

## What it is, and why this one is different

Every other export serializes the resolved FACE payload: `.glb`, `.stl`, `.3mf`
and `.usdz` all take mojulo's triangles and write triangles. `format: 'scad'`
takes the **recipe** and writes a **program**.

That difference is the whole point: the recipe's numbers arrive as variables you
can turn, and the program is something an OpenSCAD user edits in their own tool.
Sharpness is no longer the reason to leave. A field entry or a cut with
`exact: true` composes through Manifold inside the recipe (a bore has a true
circular lip in `/world`, the `.glb` and the print), and `mint_solid
kind:'scad'` takes an OpenSCAD program AS the recipe, meshed in-process by
OpenSCAD itself; for a `scad` row this export is the identity, the stored
source back. The sampled surface net remains the kernel for what OpenSCAD cannot
say (a blend, a stroke, noise, an expression, a warp), and those terms arrive
here as frozen `polyhedron()` blocks the coverage ledger names.

```
export_model (.scad — exact solids + booleans, dials at the head of the file)
   → scad-gate  (openscad -o model.stl, headless)
   → mojulo-scad-gate.json  (rendered? size agrees with what mojulo declared? volume?)
   → OpenSCAD itself        (the eyes gate: F5 preview, F6 render, export STL, print)
```

The recipe stays sovereign. The `.scad` is a deterministic derived snapshot, and
**mojulo never reads it back** — see the round-trip limit below.

## Install

The stable Homebrew cask `openscad` has been **disabled since 2026-09-01** for
failing the macOS Gatekeeper check. Use the snapshot:

```bash
brew install --cask openscad@snapshot      # verified: 2026.09.10
```

It links a CLI at `/opt/homebrew/bin/openscad`, which is what the probe finds.
Otherwise set `MOJULO_OPENSCAD` to any binary, or drop `OpenSCAD.app` in
`/Applications`. Absent all three the gate skips with the install line and the
`.scad` still ships — capability rung 0, never an error.

## How the gate runs

```bash
cd control
node scripts/scad-gate.mjs --ref sk_foo                 # export, render, compare, stamp
node scripts/scad-gate.mjs --scad path/to/model.scad    # render a file you already have
node scripts/scad-gate.mjs --ref sk_foo --fn 128        # finer facets on curves
node scripts/scad-gate.mjs --ref sk_foo --tolerance-mm 0.5
node scripts/scad-gate.mjs --ref sk_foo --no-gate       # export only
```

Env: `MOJULO_OPENSCAD` (binary), `MOJULO_OPENSCAD_TIMEOUT_MS` (watchdog, default
10 min).

## What the stamp compares, and what it refuses to

- **Bounding box, always.** This catches the entire units-and-scale class of
  error, which is the one that actually bites a print leg.
- **Volume, when one was declared.** It is the strong check precisely because it
  is triangulation-independent. Absent a declared volume the field is null with a
  reason, never a failure.
- **Triangle count: NEVER, and this is deliberate.** The USD gate compares
  triangles legitimately because both sides carry the same mesh. Here they do
  not: OpenSCAD tessellates exact solids by `$fn` while mojulo marched a grid, so
  agreement would be coincidence and disagreement would mean nothing. The stamp
  says this in-band so its absence is not read later as an oversight.

**Expect a sub-cell disagreement on a field part, and do not "fix" it.** Mojulo
declares its MARCHED mesh; OpenSCAD renders the IDEAL solid. The mesh sits about
half a grid cell inside, so a 40 mm disc declares 79.9 mm and renders 80. Pass
`--tolerance-mm` for a part with baked terms; the driver says so when it sees any.

## Coverage — measured, never claimed

A term with no OpenSCAD equivalent is polygonized by mojulo's own kernel and
emitted as a frozen `polyhedron()`, with a comment naming the term that forced
it. The result's ledger says how many transpiled and how many did not.

| transpiles exactly | arrives frozen |
|---|---|
| the nine field shapes (sphere, ellipsoid, roundCone, box incl. `round`, capsule, lathe, extrude, sweep) | `expr`, a lathe with `harmonics` |
| `add` / `subtract` / `intersect` without `blend` | any `blend` (smooth min/max has no counterpart) |
| `transform`, `repeat` (counted and polar) | `twist`, `bend`, `taper`, `elongate` |
| `cuts` (they lower to field terms first) | `stroke`, `displace`, `shell`, the `round` TERM |
| a plain `lathes` or `extrudes` monomer | `sweeps`, `lofts`, `drapes`, `reliefs`, `shells` monomers |

A `blend` contaminates the ACCUMULATOR rather than the incoming shape, so the
bake runs through the last contaminating term and the remainder folds exactly on
top of it — a blended blob keeps its bore as a live `difference()` over a frozen
body.

## Verified on this host (2026-09-11, snapshot 2026.09.10)

Five fixtures, all exit 0 with `Status: NoError`:

| fixture | declared mm | rendered mm |
|---|---|---|
| field flange (lathe + polar repeat + capsule cutters) | 79.9 × 79.9 × 6 | 80 × 80 × 6 |
| bored disc via `cuts`, authored in cm | 119.9 × 119.9 × 12 | 120 × 120 × 12 |
| rounded box + prism slot | 40 × 30 × 20 | 40 × 30 × 20 |
| blended blob (bake + exact bore) | 22.8 × 19.9 × 18.7 | 22.8 × 19.9 × 19.5 |
| figure, fully baked (34,464-triangle polyhedron) | 51.2 × 22.5 × 120 | 51.2 × 22.5 × 120 |

The flange's volume confirms the geometry independently: a 40 mm disc less six
3 mm bores is 29,141 mm³ analytically and measured 29,097 under `$fn` faceting.

Eyes gate, same day: the same recipe emitted as exact solids and as mojulo's own
field surface, rendered by the same renderer. Close on the bore lip the exact one
is a crisp ellipse; the field one carries a visible chamfer the whole way round.

## Limits (honest)

- **The round trip runs through a mesh, not the recipe.** A part edited in
  OpenSCAD comes back through `bind_mesh_render` as an STL or 3MF (converted to a
  GLB at the door, 3MF colour kept) and is placed in a world by `meshRef`; the
  recipe does not learn the edit. To keep the program as the source, mint it as a
  `scad` row and edit `/source` in place instead.
- **The BOOLEAN is exact, the primitives are not.** Curved surfaces are still
  faceted by `$fn` at the head of the file. Sharpness comes from computing the
  intersection curve rather than from sampling a grid — raise `$fn` for a smoother
  curve, but the edge is already sharp.
- **Not a B-rep kernel.** No threads, no constraints, no GD&T. The `scad` export
  removes the ROUNDING from the precision-CAD handoff, not the missing fit;
  `translate_modeler_lingo`'s `precision-cad` entry still routes to a real CAD tool.
- **`color()` is preview-only** and OpenSCAD drops it from any STL it renders.
  Label `wrap` images have no OpenSCAD counterpart at all and are dropped, which
  the ledger notes on the monomer that carried one.
- **A snapshot build, not a stable release** — that is what the disabled cask
  leaves available, and the stamp records the version it ran against.
