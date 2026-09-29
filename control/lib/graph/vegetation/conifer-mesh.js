// vegetation/conifer-mesh — what a grown conifer (conifer.js) wears, and its ladder of detail.
//
// Needles. The World page draws opaque vertex colour (no alpha cut-out), so a shoot's needles are geometry whose EDGE
// reads as needles: a sawtooth strip, each tooth a needle's length out from the shoot. The habit is the species':
//   brush (spruce, pine)  two toothed strips crossed at 90°: needles all round the shoot (a pine's are long);
//   spray (fir)           one flat strip in the branch's plane (two-ranked), and a brush on the sunlit top shoots,
//                         where Abies carries its needles all round (Edelin 1981).
// Shoots deep in the crown (exposure under `hide`) are dropped: nobody sees them. `volume` lets a shoot stand in for
// the finer shoots the grower does not grow: the brush widens and its teeth space out by the same factor, so cover
// grows at the same face count (the clusters' coverage idea in ladder.js, for needles).
//
// Far off ("fluff"), a conifer is not a cloud: its levels come from the crown's own envelope (the p90 radius of the
// needled shoots by height), not from voxel puffs.
//   L3 hero : bark on axes thicker than 6 cm, tubes to 1 cm, every visible shoot's needles
//   L2 near : bark on the trunk and limbs, tubes to 4 cm, the outer shoots' needles at volume
//   L1 mid  : tiers — one skirt per crown band, drooping and jittered at the rim, dark beneath (spruce, fir); a pine's
//             crown IS clumps, so a pine is one puff per limb's needle mass
//   L0 far  : a spire — a lathe of the envelope at five heights (spruce, fir); a pine keeps its biggest clumps
import { axisChains, tubeTris, barkQuads, woodTone, blobTris, defaultSides } from './tree-mesh.js';
import { mix as mixU } from './util.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const SHADE = [16, 30, 24];
const mix = (a, b, t) => mixU(a, b, Math.max(0, Math.min(1, t)));

/** Needle habit and tone (dark, lit) per conifer: pine greyest, fir darkest and glossiest, spruce blue-dark; `volume`
 *  multiplies every level's (a pine's needle mass is in few shoots). */
export const HABIT = Object.freeze({
  spruce: { form: 'brush', needle: 0.03, step: 0.05, lean: 0.45, tone: [[22, 44, 34], [60, 92, 72]], hide: 0.3 },
  silverfir: { form: 'spray', needle: 0.032, step: 0.045, lean: 0.25, tone: [[20, 46, 30], [56, 100, 62]], topBrush: 0.72, hide: 0.28 },
  pine: { form: 'brush', needle: 0.075, step: 0.045, lean: 0.55, tone: [[58, 80, 62], [120, 142, 108]], hide: 0.05, volume: 1.6 },   // few shoots, each a dense tuft
});

/** A toothed strip from a to b in the plane of the shoot and `side`: teeth on both edges, leaning forward. */
function strip(a, b, side, h, c, out) {
  const d = sub(b, a); const t = unit(d); const n = Math.max(1, Math.round(len(d) / h.step));
  for (let i = 0; i < n; i++) {
    const p0 = add(a, mul(d, i / n)), p1 = add(a, mul(d, (i + 1) / n)); const m = mul(add(p0, p1), 0.5);
    for (const sg of [-1, 1]) out.push({ p: [p0, p1, add(add(m, mul(side, sg * h.needle)), mul(t, h.lean * h.needle))], c, kind: 'leaf' });
  }
}
/** The needles of every visible shoot. */
export function needleTris(plant, species, { hide = null, volume = 1 } = {}) {
  const h0 = HABIT[species]; const v = volume * (h0.volume || 1); const h = { ...h0, needle: h0.needle * v, step: h0.step * v }; const cutAt = hide ?? h.hide;
  const out = []; const UP = [0, 0, 1];
  for (const n of plant.nodes) {
    if (n.died || !n.leaves || n.parent < 0) continue;
    const e = plant.exposure(n.pos); if (e < cutAt) continue;
    const a = plant.nodes[n.parent].pos, b = n.pos; const t = unit(sub(b, a));
    let s1 = cross(t, UP); s1 = len(s1) < 1e-6 ? [1, 0, 0] : unit(s1); const s2 = unit(cross(t, s1));
    const j = ((n.id * 2654435761) >>> 0) / 4294967296; const c = mix(h.tone[0], h.tone[1], 0.05 + 0.8 * e + 0.25 * (j - 0.5));   // shoot to shoot, a little light or dark
    const brush = h.form === 'brush' || (h.topBrush && e > h.topBrush);
    strip(a, b, s1, h, c, out); if (brush) strip(a, b, s2, h, mix(c, SHADE, 0.2), out);
  }
  return out;
}

