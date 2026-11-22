/**
 * headgear/realistic — the RELATIONAL HEAD's adapter for the headgear cards that are worn ON the head rather than cast on
 * the landmark cranium: the circlet and the hats (hero laws 23). The realistic body has no cranium kit, so a card's
 * realistic side lowers to a `headwear` word (`{ id, kind: 'circlet' | 'hat', … }`, the card's shape words) and this
 * builds it on the head the hero has, read off the head's own parts as the draped hood reads them (body-garment.js
 * headCloud): the skin, the hair and its locks pinned to it, and a hood worn up when there is one; the ears never.
 *
 *   THE BAND LINE   a plane round the head: at the front `front` of the way from the glabella up to the hairline, at the
 *                   back at the skull's back point (op) raised `back` of the way to the vertex; the sides between, by the
 *                   cosine of the bearing. It never passes under the ears.
 *   THE SUPPORT     at a bearing and a height, the furthest the head and its hair reach from the head's middle (each
 *                   point within a bearing bin and a slab), its dents filled (what lies on hair rides its crests), so
 *                   anything laid at the support plus a gap clears every hair at that height.
 *   CIRCLET         a flat band traced round the head on the band line at the support plus `gap`, `h` high (widening to
 *                   `peak` times that at the front), `thick` deep; a setting and a cabochon at its front on the midline
 *                   (the gem, its group `gemGroup`).
 *   HAT             a CROWN: rows from the band line up over the head, each at the support plus `ease`, every meridian's line
 *                   bridged (its upper hull, so the felt never dips between crests of hair) and held out to a soft box
 *                   (`box`: 0 a dome on the head, 1 the band's width carried up); its top `rise` over the highest hair. A
 *                   BRIM round the band, `brim.len` out, its front turned up by `brim.up` and its back let down by
 *                   `brim.drop` (shares of its length). A ribbon band round the crown's foot, `trim` high. The WIZARD's
 *                   `cone`: the crown carried on up a spine `cone.len` long leaning back by `cone.lean` (radians) and
 *                   bending further by `cone.bend`, its rings narrowing to a point.
 *
 *   SHIELD          a face shield (the welding mask): the circlet's band as its strap, and a plate stood `ease` off the
 *                   face over bearings ±`arc`, from over the band's front to under the chin, held convex across and down;
 *                   a `slot` of glass proud of it across the eyes, or a `crack` splitting it open there (heights from the
 *                   nasion)
 *
 * Each a closed shell (its winding outward), a part a colour, each pinned to the head's skin where the head bone alone carries
 * it (hero-head-layers.js visagePin, as the piercings and the hair are), so it rides the head bone. Metres in the hero's
 * frame (z up, y forward). No dice: the same head and words make the same headwear.
 *
 *   headwearOf(parts, headFit, W) → { parts: { headwear, headwearTrim?, headwearGem? }, mesh, cloud, … } | null
 *   HEADWEAR                        the realistic shape of each card that has one, by id
 */
import { relationalHead } from '../polygonizer/head-relational.js';
import { HEAD_TUNES } from '../polygonizer/hero-relational-head.js';
import { compileLayered, pinFrame } from '../polygonizer/station-loft.js';
import { surfaceLocalOffset } from '../polygonizer/surface-pin.js';
import { visagePin } from '../polygonizer/hero-head-layers.js';

/** the realistic side of the cards (headgear/cards.js names these ids): the shape words, in metres */
export const HEADWEAR = Object.freeze({
  circlet: Object.freeze({ kind: 'circlet', front: 0.42, back: 0.05, gap: 0.0015, h: 0.007, peak: 1.8, thick: 0.0022, gem: 0.0055, group: 'EyeFrame', gemGroup: 'EyeGlow' }),
  travelerHat: Object.freeze({ kind: 'hat', front: 0.62, back: -0.08, ease: 0.006, rise: 0.022, box: 0.75, thick: 0.003, trim: 0.016,
    brim: Object.freeze({ len: 0.07, up: 0.12, drop: 0.32, thick: 0.004 }), group: 'Helmet', trimGroup: 'HelmetTrim' }),
  wizardHat: Object.freeze({ kind: 'hat', front: 0.62, back: -0.08, ease: 0.006, rise: 0.008, box: 0.5, thick: 0.003, trim: 0.018,
    brim: Object.freeze({ len: 0.085, up: 0.05, drop: 0.2, thick: 0.004 }), cone: Object.freeze({ len: 0.28, lean: 0.3, bend: 0.35 }), group: 'Helmet', trimGroup: 'HelmetTrim' }),
  // the welding mask: a strap round the head on the band line, and a plate stood off the face from over the brow to under
  // the chin, flat across the nose as a shield is, a slot of dark glass across the eyes; its CRACKED twin the same plate
  // split open across the eyes and the nose, the glass gone, the face showing through the break
  weldingMask: Object.freeze({ kind: 'shield', front: 0.55, back: 0.1, ease: 0.026, arc: 1.32, rise: 0.012, drop: 0.022, thick: 0.004,
    strap: Object.freeze({ h: 0.026, thick: 0.003, gap: 0.0012 }), slot: Object.freeze({ lo: -0.03, hi: 0.012, arc: 0.6, proud: 0.0018, thick: 0.002 }),
    group: 'Helmet', trimGroup: 'HelmetTrim', visorGroup: 'HelmetVisor' }),
  weldingMaskCracked: Object.freeze({ kind: 'shield', front: 0.55, back: 0.1, ease: 0.026, arc: 1.32, rise: 0.012, drop: 0.022, thick: 0.004,
    strap: Object.freeze({ h: 0.026, thick: 0.003, gap: 0.0012 }), crack: Object.freeze({ lo: -0.052, hi: 0.022, arc: 0.95, jag: 0.012 }),
    group: 'Helmet', trimGroup: 'HelmetTrim' }),
  // the bandana: the circlet's band in cloth, wide over the brow, no gem; a knot at the back and two tails hanging from it
  bandana: Object.freeze({ kind: 'circlet', front: 0.5, back: 0.12, gap: 0.0004, h: 0.034, peak: 1, thick: 0.0016, gem: 0,
    tails: Object.freeze({ len: 0.2, w: 0.028, thick: 0.0016, spread: 0.22, back: 0.3, knot: 0.012 }), group: 'Helmet' }),
});

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const N_BEAR = 48;
/** the hair a headwear rests on (the scalp's: never the beard, the brows or the lashes) */
const HAIR = /^hair(?!Brows|Lashes|Beard)/;

