/**
 * LIFE IN THE FRAME — what a set's own world moves, read for a film. A metro's traffic (geocity/flow.js) is a plan the
 * World page drives: each lane a signalised model (scene/channels/traffic-model.js) stepped on the world's clock, its
 * vehicles drawn near the camera. A film reads the same plan with the same model: the vehicles that come within reach of
 * where the scene is played, each keyed along its lane over the scene's seconds, on the road's own height, facing as it
 * drives. Nothing is invented: a set with no traffic of its own has no life to read.
 *
 *   LIFE                       the numbers: how far about the cast, how many at most, how often a key
 *   lifeErrors(v)              → [message]: `life` is true, or { clock?, reach?, most? }
 *   flowLife(flow, { about, seconds, clock?, reach?, most? })
 *                              → [{ id, model, extra?, tint: [r, g, b] linear, len, wid, near, keys: [{ t, x, y, z, turn }] }]
 *                                (metres, the world's frame; `turn` degrees clockwise from +y, as a prop's)
 *   walkLife(payload, { about, seconds, clock?, reach?, most? })
 *                              → [{ id, figure, hgt, near, keys: [{ t, x, y, z, turn, p }] }]: a city's people (its `walkers`,
 *                                read as a camera follows them, shoot/subjects.js), `p` the gait's cycles walked so far
 *   carLife(payload, ask)      → [{ id, car, dims, wid, near, keys }]: a planned city's cars (its baked `carMeshes`), the same way
 *   carFaces(mesh)             → a baked car's faces, facing +y
 *   lifeOf(payload, ask)       → [{ id, kind: 'vehicle' | 'car' | 'walker', dims: [wid, len, hgt], keys }]: all of it, as a
 *                                storyboard draws it (plain forms where each is at a panel's moment)
 *   lifeFaces({ model, extra?, tint })  → the vehicle's faces, its paint the tint's (the page's own model and paint rule)
 *   lifeDims(model)            → [wid, len, hgt] metres
 *
 * A planned city's people (its `walkers`: loops round their blocks, waiting at the crossings' signals) are read the same
 * way: each on the world's clock, in metres, its gait's phase from the ground it has covered, as the page plays it, so a
 * walker held at a kerb stands. The walker a view follows (a geocube's stand-in) is the viewer's, never the set's.
 *
 * Pure; the model's own seeded plan, no dice here.
 */
import { createTrafficModel, stepTraffic } from '../scene/channels/traffic-model.js';
import { readFlow } from '../scene/channels/flow.js';
import { carModel, ROOF_EXTRAS } from '../geotown/cars.js';
import { shootSubjects } from '../shoot/subjects.js';

export const LIFE = Object.freeze({ reach: 90, most: 16, key: 0.25, mostAsked: 60, reachAsked: 320 });
const LIFE_KEYS = ['clock', 'reach', 'most'];
const WRAP = 100, WALK_WRAP = 6, CAR_WRAP = 14, STRIDE = 0.72;
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;

