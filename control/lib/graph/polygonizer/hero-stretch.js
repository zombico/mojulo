/**
 * hero-stretch — THE STRETCH AUDIT: what the hero's skinning does to its shell through a motion. `auditRig` gates the
 * rig (weights, rest identity, bone lengths, planted toes); this reads the SHELL the rig carries, ring by ring: every
 * closed part's station is a ring of its slots, and at each posed frame each ring is measured against itself at rest.
 *
 *   area    the ring's area over its rest area (the vector area of the loop): a joint's rings collapsing (linear blend
 *           skinning's candy wrapper and its knee and elbow pinch) read below 1, a ring stretched open above;
 *   pinch   the ring's narrowest slot, its distance from the ring's centre over that slot's at rest: a crease's local
 *           collapse that the area averages away;
 *   twist   degrees the ring has turned about its own axis away from its heaviest bone's turn: where the blend lags the
 *           bone (a forearm's pronation wrung into one ring, the neck's twist piled at a station);
 *   band    the skin BETWEEN a ring and the next along its part, slot by slot: each slot's edge over its rest length
 *           (a crease's compression below 1, the far side's stretch above), and the edges that turned back against the
 *           part's axis (`folds`: the shell folded through itself). A ring bound rigidly to one bone (the hero's knee and
 *           elbow fold rings) keeps its area whatever the joint does; the band between rings is where the joint gives.
 *
 * Each ring keeps its worst frame of each, so a report names WHERE (part, station) and WHEN (the frame's label) the
 * shell gives way. `STRETCH_REGIONS` gathers the joints the realistic register reads first (the knee, the elbow, the hip,
 * the shoulder). Pure and deterministic: frames in, numbers out; nothing about the hero changes.
 */
import { rigNodesAt, boneFrames, skinLayered } from './station-loft-rig.js';
import { heroLocomotion, motionPlan, stampHeroMotion } from './hero-motion.js';
import * as dmath from '../../util/dmath.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => dmath.hypot(dmath.hypot(a[0], a[1]), a[2]);
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

/**
 * The joints the realistic register reads first, as the rings that make them: a part family (its side appended) and how
 * many of its stations from the start (+n) or the end (−n). The thigh and the shank meet at the knee, the upper arm and
 * the forearm at the elbow; the thigh's top is the hip, the upper arm's top the shoulder. (The groin and the armpit are
 * SEAMS between parts, the thigh's top against the pelvis, the arm's against the torso: a ring of one part does not see
 * them, and the pelvis' own rings ride it rigidly, so they are not regions here.)
 */
export const STRETCH_REGIONS = Object.freeze({
  knee: [['thigh', -2], ['shank', 2]],
  elbow: [['upperArm', -2], ['foreArm', 2]],
  hip: [['thigh', 2]],
  shoulder: [['upperArm', 2]],
});
/** a ring narrower than this (metres, its first slot from its centre at rest) reads no twist: its direction is noise */
const TWIST_MIN_RADIUS = 0.01;

/**
 * Every closed layer-1 part's rings: { part, station, k (its index along the part), n (the part's station count), idx
 * (vertex indices in the part's slot order) }. A station missing a slot keeps the slots it has.
 */
export function shellRings(mesh, recipe) {
  const at = new Map();
  mesh.provenance.forEach((p, i) => { if (p.layer === 1 && p.station && p.slot) at.set(`${p.part}/${p.station}.${p.slot}`, i); });
  const rings = [];
  for (const [part, P] of Object.entries(recipe.parts)) {
    if (P.layer !== 1 || P.closure !== 'closed' || !Array.isArray(P.slots)) continue;
    const stations = Array.isArray(P.stations) ? P.stations.map((s) => (typeof s === 'string' ? s : s.id ?? s.name)) : Object.keys(P.stations || {});
    // the compiled mesh may add stations between the authored ones (an interpolated `st1_st2_50`): take them in mesh order
    const order = [];
    mesh.provenance.forEach((p) => { if (p.part === part && p.station && !order.includes(p.station)) order.push(p.station); });
    const all = order.length ? order : stations;
    all.forEach((st, k) => {
      const idx = P.slots.map((sl) => at.get(`${part}/${st}.${sl}`)).filter((i) => i !== undefined);
      if (idx.length >= 3) rings.push({ part, station: st, k, n: all.length, idx });
    });
  }
  return rings;
}

