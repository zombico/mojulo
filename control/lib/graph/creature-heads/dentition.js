/**
 * THE CREATURE HEAD'S TEETH AND GUMS (the relational creature head worn: ./worn.js): a row of teeth and a gum along each
 * jaw's ARCH, the upper the head's and the lower the jaw's, so they part as the jaw opens.
 *
 *   the arch     the mouth's seated line (./relational.js `mouth`, the corner to the front) carried in square to its own
 *                run, level, by the lip's thickness (`ARCH.upper` V; the lower `ARCH.lower`, a little further in: the
 *                upper row closes outside the lower), level at the mouth's line, read by its length from the front (0) to
 *                the corner (1)
 *   the teeth    each tooth a small cone off its gum (`DENTITIONS`: where along the arch, its kind, its crown's length,
 *                its breadth along the arch and its depth across it, V): the incisor a blunt chisel, the canine a round
 *                fang bent back (its length × the head's `fang`), the premolar and the carnassial blades, the molar low
 *                and blunt; its root buried in the gum. Shut, the skin hides them all: a tooth that would stand out of it
 *                (the lower front, where the jaw is set back under the muzzle) is moved in along the arch's facing, then
 *                shortened, until it lies inside (`FIT`), and left out if it never does
 *   the gums     a ringed tube along each arch through the midline, its lower (the upper gum's) edge at the teeth's necks,
 *                its rings drawn in wherever they would stand out of the skin
 *
 *   dentitionParts({ mouth, fH, k, zL, dentition, fang })  → { teethU, teethL, gumU, gumL }: layer-1 parts (the teeth a
 *                     mesh each row, the gums ringed), in the hero's frame (metres; `mouth` there, corner → front; `fH` the
 *                     closed skin's field there; `k` the head's scale, a V being HEAD_V × k; `zL` the mouth line's height)
 *   DENTITIONS, ARCH
 * Pure and deterministic: fixed loops, ties by index; no dice, no clock.
 */
import { HEAD_V } from '../polygonizer/head-relational.js';
import { ringSlots } from '../polygonizer/body-relational-resample.js';
import { r6 } from '../polygonizer/body-relational-vec.js';

const T = (at, kind, h, w, d) => Object.freeze({ at, kind, h, w, d });
/** the rows, per dentition: each tooth { at (along the arch, front 0 → corner 1), kind, h (the crown's length), w (its
 * breadth along the arch), d (its depth across it) } in V. A canid's long row of blades behind a long fang; a felid's
 * short row, tiny incisors, a long fang and the carnassial behind a gap. The lower canine stands ahead of the upper. */
export const DENTITIONS = Object.freeze({
  canid: Object.freeze({
    upper: Object.freeze([T(0.03, 'incisor', 0.036, 0.022, 0.015), T(0.08, 'incisor', 0.038, 0.022, 0.015), T(0.135, 'incisor', 0.04, 0.024, 0.016), T(0.21, 'canine', 0.095, 0.036, 0.032),
      T(0.33, 'premolar', 0.038, 0.03, 0.014), T(0.45, 'premolar', 0.043, 0.034, 0.015), T(0.57, 'premolar', 0.048, 0.038, 0.016), T(0.71, 'carnassial', 0.062, 0.058, 0.02), T(0.85, 'molar', 0.03, 0.04, 0.034)]),
    lower: Object.freeze([T(0.025, 'incisor', 0.032, 0.018, 0.013), T(0.07, 'incisor', 0.034, 0.019, 0.013), T(0.115, 'incisor', 0.036, 0.02, 0.014), T(0.165, 'canine', 0.08, 0.03, 0.027),
      T(0.3, 'premolar', 0.034, 0.028, 0.013), T(0.42, 'premolar', 0.038, 0.032, 0.014), T(0.54, 'premolar', 0.042, 0.035, 0.015), T(0.67, 'carnassial', 0.056, 0.058, 0.019), T(0.82, 'molar', 0.028, 0.036, 0.024)]),
  }),
  felid: Object.freeze({
    upper: Object.freeze([T(0.03, 'incisor', 0.018, 0.014, 0.011), T(0.075, 'incisor', 0.019, 0.014, 0.011), T(0.12, 'incisor', 0.02, 0.016, 0.012), T(0.24, 'canine', 0.09, 0.032, 0.029),
      T(0.5, 'premolar', 0.03, 0.034, 0.015), T(0.72, 'carnassial', 0.046, 0.06, 0.02)]),
    lower: Object.freeze([T(0.025, 'incisor', 0.016, 0.012, 0.01), T(0.065, 'incisor', 0.017, 0.012, 0.01), T(0.105, 'incisor', 0.018, 0.013, 0.011), T(0.19, 'canine', 0.075, 0.03, 0.027),
      T(0.48, 'premolar', 0.03, 0.032, 0.014), T(0.7, 'carnassial', 0.044, 0.058, 0.019)]),
  }),
});

