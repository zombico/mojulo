/**
 * THE AIRCRAFT DETAIL KIT, its parts: the made detail a craft's part builders (craft-parts.js) add under the made finish,
 * as the shelf's own monomers (lathes, sweeps, extrudes, lofts in metres), so the assembler places them with their part
 * and the form render (craft-form.js) reads their slots from their tints. Each is a function of its place and its size,
 * never of a seed: a part number always makes the same part.
 *
 *   rolledLip(id, centre, axis, R, r, tint)            an intake's or a nozzle's lip: a ring of radius R, its section r
 *   hingeLine(id, a, b, tint, { r?, knuckles? })        a control surface's hinge: its gap a dark rod, knuckles along it
 *   panelDoor(id, origin, u, v, { w, h, t?, hinge?, tint, metal })   a door (a gear's, a bay's): a plate w by h from
 *                                                       origin along u and v, its hinge knuckles along one edge and an
 *                                                       actuator rod to its middle
 *   wellBox(id, centre, { w, d, h }, { primer, metal })  a gear's well: an open box up into the body, ribbed, its plumbing
 *   treadTyre(id, hub, axis, { D, W, grooves? }, { rubber, metal })   an aircraft tyre: its ribs and grooves round it, the
 *                                                       wheel's hub and its brake disc
 *   petalNozzle(id, from, to, { R0, R1, n?, gap? }, { metal, dark, hot })   a variable nozzle: n petals with gaps, the
 *                                                       flameholder rings and spray bars dark inside, a heat-tinted ring
 *   coveredLight(id, at, normal, { r?, light, glass })   a nav light or a beacon in its clear cover
 *   blister(id, at, normal, along, { len, wid, h, tint })  a fairing or a sensor bump on the skin
 *   blade(id, at, up, along, { len, chord, rake?, tint })  a blade antenna, raked
 *
 * Craft space: +y forward, +z up, +x right, metres. Pure.
 */
import { lathe, sweep, extrudeWorld, round3 } from './craft-common.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = (v) => { const d = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// two directions square to an axis
const basis = (axis) => { const a = unit(axis), u = unit(Math.abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0])); return [u, cross(a, u)]; };
const circle = (c, axis, R, k = 24) => { const [u, v] = basis(axis); return Array.from({ length: k + 1 }, (_, i) => { const t = (2 * Math.PI * i) / k; return add(c, add(mul(u, R * Math.cos(t)), mul(v, R * Math.sin(t)))); }); };
// a flat quad's offsets square to its extrude axis (planeUV's world offsets): w along u, h along v, centred
const rectOffsets = (u, v, w, h) => [add(mul(u, w / 2), mul(v, h / 2)), add(mul(u, -w / 2), mul(v, h / 2)), add(mul(u, -w / 2), mul(v, -h / 2)), add(mul(u, w / 2), mul(v, -h / 2))];

export function rolledLip(id, centre, axis, R, r, tint) {
  return { sweeps: [sweep(id, circle(centre, axis, R, 32), r, tint, { sides: 8 })] };
}

export function hingeLine(id, a, b, tint, { r = 0.009, knuckles = 0, metal = tint } = {}) {
  const sweeps = [sweep(`${id}_gap`, [a, b], r, tint, { sides: 6 })];
  for (let k = 1; k <= knuckles; k++) {
    const t = k / (knuckles + 1), p = add(a, mul(add(b, mul(a, -1)), t)), d = unit(add(b, mul(a, -1)));
    sweeps.push(sweep(`${id}_knuckle_${k}`, [add(p, mul(d, -0.03)), add(p, mul(d, 0.03))], r * 2.2, metal, { sides: 8 }));
  }
  return { sweeps };
}

