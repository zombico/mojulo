/**
 * A BUSH READ AS FORM (gen-7): a bush kind (era/thickets.js: a leaf form with the trunk taken away) drawn as the trees are
 * (form/tree-form.js), from the trees' own parts: its wood a few thin stems as tubes (the bark a material), its foliage
 * CLUMPS (vegetation/sprays.js, a bush's LEAF in place of a species) laid over the outline its habit gives, and SITES
 * where its sprays come in near the eye inside them. No grower: a bush is a crown with no trunk, so its outline is drawn
 * (an envelope, slice by slice up it and round it, or the stems' arches) and the clumps laid on it, a layer inside for
 * depth, the stems showing at its foot. A few templates a kind (`seed`), stamped where the bushes stand.
 *
 *   BUSH_HABITS     the habit each leaf form takes as a bush: its outline (`shape`), its proportions, its leaf
 *   bushForm(kind, { seed?, height?, adorn? }) → { form, detail, height, radius, wood, clumps, sites, leaf, bark, needles?,
 *       pad?, adorn?, blooms?, berries?, look? }
 *     adorn: 'bloom' | 'fruit' | null (green): its season (BUSH_ADORN); blooms [{ p, o, s, r }] a blossom facing o,
 *     berries [{ p, n, s, r }] a cluster of n hanging from p; look: the habit's colours and sizes for it
 *   bushBlossom(look) → tris, a blossom facing +z (radius look.r);  bushBerries(look, n, seed) → tris, hanging from the origin
 *     (a needled bush's pads face out of it, `pad: false`: lying level, a tree's way, a bush's rim reads as dark stones)
 *     kind: a bush kind (thickets.js readBush: form, height [lo, hi], spread, stems, splay, girth, density, bark…)
 *     wood, clumps, sites: as treeForm's (clumps and sites [{ p, d, o, s, e, r }], e the depth in the bush, 0..1: inside
 *     dark, outside lit, an occlusion and never baked light; r a rank: a far bush keeps its clumps below a share)
 * Deterministic from the seed.
 */
import { vec } from '../vegetation/grow.js';
import { leafHolds, needleHabit } from '../vegetation/sprays.js';
import { pushTube, hashN } from './tree-form.js';
import { readBush } from '../era/thickets.js';
import * as dmath from '../../util/dmath.js';

const { add, sub, mul, len, unit, cross } = vec;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const TAU = 2 * Math.PI;

/**
 * Each leaf form as a bush: the outline its clumps are laid over (`shape`), its radius (× the kind's spread × height),
 * its clumps' size (`fill`, × their own) and how close they stand (`dense`, more a side), the leaf it carries (a
 * sprays.js LEAF) and how it reads.
 *   dome     an ellipsoid on a lifted skirt (box, laurel)
 *   mound    low and wide, its pads level in layers (juniper)
 *   fountain arches from the foot, the leaves along their outer half (forsythia)
 *   upright  a vase of upright stems, brushes at their tips (broom, heather)
 *   rosette  long leaves in rings from the ground (hosta, fern)
 *   cone     a small cone (a dwarf conifer)
 */
export const BUSH_HABITS = Object.freeze({
  spray: Object.freeze({ shape: 'dome', radius: 1, fill: 1.35, dense: 1, leaf: Object.freeze({ leafSize: 0.045, outline: 'ovate', phyllo: 'spiral' }), reads: 'a dome of small leaves: box, laurel' }),
  plate: Object.freeze({ shape: 'mound', radius: 1.7, fill: 1.2, dense: 1.5, leaf: Object.freeze({ needle: 'silverfir', scale: 0.4 }), reads: 'a low wide mound, its pads level in layers: juniper' }),
  weep: Object.freeze({ shape: 'fountain', radius: 1.25, fill: 1.15, dense: 1, leaf: Object.freeze({ leafSize: 0.05, outline: 'ovate', phyllo: 'distichous' }), reads: 'arches from the foot, leaves along them: forsythia' }),
  tuft: Object.freeze({ shape: 'upright', radius: 0.8, fill: 1.1, dense: 1.3, leaf: Object.freeze({ needle: 'pine', scale: 0.45 }), reads: 'a vase of upright stems, brushes at their tips: broom, heather' }),
  whorl: Object.freeze({ shape: 'rosette', radius: 1.2, fill: 1, dense: 1, leaf: Object.freeze({ leafSize: 0.12, outline: 'broad', phyllo: 'spiral' }), reads: 'long leaves in rings from the ground: hosta, fern' }),
  spire: Object.freeze({ shape: 'cone', radius: 0.6, fill: 1.2, dense: 1.6, leaf: Object.freeze({ needle: 'spruce', scale: 0.3 }), reads: 'a small cone: a dwarf conifer' }),
});
/** What a bush wears in its season (`adorn`): its BLOOM, small blossoms on its outer leaves (each a ring of petals round
 *  an eye, facing out), and its FRUIT, berries hanging in clusters at its outer, lower edge, under the leaves where the
 *  light still finds them. Each habit's colours (sRGB) and sizes (m: a blossom's radius, a berry's): a kind's own, the
 *  palette's later. */
