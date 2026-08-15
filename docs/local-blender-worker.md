# Local Blender worker — premium bakes & renders

Status: hero-object leg landed (interchange.plan.md I5). Optional, operator-hosted,
produces **bound derived artifacts** — the same posture as the [local image
worker](local-image-worker.md) and [local voice worker](local-voice-worker.md).
Mojulo holds no Blender, no keys, no state for this; it is a seam, not a dependency.

## Two Blender bake paths

There are two GI-bake capabilities, both optional and Blender-gated, both producing
bound derived artifacts that ship to anyone as plain vertex colours (no Blender to
view):

- **Hero-object bake (this doc)** — `scripts/blender-bake.mjs`: one posed subject
  (a suit, a statue) with a studio light rig + plinth. Premium stills / display
  variants.
- **World GI bake — the bicycle** — `scripts/bake-world-gi.mjs`: a whole *world*
  (MS arena maps, fractal city, dungeons, floorplans) GI-lit in place, at zero
  runtime cost. A drivetrain + per-world-kind gear adapters. **This is the path for
  "blenderify a level/world."** Full design, presets, rollout, and the two gates:
  [../control/lib/graph/scene/map-gi-bake.plan.md](../control/lib/graph/scene/map-gi-bake.plan.md).
  Run: `node scripts/bake-world-gi.mjs --ref <world> --preset exterior --write`.

## What it is

The "premium bake" round trip as one repeatable command. Mojulo renders unlit
vertex colours (its lighting is baked into the geometry), which means **anything
Blender can compute offline and bake into vertex colours, mojulo's runtime
displays natively at zero runtime cost.** Blender's Cycles path-tracer does real
global illumination — bounce light, soft contact shadows — that mojulo's analytic
Lambert can't reach. The interchange doors carry it: export out, bake, bind back.

```
export_model (.glb, baked-flat palette)
   → blender-bake  (Cycles diffuse GI → vertex colours, headless)
   → bind_mesh_render slot  (a bound derived artifact, sha256 + provenance)
   → meshRef in any world   (server-side lowered to the face list; renders everywhere)
```

The recipe stays sovereign. The baked mesh is a bound render, regenerable from the
script — never a row that competes with the recipe.

## Requirements

- A local **Blender ≥ 4.x** (5.2 LTS verified). No addon, no MCP server — this is
  headless `blender -b -P`, which is the right tool for a pipeline: deterministic,
  scriptable, no socket timeout, no telemetry. (blender-mcp is only for driving a
  live Blender *window* interactively; the pipeline does not need it.)
- Set `MOJULO_BLENDER` if Blender is not at the macOS default
  `/Applications/Blender.app/Contents/MacOS/Blender`.

## Usage (from `control/`)

```bash
# Bake a sketch's own export and bind the result back onto it:
node scripts/blender-bake.mjs --ref sk_foo --preview

# Bake one suit out of a world export, bind onto the suit's sketch:
node scripts/blender-bake.mjs \
  --glb data/outcomes/sk_ms_tutorial_rising/model.glb \
  --hero gframe_mk2_multi \
  --clip gframe_mk2_multi:forward \
  --bind-to sk_gframe_mk2_unit_v1_multi --preview

# Bake only, no bind (dry run — prints the baked .glb path):
node scripts/blender-bake.mjs --glb <path> --no-bind
```

Prints one JSON result line: `{ ok, bound_ref?, n?, out_glb, triangles, sha256, preview_png? }`.

To see a bound bake in a world, place it by ref in a `figures` map entry:
`figures: { hero: { meshRef: '<bind-ref>', transform?: { pos:[x,y,z], rotZ, scale } } }`.

## Unshaded source (the clean base) — default ON

