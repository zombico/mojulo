/**
 * THE HAUL KIT: what the highway's haulers share (road-haul-*.js), in the hull kit's language (mil-hull.js) and the civic
 * kit's (civic-kit.js, whose bands, stripes, lamps and guards they reuse): the long-nosed aero tractor's hood and its
 * sleeper or day cab, the European cab-over, a tractor's frame, its fuel tanks, its stacks and its fifth wheel, and the
 * trailers it pulls. Classes, not replicas: no maker's grille, badge or livery.
 *
 *   HC                                the haulers' own colours (chrome, a trailer's aluminium, a deck's timber, …)
 *   haulWords(words)                  → { trailer, empty }: the trailer a brief asks (van | reefer | flatbed | tanker |
 *                                       container | curtain | log | none), whether its load is off
 *   TRAILER_WORDS                     the trailer each word asks for
 *   aeroHood(out, { … })              → a sloped one-piece hood and its fenders, grille, swept lamps, wraparound bumper
 *   aeroCab(out, { … })               → the cab behind it, a sleeper's raised roof swept up from the screen, or a day
 *                                       cab's; its glass, doors, visor, roof lamps; its anchors
 *   euroCab(out, { … })               → a tall cab-over: its flat face, its screen, its grille, its steps, its roof
 *                                       spoiler and side deflectors; its anchors
 *   tractorFrame(out, { … })          → a tractor's rails, its axles, its drive tandem's guards, its tanks, its chassis
 *                                       fairings, its fifth wheel and deck plate
 *   stacks(out, { … })                → twin chrome exhaust stacks, their heat shields
 *   trailer(out, { kind, … })         → a trailer behind its kingpin: its body by kind, its floor, its landing gear, its
 *                                       running gear's subframe, its rear doors and under-run bar, its lamps and its
 *                                       conspicuity tape; its anchors
 *   logLoad(out, { … })               → logs bundled on bunks between stakes
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic: a log's girth and its place in the bundle come from its index, never dice.
 */
import { plate, tube, bend, face, slab } from './mil-hull.js';
import { CC, own, stripes, band, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, C } from './civic-kit.js';

// the haulers' own colours, unlit: what a livery leaves alone
export const HC = Object.freeze({
  chrome: '#cfd3d6', alu: '#b9bec2', van: '#eeefec', vanPost: '#c4c8cb', deck: '#7b5a3c', curtain: '#3b5d86', tank: '#c3c8cc',
  container: '#8f3a2a', reefer: '#d7d9db', bark: '#5a4532', heart: '#c8a26c', strap: '#e0a21a', crate: '#a98456', tarp: '#3d4a36',
  dark: '#1d1e1f', amber: '#e39a1c',
});
const black = (part) => M(part, 'carbon', C.black), glass = M('glass', 'glass', C.glass), seam = M('seam', 'seal', '#151614');
const chrome = (part) => M(part, 'alloy', HC.chrome);

/** The trailer each word asks for (a brief's words, the first that names one). */
export const TRAILER_WORDS = Object.freeze({
  van: Object.freeze(['van', 'dry van', 'box trailer', 'box']),
  reefer: Object.freeze(['reefer', 'refrigerated', 'chilled', 'fridge', 'frozen', 'cold']),
  flatbed: Object.freeze(['flatbed', 'flat deck', 'flat', 'deck']),
  tanker: Object.freeze(['tanker', 'tank', 'fuel', 'liquid', 'milk']),
  container: Object.freeze(['container', 'intermodal', 'shipping container', 'boxcar']),
  curtain: Object.freeze(['curtain', 'curtainsider', 'curtain side', 'tautliner', 'tilt']),
  none: Object.freeze(['bobtail', 'bobtailing', 'no trailer', 'unhitched', 'tractor only', 'solo']),
});
/** A hauler's words: the trailer asked (`fallback` when none is), whether its load is off (`empty`, unloaded). */
export function haulWords(words = [], fallback = 'van') {
  const W = words.map((w) => String(w).toLowerCase());
  const trailer = Object.keys(TRAILER_WORDS).find((k) => W.some((w) => TRAILER_WORDS[k].includes(w))) ?? fallback;
  return { trailer, empty: W.some((w) => ['empty', 'unloaded', 'unladen', 'light'].includes(w)) };
}

const sideFace = (out, s, x, [y0, y1], [z0, z1], look) => out.push(face([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], look, [s, 0, 0]));
const outline = (out, s, x, [y0, y1], [z0, z1]) => {
  for (const [a, b, c, d] of [[y0, y0 + 0.012, z0, z1], [y1 - 0.012, y1, z0, z1], [y0, y1, z0, z0 + 0.012], [y0, y1, z1 - 0.012, z1]]) sideFace(out, s, x, [a, b], [c, d], seam);
};
// a pane on a raked face between two points of a side profile ([y, z]), across x0..x1, a hair proud
function rake(out, a, b, x0, x1, t0, t1, look = glass) {
  const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d), n = [0, d[1] / l, -d[0] / l];
  const at = (t, x) => [x, a[0] + d[0] * t + n[1] * 0.005, a[1] + d[1] * t + n[2] * 0.005];
  out.push(face([at(t0, x0), at(t0, x1), at(t1, x1), at(t1, x0)], look, n));
  return n;
}

/** The long nose of an aero tractor: one hood over the engine and both fenders, its top falling to its grille, its
 *  sides tucked in at the nose; under it ahead of the wheels its lower nose; the grille in its chrome surround, the
 *  swept lamps at its corners; the wraparound bumper. yN the bumper's face, yG the grille's, yw the cowl (the cab's
 *  face); hw the cab's half width; zH the hood's foot (over the front wheel's top), zB its top at the cowl, zG at the
 *  grille; yf the front axle, r the wheel. */
