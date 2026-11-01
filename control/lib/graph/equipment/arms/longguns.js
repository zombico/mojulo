// equipment/arms/longguns — the long arms: the carbine and the rifle in the assault and marksman layouts, the
// submachine gun (all buildLongGun: an upper over a lower with its magazine well, a raked grip, a handguard round the
// barrel, a stock behind), the bullpup (the action behind the grip in one shell) and the shotgun (a receiver, a barrel
// over its tube magazine, a pump). Generic forms, no make or model. The bore is y = 0 along +z; every major part a side
// outline pushed through its width or a section pushed along the bore (arms law 1), chamfered (law 2).
import * as dmath from '../../../util/dmath.js';
import { slab, slabC, tube, box, band } from './geom.js';
import { optic, rail, muzzle, conduit, shellGap, fins, rod, irons, boreDisc, seam, display } from './fittings.js';
import { GRIP_RAKE } from './laws.js';

const rad = (d) => (d * Math.PI) / 180;
const K = dmath.tan(rad(GRIP_RAKE));
const RAKE = [0, dmath.cos(rad(GRIP_RAKE)), dmath.sin(rad(GRIP_RAKE))];
const push = (c, o) => slabC(o).forEach((e) => c.add('extrudes', e));

/** A raked pistol grip under a receiver: its back strap from (zBack, yTop), `depth` front to back, `drop` long. → its fist. */
export function pistolGrip(c, { zBack, yTop, drop = 9.8, depth = 4.4, hw = 1.4, role = c.R.grip, group = 'grip' }) {
  const d = drop * c.P.length, h = hw * c.P.girth * c.P.hand;
  const back = (y) => zBack - (yTop - y) * K, front = (y) => zBack + depth - (yTop - y) * K;
  const ring = [[back(yTop) - 0.3, yTop + 0.3], [front(yTop) + 0.2, yTop + 0.3], [front(yTop - 1.2) + 0.15, yTop - 1.2], [front(yTop - 2.4) - 0.2, yTop - 2.4], [front(yTop - 3.6) + 0.05, yTop - 3.6],
    [front(yTop - 5.0) - 0.15, yTop - 5.0], [front(yTop - d) + 0.1, yTop - d + 0.3], [front(yTop - d) - 0.2, yTop - d], [back(yTop - d) + 0.2, yTop - d], [back(yTop - d) - 0.25, yTop - d + 0.5], [back(yTop - 3), yTop - 3]];
  push(c, { ring, plane: 'side', hw: h, chamfer: c.ch(h * 2) * 1.2, role, group });
  const yf = yTop - d * 0.42;
  return { fist: [0, yf, (back(yf) + front(yf)) / 2], frontAt: front, backAt: back, bottom: yTop - d };
}

/** A trigger guard as a band from (zF, yTop) down, back along yBot, up into the grip at zB; and the trigger. → opening. */
export function guardAndTrigger(c, { zF, zB, yTop, yBot, zTrig }) {
  const g = c.P.girth;
  push(c, { ring: band([[zF, yTop + 0.2], [zF, yBot + 0.6], [zF - 0.6, yBot], [zB + 0.4, yBot], [zB - 0.3, yBot + 0.5]], 0.5 * g), plane: 'side', hw: 0.68 * g, chamfer: 0.12, role: c.R.frame, group: 'guard' });
  push(c, { ring: [[zTrig, yTop], [zTrig + 0.55, yTop], [zTrig + 0.3, yTop - 1.0], [zTrig - 0.3, yTop - 1.75], [zTrig - 0.6, yTop - 1.65], [zTrig - 0.15, yTop - 0.9]], plane: 'side', hw: 0.34, chamfer: 0.08, role: c.R.accent, group: 'trigger' });
  return zF - 0.25 * g - (zB + 0.4);
}

