/** hero-relational-head.js — the RELATIONAL head (head-relational.js) worn by the realistic hero as recipe content: two
 * layer-1 parts the compiler, the bind and every exporter handle like any other head, in place of the landmark head.
 *
 *   the fit    the field scaled so vertex to menton is the landmark head's, the menton on its menton, the ear canal at its
 *              ear's depth (the body study's graft, read off the landmark head's own parts before they leave)
 *   the seam   the neck ends on its highest ring standing wholly outside the head by the join's width, and the head
 *              starts on that ring, slot for slot (`multiple` head slots to a neck slot, on the neck's own edges): one
 *              ring, no gap, no shell inside another
 *   the skin   every point on a ray from one centre inside the head (`O`, at the ear canal's height over the seam ring's
 *              middle), at the first crossing outward of the head's field joined smoothly to the neck's column (a
 *              distance read off the neck's own rings): the throat, the jaw's underside and the nape fill as one skin.
 *              Each column keeps its seam point's azimuth from the seam to the vertex
 *   the mouth  the two parts share one ring, the MOUTH's: across the mouth the lips' meeting line (the groove the two lips
 *              make, found on the field), level with it behind the corners. `jaw` runs from the seam to it, `cranium` from
 *              it to the vertex; their caps there are the Mouth (the landmark head's two-part mouth)
 *   the bind   the cranium the head bone; the jaw from the neck's seam blend on its first ring to { jaw, head } by how far
 *              ahead of the ramus a point is, the mouth ring jaw-bound only between the corners: so the rig's jaw opens
 *              the mouth and the ring stays shut behind them. The rig's jaw hinge moved to the head's condyles, its tip
 *              to the gnathion; the landmark head's `jawOpen` dial (a hinge of its own jaw) leaves with it
 *
 * The ears are out of the sampled field (a ray from inside cannot find a plate standing off the head) and the eyes are
 * the field's (globe and lids in one skin); both, expressions and a face rig are later work. Pure and deterministic. */
import { relationalHead } from './head-relational.js';
import { compileLayered } from './station-loft.js';
import { crossing } from './body-relational-field.js';
import { ringSlots, mixW, four } from './body-relational-resample.js';
import { r6 } from './body-relational-vec.js';
import { smin } from './vajra.js';

/** the head's density and its joins: `multiple` head slots to a neck slot, `jaw` and `cranium` rings, the neck's join
 * to the head (`join`, metres: the smooth union's width, and how far outside the head the seam ring stands) */
export const RELATIONAL_HEAD = Object.freeze({ multiple: 4, jaw: 20, cranium: 80, join: 0.012, top: 86 });

/** the head's tune (head-relational.js `solveTune`, its wave's internal points) per pole, SOLVED once and kept: a solve
 * takes most of a minute, and a minted head is a compatibility promise (hero-relational-head.deep.test.js holds these to
 * the solver; re-pin with the solver's output in the commit that moves it) */
export const HEAD_TUNES = Object.freeze({
  male: Object.freeze({ eu: 0.006847826086956521, zy: 0.034043478260869564, go: 0.06143478260869566, op: 0.019760869565217394, g: 0.01643478260869565, gn: 0.008706521739130432, n: 0.03071739130434783, sn: 0.014086956521739132, prn: -0.01291304347826087, al: 0.0033260869565217392, mod: -0.07786956521739131 }),
  female: Object.freeze({ eu: 0.007630434782608695, zy: 0.03384782608695652, go: 0.063, op: 0.013402173913043484, g: 0.02347826086956522, gn: 0.011250000000000003, n: 0.011054347826086955, sn: 0.014478260869565218, prn: -0.013304347826086957, al: 0.0062608695652173925, mod: -0.08 }),
});

const ramp = (x) => { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rp = (p) => p.map(r6);
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);

/** the landmark head's parts: the cranium, the jaw and everything pinned on them (the eyes, the lips, the ears, the hair) */
function landmarkHeadParts(parts) {
  const out = new Set(['cranium', 'jaw'].filter((k) => parts[k]));
  for (let grew = true; grew;) { grew = false; for (const [k, p] of Object.entries(parts)) if (!out.has(k) && p.pin && out.has(p.pin.parent)) { out.add(k); grew = true; } }
  return out;
}

