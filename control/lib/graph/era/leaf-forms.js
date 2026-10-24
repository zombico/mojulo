/**
 * LEAF FORMS — a gritty crown grown as LEAF BRANCHES instead of one heap of balls: the trunk forks into structural
 * limbs, each limb throws leaf branches, and each leaf branch ends in a LOBE, an ellipsoid shaped and turned by the
 * form so the leaf pattern reads as the plant's own (a spray's fans, a beech's plates, a willow's drops). Each lobe is
 * a dark core with chips over it (era/leaf-chips.js, the painted crown), the chips grained along the lobe's length and
 * leant as the form holds its leaves. Far, the lobes' cores alone carry the tree: its silhouette the branches' own.
 *
 *   LEAF_FORMS                       the forms: spray, plate, weep, tuft, whorl
 *   TREE_KIND_KEYS                   a tree kind's settings (a biocube's `flora.trees.kinds`, era/biocube.js): a form,
 *                                      its proportions and the colours it takes from the theorist's offer
 *   readKind(kind)                   a form's name or a kind → the kind ({ form, … })
 *   lobeTris(lobe, { detail, shrink }) → the lobe's skin as triangles (a core's facets)
 *   withinLobe(p, lobe, s)           → whether p lies inside the lobe scaled by s
 *   leafForm(form, tree)             → { limbs: [{ pts, radii }], twigs: [{ pts, radii }], lobes: [lobe] }, a lobe
 *                                      { at, axes: [a, b, c] (metres along u, v, w), frame: [u, v, w], long (unit) }
 *                                      tree: { base: [x, y, z], h, c (the crown's middle), Rc (its radius), seed,
 *                                      density (its limbs, 1 the form's own) }
 *   formCore(lobes, opts)            → { faces, lobes } the lobes as dark cores (two stops by the sun, as chipCore; `detail`
 *                                      0 for a far tree's, 1 by default), with
 *                                      each lobe's triangles and bounding radius for hollowed (era/isekai.js)
 *   formChips(lobes, opts)           → the chips over the lobes (leafChips' light bands), none buried in another lobe
 *
 *   opts: { crown: { c, Rc, squash }, toSun, shadow(p, n), ramp, seed, …CHIP_DEFAULTS, grain, lean }
 *
 * Pure: hashed dice only.
 */