/** A magazine hung from its well: curved (a 30-round arc), box (straight), drum, or cell (the future line's). */
export function magazine(c, kind, { z0, z1, yTop, len, hw = 1.1, rake = 0.1, group = 'magazine' }) {
  const g = c.P.girth, depth = z1 - z0, mid = (z0 + z1) / 2, h = hw * g;
  if (kind === 'drum') {
    push(c, { ring: [[z0 + 0.2, yTop], [z1 - 0.2, yTop], [z1 - 0.4, yTop - 4.5], [z0 + 0.4, yTop - 4.5]], plane: 'side', hw: h, chamfer: 0.15, role: c.R.frame, group });
    c.add('lathes', tube({ axis: 'x', z0: -3.6 * g, z1: 3.6 * g, x: mid + 0.6, y: yTop - 9, profile: [[0, 5.2], [0.08, 5.8], [0.92, 5.8], [1, 5.2]], samples: 28, role: c.R.frame, group }));
    return yTop - 15;
  }
  const L = (kind === 'cell' ? len * 0.55 : len) * c.P.length;
  const curve = kind === 'curved' ? 4.2 : depth * rake;
  const line = []; for (let i = 0; i <= 6; i++) { const t = i / 6; line.push([mid + curve * dmath.pow(t, 1.5), yTop + 1.5 - (L + 1.5) * t]); }
  push(c, { ring: band(line, depth), plane: 'side', hw: h, chamfer: c.ch(h * 2), role: kind === 'cell' ? c.R.metal : c.R.frame, group });
  const [ez, ey] = line[line.length - 1], [pz, py] = line[line.length - 2], tz = ez - pz, ty = ey - py, tl = dmath.hypot(tz, ty);
  const nz = -ty / tl, ny = tz / tl, a = [ez + nz * (depth / 2 + 0.25), ey + ny * (depth / 2 + 0.25)], b = [ez - nz * (depth / 2 + 0.25), ey - ny * (depth / 2 + 0.25)];
  push(c, { ring: [a, b, [b[0] + (tz / tl) * 0.7, b[1] + (ty / tl) * 0.7], [a[0] + (tz / tl) * 0.7, a[1] + (ty / tl) * 0.7]], plane: 'side', hw: h * 1.08, chamfer: 0.12, role: kind === 'cell' ? c.R.frame : c.R.accent, group });
  if (kind === 'cell' && c.R.glow) {
    const m0 = line[2], m1 = line[4];
    c.add('extrudes', box({ lo: [-h - 0.05, Math.min(m0[1], m1[1]), m0[0] - depth * 0.12], hi: [h + 0.05, Math.max(m0[1], m1[1]), m0[0] + depth * 0.12], role: c.R.glow, group: 'glow' }));
  }
  return ey;
}

/** A stock behind the receiver's rear at (z0, y band yHi..yLo): fixed, collapsible (a tube and its body), folding (a
 * wire frame), skeleton (a polymer frame) or none (the tube's cap). → its butt's point and its rear z. */
function stock(c, kind, { z0, yHi, yLo, length = 25 }) {
  const g = c.P.girth, L = length * c.P.length, zb = z0 - L, R = c.R.furniture;
  const butt = (zz, yt, yb, hw) => push(c, { ring: [[zz, yt], [zz - 1.0, yt - 0.1], [zz - 1.0, yb + 0.1], [zz, yb]], plane: 'side', hw: hw * 1.04, chamfer: 0.2, role: c.R.grip, group: 'buttpad' });
  if (kind === 'none') { c.add('lathes', tube({ z0: z0 - 2.4, z1: z0 + 0.1, y: yHi - 1.6, profile: [[0, 1.2], [0.2, 1.45], [1, 1.45]], samples: 16, role: c.R.frame, group: 'stock' })); return { butt: [0, yHi - 1.6, z0 - 2.4], back: z0 - 2.4 }; }
  if (kind === 'collapsible') {
    const yt = yHi - 1.4;
    c.add('lathes', tube({ z0: z0 - L * 0.78, z1: z0 + 0.3, y: yt, profile: [[0, 1.45 * g], [1, 1.45 * g]], samples: 16, role: c.R.frame, group: 'stock' }));
    const hw = 1.9 * g;
    push(c, { ring: [[zb + 12, yt + 1.6], [zb + 1.2, yt + 2.4], [zb, yt + 2.1], [zb, yt - 8.2], [zb + 1.4, yt - 8.8], [zb + 5.2, yt - 8.3], [zb + 11.5, yt - 3.0], [zb + 13.5, yt - 1.9]], plane: 'side', hw, chamfer: c.ch(hw * 2), role: R, group: 'stock' });
    butt(zb, yt + 2.1, yt - 8.2, hw);
    return { butt: [0, yt - 3, zb - 1], back: zb - 1 };
  }
  if (kind === 'fixed') {
    const hw = 1.95 * g;
    push(c, { ring: [[z0 + 0.4, yHi], [z0 - 6, yHi + 0.2], [zb, yHi + 0.4], [zb, yLo - 7.6], [zb + 4, yLo - 7.6], [z0 - 6, yLo - 1.6], [z0 + 0.4, yLo]], plane: 'side', hw, chamfer: c.ch(hw * 2), role: R, group: 'stock' });
    butt(zb, yHi + 0.4, yLo - 7.6, hw);
    return { butt: [0, (yHi + yLo - 7) / 2, zb - 1], back: zb - 1 };
  }
  // folding (a wire frame, the metal's) or skeleton (a polymer frame, the furniture's): a band round the stock's outline
  const wire = kind === 'folding', w = (wire ? 0.75 : 1.5) * g, hw = (wire ? 0.5 : 1.5) * g;
  const loop = [[z0 + 0.6, yHi - 0.6], [zb + 1, yHi - 0.2], [zb + 0.4, yHi - 0.6], [zb + 0.4, yLo - 6.6], [zb + 1.2, yLo - 7.0], [z0 - 4, yLo - 1.2], [z0 + 0.6, yLo + 0.2]];
  push(c, { ring: band(loop, w), plane: 'side', hw, chamfer: c.ch(hw * 2), role: wire ? c.R.metal : R, group: 'stock' });
  push(c, { ring: [[zb + 0.9, yHi - 0.1], [zb - 0.4, yHi - 0.1], [zb - 0.4, yLo - 7.2], [zb + 0.9, yLo - 7.2]], plane: 'side', hw: (wire ? 1.3 : 1.7) * g, chamfer: 0.2, role: c.R.grip, group: 'buttpad' });
  return { butt: [0, (yHi + yLo - 7) / 2, zb - 0.4], back: zb - 0.4 };
}

