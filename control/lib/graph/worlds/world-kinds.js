/**
 * world-kinds — one descriptor per world kind (world-scene-registry.plan.md).
 *
 * `resolveWorldScene` (world-scene.js) owns context normalization, the registry lookup +
 * room fallback, and the opt-in channel layering; THIS file owns everything world-scene
 * knows about a kind: its assembler import, default title, and calling convention — plus,
 * per kind, the world-facing capability facts (`walk`, `fogBoxes`, and the fields later
 * renderer-convergence steps hang here). A kind's facts are readable in one screen; adding
 * a kind is one table row.
 *
 * Descriptor shape: { title, resolve(manifest, ctx) → payload | Promise<payload>, walk?, fogBoxes? }
 * ctx = { title, time, sky, groundShadows, view, render } — `ctx.title` is already resolved
 * as sketch.title || manifest.title || descriptor.title.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { assembleFractalCityScene, planFractalCity } from '@/lib/graph/city/fractal-city';
import { assembleFractalCondoScene } from '@/lib/graph/architecture/fractal-condo';
import { assembleFractalSchoolScene } from '@/lib/graph/architecture/fractal-school';
import { assembleEdificeScene, planEdifice } from '@/lib/graph/architecture/edifice';
import { boxFromFootprint } from '@/lib/graph/effects/effects-occluder';
import { assembleTransportationHubScene } from '@/lib/graph/architecture/transportation-hub';
import { assembleSubwayStationScene } from '@/lib/graph/architecture/subway-station';
import { assembleSubwayBuildingScene } from '@/lib/graph/architecture/subway-building';
import { assembleWorkbenchScene, collectWrapSources } from '@/lib/graph/worlds/workbench';
import { assembleManjiTreeWorld } from '@/lib/graph/worlds/polygomer-world';
import { latestSkinInput } from '@/lib/graph/polygonizer/skin-store';
import { assembleAssemblerScene } from '@/lib/graph/worlds/workbench-assembler';
import { assembleInstanceStudio } from '@/lib/graph/meta-fabricator';
import { assembleRoomScene, assemblePaintedLandscapeScene } from '@/lib/graph/scene/scene-css3d';
import { assembleFloorWorldScene } from '@/lib/graph/polygonizer/floorplan-structure';
import { assembleRestaurantWorldScene } from '@/lib/graph/polygonizer/floorplan-restaurant';
import { assembleControllableScene } from '@/lib/graph/worlds/controllable-world';
import { assembleOperatorWorldScene } from '@/lib/graph/worlds/operator-world';
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
import { assembleHeatSphereScene } from '@/lib/graph/views/math/heat-sphere-view';
import { assembleStarSurfaceScene } from '@/lib/graph/views/science/star-surface-view';
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
// math worlds — mathematical structures given walkable bodies (math-worlds.plan.md)
import { assembleMathStructureScene } from '@/lib/graph/structures/math-structure';
import { assembleKoenigsbergScene } from '@/lib/graph/structures/koenigsberg';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';
import { latestBoundRender } from '@/lib/graph/image-outcomes/render-store';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const svgDataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(String(svg), 'utf8').toString('base64')}`;

// Resolve workbench label-wrap sources → a { key: dataURL } texture map. A source is an inline
// `svg` string, a `dataUrl`, a `sketchRef` (a stored sketch rendered to SVG → data URL — the
// browser rasterizes the SVG when it uploads the texture, so no server-side rasterizer is needed),
// or an `outcomeRef` (an image-outcome sketch whose latest bound render PNG — the image-worker
// seam's artifact — becomes the label; PNG sources also survive .glb export as real textures).
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
    } else if (source && typeof source.outcomeRef === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(source.outcomeRef)) {
      try {
        const bound = latestBoundRender(source.outcomeRef, typeof source.target === 'string' ? source.target : 'page');
        if (bound) dataUrl = `data:image/png;base64,${(await readFile(bound.path)).toString('base64')}`;
      } catch { /* invalid target / unreadable render → skip */ }
    }
    if (dataUrl) textures[key] = dataUrl;
  }
  return textures;
}

