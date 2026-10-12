/**
 * THE CITY, BUILT — the `city` world kind: a designed city (design.js) in its facades, walkable. The ground and what is
 * reserved on it, every right-of-way (carriageway over walk), each lot as a mass wearing its facade (facades.js), the
 * sites built, the transit lines laid (a tram's rails at grade, a maglev's guideway on its pylons) with their stops.
 *
 *   { kind: 'city', seed, grammar?, play?, board?, spine?, districts?, sites?, transit?, lots?, waive?, fidelity? }
 *
 * The plan is in metres; the world is in the legacy city's units (CITY_METERS_PER_UNIT, `metersPerUnit` on the
 * payload), because the masses are handed to the legacy city's own facade pipeline (scene-css3d.js
 * assembleBoxCityScene), which sizes a balcony, an awning and a mansard in those units. `fidelity: 'massing'` draws
 * each lot as a plain mass in its skin's colour instead: the plan judged as a plan.
 */
import { designCity } from './design.js';
import { skinLot } from './facades.js';
import { strHash } from './dice.js';
import { CITY_METERS_PER_UNIT } from '../fractal-city.js';
import { assembleBoxCityScene } from '../../scene/scene-css3d.js';
import { organicFaces, ORGANIC_SHAPES } from './organic.js';
import { lobbyOf, doorFaces } from './doors.js';
import './level.js';   // registers the city's level lowering (structure/level.js registerLevelKind)
import { readCityLook, readPaint, lookLight, paintGround, paintSkin, CITY_HAZE } from './look.js';
import { resolveLookSpec } from '../../era/look.js';
import { rgbToHex } from '../../polygonizer/vexar.js';
import { makeLight, litFactor, scaleHex } from '../../polygonizer/vexar.js';

const U = CITY_METERS_PER_UNIT;
const r3 = (v) => Math.round(v * 1000) / 1000;
// the facade pipeline's own key light (scene-css3d.js assembleBoxCityScene), unless a look hands another
const CITY_LIGHT = makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
let LIT = CITY_LIGHT;
const shade = (hex, n, lift = 0) => scaleHex(hex, Math.min(1.15, litFactor(n, LIT) + lift));
const CITY_GROUND_BASE = Object.freeze({ ground: '#56643f', road: '#3b3d40', walk: '#a8a49a', plaza: '#a19f97', park: '#4f6b3a', water: '#3e6a84', parking: '#5c5e60', rail: '#6d6257', guideway: '#c9ccd1', pylon: '#9aa0a8', stop: '#d9b44a', landmark: '#c9c4b8', civic: '#bdb6a6' });
export const CITY_GROUND = CITY_GROUND_BASE;
// a maglev's guideway: its deck's underside this high, pylons this far apart
const GUIDEWAY = Object.freeze({ z: 8, deck: 1.1, w: 5.5, pylon: 30 });
// lot faces (the plan's n/s/w/e) as the legacy city names a box's faces
const FACE = { n: '-y', s: '+y', w: '-x', e: '+x' };

// faces in metres, scaled into units at the end
const flat = (x0, y0, x1, y1, z, fill, group) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], normal: [0, 0, 1], fill: shade(fill, [0, 0, 1]), group });
function strip(a, b, w, z, fill, group) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * w / 2, ny = (dx / L) * w / 2;
  return { corners: [[a[0] + nx, a[1] + ny, z], [a[0] - nx, a[1] - ny, z], [b[0] - nx, b[1] - ny, z], [b[0] + nx, b[1] + ny, z]], normal: [0, 0, 1], fill: shade(fill, [0, 0, 1]), group };
}
function box(x0, y0, x1, y1, z0, z1, wall, roof, group) {
  const W = (a, b, n) => ({ corners: [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], normal: n, fill: shade(wall, n), group });
  return [
    { corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], normal: [0, 0, 1], fill: shade(roof, [0, 0, 1], -0.05), group: `${group}:roof` },
    W([x0, y0], [x1, y0], [0, -1, 0]), W([x1, y0], [x1, y1], [1, 0, 0]), W([x1, y1], [x0, y1], [0, 1, 0]), W([x0, y1], [x0, y0], [-1, 0, 0]),
  ];
}
const toUnits = (f) => ({ ...f, corners: f.corners.map((p) => p.map((v) => r3(v / U))) });

/** A lot's wall and roof colours for the massing and the plan sheet: its skin's family, hashed off its id. */
export function lotColours(lot, G) {
  const h = strHash(lot.id), fams = G.skin[lot.skin] || G.skin.stone, fam = fams[h % fams.length];
  return { wall: lot.skin === 'glass' ? fam[0] : fam[1], roof: G.skin.roof[(h >>> 8) % G.skin.roof.length] };
}