/** The crown's envelope: per band of height, the p90 radius of the needled shoots, and the lowest needled height. */
export function crownEnvelope(plant, bands = 12) {
  const H = plant.H; const leafy = plant.nodes.filter((n) => !n.died && n.leaves > 0 && n.order > 0);
  const base = leafy.length ? Math.min(...leafy.map((n) => n.pos[2])) : 0.5 * H; const span = H - base;
  const r = []; for (let b = 0; b < bands; b++) { const lo = base + (b / bands) * span, hi = base + ((b + 1) / bands) * span; const rs = leafy.filter((n) => n.pos[2] >= lo && n.pos[2] < hi).map((n) => Math.hypot(n.pos[0], n.pos[1])).sort((x, y) => x - y); r.push(rs.length ? rs[Math.floor(0.9 * (rs.length - 1))] : 0); }
  return { base, span, H, r, z: (b) => base + ((b + 0.5) / bands) * span };
}
const ring = (z, R, k, phase = 0) => [...Array(k)].map((_, j) => { const a = phase + (2 * Math.PI * j) / k; return [R * Math.cos(a), R * Math.sin(a), z]; });
function trunkTo(plant, upTo, sides) {
  const col = woodTone(plant); const tris = [];
  for (const ch of axisChains(plant)) if (ch.order === 0) { const k = ch.pts.findIndex((p) => p[2] > upTo); const c = k > 1 ? { ...ch, pts: ch.pts.slice(0, k + 1), rs: ch.rs.slice(0, k + 1), nodes: ch.nodes.slice(0, k), continues: true } : ch; for (const t of tubeTris(c, { sidesFor: () => sides, colorFor: col })) tris.push(t); }
  return tris;
}
const toneAt = (species, low, lit) => { const [a, b] = HABIT[species].tone; return mix(a, b, 0.1 + 0.8 * lit - 0.2 * low); };

/** L1 tiers: one skirt per crown band, a cone from a collar at the trunk to a drooping, jittered rim. */
export function tiersTris(plant, species, { tiers = 7, sides = 7, droop = 0.35 } = {}) {
  const E = crownEnvelope(plant, tiers); const tris = trunkTo(plant, E.base + 0.1 * E.span, 4); const band = E.span / tiers;
  for (let b = 0; b < tiers; b++) {
    const R = Math.max(E.r[b], 0.15); const zTop = E.base + (b + 1) * band; const zRim = zTop - band * (1 + droop);
    const top = [0, 0, zTop + 0.25 * band]; const under = [0, 0, zRim + 0.35 * band];
    const rim = ring(zRim, R, sides, b * 0.9).map((q, j) => { const w = 0.82 + 0.3 * (((b * 7 + j * 13) % 11) / 10); return [q[0] * w, q[1] * w, q[2] - 0.12 * band * ((j * 5 + b) % 3)]; });
    const f = b / tiers; const c = toneAt(species, 1 - f, 0.55 + 0.45 * f); const cu = mix(c, SHADE, 0.45);
    for (let j = 0; j < sides; j++) { const a = rim[j], d = rim[(j + 1) % sides]; tris.push({ p: [top, a, d], c, kind: 'leaf' }, { p: [under, d, a], c: cu, kind: 'leaf' }); }
  }
  return tris;
}
/** L0 spire: one lathe of the envelope, at `rings` heights, `sides` round. */
export function spireTris(plant, species, { rings = 5, sides = 6 } = {}) {
  const E = crownEnvelope(plant, rings); const tris = trunkTo(plant, E.base + 0.05 * E.span, 3);
  const prof = E.r.map((R, b) => ({ z: E.z(b) - 0.5 * (E.span / rings), R: Math.max(R, 0.1) }));
  prof.unshift({ z: E.base - 0.02 * E.span, R: prof[0].R * 0.85 }); prof.push({ z: E.H + 0.02 * E.span, R: 0 });
  for (let i = 0; i < prof.length - 1; i++) {
    const a = ring(prof[i].z, prof[i].R, sides), b = ring(prof[i + 1].z, prof[i + 1].R, sides); const f = i / (prof.length - 1); const c = toneAt(species, 1 - f, 0.5 + 0.5 * f);
    for (let j = 0; j < sides; j++) { const j2 = (j + 1) % sides; if (prof[i + 1].R > 0) tris.push({ p: [a[j], a[j2], b[j2]], c, kind: 'leaf' }, { p: [a[j], b[j2], b[j]], c, kind: 'leaf' }); else tris.push({ p: [a[j], a[j2], b[0]], c, kind: 'leaf' }); }
  }
  const bot = [0, 0, prof[0].z]; const r0 = ring(prof[0].z, prof[0].R, sides); const cu = mix(toneAt(species, 1, 0.3), SHADE, 0.4);
  for (let j = 0; j < sides; j++) tris.push({ p: [bot, r0[(j + 1) % sides], r0[j]], c: cu, kind: 'leaf' });
  return tris;
}
/** A pine's clumps: its needled shoots grouped by limb, one puff per limb's needle mass, the biggest `max`. */
export function clumpTris(plant, species, { max = 9, detail = 0 } = {}) {
  const E = crownEnvelope(plant, 4); const tris = trunkTo(plant, E.base + 0.3 * E.span, 4); const groups = new Map();
  const limbOf = (n) => { let m = n; while (m.order > 1) m = plant.nodes[m.parent]; return m.order === 1 ? m.axis : -1; };
  for (const n of plant.nodes) { if (n.died || !n.leaves) continue; const a = limbOf(n); if (!groups.has(a)) groups.set(a, []); groups.get(a).push(n); }
  const gs = [...groups.values()].map((ns) => { const w = ns.length; const m = [0, 1, 2].map((i) => ns.reduce((s, n) => s + n.pos[i], 0) / w); const sd = [0, 1, 2].map((i) => Math.sqrt(ns.reduce((s, n) => s + (n.pos[i] - m[i]) ** 2, 0) / w)); return { w, m, sd, e: ns.reduce((s, n) => s + plant.exposure(n.pos), 0) / w }; })
    .sort((a, b) => b.w - a.w || a.m[2] - b.m[2]).slice(0, max);
  for (const g of gs) { const h = Math.max(1.7 * g.sd[0], 1.7 * g.sd[1], 0.5); const r = [1.1 * Math.max(0.5, 1.5 * g.sd[0]), 1.1 * Math.max(0.5, 1.5 * g.sd[1]), Math.max(0.45 * h, 1.3 * g.sd[2])]; for (const t of blobTris(g.m, r, toneAt(species, 0.3, g.e), { detail })) tris.push(t); }
  return tris;
}

