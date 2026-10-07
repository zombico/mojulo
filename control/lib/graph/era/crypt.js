/**
 * CRYPT DRESSING — what the `gothic-stone` kit lays over its rooms, read from its style card (style/crypt.js):
 *   tomb     the set piece: a tomb chest on a stepped dais in the last room of the walk, set back from the way in;
 *   candles  a cluster at each dais corner: wax, a flame, a small warm light baked like a torch (and kept as a light);
 *   cobwebs  painted cards in the angle of a pilaster and the wall, above the plinth and under the cornice, where
 *            nothing disturbs them; no two neighbouring pilasters dress alike;
 *   blends   moss up the wall bases and in the gutter, grime at the floor's edges worn off the walking line (blendsByCause).
 * Every placement has a cause and a seeded die (integer hashes); a pure function of the plan.
 */
import { hash3, walkLine } from './dirt.js';
import { P, r5, box, card as cardRaw, hexRgb } from './geom.js';
import { blendsByCause } from './nave.js';
import './leaf-cards.js';

const mix = (a, b, t) => a + (b - a) * t;
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const at = (F, u, off, z) => [F.o[0] + F.U[0] * u + F.N[0] * off, F.o[1] + F.U[1] * u + F.N[1] * off, z];

/** The last room of the walk, and where the way comes into it. */
function lastRoom(plan) {
  const walk = walkLine(plan), byId = new Map(plan.rooms.map((r) => [r.id, r]));
  const last = plan.links.length ? byId.get(plan.links[plan.links.length - 1].to) : plan.rooms[0];
  return { r: last, entry: walk.length > 2 ? walk[walk.length - 2] : walk[0] };
}

/** The tomb: dais, chest and lid, set back from the way in along the room's long axis. → { faces, corners }. */
export function cryptTomb(plan) {
  const T = plan.kit.dress.tomb, { r, entry } = lastRoom(plan), out = [];
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, alongX = r.x1 - r.x0 >= r.y1 - r.y0;
  // set back: from the centre, away from the way in, as far as the dais and a walkway round it allow
  const half = alongX ? (r.x1 - r.x0) / 2 : (r.y1 - r.y0) / 2, dl = (alongX ? T.dais.w : T.dais.d) / 2 + 1.2;
  const away = Math.sign(alongX ? cx - entry[0] : cy - entry[1]) || 1, shift = Math.max(0, Math.min(half * 0.45, half - dl));
  const [tx, ty] = alongX ? [cx + away * shift, cy] : [cx, cy + away * shift];
  const [dw, dd] = alongX ? [T.dais.w, T.dais.d] : [T.dais.d, T.dais.w], [cw, cd] = alongX ? [T.chest.w, T.chest.d] : [T.chest.d, T.chest.w];
  const stone = { key: T.stone.key, scale: T.stone.scale, tint: T.stone.tint, group: 'stage:focus' };
  let z = 0;
  for (let s = 0; s < T.dais.steps; s++) {
    const k = s * T.dais.inset;
    box(out, [tx - dw / 2 + k, ty - dd / 2 + k, z], [tx + dw / 2 - k, ty + dd / 2 - k, z + T.dais.step], { ...stone, group: 'stage:focus-dais' }, 0.6, ['-z']);
    z += T.dais.step;
  }
  box(out, [tx - cw / 2, ty - cd / 2, z], [tx + cw / 2, ty + cd / 2, z + T.chest.h], stone, 0.5, ['-z']);
  const o = T.lid.over;
  box(out, [tx - cw / 2 - o, ty - cd / 2 - o, z + T.chest.h], [tx + cw / 2 + o, ty + cd / 2 + o, z + T.chest.h + T.lid.h], { ...stone, group: 'stage:focus-lid' }, 0.5);
  const top = z - T.dais.step * 0 , k = (T.dais.steps - 1) * T.dais.inset + 0.18;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [tx + sx * (dw / 2 - k), ty + sy * (dd / 2 - k), top]);
  return { faces: out, corners };
}

