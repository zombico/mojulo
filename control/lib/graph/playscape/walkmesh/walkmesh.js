/**
 * THE WALKMESH — a world scapeshift can't make: fixed-camera PLATES (the background, an image) over an invisible FLOOR
 * the figure walks, OCCLUDERS it walks behind, and EXITS that cut to another plate. Only the floor is geometrically
 * true, so the background is isolated: it can be a painting, a photo, impossible architecture, or a world frozen once.
 *
 *   { kind: 'walkmesh', title, start: '<plate>.<spawn>', plates: [{ id,
 *       painted: { image, size: [w, h] }  |  baked: { world: <manifest>, camera: { at, look, fov }, size? },
 *       ground: { horizon, height, fov },    painted: the camera fit (horizon px, eye height m, horizontal fov)
 *       floor: [poly | { id, poly }],        painted only: plate px (a bake derives its floor from the world)
 *       occluders: [{ id, poly, base? }],    painted only: a plate crop standing on the floor at its lowest y (or base)
 *       exits: [{ id, edge: [a, b], to }],   to: '<plate>.<exit>' | { map, door }
 *       spawns: [{ id, at, face? }],
 *       figure: 1.75 }],
 *     direction: { [item]: 'proposed' | 'approved' | 'auto' } }
 *
 * A plate's words are in its own space: px on paint, metres on a bake. Both read to one floor in metres (z-up) that
 * the 3D figure walks, and to plate px for the board.
 *
 *   WALK_ITEMS                       the direction items, approved one by one
 *   readWalkmesh(m, { bakes })       the normalized walkmesh; `bakes` maps a baked plate's id to its resolved World
 *                                    payload (resolveBakes). Shape errors throw; geometry is the laws' to judge.
 *   resolveBakes(m)                  { [plateId]: payload } for every baked plate (worlds/world-scene.js)
 *   cutsOf(wm)                       the cut graph: [{ from: 'plate.exit', to: 'plate.exit' | { map, door } }]
 */
import { paintedFraming, bakedFraming, plateBasis, project, lift, horizonOf, FOV_RANGE } from './camera.js';
import { bakeFloor } from './bake.js';
import { clipNear } from './geom.js';

export const WALK_ITEMS = Object.freeze(['plates', 'ground', 'floor', 'occluders', 'exits', 'cuts']);
export const WALK_STATUS = Object.freeze(['proposed', 'approved', 'auto']);
// derived on a bake: the camera is the world's, the floor and its occlusion are read off the geometry
export const BAKED_ITEMS = Object.freeze(['ground', 'floor', 'occluders']);
export const FIGURE = 1.75;
export const BAKE_SIZE = Object.freeze([1280, 720]);

const ID = /^[a-z][a-z0-9-]*$/;
const pt = (p, what) => {
  if (!Array.isArray(p) || p.length < 2 || !p.slice(0, 2).every(Number.isFinite)) throw new Error(`walkmesh: ${what} is not a point [x, y]`);
  return [p[0], p[1]];
};
const polyOf = (p, what) => {
  if (!Array.isArray(p) || p.length < 3) throw new Error(`walkmesh: ${what} is not a polygon (three points or more)`);
  return p.map((q, i) => pt(q, `${what} point ${i}`));
};
const idOf = (x, fallback, what) => {
  const id = x && x.id !== undefined ? x.id : fallback;
  if (typeof id !== 'string' || !ID.test(id)) throw new Error(`walkmesh: ${what} id '${id}' is not a lower-case word`);
  return id;
};

function readTo(to, where) {
  if (typeof to === 'string') {
    const [plate, exit, more] = to.split('.');
    if (!plate || !exit || more !== undefined) throw new Error(`walkmesh: ${where} goes to '${to}'; write '<plate>.<exit>'`);
    return { plate, exit };
  }
  if (to && typeof to === 'object' && typeof to.map === 'string') return { map: to.map, door: to.door ?? null };
  throw new Error(`walkmesh: ${where} goes nowhere; to is '<plate>.<exit>' or { map, door }`);
}

