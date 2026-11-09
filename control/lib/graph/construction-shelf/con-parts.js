/**
 * con-parts — a builder per kind of part (con-odm.js CON_KINDS), each drawing its part in ITS BODY's frame: the root
 * (the undercarriage) in the machine's, the upper about the slew axis at its deck, a body on the chain about its pivot
 * along +y. A part's hardpoints are where its children, its rams and its links meet it, in that frame.
 *
 *   builder(row, C, ctx) → { lathes?, sweeps?, extrudes?, lofts?, hardpoints, joints? }
 *     C      the palette's six colours
 *     ctx    { physics (its machine's class: roads/vehicles.js), machine }
 *
 * A ram's barrel and its rod, and a link, are each drawn along +y from their own first pin, at their own length: the
 * chain (con-chain.js) aims them between their pins at every pose, so the rod slides in the barrel without being drawn
 * again. Pure: no clock, no dice. A part's emission for its row is a compatibility promise (construction-shelf.char.test.js).
 */
import { pinsAlong, trackPath } from '../car-designer/mil-track.js';
import { add, box, extrudeWorld, loftWorld, mul, panel as rawPanel, roundRect, spin, sub, tone, tube, unit } from './con-common.js';
import { bellcrank, liftArms, loaderBucket, loaderFront, loaderRear, skidChassis, wheel } from './con-wheeled.js';
import { backhoeChassis, boomSection, canopyCab, carriage, forkChassis, houseMini, mastChannel, stabLeg, swingFrame, swingPost, teleChassis, wheeledExChassis } from './con-handlers.js';
import { auger, breaker, forks, grapple, sweeper } from './con-tools.js';
import { adtFront, adtRear, haulFrame, mixerDrum, tipBody, truckCab, truckChassis } from './con-haulers.js';
import { ramParts } from './con-chain.js';
import { drawbar, graderCircle, graderFront, graderRear, graderSaddle, moldboard, rollerDrum, rollerFront, rollerRear } from './con-finishers.js';
import { counterJib, counterSlabs, craneCarrier, craneHouse, hookBlock, jibLattice, mastSection, outriggerBeam, outriggerJack, ropeFalls, slewingUnit, towerBase, towerHead, trolley } from './con-lifters.js';

