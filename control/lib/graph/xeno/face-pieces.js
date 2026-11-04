/**
 * THE FACE PIECES: what a make-up crew does to a face, past the skull and the appendages (./index.js), on whichever head
 * the hero wears, found on its skin by the frame (./frame.js: its brow line, nose, mouth and ears).
 *
 *   MARKINGS   painted transfers, flush with the skin: tear lines, brow chevrons, cheek stripes, a forehead mark,
 *              tribal lines, a pale mask, spot trails, a chin stripe (each a colour of its own; `coat` repaints it)
 *   EARS       tips glued to the ear's top-back (pointed, long), drops from the lobe, or no ears at all (`removes`)
 *   NOSES      a snout, flared nostrils, slit nostrils, a beak, a nose horn; `nostrils` sizes the openings (0.5 … 2.5)
 *   EYES       a third eye on the forehead: an eye, a slit eye, a gem, a cluster; its colours the palette's Sclera, Iris
 *              and Pupil (the species' or the hero's)
 *   MOUTHS     fangs from under the upper lip, sabre fangs, tusks from the jaw
 *
 * Builders: lensMesh (a dome on the skin: an eye's white, an iris, a gem, a nostril, a dot), stroke (a transfer or a lid
 * along a path cast on the face), facePatch (a sculpted piece over a region of the face, its edge feathered into the
 * skin). Each card's build(F, s, E) → [{ name, mesh, coat? }] (a piece's own coat over the entry's). Pure, deterministic.
 */
import { ridgeMesh, tubeMesh, bladeMesh } from './appliances.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** a piece's coat frame when its colour is flat: every point one texel in the middle (a lens, a dot) */
const flatFrame = (n, size) => ({ uv: Array.from({ length: n }, () => [0.5, 0.5]), length: size, radius: size / 2, span: size });

/** A DOME on the skin at `c`, facing `n`, `up` its vertical: an ellipse rx × ry, `depth` proud, its back `sink` under the
 * skin; R round, K up. Oriented, closed. */
export function lensMesh(c, n, up, { rx, ry, depth, sink, R = 16, K = 5 }) {
  n = unit(n); const v = unit(sub(up, mul(n, dot(up, n)))), u = cross(v, n), vertices = [], faces = [];
  const at = (x, y, z) => add(c, add(add(mul(u, x), mul(v, y)), mul(n, z)));
  const rings = [];
  for (let k = 0; k <= K; k++) {
    const a = (k / (K + 1)) * (Math.PI / 2), ring = [];
    for (let j = 0; j < R; j++) { const t = (2 * Math.PI * j) / R; ring.push(vertices.push(at(rx * Math.cos(a) * Math.cos(t), ry * Math.cos(a) * Math.sin(t), k === 0 ? -sink : depth * Math.sin(a))) - 1); }
    rings.push(ring);
  }
  const top = vertices.push(at(0, 0, depth)) - 1, bottom = vertices.push(at(0, 0, -sink)) - 1;
  const face = (a, b, d, want) => { const V = (i) => vertices[i], m = cross(sub(V(b), V(a)), sub(V(d), V(a))); faces.push(dot(m, want) >= 0 ? [a, b, d] : [a, d, b]); };
  for (let k = 0; k < K; k++) for (let j = 0; j < R; j++) {
    const a = rings[k][j], b = rings[k][(j + 1) % R], cc = rings[k + 1][(j + 1) % R], d = rings[k + 1][j], m = sub(mul(add(vertices[a], vertices[cc]), 0.5), sub(c, mul(n, sink)));
    face(a, b, cc, m); face(a, cc, d, m);
  }
  for (let j = 0; j < R; j++) { const a = rings[K][j], b = rings[K][(j + 1) % R]; face(a, b, top, n); face(rings[0][j], rings[0][(j + 1) % R], bottom, mul(n, -1)); }
  return { vertices, faces, line: [c, add(c, mul(n, depth))], oriented: true, coatFrame: flatFrame(vertices.length, 2 * Math.max(rx, ry)) };
}

