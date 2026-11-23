/**
 * THE FLEET'S STRUCTURES — the big built things that live in space rather than cross it: the HABITAT CYLINDER (an
 * O'Neill cylinder), the TORUS station (a wheel turning for its gravity) and the RING SHIP (a wheel round a drive
 * spine). Read in the fleet's industrial language (fleet/language.js), and dressed by their USE, civil or military, as
 * the field's vehicles are dressed (car-designer's military kit: plate with rolled and chamfered edges, armour slabs
 * welded on, fittings, stencils), carried past this century's engineering:
 *
 *   CIVIL      a place people live: glazing (the cylinder's window strips, ribbed, the light let in; a wheel's inner
 *              band, its sky), rows of lit windows, mirrors and solar arrays, docks with hazard round them, running
 *              lights, the paint pale with a blue band
 *   MILITARY   a place that is fought from: no glazing, its hull in plates of two tones, armour belts and collars
 *              welded round it (faceted: flat plates, not a turned ring, so their edges catch the light), gun blisters,
 *              lit slits for windows, sensor masts, its hull number stencilled huge on its face, a drive; the paint dark
 *
 * Every structure is a form (fleet/forms.js buildForm): parts the grid cuts into blocks of matter, held by their welds
 * to the reactor, the kibble carrying the detail (dense on a military hull's plates, light on a civil one's).
 *
 *   STRUCTURE_FORMS   cylinder | torus | ringship: each the parts of its shape from its row, by its use
 *   stencil(text, o, right, up, h, color) → quads: a hull number's digits (seven-segment, a dash) on a face
 *
 * Pure and seeded.
 */
import { unit, tint, boxPart, tube, torusRing } from './geometry.js';
import { LIGHTS } from './language.js';