/** the arch (V): each row's distance in from the mouth's line, the gum's line off the mouth's line, the gum's half
 * height and half depth, how far its middle stands off its line (into the flesh), how far along the arch it runs. The gum's
 * line a little PAST the mouth's (toward the other jaw: negative): parted, the crowns stand clear of the lips, which a gum
 * set back into its own jaw hid */
export const ARCH = Object.freeze({ upper: 0.045, lower: 0.058, gumLine: -0.004, gumHigh: 0.03, gumDeep: 0.024, gumIn: 0.024, gumReach: 0.93 });

/** the smoothing passes the mouth's line takes before it is carried in */
const ARCH_SMOOTH = 1;
/** a kind's shape: its tip's share of its breadth, how far its tip bends back along the arch (a share of its length),
 * how far it leans out (radians), the root's share of the crown's length */
const KINDS = Object.freeze({
  incisor: Object.freeze({ tip: 0.45, bend: 0, lean: 0.15, root: 0.5 }),
  canine: Object.freeze({ tip: 0.08, bend: 0.18, lean: 0.05, root: 0.45 }),
  premolar: Object.freeze({ tip: 0.22, bend: 0.05, lean: 0, root: 0.5 }),
  carnassial: Object.freeze({ tip: 0.2, bend: 0.06, lean: 0, root: 0.5 }),
  molar: Object.freeze({ tip: 0.6, bend: 0, lean: 0, root: 0.6 }),
});
/** the fit inside the skin: the margin a point keeps under it (V), the steps a tooth is moved in (V) and the scales it
 * is shortened to, in that order */
const FIT = Object.freeze({ margin: 0.004, inward: Object.freeze([0, 0.01, 0.02, 0.03, 0.04, 0.05]), scale: Object.freeze([1, 0.85, 0.7, 0.55, 0.4]) });
/** a tooth's slots round, its rings' places up it (0 the root's end … 1 the tip), the gum's slots and stations a side */
const TOOTH_SLOTS = 8, TOOTH_RINGS = Object.freeze([0, 0.5, 0.68, 0.82, 0.93]), GUM_SLOTS = 12, GUM_STATIONS = 14;

const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rp = (p) => p.map(r6);
const n4 = (v) => v.map((x) => Math.round(x * 1e4) / 1e4 + 0);

/** an arch: the mouth's line (front first) carried in by `off` along the skin's level facing, at height `z`; read by its
 * share of length → { p (the point), t (along it, toward the corner), n (level, in toward the midline) } */
function archOf(line0, off, z) {
  // (the line made to run back from the front all the way, then smoothed: a cat's front sits behind its whisker pads, and
  // that notch carried in folds the arch over itself)
  const line = line0.map((p) => [...p]);
  for (let i = 1; i < line.length; i++) line[i][1] = Math.min(line[i][1], line[i - 1][1]);
  for (let pass = 0; pass < ARCH_SMOOTH; pass++) {
    const prev = line.map((p) => [...p]);
    for (let i = 1; i + 1 < line.length; i++) for (const a of [0, 1]) line[i][a] = (prev[i - 1][a] + 2 * prev[i][a] + prev[i + 1][a]) / 4;
  }
  // (in square to the line's own run, level, toward the midline: the skin's facing at the groove is the groove's own)
  // (in: toward the midline at the corners' depth, whichever way the line runs there)
  const back = line.at(-1)[1], toIn = (n, p) => (n[0] * -p[0] + n[1] * (back - p[1]) < 0 ? n.map((x) => -x) : n);
  const inward = (i) => { const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], t = unit([b[0] - a[0], b[1] - a[1], 0]); return toIn([-t[1], t[0], 0], line[i]); };
  const pts = line.map((q, i) => { const p = add(q, inward(i), off); return [p[0], p[1], z]; });
  pts[0] = [0, pts[0][1], z];   // (the front on the midline)
  const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const L = len.at(-1) || 1;
  return (s) => {
    const d = Math.max(0, Math.min(1, s)) * L; let i = 1; while (i < pts.length - 1 && len[i] < d) i++;
    const f = (d - len[i - 1]) / (len[i] - len[i - 1] || 1), p = add(pts[i - 1], sub(pts[i], pts[i - 1]), f), t = unit(sub(pts[i], pts[i - 1]));
    // (in toward the midline: square to the run, level)
    return { p, t, n: toIn(unit([-t[1], t[0], 0]), p) };
  };
}