const X = [1, 0, 0];
/** A pin's boss across x at a point, `r` round, from x0 to x1 (a bushing, an eye). */
const boss = (id, p, x0, x1, r, tint) => spin(id, [x0, p[1], p[2]], [x1, p[1], p[2]], [[0, r], [1, r]], tint, 16);
// (an outline wound anticlockwise about the way it is extruded: the extruder's normals assume it, so a left side's
// panel, extruded toward −x, takes its outline reversed)
const area = (o) => o.reduce((s, p, i) => { const q = o[(i + 1) % o.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const wound = (o, sign) => (area(o) * sign < 0 ? o.slice().reverse() : o);
/** A flat panel square to x from x0 to x1, its outline [[y, z]…], wound to face out whichever way it is extruded. */
const panel = (id, x0, x1, outline, tint) => rawPanel(id, x0, x1, wound(outline, Math.sign(x1 - x0) || 1), tint);
/** A plan-shaped slab: its outline [[x, y]…] round its centroid, from z0 up to z1. */
function plan(id, z0, z1, raw, tint) {
  const outline = wound(raw, Math.sign(z1 - z0) || 1);
  const xc = outline.reduce((s, p) => s + p[0], 0) / outline.length, yc = outline.reduce((s, p) => s + p[1], 0) / outline.length;
  return extrudeWorld(id, [xc, yc, z0], [xc, yc, z1], outline.map(([x, y]) => [x - xc, y - yc, 0]), tint);
}
/** A box beam from a to b, its section `w` across x and `h` square to it in the (y, z) plane, tapering to w1 × h1. */
function beam(id, a, b, w, h, w1, h1, tint, r = 0.05) {
  const ax = sub(b, a);
  return loftWorld(id, a, b, [{ t: 0, points: roundRect(ax, w, h, r, 2) }, { t: 1, points: roundRect(ax, w1, h1, r, 2) }], tint);
}

// ── the crawler undercarriage ─────────────────────────────────────────────────
function undercarriage(row, C, { physics }) {
  const d = row.dims, gauge = physics.track, half = physics.wheelbase / 2, lathes = [], extrudes = [], sweeps = [];
  // (a rubber track is a belt: its segments the rubber's, its lugs moulded on, no rails)
  const rubber = row.build.family === 'rubber';
  const steel = rubber ? C.rubber : C.trim, link = tone(C.trim, 0.12), shine = tone(C.trim, 0.3);
  const inner = d.rail + d.plate + d.grouser;   // (the inner line, where the rollers ride, over the ground)
  const sprocket = { y: -half, z: d.sprocket.z, r: d.sprocket.r }, idler = { y: half, z: d.idler.z, r: d.idler.r };
  const rollers = Array.from({ length: d.roller.n }, (_, k) => ({ y: -half + 0.42 + ((2 * half - 0.84) * k) / (d.roller.n - 1), z: inner + d.roller.r, r: d.roller.r }));
  const carriers = Array.from({ length: d.carrier.n }, (_, k) => ({ y: half * (k ? -0.4 : 0.4), z: 0.79, r: d.carrier.r }));
  const path = trackPath({ sprocket, idler, wheels: rollers, rollers: carriers, sag: 0.025 }), pins = pinsAlong(path, d.pitch);
  for (const [side, s] of [['r', 1], ['l', -1]]) {
    const x = s * gauge / 2;
    // the track: each link a pair of rails, its shoe and its grouser, laid on the chord between two pins (out of the
    // anticlockwise loop is (dz, −dy))
    pins.forEach((p, k) => {
      const q = pins[(k + 1) % pins.length], a = [x, p[0], p[1]], b = [x, q[0], q[1]], t = unit(sub(b, a)), n = [0, t[2], -t[1]];
      const off = (v, o) => add(v, mul(n, o)), mid = mul(add(a, b), 0.5);
      if (d.rail) for (const rx of [-0.1, 0.1]) extrudes.push(box(`rail_${side}${k}_${rx > 0 ? 'o' : 'i'}`, off(add(a, [rx, 0, 0]), -inner + d.rail / 2), off(add(b, [rx, 0, 0]), -inner + d.rail / 2), 0.055, d.rail, link, n));
      extrudes.push(box(`shoe_${side}${k}`, off(a, -d.grouser - d.plate / 2), off(b, -d.grouser - d.plate / 2), d.shoe, d.plate, steel, n));
      if (!rubber || k % 2 === 0) extrudes.push(box(`grouser_${side}${k}`, off(sub(mid, mul(t, 0.022)), -d.grouser / 2), off(add(mid, mul(t, 0.022)), -d.grouser / 2), d.shoe * (rubber ? 0.8 : 1), d.grouser, steel, n));
    });
    // the sprocket (its teeth round its rim), the idler (its flanges), the rollers under the frame and the carriers over
    lathes.push(spin(`sprocket_${side}`, [x - 0.16, sprocket.y, sprocket.z], [x + 0.16, sprocket.y, sprocket.z], [[0, 0.22], [0.25, 0.3], [0.38, sprocket.r - 0.04], [0.62, sprocket.r - 0.04], [0.75, 0.3], [1, 0.26]], steel, 24));
    for (let k = 0; k < row.build.teeth; k++) {
      const a = (2 * Math.PI * k) / row.build.teeth, c = [x, sprocket.y + (sprocket.r - 0.01) * Math.cos(a), sprocket.z + (sprocket.r - 0.01) * Math.sin(a)], u = [0, Math.cos(a), Math.sin(a)];
      extrudes.push(box(`tooth_${side}${k}`, sub(c, mul(u, 0.04)), add(c, mul(u, 0.045)), 0.07, 0.06, shine, [0, -Math.sin(a), Math.cos(a)]));
    }
    lathes.push(spin(`idler_${side}`, [x - 0.15, idler.y, idler.z], [x + 0.15, idler.y, idler.z], [[0, idler.r - 0.03], [0.18, idler.r], [0.32, idler.r], [0.4, idler.r - 0.05], [0.6, idler.r - 0.05], [0.68, idler.r], [0.82, idler.r], [1, idler.r - 0.03]], steel, 24));
    rollers.forEach((w, k) => lathes.push(spin(`roller_${side}${k}`, [x - 0.14, w.y, w.z], [x + 0.14, w.y, w.z], [[0, w.r], [0.18, w.r], [0.22, w.r * 0.78], [0.78, w.r * 0.78], [0.82, w.r], [1, w.r]], shine, 16)));
    carriers.forEach((w, k) => lathes.push(spin(`carrier_${side}${k}`, [x - 0.1, w.y, w.z], [x + 0.1, w.y, w.z], [[0, w.r], [1, w.r]], shine, 14)));
    // the track frame inside the loop, its idler's yoke forward, the sprocket's final drive aft, a guard over the rollers
    extrudes.push(box(`frame_${side}`, [x, -half + 0.32, 0.54], [x, half - 0.25, 0.54], d.frameW, 0.36, steel));
    extrudes.push(box(`yoke_${side}`, [x, half - 0.3, idler.z], [x, half + 0.02, idler.z], d.frameW * 0.8, 0.2, steel));
    lathes.push(spin(`drive_${side}`, [x - s * 0.45, sprocket.y, sprocket.z], [x - s * 0.16, sprocket.y, sprocket.z], [[0, 0.2], [0.6, 0.24], [1, 0.24]], tone(steel, 0.18), 18));
    extrudes.push(panel(`guard_${side}`, x - s * 0.17, x - s * 0.15, [[-half + 0.3, 0.3], [half - 0.3, 0.3], [half - 0.3, 0.46], [-half + 0.3, 0.46]], steel));
  }
  // the car body between the frames, its legs to each, the slewing ring's seat on top
  const B = d.body;
  extrudes.push(box('carbody', [0, -B.l / 2, (B.z0 + B.z1) / 2], [0, B.l / 2, (B.z0 + B.z1) / 2], B.w, B.z1 - B.z0, C.trim));
  for (const s of [1, -1]) extrudes.push(box(`leg_${s > 0 ? 'r' : 'l'}`, [s * B.w / 2 - s * 0.05, 0, 0.62], [s * (gauge / 2 - d.frameW / 2), 0, 0.62], 0.9, 0.26, C.trim, [0, 0, 1]));
  // (an upper that slews sits on its ring's seat; a dozer's hull is fixed, its blade's push arms on the frames' trunnions)
  if (row.build.seat !== false) lathes.push(spin('seat', [0, 0, B.z1 - 0.02], [0, 0, d.slewZ - 0.1], [[0, 0.7], [1, 0.66]], tone(C.trim, 0.1), 28));
  const T = d.trunnion;
  // (a dozer's push arms pivot outside its tracks; a mini's blade arms inside them, at their own x)
  if (T) for (const s of [1, -1]) lathes.push(d.trunnionX ? boss(`trunnion_${s > 0 ? 'r' : 'l'}`, [0, T[0], T[1]], s * (d.trunnionX - 0.07), s * (d.trunnionX + 0.07), 0.06, tone(C.trim, 0.2))
    : boss(`trunnion_${s > 0 ? 'r' : 'l'}`, [0, T[0], T[1]], s * (gauge / 2 + d.frameW / 2 - 0.02), s * (gauge / 2 + d.frameW / 2 + 0.12), 0.11, tone(C.trim, 0.2)));
  const Br = d.bladeRam;
  return { lathes, extrudes, sweeps, hardpoints: { slew: [0, 0, d.slewZ - 0.1], ground: [0, 0, 0], ...(T ? { trunnion: [0, T[0], T[1]] } : {}), ...(Br ? { 'bladeRam.r': Br, 'bladeRam.l': [-Br[0], Br[1], Br[2]] } : {}) } };
}

// ── the slewing ring ────────────────────────────────────────────────────────
function slew(row, C) {
  const d = row.dims;
  return { lathes: [spin('ring', [0, 0, 0], [0, 0, d.h], [[0, d.r], [0.45, d.r + 0.02], [0.55, d.r + 0.02], [1, d.r - 0.03]], tone(C.trim, 0.25), 32)], hardpoints: { top: [0, 0, d.h] } };
}

// ── the upper: its deck, its engine's hood, its tank and tool box, the boom's foot ─────────────────────────────
function house(row, C, ctx) {
  if (row.build.family === 'dozer') return hullDozer(row, C, ctx);
  if (row.build.family === 'mini') return houseMini(row, C, ctx);
  if (row.build.family === 'crane') return craneHouse(row, C, ctx);
  if (row.build.family === 'tower') return slewingUnit(row, C, ctx);
  return houseExcavator(row, C);
}
function houseExcavator(row, C) {
  const d = row.dims, w = d.w, lathes = [], extrudes = [], sweeps = [];
  const body = C.paint, dark = C.trim;
  // the revolving frame (its deck), the engine's hood behind the cab, the tank and the valve bay ahead of it
  extrudes.push(plan('deck', 0, d.deck, [[-w / 2, d.back], [w / 2, d.back], [w / 2, d.front - 0.05], [0.4, d.front], [-w / 2, d.front - 0.1]], dark));
  extrudes.push(plan('hood', d.deck, d.hood, [[-w / 2 + 0.02, d.back], [w / 2 - 0.02, d.back], [w / 2 - 0.02, -0.55], [-w / 2 + 0.02, -0.55]], body));
  extrudes.push(plan('hood_top', d.hood, d.hood + 0.06, [[-w / 2 + 0.1, d.back + 0.06], [w / 2 - 0.1, d.back + 0.06], [w / 2 - 0.1, -0.62], [-w / 2 + 0.1, -0.62]], tone(body, -0.06)));
  extrudes.push(plan('tank', d.deck, 0.98, [[0.5, -0.55], [w / 2 - 0.02, -0.55], [w / 2 - 0.02, d.front - 0.1], [0.5, d.front - 0.1]], body));
  // (the louvres of the engine's side doors, the stack through the hood, the handrails along the tank's top)
  for (let k = 0; k < 6; k++) for (const s of [1, -1]) extrudes.push(box(`louvre_${s > 0 ? 'r' : 'l'}${k}`, [s * (w / 2 - 0.005), d.back + 0.35 + k * 0.13, 0.62], [s * (w / 2 + 0.005), d.back + 0.35 + k * 0.13, 0.62], 0.05, 0.5, tone(body, -0.25), [0, 0, 1]));
  lathes.push(spin('stack', [0.75, -1.25, d.hood], [0.75, -1.25, d.hood + 0.42], [[0, 0.07], [0.9, 0.065], [1, 0.075]], tone(dark, 0.2), 14));
  sweeps.push(tube('rail_tank', [[0.56, d.front - 0.18, 0.98], [0.56, d.front - 0.18, 1.25], [0.56, -0.48, 1.25], [0.56, -0.48, 0.98]], 0.018, C.light, 8));
  sweeps.push(tube('rail_hood', [[w / 2 - 0.1, -0.5, d.hood + 0.06], [w / 2 - 0.1, -0.5, d.hood + 0.35], [w / 2 - 0.1, d.back + 0.25, d.hood + 0.35], [w / 2 - 0.1, d.back + 0.25, d.hood + 0.06]], 0.018, C.light, 8));
  // the boom's foot: two plates either side of it, its pin's bosses through them; the boom rams' bases below and ahead
  const F = d.foot, B = d.ramBase;
  for (const s of [1, -1]) {
    extrudes.push(panel(`foot_${s > 0 ? 'r' : 'l'}`, s * 0.27, s * 0.31, [[-0.2, d.deck], [0.55, d.deck], [0.55, F[2] - 0.2], [F[1] + 0.1, F[2] + 0.22], [F[1] - 0.3, F[2] + 0.2], [-0.2, 0.55]], dark));
    lathes.push(boss(`foot_boss_${s > 0 ? 'r' : 'l'}`, F, s * 0.25, s * 0.34, 0.11, tone(dark, 0.2)));
    extrudes.push(panel(`ram_lug_${s > 0 ? 'r' : 'l'}`, s * (B[0] - 0.08), s * (B[0] + 0.08), [[B[1] - 0.2, d.deck], [B[1] + 0.2, d.deck], [B[1] + 0.08, B[2] + 0.1], [B[1] - 0.08, B[2] + 0.1]], dark));
  }
  return { lathes, extrudes, sweeps, hardpoints: { boomFoot: F, 'boomRam.r': B, 'boomRam.l': [-B[0], B[1], B[2]], cab: [-0.72, 0.45, d.deck], counterweight: [0, d.back, d.deck] } };
}

// ── a dozer's hull, fixed on its tracks: the mainframe, the engine's hood forward and its grille, the tank aft, the
// lift rams' towers either side of the hood, the ripper's mount at the tail ──────────────────────────────────────
function hullDozer(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], sweeps = [], lofts = [], body = C.paint, dark = C.trim;
  const half = physics.track / 2, z0 = d.deck;
  // the mainframe between the tracks and over them, the fenders
  extrudes.push(plan('frame', 0.62, z0, [[-half + 0.18, d.tail], [half - 0.18, d.tail], [half - 0.18, d.nose], [-half + 0.18, d.nose]], dark));
  extrudes.push(plan('fenders', z0, z0 + 0.06, [[-half - 0.3, d.tail + 0.1], [half + 0.3, d.tail + 0.1], [half + 0.3, d.nose - 0.25], [-half - 0.3, d.nose - 0.25]], body));
  // the engine's hood, narrowing to its grille, and its top
  const H = d.hood;
  lofts.push(loftWorld('hood', [0, H.from, z0], [0, H.to, z0], [{ t: 0, points: roundRect([0, 1, 0], H.w, 2 * (H.h), 0.06, 2).map((p) => add(p, [0, 0, 0])) }, { t: 1, points: roundRect([0, 1, 0], H.w * 0.86, 2 * (H.h - 0.12), 0.06, 2) }], body));
  extrudes.push(box('grille', [0, H.to - 0.02, z0 + H.h / 2 - 0.08], [0, H.to + 0.03, z0 + H.h / 2 - 0.08], H.w * 0.72, H.h - 0.3, dark));
  lathes.push(spin('stack', [0.3, H.from + 0.5, z0 + H.h], [0.3, H.from + 0.5, z0 + H.h + 0.55], [[0, 0.07], [0.9, 0.065], [1, 0.075]], tone(dark, 0.2), 14));
  // the lift rams' towers either side of the hood, their pins
  const L = d.liftRam;
  for (const s of [1, -1]) {
    extrudes.push(panel(`tower_${s > 0 ? 'r' : 'l'}`, s * (L[0] - 0.08), s * (L[0] + 0.08), [[L[1] - 0.45, z0], [L[1] + 0.35, z0], [L[1] + 0.12, L[2] + 0.12], [L[1] - 0.12, L[2] + 0.12]], body));
    lathes.push(boss(`tower_pin_${s > 0 ? 'r' : 'l'}`, L, s * (L[0] - 0.1), s * (L[0] + 0.1), 0.07, tone(dark, 0.2)));
  }
  // the tank aft of the cab, the ripper's mount and its ram's bracket at the tail
  extrudes.push(plan('tank', z0, z0 + 0.75, [[-half + 0.1, d.tail], [half - 0.1, d.tail], [half - 0.1, d.tail + 0.45], [-half + 0.1, d.tail + 0.45]], body));
  const Rp = d.ripper, Rr = d.ripRam;
  extrudes.push(panel('ripper_mount', -0.45, 0.45, [[d.tail + 0.05, 0.5], [d.tail + 0.05, z0 + 0.1], [Rp[1] - 0.1, Rp[2] + 0.2], [Rp[1] - 0.12, Rp[2] - 0.2]], dark));
  extrudes.push(panel('rip_ram_lug', -0.08, 0.08, [[d.tail + 0.05, z0 + 0.6], [d.tail + 0.05, z0 + 0.75], [Rr[1] - 0.08, Rr[2] + 0.1], [Rr[1] - 0.1, Rr[2] - 0.1]], dark));
  lathes.push(boss('rip_ram_pin', Rr, -0.1, 0.1, 0.07, tone(dark, 0.2)));
  // the grab rails up to the cab
  for (const s of [1, -1]) sweeps.push(tube(`rail_${s > 0 ? 'r' : 'l'}`, [[s * (half + 0.2), d.tail + 0.7, z0 + 0.06], [s * (half + 0.2), d.tail + 0.7, z0 + 0.9], [s * (half + 0.2), d.cab[1] + 0.2, z0 + 0.9]], 0.018, C.light, 8));
  return { lathes, extrudes, sweeps, lofts, hardpoints: { cab: d.cab, 'liftRam.r': L, 'liftRam.l': [-L[0], L[1], L[2]], ripper: Rp, ripRam: Rr } };
}

// ── a dozer's blade on its push arms (one body: the C-frame and the moldboard), about the trunnions ──────────────
function blade(row, C, ctx) {
  // (a grader's moldboard, on its saddle under its circle)
  if (row.build.family === 'moldboard') return moldboard(row, C, ctx);
  const { physics } = ctx, d = row.dims, P = d.profile, w = d.width, extrudes = [], lathes = [], lofts = [], body = C.paint, steel = tone(C.trim, 0.2);
  const ax = physics.track / 2 + d.arm;   // (the push arms outside the tracks)
  // the moldboard: its curved face across the blade, each span a strip, its end bits, its cutting edge
  for (let i = 0; i + 1 < P.length; i++) {
    const A = [0, P[i][0], P[i][1]], B = [0, P[i + 1][0], P[i + 1][1]], t = unit(sub(B, A)), n = [0, t[2], -t[1]];
    extrudes.push(box(`face_${i}`, add(sub(A, mul(t, 0.01)), mul(n, 0.02)), add(add(B, mul(t, 0.01)), mul(n, 0.02)), w - 0.04, 0.04, body, n));
  }
  const back = d.back;
  for (const s of [1, -1]) extrudes.push(panel(`end_${s > 0 ? 'r' : 'l'}`, s * (w / 2 - 0.04), s * (w / 2), [...P, [back, P[P.length - 1][1] - 0.1], [back, P[0][1] + 0.15]], body));
  extrudes.push(box('back', [0, back + 0.04, P[0][1] + 0.2], [0, back + 0.04, P[P.length - 1][1] - 0.15], w - 0.2, 0.08, body, [0, 1, 0]));
  extrudes.push(box('edge', [-w / 2 + 0.03, P[0][0], P[0][1] + 0.04], [w / 2 - 0.03, P[0][0], P[0][1] + 0.04], 0.07, 0.09, steel, [0, 0, 1]));
  // the push arms from the trunnions to the blade's back, their braces
  for (const s of [1, -1]) {
    lofts.push(beam(`arm_${s > 0 ? 'r' : 'l'}`, [s * ax, 0, 0], [s * ax, back - 0.05, d.armZ], 0.16, 0.26, 0.16, 0.3, body, 0.03));
    lathes.push(boss(`arm_pin_${s > 0 ? 'r' : 'l'}`, [0, 0, 0], s * (ax - 0.1), s * (ax + 0.1), 0.13, tone(body, -0.15)));
  }
  const brace = [[ax, back - 0.6, d.armZ + 0.05], [-ax * 0.2, back - 0.05, P[P.length - 1][1] - 0.25]];
  lofts.push(beam('brace', brace[0], brace[1], 0.1, 0.1, 0.1, 0.1, steel, 0.02));
  // the lift rams' eyes on the blade's back, their lugs
  const E = d.ramEye;
  for (const s of [1, -1]) {
    extrudes.push(panel(`eye_lug_${s > 0 ? 'r' : 'l'}`, s * (E[0] - 0.07), s * (E[0] + 0.07), [[back, E[2] - 0.15], [back, E[2] + 0.15], [E[1] - 0.06, E[2] + 0.08], [E[1] - 0.06, E[2] - 0.08]], body));
    lathes.push(boss(`eye_${s > 0 ? 'r' : 'l'}`, [s * E[0], E[1], E[2]], s * (E[0] - 0.09), s * (E[0] + 0.09), 0.065, tone(C.trim, 0.2)));
  }
  return { extrudes, lathes, lofts, hardpoints: { pivot: [0, 0, 0], edge: [0, P[0][0], P[0][1]], 'ramEye.r': E, 'ramEye.l': [-E[0], E[1], E[2]] }, outline: [...P.flatMap(([y, z]) => [[-w / 2, y, z], [w / 2, y, z]])] };
}

// ── a radial ripper: its beam on its pin at the tail, its shank and its tooth ───────────────────────────────────
function ripper(row, C) {
  const d = row.dims, T = d.tip, extrudes = [], lathes = [], lofts = [], steel = tone(C.trim, 0.15), body = C.paint;
  lofts.push(beam('beam', [0, 0, 0], [0, d.beam, d.beamZ], d.beamW, 0.32, d.beamW, 0.28, body, 0.03));
  lathes.push(boss('pin', [0, 0, 0], -d.beamW / 2 - 0.05, d.beamW / 2 + 0.05, 0.1, tone(body, -0.15)));
  const S = [0, d.beam + 0.05, d.beamZ];
  lofts.push(beam('shank', S, T, 0.1, 0.36, 0.1, 0.22, steel, 0.02));
  lofts.push(loftWorld('tooth', T, add(T, [0, 0.12, -0.12]), [{ t: 0, points: roundRect([0, 0.12, -0.12], 0.1, 0.14, 0.01, 1) }, { t: 1, points: roundRect([0, 0.12, -0.12], 0.05, 0.03, 0.005, 1) }], tone(C.trim, 0.3)));
  const E = d.ramEye;
  extrudes.push(panel('eye_lug', -0.07, 0.07, [[E[1] - 0.15, d.beamZ * (E[1] / d.beam) + 0.1], [E[1] + 0.15, d.beamZ * ((E[1] + 0.15) / d.beam) + 0.1], [E[1] + 0.05, E[2] + 0.08], [E[1] - 0.05, E[2] + 0.08]], body));
  lathes.push(boss('eye', E, -0.08, 0.08, 0.06, tone(C.trim, 0.2)));
  return { extrudes, lathes, lofts, hardpoints: { pin: [0, 0, 0], tip: add(T, [0, 0.12, -0.12]), ramEye: E } };
}

// ── the cab: its frame, its glass, the door, the roof's guard, its lamps ──────────────────────────────────────
function cab(row, C, ctx) {
  // (an open canopy over the seat: a mini excavator's, a roller's)
  if (row.build.family === 'canopy') return canopyCab(row, C, ctx);
  if (row.build.family === 'truck') return truckCab(row, C, ctx);
  const { w, l, h } = row.dims, extrudes = [], lathes = [], frame = tone(C.trim, 0.05), glass = C.glass;
  const y0 = -0.35, y1 = y0 + l;
  extrudes.push(plan('floor', 0, 0.08, [[-w / 2, y0], [w / 2, y0], [w / 2, y1], [-w / 2, y1]], frame));
  extrudes.push(plan('roof', h - 0.06, h, [[-w / 2 - 0.02, y0 - 0.02], [w / 2 + 0.02, y0 - 0.02], [w / 2 + 0.02, y1 - 0.12], [-w / 2 - 0.02, y1 - 0.12]], C.paint));
  // the posts (the front ones raked back with the screen)
  for (const s of [1, -1]) {
    extrudes.push(box(`post_back_${s > 0 ? 'r' : 'l'}`, [s * (w / 2 - 0.03), y0 + 0.03, 0.08], [s * (w / 2 - 0.03), y0 + 0.03, h - 0.06], 0.06, 0.06, frame, [0, 1, 0]));
    extrudes.push(box(`post_front_${s > 0 ? 'r' : 'l'}`, [s * (w / 2 - 0.03), y1 - 0.03, 0.08], [s * (w / 2 - 0.03), y1 - 0.14, h - 0.06], 0.06, 0.06, frame, [0, 1, 0]));
    extrudes.push(box(`sill_${s > 0 ? 'r' : 'l'}`, [s * (w / 2 - 0.03), y0, 0.5], [s * (w / 2 - 0.03), y1 - 0.06, 0.5], 0.06, 0.05, frame));
    // (the glass in its frame: a pane over the sill, the side's lower panel the cab's paint)
    extrudes.push(panel(`pane_${s > 0 ? 'r' : 'l'}`, s * (w / 2 - 0.02), s * (w / 2 - 0.035), [[y0 + 0.06, 0.53], [y1 - 0.08, 0.53], [y1 - 0.16, h - 0.1], [y0 + 0.06, h - 0.1]], glass));
    extrudes.push(panel(`lower_${s > 0 ? 'r' : 'l'}`, s * (w / 2 - 0.015), s * (w / 2 - 0.04), [[y0 + 0.06, 0.08], [y1 - 0.06, 0.08], [y1 - 0.06, 0.47], [y0 + 0.06, 0.47]], C.paint));
  }
  extrudes.push(extrudeWorld('screen', [-w / 2 + 0.05, y1 - 0.06, (h + 0.1) / 2], [w / 2 - 0.05, y1 - 0.06, (h + 0.1) / 2], [[0, -0.02, -(h - 0.2) / 2], [0, 0.065, -(h - 0.2) / 2], [0, -0.035, (h - 0.2) / 2], [0, -0.12, (h - 0.2) / 2]], glass));
  extrudes.push(plan('back', 0.08, h - 0.06, [[-w / 2 + 0.03, y0], [w / 2 - 0.03, y0], [w / 2 - 0.03, y0 + 0.04], [-w / 2 + 0.03, y0 + 0.04]], C.paint));
  // the door's handle and the step, the work lamps on the roof's front edge, the beacon
  extrudes.push(box('handle', [-w / 2 - 0.02, y0 + 0.4, 0.95], [-w / 2 - 0.02, y0 + 0.62, 0.95], 0.025, 0.025, C.chrome));
  for (const s of [1, -1]) lathes.push(spin(`lamp_${s > 0 ? 'r' : 'l'}`, [s * (w / 2 - 0.14), y1 - 0.14, h + 0.02], [s * (w / 2 - 0.14), y1 - 0.02, h + 0.02], [[0, 0.04], [0.7, 0.055], [1, 0.055]], C.light, 12));
  lathes.push(spin('beacon', [0, y0 + 0.2, h], [0, y0 + 0.2, h + 0.13], [[0, 0.06], [0.9, 0.055], [1, 0.03]], '#e8902a', 14));
  // the seat inside, under the operator's eye
  extrudes.push(box('seat', [0, y0 + 0.45, 0.42], [0, y0 + 0.9, 0.42], 0.5, 0.12, C.rubber));
  extrudes.push(box('seat_back', [0, y0 + 0.42, 0.45], [0, y0 + 0.5, 1.1], 0.48, 0.1, C.rubber, [0, 1, 0]));
  return { extrudes, lathes, hardpoints: { mount: [0, 0, 0], eye: [0, y0 + 0.78, 1.18], seat: [0, y0 + 0.7, 0.5] } };
}

// ── the counterweight: its tail an arc about the slew axis ─────────────────────────────────────────────────────
function counterweight(row, C) {
  if (row.build.family === 'slabs') return counterSlabs(row, C);
  const { w, h, tail } = row.dims, at = row.dims.at, ax = -at[1];   // (the slew axis, ahead of its front face)
  const arc = Array.from({ length: 13 }, (_, k) => { const x = w / 2 - (w * k) / 12; return [x, ax - Math.sqrt(tail * tail - x * x)]; });
  const top = Array.from({ length: 13 }, (_, k) => { const x = w / 2 - 0.05 - ((w - 0.1) * k) / 12; return [x, ax - Math.sqrt((tail - 0.05) ** 2 - x * x)]; });
  return {
    extrudes: [plan('weight', 0, h, [[-w / 2, 0], [w / 2, 0], ...arc], C.paint), plan('weight_top', h, h + 0.05, [[-w / 2 + 0.05, -0.02], [w / 2 - 0.05, -0.02], ...top], tone(C.paint, -0.08)),
      plan('stripe', 0.34, 0.42, [[-w / 2 - 0.004, -0.02], [w / 2 + 0.004, -0.02], ...arc.map(([x, y]) => [x * 1.002, y - 0.004])], C.trim)],
    hardpoints: { mount: [0, 0, 0] },
  };
}

// ── the boom: a box section bent at its knee (a banana), its foot's boss, its rams' eyes, its tip's ──────────
function boom(row, C) {
  const d = row.dims, K = [0, d.knee[0], d.knee[1]], T = [0, d.chord, 0], lofts = [], lathes = [], extrudes = [], sweeps = [];
  lofts.push(beam('foot_to_knee', [0, 0, 0], K, d.foot.w, d.foot.h, d.mid.w, d.mid.h, C.paint));
  lofts.push(beam('knee_to_tip', K, T, d.mid.w, d.mid.h, d.tip.w, d.tip.h, C.paint));
  lathes.push(boss('foot', [0, 0, 0], -0.25, 0.25, 0.17, tone(C.paint, -0.15)));
  lathes.push(boss('tip', T, -0.24, 0.24, 0.14, tone(C.paint, -0.15)));
  // the rams' eyes on its belly, either side (their pin through), and the stick ram's base on its back past the knee
  const E = d.ramEye, S = d.stickRam;
  for (const s of [1, -1]) {
    extrudes.push(panel(`eye_lug_${s > 0 ? 'r' : 'l'}`, s * (d.mid.w / 2 - 0.01), s * (E[0] + 0.05), [[E[1] - 0.22, E[2] + 0.2], [E[1] + 0.22, E[2] + 0.22], [E[1] + 0.1, E[2] - 0.05], [E[1] - 0.1, E[2] - 0.05]], tone(C.paint, -0.1)));
    lathes.push(boss(`eye_${s > 0 ? 'r' : 'l'}`, E, s * (d.mid.w / 2 - 0.02), s * (E[0] + 0.06), 0.07, tone(C.trim, 0.2)));
    extrudes.push(panel(`base_lug_${s > 0 ? 'r' : 'l'}`, s * 0.08, s * 0.13, [[S[1] - 0.25, S[2] - 0.45], [S[1] + 0.25, S[2] - 0.42], [S[1] + 0.08, S[2] + 0.09], [S[1] - 0.08, S[2] + 0.09]], tone(C.paint, -0.1)));
  }
  lathes.push(boss('base', S, -0.13, 0.13, 0.075, tone(C.trim, 0.2)));
  // the hoses along its back, from the foot to the stick's rams
  for (const s of [1, -1]) sweeps.push(tube(`hose_${s > 0 ? 'r' : 'l'}`, [[s * 0.14, 0.4, 0.42], [s * 0.14, K[1] - 0.2, K[2] + d.mid.h / 2 + 0.04], [s * 0.14, d.chord - 0.8, d.tip.h / 2 + 0.08]], 0.025, C.rubber, 8));
  return { lofts, lathes, extrudes, sweeps, hardpoints: { tip: T, 'ramEye.r': E, 'ramEye.l': [-E[0], E[1], E[2]], stickRam: S } };
}

// ── the stick: its heel above its pivot (the stick ram's eye), its tip (the bucket's pin), the linkage's pins ─────
function stick(row, C) {
  const d = row.dims, T = [0, d.length, 0], H = d.heel, lofts = [], lathes = [], extrudes = [];
  lofts.push(beam('stick', [0, H[1] + 0.12, H[2] - 0.2], [0, d.length - 0.08, 0.02], d.root.w, d.root.h, d.end.w, d.end.h, C.paint));
  lathes.push(boss('pivot', [0, 0, 0], -0.28, 0.28, 0.13, tone(C.paint, -0.15)));
  lathes.push(boss('heel', H, -0.12, 0.12, 0.09, tone(C.trim, 0.2)));
  lathes.push(boss('tip', T, -0.3, 0.3, 0.1, tone(C.paint, -0.15)));
  extrudes.push(panel('heel_plate', -0.12, 0.12, [[H[1] - 0.06, H[2] + 0.1], [H[1] + 0.32, 0.36], [0.2, -0.08], [H[1] + 0.04, H[2] - 0.12]], C.paint));
  const B = d.ramBase, Lk = d.link;
  extrudes.push(panel('base_lug', -0.07, 0.07, [[B[1] - 0.2, 0.2], [B[1] + 0.2, 0.2], [B[1] + 0.07, B[2] + 0.08], [B[1] - 0.07, B[2] + 0.08]], tone(C.paint, -0.1)));
  lathes.push(boss('base', B, -0.07, 0.07, 0.07, tone(C.trim, 0.2)));
  lathes.push(boss('link_pin', Lk, -Lk[0] - 0.03, Lk[0] + 0.03, 0.05, tone(C.trim, 0.25)));
  return { lofts, lathes, extrudes, hardpoints: { tip: T, ramEye: H, toolRam: B, link: [0, Lk[1], Lk[2]], 'link.r': Lk, 'link.l': [-Lk[0], Lk[1], Lk[2]] } };
}

// ── the bucket: its side plates, its wrapper round the back, its cutting edge and teeth, its ears ─────────────
function bucket(row, C, ctx) {
  // (a loader's or a skid steer's bucket is its own: a floor and a back, no teeth on a linkage of its own)
  if (row.build.family !== 'dig') return loaderBucket(row, C, ctx);
  const d = row.dims, P = d.profile, w = d.width, extrudes = [], lathes = [], lofts = [], steel = tone(C.trim, 0.05), wear = tone(C.trim, 0.25);
  for (const s of [1, -1]) extrudes.push(panel(`side_${s > 0 ? 'r' : 'l'}`, s * (w / 2 - 0.025), s * (w / 2), P, C.paint));
  // the wrapper: the plate round the back from the cutting edge to the top, each span a strip across the bucket (the
  // mouth, from the top lip to the cutting edge, open)
  for (let i = 2; i < P.length + 1; i++) {
    const a = P[i % P.length], b = P[(i + 1) % P.length];
    if ((i + 1) % P.length === 1) break;
    const A = [0, a[0], a[1]], B = [0, b[0], b[1]], t = unit(sub(B, A)), n = [0, t[2], -t[1]];
    extrudes.push(box(`wrap_${i}`, add(sub(A, mul(t, 0.01)), mul(n, -0.012)), add(add(B, mul(t, 0.01)), mul(n, -0.012)), w - 0.05, 0.024, C.paint, n));
  }
  // the top plate, from the top-back corner down to the top lip
  extrudes.push(box('top', [0, P[0][0], P[0][1]], [0, P[1][0], P[1][1]], w - 0.05, 0.024, C.paint, [0, 1, 0]));
  // the cutting edge and its teeth, the wear strips under the bottom
  const E = [0, P[2][0], P[2][1]], back = [0, P[3][0], P[3][1]], dir = unit(sub(E, back)), out = unit([0, dir[1] * 0.97 + 0.03, dir[2] * 0.97 - 0.12]);
  extrudes.push(box('edge', add(E, [-w / 2 + 0.02, 0, 0]), add(E, [w / 2 - 0.02, 0, 0]), 0.05, 0.05, wear, [0, 0, 1]));
  for (let k = 0; k < d.teeth; k++) {
    const x = -w / 2 + 0.1 + ((w - 0.2) * k) / (d.teeth - 1), root = add(E, [x, 0, 0]);
    lofts.push(loftWorld(`tooth_${k}`, root, add(root, mul(out, 0.2)), [{ t: 0, points: roundRect(out, 0.085, 0.07, 0.01, 1) }, { t: 1, points: roundRect(out, 0.04, 0.02, 0.005, 1) }], wear));
  }
  for (const s of [0.28, -0.28]) extrudes.push(box(`wear_${s > 0 ? 'r' : 'l'}`, [s, P[3][0] - 0.02, P[3][1] + 0.02], [s, P[2][0] - 0.1, P[2][1] + 0.03], 0.05, 0.03, wear, [0, 0.3, 1]));
  // the ears either side round its pin and its link's pin, their bosses
  const L = d.link;
  for (const s of [1, -1]) {
    extrudes.push(panel(`ear_${s > 0 ? 'r' : 'l'}`, s * 0.26, s * 0.3, [[-0.15, -0.18], [0.18, -0.12], [0.12, 0.3], [L[1] + 0.02, L[2] + 0.12], [L[1] - 0.12, L[2] + 0.05]], steel));
    lathes.push(boss(`pin_${s > 0 ? 'r' : 'l'}`, [0, 0, 0], s * 0.24, s * 0.32, 0.08, steel));
    lathes.push(boss(`lpin_${s > 0 ? 'r' : 'l'}`, L, s * 0.19, s * 0.32, 0.07, steel));
  }
  // (the teeth's tip: what the reach and the depth are measured to)
  const tip = add(add(E, [0, 0, 0]), mul(out, 0.2));
  return { extrudes, lathes, lofts, hardpoints: { pin: [0, 0, 0], link: L, tip, lip: [0, P[1][0], P[1][1]] }, outline: [...P.map(([y, z]) => [0, y, z]), tip] };
}

// ── a link: a dogbone's plate, an H-link's two plates and its cross tube ───────────────────────────────────────
function link(row, C) {
  const d = row.dims, L = d.length, steel = tone(C.trim, 0.15), extrudes = [], lathes = [];
  if (row.build.family === 'hlink') {
    for (const s of [1, -1]) {
      extrudes.push(box(`plate_${s > 0 ? 'r' : 'l'}`, [s * d.w / 2, 0, 0], [s * d.w / 2, L, 0], 0.045, d.h, steel));
      lathes.push(boss(`end_${s > 0 ? 'r' : 'l'}`, [0, L, 0], s * (d.w / 2 - 0.05), s * (d.w / 2 + 0.03), 0.075, steel));
    }
    lathes.push(boss('cross', [0, 0, 0], -d.w / 2 - 0.03, d.w / 2 + 0.03, 0.075, steel));
    lathes.push(boss('tie', [0, L * 0.55, 0], -d.w / 2, d.w / 2, 0.045, steel));
  } else {
    extrudes.push(box('plate', [0, 0, 0], [0, L, 0], d.w, d.h, steel));
    lathes.push(boss('a', [0, 0, 0], -d.w / 2 - 0.01, d.w / 2 + 0.01, 0.075, steel));
    lathes.push(boss('b', [0, L, 0], -d.w / 2 - 0.01, d.w / 2 + 0.01, 0.075, steel));
  }
  return { extrudes, lathes, hardpoints: { a: [0, 0, 0], b: [0, L, 0] } };
}

// ── a ram: its barrel from its base's eye (the barrel kind), its rod from its rod's eye (the rod kind) ──────────
// (its lengths are the chain's, which slides its stages: con-chain.js ramParts)
export { ramParts };
function ram(row, C, { part = 'barrel' } = {}) {
  const d = row.dims, L = ramParts(d), lathes = [], extrudes = [], R = d.bore / 2 + 0.018;
  if (part.startsWith('stage')) {
    // (a telescopic ram's stage k: a sleeve a step narrower than the one outside it, its collar at its mouth)
    const k = Number(part.slice(5)), r = R - 0.022 * k;
    lathes.push(spin('stage', [0, 0, 0], [0, L.stage, 0], [[0, r - 0.006], [0.94, r - 0.006], [0.97, r + 0.006], [1, r]], C.chrome, 16));
    return { lathes, hardpoints: { eye: [0, 0, 0] } };
  }
  if (part === 'rod') {
    lathes.push(boss('eye', [0, 0, 0], -0.05, 0.05, d.rod / 2 + 0.035, tone(C.trim, 0.2)));
    lathes.push(spin('rod', [0, 0.04, 0], [0, L.rod, 0], [[0, d.rod / 2], [1, d.rod / 2]], C.chrome, 16));
    return { lathes, hardpoints: { eye: [0, 0, 0] } };
  }
  lathes.push(boss('eye', [0, 0, 0], -0.06, 0.06, R * 0.85, tone(C.trim, 0.2)));
  lathes.push(spin('barrel', [0, 0.06, 0], [0, L.barrel, 0], [[0, R * 0.8], [0.04, R], [0.92, R], [0.96, R + 0.012], [1, R - 0.01]], C.paint, 18));
  extrudes.push(box('port', [0, 0.18, R - 0.01], [0, 0.18, R + 0.05], 0.05, 0.05, C.chrome, [0, 1, 0]));
  return { lathes, extrudes, hardpoints: { eye: [0, 0, 0] } };
}

export const CON_BUILDERS = Object.freeze({
  'con-undercarriage': undercarriage,
  'con-slew': slew,
  'con-house': house,
  'con-cab': cab,
  'con-counterweight': counterweight,
  'con-boom': boom,
  'con-stick': stick,
  'con-bucket': bucket,
  'con-link': link,
  'con-ram': ram,
  'con-blade': blade,
  'con-ripper': ripper,
  'con-wheel': wheel,
  'con-chassis': (row, C, ctx) => ({ loaderRear, loaderFront, skid: skidChassis, forklift: forkChassis, telehandler: teleChassis, backhoe: backhoeChassis, wheeledEx: wheeledExChassis, truck: truckChassis, adtFront, adtRear, haul: haulFrame, crane: craneCarrier, rollerRear, rollerFront, graderRear, graderFront })[row.build.family](row, C, ctx),
  'con-body': tipBody,
  'con-drum': (row, C, ctx) => ({ mixer: mixerDrum, roller: rollerDrum })[row.build.family](row, C, ctx),
  'con-tool': (row, C, ctx) => ({ breaker, grapple, auger, forks, sweeper })[row.build.family](row, C, ctx),
  'con-mast': mastChannel,
  'con-carriage': carriage,
  'con-section': boomSection,
  'con-post': (row, C, ctx) => ({ kingpin: swingPost, frame: swingFrame })[row.build.family](row, C, ctx),
  'con-leg': stabLeg,
  'con-arms': liftArms,
  'con-crank': bellcrank,
  'con-outrigger': (row, C, ctx) => ({ beam: outriggerBeam, jack: outriggerJack })[row.build.family](row, C, ctx),
  'con-hook': hookBlock,
  'con-rope': ropeFalls,
  'con-tower': (row, C, ctx) => ({ base: towerBase, mast: mastSection, head: towerHead })[row.build.family](row, C, ctx),
  'con-jib': (row, C, ctx) => ({ jib: jibLattice, counter: counterJib })[row.build.family](row, C, ctx),
  'con-trolley': trolley,
  'con-drawbar': drawbar,
  'con-circle': (row, C, ctx) => ({ circle: graderCircle, saddle: graderSaddle })[row.build.family](row, C, ctx),
});
export { X };