const GLASS = '#5c7e9e';      // a window strip seen from outside: the daylit land under the glass, lit
const MIRROR = '#b4c0c8';
const ARRAY = '#22385a';      // a solar cell's blue
// (a stencil's paint: dark on a light hull, light on a dark one, so a number reads at a glance)
const paintOn = (L0) => { const c = [1, 3, 5].map((i) => parseInt(L0.base.slice(i, i + 2), 16) / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.45 ? '#1d2024' : '#e6e8e2'; };

// (the seven segments of a digit: a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle)
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
/** A hull number painted on a face: each character seven-segment, `h` tall, from `o` along `right`, `up` its up (laid a
 *  metre or two proud of the face, so it holds its place in the depth at the ranges a fight is seen from). */
export function stencil(text, o, right, up, h, color = '#e6e8e2') {
  const w = h * 0.55, t = h * 0.13, gap = h * 0.25, out = [];
  const P = (x, y) => [0, 1, 2].map((k) => o[k] + right[k] * x + up[k] * y);
  const bar = (x0, y0, x1, y1) => out.push({ corners: [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], color });
  [...String(text)].forEach((ch, i) => {
    const x = i * (w + gap), s = SEG[ch] || '';
    if (s.includes('a')) bar(x, h - t, x + w, h);
    if (s.includes('d')) bar(x, 0, x + w, t);
    if (s.includes('g')) bar(x, h / 2 - t / 2, x + w, h / 2 + t / 2);
    if (s.includes('f')) bar(x, h / 2, x + t, h);
    if (s.includes('b')) bar(x + w - t, h / 2, x + w, h);
    if (s.includes('e')) bar(x, 0, x + t, h / 2);
    if (s.includes('c')) bar(x + w - t, 0, x + w, h / 2);
  });
  return out;
}
const stencilWidth = (text, h) => String(text).length * h * 0.8 - h * 0.25;
const hazard = (L0) => (i) => (i % 2 ? LIGHTS.hazard : L0.dark);

/** A dock: a spindle off a face along the axis, its ring at its tip striped with hazard. */
function dock(from, dir, len, r, ringR, L0, parts) {
  const at = (s) => from.map((v, k) => v + dir[k] * s);
  parts.push(tube(at(0), at(len), r, 12, { role: 'deck', color: L0.trim }));
  parts.push(tube(at(len - 18), at(len), ringR, 16, { role: 'deck', color: L0.dark, polyColor: (i) => (i < 2 ? L0.dark : hazard(L0)(i)) }));
}

// ── THE HABITAT CYLINDER: its axis x, the sun down it ──
function cylinderForm(C, L0, rnd) {
  const L = C.length, R = C.radius, mil = C.use === 'military', xs = -L / 2, xf = L / 2, n = C.sides ?? 36;
  const sector = (i) => Math.floor(((((i + 0.5) / n) * 360 + 30) % 360) / 60);   // (six strips round it: land at 0, 120, 240°)
  const glass = (i) => !mil && sector(i) % 2 === 1;
  const parts = [], lit = [], lights = [], decor = [], guns = [];
  // the hull: civil, land strips plated and window strips glazed; military, plates of two tones all round
  parts.push(tube([xs, 0, 0], [xf, 0, 0], R, n, { role: 'hull', color: L0.base,
    polyColor: (i) => (i < 2 ? (mil ? L0.trim : L0.base) : glass(i - 2) ? GLASS : mil && (i - 2) % 2 ? tint(L0.base, 0.9) : L0.base), litPoly: (i) => i >= 2 && glass(i - 2) }));
  const ang = (i) => (2 * Math.PI * i) / n, ap = R * Math.cos(Math.PI / n);
  // (a facet's quad from x0 to x1, `o` m proud of it, between its edges' shares e0 and e1)
  const facet = (i, x0, x1, o, e0 = 0, e1 = 1) => { const a = ang(i), b = ang(i + 1), p = (t, x) => { const th = a + (b - a) * t, rr = (ap + o) / Math.cos(th - (a + b) / 2); return [x, rr * Math.cos(th), rr * Math.sin(th)]; }; return [p(e0, x0), p(e1, x0), p(e1, x1), p(e0, x1)]; };
  if (!mil) {
    // the glazing's ribs across it, every so many metres
    for (let i = 0; i < n; i++) if (glass(i)) for (let x = xs + 40; x < xf - 20; x += C.ribEvery ?? 70) decor.push({ corners: facet(i, x - 2, x + 2, 0.6), color: L0.dark });
    // the mirrors: one over each window strip, hinged at the stern, opened out, the sun thrown in through the glass
    const op = ((C.mirrorOpen ?? 22) * Math.PI) / 180, Lm = L * 0.92;
    for (let k = 0; k < 3; k++) {
      const th = ((60 + 120 * k) * Math.PI) / 180, half = (R * Math.PI) / 6 * 0.95, d = [Math.cos(th), Math.sin(th)], tg = [-Math.sin(th), Math.cos(th)];
      // (its face toward the hull the mirror; its back, a frame's depth out, dark structure)
      const P = (s, w, o = 0) => { const rr = R + 6 + s * Math.sin(op) + o * Math.cos(op); return [xs + s * Math.cos(op) - o * Math.sin(op), rr * d[0] + w * tg[0], rr * d[1] + w * tg[1]]; };
      decor.push({ corners: [P(0, -half), P(0, half), P(Lm, half), P(Lm, -half)], color: MIRROR });
      decor.push({ corners: [P(0, -half, 1.5), P(Lm, -half, 1.5), P(Lm, half, 1.5), P(0, half, 1.5)], color: L0.trim });
    }
    // the farm wheel ahead of its bow on the dock's spindle, its spokes, its glazing lit
    const xr = xf + 110, Ra = R * 0.85, ra = Math.max(18, R * 0.12);
    parts.push(...torusRing([xr, 0, 0], 0, Ra, ra, 24, 10, { role: 'hab', color: L0.base, polyColor: (i, nn) => (Math.abs(nn[0]) > 0.6 ? GLASS : L0.base), litPoly: (i, nn) => Math.abs(nn[0]) > 0.6 }));
    for (const [y, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const lo = 24, hi = Ra - ra * 0.8, w = Math.max(6, ra * 0.4);
      parts.push(boxPart([xr - w, y ? Math.min(y * lo, y * hi) : -w, z ? Math.min(z * lo, z * hi) : -w], [xr + w, y ? Math.max(y * lo, y * hi) : w, z ? Math.max(z * lo, z * hi) : w], { role: 'truss', color: L0.trim }));
    }
    dock([xf, 0, 0], [1, 0, 0], 220, 26, 64, L0, parts);
    // running lights round both caps, lit windows round the farm wheel's rim
    for (let k = 0; k < 8; k++) { const t = (2 * Math.PI * k) / 8; lights.push({ at: [xf + 1, R * Math.cos(t), R * Math.sin(t)], color: k % 2 ? LIGHTS.port : LIGHTS.starboard }, { at: [xs - 1, R * Math.cos(t), R * Math.sin(t)], color: LIGHTS.strobe }); }
  } else {
    // armour belts welded round it, faceted; between them its guns in fours; lit slits along its flanks
    const belts = C.belts ?? 5;
    for (let k = 1; k <= belts; k++) { const x = xs + (L * k) / (belts + 1); parts.push(tube([x - 14, 0, 0], [x + 14, 0, 0], R + 7, Math.round(n / 2), { role: 'armour', color: L0.trim })); }
    for (let k = 0; k <= belts; k++) {
      const x = xs + (L * (k + 0.5)) / (belts + 1);
      for (const [y, z] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) guns.push({ from: [x, y * (R + 400), z * (R + 400)], dir: [0, -y, -z] });
      for (let i = 0; i < n; i += Math.round(n / 4)) for (let s = 0; s < 3; s++) { const x0 = x - 40 + s * 30; lit.push({ corners: facet(i, x0, x0 + 18, 0.5, 0.2, 0.8), n: [0, Math.cos(ang(i + 0.5)), Math.sin(ang(i + 0.5))], color: LIGHTS.window, slit: true }); }
    }
    // (its slits thin: the lit quads cut to a band)
    for (const f of lit) if (f.slit) { const c = f.corners, m = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t); f.corners = [m(c[0], c[1], 0.45), m(c[0], c[1], 0.55), m(c[3], c[2], 0.55), m(c[3], c[2], 0.45)]; delete f.slit; }
    // a drive aft: four bells, their throats lit
    for (const [y, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const c = [xs, y * R * 0.42, z * R * 0.42], br = R * 0.24;
      parts.push(tube([xs - br * 1.2, c[1], c[2]], [xs + 2, c[1], c[2]], br, 16, { role: 'drive', color: L0.dark }));
      lit.push({ corners: Array.from({ length: 16 }, (_, q) => [xs - br * 1.2 - 0.3, c[1] + br * 0.72 * Math.cos((-2 * Math.PI * q) / 16), c[2] + br * 0.72 * Math.sin((-2 * Math.PI * q) / 16)]), n: [-1, 0, 0], color: LIGHTS.drive });
    }
    dock([xf, 0, 0], [1, 0, 0], 90, 22, 46, L0, parts);
    // its number on its bow face, huge, off the dock
    const num = C.number ?? String(10 + Math.floor(rnd() * 89)), h = R * 0.38;
    for (const q of stencil(num, [xf + 2, -stencilWidth(num, h) / 2, -R * 0.75], [0, 1, 0], [0, 0, 1], h, paintOn(L0))) decor.push(q);
    for (let k = 0; k < 4; k++) { const t = (2 * Math.PI * (k + 0.5)) / 4; lights.push({ at: [xf + 1, R * Math.cos(t), R * Math.sin(t)], color: LIGHTS.port }); }
  }
  return { parts, lit, lights, decor, guns, core: [0, 0, -R * 0.8], driveX: mil ? xs + L * 0.06 : -Infinity, length: L + (mil ? 110 : 330) };
}

/** A wheel's dress: its ring's glazing or armour collars, its windows or slits, its guns, its spokes. `ax` the axis. */
function wheel(c, ax, R, r, L0, mil, rnd, parts, lit, guns, o = {}) {
  const u = (ax + 1) % 3, v = (ax + 2) % 3, N = o.segments ?? 32;
  parts.push(...torusRing(c, ax, R, r, N, 12, { role: 'hab', color: L0.base,
    // (civil: its inner band glazed, the sky of the people in it, lit; military: plates of two tones, no glass)
    polyColor: (i, nn, P) => (!mil && P && isInner(P, c, ax, R) ? GLASS : mil && i % 2 ? tint(L0.base, 0.9) : L0.base), litPoly: (i, nn, P) => !mil && P && isInner(P, c, ax, R) }));
  // the spokes: four, square to the axis
  for (const [su, sv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const lo = o.hub ?? 20, hi = R - r * 0.8, w = Math.max(5, r * 0.3), mn = [0, 0, 0], mx = [0, 0, 0];
    mn[ax] = c[ax] - w; mx[ax] = c[ax] + w;
    mn[u] = c[u] + (su ? Math.min(su * lo, su * hi) : -w); mx[u] = c[u] + (su ? Math.max(su * lo, su * hi) : w);
    mn[v] = c[v] + (sv ? Math.min(sv * lo, sv * hi) : -w); mx[v] = c[v] + (sv ? Math.max(sv * lo, sv * hi) : w);
    parts.push(boxPart(mn, mx, { role: 'truss', color: L0.trim }));
  }
  const at = (th, rho, z) => { const p = [0, 0, 0]; p[u] = c[u] + rho * Math.cos(th); p[v] = c[v] + rho * Math.sin(th); p[ax] = c[ax] + z; return p; };
  if (!mil) {
    // a row of lit windows round its outer rim, gapped by the dice
    const n = Math.round((2 * Math.PI * (R + r)) / 10);
    for (let i = 0; i < n; i++) { if (rnd() < 0.3) continue; const t0 = (2 * Math.PI * i) / n, t1 = t0 + 3.5 / (R + r); for (const z of [-r * 0.25, r * 0.25]) lit.push({ corners: [at(t0, R + r + 0.4, z - 1), at(t1, R + r + 0.4, z - 1), at(t1, R + r + 0.4, z + 1), at(t0, R + r + 0.4, z + 1)], n: unit(at((t0 + t1) / 2, 1, 0).map((x, k) => x - c[k])), color: LIGHTS.window }); }
  } else {
    // armour collars round the ring, faceted, and guns between them on its outer rim; slits
    for (let k = 0; k < 8; k++) { const t = (2 * Math.PI * k) / 8 + Math.PI / 8; parts.push(...torusRing(c, ax, R, r + 5, 2, 8, { role: 'armour', color: L0.trim }, { from: t - 0.05, to: t + 0.05 })); }
    for (let k = 0; k < 4; k++) { const t = (Math.PI / 2) * k, d = at(t, 1, 0).map((x, q) => x - c[q]); guns.push({ from: at(t, R + r + 400, 0), dir: d.map((x) => -x) }); }
    const n = Math.round((2 * Math.PI * (R + r)) / 26);
    for (let i = 0; i < n; i++) { const t0 = (2 * Math.PI * i) / n, t1 = t0 + 9 / (R + r); lit.push({ corners: [at(t0, R + r + 0.4, -0.5), at(t1, R + r + 0.4, -0.5), at(t1, R + r + 0.4, 0.5), at(t0, R + r + 0.4, 0.5)], n: unit(at((t0 + t1) / 2, 1, 0).map((x, k) => x - c[k])), color: LIGHTS.window }); }
  }
}
// (a point on a ring's surface facing its axis: its inner band, within a third of its tube's radius of the plane)
function isInner(P, c, ax, R) {
  const u = (ax + 1) % 3, v = (ax + 2) % 3, m = P.reduce((s, p) => s.map((x, k) => x + p[k] / P.length), [0, 0, 0]);
  return Math.hypot(m[u] - c[u], m[v] - c[v]) < R * 0.97 && Math.abs(m[ax] - c[ax]) < R * 0.06;
}

// ── THE TORUS STATION: its axis z, its hub, its spindle and dock up, its arrays (civil) or masts (military) below ──
function torusForm(C, L0, rnd) {
  const R = C.radius, r = C.tube, mil = C.use === 'military', H = C.hub, parts = [], lit = [], lights = [], decor = [], guns = [];
  wheel([0, 0, 0], 2, R, r, L0, mil, rnd, parts, lit, guns, { hub: H.r * 0.9 });
  parts.push(tube([0, 0, -H.h / 2], [0, 0, H.h / 2], H.r, 20, { role: 'deck', color: mil ? L0.trim : L0.base, polyColor: (i) => (i < 2 ? L0.trim : (i % 4 === 0 && !mil ? GLASS : mil ? L0.trim : L0.base)), litPoly: (i) => i >= 2 && i % 4 === 0 && !mil }));
  dock([0, 0, H.h / 2], [0, 0, 1], mil ? 70 : 140, 18, 44, L0, parts);
  if (!mil) {
    // solar arrays on a mast below: two wings of cells, their frames dark
    parts.push(tube([0, 0, -H.h / 2], [0, 0, -H.h / 2 - 150], 9, 10, { role: 'truss', color: L0.trim }));
    const z = -H.h / 2 - 130, w = R * 0.42, d = 46;
    for (const s of [1, -1]) {
      for (let k = 0; k < 4; k++) { const x0 = s * (14 + (k * w) / 4), x1 = s * (14 + ((k + 1) * w) / 4 - 2); decor.push({ corners: [[x0, -d, z], [x1, -d, z], [x1, d, z], [x0, d, z]], color: ARRAY }); decor.push({ corners: [[x0, d, z - 0.4], [x1, d, z - 0.4], [x1, -d, z - 0.4], [x0, -d, z - 0.4]], color: L0.dark }); }
      decor.push({ corners: [[s * 9, -2, z - 1], [s * (14 + w), -2, z - 1], [s * (14 + w), 2, z - 1], [s * 9, 2, z - 1]], color: L0.trim });
    }
    for (let k = 0; k < 8; k++) { const t = (2 * Math.PI * k) / 8; lights.push({ at: [(R + r + 1) * Math.cos(t), (R + r + 1) * Math.sin(t), 0], color: k % 2 ? LIGHTS.port : LIGHTS.starboard }); }
  } else {
    // its masts below, its number on its hub's top
    parts.push(tube([0, 0, -H.h / 2], [0, 0, -H.h / 2 - 90], 7, 8, { role: 'truss', color: L0.trim }));
    lights.push({ at: [0, 0, -H.h / 2 - 92], color: LIGHTS.port });
    for (const [y, z] of [[1, 0], [-1, 0]]) guns.push({ from: [0, y * (H.r + 400), z], dir: [0, -y, 0] });
    const num = C.number ?? String(10 + Math.floor(rnd() * 89)), h = H.r * 0.4;
    for (const q of stencil(num, [-stencilWidth(num, h) / 2, -H.r * 0.85, H.h / 2 + 1], [1, 0, 0], [0, 1, 0], h, paintOn(L0))) decor.push(q);
  }
  return { parts, lit, lights, decor, guns, core: [0, 0, -H.h * 0.4], driveX: -Infinity, length: 2 * (R + r) };
}

// ── THE RING SHIP: a wheel round a spine, its axis x: the drive aft, command fore ──
function ringshipForm(C, L0, rnd) {
  const L = C.length, rs = C.spine, mil = C.use === 'military', xs = -L / 2, xf = L / 2, parts = [], lit = [], lights = [], decor = [], guns = [];
  parts.push(tube([xs, 0, 0], [xf, 0, 0], rs, 16, { role: 'hull', color: L0.base, polyColor: (i) => (mil && i % 2 ? tint(L0.base, 0.9) : L0.base) }));
  // the drive: a wider section aft, bells across its stern
  const dr = rs * 1.6;
  parts.push(tube([xs, 0, 0], [xs + L * 0.14, 0, 0], dr, 16, { role: 'drive', color: L0.trim }));
  for (const [y, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = [xs, y * dr * 0.5, z * dr * 0.5], br = dr * 0.3;
    parts.push(tube([xs - br, c[1], c[2]], [xs + 2, c[1], c[2]], br, 14, { role: 'drive', color: L0.dark }));
    lit.push({ corners: Array.from({ length: 14 }, (_, q) => [xs - br - 0.3, c[1] + br * 0.72 * Math.cos((-2 * Math.PI * q) / 14), c[2] + br * 0.72 * Math.sin((-2 * Math.PI * q) / 14)]), n: [-1, 0, 0], color: LIGHTS.drive });
  }
  // command fore: a block across the spine's nose, its windows lit
  const cw = rs * 2.2, cl = L * 0.08;
  parts.push(boxPart([xf - cl, -cw / 2, -rs * 0.9], [xf, cw / 2, rs * 1.1], { role: 'tower', color: mil ? L0.trim : L0.base }));
  for (const s of [1, -1]) lit.push({ corners: [[xf - cl * 0.9, s * (cw / 2 + 0.3), rs * 0.5], [xf - cl * 0.1, s * (cw / 2 + 0.3), rs * 0.5], [xf - cl * 0.1, s * (cw / 2 + 0.3), rs * (mil ? 0.6 : 0.8)], [xf - cl * 0.9, s * (cw / 2 + 0.3), rs * (mil ? 0.6 : 0.8)]], n: [0, s, 0], color: LIGHTS.window });
  // the wheel amidships
  const xr = xs + L * (C.ringAt ?? 0.55);
  wheel([xr, 0, 0], 0, C.radius, C.tube, L0, mil, rnd, parts, lit, guns, { hub: rs, segments: 28 });
  if (mil) {
    for (const x of [xs + L * 0.25, xs + L * 0.8]) for (const [y, z] of [[0, 1], [0, -1]]) guns.push({ from: [x, 0, z * (rs + 400)], dir: [0, 0, -z] });
    const num = C.number ?? String(10 + Math.floor(rnd() * 89)), h = rs * 0.9;
    for (const q of stencil(num, [xf - cl * 0.5 - stencilWidth(num, h) / 2, -(cw / 2 + 1), -rs * 0.7], [1, 0, 0], [0, 0, 1], h, paintOn(L0))) decor.push({ corners: q.corners.slice().reverse(), color: q.color });
  }
  lights.push({ at: [xs + 2, dr + 0.5, 0], color: LIGHTS.port }, { at: [xs + 2, -dr - 0.5, 0], color: LIGHTS.starboard }, { at: [xf + 0.5, 0, 0], color: LIGHTS.strobe });
  return { parts, lit, lights, decor, guns, core: [xs + L * 0.3, 0, -rs * 0.7], driveX: xs + L * 0.1, length: L };
}

export const STRUCTURE_FORMS = Object.freeze({ cylinder: cylinderForm, torus: torusForm, ringship: ringshipForm });