export function aeroHood(out, { yN, yG, yw, hw, zH, zB, zG, yf, r }) {
  const P = (o) => out.push(...plate(o)), hf = hw - 0.02, hn = hf - 0.16;
  // (the hood: its side a dome falling forward, its plan narrowing to the grille, its section shouldered)
  out.push(...slab({
    side: [[yw, zH], [yG, zH], [yG, zG - 0.1], [yG - 0.3, zG + 0.08], [yw - 0.02, zB]],
    front: [[-hf, zH], [hf, zH], [hf, zB - 0.42], [hf - 0.3, zB], [-hf + 0.3, zB], [-hf, zB - 0.42]],
    plan: [[-hf, yw], [hf, yw], [hf, yf + 0.2], [hn, yG], [-hn, yG], [-hf, yf + 0.2]],
    chamfer: 0.05, crease: 10, look: () => paint('hood'),
  }));
  // (the lower nose ahead of the wheels, from the bumper to the hood's foot, and the fender's skirt behind the wheel)
  const yA = yf + r + 0.12;
  P({ axis: 'x', profile: [[yA, 0.9], [yG - 0.02, 0.9], [yG - 0.02, zH + 0.02], [yA, zH + 0.02]], from: -hn - 0.04, to: hn + 0.04, r: 0.03, seg: 1, look: paint('hood.nose') });
  for (const s of [-1, 1]) {
    // (the skirt behind the wheel, under the cab's front, its leading edge raked with the wheel's arc)
    const ys0 = Math.min(yw - 0.3, yf - r - 0.4), ys1 = yf - r - 0.06;
    P({ axis: 'x', profile: [[ys0, 0.62], [ys1, 0.62], [ys1 + 0.22, zH + 0.02], [ys0, zH + 0.02]], from: s * (hf - 0.4), to: s * hf, r: 0.02, seg: 1, look: paint('fender.skirt') });
    out.push(...guard(yf, r, r + 0.07, 0.25, Math.PI - 0.25, ...xs(s, hf - 0.42, hf - 0.01), black('arch')));
  }
  // (the grille in its surround, its bars; the lamps swept round the hood's front corners; the turn signals)
  const zg0 = 0.98, zg1 = zG - 0.18, gw = hn - 0.34;
  P({ axis: 'y', profile: rect(-gw - 0.06, gw + 0.06, zg0 - 0.06, zg1 + 0.06), from: yG - 0.01, to: yG + 0.025, r: 0.02, seg: 1, look: chrome('grille.surround') });
  P({ axis: 'y', profile: rect(-gw, gw, zg0, zg1), from: yG + 0.015, to: yG + 0.03, look: black('grille') });
  for (let z = zg0 + 0.07; z < zg1 - 0.03; z += 0.085) P({ axis: 'y', profile: rect(-gw + 0.02, gw - 0.02, z, z + 0.022), from: yG + 0.03, to: yG + 0.045, look: chrome('grille.bar') });
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hn - 0.14), yG + 0.002, zH + 0.12], Y, 0.22, 0.2, 'lamp', 'headlamp'));
    out.push(...lamp([s * (hf - 0.08), yf + r + 0.1, zH + 0.08], [s, 0, 0], 0.22, 0.08, 'marker', 'indicator'));
  }
  // (the bumper across the nose and round its corners)
  P({ axis: 'x', profile: [[yG - 0.12, 0.46], [yN - 0.06, 0.46], [yN, 0.54], [yN, 0.8], [yN - 0.06, 0.86], [yG - 0.12, 0.86]], from: -hw + 0.03, to: hw - 0.03, r: 0.05, seg: 2, look: chrome('bumper') });
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.3), yN + 0.002, 0.64], Y, 0.16, 0.08, 'lamp', 'foglamp'));
}

/** The cab behind an aero hood: from its face at the cowl `yw` back to `yb`; a sleeper's (sleeper: true) roof swept up
 *  from the screen's head to `zTop`, a day cab's flat at the screen's head; its screen raked in two panes, its visor,
 *  its doors and their glass, a sleeper's locker door and its side window, the amber lamps along its roof's front; its
 *  anchors (its mirrors' posts, its steps, its grab bars, its number). */