export const BUSH_ADORN = Object.freeze({
  spray: Object.freeze({ bloom: Object.freeze({ petal: [242, 238, 228], eye: [228, 190, 70], r: 0.035 }), fruit: Object.freeze({ c: [178, 28, 36], r: 0.009 }) }),
  plate: Object.freeze({ bloom: Object.freeze({ petal: [226, 214, 128], eye: [196, 170, 70], r: 0.022 }), fruit: Object.freeze({ c: [74, 92, 150], r: 0.007 }) }),
  weep: Object.freeze({ bloom: Object.freeze({ petal: [246, 202, 40], eye: [226, 168, 24], r: 0.03 }), fruit: Object.freeze({ c: [64, 40, 66], r: 0.008 }) }),
  tuft: Object.freeze({ bloom: Object.freeze({ petal: [244, 198, 36], eye: [232, 170, 30], r: 0.022 }), fruit: Object.freeze({ c: [52, 46, 40], r: 0.008 }) }),
  whorl: Object.freeze({ bloom: Object.freeze({ petal: [176, 146, 214], eye: [236, 230, 240], r: 0.04 }), fruit: Object.freeze({ c: [128, 40, 64], r: 0.01 }) }),
  spire: Object.freeze({ bloom: Object.freeze({ petal: [222, 202, 150], eye: [190, 160, 90], r: 0.02 }), fruit: Object.freeze({ c: [92, 104, 136], r: 0.007 }) }),
});
/** How many blossoms an outer clump carries, and the share of the outer, lower clumps a berry cluster hangs from, its
 *  berries; at most `cap` blossoms and clusters a bush (a big mound's season as a small dome's, spread thinner); and
 *  their `size` × the habit's (read at a walker's distance, as the grass's flowers are: form/grass-drifts.js FLOWER_SIZE). */
export const ADORN = Object.freeze({ blooms: 3, fruit: 0.6, berries: Object.freeze([3, 6]), cap: Object.freeze([90, 24]), size: 2.4 });
/** The clumps' spacing on the outline (× a clump's span), the inner layer's depth (× the radius) and share, the sprays a
 *  clump holds near at most, and the stems' sides. */
export const BUSH_FORM = Object.freeze({ spacing: 0.85, inner: Object.freeze([0.55, 0.25]), sprays: 2, sides: 5, skirt: 0.12, detail: Object.freeze([3, 8]) });

/** The outline's radius at height z (0..h) for an envelope shape, 0 past it. */
function outline(shape, z, h, R) {
  const t = z / h;
  if (shape === 'dome') { const zc = 0.56, hz = 0.44, q = (t - zc) / hz; return q * q >= 1 ? 0 : R * Math.sqrt(1 - q * q); }
  if (shape === 'mound') return t >= 1 ? 0 : R * Math.pow(1 - t * t, 0.6);
  if (shape === 'upright') return t >= 1 ? 0 : R * (0.3 + 0.7 * Math.min(1, t * 1.15)) * (t > 0.85 ? Math.sqrt((1 - t) / 0.15) : 1);
  if (shape === 'cone') return t >= 1 ? 0 : R * (1 - t);
  return 0;
}

