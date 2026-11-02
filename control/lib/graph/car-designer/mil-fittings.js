/**
 * THE FIELD'S FITTINGS: what a field vehicle carries bolted, strapped and welded on, as CARDS. A card builds its fitting
 * in the frame of the ANCHOR it is set on, and a body declares its anchors (road-military.js): a new fitting is a card,
 * never a body special-cased.
 *
 * An anchor: { id, kind, at, out, up }   at: the point on the surface; out: the surface's outward normal; up: its up.
 * A card builds in the anchor's frame: x across (out × up), y out from the surface (0 on it), z up; or, for a wheel, in
 * vehicle space from the anchor itself.
 *
 *   spareWheel    the vehicle's own wheel (mil-wheel.js) on a carrier: a plate, its studs, the wheel clamped over them
 *   jerryCans     cans in a rack: each its pressed X, three handles and a spout; the rack's tray, posts and strap
 *   pioneerTools  a shovel and an axe in their clips, along a flank
 *   fuelTank      a saddle tank on its cradle, its straps over it, the filler and its cap
 *   shackle       a D-ring through its tab, its pin
 *   pintle        the towing hook on its block, its latch
 *   antenna       a whip on a sprung base, on its bracket
 *   grabHandle    a bent bar on two feet
 *   step          a tread plate on its brackets, holed against the mud
 *   mudFlap       a rubber flap on its bar
 *   mirror        a round mirror on its arm
 *   tarpRoll      a rolled tarp, two straps round it
 *   stowageBox    a box hung on its brackets, its lid proud and latched, a handle each end
 *
 *   FITTINGS                        card id → { reads, fits: [anchor kinds], build(anchor, ctx) → faces }
 *   fit(anchor, card, ctx)          → the card's faces on that anchor (throws when the card does not fit the anchor's kind)
 *   ctx: { r, tyreW, paint, seed }  the vehicle's wheel, its paint, the dice's seed
 *
 * Vehicle space (+y forward, x across, z up), metres. Pure and deterministic.
 */
import { plate, tube, bend, bolts, place } from './mil-hull.js';
import { milWheel } from './mil-wheel.js';

const C = Object.freeze({
  steel: '#3f413c', red: '#7a2a1c', canvas: '#5f5b43', webbing: '#4a4a32', rubber: '#1a1b1d', wood: '#6b5232',
  glass: '#2c3836', canOlive: '#4f5726', canSand: '#8a7a55', tread: '#444640',
});
const M = (part, material, albedo) => ({ part, material, albedo });
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
const disc = (cu, cv, rr, k = 12) => Array.from({ length: k }, (_, i) => [cu + rr * Math.cos((2 * Math.PI * i) / k), cv + rr * Math.sin((2 * Math.PI * i) / k)]);

// the anchor's frame: x across, y out, z up
const frameOf = (A) => ({ origin: A.at, ex: cross(A.out, A.up), ey: A.out, ez: A.up });
const onAnchor = (A, faces) => place(faces, frameOf(A));

// ── the cards ───────────────────────────────────────────────────────────────────
function spareWheel(A, ctx) {
  const local = [
    ...plate({ axis: 'y', profile: rect(-0.13, 0.13, -0.13, 0.13), from: 0, to: 0.02, r: 0.006, seg: 1, look: M('spare.carrier', 'milPaint', ctx.paint) }),
    ...tube([[0, 0, 0], [0, 0.05, 0]], 0.05, { sides: 10, look: M('spare.carrier', 'milPaint', ctx.paint) }),
    ...bolts([[-0.08, 0.02, -0.08], [0.08, 0.02, -0.08], [0.08, 0.02, 0.08], [-0.08, 0.02, 0.08]], [0, 1, 0], { r: 0.012, h: 0.01, look: M('spare.bolt', 'steel', C.steel) }),
  ];
  return [...onAnchor(A, local), ...milWheel({ hub: add(A.at, mul(A.out, ctx.tyreW / 2 + 0.03)), r: ctx.r, width: ctx.tyreW, paint: ctx.paint, axis: A.out })];
}