/** THE HEAD AS WORN, in the hero's frame: the skin, the parts pinned to it (the hair, its cards), a hood worn up; the
 * points split into the skull's, the hair's and the hood's (the ears and the face's hair left out) */
function headCloudOf(parts) {
  const seeds = new Set(Object.keys(parts).filter((n) => /^(cranium|jaw|headSkin)$/.test(n)));
  for (let grew = true; grew;) { grew = false; for (const [n, p] of Object.entries(parts)) if (!seeds.has(n) && p.pin?.parent && seeds.has(p.pin.parent)) { seeds.add(n); grew = true; } }
  for (const n of Object.keys(parts)) if (/_hood$/.test(n) && parts[n].stations) seeds.add(n);
  if (!seeds.size) return null;
  const mesh = compileLayered({ schema: 'layered-v1', dials: {}, parts: Object.fromEntries([...seeds].map((n) => [n, parts[n]])) }, {}, { details: true, creases: false });
  const out = { skull: [], hair: [], hood: [] };
  mesh.vertices.forEach((p, i) => { const n = mesh.provenance[i].part;
    if (/^(cranium|jaw|headSkin)$/.test(n)) out.skull.push(p); else if (HAIR.test(n)) out.hair.push(p); else if (/_hood$/.test(n)) out.hood.push(p); });
  return out.skull.length ? out : null;
}

/** the support: per bearing (0 the front, turning to the figure's right) the furthest reach of `pts` from `c` within a
 * slab `dz` of the height `zOf(bearing)`; missing bearings filled from their neighbours, dents filled */
function supportRing(pts, c, zOf, dz) {
  const r = new Array(N_BEAR).fill(-1), w = 2 * Math.PI / N_BEAR;
  for (const p of pts) {
    const dx = p[0] - c[0], dy = p[1] - c[1], rho = Math.hypot(dx, dy); if (rho < 1e-6) continue;
    let th = Math.atan2(dx, dy); if (th < 0) th += 2 * Math.PI;
    const q0 = Math.round(th / w);
    for (const dq of [-1, 0, 1]) { const q = (q0 + dq + N_BEAR) % N_BEAR, b = q * w; if (Math.abs(p[2] - zOf(b)) > dz) continue;
      const along = dx * Math.sin(b) + dy * Math.cos(b); if (along > r[q]) r[q] = along; }
  }
  if (r.every((x) => x < 0)) return null;
  for (let pass = 0; pass < N_BEAR && r.some((x) => x < 0); pass++) for (let q = 0; q < N_BEAR; q++) if (r[q] < 0) { const a = r[(q + N_BEAR - 1) % N_BEAR], b = r[(q + 1) % N_BEAR]; if (a >= 0 || b >= 0) r[q] = Math.max(a, b); }
  return fillDents(r);
}
/** a ring's dents filled (each radius no less than its neighbours' mean), then eased once */
function fillDents(r) {
  let out = [...r];
  for (let pass = 0; pass < 3; pass++) out = out.map((x, q) => Math.max(x, (out[(q + 1) % N_BEAR] + out[(q + N_BEAR - 1) % N_BEAR]) / 2));
  return out.map((x, q) => Math.max(x, 0.25 * out[(q + 1) % N_BEAR] + 0.5 * x + 0.25 * out[(q + N_BEAR - 1) % N_BEAR]));
}
/** the upper hull of the line (x, y), x increasing: every y raised to the least concave line over them */
function upperHull(x, y) {
  const H = [];
  for (let q = 0; q < x.length; q++) { while (H.length >= 2) { const a = H[H.length - 2], b = H[H.length - 1]; if ((x[b] - x[a]) * (y[q] - y[a]) - (y[b] - y[a]) * (x[q] - x[a]) >= 0) H.pop(); else break; } H.push(q); }
  const out = [...y];
  for (let h = 0; h + 1 < H.length; h++) { const a = H[h], b = H[h + 1]; for (let q = a + 1; q < b; q++) out[q] = Math.max(y[q], y[a] + (y[b] - y[a]) * (x[q] - x[a]) / Math.max(1e-9, x[b] - x[a])); }
  return out;
}