export function aeroCab(out, { yw, yb, hw, z0, zB, zTop, sleeper }) {
  const zS = zB + 0.08, yS = yw - 0.62, zR = zS + 0.95, yR = sleeper ? yw - 2.0 : yS - 0.5, top = sleeper ? zTop : zR + 0.12;
  out.push(...slab({
    side: [[yb, z0], [yw, z0], [yw, zS], [yS, zR], [yR, top], [yb, top]],
    front: [[-hw, z0], [hw, z0], [hw, top - 0.45], [hw - 0.16, top], [-hw + 0.16, top], [-hw, top - 0.45]],
    plan: [[-hw, yb], [hw, yb], [hw, yw - 0.45], [hw - 0.12, yw], [-hw + 0.12, yw], [-hw, yw - 0.45]],
    chamfer: 0.06, crease: 8, look: () => paint('cab'),
  }));
  // (the screen, two panes about its post, a hair proud of the rake; the visor over it; the wipers parked at its foot)
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, 0.035, hw - 0.2);
    rake(out, [yw, zS], [yS, zR], a, b, 0.1, 0.9);
    out.push(...tube([[s * 0.12, yw + 0.02, zS + 0.12], [s * 0.7, yw - 0.02, zS + 0.18]], 0.008, { sides: 6, look: black('wiper') }));
  }
  out.push(...plate({ axis: 'x', profile: [[yS + 0.02, zR - 0.02], [yS + 0.28, zR - 0.1], [yS + 0.3, zR - 0.06], [yS + 0.04, zR + 0.03]], from: -hw + 0.12, to: hw - 0.12, r: 0.01, seg: 1, look: paint('visor') }));
  // (the amber cab lamps along the roof's front, five)
  for (let i = -2; i <= 2; i++) out.push(...lamp([i * 0.3, yS - 0.12, zR + (sleeper ? 0.12 : 0.13)], Z, 0.08, 0.05, 'marker', 'cab.lamp'));
  // the doors: their glass and shut lines, their handles; a sleeper's locker door low behind them and its bunk window
  const yd0 = yw - 0.12, yd1 = yw - 1.18, zw = zS + 0.12;
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.004);
    outline(out, s, x, [yd1, yd0], [z0 + 0.05, zR - 0.08]);
    sideFace(out, s, x + s * 0.001, [yd1 + 0.08, yd0 - 0.2], [zw, zR - 0.18], glass);
    // (the door's quarter glass, a triangle ahead of its post: a fixed pane)
    out.push(face([[x + s * 0.001, yd0 - 0.17, zw], [x + s * 0.001, yd0 - 0.02, zw], [x + s * 0.001, yd0 - 0.17, zR - 0.18]], glass, [s, 0, 0]));
    out.push(...tube(bend([[x, yd1 + 0.12, zw - 0.15], [x + s * 0.03, yd1 + 0.12, zw - 0.15], [x + s * 0.03, yd1 + 0.3, zw - 0.15], [x, yd1 + 0.3, zw - 0.15]], 0.012, 2), 0.01, { sides: 6, look: chrome('door.handle') }));
    if (sleeper) {
      outline(out, s, x, [yb + 0.15, yd1 - 0.12], [z0 + 0.1, z0 + 0.75]);
      sideFace(out, s, x + s * 0.001, [yb + 0.35, yd1 - 0.3], [zR - 0.55, zR - 0.25], glass);
    }
  }
  // the back wall: a day cab's rear window
  if (!sleeper) out.push(face([[-0.45, yb - 0.004, zR - 0.6], [0.45, yb - 0.004, zR - 0.6], [0.45, yb - 0.004, zR - 0.25], [-0.45, yb - 0.004, zR - 0.25]], glass, neg(Y)));
  return [-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `post.${L}`, kind: 'post', at: [s * hw, yd0 - 0.05, zR - 0.4], out: sd, up: Z },
      { id: `sill.${L}`, kind: 'sill', at: [s * (hw - 0.14), yd1 + 0.45, z0 - 0.02], out: sd, up: Z },
      { id: `grab.${L}`, kind: 'flank', at: [s * hw, yd1 - 0.04, zw - 0.1], out: sd, up: Z },
      { id: `mark.cab.${L}`, kind: 'mark', role: 'number', at: [s * (hw + 0.005), (yd0 + yd1) / 2, z0 + 0.32], out: sd, up: Z, h: 0.12 },
    ];
  });
}

/** A tall cab-over: its face nearly upright from its bumper to its roof at `zTop`, its back at `yb`; the screen across
 *  it, its grille, its lamps low in its bumper, its step wells behind its front wheel; its roof spoiler and the side
 *  deflectors that close the gap to the trailer. Its anchors. */
