/**
 * THE FARM'S MACHINES in the form render: the tractor and the heavy machines that work a field, at their classes' true
 * numbers (roads/vehicles.js), in the hull kit's language (mil-hull.js, civic-kit.js, farm-kit.js), drawn, worn and
 * painted as the field's are (road-military.js compileMilitary): previewed, parked, driven and exported. Their wheels are
 * their own, axle by axle (`wheelSet`): a tractor's small steering fronts and its tall drive tyres, a combine's big drive
 * wheels ahead and its small steering rears, a sprayer's tall narrow row-crop tyres; agricultural lugs, cream rims. A
 * working machine: it wears its field's soil unless kept clean. Classes, not replicas: no maker's colours, no badge.
 *
 *   tractor    the row-crop tractor: its narrow hood over the engine and its frame, the grille, the front weights on
 *              its nose; the front axle on its pivot and the fenders that steer with it; the glasshouse cab over the rear
 *              axle between the big rear fenders, its steps, its exhaust stack up the cab's front corner; the three-point
 *              hitch, the drawbar and the power take-off. `loader` (front loader) fits a loader on towers at its middle,
 *              its arms out over the hood to a bucket held level (the reach: the bucket's pin, `raised`/lifting lifts
 *              it), its weights off; `plough` (plow) hangs a four-furrow mouldboard plough on its hitch, raised on the
 *              road, in the ground `ploughing`
 *   combine    the combine harvester: the grain platform ahead (its cutterbar, its auger, its reel on its arms, its
 *              dividers) on the inclined feeder house; the cab high at the front, its platform and ladder; the threshing
 *              body, the grain tank on top and its flared extensions, the engine deck, the rotary screen, the straw
 *              spreader at its tail; big drive wheels ahead, small steering wheels behind. `corn` (maize) fits a corn head,
 *              its row dividers' snouts; `unloading` swings the unloading auger out from its rest along the left side
 *   sprayer    the self-propelled sprayer: a high-clearance frame on four tall legs, the cab ahead, the poly tank in its
 *              middle, the engine behind; its booms folded forward along both sides on their rests. `spraying` swings the
 *              booms out behind it to their full width, low over the crop, their nozzles down
 *
 *   FARM_CLASSES                      physics class → its body kind
 *   farmAxles(cls)                    → the axles' stations (+y forward, the body centred), the front first
 *   FARM_BODIES, FARM_KITS            the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *   FARM_LIVERY                       kind → its plain livery
 *   FARM_REACH, farmWords(words)      the loader's bucket pin (stowed, raised, its range); a brief's farm words
 *   loaderReach(words, pose)          → the bucket pin's height: `pose.reach` clamped, else raised or stowed by its words
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, face, slab } from './mil-hull.js';
import { FC, glassCab, truss, louvres, hitch, own, M, paint, dark, alu, rect, xs, X, Y, Z, neg, lamp, guard, C, black } from './farm-kit.js';

export const FARM_CLASSES = Object.freeze({ farmTractor: 'tractor', combineHarvester: 'combine', cropSprayer: 'sprayer' });

// each kind's wheels, front axle first: its radius, its tyre's width, its lugs round the tread
const WHEELS = Object.freeze({
  tractor: Object.freeze([{ r: 0.68, w: 0.42, lugs: 20 }, { r: 0.93, w: 0.52, lugs: 23 }]),
  combine: Object.freeze([{ r: 0.98, w: 0.82, lugs: 24 }, { r: 0.7, w: 0.6, lugs: 20 }]),
  sprayer: Object.freeze([{ r: 0.92, w: 0.38, lugs: 24 }, { r: 0.92, w: 0.38, lugs: 24 }]),
});
// (the front axle's station behind the nose)
const AHEAD = Object.freeze({ tractor: 1.15, combine: 3.6, sprayer: 2.0 });

/** Where each axle stands (+y forward), the front first. */
export function farmAxles(cls) {
  const kind = FARM_CLASSES[cls], v = VEHICLES[cls];
  if (!kind) throw new Error(`car-designer: '${cls}' is not one of the farm's machines (${Object.keys(FARM_CLASSES).join(', ')})`);
  const yf = v.L / 2 - AHEAD[kind];
  return [yf, yf - v.wheelbase];
}

