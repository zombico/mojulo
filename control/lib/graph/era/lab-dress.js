/**
 * The LAB's dressing (style/research-lab.js): what the research-lab kit places in its shell (lab.js).
 *
 *   set piece  a containment tank at the room's centre: a stepped round dais ringed in hazard paint, a steel base, a
 *              glass cylinder round a glowing column of liquid, a cap and a conduit up into the trusses; cables from
 *              its base down into grated trenches that run out to the walls
 *   things     PLACED as records — { kind, at, yaw, … } — and only then built into faces in their own frame and moved
 *              into place: benches (each dressed differently from its neighbours: monitors, a microscope, glassware,
 *              papers, a toolbox), chairs, server racks, lockers, a cart, a whiteboard, an extinguisher. A later pass
 *              (decay) acts on the records: it tips them, moves them, breaks them, before they are built
 *   light      the tank's glow and each screen's, as pools the stage bakes
 *
 * Dice are hash3; nothing here is random.
 */
import './lab-tiles.js';
import { add, P, r5, hexRgb, panel, box, lathe } from './geom.js';
import { hash3 } from './dirt.js';
import { rotAbout } from './lab.js';
import { abandonThings, emergencyLamps, debrisPile, leakAt, spillAt } from './lab-decay.js';

const Z = [0, 0, 1];
// lathe's z is absolute: lift a profile to stand on `c[2]`
const latheAt = (out, c, prof, sides, surf, group) => lathe(out, [c[0], c[1]], prof.map(([r, z]) => [r, r5(c[2] + z)]), sides, surf, group);
const plain = (tint, group) => ({ key: null, scale: 1, tint, group });
const tex = (key, scale, tint, group) => ({ key, scale, tint, group });

// ── moving a thing's faces from its own frame (origin at its foot, +y its front) into the room ──
function rotZ(p, c, s) { return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }
/** Move `faces` built in a thing's frame to `at`, turned `yaw` (radians) about z; a `tip` ({ axis, a }: a thing
 *  knocked over) turns it first about its own axis through its foot, then lets it down onto the floor. */
export function placeFaces(faces, at, yaw, tip = null) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  if (tip) {
    const O = [0, 0, 0], turned = faces.map((f) => ({ ...f, corners: f.corners.map((p) => rotAbout(p, O, tip.axis, tip.a)), normal: rotAbout(f.normal, O, tip.axis, tip.a) }));
    const low = Math.min(...turned.flatMap((f) => f.corners.map((p) => p[2])));
    faces = turned.map((f) => ({ ...f, corners: f.corners.map((p) => [p[0], p[1], p[2] - low]) }));
  }
  return faces.map((f) => {
    const n = rotZ(f.normal, c, s).map(r5);
    return { ...f, corners: f.corners.map((p) => P(add(rotZ(p, c, s), at))), normal: n, outNormal: n };
  });
}
/** A self-lit face: its own fill, emissive in the GLB, a halo when `glow`. */
const glowFace = (corners, n, fill, group, glow = null, strength = 2) => ({ corners: corners.map(P), normal: n, outNormal: n, fill, group, emissive: hexRgb(fill), emissiveStrength: strength, ...(glow ? { glow } : {}) });