export function euroCab(out, { yN, yb, hw, z0, zTop, yf, r }) {
  const P = (o) => out.push(...plate(o)), yF = yN - 0.08, zS0 = z0 + 1.05, zS1 = zTop - 0.6;
  out.push(...slab({
    side: [[yb, z0], [yF, z0], [yF, zS0], [yF - 0.22, zS1], [yF - 0.42, zTop], [yb, zTop]],
    front: [[-hw, z0], [hw, z0], [hw, zTop - 0.3], [hw - 0.1, zTop], [-hw + 0.1, zTop], [-hw, zTop - 0.3]],
    plan: [[-hw, yb], [hw, yb], [hw, yF - 0.25], [hw - 0.12, yF], [-hw + 0.12, yF], [-hw, yF - 0.25]],
    chamfer: 0.05, crease: 8, look: () => paint('cab'),
  }));
  // (the lower face under the cab's floor, down to the bumper, ahead of the front wheels; the arches' liners and flaps)
  P({ axis: 'x', profile: rect(yf + r + 0.08, yN, 0.38, z0 + 0.02), from: -hw + 0.04, to: hw - 0.04, r: 0.04, seg: 2, look: paint('cab.lower') });
  for (const s of [-1, 1]) {
    out.push(...guard(yf, r, r + 0.07, 0.3, Math.PI - 0.3, ...xs(s, hw - 0.5, hw - 0.04), black('arch')));
    // (the step well behind the wheel: two treads up to the door)
    for (const [z, d] of [[0.5, 0.0], [0.88, 0.06]]) P({ axis: 'z', profile: rect(...xs(s, hw - 0.36 + d, hw - 0.04), yf - r - 0.62, yf - r - 0.12), from: z, to: z + 0.04, r: 0.008, seg: 1, look: alu('step') });
    P({ axis: 'x', profile: rect(yf - r - 0.66, yf - r - 0.08, 0.4, z0 + 0.02), from: s * (hw - 0.4), to: s * (hw - 0.37), look: black('step.well') });
  }
  // (the screen, one pane across the raked face; the grille's slats under it; the lamps in the bumper; the badge plate)
  rake(out, [yF, zS0], [yF - 0.22, zS1], -hw + 0.12, hw - 0.12, 0.05, 0.94);
  for (let k = 0; k < 4; k++) { const z = z0 + 0.15 + k * 0.2; P({ axis: 'y', profile: rect(-hw + 0.3, hw - 0.3, z, z + 0.1), from: yF - 0.01, to: yF + 0.008, look: black('grille') }); }
  P({ axis: 'y', profile: rect(-0.3, 0.3, zS0 - 0.24, zS0 - 0.12), from: yF, to: yF + 0.012, look: chrome('grille.badge') });
  out.push(...tube([[-0.7, yF + 0.02, zS0 + 0.08], [-0.05, yF + 0.02, zS0 + 0.1]], 0.008, { sides: 6, look: black('wiper') }), ...tube([[0.05, yF + 0.02, zS0 + 0.1], [0.7, yF + 0.02, zS0 + 0.08]], 0.008, { sides: 6, look: black('wiper') }));
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hw - 0.32), yN + 0.002, 0.68], Y, 0.36, 0.14, 'lamp', 'headlamp'));
    out.push(...lamp([s * (hw - 0.08), yN + 0.002, 0.68], Y, 0.08, 0.12, 'marker', 'indicator'));
  }
  P({ axis: 'y', profile: rect(-hw + 0.04, hw - 0.04, 0.36, 0.5), from: yN - 0.08, to: yN + 0.01, r: 0.02, seg: 1, look: black('bumper') });
  // (the sun visor over the screen; the roof spoiler, its foot on the roof, its face raked up to the trailer's height;
  // the side deflectors at the cab's back corners)
  P({ axis: 'x', profile: [[yF - 0.42, zTop - 0.02], [yF - 0.2, zTop - 0.12], [yF - 0.18, zTop - 0.06], [yF - 0.42, zTop + 0.02]], from: -hw + 0.1, to: hw - 0.1, r: 0.01, seg: 1, look: paint('visor') });
  const yd0 = yF - 0.25, yd1 = yF - 1.3, zw = zS0 + 0.08;
  for (const s of [-1, 1]) {
    P({ axis: 'x', profile: [[yb - 0.02, z0 + 0.6], [yb + 0.35, z0 + 0.6], [yb + 0.35, zTop - 0.1], [yb - 0.02, zTop - 0.1]], from: s * (hw - 0.02), to: s * (hw + 0.02), r: 0.008, seg: 1, look: paint('deflector') });
    const x = s * (hw + 0.004);
    outline(out, s, x, [yd1, yd0], [z0 + 0.04, zS1 - 0.02]);
    sideFace(out, s, x + s * 0.001, [yd1 + 0.08, yd0 - 0.08], [zw, zS1 - 0.12], glass);
    out.push(...tube(bend([[x, yd1 + 0.12, zw - 0.18], [x + s * 0.03, yd1 + 0.12, zw - 0.18], [x + s * 0.03, yd1 + 0.3, zw - 0.18], [x, yd1 + 0.3, zw - 0.18]], 0.012, 2), 0.01, { sides: 6, look: chrome('door.handle') }));
  }
  return [-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `post.${L}`, kind: 'post', at: [s * hw, yd0 + 0.1, zS1 - 0.35], out: sd, up: Z },
      { id: `grab.${L}`, kind: 'flank', at: [s * hw, yd0 + 0.05, z0 + 0.4], out: sd, up: Z },
      { id: `mark.cab.${L}`, kind: 'mark', role: 'number', at: [s * (hw + 0.005), (yd0 + yd1) / 2, z0 + 0.35], out: sd, up: Z, h: 0.14 },
    ];
  });
}

/** A tractor's chassis: its rails from its bumper to its tail `yE`; its axles; its drive tandem's quarter fenders and
 *  their brackets; a saddle tank each side behind its cab door (its straps, its cap); the fairing along each side from
 *  the tank to the tandem; the deck plate behind the cab and the fifth wheel on its mount at `y5`. */
export function tractorFrame(out, { axles, yN, yE, hw, r, zf = 1.0, tanks, y5, z5 = 1.22, fairing = true, axleHalf = 0.9 }) {
  const P = (o) => out.push(...plate(o)), [, ...drive] = axles, y1 = Math.max(...drive), y2 = Math.min(...drive);
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, 0.4, 0.5), zf - 0.28, zf), from: yE, to: yN - 0.35, r: 0.01, seg: 1, look: dark('frame') });
  for (const y of axles) out.push(...tube([[-axleHalf, y, r], [axleHalf, y, r]], 0.07, { sides: 10, look: M('axle', 'steel', C.steel) }));
  for (const s of [-1, 1]) {
    // (the quarter fenders over the tandem's tyres: one a wheel, poly, on their brackets)
    for (const y of drive) out.push(...guard(y, r, r + 0.06, 0.55, Math.PI - 0.55, ...xs(s, 0.72, hw - 0.01), black('fender.quarter')));
    out.push(...tube([[s * 0.52, (y1 + y2) / 2, zf - 0.1], [s * 0.85, (y1 + y2) / 2, r + r + 0.02]], 0.025, { sides: 6, look: dark('fender.bracket') }));
    if (tanks) {
      const [ya, yb2] = tanks, rt = 0.32, xt = s * (hw - rt - 0.04), zt = 0.72;
      out.push(...tube([[xt, ya, zt], [xt, yb2, zt]], rt, { sides: 18, look: chrome('tank') }));
      for (const y of [ya - 0.12, yb2 + 0.12]) out.push(...tube([[xt, y + 0.025, zt], [xt, y - 0.025, zt]], rt + 0.012, { sides: 18, look: black('tank.strap') }));
      out.push(...tube([[xt, (ya + yb2) / 2, zt + rt - 0.02], [xt, (ya + yb2) / 2, zt + rt + 0.05]], 0.05, { sides: 10, look: chrome('tank.cap') }));
      // (its fairing from the tank's tail to the tandem, closing the gap under the frame)
      if (fairing && yb2 - 0.1 > y1 + r + 0.15) P({ axis: 'x', profile: rect(y1 + r + 0.12, yb2 - 0.05, 0.38, zf + 0.12), from: s * (hw - 0.06), to: s * (hw - 0.02), r: 0.015, seg: 1, look: paint('fairing') });
    }
  }
  // (the deck plate between the cab and the fifth wheel; the fifth wheel's mount, its plate and its throat)
  if (y5 !== undefined) {
    P({ axis: 'z', profile: rect(-0.55, 0.55, y5 - 0.9, y5 + 0.65), from: z5 - 0.18, to: z5 - 0.08, r: 0.015, seg: 1, look: dark('fifthwheel.mount') });
    out.push(...tube([[0, y5, z5 - 0.08], [0, y5, z5]], 0.48, { sides: 20, look: M('fifthwheel', 'steel', '#2b2c2c') }));
    P({ axis: 'z', profile: rect(-0.09, 0.09, y5 - 0.52, y5 - 0.1), from: z5 - 0.002, to: z5 + 0.004, look: black('fifthwheel.throat') });
  }
}