// the loader's bucket pin, metres from the ground: carried low on the road, raised to tip into a trailer
export const FARM_REACH = Object.freeze({ loader: Object.freeze({ stowed: 0.6, deployed: 3.4, range: Object.freeze([0.25, 3.8]) }) });
const WORDS = Object.freeze({
  loader: ['loader', 'front loader', 'front-loader', 'bucket'], raised: ['raised', 'lifting', 'lifted', 'loading', 'up', 'tipping'],
  plough: ['plough', 'plow', 'ploughing', 'plowing'], ploughing: ['ploughing', 'plowing', 'working', 'in the ground'],
  corn: ['corn', 'maize', 'corn head', 'cornhead'], unloading: ['unloading', 'offloading', 'unload', 'emptying', 'auger out'],
  spraying: ['spraying', 'booms out', 'unfolded', 'working', 'deployed'],
});
/** A brief's farm words: what each says of the machine. */
export function farmWords(words = []) {
  const W = words.map((w) => String(w).toLowerCase()), has = (k) => W.some((w) => WORDS[k].includes(w));
  return { loader: has('loader') || has('raised'), raised: has('raised'), plough: has('plough'), ploughing: has('ploughing') && has('plough'), corn: has('corn'), unloading: has('unloading'), spraying: has('spraying') };
}
/** The loader's bucket pin height: `pose.reach` clamped to its range, else raised or carried by its words. */
export function loaderReach(words = [], pose = {}) {
  const R = FARM_REACH.loader, want = Number.isFinite(pose?.reach) ? pose.reach : farmWords(words).raised ? R.deployed : R.stowed;
  return Math.min(R.range[1], Math.max(R.range[0], want));
}

const cream = (part) => M(part, 'plate', FC.rim);
const wheelSetOf = (kind) => WHEELS[kind].map((w) => ({ ...w, rim: FC.rim }));