// ── the things, each in its own frame: x across, y toward its front, z up; the foot at the origin ──
const BUILD = {
  bench(t, D) {
    const out = [], B = D.bench, L = B.len / 2, W = B.depth / 2, top = tex('lab:panel', 0.8, B.top, 'stage:bench'), steel = plain(B.frame, 'stage:bench');
    box(out, [-L, -W, B.h - 0.04], [L, W, B.h], top, 1);
    box(out, [-L + 0.05, -W + 0.05, 0.12], [L - 0.05, W - 0.1, B.h - 0.04], tex('hull-plate', 1.2, B.body, 'stage:bench'), 1, ['-z']);   // the cabinet under it
    box(out, [-L + 0.05, -W + 0.05, 0], [L - 0.05, W - 0.15, 0.12], steel, 1, ['-z']);                                            // the toe kick
    for (const x of [-L / 2, 0, L / 2]) box(out, [x - 0.2, W - 0.101, 0.3], [x + 0.2, W - 0.1, 0.62], plain(B.door, 'stage:bench'), 1, ['-y']);   // drawer fronts
    for (const it of t.items) out.push(...ITEM[it.kind](it, B));
    return out;
  },
  chair(t, D) {
    const out = [], C = D.chair, seat = plain(C.seat, 'stage:chair'), steel = plain(C.frame, 'stage:chair');
    for (let k = 0; k < 5; k++) { const a = (k * 2 * Math.PI) / 5, x = Math.cos(a) * 0.28, y = Math.sin(a) * 0.28; box(out, [Math.min(0, x) - 0.02, Math.min(0, y) - 0.02, 0.03], [Math.max(0, x) + 0.02, Math.max(0, y) + 0.02, 0.07], steel, 1); }
    box(out, [-0.025, -0.025, 0.07], [0.025, 0.025, C.h - 0.06], steel, 1);
    box(out, [-0.24, -0.23, C.h - 0.07], [0.24, 0.23, C.h], seat, 1);
    box(out, [-0.22, -0.27, C.h + 0.08], [0.22, -0.22, C.h + 0.55], seat, 1);
    box(out, [-0.02, -0.25, C.h], [0.02, -0.22, C.h + 0.1], steel, 1);
    return out;
  },
  rack(t, D) {
    const out = [], R = D.rack, w = R.w / 2, d = R.d / 2;
    box(out, [-w, -d, 0], [w, d, R.h], plain(R.body, 'stage:rack'), 1, ['+y']);
    panel(out, [-w + 0.03, d, 0.05], [1, 0, 0], R.w - 0.06, Z, R.h - 0.1, [0, 1, 0], { ...tex('lab:rack', 1, [1, 1, 1], 'stage:rack'), uvOf: (p) => [(p[0] + w) / R.w, (p[2] - 0.05) / (R.h - 0.1)] }, 3);
    out.push(glowFace([[-w + 0.06, d + 0.004, R.h - 0.12], [w - 0.06, d + 0.004, R.h - 0.12], [w - 0.06, d + 0.004, R.h - 0.09], [-w + 0.06, d + 0.004, R.h - 0.09]], [0, 1, 0], t.led || R.led, 'stage:lamp', null, 2));
    return out;
  },
  lockers(t, D) {
    const out = [], K = D.lockers, w = (K.n * K.w) / 2, d = K.d / 2;
    box(out, [-w, -d, 0], [w, d, K.h], tex('hull-plate', 1.2, K.tint, 'stage:locker'), 1, ['+y']);
    for (let i = 0; i < K.n; i++) {
      const x0 = -w + i * K.w;
      panel(out, [x0 + 0.02, d, 0.08], [1, 0, 0], K.w - 0.04, Z, K.h - 0.16, [0, 1, 0], tex('hull-plate', 1.2, K.tint.map((v) => v * (0.94 + 0.1 * hash3(i, t.seed, 7101))), 'stage:locker'), 2);
      for (let v = 0; v < 4; v++) box(out, [x0 + 0.12, d, K.h - 0.35 - v * 0.05], [x0 + K.w - 0.12, d + 0.005, K.h - 0.33 - v * 0.05], plain([0.1, 0.1, 0.11], 'stage:locker'), 1, ['-y']);   // vents
      box(out, [x0 + K.w - 0.1, d, 0.95], [x0 + K.w - 0.06, d + 0.03, 1.1], plain([0.5, 0.5, 0.52], 'stage:locker'), 1, ['-y']);         // a handle
    }
    return out;
  },
  cart(t, D) {
    const out = [], C = D.cart, w = C.w / 2, d = C.d / 2, steel = plain(C.tint, 'stage:cart');
    for (const z of [0.18, C.h - 0.04]) box(out, [-w, -d, z], [w, d, z + 0.04], steel, 1);
    for (const [x, y] of [[-w, -d], [w, -d], [-w, d], [w, d]]) { box(out, [x - 0.015, y - 0.015, 0.08], [x + 0.015, y + 0.015, C.h], steel, 1); box(out, [x - 0.035, y - 0.035, 0], [x + 0.035, y + 0.035, 0.08], plain([0.12, 0.12, 0.12], 'stage:cart'), 1); }
    box(out, [-w + 0.08, -d + 0.08, C.h], [w - 0.25, d - 0.08, C.h + 0.28], plain(C.box, 'stage:cart'), 1, ['-z']);
    return out;
  },
  board(t, D) {
    const out = [], Bd = D.board, w = Bd.w / 2;
    box(out, [-w - 0.03, -0.03, Bd.z - 0.03], [w + 0.03, 0.02, Bd.z + Bd.h + 0.03], plain([0.6, 0.62, 0.64], 'stage:board'), 1, ['-y']);
    panel(out, [-w, 0.021, Bd.z], [1, 0, 0], Bd.w, Z, Bd.h, [0, 1, 0], { ...tex('lab:board', 1, [1, 1, 1], 'stage:board'), uvOf: (p) => [(p[0] + w) / Bd.w, (p[2] - Bd.z) / Bd.h] }, 4);
    box(out, [-w, 0.02, Bd.z - 0.06], [w, 0.09, Bd.z - 0.03], plain([0.6, 0.62, 0.64], 'stage:board'), 1, ['-y']);   // the marker tray
    return out;
  },
  extinguisher(t, D) {
    const out = [], E = D.extinguisher;
    const ez = t.floor ? 0 : E.z;
    latheAt(out, [0, 0.12, ez], [[0, 0], [0.08, 0], [0.085, 0.05], [0.085, E.h - 0.1], [0.06, E.h - 0.03], [0.02, E.h]], 10, { key: null, scale: 1, tint: E.tint }, 'stage:extinguisher');
    if (!t.floor) box(out, [-0.05, 0, ez + E.h * 0.55], [0.05, 0.04, ez + E.h * 0.62], plain([0.2, 0.2, 0.22], 'stage:extinguisher'), 1, ['-y']);
    return out;
  },
  // a monitor off its bench (abandon), on the floor; built as a bench's monitor on a bench of no height
  screen(t, D) { return ITEM.monitor({ x: 0, on: t.on !== false }, { h: 0 }); },
  // a sheet of paper on the floor, curled a little along its fold
  sheet(t, D) {
    const lift = 0.004 + 0.03 * hash3(t.seed, 1, 7201);
    return [{ corners: [[-0.105, -0.15, 0.003], [0.105, -0.15, 0.003], [0.105, 0, 0.003], [-0.105, 0, 0.003]].map(P), normal: Z, outNormal: Z, texture: null, tint: [0.92, 0.92, 0.88], group: 'stage:paper' },
      { corners: [[-0.105, 0, 0.003], [0.105, 0, 0.003], [0.105, 0.15, lift], [-0.105, 0.15, lift]].map(P), normal: Z, outNormal: Z, texture: null, tint: [0.92, 0.92, 0.88], group: 'stage:paper' }];
  },
};
// the things a bench carries, in the bench's frame (its top at B.h)
const ITEM = {
  monitor(it, B) {
    // at the back of the bench, its picture facing the front (+y) where the chair is; the keyboard before it
    const out = [], z = B.h, x = it.x, sw = 0.27, sh = 0.18, k = plain([0.14, 0.14, 0.15], 'stage:kit'), yb = -0.2;
    box(out, [x - 0.1, yb - 0.08, z], [x + 0.1, yb + 0.08, z + 0.02], k, 1, ['-z']);
    box(out, [x - 0.02, yb - 0.04, z + 0.02], [x + 0.02, yb - 0.01, z + 0.16], k, 1);
    box(out, [x - sw - 0.02, yb, z + 0.14], [x + sw + 0.02, yb + 0.06, z + 0.16 + 2 * sh + 0.04], k, 1);
    // the picture: unlit, so it glows at its own brightness; a dead screen is black glass, lit by the room
    const yf = yb + 0.061, sc = [[x + sw, yf, z + 0.16], [x - sw, yf, z + 0.16], [x - sw, yf, z + 0.16 + 2 * sh], [x + sw, yf, z + 0.16 + 2 * sh]].map(P);
    out.push(it.on === false ? { corners: sc, normal: [0, 1, 0], outNormal: [0, 1, 0], tint: [0.06, 0.07, 0.08], group: 'stage:kit' }
      : { corners: sc, normal: [0, 1, 0], outNormal: [0, 1, 0], texture: 'lab:screen', textureLit: false, uv: [[0, 0], [1, 0], [1, 1], [0, 1]], group: 'stage:screen' });
    box(out, [x - 0.22, 0.04, z], [x + 0.22, 0.18, z + 0.02], plain([0.2, 0.2, 0.22], 'stage:kit'), 1, ['-z']);   // the keyboard
    return out;
  },
  microscope(it, B) {
    const out = [], z = B.h, x = it.x, k = plain([0.82, 0.84, 0.86], 'stage:kit'), d = plain([0.12, 0.12, 0.13], 'stage:kit');
    box(out, [x - 0.12, -0.1, z], [x + 0.12, 0.12, z + 0.04], k, 1, ['-z']);
    box(out, [x - 0.04, 0.04, z + 0.04], [x + 0.04, 0.1, z + 0.38], k, 1);
    box(out, [x - 0.08, -0.06, z + 0.14], [x + 0.08, 0.04, z + 0.17], d, 1);
    box(out, [x - 0.03, -0.04, z + 0.22], [x + 0.03, 0.08, z + 0.3], d, 1);
    box(out, [x - 0.025, -0.08, z + 0.3], [x + 0.025, 0.0, z + 0.44], d, 1);
    return out;
  },
  glassware(it, B) {
    const out = [], z = B.h;
    it.flasks.forEach(([x, y, r, h, col], i) => {
      const g = { key: null, scale: 1, tint: col };
      latheAt(out, [it.x + x, y, z], i % 2 ? [[0, 0], [r, 0], [r, h * 0.55], [r * 0.35, h * 0.8], [r * 0.35, h]] : [[0, 0], [r * 0.6, 0], [r * 0.6, h]], 8, g, 'stage:glassware');
    });
    box(out, [it.x - 0.18, 0.02, z], [it.x + 0.18, 0.14, z + 0.06], plain([0.7, 0.72, 0.74], 'stage:kit'), 1, ['-z']);   // a tube rack
    return out;
  },
  papers(it, B) {
    const out = [], z = B.h + 0.002;
    it.sheets.forEach(([x, y, a]) => {
      const c = Math.cos(a), s = Math.sin(a), p = (u, v) => [it.x + x + u * c - v * s, y + u * s + v * c, z];
      out.push({ corners: [p(-0.105, -0.15), p(0.105, -0.15), p(0.105, 0.15), p(-0.105, 0.15)].map(P), normal: Z, outNormal: Z, texture: null, tint: [0.96, 0.96, 0.94], group: 'stage:paper' });
    });
    return out;
  },
  toolbox(it, B) {
    const out = [], z = B.h, x = it.x;
    box(out, [x - 0.24, -0.1, z], [x + 0.24, 0.1, z + 0.2], plain([0.72, 0.12, 0.1], 'stage:kit'), 1, ['-z']);
    box(out, [x - 0.1, -0.015, z + 0.2], [x + 0.1, 0.015, z + 0.26], plain([0.15, 0.15, 0.16], 'stage:kit'), 1);
    return out;
  },
};