/** A STROKE: a ridge `height` proud along a path of face points [[x, z], …] cast on the skin, `width` across, tapered to
 * its ends: a painted transfer (a hair's height) or a lid (a few millimetres). null when the path misses the face. */
export function stroke(F, path, { width, height, sink, taper = 0.35, per = 10, plateau = 0 }) {
  const S = [];
  for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < per; k++) { const t = k / per, h = F.front(lerp(path[i][0], path[i + 1][0], t), lerp(path[i][1], path[i + 1][1], t)); if (h) S.push(h); }
  const end = F.front(...path.at(-1)); if (end) S.push(end);
  if (S.length < 3) return null;
  return ridgeMesh(S, { height: () => height, width: (t) => width * Math.max(0.25, Math.sin(Math.PI * Math.min(1, Math.max(0, t)))) ** taper, sink, K: plateau ? 7 : 5, plateau });
}

/** A PATCH sculpted over the face: an ellipse rx × rz round (cx, cz), each point of the skin under it lifted along the
 * head's radius by `lift(u, v, hit)` (metres; u, v −1 … 1 across it), feathered to nothing at its edge; an underside
 * sunk under the skin and a lip. → a closed, oriented mesh, and `pointAt(x, z)` on its outside. */
export function facePatch(F, s, { cx, cz, rx, rz, lift, C = 36, K = 10 }) {
  const sink = 0.0012 * s, vertices = [], faces = [], axis = (p) => [F.centre[0], F.centre[1] - 0.02 * s, p[2]];
  const out = (h, u, v, k) => { const d = unit(sub(h.p, axis(h.p))), e = smooth(0, 0.3, k); return add(h.p, mul(d, 0.0006 * s + lift(u, v, h) * e)); };
  const pointAt = (x, z) => { const h = F.front(x, z); if (!h) return null; const u = (x - cx) / rx, v = (z - cz) / rz; return out(h, u, v, 1 - Math.min(1, Math.hypot(u, v))); };
  const O = [], I = [];
  for (let k = 0; k < K; k++) {
    const r = 1 - k / K, o = [], q = [];
    for (let j = 0; j < C; j++) {
      const a = (2 * Math.PI * j) / C, u = r * Math.cos(a), v = r * Math.sin(a), h = F.front(cx + rx * u, cz + rz * v); if (!h) return null;
      o.push(vertices.push(out(h, u, v, 1 - r)) - 1); q.push(vertices.push(sub(h.p, mul(unit(sub(h.p, axis(h.p))), sink))) - 1);
    }
    O.push(o); I.push(q);
  }
  const hc = F.front(cx, cz); if (!hc) return null;
  const top = vertices.push(out(hc, 0, 0, 1)) - 1, bottom = vertices.push(sub(hc.p, mul(unit(sub(hc.p, axis(hc.p))), sink))) - 1;
  const V = (i) => vertices[i];
  const face = (a, b, c, want) => { const m = cross(sub(V(b), V(a)), sub(V(c), V(a))); faces.push(dot(m, want) >= 0 ? [a, b, c] : [a, c, b]); };
  const outward = (a) => unit(sub(V(a), axis(V(a))));
  for (const [G, sign, pole] of [[O, 1, top], [I, -1, bottom]]) {
    for (let k = 0; k < K - 1; k++) for (let j = 0; j < C; j++) { const a = G[k][j], b = G[k][(j + 1) % C], c = G[k + 1][(j + 1) % C], d = G[k + 1][j]; face(a, b, c, mul(outward(a), sign)); face(a, c, d, mul(outward(a), sign)); }
    for (let j = 0; j < C; j++) face(G[K - 1][j], G[K - 1][(j + 1) % C], pole, mul(outward(pole), sign));
  }
  for (let j = 0; j < C; j++) { const a = O[0][j], b = O[0][(j + 1) % C], c = I[0][(j + 1) % C], d = I[0][j], away = sub(V(a), V(O[1][j])); face(a, b, c, away); face(a, c, d, away); }
  const line = O.map((r) => V(r[0])).concat([V(top)]);
  return { mesh: { vertices, faces, line, oriented: true, coatFrame: flatFrame(vertices.length, 2 * Math.max(rx, rz)) }, pointAt };
}