// ── the tractor ─────────────────────────────────────────────────────────────────
function tractor(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], [F, R] = WHEELS.tractor, [yf, yr] = farmAxles(cls), yN = v.L / 2, yT = -v.L / 2, tw = v.track / 2, out = [];
  const P = (o) => out.push(...plate(o)), fw = farmWords(words), loader = fw.loader || Number.isFinite(pose?.reach);
  // the frame and the engine under the hood: its sump, its rails out to the nose; the hood narrow and tall over it, its
  // top falling to its grille, its side louvres
  const yC = yr + 0.78, yG = yN - 0.36, hb = 0.42, zH0 = 0.95, zHc = 1.88, zHg = 1.74;
  P({ axis: 'y', profile: rect(-0.3, 0.3, 0.5, zH0 + 0.02), from: yr + 0.3, to: yG + 0.05, r: 0.03, seg: 1, look: dark('frame') });
  out.push(...slab({
    side: [[yC, zH0], [yG, zH0], [yG, zHg - 0.1], [yG - 0.18, zHg], [yC, zHc]],
    front: [[-hb, zH0], [hb, zH0], [hb, zHc - 0.25], [hb - 0.12, zHc], [-hb + 0.12, zHc], [-hb, zHc - 0.25]],
    chamfer: 0.04, crease: 10, look: () => paint('hood'),
  }));
  for (const s of [-1, 1]) louvres(out, { s, x: s * hb, y0: yG - 0.9, y1: yG - 0.15, z0: zH0 + 0.25, z1: zHc - 0.35 });
  P({ axis: 'y', profile: rect(-hb + 0.08, hb - 0.08, zH0 + 0.08, zHg - 0.16), from: yG - 0.01, to: yG + 0.01, look: black('grille') });
  for (const s of [-1, 1]) out.push(...lamp([s * (hb - 0.1), yG + 0.012, zHg - 0.24], Y, 0.18, 0.08, 'lamp', 'headlamp'));
  // the front axle on its pivot under the frame, its steering fenders over the front tyres; the weights on its nose
  out.push(...tube([[-tw + 0.25, yf, F.r], [tw - 0.25, yf, F.r]], 0.09, { sides: 10, look: dark('axle.front') }));
  out.push(...tube([[0, yf - 0.15, F.r + 0.02], [0, yf + 0.15, F.r + 0.02]], 0.14, { sides: 12, look: dark('axle.pivot') }));
  for (const s of [-1, 1]) {
    out.push(...guard(yf, F.r, F.r + 0.1, 0.35, Math.PI - 0.55, ...xs(s, tw - F.w / 2 - 0.03, tw + F.w / 2 + 0.02), paint('fender.front')));
    out.push(...tube([[s * (tw - F.w / 2 - 0.05), yf, F.r], [s * (tw - F.w / 2 - 0.05), yf, 2 * F.r + 0.08]], 0.025, { sides: 6, look: dark('fender.stay') }));
  }
  if (!loader) {
    P({ axis: 'y', profile: rect(-0.32, 0.32, 0.62, 0.95), from: yG + 0.02, to: yN - 0.1, r: 0.02, seg: 1, look: dark('weight.bracket') });
    for (let k = 0; k < 8; k++) { const y = yN - 0.26 + k * 0.032; P({ axis: 'y', profile: [[-0.5, 0.66], [0.5, 0.66], [0.52, 1.0], [0.42, 1.12], [-0.42, 1.12], [-0.52, 1.0]], from: y, to: y + 0.028, r: 0.006, seg: 1, look: paint('weight') }); }
  }
  // the rear axle's housings out to the hubs; the cab over it between the big rear fenders, its floor over the axle
  out.push(...tube([[-tw + 0.3, yr, R.r], [tw - 0.3, yr, R.r]], 0.13, { sides: 12, look: dark('axle.rear') }));
  P({ axis: 'y', profile: rect(-0.5, 0.5, 0.55, 1.35), from: yr - 0.55, to: yC + 0.02, r: 0.04, seg: 1, look: dark('transmission') });
  const hc = 0.74, z0 = 1.42, z1 = 2.86, yF = yC - 0.04, yB = yr - 0.62;
  const anchors = glassCab(out, { yF, yB, hw: hc, z0, z1, rake: 0.12, over: 0.12 });
  for (const s of [-1, 1]) {
    out.push(...guard(yr, R.r, R.r + 0.1, 0.18, Math.PI - 0.12, ...xs(s, hc - 0.02, tw + R.w / 2 + 0.03), paint('fender.rear')));
    P({ axis: 'x', profile: rect(yB - 0.05, yF + 0.02, 0.95, z0), from: s * (hc - 0.08), to: s * hc, r: 0.01, seg: 1, look: paint('cab.side') });
    out.push(...lamp([s * (tw + R.w / 2 - 0.02), yr - 0.3, 2 * R.r + 0.11], neg(Y), 0.12, 0.08, 'tail', 'fender.lamp'));
    out.push(...lamp([s * (tw + R.w / 2 - 0.02), yr + 0.3, 2 * R.r + 0.11], Y, 0.12, 0.08, 'marker', 'fender.indicator'));
  }
  // (the steps up to the left door, ahead of the left rear tyre; the exhaust up the cab's right front post; the intake)
  for (const [z, d] of [[0.5, 0], [0.86, 0.05], [1.2, 0.1]]) P({ axis: 'z', profile: rect(-hc - 0.3 + d, -hc + 0.02, yr + R.r + 0.08, yr + R.r + 0.42), from: z, to: z + 0.035, r: 0.006, seg: 1, look: alu('step') });
  out.push(...tube([[-hc - 0.24, yr + R.r + 0.1, 0.5], [-hc - 0.24, yr + R.r + 0.1, z0]], 0.02, { sides: 6, look: dark('step.rail') }));
  out.push(...tube([[hb - 0.05, yC - 0.05, zHc - 0.05], [hc + 0.04, yF + 0.03, z0 + 0.2], [hc + 0.04, yF + 0.03, z1 + 0.32]], 0.06, { sides: 10, look: black('exhaust') }));
  out.push(...tube([[-hc - 0.04, yF + 0.03, z0 + 0.4], [-hc - 0.04, yF + 0.03, z1 - 0.1]], 0.08, { sides: 10, look: black('intake') }));
  // the three-point hitch, its drawbar and its PTO; a plough on it when asked, raised on the road, in the ground at work
  const H = hitch(out, { y: yr, yT, zAxle: R.r, drop: fw.ploughing ? 0.42 : 0 });
  if (fw.plough) plough(out, { at: H, ground: fw.ploughing });
  // a loader when asked: its towers either side of the hood, its arms out over the nose to its bucket, held level
  if (loader) frontLoader(out, { yTower: yC + 0.35, yf, F, reach: loaderReach(words, pose), yN, hb });
  anchors.push(...[-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [{ id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (hb + 0.004), yG - 0.55, zHc - 0.25], out: sd, up: Z, h: 0.12 }];
  }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.55, tub: { x: tw + R.w / 2, y: [yT, yN], z: [0.2, 1.0] } }, wheelSet: wheelSetOf('tractor') };
}
// (the loader's arms pivot on their towers; their tip, the bucket's pin, stands at the reach asked, `len` from the pivot)
function frontLoader(out, { yTower, yf, F, reach, yN, hb }) {
  const xa = hb + 0.14, piv = [yTower, 2.05], len = 3.05, a = Math.asin(Math.max(-1, Math.min(1, (reach - piv[1]) / len))), tip = [piv[0] + len * Math.cos(a), reach];
  for (const s of [-1, 1]) {
    const x = s * xa;
    out.push(...plate({ axis: 'x', profile: [[yTower - 0.25, 0.75], [yTower + 0.2, 0.75], [yTower + 0.12, piv[1] + 0.1], [yTower - 0.12, piv[1] + 0.1]], from: x - 0.06, to: x + 0.06, r: 0.01, seg: 1, look: paint('loader.tower') }));
    // (the arm: up from its pivot over the hood, then bent down to the pin; its ram from the tower's foot to its knee)
    const knee = [piv[0] + len * 0.62 * Math.cos(a) + 0.05, piv[1] + len * 0.62 * Math.sin(a) + 0.25];
    out.push(...tube([[x, piv[0], piv[1]], [x, knee[0], knee[1]], [x, tip[0], tip[1] + 0.05]], 0.075, { sides: 8, look: paint('loader.arm') }));
    out.push(...tube([[x - s * 0.1, yTower + 0.15, 0.95], [x - s * 0.1, knee[0] - 0.4, knee[1] - 0.15]], 0.045, { sides: 8, look: M('loader.ram', 'alloy', '#cfd3d6') }));
  }
  out.push(...tube([[-xa, (piv[0] + tip[0]) / 2, (piv[1] + tip[1]) / 2 + 0.2], [xa, (piv[0] + tip[0]) / 2, (piv[1] + tip[1]) / 2 + 0.2]], 0.05, { sides: 8, look: paint('loader.cross') }));
  // the bucket hung on its pin, kept level: its back, its floor out ahead, its sides, its cutting edge
  const by = tip[0], bz = tip[1] - 0.25, wB = 1.15, P = (o) => out.push(...plate(o));
  P({ axis: 'x', profile: [[by - 0.05, bz], [by + 0.85, bz], [by + 0.9, bz + 0.06], [by + 0.05, bz + 0.12], [by + 0.0, bz + 0.75], [by - 0.1, bz + 0.72]], from: -wB, to: wB, r: 0.02, seg: 1, look: paint('loader.bucket') });
  P({ axis: 'x', profile: rect(by + 0.82, by + 0.92, bz - 0.01, bz + 0.03), from: -wB, to: wB, look: M('loader.edge', 'steel', FC.knife) });
  for (const s of [-1, 1]) P({ axis: 'x', profile: [[by - 0.05, bz], [by + 0.88, bz], [by + 0.05, bz + 0.75]], from: s * wB, to: s * (wB + 0.02), look: paint('loader.bucket.side') });
}
// (a four-furrow mouldboard plough on the hitch: its headstock, its beam on the diagonal, its legs, its mouldboards and
// shares, its depth wheel; its shares at the ground working, 0.4 up on the road)
function plough(out, { at, ground }) {
  const [l, rr] = at.lower, y0 = l[1], z = ground ? 0 : 0.42, P = (o) => out.push(...plate(o));
  out.push(...tube([l, rr], 0.05, { sides: 8, look: paint('plough.headstock') }), ...tube([[0, y0, l[2]], at.top], 0.05, { sides: 8, look: paint('plough.headstock') }));
  const beam = (t) => [0.3 + t * 1.35, y0 - 0.35 - t * 3.2, z + 0.85];
  out.push(...tube([[0, y0 - 0.1, l[2]], beam(0), beam(1)], 0.07, { sides: 8, look: paint('plough.beam') }));
  for (let k = 0; k < 4; k++) {
    const [bx, by] = beam(0.12 + k * 0.27);
    out.push(...tube([[bx, by, z + 0.85], [bx, by - 0.1, z + 0.18]], 0.04, { sides: 6, look: paint('plough.leg') }));
    // (the mouldboard: a twisted plate turning the furrow to the right; the share its point at the ground)
    out.push(face([[bx - 0.12, by + 0.25, z + 0.02], [bx + 0.15, by - 0.35, z + 0.08], [bx + 0.42, by - 0.45, z + 0.55], [bx - 0.05, by + 0.05, z + 0.45]], M('plough.mouldboard', 'steel', FC.knife), [1, 0.4, 0.2]));
    out.push(face([[bx - 0.12, by + 0.25, z + 0.02], [bx - 0.15, by + 0.38, z], [bx + 0.2, by - 0.25, z], [bx + 0.15, by - 0.35, z + 0.08]], M('plough.share', 'steel', '#7d8386'), [0.3, 0.2, 1]));
  }
  // (its depth wheel at the beam's tail, on its arm)
  const [wx, wy] = beam(1), hub = [wx + 0.25, wy - 0.2, 0.3 + z];
  out.push(...tube([[hub[0] - 0.07, hub[1], hub[2]], [hub[0] + 0.07, hub[1], hub[2]]], 0.3, { sides: 14, look: black('plough.wheel') }));
  out.push(...tube([[wx, wy, z + 0.85], hub], 0.035, { sides: 6, look: paint('plough.wheelarm') }));
}