// ── the set piece ──
function tank(c, D, br = null) {
  const out = [], T = D.tank, steel = { key: 'hull-plate-dark', scale: 1.2, tint: T.steel }, at = (z) => [c[0], c[1], z];
  // the dais: two round steps, a hazard ring painted round its foot
  latheAt(out, at(0), [[T.dais[0].r, 0], [T.dais[0].r, T.dais[0].h], [T.dais[1].r, T.dais[0].h], [T.dais[1].r, T.dais[0].h + T.dais[1].h], [0, T.dais[0].h + T.dais[1].h]], T.sides, { key: 'deck-tread', scale: 1.2, tint: T.deck }, 'stage:dais');
  const ring = T.ring, r0 = T.dais[0].r + 0.02, r1 = r0 + ring;
  for (let k = 0; k < T.sides; k++) {
    const a0 = (2 * Math.PI * k) / T.sides, a1 = (2 * Math.PI * (k + 1)) / T.sides, p = (r, a) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, 0.006];
    const u0 = (a0 * r1) / 0.8, u1 = (a1 * r1) / 0.8;
    out.push({ corners: [p(r0, a0), p(r0, a1), p(r1, a1), p(r1, a0)].map(P), normal: Z, outNormal: Z, texture: 'lab:hazard', textureLit: true, uv: [[u0, 0], [u1, 0], [u1, ring / 0.8], [u0, ring / 0.8]].map((q) => q.map(r5)), tint: [1, 1, 1], group: 'stage:hazard' });
  }
  const z0 = T.dais[0].h + T.dais[1].h, B = T.base, Cp = T.cap;
  latheAt(out, at(z0), [[0, 0], [B.r, 0], [B.r, B.h * 0.7], [B.r * 1.08, B.h * 0.75], [B.r * 1.08, B.h], [T.r + 0.06, B.h]], T.sides, steel, 'stage:tank');
  // the liquid: a glowing column, brighter low down; the glass round it, see-through
  const zg = z0 + B.h, zt = zg + T.h, rl = T.r - 0.06;
  // breached (decay): the glass a jagged ring round the foot, the liquid drained to a skim in the base, the glow out
  const Bk = br ? D.decay.breach : null, jag = (k) => r5(Bk.keep + Bk.jag * hash3(br.seed, k % T.sides, 7301) * (k % 2 ? 1 : 0.35));
  for (let k = 0; k < T.sides && br; k++) {
    const a0 = (2 * Math.PI * k) / T.sides, a1 = (2 * Math.PI * (k + 1)) / T.sides, am = (a0 + a1) / 2, n = [Math.cos(am), Math.sin(am), 0].map(r5);
    const p = (r, a, z) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z];
    out.push({ corners: [p(T.r, a0, zg), p(T.r, a1, zg), p(T.r, a1, zg + jag(k + 1)), p(T.r, a0, zg + jag(k))].map(P), normal: n, outNormal: n, fill: Bk.glass, alpha: Bk.alpha, group: 'stage:tankglass' });
    out.push({ corners: [p(0, a0, zg + 0.04), p(rl, a0, zg + 0.04), p(rl, a1, zg + 0.04), p(0, a1, zg + 0.04)].map(P), normal: Z, outNormal: Z, tint: hexRgb(Bk.color), group: 'stage:tank' });
  }
  for (let k = 0; k < T.sides && !br; k++) {
    const a0 = (2 * Math.PI * k) / T.sides, a1 = (2 * Math.PI * (k + 1)) / T.sides, am = (a0 + a1) / 2, n = [Math.cos(am), Math.sin(am), 0].map(r5);
    const p = (r, a, z) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z];
    out.push({ ...glowFace([p(rl, a0, zg), p(rl, a1, zg), p(rl, a1, zt), p(rl, a0, zt)], n, T.glow, 'stage:liquid', k === 0 ? `0 0 30px 12px ${T.glow}` : null, 2.5), cornerFills: [T.glowLow, T.glowLow, T.glow, T.glow] });
    out.push({ corners: [p(T.r, a0, zg), p(T.r, a1, zg), p(T.r, a1, zt), p(T.r, a0, zt)].map(P), normal: n, outNormal: n, fill: T.glass, alpha: T.alpha, group: 'stage:tankglass' });
  }
  // the hoops (a breached tank's fell with its glass: one lies on the dais, tilted against the base)
  if (!br) for (let i = 1; i < T.hoops; i++) { const z = zg + (T.h * i) / T.hoops; latheAt(out, at(z - 0.03), [[T.r + 0.005, 0], [T.r + 0.04, 0], [T.r + 0.04, 0.06], [T.r + 0.005, 0.06]], T.sides, steel, 'stage:tank'); }
  else {
    const hoop = []; latheAt(hoop, [0, 0, 0], [[T.r + 0.005, 0], [T.r + 0.04, 0], [T.r + 0.04, 0.06], [T.r + 0.005, 0.06]], T.sides, steel, 'stage:tank');
    const tw = br.seed * 0.7, ax = [Math.cos(tw), Math.sin(tw), 0], off = [-Math.sin(tw) * (T.r + 0.35), Math.cos(tw) * (T.r + 0.35)];
    for (const f of hoop) out.push({ ...f, corners: f.corners.map((q) => { const r1 = rotAbout(q, [0, 0, 0], ax, 0.32); return P([c[0] + off[0] + r1[0], c[1] + off[1] + r1[1], z0 + 0.22 + r1[2]]); }), normal: rotAbout(f.normal, [0, 0, 0], ax, 0.32).map(r5) });
  }
  // the frame: four struts from the base to the cap, the glass inside them
  for (let q = 0; q < 4; q++) {
    const a = Math.PI / 4 + (q * Math.PI) / 2, x = c[0] + Math.cos(a) * (T.r + 0.1), y = c[1] + Math.sin(a) * (T.r + 0.1);
    box(out, [x - 0.05, y - 0.05, zg], [x + 0.05, y + 0.05, zt], { ...steel, group: 'stage:tank' }, 1, ['-z', '+z']);
  }
  latheAt(out, at(zt), [[T.r + 0.06, 0], [Cp.r, Cp.h * 0.2], [Cp.r, Cp.h * 0.8], [Cp.r * 0.6, Cp.h], [T.conduit, Cp.h]], T.sides, steel, 'stage:tank');
  latheAt(out, at(zt + Cp.h), [[T.conduit, 0], [T.conduit, D.roof - zt - Cp.h]], 10, steel, 'stage:tank');   // the conduit up to the trusses
  return { faces: out, light: br ? null : { at: P(at(zg + T.h * 0.45)), n: [0, 0, 1], color: T.light.color, intensity: T.light.intensity, radius: T.light.radius, fixture: 'tank' }, z0, base: B.r };
}