/** A MESH of shells: vertices, triangles, each triangle's group; `loft` joins loops (each N_BEAR points round the head, or
 * one point: an apex) in sequence, `closed` back to the first; a triangle with a repeated corner is dropped */
function meshOf() {
  const M = { vertices: [], faces: [], groups: [], shells: [] };
  M.add = (p) => M.vertices.push(p.map(r6)) - 1;
  M.loop = (pts) => pts.map((p) => M.add(p));
  M.loft = (loops, group, { closed = false } = {}) => {
    const f0 = M.faces.length, L = closed ? [...loops, loops[0]] : loops, gOf = typeof group === 'function' ? group : () => group;
    for (let i = 0; i + 1 < L.length; i++) { const A = L[i], B = L[i + 1], n = Math.max(A.length, B.length), g = gOf(i);
      for (let q = 0; q < n; q++) { const a0 = A[q % A.length], a1 = A[(q + 1) % n % A.length], b0 = B[q % B.length], b1 = B[(q + 1) % n % B.length];
        for (const t of [[a0, b0, b1], [a0, b1, a1]]) if (new Set(t).size === 3) { M.faces.push(t); M.groups.push(g); } } }
    M.shells.push([f0, M.faces.length]);
  };
  return M;
}
/** each shell turned to face out (its signed volume positive) */
function outward(M) {
  for (const [a, b] of M.shells) {
    let vol = 0; for (let f = a; f < b; f++) { const [p, q, s] = M.faces[f].map((i) => M.vertices[i]); vol += p[0] * (q[1] * s[2] - q[2] * s[1]) - p[1] * (q[0] * s[2] - q[2] * s[0]) + p[2] * (q[0] * s[1] - q[1] * s[0]); }
    if (vol < 0) for (let f = a; f < b; f++) M.faces[f] = [M.faces[f][0], M.faces[f][2], M.faces[f][1]];
  }
  return M;
}
const ringAt = (c, z, r, out = 0) => r.map((x, q) => { const b = q * 2 * Math.PI / N_BEAR; return [c[0] + (x + out) * Math.sin(b), c[1] + (x + out) * Math.cos(b), typeof z === 'function' ? z(b) : z]; });

/** THE TAILS of a tied band (the bandana's): a knot on the band's back at `at`, and two flat tails `len` long hanging from
 * it, each swung `spread` of its length to its side and `back` of it behind the head, the rest of it down; each a closed
 * shell in the band's group */
function tails(M, c, at, W, k) {
  const T = W.tails, len = T.len * k, w = T.w * k / 2, th = T.thick * k / 2, kn = T.knot * k, K = 6;
  // (the knot: a small lozenge standing off the band)
  const ring = (y, r) => M.loop([[at[0] - r, y, at[2]], [at[0], y, at[2] + r * 0.8], [at[0] + r, y, at[2]], [at[0], y, at[2] - r * 0.8]]);
  M.loft([[M.add([at[0], at[1] + kn * 0.2, at[2]])], ring(at[1] - kn * 0.2, kn), ring(at[1] - kn * 0.8, kn * 0.8), [M.add([at[0], at[1] - kn * 1.1, at[2]])]], W.group);
  for (const side of [-1, 1]) {
    const loops = [];
    for (let i = 0; i <= K; i++) {
      const s = i / K, ease = s * (2 - s);
      const p = [at[0] + side * (kn * 0.4 + T.spread * len * ease), at[1] - kn * 0.6 - T.back * len * ease, at[2] - len * (1 - T.back) * s * (0.4 + 0.6 * s)];
      // (flat across the tail's width, widening a little to its end)
      const hw = w * (0.7 + 0.3 * s);
      loops.push(M.loop([[p[0] - hw, p[1] + th, p[2]], [p[0] + hw, p[1] + th, p[2]], [p[0] + hw, p[1] - th, p[2]], [p[0] - hw, p[1] - th, p[2]]]));
    }
    const a0 = M.vertices[loops[0][0]], aK = M.vertices[loops[K][0]];
    M.loft([[M.add([a0[0] + w * 0.7, a0[1] - th, a0[2] + 0.001 * k])], ...loops, [M.add([aK[0] + w, aK[1] - th, aK[2] - 0.002 * k])]], W.group);
  }
}