/** a tapered horn or tooth along a line of points, kept `clear` in front of the face below `z0` */
const keepOff = (F, line, r, clear) => line.map((p, i) => { const h = F.front(p[0], p[2]); const rr = r(i / (line.length - 1)); return h && p[1] < h.p[1] + rr + clear ? [p[0], h.p[1] + rr + clear, p[2]] : p; });

// ─── where the face's features sit (the frame's, at the scale s) ───────────────────────────────────────────────────
const LEVELS = (F, s) => ({ ex: 0.42 * F.halfWidth, eye: F.browZ - 0.018 * s, brow: F.browZ, hair: F.browZ + 0.05 * s, nose: F.noseTip[2], mouth: F.mouth.z, chin: F.chinZ });
const sides = [['R', 1], ['L', -1]];

// ─── MARKINGS ───────────────────────────────────────────────────────────────────────────────────────────────────────
const DARK = '#1f171b', PALE = '#efe9df';
/** a marking card: strokes (a path in face coordinates, a width) and dots, mirrored where the path is a side's */
const marking = (reads, like, color, draw) => Object.freeze({ reads, like, family: 'marking', region: 'face',
  coat: Object.freeze({ color }),
  build(F, s) {
    const L = LEVELS(F, s), out = [], H = 0.0007 * s, sink = 0.0007 * s;
    const { strokes = [], dots = [] } = draw(L, s);
    strokes.forEach(([path, w, mirror = true], i) => {
      for (const [side, sx] of mirror ? sides : [['', 1]]) { const m = stroke(F, path.map(([x, z]) => [sx * x, z]), { width: w, height: H, sink, plateau: 6 }); if (m) out.push({ name: `${side}Line${i}`, mesh: m }); }
    });
    dots.forEach(([x, z, r, mirror = true], i) => {
      for (const [side, sx] of mirror && x !== 0 ? sides : [['', 1]]) { const h = F.surfaceAt(sx * x, z); if (h) out.push({ name: `${side}Dot${i}`, mesh: lensMesh(h.p, h.n, [0, 0, 1], { rx: r, ry: r, depth: H, sink, R: 12, K: 2 }) }); }
    });
    return out;
  } });