/** Grated trenches from the dais out to the walls along the room's axes, cables lying from the tank's base to them. */
function trenches(r, c, D, zDais, baseR) {
  const out = [], T = D.trench, g = { key: 'lab:grate', scale: 0.6, tint: [1, 1, 1], group: 'stage:grate' };
  const rimR = D.tank.dais[0].r + D.tank.ring + 0.05, cable = { key: null, scale: 1, tint: [0.09, 0.09, 0.1] };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (D.portal && D.portal.side === (dy < 0 ? '-y' : dy > 0 ? '+y' : dx < 0 ? '-x' : '+x')) continue;   // never across the way in
    const far = dx > 0 ? r.x1 - 0.6 : dx < 0 ? r.x0 + 0.6 : dy > 0 ? r.y1 - 0.6 : r.y0 + 0.6, near = dx ? c[0] + dx * rimR : c[1] + dy * rimR;
    const lo = Math.min(near, far), hi = Math.max(near, far), w = T.w / 2;
    const o = dx ? [lo, c[1] - w, 0.008] : [c[0] - w, lo, 0.008], A = dx ? [1, 0, 0] : [0, 1, 0], B = dx ? [0, 1, 0] : [1, 0, 0];
    panel(out, o, A, hi - lo, B, T.w, Z, { ...g, uvOf: (p) => [p[0] / g.scale, p[1] / g.scale] }, 1.2);
    // the frame each side of the grating
    for (const sg of [-1, 1]) { const e = dx ? [lo, c[1] + sg * (w + 0.03) - 0.03, 0] : [c[0] + sg * (w + 0.03) - 0.03, lo, 0]; box(out, e, dx ? [hi, e[1] + 0.06, 0.012] : [e[0] + 0.06, hi, 0.012], { key: null, scale: 1, tint: [0.5, 0.52, 0.55], group: 'stage:grate' }, 1.2, ['-z']); }
    // cables: from the tank's base down the dais' steps (lying on each tread, dropping at each riser) onto the grating
    const Ds = D.tank.dais, z1 = Ds[0].h, cr = 0.045;
    const runs = [[baseR + 0.02, Ds[1].r, zDais], [Ds[1].r, Ds[0].r, z1], [Ds[0].r, rimR + 0.25, 0.012]];
    for (const off of [-0.1, 0.1]) {
      const seg = (s0, s1, z, z2 = z + 2 * cr) => {
        const a0 = Math.min(s0, s1), a1 = Math.max(s0, s1), m0 = dx ? c[0] + dx * a0 : c[1] + dy * a0, m1 = dx ? c[0] + dx * a1 : c[1] + dy * a1;
        const lo = Math.min(m0, m1), hi = Math.max(m0, m1), p0 = dx ? [lo, c[1] + off - cr, z] : [c[0] + off - cr, lo, z], p1 = dx ? [hi, c[1] + off + cr, z2] : [c[0] + off + cr, hi, z2];
        box(out, p0, p1, { ...cable, group: 'stage:cable' }, 1, ['-z']);
      };
      for (const [s0, s1, z] of runs) seg(s0, s1, z);
      seg(Ds[1].r, Ds[1].r + 2 * cr, z1, zDais + 2 * cr);       // over the upper riser
      seg(Ds[0].r, Ds[0].r + 2 * cr, 0.012, z1 + 2 * cr);       // over the lower riser
    }
  }
  return out;
}