export function bushForm(kind, { seed = 1, height = null, adorn = null } = {}) {
  if (adorn !== null && adorn !== 'bloom' && adorn !== 'fruit') throw new Error(`bush-form: adorn is 'bloom', 'fruit' or null (green), not '${adorn}'`);
  const K = readBush(kind), H = BUSH_HABITS[K.form];
  if (!H) throw new Error(`bush-form: '${K.form}' has no bush habit (one of ${Object.keys(BUSH_HABITS).join(', ')})`);
  const h = height ?? (K.height[0] + K.height[1]) / 2, R = K.spread * h * H.radius, leaf = H.leaf, needles = needleHabit(leaf);
  const dice = (a, b = 0) => hashN(seed * 7919 + a * 131 + b * 17);
  // a clump's span: its leaves' reach (sprays.js CLUMP, a leaf 3.5 times the leaf's, tilted out), or a pad's length
  const span = needles ? (needles === 'pine' ? 1.2 : 1.1) * leaf.scale : leaf.leafSize * 3.5 * 1.8, gap = span * BUSH_FORM.spacing / Math.sqrt(K.density) / H.dense;
  const holds = leafHolds(leaf), clumps = [], sites = [], W = { pos: [], nrm: [], uv: [], idx: [] };
  const clump = (p, o, d, e, s) => clumps.push({ p: p.map(r4), d: unit(d).map(r4), o: unit(o).map(r4), s: r4(s * H.fill), e: r4(Math.max(0, Math.min(1, e))), r: r4(dice(clumps.length, 3)) });
  const girth = K.girth * h, ns = K.stems, splay = (K.splay * Math.PI) / 180, yaw0 = TAU * dice(1);

  if (H.shape === 'fountain') {
    // ARCHES: stems from the foot rising steep and bending over and down, the leaves along their outer half facing out
    // and up, their sprays running along the arch
    const na = ns * 2;
    for (let a = 0; a < na; a++) {
      const az = yaw0 + (TAU * (a + 0.4 * (dice(10, a) - 0.5))) / na, reach = R * (0.7 + 0.35 * dice(11, a)), top = h * (0.75 + 0.25 * dice(12, a));
      const ax = [dmath.cos(az), dmath.sin(az), 0], at = (t) => add(mul(ax, reach * t), [0, 0, top * dmath.sin(Math.PI * t * 0.78)]);
      const pts = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map(at), rs = pts.map((_, i) => girth * (1 - 0.75 * (i / (pts.length - 1))));
      pushTube(W, pts, rs, BUSH_FORM.sides, true);
      const L = pts.reduce((s, p, i) => (i ? s + len(sub(p, pts[i - 1])) : 0), 0), n = Math.max(2, Math.round((L * 0.6) / gap));
      for (let q = 0; q < n; q++) {
        const t = 0.4 + (0.6 * (q + 0.5)) / n, p = at(t), tan = sub(at(Math.min(1, t + 0.02)), at(Math.max(0, t - 0.02)));
        clump(add(p, [0, 0, span * 0.15]), add(ax, [0, 0, 0.9]), tan, 0.55 + 0.45 * t, 0.85 + 0.3 * dice(13, a * 31 + q));
      }
    }
  } else if (H.shape === 'rosette') {
    // RINGS from the ground: each clump a few long leaves turned out, the outer ring lying lower
    const rings = [[0.15, 0.95], [0.5, 0.7], [0.85, 0.45]];
    rings.forEach(([rr, lift], ri) => {
      const n = Math.max(3, Math.round((TAU * rr * R) / gap));
      for (let q = 0; q < n; q++) {
        const th = yaw0 + (TAU * (q + 0.5 * ri + 0.3 * dice(20 + ri, q))) / n, o = [dmath.cos(th), dmath.sin(th), lift * 1.6];
        clump([dmath.cos(th) * rr * R, dmath.sin(th) * rr * R, h * (0.08 + 0.3 * lift * (1 - rr))], o, [dmath.cos(th), dmath.sin(th), 0], 0.4 + 0.6 * rr, 0.9 + 0.25 * dice(24, ri * 97 + q));
      }
    });
  } else {
    // STEMS: from the foot, splayed, each forking once inside the outline toward its surface; the outline's surface
    // laid with clumps, slice by slice and round, facing out of it; a layer inside for depth
    const z0 = h * (H.shape === 'mound' ? 0.2 : BUSH_FORM.skirt);
    for (let k = 0; k < ns; k++) {
      const az = yaw0 + (TAU * (k + 0.3 * (dice(30, k) - 0.5))) / ns, c = dmath.cos(az), s = dmath.sin(az), lean = H.shape === 'upright' ? splay * 0.5 : H.shape === 'mound' ? splay * 2 : splay;
      const foot = [c * girth * 2, s * girth * 2, 0], zm = h * (H.shape === 'mound' ? 0.25 : 0.45), rm = Math.min(outline(H.shape, zm, h, R) * 0.6, zm * Math.tan(lean));
      const mid = [c * rm, s * rm, zm];
      pushTube(W, [foot, add(mul(foot, 0.5), mul(mid, 0.5)), mid], [girth, girth * 0.85, girth * 0.7], BUSH_FORM.sides, false);
      for (const f of [-1, 1]) {
        const a2 = az + f * 0.45, zt = h * (H.shape === 'mound' ? 0.45 : H.shape === 'cone' ? 0.5 : 0.72), rt = outline(H.shape, zt, h, R) * 0.55;
        pushTube(W, [mid, [dmath.cos(a2) * rt, dmath.sin(a2) * rt, zt]], [girth * 0.6, girth * 0.3], 4, true);
      }
    }
    const nz = Math.max(2, Math.ceil((h - z0) / gap)), dz = (h - z0) / nz;
    for (let i = 0; i <= nz; i++) {
      const z = Math.min(h - dz * 0.35, z0 + i * dz), r = outline(H.shape, z, h, R), top = i === nz;
      const slope = (outline(H.shape, Math.min(h, z + dz * 0.5), h, R) - outline(H.shape, Math.max(0, z - dz * 0.5), h, R)) / dz;
      const n = top || r < gap * 0.5 ? 1 : Math.max(3, Math.round((TAU * r) / gap));
      for (let q = 0; q < n; q++) {
        const th = yaw0 + (TAU * (q + (i % 2) * 0.5 + 0.35 * (dice(40 + i, q) - 0.5))) / n, c = dmath.cos(th), s = dmath.sin(th);
        const rr = n === 1 ? 0 : r * (0.92 + 0.12 * dice(41 + i, q)), p = [c * rr, s * rr, z + (dice(42 + i, q) - 0.5) * dz * 0.4];
        // (the surface's normal: out round the axis, tipped by how the outline narrows up it; the top faces the sky)
        const o = n === 1 ? [0, 0, 1] : [c, s, -slope + (H.shape === 'mound' ? 0.9 : 0.35)];
        clump(p, o, H.shape === 'mound' ? [c, s, 0] : [-s, c, 0.3], 0.5 + 0.5 * (z / h), 0.85 + 0.3 * dice(43 + i, q));
        // (the inner layer: fewer, smaller, in the bush's shade)
        if (n > 1 && dice(44 + i, q) < BUSH_FORM.inner[1]) clump([c * rr * BUSH_FORM.inner[0], s * rr * BUSH_FORM.inner[0], p[2]], o, [-s, c, 0.3], 0.15 + 0.3 * (z / h), 0.7);
      }
    }
  }
  // the sprays near: a clump's leaf area shared by up to BUSH_FORM.sprays of them inside it, each turned along it
  const per = Math.min(BUSH_FORM.sprays, Math.max(1, Math.ceil(holds.clump / holds.spray))), ss = Math.max(0.6, Math.min(2.2, Math.sqrt(holds.clump / (per * holds.spray))));
  for (const [ci, c] of clumps.entries()) for (let j = 0; j < per; j++) {
    const a = TAU * dice(60 + j, ci), off = [dmath.cos(a) * span * 0.25, dmath.sin(a) * span * 0.25, (dice(61 + j, ci) - 0.5) * span * 0.2];
    const d = unit(add(c.o, [dmath.cos(a) * 0.8, dmath.sin(a) * 0.8, 0]));
    sites.push({ p: add(c.p, off).map(r4), d: d.map(r4), o: c.o, s: r4(ss), e: c.e, r: r4(dice(62 + j, ci)) });
  }
  // its season: blossoms on the outer clumps, facing out a little off their leaves; or berries hanging under the outer,
  // lower ones (an inner clump, in the bush's shade, carries neither)
  const blooms = [], berries = [], outer = clumps.filter((c) => c.e >= 0.4);
  if (adorn === 'bloom') for (const [ci, c] of outer.entries()) for (let j = 0; j < ADORN.blooms; j++) {
    // (round the clump's facing: two directions square to it, a turn between them)
    const a = TAU * dice(70 + j, ci), t1 = Math.abs(c.o[2]) > 0.95 ? [1, 0, 0] : unit(cross(c.o, [0, 0, 1])), t2 = cross(c.o, t1), u = add(mul(t1, dmath.cos(a)), mul(t2, dmath.sin(a)));
    const p = add(add(c.p, mul(c.o, span * 0.5 * c.s)), mul(u, span * 0.4 * c.s * dice(71 + j, ci)));
    blooms.push({ p: p.map(r4), o: unit(add(c.o, [0, 0, 0.25])).map(r4), s: r4(0.8 + 0.4 * dice(72 + j, ci)), r: r4(dice(73 + j, ci)) });
  }
  if (adorn === 'fruit') for (const [ci, c] of outer.entries()) {
    if (c.o[2] > 0.85 || c.p[2] > h * 0.85 || dice(80, ci) > ADORN.fruit) continue;
    const p = add(add(c.p, mul(c.o, span * 0.45 * c.s)), [0, 0, -span * 0.12 * c.s]);
    berries.push({ p: p.map(r4), n: ADORN.berries[0] + Math.floor(dice(81, ci) * (ADORN.berries[1] - ADORN.berries[0] + 1)), s: r4(0.85 + 0.3 * dice(82, ci)), r: r4(dice(83, ci)) });
  }
  clumps.sort((a, b) => a.r - b.r); sites.sort((a, b) => a.r - b.r); blooms.sort((a, b) => a.r - b.r).splice(ADORN.cap[0]); berries.sort((a, b) => a.r - b.r).splice(ADORN.cap[1]);
  // (a bush's sprays come in closer than a tree's: it is small, and stands by the walk)
  return { form: K.form, detail: BUSH_FORM.detail, height: r4(h), radius: r4(R), wood: W, clumps, sites, leaf, bark: 'beech', ...(adorn ? { adorn, blooms, berries, look: BUSH_ADORN[K.form][adorn] } : {}), ...(needles ? { needles, pad: false } : {}) };
}