export function panelDoor(id, origin, u, v, { w, h, t = 0.012, hinge = 'u0', tint, metal }) {
  const U = unit(u), V = unit(v), N = unit(cross(U, V)), c = add(origin, add(mul(U, w / 2), mul(V, h / 2)));
  const extrudes = [extrudeWorld(id, add(c, mul(N, -t / 2)), add(c, mul(N, t / 2)), rectOffsets(U, V, w, h), tint)];
  // (its hinge along one edge, knuckles on it; the actuator from inside to its middle)
  const [a, b] = hinge === 'u0' ? [origin, add(origin, mul(U, w))] : [origin, add(origin, mul(V, h))];
  const sweeps = [...hingeLine(`${id}_hinge`, a, b, metal, { r: 0.01, knuckles: 3 }).sweeps];
  sweeps.push(sweep(`${id}_actuator`, [add(a, add(mul(N, -0.15), mul(hinge === 'u0' ? U : V, 0.2))), add(c, mul(N, -0.02))], 0.012, metal, { sides: 6 }));
  return { extrudes, sweeps };
}

export function wellBox(id, centre, { w, d, h }, { primer, metal }) {
  // (the box's four walls and its roof, open below; ribs across its roof; a line of plumbing along a wall)
  const [x, y, z] = centre, t = 0.01, extrudes = [], sweeps = [];
  const wall = (k, from, to, off) => extrudes.push(extrudeWorld(`${id}_${k}`, from, to, off, primer));
  wall('front', [x, y + d / 2, z], [x, y + d / 2 - t, z], [[w / 2, 0, 0], [-w / 2, 0, 0], [-w / 2, 0, h], [w / 2, 0, h]]);
  wall('back', [x, y - d / 2 + t, z], [x, y - d / 2, z], [[w / 2, 0, 0], [-w / 2, 0, 0], [-w / 2, 0, h], [w / 2, 0, h]]);
  wall('left', [x - w / 2, y, z], [x - w / 2 + t, y, z], [[0, d / 2, 0], [0, -d / 2, 0], [0, -d / 2, h], [0, d / 2, h]]);
  wall('right', [x + w / 2 - t, y, z], [x + w / 2, y, z], [[0, d / 2, 0], [0, -d / 2, 0], [0, -d / 2, h], [0, d / 2, h]]);
  wall('roof', [x, y, z + h - t], [x, y, z + h], [[w / 2, d / 2, 0], [-w / 2, d / 2, 0], [-w / 2, -d / 2, 0], [w / 2, -d / 2, 0]]);
  for (let k = 1; k < 4; k++) { const yy = y - d / 2 + (d * k) / 4; extrudes.push(extrudeWorld(`${id}_rib_${k}`, [x - w / 2 + t, yy, z + h - t], [x + w / 2 - t, yy, z + h - t], [[0, 0.012, 0], [0, -0.012, 0], [0, -0.012, -0.05], [0, 0.012, -0.05]], primer)); }
  for (let k = 0; k < 2; k++) sweeps.push(sweep(`${id}_pipe_${k}`, [[x - w / 2 + 0.03 + k * 0.035, y + d / 2 - 0.03, z + 0.05], [x - w / 2 + 0.03 + k * 0.035, y + d / 2 - 0.03, z + h - 0.03], [x - w / 2 + 0.03 + k * 0.035, y - d / 2 + 0.03, z + h - 0.03]], 0.008, metal, { sides: 6 }));
  return { extrudes, sweeps };
}

export function treadTyre(id, hub, axis, { D, W, grooves = 3 }, { rubber, metal }) {
  const A = unit(axis), R = D / 2, from = add(hub, mul(A, -W / 2)), to = add(hub, mul(A, W / 2));
  // (its section: the bead in at the rim, the shoulders rounded, its tread ribbed by grooves round it)
  const pairs = [[0, R * 0.62], [0.06, R * 0.86], [0.14, R * 0.97]];
  for (let g = 0; g <= grooves; g++) {
    const t0 = 0.18 + (0.64 * g) / (grooves + 1), t1 = 0.18 + (0.64 * (g + 1)) / (grooves + 1);
    pairs.push([t0 + 0.01, R], [t1 - 0.035, R], ...(g < grooves ? [[t1 - 0.025, R * 0.975], [t1 - 0.005, R * 0.975]] : []));
  }
  pairs.push([0.86, R * 0.97], [0.94, R * 0.86], [1, R * 0.62]);
  const lathes = [lathe(`${id}_tyre`, from, to, pairs, rubber, { samples: 24, crossSections: pairs.length })];
  // (the wheel: its hub, its bolts' boss, the brake disc inboard)
  lathes.push(lathe(`${id}_hub`, add(hub, mul(A, -W * 0.42)), add(hub, mul(A, W * 0.45)), [[0, R * 0.6], [0.2, R * 0.58], [0.8, R * 0.58], [1, R * 0.3]], metal, { samples: 20 }));
  lathes.push(lathe(`${id}_brake`, add(hub, mul(A, -W * 0.48)), add(hub, mul(A, -W * 0.4)), [[0, R * 0.52], [1, R * 0.52]], metal, { samples: 20 }));
  return { lathes };
}