function jerryCan(x0, tone) {
  const W = 0.345, D = 0.165, H = 0.47, can = M('jerrycan', 'milPaint', tone), y0 = 0.02, y1 = y0 + D, out = [];
  out.push(...plate({ axis: 'z', profile: rect(x0 - W / 2, x0 + W / 2, y0, y1), from: 0, to: H, r: 0.016, seg: 2, look: can }));
  // the pressed X and its border on the face that looks out
  const f = y1 + 0.002, i = 0.045, q = [[x0 - W / 2 + i, f, i], [x0 + W / 2 - i, f, i], [x0 + W / 2 - i, f, H - i], [x0 - W / 2 + i, f, H - i]];
  for (const [a, b] of [[0, 2], [1, 3], [0, 1], [1, 2], [2, 3], [3, 0]]) out.push(...tube([q[a], q[b]], 0.006, { sides: 6, caps: false, look: can }));
  // three handles along the top, the spout at a corner
  for (const dx of [-0.1, 0, 0.1]) out.push(...tube(bend([[x0 + dx, y0 + 0.05, H], [x0 + dx, y0 + 0.05, H + 0.035], [x0 + dx, y1 - 0.05, H + 0.035], [x0 + dx, y1 - 0.05, H]], 0.012, 2), 0.007, { sides: 6, look: can }));
  out.push(...tube([[x0 + W / 2 - 0.05, y0 + D / 2, H - 0.01], [x0 + W / 2 - 0.05, y0 + D / 2, H + 0.04]], 0.022, { sides: 10, look: can }));
  return out;
}
function jerryCans(A, ctx) {
  const n = ctx.count ?? 1, gap = 0.37, out = [];
  for (let k = 0; k < n; k++) {
    const x = (k - (n - 1) / 2) * gap, tone = ctx.tones?.[k] ?? C.canOlive;
    out.push(...jerryCan(x, tone));
    // the rack: its tray, two posts, a strap over the can and its buckle
    out.push(...plate({ axis: 'z', profile: rect(x - 0.19, x + 0.19, 0, 0.2), from: -0.025, to: 0, r: 0.005, seg: 1, look: M('rack', 'milPaint', ctx.paint) }));
    for (const s of [-1, 1]) out.push(...tube([[x + s * 0.185, 0.012, -0.02], [x + s * 0.185, 0.012, 0.36]], 0.011, { sides: 8, look: M('rack', 'milPaint', ctx.paint) }));
    out.push(...plate({ axis: 'z', profile: rect(x - 0.19, x + 0.19, 0.188, 0.196), from: 0.27, to: 0.31, look: M('rack.strap', 'canvas', C.webbing) }));
    out.push(...plate({ axis: 'z', profile: rect(x + 0.06, x + 0.11, 0.195, 0.203), from: 0.262, to: 0.318, r: 0.002, seg: 1, look: M('rack.buckle', 'steel', C.steel) }));
  }
  return onAnchor(A, out);
}

function pioneerTools(A, ctx) {
  const out = [], clip = M('tools.clip', 'milPaint', ctx.paint), steel = M('tools.blade', 'steel', C.steel), wood = M('tools.handle', 'canvas', C.wood);
  // the shovel: its handle along the flank, its blade at the fore end, a D grip aft
  out.push(...tube([[-0.62, 0.04, 0], [0.16, 0.04, 0]], 0.017, { sides: 8, look: wood }));
  out.push(...plate({ axis: 'y', profile: [[0.15, -0.1], [0.38, -0.1], [0.45, 0], [0.38, 0.1], [0.15, 0.1]], from: 0.034, to: 0.04, r: 0.002, seg: 1, look: steel }));
  out.push(...tube(bend([[-0.62, 0.04, 0.0], [-0.66, 0.04, 0.05], [-0.76, 0.04, 0.05], [-0.76, 0.04, -0.05], [-0.66, 0.04, -0.05], [-0.62, 0.04, 0.0]], 0.02, 2), 0.009, { sides: 6, look: wood }));
  // the axe: proud of the shovel, its head aft
  out.push(...tube([[-0.58, 0.08, -0.05], [0.2, 0.08, -0.05]], 0.016, { sides: 8, look: wood }));
  out.push(...plate({ axis: 'y', profile: [[-0.66, -0.1], [-0.56, -0.07], [-0.56, -0.02], [-0.66, 0.0]], from: 0.07, to: 0.09, r: 0.002, seg: 1, look: steel }));
  // the clips
  for (const x of [-0.42, 0.06]) out.push(...plate({ axis: 'z', profile: rect(x - 0.025, x + 0.025, 0, 0.1), from: -0.08, to: 0.03, r: 0.006, seg: 1, look: clip }));
  return onAnchor(A, out);
}