/** The records: where every thing stands, what each bench carries. Seeded per room; the dressing's numbers from D. */
export function labThings(plan, r, ri, D) {
  const things = [], cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, alongY = r.y1 - r.y0 >= r.x1 - r.x0;
  // benches in two rows along the long walls, clear of the tank and the way in; each carries one dressing from the
  // cycle, from a seeded start, so neighbours never match
  const B = D.bench, cyc = D.bench.dressings, start = Math.floor(hash3(ri, 3, 7001) * cyc.length);
  const lanes = alongY ? [r.x0 + B.off, r.x1 - B.off] : [r.y0 + B.off, r.y1 - B.off];
  const run0 = alongY ? r.y0 : r.x0, run1 = alongY ? r.y1 : r.x1, slots = B.at.map((f) => run0 + (run1 - run0) * f);
  let n = 0;
  lanes.forEach((lane, li) => slots.forEach((sl, si) => {
    const yaw = alongY ? (li === 0 ? -Math.PI / 2 : Math.PI / 2) : (li === 0 ? 0 : Math.PI);   // the front faces the room's middle
    const at = alongY ? [lane, sl, 0] : [sl, lane, 0], dress = cyc[(start + n++) % cyc.length], seed = ri * 31 + li * 7 + si;
    things.push({ kind: 'bench', at, yaw, dress, seed, items: benchItems(dress, seed, B) });
    // a chair at the bench's front, pulled out a little, turned a little
    const out = B.depth / 2 + 0.45 + 0.25 * hash3(seed, 1, 7003), side = (hash3(seed, 2, 7005) - 0.5) * 1.2;
    const fx = Math.cos(yaw + Math.PI / 2), fy = Math.sin(yaw + Math.PI / 2), ux = Math.cos(yaw), uy = Math.sin(yaw);
    if (hash3(seed, 4, 7009) < D.chair.share) things.push({ kind: 'chair', at: [at[0] + fx * out + ux * side, at[1] + fy * out + uy * side, 0], yaw: yaw + Math.PI + (hash3(seed, 3, 7007) - 0.5) * 0.9, seed });
  }));
  // server racks in a row against the far end wall, lockers by the way in, the whiteboard and a cart along a side
  const R = D.rack, endY = alongY ? r.y1 - R.d / 2 - 0.4 : null, endX = alongY ? null : r.x1 - R.d / 2 - 0.4;
  for (let i = 0; i < R.n; i++) {
    const u = (i - (R.n - 1) / 2) * (R.w + 0.02) + R.shift * (alongY ? r.x1 - r.x0 : r.y1 - r.y0);
    things.push({ kind: 'rack', at: alongY ? [cx + u, endY, 0] : [endX, cy + u, 0], yaw: alongY ? Math.PI : Math.PI / 2, seed: i });
  }
  const K = D.lockers, lockAt = alongY ? [r.x1 - K.d / 2 - 0.4, r.y0 + K.from, 0] : [r.x0 + K.from, r.y1 - K.d / 2 - 0.4, 0];
  things.push({ kind: 'lockers', at: lockAt, yaw: alongY ? Math.PI / 2 : Math.PI, seed: 1 });
  const Bd = D.board, boardAt = alongY ? [r.x0 + 0.03, cy + Bd.shift, 0] : [cx + Bd.shift, r.y0 + 0.03, 0];
  things.push({ kind: 'board', at: boardAt, yaw: alongY ? -Math.PI / 2 : 0, seed: 1 });
  const Ex = D.extinguisher, exAt = alongY ? [r.x0 + 0.03 + 0, r.y0 + Ex.from, 0] : [r.x0 + Ex.from, r.y0 + 0.03, 0];
  things.push({ kind: 'extinguisher', at: exAt, yaw: alongY ? -Math.PI / 2 : 0, seed: 1 });
  const Ct = D.cart, cartAt = alongY ? [cx + Ct.at[0], r.y0 + (r.y1 - r.y0) * Ct.at[1], 0] : [r.x0 + (r.x1 - r.x0) * Ct.at[1], cy + Ct.at[0], 0];
  things.push({ kind: 'cart', at: cartAt, yaw: Ct.yaw, seed: 1 });
  return things;
}
// what a bench carries for its dressing, laid out along it
function benchItems(dress, seed, B) {
  const L = B.len / 2, items = [], h = (k) => hash3(seed, k, 7101);
  for (const part of dress.split('+')) {
    if (part === 'monitors') { items.push({ kind: 'monitor', x: -L * 0.5 }, { kind: 'monitor', x: L * 0.1 }); }
    if (part === 'monitor') items.push({ kind: 'monitor', x: -L * 0.35 + 0.3 * h(1) });
    if (part === 'microscope') items.push({ kind: 'microscope', x: L * 0.55 });
    if (part === 'glassware') items.push({ kind: 'glassware', x: L * (0.3 - 0.9 * h(2)), flasks: [0, 1, 2, 3, 4].map((i) => [-0.24 + i * 0.12, -0.12 + 0.08 * h(10 + i), 0.035 + 0.025 * h(20 + i), 0.12 + 0.12 * h(30 + i), B.liquids[Math.floor(h(40 + i) * B.liquids.length)]]) });
    if (part === 'papers') items.push({ kind: 'papers', x: L * 0.45, sheets: [0, 1, 2].map((i) => [(h(50 + i) - 0.5) * 0.4, -0.12 + 0.1 * h(60 + i), (h(70 + i) - 0.5) * 1.2]) });
    if (part === 'toolbox') items.push({ kind: 'toolbox', x: -L * 0.55 });
  }
  return items;
}