/** the fit of the relational head (STAND units) into the hero's frame: { k, ty, men } with hero = (x k, y k + ty, z k + men) */
function fitOf(parts, head, eared) {
  const { cranium, jaw, earR } = parts;
  const mesh = compileLayered({ parts: { cranium, jaw, ...(earR ? { earR } : {}) }, dials: {}, creases: {} });
  const of = (re) => mesh.vertices.filter((_, i) => re.test(mesh.provenance[i].part));
  const top = Math.max(...of(/^(cranium|jaw)$/).map((v) => v[2])), men = Math.min(...of(/^jaw$/).map((v) => v[2]));
  const ear = of(/^earR$/), earY = ear.length ? ear.reduce((a, v) => a + v[1], 0) / ear.length : 0;
  const f = (q) => head.field({ x: q[0], y: q[1], z: q[2] }), V = head.landmarks.H, vx = head.points.vertex;
  const hz = crossing(f, [0, vx.y, 0.5 * V], [0, 0, 1], 2 * V, 0.0005)[2], k = (top - men) / hz;
  return { k, men, ty: earY - eared.landmarks.tragionR.y * k };
}

/** the neck's column as a distance: each ring a level polygon at its mean height, lerped between; closed at both ends
 * (from ring `from` up: a ray cast steeply down the side found the neck's flared base again past the seam) */
function neckField(neck, from = 0) {
  const rings = neck.stations.slice(from).map((st) => { const pts = neck.slots.map((s) => st.points[s]); return { z: mean(pts)[2], pts }; });
  const zTop = Math.max(...rings.at(-1).pts.map((p) => p[2])), zBot = Math.min(...rings[0].pts.map((p) => p[2]));
  const poly = (pts, x, y) => {
    let d = Infinity, inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[j], b = pts[i], ex = b[0] - a[0], ey = b[1] - a[1], wx = x - a[0], wy = y - a[1];
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
      d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
      if ((a[1] > y) !== (b[1] > y) && x < a[0] + ((y - a[1]) * ex) / ey) inside = !inside;
    }
    return inside ? -d : d;
  };
  return (q) => {
    let i = rings.findIndex((r) => r.z > q[2]), pts;
    if (i === 0) pts = rings[0].pts;
    else if (i < 0) pts = rings.at(-1).pts;
    else { const a = rings[i - 1], b = rings[i], t = (q[2] - a.z) / (b.z - a.z); pts = a.pts.map((p, s) => lerp3(p, b.pts[s], t)); }
    return Math.max(poly(pts, q[0], q[1]), q[2] - zTop, zBot - q[2]);
  };
}

/**
 * The realistic hero's recipe (a sliced one: formSlice) wearing the relational head in place of its landmark head.
 * `sex` picks the head's pole. Returns a new recipe; the one given is left as it was.
 */
