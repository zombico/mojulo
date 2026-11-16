/**
 * AN INDUSTRIAL FACILITY AS A FIGHTING MAP — a yard of a geocity's industry (its tank farm, its container storage, its
 * works: geocity/industry.js) designed under the arena's laws and drawn as itself. Two halves:
 *
 *   DESIGNED   designFacility: windows over an industrial block are each read onto the grid (read-town.js) and grown
 *              under the laws with what the place is made of kept (generate.js); the one that holds the most laws, and
 *              among those the most kinds of thing, is the facility. The laws are the only judge; the search is how a
 *              place that can hold them is found, where a single picked window may not.
 *   DRAWN      facilityGround: the map's ground in the seventh generation, the place's own things standing where the
 *              design put them (the block's plan, kept by the reader in `read.things`): tanks, spheres, a gasholder,
 *              silos, a stack, containers, transformers, gantries, pipe racks, pylons and halls, each the geocity's own
 *              piece at its size; what the generator grew on the open ground as a yard's own cover (a wall panel a
 *              concrete panel, a low wall a barrier, a pillar a short container); a perimeter wall; and the things of
 *              the block beyond the wall as its skyline. Lit by the cube at its hour and by FLOODLIGHTS on masts over
 *              the places the map's own measures name (its prizes: the most seen places are the lit ones), baked as a
 *              town's buildings are with each flood's light added by its distance, and handed to the form render with
 *              its floods, its surfaces' roughness and, where it rains, its wet.
 *
 *   FACILITY                   its numbers: the window, the search's stride and passes, a flood's mast, light and reach
 *   designFacility(spec?, { seed?, on?, size?, kit?, design?, most? }) → { on, at, size, map, laws, held, of, kinds, tried }
 *   facilityGround(M, { cube?, hour?, weather?, floods? }) → { faces, colliders, entities, form: { room }, sky, air, bg,
 *                              floods: [{ at, key, radius }], wet, dress: 'facility' }
 *   isFacility(M)              a map whose reader kept an industrial block's things
 *
 * What is approximated, said: a flood's light is not shaded by what stands between it and a face in the bake (the page
 * draws the nearest floods' shadows live); a hall is its box and its gable in its paint, its doors and windows not
 * drawn; the colliders are the grid's cells, as the laws measured them, so a round tank is walked round as its cells.
 * Pure: a function of the design, the seed and the cube.
 */
import { CELL, RISE, LOW } from './blocks.js';
import { mapGround } from './ground.js';
import { cityGround, readGroundMap } from './read-town.js';
import { growArenaMap } from './generate.js';
import { mapLaws, kitOf } from './laws.js';
import { designGeocity } from '../geocity/design.js';
import { industryRaw, CONTAINER_PAINT } from '../geocity/industry.js';
import { INDUSTRY_SEGMENTS } from '../geocity/segments.js';
import { readGeocube } from '../era/geocube.js';
import { cubeLight } from '../era/cube-light.js';
import { readHour } from '../era/geocube-hours.js';
import { readWetness, wetOfWeather } from '../era/wetness.js';
import { makeSunShadow } from '../era/sun.js';
import { sunLitFaces, skyAt } from '../form/sun-light.js';
import { paintMean, linHex } from '../form/room-light.js';