import { hash3 } from './dirt.js';
import { P, r5, rgbHex } from './geom.js';
import { blobTris } from '../vegetation/tree-mesh.js';
import { CHIP_DEFAULTS } from './leaf-chips.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => a + (b - a) * t;
const hexOf = (c) => rgbHex(c.map((v) => v / 255));
const dirOf = (az, el) => [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
const DEG = Math.PI / 180;

/** A frame whose u runs along `d`, w as near up as it can: a lobe stretched along a twig. */
const alongFrame = (d) => { const u = unit(d), s = Math.abs(u[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1], v = unit(cross(s, u)); return [u, v, cross(u, v)]; };
/** A level frame turned to azimuth `az`, tipped `tilt` radians about its v: a plate, a whorl's spoke. */
const levelFrame = (az, tilt = 0) => { const u = dirOf(az, tilt), v = [-Math.sin(az), Math.cos(az), 0]; return [u, v, cross(u, v)]; };
const lobe = (at, axes, frame) => { const k = axes.indexOf(Math.max(...axes)); return { at: at.map(r5), axes: axes.map(r5), frame, long: frame[k] }; };

/**
 * THE FORMS, in the crown's radius: how many limbs and how they rise (`limbs`, `rise` degrees, `reach`), where along a
 * limb its leaf branches leave (`at`), and the lobes each grows (`grow`). On the chips: `grain` (0..1) how far a chip's
 * length follows its lobe's, `lean` a bias on a chip's facing (world, added to its normal).
 */
export const LEAF_FORMS = Object.freeze({
  // fans of leaves along short twigs that leave each limb on alternate sides, lifting
  spray: Object.freeze({ limbs: [5, 6], rise: [30, 58], reach: 0.82, at: [0.4, 0.6, 0.8, 1], grain: 0.8, lean: [0, 0, 0.15] }),
  // flat plates held level in tiers, the limbs spreading low and the plates broad and thin, the leaves facing the sky
  plate: Object.freeze({ limbs: [6, 7], rise: [12, 30], reach: 0.9, at: [0.6, 1], grain: 0.2, lean: [0, 0, 0.75] }),
  // long drops hanging from arching limbs, the leaves hanging along them
  weep: Object.freeze({ limbs: [6, 7], rise: [40, 60], reach: 0.7, at: [0.7, 1], grain: 0.9, lean: [0, 0, -0.1] }),
  // small upright lobes in brushes at the limbs' tips, the limbs bare below them
  tuft: Object.freeze({ limbs: [6, 7], rise: [48, 70], reach: 0.92, at: [1], grain: 0.55, lean: [0, 0, 0.3] }),
  // a ring of spokes round each limb's end, radiating level, a small heart in the middle
  whorl: Object.freeze({ limbs: [4, 5], rise: [38, 55], reach: 0.8, at: [1], grain: 0.9, lean: [0, 0, 0.2] }),
});
export const LEAF_FORM_IDS = Object.freeze(Object.keys(LEAF_FORMS));
/**
 * A TREE KIND: a silhouette and how it is built, composed by whoever makes the level, not looked up from nature.
 *   form     the silhouette (LEAF_FORMS)
 *   scale    its height against the level's tree heights (1 as they are)
 *   trunk    where the crown starts, a share of its height (absent: the kit's crown)
 *   girth    the trunk's radius, a share of its height (absent: the kit's)
 *   spread   the crown's radius, a share of its height (absent: the kit's)
 *   density  its limbs against the form's (1 the form's own)
 *   leaf     its foliage: 0 the world's, 1..FLORA_OFFER the theorist's offer (era/flora-colours.js)
 *   bark     its wood: 0 the world's, 1..FLORA_OFFER the theorist's offer
 */
export const TREE_KIND_KEYS = Object.freeze(['form', 'scale', 'trunk', 'girth', 'spread', 'density', 'leaf', 'bark']);
export const readKind = (k) => (typeof k === 'string' ? { form: k } : k);

/** The leaf branches and their lobes for one leaf branch of each form, from where it leaves (`p`), its limb's
 *  heading (`dir`, `az`), its place along the limb (`f`), its index (`j`) and the crown's radius. */
const GROW = {
  spray: (p, dir, az, f, j, R, h) => {
    const side = j % 2 ? 1 : -1, d = unit(add(dirOf(az + side * mix(30, 55, h(1)) * DEG, mix(15, 35, h(2)) * DEG), mul(dir, 0.4))), L = R * mix(0.26, 0.36, h(3));
    const end = add(p, mul(d, L)), mid = add(p, mul(d, L * 0.5));
    return { twig: [p, end], lobes: [lobe(mid, [R * 0.24, R * 0.15, R * 0.12], alongFrame(d)), lobe(end, [R * mix(0.28, 0.36, h(4)), R * 0.17, R * 0.13], alongFrame(d))] };
  },
  plate: (p, dir, az, f, j, R, h) => {
    const d = unit([dir[0], dir[1], 0.1]), end = add(p, mul(d, R * mix(0.08, 0.16, h(1)))), a = R * mix(0.34, 0.46, h(2));
    return { twig: [p, end], lobes: [lobe(add(end, [0, 0, R * 0.04]), [a, a * mix(0.75, 0.9, h(3)), R * 0.085], levelFrame(az + (h(4) - 0.5) * 0.6, (h(5) - 0.5) * 0.18))] };
  },
  weep: (p, dir, az, f, j, R, h) => {
    const out = unit([dir[0], dir[1], 0]), lobes = [], n = 2 + (h(1) < 0.5 ? 1 : 0), ends = [];
    for (let i = 0; i < n; i++) {
      const a2 = az + (i - (n - 1) / 2) * mix(18, 28, h(2 + i)) * DEG, top = add(p, add(mul(dirOf(a2, 0), R * mix(0.12, 0.22, h(5 + i))), [0, 0, R * 0.06]));
      const len = R * mix(0.36, 0.5, h(8 + i)), down = unit([out[0] * 0.18, out[1] * 0.18, -1]);
      lobes.push(lobe(add(top, mul(down, len * 0.85)), [len, R * 0.1, R * 0.09], alongFrame(down))); ends.push(top);
    }
    return { twig: [p, ...ends.slice(0, 1)], twigs: ends.map((e) => [p, e]), lobes };
  },
  tuft: (p, dir, az, f, j, R, h) => {
    const lobes = [], twigs = [];
    for (let i = 0; i < 3; i++) {
      const d = unit(add(dirOf(az + (i - 1) * mix(35, 50, h(1 + i)) * DEG, mix(35, 65, h(4 + i)) * DEG), mul(dir, 0.3))), end = add(p, mul(d, R * mix(0.12, 0.2, h(7 + i))));
      twigs.push([p, end]); lobes.push(lobe(add(end, mul(d, R * 0.12)), [R * mix(0.2, 0.26, h(10 + i)), R * 0.15, R * 0.15], alongFrame(d)));
    }
    return { twig: twigs[0], twigs, lobes };
  },
  whorl: (p, dir, az, f, j, R, h) => {
    const n = 5 + (h(1) < 0.5 ? 1 : 0), lobes = [lobe(add(p, [0, 0, R * 0.05]), [R * 0.12, R * 0.12, R * 0.09], levelFrame(az))], twigs = [];
    for (let i = 0; i < n; i++) {
      const a2 = az + (2 * Math.PI * (i + 0.25 * h(2 + i))) / n, fr = levelFrame(a2, mix(8, 20, h(9 + i)) * DEG), len = R * mix(0.28, 0.36, h(15 + i));
      lobes.push(lobe(add(p, mul(fr[0], len * 0.85)), [len, R * 0.1, R * 0.065], fr));
    }
    return { twig: null, twigs, lobes };
  },
};

/** One tree's limbs, leaf branches and lobes in a form. */
export function leafForm(form, { base, h, c, Rc, seed = 1, density = 1 }) {
  const F = LEAF_FORMS[form], grow = GROW[form];
  if (!F) throw new Error(`leaf form '${form}' is not one (${LEAF_FORM_IDS.join(', ')})`);
  const S = seed | 0, H = (a, b) => hash3(S, a, b + 4801), n0 = F.limbs[0] + Math.floor(H(1, 1) * (F.limbs[1] - F.limbs[0] + 1)), yaw = 2 * Math.PI * H(2, 1);
  const n = density === 1 ? n0 : Math.max(2, Math.round(n0 * density));
  const limbs = [], twigs = [], lobes = [];
  // (the fork low in the crown; a plate's limbs leave the trunk in tiers, so its plates stand one over another)
  const fork = [c[0], c[1], c[2] - 0.45 * Rc];
  for (let i = 0; i < n; i++) {
    const az = yaw + (form === 'plate' ? i * 2.39996 + 0.3 * H(10 + i, 2) : (2 * Math.PI * (i + 0.35 * H(10 + i, 2))) / n), el = mix(F.rise[0], F.rise[1], H(20 + i, 3)) * DEG;
    const from = form === 'plate' ? [fork[0], fork[1], fork[2] - Rc * 0.35 + (Rc * 0.9 * i) / Math.max(1, n - 1)] : fork;
    const reach = Rc * F.reach * mix(0.85, 1.1, H(30 + i, 4)) * (form === 'plate' ? mix(1.05, 0.6, i / Math.max(1, n - 1)) : 1);
    const dir = dirOf(az, el), elbow = add(from, mul(dirOf(az, el * 1.25), reach * 0.5)), end = add(from, mul(dir, reach));
    limbs.push({ pts: [from, elbow, end], radii: [0.03 * h, 0.022 * h, 0.012 * h] });
    F.at.forEach((f, j) => {
      const p = f <= 0.5 ? add(from, mul(sub(elbow, from), f * 2)) : add(elbow, mul(sub(end, elbow), (f - 0.5) * 2));
      const g = grow(p, dir, az, f, j + i, Rc, (k) => H(100 + i * 31 + j * 7, k));
      for (const t of g.twigs ?? (g.twig ? [g.twig] : [])) twigs.push({ pts: t, radii: [0.009 * h, 0.005 * h] });
      lobes.push(...g.lobes);
    });
  }
  return { limbs, twigs, lobes };
}

// a point on a lobe's skin for a direction on the unit sphere, and the skin's normal there
const onLobe = (L, d, s = 1) => add(L.at, add(add(mul(L.frame[0], d[0] * L.axes[0] * s), mul(L.frame[1], d[1] * L.axes[1] * s)), mul(L.frame[2], d[2] * L.axes[2] * s)));
const normalOn = (L, d) => unit(add(add(mul(L.frame[0], d[0] / L.axes[0]), mul(L.frame[1], d[1] / L.axes[1])), mul(L.frame[2], d[2] / L.axes[2])));
// inside a lobe scaled by `s`: its local coordinates within the unit ball
export const withinLobe = (p, L, s) => within(p, L, s);
const within = (p, L, s) => { const q = sub(p, L.at), x = dot(q, L.frame[0]) / L.axes[0], y = dot(q, L.frame[1]) / L.axes[1], z = dot(q, L.frame[2]) / L.axes[2]; return x * x + y * y + z * z < s * s; };
// an ellipsoid's area (Knud Thomsen's): the chips a lobe takes go by it, as a ball's by its radius squared
const areaOf = ([a, b, c]) => 4 * Math.PI * (((a * b) ** 1.6 + (a * c) ** 1.6 + (b * c) ** 1.6) / 3) ** (1 / 1.6);

/** A lobe's skin as triangles, scaled by `shrink`: a core's facets. */
export const lobeTris = (L, { detail = 1, shrink = 1 } = {}) => blobTris([0, 0, 0], [1, 1, 1], null, { detail }).map((tri) => tri.p.map((d) => P(onLobe(L, d, shrink))));
/** The lobes as the crown's dark cores, with what hollowed needs of each. */
export function formCore(lobes, opts) {
  const o = { ...CHIP_DEFAULTS, ...opts }, dark = hexOf(o.ramp[0]), lit = hexOf(o.ramp[Math.min(1, o.ramp.length - 1)]), faces = [], hollow = [];
  lobes.forEach((L, id) => {
    const tris = [], s = o.shrink;
    for (const tri of blobTris([0, 0, 0], [1, 1, 1], null, { detail: o.detail ?? 1 })) {
      const cs = tri.p.map((d) => P(onLobe(L, d, s))), n = unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]))), out1 = dot(n, sub(cs[0], L.at)) < 0 ? mul(n, -1) : n;
      const m = mul(add(add(cs[0], cs[1]), cs[2]), 1 / 3);
      const sunlit = o.toSun && dot(out1, o.toSun) > 0.15 && (!o.shadow || o.shadow(add(m, mul(out1, 0.05)), out1) > 0.5);
      tris.push(cs);
      faces.push({ corners: cs, normal: out1.map(r5), outNormal: out1.map(r5), fill: sunlit ? lit : dark, group: 'isekai:core', _lobe: id });
    }
    hollow.push({ at: L.at, r: Math.max(...L.axes) * s, tris, id });
  });
  return { faces, lobes: hollow };
}