/** A handguard's section pushed along the bore from z0 to z1: an octagon (modern) or a hexagon with deep facets
 * (future), its slots dark along each side, every pitch. */
export function handguard(c, { z0, z1, hw, yTop, yBot, role }) {
  const fut = c.line === 'future', cut = fut ? hw * 0.7 : hw * 0.42;
  const ring = fut
    ? [[hw, yTop - cut], [hw * 0.45, yTop], [-hw * 0.45, yTop], [-hw, yTop - cut], [-hw * 0.82, yBot + cut * 0.6], [0, yBot], [hw * 0.82, yBot + cut * 0.6]]
    : [[hw, yTop - cut], [hw - cut, yTop], [-hw + cut, yTop], [-hw, yTop - cut], [-hw, yBot + cut], [-hw + cut, yBot], [hw - cut, yBot], [hw, yBot + cut]];
  slab({ ring, plane: 'front', w0: z0, w1: z1, chamfer: c.ch(hw) * 0.8, role, group: 'handguard' }).forEach((e) => c.add('extrudes', e));
  if (fut) return;
  const p = c.pitch(4.6), n = Math.max(1, Math.floor((z1 - z0 - 2) / p)), sl = Math.min(3.2, p * 0.68), ym = (yTop + yBot) / 2 - 0.2;
  for (let i = 0; i < n; i++) { const z = z0 + 1.2 + i * p; for (const s of [1, -1]) c.add('extrudes', box({ lo: [s > 0 ? hw - 0.02 : -hw - 0.03, ym - 0.38, z], hi: [s > 0 ? hw + 0.03 : -hw + 0.02, ym + 0.38, z + sl], role: c.R.bore, group: 'handguard' })); }
}

const LAYOUTS = Object.freeze({
  assault: { rz0: -9, rz1: 14.5, top: 2.6, bot: -1.4, hw: 1.25, well: [3.8, 11.4], wellY: -6.4, gripBack: -5.0, hgHW: 2.3, hgBot: -2.9, rB: 0.95, chamber: 4, magLen: 18, stockL: 25, exposed: 7 },
  marksman: { rz0: -10, rz1: 15.5, top: 2.7, bot: -1.5, hw: 1.35, well: [4.4, 11.4], wellY: -6.5, gripBack: -5.6, hgHW: 2.5, hgBot: -3.0, rB: 1.15, chamber: 4.5, magLen: 9, stockL: 31, exposed: 11 },
  // the breacher (a drum-fed automatic shotgun, the near line's): a deep receiver, a wide well, a big bore
  breacher: { rz0: -10, rz1: 13, top: 3.0, bot: -1.8, hw: 1.7, well: [3.6, 12.0], wellY: -7.0, gripBack: -5.6, hgHW: 2.7, hgBot: -3.2, rB: 1.25, chamber: 4, magLen: 9, stockL: 28, exposed: 5 },
  smg: { rz0: -6.5, rz1: 12, top: 2.4, bot: -1.8, hw: 1.4, well: [4.2, 8.0], wellY: -4.8, gripBack: -4.6, hgHW: 2.0, hgBot: -2.6, rB: 0.8, chamber: 3, magLen: 20, stockL: 22, exposed: 2 },
});

