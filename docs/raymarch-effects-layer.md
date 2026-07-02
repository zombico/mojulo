# Raymarch effects layer

How mojulo composites **raymarched volumetric effects** (volumetric fog being the first) over the
rasterized three.js mesh worlds — and how to build new ones. The first vertical (fog over
`fractal-city`) is documented blow-by-blow in
[control/lib/graph/effects-layer.plan.md](../control/lib/graph/effects-layer.plan.md); this file is
the durable **principles + primitive inventory + extension recipe**. Read this before adding a new
raymarch visual layer so you extend the spine instead of rebuilding it.

## The core idea

Historically raymarch was a *world-replacement* mode: `emitRaymarchWorld` rendered one fullscreen
shader and threw the mesh scene away. Mesh rasterization and raymarching were mutually exclusive.
The effects layer makes them **cooperate in one framebuffer**: the rasterizer draws the solids; a
raymarched shader rides on top as a transparent, depth-correct **layer**. The unification reduced to
five small reconciliations — internalize these, they are the whole trick:

1. **One camera, expressed twice.** A perspective camera and a per-pixel raymarcher are the same
   projection. Reconstruct the ray basis (right/up/forward + vertical FOV) from the three.js camera
   each frame and feed it as uniforms (`uCamPos`, `uCamBasis`, `uFov`, `uRes`). Once the shader casts
   rays from the *same* camera, the two images register pixel-for-pixel for free — and the layer
   tracks orbit/walk live with no extra logic.
2. **Depth without a depth buffer.** The hard part of mixing raster + raymarch is occlusion: how does
   the fullscreen shader know where the solids are? We do **not** sample a depth texture. The shader
   raymarches an analytic **SDF built from the SAME primitives that produced the meshes** (the
   building boxes). One source of truth, triangulated by the rasterizer and signed-distance-fielded by
   the effect. Depth agreement is structural, not sampled.
3. **Composite through the pass that already exists.** The effect is a fullscreen quad with a
   passthrough vertex shader (emits clip-space directly → always fullscreen, ignores the camera
   transform), `depthTest:false`, premultiplied-alpha blending, a huge `renderOrder`, dropped into the
   normal scene. three's opaque→transparent pipeline draws it last, over the meshes. No render-loop
   surgery; an `onBeforeRender` hook does the per-frame camera feed.
4. **Two output models — image vs layer.** The volume march can output an opaque *image* (background
   composite + tonemap, alpha 1) or a premultiplied *layer* (`emission, 1−transmittance`, no
   background, no tonemap) that alpha-blends over the mesh. The layer mode is what makes it ride on the
   world instead of replacing it.
5. **Reconcile the frame.** The standalone raymarch views are Y-up; the World mesh is Z-up. The
   occluder/effect must be authorable in either frame so it can live in the World's native coordinates,
   aligned with the mesh (no centering).

## Primitive inventory (the spine)

Build new effects by composing/extending these — do not start from scratch.

| Primitive | File | What it is |
|---|---|---|
| `buildVolumeFrag({ … })` | [volume-raymarch.js](../control/lib/graph/volume-raymarch.js) | The reusable emission/absorption march. You supply a `volSample(p[,rd], out emis, out ext)` transfer function via `globals`. `overlay:true` → premultiplied layer output (composites over a mesh); default → opaque image (bounding sphere + background + tonemap). `occluder:{ sdfFn, … }` clips the march at the first solid via sphere-tracing. |
| `SDF_GLSL` | [sdf-glsl.js](../control/lib/graph/sdf-glsl.js) | GLSL SDF primitives: `sdfSphere/sdfBox/sdfEllipsoid` + set ops `opU/sdfSmin/sdfSmax`. Concatenate BEFORE any consumer GLSL. |
| `bakeBoxField` / `boxFieldGLSL` / `boxFromFootprint` | [effects-occluder.js](../control/lib/graph/effects-occluder.js) | The grid-culled **scene-SDF occluder**: bake a box set + a coarse uniform grid (cell→box-index table) into Float32 data textures, and the matching GLSL that decodes them so the SDF tests only the boxes in each ray-point's cell. `up:'y'|'z'` selects the vertical axis. `boxFromFootprint` adapts fractal-city's z-up footprint boxes. |
| `composeVolumeFog(boxes, opts)` | [effects-fog.js](../control/lib/graph/effects-fog.js) | The productized fog effect: bakes the box field, composes occluder + fog transfer fn + overlay shader, returns `{ frag, customUniforms, dataTextures }` ready for `emitThreeWorld`'s `fog`. |
| `emitThreeWorld({ …, fog })` | [scene-three.js](../control/lib/graph/scene-three.js) | The mesh-world host. The `fog` param adds the effect as the transparent fullscreen quad (premultiplied blend, depthTest off, `onBeforeRender` camera feed). `dataTextures` builds Float32 `DataTexture`s in-page. |
| `emitRaymarchWorld({ …, dataTextures })` | [scene-three.js](../control/lib/graph/scene-three.js) | The standalone raymarch host (no mesh) — for opaque, full-frame raymarch worlds and for isolating an effect's SDF/transfer fn before composing it over a mesh. |
| `resolveWorldScene` `fog` setting | [world-scene.js](../control/lib/graph/world-scene.js) | The opt-in wiring: a manifest `fog: true \| {tuning}` on a kind with a registered occluder-box extractor (`FOG_OCCLUDER_BOXES`) attaches `payload.fog = composeVolumeFog(...)`. Renders only on the live `/world` path. |