function fuelTank(A, ctx) {
  const L = ctx.length ?? 0.6, R = ctx.radius ?? 0.13, out = [], body = M('fueltank', 'milPaint', ctx.paint);
  // (a cylinder along x, below the anchor: the anchor is the frame rail's side, the tank hung out from it)
  out.push(...tube([[-L / 2, R + 0.03, -R], [L / 2, R + 0.03, -R]], R, { sides: 16, look: body }));
  for (const x of [-L / 2 + 0.1, L / 2 - 0.1]) {
    const ring = Array.from({ length: 17 }, (_, k) => { const a = Math.PI * (k / 16) - Math.PI; return [x, R + 0.03 + (R + 0.006) * Math.cos(a + Math.PI / 2), -R + (R + 0.006) * Math.sin(a + Math.PI / 2)]; });
    out.push(...tube(ring, 0.008, { sides: 6, look: M('fueltank.strap', 'steel', C.steel) }));
    out.push(...plate({ axis: 'x', profile: rect(0, R + 0.03, -2 * R - 0.02, -2 * R), from: x - 0.02, to: x + 0.02, look: M('fueltank.cradle', 'milPaint', ctx.paint) }));
  }
  out.push(...tube([[L / 2 - 0.12, R + 0.03, -0.005], [L / 2 - 0.12, R + 0.03, 0.05]], 0.035, { sides: 10, look: body }));
  out.push(...tube([[L / 2 - 0.12, R + 0.03, 0.05], [L / 2 - 0.12, R + 0.03, 0.07]], 0.042, { sides: 10, look: M('fueltank.cap', 'steel', C.steel) }));
  return onAnchor(A, out);
}

function shackle(A) {
  const look = M('shackle', 'milPaint', C.red), out = [];
  out.push(...plate({ axis: 'z', profile: rect(-0.022, 0.022, 0, 0.06), from: -0.04, to: 0.04, r: 0.006, seg: 1, look: M('shackle.tab', 'steel', C.steel) }));
  out.push(...tube(bend([[-0.045, 0.035, 0.0], [-0.045, 0.09, -0.06], [0.045, 0.09, -0.06], [0.045, 0.035, 0.0]], 0.04, 4), 0.014, { sides: 8, look }));
  out.push(...tube([[-0.062, 0.035, 0], [0.062, 0.035, 0]], 0.011, { sides: 8, look }));
  return onAnchor(A, out);
}

function pintle(A) {
  const steel = M('pintle', 'steel', C.steel), out = [];
  out.push(...plate({ axis: 'y', profile: rect(-0.07, 0.07, -0.06, 0.06), from: 0, to: 0.07, r: 0.008, seg: 1, look: steel }));
  out.push(...tube(bend([[0, 0.07, -0.01], [0, 0.17, -0.01], [0, 0.19, 0.06], [0, 0.15, 0.1]], 0.03, 3), 0.019, { sides: 10, look: steel }));
  out.push(...plate({ axis: 'x', profile: rect(0.07, 0.15, 0.03, 0.05), from: -0.012, to: 0.012, r: 0.003, seg: 1, look: M('pintle.latch', 'milPaint', C.red) }));
  out.push(...bolts([[-0.045, 0, -0.035], [0.045, 0, -0.035], [0.045, 0, 0.035], [-0.045, 0, 0.035]], [0, 1, 0], { r: 0.011, h: 0.012, look: steel }));
  return onAnchor(A, out);
}

