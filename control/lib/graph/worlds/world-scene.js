/**
 * world-scene — the single kind → `assemble*Scene` dispatch seam.
 *
 * A stored sketch manifest is a tiny RECIPE; the full traversable-World geometry is
 * regenerated deterministically by the per-kind assembler. Both the live World route
 * (/api/sketches/[ref]/world → emitThreeWorld) and the .glb export route
 * (/api/sketches/[ref]/model.glb → facesToGlb) resolve the SAME payload here, so the
 * downloadable mesh always matches the rendered World — adding a new world kind in one
 * place keeps both surfaces in sync.
 *
 * `resolveWorldScene` returns `{ payload, kind }` where `payload` is null for any kind
 * with no traversable form (the caller then points the user back at /scene or /svg).
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveMotionMovers } from '@/lib/graph/worlds/motion-vocabulary';
import { resolveSignage } from '@/lib/graph/scene/signage-chrome';
import { resolveSceneLighting } from '@/lib/graph/scene/scene-css3d';
import { assembleFractalCityScene, planFractalCity } from '@/lib/graph/city/fractal-city';
import { composeVolumeFog } from '@/lib/graph/effects/effects-fog';
import { boxFromFootprint } from '@/lib/graph/effects/effects-occluder';
import { composeLandscapeRaymarch } from '@/lib/graph/landscape/painted-landscape-raymarch';
import { assembleTransportationHubScene } from '@/lib/graph/architecture/transportation-hub';
import { assembleSubwayStationScene } from '@/lib/graph/architecture/subway-station';
import { assembleSubwayBuildingScene } from '@/lib/graph/architecture/subway-building';
import { assembleWorkbenchScene, collectWrapSources } from '@/lib/graph/worlds/workbench';
import { assembleAssemblerScene } from '@/lib/graph/worlds/workbench-assembler';
import { assembleInstanceStudio } from '@/lib/graph/meta-fabricator';
import { assembleRoomScene, assemblePaintedLandscapeScene } from '@/lib/graph/scene/scene-css3d';
import { assembleFloorWorldScene } from '@/lib/graph/polygonizer/floorplan-structure';
import { assembleRestaurantWorldScene } from '@/lib/graph/polygonizer/floorplan-restaurant';
import { renderFigureWorldFrames } from '@/lib/graph/polygonizer/figure-render';
import { assembleControllableScene } from '@/lib/graph/worlds/controllable-world';
import { assemblePlanetaryScene } from '@/lib/graph/scene/scene-planetary';
import { assembleMoleculeScene } from '@/lib/graph/views/bio/molecule-view';
import { assembleDnaScene } from '@/lib/graph/views/bio/dna-view';
import { assembleEnergyCycleScene } from '@/lib/graph/views/bio/energy-cycle';
import { assembleDnaProcessScene } from '@/lib/graph/views/bio/dna-process';
import { assembleCellularScene } from '@/lib/graph/views/bio/cellular-view';
import { assembleAtomScene } from '@/lib/graph/views/science/atom-view';
import { assembleMechanicsScene } from '@/lib/graph/views/science/mechanics-view';
import { assembleOrbitScene } from '@/lib/graph/views/science/orbit-view';
import { assembleCometScene } from '@/lib/graph/views/science/comet-view';
import { assembleFieldScene } from '@/lib/graph/views/science/field-view';
import { assembleFluidScene } from '@/lib/graph/landscape/fluid-view';
import { assembleOceanScene } from '@/lib/graph/landscape/ocean-view';
import { assembleGravityWaveScene } from '@/lib/graph/views/science/gravity-wave-view';
import { assembleParallelTransportScene } from '@/lib/graph/views/science/parallel-transport-view';
import { assembleWindmillScene } from '@/lib/graph/vehicles/windmill-view';
import { assembleDoubleSlitScene } from '@/lib/graph/views/science/double-slit-view';
import { assembleBlackHoleScene } from '@/lib/graph/views/science/black-hole-view';
import { assembleSaturnScene } from '@/lib/graph/views/science/saturn-view';
import { assembleGalaxyScene } from '@/lib/graph/views/science/galaxy-view';
import { assembleStarBirthScene } from '@/lib/graph/views/science/star-birth-view';
import { assemblePulsarScene } from '@/lib/graph/views/science/pulsar-view';
import { assemblePlasmaGlobeScene } from '@/lib/graph/views/science/plasma-globe-view';
import { assembleLightningStormScene } from '@/lib/graph/views/science/lightning-storm-view';
import { assembleWavepacketScene } from '@/lib/graph/views/science/wavepacket-view';
import { assembleFissionScene } from '@/lib/graph/views/science/fission-view';
import { assembleCascadeScene } from '@/lib/graph/landscape/cascade-view';
import { assembleFusionScene } from '@/lib/graph/views/science/fusion-view';
import { assembleCherenkovScene } from '@/lib/graph/views/science/cherenkov-view';
import { assembleReactorScene } from '@/lib/graph/views/science/reactor-view';
import { assembleAtmosphereScene } from '@/lib/graph/landscape/atmosphere-view';
import { assembleTransformerScene } from '@/lib/graph/views/math/transformer-view';
import { assembleVectorMatchScene } from '@/lib/graph/views/math/vector-match-view';
// education module — math explainers
import { assembleTransformScene } from '@/lib/graph/views/math/transform-view';
import { assembleFieldFlowScene } from '@/lib/graph/views/science/field-flow-view';
import { assembleSurfaceScene } from '@/lib/graph/views/math/surface-view';
import { assembleSeriesScene } from '@/lib/graph/views/math/series-view';
import { assembleProbabilityScene } from '@/lib/graph/views/math/probability-view';
import { assembleComplexScene } from '@/lib/graph/views/math/complex-view';
import { assembleTrigCircleScene } from '@/lib/graph/views/math/trig-circle-view';
import { assemblePythagorasScene } from '@/lib/graph/views/math/pythagoras-view';
import { assembleQuadraticScene } from '@/lib/graph/views/math/quadratic-view';
import { assembleCompleteSquareScene } from '@/lib/graph/views/math/complete-square-view';
import { assembleConicsScene } from '@/lib/graph/views/math/conics-view';
import { assembleDerivativeScene } from '@/lib/graph/views/math/derivative-view';
import { assembleFtcScene } from '@/lib/graph/views/math/ftc-view';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';

const svgDataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(String(svg), 'utf8').toString('base64')}`;

// Resolve workbench label-wrap sources → a { key: dataURL } texture map. A source is an inline
// `svg` string, a `dataUrl`, or a `sketchRef` (a stored sketch rendered to SVG → data URL — the
// browser rasterizes the SVG when it uploads the texture, so no server-side rasterizer is needed).
// External stash IMAGE items (mediaRef → file) are a documented follow-on.
export async function resolveWrapTextures(manifest) {
  const textures = {};
  for (const { key, source } of collectWrapSources(manifest)) {
    let dataUrl = null;
    if (source && typeof source.dataUrl === 'string') dataUrl = source.dataUrl;
    else if (source && typeof source.svg === 'string') dataUrl = svgDataUrl(source.svg);
    else if (source && typeof source.sketchRef === 'string') {
      const s = SketchRepository.getByRef(source.sketchRef);
      if (s) {
        try { dataUrl = svgDataUrl(await renderStoredSketchSvg(s)); } catch { /* dangling/invalid sketch → skip */ }
      }
    }
    if (dataUrl) textures[key] = dataUrl;
  }
  return textures;
}