/** THE CIRCLET: a band on the band line over the hair, a setting and a gem at its front */
function circlet(M, cloud, c, zOf, W, k) {
  const pts = [...cloud.skull, ...cloud.hair, ...cloud.hood], h0 = W.h * k;
  const hOf = (b) => h0 * (1 + (W.peak - 1) * Math.max(0, Math.cos(b)) ** 6);
  const zt = (b) => zOf(b) + hOf(b) / 2, zb = (b) => zOf(b) - hOf(b) / 2;
  // (a WIDE band, a cloth's: one support over its whole height, so nothing between its edges stands through it)
  const dz = 0.004 * k, wide = h0 > 4 * dz, all = wide ? supportRing(pts, c, zOf, h0 / 2 + dz) : null;
  const rt = all ?? supportRing(pts, c, zt, dz), rb = all ?? supportRing(pts, c, zb, dz), rm = all ?? supportRing(pts, c, zOf, dz);
  if (!rt || !rb || !rm) return null;
  // (a rigid band: never in under its own middle, so it bridges a hair's dip as metal does)
  const inT = rt.map((x, q) => Math.max(x, rm[q] - 0.002 * k) + W.gap * k), inB = rb.map((x, q) => Math.max(x, rm[q] - 0.002 * k) + W.gap * k);
  const t = W.thick * k;
  M.loft([M.loop(ringAt(c, zt, inT, t)), M.loop(ringAt(c, zb, inB, t)), M.loop(ringAt(c, zb, inB)), M.loop(ringAt(c, zt, inT))], W.group, { closed: true });
  if (W.tails) tails(M, c, [c[0], c[1] - (inT[N_BEAR / 2] + inB[N_BEAR / 2]) / 2 - t, zOf(Math.PI)], W, k);
  // (a band with no gem, the bandana: the band alone)
  if (!(W.gem > 0)) return { band: { front: zOf(0), back: zOf(Math.PI), height: h0, peak: W.peak, gap: W.gap * k }, inner: inT, innerB: inB, zt, zb };
  // the setting and the gem: on the band's face at the front, along its outward normal there
  const pt = [c[0], c[1] + inT[0] + t, zt(0)], pb = [c[0], c[1] + inB[0] + t, zb(0)], mid = pt.map((v, i) => (v + pb[i]) / 2);
  const up = [0, pt[1] - pb[1], pt[2] - pb[2]], ul = Math.hypot(...up), u = up.map((v) => v / ul), n = [0, u[2], -u[1]];
  const g = W.gem * k, at = (r, a, out) => [mid[0] + r * Math.cos(a), mid[1] + r * Math.sin(a) * u[1] + out * n[1], mid[2] + r * Math.sin(a) * u[2] + out * n[2]];
  const S = 10, A = (i) => 2 * Math.PI * i / S;
  // (a gold bezel: a short collar round the stone, a little wider than it)
  const bezel = [M.loop(Array.from({ length: S }, (_, i) => at(1.35 * g, A(i), -0.0006 * k))), M.loop(Array.from({ length: S }, (_, i) => at(1.35 * g, A(i), 0.0014 * k))), M.loop(Array.from({ length: S }, (_, i) => at(1.05 * g, A(i), 0.0016 * k)))];
  M.loft([[M.add(at(0, 0, -0.0006 * k))], ...bezel, [M.add(at(0, 0, 0.0012 * k))]], W.group);
  // (the cabochon: a dome on the bezel)
  const dome = [0, 0.45, 0.8].map((f) => M.loop(Array.from({ length: S }, (_, i) => at(g * Math.cos(f * Math.PI / 2), A(i), 0.0012 * k + 0.7 * g * Math.sin(f * Math.PI / 2)))));
  M.loft([[M.add(at(0, 0, 0.0008 * k))], ...dome, [M.add(at(0, 0, 0.0012 * k + 0.7 * g))]], W.gemGroup);
  return { band: { front: zOf(0), back: zOf(Math.PI), height: h0, peak: W.peak, gap: W.gap * k }, inner: inT, innerB: inB, zt, zb };
}