export const MARKING_CARDS = Object.freeze({
  'tear-lines': marking('a dark line from under each eye down the cheek', 'the tear-lined faces of 80s–90s space-opera aliens', DARK,
    (L, s) => ({ strokes: [[[[L.ex, L.eye - 0.009 * s], [L.ex * 1.04, lerp(L.nose, L.mouth, 0.5)], [L.ex * 1.08, L.mouth]], 0.0026 * s]] })),
  'brow-chevrons': marking('two chevrons over each brow, pointing up', 'the chevron-browed diplomats of 2000s space-opera games', DARK,
    (L, s) => ({ strokes: [0, 1].map((k) => [[[L.ex * 0.3, L.brow + (0.009 + 0.011 * k) * s], [L.ex * 0.9, L.brow + (0.02 + 0.011 * k) * s], [L.ex * 1.55, L.brow + (0.005 + 0.011 * k) * s]], 0.003 * s]) })),
  'cheek-stripes': marking('three stripes across each cheek, from the ear toward the nose', 'the striped cheeks of feline aliens', DARK,
    (L, s) => ({ strokes: [0, 1, 2].map((k) => [[[L.ex * 1.75, L.eye - (0.014 + 0.01 * k) * s], [L.ex * 1.0, L.eye - (0.02 + 0.01 * k) * s]], 0.0042 * s]) })),
  'forehead-mark': marking('a bar up the middle of the forehead over a dot between the brows', 'the forehead marks of 60s–90s TV sci-fi telepaths', '#7a1f2a',
    (L, s) => ({ strokes: [[[[0, L.brow + 0.008 * s], [0, L.brow + 0.04 * s]], 0.005 * s, false]], dots: [[0, L.brow - 0.002 * s, 0.0026 * s, false]] })),
  'tribal-lines': marking('black lines radiating from the eyes up the forehead and down the cheeks, and down the chin', 'the tattooed faces of horn-crowned warriors in 90s–2000s space-opera cinema', '#111013',
    (L, s) => ({ strokes: [
      [[[L.ex * 0.55, L.brow + 0.005 * s], [L.ex * 0.35, L.hair]], 0.003 * s], [[[L.ex * 1.25, L.brow + 0.002 * s], [L.ex * 1.6, L.hair - 0.008 * s]], 0.003 * s],
      [[[L.ex * 1.25, L.eye - 0.01 * s], [L.ex * 1.45, L.mouth]], 0.003 * s], [[[L.ex * 0.55, L.eye - 0.012 * s], [L.ex * 0.65, L.nose - 0.008 * s]], 0.0028 * s],
      [[[0, L.mouth - 0.008 * s], [0, L.chin + 0.006 * s]], 0.0032 * s, false], [[[L.ex * 0.42, L.mouth - 0.01 * s], [L.ex * 0.5, L.chin + 0.01 * s]], 0.0026 * s],
    ] })),
  'pale-mask': marking('broad pale markings: arcs over the brows, sweeps under the eyes down the cheeks, a stripe up the forehead and down the chin', 'the pale facial markings of the horned predator race of 2000s space-opera animation', PALE,
    (L, s) => ({ strokes: [
      [[[L.ex * 0.25, L.brow + 0.012 * s], [L.ex, L.brow + 0.02 * s], [L.ex * 1.6, L.brow + 0.006 * s]], 0.009 * s],
      [[[L.ex * 0.6, L.eye - 0.012 * s], [L.ex * 1.3, L.eye - 0.02 * s], [L.ex * 1.5, L.nose]], 0.008 * s],
      [[[0, L.brow + 0.006 * s], [0, L.hair]], 0.01 * s, false], [[[0, L.mouth - 0.007 * s], [0, L.chin + 0.004 * s]], 0.008 * s, false],
    ] })),
  'spot-trails': marking('a trail of spots down each temple to the jaw, smaller as they fall', 'the spotted temples of a joined people of 90s TV sci-fi', '#5a3a2e',
    (L, s) => ({ dots: Array.from({ length: 9 }, (_, i) => { const t = i / 8, x = L.ex * (1.85 - 0.45 * t ** 2), z = lerp(L.brow + 0.02 * s, L.chin + 0.004 * s, t); return [x, z, (0.0034 - 0.0016 * t) * s]; }) })),
  'chin-stripe': marking('a dark stripe from the lower lip down the chin', 'the striped chins of 70s–80s space-opera aliens', DARK,
    (L, s) => ({ strokes: [[[[0, L.mouth - 0.006 * s], [0, L.chin + 0.004 * s]], 0.006 * s, false]] })),
});

// ─── EARS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** an ear piece grown from each ear: from its top-back (`from: 'top'`) or its lobe, along `dir` (out, forward, up: the
 * side's), bending by `bend` (out, forward, up) over its length; flat, its broad face turned out like the ear's */