/** a loop's vector area (Newell): its direction the loop's normal, its length the area */
function vectorArea(V, idx) {
  const s = [0, 0, 0];
  for (let i = 0; i < idx.length; i++) { const c = cross(V[idx[i]], V[idx[(i + 1) % idx.length]]); s[0] += c[0] / 2; s[1] += c[1] / 2; s[2] += c[2] / 2; }
  return s;
}
const centre = (V, idx) => { const c = [0, 0, 0]; for (const i of idx) { c[0] += V[i][0]; c[1] += V[i][1]; c[2] += V[i][2]; } return c.map((x) => x / idx.length); };

/** one ring at one frame against its rest: { area, pinch, bulge, twist } */
function ringAt(ring, rest, posed, skin, frames) {
  const { idx } = ring;
  const a0 = vectorArea(rest, idx), a1 = vectorArea(posed, idx), A0 = len(a0), A1 = len(a1);
  const c0 = centre(rest, idx), c1 = centre(posed, idx);
  let pinch = Infinity, bulge = 0;
  for (const i of idx) { const r0 = len(sub(rest[i], c0)); if (r0 < 1e-9) continue; const q = len(sub(posed[i], c1)) / r0; if (q < pinch) pinch = q; if (q > bulge) bulge = q; }
  // the twist: the first slot's direction from the centre, as the ring's heaviest bone carries it rigidly, against where
  // the skin put it, both seen down the posed ring's axis
  const wsum = new Map();
  for (const i of idx) skin.joints[i].forEach((j, q) => { const w = skin.weights[i][q]; if (w > 0) wsum.set(j, (wsum.get(j) || 0) + w); });
  const bone = [...wsum].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0][0];
  const n = A1 > 1e-12 ? a1.map((x) => x / A1) : [0, 0, 1];
  const flat = (v) => { const d = dot(v, n); return [v[0] - d * n[0], v[1] - d * n[1], v[2] - d * n[2]]; };
  const e = flat(mv(frames[bone].m, sub(rest[idx[0]], c0))), u = flat(sub(posed[idx[0]], c1));
  const twist = len(sub(rest[idx[0]], c0)) >= TWIST_MIN_RADIUS && len(e) > 1e-9 && len(u) > 1e-9 ? (dmath.atan2(dot(n, cross(e, u)), dot(e, u)) * 180) / Math.PI : 0;
  return { area: A0 > 1e-12 ? A1 / A0 : 1, pinch: pinch === Infinity ? 1 : pinch, bulge, twist };
}

/** the band from ring `r` to ring `q` (the next along the part) at one frame: { min, max, folds } over the slots both
 * carry (the rings list their vertices in the part's slot order, so the i-th of each is the same slot when both are whole) */
function bandAt(r, q, rest, posed) {
  const m = Math.min(r.idx.length, q.idx.length), axis = sub(centre(posed, q.idx), centre(posed, r.idx));
  let min = Infinity, max = 0, folds = 0;
  for (let i = 0; i < m; i++) {
    const e0 = sub(rest[q.idx[i]], rest[r.idx[i]]), e1 = sub(posed[q.idx[i]], posed[r.idx[i]]), l0 = len(e0);
    if (l0 < 1e-9) continue;
    const k = len(e1) / l0; if (k < min) min = k; if (k > max) max = k;
    if (dot(e1, axis) < 0 && dot(e0, sub(centre(rest, q.idx), centre(rest, r.idx))) > 0) folds++;
  }
  return { min: min === Infinity ? 1 : min, max: max || 1, folds };
}

/**
 * THE AUDIT: the hero's shell over `frames` ([{ label, pose }]: rig poses as `rigNodesAt` takes them, or { label, nodes }
 * posed joints given whole: the bind itself is { nodes: R.joints }, where every measure reads exactly its rest; an empty
 * pose is the rig's planted stand, a little off the bind). Returns
 * { rings: [{ part, station, k, n, area: { min, minAt, max, maxAt }, pinch: { min, at }, twist: { max, at }, band: { min,
 *   minAt, max, maxAt, folds, foldAt } }],
 *   regions: { <region>: the worst of its rings, each with its ring named }, worst: the shell's worst of each, frames }.
 */
