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
import { assembleFractalCityScene, planFractalCity, CITY_METERS_PER_UNIT } from '@/lib/graph/city/fractal-city';
import { assembleRoadwayScene } from '@/lib/graph/roads/roadway';
import { pairLanes, laneCapacity, laneTurns, buildSignals, deriveClearance, carFootprint, rectsTouch, TRAFFIC } from '@/lib/graph/scene/channels/traffic-model';
import { resolveCityInsets } from '@/lib/graph/worlds/city-insets';
import { assembleFractalCondoScene } from '@/lib/graph/architecture/fractal-condo';
import { assembleFractalSchoolScene } from '@/lib/graph/architecture/fractal-school';
import { assembleEdificeScene, planEdifice } from '@/lib/graph/architecture/edifice';
import { assembleDungeonScene } from '@/lib/graph/architecture/dungeon-designer';
import { assembleStageScene } from '@/lib/graph/era/stage';
import { assembleGeocubeScene, geocubeReadout } from '@/lib/graph/era/geocube';
import { geocubeCity, withSidewalkCamera } from '@/lib/graph/era/geocube-city';
import { styleReadout } from '@/lib/graph/era/arch-style';
import { attachDummy } from '@/lib/graph/local-meru/dummy';
import { assembleBoardScene } from '@/lib/graph/board/board-scene';
import { assembleEgocubeScene } from '@/lib/graph/egocube/kind.js';
import { assembleHeartbeatScene } from '@/lib/graph/level/heartbeat-scene';
import { assembleCityScene, cityFogBoxes } from '@/lib/graph/city/plan/scene';
import { assembleHistoricKindScene } from '@/lib/graph/historic/historic-kind';
import { historicAudio } from '@/lib/graph/historic/soundtrack';
import { boxFromFootprint } from '@/lib/graph/effects/effects-occluder';
import { assembleTransportationHubScene } from '@/lib/graph/architecture/transportation-hub';
import { assembleSubwayStationScene, planSubwayStation } from '@/lib/graph/architecture/subway-station';
import { assembleSubwayBuildingScene } from '@/lib/graph/architecture/subway-building';
import { assembleWorkbenchScene, collectWrapSources } from '@/lib/graph/worlds/workbench';
import { compileLayered } from '@/lib/graph/polygonizer/station-loft';
import { heroCastLight } from '@/lib/graph/era/cast-light';
import { faceTint } from '@/lib/graph/polygonizer/face-tint';
import { bakeSampler, stackTints, stackFace, bakePieces } from '@/lib/graph/polygonizer/surface-bake';
import { levelClothBake, recipeTones } from '@/lib/graph/materials/dress-materials';
import { readGeocube } from '@/lib/graph/era/geocube';
import { fieldPaintOf, fieldColours } from '@/lib/graph/polygonizer/field-paint';
import { heroFieldPaint } from '@/lib/graph/polygonizer/hero-emblem';
import { drawnMarkings, drawnCrease } from '@/lib/graph/polygonizer/creature-silhouette.js';
import { TIERED_FACE_TINT, tieredPole, heroShade } from '@/lib/graph/polygonizer/tiered-form';
import { studioSceneFromFaces, WORKBENCH_LIGHT } from '@/lib/graph/worlds/workbench';
import { withBands, resolveToon } from '@/lib/graph/polygonizer/vexar';
import { layeredFaces, layeredSeat } from '@/lib/graph/polygonizer/station-loft-faces';
import { resolveCharacterLight, layeredShadingNormals, characterLitPieces, characterLitFaces, characterInk, piecesAt, STUDIO_SMOOTH_CREASE } from '@/lib/graph/polygonizer/station-loft-shade';
import { standPose, poseLayered, rigidParts, GESTURE_CLIP, heroClipSeconds, STRUCTURED_SWING_BASE } from '@/lib/graph/polygonizer/hero-gesture';
import { locomotionClips } from '@/lib/graph/polygonizer/hero-motion';
import { validateRig, bindLayered, packLayeredRig, rigNodesAt, boneFrames, layeredClip } from '@/lib/graph/polygonizer/station-loft-rig';
import { isSwing, SWING_HAND, swingClassOfKeys, swingPhases, swingTiming, swingClass, HELD_SWINGS, HELD_STRIKE, swingClipKeys, fitSwing } from '@/lib/graph/polygonizer/hero-swing';
import { faunaBones, packFaunaRig } from '@/lib/graph/fauna/rig';
import { bugBones, packBugRig } from '@/lib/graph/bugs/rig';
import { heroFaceRig, faceKnots } from '@/lib/graph/polygonizer/anime-face-rig';
import { facePaintOf } from '@/lib/graph/polygonizer/face-paint';
import { skinPaintOf } from '@/lib/graph/polygonizer/skin-paint';
import { heroSkinPaint, heroHidden } from '@/lib/graph/epidermis/dermal-hero';
import { heroRelief, reliefOnRecord } from '@/lib/graph/epidermis/dermal-relief';
import { beastCoverStyleOf, beastCoatOf, coverMap } from '@/lib/graph/beast/cover';
import { beastCoatPaint, coatRelief } from '@/lib/graph/beast/coat-atlas';
import { relationalFaceRig, performanceTrack } from '@/lib/graph/polygonizer/relational-face-rig';
import { perform } from '@/lib/graph/face-acting/perform';
import { animePerformanceTrack } from '@/lib/graph/face-acting/anime-read';
/** a packed face part's rows (`morph: { i, d }`, f32) as 16-bit steps of their largest offset (`{ i, q, s }`): the page's
 * players read `q × s` (rig-preview.js, controllable) */
function quantMorph({ i, d }) {
  const b = Buffer.from(d, 'base64'), f = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  let m = 0; for (const x of f) m = Math.max(m, Math.abs(x));
  const s = m > 0 ? m / 32767 : 1, q = Int16Array.from(f, (x) => Math.round(x / s));
  return { i, q: Buffer.from(q.buffer).toString('base64'), s };
}
/** the realistic skin's pages on the World page (an export's are dermal-hero.js's own): the body's a side, and the
 * head's, where the face's detail is (its moles, its marks, its fine lines), twice that */