/** THE HAT: a crown fitted over the hair from the band line up, a ribbon at its foot, a brim, the wizard's cone */
function hat(M, cloud, c, zOf, W, k) {
  const pts = [...cloud.skull, ...cloud.hair, ...cloud.hood], ease = W.ease * k;
  const zTop = Math.max(...pts.map((p) => p[2])) + W.rise * k;
  // the rows from the band line to the top: the support at each, every meridian's line bridged (upper hull)
  // (the first two rows the ribbon's foot and top, `trim` high, the third just over it where the felt steps back)
  const fr = Math.min(0.3, W.trim * k / Math.max(0.02, zTop - zOf(0))), ROWS = 11;
  const s = [0, fr, fr + 0.02, ...Array.from({ length: ROWS - 3 }, (_, i) => fr + 0.02 + (1 - fr - 0.02) * (i + 1) / (ROWS - 3))];
  const zRow = (j) => (b) => zOf(b) + (zTop - zOf(b)) * s[j];
  const dz = Math.max(0.004 * k, 0.6 * (zTop - zOf(0)) / (ROWS - 1)), sup = s.map((_, j) => supportRing(pts, c, zRow(j), dz));
  if (!sup[0]) return null;
  for (let j = 1; j < ROWS; j++) if (!sup[j]) sup[j] = sup[j - 1].map((x) => x * 0.4);
  const R = sup.map((r) => r.map((x) => x + ease));
  const base = R[0];
  for (let q = 0; q < N_BEAR; q++) {
    const b = q * 2 * Math.PI / N_BEAR, x = s.map((f) => f * (zTop - zOf(b)));
    // (held out to a soft box: the band's own width carried up, rounding over at the top as a felt crown does)
    const boxed = s.map((f, j) => Math.max(R[j][q], W.box * base[q] * Math.max(0, 1 - f ** 5) ** (1 / 5)));
    upperHull(x, boxed).forEach((v, j) => { R[j][q] = v; });
  }
  // CLEARANCE: the felt runs straight between its rows and its bearings, so a crest of hair between them is met there: each
  // point under the crown raises the four corners round it by the least that clears it by half the ease, by nearness
  const hullAll = () => { for (let q = 0; q < N_BEAR; q++) { const b = q * 2 * Math.PI / N_BEAR; upperHull(s.map((f) => f * (zTop - zOf(b))), R.map((r) => r[q])).forEach((v, j) => { R[j][q] = v; }); } };
  const wb = 2 * Math.PI / N_BEAR, chord = 1 / Math.cos(Math.PI / N_BEAR);
  for (let pass = 0; pass < 3; pass++) {
    const need = R.map((r) => r.map(() => 0));
    for (const p of pts) {
      const dx = p[0] - c[0], dy = p[1] - c[1], rho = Math.hypot(dx, dy); if (rho < 1e-6) continue; let th = Math.atan2(dx, dy); if (th < 0) th += 2 * Math.PI;
      const x = th / wb, q0 = Math.floor(x) % N_BEAR, q1 = (q0 + 1) % N_BEAR, g = x - Math.floor(x), zb0 = zOf(th), hgt = zTop - zb0, f = (p[2] - zb0) / Math.max(1e-9, hgt);
      if (f < 0 || f >= 1) continue;
      let j = 0; while (j < ROWS - 2 && s[j + 1] <= f) j++; const h = (f - s[j]) / (s[j + 1] - s[j]);
      const Wt = [[j, q0, (1 - h) * (1 - g)], [j, q1, (1 - h) * g], [j + 1, q0, h * (1 - g)], [j + 1, q1, h * g]];
      const dl = (rho + ease / 2) * chord - Wt.reduce((t, [a, b, w]) => t + w * R[a][b], 0); if (dl <= 0) continue;
      const zz = Wt.reduce((t, [, , w]) => t + w * w, 0); for (const [a, b, w] of Wt) need[a][b] = Math.max(need[a][b], dl * w / zz);
    }
    R.forEach((r, j) => r.forEach((_, q) => { r[q] += need[j][q]; })); hullAll();
  }
  // THE CONE (the wizard's): the crown carried on up a spine leaning back, narrowing to a point
  // (the ribbon: the crown's first two rows standing `band` proud of the felt)
  const band = 0.0018 * k, loops = R.map((r, j) => ringAt(c, zRow(j), r, j <= 1 ? band : 0));
  let apex = null;
  if (W.cone) {
    const L = W.cone.len * k, K = 9, top = [c[0], c[1], zTop], dir = (t) => { const a = W.cone.lean + W.cone.bend * t * t; return [0, -Math.sin(a), Math.cos(a)]; };
    let p = top; const cen = [top];
    for (let i = 1; i <= K; i++) { const d = dir(i / K); p = p.map((v, a) => v + d[a] * L / K); cen.push(p); }
    // (the crown's last full row the cone's foot; each ring of the cone no closer to the hair under it than the ease)
    const foot = R[ROWS - 2];
    loops.splice(ROWS - 1);
    for (let i = 1; i < K; i++) { const t = i / K, under = supportRing(pts, [cen[i][0], cen[i][1]], () => cen[i][2], dz);
      const rr = foot.map((x, q) => Math.max(0.002 * k, x * (1 - t) ** 1.15, under ? under[q] + ease : 0)); loops.push(rr.map((x, q) => { const b = q * 2 * Math.PI / N_BEAR; return [cen[i][0] + x * Math.sin(b), cen[i][1] + x * Math.cos(b), cen[i][2]]; })); }
    apex = cen[K];
  } else {
    // (a felt crown's top: its last row closes on a soft dome a little over it)
    loops.pop(); apex = [c[0], c[1], zTop + 0.003 * k];
  }
  // the crown a shell `thick` deep: out over the rows, the apex, back down inside
  const t = W.thick * k, inner = loops.map((L) => L.map((p, q) => { const b = q * 2 * Math.PI / N_BEAR; return [p[0] - t * Math.sin(b), p[1] - t * Math.cos(b), p[2]]; })).reverse();
  M.loft([...loops.map((L) => M.loop(L)), [M.add(apex)], [M.add([apex[0], apex[1], apex[2] - t])], ...inner.map((L) => M.loop(L))], (i) => (i <= 1 ? W.trimGroup : W.group), { closed: true });
  // THE BRIM: from the crown's foot out `len`, its front turned up and its back let down, a little bowed
  const B = W.brim, bl = B.len * k, bt = B.thick * k;
  const lift = (b, f) => { const front = Math.max(0, Math.cos(b)), back = Math.max(0, -Math.cos(b)); return bl * f * (B.up * front ** 2 - B.drop * back ** 1.5 - 0.06 * f); };
  // (its outer edge on an eased line: the crown's foot follows the hair's crests, the brim's edge does not)
  let even = [...base]; for (let pass = 0; pass < 4; pass++) even = even.map((x, q) => (even[(q + N_BEAR - 1) % N_BEAR] + 2 * x + even[(q + 1) % N_BEAR]) / 4);
  const brimRing = (f, dz) => base.map((x0, q) => { const x = x0 + (Math.max(x0, even[q]) - x0) * f, b = q * 2 * Math.PI / N_BEAR, r = x - 0.0015 * k + bl * f; return [c[0] + r * Math.sin(b), c[1] + r * Math.cos(b), zOf(b) + lift(b, f) + dz]; });
  M.loft([M.loop(brimRing(0, bt)), M.loop(brimRing(0.5, bt)), M.loop(brimRing(1, bt * 0.5)), M.loop(brimRing(1, -bt * 0.5)), M.loop(brimRing(0.5, 0)), M.loop(brimRing(0, 0))], W.group, { closed: true });
  return { band: { front: zOf(0), back: zOf(Math.PI), ease }, top: zTop, crown: W.cone ? R.slice(0, ROWS - 1) : R, rows: s.map((_, j) => zRow(j)).slice(0, W.cone ? ROWS - 1 : ROWS), cone: !!W.cone, apex };
}