function readPlate(p, i, bakes) {
  if (!p || typeof p !== 'object') throw new Error(`walkmesh: plate ${i} is not an object`);
  const id = idOf(p, undefined, `plate ${i}`);
  const painted = p.painted && typeof p.painted === 'object', baked = p.baked && typeof p.baked === 'object';
  if (painted === baked) throw new Error(`walkmesh: plate '${id}' is painted or baked, one of them`);
  const figure = Number.isFinite(p.figure) && p.figure > 0 ? p.figure : FIGURE;
  let size, framing, bake = null, payload = null;
  if (painted) {
    size = p.painted.size;
    if (!Array.isArray(size) || size.length !== 2 || !size.every((n) => Number.isFinite(n) && n > 0)) throw new Error(`walkmesh: painted plate '${id}' needs size: [w, h] in px`);
    if (typeof p.painted.image !== 'string' || !p.painted.image.trim()) throw new Error(`walkmesh: painted plate '${id}' needs an image`);
    const g = p.ground || {};
    if (!Number.isFinite(g.horizon)) throw new Error(`walkmesh: painted plate '${id}' needs ground.horizon (the plate y where the level ground meets the sky)`);
    for (const k of ['height', 'fov']) if (g[k] !== undefined && !(Number.isFinite(g[k]) && g[k] > 0)) throw new Error(`walkmesh: plate '${id}' ground.${k} is a positive number`);
    if (g.fov !== undefined && (g.fov < FOV_RANGE[0] || g.fov > FOV_RANGE[1])) throw new Error(`walkmesh: plate '${id}' ground.fov is ${FOV_RANGE[0]}..${FOV_RANGE[1]} degrees`);
    framing = paintedFraming(size, g);
  } else {
    const c = p.baked.camera || {};
    if (!p.baked.world || typeof p.baked.world !== 'object') throw new Error(`walkmesh: baked plate '${id}' needs the world it freezes (baked.world, a manifest)`);
    pt(c.at || [], `plate '${id}' camera.at`); pt(c.look || [], `plate '${id}' camera.look`);
    for (const k of ['floor', 'occluders']) if (p[k] !== undefined) throw new Error(`walkmesh: baked plate '${id}' reads its ${k} off the world; drop ${k}`);
    size = Array.isArray(p.baked.size) ? p.baked.size : [...BAKE_SIZE];
    framing = bakedFraming({ at: [c.at[0], c.at[1], c.at[2] ?? 1.6], look: [c.look[0], c.look[1], c.look[2] ?? 1.6], fov: c.fov }, size);
    payload = bakes && bakes[id];
    if (!payload) throw new Error(`walkmesh: baked plate '${id}' has no resolved world (resolveBakes)`);
    bake = bakeFloor(payload);
  }
  const B = plateBasis(framing, size);
  const both = (q) => (painted ? { px: q, m: lift(B, q) } : { m: [q[0], q[1], 0], px: (project(B, [q[0], q[1], 0]) || {}).px || null });

  const floor = painted
    ? (p.floor || []).map((f, k) => { const poly = polyOf(Array.isArray(f) ? f : f.poly, `plate '${id}' floor ${k}`); return { id: Array.isArray(f) ? `floor-${k}` : idOf(f, `floor-${k}`, `plate '${id}' floor ${k}`), px: poly, m: poly.map((q) => lift(B, q)) }; })
    : bake.rects.map((r, k) => {
      const m = [[r.min[0], r.min[1], 0], [r.max[0], r.min[1], 0], [r.max[0], r.max[1], 0], [r.min[0], r.max[1], 0]];
      const seen = clipNear(B, m).map((P) => project(B, P)).filter(Boolean).map((x) => x.px);
      return { id: `cell-${k}`, m, px: seen.length >= 3 ? seen : null };
    });
  const occluders = (painted ? p.occluders || [] : []).map((o, k) => {
    const poly = polyOf(o.poly, `plate '${id}' occluder ${k}`), oid = idOf(o, `occluder-${k}`, `plate '${id}' occluder ${k}`);
    const ys = poly.map((q) => q[1]), base = Number.isFinite(o.base) ? o.base : Math.max(...ys);
    const xs = poly.filter((q) => Math.abs(q[1] - base) < 1e-6).map((q) => q[0]);
    const foot = [xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : poly.reduce((s, q) => s + q[0], 0) / poly.length, base];
    return { id: oid, px: poly, base, foot, m: lift(B, foot) };
  });
  const exits = (p.exits || []).map((e, k) => {
    const eid = idOf(e, undefined, `plate '${id}' exit ${k}`);
    if (!Array.isArray(e.edge) || e.edge.length !== 2) throw new Error(`walkmesh: plate '${id}' exit '${eid}' needs edge: [a, b]`);
    const ends = e.edge.map((q, n) => both(pt(q, `plate '${id}' exit '${eid}' end ${n}`)));
    return { id: eid, px: ends.map((x) => x.px), m: ends.map((x) => x.m), to: readTo(e.to, `plate '${id}' exit '${eid}'`) };
  });
  const spawns = (p.spawns || []).map((s, k) => {
    const sid = idOf(s, undefined, `plate '${id}' spawn ${k}`), at = both(pt(s.at, `plate '${id}' spawn '${sid}'`));
    return { id: sid, px: at.px, m: at.m, face: Number.isFinite(s.face) ? s.face : null };
  });
  for (const [what, list] of [['exit', exits], ['spawn', spawns], ['occluder', occluders], ['floor', floor]]) {
    const seen = new Set();
    for (const x of list) { if (seen.has(x.id)) throw new Error(`walkmesh: plate '${id}' has two ${what}s called '${x.id}'`); seen.add(x.id); }
  }
  return { id, source: painted ? 'painted' : 'baked', image: painted ? p.painted.image.trim() : null, world: baked ? p.baked.world : null, size: [...size], framing, basis: B, horizon: horizonOf(B), ground: painted ? { horizon: p.ground.horizon, height: framing.cameraPosition[2], fov: framing.horizontalFov } : null, figure, floor, occluders, exits, spawns, bake, payload };
}