/** one tooth's points and faces: rings of an ellipse (its breadth along the arch, its depth across) from the root's end up
 * past the gum to the tip, bent back and leaning out by its kind; `down` its way (−1 an upper tooth) */
function toothMesh(at, tooth, V, down, fang) {
  const K = KINDS[tooth.kind], h = tooth.h * V * (tooth.kind === 'canine' ? fang : 1), root = K.root * h, total = root + h, neck = root / total;
  const D = unit(add([0, 0, down], at.n, -Math.sin(K.lean))), base = add(at.p, D, -root);   // (leaning out, either row)
  const ring = TOOTH_RINGS.map((t) => {
    const c = add(add(base, D, t * total), at.t, K.bend * h * Math.max(0, (t - neck) / (1 - neck)) ** 2), f = t <= neck ? 1 : 1 - (1 - K.tip) * ((t - neck) / (1 - neck)) ** 1.6;
    return Array.from({ length: TOOTH_SLOTS }, (_, j) => { const a = (2 * Math.PI * j) / TOOTH_SLOTS; return add(add(c, at.t, Math.cos(a) * tooth.w * V * 0.5 * f), at.n, Math.sin(a) * tooth.d * V * 0.5 * f); });
  });
  const tip = add(add(base, D, total), at.t, K.bend * h);
  return { ring, tip, base: add(base, D, -0.0005) };
}

/** a mesh part of teeth: each its own closed cone (fanned at the root and the tip), wound outward, shaded smooth */
function teethPart(teeth, bone) {
  const points = {}, faces = {}, normals = {}; let f = 0;
  teeth.forEach(({ ring, tip, base }, ti) => {
    const id = (i, j) => `t${ti}r${i}s${((j % TOOTH_SLOTS) + TOOTH_SLOTS) % TOOTH_SLOTS}`, P = {}, F = [];
    ring.forEach((r, i) => r.forEach((p, j) => { P[id(i, j)] = p; }));
    P[`t${ti}tip`] = tip; P[`t${ti}base`] = base;
    for (let j = 0; j < TOOTH_SLOTS; j++) F.push([`t${ti}base`, id(0, j + 1), id(0, j)]);
    for (let i = 0; i + 1 < ring.length; i++) for (let j = 0; j < TOOTH_SLOTS; j++) { F.push([id(i, j), id(i, j + 1), id(i + 1, j + 1)]); F.push([id(i, j), id(i + 1, j + 1), id(i + 1, j)]); }
    for (let j = 0; j < TOOTH_SLOTS; j++) F.push([id(ring.length - 1, j), id(ring.length - 1, j + 1), `t${ti}tip`]);
    // (wound outward: turned once if its volume reads negative)
    let vol = 0; for (const [a, b, c] of F) { const A = P[a], B = P[b], C = P[c]; vol += A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0]); }
    const W = vol < 0 ? F.map(([a, b, c]) => [a, c, b]) : F, acc = Object.fromEntries(Object.keys(P).map((k) => [k, [0, 0, 0]]));
    for (const t of W) { const n = cross(sub(P[t[1]], P[t[0]]), sub(P[t[2]], P[t[0]])); for (const v of t) acc[v] = add(acc[v], n); }
    for (const [k, p] of Object.entries(P)) { points[k] = rp(p); normals[k] = n4(unit(acc[k])); }
    for (const t of W) faces[`f${f++}`] = t;
  });
  return { layer: 1, closure: 'closed', group: 'Teeth', mesh: { points, faces, normals }, bind: bone };
}

