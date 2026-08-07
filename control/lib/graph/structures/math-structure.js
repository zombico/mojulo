/**
 * math-structure — the graph→geometry step for walkable math worlds (math-worlds.plan.md, Phase 1).
 *
 * Dispatches on `manifest.structure` and turns a laid-out Cayley graph (cayley-graph.js, itself pure
 * over group-presentation.js) into a scene payload by REUSING the city's low-level box/road/scene
 * primitives — `assembleBoxCityScene` + `roadRibbons` — NOT the procedural `planFractalCity`
 * generator. Plazas are tinted boxes at the graph's vertices; each generator is a visually distinct
 * street type between them. The result is one engine-agnostic face payload (same contract as every
 * other world kind), carrying a `mathPlan` sidecar so a walk that spells a relation can target the
 * exact plaza positions and a probe can assert it returned home.
 *
 * The structure→graph step is pure and unit-tested separately (group-presentation.test.js /
 * cayley-graph.test.js); this file only does graph→boxes+ribbons, then delegates to the shared
 * scene assembler. Same recipe → byte-identical world.
 */

import { assembleBoxCityScene } from '@/lib/graph/scene/scene-css3d';
import { roadRibbons, straightPath } from '@/lib/graph/city/roads';
import { buildGroup } from '@/lib/graph/structures/group-presentation';
import { planCayleyGraph, spellWalk } from '@/lib/graph/structures/cayley-graph';

const PLAZA = { w: 2.6, d: 2.6 };
const RING_TINTS = ['#8ea2b8', '#b98a6a', '#7f9b84', '#a98bb0'];   // ring 0,1,2,… plaza colour
const IDENTITY_TINT = '#c9b25c';                                    // the home plaza — gold, taller

/**
 * planMathStructure(manifest) → { kind, group, plan, boxes, grounds, ribbons, extent, walkStart }
 *
 * Pure. `plan` is the Cayley graph; boxes/grounds/ribbons are the world geometry (feedable straight
 * into assembleBoxCityScene). `walkStart` is a first-person spawn just outside the identity plaza.
 */
export function planMathStructure(manifest = {}) {
  const structure = manifest.structure || { kind: 'cayley', family: 'dihedral', n: 4 };
  const family = structure.family || 'dihedral';
  const n = structure.n ?? 4;

  const group = buildGroup({ family, n });
  const plan = planCayleyGraph(group, {
    innerRadius: structure.innerRadius ?? 7,
    ringGap: structure.ringGap ?? 6.5,
  });

  const boxes = [];
  const grounds = [];
  const posByElement = new Map();
  for (const v of plan.vertices) {
    posByElement.set(v.index, v.pos);
    const [x, y] = v.pos;
    const tint = v.identity ? IDENTITY_TINT : RING_TINTS[v.ring % RING_TINTS.length];
    const height = v.identity ? 4.2 : 2.2 + v.ring * 0.4;         // home plaza stands tallest
    boxes.push({ x: x - PLAZA.w / 2, y: y - PLAZA.d / 2, w: PLAZA.w, d: PLAZA.d, z0: 0, z1: height, tint, kind: 'plaza' });
    // a lighter pad under each plaza so it reads as a place, not a floating block
    grounds.push({ x: x - PLAZA.w / 2 - 0.8, y: y - PLAZA.d / 2 - 0.8, w: PLAZA.w + 1.6, d: PLAZA.d + 1.6, z: 0.03, fill: v.identity ? '#e6d9a8' : '#bdc0b4' });
  }

  // streets: one ribbon per graph edge, typed by its generator. The path stops short of each plaza
  // box so the road meets a frontage, not the building centre.
  const ribbons = [];
  for (const e of plan.edges) {
    const a = posByElement.get(e.from);
    const b = posByElement.get(e.to);
    const [ax, ay, bx, by] = trimSegment(a, b, PLAZA.w / 2 + 0.3);
    const st = e.style;
    const road = roadRibbons({
      path: straightPath([ax, ay], [bx, by], 4),
      width: st.width,
      asphalt: st.tint,
      lanes: st.twoLane ? 2 : 1,
      laneLine: st.twoLane,
      pillars: false,
    });
    ribbons.push(...road.ribbons);
    for (const bx2 of road.boxes) boxes.push(bx2);
  }

  // base ground: a plane covering the whole town with a margin
  const R = plan.radius + 4;
  grounds.unshift({ x: -R, y: -R, w: 2 * R, d: 2 * R, z: 0, fill: '#4b4f49' });

  const home = posByElement.get(group.identity);
  const walkStart = [home[0], home[1] - (PLAZA.d / 2 + 2.5), 1.4];

  return {
    kind: 'math-structure',
    group: plan.group,
    plan,
    boxes, grounds, ribbons,
    extent: R,
    walkStart,
  };
}

// pull a segment's endpoints inward by `inset` at each end (so a street runs plaza-frontage to
// plaza-frontage, not centre to centre). Degenerate short segments collapse to their midpoint.
function trimSegment([ax, ay], [bx, by], inset) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(0.45, inset / len);
  return [ax + dx * t, ay + dy * t, bx - dx * t, by - dy * t];
}

// camera set: a high 3/4 hero that frames the whole structure, plus a lower oblique.
function mathCameras(extent) {
  const d = extent * 1.7;
  return [
    { name: 'structure hero', worldFraming: { cameraPosition: [-d * 0.5, d, d * 0.75], lookAt: [0, 0, 1.5], horizontalFov: 52, pictureCenter: [560, 400] } },
    { name: 'oblique', worldFraming: { cameraPosition: [d * 0.7, d * 0.55, d * 0.4], lookAt: [0, 0, 1.2], horizontalFov: 50, pictureCenter: [560, 420] } },
  ];
}

/**
 * assembleMathStructureScene(manifest, { title }) → scene payload.
 *
 * The world-kind resolver's calling convention. Returns exactly what assembleBoxCityScene returns,
 * plus a `mathPlan` sidecar (group meta + plaza world-positions keyed by element/label/word) and a
 * default `walk` spawn at the identity plaza.
 */
export function assembleMathStructureScene(manifest = {}, { title } = {}) {
  const built = planMathStructure(manifest);
  const scene = assembleBoxCityScene({
    boxes: built.boxes,
    grounds: built.grounds,
    ribbons: built.ribbons,
    cameras: mathCameras(built.extent),
    sky: { preset: 'day' },
    viewBox: { width: 1120, height: 780 },
    unitScale: manifest.unitScale || 20,
    title: title || `mojulo ${built.group.title} — Cayley city`,
    groundShadows: manifest.groundShadows ?? false,
  });

  // first-person WASD walk for browsing the town — but only when nothing else drives movement. A
  // manifest that overlays a walker ENTITY + follow camera (e.g. the compile-a-relation spike) owns
  // navigation itself, so we don't also spawn the FP controller.
  if (!Array.isArray(manifest.entities) || !manifest.entities.length) {
    scene.walk = { enabled: true, speed: 3.6, eyeHeight: 1.4, start: built.walkStart, yaw: Math.PI / 2 };
  }
  scene.mathPlan = {
    kind: built.kind,
    group: built.group,
    plazas: built.plan.vertices.map((v) => ({ index: v.index, label: v.label, ring: v.ring, pos: v.pos, identity: v.identity })),
    generators: built.plan.generators.map((g) => ({ name: g.name, symbol: g.symbol, involution: g.involution })),
  };
  return scene;
}

// Re-export the walk speller so callers (compile-a-relation, spike tests) reach it through the
// assembler module without importing the pure graph layer directly.
export { spellWalk, buildGroup, planCayleyGraph };
