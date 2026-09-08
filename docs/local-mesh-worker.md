# Local mesh worker (optional)

An **optional** external sculptor for the mesh handoff
(`request_mesh_render` → `pull_mesh_render` → `submit_mesh_render` →
`accept_mesh_render` / `reject_mesh_render`), seam 5 of
interchange-seams.plan.md.
Same posture as the [local image worker](local-image-worker.md), the [local
Blender worker](local-blender-worker.md), and the [local slicer
worker](local-slicer-worker.md): operator-hosted, never a dependency, produces
**bound derived artifacts** with provenance. Mojulo holds no generator, no
key, no worker state.

**Who needs this:** nobody by default. Mojulo greyboxes an object's FORM
deterministically and that greybox ships to every engine and printer today.
Reach for a mesh worker when a hero object wants high-frequency surface
detail mojulo does not author — sculpted folds, organic muscle, ornament —
and you have a generator that can produce it from a shape prior.

**The shape:** mojulo is the DIRECTOR, the worker is the sculptor. The packet
is the greybox GLB (the shape prior, conditioning input, never the
deliverable) plus the still / turntable renders and the declared size. The
worker returns ONE `.glb`; mojulo validates it at the door, measures it
against the greybox, stores it as an append-only `meshRef` slot beside the
recipe, and a different pair of eyes accepts it. The recipe stays sovereign;
the sculpt is a bound render, regenerable from the greybox any time.

```
request_mesh_render { ref }             → a durable row (survives restarts)
pull_mesh_render {}                     → greybox.glb + stills + size + instructions
   (your worker: Meshy / Tripo / Rodin / Hunyuan3D / TripoSR / a Blender sculpt)
submit_mesh_render { request_id, glb_path, worker_audit, source }
   machine gates: GLB decodes · size within 0.5×–2× of the greybox per axis · closure audit
accept_mesh_render { request_id, accept_audit, source }   ← a DIFFERENT source than the submit
   → data/outcomes/<ref>/mesh-<n>.glb (+ .json provenance) = the latest meshRef
```

## Workers that fit

| worker | where | input | key |
|---|---|---|---|
| Hunyuan3D 2.x | local (GPU) | image → mesh | none |
| TripoSR | local | image → mesh | none |
| Meshy / Tripo / Rodin | cloud API | image or text → mesh | the operator's, in the worker script's env |
| Blender (manual sculpt over the greybox) | local | the greybox | none |

The cloud keys live in YOUR worker script's environment — never in mojulo, never
in a recipe. Renders record their `source`, so a cloud sculpt and a local one are
distinguishable in the sidecar.

## How the worker drives it

1. `pull_mesh_render({})` — read `greybox.path` (a GLB of the printable set: no
   water, decals, or studio grid), `reference_urls.still` / `turntable`,
   `size_world_units`, `units`, `budget.triangles_max`, and `instructions`.