export function petalNozzle(id, from, to, { R0, R1, n = 14, gap = 0.25 }, { metal, dark, hot }) {
  const A = unit(add(to, mul(from, -1))), L = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]), [u, v] = basis(A), extrudes = [], sweeps = [];
  for (let k = 0; k < n; k++) {
    const t = ((k + 0.5) * 2 * Math.PI) / n, half = (Math.PI / n) * (1 - gap), dir = (r, a) => add(mul(u, r * Math.cos(a)), mul(v, r * Math.sin(a)));
    // (a petal: a flat plate from the throat's ring to the exit's, its edges a gap from its neighbours')
    const p0 = add(from, dir(R0, t - half)), p1 = add(from, dir(R0, t + half)), p2 = add(to, dir(R1, t + half)), p3 = add(to, dir(R1, t - half));
    const mid = mul(add(add(p0, p1), add(p2, p3)), 0.25), N = unit(dir(1, t));
    extrudes.push({ ...extrudeWorld(`${id}_petal_${k}`, add(mid, mul(N, -0.006)), add(mid, mul(N, 0.006)), [p0, p1, p2, p3].map((p) => add(p, mul(mid, -1))), metal) });
    // (its actuator rod along it, outside)
    sweeps.push(sweep(`${id}_rod_${k}`, [add(from, dir(R0 + 0.04, t)), add(add(from, mul(A, L * 0.7)), dir((R0 + (R1 - R0) * 0.7) + 0.03, t))], 0.009, metal, { sides: 5 }));
  }
  // (inside: the flameholder's rings and the spray bars across them, dark; a heat-tinted ring at the throat)
  for (const [k, f] of [[0, 0.45], [1, 0.7]]) sweeps.push(sweep(`${id}_holder_${k}`, circle(add(from, mul(A, -L * f)), A, R0 * (0.75 - 0.25 * k), 20), 0.012, dark, { sides: 6 }));
  for (let k = 0; k < 6; k++) { const t = (k * Math.PI) / 3, c = add(from, mul(A, -L * 0.45)); sweeps.push(sweep(`${id}_bar_${k}`, [c, add(c, add(mul(u, R0 * 0.75 * Math.cos(t)), mul(v, R0 * 0.75 * Math.sin(t))))], 0.008, dark, { sides: 5 })); }
  const lathes = [lathe(`${id}_throat`, add(from, mul(A, -0.08)), from, [[0, R0 * 1.02], [1, R0 * 1.02]], hot, { samples: 24 })];
  return { extrudes, sweeps, lathes };
}

export function coveredLight(id, at, normal, { r = 0.045, light, glass }) {
  const N = unit(normal);
  return {
    lathes: [
      lathe(`${id}_bulb`, add(at, mul(N, -0.005)), add(at, mul(N, r * 0.5)), [[0, r * 0.45], [1, r * 0.2]], light, { samples: 10, crossSections: 2 }),
      lathe(`${id}_cover`, at, add(at, mul(N, r * 0.9)), [[0, r], [0.5, r * 0.9], [1, r * 0.2]], glass, { samples: 14, crossSections: 3, material: 'glass' }),
    ],
  };
}

export function blister(id, at, normal, along, { len, wid, h, tint }) {
  const N = unit(normal), A = unit(along), from = add(at, mul(A, len / 2)), to = add(at, mul(A, -len / 2));
  // (a teardrop lathed along its length, its axis sunk into the skin so it stands h proud of it: a fairing, a sensor bump)
  const s = (t) => Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.6, sink = mul(N, h - wid / 2);
  return { lathes: [lathe(id, add(from, sink), add(to, sink), Array.from({ length: 9 }, (_, i) => [i / 8, Math.max(0.004, (wid / 2) * s(i / 8))]), tint, { samples: 14 })] };
}

