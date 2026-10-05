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
 * Descriptor shape: { title, resolve(manifest, ctx) → payload | Promise<payload>, walk?, fogBoxes?, clouds? }
 *   `fogBoxes(manifest)` → the solid boxes the fog clips against; it also admits the `clouds` deck.
 *   `clouds: true` admits the deck on a kind with no solids to clip (the band clears the mesh's height).
 * ctx = { title, time, sky, groundShadows, view, render } — `ctx.title` is already resolved
 * as sketch.title || manifest.title || descriptor.title.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { assembleFractalCityScene, planFractalCity } from '@/lib/graph/city/fractal-city';
import { pairLanes, laneCapacity, buildSignals, deriveClearance, carFootprint, rectsTouch, TRAFFIC } from '@/lib/graph/scene/channels/traffic-model';
import { resolveCityInsets } from '@/lib/graph/worlds/city-insets';
import { assembleFractalCondoScene } from '@/lib/graph/architecture/fractal-condo';
import { assembleFractalSchoolScene } from '@/lib/graph/architecture/fractal-school';
import { assembleEdificeScene, planEdifice } from '@/lib/graph/architecture/edifice';
import { assembleDungeonScene } from '@/lib/graph/architecture/dungeon-designer';
import { boxFromFootprint } from '@/lib/graph/effects/effects-occluder';
import { assembleTransportationHubScene } from '@/lib/graph/architecture/transportation-hub';
import { assembleSubwayStationScene, planSubwayStation } from '@/lib/graph/architecture/subway-station';
import { assembleSubwayBuildingScene } from '@/lib/graph/architecture/subway-building';
import { assembleWorkbenchScene, collectWrapSources } from '@/lib/graph/worlds/workbench';
import { compileLayered } from '@/lib/graph/polygonizer/station-loft';
import { studioSceneFromFaces, WORKBENCH_LIGHT } from '@/lib/graph/worlds/workbench';
import { withBands, resolveToon } from '@/lib/graph/polygonizer/vexar';
import { layeredFaces, layeredSeat } from '@/lib/graph/polygonizer/station-loft-faces';
import { resolveCharacterLight, layeredShadingNormals, characterLitPieces, characterLitFaces, characterInk, piecesAt, STUDIO_SMOOTH_CREASE } from '@/lib/graph/polygonizer/station-loft-shade';
import { standPose, poseLayered, rigidParts, GESTURE_CLIP, heroClipSeconds } from '@/lib/graph/polygonizer/hero-gesture';
import { validateRig, bindLayered, packLayeredRig, rigNodesAt, boneFrames } from '@/lib/graph/polygonizer/station-loft-rig';
import { heroFaceRig } from '@/lib/graph/polygonizer/anime-face-rig';
import { heroFaceTracks } from '@/lib/graph/polygonizer/anime-face-tracks';
import { gearMounts, gearFaces, gearPackParts } from '@/lib/graph/polygonizer/hero-gear';
import { collectFaceTextures } from '@/lib/graph/landscape/surface-textures';
import { meshSource } from '@/lib/graph/polygonizer/stroke-resolve';
import { silhouetteResidual } from '@/lib/graph/polygonizer/silhouette-solve';
import { residualRuns } from '@/lib/graph/scene/channels/stroke-overlay';
import { frameSource } from '@/lib/graph/scene/wire-svg';
import { LAYERED_VIEW_AZ } from '@/lib/graph/scene/depth-raster';
import { assembleScadScene } from '@/lib/graph/worlds/scad';
import { assembleFigureScene, assembleAnimalScene } from '@/lib/graph/figures/figure-world';
import { assembleCarvedSolidScene } from '@/lib/graph/effects/carved-solid-world';
import { assembleSolidTurntableScene } from '@/lib/graph/worlds/solid-turntable';
import { assembleManjiTreeWorld } from '@/lib/graph/worlds/polygomer-world';
import { latestSkinInput } from '@/lib/graph/polygonizer/skin-store';
import { assembleAssemblerScene, collectAssemblerWrapSources } from '@/lib/graph/worlds/workbench-assembler';
import { assembleInstanceStudio } from '@/lib/graph/meta-fabricator';
import { assembleRoomScene, assemblePaintedLandscapeScene } from '@/lib/graph/scene/scene-css3d';
import { assembleTerrainWorld, resolveTerrainFrom } from '@/lib/graph/terrain/terrain-world';
import { resolveTerrainCities } from '@/lib/graph/terrain/terrain-city';
import { assembleFloorWorldScene, assembleHouseWorldScene, storeyLevels } from '@/lib/graph/polygonizer/floorplan-structure';
import { assembleRestaurantWorldScene } from '@/lib/graph/polygonizer/floorplan-restaurant';
import { assembleStoreWorldScene } from '../retail/store-world.js';
import { assembleMallWorldScene } from '../polygonizer/floorplan-mall.js';
import { assembleControllableScene } from '@/lib/graph/worlds/controllable-world';
import { assemblePlanetaryScene } from '@/lib/graph/scene/scene-planetary';
import { assembleMoleculeScene } from '@/lib/graph/views/bio/molecule-view';
import { assembleDnaScene } from '@/lib/graph/views/bio/dna-view';
import { assembleEnergyCycleScene } from '@/lib/graph/views/bio/energy-cycle';
import { assembleDnaProcessScene } from '@/lib/graph/views/bio/dna-process';
import { assembleCellularScene } from '@/lib/graph/views/bio/cellular-view';
import { assembleAtomScene } from '@/lib/graph/views/science/atom-view';
import { assembleMechanicsScene } from '@/lib/graph/views/science/mechanics-view';
import { assembleRocketScene } from '@/lib/graph/views/science/rocket-view';
import { assembleAirplaneScene } from '@/lib/graph/views/science/airplane-view';
import { assembleOrbitScene } from '@/lib/graph/views/science/orbit-view';
import { assembleCometScene } from '@/lib/graph/views/science/comet-view';
import { assembleFieldScene } from '@/lib/graph/views/science/field-view';
import { assembleFluidScene } from '@/lib/graph/landscape/fluid-view';
import { assembleOceanScene } from '@/lib/graph/landscape/ocean-view';
import { assembleBeachScene } from '@/lib/graph/landscape/beach-view';
import { assembleRiverScene } from '@/lib/graph/landscape/river-view';
import { assembleGravityWaveScene } from '@/lib/graph/views/science/gravity-wave-view';
import { assembleParallelTransportScene } from '@/lib/graph/views/science/parallel-transport-view';
import { assembleWindmillScene } from '@/lib/graph/vehicles/windmill-view';
import { assembleHydroScene } from '@/lib/graph/views/science/hydro-view';
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
import { loadSharp } from '@/lib/sharp-lazy';

const svgDataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(String(svg), 'utf8').toString('base64')}`;

// Resolve workbench label-wrap sources → a { key: dataURL } texture map. A source is an inline
// `svg` string, a `dataUrl`, a `sketchRef` (a stored sketch rendered to SVG → data URL — the
// browser rasterizes the SVG when it uploads the texture, so no server-side rasterizer is needed),
// or an `outcomeRef` (an image-outcome sketch whose latest bound render PNG — the image-worker
// seam's artifact — becomes the label; PNG sources also survive .glb export as real textures).
// External stash IMAGE items (mediaRef → file) are a documented follow-on.
export async function resolveWrapTextures(manifest) {
  return resolveWrapSourceList(collectWrapSources(manifest));
}

// The assembler's frozen parts keep their labels: the same resolver over item-scoped keys
// (`p<index>:wrap_<i>`, see collectAssemblerWrapSources). Absent any wrap, `{}` — byte-identical.
export async function resolveAssemblerWrapTextures(manifest) {
  return resolveWrapSourceList(collectAssemblerWrapSources(manifest));
}

async function resolveWrapSourceList(sources) {
  const textures = {};
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

/** a compiled mesh's height (max z − min z): the character ink's width scale */
const zExtent = (mesh) => { let lo = Infinity, hi = -Infinity; for (const v of mesh.vertices) { if (v[2] < lo) lo = v[2]; if (v[2] > hi) hi = v[2]; } return hi > lo ? hi - lo : 0; };

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
  const scale = (scene.cityCues?.pedHeight ?? CITY_PED_HEIGHT) / (rigs[0].figH || 1.85);   // a metro city walks real-size people (fractal-city METRO)
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
const _carBanks = new Map();   // one bank per car scale: the stock 0.9, and metro's real-size cars
function carMeshBank(scale = CITY_CAR_SCALE) {
  if (!_carBanks.has(scale)) {
    _carBanks.set(scale, (async () => {
      const { bakeCarMesh } = await import('@/lib/graph/vehicles/car-bake');
      const rng = _mul32(0x2545f491);
      const bank = {};
      for (let i = 0; i < 6; i++) bank['car' + i] = bakeCarMesh({ scale, rng });   // sampled type + paint + hull
      return bank;
    })().catch((err) => { _carBanks.delete(scale); throw err; }));
  }
  return _carBanks.get(scale);
}
async function attachCityCars(scene) {
  const cues = scene && scene.cityCues;
  if (cues) delete scene.cityCues;   // consumed here (walkers read it first) → keep the payload clean for emitThreeWorld
  let lanes = scene && scene.carLanes;
  if (!Array.isArray(lanes) || !lanes.length) return scene;
  const { carLaneToPath } = await import('@/lib/graph/city/fractal-city');
  const bank = await carMeshBank(cues?.car ?? CITY_CAR_SCALE);
  const names = Object.keys(bank);
  // SIGNALISED traffic: when the plan exported the crossings, the city's own traffic constants are
  // derived from the MEASURED car bank — the longest and widest model are the collision footprint,
  // the clearance is what that model needs to leave the widest box (deriveClearance) — the phase
  // programs are rebuilt with them, every lane is trimmed at the boxes it starts or ends in and
  // paired with the junctions it crosses (pairLanes, which also drops a second direction a road is too
  // narrow to hold) BEFORE its path is laid, and each lane takes as many cars as its ring can hold
  // with a full footprint + gap between each (carsPerLane). Zero car overlap is the invariant
  // (traffic-model.test.js proves it pairwise, every tick).
  const signalised = Array.isArray(scene.signals) && scene.signals.length > 0 && Array.isArray(scene.junctions);
  let T = TRAFFIC, signals = null;
  if (signalised) {
    const dims = Object.values(bank);
    T = { ...TRAFFIC, CAR_LEN: Math.max(...dims.map((m) => m.len || 0), TRAFFIC.CAR_LEN), CAR_WID: Math.max(...dims.map((m) => m.wid || 0), TRAFFIC.CAR_WID) };
    const maxBox = Math.max(0, ...scene.junctions.map((j) => Math.max(j.wx, j.wy)));
    T.CLEARANCE = deriveClearance(maxBox, T.CAR_LEN, CAR_SPEED, T.ACCEL);
    signals = buildSignals(scene.junctions, scene.trafficSeed ?? 1, scene.trafficRegion, T);
    lanes = pairLanes(lanes, signals, CAR_SPEED, T);
  }
  const cars = [], laneCounts = [];
  lanes.forEach((L, li) => {
    const path = carLaneToPath(L);
    // signalised: the lane takes as many cars as its ring (minus its boxes) holds with each car's OWN
    // measured length + gap between them (laneCapacity), the models assigned round-robin as before
    const nameAt = (k) => names[(li * CARS_PER_LANE + k) % names.length];
    const n = signalised ? laneCapacity(L.total, CARS_PER_LANE, T, L.crossings, (k) => bank[nameAt(k)].len || T.CAR_LEN) : CARS_PER_LANE;
    laneCounts.push(n);
    for (let k = 0; k < n; k++) {
      cars.push({ car: nameAt(k), path, speed: CAR_SPEED, lane: li,
        ...(signalised ? { len: bank[nameAt(k)].len } : {}),
        startFrac: ((k / n) + li * 0.19) % 1 });   // stagger lane-mates + neighbouring lanes
    }
  });
  scene.cars = cars;
  const used = new Set(cars.map((c) => c.car));
  scene.carMeshes = {};
  for (const n of used) scene.carMeshes[n] = bank[n];
  if (signalised) {
    scene.signals = signals;
    scene.trafficLanes = lanes.map((L, li) => ({ axis: L.axis, cross: L.cross, lo: L.lo, hi: L.hi, dir: L.dir, total: L.total, speed: L.speed, crossings: L.crossings, cars: laneCounts[li], ...(L.singled ? { singled: true } : {}) }));
    scene.trafficConstants = T;
    scene.carFootprints = Object.fromEntries(Object.entries(bank).map(([n, m]) => [n, { len: m.len, wid: m.wid }]));
    // STATIC CARS: a portal car-ant (frontage) that lies on any moving lane's swept strip is dropped —
    // removal only, the rng stream untouched — and the survivors are listed so the invariant can be
    // checked against them too
    if (Array.isArray(scene.faces)) {
      const strips = lanes.map((L) => carFootprint(L, 0, 0, T.CAR_WID, T)).map((r, li) => { const L = lanes[li]; return L.axis === 'x' ? { x: Math.min(L.lo, L.hi), y: r.y, w: Math.abs(L.hi - L.lo), d: r.d } : { x: r.x, y: Math.min(L.lo, L.hi), w: r.w, d: Math.abs(L.hi - L.lo) }; });
      const onLane = (rect) => strips.some((s) => rectsTouch(s, { x: rect.x - T.MARGIN, y: rect.y - T.MARGIN, w: rect.w + 2 * T.MARGIN, d: rect.d + 2 * T.MARGIN }));
      const dropped = new Set();
      for (const f of scene.faces) if (f && f.portalCarRect && !dropped.has(f.portalCarKey) && onLane(f.portalCarRect)) dropped.add(f.portalCarKey);
      if (dropped.size) scene.faces = scene.faces.filter((f) => !(f && f.portalCarKey && dropped.has(f.portalCarKey)));
      const statics = new Map();
      for (const f of scene.faces) if (f && f.portalCarRect && !statics.has(f.portalCarKey)) statics.set(f.portalCarKey, f.portalCarRect);
      scene.staticCars = [...statics.values()];
      if (dropped.size) scene.staticCarsDropped = dropped.size;
    }
  } else delete scene.signals;
  delete scene.junctions; delete scene.trafficSeed; delete scene.trafficRegion;
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
  'rocket-view': view(assembleRocketScene, 'mojulo rocket'),
  'airplane-view': view(assembleAirplaneScene, 'mojulo airplane'),
  'orbit-view': view(assembleOrbitScene, 'mojulo orbit'),
  'comet-view': view(assembleCometScene, 'mojulo comet'),
  'field-view': view(assembleFieldScene, 'mojulo field'),
  'fluid-view': view(assembleFluidScene, 'mojulo fluid'),
  'ocean-view': view(assembleOceanScene, 'mojulo ocean'),
  'beach-view': view(assembleBeachScene, 'mojulo beach'),
  'river-view': view(assembleRiverScene, 'mojulo river'),
  'gravity-wave-view': view(assembleGravityWaveScene, 'mojulo gravitational waves'),
  'parallel-transport-view': view(assembleParallelTransportScene, 'mojulo parallel transport'),
  'windmill-view': view(assembleWindmillScene, 'mojulo windmill'),
  'hydro-view': view(assembleHydroScene, 'mojulo hydro'),
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
    // inset edifices (worlds/city-insets.js): minted buildings the recipe names in `edifices`,
    // resolved here (DB) and handed to the DB-free planner; their envelopes clip the fog too.
    fogBoxes: (m) => {
      const plan = planFractalCity({ ...m, insets: resolveCityInsets(m) });
      return [
        ...plan.boxes
          .filter((b) => FRACTAL_CITY_FOG_KINDS.has(b.kind) && b.z1 > (b.z0 || 0) && b.w > 0 && b.d > 0)
          .map((b) => boxFromFootprint(b, { up: 'z' })),
        ...(plan.insets || []).map((i) => boxFromFootprint(i.envelope, { up: 'z' })),   // where the planner actually seated each inset
      ];
    },
    // `unshaded` (GI-bake raw-albedo export) forces plain lighting + FLAT_LIGHT inside the
    // assembler; absent it, every field is byte-identical to before.
    resolve: async (m, ctx) => attachCityCars(await attachCityWalkers(assembleFractalCityScene({ ...m, insets: resolveCityInsets(m), time: ctx.time, sky: ctx.sky, groundShadows: ctx.groundShadows, title: ctx.title, unshaded: ctx.unshaded, toon: ctx.toon }))),
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
    resolve: (m, ctx) => assembleEdificeScene(m, { title: ctx.title, time: ctx.time, sky: ctx.sky, groundShadows: ctx.groundShadows, toon: ctx.toon }),
  },
  // the fantasy-interior primitive (dungeon-designer): a { chambers, tunnels } graph of
  // organic round chambers at elevation, joined by sloping tube/corridor tunnels, lit by
  // traced fires. Fully enclosed and walkable; no CSS-3D /scene form.
  dungeon: {
    title: 'mojulo dungeon',
    walk: true,
    resolve: (m, ctx) => assembleDungeonScene(m, { title: ctx.title, unshaded: ctx.unshaded }),
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
    // A `levels[]` manifest is a STACK (structurizeHouse: one meru, per-level plans and heights,
    // stairs through the slabs, one roof on the top footprint); `storeys: N` (alias `floors`) is
    // the one-field shorthand for that stack, lowered here (storeyLevels) so the recipe stays one
    // field; without either the manifest is the single floor it always was — absent ⇒ byte-identical.
    resolve: (m, ctx) => {
      const opts = { ...m, view: ctx.view ?? m.view, walk: m.walk ?? true, title: ctx.title };
      if (Array.isArray(m.levels) && m.levels.length) return assembleHouseWorldScene(m, opts);
      const stack = storeyLevels(m);
      if (stack) return assembleHouseWorldScene({ ...m, ...stack }, opts);
      return assembleFloorWorldScene(m, opts);
    },
  },
  restaurant: {
    title: 'mojulo restaurant',
    walk: true,
    ao: true,
    resolve: (m, ctx) => assembleRestaurantWorldScene(m, { ...m, view: ctx.view ?? m.view, walk: m.walk ?? true, title: ctx.title }),
  },
  // retail concept cards: one shop from a card, or a mall whose bays are fit from cards
  store: {
    title: 'mojulo store',
    walk: true,
    ao: true,
    resolve: (m, ctx) => assembleStoreWorldScene(m, { walk: m.walk ?? true, title: ctx.title }),
  },
  mall: {
    title: 'mojulo mall',
    walk: true,
    ao: true,
    resolve: (m, ctx) => assembleMallWorldScene(m, { walk: m.walk ?? true, title: ctx.title }),
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
      ...m, title: ctx.title, textures: await resolveWrapTextures(m), skin: await loadBoundSkin(ctx.ref), light: ctx.light, toon: ctx.toon,
    }),
  },
  // A layered station/slot solid (mint_solid kind 'layered'): the stored recipe + dial values lower
  // to a workbench spec on EVERY read (station-loft-workbench.js), so a dial patch reshapes the solid
  // in place and the studio, measure and export legs see the re-lowered monomers.
  layered: {
    title: 'mojulo layered solid',
    resolve: async (m, ctx) => {
      // The compiled mesh IS the solid: every closed part exact, whatever its shape (station-loft-faces.js),
      // on the workbench studio through the same faces seam the scad kind rides.
      const mesh = compileLayered(m.recipe, m.dials || {}, m.channels || {});
      const rigged = !!(m.recipe?.rig && m.recipe?.clips && Object.keys(m.recipe.clips).length);
      const light = withBands(ctx.light || WORKBENCH_LIGHT, resolveToon(ctx.toon)?.bands); const seat = m.seat !== false;
      // The STAND (hero-gesture.js): a HERO (a hero-door row, `m.hero`) whose rigged recipe carries the one-key `gesture`
      // clip shows its static solid skinned at that key (bindLayered → rigNodesAt → boneFrames → skinLayered), seated on
      // the REST floor its planted toes hold; the light below is baked on that posed mesh. Keyed on the hero record, so a
      // plan's own clip of that name stays an ordinary clip. No stand ⇒ the rest mesh, byte-identical.
      const rig = rigged ? (() => { const R = validateRig(m.recipe.rig); return { R, skin: bindLayered(mesh, m.recipe, R) }; })() : null;
      const stand = rig && m.hero ? standPose(m.recipe, rig.R) : null;
      const shown = stand ? poseLayered(mesh, m.recipe, stand, rig).mesh : mesh; const restDz = layeredSeat(mesh, seat);
      // The character light (station-loft-shade.js): ctx.light (FLAT_LIGHT under the unshaded / lit export) wins, then
      // the manifest's `toon.light`, then the anime head's read-time default; the static faces then take the step (two
      // tones, three where the light names a highlight), split crisply along the iso-lines. Null (every other manifest)
      // ⇒ today's Lambert bake, byte-identical. `light` stays the studio key for the grid either way; toon bands band
      // that key, never the character step. The pieces are built ONCE (shading normals, step, split) and shared by the
      // static faces and the rig pack, so the rest solid and the clip preview show the same tones on the same lines.
      // Standing in a gesture, the step and the split are decided on the POSED mesh (the weld and the region weights
      // read the rest), except the parts riding the head bone, lit in the head's OWN frame (rigidParts → the rest
      // normals): a nodded or turned head keeps the shadow shapes it has at rest. The rig pack re-places those pieces on
      // the rest mesh it skins from (piecesAt), so its bind pose carries the same two tones.
      const character = resolveCharacterLight(m, ctx);
      const normals = character ? layeredShadingNormals(shown, m.recipe, stand ? { rest: mesh, rigid: rigidParts(mesh, rig.skin, rig.R, 'head') } : {}) : null;
      const pieces = character ? characterLitPieces(shown, { light: character, normals, palette: m.recipe?.palette, dz: restDz, rest: mesh, glows: m.recipe?.emissive }) : null;
      // SMOOTH under the studio light (a hero without the character light and the anime head: the landmark head, no head;
      // an anime hero with the light turned off keeps the old bake): the faces carry
      // the key at their corners from the welded normals (STUDIO_SMOOTH_CREASE: the skin at 70°, the rest at 35°), so the
      // face reads as one form and the body as muscle instead of facets; the rig pack shades its corners from the same
      // weld on the rest mesh. Standing, the parts riding the head bone are shaded in the head's own frame (their rest
      // normals, as the character light does and as the pack carries them), so a tilted head keeps the shading it has at
      // rest. Any other layered row, and a flat (unshaded) export, keeps one shade per face.
      const smooth = !character && m.hero && m.hero.head !== 'anime' && !light.flat ? layeredShadingNormals(shown, m.recipe, { crease: STUDIO_SMOOTH_CREASE, proxy: false, rest: mesh, ...(stand ? { rigid: rigidParts(mesh, rig.skin, rig.R, 'head') } : {}) }) : null;
      // The character ink: a character-lit figure wears the silhouette hull by default (characterInk — no crease or
      // boundary lines, a width set by the figure's height), unless the manifest says `toon.ink: false`; its own ink
      // fields win. It rides the payload's own `toon` (world-scene keeps a resolver's toon over the manifest's).
      const rawToon = m.toon ?? m.scene?.toon; const toon = ctx && 'toon' in ctx ? ctx.toon : resolveToon(rawToon, { light: true });
      const ink = character ? characterInk(rawToon?.ink === false ? false : toon?.ink, zExtent(mesh)) : null;
      // The DRAW LAYERS (station-loft-shade drawLayer): the faces of a part flagged `through` / `veil` (the graphic face's
      // brows and lids drawn through the fringe) carry that `layer`, and with the ink on every other hair face carries
      // 'hair' (a hair outline never draws over hair), so the World page splits the render group by layer and draws the
      // stencil rules (channels/draw-layers.js); the rig pack orders its parts the same way (`ranges`). A mesh with no
      // flagged part and no ink carries no layer: its faces and pack are the ones before the layers.
      const faces = character
        ? characterLitFaces(shown, m.recipe, { pieces, group: rigged ? 'body' : null, hairInk: !!ink })
        : layeredFaces(shown, m.recipe, { light, seat, group: rigged ? 'body' : null, ...(stand ? { dz: restDz, rest: mesh } : {}), ...(smooth ? { normals: smooth } : {}) });
      // HELD GEAR (hero-gear.js): a hero's `gear` is placed on its bones at rest and carried by the stand's frames, baked
      // by the studio light turned into each item's frame, in the body's group (a clip preview hides it with the body;
      // the pack carries it). Absent ⇒ nothing here, byte-identical.
      const gear = rig && m.hero?.gear ? gearMounts(m.hero, rig.R) : null;
      const gearShown = gear?.length ? gearFaces(gear, { frames: stand ? boneFrames(rig.R, rig.R.joints, rigNodesAt(rig.R, stand).nodes) : null, light, dz: restDz, group: 'body' }) : null;
      if (gearShown) faces.push(...gearShown);
      const scene = studioSceneFromFaces(faces, { units: m.units || 'm', facing: m.facing || '+y', ...(m.grid === false ? { grid: false } : {}), title: ctx.title, light });
      if (ink) { const { light: _light, ...dial } = toon || {}; scene.toon = { ...dial, ink }; }   // the light is baked in, never a page dial
      if (gearShown) { const textures = collectFaceTextures(gearShown, {}); if (Object.keys(textures).length) scene.textures = { ...(scene.textures || {}), ...textures }; }   // a barked staff's bark
      // A rigged recipe with clips also carries its packed rig figure (station-loft-rig.js): the skinned
      // glTF export (`export_model { clips, skinned }`) reads it, `embodies: 'body'` drops the static solid
      // from that export, and `preview` lets the World page play the clips over the hidden solid.
      if (rigged) {
        const { R, skin } = rig; const dz = restDz;
        // hullShade (opt-in, manifest-level): bake COLOR_0 from the smooth L1 hull normal field instead of
        // flat face normals — `hullShade: true | { except: [...] }`; absent ⇒ the pack is byte-identical.
        // rim (opt-in): ms-contrast's fresnel edge `[r,g,b,strength,power]` carried on the packed figure,
        // rendered by the rig-preview channel's rim patch; absent ⇒ byte-identical.
        // Under the character light the pack takes the same pieces (palette, step, split; joints and weights
        // interpolated at the split), and with the character ink the preview inks its moving parts and hides the
        // static outline with the static solid (`preview.ink`, the rig-preview channel).
        // Standing, the static solid IS the stand (skinned exactly), so the preview opens on it (`solid: 'stand'`) and
        // leaves the one-key clip out of its picker (played by rigidly moved parts it would only crack at the joints);
        // the clip stays in the pack for the skinned and engine exports.
        const rim = Array.isArray(m.rim) && m.rim.length === 5 && m.rim.every(Number.isFinite) ? m.rim : null;
        // THE FACE (anime-face-rig.js), only when the export asks (ctx.face: the skinned GLB, the Godot pack's figure): the
        // anime hero's expression channels as morph targets — its rows ride the pack's parts (`morph`), the targets, the
        // authored weights and every word's weights ride the figure (`face`); a row the guards refuse says why
        // (`faceSkipped`) and exports without it. The World page never asks, so its payload is the one before the face.
        const face = ctx.face && rigged && m.hero?.head === 'anime' ? heroFaceRig(m, mesh) : null;
        // CLIP TIMING (hero-gesture.js heroClipSeconds): the anime hero's clips each carry a designed duration (`s` on the
        // packed clip), which the World page's clip preview, the GLB and the Godot pack all play; every other row's clips
        // carry none (three seconds on the page, one in an export, as before). With the face, each clip's facial track
        // and the ambient blink ride the face (anime-face-tracks.js), derived here and never stored.
        const seconds = m.hero?.head === 'anime' ? heroClipSeconds(m.hero, m.recipe.clips) : null;
        if (face?.meta) Object.assign(face.meta, heroFaceTracks(m.hero, m.recipe.clips, seconds, face.authored));
        const pack = packLayeredRig(mesh, skin, R, { clips: m.recipe.clips, keys: 12, dz, hullShade: m.hullShade || null, ...(smooth ? { normals: shown === mesh ? smooth : layeredShadingNormals(mesh, m.recipe, { crease: STUDIO_SMOOTH_CREASE, proxy: false }) } : {}), ...(character ? { character: { pieces: stand ? piecesAt(pieces, mesh, dz) : pieces, hairInk: !!ink } } : {}), ...(face?.rows ? { face } : {}), ...(seconds ? { seconds } : {}), ...(gear?.length ? { gear: gearPackParts(gear, { light, dz }) } : {}), ...(!character && Array.isArray(m.recipe.emissive) && m.recipe.emissive.length ? { emissive: m.recipe.emissive } : {}) });
        const clips = Object.keys(m.recipe.clips).filter((c) => !(stand && c === GESTURE_CLIP));
        scene.figures = { body: { ...pack, ...(face?.meta ? { face: face.meta } : face?.skipped ? { faceSkipped: face.skipped } : {}), ...(rim ? { rim } : {}), embodies: 'body', preview: { clips, hide: 'body', period: 3, ...(ink ? { ink: true } : {}), ...(stand ? { solid: 'stand' } : {}) } } };
      }
      // the stroke overlay (opt-in `channels.strokes`, stroke-affordances): the World page draws on this solid. It
      // carries the wire's framing of the UNSEATED mesh (what a stroke resolves against) and the seat, the stored
      // strokes, and each silhouette's residual against this form as scanline runs. Absent ⇒ byte-identical.
      if (m.channels?.strokes === true) {
        const source = meshSource(mesh); const { target, distance } = frameSource(source);
        const strokes = Array.isArray(m.strokes) ? m.strokes : []; const residuals = {};
        for (const s of strokes) if (s.intent === 'silhouette' && Array.isArray(s.points) && s.points.length >= 3) { const R = silhouetteResidual(mesh, s); residuals[s.id] = { res: R.res, runs: residualRuns(R.mask, R.res), now: { iou: R.iou, share: R.share, bbox: R.bbox } }; }
        scene.strokeOverlay = { ref: ctx.ref || null, dz: layeredSeat(mesh, seat), framing: { target: target.map((v) => Math.round(v * 1e6) / 1e6), distance: Math.round(distance * 1e6) / 1e6, focalPixels: 1400, size: 900 }, views: LAYERED_VIEW_AZ, strokes, residuals };
      }
      return scene;
    },
  },
  // The OpenSCAD front door (scad kind): the source is the recipe, OpenSCAD-in-WASM meshes it,
  // and it rides the workbench studio (light, grid, facing, movers) through the same seam.
  scad: {
    title: 'mojulo scad',
    resolve: async (m, ctx) => assembleScadScene({ ...m, title: ctx.title, light: ctx.light, toon: ctx.toon }),
  },
  // A polygomer (create_manji_tree) as a turnable 3D model: its slot-bonded lathes
  // lower to baked faces (turntable cameras + .glb export). When a skin is bound
  // (skin_polygomer), it's baked onto the faces so the model wears the painted look.
  'manji-tree': {
    title: 'mojulo polygomer',
    resolve: async (m, ctx) => assembleManjiTreeWorld(m, { title: ctx.title, skin: await loadBoundSkin(ctx.ref), light: ctx.light, toon: ctx.toon }),
  },
  assembler: {
    title: 'mojulo assembler',
    resolve: async (m, ctx) => assembleAssemblerScene({
      ...m, title: ctx.title, textures: await resolveAssemblerWrapTextures(m), skin: await loadBoundSkin(ctx.ref), light: ctx.light, toon: ctx.toon,
    }),
  },
  // ── interchange.plan.md I2: sketch kinds widened into the World/export form ──
  // A lone figure / wordmark / solid is an OBJECT STUDY (orbit, export), not a
  // traversable world — deliberately not `walk` (same posture as workbench /
  // vehicle-instance / manji-tree).
  figure: {
    title: 'mojulo figure',
    resolve: (m, ctx) => assembleFigureScene(m, { title: ctx.title, ref: ctx.ref }),
  },
  // The animal study's World form (skin-over-mesh: figure-world
  // assembleAnimalScene) — orbit/export object study, same posture as figure.
  animal: {
    title: 'mojulo animal',
    resolve: (m, ctx) => assembleAnimalScene(m, { title: ctx.title, ref: ctx.ref }),
  },
  'carved-solid': {
    title: 'mojulo carved solid',
    resolve: (m, ctx) => assembleCarvedSolidScene(m, { title: ctx.title }),
  },
  'css3d-turntable': {
    title: 'mojulo solid',
    resolve: (m, ctx) => assembleSolidTurntableScene(m, { title: ctx.title }),
  },
  // clouds: the deck rides over the terrain (no boxes to clip; the band clears the mesh's tallest
  // vertex). The ?render=raymarch backend returns before the channel layer, so it carries no deck.
  'painted-landscape': { walk: true, clouds: true, ...view(assemblePaintedLandscapeScene, 'mojulo terrain') },
  // a painted scene made ground at real scale: the live page meshes it around the camera (the
  // terrain channel's LOD), everything else (exports, stills) gets the baked world. `from: { ref }` resolves to the
  // stored painted-landscape, so a promoted painting follows its source's edits.
  terrain: {
    walk: true, title: 'mojulo terrain world',
    resolve: async (m, ctx) => assembleTerrainWorld({ ...m, from: await resolveTerrainFrom(m), ...(m.cities ? { cities: await resolveTerrainCities(m.cities) } : {}) }, { title: ctx.title, live: !!ctx.live }),
  },
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
export const ROOM_FALLBACK = { title: 'mojulo room', walk: true, ao: true, resolve: (m, ctx) => assembleRoomScene(m, { title: ctx.title, toon: ctx.toon }) };

// Load the latest bound INPUT skin for a polygomer ref as a raw raster (for the
// manji-tree world bake), or null. Kept here (the DB/IO-aware layer) so the
// polygomer-world assembler stays a pure geometry+colour function.
async function loadBoundSkin(ref) {
  if (!ref) return null;
  const bound = latestSkinInput(ref);
  if (!bound || !existsSync(bound.path)) return null;
  const sharp = await loadSharp();
  const { data, info } = await sharp(await readFile(bound.path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}
