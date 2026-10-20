/** body-relational-map.js — THE BODY-PART MAP of the realistic body: every re-sampled skin point labelled with the BODY
 * PART it belongs to (what a garment names: the chest, the seat, the upper arm) and the MUSCLE most under it. The field
 * knows: the skin is the masses' log-sum-exp, and each mass's weight in it, e^(−dᵢ/k) / Σ, is its share of the skin at a
 * point, so a point is the part its masses' shares add up to most. Each mass names its part (MASS_PART); the deep base
 * masses (the core, the ribcage, the seat's basin), under the skin where no muscle is, by where the point lies: its
 * height up the trunk and its azimuth round it (front, side, back). Under the iliac crest the trunk is the seat behind,
 * the hip at the side and the groin in front. A point inside another part's skin (the pelvis's rings under the crotch's
 * level, in the thighs; the arm's top, under the shoulder's cap) is `hidden`: no part shows it, and dress made on the body
 * leaves it alone. The labels are eased over each part's grid (a point of a part few of its neighbours share takes
 * theirs), and both sides are one another's mirror. Pure and deterministic (dmath). */
import * as dmath from '../../util/dmath.js';
import { bodyField, limbField, sdPrim } from './body-relational-field.js';
import { BODY_BUILDS } from './body-relational-builds.js';

/** the body parts, in the order a legend reads them, each with a colour to show it by (distinct beside its neighbours) */
export const BODY_PARTS = Object.freeze(['neck', 'collar', 'shoulderTop', 'chest', 'breast', 'armpit', 'flank', 'abdomen', 'upperBack', 'back', 'lowerBack', 'hip', 'groin', 'seat',
  'shoulderCap', 'upperArm', 'elbow', 'forearm', 'wrist', 'thigh', 'knee', 'shin', 'calf', 'ankle', 'hidden']);
export const PART_COLOURS = Object.freeze({
  neck: '#e0524f', collar: '#f2a65a', shoulderTop: '#9c6ade', chest: '#f4d03f', breast: '#7fe0f0', armpit: '#555555', flank: '#1abc9c',
  abdomen: '#2e4fd6', upperBack: '#f08a24', back: '#2c3e50', lowerBack: '#c0399b', hip: '#b9770e', groin: '#5dade2', seat: '#e74c3c',
  shoulderCap: '#ff7eb6', upperArm: '#7d3cff', elbow: '#ffffff', forearm: '#33d6d6', wrist: '#ff3399', thigh: '#7bd148', knee: '#2850a0',
  shin: '#e8613c', calf: '#0e6655', ankle: '#8e44ad', hidden: '#8a8a8a',
});

// a mass's part by its id (a chain's beads read by their chain's id); the base masses and the seat's by position
const MASS_PART = {
  pectoralSternal: 'chest', pectoralClavicular: 'chest', sternum: 'chest', clavicle: 'collar',
  rectus1: 'abdomen', rectus2: 'abdomen', rectus3: 'abdomen', rectus4: 'abdomen',
  obliqueExternal: 'flank', serratus1: 'flank', serratus2: 'flank', serratus3: 'flank',
  latissimus: 'back', infraspinatus: 'upperBack', trapeziusLower: 'upperBack', erector: 'lowerBack',
  sternocleidomastoid: 'neck', trapeziusUpper: 'shoulderTop', girdle: 'shoulderTop', axilla: 'armpit', pectoralTendon: 'armpit',
  deltoidAnterior: 'shoulderCap', deltoidLateral: 'shoulderCap', deltoidPosterior: 'shoulderCap',
  humerus: 'upperArm', biceps: 'upperArm', brachialis: 'upperArm', tricepsLong: 'upperArm', tricepsLateral: 'upperArm',
  radiusUlna: 'forearm', brachioradialis: 'forearm', flexors: 'forearm', extensors: 'forearm', wrist: 'wrist',
  femur: 'thigh', tensorFasciae: 'hip', rectusFemoris: 'thigh', vastusLateralis: 'thigh', vastusMedialis: 'thigh', adductors: 'thigh',
  adductorOrigin: 'groin', hamstrings: 'thigh', sweep: 'thigh', patella: 'knee',
  tibia: 'shin', tibialisAnterior: 'shin', gastrocnemiusMedial: 'calf', gastrocnemiusLateral: 'calf', soleus: 'calf', achilles: 'ankle', ankle: 'ankle',
  neck: 'neck', pubis: 'groin',
};
// a joint mass whose id two limbs share (the elbow, the knee): the limb's joint
const JOINT_PART = { elbow: 'elbow', knee: 'knee' };
// the re-sampled parts the map labels, and the other skins that may hide their points
const SKINS = { torso: ['upperArm'], neck: [], pelvis: ['thigh'], upperArm: ['body'], foreArm: [], thigh: ['body'], shank: [] };
// under the crest, what a trunk part is
const BELOW = { lowerBack: 'seat', abdomen: 'groin', flank: 'hip', back: 'seat' };
// a LIMB's bands by where a point lies down its bone (s, 0 at its head joint, 1 at its tail): the shoulder's cap over the
// upper arm's top, the elbow, the knee, the wrist and the ankle each a band about its joint (the masses' shares left the
// deltoid a sliver under the arm's own bellies, and the joints none)
const BANDS = {
  upperArm: [[0, 0.28, 'shoulderCap'], [0.9, 1.01, 'elbow']], foreArm: [[-0.01, 0.1, 'elbow'], [0.93, 1.01, 'wrist']],
  thigh: [[0.92, 1.01, 'knee']], shank: [[-0.01, 0.08, 'knee'], [0.92, 1.01, 'ankle']],
};
// the parts a limb's masses name, read on the trunk above the thigh's top as the trunk's own (by azimuth)
const LIMB_PARTS = new Set(['thigh', 'knee', 'shin', 'calf', 'ankle']);