export function blade(id, at, up, along, { len, chord, rake = 0.35, tint }) {
  const U = unit(up), A = unit(along), S = unit(cross(A, U));
  // (its root on the skin, its tip raked aft, thin across)
  const root = [add(at, mul(A, chord / 2)), add(at, mul(A, -chord / 2))], tip = [add(add(at, mul(U, len)), mul(A, -rake * len + chord * 0.2)), add(add(at, mul(U, len)), mul(A, -rake * len - chord * 0.15))];
  const c = mul(add(add(root[0], root[1]), add(tip[0], tip[1])), 0.25);
  return { extrudes: [extrudeWorld(id, add(c, mul(S, -0.006)), add(c, mul(S, 0.006)), [root[0], root[1], tip[1], tip[0]].map((p) => add(p, mul(c, -1))), tint)] };
}

/** Several kit pieces' monomers merged into one workbench source's lists. */
export function mergeKit(...pieces) {
  const out = { lathes: [], sweeps: [], extrudes: [], lofts: [] };
  for (const p of pieces) for (const k of Object.keys(out)) if (p?.[k]) out[k].push(...p[k]);
  return out;
}

export const KIT_PRECISION = round3;

/**
 * A fighter's cockpit seen through its canopy, built up from a deck laid over the hull's top inside the canopy (the hull
 * is a closed skin: what is under it is never seen), every piece fitted to the canopy's own section where it stands:
 * the side consoles, the coaming and its glare shield over the instrument panel (two displays, dials), the HUD's
 * combiner on its posts, the stick, the ejection seat (its back, its headrest, the yellow pull handle on top, its rails
 * behind). `front` is where the canopy begins (+y the nose), `len` its length aft, `deck` the deck's height, and
 * `fit(f)` → { half, roof }: the canopy's inside half-width and its height over the deck at a fraction f of its length.
 */