/** a gum: rings along its arch from the left end through the midline to the right, each an ellipse (its half height and
 * half depth) about a middle set off the gum's line up (`up` +1) or down into the flesh, drawn in toward that middle
 * wherever a point would stand out of the skin */
function gumPart(arch, gumZ, up, V, fH, bone) {
  const C = ARCH, slots = ringSlots(GUM_SLOTS), margin = FIT.margin * V, ss = [];
  for (let i = GUM_STATIONS; i >= 1; i--) ss.push(-(C.gumReach * i) / GUM_STATIONS);
  ss.push(0); for (let i = 1; i <= GUM_STATIONS; i++) ss.push((C.gumReach * i) / GUM_STATIONS);
  const stations = ss.map((s, si) => {
    const a = arch(Math.abs(s)), flip = s < 0 ? -1 : 1, p = [a.p[0] * flip, a.p[1], gumZ], n = s === 0 ? [0, Math.sign(a.n[1]) || -1, 0] : [a.n[0] * flip, a.n[1], 0];
    const mid = add(add(p, [0, 0, up], (C.gumHigh - C.gumLine * 0.6) * V), n, C.gumIn * V * 0.25);
    const pts = Object.fromEntries(slots.map((sl, j) => {
      const th = (2 * Math.PI * j) / GUM_SLOTS; let q = add(add(mid, [0, 0, 1], Math.cos(th) * C.gumHigh * V), n, Math.sin(th) * C.gumDeep * V);
      for (let it = 0; it < 24 && fH(q) > -margin; it++) q = add(mid, sub(q, mid), 0.9);
      return [sl, rp(q)];
    }));
    return { id: `st${si}`, u: si, points: pts, mid };
  });
  const end = (st, dir) => { const m = st.mid; return rp(add(m, dir, 0.002)); };
  const first = stations[0], last = stations.at(-1);
  const out0 = unit(sub(first.mid, stations[1].mid)), out1 = unit(sub(last.mid, stations.at(-2).mid));
  return { layer: 1, closure: 'closed', slots, stations: stations.map(({ mid: _m, ...st }) => st), caps: { back: end(first, out0), tip: end(last, out1) }, group: 'Gums', bind: bone };
}

export function dentitionParts({ mouth, fH, k, zL, dentition = 'canid', fang = 1 }) {
  const V = HEAD_V * k, rows = DENTITIONS[dentition] ?? DENTITIONS.canid, line = [...mouth].reverse(), margin = FIT.margin * V;
  const inside = (m) => m.ring.every((r) => r.every((p) => fH(p) < -margin)) && fH(m.tip) < -margin;
  const row = (teeth, off, gumZ, down) => {
    const arch = archOf(line, off * V, gumZ), placed = [];
    for (const tooth of teeth) {
      let got = null;
      for (const sc of FIT.scale) { for (const dn of FIT.inward) {
        const a = arch(tooth.at), at = { ...a, p: add(a.p, a.n, dn * V) }, sized = { ...tooth, h: tooth.h * sc, w: tooth.w * Math.sqrt(sc), d: tooth.d * Math.sqrt(sc) };
        for (const side of [1, -1]) { const s2 = side > 0 ? at : { p: [-at.p[0], at.p[1], at.p[2]], t: [-at.t[0], at.t[1], 0], n: [-at.n[0], at.n[1], 0] }, m = toothMesh(s2, sized, V, down, fang); if (!inside(m)) { got = null; break; } got = [...(got ?? []), m]; }
        if (got) break; }
        if (got) break; }
      if (got) placed.push(...got);
    }
    return { arch, placed };
  };
  const U = row(rows.upper, ARCH.upper, zL + ARCH.gumLine * V, -1), L = row(rows.lower, ARCH.lower, zL - ARCH.gumLine * V, 1);
  return {
    teethU: teethPart(U.placed, 'head'), teethL: teethPart(L.placed, 'jaw'),
    gumU: gumPart(U.arch, zL + ARCH.gumLine * V, 1, V, fH, 'head'), gumL: gumPart(L.arch, zL - ARCH.gumLine * V, -1, V, fH, 'jaw'),
  };
}