/** the map: `{ part: { <pointId>: part }, muscle: { <pointId>: mass id }, side: { <pointId>: 'R' | 'L' | 'M' } }`, every
 * re-sampled part's points (the compiled mesh's `pointIds`, `<part>/<station>.<slot>`) */
export function bodyPartMap(recipe, R, build) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build;
  const field = bodyField(R, B), F = field.frame, W = F.W, kM = B.kMuscle * W, kB = B.kBase * W;
  const limbs = Object.fromEntries(Object.keys(B.limbs || {}).map((k) => [k, limbField(R, B, k)]));
  const trunk = [...field.masses.base.map((p) => ({ p, base: true })), ...field.masses.muscles.map((p) => ({ p }))];
  const limbPrims = (k) => (limbs[k]?.prims || []).flatMap((p) => [{ p }, { p: mirror(p) }]);
  const chestT = 0.42, bladeT = 0.4;
  // THE CREST (the iliac crest, a hand over the hip's joint): under it the trunk is the seat behind, the hip at the side
  // and the groin in front, whatever reaches down to it (the erector's and the sacrum's masses ran over the buttocks)
  const crest = R.joints.hipR[2] + 0.45 * W, thighTop = R.joints.hipR[2] - 0.25 * W;
  // a point's place down a limb's bone (the right's; a left point read mirrored)
  const along = (limb, q) => {
    const Lb = B.limbs[limb], a = R.joints[Lb.from], b = R.joints[Lb.to], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], p = [Math.abs(q[0]) - a[0], q[1] - a[1], q[2] - a[2]];
    return (p[0] * ab[0] + p[1] * ab[1] + p[2] * ab[2]) / (ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]);
  };
  // a base mass's part by where the point lies
  const byPlace = (id, q) => {
    const az = (Math.atan2(Math.abs(q[0]), q[1]) * 180) / Math.PI, t = F.tOf(q[2]);
    if (id === 'seatLobe') return az > 125 ? 'seat' : az > 55 ? 'hip' : 'groin';
    if (id === 'seatTaper') return az > 125 ? 'lowerBack' : az > 70 ? 'hip' : 'abdomen';
    if (az < 60) return t >= chestT ? 'chest' : 'abdomen';
    if (az < 115) return 'flank';
    return t >= bladeT ? 'upperBack' : 'lowerBack';
  };
  const massPart = (id, q, base) => {
    if (base) return MASS_PART[id] ?? byPlace(id, q);
    const bare = MASS_PART[id] ? id : id.replace(/\d+$/, '');
    return MASS_PART[bare] ?? JOINT_PART[bare] ?? byPlace(id, q);
  };
  // the shares at a point: the base masses' as one term (their own wide blend inside it), the rest each its own
  const label = (q, candidates) => {
    const base = candidates.filter((c) => c.base), rest = candidates.filter((c) => !c.base);
    const db = base.map((c) => sdPrim(c.p, q)), mb = db.length ? Math.min(...db) : Infinity, eb = db.map((d) => dmath.exp(-(d - mb) / kB)), sb = eb.reduce((a, e) => a + e, 0);
    const dB = db.length ? mb - kB * dmath.log(sb) : Infinity;
    const dr = rest.map((c) => sdPrim(c.p, q)), m = Math.min(dB, ...dr);
    const wB = Number.isFinite(dB) ? dmath.exp(-(dB - m) / kM) : 0, wr = dr.map((d) => dmath.exp(-(d - m) / kM)), Z = wB + wr.reduce((a, w) => a + w, 0);
    const score = {}; let top = null, topW = -1;
    if (wB) base.forEach((c, i) => { const w = ((wB / Z) * eb[i]) / sb, k = massPart(c.p.id, q, true); score[k] = (score[k] || 0) + w; });
    rest.forEach((c, i) => { const w = wr[i] / Z, k = massPart(c.p.id, q, false); score[k] = (score[k] || 0) + w; if (w > topW) { topW = w; top = c.p.id; } });
    let part = null, best = -1; for (const k of Object.keys(score).sort()) if (score[k] > best) { best = score[k]; part = k; }
    return { part, muscle: top };
  };
  const out = { part: {}, muscle: {}, side: {} };
  for (const [name, P] of Object.entries(recipe.parts)) {
    const base = name.replace(/[RL]$/, ''); if (!(base in SKINS) || P.layer !== 1) continue;
    const isLimb = base !== 'torso' && base !== 'neck' && base !== 'pelvis';
    const candidates = isLimb ? [...trunk, ...limbPrims(base)] : [...trunk, ...limbPrims('upperArm'), ...limbPrims('thigh')];
    // (a limb's field is the right's: a point read on its own side)
    const hiders = SKINS[base].filter((h) => h === 'body' || limbs[h]).map((h) => (h === 'body' ? field.sd : (q) => limbs[h].sd([Math.abs(q[0]), q[1], q[2]])));
    const grid = P.stations.map((st) => P.slots.map((sl) => {
      const q = st.points[sl], id = `${name}/${st.id}.${sl}`;
      if (hiders.some((h) => h(q) < -0.002)) return { id, part: 'hidden', muscle: null, q };
      let { part, muscle } = label(q, candidates);
      if (q[2] < crest && BELOW[part]) part = BELOW[part];
      if (!isLimb && LIMB_PARTS.has(part) && q[2] > thighTop) { const az = (Math.atan2(Math.abs(q[0]), q[1]) * 180) / Math.PI; part = az > 125 ? 'seat' : az > 55 ? 'hip' : 'groin'; }
      // (the armpit's fill reaches up the shoulder's front and back: above the hollow, a third of W under the shoulder's
      // joint, the skin there is the shoulder's cap)
      if (part === 'armpit' && q[2] > R.joints.shoulderR[2] - 0.35 * W) part = 'shoulderCap';
      if (isLimb && part !== 'armpit') { const sb = along(base, q); for (const [a, b, k] of BANDS[base] || []) if (sb >= a && sb < b) part = k; }
      if (part === 'chest' && field.bust && field.bust(q) > 0.25 * (B.bust?.rb ?? 0) * W) part = 'breast';
      return { id, part, muscle, q };
    }));
    ease(grid);
    for (const row of grid) for (const c of row) { out.part[c.id] = c.part; out.muscle[c.id] = c.muscle; out.side[c.id] = c.q[0] > 1e-6 ? 'R' : c.q[0] < -1e-6 ? 'L' : 'M'; }
  }
  return out;
}