export function lifeErrors(v) {
  if (v === true || v === false) return [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['life: true (the set\'s own traffic drives through the scene), or { clock?, reach?, most? }'];
  const errs = [], bad = Object.keys(v).filter((k) => !LIFE_KEYS.includes(k));
  if (bad.length) errs.push(`life takes ${LIFE_KEYS.join(', ')} (not ${bad.join(', ')})`);
  if (v.clock !== undefined && !(Number.isFinite(v.clock) && v.clock >= 0)) errs.push('life.clock: the second of the world\'s own clock the scene starts at, 0 or more');
  if (v.reach !== undefined && !(Number.isFinite(v.reach) && v.reach > 0 && v.reach <= LIFE.reachAsked)) errs.push(`life.reach: how far about the cast the traffic is read, metres, up to ${LIFE.reachAsked}`);
  if (v.most !== undefined && !(Number.isInteger(v.most) && v.most > 0 && v.most <= LIFE.mostAsked)) errs.push(`life.most: how many vehicles at most, 1 to ${LIFE.mostAsked}`);
  return errs;
}

/** Whether a world's payload moves anything a film can read. */
export const hasLife = (payload) => !!readFlow(payload?.flow) || walkersOf(payload).length > 0 || carsOf(payload).length > 0;

// a world's ambient walkers as the page lists them (scene-three's filter, the subjects' own), the followed one left out
function walkersOf(payload) {
  const figs = payload?.figures || {};
  return (Array.isArray(payload?.walkers) ? payload.walkers : []).filter((w) => w && typeof w.figure === 'string' && figs[w.figure] && Array.isArray(w.path) && w.path.length > 2)
    .map((w, i) => ({ w, i })).filter(({ w }) => !w.follow);
}

// the road's height at u along a lane (its samples ascending: the page's own rule, channels/flow.js)
function groundAt(g, u) {
  const n = g.length / 2;
  if (u <= g[0]) return g[1];
  if (u >= g[2 * n - 2]) return g[2 * n - 1];
  let a = 0, b = n - 1;
  while (b - a > 1) { const k = (a + b) >> 1; if (g[2 * k] <= u) a = k; else b = k; }
  const t = (u - g[2 * a]) / (g[2 * b] - g[2 * a] || 1e-6);
  return g[2 * a + 1] + (g[2 * b + 1] - g[2 * a + 1]) * t;
}

/** The traffic that comes within `reach` of `about` during the scene, nearest first, each keyed along its lane. */
export function flowLife(flow, { about, seconds, clock = 0, reach = LIFE.reach, most = LIFE.most } = {}) {
  const F = readFlow(flow);
  if (!F || !Array.isArray(about) || !(seconds > 0)) return [];
  const [ax, ay] = about, n = Math.max(1, Math.ceil(seconds / LIFE.key)), times = Array.from({ length: n + 1 }, (_, i) => Math.min(seconds, i * LIFE.key));
  const found = [];
  F.lanes.forEach((L, li) => {
    // (a lane within reach across it, or none of it is stepped: the page's own test)
    if (Math.abs((L.axis === 'y' ? ax : ay) - L.cross) > reach) return;
    const cars = F.cars.filter((c) => c[0] === li);
    if (!cars.length) return;
    const m = createTrafficModel([L], cars.map((c) => ({ lane: 0, startFrac: c[3], len: F.kinds[c[1]].len })), F.signals, F.T);
    const sg = L.dir >= 0 ? 1 : -1, turn = L.axis === 'y' ? (sg > 0 ? 0 : 180) : (sg > 0 ? 90 : -90);
    const keys = cars.map(() => []), near = cars.map(() => Infinity);
    // (the world's clock up to the scene's first second, a minute a step: the model takes so many ticks a call)
    for (let c = 60; c < clock; c += 60) stepTraffic(m, c);
    for (const t of times) {
      stepTraffic(m, clock + t);
      for (let k = 0; k < cars.length; k++) {
        const kind = F.kinds[cars[k][1]], s = m.cars[k].s, u = sg > 0 ? L.lo + s : L.hi - s, h = kind.len * 0.35;
        const x = L.axis === 'y' ? L.cross : u, y = L.axis === 'y' ? u : L.cross, z = (groundAt(L.ground, u + sg * h) + groundAt(L.ground, u - sg * h)) / 2;
        near[k] = Math.min(near[k], Math.hypot(x - ax, y - ay));
        keys[k].push({ t: r3(t), x: r3(x), y: r3(y), z: r3(z), turn });
      }
    }
    cars.forEach((c, k) => {
      if (near[k] > reach) return;
      // (a lane is a ring: a vehicle that goes out at the land's edge and comes back in at the other during the scene
      //  would be keyed across the whole metro in one step, so it is left out)
      if (keys[k].some((q, i) => i && Math.hypot(q.x - keys[k][i - 1].x, q.y - keys[k][i - 1].y) > WRAP)) return;
      const kind = F.kinds[c[1]];
      found.push({ id: `flow:${li}:${k}`, model: kind.model, ...(kind.extra ? { extra: kind.extra } : {}), tint: F.tints[c[2]], len: kind.len, wid: kind.wid, near: r3(near[k]), keys: keys[k] });
    });
  });
  return found.sort((a, b) => a.near - b.near || (a.id < b.id ? -1 : 1)).slice(0, most);
}

// what a world moves on a schedule, as a camera follows it (shoot/subjects.js), read about the cast: each subject's keys
// in metres, facing the way it goes, turned the short way round; `each(i, key, moved)` adds what its kind keys beside
function followed(payload, ids, { about, seconds, clock = 0, reach = LIFE.reach, most = LIFE.most } = {}, wrap, each = null) {
  if (!ids.length || !Array.isArray(about) || !(seconds > 0)) return [];
  const k = Number.isFinite(payload.metersPerUnit) && payload.metersPerUnit > 0 ? payload.metersPerUnit : 1, subjects = shootSubjects(payload);
  const [ax, ay] = about, n = Math.max(1, Math.ceil(seconds / LIFE.key)), times = Array.from({ length: n + 1 }, (_, i) => Math.min(seconds, i * LIFE.key));
  // (the subjects of one model share its clock: every one is asked at each second in turn, never one through and back)
  const S = ids.map((id) => subjects.get(id)), keys = ids.map(() => []), near = ids.map(() => Infinity), last = ids.map(() => null), turn = ids.map(() => 0), wraps = ids.map(() => false);
  for (const t of times) {
    S.forEach((sub, i) => {
      if (!sub) return;
      const { pos, heading } = sub.at(clock + t), x = pos[0] * k, y = pos[1] * k, d = last[i] ? Math.hypot(x - last[i][0], y - last[i][1]) : 0;
      if (d > wrap) wraps[i] = true;
      // (it faces the way it goes, turned the short way round from where it faced; where it stands, the way it last went)
      if (!last[i] || d > 1e-6) {
        const a = 90 - heading * 180 / Math.PI;
        turn[i] = r3(last[i] ? turn[i] + ((((a - turn[i]) % 360) + 540) % 360 - 180) : a);
      }
      last[i] = [x, y];
      near[i] = Math.min(near[i], Math.hypot(x - ax, y - ay));
      keys[i].push({ t: r3(t), x: r3(x), y: r3(y), z: r3((pos[2] || 0) * k), turn: turn[i], ...(each ? each(i, d) : {}) });
    });
  }
  // (a thing that relands at its way's far end during the scene is left out, as a vehicle that rounds its lane's ring is)
  return ids.map((id, i) => ({ id, i, k, box: S[i]?.box ?? null, near: r3(near[i]), keys: keys[i] })).filter((F, i) => S[i] && near[i] <= reach && !wraps[i])
    .sort((a, b) => a.near - b.near || (a.id < b.id ? -1 : 1)).slice(0, most);
}

/** The people who come within `reach` of `about` during the scene, nearest first, each keyed along its way. */
export function walkLife(payload, ask = {}) {
  const list = walkersOf(payload), walked = list.map(() => 0);
  // (one gait cycle a stride of ground: the page's own rule, channels/walkers.js)
  const k = Number.isFinite(payload?.metersPerUnit) && payload.metersPerUnit > 0 ? payload.metersPerUnit : 1;
  const stride = list.map(({ w }) => (w.stride > 0 ? w.stride : Math.max(0.05, (payload.figures[w.figure].figH || 1.8) * STRIDE * (w.scale > 0 ? w.scale : 1))) * k);
  return followed(payload, list.map(({ i }) => `walker:${i}`), ask, WALK_WRAP, (i, d) => ({ p: r3((walked[i] += d) / stride[i]) }))
    .map((F) => { const { w } = list[F.i]; return { id: F.id, figure: w.figure, hgt: r3((payload.figures[w.figure].figH || 1.8) * (w.scale > 0 ? w.scale : 1) * F.k), near: F.near, keys: F.keys }; });
}

// a world's driven cars as the page lists them (the subjects' own filter)
const carsOf = (payload) => (Array.isArray(payload?.cars) ? payload.cars : []).filter((c) => c && typeof c.car === 'string' && payload.carMeshes?.[c.car] && Array.isArray(c.path) && c.path.length > 1);

/** A planned city's cars that come within `reach` of `about` during the scene, nearest first: its baked meshes on its
 *  lanes, the signalised model the page steps (its turns at the junctions too). */
export function carLife(payload, ask = {}) {
  const list = carsOf(payload);
  return followed(payload, list.map((_, i) => `car:${i}`), ask, CAR_WRAP)
    .map((F) => ({ id: F.id, car: list[F.i].car, dims: [r3(F.box.wid * F.k), r3(F.box.len * F.k), r3(F.box.hgt * F.k)], wid: r3(F.box.wid * F.k), near: F.near, keys: F.keys }));
}

/** A baked car's faces (its mesh's triangles, each corner its own colour), turned to face +y as a prop is read. */
export function carFaces(mesh) {
  const b = Buffer.from(mesh.pos, 'base64'), P = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), C = Buffer.from(mesh.col, 'base64');
  // (the bake's colours are in linear light, as the page's material reads them: a face's fill is sRGB)
  const hex = (i) => `#${[0, 1, 2].map((j) => Math.round(toS(C[3 * i + j] / 255) * 255).toString(16).padStart(2, '0')).join('')}`, faces = [];
  for (let v = 0; v + 2 < P.length / 3; v += 3) {
    const fills = [hex(v), hex(v + 1), hex(v + 2)];
    faces.push({ corners: [v, v + 1, v + 2].map((q) => [r3(-P[3 * q + 1]), r3(P[3 * q]), r3(P[3 * q + 2])]), fill: fills[0], cornerFills: fills });
  }
  return faces;
}

