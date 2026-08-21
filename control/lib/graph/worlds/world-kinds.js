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
import { assembleDungeonScene } from '@/lib/graph/architecture/dungeon-designer';
import { boxFromFootprint } from '@/lib/graph/effects/effects-occluder';
import { assembleTransportationHubScene } from '@/lib/graph/architecture/transportation-hub';
import { assembleSubwayStationScene, planSubwayStation } from '@/lib/graph/architecture/subway-station';
import { assembleSubwayBuildingScene } from '@/lib/graph/architecture/subway-building';
import { assembleWorkbenchScene, collectWrapSources } from '@/lib/graph/worlds/workbench';
import { assembleFigureScene } from '@/lib/graph/figures/figure-world';
import { assembleCarvedSolidScene } from '@/lib/graph/effects/carved-solid-world';
import { assembleSolidTurntableScene } from '@/lib/graph/worlds/solid-turntable';
import { assembleManjiTreeWorld } from '@/lib/graph/worlds/polygomer-world';
import { latestSkinInput } from '@/lib/graph/polygonizer/skin-store';
import { assembleAssemblerScene } from '@/lib/graph/worlds/workbench-assembler';
import { assembleInstanceStudio } from '@/lib/graph/meta-fabricator';
import { assembleRoomScene, assemblePaintedLandscapeScene } from '@/lib/graph/scene/scene-css3d';
import { assembleFloorWorldScene } from '@/lib/graph/polygonizer/floorplan-structure';
import { assembleRestaurantWorldScene } from '@/lib/graph/polygonizer/floorplan-restaurant';
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
// renderStoredSketchSvg is imported LAZILY inside resolveWrapTextures (below): its transitive
// chain (sketch-svg.js) statically pulls a React `.jsx` component, which the Next.js/vitest
// bundlers transform but plain Node cannot parse. Keeping it off the eager import graph lets a
// plain-Node caller (scripts/blender-bake.mjs) import resolveWorldScene → this module to generate
// an unshaded export without dragging in the UI layer. Workbench label-wraps are the only consumer.
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
  const sources = collectWrapSources(manifest);
  // Lazy so the eager import graph stays plain-Node-safe (see the import note above); only a
  // manifest carrying a `sketchRef` wrap source actually needs the SVG renderer.
  let renderStoredSketchSvg = null;
  if (sources.some((s) => s.source && typeof s.source.sketchRef === 'string')) {
    ({ renderStoredSketchSvg } = await import('@/lib/graph/sketch/stored-sketch-svg'));
  }
  for (const { key, source } of sources) {
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

// ambient walkers (city/walkers.plan.md P4): when the city plan produced walker loops, dress + bake a
// small cast of CLOTHED walk rigs (tee + trousers) once and finalize the `walkers` payload the
// scene-three walkers channel reads — a figure name + city-unit path + the scale that sizes the
// (~1.8-unit) bake down to the city's ~0.6-unit people. Motion is /world (three.js) only; the CSS3D
// /scene stays static. A scene without walkerLoops is returned untouched (byte-identical), so this is
// inert for a walkers-off city.
const CITY_PED_HEIGHT = 0.62;   // static adult height in city units (pedestrian-asset ARCHETYPES.adultM)
// outfit colours borrowed from the static-pedestrian PALETTES so the walking crowd matches the standing
// one; spread across the loops so the cast isn't clones.
// four outfits, not more: each clothed rig is a distinct multi-MB bake (geometry can't be shared
// across colours), so the cast is capped to keep the /world page light while still reading as varied.
const WALKER_OUTFITS = [
  { shirt: '#3a6ea5', pants: '#2c3038' },   // blue tee
  { shirt: '#b5483f', pants: '#33363d' },   // red tee
  { shirt: '#d9b65a', pants: '#4a5a3a' },   // mustard tee
  { shirt: '#4f9a78', pants: '#22252b' },   // green tee
];
// the clothed rigs are city-INDEPENDENT, so bake them once and memoize across every city render.
let _walkerRigs = null;
function walkerRigVariants() {
  if (!_walkerRigs) {
    _walkerRigs = (async () => {
      const { bakeProtoformRig } = await import('@/lib/graph/figures/rig-bake');
      const { GARMENTS } = await import('@/lib/graph/polygonizer/figure-garments');
      const outfit = (o) => [{ ...GARMENTS.tee, color: { cloth: o.shirt } }, { ...GARMENTS.trousers, color: { cloth: o.pants } }];
      const out = [];
      for (const o of WALKER_OUTFITS) out.push(await bakeProtoformRig({ proto: { sex: 'male' }, garment: outfit(o), motion: 'walk', keys: 8 }));
      return out;
    })().catch((err) => { _walkerRigs = null; throw err; });   // let a failed bake retry next render
  }
  return _walkerRigs;
}
async function attachCityWalkers(scene) {
  const loops = scene && scene.walkerLoops;
  if (!Array.isArray(loops) || !loops.length) return scene;
  const rigs = await walkerRigVariants();
  const scale = CITY_PED_HEIGHT / (rigs[0].figH || 1.85);
  scene.walkers = loops.map((L, i) => ({ figure: 'ped' + (i % rigs.length), path: L.path, style: L.style || 'bumble', scale, speed: 0.7 }));
  // embed only the outfits actually walking this city (a 2-loop city ships 2 rigs, not all six).
  const used = new Set(scene.walkers.map((w) => w.figure));
  scene.figures = { ...(scene.figures || {}) };
  rigs.forEach((r, i) => { const name = 'ped' + i; if (used.has(name)) scene.figures[name] = r; });
  delete scene.walkerLoops;   // consumed → keep the payload clean for emitThreeWorld
  return scene;
}

// ambient TRAFFIC (the driver-ants): when the city plan produced main-avenue lanes, bake a small cast of
// vehicles once and finalize the `cars` payload the scene-three cars channel reads — a mesh name + a
// pacman lane path + speed. Cars are authored in city units already (unlike the rig, no down-scaling).
// Motion is /world only; the CSS3D /scene stays static. A scene without carLanes is returned untouched.
const CITY_CAR_SCALE = 0.9;   // matches the static street-car ants (vehicleFaces scale)
const CAR_SPEED = 1.26;       // ≈ 1.8× the walker speed (0.7 city units/s)
const CARS_PER_LANE = 3;
// a small mulberry32 so the vehicle cast is deterministic + city-independent (bake once, memoize).
const _mul32 = (a) => () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let _carBank = null;
function carMeshBank() {
  if (!_carBank) {
    _carBank = (async () => {
      const { bakeCarMesh } = await import('@/lib/graph/vehicles/car-bake');
      const rng = _mul32(0x2545f491);
      const bank = {};
      for (let i = 0; i < 6; i++) bank['car' + i] = bakeCarMesh({ scale: CITY_CAR_SCALE, rng });   // sampled type + paint + hull
      return bank;
    })().catch((err) => { _carBank = null; throw err; });
  }
  return _carBank;
}
async function attachCityCars(scene) {
  const lanes = scene && scene.carLanes;
  if (!Array.isArray(lanes) || !lanes.length) return scene;
  const { carLaneToPath } = await import('@/lib/graph/city/fractal-city');
  const bank = await carMeshBank();
  const names = Object.keys(bank);
  const cars = [];
  lanes.forEach((L, li) => {
    const path = carLaneToPath(L);
    for (let k = 0; k < CARS_PER_LANE; k++) {
      cars.push({ car: names[(li * CARS_PER_LANE + k) % names.length], path, speed: CAR_SPEED,
        startFrac: ((k / CARS_PER_LANE) + li * 0.19) % 1 });   // stagger lane-mates + neighbouring lanes
    }
  });
  scene.cars = cars;
  const used = new Set(cars.map((c) => c.car));
  scene.carMeshes = {};
  for (const n of used) scene.carMeshes[n] = bank[n];
  delete scene.carLanes;   // consumed
  return scene;
}

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
    // `unshaded` (GI-bake raw-albedo export) forces plain lighting + FLAT_LIGHT inside the
    // assembler; absent it, every field is byte-identical to before.
    resolve: async (m, ctx) => attachCityCars(await attachCityWalkers(assembleFractalCityScene({ ...m, time: ctx.time, sky: ctx.sky, groundShadows: ctx.groundShadows, title: ctx.title, unshaded: ctx.unshaded }))),
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
  // the fantasy-interior primitive (dungeon-designer): a { chambers, tunnels } graph of
  // organic round chambers at elevation, joined by sloping tube/corridor tunnels, lit by
  // traced fires. Fully enclosed and walkable; no CSS-3D /scene form.
  dungeon: {
    title: 'mojulo dungeon',
    walk: true,
    resolve: (m, ctx) => assembleDungeonScene(m, { title: ctx.title }),
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
  'subway-station': {
    walk: true,
    ao: true,
    // fog clips against the same solids the plan builds (box()/tiledColumn()
    // record their footprints as `occluders`); paper-thin trims are dropped.
    fogBoxes: (m) => planSubwayStation(m).occluders
      .filter((b) => b.z1 > b.z0 && b.w > 0.05 && b.d > 0.05)
      .map((b) => boxFromFootprint(b, { up: 'z' })),
    ...spread(assembleSubwayStationScene, 'mojulo subway station'),
  },
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
    // ctx.light is FLAT_LIGHT under unshaded export (else undefined → WORKBENCH_LIGHT default).
    resolve: async (m, ctx) => assembleWorkbenchScene({
      ...m, title: ctx.title, textures: await resolveWrapTextures(m), skin: await loadBoundSkin(ctx.ref), light: ctx.light,
    }),
  },
  // A polygomer (create_manji_tree) as a turnable 3D model: its slot-bonded lathes
  // lower to baked faces (turntable cameras + .glb export). When a skin is bound
  // (skin_polygomer), it's baked onto the faces so the model wears the painted look.
  'manji-tree': {
    title: 'mojulo polygomer',
    resolve: async (m, ctx) => assembleManjiTreeWorld(m, { title: ctx.title, skin: await loadBoundSkin(ctx.ref), light: ctx.light }),
  },
  assembler: {
    title: 'mojulo assembler',
    resolve: async (m, ctx) => assembleAssemblerScene({ ...m, title: ctx.title, skin: await loadBoundSkin(ctx.ref), light: ctx.light }),
  },
  // ── interchange.plan.md I2: sketch kinds widened into the World/export form ──
  // A lone figure / wordmark / solid is an OBJECT STUDY (orbit, export), not a
  // traversable world — deliberately not `walk` (same posture as workbench /
  // vehicle-instance / manji-tree).
  figure: {
    title: 'mojulo figure',
    resolve: (m, ctx) => assembleFigureScene(m, { title: ctx.title }),
  },
  'carved-solid': {
    title: 'mojulo carved solid',
    resolve: (m, ctx) => assembleCarvedSolidScene(m, { title: ctx.title }),
  },
  'css3d-turntable': {
    title: 'mojulo solid',
    resolve: (m, ctx) => assembleSolidTurntableScene(m, { title: ctx.title }),
  },
  'painted-landscape': { walk: true, ...view(assemblePaintedLandscapeScene, 'mojulo terrain') },
  // standalone controllable stage: a bare floor (or manifest.faces) that exists only to host
  // entities, so an entities-only manifest renders without piggybacking on another kind.
  // fogBoxes: the manifest's own AABB collision hull doubles as the fog occluder — the same
  // masses the platform rule ejects the suit from clip the aerial-perspective fog overlay.
  controllable: {
    ...view(assembleControllableScene, 'mojulo controllable world'),
    fogBoxes: (m) => (Array.isArray(m.colliders) ? m.colliders : [])
      .filter((c) => Array.isArray(c?.min) && Array.isArray(c?.max))
      .map((c) => ({
        cx: (c.min[0] + c.max[0]) / 2, cy: (c.min[1] + c.max[1]) / 2, cz: (c.min[2] + c.max[2]) / 2,
        hx: (c.max[0] - c.min[0]) / 2, hy: (c.max[1] - c.min[1]) / 2, hz: (c.max[2] - c.min[2]) / 2,
      })),
  },
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
