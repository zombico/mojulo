# Supercar close-camera review

The ODM compiler (`control/lib/graph/car-designer/vehicle-odm-surface.js`) produces a deterministic exterior mesh with panel shut lines, framed glazing and five-spoke wheels. `game`, `studio` and `hero` use the same proportions and wheel design, with different tessellation. These are display meshes; the live racer/roster integration remains separate.

From `control/`, render an offline review sheet and orbitable models:

```sh
node scripts/render-supercars.mjs /workspace/supercar-game game pbr
node scripts/render-supercars.mjs /workspace/supercar-close studio pbr
node scripts/render-supercars.mjs /workspace/supercar-baked game baked
node scripts/render-supercars.mjs /workspace/supercar-front game pbr front,side,lights
node scripts/render-supercars.mjs /workspace/supercar-cabin game pbr cabin,spoiler,vents razor,endurance
```

Each run produces front, flank, rear, close chase, headlamp, mirror, cabin, spoiler and vent detail views for the composition cards in `SUPERCAR_LIBRARY`, plus `index.html` and `report.json`. The lit pages include a Wireframe button. No database writes or external textures are required; Chromium must already be installed. The baked mode uses the existing world renderer for comparison.

## Composing the vehicle library

`control/lib/graph/car-designer/vehicle-library.js` defines replayable cards for an Italian-style wedge, a rounded road coupe, a track special and a front-engine fastback. Each combines the existing architectural brief with independent exterior choices:

| Card | Cabin | Cooling | Spoiler |
| --- | --- | --- | --- |
| `razor` | Low wedge with a raked windscreen | Recessed quarter-panel intakes | Swept pedestal wing |
| `strada` | Tapered teardrop coupe | Recessed quarter-panel intakes | Integrated ducktail |
| `endurance` | Tapered teardrop coupe | Recessed quarter-panel intakes | Swan-neck wing and endplates |
| `touring` | Long fastback | Hood extractors | Integrated ducktail |

```js
import {composeSupercar} from './vehicle-library.js';

const car = composeSupercar({
  preset: 'razor', seed: 1014,
  brief: {finish: 'twoTone'},
  surface: {quality: 'studio', paint: 'amber', spoilerStyle: 'swanNeck'},
});
// Store this small recipe and regenerate the same mesh later.
const replay = composeSupercar(JSON.parse(JSON.stringify(car.composition)));
```

`brief` overrides architectural inputs; `surface` overrides the card's exterior choices. Surface options include `cabinStyle` (`wedge`, `teardrop`, `fastback`), `ventStyle` (`none`, `sideBlades`, `hoodLouvers`), `spoilerStyle` (`none`, `ducktail`, `pedestal`, `swanNeck`) and `headlightStyle` as described below. `auto` uses architectural or styling defaults. Resolved choices are exposed on the compiled result. A long cabin without room for a side duct uses hood extractors instead; the resolved `ventStyle` records that fit decision. The cards do not add database rows or change the solved physical frame.

Cabin surfaces use a continuous roof-height curve, a longer raked windscreen, transverse crown, tapered upper glazing and fitted pillars/seals. Vent recesses replace actual body cells and close the hole with perimeter walls and an inset throat; louvres are solid blades. Wings have closed cambered profiles, swept/tapered tips, shaped endplates and solid mounts. The ducktail follows the deck. These are exterior form and readability features; airflow, drag, downforce, cooling and driver accommodation have not been simulated.

## Geometry budgets

`SUPERCAR_LODS` in the compiler is the authoritative definition. The compiler counts the triangles it actually emits and refuses meshes above the selected ceiling. The report includes counts by part, remaining triangles, material groups, unique positions and, for PBR, indexed GPU vertices and geometry buffer bytes. Geometry buffer bytes exclude textures, environment maps, shadow maps and driver overhead.

| Detail | Triangle ceiling | Intended view |
| --- | ---: | --- |
| game | 10,000 | Browser racing exterior and chase view |
| studio | 22,000 | Close garage inspection |
| hero | 44,000 | Detailed exterior inspection |

These are per-car asset limits, not a frame-rate promise. Several cars, scene geometry, pixel resolution and shadows all add cost. The preview currently uses nine vehicle material draws plus a ground draw, with one static shadow map; hardware performance still needs testing in the target game. LOD switching is not automatic in the racing runtime.

## Front forms and headlight selection

The front has a rolled upper edge, a low leading edge and swept corners. The grand tourer uses the softest roll; the wedge keeps more tension and the track design a tighter transition. The blend ends before the front wheel opening. Nose and flank sample boundaries meet, and lamp/intake patches adapt to the actual bumper triangles, including their interiors. These are shape and readability decisions; no drag, downforce or cooling performance has been measured.

| Headlight style | Shape and signature | Design consideration |
| --- | --- | --- |
| `round` | Circular housing, halo and central projector | Give it enough vertical space; suits a softer grand-tourer nose. |
| `catEye` | Outward-swept almond, upper brow and inset projector | Carry the sweep into the fender line while keeping the projector visibly separate from the pointed tip. |
| `slim` | Low rounded housing, upper strip and compact projector pair | Keep a dark perimeter so the thin signature remains readable against bright paint. |

The compiler's `headlightStyle: 'auto'` maps those styles to the respective design languages. Set it independently of the architectural brief to compare styles on the same body:

```js
compileSupercarSurface(
  {seed: 1014, architecture: 'midEngine', language: 'aeroWedge'},
  {quality: 'game', paint: 'scarlet', headlightStyle: 'round'},
);
```

The solved physical frame and rear light design stay the same when only the headlight style changes. The result exposes the resolved `headlightStyle`, and the review report records it. Invalid styles are rejected. Lamp shape and semantic components persist across LODs; the game mesh allocates more cross-body samples to the fender roll, while adaptive patches spend triangles where fascia curvature requires them.

## Exterior detail segmentation

Lights have fitted housings, seals, smoked lenses and separate reflector rings, projectors and light signatures. Rear assemblies separate red bars, reversing lamps and amber indicators. Mirror pods have a painted lid, dark undershell, perimeter seal, reflective inset and closed stalk. Their component boundaries remain at every LOD; small fascia patches use physical-size tessellation. The silver mirror face shares the existing alloy material and is an inspection approximation, not a rendered rear-view camera.

## Surface response

The compiler supplies raw albedo, material identifiers, outward and crease-aware corner normals, plus baked corner colours for the existing unlit world path. The review uses the same mesh with indexed geometry and physical paint, smoked glass, rubber and alloy materials. Glass is opaque smoked glazing; this does not model a transparent cabin interior. Smooth shading preserves creases and material seams. It does not substitute for silhouette geometry.

Regression checks live beside the compiler and include real triangle emission, budget limits, unit normals, panel seams, clearance, stable wheel design, and an offline Chromium material-rendering test. Run from `control/`:

```sh
npm test -- --pool=threads --maxWorkers=2 lib/graph/car-designer
```