// ── the combine harvester ───────────────────────────────────────────────────────
function combine(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], [F, R] = WHEELS.combine, [yf, yr] = farmAxles(cls), yN = v.L / 2, yT = -v.L / 2, tw = v.track / 2, out = [];
  const P = (o) => out.push(...plate(o)), fw = farmWords(words), hh = v.W / 2;
  // the header: a grain platform's pan, back wall, end sheets, cutterbar, auger and reel; or a corn head's snouts
  const yH0 = yN - 2.0, yH1 = yN - 0.12;
  P({ axis: 'y', profile: rect(-hh + 0.05, hh - 0.05, 0.22, 0.34), from: yH0 + 0.1, to: yH1, r: 0.02, seg: 1, look: paint('header.pan') });
  P({ axis: 'y', profile: rect(-hh + 0.05, hh - 0.05, 0.22, 1.32), from: yH0, to: yH0 + 0.12, r: 0.02, seg: 1, look: paint('header.back') });
  if (!fw.corn) {
    for (const s of [-1, 1]) P({ axis: 'x', profile: [[yH0, 0.22], [yH1, 0.22], [yH1 - 0.5, 0.95], [yH0, 1.32]], from: s * (hh - 0.06), to: s * hh, r: 0.01, seg: 1, look: paint('header.end') });
    P({ axis: 'x', profile: rect(yH1 - 0.04, yN, 0.16, 0.24), from: -hh + 0.05, to: hh - 0.05, r: 0.01, seg: 1, look: M('cutterbar', 'steel', FC.knife) });
    for (let x = -hh + 0.12; x < hh - 0.08; x += 0.15) out.push(...tube([[x, yH1, 0.2], [x, yN - 0.005, 0.2]], 0.018, { sides: 4, look: M('cutterbar.guard', 'steel', FC.knife) }));
    out.push(...tube([[-hh + 0.1, yH0 + 0.45, 0.6], [hh - 0.1, yH0 + 0.45, 0.6]], 0.28, { sides: 14, look: paint('header.auger') }));
    // (the reel: its shaft, its bats round it, its spiders at its ends and middle, carried on two arms off the back wall)
    const rc = [yN - 0.75, 1.5], rR = 0.55;
    out.push(...tube([[-hh + 0.2, ...rc], [hh - 0.2, ...rc]], 0.05, { sides: 8, look: M('reel.shaft', 'steel', FC.steel) }));
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3, p = [rc[0] + rR * Math.cos(a), rc[1] + rR * Math.sin(a)];
      out.push(...tube([[-hh + 0.25, ...p], [hh - 0.25, ...p]], 0.03, { sides: 6, look: M('reel.bat', 'plate', FC.reel) }));
      for (const x of [-hh + 0.3, 0, hh - 0.3]) out.push(...tube([[x, ...rc], [x, ...p]], 0.018, { sides: 5, look: M('reel.spider', 'plate', FC.reel) }));
    }
    for (const s of [-1, 1]) out.push(...tube([[s * (hh - 0.15), yH0 + 0.06, 1.32], [s * (hh - 0.15), rc[0], rc[1] + 0.05]], 0.05, { sides: 8, look: paint('reel.arm') }));
    for (const s of [-1, 1]) out.push(face([[s * hh, yH1, 0.22], [s * hh, yN + 0.0, 0.18], [s * (hh - 0.1), yH1 - 0.6, 0.85]], paint('divider'), [s, 0.3, 0.3]));
  } else {
    // (a corn head: eight row units, a snout between each two rows, pointed ahead and down)
    const rows = 8, pitch = (2 * hh - 0.2) / rows;
    for (let k = 0; k <= rows; k++) {
      const x = -hh + 0.1 + k * pitch;
      out.push(...slab({ side: [[yH0 + 0.12, 0.3], [yN, 0.16], [yN - 0.2, 0.42], [yH0 + 0.12, 0.95]], front: [[x - 0.16, 0.1], [x + 0.16, 0.1], [x + 0.16, 1.0], [x - 0.16, 1.0]], plan: [[x - 0.16, yH0 + 0.12], [x + 0.16, yH0 + 0.12], [x + 0.06, yN - 0.15], [x, yN], [x - 0.06, yN - 0.15]], chamfer: 0.02, look: () => paint('snout') }));
    }
    out.push(...tube([[-hh + 0.1, yH0 + 0.45, 0.62], [hh - 0.1, yH0 + 0.45, 0.62]], 0.24, { sides: 14, look: paint('header.auger') }));
  }
  // the feeder house up from the header to the body, under the cab
  const yB0 = yf + F.r + 0.2;
  out.push(...slab({ side: [[yB0 - 0.2, 1.0], [yH0, 0.25], [yH0, 1.0], [yB0 - 0.2, 2.15]], front: [[-0.62, 0], [0.62, 0], [0.62, 3], [-0.62, 3]], chamfer: 0.03, look: () => paint('feeder') }));
  // the body: the threshing housing low between the drive wheels, wide above them; its side louvres; the grain tank
  // over it and its flared extensions; the engine deck behind and its rotary screen; the spreader at its tail
  const yBT = yT + 0.35, zU = 2 * F.r + 0.1, hl = tw - F.w / 2 - 0.08;
  P({ axis: 'y', profile: rect(-hl, hl, 0.62, zU + 0.05), from: yBT + 0.4, to: yB0, r: 0.05, seg: 1, look: paint('body.lower') });
  out.push(...slab({ side: [[yBT, zU], [yB0 + 0.1, zU], [yB0 + 0.1, 3.25], [yBT + 0.25, 3.25], [yBT, 2.9]], front: [[-1.45, zU], [1.45, zU], [1.45, 3.2], [1.38, 3.25], [-1.38, 3.25], [-1.45, 3.2]], chamfer: 0.04, look: () => paint('body') }));
  for (const s of [-1, 1]) louvres(out, { s, x: s * 1.45, y0: yr + 0.2, y1: yr + 1.5, z0: zU + 0.25, z1: 2.95, pitch: 0.08 });
  out.push(...slab({ side: [[yr + 0.6, 3.24], [yf - 0.05, 3.24], [yf + 0.15, 3.8], [yr + 0.45, 3.8]], front: [[-1.3, 3.24], [1.3, 3.24], [1.55, 3.82], [-1.55, 3.82]], chamfer: 0.03, look: () => paint('tank') }));
  for (const s of [-1, 1]) P({ axis: 'x', profile: [[yr + 0.5, 3.8], [yf + 0.12, 3.8], [yf + 0.2, v.H - 0.01], [yr + 0.4, v.H - 0.01]], from: s * 1.45, to: s * 1.52, r: 0.01, seg: 1, look: own('tank.extension', '#c4c7c6', 'steel') });
  out.push(face([[-1.45, yr + 0.5, v.H - 0.02], [1.45, yr + 0.5, v.H - 0.02], [1.45, yf + 0.12, v.H - 0.02], [-1.45, yf + 0.12, v.H - 0.02]], M('grain', 'canvas', FC.grain), Z));
  out.push(...tube([[0.5, yBT + 1.2, 3.25], [0.5, yBT + 1.2, 3.55]], 0.42, { sides: 18, look: black('screen') }), ...tube([[-0.6, yBT + 0.9, 3.25], [-0.6, yBT + 0.9, 3.75]], 0.06, { sides: 10, look: black('exhaust') }));
  for (const s of [-1, 1]) out.push(...tube([[s * 0.4, yT + 0.4, 0.95], [s * 0.4, yT + 0.4, 1.05]], 0.38, { sides: 14, look: dark('spreader') }));
  P({ axis: 'z', profile: rect(-1.0, 1.0, yT, yBT + 0.1), from: 1.05, to: 1.12, r: 0.01, seg: 1, look: paint('spreader.hood') });
  // the axles: the drive's beam under the body, the steering axle's; the guards over the steering wheels
  out.push(...tube([[-tw + 0.3, yf, F.r], [tw - 0.3, yf, F.r]], 0.14, { sides: 12, look: dark('axle.front') }));
  out.push(...tube([[-tw + 0.3, yr, R.r], [tw - 0.3, yr, R.r]], 0.09, { sides: 10, look: dark('axle.rear') }));
  P({ axis: 'z', profile: rect(-0.3, 0.3, yr - 0.2, yr + 0.2), from: R.r, to: zU, r: 0.02, seg: 1, look: dark('axle.mount') });
  // the cab high at the front over the feeder house, its platform, its ladder down the left; lamps on the body's sides
  const yCF = yB0 + 1.15, z0 = 2.45, z1 = 3.6;
  const anchors = glassCab(out, { yF: yCF, yB: yB0 - 0.15, hw: 0.82, z0, z1, rake: 0.25, over: 0.14 });
  P({ axis: 'z', profile: rect(-1.3, 1.0, yB0 - 0.3, yCF + 0.15), from: z0 - 0.14, to: z0 - 0.06, r: 0.01, seg: 1, look: dark('platform') });
  out.push(...tube([[-1.3, yB0 - 0.3, z0 + 0.9], [-1.3, yCF + 0.15, z0 + 0.9], [-1.0, yCF + 0.15, z0 + 0.9]], 0.022, { sides: 6, look: alu('platform.rail') }));
  for (const sx of [-1.12, -1.42]) out.push(...tube([[sx, yB0 - 0.1, 0.45], [sx, yB0 - 0.15, z0 - 0.1]], 0.022, { sides: 6, look: alu('ladder') }));
  for (let z = 0.55; z < z0 - 0.2; z += 0.3) out.push(...tube([[-1.42, yB0 - 0.12, z], [-1.12, yB0 - 0.12, z]], 0.016, { sides: 6, look: alu('ladder') }));
  for (const s of [-1, 1]) out.push(...lamp([s * 1.46, yBT + 0.4, 1.9], [s, 0, 0], 0.1, 0.06, 'marker', 'side.marker'), ...lamp([s * 1.0, yT + 0.002, 1.45], neg(Y), 0.14, 0.1, 'tail', 'taillamp'));
  // the unloading auger: from its turret at the tank's back left corner, folded forward along the left side on its rest,
  // or swung out square to the left and up to a trailer alongside, its spout down
  const piv = [-1.5, yr + 0.55, 3.55], len = 6.0, out90 = fw.unloading;
  const end = out90 ? [piv[0] - len * Math.cos(0.17), piv[1] + 0.3, piv[2] + len * Math.sin(0.17)] : [piv[0] - 0.2, Math.min(piv[1] + len, yN - 0.4), piv[2] + 0.05];
  out.push(...tube([[piv[0] + 0.1, piv[1], 3.0], [piv[0], piv[1], piv[2]], end], 0.17, { sides: 12, look: paint('auger') }));
  out.push(...tube([end, [end[0], end[1] + (out90 ? 0 : 0.2), end[2] - 0.45]], 0.15, { sides: 10, look: paint('auger.spout') }));
  if (!out90) out.push(...tube([[-1.45, yf + 1.1, 3.1], [end[0] + 0.02, yf + 1.1, piv[2] - 0.18]], 0.04, { sides: 6, look: dark('auger.rest') }));
  for (const s of [-1, 1]) anchors.push({ id: `mark.${s < 0 ? 'L' : 'R'}`, kind: 'mark', role: 'number', at: [s * 1.455, yr + 2.4, 2.3], out: s < 0 ? neg(X) : X, up: Z, h: 0.24 });
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.62, tub: { x: tw + F.w / 2, y: [yT, yB0], z: [0.25, 1.2] } }, wheelSet: wheelSetOf('combine') };
}