export const FACILITY = Object.freeze({
  size: 42, stride: 12, passes: 500, most: 2, tries: 8,
  // (a yard's floodlight, as era/stage-buildings.js FLOOD is: a sodium lamp on a mast)
  // (its key in the day's units, where a noon sun is a little over a half: a pool of amber a third of the day's light at
  // its foot, gone by its reach; `fall` the falloff's power, 1 a lamp's long soft edge)
  flood: Object.freeze({ h: 11, key: Object.freeze([1.3, 1.1, 0.68]), radius: 34, fall: 1, most: 4, apart: 15 }),
  skyline: 90,
  tiles: Object.freeze({ apron: 'asphalt-aged', wall: 'concrete-board', barrier: 'concrete-board' }),
  // what each part gives back (the form render's `reflect.surfaces`): painted steel sheens, concrete barely
  surfaces: Object.freeze({ 'facility:apron': { rough: 0.86 }, 'facility:wall': { rough: 0.8 }, 'facility:barrier': { rough: 0.8 }, 'facility:hall': { rough: 0.5 }, 'facility:roof': { rough: 0.42 },
    'facility:container': { rough: 0.36 }, 'facility:tank': { rough: 0.4 }, 'facility:sphere': { rough: 0.35 }, 'facility:holder': { rough: 0.5 }, 'facility:silos': { rough: 0.8 }, 'facility:stack': { rough: 0.85 },
    'facility:transformer': { rough: 0.45, metal: 1 }, 'facility:gantry': { rough: 0.45, metal: 1 }, 'facility:breaker': { rough: 0.45, metal: 1 }, 'facility:piperack': { rough: 0.45, metal: 1 },
    'facility:pylon': { rough: 0.45, metal: 1 }, 'facility:chainlink': { rough: 0.5, metal: 1 }, 'facility:mast': { rough: 0.45, metal: 1 } }),
});
const KEEP = Object.freeze(['facility:flood', 'map:water', 'map:ladder']);
const r3 = (v) => Math.round(v * 1000) / 1000, r5 = (v) => Math.round(v * 1e5) / 1e5;
const P = (p) => p.map(r3);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// a thing of the place stands in the map's own ground: a cell under its footprint is a mass of the map (a thing on the
// far side of a fence, in ground the reader closed, is not the yard's)
function solidUnder(M, t) {
  const q = t.q ?? t.foot; if (!q) return false;
  const c = M.read.cell ?? CELL, i = Math.floor((q[0] + q[2]) / 2 / c), j = Math.floor((q[1] + q[3]) / 2 / c);
  return i >= 0 && j >= 0 && i < M.nx && j < M.ny;
}

export const isFacility = (M) => Array.isArray(M?.read?.things) && M.read.things.length > 0;

/** The facility designed (see the header): the window of an industrial block that, grown, holds the most laws. */
export function designFacility(spec = {}, { seed = 1, on = INDUSTRY_SEGMENTS[0], size = FACILITY.size, kit = kitOf(), design = null, most = FACILITY.most, passes = FACILITY.passes } = {}) {
  const d = design ?? designGeocity(spec, { seed }), G = cityGround(d, { on }), [x0, y0, x1, y1] = G.bounds, found = [];
  // every window on the stride that is a yard: ground to fight on, things of the place standing in it (a window all
  // slab, all hall, or the street outside the fence is none); the ones with the most kinds of thing grown first
  const cands = [];
  for (let y = y0 + size / 2; y <= y1 - size / 2; y += FACILITY.stride) for (let x = x0 + size / 2; x <= x1 - size / 2; x += FACILITY.stride) {
    const M = readGroundMap(G, { at: [x, y], size }), sh = M.read.share, inside = (M.read.things ?? []).filter((t) => !t.beyond && solidUnder(M, t));
    if (sh.mass < 0.12 || sh.mass > 0.5 || sh.floor < 0.45 || !inside.length) continue;
    cands.push({ at: [Math.round(x), Math.round(y)], M, kinds: [...new Set(inside.map((t) => t.key ?? t.kind))], n: inside.length });
  }
  cands.sort((a, b) => b.kinds.length - a.kinds.length || b.n - a.n || a.at[1] - b.at[1] || a.at[0] - b.at[0]);
  let tried = 0;
  for (const c of cands) {
    tried++;
    const g = growArenaMap({ map: c.M, seed, passes, kit });
    found.push({ at: c.at, map: g.map, laws: g.laws, held: g.held, of: g.of, kinds: c.kinds });
    if (found.filter((f) => f.held === f.of).length >= most || tried >= FACILITY.tries) break;
  }
  if (!found.length) throw new Error(`arena-map: no yard of this city's ${on} is ground to fight on at ${size} m (a window all slab or all hall): try another segment or size`);
  const best = found.sort((a, b) => b.held - a.held || b.kinds.length - a.kinds.length || a.at[1] - b.at[1] || a.at[0] - b.at[0])[0];
  return { on, size, tried, ...best };
}

// a quad as a face: its normal from its corners (counter-clockwise seen from where it faces)
const face = (corners, fill, group, more = {}) => {
  const c = corners, a = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], b = [c[2][0] - c[0][0], c[2][1] - c[0][1], c[2][2] - c[0][2]];
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(...n) || 1;
  return { corners: c.map(P), normal: n.map((v) => r5(v / l)), fill, group, ...more };
};
// a box's four walls seen from outside, and its five faces (no bottom): walls one fill, its top another
function wallFaces(out, x0, y0, x1, y1, z0, z1, wall, group) {
  out.push(face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], wall, group), face([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], wall, group),
    face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], wall, group), face([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], wall, group));
}
function boxFaces(out, x0, y0, x1, y1, z0, z1, wall, top, group, topGroup = group) {
  out.push(face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top, topGroup));
  wallFaces(out, x0, y0, x1, y1, z0, z1, wall, group);
}