/** The carbine, the rifle (assault, marksman) and the submachine gun. */
export function buildLongGun(c, M) {
  const L = LAYOUTS[M.layout], p = c.parts, g = c.P.girth, fut = c.line === 'future', mk = M.layout === 'marksman';
  const hw = L.hw * g, top = L.top, bot = L.bot;
  const zM = L.chamber + c.barrel * c.P.length;
  const hgEnd = Math.max(L.rz1 + 3, zM - L.exposed * (mk ? 1 : c.P.length));
  const upperRole = c.R.frame, lowerRole = fut ? c.R.metal : c.R.frame;
  // the upper and the lower (law 1): the upper flat-topped, the lower round its magazine well and its trigger
  push(c, { ring: [[L.rz0, bot], [L.rz0, top - 0.6], [L.rz0 + 0.6, top], [L.rz1, top], [L.rz1, bot]], plane: 'side', hw, chamfer: c.ch(hw * 2), role: upperRole, group: 'upper' });
  const [w0, w1] = L.well, wy = L.wellY;
  push(c, { ring: [[L.rz0 - 0.5, bot], [w1 + 1.6, bot], [w1 + 1.6, bot - 1.1], [w1, bot - 1.3], [w1, wy], [w0, wy], [w0, bot - 1.7], [L.gripBack, bot - 1.7], [L.gripBack - 2.3, bot - 2.2], [L.rz0 - 0.5, bot - 1.9]],
    plane: 'side', hw: hw * 1.04, chamfer: c.ch(hw * 2), role: lowerRole, group: 'lower' });
  if (fut) { shellGap(c, { z0: L.rz0 + 0.2, z1: L.rz1 - 0.1, y: bot, hw: hw * 1.02, t: 0.26 }); conduit(c, { z0: L.rz0 + 2, z1: L.rz1 - 1.5, y: top - 1.3, hw }); }
  // the near line (law 9): the upper parted from the lower by its seam, a round counter on the left by the thumb
  if (c.line === 'near') { seam(c, { z0: L.rz0 + 0.3, z1: L.rz1 - 0.3, y: bot, hw: hw * 1.04 }); display(c, { face: 'left', x: hw * 1.04, z0: L.gripBack + 0.6, z1: L.gripBack + 3.8, y0: bot - 1.25, y1: bot - 0.35 }); }
  // the port and its bolt (right side), the charging handle at the rear top, the forward assist, the controls
  c.add('extrudes', box({ lo: [hw - 0.01, 0.0, 0.6], hi: [hw + 0.03, 1.6, Math.min(6.6, L.rz1 - 3)], role: c.R.bore, group: 'port' }));
  c.add('extrudes', box({ lo: [hw - 0.2, 0.35, 1.0], hi: [hw + 0.04, 1.25, Math.min(6.2, L.rz1 - 3.4)], role: c.R.metal, group: 'port' }));
  c.add('extrudes', box({ lo: [-1.9 * g, top - 0.7, L.rz0 - 1.6], hi: [1.9 * g, top - 0.05, L.rz0 + 0.3], role: c.R.accent, group: 'controls', chamfer: 0.12 }));
  if (!fut) c.add('lathes', tube({ z0: L.rz0 + 2.4, z1: L.rz0 + 5.2, x: hw + 0.45, y: top - 1.2, profile: [[0, 0.55], [0.7, 0.55], [1, 0.4]], samples: 12, role: c.R.metal, group: 'controls' }));
  c.add('extrudes', box({ lo: [-hw * 1.04 - 0.07, bot - 1.0, L.gripBack + 0.9], hi: [-hw * 1.04 + 0.01, bot - 0.45, L.gripBack + 2.0], role: c.R.accent, group: 'controls', chamfer: 0.05 }));
  c.add('extrudes', box({ lo: [hw * 1.04 - 0.01, bot - 1.4, w0 - 1.1], hi: [hw * 1.04 + 0.08, bot - 0.8, w0 - 0.4], role: c.R.accent, group: 'controls', chamfer: 0.06 }));
  // the grip (law 4: raked back off the bore), the guard and its trigger (law 6: a finger's opening)
  const G = pistolGrip(c, { zBack: L.gripBack, yTop: bot - 1.7, drop: M.layout === 'smg' ? 9.4 : 9.8, depth: 3.9, hw: 1.35 });
  const guardOpening = guardAndTrigger(c, { zF: w0 - 0.05, zB: G.frontAt(bot - 4.4), yTop: bot - 1.7, yBot: bot - 4.6, zTrig: L.gripBack + 4.6 });
  // the magazine from its well
  const magBottom = magazine(c, p.magazine, { z0: w0 + 0.25, z1: w1 - 0.25, yTop: wy, len: L.magLen, rake: M.layout === 'smg' ? 0.25 : 0.1 });
  // the handguard round the barrel, the barrel out of it, its gas block, the muzzle and its device
  handguard(c, { z0: L.rz1, z1: hgEnd, hw: L.hgHW * g, yTop: top, yBot: L.hgBot * g, role: upperRole });
  if (fut) conduit(c, { z0: L.rz1 + 1.5, z1: hgEnd - 1.5, y: 0.3, hw: L.hgHW * g * 0.86, h: 0.36 });
  const rB = L.rB * g;
  c.add('lathes', tube({ z0: L.rz1 - 0.5, z1: zM, profile: [[0, rB * 1.08], [0.5, rB], [1, rB * 0.94]], samples: 16, role: c.R.metal, group: 'barrel' }));
  if (zM - hgEnd > 3 && !fut) c.add('extrudes', box({ lo: [-rB * 1.35, -rB * 1.25, hgEnd + 0.6], hi: [rB * 1.35, rB * 1.6, hgEnd + 2.4], role: c.R.metal, group: 'barrel', chamfer: 0.15 }));
  if (fut && zM - hgEnd > 3) fins(c, { z0: hgEnd + 0.5, z1: zM - 0.5, r: rB * 1.7 });
  const front = muzzle(c, p.muzzle, { zM, rB: rB * 0.94 });
  // the rail on the top line over the upper and the handguard, its sides when full (law 4: one line)
  let yTop = top;
  if (p.rail !== 'none') yTop = rail(c, { z0: L.rz0 + 0.8, z1: hgEnd - 0.6, yTop: top, hw: 1.05 * g });
  if (p.rail === 'full') for (const s of [1, -1]) { const x = s * L.hgHW * g; c.add('extrudes', box({ lo: s > 0 ? [x - 0.02, -0.9, L.rz1 + 2.5] : [x - 0.32, -0.9, L.rz1 + 2.5], hi: s > 0 ? [x + 0.32, 0.5, hgEnd - 1.5] : [x + 0.02, 0.5, hgEnd - 1.5], role: upperRole, group: 'rail', chamfer: 0.08 })); }
  // the optic (or the irons standing tall on the rail)
  const zOptic = mk ? L.rz0 - 1 : M.layout === 'smg' ? L.rz0 + 1.5 : -1.5;
  if (p.optic === 'irons') irons(c, { zRear: L.rz0 + 2.6, zFront: hgEnd - 1.0, yTop, w: 2.4, h: 1.7 });
  else optic(c, p.optic, { z0: zOptic, z1: zOptic + (mk ? 34 : 26), yTop });
  // the stock
  const S = stock(c, p.stock, { z0: L.rz0 - 0.4, yHi: top - 0.2, yLo: bot - 1.9, length: L.stockL });
  // under the handguard: a foregrip, a light, a bipod
  const hb = L.hgBot * g, zu = L.rz1 + (hgEnd - L.rz1) * 0.42;
  if (p.underbarrel === 'grip') c.add('lathes', tube({ axis: 'y', z0: hb - 8.5, z1: hb + 0.3, x: 0, y: zu, profile: [[0, 1.4], [0.1, 1.55], [0.9, 1.3], [1, 1.5]], samples: 16, role: c.R.grip, group: 'foregrip' }));
  if (p.underbarrel === 'light') {
    const x = L.hgHW * g + 1.3, z1 = hgEnd - 1;
    c.add('lathes', tube({ z0: z1 - 12, z1, x, y: -0.2, profile: [[0, 1.05], [0.72, 1.05], [0.8, 1.35], [1, 1.35]], samples: 16, role: c.R.frame, group: 'light' }));
    c.add('lathes', tube({ z0: z1 - 0.02, z1: z1 + 0.03, x, y: -0.2, profile: [[0, 1.15], [1, 1.15]], samples: 16, role: c.R.glass, group: 'light' }));
  }
  if (p.underbarrel === 'bipod') {
    const zb = hgEnd - 2.5;
    c.add('extrudes', box({ lo: [-1.6, hb - 1.6, zb - 1.4], hi: [1.6, hb + 0.1, zb + 1.4], role: c.R.frame, group: 'bipod', chamfer: 0.2 }));
    for (const s of [1, -1]) rod(c, { from: [s * 1.2, hb - 1.2, zb], to: [s * 7.5, hb - 21, zb + 6], r: 0.55, role: c.R.metal, group: 'bipod' });
  }
  return { back: S.back, front, fist: G.fist, axis: RAKE, butt: S.butt, top: yTop, guardOpening, bottom: Math.min(magBottom, G.bottom) };
}

