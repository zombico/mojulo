/**
 * DERMAL JEWEL — the piercings a head wears, for the realistic register: each a SITE on the relational head (the ear's
 * lobe and rim, the nose's wing and septum, the brow, the bridge, the lips), placed from the head's landmarks and settled
 * on its chart (the ear's own samples for the ear's sites), and a KIND of jewellery through it in a METAL.
 *
 *   SITES      where a piercing goes, its default side and kind, and the kinds it takes (`PIERCING_SITES`)
 *   KINDS      stud (a ball, or a gem, on the skin), hoop (a ring through the hole, hanging off the tissue's edge),
 *              barbell (two balls either side of a surface piercing: the brow's, the bridge's), drop (a stud with a
 *              pendant on a short wire)
 *   THE RING   a hoop's wire leaves the hole along the hole's axis (the skin's normal there; the septum's across the
 *              nose), so its plane holds that axis and the way it hangs (down off a lobe, toward a nostril's rim, over
 *              the lip's edge): the hole on the ring, the ring off the edge
 *
 *   readPiercings(spec)            words ('lobes', 'nostril-L', 'septum') or { site, side, kind, metal, gem, size } → the list
 *   pierce(chart, head, spec)      → { pieces: [{ site, side, kind, metal, at, n }], mesh: { vertices, normals, faces,
 *                                    material, piece (each face's piece) }, materials: [{ name, colour, metal, roughness }] }
 *
 * Metres in the chart's frame (x the figure's right, y forward, z up): the mesh lies on the head the chart charts.
 * No dice: the same head and list place the same jewellery. Absent a list, nothing.
 */
import { STAND_M } from './dermal-head.js';
import { hexLin } from './dermal-map.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a, fb = [0, 0, 1]) => { const l = len(a); return l > 1e-12 ? scl(a, 1 / l) : fb; };
const perp = (a, n) => sub(a, scl(n, dot(a, n)));
const r6 = (v) => Math.round(v * 1e6) / 1e6;

/** The metals (sRGB hex, as a jeweller names them) and the gems a stud may set. */
export const JEWEL_METALS = Object.freeze({ gold: '#d9ad55', silver: '#cfd2d6', rose: '#d69a86', steel: '#9ea4aa', black: '#232326' });
export const JEWEL_GEMS = Object.freeze({ diamond: '#eef4ff', ruby: '#b0182e', sapphire: '#1f3fa6', emerald: '#1d8a52', opal: '#d6e4ea', pearl: '#efe8dc', jet: '#141416' });
export const PIERCING_KINDS = Object.freeze(['stud', 'hoop', 'barbell', 'drop']);

/**
 * The sites: `side` both | L | R | mid (on the middle), the default `kind`, the `kinds` it takes, and the jewellery's
 * sizes there in metres (`stud` a ball's radius, `hoop` a ring's radius, `wire` its gauge's radius).
 */
export const PIERCING_SITES = Object.freeze({
  lobe: { side: 'both', kind: 'stud', kinds: ['stud', 'hoop', 'drop'], stud: 0.0019, hoop: 0.009, wire: 0.0007 },
  'upper-lobe': { side: 'both', kind: 'stud', kinds: ['stud', 'hoop'], stud: 0.0014, hoop: 0.006, wire: 0.0005 },
  helix: { side: 'L', kind: 'hoop', kinds: ['stud', 'hoop'], stud: 0.0013, hoop: 0.0045, wire: 0.0005 },
  tragus: { side: 'L', kind: 'stud', kinds: ['stud'], stud: 0.0013 },
  nostril: { side: 'L', kind: 'stud', kinds: ['stud', 'hoop'], stud: 0.0011, hoop: 0.0042, wire: 0.0004 },
  septum: { side: 'mid', kind: 'hoop', kinds: ['hoop'], hoop: 0.0052, wire: 0.0006 },
  brow: { side: 'R', kind: 'barbell', kinds: ['barbell', 'hoop'], stud: 0.0015, hoop: 0.0055, wire: 0.0006, span: 0.0055 },
  bridge: { side: 'mid', kind: 'barbell', kinds: ['barbell'], stud: 0.0015, span: 0.0065 },
  labret: { side: 'mid', kind: 'stud', kinds: ['stud'], stud: 0.0015 },
  'lip-ring': { side: 'R', kind: 'hoop', kinds: ['hoop'], hoop: 0.0048, wire: 0.0006 },
  monroe: { side: 'L', kind: 'stud', kinds: ['stud'], stud: 0.0013 },
  medusa: { side: 'mid', kind: 'stud', kinds: ['stud'], stud: 0.0013 },
});
const SIDES = ['both', 'L', 'R', 'mid'];
const PIERCE_KEYS = ['site', 'side', 'kind', 'metal', 'gem', 'size'];