/** Twin exhaust stacks at a sleeper's back corners: each pipe from the frame up past the roof, its heat shield, its
 *  curved tip. */
export function stacks(out, { y, x, z0, z1 }) {
  for (const s of [-1, 1]) {
    out.push(...tube(bend([[s * x, y, z0], [s * x, y, z1 - 0.12], [s * x, y - 0.1, z1]], 0.1, 3), 0.075, { sides: 12, look: chrome('stack') }));
    out.push(...tube([[s * x, y, z0 + 0.6], [s * x, y, z0 + 1.6]], 0.095, { sides: 12, look: M('stack.shield', 'steel', HC.alu) }));
  }
}

// a log in the bundle: its girth and its offset from its index, deterministic (no dice)
const girth = (i) => 0.17 + 0.07 * ((i * 7) % 5) / 4;
/** Logs on a trailer's bunks: rows of them bundled between the stakes, their bark, their cut ends; strapped. */
export function logLoad(out, { y0, y1, hw, z0, rows = 4 }) {
  const per = Math.floor((2 * hw - 0.1) / 0.42);
  let n = 0;
  for (let row = 0; row < rows; row++) {
    const k = per - (row === rows - 1 ? 1 : 0), z = z0 + 0.22 + row * 0.38, w0 = -((k - 1) * 0.42) / 2;
    for (let i = 0; i < k; i++, n++) {
      const rr = girth(n), x = w0 + i * 0.42 + (row % 2 ? 0.05 : -0.05), a = y0 + ((n * 3) % 4) * 0.1, b = y1 - ((n * 5) % 4) * 0.12;
      out.push(...tube([[x, a, z + rr - 0.2], [x, b, z + rr - 0.2]], rr, { sides: 10, look: (role) => (role === 'cap' ? M('log.end', 'plate', HC.heart) : M('log', 'canvas', HC.bark)) }));
    }
  }
  return z0 + 0.22 + rows * 0.38;
}

/**
 * A trailer, its kingpin at `yK` on a fifth wheel at `z5`: its nose `yNose`, its tail `yT`, its half width `hw`, its
 * height `H`; `axles` its own (their tyres' radius r). Its body by kind:
 *   van        a dry van: aluminium skin on its posts, its rails, its swing doors and their locking bars, its skirts
 *   reefer     the van and its fridge unit on its nose, its fuel tank under its floor
 *   container  a container on a skeleton chassis: its corrugations, its corner castings, its doors
 *   curtain    a curtain-sider: its roof and rails, its curtains and their straps, its headboard and its rear doors
 *   tanker     a tank barrel on its cradles: its rings, its walkway, its hatches and its rear ladder
 *   flatbed    a deck of timber in its steel frame, its stake pockets; its load (crates under a tarp, strapped) unless
 *              `empty`
 *   log        a log trailer: bunks and stakes along a frame; its logs unless `empty`
 * Each its floor's cross-members, its landing gear, its tandem's subframe, its under-run bar, its lamps and its
 * conspicuity tape. Its anchors (its flaps behind its last axle). Returns { anchors, top } (top: its load's height).
 */