function antenna(A, ctx) {
  const steel = M('antenna', 'steel', C.steel), out = [];
  out.push(...plate({ axis: 'y', profile: rect(-0.05, 0.05, -0.06, 0.06), from: 0, to: 0.015, r: 0.004, seg: 1, look: M('antenna.bracket', 'milPaint', ctx.paint) }));
  out.push(...plate({ axis: 'z', profile: rect(-0.04, 0.04, 0.015, 0.07), from: 0.04, to: 0.055, r: 0.004, seg: 1, look: M('antenna.bracket', 'milPaint', ctx.paint) }));
  out.push(...tube([[0, 0.045, 0.055], [0, 0.045, 0.15]], 0.028, { sides: 10, look: steel }));
  out.push(...tube([[0, 0.045, 0.15], [0, 0.045, 0.24]], 0.016, { sides: 8, look: M('antenna.spring', 'rubber', C.rubber) }));
  // the whip, leaning back, a ball at its tip
  const tip = [-0.28 * (ctx.lean ?? 1), 0.045, 0.24 + (ctx.whip ?? 1.5)];
  out.push(...tube([[0, 0.045, 0.24], tip], 0.004, { sides: 5, look: steel }));
  out.push(...tube([add(tip, [0, 0, -0.008]), add(tip, [0, 0, 0.008])], 0.009, { sides: 6, look: steel }));
  return onAnchor(A, out);
}

function grabHandle(A, ctx) {
  const look = M('grab', 'milPaint', ctx.paint), w = (ctx.width ?? 0.26) / 2, out = [];
  out.push(...tube(bend([[-w, 0, 0], [-w, 0.05, 0], [w, 0.05, 0], [w, 0, 0]], 0.022, 3), 0.012, { sides: 8, look }));
  for (const x of [-w, w]) out.push(...plate({ axis: 'y', profile: disc(x, 0, 0.022, 8), from: 0, to: 0.008, look }));
  return onAnchor(A, out);
}

function step(A, ctx) {
  const tread = M('step', 'steel', C.tread), out = [];
  out.push(...plate({ axis: 'z', profile: rect(-0.16, 0.16, 0, 0.13), from: -0.012, to: 0.012, r: 0.004, seg: 1, look: tread }));
  // (holed against the mud: dark pits in the plate's top)
  for (const x of [-0.1, 0, 0.1]) for (const y of [0.04, 0.09]) out.push(...plate({ axis: 'z', profile: disc(x, y, 0.014, 8), from: 0.0125, to: 0.0135, look: M('step.hole', 'carbon', C.rubber) }));
  for (const x of [-0.12, 0.12]) out.push(...tube([[x, 0.1, -0.012], [x, 0.0, 0.08 * (ctx.drop ?? 1)]], 0.012, { sides: 6, look: M('step.bracket', 'milPaint', ctx.paint) }));
  return onAnchor(A, out);
}

function mudFlap(A, ctx) {
  const out = [];
  out.push(...plate({ axis: 'y', profile: rect(-0.17, 0.17, -(ctx.drop ?? 0.36), 0), from: 0, to: 0.008, r: 0.003, seg: 1, look: M('mudflap', 'rubber', C.rubber) }));
  out.push(...plate({ axis: 'y', profile: rect(-0.18, 0.18, -0.04, 0.01), from: 0.008, to: 0.016, r: 0.003, seg: 1, look: M('mudflap.bar', 'milPaint', ctx.paint) }));
  out.push(...bolts([[-0.12, 0.016, -0.015], [0, 0.016, -0.015], [0.12, 0.016, -0.015]], [0, 1, 0], { r: 0.008, h: 0.005, look: M('bolt', 'steel', C.steel) }));
  return onAnchor(A, out);
}

function mirror(A, ctx) {
  const look = M('mirror', 'milPaint', ctx.paint), out = [];
  out.push(...tube(bend([[0, 0, 0], [0, 0.11, 0.02], [0, 0.17, 0.08]], 0.03, 3), 0.009, { sides: 6, look }));
  out.push(...plate({ axis: 'x', profile: disc(0.17, 0.15, 0.075, 14), from: -0.01, to: 0.015, r: 0.004, seg: 1, look }));
  out.push(...plate({ axis: 'x', profile: disc(0.17, 0.15, 0.065, 14), from: -0.014, to: -0.01, look: M('mirror.glass', 'glass', C.glass) }));
  return onAnchor(A, out);
}