/** The ground, the ways, the reserved ground and the transit, as faces in metres, in the look's colours. */
function groundFaces(d, paint) {
  const { W, D } = d.frame, faces = [], CITY_GROUND = paintGround(paint, CITY_GROUND_BASE);
  faces.push(flat(-20, -20, W + 20, D + 20, 0, CITY_GROUND.ground, 'city:ground'));
  for (const r of d.reserved) if (r.kind === 'district') faces.push(flat(r.rect.x0, r.rect.y0, r.rect.x1, r.rect.y1, 0.01, r.use === 'water' ? CITY_GROUND.water : CITY_GROUND.park, `city:${r.use}`));
  for (const s of d.sites) faces.push(flat(s.rect.x0, s.rect.y0, s.rect.x1, s.rect.y1, 0.02, s.use === 'park' ? CITY_GROUND.park : CITY_GROUND.plaza, `city:${s.use === 'park' ? 'park' : 'plaza'}`));
  for (const s of d.streets) for (let k = 1; k < s.pts.length; k++) {
    faces.push(strip(s.pts[k - 1], s.pts[k], s.road + 2 * s.walk, 0.03, CITY_GROUND.walk, 'city:walk'));
    faces.push(strip(s.pts[k - 1], s.pts[k], s.road, 0.05, CITY_GROUND.road, 'city:road'));
  }
  for (const l of d.lots) if (l.use === 'parking') faces.push(flat(l.x0, l.y0, l.x1, l.y1, 0.02, CITY_GROUND.parking, 'city:parking'));
  faces.push(...entryFaces(d));
  for (const t of d.transit) {
    if (t.mode === 'maglev') {
      const G = GUIDEWAY, z0 = G.z, z1 = G.z + G.deck;
      for (let k = 1; k < t.pts.length; k++) {
        const a = t.pts[k - 1], b = t.pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L, nx = -dy * G.w / 2, ny = dx * G.w / 2;
        const top = [[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny]];
        faces.push({ corners: top.map(([x, y]) => [x, y, z1]), normal: [0, 0, 1], fill: shade(CITY_GROUND.guideway, [0, 0, 1]), group: 'city:guideway' });
        faces.push({ corners: [...top].reverse().map(([x, y]) => [x, y, z0]), normal: [0, 0, -1], fill: shade(CITY_GROUND.guideway, [0, 0, -1], -0.2), group: 'city:guideway' });
        for (const [p, q] of [[0, 3], [1, 2]]) { const n = p === 0 ? [-dy, dx, 0] : [dy, -dx, 0]; faces.push({ corners: [[...top[p], z0], [...top[q], z0], [...top[q], z1], [...top[p], z1]], normal: n, fill: shade(CITY_GROUND.guideway, n), group: 'city:guideway' }); }
        for (let s = G.pylon / 2; s < L; s += G.pylon) { const x = a[0] + dx * s, y = a[1] + dy * s; faces.push(...box(x - 0.8, y - 0.8, x + 0.8, y + 0.8, 0, z0, CITY_GROUND.pylon, CITY_GROUND.pylon, 'city:pylon')); }
      }
      for (const s of t.stops) faces.push(...box(s.at[0] - 14, s.at[1] - 3.2, s.at[0] + 14, s.at[1] + 3.2, z0 - 0.2, z0 + 0.3, CITY_GROUND.stop, CITY_GROUND.stop, 'city:stop'));
    } else {
      for (let k = 1; k < t.pts.length; k++) faces.push(strip(t.pts[k - 1], t.pts[k], 2.6, 0.07, CITY_GROUND.rail, `city:${t.mode}`));
      for (const s of t.stops) faces.push(...box(s.at[0] - 3, s.at[1] - 1.2, s.at[0] + 3, s.at[1] + 1.2, 0, 2.8, CITY_GROUND.stop, CITY_GROUND.stop, 'city:stop'));
    }
  }
  return faces;
}

/** A lobby's colours: its floor, ceiling and walls lit stone and plaster, its front the lot's own facade body. */
export const lobbyColours = (l, G) => ({ floor: '#c9c3b7', ceiling: '#ece8de', wall: '#bbb3a5', front: lotColours(l, G).wall, glass: '#2c3a45', counter: '#5a4636', stair: '#a19b90' });
/** The entries' faces, in metres: every walk-in's lobby, every door scene's marked door. */
function entryFaces(d) {
  const lots = new Map(d.lots.map((l) => [l.id, l])), out = [];
  for (const e of d.entries || []) {
    const l = lots.get(e.lot);
    if (!l || e.error) continue;
    if (e.enter === 'walk') out.push(...lobbyOf(l, lobbyColours(l, d.grammar)).faces);
    else out.push(...doorFaces(l, '#c9a24a'));
  }
  return out.map((f) => ({ ...f, fill: shade(f.fill, f.normal || [0, 0, 1], 0.1) }));
}

