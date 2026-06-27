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
import { resolveMotionMovers } from '@/lib/graph/motion-vocabulary';
import { resolveSignage } from '@/lib/graph/signage-chrome';
import { resolveSceneLighting } from '@/lib/graph/scene-css3d';
import { assembleFractalCityScene } from '@/lib/graph/fractal-city';
import { assembleTransportationHubScene } from '@/lib/graph/transportation-hub';
import { assembleSubwayStationScene } from '@/lib/graph/subway-station';
import { assembleWorkbenchScene, collectWrapSources } from '@/lib/graph/workbench';
import { assembleAssemblerScene } from '@/lib/graph/workbench-assembler';
import { assembleInstanceStudio } from '@/lib/graph/meta-fabricator';
import { assembleRoomScene, assemblePaintedLandscapeScene } from '@/lib/graph/scene-css3d';
import { assembleFloorWorldScene } from '@/lib/graph/polygonizer/floorplan-structure';
import { renderFigureWorldFrames } from '@/lib/graph/polygonizer/figure-render';
import { assembleControllableScene } from '@/lib/graph/controllable-world';
import { assemblePlanetaryScene } from '@/lib/graph/scene-planetary';
import { assembleMoleculeScene } from '@/lib/graph/molecule-view';
import { assembleDnaScene } from '@/lib/graph/dna-view';
import { assembleEnergyCycleScene } from '@/lib/graph/energy-cycle';
import { assembleDnaProcessScene } from '@/lib/graph/dna-process';
import { assembleCellularScene } from '@/lib/graph/cellular-view';
import { assembleAtomScene } from '@/lib/graph/atom-view';
import { assembleMechanicsScene } from '@/lib/graph/mechanics-view';
import { assembleOrbitScene } from '@/lib/graph/orbit-view';
import { assembleCometScene } from '@/lib/graph/comet-view';
import { assembleFieldScene } from '@/lib/graph/field-view';
import { assembleFluidScene } from '@/lib/graph/fluid-view';
import { assembleOceanScene } from '@/lib/graph/ocean-view';
import { assembleGravityWaveScene } from '@/lib/graph/gravity-wave-view';
import { assembleParallelTransportScene } from '@/lib/graph/parallel-transport-view';
import { assembleWindmillScene } from '@/lib/graph/windmill-view';
import { assembleDoubleSlitScene } from '@/lib/graph/double-slit-view';
import { assembleBlackHoleScene } from '@/lib/graph/black-hole-view';
import { assembleSaturnScene } from '@/lib/graph/saturn-view';
import { assembleGalaxyScene } from '@/lib/graph/galaxy-view';
import { assembleStarBirthScene } from '@/lib/graph/star-birth-view';
import { assemblePulsarScene } from '@/lib/graph/pulsar-view';
import { assemblePlasmaGlobeScene } from '@/lib/graph/plasma-globe-view';
import { assembleLightningStormScene } from '@/lib/graph/lightning-storm-view';
import { assembleWavepacketScene } from '@/lib/graph/wavepacket-view';
import { assembleFissionScene } from '@/lib/graph/fission-view';
import { assembleCascadeScene } from '@/lib/graph/cascade-view';
import { assembleFusionScene } from '@/lib/graph/fusion-view';
import { assembleCherenkovScene } from '@/lib/graph/cherenkov-view';
import { assembleReactorScene } from '@/lib/graph/reactor-view';
import { assembleAtmosphereScene } from '@/lib/graph/atmosphere-view';
import { assembleTransformerScene } from '@/lib/graph/transformer-view';
import { assembleVectorMatchScene } from '@/lib/graph/vector-match-view';
// education module — math explainers
import { assembleTransformScene } from '@/lib/graph/transform-view';
import { assembleFieldFlowScene } from '@/lib/graph/field-flow-view';
import { assembleSurfaceScene } from '@/lib/graph/surface-view';
import { assembleSeriesScene } from '@/lib/graph/series-view';
import { assembleProbabilityScene } from '@/lib/graph/probability-view';
import { assembleComplexScene } from '@/lib/graph/complex-view';
import { assembleTrigCircleScene } from '@/lib/graph/trig-circle-view';
import { assemblePythagorasScene } from '@/lib/graph/pythagoras-view';
import { assembleQuadraticScene } from '@/lib/graph/quadratic-view';
import { assembleCompleteSquareScene } from '@/lib/graph/complete-square-view';
import { assembleConicsScene } from '@/lib/graph/conics-view';
import { assembleDerivativeScene } from '@/lib/graph/derivative-view';
import { assembleFtcScene } from '@/lib/graph/ftc-view';
import { renderStoredSketchSvg } from '@/lib/graph/stored-sketch-svg';

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
export const WALK_KINDS = new Set(['fractal-city', 'transportation-hub', 'subway-station', 'painted-landscape', 'room', 'floorplan']);

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
    : kind === 'floorplan'
    ? assembleFloorWorldScene(sketch.manifest, { ...sketch.manifest, view: viewOpts.view ?? sketch.manifest.view, walk: sketch.manifest.walk ?? true, title: titleOf('mojulo house') })
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

  return { payload, kind };
}