// Spatial ("moved through") kinds get first-person traverse on by default; the object-study /
// orbit-only kinds (workbench, vehicle-instance, planetary) are intentionally absent.
export const WALK_KINDS = new Set(['fractal-city', 'transportation-hub', 'subway-station', 'subway-building', 'painted-landscape', 'room', 'floorplan', 'restaurant']);

// Per-kind extractors for the opt-in volumetric `fog` effect (effects-layer.plan.md / P3.5): given a
// manifest, return the SOLID masses the fog clips against, in the World's native z-up centre form.
// Only kinds listed here can carry fog; add a new outdoor renderer by mapping it to its box source.
const FRACTAL_CITY_FOG_KINDS = new Set(['building', 'anchor', 'house', 'townhouse', 'midtower', 'garage']);
const FOG_OCCLUDER_BOXES = {
  'fractal-city': (manifest) => planFractalCity(manifest).boxes
    .filter((b) => FRACTAL_CITY_FOG_KINDS.has(b.kind) && b.z1 > (b.z0 || 0) && b.w > 0 && b.d > 0)
    .map((b) => boxFromFootprint(b, { up: 'z' })),
};

/**
 * resolveWorldScene(sketch) → { payload, kind }
 *
 * Regenerates the traversable-World payload for a stored sketch via its per-kind
 * assembler. `payload` is null when the kind has no World form (the assembleRoomScene
 * fallback returns null for any non-room manifest). Async because the workbench path
 * resolves label-wrap textures (which may render referenced sketches to SVG).
 */