/** Each built lot and site as a box the legacy facade pipeline reads, in units. A walk-in lot's facade stands on its
 *  lobby, from the lobby's ceiling up. */
export function cityBoxes(d, paint = readPaint(d.plan.paint)) {
  const G = d.grammar, boxes = [], walk = new Map((d.entries || []).filter((e) => e.enter === 'walk' && !e.error).map((e) => [e.lot, e]));
  for (const l of d.lots) {
    if (l.use === 'parking') continue;
    const { skin: worn, shape } = skinLot(l, G, d.plan.seed), front = FACE[l.face];
    const lobby = walk.has(l.id) ? lobbyOf(l, lobbyColours(l, G)) : null;
    const skin = paintSkin(paint, lobby ? { ...worn, storefront: false, awning: false } : worn);
    boxes.push({
      x: r3(l.x0 / U), y: r3(l.y0 / U), w: r3((l.x1 - l.x0) / U), d: r3((l.y1 - l.y0) / U), z0: lobby ? r3(lobby.height / U) : 0, z1: r3(l.h / U),
      kind: 'building', metro: true, floors: lobby ? Math.max(1, l.floors - Math.round(lobby.height / l.floorH)) : l.floors, floorH: r3(l.floorH / U), skin, shape: lobby ? 'box' : shape, front, roadFaces: [front],
      ...(l.tower ? { tower: true } : {}), lot: l.id,
    });
  }
  for (const s of d.sites) if (s.mass) {
    const m = s.mass, floorH = G.floorH.office, floors = Math.max(1, Math.round(m.h / floorH)), lm = s.use === 'landmark';
    const fam = lm ? G.skin.glass[0] : G.skin.stone[0];
    boxes.push({
      x: r3(m.x0 / U), y: r3(m.y0 / U), w: r3((m.x1 - m.x0) / U), d: r3((m.y1 - m.y0) / U), z0: 0, z1: r3(m.h / U),
      kind: 'building', metro: true, floors, floorH: r3(floorH / U), shape: lm ? 'setback' : 'podium', front: '+y', roadFaces: ['+y'],
      skin: paintSkin(paint, { material: lm ? 'glass' : 'stone', glass: fam[0], frame: fam[1], roof: G.skin.roof[0], ...(lm ? {} : { rhythm: 'pier' }), storefront: false, fireEscape: false }),
      site: s.id,
    });
  }
  return boxes;
}

/** The `city` world kind: the recipe → the city in its facades (or its massing), walkable, the design's readout attached. */
export function assembleCityScene(manifest, ctx = {}) {
  // a level's lowered channels (level.js) are the world's, not the plan's
  const { kind, title, walk: walkFlag, game: _g, entities: _e, camera: _c, events: _v, colliders: _k, ...recipe } = manifest;
  const d0 = designCity(recipe), G = d0.grammar;
  // a segment played as a level: its own masses and a ring of the city round it (the backdrop past its walls)
  const seg = d0.plan.level ? (d0.segments || []).find((x) => x.id === d0.plan.level.segment) : null;
  const ring = 140, near = (r) => !seg || !(r.x1 < seg.rect.x0 - ring || r.x0 > seg.rect.x1 + ring || r.y1 < seg.rect.y0 - ring || r.y0 > seg.rect.y1 + ring);
  const d = seg ? { ...d0, lots: d0.lots.filter(near), sites: d0.sites.filter((x) => near(x.rect)) } : d0;
  const W = seg ? seg.rect.x1 - seg.rect.x0 : d.frame.W, D = seg ? seg.rect.y1 - seg.rect.y0 : d.frame.D;
  // the look lights the city (the world-wide channel adds its air and sky after); with none, a paint's cube's look does,
  // and the city takes that look's air and sky itself
  const paint = readPaint(d.plan.paint), spec = readCityLook(d.plan.look) || (paint ? resolveLookSpec(paint.cube.light.reference) : null);
  const lit = spec ? lookLight(spec, paint) : null;
  LIT = lit ? lit.light : CITY_LIGHT;
  const ox = seg ? seg.rect.x0 : 0, oy = seg ? seg.rect.y0 : 0;
  try { return assembleIn(d, G, W, D, { paint, spec, lit, own: !d.plan.look && !!spec, ox, oy }, { title, walkFlag, ctx }); } finally { LIT = CITY_LIGHT; }
}