const earPiece = ({ from, dir, bend = [0, 0, 0], length, width, tip, flat = 0.4 }) => (F, s) => {
  const out = [];
  for (const [side, E] of Object.entries(F.ears || {})) {
    const at = from === 'top' ? E.top : E.lobe, root = add(at, mul(sub(E.centre, at), 0.22)), N = 12, L = length * s;
    let d = unit([E.side * dir[0], dir[1], dir[2]]); const line = [root]; let p = root;
    for (let i = 1; i <= N; i++) { d = unit(add(d, mul([E.side * bend[0], bend[1], bend[2]], 1 / N))); p = add(p, mul(d, L / N)); line.push(p); }
    const m = bladeMesh(line, { radius: (t) => (width * s / 2) * (1 - t) ** 0.8 + (tip * s / 2) * t, flat, face: () => [E.side, 0, 0], R: 12 });
    if (m) out.push({ name: side, mesh: m });
  }
  return out;
};
export const EAR_CARDS = Object.freeze({
  'pointed-ears': Object.freeze({ reads: 'a pointed tip glued to the top-back of each ear', like: 'the pointed ears of the logical aliens of 60s TV sci-fi and of elves', family: 'ear', region: 'ears',
    coat: Object.freeze({ color: 'Skin' }), build: earPiece({ from: 'top', dir: [0.25, -0.45, 0.85], bend: [0, -0.4, 0], length: 0.026, width: 0.017, tip: 0.0012 }) }),
  'long-ears': Object.freeze({ reads: 'long tips swept back from the top of each ear', like: 'the long swept ears of fantasy elves and goblins', family: 'ear', region: 'ears',
    coat: Object.freeze({ color: 'Skin' }), build: earPiece({ from: 'top', dir: [0.4, -0.8, 0.45], bend: [0.1, 0, 0.3], length: 0.065, width: 0.022, tip: 0.0012 }) }),
  'lobe-drops': Object.freeze({ reads: 'long fleshy lobes hanging from each ear', like: 'the long-lobed ears of the trader aliens of 90s TV sci-fi', family: 'ear', region: 'earlobes',
    coat: Object.freeze({ color: 'Skin' }), build: earPiece({ from: 'lobe', dir: [0.12, 0.1, -1], bend: [0.1, 0.2, 0], length: 0.032, width: 0.014, tip: 0.009, flat: 0.45 }) }),
  'no-ears': Object.freeze({ reads: 'no outer ears: the ears left off, the head smooth where they were', like: 'the earless heads of grey visitors and many 50s–90s aliens', family: 'ear', region: 'ears',
    removes: Object.freeze(['ears']), coat: Object.freeze({ color: 'Skin' }), build: () => [] }),
});