/**
 * Trunk and limbs: bark quads (the tile's uv) on axes at least `barkD` across, plain tubes down to `minD`. With
 * `barks.high`, a pine's trunk changes from `low` (grey plates) to `high` (papery orange) at `change` of its height,
 * and its limbs above that wear `high`.
 */
function woodTris(plant, { minD, barkD, barks, change = 0.45, sidesMax = 10 }) {
  const tris = []; const col = woodTone(plant); const H = plant.H; const sidesFor = (r) => Math.min(sidesMax, defaultSides(r));
  const quads = (ch, b) => { for (const q of barkQuads(ch, { sidesFor, tile: b.metres, color: b.mean, key: b.key })) tris.push(q); };
  for (const ch of axisChains(plant)) {
    if (ch.dMax < minD) continue;
    if (barks && ch.dMax >= barkD) {
      if (barks.high && ch.order === 0) {
        const k = Math.max(2, ch.pts.findIndex((q) => q[2] > change * H));
        quads({ ...ch, pts: ch.pts.slice(0, k + 1), rs: ch.rs.slice(0, k + 1) }, barks.low); quads({ ...ch, pts: ch.pts.slice(k), rs: ch.rs.slice(k) }, barks.high);
      } else quads(ch, barks.high && ch.pts[0][2] > change * H ? barks.high : barks.low);
      continue;
    }
    const upper = barks && barks.high ? (c, i) => (c.pts[i][2] > 0.4 * H ? mix(col(c, i), barks.high.mean, 0.6) : col(c, i)) : col;
    for (const t of tubeTris(ch, { sidesFor, colorFor: upper })) tris.push(t);
  }
  return tris;
}

/** The four levels of one grown conifer. `barks`: { low: tile, high?: tile } from tiles.js `barkTile`. */
export function coniferLadder(plant, species, { barks = null } = {}) {
  const pine = species === 'pine'; const H = plant.H;
  const L3 = woodTris(plant, { minD: 0.01, barkD: 0.06, barks }); for (const t of needleTris(plant, species, { volume: 1.7 })) L3.push(t);
  const L2 = woodTris(plant, { minD: Math.max(0.04, H / 420), barkD: 0.06, barks, sidesMax: 6 }); for (const t of needleTris(plant, species, { hide: pine ? 0.12 : 0.4, volume: 2.6 })) L2.push(t);   // a pine's needles are inside its clumps
  return {
    L3, L2,
    L1: pine ? clumpTris(plant, species, { max: 14, detail: 1 }) : tiersTris(plant, species),
    L0: pine ? clumpTris(plant, species, { max: 7 }) : spireTris(plant, species),
  };
}