/** A list of piercings: each a site's word ('lobes' the lobe both sides, 'nostril-R' one side), or { site, side, kind,
 * metal, gem (a stud's), size (× the site's) }. `opts.metal` the list's metal where a piece names none. */
export function readPiercings(spec, { metal = 'silver' } = {}) {
  if (spec === undefined || spec === null) return [];
  if (!Array.isArray(spec)) throw new Error('piercings: a list of site words or { site, side, kind, metal, gem, size }');
  const out = [];
  spec.forEach((q, i) => {
    const at = `piercings[${i}]`;
    let doc = q;
    if (typeof q === 'string') {
      const m = /^(.*?)(?:-(L|R))?$/.exec(q), word = m[1] === 'lobes' ? 'lobe' : m[1];
      doc = { site: word, ...(m[2] ? { side: m[2] } : m[1] === 'lobes' ? { side: 'both' } : {}) };
    }
    if (!doc || typeof doc !== 'object') throw new Error(`${at}: a site word or { site, … }`);
    for (const k of Object.keys(doc)) if (!PIERCE_KEYS.includes(k)) throw new Error(`${at}.${k}: unknown (have ${PIERCE_KEYS.join(', ')})`);
    const S = PIERCING_SITES[doc.site];
    if (!S) throw new Error(`${at}.site: '${doc.site}' (have ${Object.keys(PIERCING_SITES).join(', ')})`);
    const side = doc.side ?? S.side, kind = doc.kind ?? S.kind, mt = doc.metal ?? metal;
    if (!SIDES.includes(side) || (S.side === 'mid') !== (side === 'mid')) throw new Error(`${at}.side: ${S.side === 'mid' ? "'mid' (the site is on the middle)" : 'both | L | R'}`);
    if (!S.kinds.includes(kind)) throw new Error(`${at}.kind: the ${doc.site} takes ${S.kinds.join(' | ')}`);
    if (!JEWEL_METALS[mt] && !/^#[0-9a-f]{6}$/i.test(mt)) throw new Error(`${at}.metal: '#rrggbb' or ${Object.keys(JEWEL_METALS).join(' | ')}`);
    if (doc.gem !== undefined && (kind !== 'stud' || !(JEWEL_GEMS[doc.gem] || /^#[0-9a-f]{6}$/i.test(doc.gem)))) throw new Error(`${at}.gem: a stud's, '#rrggbb' or ${Object.keys(JEWEL_GEMS).join(' | ')}`);
    if (doc.size !== undefined && !(doc.size >= 0.5 && doc.size <= 3)) throw new Error(`${at}.size: 0.5 … 3 (× the site's)`);
    for (const sd of side === 'both' ? ['L', 'R'] : [side]) out.push({ site: doc.site, side: sd, kind, metal: mt, ...(doc.gem ? { gem: doc.gem } : {}), size: doc.size ?? 1 });
  });
  return out;
}

// ─── where each site lies: a point and the hole's axis, and the way a hoop hangs from it ───
function siteFrame(chart, head, site, side) {
  const s = side === 'L' ? -1 : 1, L = head.landmarks, M = (p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M];
  const mir = (p) => [Math.abs(p[0]) * s, p[1], p[2]];
  const V = chart.vertices, N = (i) => chart.normals?.[i] ?? chart.samples[i]?.n ?? [0, 0, 1];
  // (the ear's own samples on this side, facing out: its lobe, its rim)
  const ear = () => V.map((p, i) => i).filter((i) => chart.samples[i]?.feature === 'ear' && V[i][0] * s > 0 && N(i)[0] * s > 0.2);
  // (a point settled on the head's own surface: walked down the field's gradient to its zero, the normal the gradient's,
  // so a site sits on the skin at any chart's resolution; the nearest chart point of `ids` first, where it names them)
  const F = (q) => head.field({ x: q[0] / STAND_M, y: q[1] / STAND_M, z: q[2] / STAND_M }) * STAND_M;
  const grad = (q) => { const e = 1e-4; return unit([0, 1, 2].map((k) => { const a = q.slice(), b = q.slice(); a[k] += e; b[k] -= e; return F(a) - F(b); })); };
  const settle = (q) => { let p = q; for (let it = 0; it < 12; it++) { const d = F(p); if (!Number.isFinite(d)) break; p = sub(p, scl(grad(p), d)); if (Math.abs(d) < 2e-6) break; } return { p, n: grad(p) }; };
  const snap = (ids, q) => { if (!ids) return settle(q); let bi = ids[0], bd = Infinity; for (const i of ids) { const d = len(sub(V[i], q)); if (d < bd) { bd = d; bi = i; } } const at = settle(V[bi]); return Number.isFinite(at.n[0]) ? at : { p: V[bi], n: unit(N(bi)) }; };
  const down = [0, 0, -1], up = [0, 0, 1];
  if (site === 'lobe' || site === 'upper-lobe') {
    const E = ear(); if (!E.length) return null;
    const lo = E.reduce((a, i) => (V[i][2] < V[a][2] ? i : a), E[0]);
    const at0 = snap(E, add(V[lo], [0, 0.001, site === 'lobe' ? 0.006 : 0.013]));
    // (the lobe is a flap facing out: its hole runs across it, out from the head, whatever the curl of its edge)
    const n = unit(add(perp(at0.n, up), [s * 0.8, 0, 0]), [s, 0, 0]), at = { ...at0, n };
    return { ...at, axis: n, hang: unit(perp(down, n), down) };
  }
  if (site === 'helix') {
    const E = ear(); if (!E.length) return null;
    const rim = E.reduce((a, i) => (V[i][2] - 0.6 * V[i][1] > V[a][2] - 0.6 * V[a][1] ? i : a), E[0]);
    const at = snap(E, add(V[rim], [0, 0.002, -0.004]));
    return { ...at, axis: at.n, hang: unit(perp(sub(V[rim], at.p), at.n), up) };
  }
  if (site === 'tragus') {
    const E = ear(); if (!E.length) return null;
    const at = snap(E, add(mir(M(L.tragionR)), [0.003 * s, 0.009, -0.006]));
    return { ...at, axis: at.n, hang: down };
  }
  if (site === 'nostril') {
    const at = snap(null, add(mir(M(L.alR)), [-0.0005 * s, 0.003, 0.004]));
    return { ...at, axis: at.n, hang: unit(perp([0, 0.35, -1], at.n), down) };
  }
  if (site === 'septum') {
    // (inside the nose, under the columella: the hole's axis across it)
    const p = add(M(L.sn), [0, 0.0045, 0.0018]);
    return { p, n: [0, 0, -1], axis: [1, 0, 0], hang: down };
  }
  if (site === 'brow') {
    // the brow's outer third, over the eye's outer corner
    const ex = mir(M(L.exR)), at = snap(null, add(ex, [-0.004 * s, -0.003, 0.016]));
    return { ...at, axis: at.n, hang: unit(perp(up, at.n), up), along: unit(perp(up, at.n), up) };
  }
  if (site === 'bridge') {
    const at = snap(null, add(M(L.n), [0, 0, -0.004]));
    return { ...at, axis: at.n, hang: down, along: unit(perp([1, 0, 0], at.n), [1, 0, 0]) };
  }
  if (site === 'labret') {
    // (down the middle from the lower lip toward the chin, the first skin that faces forward: under the lip's roll, not on it)
    const tries = [0.35, 0.45, 0.55, 0.65, 0.75].map((t) => snap(null, add(add(scl(M(L.li), 1 - t), scl(M(L.pg), t)), [0, 0.01, 0])));
    const at = tries.find((q) => q.n[1] > 0.75) ?? tries[2];
    return { ...at, axis: at.n, hang: down };
  }
  if (site === 'lip-ring') {
    // under the lower lip's edge toward the corner: the ring over the lip's edge
    const ch = s > 0 ? M(L.chR) : M(L.chL), at = snap(null, add(add(scl(M(L.li), 0.55), scl(ch, 0.45)), [0, 0.006, -0.004]));
    return { ...at, axis: at.n, hang: unit(perp(up, at.n), up) };
  }
  if (site === 'monroe') {
    const ch = s > 0 ? M(L.chR) : M(L.chL), at = snap(null, add(add(scl(M(L.ls), 0.4), scl(ch, 0.6)), [0, 0, 0.008]));
    return { ...at, axis: at.n, hang: down };
  }
  if (site === 'medusa') {
    const at = snap(null, scl(add(M(L.sn), M(L.ls)), 0.5));
    return { ...at, axis: at.n, hang: down };
  }
  return null;
}

// ─── the mesh: balls, rings, wires ───
function mesher() {
  const vertices = [], normals = [], faces = [], material = [], piece = [];
  let current = 0;
  const put = (p, n) => { vertices.push(p.map(r6)); normals.push(n.map(r6)); return vertices.length - 1; };
  const quad = (a, b, c, d, m) => { faces.push([a, b, c], [a, c, d]); material.push(m, m); piece.push(current, current); };
  const tri = (a, b, c, m) => { faces.push([a, b, c]); material.push(m); piece.push(current); };
  const ball = (c, r, m, flat = 1) => {
    // (a pole a single point: the rings between it and the other pole, fanned to it, no face collapsed onto one)
    const NA = 12, NB = 8, pt = (th, ph) => { const n = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; return put(add(c, [n[0] * r, n[1] * r, n[2] * r * flat]), n); };
    const top = pt(0, 0), rows = [];
    for (let j = 1; j < NB; j++) rows.push(Array.from({ length: NA }, (_, i) => pt((Math.PI * j) / NB, (2 * Math.PI * i) / NA)));
    const bot = pt(Math.PI, 0);
    for (let i = 0; i < NA; i++) tri(top, rows[0][i], rows[0][(i + 1) % NA], m);
    for (let j = 0; j + 1 < rows.length; j++) for (let i = 0; i < NA; i++) quad(rows[j][i], rows[j + 1][i], rows[j + 1][(i + 1) % NA], rows[j][(i + 1) % NA], m);
    for (let i = 0; i < NA; i++) tri(bot, rows.at(-1)[(i + 1) % NA], rows.at(-1)[i], m);
  };
  // a ring about `c` in the plane of e1, e2 (radius R, the wire's r)
  const ring = (c, e1, e2, R, r, m) => {
    const NA = 28, NB = 6, ids = [];
    const ax = cross(e1, e2);
    for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) {
      const a = (2 * Math.PI * i) / NA, b = (2 * Math.PI * j) / NB, out = add(scl(e1, Math.cos(a)), scl(e2, Math.sin(a))), n = add(scl(out, Math.cos(b)), scl(ax, Math.sin(b)));
      ids.push(put(add(add(c, scl(out, R)), scl(n, r)), n));
    }
    for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) { const i2 = (i + 1) % NA, j2 = (j + 1) % NB; quad(ids[i * NB + j], ids[i2 * NB + j], ids[i2 * NB + j2], ids[i * NB + j2], m); }
  };
  const wire = (a, b, r, m) => {
    const t = unit(sub(b, a)), e1 = unit(perp([1, 0, 0], t), unit(perp([0, 1, 0], t))), e2 = cross(t, e1), NA = 6, ids = [];
    for (const p of [a, b]) for (let i = 0; i < NA; i++) { const g = (2 * Math.PI * i) / NA, n = add(scl(e1, Math.cos(g)), scl(e2, Math.sin(g))); ids.push(put(add(p, scl(n, r)), n)); }
    for (let i = 0; i < NA; i++) quad(ids[i], ids[(i + 1) % NA], ids[NA + ((i + 1) % NA)], ids[NA + i], m);
    // (capped both ends: every piece a closed solid)
    const ca = put(a, scl(t, -1)), cb = put(b, t);
    for (let i = 0; i < NA; i++) { tri(ca, ids[(i + 1) % NA], ids[i], m); tri(cb, ids[NA + i], ids[NA + ((i + 1) % NA)], m); }
  };
  return { vertices, normals, faces, material, piece, ball, ring, wire, at: (i) => { current = i; } };
}

/** The piercings on a head: each placed on its site and its jewellery meshed. `spec` as readPiercings takes it. */
export function pierce(chart, head, spec, opts = {}) {
  const list = readPiercings(spec, opts), M = mesher(), materials = [], matOf = new Map();
  const mat = (name, hex, metal) => { const k = `${name}:${hex}`; if (!matOf.has(k)) { matOf.set(k, materials.length); materials.push({ name, colour: hexLin(hex).map((v) => Math.round(v * 1e4) / 1e4), metal, roughness: metal ? 0.22 : 0.08 }); } return matOf.get(k); };
  const pieces = [];
  for (const P of list) {
    const F = siteFrame(chart, head, P.site, P.side); if (!F) continue;
    M.at(pieces.length);
    const S = PIERCING_SITES[P.site], z = P.size, hexM = JEWEL_METALS[P.metal] ?? P.metal, m = mat(P.metal, hexM, true);
    if (P.kind === 'stud') {
      const r = S.stud * z, g = P.gem ? mat(P.gem, JEWEL_GEMS[P.gem] ?? P.gem, false) : m;
      M.ball(add(F.p, scl(F.n, r * 0.55)), r, g, P.gem ? 0.7 : 1);
    } else if (P.kind === 'hoop') {
      // the hole on the ring, the ring hanging off the tissue's edge: its centre `hang` from the hole by its radius
      const R = S.hoop * z, e1 = scl(F.hang, -1), e2 = unit(perp(F.axis, F.hang), F.n);
      M.ring(add(F.p, scl(F.hang, R)), e1, e2, R, S.wire * Math.sqrt(z), m);
    } else if (P.kind === 'barbell') {
      const r = S.stud * z, u = F.along ?? F.hang, h = S.span * z;
      for (const k of [-1, 1]) M.ball(add(add(F.p, scl(u, k * h)), scl(F.n, r * 0.5)), r, m);
      M.wire(add(F.p, scl(u, -h)), add(F.p, scl(u, h)), r * 0.35, m);
    } else if (P.kind === 'drop') {
      // a stud and, on a short wire beneath it, a pendant
      const r = S.stud * z, top = add(F.p, scl(F.n, r * 0.55)), end = add(top, [0, 0, -0.012 * z]);
      M.ball(top, r, m); M.wire(top, end, 0.00035, m); M.ball(add(end, [0, 0, -0.0025 * z]), 0.0025 * z, m, 1.3);
    }
    pieces.push({ ...P, at: F.p.map(r6), n: F.n.map(r6) });
  }
  return { pieces, mesh: { vertices: M.vertices, normals: M.normals, faces: M.faces, material: M.material, piece: M.piece }, materials };
}