export function cockpit(id, { front, len, deck, fit }, { dark, console: con, glass, metal, seat, accent }) {
  const [x0, y0] = front, z = deck, extrudes = [], sweeps = [], lathes = [];
  const yAt = (f) => y0 - f * len;
  const box = (k, xa, xb, fa, fb, za, zb, tint, extra = {}) => { const ya = yAt(fa), yb = yAt(fb); extrudes.push({ ...extrudeWorld(`${id}_${k}`, [(xa + xb) / 2 + x0, ya, za], [(xa + xb) / 2 + x0, ya, zb], [[(xb - xa) / 2, 0, 0], [-(xb - xa) / 2, 0, 0], [-(xb - xa) / 2, yb - ya, 0], [(xb - xa) / 2, yb - ya, 0]], tint), ...extra }); };
  // (the narrower of the canopy's half-widths over a band, and its lower roof: what a piece in the band must fit in)
  const band = (fa, fb) => { const a = fit(fa), b = fit(fb), m = fit((fa + fb) / 2); return { half: Math.min(a.half, b.half, m.half), roof: Math.min(a.roof, b.roof, m.roof) }; };
  // the deck, dark, in bands narrowing to the canopy's ends
  for (const [k, fa, fb] of [[0, 0.22, 0.34], [1, 0.34, 0.5], [2, 0.5, 0.78], [3, 0.78, 0.9]]) { const B = band(fa, fb); if (B.half > 0.05) box(`deck_${k}`, -B.half * 0.92, B.half * 0.92, fa, fb, z - 0.01, z + 0.012, dark); }
  // the coaming over the instrument panel, its glare shield; the panel's two displays and its dials facing aft
  const C = band(0.25, 0.36), zc = z + Math.min(0.24, C.roof * 0.42), hc = C.half * 0.85;
  box('coaming', -hc, hc, 0.25, 0.36, z, zc, dark);
  box('glareshield', -hc * 1.04, hc * 1.04, 0.245, 0.37, zc, zc + 0.018, dark);
  const md = Math.min(0.13, hc * 0.42);
  for (const s of [-1, 1]) box(`mfd_${s > 0 ? 'r' : 'l'}`, s * hc * 0.5 - md / 2, s * hc * 0.5 + md / 2, 0.36, 0.362, z + 0.03, Math.min(zc - 0.02, z + 0.03 + md), glass, { material: 'glass' });
  for (const [k, dx] of [[0, -0.045], [1, 0.045]]) lathes.push(lathe(`${id}_dial_${k}`, [x0 + dx, yAt(0.36) - 0.002, zc - 0.045], [x0 + dx, yAt(0.36) - 0.01, zc - 0.045], [[0, 0.024], [1, 0.02]], metal, { samples: 10, crossSections: 2 }));
  // the HUD's combiner, a pane of tinted glass on two posts over the coaming
  const H = fit(0.3), hh = Math.min(0.12, (H.roof - (zc - z)) * 0.55);
  for (const s of [-1, 1]) sweeps.push(sweep(`${id}_hud_post_${s > 0 ? 'r' : 'l'}`, [[x0 + s * 0.05, yAt(0.28), zc + 0.015], [x0 + s * 0.05, yAt(0.3), zc + hh]], 0.006, metal, { sides: 5 }));
  extrudes.push(extrudeWorld(`${id}_hud`, [x0, yAt(0.3), zc + hh * 0.6], [x0, yAt(0.3) - 0.005, zc + hh * 0.6], [[0.06, 0, -hh * 0.45], [-0.06, 0, -hh * 0.45], [-0.06, 0, hh * 0.45], [0.06, 0, hh * 0.45]], glass, { material: 'glass' }));
  // the side consoles, low along both sides, from the panel back to the seat
  const S = band(0.38, 0.6);
  for (const s of [-1, 1]) box(`console_${s > 0 ? 'r' : 'l'}`, s > 0 ? S.half * 0.55 : -S.half * 0.88, s > 0 ? S.half * 0.88 : -S.half * 0.55, 0.38, 0.6, z, z + Math.min(0.09, S.roof * 0.15), con);
  // the stick between the seat and the panel
  sweeps.push(sweep(`${id}_stick`, [[x0, yAt(0.46), z], [x0, yAt(0.47), z + 0.13]], 0.011, dark, { sides: 6 }));
  sweeps.push(sweep(`${id}_grip`, [[x0, yAt(0.47), z + 0.12], [x0, yAt(0.465), z + 0.18]], 0.018, dark, { sides: 6 }));
  // the ejection seat: its pan, its back raked aft, its headrest under the canopy's roof, the pull handle on top, its rails
  const T = band(0.58, 0.72), top = z + T.roof * 0.86, sw = Math.min(0.2, T.half * 0.62), fb = 0.62;
  box('seat_pan', -sw, sw, 0.52, fb, z, z + 0.06, seat);
  extrudes.push(extrudeWorld(`${id}_seat_back`, [x0, yAt(fb), z], [x0, yAt(fb) - 0.07, z], [[sw, 0, 0], [-sw, 0, 0], [-sw * 0.92, -0.1, top - z - 0.16], [sw * 0.92, -0.1, top - z - 0.16]], seat));
  const ry = (yAt(fb) - 0.1 - y0) / -len;
  box('headrest', -sw * 0.8, sw * 0.8, ry - 0.005, ry + 0.045, top - 0.17, top - 0.025, dark);
  sweeps.push(sweep(`${id}_pull`, [[x0 - 0.06, yAt(ry + 0.01), top - 0.025], [x0 - 0.06, yAt(ry + 0.01), top], [x0 + 0.06, yAt(ry + 0.01), top], [x0 + 0.06, yAt(ry + 0.01), top - 0.025]], 0.008, accent, { sides: 6 }));
  for (const s of [-1, 1]) sweeps.push(sweep(`${id}_rail_${s > 0 ? 'r' : 'l'}`, [[x0 + s * sw * 0.7, yAt(fb) - 0.07, z], [x0 + s * sw * 0.7, yAt(ry + 0.05), top - 0.06]], 0.013, metal, { sides: 6 }));
  return { extrudes, sweeps, lathes };
}