/** The bullpup: the action behind the grip in one shell, the magazine behind the trigger, a guard that takes the hand. */
export function buildBullpup(c) {
  const p = c.parts, g = c.P.girth, fut = c.line === 'future', hw = 1.9 * g;
  const zM = -10 + c.barrel * c.P.length, zFront = 13, hgEnd = Math.max(zFront + 6, zM - 9 * c.P.length);
  const body = [[-38, -9.6], [-38, 2.2], [-37, 3.0], [zFront - 3, 3.0], [zFront, 1.6], [zFront, -3.0], [6.6, -3.0], [-0.6, -3.2], [-3.2, -4.4], [-5.2, -5.6], [-14.2, -5.6], [-16, -5.2], [-34, -9.0], [-35.5, -10.2]];
  push(c, { ring: body, plane: 'side', hw, chamfer: c.ch(hw * 2), role: c.R.frame, group: 'body' });
  // the cheek rest and the butt pad, the port by the cheek (law 5)
  push(c, { ring: [[-34, 3.0], [-18, 3.0], [-18, 3.9], [-33, 4.3]], plane: 'side', hw: hw * 0.8, chamfer: c.ch(hw), role: c.R.grip, group: 'cheek' });
  push(c, { ring: [[-38, 2.2], [-39.1, 2.1], [-39.1, -10.0], [-38, -9.6]], plane: 'side', hw: hw * 1.04, chamfer: 0.2, role: c.R.grip, group: 'buttpad' });
  c.add('extrudes', box({ lo: [hw - 0.01, -0.2, -15], hi: [hw + 0.03, 1.6, -9], role: c.R.bore, group: 'port' }));
  if (fut) { shellGap(c, { z0: -36, z1: zFront - 0.5, y: -1.6, hw: hw * 1.01, t: 0.26 }); conduit(c, { z0: -30, z1: zFront - 2, y: 1.2, hw }); }
  if (c.line === 'near') { seam(c, { z0: -37, z1: zFront - 0.5, y: -1.6, hw }); display(c, { face: 'left', x: hw, z0: -4, z1: 0.4, y0: 0.0, y1: 1.4 }); }
  // the grip forward, the guard that takes the whole hand, the magazine behind it
  const G = pistolGrip(c, { zBack: 2.6, yTop: -3.0, drop: 9.6, depth: 4.1, hw: 1.45 });
  push(c, { ring: band([[zFront - 1.6, -2.9], [zFront - 1.6, -10.6], [zFront - 2.6, -12.0], [G.frontAt(-12.4) + 0.4, -12.4]], 0.7 * g), plane: 'side', hw: 0.95 * g, chamfer: 0.18, role: c.R.frame, group: 'guard' });
  push(c, { ring: [[6.4, -3.0], [6.95, -3.0], [6.7, -4.0], [6.1, -4.75], [5.8, -4.65], [6.25, -3.9]], plane: 'side', hw: 0.34, chamfer: 0.08, role: c.R.accent, group: 'trigger' });
  const magBottom = magazine(c, p.magazine, { z0: -13.6, z1: -6.8, yTop: -5.6, len: 17 });
  // the short handguard, the barrel, the muzzle
  handguard(c, { z0: zFront, z1: hgEnd, hw: 2.1 * g, yTop: 2.0, yBot: -2.8 * g, role: c.R.frame });
  const rB = 0.95 * g;
  c.add('lathes', tube({ z0: zFront - 1, z1: zM, profile: [[0, rB], [1, rB * 0.94]], samples: 16, role: c.R.metal, group: 'barrel' }));
  if (fut && zM - hgEnd > 3) fins(c, { z0: hgEnd + 0.5, z1: zM - 0.5, r: rB * 1.7 });
  const front = muzzle(c, p.muzzle, { zM, rB: rB * 0.94 });
  const yTop = rail(c, { z0: -16, z1: zFront - 3.6, yTop: 3.0, hw: 1.05 * g });
  if (p.optic === 'irons') irons(c, { zRear: -14, zFront: zFront - 4.2, yTop, w: 2.4, h: 1.7 });
  else optic(c, p.optic, { z0: -8, z1: 18, yTop });
  if (p.underbarrel === 'grip') c.add('lathes', tube({ axis: 'y', z0: -2.8 * g - 8, z1: -2.8 * g + 0.3, x: 0, y: zFront + (hgEnd - zFront) * 0.6, profile: [[0, 1.4], [0.1, 1.55], [0.9, 1.3], [1, 1.5]], samples: 16, role: c.R.grip, group: 'foregrip' }));
  if (p.underbarrel === 'light') { const x = 2.1 * g + 1.3; c.add('lathes', tube({ z0: hgEnd - 11, z1: hgEnd - 0.5, x, y: -0.2, profile: [[0, 1.05], [0.72, 1.05], [0.8, 1.35], [1, 1.35]], samples: 16, role: c.R.frame, group: 'light' })); }
  return { back: -39.1, front, fist: G.fist, axis: RAKE, butt: [0, -4, -39.1], top: yTop, guardOpening: zFront - 1.6 - 0.35 * g - G.frontAt(-6), bottom: Math.min(magBottom, G.bottom) };
}