/** THE SHIELD (the welding mask): a strap round the head on the band line (the circlet's band, in the trim), and a PLATE
 * stood `ease` off the face over bearings ±`arc` from `rise` over the band's front to `drop` under the chin: each row the
 * head's support there carried out by the ease, then held convex across (a chord over the nose, not round it) and down (a
 * line from the brow to the chin over the nose's tip), `thick` deep. Its `slot` a plate of glass proud of it across the
 * eyes (heights from the nasion); a `crack` the plate split open across the eyes and the nose (the heights from the nasion
 * its lower and upper edge, each broken by `jag`, over ±`arc`), the face seen through it */
function shield(M, cloud, c, zOf, W, k, face) {
  const pts = [...cloud.skull, ...cloud.hair, ...cloud.hood], ease = W.ease * k, arc = W.arc;
  const strap = circlet(M, cloud, c, zOf, { kind: 'circlet', h: W.strap.h, peak: 1, gap: W.strap.gap, thick: W.strap.thick, gem: 0, group: W.trimGroup }, k);
  if (!strap) return null;
  const zTop = zOf(0) + W.rise * k, zBot = face.chin - W.drop * k, ROWS = 14, COLS = 19, w = 2 * Math.PI / N_BEAR;
  const zs = Array.from({ length: ROWS }, (_, j) => zBot + (zTop - zBot) * j / (ROWS - 1)), bs = Array.from({ length: COLS }, (_, i) => -arc + 2 * arc * i / (COLS - 1));
  const dz = 0.6 * (zTop - zBot) / (ROWS - 1);
  const ringR = (r, b) => { const x = ((b % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / w, q = Math.floor(x) % N_BEAR, f = x - Math.floor(x); return r[q] + (r[(q + 1) % N_BEAR] - r[q]) * f; };
  const R = zs.map((z) => { const r = supportRing(pts, c, () => z, dz); return bs.map((b) => (r ? ringR(r, b) : 0.06 * k) + ease); });
  // (held convex ACROSS: each bearing's radius raised to the chord between any two others round it, so the plate runs flat
  // over the nose and the brow)
  const X = (r, b) => [r * Math.sin(b), r * Math.cos(b)], cross = (a, d) => a[0] * d[1] - a[1] * d[0];
  for (const row of R) for (let pass = 0; pass < 2; pass++) for (let i = 1; i < COLS - 1; i++) for (let a = 0; a < i; a++) for (let b = i + 1; b < COLS; b++) {
    const A = X(row[a], bs[a]), B = X(row[b], bs[b]), d = [B[0] - A[0], B[1] - A[1]], dir = [Math.sin(bs[i]), Math.cos(bs[i])], den = cross(dir, d);
    if (Math.abs(den) < 1e-9) continue; const r = cross(A, d) / den; if (r > row[i]) row[i] = r; }
  // (and DOWN: each bearing's profile from the chin to the top raised to its upper hull)
  for (let i = 0; i < COLS; i++) upperHull(zs, R.map((r) => r[i])).forEach((v, j) => { R[j][i] = v; });
  // the plate's radius at any height and bearing in it (between the grid's rows and columns)
  const at = (z, b) => { const y = Math.max(0, Math.min(ROWS - 1 - 1e-9, (z - zBot) / (zTop - zBot) * (ROWS - 1))), x = Math.max(0, Math.min(COLS - 1 - 1e-9, (b + arc) / (2 * arc) * (COLS - 1)));
    const j = Math.floor(y), i = Math.floor(x), fy = y - j, fx = x - i; return (R[j][i] * (1 - fx) + R[j][i + 1] * fx) * (1 - fy) + (R[j + 1][i] * (1 - fx) + R[j + 1][i + 1] * fx) * fy; };
  const P = (z, b, out) => { const r = at(z, b) + out; return [c[0] + r * Math.sin(b), c[1] + r * Math.cos(b), z]; };
  // A PIECE of the plate (or of the glass on it): bearings b0..b1, from its foot lo(b) to its top hi(b), `out` off the plate
  // and `t` deep; a closed shell: its rows each a ribbon (out across, back in under), capped top and bottom on its middle
  const piece = (b0, b1, lo, hi, out, t, group) => {
    const n = 13, cols = Array.from({ length: n }, (_, i) => b0 + (b1 - b0) * i / (n - 1)), rows = 10, loops = [];
    for (let j = 0; j < rows; j++) { const f = j / (rows - 1), zOfC = cols.map((b) => lo(b) + (hi(b) - lo(b)) * f);
      loops.push([...cols.map((b, i) => M.add(P(zOfC[i], b, out + t))), ...cols.map((b, i) => M.add(P(zOfC[i], b, out))).reverse()]); }
    const cap = (j) => { const mid = cols.map((b) => { const f = j ? 1 : 0, z = lo(b) + (hi(b) - lo(b)) * f; return M.add(P(z, b, out + t / 2)); }); return [...mid, ...[...mid].reverse()]; };
    M.loft([cap(0), ...loops, cap(1)], group);
  };
  const T = W.thick * k, flat = (z) => () => z;
  if (W.crack) {
    // (the break: its lower edge under the nose and its upper over the brow, each a jag of fixed teeth, no dice)
    const C = W.crack, jag = C.jag * k, TEETH = [0, 0.8, -0.5, 1, -0.2, 0.6, -0.9, 0.3, 1, -0.6, 0.4, -1, 0.7];
    const tooth = (b, ph) => { const x = (b + C.arc) / (2 * C.arc) * (TEETH.length - 1), i = Math.max(0, Math.min(TEETH.length - 2, Math.floor(x))), f = x - i; return TEETH[(i + ph) % TEETH.length] * (1 - f) + TEETH[(i + 1 + ph) % TEETH.length] * f; };
    const ends = (b) => Math.min(1, (C.arc - Math.abs(b)) / 0.18);   // (the break closing at its ends)
    const lower = (b) => (Math.abs(b) >= C.arc ? zTop : face.nasion + C.lo * k + jag * tooth(b, 0) + (zTop - face.nasion - C.lo * k) * (1 - ends(b)));
    const upper = (b) => (Math.abs(b) >= C.arc ? zTop : face.nasion + C.hi * k + jag * tooth(b, 5));
    piece(-arc, arc, flat(zBot), lower, 0, T, W.group);
    piece(-C.arc, C.arc, (b) => Math.max(upper(b), lower(b) - 0.002 * k), flat(zTop), 0, T, W.group);
  } else {
    piece(-arc, arc, flat(zBot), flat(zTop), 0, T, W.group);
    if (W.slot) { const S = W.slot; piece(-S.arc, S.arc, flat(face.nasion + S.lo * k), flat(face.nasion + S.hi * k), T, S.thick * k + S.proud * k, W.visorGroup); }
  }
  return { ...strap, shield: { top: zTop, bottom: zBot, ease, arc } };
}

/**
 * THE BUILDER alone, on a head given as points (`cloud`: { skull, hair, hood }, metres, z up, y forward), its middle
 * `centre` ([x, y]), its band line `band(bearing)` (a height) and its scale `k` (1 an adult man's): → { M (vertices, faces,
 * groups, shells: each closed, faced out), made (what the law reads) } or null. What headwearOf builds on a hero's head.
 */
export function buildHeadwear(cloud, { centre, band, k = 1, face = null }, W) {
  const M = meshOf(), made = W.kind === 'circlet' ? circlet(M, cloud, centre, band, W, k) : W.kind === 'shield' ? (face ? shield(M, cloud, centre, band, W, k, face) : null) : hat(M, cloud, centre, band, W, k);
  if (!made || !M.faces.length) return null;
  return { M: outward(M), made };
}

/**
 * The headwear `W` (HEADWEAR's words, `id` among them) on the realistic head of `parts` (a recipe's, its head swapped in and
 * its hair worn) fitted by `headFit`: one part, `headwear`, pinned to the head's skin; null when the recipe carries no
 * relational head. `measures` is what the laws read: the band line, the gaps, the points of hair the shell must clear.
 */
export function headwearOf(parts, headFit, W) {
  if (!headFit || !W || !parts.headSkin) return null;
  const { sex, k: hk, ty, men, relations, eyes } = headFit;
  const head = relationalHead({ sex, tune: headFit.tune ?? HEAD_TUNES[sex], ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}), ...(headFit.seat ? { seat: headFit.seat } : {}) });
  const Lm = head.landmarks, at = (p) => [p.x * hk, p.y * hk + ty, p.z * hk + men];
  const cloud = headCloudOf(parts); if (!cloud) return null;
  // (the head's own scale against an adult man's: the words are an adult's)
  const g = at(Lm.g), tr = at(Lm.trichion), op = at(Lm.op), vx = at(Lm.vertex), k = (vx[2] - at(Lm.me)[2]) / 0.235;
  const c = [0, (g[1] + op[1]) / 2], zf = g[2] + W.front * (tr[2] - g[2]), zbk = op[2] + W.back * (vx[2] - op[2]);
  const zOf = (b) => zbk + (zf - zbk) * (1 + Math.cos(b)) / 2;
  const B = buildHeadwear(cloud, { centre: c, band: zOf, k, face: { nasion: at(Lm.n)[2], chin: at(Lm.me)[2] } }, W); if (!B) return null;
  const { M, made } = B;
  const skin = parts.headSkin, compiled = compileLayered({ parts: { headSkin: skin }, dials: {}, creases: {} }).parts.headSkin;
  const pin = visagePin(skin, compiled, 'head', at(Lm.n), 'headSkin'); if (!pin) return null;
  // (a part a colour: the felt or the metal `headwear`, the ribbon `headwearTrim`, the gem `headwearGem`, each painted whole)
  const frame = pinFrame(compiled, pin), out = {};
  for (const [name, group] of [['headwear', W.group], ['headwearTrim', W.trimGroup], ['headwearGem', W.gemGroup], ['headwearVisor', W.visorGroup]]) {
    if (!group) continue;
    const vid = new Map(), offsets = {}, faces = {};
    const v = (i) => { if (!vid.has(i)) { const id = `v${vid.size}`; vid.set(i, id); offsets[id] = surfaceLocalOffset(frame, M.vertices[i]).map(r6); } return vid.get(i); };
    M.faces.forEach((f, i) => { if (M.groups[i] === group) faces[`f${Object.keys(faces).length}`] = f.map(v); });
    if (Object.keys(faces).length) out[name] = { layer: 2, closure: 'closed', pin, group, offsets, faces };
  }
  return { parts: out, mesh: { vertices: M.vertices, faces: M.faces, groups: M.groups, shells: M.shells }, cloud, centre: c, band: zOf, made };
}