## Recipe — add a new raymarch effect layer

Say you want light-shafts, rain, heat-shimmer, or a force-field over a world:

1. **Transfer function.** Write the GLSL `void volSample(vec3 p[, vec3 rd], out vec3 emis, out vec3 ext)`
   that defines your effect's emission + extinction as a function of position (and view dir, with
   `rayDirArg:true`). This is the *whole* creative surface — fog is just one transfer function.
2. **Occluder.** If the effect must respect the world's solids, reuse the box-field occluder
   (`bakeBoxField`/`boxFieldGLSL`) so it clips against the same primitives the mesh came from. New
   geometry classes (non-box solids, caves) → add an SDF primitive to `sdf-glsl.js` and a matching
   field, keeping the grid-cull + conservative cell-bounded stepping.
3. **Shader.** `buildVolumeFrag({ globals: SDF_GLSL + occluderGLSL + yourGLSL, overlay:true,
   occluder, rayDirArg, … })`.
4. **Host.** Pass `{ frag, customUniforms, dataTextures }` as `emitThreeWorld`'s `fog` (rename the
   param if you generalize it to `effects[]`) — or `emitRaymarchWorld` for a standalone full-frame
   version while iterating.
5. **Productize + wire.** Wrap step 1–4 in a `compose*` helper (like `composeVolumeFog`), then make it
   an opt-in `resolveWorldScene` setting with a per-kind occluder-box extractor.

## Worked examples

- **Volumetric fog** over the city — the first vertical; `composeVolumeFog` + `emitThreeWorld({ fog })`,
  wired as a `resolveWorldScene` setting.
- **River + waterfall** (`control/scripts/render-river.mjs`) — terrain + water as SDF surfaces (the
  occluder's `groundFn`) + volumetric spray as `volSample`. New transfer function, same spine.
- **Painted-landscape port** (`control/scripts/render-landscape.mjs`) — a real substrate generator
  (`painted-landscape.js`) ported to raymarch: resolve the recipe JS-side (`resolveHeartbeat` /
  `derivePalette` / `deriveSky`) → bake the numbers into GLSL that runs painted-landscape's own
  height/slope/Lambert/ramp equations as a terrain SDF. The pattern for porting any recipe-driven
  generator: **resolve to numbers in JS, evaluate the same math per-pixel in GLSL** (don't reimplement
  the RNG in the shader).

## Gotchas (each cost real debugging time)

- **Cell-wall step floor MUST exceed the occluder `surfEps`.** The grid SDF clamps the step to the
  cell boundary; if that clamp can return a value below the sphere-tracer's surface epsilon, every
  grid line reads as a phantom wall (a chaotic warped surface). `boxFieldGLSL`'s `wallFloor` (0.12)
  must stay > the occluder `surfEps` (0.02).
- **`up` must match across bake, GLSL, and transfer fn.** `bakeBoxField`, `boxFieldGLSL`, and your
  height-based density must agree on the vertical axis (`y` for raymarch frame, `z` for World mesh).
- **Bounds differ by output mode.** Opaque marches a bounding sphere (`uRmax`, origin-centred);
  overlay marches `[0, uMaxDist]` clipped by the SDF (no centering needed — works in native coords).
- **Occlusion is against the box HULL, not the fine mesh.** Acceptable (sub-pixel-soft) for soft fog;
  a sharp effect needing pixel-exact occlusion against window ledges/setbacks would require the
  depthTexture pass we deliberately skipped.
- **Data textures must be `FloatType` RGBA, `NearestFilter`.** Indices/coords need exact values;
  linear filtering corrupts them.

## Verification discipline (how this was kept tractable)

It's headless — you can't eyeball a live page, so:

- **Render to PNG and read it.** Drive `emitThreeWorld`/`emitRaymarchWorld` HTML through
  `renderWorldToPng` (puppeteer + SwiftShader/ANGLE). Also write the `.html` (`inline:true` → opens
  from `file://`, no server) so a human can interact.
- **Keep an unrolled control.** When a data-driven path (textures/grid) misbehaves, render the same
  geometry unrolled directly into GLSL. If the control is right and the data path is wrong, the bug is
  in the bake/decode — not the math.
- **Add a `DBG` toggle** that strips the effect and shows the raw occluder SDF with plain shading, to
  separate geometry bugs from effect bugs.
- **Isolate before composing.** Get the effect right in `emitRaymarchWorld` (opaque, standalone)
  before making it an overlay over a mesh.