export async function resolveWorldScene(sketch, viewOpts = {}) {
  // declarative scene lighting — same normalization the /scene route uses.
  const scene = sketch.manifest.scene && typeof sketch.manifest.scene === 'object' ? sketch.manifest.scene : {};
  const time = sketch.manifest.time ?? scene.time;
  const sky = sketch.manifest.sky ?? scene.sky;
  // opt-in per-building ground shadows (off unless the manifest asks). `true` for the default
  // look, or an object `{ strength, length, maxAlpha, max }` to tune the cast.
  const groundShadows = sketch.manifest.groundShadows ?? scene.groundShadows ?? false;
  const kind = sketch.manifest.kind;
  const titleOf = (fallback) => sketch.title || sketch.manifest.title || fallback;

  const payload = kind === 'planetary'
    ? assemblePlanetaryScene({ ...sketch.manifest, title: titleOf('mojulo planetary') })
    : kind === 'molecule-view'
    ? assembleMoleculeScene(sketch.manifest, { title: titleOf('mojulo molecule') })
    : kind === 'dna-view'
    ? assembleDnaScene(sketch.manifest, { title: titleOf('mojulo DNA') })
    : kind === 'energy-cycle'
    ? assembleEnergyCycleScene(sketch.manifest, { title: titleOf('mojulo energy cycle') })
    : kind === 'dna-process'
    ? assembleDnaProcessScene(sketch.manifest, { title: titleOf('mojulo DNA process') })
    : kind === 'cellular-view'
    ? assembleCellularScene(sketch.manifest, { title: titleOf('mojulo cell') })
    : kind === 'atom-view'
    ? assembleAtomScene(sketch.manifest, { title: titleOf('mojulo atom') })
    : kind === 'mechanics-view'
    ? assembleMechanicsScene(sketch.manifest, { title: titleOf('mojulo mechanics') })
    : kind === 'orbit-view'
    ? assembleOrbitScene(sketch.manifest, { title: titleOf('mojulo orbit') })
    : kind === 'comet-view'
    ? assembleCometScene(sketch.manifest, { title: titleOf('mojulo comet') })
    : kind === 'field-view'
    ? assembleFieldScene(sketch.manifest, { title: titleOf('mojulo field') })
    : kind === 'fluid-view'
    ? assembleFluidScene(sketch.manifest, { title: titleOf('mojulo fluid') })
    : kind === 'ocean-view'
    ? assembleOceanScene(sketch.manifest, { title: titleOf('mojulo ocean') })
    : kind === 'gravity-wave-view'
    ? assembleGravityWaveScene(sketch.manifest, { title: titleOf('mojulo gravitational waves') })
    : kind === 'parallel-transport-view'
    ? assembleParallelTransportScene(sketch.manifest, { title: titleOf('mojulo parallel transport') })
    : kind === 'windmill-view'
    ? assembleWindmillScene(sketch.manifest, { title: titleOf('mojulo windmill') })
    : kind === 'double-slit-view'
    ? assembleDoubleSlitScene(sketch.manifest, { title: titleOf('mojulo double-slit') })
    : kind === 'black-hole-view'
    ? assembleBlackHoleScene(sketch.manifest, { title: titleOf('mojulo black hole') })
    : kind === 'saturn-view'
    ? assembleSaturnScene(sketch.manifest, { title: titleOf('mojulo Saturn') })
    : kind === 'galaxy-view'
    ? assembleGalaxyScene(sketch.manifest, { title: titleOf('mojulo galaxy') })
    : kind === 'star-birth-view'
    ? assembleStarBirthScene(sketch.manifest, { title: titleOf('mojulo star birth') })
    : kind === 'pulsar-view'
    ? assemblePulsarScene(sketch.manifest, { title: titleOf('mojulo pulsar') })
    : kind === 'plasma-globe-view'
    ? assemblePlasmaGlobeScene(sketch.manifest, { title: titleOf('mojulo plasma globe') })
    : kind === 'lightning-storm-view'
    ? assembleLightningStormScene(sketch.manifest, { title: titleOf('mojulo lightning storm') })
    : kind === 'wavepacket-view'
    ? assembleWavepacketScene(sketch.manifest, { title: titleOf('mojulo wavepacket') })
    : kind === 'fission-view'
    ? assembleFissionScene(sketch.manifest, { title: titleOf('mojulo fission') })
    : kind === 'cascade-view'
    ? assembleCascadeScene(sketch.manifest, { title: titleOf('mojulo chain reaction') })
    : kind === 'fusion-view'
    ? assembleFusionScene(sketch.manifest, { title: titleOf('mojulo fusion') })
    : kind === 'cherenkov-view'
    ? assembleCherenkovScene(sketch.manifest, { title: titleOf('mojulo Cherenkov glow') })
    : kind === 'reactor-view'
    ? assembleReactorScene(sketch.manifest, { title: titleOf('mojulo reactor') })
    : kind === 'atmosphere-view'
    ? assembleAtmosphereScene(sketch.manifest, { title: titleOf('mojulo atmosphere') })
    : kind === 'transformer-view'
    ? assembleTransformerScene(sketch.manifest, { title: titleOf('mojulo transformer attention') })
    : kind === 'vector-match-view'
    ? assembleVectorMatchScene(sketch.manifest, { title: titleOf('mojulo vector match') })
    // ── education module — math explainers ──
    : kind === 'transform-view'
    ? assembleTransformScene(sketch.manifest, { title: titleOf('mojulo linear transform') })
    : kind === 'field-flow-view'
    ? assembleFieldFlowScene(sketch.manifest, { title: titleOf('mojulo vector field') })
    : kind === 'surface-view'
    ? assembleSurfaceScene(sketch.manifest, { title: titleOf('mojulo surface') })
    : kind === 'series-view'
    ? assembleSeriesScene(sketch.manifest, { title: titleOf('mojulo series') })
    : kind === 'probability-view'
    ? assembleProbabilityScene(sketch.manifest, { title: titleOf('mojulo galton board') })
    : kind === 'complex-view'
    ? assembleComplexScene(sketch.manifest, { title: titleOf('mojulo complex function') })
    : kind === 'trig-circle-view'
    ? assembleTrigCircleScene(sketch.manifest, { title: titleOf('mojulo unit circle') })
    : kind === 'pythagoras-view'
    ? assemblePythagorasScene(sketch.manifest, { title: titleOf('mojulo pythagoras') })
    : kind === 'quadratic-view'
    ? assembleQuadraticScene(sketch.manifest, { title: titleOf('mojulo quadratic') })
    : kind === 'complete-square-view'
    ? assembleCompleteSquareScene(sketch.manifest, { title: titleOf('mojulo completing the square') })
    : kind === 'conics-view'
    ? assembleConicsScene(sketch.manifest, { title: titleOf('mojulo conic sections') })
    : kind === 'derivative-view'
    ? assembleDerivativeScene(sketch.manifest, { title: titleOf('mojulo derivative') })
    : kind === 'ftc-view'
    ? assembleFtcScene(sketch.manifest, { title: titleOf('mojulo fundamental theorem') })
    : kind === 'fractal-city'
    ? assembleFractalCityScene({ ...sketch.manifest, time, sky, groundShadows, title: titleOf('mojulo city') })
    : kind === 'transportation-hub'
    ? assembleTransportationHubScene({ ...sketch.manifest, time, sky, title: titleOf('mojulo transportation hub') })
    : kind === 'subway-station'
    ? assembleSubwayStationScene({ ...sketch.manifest, title: titleOf('mojulo subway station') })
    : kind === 'subway-building'
    ? assembleSubwayBuildingScene({ ...sketch.manifest, title: titleOf('mojulo subway') }, { explode: sketch.manifest.explode })
    : kind === 'floorplan'
    ? assembleFloorWorldScene(sketch.manifest, { ...sketch.manifest, view: viewOpts.view ?? sketch.manifest.view, walk: sketch.manifest.walk ?? true, title: titleOf('mojulo house') })
    : kind === 'restaurant'
    ? assembleRestaurantWorldScene(sketch.manifest, { ...sketch.manifest, view: viewOpts.view ?? sketch.manifest.view, walk: sketch.manifest.walk ?? true, title: titleOf('mojulo restaurant') })
    : kind === 'vehicle-instance'
    ? assembleInstanceStudio(
      { type: sketch.manifest.type, family: sketch.manifest.family, decoration: sketch.manifest.decoration },
      { pose: sketch.manifest.pose, viewBox: sketch.manifest.viewBox, title: sketch.title || sketch.manifest.title },
    )
    : kind === 'workbench'
    ? assembleWorkbenchScene({ ...sketch.manifest, title: titleOf('mojulo workbench'), textures: await resolveWrapTextures(sketch.manifest) })
    : kind === 'assembler'
    ? assembleAssemblerScene({ ...sketch.manifest, title: titleOf('mojulo assembler') })
    : kind === 'painted-landscape'
    ? assemblePaintedLandscapeScene(sketch.manifest, { title: titleOf('mojulo terrain') })
    : kind === 'controllable'
    // standalone controllable stage: a bare floor (or manifest.faces) that exists only to host
    // entities, so an entities-only manifest renders without piggybacking on another kind.
    ? assembleControllableScene(sketch.manifest, { title: titleOf('mojulo controllable world') })
    // furnished two-point rooms: returns null for any non-room manifest, so this is a
    // safe final fallback for unrecognized kinds.
    : assembleRoomScene(sketch.manifest, { title: titleOf('mojulo room') });

  // opt-in RAYMARCH backend for painted-landscape (?render=raymarch): a per-pixel terrain/water/sky
  // render (painted-landscape-raymarch.js) instead of the polygon mesh. emitThreeWorld dispatches a
  // `raymarch` payload to emitRaymarchWorld (same path black-hole-view uses), so we swap the whole
  // payload and return early — the mesh channels (motion/signage/walk/…) don't apply to a shader world.
  if (payload && kind === 'painted-landscape' && viewOpts.render === 'raymarch') {
    try {
      const raymarch = composeLandscapeRaymarch(sketch.manifest);
      return { payload: { raymarch, viewBox: payload.viewBox || { width: 1120, height: 780 }, bg: payload.bg || '#9fb6c8', title: payload.title || titleOf('mojulo landscape') }, kind };
    } catch {
      // an unsupportable recipe (should not happen — both engines port) falls back to the mesh world.
    }
  }

  // generic, opt-in MOTION layer: ANY world may carry a `motion` spec — a list of motion-vocabulary
  // rules (ballistic arc, pendulum, spring, …) placed into the scene at a position/scale. Resolved here
  // so every kind gains it uniformly, and appended to the mover channel the renderer already animates.
  // Purely additive — absent `motion` (the common case) leaves every existing payload untouched.
  if (payload && Array.isArray(sketch.manifest.motion) && sketch.manifest.motion.length) {
    const placed = resolveMotionMovers(sketch.manifest.motion);
    if (placed.length) payload.movers = [...(payload.movers || []), ...placed];
  }

  // generic, opt-in adaptive-signage layer (the same channel the /scene + /svg backends read).
  // Chrome is derived from the World's own palette so notes match the scene's visual language.
  // { object } anchors are left unresolved here and bound to a mesh by render-group name at render
  // time (emitThreeWorld's signage channel). Absent `signage` leaves the payload untouched.
  if (payload && Array.isArray(sketch.manifest.signage) && sketch.manifest.signage.length) {
    const { lighting } = resolveSceneLighting(sketch.manifest);
    payload.signs = resolveSignage(sketch.manifest.signage, {
      palette: {
        bg: payload.bg,
        sky: payload.sky ?? lighting?.sky,
        tint: lighting?.tint,
        ambient: lighting?.vexar?.ambient,
        lamps: lighting?.lamps,
        mood: sketch.manifest.time === 'night' ? 'night' : undefined,
      },
    });
  }

  // generic, opt-in PHYSICS property (actions-world.plan.md): ANY world may carry a `physics` block
  // (gravity + bodies with mass/restitution/friction/velocity). It is the only LIVE, non-deterministic
  // channel — the browser runs the integrator rather than replaying a baked path — so a world carrying
  // it is flagged `nonBakeable` (the /svg + /scene stills degrade to frame zero; only /world is live).
  // Purely additive — absent `physics` leaves every existing payload untouched.
  if (payload && sketch.manifest.physics && Array.isArray(sketch.manifest.physics.bodies) && sketch.manifest.physics.bodies.length) {
    payload.physics = sketch.manifest.physics;
    payload.nonBakeable = true;
    // the ACTIONS channel (input → impulse) rides alongside physics — same live tier.
    if (Array.isArray(sketch.manifest.actions) && sketch.manifest.actions.length) {
      payload.actions = sketch.manifest.actions;
    }
  }

  // generic, opt-in CONTROLLABLE channel (controllable-world.plan.md): a manifest may carry `entities`
  // (transform + rule + body) and a `camera` spec — the unified "control a thing in a world" primitive
  // (walk/glide/follow/clock). It rides ON TOP of any recognized world kind (a figure walking a stored
  // city, a drone over a room), so it is gated on an existing `payload`. Input-driven ⇒ `nonBakeable`.
  // `figure-frames` bodies reference a baked-at-resolve-time figure: manifest.figures is a map of
  // name → renderFigureWorldFrames spec ({ motion, proto, frames? }); we bake each here so the stored
  // manifest stays a tiny recipe (no packed geometry persisted), matching the rest of the substrate.
  if (payload && Array.isArray(sketch.manifest.entities) && sketch.manifest.entities.length) {
    payload.entities = sketch.manifest.entities;
    if (sketch.manifest.camera && sketch.manifest.camera.rule) payload.camera = sketch.manifest.camera;
    payload.nonBakeable = true;
    const figs = sketch.manifest.figures;
    if (figs && typeof figs === 'object') {
      payload.figures = {};
      for (const [name, spec] of Object.entries(figs)) {
        if (spec && typeof spec === 'object') payload.figures[name] = renderFigureWorldFrames(spec, spec.frames || 24).frames;
      }
    }
  }

  // generic, opt-in EVENTS channel (event-bus.plan.md): the in-world bus. A manifest may carry an
  // `events` block ({ sources, reactions, sequences, initial, entities }) — declarative reactions
  // that turn physics FACTS (contact/rest) and timers into meaning (spawn/toggle/move/emit), and
  // reach back into physics via the 5b bridge. It rides on top of any kind (typically alongside
  // `physics`), so it is gated on an existing payload. Present (reactions or sequences) ⇒ a LIVE
  // channel the static stills can't run, so `nonBakeable` (the /svg + /scene degrade to frame zero).
  const ev = payload && sketch.manifest.events;
  if (ev && ((Array.isArray(ev.reactions) && ev.reactions.length) || (Array.isArray(ev.sequences) && ev.sequences.length))) {
    payload.events = ev;
    payload.nonBakeable = true;
  }

  // generic, opt-in WALK camera: any world may set `walk: true` (or a config object) to offer the
  // emitThreeWorld first-person Fly/Walk navigation (WASD + pointer-lock look, ground-snap, wall
  // collision against the scene `solids`). Needed by controllable game worlds you move THROUGH — e.g.
  // a laser range. Additive; absent ⇒ orbit only.
  if (payload && sketch.manifest.walk) payload.walk = sketch.manifest.walk;

  // generic, opt-in volumetric FOG (effects-layer.plan.md / P3.5): an outdoor world may set
  // `fog: true` (or a tuning object: { density, height, color, maxDist, ... }) to composite a
  // ground-hugging volumetric fog over the rasterized mesh — a raymarched overlay that clips against
  // the world's solids via a grid-culled scene SDF (see composeVolumeFog + docs/raymarch-effects-layer.md).
  // Only kinds with a registered occluder-box extractor carry it; it renders ONLY on the live /world
  // (three.js) path — the /svg + /scene stills ignore `payload.fog`. Additive; absent ⇒ no fog.
  if (payload && sketch.manifest.fog && FOG_OCCLUDER_BOXES[kind]) {
    const boxes = FOG_OCCLUDER_BOXES[kind](sketch.manifest);
    if (boxes && boxes.length) {
      const opts = (sketch.manifest.fog && typeof sketch.manifest.fog === 'object') ? sketch.manifest.fog : {};
      payload.fog = composeVolumeFog(boxes, { up: 'z', ...opts });
    }
  }

  return { payload, kind };
}