export function stretchAudit(mesh, skin, R, recipe, frames) {
  const rest = mesh.vertices, rings = shellRings(mesh, recipe);
  const acc = rings.map((r) => ({ part: r.part, station: r.station, k: r.k, n: r.n, area: { min: Infinity, minAt: null, max: -Infinity, maxAt: null }, pinch: { min: Infinity, at: null }, twist: { max: 0, at: null }, band: { min: Infinity, minAt: null, max: -Infinity, maxAt: null, folds: 0, foldAt: null } }));
  // the band from each ring to the next along its part (on the ring that starts it; the part's last ring has none)
  const next = rings.map((r, i) => (rings[i + 1] && rings[i + 1].part === r.part && rings[i + 1].k === r.k + 1 ? rings[i + 1] : null));
  for (const { label, pose, nodes: given } of frames) {
    const nodes = given ?? rigNodesAt(R, pose).nodes;
    const F = boneFrames(R, R.joints, nodes), posed = skinLayered(mesh, skin, F);
    rings.forEach((r, i) => {
      const m = ringAt(r, rest, posed, skin, F), a = acc[i];
      if (m.area < a.area.min) { a.area.min = m.area; a.area.minAt = label; }
      if (m.area > a.area.max) { a.area.max = m.area; a.area.maxAt = label; }
      if (m.pinch < a.pinch.min) { a.pinch.min = m.pinch; a.pinch.at = label; }
      if (Math.abs(m.twist) > Math.abs(a.twist.max)) { a.twist.max = m.twist; a.twist.at = label; }
      if (next[i]) {
        const b = bandAt(r, next[i], rest, posed);
        if (b.min < a.band.min) { a.band.min = b.min; a.band.minAt = label; }
        if (b.max > a.band.max) { a.band.max = b.max; a.band.maxAt = label; }
        if (b.folds > a.band.folds) { a.band.folds = b.folds; a.band.foldAt = label; }
      }
    });
  }
  const worstOf = (list) => {
    const name = (r) => `${r.part}/${r.station}`;
    const lo = list.reduce((b, r) => (r.area.min < b.area.min ? r : b)), hi = list.reduce((b, r) => (r.area.max > b.area.max ? r : b));
    const pn = list.reduce((b, r) => (r.pinch.min < b.pinch.min ? r : b)), tw = list.reduce((b, r) => (Math.abs(r.twist.max) > Math.abs(b.twist.max) ? r : b));
    const bl = list.reduce((b, r) => (r.band.min < b.band.min ? r : b)), bh = list.reduce((b, r) => (r.band.max > b.band.max ? r : b)), bf = list.reduce((b, r) => (r.band.folds > b.band.folds ? r : b));
    return {
      bandMin: { value: bl.band.min, ring: name(bl), at: bl.band.minAt }, bandMax: { value: bh.band.max, ring: name(bh), at: bh.band.maxAt },
      folds: { value: bf.band.folds, ring: name(bf), at: bf.band.foldAt },
      areaMin: { value: lo.area.min, ring: name(lo), at: lo.area.minAt }, areaMax: { value: hi.area.max, ring: name(hi), at: hi.area.maxAt },
      pinch: { value: pn.pinch.min, ring: name(pn), at: pn.pinch.at }, twist: { value: tw.twist.max, ring: name(tw), at: tw.twist.at },
    };
  };
  const regions = {};
  for (const [name, spec] of Object.entries(STRETCH_REGIONS)) {
    const list = acc.filter((r) => spec.some(([fam, cnt]) => (r.part === `${fam}R` || r.part === `${fam}L` || r.part === fam) && (cnt > 0 ? r.k < cnt : r.k >= r.n + cnt)));
    if (list.length) regions[name] = worstOf(list);
  }
  return { rings: acc, regions, worst: acc.length ? worstOf(acc) : null, frames: frames.length };
}

/**
 * The studied gaits as audit frames: each of `gaits` (the hero's walk, jog and sprint as the door stamps them) sampled at
 * `samples` phases over its cycle, labelled `<gait> <i>/<samples>`.
 */
export function gaitFrames(R, { gaits = ['walk', 'jog', 'sprint'], samples = 12 } = {}) {
  const plan = motionPlan(stampHeroMotion(Object.fromEntries(gaits.map((g) => [g, true]))));
  const out = [];
  for (const g of gaits) {
    const loco = heroLocomotion(plan[g].spec, R, { tilt: plan[g].tilt });
    for (let i = 0; i < samples; i++) out.push({ label: `${g} ${i}/${samples}`, pose: loco.fn(i / samples) });
  }
  return out;
}