export function trailer(out, { kind, yNose, yT, yK, hw: W2, H, axles, r, z5 = 1.22, empty = false, zDeck }) {
  // (its skin inside the legal width by what stands proud of it: its rails, its tape, its side markers)
  const hw = W2 - 0.036;
  const P = (o) => out.push(...plate(o)), zF = zDeck ?? z5 + 0.08, last = Math.min(...axles), first = Math.max(...axles), anchors = [];
  const skeleton = kind === 'container' || kind === 'log', boxed = ['van', 'reefer', 'container', 'curtain'].includes(kind);
  // the kingpin and its upper coupler plate; the main beams from the nose to the tail (a skeleton's narrow, a van's under
  // its floor)
  out.push(...tube([[0, yK, z5 - 0.08], [0, yK, zF]], 0.045, { sides: 10, look: M('kingpin', 'steel', C.steel) }));
  P({ axis: 'z', profile: rect(-0.6, 0.6, yK - 0.6, yNose - 0.05), from: z5, to: zF, r: 0.01, seg: 1, look: dark('coupler') });
  const zb = kind === 'tanker' ? zF : zF - 0.02;
  if (kind !== 'tanker') for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, skeleton ? 0.38 : 0.45, skeleton ? 0.5 : 0.55), zb - 0.42, zb), from: yT + 0.1, to: yNose - 0.1, r: 0.01, seg: 1, look: dark('trailer.beam') });
  // the tandem's subframe and its slider rails, its axles' hangers
  P({ axis: 'y', profile: rect(-0.55, 0.55, r + 0.22, zF - 0.3), from: last - 0.7, to: first + 0.7, r: 0.01, seg: 1, look: dark('subframe') });
  for (const y of axles) out.push(...tube([[-0.92, y, r], [0.92, y, r]], 0.065, { sides: 10, look: M('axle', 'steel', C.steel) }));
  // the landing gear: two legs and their brace, their sand shoes, the crank handle
  const yL = yK - 1.8;
  for (const s of [-1, 1]) {
    P({ axis: 'z', profile: rect(...xs(s, 0.62, 0.74), yL - 0.06, yL + 0.06), from: 0.22, to: zF - 0.42, r: 0.01, seg: 1, look: dark('landing.leg') });
    P({ axis: 'z', profile: rect(...xs(s, 0.52, 0.84), yL - 0.18, yL + 0.18), from: 0.0, to: 0.05, r: 0.01, seg: 1, look: dark('landing.shoe') });
  }
  out.push(...tube([[-0.68, yL, 0.55], [0.68, yL, zF - 0.5]], 0.025, { sides: 6, look: dark('landing.brace') }), ...tube([[0.74, yL, zF - 0.6], [hw - 0.05, yL, zF - 0.6], [hw - 0.05, yL + 0.2, zF - 0.78]], 0.015, { sides: 6, look: dark('landing.crank') }));
  // the under-run bar at the tail, striped; the lamps; the flaps' anchors behind the last axle
  P({ axis: 'x', profile: rect(yT + 0.15, yT + 0.3, 0.45, 0.6), from: -hw + 0.15, to: hw - 0.15, r: 0.012, seg: 1, look: dark('underrun') });
  for (const s of [-1, 1]) out.push(...tube([[s * 0.5, yT + 0.22, 0.6], [s * 0.5, yT + 0.6, zF - 0.42]], 0.035, { sides: 6, look: dark('underrun.strut') }));
  out.push(...stripes({ o: [hw - 0.15, yT + 0.15, 0.45], u: neg(X), v: Z, w: 2 * hw - 0.3, h: 0.15, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], part: 'underrun.stripe' }));
  for (const s of [-1, 1]) {
    const L = s < 0 ? 'L' : 'R';
    anchors.push({ id: `flap.${L}`, kind: 'flap', at: [s * 1.0, last - r - 0.15, zF - 0.42], out: neg(Y), up: Z });
  }
  // the body by its kind
  let top = zF;
  if (boxed) {
    const curtain = kind === 'curtain', skin = curtain ? M('curtain', 'canvas', HC.curtain) : kind === 'container' ? own('container', HC.container, 'plate') : own('van', HC.van, 'plate');
    const zb0 = kind === 'container' ? zF + 0.05 : zF, yB = kind === 'container' ? yT + 0.4 : yT;
    // (the box: its nose rounded at the corners; a curtain-sider's roof and headboard its own, its sides fabric)
    P({ axis: 'y', profile: rect(-hw + 0.01, hw - 0.01, zb0, H - 0.01), from: yB, to: yNose, r: kind === 'container' ? 0.02 : 0.05, seg: 1, look: skin });
    top = H;
    for (const s of [-1, 1]) {
      const x = s * (hw - 0.004);
      if (kind === 'container') {
        // (the corrugations, its corner castings, its door's locking bars)
        for (let y = yB + 0.25; y < yNose - 0.15; y += 0.28) P({ axis: 'x', profile: rect(y - 0.07, y + 0.07, zb0 + 0.12, H - 0.12), from: s * (hw - 0.012), to: s * (hw + 0.012), look: own('container.rib', HC.container, 'plate') });
        for (const [y, z] of [[yB, zb0], [yB, H - 0.17], [yNose - 0.17, zb0], [yNose - 0.17, H - 0.17]]) P({ axis: 'x', profile: rect(y, y + 0.17, z, z + 0.17), from: s * (hw - 0.02), to: s * (hw + 0.012), look: dark('container.casting') });
      } else if (curtain) {
        // (the curtain's top and bottom rails, its straps and buckles down its foot, its poles at the posts)
        for (const z of [zb0 + 0.02, H - 0.12]) P({ axis: 'y', profile: rect(...xs(s, hw - 0.03, hw + 0.012), z, z + 0.1), from: yB + 0.02, to: yNose - 0.02, r: 0.01, seg: 1, look: alu('curtain.rail') });
        for (let y = yB + 0.4; y < yNose - 0.2; y += 0.55) sideFace(out, s, x + s * 0.018, [y - 0.025, y + 0.025], [zb0 + 0.12, zb0 + 0.75], own('curtain.strap', '#c9a227', 'canvas'));
        for (let y = yB + 3.4; y < yNose - 1; y += 3.4) sideFace(out, s, x + s * 0.016, [y - 0.04, y + 0.04], [zb0 + 0.12, H - 0.12], own('curtain.pole', '#2d3e57', 'canvas'));
      } else {
        // (a van's posts, its top and bottom rails, the skirt under it from the landing gear to the tandem)
        for (let y = yB + 0.6; y < yNose - 0.2; y += 0.6) sideFace(out, s, x + s * 0.008, [y - 0.018, y + 0.018], [zb0 + 0.08, H - 0.1], own('van.post', HC.vanPost, 'steel'));
        for (const z of [zb0, H - 0.1]) P({ axis: 'y', profile: rect(...xs(s, hw - 0.015, hw + 0.012), z, z + 0.1), from: yB, to: yNose, r: 0.01, seg: 1, look: alu('van.rail') });
        P({ axis: 'x', profile: rect(first + r + 0.25, yL - 0.3, 0.38, zF - 0.02), from: s * (hw - 0.07), to: s * (hw - 0.04), r: 0.01, seg: 1, look: own('skirt', '#d9dad8', 'plate') });
      }
      // (the conspicuity tape along its foot, red and white; its side markers)
      out.push(...stripes({ o: [x + s * 0.016, s > 0 ? yB + 0.05 : yNose - 0.05, zb0 + 0.12], u: s > 0 ? Y : neg(Y), v: Z, w: yNose - yB - 0.1, h: 0.05, n: [s, 0, 0], colours: [CC.reflRed, CC.reflWhite], pitch: 0.3, part: 'tape' }));
      for (const y of [yNose - 0.15, (yNose + yB) / 2, yB + 0.15]) out.push(...lamp([x + s * 0.02, y, zb0 + 0.3], [s, 0, 0], 0.08, 0.05, 'marker', 'side.marker'));
    }
    // (its rear: two swing doors, their hinges and their locking bars, its lamps, its tape; a container's own)
    const yR = yB - 0.004;
    out.push(face([[-0.006, yR - 0.002, zb0 + 0.06], [0.006, yR - 0.002, zb0 + 0.06], [0.006, yR - 0.002, H - 0.12], [-0.006, yR - 0.002, H - 0.12]], seam, neg(Y)));
    for (const x of [-0.75, -0.3, 0.3, 0.75]) out.push(...tube([[x, yR - 0.03, zb0 + 0.12], [x, yR - 0.03, H - 0.14]], 0.022, { sides: 6, look: chrome('door.bar') }));
    for (const s of [-1, 1]) {
      for (const z of [zb0 + 0.4, H - 0.6]) P({ axis: 'z', profile: rect(...xs(s, hw - 0.12, hw - 0.02), yR - 0.03, yR), from: z, to: z + 0.1, look: chrome('door.hinge') });
      out.push(...lamp([s * (hw - 0.22), yT - 0.004, 0.75], neg(Y), 0.14, 0.14, 'tail', 'taillamp'));
      out.push(...lamp([s * (hw - 0.42), yT - 0.004, 0.75], neg(Y), 0.12, 0.1, 'marker', 'indicator'));
    }
    out.push(...stripes({ o: [hw - 0.06, yR - 0.006, zb0 + 0.05], u: neg(X), v: Z, w: 2 * hw - 0.12, h: 0.05, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], pitch: 0.3, part: 'tape' }));
    for (let i = -2; i <= 2; i++) out.push(...lamp([i * 0.25, yR, H - 0.08], neg(Y), 0.06, 0.04, 'tail', 'id.lamp'));
    // (a reefer's fridge unit on its nose, its grille and its fans; its fuel tank under the floor)
    if (kind === 'reefer') {
      P({ axis: 'y', profile: rect(-0.95, 0.95, H - 1.75, H - 0.2), from: yNose, to: yNose + 0.42, r: 0.06, seg: 2, look: own('reefer', HC.reefer, 'plate') });
      P({ axis: 'y', profile: rect(-0.8, 0.8, H - 1.55, H - 0.95), from: yNose + 0.42, to: yNose + 0.43, look: black('reefer.grille') });
      for (const x of [-0.42, 0.42]) out.push(...tube([[x, yNose + 0.42, H - 0.6], [x, yNose + 0.44, H - 0.6]], 0.22, { sides: 16, look: black('reefer.fan') }));
      out.push(...tube([[0.7, yL - 1.0, zF - 0.6], [0.7, yL - 2.2, zF - 0.6]], 0.22, { sides: 12, look: alu('reefer.tank') }));
    }
    // (a curtain-sider's headboard and its rear frame's posts)
    if (curtain) P({ axis: 'y', profile: rect(-hw + 0.02, hw - 0.02, zb0, H), from: yNose - 0.06, to: yNose + 0.01, r: 0.02, seg: 1, look: alu('headboard') });
  } else if (kind === 'tanker') {
    // the barrel on its cradles, its rings, its walkway and handrail on top, its hatches, its rear ladder, its valves
    const R = Math.min(hw - 0.08, (H - zF - 0.1) / 2), zc = H - R, y0 = yT + 0.5, y1 = yNose - 0.2;
    out.push(...tube([[0, y0, zc], [0, y1, zc]], R, { sides: 24, look: own('tanker', HC.tank, 'alloy') }));
    for (let y = y0 + 1.6; y < y1 - 0.5; y += 1.6) out.push(...tube([[0, y - 0.03, zc], [0, y + 0.03, zc]], R + 0.012, { sides: 24, look: own('tanker.ring', '#b2b7bb', 'alloy') }));
    for (const [ya, yb2] of [[yK - 0.6, yNose - 0.05], [last - 0.8, first + 0.8]]) P({ axis: 'y', profile: [[-0.6, zF - 0.4], [0.6, zF - 0.4], [0.75, zc - R * 0.55], [-0.75, zc - R * 0.55]], from: ya, to: yb2, r: 0.01, seg: 1, look: dark('tanker.cradle') });
    P({ axis: 'z', profile: rect(-0.32, 0.32, y0 + 0.6, y1 - 0.6), from: H - 0.02, to: H + 0.02, r: 0.005, seg: 1, look: alu('tanker.walkway') });
    for (let y = y0 + 1.2; y < y1 - 0.8; y += 2.6) out.push(...tube([[0, y, H - 0.02], [0, y, H + 0.1]], 0.25, { sides: 16, look: alu('tanker.hatch') }));
    for (const s of [-1, 1]) out.push(...tube([[s * 0.34, y1 - 0.6, H + 0.02], [s * 0.34, y1 - 0.6, H + 0.42], [s * 0.34, y0 + 0.6, H + 0.42], [s * 0.34, y0 + 0.6, H + 0.02]], 0.014, { sides: 6, look: alu('tanker.rail') }));
    for (const s of [-1, 1]) out.push(...tube([[s * 0.22, y0 - 0.1, 0.9], [s * 0.22, y0 - 0.1, H - 0.1]], 0.016, { sides: 6, look: alu('tanker.ladder') }));
    for (let z = 1.0; z < H - 0.2; z += 0.3) out.push(...tube([[-0.22, y0 - 0.1, z], [0.22, y0 - 0.1, z]], 0.012, { sides: 6, look: alu('tanker.ladder') }));
    out.push(...tube([[0, y0 + 2.5, zc - R], [0, y0 + 2.5, zF - 0.3], [0.9, y0 + 2.5, zF - 0.3]], 0.05, { sides: 10, look: alu('tanker.valve') }));
    for (const s of [-1, 1]) {
      out.push(...lamp([s * (hw - 0.22), yT + 0.15, 0.8], neg(Y), 0.14, 0.14, 'tail', 'taillamp'));
      P({ axis: 'z', profile: rect(...xs(s, 0.3, hw - 0.02), last - r - 0.1, first + r + 0.1), from: r * 2 + 0.06, to: r * 2 + 0.1, r: 0.01, seg: 1, look: alu('fender') });
    }
    P({ axis: 'y', profile: rect(-hw + 0.1, hw - 0.1, 0.7, 0.95), from: yT + 0.15, to: yT + 0.5, r: 0.01, seg: 1, look: dark('tanker.bumper') });
    top = H + 0.42;
  } else {
    // a deck: its frame and its timber planks, its stake pockets, its rub rail; a log trailer's bunks and stakes
    if (kind === 'flatbed') {
      P({ axis: 'z', profile: rect(-hw + 0.02, hw - 0.02, yT, yNose), from: zF - 0.1, to: zF + 0.04, r: 0.01, seg: 1, look: dark('deck.frame') });
      for (let x = -hw + 0.08; x < hw - 0.1; x += 0.16) P({ axis: 'z', profile: rect(x, Math.min(x + 0.15, hw - 0.08), yT + 0.05, yNose - 0.05), from: zF + 0.04, to: zF + 0.08, look: own('deck', HC.deck, 'canvas') });
      for (const s of [-1, 1]) {
        P({ axis: 'y', profile: rect(...xs(s, hw - 0.06, hw), zF - 0.18, zF + 0.08), from: yT, to: yNose, r: 0.01, seg: 1, look: dark('deck.rail') });
        for (let y = yT + 0.5; y < yNose - 0.2; y += 0.6) P({ axis: 'z', profile: rect(...xs(s, hw - 0.01, hw + 0.03), y - 0.05, y + 0.05), from: zF - 0.16, to: zF + 0.06, look: dark('stake.pocket') });
        out.push(...lamp([s * (hw - 0.2), yT - 0.004, zF - 0.1], neg(Y), 0.14, 0.12, 'tail', 'taillamp'));
      }
      top = zF + 0.08;
      if (!empty) {
        // (its load: crates in a row under a tarp, strapped over the tarp to the rails)
        const n = Math.floor((yNose - yT - 1.0) / 1.25), zc = zF + 0.08;
        for (let i = 0; i < n; i++) {
          const y = yNose - 0.5 - i * 1.25;
          P({ axis: 'z', profile: rect(-hw + 0.15, hw - 0.15, y - 1.15, y), from: zc, to: zc + 0.12, r: 0.01, seg: 1, look: own('pallet', HC.crate, 'canvas') });
          P({ axis: 'z', profile: rect(-hw + 0.18, hw - 0.18, y - 1.12, y - 0.03), from: zc + 0.12, to: zc + 1.25, r: 0.03, seg: 1, look: M('tarp', 'canvas', HC.tarp) });
          for (const t of [0.3, 0.8]) out.push(...tube([[-hw - 0.01, y - t, zF], [-hw + 0.17, y - t, zc + 1.26], [hw - 0.17, y - t, zc + 1.26], [hw + 0.01, y - t, zF]], 0.012, { sides: 4, look: M('strap', 'canvas', HC.strap) }));
        }
        top = zc + 1.27;
      }
    } else {
      // (a log trailer: its bunks across its frame, a stake up each end of each, its logs bundled between)
      const bunks = [yNose - 0.4, yNose - (yNose - yT) * 0.36, last + 0.2, yT + 0.25];
      for (const y of bunks) {
        P({ axis: 'x', profile: rect(y - 0.12, y + 0.12, zF - 0.02, zF + 0.16), from: -hw + 0.02, to: hw - 0.02, r: 0.01, seg: 1, look: dark('bunk') });
        for (const s of [-1, 1]) P({ axis: 'z', profile: rect(...xs(s, hw - 0.12, hw - 0.02), y - 0.06, y + 0.06), from: zF + 0.16, to: H - 0.15, r: 0.01, seg: 1, look: dark('stake') });
      }
      for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.2), yT + 0.1, zF - 0.1], neg(Y), 0.14, 0.12, 'tail', 'taillamp'));
      top = zF + 0.16;
      if (!empty) {
        top = logLoad(out, { y0: yT + 0.02, y1: yNose - 0.1, hw: hw - 0.13, z0: zF + 0.16, rows: Math.max(1, Math.floor((H - zF - 0.4) / 0.38)) });
        for (const y of [bunks[1] + 1.2, bunks[2] + 1.2]) out.push(...tube([[-hw + 0.1, y, zF + 0.16], [-hw + 0.1, y, top - 0.05], [hw - 0.1, y, top - 0.05], [hw - 0.1, y, zF + 0.16]], 0.012, { sides: 4, look: M('strap', 'canvas', HC.strap) }));
      }
    }
  }
  return { anchors, top };
}

export { CC, own, stripes, band, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, C, black, chrome, glass, seam, sideFace, outline, rake };