// The two dominant calling conventions; odd kinds write their lambda inline.
const view = (assemble, title) => ({ title, resolve: (m, ctx) => assemble(m, { title: ctx.title }) });
const spread = (assemble, title) => ({ title, resolve: (m, ctx) => assemble({ ...m, title: ctx.title }) });

// Fractal-city fog: which planFractalCity box kinds count as SOLID masses for the volumetric
// fog overlay to clip against (effects-layer.plan.md / P3.5).
const FRACTAL_CITY_FOG_KINDS = new Set(['building', 'anchor', 'house', 'townhouse', 'midtower', 'garage']);

export const WORLD_KINDS = {
  planetary: spread(assemblePlanetaryScene, 'mojulo planetary'),
  'molecule-view': view(assembleMoleculeScene, 'mojulo molecule'),
  'dna-view': view(assembleDnaScene, 'mojulo DNA'),
  'energy-cycle': view(assembleEnergyCycleScene, 'mojulo energy cycle'),
  'dna-process': view(assembleDnaProcessScene, 'mojulo DNA process'),
  'cellular-view': view(assembleCellularScene, 'mojulo cell'),
  'atom-view': view(assembleAtomScene, 'mojulo atom'),
  'mechanics-view': view(assembleMechanicsScene, 'mojulo mechanics'),
  'orbit-view': view(assembleOrbitScene, 'mojulo orbit'),
  'comet-view': view(assembleCometScene, 'mojulo comet'),
  'field-view': view(assembleFieldScene, 'mojulo field'),
  'fluid-view': view(assembleFluidScene, 'mojulo fluid'),
  'ocean-view': view(assembleOceanScene, 'mojulo ocean'),
  'gravity-wave-view': view(assembleGravityWaveScene, 'mojulo gravitational waves'),
  'parallel-transport-view': view(assembleParallelTransportScene, 'mojulo parallel transport'),
  'windmill-view': view(assembleWindmillScene, 'mojulo windmill'),
  'double-slit-view': view(assembleDoubleSlitScene, 'mojulo double-slit'),
  'black-hole-view': view(assembleBlackHoleScene, 'mojulo black hole'),
  'saturn-view': view(assembleSaturnScene, 'mojulo Saturn'),
  'star-surface-view': view(assembleStarSurfaceScene, 'mojulo star surface'),
  'galaxy-view': view(assembleGalaxyScene, 'mojulo galaxy'),
  'star-birth-view': view(assembleStarBirthScene, 'mojulo star birth'),
  'pulsar-view': view(assemblePulsarScene, 'mojulo pulsar'),
  'plasma-globe-view': view(assemblePlasmaGlobeScene, 'mojulo plasma globe'),
  'lightning-storm-view': view(assembleLightningStormScene, 'mojulo lightning storm'),
  'wavepacket-view': view(assembleWavepacketScene, 'mojulo wavepacket'),
  'fission-view': view(assembleFissionScene, 'mojulo fission'),
  'cascade-view': view(assembleCascadeScene, 'mojulo chain reaction'),
  'fusion-view': view(assembleFusionScene, 'mojulo fusion'),
  'cherenkov-view': view(assembleCherenkovScene, 'mojulo Cherenkov glow'),
  'reactor-view': view(assembleReactorScene, 'mojulo reactor'),
  'atmosphere-view': view(assembleAtmosphereScene, 'mojulo atmosphere'),
  'transformer-view': view(assembleTransformerScene, 'mojulo transformer attention'),
  'vector-match-view': view(assembleVectorMatchScene, 'mojulo vector match'),
  // ── education module — math explainers ──
  'transform-view': view(assembleTransformScene, 'mojulo linear transform'),
  'field-flow-view': view(assembleFieldFlowScene, 'mojulo vector field'),
  'surface-view': view(assembleSurfaceScene, 'mojulo surface'),
  'series-view': view(assembleSeriesScene, 'mojulo series'),
  'probability-view': view(assembleProbabilityScene, 'mojulo galton board'),
  'complex-view': view(assembleComplexScene, 'mojulo complex function'),
  'trig-circle-view': view(assembleTrigCircleScene, 'mojulo unit circle'),
  'pythagoras-view': view(assemblePythagorasScene, 'mojulo pythagoras'),
  'quadratic-view': view(assembleQuadraticScene, 'mojulo quadratic'),
  'complete-square-view': view(assembleCompleteSquareScene, 'mojulo completing the square'),
  'conics-view': view(assembleConicsScene, 'mojulo conic sections'),
  'derivative-view': view(assembleDerivativeScene, 'mojulo derivative'),
  'ftc-view': view(assembleFtcScene, 'mojulo fundamental theorem'),
  'heat-sphere-view': view(assembleHeatSphereScene, 'mojulo heat sphere'),

  'fractal-city': {
    title: 'mojulo city',
    walk: true,
    fogBoxes: (m) => planFractalCity(m).boxes
      .filter((b) => FRACTAL_CITY_FOG_KINDS.has(b.kind) && b.z1 > (b.z0 || 0) && b.w > 0 && b.d > 0)
      .map((b) => boxFromFootprint(b, { up: 'z' })),
    resolve: (m, ctx) => assembleFractalCityScene({ ...m, time: ctx.time, sky: ctx.sky, groundShadows: ctx.groundShadows, title: ctx.title }),
  },
  // a finite group as a walkable town: plazas are elements, generators are street types, and a
  // walk that spells a relation returns to its start plaza (math-worlds.plan.md, Phase 1).
  'math-structure': {
    title: 'mojulo Cayley city',
    walk: true,
    resolve: (m, ctx) => assembleMathStructureScene(m, { title: ctx.title }),
  },
  // a playable theorem: the Seven Bridges of Königsberg, where a crossed bridge retracts and the
  // parity argument becomes the shape of the frustration (math-worlds.plan.md, Phase 2).
  koenigsberg: {
    title: 'mojulo Königsberg bridges',
    walk: true,
    resolve: (m, ctx) => assembleKoenigsbergScene(m, { title: ctx.title }),
  },
  'condo-complex': { walk: true, ...view(assembleFractalCondoScene, 'mojulo condo complex') },
  'school-complex': { walk: true, ...view(assembleFractalSchoolScene, 'mojulo school complex') },
  // a bespoke building authored as a graph of masses + concourses (dream-architecture,
  // track E): the "workbench for buildings". fogBoxes clip against the mass/hall envelopes.
  edifice: {
    title: 'mojulo edifice',
    walk: true,
    fogBoxes: (m) => planEdifice(m).envelopes.map((e) => boxFromFootprint({ x: e.x0, y: e.y0, w: e.x1 - e.x0, d: e.y1 - e.y0, z0: 0, z1: e.top }, { up: 'z' })),
    resolve: (m, ctx) => assembleEdificeScene(m, { title: ctx.title, time: ctx.time, sky: ctx.sky, groundShadows: ctx.groundShadows }),
  },
  'transportation-hub': {
    title: 'mojulo transportation hub',
    walk: true,
    resolve: (m, ctx) => assembleTransportationHubScene({ ...m, time: ctx.time, sky: ctx.sky, title: ctx.title }),
  },
  // `ao: true` on an interior kind = baked ambient occlusion ON BY DEFAULT (renderer-convergence
  // 1c) — a manifest `ao: false` still disables it. Profiled (2026-07-04, default fixtures):
  // floorplan 9ms · subway-station 195ms · subway-building 220ms · restaurant 353ms — acceptable
  // one-time emit cost. condo-complex is deliberately NOT defaulted: 692ms on 74k faces AND heavy
  // per-cell overflow at kPerCell=64 (reads lighter than truth) — opt in per manifest instead.
  'subway-station': { walk: true, ao: true, ...spread(assembleSubwayStationScene, 'mojulo subway station') },
  'subway-building': {
    title: 'mojulo subway',
    walk: true,
    ao: true,
    resolve: (m, ctx) => assembleSubwayBuildingScene({ ...m, title: ctx.title }, { explode: m.explode }),
  },
  floorplan: {
    title: 'mojulo house',
    walk: true,
    ao: true,
    resolve: (m, ctx) => assembleFloorWorldScene(m, { ...m, view: ctx.view ?? m.view, walk: m.walk ?? true, title: ctx.title }),
  },
  restaurant: {
    title: 'mojulo restaurant',
    walk: true,
    ao: true,
    resolve: (m, ctx) => assembleRestaurantWorldScene(m, { ...m, view: ctx.view ?? m.view, walk: m.walk ?? true, title: ctx.title }),
  },
  'vehicle-instance': {
    // no default title — assembleInstanceStudio applies its own when the sketch carries none.
    title: undefined,
    resolve: (m, ctx) => assembleInstanceStudio(
      { type: m.type, family: m.family, decoration: m.decoration },
      { pose: m.pose, viewBox: m.viewBox, title: ctx.title },
    ),
  },
  // Workbench + assembler polygomers wear a bound painted skin the same way the
  // manji-tree does (skin_polygomer → bakeBoundSkinFaces at assemble time).
  workbench: {
    title: 'mojulo workbench',
    resolve: async (m, ctx) => assembleWorkbenchScene({
      ...m, title: ctx.title, textures: await resolveWrapTextures(m), skin: await loadBoundSkin(ctx.ref),
    }),
  },
  // A polygomer (create_manji_tree) as a turnable 3D model: its slot-bonded lathes
  // lower to baked faces (turntable cameras + .glb export). When a skin is bound
  // (skin_polygomer), it's baked onto the faces so the model wears the painted look.
  'manji-tree': {
    title: 'mojulo polygomer',
    resolve: async (m, ctx) => assembleManjiTreeWorld(m, { title: ctx.title, skin: await loadBoundSkin(ctx.ref) }),
  },
  assembler: {
    title: 'mojulo assembler',
    resolve: async (m, ctx) => assembleAssemblerScene({ ...m, title: ctx.title, skin: await loadBoundSkin(ctx.ref) }),
  },
  'painted-landscape': { walk: true, ...view(assemblePaintedLandscapeScene, 'mojulo terrain') },
  // standalone controllable stage: a bare floor (or manifest.faces) that exists only to host
  // entities, so an entities-only manifest renders without piggybacking on another kind.
  controllable: view(assembleControllableScene, 'mojulo controllable world'),
  // the operator's own Connected Services state, projected to a walkable block-graph (ground + sky +
  // blocks). Regenerated from the { nodes, edges } the mint tool snapshotted into the manifest.
  'operator-world': { walk: true, ...view(assembleOperatorWorldScene, 'mojulo operator world') },
};

// Furnished two-point rooms: assembleRoomScene returns null for any non-room manifest, so this
// is a safe final fallback for unrecognized kinds — a fallback, NOT a registry entry (the "no
// traversable form" contract callers rely on). `room` IS walkable when it resolves; the world
// route's WALK_KINDS carries it explicitly.
export const ROOM_FALLBACK = { title: 'mojulo room', walk: true, ao: true, resolve: (m, ctx) => assembleRoomScene(m, { title: ctx.title }) };

// Load the latest bound INPUT skin for a polygomer ref as a raw raster (for the
// manji-tree world bake), or null. Kept here (the DB/IO-aware layer) so the
// polygomer-world assembler stays a pure geometry+colour function.
async function loadBoundSkin(ref) {
  if (!ref) return null;
  const bound = latestSkinInput(ref);
  if (!bound || !existsSync(bound.path)) return null;
  const { data, info } = await sharp(await readFile(bound.path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}