2. Render the still / turntable PNG(s) to images if the generator is image-conditioned
   (a dark background is fine — rembg cuts it);
   pass the greybox as the shape prior where the generator accepts one
   (Hunyuan3D shape refinement, Tripo's "refine from mesh", a Blender shrink-wrap).
3. Ask for a z-up mesh in the SAME units and centred where the greybox sits,
   uncompressed (no Draco / meshopt), triangles only. Generators normalise to their
   own unit box: re-frame the return onto the packet's `greybox_box` with
   `node scripts/fit-mesh-to-greybox.mjs --ref <ref> --in raw.glb --out fitted.glb
   [--up triposr]` before submitting (a raw normalised return fails the size gate
   by design). Vertex colours or a
   baseColor texture are welcome: albedo textures (TEXCOORD_0 + an embedded
   PNG / JPEG) are carried on ingest (seam 6b); normal / roughness / metallic
   maps are counted and dropped.
4. `submit_mesh_render` with an honest `worker_audit` — `{ invoked_generator:
   true, generator: 'hunyuan3d', conditioned: 'greybox+images' }` — and your
   `source`. Read `machine.size_agrees`; a `false` means the generator
   re-scaled or re-centred: fix and re-submit against the same request.
5. Someone ELSE looks (the driving agent or the operator) and runs
   `accept_mesh_render` with `accept_audit: { read: '...' }` — or rejects with
   the reason, and the worker goes again.

## First contact — TripoSR on an M1 Max (2026-09-07)

The loop had only ever met a fake sculptor. The first real generator was TripoSR
(single image → mesh, no key, CPU is enough) on the lighthouse `sk_5732vu2va0`,
driven cold from the packet above. What it settled:

- **The packet was enough** to write the worker (`~/.mojulo/workers/triposr/worker.sh`
  on this host): pull → render the `still` to a PNG → generate → submit. One thing
  it did not say and now does: **generators normalise.** TripoSR returned a ~0.9-unit
  mesh, z-up in the file, in its own frame. Submitted raw it failed `size_agrees`
  exactly as designed (ratios 0.016 / 0.022 / 0.005). The packet now carries
  `greybox_box` and the instruction to re-frame before submitting, and
  `scripts/fit-mesh-to-greybox.mjs` (pure half `lib/graph/scene/mesh-fit.js`) does
  it: stand it up (`--up triposr` for TripoSR's z-up file, which the reader lands on
  −y), uniform scale on the height, base on the greybox floor, XY centred.
- **The 0.5×–2× band held.** Fitted on height, TripoSR's lighthouse came out 1.72× /
  1.28× the greybox in XY — a single view guesses girth generously — inside the band
  but not by much. The band is the right shape (height is the axis a generator gets
  right; XY is its opinion); a tighter band would refuse honest returns.
- **What came home:** 82,408 triangles, vertex colours (`COLOR_0` → `fill`), closure
  clean, no textures — TripoSR bakes a texture only with `--bake-texture`, whose
  `xatlas` wheel does not build on this host, so seam 6b's textured-return input is
  still untested by a generator. The `contract` block on submit (node inventory,
  landmark) is the Blender return's check and fails for any generator return
  (`geometry_0` vs the pack's node names); read `size_agrees` and `closure` for a
  sculpt, `contract` for an art pass.
- **Eyes gate (agent, via a Blender Workbench render of slot 2):** reads as the
  lighthouse — tapered tower, red gallery ring and lantern roof, the red door on the
  flank; leans a few degrees; the back is a single-view guess. Accepted by a different
  source with that note, placed in a controllable world at 0.1 scale
  (`figures: { lh: { meshRef, transform: { pos, scale } } }`) and exported: it stands
  on the floor at ten metres beside the walker.
- **Host notes (M1 Max, Python 3.11, torch 2.14):** `torchmcubes` will not compile
  (its CMake pins C++17; torch wants C++20) — `tsr/models/isosurface.py` falls back to
  PyMCubes with the vertex order flipped to torchmcubes' (z, y, x); `xatlas` does not
  build (old pybind11 vs CMake 4) — imported lazily; `rembg` needs `rembg[cpu]`; the
  pinned `trimesh==4.0.5` cannot export GLB under numpy 2 (`ndarray.ptp`) — upgraded;
  `run.py` ignores `--device mps` without CUDA and runs on CPU, ~40 s per mesh at
  marching-cubes 256 after the one-time 1.6 GB weight download.

## Notes

- The greybox at `data/outcomes/<ref>/greybox.glb` is overwritten on every
  pull (a derived snapshot); the submitted meshes are append-only slots.
- `accept` refuses a self-accept (same `source` as the submit) and refuses a
  failed size gate unless `accept_audit.override_size` says why the size is
  right.
- Place the accepted mesh anywhere: `figures: { hero: { meshRef: '<ref>',
  transform?: { pos, rotZ, scale } } }` in a world manifest — it lowers to the
  standard face list, so `/world`, the stills, and every export render it.
- The manual half of this loop is `bind_mesh_render` (a Blender pass over an
  `export_model` file); both go through the same bind-back door.