// ─── NOSES ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const NOSTRIL = '#1a1012';
const nostrilsOf = (E) => E?.nostrils ?? 1;
const opening = (c, n, up, rx, ry, s) => lensMesh(c, n, up, { rx, ry, depth: 0.0006 * s, sink: 0.0012 * s, R: 14, K: 2 });
export const NOSE_CARDS = Object.freeze({
  snout: Object.freeze({ reads: 'a broad flat-fronted snout over the nose, two big nostrils on its front', like: 'the pig-snouted guards of 80s space-opera cinema', family: 'nose', region: 'nose',
    coat: Object.freeze({ color: 'Skin' }),
    build(F, s, E) {
      const n = nostrilsOf(E), cz = F.noseTip[2] - 0.004 * s, yFront = F.frontY + 0.013 * s;
      const P = facePatch(F, s, { cx: F.centre[0], cz, rx: 0.026 * s, rz: 0.022 * s,
        lift: (u, v, h) => Math.max(0, (yFront - h.p[1]) * (1 - smooth(0.6, 1, Math.hypot(u, v)))) });
      if (!P) return [];
      const out = [{ name: 'Snout', mesh: P.mesh }];
      for (const [side, sx] of sides) { const c = P.pointAt(F.centre[0] + sx * 0.0085 * s, cz - 0.002 * s); if (c) out.push({ name: `${side}Nostril`, mesh: opening(c, [0, 1, 0.15], [0, 0, 1], 0.003 * s * n, 0.0045 * s * n, s), coat: { color: NOSTRIL } }); }
      return out;
    } }),
  'flared-nostrils': Object.freeze({ reads: 'wide flared nostril wings either side of the nose tip, the openings dark and big', like: 'the flared nostrils of bestial aliens', family: 'nose', region: 'nose',
    coat: Object.freeze({ color: 'Skin' }),
    build(F, s, E) {
      const n = nostrilsOf(E), z = F.noseTip[2] - 0.006 * s, out = [];
      for (const [side, sx] of sides) {
        const h = F.surfaceAt(F.centre[0] + sx * 0.012 * s, z); if (!h) continue;
        out.push({ name: `${side}Wing`, mesh: lensMesh(h.p, h.n, [0, 0, 1], { rx: 0.0075 * s * n, ry: 0.0068 * s * n, depth: 0.0055 * s * n, sink: 0.002 * s }) });
        const o = F.surfaceAt(F.centre[0] + sx * 0.0068 * s, z - 0.003 * s);
        if (o) out.push({ name: `${side}Nostril`, mesh: opening(add(o.p, mul(o.n, 0.0025 * s * n)), unit(add(o.n, [0, 0, -0.9])), [0, 1, 0], 0.0032 * s * n, 0.002 * s * n, s), coat: { color: NOSTRIL } });
      }
      return out;
    } }),
  'slit-nostrils': Object.freeze({ reads: 'two narrow slits for nostrils on the nose tip, a reptile\'s', like: 'the slit-nosed reptilian aliens of 80s–90s sci-fi', family: 'nose', region: 'nose',
    coat: Object.freeze({ color: NOSTRIL }),
    build(F, s, E) {
      const n = nostrilsOf(E), out = [];
      for (const [side, sx] of sides) { const h = F.surfaceAt(F.centre[0] + sx * 0.0055 * s, F.noseTip[2] - 0.004 * s); if (h) out.push({ name: `${side}Slit`, mesh: opening(add(h.p, mul(h.n, 0.0006 * s)), h.n, [0.25 * sx, 0, 1], 0.0011 * s * n, 0.0048 * s * n, s) }); }
      return out;
    } }),
  beak: Object.freeze({ reads: 'a hooked beak from the bridge of the nose over the nose, down past the upper lip', like: 'the beaked bird-people of 80s space-opera cinema and comics', family: 'nose', region: 'nose',
    coat: Object.freeze({ color: '#c9a54a', pattern: [{ kind: 'points', color: '#3a2d16', from: 0.8, soft: 0.1 }] }),
    build(F, s) {
      const top = F.front(F.centre[0], lerp(F.browZ, F.noseTip[2], 0.3)); if (!top) return [];
      const root = sub(top.p, [0, 0.006 * s, 0]), N = 14, drop = top.p[2] - (F.mouth.z - 0.004 * s);
      const line = Array.from({ length: N + 1 }, (_, i) => { const t = i / N; return add(root, [0, 0.03 * s * Math.sin((Math.PI * t) / 1.6) + 0.006 * s * t, -drop * t ** 1.25]); });
      const half = (t) => 0.021 * s * (1 - t) ** 0.7 + 0.0008 * s;
      const m = bladeMesh(keepOff(F, line, (t) => half(t) * 0.75, 0.002 * s), { radius: half, flat: 1, face: () => [1, 0, 0], R: 14 });
      return m ? [{ name: 'Beak', mesh: m }] : [];
    } }),
  'nose-horn': Object.freeze({ reads: 'a horn rising from the top of the nose', like: 'the rhino-horned aliens of space-opera cinema', family: 'nose', region: 'nose',
    coat: Object.freeze({ color: '#d8ccb2', pattern: [{ kind: 'points', color: '#5a4a32', from: 0.7, soft: 0.15 }] }),
    build(F, s) {
      const h = F.front(F.centre[0], F.noseTip[2] + 0.006 * s); if (!h) return [];
      const root = sub(h.p, [0, 0.004 * s, 0]), N = 12, line = Array.from({ length: N + 1 }, (_, i) => { const t = i / N; return add(root, [0, 0.016 * s * t ** 0.6, 0.042 * s * t]); });
      const m = tubeMesh(line, { radius: (t) => 0.0085 * s * (1 - t) ** 0.9 + 0.0004 * s, R: 12 });
      return m ? [{ name: 'Horn', mesh: m }] : [];
    } }),
});

// ─── THE THIRD EYE ──────────────────────────────────────────────────────────────────────────────────────────────────
/** an eye on the forehead at (x, z): its white, its iris and its pupil as domes (the palette's Sclera, Iris and Pupil),
 * framed by two lids (strokes in the skin's colour); `vertical` turns it on its end */