/** THE LAW a headwear is held to: no point of the head or its hair (or a hood under a hat) lies outside it where it covers
 * them — the circlet's band from its foot to its top, a hat's crown from the band line to its top. → { points (read),
 * through (outside it), minGap (m, the least room between the cloth or the metal and what it covers) } */
export function headwearGaps(H) {
  const { cloud, centre: c, band: zOf, made } = H, w = 2 * Math.PI / N_BEAR;
  const at = (r, th) => { const x = th / w, q = Math.floor(x) % N_BEAR, f = x - Math.floor(x); return r[q] + (r[(q + 1) % N_BEAR] - r[q]) * f; };
  let points = 0, through = 0, minGap = Infinity;
  for (const p of [...cloud.skull, ...cloud.hair, ...cloud.hood]) {
    const dx = p[0] - c[0], dy = p[1] - c[1], rho = Math.hypot(dx, dy); let th = Math.atan2(dx, dy); if (th < 0) th += 2 * Math.PI;
    let room = null;
    if (made.inner) { const lo = made.zb(th), hi = made.zt(th); if (p[2] >= lo && p[2] <= hi) { const f = (p[2] - lo) / Math.max(1e-9, hi - lo); room = at(made.innerB, th) + (at(made.inner, th) - at(made.innerB, th)) * f - rho; } }
    else if (made.rows && p[2] >= zOf(th) && p[2] <= made.rows[made.rows.length - 1](th)) {
      const zs = made.rows.map((z) => z(th)); let j = zs.findIndex((z) => z > p[2]); if (j <= 0) j = 1;
      const f = (p[2] - zs[j - 1]) / Math.max(1e-9, zs[j] - zs[j - 1]); room = at(made.crown[j - 1], th) + (at(made.crown[j], th) - at(made.crown[j - 1], th)) * f - rho;
    }
    if (room === null) continue;
    points++; if (room < 0) through++; minGap = Math.min(minGap, room);
  }
  return { points, through, minGap: points ? minGap : null };
}