/** Build every record into faces, in place. */
export function buildThings(things, D) {
  return things.flatMap((t) => placeFaces(BUILD[t.kind](t, D), t.at, t.yaw, t.tip || null));
}

/** Everything the lab's dressing adds, in the shape the stage composes (see nave.js `naveDress`). With `decay`
 *  (decay.js, lab-decay.js) each event changes what is built, by cause; the dressing also hands the stage its extra
 *  lights (the emergency lamps), its dirt (leaks, dust, age) and its water (spills, the leak's stream). */
export function labDress(plan, geom) {
  const D = plan.kit.dress, faces = [], pools = [], after = [], jets = [], lights = [], leaks = [], things = [];
  const Dz = plan.decay ? { k: plan.decay.k, seed: plan.decay.seed } : null, live = !!geom.water;
  for (const [ri, L] of (geom.labs || []).entries()) {
    const r = L.r, c = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], pick = Dz ? plan.decay.picks[ri] : null;
    const tk = tank(c, { ...D, roof: r.h - plan.kit.lab.truss.depth }, Dz && Dz.k.breach > 0 ? Dz : null);
    faces.push(...tk.faces, ...trenches(r, c, D, tk.z0, tk.base));
    if (tk.light) pools.push(tk.light);
    const placed = labThings(plan, r, ri, D);
    things.push(...(Dz ? abandonThings(placed, r, ri, D, Dz) : placed));
    if (!Dz) continue;
    const roomBays = (geom.bays || []).filter((b) => b.F.o[0] >= r.x0 - 1e-6 && b.F.o[0] <= r.x1 + 1e-6 && b.F.o[1] >= r.y0 - 1e-6 && b.F.o[1] <= r.y1 + 1e-6);
    if (Dz.k.blackout > 0) { const E = emergencyLamps(roomBays, D, Dz, plan.kit.lab); faces.push(...E.faces); lights.push(...E.lights); }
    if (L.hole) faces.push(...debrisPile(L.hole, D, Dz, plan.kit, { key: plan.kit.tiles.ceiling.key, scale: plan.kit.tiles.ceiling.scale, tint: plan.kit.tint.ceiling }).faces);
    if (Dz.k.breach > 0) { const sp = spillAt(c, D, Dz, pick.breach, live); after.push(...sp.faces); faces.push(...sp.shards); }
    if (Dz.k.leak > 0) {
      const lk = leakAt(r, roomBays, D, Dz, plan.kit.lab, pick.leak, live);
      after.push(...lk.faces); if (lk.jet) jets.push(lk.jet);
      leaks.push({ at: lk.source, n: lk.n, w: lk.width, k: Dz.k.leak, rust: D.decay.leak.rust });
    }
  }
  const built = buildThings(things, D);
  // each screen lights the bench in front of it a little
  for (const f of built) if (f.group === 'stage:screen') {
    const m = f.corners.reduce((s, p) => add(s, p), [0, 0, 0]).map((v) => v / 4);
    pools.push({ at: P(add(m, f.normal.map((v) => v * 0.25))), n: f.normal, color: D.screenLight.color, intensity: D.screenLight.intensity, radius: D.screenLight.radius, fixture: 'screen' });
  }
  faces.push(...built);
  // the dirt a decayed lab asks of dirt.js: older, less walked, leaks down the walls, dust on what faces up
  const dirt = Dz ? { age: Math.min(1, 0.7 + 0.3 * Dz.k.abandon), traffic: 0.6 * (1 - Dz.k.abandon), ...(leaks.length ? { leaks } : {}), ...(Dz.k.abandon > 0 ? { dust: Dz.k.abandon, dustColor: D.decay.abandon.dust } : {}) } : null;
  return { faces, blends: () => [], after, pools, cut: () => false, shadowSkip: () => false, clouds: null, jets, things,
    ...(lights.length ? { lights } : {}), ...(dirt ? { dirt } : {}), ...(Dz && jets.length ? { jetLight: D.decay.jetLight } : {}) };
}