function eyeAt(F, s, x, z, { rx, ry, iris, pupil, vertical = false, lids = true }, name) {
  const h = F.surfaceAt(x, z, 0.006 * s); if (!h) return [];
  // (on its end: the lens's first axis vertical, so its long axis stands up)
  const up = vertical ? [1, 0, 0] : [0, 0, 1], ax = rx, ay = ry, depth = 0.0045 * s, out = [];
  out.push({ name: `${name}White`, mesh: lensMesh(h.p, h.n, up, { rx: ax, ry: ay, depth, sink: 0.002 * s }), coat: { color: 'Sclera' } });
  const front = add(h.p, mul(h.n, depth * 0.72));
  out.push({ name: `${name}Iris`, mesh: lensMesh(front, h.n, up, { rx: iris[0], ry: iris[1], depth: 0.001 * s, sink: 0.0012 * s }), coat: { color: 'Iris' } });
  out.push({ name: `${name}Pupil`, mesh: lensMesh(add(front, mul(h.n, 0.0008 * s)), h.n, up, { rx: pupil[0], ry: pupil[1], depth: 0.0006 * s, sink: 0.001 * s }), coat: { color: 'Pupil' } });
  if (lids) {
    const arc = (a0, a1) => Array.from({ length: 9 }, (_, i) => { const a = lerp(a0, a1, i / 8); return vertical ? [x + 1.2 * ay * Math.sin(a), z + 1.12 * ax * Math.cos(a)] : [x + 1.12 * ax * Math.cos(a), z + 1.2 * ay * Math.sin(a)]; });
    for (const [k, [a0, a1]] of [[0, [0, Math.PI]], [1, [Math.PI, 2 * Math.PI]]]) { const m = stroke(F, arc(a0, a1), { width: 0.0034 * s, height: 0.0028 * s, sink: 0.001 * s, taper: 0.5, per: 3 }); if (m) out.push({ name: `${name}Lid${k}`, mesh: m }); }
  }
  return out;
}
export const EYE_CARDS = Object.freeze({
  'third-eye': Object.freeze({ reads: 'a third eye, lidded, in the middle of the forehead', like: 'the three-eyed seers of 70s–80s sci-fi and myth', family: 'eye', region: 'forehead',
    coat: Object.freeze({ color: 'Skin' }), build: (F, s) => eyeAt(F, s, F.centre[0], F.browZ + 0.026 * s, { rx: 0.011 * s, ry: 0.0062 * s, iris: [0.0049 * s, 0.0049 * s], pupil: [0.0024 * s, 0.0024 * s] }, 'Eye') }),
  'slit-eye': Object.freeze({ reads: 'an upright third eye on the forehead with a slit pupil', like: 'the vertical forehead eyes of demons and seers', family: 'eye', region: 'forehead',
    coat: Object.freeze({ color: 'Skin' }), build: (F, s) => eyeAt(F, s, F.centre[0], F.browZ + 0.03 * s, { rx: 0.012 * s, ry: 0.0056 * s, iris: [0.0075 * s, 0.0044 * s], pupil: [0.0062 * s, 0.0009 * s], vertical: true }, 'Eye') }),
  'gem-eye': Object.freeze({ reads: 'a faceted gem set in the forehead in a raised rim, where a third eye would be', like: 'the forehead jewels of space-opera mystics', family: 'eye', region: 'forehead',
    coat: Object.freeze({ color: 'Skin' }),
    build(F, s) {
      const x = F.centre[0], z = F.browZ + 0.026 * s, h = F.surfaceAt(x, z, 0.006 * s); if (!h) return [];
      const r = 0.0068 * s, ring = stroke(F, Array.from({ length: 17 }, (_, i) => { const a = (2 * Math.PI * i) / 16; return [x + 1.25 * r * Math.cos(a), z + 1.25 * r * Math.sin(a)]; }), { width: 0.003 * s, height: 0.0022 * s, sink: 0.001 * s, taper: 0.05, per: 2 });
      return [{ name: 'Gem', mesh: lensMesh(h.p, h.n, [0, 0, 1], { rx: r, ry: r, depth: 0.0048 * s, sink: 0.002 * s, R: 6, K: 2 }), coat: { color: 'Iris' } }, ...(ring ? [{ name: 'Rim', mesh: ring }] : [])];
    } }),
  'eye-cluster': Object.freeze({ reads: 'three small dark eyes in an arc on the forehead, an insect\'s or a spider\'s', like: 'the clustered eyes of arachnid aliens', family: 'eye', region: 'forehead',
    coat: Object.freeze({ color: 'Skin' }),
    build(F, s) {
      const out = [];
      for (const [name, dx, dz, r] of [['Mid', 0, 0.02, 0.0062], ['R', 0.017, 0.031, 0.0046], ['L', -0.017, 0.031, 0.0046]]) {
        const h = F.surfaceAt(F.centre[0] + dx * s, F.browZ + dz * s, 0.005 * s); if (!h) continue;
        out.push({ name: `${name}Eye`, mesh: lensMesh(h.p, h.n, [0, 0, 1], { rx: r * s, ry: r * s, depth: 0.7 * r * s, sink: 0.002 * s }), coat: { color: 'Pupil' } });
        out.push({ name: `${name}Glint`, mesh: lensMesh(add(h.p, add(mul(h.n, 0.62 * r * s), [0.25 * r * s, 0, 0.3 * r * s])), h.n, [0, 0, 1], { rx: 0.22 * r * s, ry: 0.22 * r * s, depth: 0.0004 * s, sink: 0.0008 * s, R: 10, K: 2 }), coat: { color: '#f4f4f0' } });
      }
      return out;
    } }),
});