/** A blossom: five petals round an eye, cupped a little, facing +z; each petal two facets so a sun finds them. */
export function bushBlossom(look) {
  const tris = [], R = look.r * ADORN.size, eye = R * 0.32, P = look.petal, E = look.eye || look.petal;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU, w = TAU / 12, at = (ang, r, z) => [dmath.cos(ang) * r, dmath.sin(ang) * r, z].map(r4);
    const base = at(a, eye * 0.8, 0), l = at(a - w, R * 0.62, R * 0.12), rr = at(a + w, R * 0.62, R * 0.12), tip = at(a, R, R * 0.22);
    tris.push({ p: [base, rr, tip], c: P }, { p: [base, tip, l], c: P }, { p: [[0, 0, R * 0.08].map(r4), at(a, eye, R * 0.02), at(a + TAU / 5, eye, R * 0.02)], c: E });
  }
  return tris;
}
/** A cluster of `n` berries hanging from the origin on short stalks: each an octahedron, a glossy bead. */
export function bushBerries(look, n, seed = 1) {
  const tris = [], R = look.r * ADORN.size, C = look.c, d = (a) => hashN(seed * 977 + a);
  for (let k = 0; k < n; k++) {
    const a = TAU * (k / n + 0.2 * d(k)), off = R * 1.6 * Math.sqrt(d(k + 40)), c = [dmath.cos(a) * off, dmath.sin(a) * off, -R * (1.4 + 1.6 * d(k + 80))];
    const r = R * (0.85 + 0.3 * d(k + 120)), V = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]].map((v) => v.map((x, i) => r4(x + c[i])));
    for (const [i, j] of [[0, 2], [2, 1], [1, 3], [3, 0]]) tris.push({ p: [V[i], V[j], V[4]], c: C }, { p: [V[j], V[i], V[5]], c: C });
    tris.push({ p: [[0, 0, 0], [R * 0.15, 0, 0], V[4]], c: [70, 90, 50] });
  }
  return tris;
}