const PAGE_SKIN = Object.freeze({ page: 1024, headPage: 2048 });
import { readTarget, pxPerMetre, DEFAULT_TARGET } from '@/lib/graph/era/target';
import { planHeight } from '@/lib/graph/era/cast-density';
/** pixels a metre a creature is drawn at (its drawn target, else the default): the skin's level of detail */
const skinPpm = (plan) => { try { return pxPerMetre(readTarget((typeof plan.style?.drawn === 'object' && plan.style.drawn.target) || DEFAULT_TARGET), planHeight(plan)); } catch { return Infinity; } };
import { paintFaceRig, paintFaceBase } from '@/lib/graph/polygonizer/face-paint-rig';
import { heroFaceTracks } from '@/lib/graph/polygonizer/anime-face-tracks';
import { westernFaceRig } from '@/lib/graph/polygonizer/western-face-rig';
import { gearMounts, gearFaces, gearPackParts, gearRestPoint } from '@/lib/graph/polygonizer/hero-gear';
import { statueBaseOf } from '@/lib/graph/statue/expand';
import { statueBaseFaces } from '@/lib/graph/statue/base';
import { creatureStatue, mountedStatue, riderSeat, validateCreatureStatue, carveCreatureRecipe, creatureBaseOf } from '@/lib/graph/statue/creature';
import { resolveMaterial, tagFacesWithMaterial } from '@/lib/graph/polygonizer/materials';
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
import { assembleAirspace } from '@/lib/graph/skyscape/airspace';
import { resolveTerrainCities } from '@/lib/graph/terrain/terrain-city';
import { assembleFloorWorldScene, assembleHouseWorldScene, storeyLevels } from '@/lib/graph/polygonizer/floorplan-structure';
import { assembleInteriorWorldScene } from '@/lib/graph/interior/scene';
import { assembleRestaurantWorldScene } from '@/lib/graph/polygonizer/floorplan-restaurant';
import { assembleStoreWorldScene } from '../retail/store-world.js';
import { assembleMallWorldScene } from '../polygonizer/floorplan-mall.js';
import { assembleBuildingWorldScene, officeInput, validateOfficeManifest } from '../polygonizer/floorplan-building.js';
import { assembleControllableScene } from '@/lib/graph/worlds/controllable-world';
import { assemblePlanetaryScene } from '@/lib/graph/scene/scene-planetary';
import { assembleMoleculeScene } from '@/lib/graph/views/bio/molecule-view';
import { assembleDnaScene } from '@/lib/graph/views/bio/dna-view';
import { assembleEnergyCycleScene } from '@/lib/graph/views/bio/energy-cycle';
import { assembleDnaProcessScene } from '@/lib/graph/views/bio/dna-process';
import { assembleCellularScene } from '@/lib/graph/views/bio/cellular-view';
import { assembleAtomScene } from '@/lib/graph/views/science/atom-view';
import { assembleMechanicsScene } from '@/lib/graph/views/science/mechanics-view';
import { assembleClassicalScene } from '@/lib/graph/science-worlds/classical/world';
import { assembleMicroscopicScene } from '@/lib/graph/science-worlds/microscopic/world';
import { assembleQuantumScene } from '@/lib/graph/science-worlds/quantum/world';
import { assembleRelativisticScene } from '@/lib/graph/science-worlds/relativistic/world';
import { assembleRocketScene } from '@/lib/graph/views/science/rocket-view';
import { assembleAirplaneScene } from '@/lib/graph/views/science/airplane-view';
import { assembleOrbitScene } from '@/lib/graph/views/science/orbit-view';
import { assembleCometScene } from '@/lib/graph/views/science/comet-view';
import { assembleFieldScene } from '@/lib/graph/views/science/field-view';
import { assembleFluidScene } from '@/lib/graph/landscape/fluid-view';
import { assembleOceanScene } from '@/lib/graph/landscape/ocean-view';
import { assembleBeachScene } from '@/lib/graph/landscape/beach-view';
import { assembleRiverScene } from '@/lib/graph/landscape/river-view';
import { assembleWaterfallScene } from '@/lib/graph/landscape/waterfall-view';
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
import { rigSpecies } from '@/lib/graph/mutagen/rig';

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
  // a planned city's walker (city/plan/pedestrians.js) carries its own pace, its start along its loop and the crossings it
  // waits at (`holds`); a legacy loop carries none of them and walks as before
  scene.walkers = loops.map((L, i) => ({ figure: 'ped' + (i % rigs.length), path: L.path, style: L.style || 'bumble', scale, speed: L.speed > 0 ? L.speed : 0.7,
    ...(Number.isFinite(L.start) ? { startFrac: L.start } : {}), ...(Array.isArray(L.holds) ? { holds: L.holds } : {}) }));
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
    // TURNS (opt-in, the planned city's `trafficTurns`: { share }): each lane's near-side turns and its capacity, and
    // its path so the page can draw a car on whichever lane it has turned into; absent, every byte as before
    const turning = scene.trafficTurns && (scene.trafficTurns.share > 0 || scene.trafficTurns.heads) ? laneTurns(lanes, signals, T) : null;
    scene.trafficLanes = lanes.map((L, li) => ({ axis: L.axis, cross: L.cross, lo: L.lo, hi: L.hi, dir: L.dir, total: L.total, speed: L.speed, crossings: L.crossings, cars: laneCounts[li], ...(L.singled ? { singled: true } : {}),
      ...(turning ? { turns: turning[li].turns, cap: Math.max(laneCounts[li], turning[li].cap), path: carLaneToPath(L), share: scene.trafficTurns.share, ...(scene.trafficTurns.heads ? { heads: true } : {}) } : {}) }));
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
  delete scene.junctions; delete scene.trafficSeed; delete scene.trafficRegion; delete scene.trafficTurns;
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
  'classical-view': view(assembleClassicalScene, 'mojulo classical world'),
  'microscopic-view': view(assembleMicroscopicScene, 'mojulo microscopic world'),
  'quantum-view': view(assembleQuantumScene, 'mojulo quantum world'),
  'relativistic-view': view(assembleRelativisticScene, 'mojulo relativistic world'),
  'rocket-view': view(assembleRocketScene, 'mojulo rocket'),
  'airplane-view': view(assembleAirplaneScene, 'mojulo airplane'),
  'orbit-view': view(assembleOrbitScene, 'mojulo orbit'),
  'comet-view': view(assembleCometScene, 'mojulo comet'),
  'field-view': view(assembleFieldScene, 'mojulo field'),
  'fluid-view': view(assembleFluidScene, 'mojulo fluid'),
  'ocean-view': view(assembleOceanScene, 'mojulo ocean'),
  'beach-view': view(assembleBeachScene, 'mojulo beach'),
  'river-view': view(assembleRiverScene, 'mojulo river'),
  'waterfall-view': view(assembleWaterfallScene, 'mojulo waterfall'),
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
    resolve: async (m, ctx) => attachCityCars(await attachCityWalkers(assembleFractalCityScene({ ...m, insets: resolveCityInsets(m), time: ctx.time, sky: ctx.sky, groundShadows: ctx.groundShadows, title: ctx.title, unshaded: ctx.unshaded, toon: ctx.toon, creases: ctx.creases }))),
  },
  // a city on rails (city/plan/): a plan laid layer by layer on a board of cells, shown as its massing and walked.
  // The legacy 'fractal-city' above is frozen; new city work lands here.
  city: {
    title: 'mojulo city plan',
    walk: true,
    // its masses as the volumetric fog's and the cloud deck's solids (`fog`, `clouds`: a level's segment and its ring)
    fogBoxes: (m) => cityFogBoxes(m).map((b) => boxFromFootprint(b, { up: 'z' })),
    // its streets driven by the legacy city's car bank and signalled traffic (city/plan/traffic.js lays the lanes)
    resolve: async (m, ctx) => attachCityCars(await attachCityWalkers(assembleCityScene(m, { title: ctx.title, creases: ctx.creases, ...(ctx.liveSun ? { liveSun: true } : {}) }))),
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
  // a level built the sixth-gen way (era/stage.js): grid rooms dressed by a kit card, tiles multiplied
  // over per-corner baked light, placed torches that also leave as punctual lights. Walkable.
  stage: {
    title: 'mojulo stage',
    walk: true,
    ao: true,   // corners, the junction band and under the cornice darken by occlusion (dirt.js leaves AO to this)
    resolve: (m, ctx) => assembleStageScene(m, { title: ctx.title, unshaded: ctx.unshaded, ...(ctx.liveSun ? { liveSun: true } : {}), ...(ctx.solid ? { solid: true } : {}), ...(ctx.form ? { form: true } : {}), ...(ctx.formLit ? { formLit: true } : {}) }),
  },
  // a geocube (era/geocube.js): one style for a level's inside and outside, shown as one of its two specimens, the
  // bare room or the island landform, each built by the stage. A level is then a stage recipe with `geocube`.
  geocube: {
    title: 'mojulo geocube',
    walk: true,
    ao: true,
    // (a trail, a town or a city is walked by its dummy, local-meru/dummy.js: the specimens that wait on a bake). A city
    // (era/geocube-city.js) is the city plan's, in its units: the dummy stands a person's height in them
    resolve: (m, ctx) => {
      if (m.show === 'city') {
        const { city, cube, pick, style } = geocubeCity(m), p = withSidewalkCamera(assembleCityScene(city, { title: ctx.title || `${cube.title} · city`, route: true, ...(ctx.liveSun ? { liveSun: true } : {}) }), { metersPerUnit: CITY_METERS_PER_UNIT });
        return attachDummy({ ...p, geocube: { ...geocubeReadout(cube, 'city', pick, m), ...(style ? { style: styleReadout(style) } : {}) } }, { scale: 1 / CITY_METERS_PER_UNIT });
      }
      const p = assembleGeocubeScene(m, { title: ctx.title, unshaded: ctx.unshaded, ...(ctx.liveSun ? { liveSun: true } : {}), ...(ctx.solid ? { solid: true } : {}), ...(ctx.form ? { form: true } : {}), ...(ctx.formLit ? { formLit: true } : {}) }, assembleStageScene);
      return p.route ? attachDummy(p) : p;
    },
  },
  // a sport's venue (stadium/stadium.js): the field, grandstands and their crowd, floodlight masts, a skyline and a sky at
  // its hour, composed from the track's set pieces, a kit's ramps on its pole and the fractal structures. Not walked: a
  // sport's channel (court, pitch, meet, turns, holo) owns the camera
  stadium: {
    title: 'mojulo stadium',
    resolve: async (m, ctx) => (await import('@/lib/graph/stadium/stadium.js')).assembleStadiumScene(m, { title: ctx.title === 'mojulo stadium' ? undefined : ctx.title }),
  },
  // a tactics board (board/board-scene.js): square spots over a geocube's ground (its diorama, rooms or land), units on
  // them, played with the tactical camera. Not walked: the board owns the camera and the keys
  board: {
    title: 'mojulo board',
    // a battle's units stood as figures (board/board-figures.js): each look a hero, resolved as the figures map resolves one
    resolve: async (m, ctx) => {
      const P = assembleBoardScene(m, { title: ctx.title === 'mojulo board' ? undefined : ctx.title });
      if (!P.board.battle || m.battle?.figures === false) return P;
      const [{ boardFigures }, { heroFigure }] = await Promise.all([import('@/lib/graph/board/board-figures'), import('@/lib/graph/worlds/world-scene')]);
      return boardFigures(P, { heroFigure });
    },
  },
  // an egocube (egocube/kind.js): a character's design sheet rolled once and kept, shown as its character at each age of
  // its thread, side by side; characters are made from it by ref (create_character { egocube }). A cast's cube shows its
  // members in a line, a beast among them as the animal kind makes it
  egocube: {
    title: 'mojulo egocube',
    resolve: (m, ctx) => assembleEgocubeScene(m, { title: ctx.title, unshaded: ctx.unshaded }, (lm, c) => WORLD_KINDS.layered.resolve(lm, c), (am, c) => WORLD_KINDS.animal.resolve(am, c)),
  },
  // a heartbeat (era/heartbeat.js, level/heartbeat-scene.js): the flow of a level's land apart from its look, shown as a
  // walkable greybox on a reference level. A level lays it with ground.heartbeat and paints it with its kit or geocube.
  heartbeat: {
    title: 'mojulo heartbeat',
    walk: true,
    resolve: (m, ctx) => assembleHeartbeatScene(m, { title: ctx.title }),
  },
  // a culture at its period (historic/historic-kind.js): the town, its land, a farmstead or the works, on the
  // World page. The builder's own title ('mojulo historic city · New Kingdom Thebes') unless the row names one.
  historic: {
    title: 'mojulo historic',
    walk: true,
    resolve: (m, ctx) => assembleHistoricKindScene(m, { title: ctx.title === 'mojulo historic' ? undefined : ctx.title }),
    // `audio.soundtrack: 'default'` is the culture's period music (historic/soundtrack.js); opt-in, absent ⇒ silent
    audio: (m) => historicAudio(m),
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
    ownsWalk: true,   // the resolver reads m.walk (world-scene keeps its framed, reflected walk)
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
  // a room of a house, fitted out (lib/graph/interior/): the house is read from its own row (`house`, a ref; an exported
  // interior may carry it inline), the room's program solved and skinned, and the house built with that room fitted out.
  // The house row is never written; an edit to the house flows into every interior over it.
  interior: {
    title: 'mojulo interior',
    walk: true,
    ownsWalk: true,   // the resolver places the walker in the room
    ao: true,
    resolve: (m, ctx) => {
      const house = typeof m.house === 'string' ? SketchRepository.getByRef(m.house)?.manifest : m.house;
      if (!house) throw new Error(`interior: no house '${m.house}' — mint_building makes one; an interior decorates a room of a house`);
      if (house.kind !== 'floorplan') throw new Error(`interior: '${m.house}' is a ${house.kind}, not a house (kind 'floorplan')`);
      return assembleInteriorWorldScene(m, house, { title: ctx.title, view: ctx.view });
    },
  },
  restaurant: {
    title: 'mojulo restaurant',
    walk: true,
    ownsWalk: true,   // the resolver reads m.walk (world-scene keeps its framed, reflected walk)
    ao: true,
    resolve: (m, ctx) => assembleRestaurantWorldScene(m, { ...m, view: ctx.view ?? m.view, walk: m.walk ?? true, title: ctx.title }),
  },
  // retail concept cards: one shop from a card, or a mall whose bays are fit from cards
  store: {
    title: 'mojulo store',
    walk: true,
    ownsWalk: true,   // the resolver reads m.walk (world-scene keeps its framed, reflected walk)
    ao: true,
    resolve: (m, ctx) => assembleStoreWorldScene(m, { walk: m.walk ?? true, title: ctx.title }),
  },
  // an office building: a lobby and office floors stacked over one lift-and-stair core
  office: {
    title: 'mojulo office',
    walk: true,
    ownsWalk: true,   // the resolver reads m.walk (world-scene keeps its framed, reflected walk)
    ao: true,
    resolve: (m, ctx) => {
      const errs = validateOfficeManifest(m);
      if (errs.length) throw new Error(errs.join('; '));
      return assembleBuildingWorldScene(officeInput(m), { walk: m.walk ?? true, title: ctx.title });
    },
  },
  mall: {
    title: 'mojulo mall',
    walk: true,
    ownsWalk: true,   // the resolver reads m.walk (world-scene keeps its framed, reflected walk)
    ao: true,
    resolve: (m, ctx) => assembleMallWorldScene(m, { walk: m.walk ?? true, title: ctx.title }),
  },
  'vehicle-instance': {
    // no default title — assembleInstanceStudio applies its own when the sketch carries none.
    title: undefined,
    // (a race machine's instance, { racer } or { supercar }, its theme worn: the family layer builds it)
    resolve: (m, ctx) => assembleInstanceStudio(
      { type: m.type, family: m.family, decoration: m.decoration, ...(m.racer ? { racer: m.racer } : {}), ...(m.supercar ? { supercar: m.supercar } : {}) },
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
      // A CREATURE carved (statue/creature.js, opt-in `statue` on a plan that is not a hero: the creature designer's
      // sphinx, horse, bull): every palette group the material (a `…Groove` group a shade darker: a carved channel), the
      // surfaces tagged; its base below. Absent ⇒ byte-identical.
      const creature = !m.hero && m.statue ? m.statue : null;
      if (creature) { const errs = validateCreatureStatue(creature); if (errs.length) throw new Error(`layered: ${errs.join('; ')}`); m = { ...m, recipe: carveCreatureRecipe(m.recipe, creature) }; }
      // A NAMED HERO'S EMBLEM (hero-emblem.js, `hero.emblem`): lowered to field paint under the row's own, on the place it is
      // worn, its roles coloured from the palette as it reads now. Absent ⇒ the row's field paint as it is
      if (m.hero?.emblem) m = { ...m, fieldPaint: heroFieldPaint(m) };
      // FIELD PAINT (field-paint.js, opt-in `fieldPaint`): the colours its entries name join the palette. Absent ⇒ as before
      if (Array.isArray(m.fieldPaint) && m.fieldPaint.length) { const fcol = fieldColours(m.fieldPaint); if (Object.keys(fcol).length) m = { ...m, recipe: { ...m.recipe, palette: { ...(m.recipe.palette || {}), ...fcol } } }; }
      // The compiled mesh IS the solid: every closed part exact, whatever its shape (station-loft-faces.js),
      // on the workbench studio through the same faces seam the scad kind rides.
      const mesh = compileLayered(m.recipe, m.dials || {}, m.channels || {});
      // and its cut, read off the rest mesh: the studio's faces and the plain pack take the same cells
      const fields = Array.isArray(m.fieldPaint) && m.fieldPaint.length ? fieldPaintOf(mesh, m.fieldPaint) : null;
      const rigged = !!(m.recipe?.rig && m.recipe?.clips && Object.keys(m.recipe.clips).length);
      // a minted animal with MOTION (fauna/rig.js): its species' skeleton and gaits, packed below as the rig figure
      const motioned = !rigged && !!(m.recipe?.motion?.gaits?.length || m.recipe?.motion?.behaviors?.length);
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
      // The CAST light (era/cast-light.js): a hero with a geocube is baked in the cube's light, its key, tinted ambient and
      // ground bounce per channel, the cube's register banding the key, and wears the cube's rim. It takes the place of
      // the studio key on the figure (the grid keeps the studio's) and of the anime head's read-time character light
      // (a `toon.light` the manifest names still wins). An export's ctx.light wins over it. No cube ⇒ null, byte-identical.
      const castLight0 = !ctx.light && m.hero?.geocube ? heroCastLight(m.hero) : null;
      const castLight = castLight0 ? withBands(castLight0, resolveToon(ctx.toon)?.bands) : null;
      const character = castLight && (m.toon ?? m.scene?.toon)?.light == null ? null : resolveCharacterLight(m, ctx);
      const figLight = castLight && !character ? castLight : light;
      // (the tiered form's body is smooth under the character light too: its crease, the anime head's proxy kept)
      const normals = character ? layeredShadingNormals(shown, m.recipe, { ...(stand ? { rest: mesh, rigid: rigidParts(mesh, rig.skin, rig.R, 'head') } : {}), ...(!m.hero && m.plan?.style?.drawn ? { crease: drawnCrease(m.plan), proxy: false } : {}), ...(m.hero?.form === 'tiered' ? (({ crease, face }) => ({ crease, ...(face !== undefined ? { face } : {}) }))(heroShade(m.hero)) : {}) }) : null;
      // a drawn creature's markings (creature-silhouette.js), stepped by the character light as its own colours
      const marks = character && !m.hero && m.plan?.style?.drawn ? drawnMarkings(m.plan, mesh, m.recipe?.palette) : null;
      const pieces = character ? characterLitPieces(shown, { light: character, normals, palette: m.recipe?.palette, dz: restDz, rest: mesh, glows: m.recipe?.emissive, ...(marks ? { tint: marks } : {}) }) : null;
      // SMOOTH under the studio light (a hero without the character light and the anime head: the landmark head, no head;
      // an anime hero with the light turned off keeps the old bake): the faces carry
      // the key at their corners from the welded normals (STUDIO_SMOOTH_CREASE: the skin at 70°, the rest at 35°), so the
      // face reads as one form and the body as muscle instead of facets; the rig pack shades its corners from the same
      // weld on the rest mesh. Standing, the parts riding the head bone are shaded in the head's own frame (their rest
      // normals, as the character light does and as the pack carries them), so a tilted head keeps the shading it has at
      // rest. Any other layered row keeps one shade per face unless it opts in with `smooth: true` (a creature, a
      // sculpted animal); a flat (unshaded) export always does.
      // the tiered form blends its body's own colour groups like the skin (tiered-form.js TIERED_SMOOTH_CREASE)
      // a DRAWN creature (creature-drawn.js, the plan's `style.drawn`) welds its body and fur as one form, and wears its
      // markings (creature-silhouette.js): its own, or countershading and points when its body is one colour
      const drawn = !m.hero && !!m.plan?.style?.drawn;
      const crease = drawn ? drawnCrease(m.plan) : heroShade(m.hero).crease;
      // and its landmark head's normals toward the head's ellipsoid (tiered-form.js TIERED_FACE_SMOOTH)
      const ellipsoid = heroShade(m.hero).ellipsoid;
      // and its skin's occlusion and blush (face-tint.js), read off the rest mesh: the same per corner in any pose
      // and the BAKE STACK (surface-bake.js, opt-in `bake`): painted light per corner, read off the rest mesh, stacked
      // over the head's tint or a drawn creature's markings (their product). Absent ⇒ the tint is the one before it
      // a figure dressed by its level (`recipe.surfaces`: a geocube that names `materials`) with no bake of its own takes
      // the level's painted cloth and leather (dress-materials.js levelClothBake), its other groups left as they are
      // (a statue carries its carving as surfaces: never a level's cloth)
      const levelG = m.hero ? m.hero.geocube : m.geocube, dressedBy = !m.bake && m.recipe?.surfaces && !m.recipe.statue && levelG ? readGeocube(levelG).materials : undefined;
      const levelBake = dressedBy !== undefined && dressedBy !== false ? levelClothBake(m.recipe.surfaces, Object.keys(m.hero ? m.recipe.palette || {} : recipeTones(m.recipe))) : null;
      // (the REALISTIC HERO, its head parts: its layers let down under one another and its eyes' globes cast no occlusion,
      // epidermis/dermal-hero.js heroHidden; its surface's normals the field's, so a seam between two parts of its skin
      // reads as none; its globes in the `eye` finish unless the bake names them)
      const realBake = m.bake && m.hero?.form === 'realistic' && m.recipe.headFit ? (m.bake === true ? {} : m.bake) : null;
      const bakeIn = realBake ? { ...realBake, finish: { ...Object.fromEntries(['Sclera', 'Iris', 'Pupil'].map((g) => [g, 'eye'])), ...(realBake.finish || {}) } } : m.bake;
      const bakeS = m.bake ? bakeSampler(mesh, bakeIn, { glows: m.recipe?.emissive, ...(realBake ? { hidden: heroHidden(mesh, m.recipe), normals: layeredShadingNormals(mesh, m.recipe, { crease, proxy: false }) } : {}) }) : levelBake ? bakeSampler(mesh, { finish: levelBake.finish }, { glows: m.recipe?.emissive, only: levelBake.only }) : null, baked = bakeS?.tint ?? null;
      const under = ellipsoid ? faceTint(mesh, TIERED_FACE_TINT[tieredPole(m.hero)]) : drawn ? drawnMarkings(m.plan, mesh, m.recipe?.palette) : null;
      const tint = stackTints(under, baked);
      // a field paint cell bakes under its OWN group's finish (a gold charge on a cloth tabard as gilt), over the same tint
      const cellTint = bakeS && fields ? (fi, grp) => stackFace(under?.[fi] ?? null, bakeS.groupTint(fi, grp)) : null;
      // UNDER THE CHARACTER LIGHT (the anime look's step) the bake stays off unless `bake.characterLight` asks for it: then
      // each piece keeps its tone and takes the bake per corner (bakePieces). Absent ⇒ the pieces as they were
      const litPieces = pieces && bakeS?.characterLight ? bakePieces(pieces, mesh, tint) : pieces;
      const smooth = !character && ((m.hero && (m.hero.head !== 'anime' || figLight !== light)) || m.smooth === true || drawn) && !light.flat ? layeredShadingNormals(shown, m.recipe, { crease, proxy: false, ellipsoid, rest: mesh, ...(stand ? { rigid: rigidParts(mesh, rig.skin, rig.R, 'head') } : {}) }) : null;
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
      // the PAINTED FACE (face-paint.js): the anime head's features as a texture on its face; absent ⇒ null, byte-identical
      // (under a level's cast light too: the studio-lit faces carry it the same way)
      const facePaint0 = character || m.hero?.painterly ? facePaintOf(mesh, m.recipe?.palette) : null;
      // a creature's SKIN TEXTURE (skin-paint.js, the plan's `skin`): its scales, plates and scutes painted as the face is,
      // under the character light. Absent ⇒ byte-identical
      const skinPaint = !facePaint0 && character && !m.hero && Array.isArray(m.plan?.skin) && m.plan.skin.length ? skinPaintOf(mesh, m.plan.skin, { ppm: skinPpm(m.plan) }) : null;
      // the REALISTIC HERO'S SKIN (epidermis/dermal-hero.js): its body's and its head's dermal maps on one atlas, on the
      // World page as in an export (the page's own sizes, PAGE_SKIN: the body's a size down, the head's where the face's
      // detail is; the payload a PNG), so the page shows the skin's tone, its grain, its lips, marks and fine lines, not one flat colour. Absent a
      // realistic hero with a head's fit, as before
      const heroSkin = !facePaint0 && !skinPaint && !character && m.hero?.form === 'realistic' && m.recipe?.headFit ? heroSkinPaint(mesh, m.recipe, { ...(m.recipe.dermis ? { dermis: m.recipe.dermis } : {}), ...(light.flat || ctx.face ? {} : PAGE_SKIN) }) : null;
      // THE COAT'S PATTERN (beast/coat-atlas.js): a beast-kin's markings solved in a biped's anatomy, painted in colour into
      // an atlas over its coat at texel density; carried as the realistic skin is. A beast with no pattern: none, as before
      const beastCoat = !facePaint0 && !skinPaint && !heroSkin && !character && m.hero?.beast?.pattern ? beastCoatPaint(mesh, m.recipe, m.hero) : null;
      const facePaint = facePaint0 ?? skinPaint ?? heroSkin ?? beastCoat;
      const faces = character
        ? characterLitFaces(shown, m.recipe, { pieces: litPieces, group: rigged || motioned ? 'body' : null, hairInk: !!ink, ...(facePaint ? { paint: facePaint } : {}) })
        : layeredFaces(shown, m.recipe, { light: figLight, seat, group: rigged || motioned ? 'body' : null, ...(stand ? { dz: restDz, rest: mesh } : {}), ...(smooth ? { normals: smooth } : {}), ...(tint ? { tint } : {}), ...(baked ? { cornerTint: true } : {}), ...(fields ? { fields } : {}), ...(cellTint ? { cellTint } : {}), ...(facePaint ? { paint: facePaint } : {}) });
      // HELD GEAR (hero-gear.js): a hero's `gear` is placed on its bones at rest and carried by the stand's frames, baked
      // by the studio light turned into each item's frame, in the body's group (a clip preview hides it with the body;
      // the pack carries it). Absent ⇒ nothing here, byte-identical.
      const gear = rig && m.hero?.gear ? gearMounts(m.hero, rig.R) : null;
      const gearShown = gear?.length ? gearFaces(gear, { frames: stand ? boneFrames(rig.R, rig.R.joints, rigNodesAt(rig.R, stand).nodes) : null, light: figLight, dz: restDz, group: 'body' }) : null;
      if (gearShown) faces.push(...gearShown);
      // A STATUE's BASE (statue/base.js): a hero carrying a statue build stands on its base, built under the posed
      // figure from the footprint it stands on (the feet, or a bust's cut) in the base's stone, the figure lifted onto
      // it (the clip preview's pack below by the same lift). Group 'base': a skinned export keeps it beside the figure.
      // No statue ⇒ nothing here, byte-identical.
      const statueBase = m.hero?.statue ? statueBaseOf(m.hero.statue) : null;
      // A MOUNTED statue (statue/creature.js mountedStatue, law 10): the creature designer's horse carved in the rider's
      // material, its saddle under the rider, the base under the horse; the rider lifted as on any base.
      const baseTag = statueBase ? (fs) => tagFacesWithMaterial(fs, resolveMaterial(statueBase.surface)) : null;
      const based = !statueBase ? null : statueBase.mounted && stand ? mountedStatue(faces, statueBase, { light, tag: baseTag, seat: riderSeat({ R: rig.R, pose: stand, mesh, recipe: m.recipe, dz: restDz }) }) : statueBaseFaces(faces, { kind: statueBase.kind, tone: statueBase.tone, light, seated: statueBase.seated, tag: baseTag });
      const lift = based?.lift ?? 0;
      if (lift) for (const f of faces) f.corners = f.corners.map((c) => [c[0], c[1], Math.round((c[2] + lift) * 1e9) / 1e9]);
      if (based?.faces.length) faces.push(...based.faces);
      // A CREATURE carved (statue/creature.js, opt-in `statue` on a plan that is not a hero: the creature designer's
      // sphinx, horse, dragon): one material over every face, an oblong base under it. Absent ⇒ byte-identical.
      if (creature) { const B = creatureBaseOf(creature), on = statueBaseFaces(faces, { kind: B.kind, tone: B.tone, light, oblong: true, tag: (fs) => tagFacesWithMaterial(fs, resolveMaterial(B.surface)) });
        if (on.lift) for (const f of faces) f.corners = f.corners.map((c) => [c[0], c[1], Math.round((c[2] + on.lift) * 1e9) / 1e9]);
        faces.push(...on.faces); }
      const scene = studioSceneFromFaces(faces, { units: m.units || 'm', facing: m.facing || '+y', ...(m.grid === false ? { grid: false } : {}), title: ctx.title, light });
      if (ink) { const { light: _light, ...dial } = toon || {}; scene.toon = { ...dial, ink }; }   // the light is baked in, never a page dial
      if (gearShown) { const textures = collectFaceTextures(gearShown, {}); if (Object.keys(textures).length) scene.textures = { ...(scene.textures || {}), ...textures }; }   // a barked staff's bark
      if (facePaint) scene.textures = { ...(scene.textures || {}), [facePaint.key]: facePaint.url };
      // A rigged recipe with clips also carries its packed rig figure (station-loft-rig.js): the skinned
      // glTF export (`export_model { clips, skinned }`) reads it, `embodies: 'body'` drops the static solid
      // from that export, and `preview` lets the World page play the clips over the hidden solid.
      if (rigged) {
        const { R, skin } = rig; const dz = restDz + lift;
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
        const rim = Array.isArray(m.rim) && m.rim.length === 5 && m.rim.every(Number.isFinite) ? m.rim : figLight !== light ? figLight.rim : null;
        // THE FACE (anime-face-rig.js), only when the export asks (ctx.face: the skinned GLB, the Godot pack's figure): the
        // anime hero's expression channels as morph targets — its rows ride the pack's parts (`morph`), the targets, the
        // authored weights and every word's weights ride the figure (`face`); a row the guards refuse says why
        // (`faceSkipped`) and exports without it. The World page never asks, so its payload is the one before the face.
        // (the PAINTED face, face-paint-rig.js: its drawings swapped on a texture atlas, the same targets' shape and tracks)
        // the face's blend shapes: the anime head's (drawn, or painted), the landmark head's (western-face-rig.js)
        // (the REALISTIC face plays on the page too, relational-face-rig.js: its morphs and tracks ride the page's pack, and
        // the rig preview drives them; the anime and the landmark faces ride an export alone, as before)
        const pageFace = !ctx.face && rigged && m.hero?.form === 'realistic' && m.hero.head === 'relational';
        const face = (ctx.face || pageFace) && rigged && m.hero ? (m.hero.head === 'anime' ? (m.hero.painterly && facePaint ? paintFaceRig(m, mesh, facePaint) : heroFaceRig(m, mesh)) : (m.hero.head ?? 'landmark') === 'landmark' ? westernFaceRig(m, mesh) : m.hero.head === 'relational' ? relationalFaceRig(m, mesh) : null) : null;
        // CLIP TIMING (hero-gesture.js heroClipSeconds): the anime hero's clips each carry a designed duration (`s` on the
        // packed clip), which the World page's clip preview, the GLB and the Godot pack all play; every other row's clips
        // carry none (three seconds on the page, one in an export, as before). With the face, each clip's facial track
        // and the ambient blink ride the face (anime-face-tracks.js), derived here and never stored.
        let seconds = m.hero?.head === 'anime' ? heroClipSeconds(m.hero, m.recipe.clips) : null;
        // LOCOMOTION (hero-motion.js, the door's `motion`): each gait compiled on this rig into a dense clip that replaces
        // the hero's own of that name, with its seconds and its ground speed (`v` on the packed clip). Absent ⇒ as before.
        let clipsIn = m.recipe.clips, speeds = null;
        if (m.recipe.locomotion) { const L = locomotionClips(m.recipe.locomotion, R); clipsIn = { ...m.recipe.clips, ...L.clips }; seconds = { ...(seconds || {}), ...L.seconds }; speeds = L.speeds; }
        // THE SWING (hero-swing.js): a hero's swing clip packs knowing its blow, `move` on the packed clip (the GLB's
        // `moj:move`): its word, hand and class, the impact's phase and the contact window (shares of the clip), and the blade's
        // TIP (the item's point at rest on the hand's bone, which carries it rigidly: a game's hit test and a trail ride it).
        // A world whose composed juice names a game type (ctx.swing, the world's fxStyle flavor) plays the swing at that
        // type's timing (swingTiming), its own keys re-timed in a dense clip the packer samples, as a gait's; realistic or
        // none plays the keys as they are (the same frames).
        const swingWord = isSwing(m.hero?.gesture) && Array.isArray(clipsIn[m.hero.gesture]) ? m.hero.gesture : null;
        if (swingWord) {
          const n = clipsIn[swingWord].length, cls = swingClassOfKeys(n), T = ctx.swing ? swingTiming(cls, ctx.swing) : null, P = T ?? swingPhases(n);
          const own = layeredClip(clipsIn[swingWord], R), fn = T ? (u) => own(T.warp(u)) : own; fn.keys = T ? 24 : 12;
          const g = gear?.find((x) => x.slot === SWING_HAND[swingWord]), q = g && (g.sockets.tip?.origin ?? g.sockets.focal?.origin);
          const tip = q ? gearRestPoint(g, q) : null;
          fn.move = { family: 'swing', word: swingWord, hand: SWING_HAND[swingWord] === 'left' ? 'L' : 'R', class: cls, strike: P.strike, window: P.window, ...(T ? { flavor: ctx.swing } : {}), ...(tip ? { tip: { bone: g.bone, at: [tip[0], tip[1], tip[2] + dz].map((v) => Math.round(v * 1e4) / 1e4) } } : {}) };
          clipsIn = { ...clipsIn, [swingWord]: fn };
        }
        // THE HELD STRIKE (ctx.swings: a world whose body playing this hero strikes in melee, its contact window): a hero
        // holding a blade or a haft in its right hand swings it as the runtime's swing directions (HELD_SWINGS), each its
        // own verb at the item's class, fitted to the window (fitSwing: the strike as the window opens), at the world's game
        // type when it names one; each knows its blow (`move`). The strike's numbers ride the body (`held`) for the world to
        // arm the rule with. None asked, or nothing held ⇒ as before.
        let held = null;
        const hg = ctx.swings && gear ? gear.find((x) => x.slot === 'right' && (x.hold === 'blade' || x.hold === 'haft')) : null;
        if (hg) {
          const cls = swingClass({ item: hg.item, mass: hg.trace.dials?.mass ?? 1, share: hg.trace.length / 167.4 }), from = ctx.swings.contact[0];
          const grip = R.hands ? ['right', 'left'].filter((s) => m.hero.gear?.[s]).map((s) => `fingers${s === 'right' ? 'R' : 'L'}`) : [];
          const base = (m.hero.core ?? 'structured') === 'structured' ? STRUCTURED_SWING_BASE : null;
          const q = hg.sockets.tip?.origin ?? hg.sockets.focal?.origin, tip = q ? gearRestPoint(hg, q) : null;
          const own = isSwing(m.hero.gesture) && SWING_HAND[m.hero.gesture] === 'right' ? m.hero.gesture : 'chop';
          const swings = {};
          for (const [dir, verb] of Object.entries(HELD_SWINGS)) {
            const word = verb ?? own, keys = swingClipKeys(word, cls, { base, grip }), T = ctx.swing ? swingTiming(cls, ctx.swing) : null;
            const play = layeredClip(keys, R), fit = fitSwing(T ? T.strike : swingPhases(keys.length).strike, from);
            const fn = T ? (u) => play(T.warp(fit(u))) : (u) => play(fit(u)); fn.keys = 24;
            fn.move = { family: 'swing', word, hand: 'R', class: cls, strike: from, window: [from, ctx.swings.contact[1]], ...(T ? { flavor: ctx.swing } : {}), ...(tip ? { tip: { bone: hg.bone, at: [tip[0], tip[1], tip[2] + dz].map((v) => Math.round(v * 1e4) / 1e4) } } : {}) };
            swings[`swing_${dir}`] = fn;
          }
          clipsIn = { ...clipsIn, ...swings };
          held = { item: hg.item, class: cls, reach: Math.round((hg.length + 0.65) * 100) / 100, seconds: HELD_STRIKE[cls].seconds, damage: HELD_STRIKE[cls].damage };
        }
        // (the painted face's texture rides the pack: with its drawings for an export, its authored face alone for the page)
        // (the REALISTIC HERO'S SKIN above: the GLB's base colour, under the lit export's plain corners or the unlit's baked
        // light, and the page's clips' the same atlas)
        const paintPack = face?.pack ?? (m.hero?.painterly && facePaint ? paintFaceBase(m, facePaint) : skinPaint ?? heroSkin ?? beastCoat ?? null);
        // (over every clip the pack plays: the door's motion compiles clips the recipe does not list, each holding the
        // authored face with its blinks)
        if (face?.meta) Object.assign(face.meta, face.K ? heroFaceTracks(m.hero, clipsIn, seconds, face.authored, face.K) : heroFaceTracks(m.hero, clipsIn, seconds, face.authored));
        // THE FACE'S PERFORMANCES (the door's `perform`, face-acting/perform.js): each take played by the realistic face's
        // targets as a LINEAR weights track, a face-only clip an engine layers over a body's (`face:<take>`), derived here
        // and never stored. Absent ⇒ as before.
        if (face?.meta && m.hero.head === 'relational' && m.hero.perform) face.meta.performances = Object.fromEntries(Object.entries(m.hero.perform).map(([k, P]) => [k, performanceTrack(perform(P))]));
        // (the ANIME face's: each take read as drawings, face-acting/anime-read.js, a STEP track on its targets: the 7G
        // drawings where its rig draws them, anime-face-rig.js sevenG, else lowered to its four channels, painted or drawn)
        else if (face?.meta && m.hero.head === 'anime' && m.hero.perform) face.meta.performances = Object.fromEntries(Object.entries(m.hero.perform).map(([k, P]) => [k, animePerformanceTrack(perform(P), face.K ?? faceKnots(face.authored), { sevenG: !!face.sevenG })]));
        // the recipe PALETTE colours the plain pack as it colours the static faces (group → palette, else tint), so a
        // palette-only group (the detailed head, horns, a pinned tile, an adornment) keeps its colour in a clip frame.
        const palette = m.recipe.palette && typeof m.recipe.palette === 'object' ? m.recipe.palette : null;
        // THE CORRECTIVES (a sliced recipe's, the realistic body's: body-relational-correctives.js), only when the export
        // asks for blend shapes (ctx.face, as the face): morph targets on the rest, their drivers, each clip key's weights.
        // The World page never asks, so its payload is the one before them. Absent ⇒ byte-identical.
        const correctives = ctx.face && Array.isArray(m.recipe.correctives) && m.recipe.correctives.length ? m.recipe.correctives : null;
        // THE REALISTIC BODY LIT BY AN ENGINE (the flat light: the lit export): its pack carries the studio weld's normals per
        // corner and no baked shade, so the engine's light shades one smooth skin, once. Any other figure as before.
        // (and a beast-kin on the tiered body, beast/tiered.js: its coat lit by the engine over its cover's maps, below)
        const engineLit = light.flat && (m.hero?.form === 'realistic' || m.hero?.beast) && !character ? layeredShadingNormals(mesh, m.recipe, { crease, proxy: false, ellipsoid }) : null;
        // THE RELIEF (epidermis/dermal-relief.js), on a realistic hero minted under realistic laws 5, lit by its engine and
        // exported skinned (ctx.face: the export that asks for the figure's blend shapes): the one skin's relief baked from
        // its own field into a normal map on the skin's atlas, each corner's tangent beside it (the GLB's normalTexture and
        // TANGENT). A hero minted before, an unlit or a rigid export and the page: none, byte-identical
        const relief = engineLit && ctx.face && heroSkin && paintPack === heroSkin && reliefOnRecord(m.hero) ? heroRelief(mesh, m.recipe, heroSkin, engineLit)
          // (a beast-kin's patterned coat: its cover's relief laid onto the same atlas, beast/coat-atlas.js coatRelief)
          : engineLit && ctx.face && beastCoat && paintPack === beastCoat ? coatRelief(mesh, beastCoat, beastCoverStyleOf(m.hero), engineLit) : null;
        // THE COVER (beast/cover.js): a beast-kin's fur, scales, chitin or feathers as a tiling material over its coat, on
        // the same lit, skinned export (its tile's UVs, each corner's tangent; the GLB's maps). Any other figure: none
        const coverKind = engineLit && ctx.face && !paintPack ? beastCoverStyleOf(m.hero) : null, cover = coverKind ? coverMap(mesh, m.recipe, engineLit, coverKind, beastCoatOf(m.hero)) : null;
        const pack = packLayeredRig(mesh, skin, R, { clips: clipsIn, ...(correctives ? { correctives } : {}), ...(engineLit ? { engineLit: true } : {}), ...(relief ? { relief } : {}), ...(cover ? { cover } : {}), keys: 12, dz, hullShade: m.hullShade || null, ...(smooth ? { normals: shown === mesh ? smooth : layeredShadingNormals(mesh, m.recipe, { crease, proxy: false, ellipsoid }) } : engineLit ? { normals: engineLit } : {}), ...(character ? { character: { pieces: stand ? piecesAt(litPieces, mesh, dz) : litPieces, hairInk: !!ink } } : {}), ...(face?.rows ? { face } : {}), ...(paintPack ? { paint: paintPack } : {}), ...(seconds ? { seconds } : {}), ...(speeds ? { speeds } : {}), ...(gear?.length ? { gear: gearPackParts(gear, { light: figLight, dz }) } : {}), ...(figLight !== light ? { cast: figLight } : {}), ...(!character && palette ? { palette } : {}), ...(tint ? { tint } : {}), ...(!character && fields ? { fields } : {}), ...(!character && cellTint ? { cellTint } : {}), ...(!character && Array.isArray(m.recipe.emissive) && m.recipe.emissive.length ? { emissive: m.recipe.emissive } : {}), ...(!character && m.recipe.surfaces ? { surfaces: m.recipe.surfaces } : {}) });
        // (the page's face rows as 16-bit steps of each part's own scale, about a micron: an export keeps its floats)
        if (pageFace && face?.rows) pack.parts = pack.parts.map((P) => (P?.morph ? { ...P, morph: quantMorph(P.morph) } : P));
        const clips = Object.keys(clipsIn).filter((c) => !(stand && c === GESTURE_CLIP));
        // (the realistic hero's pack written a corner a triangle: an export welds it, scene-gltf.js weldCorners)
        scene.figures = { body: { ...pack, ...(face?.meta ? { face: face.meta } : face?.skipped ? { faceSkipped: face.skipped } : {}), ...(rim ? { rim } : {}), ...(m.hero?.form === 'realistic' ? { weld: true } : {}), ...(held ? { held } : {}), embodies: 'body', preview: { clips, hide: 'body', period: 3, ...(ink ? { ink: true } : {}), ...(stand ? { solid: 'stand' } : {}) } } };
      } else if (motioned) {
        // the animal's gaits and behaviors: the mesh bound to the species' skeleton, each gait a clip from the gait solver
        // (in place, one stride, its own duration) and each behavior one loop from the behavior solver, packed like a
        // rigged recipe's so the preview, the GLB and Godot play it
        // (a bug's motion carries its bauplan: bugs/rig.js derives the skeleton and clips from it, packed the same way)
        // (an oozed animal's motion names its species and its ooze: the body it was made with, mutagen/rig.js)
        const bugMotion = !!m.recipe.motion.bug, motion = m.recipe.motion.ooze ? { ...m.recipe.motion, species: rigSpecies(m.recipe.motion) } : m.recipe.motion;
        const B = bugMotion ? bugBones(motion) : faunaBones(motion.species), skin = bindLayered(mesh, m.recipe, B);
        // UNDER THE CHARACTER LIGHT (a game's animal: its setting's `toon.light`) it packs as a hero does: the same lit
        // pieces (the step, the shades, the split) and the ink, so it moves in its game beside the hero in the hero's
        // light; packed plain it was the Lambert bake, faceted, with no smoothing (the character light turns that off)
        const pack = (bugMotion ? packBugRig : packFaunaRig)(mesh, skin, motion, { dz: restDz, hullShade: m.hullShade || null, ...(smooth ? { normals: smooth } : {}), ...(character ? { character: { pieces: litPieces, hairInk: !!ink } } : {}), ...(!character && m.recipe.palette && typeof m.recipe.palette === 'object' ? { palette: m.recipe.palette } : {}), ...(baked ? { tint } : {}), ...(!character && fields ? { fields } : {}), ...(!character && cellTint ? { cellTint } : {}) });
        scene.figures = { body: { ...pack, embodies: 'body', preview: { clips: Object.keys(pack.clips), hide: 'body', period: pack.clips[Object.keys(pack.clips)[0]]?.s || 1, ...(character && ink ? { ink: true } : {}) } } };
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
    resolve: (m, ctx) => assembleFigureScene(m, { title: ctx.title, ref: ctx.ref, ...(ctx.tpose ? { tpose: true } : {}) }),
  },
  // The animal study's World form (skin-over-mesh: figure-world
  // assembleAnimalScene) — orbit/export object study, same posture as figure.
  animal: {
    title: 'mojulo animal',
    // A STATUE (statue/creature.js, opt-in `statue`): the animal carved in one material on an oblong base; its fur splats
    // and skin textures dropped (stone has no coat). Absent ⇒ the animal as it was.
    resolve: (m, ctx) => {
      const scene = assembleAnimalScene(m, { title: ctx.title, ref: ctx.ref });
      if (!m.statue) return scene;
      const { splats: _s, textures: _t, ...rest } = scene;
      return { ...rest, faces: creatureStatue(scene.faces, m.statue, { light: withBands(ctx.light || WORKBENCH_LIGHT, resolveToon(ctx.toon)?.bands) }).faces };
    },
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
  // a road built for driving, authored in metres (roads/roadway.js): alignment + cross-section kernel, markings,
  // barriers; the payload carries the lane graph a driving game reads. `?view=` picks the opening shot: a preset
  // name, or `s<station>[-<lane id>]` (the map's deep link).
  roadway: { walk: true, title: 'mojulo roadway', resolve: (m, ctx) => assembleRoadwayScene(m, { title: ctx.title, view: ctx.view }) },
  // a painted scene made ground at real scale: the live page meshes it around the camera (the
  // terrain channel's LOD), everything else (exports, stills) gets the baked world. `from: { ref }` resolves to the
  // stored painted-landscape, so a promoted painting follows its source's edits.
  terrain: {
    walk: true, title: 'mojulo terrain world',
    resolve: async (m, ctx) => assembleTerrainWorld({ ...m, from: await resolveTerrainFrom(m), ...(m.cities ? { cities: await resolveTerrainCities(m.cities) } : {}) }, { title: ctx.title, live: !!ctx.live }),
  },
  // a flight game's level (skyscape/airspace.js): a map planned by the pilot's eye (field, reach, backdrop, a haze that
  // hides the edge) and scapeshift's ground laid on it, meshed round the camera by the terrain channel on the live page
  airspace: { walk: true, title: 'mojulo airspace', resolve: (m, ctx) => assembleAirspace(m, { title: ctx.title, live: !!ctx.live }) },
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