/** All a set moves about the cast, each as its size and its keys: what a storyboard stands in its panels. */
export function lifeOf(payload, ask = {}) {
  return [
    ...flowLife(payload?.flow, ask).map((V) => ({ id: V.id, kind: 'vehicle', dims: lifeDims(V.model), keys: V.keys })),
    ...carLife(payload, ask).map((V) => ({ id: V.id, kind: 'car', dims: V.dims, keys: V.keys })),
    ...walkLife(payload, ask).map((W) => ({ id: W.id, kind: 'walker', dims: [r3(W.hgt * 0.36), r3(W.hgt * 0.36), W.hgt], keys: W.keys })),
  ];
}

// a fill under a tint: the page multiplies the pale body's colour by the paint in linear light
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), toS = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const tinted = (hex, tint) => (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)
  ? `#${[1, 3, 5].map((i, k) => Math.round(Math.max(0, Math.min(1, toS(toLin(parseInt(hex.slice(i, i + 2), 16) / 255) * tint[k]))) * 255).toString(16).padStart(2, '0')).join('')}` : hex);

/** A driven vehicle's faces: the parked vehicles' own model (geotown/cars.js), its paint the tint's, its roof's extra. */
export function lifeFaces({ model, extra = null, tint = [1, 1, 1] }) {
  const M = carModel(model);
  const paint = M.paint.map((f) => ({ ...f, fill: tinted(f.fill, tint), ...(Array.isArray(f.cornerFills) ? { cornerFills: f.cornerFills.map((c) => tinted(c, tint)) } : {}) }));
  const top = extra && ROOF_EXTRAS[extra] ? ROOF_EXTRAS[extra](Math.round((M.roof.y - 0.3) * 1e4) / 1e4, M.roof.z) : [];
  return [...paint, ...M.trim, ...top];
}

export function lifeDims(model) { const M = carModel(model); return [M.W, M.L, M.H]; }