/** A cluster of candles at each dais corner: wax faces, flame faces, and one baked light per cluster. */
export function cryptCandles(plan, spots) {
  const C = plan.kit.dress.candles, faces = [], lights = [];
  spots.forEach((p, i) => {
    let hi = 0;
    for (let j = 0; j < C.per; j++) {
      const a = (j / C.per) * Math.PI * 2 + hash3(i, j, 4201) * 1.3, d = j === 0 ? 0 : 0.08 + hash3(i, j, 4203) * 0.05;
      const x = p[0] + Math.cos(a) * d, y = p[1] + Math.sin(a) * d, h = mix(C.h[0], C.h[1], hash3(i, j, 4205));
      const wax = [];
      box(wax, [x - C.r, y - C.r, p[2]], [x + C.r, y + C.r, p[2] + h], { key: null, scale: 1, tint: [1, 1, 1], group: 'stage:candle' }, 1, ['-z']);
      for (const { texture, textureLit, uv, tint, ...f } of wax) faces.push({ ...f, fill: C.wax });
      // the flame: two crossed quads, emissive, carrying its glow
      for (const [ax, ay] of [[1, 0], [0, 1]]) {
        const zb = p[2] + h, n = [ay, -ax, 0], q = (u, zz) => P([x + ax * u, y + ay * u, zz]);
        faces.push({ corners: [q(-0.018, zb), q(0.018, zb), q(0.004, zb + 0.07), q(-0.004, zb + 0.07)], fill: '#fff2c8', normal: n, outNormal: n, group: 'stage:candle', emissive: hexRgb(C.color), emissiveStrength: 3, glow: `0 0 5px 2px ${C.color}` });
      }
      hi = Math.max(hi, h);
    }
    lights.push({ at: P([p[0], p[1], p[2] + hi + 0.06]), n: [0, 0, 1], color: C.color, intensity: C.intensity, radius: C.radius, fixture: 'candle' });
  });
  return { faces, lights };
}

/** Which pilasters wear cobwebs: a share of them, by die, never two neighbours on one wall. */
export function cobwebPilasters(plan, pilasters) {
  const W = plan.kit.dress.cobwebs;
  let prev = null;
  return pilasters.map((p, i) => {
    const neighbour = prev && prev.room === p.room && prev.F === p.F && prev.k === p.k - 1 && prev.dressed;
    const dressed = !neighbour && hash3(i, p.k, 4301) < W.share;
    prev = { ...p, dressed };
    return dressed;
  });
}

/** Cobwebs in the pilaster angles, where nothing disturbs them; a dressed pilaster never stands beside another. */
export function cryptCobwebs(plan, pilasters) {
  const W = plan.kit.dress.cobwebs, pw = plan.kit.pilaster.w, out = [], dressed = cobwebPilasters(plan, pilasters);
  pilasters.forEach((p, i) => {
    if (!dressed[i]) return;
    for (const [lvl, z, up] of [[0, plan.kit.plinth.h + 0.04, 1], [1, p.top - 0.04, -1]]) {
      const sg = hash3(i, lvl, 4303) < 0.5 ? -1 : 1;
      if (p.u + sg * pw < 0 || p.u + sg * pw > p.F.len) continue;
      const s = mix(W.size[0], W.size[1], hash3(i, lvl, 4305));
      const along = unit([p.F.U[0] * -sg + p.F.N[0], p.F.U[1] * -sg + p.F.N[1], 0]), corner = at(p.F, p.u + sg * (pw / 2 + 0.01), 0.02, z);
      cardRaw(out, [corner[0] + along[0] * s / 2, corner[1] + along[1] * s / 2, corner[2]], along, [0, 0, up], s, s, 'card:cobweb', W.tint, 'stage:cobweb');
    }
  });
  return out;
}

/** The view the walk leads to: from the way into the last room, eye height, on the tomb. */
export function tombCamera(plan, corners) {
  const { r, entry } = lastRoom(plan), cx = corners.reduce((s, c) => s + c[0], 0) / 4, cy = corners.reduce((s, c) => s + c[1], 0) / 4;
  // stand in the way in, a little above the eye, a step to the side so the dais reads in three-quarter
  const dx = cx - entry[0], dy = cy - entry[1], L = Math.hypot(dx, dy) || 1, ex = entry[0] + (dx / L) * 0.4 - (dy / L) * 0.6, ey = entry[1] + (dy / L) * 0.4 + (dx / L) * 0.6;
  return { name: 'tomb', worldFraming: { cameraPosition: P([Math.min(r.x1 - 0.6, Math.max(r.x0 + 0.6, ex)), Math.min(r.y1 - 0.6, Math.max(r.y0 + 0.6, ey)), 2.3]), lookAt: P([cx, cy, 0.45]), horizontalFov: 80, pictureCenter: [560, 390] } };
}

/** Everything the crypt adds, in the shape the stage composes (see naveDress). */
export function cryptDress(plan, geom) {
  const D = plan.kit.dress, tomb = cryptTomb(plan), candles = cryptCandles(plan, tomb.corners);
  return {
    cameras: [tombCamera(plan, tomb.corners)],
    faces: [...tomb.faces, ...cryptCobwebs(plan, geom.pilasters || [])],
    blends: (faces) => blendsByCause(plan, faces, D.moss, D.grime),
    after: candles.faces, pools: [], lights: candles.lights, cut: () => false, shadowSkip: () => false,
  };
}
