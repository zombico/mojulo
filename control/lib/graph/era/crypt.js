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
import { cornerThings } from './props.js';
import { tileFamilyOf } from './tile-specs.js';
import { panel, wallBox } from './geom.js';
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

/** The walls of the plan, each with its pilasters in order: the bays between two neighbours are its runs of bare wall. */
function wallsOf(pilasters) {
  const by = new Map();
  for (const p of pilasters) { const k = `${p.room}|${p.F.o.join()}|${p.F.U.join()}`; if (!by.has(k)) by.set(k, { F: p.F, room: p.room, ps: [] }); by.get(k).ps.push(p); }
  for (const w of by.values()) w.ps.sort((a, b) => a.k - b.k);
  return [...by.values()];
}

/** Whether a doorway opens in the wall `F` between `u0` and `u1` (its centre on the wall's plane, its span overlapping). */
export function doorIn(plan, F, u0, u1) {
  return plan.links.some((l) => {
    const mid = (l.lo + l.hi) / 2, c = l.wall.endsWith('y') ? [mid, l.at] : [l.at, mid], half = (l.hi - l.lo) / 2 + plan.kit.door.frame;
    const off = (c[0] - F.o[0]) * F.N[0] + (c[1] - F.o[1]) * F.N[1], u = (c[0] - F.o[0]) * F.U[0] + (c[1] - F.o[1]) * F.U[1];
    return Math.abs(off) < plan.kit.wall + 0.1 && u + half > u0 && u - half < u1;
  });
}

/** The accent wall: in the last room, the wall behind the tomb (its normal faces back toward the way in). */
export function accentWall(plan, pilasters, tombAt) {
  const { r } = lastRoom(plan);
  let best = null;
  for (const w of wallsOf(pilasters)) {
    if (w.room !== r.id) continue;
    const mid = [w.F.o[0] + w.F.U[0] * w.F.len / 2, w.F.o[1] + w.F.U[1] * w.F.len / 2], d = Math.hypot(mid[0] - tombAt[0], mid[1] - tombAt[1]);
    const behind = (tombAt[0] - mid[0]) * w.F.N[0] + (tombAt[1] - mid[1]) * w.F.N[1] > 0;   // the tomb stands in front of it
    if (behind && (!best || d < best.d)) best = { ...w, d };
  }
  return best;
}

/** The repeating element: a burial niche (a loculus) centred in every bare bay, the same on every wall, in tiers where
 *  the wall is tall; a niche holds an urn now and then. The accent wall carries none: it breaks the repeat. */
export function cryptNiches(plan, pilasters, accent) {
  const N = plan.kit.dress.niches, pw = plan.kit.pilaster.w, out = [];
  const trimT = plan.kit.tiles.trim, trim = { key: trimT.family ? `${trimT.family}-a` : trimT.key, scale: trimT.scale, tint: plan.kit.tint.trim, group: 'stage:motif' };
  const back = { key: null, scale: 1, tint: N.dark, group: 'stage:niche' };
  let n = 0;
  for (const w of wallsOf(pilasters)) {
    if (accent && w.room === accent.room && w.F === accent.F) continue;
    for (let i = 0; i + 1 < w.ps.length; i++) {
      const a = w.ps[i], b = w.ps[i + 1];
      if (b.k !== a.k + 1) continue;   // a doorway lies between: not a bare run
      const u0 = a.u + pw / 2, u1 = b.u - pw / 2, wd = Math.min(N.w, (u1 - u0) * 0.6), um = (u0 + u1) / 2;
      if (doorIn(plan, w.F, u0, u1)) continue;   // a doorway inside the bay: not bare either
      const z0 = plan.kit.plinth.h + N.sill, tiers = a.top - z0 > 2 * N.h + N.gap + 0.6 ? 2 : 1;
      for (let t = 0; t < tiers; t++) {
        const zb = z0 + t * (N.h + N.gap), zt = zb + N.h, F = w.F, f = N.frame;
        // the recess reads by its dark back; the frame stands proud of the wall around it
        panel(out, at(F, um - wd / 2, 0.012, zb), F.U, wd, [0, 0, 1], N.h, F.N, back, 0.5);
        wallBox(out, F, um - wd / 2 - f, um + wd / 2 + f, zb - f, zb, N.out, trim, 0.5);        // sill
        wallBox(out, F, um - wd / 2 - f, um + wd / 2 + f, zt, zt + f, N.out, trim, 0.5);        // lintel
        wallBox(out, F, um - wd / 2 - f, um - wd / 2, zb, zt, N.out, trim, 0.5, true);          // jambs
        wallBox(out, F, um + wd / 2, um + wd / 2 + f, zb, zt, N.out, trim, 0.5, true);
        if (hash3(n++, t, 4401) < N.urns) {
          const c = at(F, um + (hash3(n, t, 4403) - 0.5) * wd * 0.5, 0.18, zb);
          for (let k = 0; k < 8; k++) {
            const a0 = (k / 8) * 2 * Math.PI, a1 = ((k + 1) / 8) * 2 * Math.PI, nrm = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0].map(r5);
            const pt = (a, rr, z) => P([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a), z]);
            out.push({ corners: [pt(a0, 0.09, zb), pt(a1, 0.09, zb), pt(a1, 0.12, zb + 0.18), pt(a0, 0.12, zb + 0.18)], normal: nrm, outNormal: nrm, tint: N.urn, group: 'stage:motif-urn', doubleSided: true });
            out.push({ corners: [pt(a0, 0.12, zb + 0.18), pt(a1, 0.12, zb + 0.18), pt(a1, 0.07, zb + 0.3), pt(a0, 0.07, zb + 0.3)], normal: nrm, outNormal: nrm, tint: N.urn, group: 'stage:motif-urn', doubleSided: true });
          }
        }
      }
    }
  }
  return out;
}