/** The facility's ground as material under its hour, its floods and its weather (see the header). */
export function facilityGround(M, { cube = 'valley-morning', hour = 'night', weather = null, floods = true } = {}) {
  const G = mapGround(M), T = FACILITY.tiles, RAW = industryRaw(), things = M.read.things, out = [], cell = M.read.cell ?? CELL;
  const tileFill = {}, fillOf = (key) => (tileFill[key] ??= linHex(paintMean(key)));
  const uvFlat = (c) => c.map((p) => [r5(p[0] / CELL), r5(p[1] / CELL)]);
  // THE SLAB: every cell of ground and under every mass, in quarters so a flood's pool reads across it
  for (const [i, j, k] of M.floors) {
    if (k !== 0) continue;
    for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
      const x0 = (i + a / 2) * cell, y0 = (j + b / 2) * cell, c = [[x0, y0, 0], [x0 + cell / 2, y0, 0], [x0 + cell / 2, y0 + cell / 2, 0], [x0, y0 + cell / 2, 0]];
      out.push({ ...face(c, fillOf(T.apron), 'facility:apron', { doubleSided: true }), texture: T.apron, uv: uvFlat(c) });
    }
  }
  // THE WALLS AND THE BARRIERS: the map's own panels (its perimeter, what the generator grew), in concrete
  for (const f of G.faces) {
    if (f.group !== 'map:wall' && f.group !== 'map:low-wall') continue;
    const low = f.group === 'map:low-wall', key = low ? T.barrier : T.wall, g = face(f.corners, fillOf(key), low ? 'facility:barrier' : 'facility:wall');
    const up = Math.abs(g.normal[2]) > 0.7, alongX = Math.abs(g.normal[1]) >= Math.abs(g.normal[0]);
    out.push({ ...g, texture: key, uv: f.corners.map((p) => (up ? [r5(p[0] / CELL), r5(p[1] / CELL)] : [r5((alongX ? p[0] : p[1]) / CELL), r5(p[2] / CELL)])) });
  }
  // THE PLACE'S OWN THINGS, where the design put them; the block's beyond the wall as its skyline
  const covered = new Set(), cover = (q) => { for (let j = Math.floor(q[1] / cell); j <= Math.floor((q[3] - 1e-6) / cell); j++) for (let i = Math.floor(q[0] / cell); i <= Math.floor((q[2] - 1e-6) / cell); i++) covered.add(`${i},${j}`); };
  for (const t of things) {
    if (t.kind === 'box') { boxFaces(out, t.q[0], t.q[1], t.q[2], t.q[3], t.z, t.z + t.h, t.wall, t.roof, 'facility:hall', 'facility:roof'); if (t.z < 1) cover(t.q); continue; }
    if (t.kind === 'gable') {
      // (a hall under a ridge: its walls to the eaves, two roof planes, its gable ends)
      const [x0, y0, x1, y1] = t.q, ze = t.ze, zr = t.zr, z0 = t.z ?? 0, ax = t.axis === 'y';
      wallFaces(out, x0, y0, x1, y1, z0, ze, t.wall, 'facility:hall');
      if (ax) { const xm = (x0 + x1) / 2;
        out.push(face([[x0, y0, ze], [xm, y0, zr], [xm, y1, zr], [x0, y1, ze]], t.roof, 'facility:roof'), face([[xm, y0, zr], [x1, y0, ze], [x1, y1, ze], [xm, y1, zr]], t.roof, 'facility:roof'),
          face([[x0, y0, ze], [x1, y0, ze], [xm, y0, zr], [xm, y0, zr]], t.wall, 'facility:hall'), face([[x1, y1, ze], [x0, y1, ze], [xm, y1, zr], [xm, y1, zr]], t.wall, 'facility:hall'));
      } else { const ym = (y0 + y1) / 2;
        out.push(face([[x0, y0, ze], [x1, y0, ze], [x1, ym, zr], [x0, ym, zr]], t.roof, 'facility:roof'), face([[x0, ym, zr], [x1, ym, zr], [x1, y1, ze], [x0, y1, ze]], t.roof, 'facility:roof'),
          face([[x1, y0, ze], [x1, y1, ze], [x1, ym, zr], [x1, ym, zr]], t.wall, 'facility:hall'), face([[x0, y1, ze], [x0, y0, ze], [x0, ym, zr], [x0, ym, zr]], t.wall, 'facility:hall'));
      }
      cover(t.q); continue;
    }
    if (t.kind !== 'stamp' || !RAW[t.key]) continue;
    const src = RAW[t.key].x ? RAW[t.key][t.lies === 'y' ? 'y' : 'x'] : RAW[t.key], k = t.scale ?? 1, tint = t.tint ? hexRgb(t.tint) : null, z = t.z ?? 0;
    for (const f of src) {
      const c = hexRgb(f.hex), fill = rgbHex(tint ? c.map((v, n) => v * tint[n]) : c);
      out.push({ corners: f.corners.map((p) => P([t.at[0] + p[0] * k, t.at[1] + p[1] * k, z + p[2] * k])), normal: f.normal.map(r5), fill, group: `facility:${t.key}`, doubleSided: true });
    }
    if (t.foot && z < 1) cover(t.foot);
  }
  // WHAT THE GENERATOR GREW: a mass on the open ground no thing of the place covers is a short container, stood by the dice
  const box20 = RAW.container.x, len = Math.max(...box20.flatMap((f) => f.corners.map((p) => p[0]))) - Math.min(...box20.flatMap((f) => f.corners.map((p) => p[0])));
  for (const [i, j, k] of M.solids ?? []) {
    if (k !== 0 || covered.has(`${i},${j}`)) continue;
    const tint = hexRgb(CONTAINER_PAINT[Math.floor(hash(i, j) * CONTAINER_PAINT.length)]), sx = (cell - 0.3) / len, cx = (i + 0.5) * cell, cy = (j + 0.5) * cell, turn = hash(j, i) < 0.5;
    for (const f of box20) {
      const c = hexRgb(f.hex), q = (p) => { const u = p[0] * sx, v = p[1]; return turn ? [cx - v, cy + u, p[2]] : [cx + u, cy + v, p[2]]; };
      out.push({ corners: f.corners.map((p) => P(q(p))), normal: (turn ? [-f.normal[1], f.normal[0], f.normal[2]] : f.normal).map(r5), fill: rgbHex(c.map((v, n) => v * tint[n])), group: 'facility:container', doubleSided: true });
    }
  }
  // THE FLOODLIGHTS: a mast over each of the map's prizes (the most seen places are the lit ones), kept apart, each in
  // the corner of its cell; none by day, or where the recipe asks for none
  const C = readGeocube(typeof cube === 'string' ? { from: cube } : cube), h = readHour(hour), CL = cubeLight(C, { hour: h });
  const light = { sun: CL.sun.linear, ambient: CL.ambient.linear, dir: CL.sun.dir }, night = !(light.dir[2] > 0.12 && lum(light.ambient) >= 0.08);
  const F0 = FACILITY.flood, lamps = [], colliders = G.colliders.slice();
  if (floods && night) {
    const R = mapLaws(M), want = [...R.furnished.items.filter((x) => x.major).map((x) => x.at), ...R.furnished.items.filter((x) => !x.major).map((x) => x.at)];
    const most = Number.isInteger(floods) ? floods : F0.most;
    for (const c of want) {
      if (lamps.length >= most) break;
      const at = [(c[0] + 0.12) * cell, (c[1] + 0.12) * cell];
      if (lamps.some((l) => Math.hypot(l.at[0] - at[0], l.at[1] - at[1]) < F0.apart)) continue;
      lamps.push({ at: P([at[0] + 0.5, at[1] + 0.5, F0.h - 0.3]), key: F0.key.slice(), radius: F0.radius, foot: at });
    }
    for (const l of lamps) {
      const [x, y] = l.foot, w = 0.11;
      boxFaces(out, x - w, y - w, x + w, y + w, 0, F0.h, '#5a5e62', '#5a5e62', 'facility:mast');
      // (its head: a lamp turned down over the yard, its face the light's own)
      boxFaces(out, x - 0.1, y - 0.1, x + 1.1, y + 1.1, F0.h - 0.25, F0.h, '#4a4e52', '#4a4e52', 'facility:mast');
      out.push({ ...face([[x - 0.05, y + 1.05, F0.h - 0.26], [x + 1.05, y + 1.05, F0.h - 0.26], [x + 1.05, y - 0.05, F0.h - 0.26], [x - 0.05, y - 0.05, F0.h - 0.26]], '#fff6dc', 'facility:flood'), emissive: [1, 0.95, 0.82], emissiveStrength: 4, glow: '0 0 14px 6px #ffe9b8' });
      colliders.push({ min: P([x - 0.15, y - 0.15, 0]), max: P([x + 0.15, y + 0.15, F0.h]) });
    }
  }
  // THE BAKE. A face's BASE is the colour its paint asks for under the cube's own day (form/sun-light.js baseOf: taken
  // under the light it is solved for, a paint shows as itself, so a night baked against its own moon would be as bright
  // as noon); its LIGHT is the hour's: the sky by how the face is turned, the moon (or the sun) where it reaches, and
  // each flood by its distance and by how the face is turned to it. So a night is dark, and lit where a flood stands
  const keep = new Set(KEEP), DAY = cubeLight(C), day = { sun: DAY.sun.linear, ambient: DAY.ambient.linear, dir: DAY.sun.dir };
  const ground = DAY.linearBases?.stone ?? DAY.linearBases?.floor ?? null;
  const B = sunLitFaces(out, day, { keep, ...(ground ? { ground } : {}) }), shadow = makeSunShadow(out.filter((f) => !keep.has(f.group)), light.dir);
  const faces = B.faces.map((f) => {
    if (!f.cornerLight) return f;
    const n = f.normal, two = !!f.doubleSided, sky = skyAt(n, light, ground), cos0 = n[0] * light.dir[0] + n[1] * light.dir[1] + n[2] * light.dir[2], cos = Math.max(two ? Math.abs(cos0) : cos0, 0);
    const cornerLight = [], sunShare = [];
    for (const c of f.corners) {
      const sh = cos > 0 ? shadow([c[0] + n[0] * 0.05, c[1] + n[1] * 0.05, c[2] + n[2] * 0.05], n) : 0, sun = light.sun.map((v) => v * cos * sh), L = sky.map((v, k) => v + sun[k]);
      for (const l of lamps) {
        const d = [l.at[0] - c[0], l.at[1] - c[1], l.at[2] - c[2]], r = Math.hypot(...d) || 1e-3, t = Math.max(0, 1 - Math.max(r, 1.1) / l.radius), nd = (n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) / r;
        const w = Math.pow(t * t, F0.fall) * Math.max(two ? Math.abs(nd) : nd, 0);
        for (let k = 0; k < 3; k++) L[k] += l.key[k] * w;
      }
      cornerLight.push(L.map(r5)); sunShare.push(lum(L) > 1e-9 ? r3(Math.min(1, lum(sun) / lum(L))) : 0);
    }
    return { ...f, cornerLight, sunShare };
  });
  const wet = readWetness(wetOfWeather(weather));
  const sky = CL.sky && CL.sky.zenith && CL.sky.horizon ? { zenith: CL.sky.zenith.slice(0, 3), horizon: CL.sky.horizon.slice(0, 3), day: night ? 0 : 1, stars: 0, seed: 1 } : { zenith: [16, 20, 30], horizon: [38, 44, 56], day: 0, stars: 0, seed: 1 };
  const lin = (c) => c.map((v) => r5((v / 255) ** 2.2));
  const far = light.dir.map((v) => r5(v * 1e6)), list = lamps.map(({ at, key, radius }) => ({ at, key, radius }));
  const room = {
    lights: [...list.map((l) => ({ ...l, live: true })), { at: far, key: light.sun, radius: 1e9, live: true }], ambient: light.ambient, fall: F0.fall,
    sun: { ground: skyAt([0, 0, -1], light, ground).map(r5) }, keep: [...KEEP], panes: [],
    reflect: { env: { zenith: lin(sky.zenith), horizon: lin(sky.horizon), ground: lin(sky.horizon).map((v) => r5(v * 0.35)) }, surfaces: FACILITY.surfaces, ...(list.length ? { floods: list } : {}),
      ...(wet ? { wet: { ...wet, seed: r5(((M.read.origin?.[0] ?? 1) * 7.31) % 50), groups: Object.keys(FACILITY.surfaces), damp: true } } : {}) },
    ...(B.unreached.length ? { unreached: B.unreached } : {}),
  };
  // (the air the weather is drawn in: the cube's own fog at this hour, its shade the cube's: a night's rain is dark)
  const air = { hue: typeof CL.fog === 'string' ? CL.fog : rgbHex(sky.horizon.map((v) => v / 255)), shade: CL.shade };
  return { faces, colliders, entities: G.entities, form: { room }, sky, air, bg: rgbHex(sky.horizon.map((v) => v / 255)), floods: list, wet: !!wet, night, dress: 'facility', heights: { rise: RISE, low: LOW } };
}