function stowageBox(A, ctx) {
  const W = ctx.width ?? 0.7, D = ctx.depth ?? 0.34, H = ctx.height ?? 0.38, look = M('stowage', 'milPaint', ctx.paint), out = [];
  // (hung out from its mount, below it: a box, its lid a plate proud of it, two latches, a handle each end)
  out.push(...plate({ axis: 'z', profile: rect(-W / 2, W / 2, 0.02, 0.02 + D), from: -H, to: -0.06, r: 0.015, seg: 2, look }));
  out.push(...plate({ axis: 'z', profile: rect(-W / 2 - 0.01, W / 2 + 0.01, 0.01, 0.03 + D), from: -0.06, to: -0.02, r: 0.012, seg: 1, look: M('stowage.lid', 'milPaint', ctx.paint) }));
  for (const x of [-W / 4, W / 4]) out.push(...plate({ axis: 'y', profile: rect(x - 0.03, x + 0.03, -0.16, -0.05), from: 0.02 + D, to: 0.03 + D, r: 0.004, seg: 1, look: M('stowage.latch', 'steel', C.steel) }));
  for (const s of [-1, 1]) out.push(...tube(bend([[s * W / 2, 0.08, -0.12], [s * (W / 2 + 0.035), 0.08, -0.12], [s * (W / 2 + 0.035), D - 0.06, -0.12], [s * W / 2, D - 0.06, -0.12]], 0.015, 2), 0.009, { sides: 6, look }));
  // (its brackets up to the mount)
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) out.push(...plate({ axis: 'x', profile: rect(0, 0.05, -0.08, 0.02), from: x - 0.02, to: x + 0.02, look: M('stowage.bracket', 'milPaint', ctx.paint) }));
  return onAnchor(A, out);
}

function tarpRoll(A, ctx) {
  const w = (ctx.width ?? 1.1) / 2, R = 0.085, out = [];
  out.push(...tube([[-w, R + 0.005, 0], [w, R + 0.005, 0]], R, { sides: 14, look: M('tarp', 'canvas', C.canvas) }));
  for (const x of [-w * 0.6, w * 0.6]) {
    out.push(...tube(Array.from({ length: 15 }, (_, k) => { const a = (2 * Math.PI * k) / 14; return [x, R + 0.005 + (R + 0.004) * Math.cos(a), (R + 0.004) * Math.sin(a)]; }), 0.005, { sides: 5, caps: false, look: M('tarp.strap', 'canvas', C.webbing) }));
    out.push(...plate({ axis: 'x', profile: rect(2 * R - 0.005, 2 * R + 0.012, -0.02, 0.02), from: x - 0.022, to: x + 0.022, r: 0.002, seg: 1, look: M('tarp.buckle', 'steel', C.steel) }));
  }
  return onAnchor(A, out);
}

export const FITTINGS = Object.freeze({
  spareWheel: { reads: 'the vehicle\'s own wheel on a carrier', fits: ['panel', 'bonnet'], build: spareWheel },
  jerryCans: { reads: 'jerry cans in a rack, strapped', fits: ['panel', 'flank'], build: jerryCans },
  pioneerTools: { reads: 'a shovel and an axe in their clips', fits: ['flank'], build: pioneerTools },
  fuelTank: { reads: 'a saddle fuel tank on its cradle, strapped', fits: ['rail'], build: fuelTank },
  shackle: { reads: 'a D-ring through its tab', fits: ['bumper'], build: shackle },
  pintle: { reads: 'the towing hook on its block', fits: ['bumper'], build: pintle },
  antenna: { reads: 'a whip on a sprung base', fits: ['flank', 'panel'], build: antenna },
  grabHandle: { reads: 'a bent grab bar', fits: ['flank', 'panel'], build: grabHandle },
  step: { reads: 'a holed tread plate under a doorway', fits: ['sill'], build: step },
  mudFlap: { reads: 'a rubber flap behind a wheel', fits: ['flap'], build: mudFlap },
  mirror: { reads: 'a round mirror on its arm', fits: ['post'], build: mirror },
  tarpRoll: { reads: 'a rolled tarp, strapped', fits: ['top'], build: tarpRoll },
  stowageBox: { reads: 'a stowage box, its lid latched', fits: ['rail', 'flank'], build: stowageBox },
});

/** A card's fitting on an anchor. */
export function fit(anchor, card, ctx) {
  const F = FITTINGS[card];
  if (!F) throw new Error(`mil-fittings: '${card}' is not a fitting (${Object.keys(FITTINGS).join(', ')})`);
  if (!F.fits.includes(anchor.kind)) throw new Error(`mil-fittings: a ${card} fits a ${F.fits.join(' or ')}, not the ${anchor.kind} '${anchor.id}'`);
  return F.build(anchor, ctx);
}