/** The shotgun: a receiver, a barrel over its tube magazine, a pump round the tube, a straight stock or a pistol grip. */
export function buildShotgun(c, M) {
  const p = c.parts, g = c.P.girth, fut = c.line === 'future', hw = 1.6 * g;
  const zR0 = -9, zR1 = 10, top = 2.6, bot = -3.0;
  const zM = zR1 + c.barrel * c.P.length, yT = -2.35 * g;
  const recv = fut ? c.R.frame : c.R.metal;
  push(c, { ring: [[zR0, bot + 0.4], [zR0, top - 0.8], [zR0 + 1.2, top], [zR1 - 0.6, top], [zR1, top - 0.6], [zR1, bot], [zR0 + 1.0, bot]], plane: 'side', hw, chamfer: c.ch(hw * 2) * 1.2, role: recv, group: 'receiver' });
  c.add('extrudes', box({ lo: [hw - 0.01, -0.6, -1.0], hi: [hw + 0.03, 1.5, 5.5], role: c.R.bore, group: 'port' }));
  c.add('extrudes', box({ lo: [-0.9 * g, bot - 0.03, 0], hi: [0.9 * g, bot + 0.05, 7.5], role: c.R.bore, group: 'port' }));
  if (fut) { shellGap(c, { z0: zR0 + 0.5, z1: zR1 - 0.3, y: -0.9, hw: hw * 1.01, t: 0.26 }); conduit(c, { z0: zR0 + 2.5, z1: zR1 - 1.5, y: 1.2, hw }); }
  if (c.line === 'near') { seam(c, { z0: zR0 + 0.5, z1: zR1 - 0.3, y: -0.9, hw: hw * 1.01 }); display(c, { face: 'left', x: hw, z0: -6.4, z1: -2.8, y0: 0.4, y1: 1.6 }); }
  // the barrel and the magazine tube under it, its cap; a bead at the muzzle
  const rB = 1.15 * g;
  c.add('lathes', tube({ z0: zR1 - 0.5, z1: zM, profile: [[0, rB * 1.05], [0.15, rB], [1, rB * 0.97]], samples: 18, role: c.R.metal, group: 'barrel' }));
  const tubeEnd = p.magazine === 'tube' ? zM - 7 * c.P.length : zR1 + 18;
  if (p.magazine !== 'box') {
    c.add('lathes', tube({ z0: zR1 - 0.3, z1: tubeEnd, y: yT, profile: [[0, 1.05 * g], [1, 1.05 * g]], samples: 16, role: c.R.metal, group: 'magazine' }));
    c.add('lathes', tube({ z0: tubeEnd, z1: tubeEnd + 1.4, y: yT, profile: [[0, 1.2 * g], [0.8, 1.2 * g], [1, 0.95 * g]], samples: 16, role: c.R.accent, group: 'magazine' }));
    c.add('extrudes', box({ lo: [-0.5, yT + 0.4, tubeEnd - 0.2], hi: [0.5, -rB * 0.6, tubeEnd + 1.2], role: c.R.accent, group: 'magazine', chamfer: 0.1 }));
  }
  if (p.magazine === 'box' || p.magazine === 'cell') magazine(c, p.magazine === 'cell' ? 'cell' : 'box', { z0: 1.2, z1: 7.4, yTop: bot + 0.5, len: p.magazine === 'cell' ? 14 : 12 });
  c.add('lathes', tube({ axis: 'y', z0: rB - 0.1, z1: rB + 0.55, x: 0, y: zM - 1.2, profile: [[0, 0.24], [0.6, 0.3], [1, 0.12]], samples: 10, role: c.R.accent, group: 'sights' }));
  // the pump round the tube: a section pushed along, its ribs the grip's (law 5)
  const pz0 = zR1 + 9, pz1 = pz0 + 17 * c.P.length, pw = 2.3 * g, pt = yT + 1.8 * g, pb = yT - 1.8 * g;
  slab({ ring: [[pw, pt - 0.8], [pw - 0.8, pt], [-pw + 0.8, pt], [-pw, pt - 0.8], [-pw, pb + 0.9], [-pw + 0.9, pb], [pw - 0.9, pb], [pw, pb + 0.9]], plane: 'front', w0: pz0, w1: pz1, chamfer: c.ch(pw), role: fut ? c.R.metal : c.R.furniture, group: 'pump' }).forEach((e) => c.add('extrudes', e));
  const rp = c.pitch(1.6), nr = Math.max(3, Math.floor((pz1 - pz0 - 3) / rp));
  for (let i = 0; i < nr; i++) { const z = pz0 + 1.5 + i * rp; for (const s of [1, -1]) c.add('extrudes', box({ lo: s > 0 ? [pw - 0.02, pb + 1.0, z] : [-pw - 0.1, pb + 1.0, z], hi: s > 0 ? [pw + 0.1, pt - 0.9, z + rp * 0.45] : [-pw + 0.02, pt - 0.9, z + rp * 0.45], role: c.R.grip, group: 'pump' })); }
  if (fut) conduit(c, { z0: pz0 + 1, z1: pz1 - 1, y: yT, hw: pw, h: 0.4 });
  const front = muzzle(c, p.muzzle, { zM, rB: rB * 0.97 });
  // the trigger in its guard under the receiver
  const pistol = p.grip === 'pistol';
  let fist, butt, back, guardOpening;
  if (pistol) {
    const G = pistolGrip(c, { zBack: zR0 + 1.6, yTop: bot, drop: 9.8, depth: 4.2, hw: 1.4 });
    guardOpening = guardAndTrigger(c, { zF: 4.2, zB: G.frontAt(bot - 3.0), yTop: bot, yBot: bot - 3.3, zTrig: zR0 + 6.4 });
    const S = stock(c, p.stock === 'fixed' ? 'fixed' : p.stock, { z0: zR0 + 0.2, yHi: top - 0.4, yLo: bot + 0.6, length: 26 });
    fist = G.fist; butt = S.butt; back = S.back;
  } else {
    guardOpening = guardAndTrigger(c, { zF: 3.2, zB: zR0 + 1.0, yTop: bot, yBot: bot - 3.0, zTrig: zR0 + 4.4 });
    // the straight stock: the comb to the receiver's top line, the wrist taken by the hand, the butt dropped (law 4)
    if (p.stock === 'none') {
      const G = pistolGrip(c, { zBack: zR0 - 0.5, yTop: bot + 1.2, drop: 9.8, depth: 4.2, hw: 1.45, role: c.R.furniture });
      fist = G.fist; butt = [0, bot - 6, zR0 - 3]; back = zR0 - 4;
    } else {
      const zb = zR0 - 36 * c.P.length, h = 1.9 * g;
      push(c, { ring: [[zR0 + 0.6, top - 1.0], [zR0 - 4, top - 1.1], [zb, top - 3.4], [zb, bot - 11.0], [zb + 2.6, bot - 11.2], [zR0 - 9.0, bot - 4.6], [zR0 - 3.6, bot - 1.6], [zR0 + 0.6, bot + 0.2]], plane: 'side', hw: h, chamfer: c.ch(h * 2), role: c.R.furniture, group: 'stock' });
      push(c, { ring: [[zb, top - 3.4], [zb - 1.2, top - 3.5], [zb - 1.2, bot - 10.9], [zb, bot - 11.0]], plane: 'side', hw: h * 1.04, chamfer: 0.2, role: c.R.grip, group: 'buttpad' });
      fist = [0, bot - 2.4, zR0 - 4.8]; butt = [0, (top + bot - 14) / 2, zb - 1.2]; back = zb - 1.2;
    }
  }
  let yTop = top;
  if (p.rail === 'top') yTop = rail(c, { z0: zR0 + 1.2, z1: zR1 - 0.8, yTop: top, hw: 1.05 * g });
  if (p.optic === 'irons') { if (p.rail === 'top') irons(c, { zRear: zR0 + 2.2, zFront: zR1 - 1.4, yTop, w: 2.2, h: 1.3 }); }
  else optic(c, p.optic, { z0: zR0 + 2.4, z1: zR0 + 26, yTop });
  if (p.underbarrel === 'light') { const x = pw + 1.25; c.add('lathes', tube({ z0: pz1 + 1, z1: pz1 + 11, x, y: yT, profile: [[0, 1.05], [0.72, 1.05], [0.8, 1.35], [1, 1.35]], samples: 16, role: c.R.frame, group: 'light' })); c.add('lathes', tube({ z0: pz1 + 10.98, z1: pz1 + 11.03, x, y: yT, profile: [[0, 1.15], [1, 1.15]], samples: 16, role: c.R.glass, group: 'light' })); }
  return { back, front, fist, axis: pistol ? RAKE : [0, 0.6, 0.8], butt, top: yTop, guardOpening };
}