/** The chips over the lobes: lit by the clump's normal (the lobe's, leant to the crown's) as leafChips lights them,
 *  each grained along its lobe and leant as the form holds its leaves; none whose middle another lobe buries. */
export function formChips(lobes, opts) {
  const o = { ...CHIP_DEFAULTS, grain: 0, lean: [0, 0, 0], ...opts }, { c, Rc, squash = 1 } = o.crown, out = [], ramp = o.ramp, S = o.seed | 0;
  const stop = { low: ramp[Math.min(1, ramp.length - 1)], mid: ramp[Math.floor(ramp.length / 2)], high: ramp[Math.max(0, ramp.length - 2)], glint: ramp[ramp.length - 1] };
  lobes.forEach((L, li) => {
    const n = Math.round((o.count * areaOf(L.axes)) / (4 * Math.PI * Rc * Rc));
    for (let i = 0; i < n; i++) {
      const h = (k) => hash3(li * 4099 + i, k, S + 6007);
      const z = 2 * h(1) - 1, a = 2 * Math.PI * h(2), rr = Math.sqrt(1 - z * z), d = [Math.cos(a) * rr, Math.sin(a) * rr, z];
      const s = h(3) < o.stray ? 1.1 + 0.25 * h(4) : 0.94 + 0.12 * h(4), p = onLobe(L, d, s);
      if (lobes.some((M, mi) => mi !== li && within(p, M, CHIP_BURIED))) continue;
      const nl = normalOn(L, d), nc = unit(add(mul(nl, 0.65), mul(unit([p[0] - c[0], p[1] - c[1], (p[2] - c[2]) / squash]), 0.35)));
      const lam = Math.max(0, (dot(nc, o.toSun) + 0.2) / 1.2), sun = o.shadow ? o.shadow(add(p, mul(nc, 0.05)), nc) : 1;
      const v = lam * (0.25 + 0.75 * sun) + o.noise * (2 * h(5) - 1);
      const band = v > o.bands[1] ? 'high' : v > o.bands[0] ? 'mid' : 'low';
      if (band === 'low' && h(6) > o.keepLow) continue;
      const col = band === 'high' && h(7) < o.glint ? stop.glint : stop[band];
      // the chip: its facing the clump's, leant as the form holds its leaves, tilted a little each way
      const nrm = unit(add(add(nc, o.lean), mul([h(8) - 0.5, h(9) - 0.5, h(10) - 0.35], 2 * o.tilt)));
      const e0 = unit(Math.abs(nrm[2]) > 0.9 ? cross(nrm, [1, 0, 0]) : cross(nrm, [0, 0, 1])), t = 2 * Math.PI * h(11);
      let e1 = add(mul(e0, Math.cos(t)), mul(cross(nrm, e0), Math.sin(t)));
      // (its length along its lobe's, by the grain: a spray's leaves fan along the twig, a willow's hang)
      const lp = sub(L.long, mul(nrm, dot(L.long, nrm)));
      if (o.grain > 0 && Math.hypot(...lp) > 0.15) { const g = unit(lp), sg = dot(g, e1) < 0 ? -1 : 1; e1 = unit(add(mul(e1, 1 - o.grain), mul(g, sg * o.grain))); }
      const e2 = cross(nrm, e1), A = Rc * o.size * (0.75 + 0.5 * h(12)), B = A * (0.55 + 0.15 * h(13));
      const rim = Array.from({ length: o.corners }, (_, k) => { const q = (2 * Math.PI * k) / o.corners; return add(add(add(p, mul(e1, Math.cos(q) * A)), mul(e2, Math.sin(q) * B)), mul(nrm, o.cup * B * Math.cos(2 * q))); });
      out.push({ corners: rim.map(P), normal: nrm.map(r5), outNormal: nrm.map(r5), fill: hexOf(col), group: 'isekai:chips', doubleSided: true });
    }
  });
  return out;
}
const CHIP_BURIED = 0.92;