// ─── MOUTHS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const IVORY = Object.freeze({ color: '#eee6cf', pattern: [{ kind: 'countershade', color: '#c8b98f', reach: 0.4, soft: 0.2 }] });
/** a tooth from the mouth line at x (0 … 1 of the mouth's half width), `rise` up (a tusk) or down (a fang), `out` toward
 * its side and `forward`, kept in front of the lips and the chin */
const tooth = (F, s, sx, { x, dz, length, rise, out = 0, forward = 0.004, r0, curl = 0 }) => {
  const z0 = F.mouth.z + dz * s, x0 = F.centre[0] + sx * x * F.mouth.halfWidth, h = F.front(x0, z0); if (!h) return null;
  const root = sub(h.p, [0, 0.0025 * s, 0]), N = 10, L = length * s;
  const line = Array.from({ length: N + 1 }, (_, i) => { const t = i / N; return add(root, [sx * out * s * t, forward * s * t + curl * s * t * t, (rise ? 1 : -1) * L * t]); });
  const r = (t) => r0 * s * (1 - t) ** 0.85 + 0.0003 * s;
  return tubeMesh(keepOff(F, line, r, 0.0005 * s).map((p, i) => (i === 0 ? root : p)), { radius: r, R: 10 });
};
const teeth = (spec) => (F, s) => sides.map(([side, sx]) => { const m = tooth(F, s, sx, spec); return m ? { name: side, mesh: m } : null; }).filter(Boolean);
export const MOUTH_CARDS = Object.freeze({
  fangs: Object.freeze({ reads: 'two fangs from under the upper lip, over the lower', like: 'the fanged predators of 80s–90s sci-fi and vampires', family: 'mouth', region: 'mouth',
    coat: IVORY, build: teeth({ x: 0.55, dz: 0.0025, length: 0.011, rise: false, r0: 0.0021 }) }),
  'sabre-fangs': Object.freeze({ reads: 'long sabre fangs from under the upper lip, down past the chin', like: 'the sabre-toothed beasts of 50s–80s monster cinema', family: 'mouth', region: 'mouth',
    coat: IVORY, build: teeth({ x: 0.5, dz: 0.0025, length: 0.03, rise: false, r0: 0.0032, curl: -0.004 }) }),
  tusks: Object.freeze({ reads: 'two tusks from the lower jaw at the corners of the mouth, rising up past the upper lip', like: 'the tusked brutes of fantasy and 80s space opera', family: 'mouth', region: 'mouth',
    coat: IVORY, build: teeth({ x: 0.85, dz: -0.006, length: 0.022, rise: true, out: 0.005, r0: 0.0036, forward: 0.006 }) }),
});

/** every face card, by family, for ./index.js */
export const FACE_CARDS = Object.freeze({ ...MARKING_CARDS, ...EAR_CARDS, ...NOSE_CARDS, ...EYE_CARDS, ...MOUTH_CARDS });