export function readWalkmesh(manifest, { bakes = {} } = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('walkmesh: no manifest');
  const list = manifest.plates;
  if (!Array.isArray(list) || !list.length) throw new Error('walkmesh: plates is a list of one or more plates');
  const plates = list.map((p, i) => readPlate(p, i, bakes));
  const ids = new Set();
  for (const p of plates) { if (ids.has(p.id)) throw new Error(`walkmesh: two plates called '${p.id}'`); ids.add(p.id); }
  const d = manifest.direction || {};
  for (const [k, v] of Object.entries(d)) {
    if (!WALK_ITEMS.includes(k)) throw new Error(`walkmesh: direction item '${k}' is not one of ${WALK_ITEMS.join(', ')}`);
    if (!WALK_STATUS.includes(v)) throw new Error(`walkmesh: direction ${k} is '${v}'; it is ${WALK_STATUS.join(', ')}`);
  }
  const allBaked = plates.every((p) => p.source === 'baked');
  const status = Object.fromEntries(WALK_ITEMS.map((k) => [k, d[k] || (allBaked && BAKED_ITEMS.includes(k) ? 'auto' : 'proposed')]));
  const start = typeof manifest.start === 'string' ? manifest.start : `${plates[0].id}.${(plates[0].spawns[0] || {}).id || ''}`;
  return { title: manifest.title || 'walkmesh', start, plates, status };
}

export async function resolveBakes(manifest) {
  const { resolveWorldScene } = await import('../../worlds/world-scene.js');
  const out = {};
  for (const p of manifest.plates || []) {
    if (!p || !p.baked || !p.baked.world) continue;
    const { payload } = await resolveWorldScene({ ref: `walkmesh-${p.id}`, render_mode: 'world', manifest: p.baked.world });
    out[p.id] = payload;
  }
  return out;
}

export const cutsOf = (wm) => wm.plates.flatMap((p) => p.exits.map((e) => ({ from: `${p.id}.${e.id}`, to: e.to.plate ? `${e.to.plate}.${e.to.exit}` : e.to })));