// ── the self-propelled sprayer ──────────────────────────────────────────────────
function sprayer(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], [F] = WHEELS.sprayer, axles = farmAxles(cls), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, tw = v.track / 2, out = [];
  const P = (o) => out.push(...plate(o)), fw = farmWords(words), zf = 1.75;
  // the spine high over the crop, the four legs down to the hubs (a motor at each), their struts
  P({ axis: 'y', profile: rect(-0.42, 0.42, zf, zf + 0.3), from: yT + 0.35, to: yN - 0.3, r: 0.02, seg: 1, look: dark('frame') });
  for (const y of axles) for (const s of [-1, 1]) {
    const xl = s * (tw - F.w / 2 - 0.14);
    out.push(...tube([[s * 0.4, y, zf + 0.12], [xl, y, zf + 0.12]], 0.08, { sides: 8, look: dark('leg.beam') }));
    P({ axis: 'z', profile: rect(xl - 0.09, xl + 0.09, y - 0.12, y + 0.12), from: F.r - 0.05, to: zf + 0.2, r: 0.02, seg: 1, look: paint('leg') });
    out.push(...tube([[xl, y, F.r], [s * (tw - 0.05), y, F.r]], 0.12, { sides: 12, look: dark('hub.motor') }));
    out.push(...guard(y, F.r, F.r + 0.08, 0.6, Math.PI - 0.6, ...xs(s, tw - F.w / 2 - 0.02, tw + F.w / 2 + 0.02), paint('fender')));
  }
  // the cab ahead on its deck, the poly tank in the middle, the engine behind under its hood
  const yCF = yN - 0.3, anchors = glassCab(out, { yF: yCF, yB: yCF - 1.45, hw: 0.8, z0: zf + 0.35, z1: 3.63, rake: 0.2, over: 0.1 });
  P({ axis: 'z', profile: rect(-0.95, 0.95, yCF - 1.6, yN), from: zf + 0.2, to: zf + 0.3, r: 0.01, seg: 1, look: dark('deck') });
  P({ axis: 'y', profile: rect(-0.88, 0.88, zf + 0.3, 3.15), from: yr - 0.2, to: yCF - 1.75, r: 0.35, seg: 3, look: own('tank', FC.poly, 'plate') });
  out.push(...tube([[0, (yr + yCF - 1.95) / 2, 3.12], [0, (yr + yCF - 1.95) / 2, 3.24]], 0.22, { sides: 14, look: own('tank.lid', '#d6d6cd', 'plate') }));
  P({ axis: 'y', profile: [[-0.78, zf + 0.3], [0.78, zf + 0.3], [0.78, 2.7], [0.6, 2.88], [-0.6, 2.88], [-0.78, 2.7]], from: yT + 0.4, to: yr - 0.3, r: 0.04, seg: 2, look: paint('engine.hood') });
  for (const s of [-1, 1]) louvres(out, { s, x: s * 0.78, y0: yT + 0.6, y1: yr - 0.5, z0: zf + 0.5, z1: 2.6 });
  out.push(...tube([[0.4, yT + 1.0, 2.88], [0.4, yT + 1.0, 3.35]], 0.06, { sides: 10, look: black('exhaust') }));
  out.push(...lamp([-0.5, yT + 0.4, 2.3], neg(Y), 0.14, 0.1, 'tail', 'taillamp'), ...lamp([0.5, yT + 0.4, 2.3], neg(Y), 0.14, 0.1, 'tail', 'taillamp'));
  // the ladder up to the cab's deck on the left
  for (const sx of [-0.98, -1.25]) out.push(...tube([[sx, yCF - 1.0, 0.5], [sx, yCF - 1.1, zf + 0.22]], 0.02, { sides: 6, look: alu('ladder') }));
  for (let z = 0.6; z < zf + 0.1; z += 0.3) out.push(...tube([[-1.25, yCF - 1.05, z], [-0.98, yCF - 1.05, z]], 0.015, { sides: 6, look: alu('ladder') }));
  // the booms: their centre frame at the tail, its lift; each wing folded forward along its side on its rest, or swung
  // out behind to its full reach, low over the crop, its nozzles hanging
  const yBm = yT + 0.1, zB = fw.spraying ? 1.05 : 2.1, half = 18.0, wingX = (v.W / 2) - 0.1;
  P({ axis: 'x', profile: rect(yBm - 0.08, yBm + 0.08, zB, zB + 0.45), from: -1.0, to: 1.0, r: 0.01, seg: 1, look: paint('boom.centre') });
  for (const s of [-1, 1]) out.push(...tube([[s * 0.35, yT + 0.4, zf + 0.1], [s * 0.35, yBm, zB + 0.3]], 0.04, { sides: 8, look: dark('boom.lift') }));
  for (const s of [-1, 1]) {
    if (fw.spraying) {
      truss(out, [s * 1.0, yBm, zB], [s * half, yBm, zB], { h: 0.4, pitch: 0.75, look: paint('boom') });
      for (let x = 1.3; x < half; x += 0.5) out.push(...tube([[s * x, yBm, zB], [s * x, yBm, zB - 0.18]], 0.01, { sides: 4, look: M('nozzle', 'steel', FC.knife) }));
    } else {
      // (folded: its inner wing forward along the side, its outer wings doubled back over it)
      truss(out, [s * wingX, yBm + 0.1, zB], [s * wingX, yN - 2.0, zB], { h: 0.42, pitch: 0.75, look: paint('boom') });
      truss(out, [s * (wingX - 0.08), yN - 2.1, zB + 0.48], [s * (wingX - 0.08), yBm + 0.5, zB + 0.48], { h: 0.3, pitch: 0.75, r: 0.028, look: paint('boom') });
      P({ axis: 'z', profile: rect(...xs(s, 0.88, wingX + 0.05), yN - 2.3, yN - 2.15), from: zB - 0.08, to: zB, r: 0.01, seg: 1, look: dark('boom.rest') });
    }
  }
  return { faces: out.filter(Boolean), anchors, zones: { floor: 1.0, tub: { x: tw + F.w / 2, y: [yT, yN], z: [0.3, 1.4] } }, wheelSet: wheelSetOf('sprayer') };
}

export const FARM_BODIES = Object.freeze({ tractor, combine, sprayer });

const MIRRORS = [['post.L', 'mirror'], ['post.R', 'mirror']];
/** Each farm machine's kit (mil-fittings.js cards on its anchors). */
export const FARM_KITS = Object.freeze({ tractor: Object.freeze([...MIRRORS]), combine: Object.freeze([...MIRRORS]), sprayer: Object.freeze([...MIRRORS]) });

const mono = (c) => Object.freeze({ pattern: 'mono', colours: Object.freeze([c]), marks: Object.freeze({ emblem: false }) });
/** Each farm machine's plain livery: one paint, no badge (its rims cream, its tank poly, its frame dark: its own). */
export const FARM_LIVERY = Object.freeze({ tractor: mono('#2f6a3c'), combine: mono('#a3271f'), sprayer: mono('#2f6a3c') });

export { louvres, truss, black, C };
