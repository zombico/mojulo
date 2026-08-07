# emit-scope — page-lexical globals a channel block may reference

_S0 census, channel-registry-formalization.plan.md. This is the ALLOWED list: a block that
references a page symbol not on it (and not in its row's `requires`) fails the contract
lint. Yesterday folklore, today a list. The page core that defines these is scene-three.js's
emitted template (from `<script type="module">` onward)._

## Environment

| symbol | what |
|---|---|
| `THREE` | the vendored three.js module namespace |
| `document`, `window`, `performance` | the browser — blocks may add DOM + listeners |

## Page core (defined by the emitted scaffold before any block)

| symbol | what |
|---|---|
| `scene` | THREE.Scene — blocks add their meshes/sprites here |
| `camera` | THREE.PerspectiveCamera (world z-up, camera.up = +Z) |
| `renderer` | THREE.WebGLRenderer (`renderer.domElement` for pointer listeners) |
| `controls` | OrbitControls — walk/controllable disable it when they own the camera |
| `canvas` | the renderer's canvas element |
| `wrap` | the `#wrap` positioning div — HUD widgets/overlays append here |
| `hud` | the `.hud` button strip — channels append their toggle buttons |
| `meshes` | name → THREE.Mesh map of render groups; planets register into it, movers bind from it |
| `solids` | raycastable world meshes (walk collision, pick occlusion); planets push into it |
| `GROUPS` | the serialized render-group payload (pos/col/spec/tex per group) |
| `xrayGroups` | wireframe-toggle bookkeeping for hideable groups |
| `applyCam` | seat the camera on a bookmark (walk exit restores through it) |
| `decodeF32`, `decodeU8` | base64 → typed-array decoders for packed payloads |
| `wireframeOn` | live wireframe-mode flag (tracers dim their focus alpha off it) |
| `_capture` | capture-run flag — `const`, defined immediately BEFORE the game splice anchor; only game (and later blocks) may read it |
| `window.__mojClock` | the pinned overlay clock (set by `frame()`/`step()`) — effects/fx timing |
| `__mojStep(t)` | the assembled runtime stepper — blocks never call it; they ride their registry slot |

## Registry lets (emitted unconditionally by the runtime section scaffold)

Always present even when the owning block is absent — safe for the page loop and later
blocks to reference unconditionally:

`walkPrevT`, `walkOn`, `stepWalk`, `stepTracers`, `stepPlanets`, `stepMovers`,
`stepComets`, `stepFields`, `stepSurfaces`, `stepHeatSpheres`, `stepStarSurfaces`,
`stepBuildups`, `stepTransports`, `stepDeforms`, `stepSigns`, `stepPhysics`,
`stepEvents`, `stepControllable`, `__ctrlActive`, `__ctrlOwnsCamera`
(+ `stepFx` / `stepSpriteSfx`, emitted by scene-three only when those channels are present).

## NOT in scope

Cross-block symbols (`__uvSphereRig`, `__BUS`, `__specPatch`, `window.__mojSim`,
`window.__mojCtrl`, …) are NOT globals — they are provides/requires between rows, declared
on the registry and checked in order. See contract.md's ledger.