A clean Cycles bake needs a RAW-ALBEDO base so the GI it computes is the *only*
lighting. mojulo normally bakes its own Lambert (plus AO, procedural-material and
weathering darkening) into every colour — bake onto that and light lands twice
(the "double-lighting" that turned the mk2's biceps black). So `blender-bake`
defaults to **unshaded**: given `--ref`, it generates a flat-albedo source
in-process via `resolveWorldScene(sketch, { unshaded:true })` → `facesToGlb`
(a flat light with `litFactor ≡ 1`, AO/materials/weathering skipped), NOT the
sketch's own shaded export. Pass `--shaded` to bake the shaded export instead.

Scope: unshaded is exact for the vexar object-study kinds (workbench, unit/suit,
figure, carved-solid, turntable, manji-tree — the export targets). Room/city/
floorplan kinds use a different (traced-diffusion) lighting model that a flat
Lambert light can't neutralise; `resolveWorldScene` flags those with a
`payload.unshadedWarning` rather than half-flattening them.

Honest nuance: unshaded forces mojulo's `shade`/`contrast`/`material` passes off
to reach the *rawest* base albedo. That is the correct GI base, but surfaces that
leaned on those passes read a touch softer than the vivid runtime look. If you
want the vivid base preserved, `--shaded` bakes onto it (accepting mild
double-lighting) — a per-subject taste dial.

## The two tricks worth knowing

Both discovered by eyes-gate, both baked into the `statue` preset. With an
unshaded source they are now *belt-and-suspenders* (the black-bicep failure can't
occur on a flat base), but they still help and stay on:

1. **Ambient fill + no-cast armor.** bicep/underarm boxes sit in *occlusion
   wells* (shoulder caps + shield above). A strong neutral ambient fills them, and
   the well-digging armor (`shoulderCap`, `shield`) is set to RECEIVE but not
   CAST, so the wells fill while the body still drops a shadow.
2. **The shadow lives in vertices.** A vertex-colour shadow needs vertices to land
   on, so the worker adds a dense grid **plinth** under the feet (a sparse floor
   can't hold a gradient). The plinth is part of the exported object.

Repo-dev note: `blender-bake --ref` opens the sketch DB directly. In an installed
mojulo `MOJULO_HOME` points it at the right data dir; running from a repo checkout,
set `MOJULO_DATA_DIR="$(pwd)/data" MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes"`.

## Limits (honest)

- **Baked = frozen.** A baked mesh is a posed still; it does not animate. It rides
  *alongside* a playable rig as the deluxe display variant, never replacing it.
- **View-dependent light does not port.** Reflections and moving speculars are
  camera-dependent; baked vertex colours can't carry them (they stay Blender-render-
  only). Per-vertex shading is a touch chunkier than per-pixel.
- **GI-baked walkable LEVELS are BUILT** — the map-GI bake bicycle
  ([../control/lib/graph/scene/map-gi-bake.plan.md](../control/lib/graph/scene/map-gi-bake.plan.md),
  Depot promoted). What remains is the FIGURE half: a *moving* `unitRef` suit that
  carries baked GI, and its coherence with a GI-baked map. Orientation — including
  the key realization that it is a colour-buffer swap, not a lighting engine
  (mojulo's runtime is already unlit vertex-colour, rig parts included), and that
  it REUSES the map bicycle's position→colour recolour — is in
  [../control/lib/graph/worlds/prelit-figure.plan.md](../control/lib/graph/worlds/prelit-figure.plan.md).

## Output hygiene — the lean GLB (2026-08-11)

A baked suit is a display prop, and the naive export was heavy: an external agent's read of
the `.glb` found ~11% degenerate triangles, fully-unwelded vertices (3.00/tri), and **65% of
vertices pure black** — sealed interior seams the bake ran over that no viewpoint can see. Three
mechanical fixes, no visible change:

1. **Weld + degenerate-drop** (`scene/scene-gltf.js` GLB writer): drop zero-area triangles (the
   padded `[a,b,c,c]` cap/tri convention's degenerate half) and merge byte-identical vertices into
   an indexed primitive when it helps. Source export **−47%** (mk2 341k→152k verts), and because
   the leaner source is what Blender imports, the baked artifact drops too.
2. **Interior cull** (`blender-bake.py`, `--cull-black <linear>`; default `0.004` on the `statue`
   preset): after the bake, delete faces whose every loop baked below the threshold. A sealed
   interior face gets no light path (not even ambient, which needs line-of-sight) so it bakes to
   ~0; a face visible from ANY angle catches GI and is never pure black — so a strict threshold
   removes only never-visible geometry. **No holes from any viewpoint** (verified on mk2 + Zeonic
   Z11, front/back/side). Culls ~45–50% of faces.
3. Net on the served artifact: mk2 **13.7 MB → 6.1 MB (−55%)**, Z11 **16.5 MB → 8.3 MB (−50%)**,
   triangles roughly halved — smaller for the agent, and the interior overdraw that made `/world`
   choke on approach is gone.

Escape hatch: `--cull-black 0` disables the cull for a suit with deep, genuinely-visible recesses.

4. **Decimate** (`--decimate <ratio>`, e.g. 0.5 = keep ~half; opt-in): Collapse-decimate the visible
   shell *after* bake+cull so the GI is computed at full detail, then interpolated onto the survivors.
   Fewer triangles is the one lever that speeds the live viewer (less vertex AND fill). **Ratio is
   suit-dependent:** paneled legs (mk2) take 0.5 cleanly; large smooth *conical* surfaces (the Zaku's
   calves) spike into needles at 0.5 and need ~0.7 — always eyes-gate the curved parts.
5. **Protect region** (`--protect-top <fraction>`, e.g. 0.45): spare the top fraction of the figure
   (head + chest — detail-dense, camera-facing) from the collapse via a height-weighted vertex group,
   so the face keeps its detail while arms/legs/skirt decimate. Costs little (the head is few faces).
6. **Neutral light** (`--neutral-light`): whiten the warm key/rim so a cream albedo (mk2 `#e7dfcf`)
   reads white instead of tan — the down-facing shin panels catch warm key + red-foot GI bounce and
   go brownish otherwise. Ambient unchanged; a per-bake mood dial.

These three are OPT-IN (not preset defaults) — unlike the cull (zero visual change), they trade look
for size/speed, so the operator dials them per bake. Recommended hero-statue combo:
`--decimate 0.5 --protect-top 0.45 --neutral-light` (bump to `--decimate 0.7` for conical suits).

Net on the two smoke-test statues: **13.7 MB → ~3 MB** and the `/world` geometry **263k → 84k faces**
(weld + cull + decimate) with the visible detail preserved. Still owed for a smaller *shared* artifact:
a post-bake weld-by-distance (Blender re-splits verts on smooth colour) and quantize/Draco (bytes, but
breaks mojulo's own re-import — external artifact only). Neither speeds the viewer further.

## Principles — the shading bicycle

This is the loop that turns a flat-albedo mojulo recipe into the sixth-gen-console
look (PS2/GameCube box-art: crisp flat panels lifted by soft baked global
illumination). It is a **bicycle** in the [docs/bicycles.md](bicycles.md) sense — a
self-documenting, two-gate, resumable loop — and every principle below was paid for
by a specific bake that came out wrong. Read them before touching the export or the
worker.

```
author (mojulo geometry + outward normals)
  → export  (unshaded GLB: raw albedo + NORMAL attribute + consistent winding)
  → bake    (Blender Cycles diffuse GI → per-vertex COLOR_0, headless)
  → bind    (bind_mesh_render: the machine gate — full geometry decode before disk)
  → inspect (the eyes gate — the FAITHFUL /world render, not the flat fill)
  → (retry the failing part | done)
```

### The one law

**mojulo authors truth at home; the edge tool consumes it and never guesses at the
seam.** A recipe is idiosyncratic and sovereign; a `.glb` is standard currency. The
whole art is making the currency carry *enough truth* that a conventional tool
(Blender's path tracer) needs no heuristic to light it right. Every failure below is
the same failure: something the export *left for Blender to guess*, and Blender
guessed wrong.

### The principles (each with the failure that taught it)

1. **Author the outward normal in the geometry layer — the generator knows it
   analytically.** A lathe's outward is radial from its axis; an extrude's is the
   profile's edge normal. Do not reconstruct "outward" downstream from winding or a
   centroid heuristic — those are ambiguous and fail on the parts that matter.
   *(Failure: no NORMAL exported → Blender rebuilt normals from winding → mirror-built
   parts baked black.)*

2. **A bake reads the WINDING, not just the NORMAL attribute.** Exporting a correct
   per-vertex normal is necessary but not sufficient: a Cycles *diffuse bake* treats a
   face whose geometric (winding) normal opposes its shading normal as a backface and
   bakes it black. Export **both** — the NORMAL accessor *and* triangle winding made
   consistent with it. *(Failure: normal exported correctly, one arm still baked black;
   winding on the mirrored side opposed the normal.)*

3. **Never assume CCW — detect the winding and correct.** Any normal derived from a
   2D profile's edge normals is outward only for a CCW profile. Hand-mirrored parts
   wind CW → inward normals → black. Detect the winding once (signed area) and flip
   the exported normal to genuine outward; orient-against-the-axis (what the lathe
   does) is the winding-robust construction to copy. *(Failure: the left foot's CW
   profile baked black while the identical-tint right foot was correct.)*

4. **Correct the EXPORT normal, never the shaded fill.** mojulo's own renderers
   tolerate an inward normal (clamped Lambert → dim-but-right-hue). So fix `outNormal`
   (the export-only field) and leave `fill`/`cornerFills` untouched — then every
   emitted page stays byte-identical and only the `.glb` changes. Char-safety is not
   negotiable; the fix rides an export-only field, gated so non-export consumers never
   see it. *(This is why the emit byte-pin stayed green through all three fixes.)*

5. **Every reflection layer must transform the normal.** A mirror moves corners *and*
   flips the outward direction (`n → A·n` for the reflection `A`). A transform that
   moves positions but not the authored normal IS the black-bake bug. There is one
   such layer per posing stage (the assembler's flip; watch the rig/pose stages next).
   Fix each where the reflection happens.

6. **Bake onto raw albedo, never pre-lit geometry.** mojulo bakes its own Lambert +
   AO + material darkening into every colour; bake GI on top of that and light lands
   twice (the "black biceps"). The unshaded export (`FLAT_LIGHT`, litFactor ≡ 1) is
   the mandatory clean base — the GI the bake computes must be the *only* lighting.

7. **The eyes gate must be FAITHFUL, or it lies.** The baked colour lives in
   per-vertex `cornerFills`; a flat-`fill` inspection render masks a black-baked face
   behind a representative corner colour and reports a false pass. Inspect what
   `/world` shows — average `cornerFills` into the display fill. *(Failure: flat-fill
   stills reported "symmetric feet / fixed arms" while `/world` showed the truth; the
   operator's screenshot caught what the machine render hid. When the machine gate and
   the eyes gate disagree, the eyes gate wins — and the machine render was wrong, not
   the eyes.)*

### The two gates, concretely

- **Machine gate** (deterministic, in `bind_mesh_render` + a headless Blender
  introspection): the bound `.glb` must fully decode (no compressed/sparse/triangle-
  less mesh reaches disk); and a mirrored part and its original must import with
  winding *agreeing* with the authored normal on **both** sides (symmetric
  agree-shares), not one side backwards.
- **Eyes gate** (the rider's judgment, against the faithful `/world` render): each
  part reads its intended colour from every angle — no asymmetric black panel, no
  one-side-lit-one-side-dark. Drive it section by section (feet, arms, chest, …); a
  single hero front/back still is not enough — the failures hide at ¾ and from behind.

### Scope

This pipeline is for **mirror-built hard-surface figures baked as a deluxe display
variant**. For premium *stills* (covers, portraits) the RENDER path (`portrait.py`)
auto-orients normals and needs none of this — reach for it first. Static scenery has
no mirror problem and bakes fine untouched. The bake is frozen (see Limits); it rides
*alongside* the playable rig, never replaces it.