/** The accent's stone: larger, darker ashlar than the courses round it, named from its own numbers. */
const accentFamily = (A) => tileFamilyOf({ gen: 'stone-brick', ...A.stone });

/** The view the walk leads to: from the way into the last room, eye height, on the tomb. */
export function tombCamera(plan, corners) {
  const { r, entry } = lastRoom(plan), cx = corners.reduce((s, c) => s + c[0], 0) / 4, cy = corners.reduce((s, c) => s + c[1], 0) / 4;
  // stand in the way in, a little above the eye, a step to the side so the dais reads in three-quarter
  const dx = cx - entry[0], dy = cy - entry[1], L = Math.hypot(dx, dy) || 1, ex = entry[0] + (dx / L) * 0.4 - (dy / L) * 0.6, ey = entry[1] + (dy / L) * 0.4 + (dx / L) * 0.6;
  return { name: 'tomb', worldFraming: { cameraPosition: P([Math.min(r.x1 - 0.6, Math.max(r.x0 + 0.6, ex)), Math.min(r.y1 - 0.6, Math.max(r.y0 + 0.6, ey)), 2.3]), lookAt: P([cx, cy, 0.45]), horizontalFov: 80, pictureCenter: [560, 390] } };
}

/** Everything the crypt adds, in the shape the stage composes (see naveDress). */
export function cryptDress(plan, geom) {
  const D = plan.kit.dress, tomb = cryptTomb(plan), candles = cryptCandles(plan, tomb.corners), pil = geom.pilasters || [];
  const tc = [tomb.corners.reduce((s, c) => s + c[0], 0) / 4, tomb.corners.reduce((s, c) => s + c[1], 0) / 4];
  const accent = accentWall(plan, pil, tc), fam = accentFamily(D.accent);
  // the accent wall's courses re-cut in its own stone: the shell's wall faces on that plane are replaced, variant kept
  const onAccent = (f) => accent && f.group === 'stage:wall' && f.normal[0] === accent.F.N[0] && f.normal[1] === accent.F.N[1]
    && f.corners.every((c) => Math.abs((c[0] - accent.F.o[0]) * accent.F.N[0] + (c[1] - accent.F.o[1]) * accent.F.N[1]) < 0.02);
  const accentFaces = accent ? geom.faces.filter(onAccent).map((f) => ({ ...f, texture: `${fam}-${(f.texture || 'x-a').slice(-1)}`, tint: D.accent.tint, group: 'stage:accent' })) : [];
  const keepClear = [{ x: tc[0], y: tc[1], r: Math.hypot(D.tomb.dais.w, D.tomb.dais.d) / 2 + 0.6 }];
  return {
    cameras: [tombCamera(plan, tomb.corners)],
    faces: [...tomb.faces, ...accentFaces, ...cryptNiches(plan, pil, accent), ...cryptCobwebs(plan, pil), ...cornerThings(plan, pil, D.props, keepClear)],
    blends: (faces) => blendsByCause(plan, faces, D.moss, D.grime),
    after: candles.faces, pools: [], lights: candles.lights, cut: onAccent, shadowSkip: () => false,
  };
}