function assembleIn(d, G, W, D, { paint, spec, lit, own, ox, oy }, { title, walkFlag, ctx }) {
  const ground = groundFaces(d, paint);
  // the walker starts on the walk nearest the height field's core, facing along its street
  const start = d.walk.nodes.reduce((b, n) => (!b || Math.hypot(n.x - d.field.cx, n.y - d.field.cy) < Math.hypot(b.x - d.field.cx, b.y - d.field.cy) ? n : b), null);
  const edge = d.walk.edges.find((e) => e.a === start.id || e.b === start.id), far = d.walk.nodes[edge.a === start.id ? edge.b : edge.a];
  const street = d.streets.find((s) => s.id === edge.street), off = street.road / 2 + street.walk / 2;
  const dir = [far.x - start.x, far.y - start.y], L = Math.hypot(...dir) || 1, side = [-dir[1] / L * off, dir[0] / L * off];
  const eye = [start.x + side[0] + dir[0] / L * 6, start.y + side[1] + dir[1] / L * 6, 1.7];
  const top = Math.max(...d.lots.map((l) => l.h), 40), S = Math.max(W, D);
  const u = (p) => p.map((v) => r3(v / U));
  const cameras = [
    // the whole board from its south-east corner, high enough to read the street plan through the towers
    { name: 'over', worldFraming: { cameraPosition: u([ox + W / 2 + S * 0.62, oy + D / 2 + S * 0.95, S * 0.72 + top * 0.5]), lookAt: u([ox + W / 2, oy + D / 2, 0]), horizontalFov: 50 } },
    { name: 'street', worldFraming: { cameraPosition: u(eye), lookAt: u([eye[0] + dir[0] / L * 40, eye[1] + dir[1] / L * 40, 6]), horizontalFov: 75 } },
  ];
  const sheetTitle = ctx.title || title || `${G.label} · city`;
  let scene;
  if (d.plan.fidelity === 'massing') {
    const faces = [...ground];
    for (const l of d.lots) if (l.use !== 'parking') { const c = lotColours(l, G); faces.push(...box(l.x0 + 0.05, l.y0 + 0.05, l.x1 - 0.05, l.y1 - 0.05, 0, l.h, c.wall, c.roof, `city:${l.skin}`)); }
    for (const s of d.sites) if (s.mass) faces.push(...box(s.mass.x0, s.mass.y0, s.mass.x1, s.mass.y1, 0, s.mass.h, CITY_GROUND[s.use] || CITY_GROUND.civic, CITY_GROUND.plaza, `city:${s.use}`));
    scene = { title: sheetTitle, faces: faces.map(toUnits), cameras, viewBox: { width: 1280, height: 720 } };
  } else {
    // the organic masses are built here (organic.js); every other the legacy pipeline draws
    const boxes = cityBoxes(d, paint), organic = boxes.filter((b) => ORGANIC_SHAPES.includes(b.shape));
    const grown = organic.flatMap((b) => organicFaces(b, undefined, LIT));
    scene = assembleBoxCityScene({ boxes: boxes.filter((b) => !ORGANIC_SHAPES.includes(b.shape)), faces: [...ground.map(toUnits), ...grown], cameras, viewBox: { width: 1280, height: 720 }, title: sheetTitle, light: LIT, ...(lit && lit.night ? { moonlight: true } : {}) });
  }
  const air = spec && spec.ref.air;
  return {
    ...scene,
    bg: '#cfd6dc',
    // a look's air and sky: the world-wide channel lays them for a recipe's own look (thinned by lookHaze, the city lit
    // by it: lookLit); a paint's cube's look is laid here
    ...(spec && !own ? { lookLit: true, lookHaze: CITY_HAZE } : {}),
    ...(own ? { bg: lit.night ? air.fog.color : rgbToHex(air.dome.horizon), haze: { color: air.fog.color, density: +(air.fog.density * CITY_HAZE).toFixed(5) }, sky: { zenith: air.dome.zenith, horizon: air.dome.horizon, day: lit.night ? 0 : 1, stars: 0, seed: 1 } } : {}),
    walk: walkFlag === false ? false : { speed: r3(G.walk.speed * 1.1 / U), spawn: u(eye), minEye: r3(1.7 / U), gravity: r3(22 / U), radius: r3(0.4 / U) },
    metersPerUnit: U,
    city: { grammar: typeof d.plan.grammar === 'string' ? d.plan.grammar : `${d.plan.grammar.from}+`, label: G.label, ...(spec ? { look: spec.id } : {}), ...(paint ? { paint: paint.cube.id } : {}), play: d.plan.play, fidelity: d.plan.fidelity, stats: d.stats, laws: d.laws.map((l) => ({ id: l.id, ok: l.ok, findings: l.findings.length })) },
  };
}