// the labels eased over a part's grid: a point of a part fewer than three of its eight neighbours share takes their most
// common (round the ring and along the part; a hidden point keeps its own and is never counted): a part's edge clean
function ease(grid, iters = 3) {
  const n = grid[0]?.length ?? 0;
  for (let it = 0; it < iters; it++) {
    const next = grid.map((row) => row.map((c) => c.part));
    for (let i = 0; i < grid.length; i++) for (let j = 0; j < n; j++) {
      const c = grid[i][j]; if (c.part === 'hidden') continue;
      const nb = [-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => (a || b ? grid[i + a]?.[(j + b + n) % n] : null))).filter((x) => x && x.part !== 'hidden');
      if (!nb.length || nb.filter((x) => x.part === c.part).length >= 3) continue;
      const count = {}; for (const x of nb) count[x.part] = (count[x.part] || 0) + 1;
      next[i][j] = Object.keys(count).sort().reduce((a, k) => (count[k] > count[a] ? k : a));
    }
    grid.forEach((row, i) => row.forEach((c, j) => { c.part = next[i][j]; }));
  }
}

const mirror = (p) => (p.cone ? { ...p, cone: p.cone.map(([x, y, z]) => [-x, y, z]) } : { ...p, c: [-p.c[0], p.c[1], p.c[2]], ax: p.ax.map(([x, y, z]) => [-x, y, z]) });