export function relationalHeadRecipe(recipe, { sex = 'male', opts = {} } = {}) {
  const C = { ...RELATIONAL_HEAD, ...opts };
  const r = structuredClone(recipe), parts = r.parts, neck = parts.neck;
  if (!parts.cranium || !parts.jaw || !neck) throw new Error('hero-relational-head: the recipe carries no landmark head on a neck');
  const tune = HEAD_TUNES[sex];
  if (!tune) throw new Error(`hero-relational-head: the head's pole is ${Object.keys(HEAD_TUNES).join(' or ')}`);
  const head = relationalHead({ sex, tune, ears: false }), eared = relationalHead({ sex, tune });
  const { k, ty, men } = fitOf(parts, head, eared);
  const toHero = (p) => [p.x * k, p.y * k + ty, p.z * k + men];
  const fH = (q) => head.field({ x: q[0] / k, y: (q[1] - ty) / k, z: (q[2] - men) / k }) * k;

  // THE SEAM: the highest neck ring standing wholly outside the head by the join's width (where the union is the neck's)
  let seam = -1;
  for (let i = neck.stations.length - 1; i >= 0 && seam < 0; i--) if (neck.slots.every((s) => fH(neck.stations[i].points[s]) > C.join)) seam = i;
  if (seam < 1) throw new Error('hero-relational-head: no neck ring stands clear of the head');
  // (the union's neck from the ring under the seam: the head's lower rings start on the seam and only rise from it)
  const fN = neckField(neck, seam - 1), fU = (q) => smin(fH(q), fN(q), C.join);
  const seamSt = neck.stations[seam], N = neck.slots.length, H = N * C.multiple, slots = ringSlots(H), half = H / 2;
  const seamPts = Array.from({ length: H }, (_, j) => { const i = Math.floor(j / C.multiple), t = (j % C.multiple) / C.multiple; return lerp3(seamSt.points[neck.slots[i]], seamSt.points[neck.slots[(i + 1) % N]], t); });

  // the centre: over the seam ring's middle, at the ear canal's height
  const P = head.points, c0 = mean(seamPts), O = [0, c0[1], toHero(P.porionR)[2]];
  const az = seamPts.map((p) => Math.atan2(p[0] - O[0], p[1] - O[1]));
  const dir = (a, f) => [Math.sin(a) * Math.cos(f), Math.cos(a) * Math.cos(f), Math.sin(f)];
  // the OUTERMOST crossing along the ray, marched in from outside (`reach` out): the head's field is not negative all
  // through (pockets between the masses, behind the lips), so the first crossing outward from O can be a pocket's wall
  const reach = 0.22, LIP = 4;
  const cast = (a, f) => {
    const d = dir(a, f), at = (t) => [O[0] + d[0] * t, O[1] + d[1] * t, O[2] + d[2] * t];
    let t = reach, ft = fU(at(t));
    if (ft <= 0) return crossing(fU, O, d, reach, 0.002);
    while (t > 0) {
      const tn = t - Math.max(0.002, ft / LIP), fn = fU(at(tn));
      if (fn <= 0) { let lo = tn, hi = t; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fU(at(m)) <= 0) lo = m; else hi = m; } return at((lo + hi) / 2); }
      t = tn; ft = fn;
    }
    return null;
  };
  const latOf = (p) => Math.atan2(p[2] - O[2], Math.hypot(p[0] - O[0], p[1] - O[1]));
  // the latitude at which column a's skin stands at height z (bisection: the crossing's height rises with the latitude)
  const latAt = (a, z, lo, hi) => { for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2, q = cast(a, m); if (q && q[2] < z) lo = m; else hi = m; } return (lo + hi) / 2; };

  // THE MOUTH RING: level with the stomion, and across the mouth on the lips' meeting line (the groove: the nearest
  // the skin comes to O between the lips), eased back to the level past the corners
  const zM = toHero(P.sto)[2], ch = toHero(P.chR), aCh = Math.atan2(ch[0] - O[0], ch[1] - O[1]), ease = (6 * Math.PI) / 180;
  const shut = (a) => ramp((Math.abs(a) - aCh) / ease);   // 0 between the corners, 1 past them
  const latM = new Array(H);
  for (let j = 0; j <= half; j++) {
    const a = az[j], f0 = latAt(a, zM, latOf(seamPts[j]), Math.PI / 2 - 0.05), w = 1 - shut(a);
    let f = f0;
    if (w > 0) {
      const q0 = cast(a, f0), d0 = Math.hypot(q0[0] - O[0], q0[1] - O[1], q0[2] - O[2]), span = 0.005 / d0;
      let best = f0, bd = d0;
      for (let s = -12; s <= 12; s++) { const fs = f0 + (span * s) / 12, q = cast(a, fs); if (!q) continue; const d = Math.hypot(q[0] - O[0], q[1] - O[1], q[2] - O[2]); if (d < bd) { bd = d; best = fs; } }
      f = f0 + w * (best - f0);
    }
    latM[j] = f; if (j && j < half) latM[H - j] = f;
  }
  // a column's points, its right half cast and its left the mirror
  const column = (fOf) => {
    const pts = new Array(H);
    for (let j = 0; j <= half; j++) { const q = cast(az[j], fOf(j)); if (!q) throw new Error(`hero-relational-head: a ray found no skin (slot ${slots[j]})`); pts[j] = q; if (j && j < half) pts[H - j] = [-q[0], q[1], q[2]]; }
    for (const j of [0, half]) pts[j] = [0, pts[j][1], pts[j][2]];
    return pts;
  };
  const mouthPts = column((j) => latM[j]);
  const jawRings = [seamPts, ...Array.from({ length: C.jaw - 1 }, (_, i) => column((j) => latOf(seamPts[j]) + ((latM[j] - latOf(seamPts[j])) * (i + 1)) / C.jaw)), mouthPts];
  const top = (C.top * Math.PI) / 180;
  const cranRings = [mouthPts, ...Array.from({ length: C.cranium - 1 }, (_, i) => column((j) => latM[j] + ((top - latM[j]) * (i + 1)) / (C.cranium - 1)))];
  const vertex = cast(0, Math.PI / 2);

  const station = (pts, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(slots.map((s, j) => [s, rp(pts[j])])) });
  // (the caps on the shared rings are inside the head, each set a few millimetres off its ring's middle OUTWARD for its
  // part: the loft winds a cap by its first face against the ring's middle, and a flat cap leaves that undecided)
  const lift = (ps, h) => { const c = mean(ps); return rp([c[0], c[1], c[2] + h]); };
  const mouthUp = lift(mouthPts, 0.004), mouthDown = lift(mouthPts, -0.004), seamUp = lift(seamPts, 0.004), seamDown = lift(seamPts, -0.004);

  // THE BIND. The seam ring carries the neck's blend there (lerped onto the head's extra slots); the rings above ease
  // to { jaw, head }: the jaw's share by how far ahead of the ramus (gonion → condyle) a point stands, held to the
  // mouth's corners on the mouth ring and freed of them a lip's height under it
  const nb = neck.bind?.blend || {}, nbone = typeof neck.bind === 'string' ? neck.bind : neck.bind.bone;
  const neckW = (s) => nb[`${seamSt.id}.${s}`] || nb[seamSt.id] || { [nbone]: 1 };
  const seamW = Array.from({ length: H }, (_, j) => { const i = Math.floor(j / C.multiple), t = (j % C.multiple) / C.multiple; return mixW(neckW(neck.slots[i]), neckW(neck.slots[(i + 1) % N]), t); });
  const go = toHero(P.goR), cd = toHero(P.condyleR), ry = cd[1] - go[1], rz = cd[2] - go[2], rl = Math.hypot(ry, rz);
  const ahead = (p) => ((p[1] - go[1]) * rz - (p[2] - go[2]) * ry) / rl;   // + toward the face, square to the ramus
  const jawShare = (p, a) => ramp((ahead(p) + 0.006) / 0.018) * (1 - shut(a) * (1 - ramp((zM - p[2]) / 0.015)));
  const blend = {};
  jawRings.forEach((pts, i) => slots.forEach((s, j) => {
    const v = ramp(i / (0.45 * C.jaw)), wj = r6(jawShare(pts[j], az[j])), target = wj > 0 ? (wj < 1 ? { head: r6(1 - wj), jaw: wj } : { jaw: 1 }) : { head: 1 };
    blend[`st${i}.${s}`] = four(mixW(seamW[j], target, v));
  }));
  blend.back = four(mixW(seamW[0], seamW[half], 0.5)); blend.tip = { head: 1 };
  parts.jaw = { layer: 1, closure: 'closed', slots, stations: jawRings.map(station), group: 'Skin', caps: { back: seamDown, tip: mouthUp }, capGroups: { back: 'Skin', tip: 'Mouth' }, bind: { bone: 'head', blend } };
  parts.cranium = { layer: 1, closure: 'closed', slots, stations: cranRings.map(station), group: 'Skin', caps: { back: mouthDown, tip: rp(vertex) }, capGroups: { back: 'Mouth', tip: 'Skin' }, bind: 'head' };

  // the landmark head leaves (its details, its creases, its dial); the neck ends on the seam
  const gone = landmarkHeadParts(recipe.parts);
  for (const g of gone) if (g !== 'cranium' && g !== 'jaw') delete parts[g];
  for (const [id, c] of Object.entries(r.creases || {})) if (gone.has(c.parent)) delete r.creases[id];
  if (r.dials?.jawOpen?.part === 'jaw') delete r.dials.jawOpen;
  const kept = new Set(neck.stations.slice(0, seam + 1).map((s) => s.id));
  neck.stations = neck.stations.slice(0, seam + 1);
  neck.caps = { ...neck.caps, tip: seamUp };
  if (neck.bind?.blend) {
    for (const key of Object.keys(nb)) { const st = key.split('.')[0]; if (st !== 'back' && st !== 'tip' && !kept.has(st)) delete nb[key]; }
    nb.tip = blend.back;
  }
  // the rig's jaw on the head's own joint: the hinge between the condyles, the tip at the gnathion
  const J = r.rig.joints, at = (name, p) => { if (J[name]) J[name] = Array.isArray(J[name]) ? rp(p) : { ...J[name], at: rp(p) }; };
  at('jawHinge', [0, cd[1], cd[2]]); at('jawTip', toHero(P.gn));
  return r;
}
