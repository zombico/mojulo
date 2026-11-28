/**
 * hero-flow — what FLOWS on a hero: the hair and every garment piece designed to, each on CONTROL STRINGS that swing
 * with inertia and the world's wind against the body and what is worn LOCKED on it, one COLLISION FORM.
 *
 *   • RIGIDITY is the one word for how a piece moves (the garment canon's fourth axis: coverage, mugen, RIGIDITY, cuts):
 *     `shell` (1: locked, it moves rigidly with its bones and is part of the form), `stiff` (0.8: leather, a starched
 *     hem), `crisp` (0.6: cotton), `soft` (0.4: wool, a long hair mass), `flowing` (0.2: silk, chiffon), or a number in
 *     0 … 1. It sets the strings' pull to shape, damping, how much air they catch and how much gravity they feel
 *     (rigidityParams); a piece's `material` (cloth-law.js) names one and a weight that slows its pull and its sail.
 *     A garment piece is a shell unless it says otherwise; the hair's sections carry their own.
 *   • THE STRINGS. A piece hangs on one or more strings, chains of joints from its attached edge to its free one:
 *     a STRAND (one string: a hair section from its root on the skull, nearest the skull's centre, to its tip; a ribbon
 *     or a sash tail from its top) or a CURTAIN (a string every 360 / M degrees round its hanging edge, its neighbours
 *     coupled: a skirt — a coarse cloth; an open one, a cape, spreads its M strings over the arc it covers, so its open
 *     edges are its own and its middle is coupled). Each joint rides the piece's CARRIER bone (the head, the pelvis); a
 *     bone per link, its roll from two joints across the carrier. The piece's vertices are re-weighed along their
 *     strings (between the two nearest strings round a curtain, between the two nearest links along each), less what
 *     their own skin weighs an arm: cloth DRAPED on an arm keeps that share on it (a cloak over the shoulder).
 *   • THE TARGET. Each joint is pulled toward where the piece's own skin would carry it (the blend of the vertices round
 *     it): a skirt still follows the legs in a stride, a hair section the head; the dynamics ride on top.
 *   • THE FORM. The body and everything locked on it, as capsules on the body's bones, each the flesh round that bone
 *     (a high percentile of the distance of the vertices it carries; what flows is never part of it). The strings stay
 *     out of it (as far as their rest allows: a string lying on the back at rest is not shoved off it) and above the
 *     floor.
 *   • THE DYNAMICS. Verlet at fixed substeps (deterministic): the pull to the target, gravity as it differs from the
 *     carrier's rest (a head upside down pulls the hair the other way), drag toward the air (the wind less the body's own
 *     motion: running into still air is a headwind), damping; neighbours eased to their rest spacing; then the links'
 *     lengths, the form, the floor, and the lengths last.
 * The rig channel is `flow` (station-loft-rig.js): each string joint's displacement from rest in its carrier's frame.
 * Pure and deterministic.
 */
import { validateRig, bindLayered, rigNodesAt, boneFrames } from './station-loft-rig.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const mv = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const mtv = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
const centroid = (pts) => mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length);
const r6 = (v) => +v.toFixed(6);

// ─── rigidity (rigidity.js: the vocabulary, shared with the garments that declare it) and the material (cloth-law.js:
// a word naming a rigidity and a weight) ───
import { RIGIDITY_WORDS, rigidityOf, rigidityErrors, rigidityParams } from './rigidity.js';
import { clothRigidity, materialParams } from './cloth-law.js';
import * as dmath from '../../util/dmath.js';
export { RIGIDITY_WORDS, rigidityOf, rigidityErrors, rigidityParams };

/**
 * The hair's sections: each a strand, `links` its joints past the root, its rigidity (the back hangs soft, the fringe
 * and the sideburns are short and stiff), and any motion of its own over the rigidity's (the ahoge springs: a character
 * beat, underdamped).
 */
export const HAIR_SECTIONS = Object.freeze({
  hairFormBackC: Object.freeze({ links: 4, rigidity: 0.36 }),
  hairFormBackL: Object.freeze({ links: 4, rigidity: 0.36 }),
  hairFormBackR: Object.freeze({ links: 4, rigidity: 0.36 }),
  hairFormSideL: Object.freeze({ links: 4, rigidity: 0.43 }),
  hairFormSideR: Object.freeze({ links: 4, rigidity: 0.43 }),
  hairFormFringeA: Object.freeze({ links: 2, rigidity: 0.9 }),
  hairFormFringeB: Object.freeze({ links: 2, rigidity: 0.9 }),
  hairSideburnL: Object.freeze({ links: 1, rigidity: 0.93 }),
  hairSideburnR: Object.freeze({ links: 1, rigidity: 0.93 }),
  hairAhoge: Object.freeze({ links: 2, rigidity: 0.8, damping: 3 }),
});
/** neighbouring hair sections move as one mass: their joints held softly at their rest spacing */
export const HAIR_NEIGHBOURS = Object.freeze([['hairFormBackL', 'hairFormBackC'], ['hairFormBackC', 'hairFormBackR'], ['hairFormSideL', 'hairFormBackL'], ['hairFormSideR', 'hairFormBackR'], ['hairFormFringeA', 'hairFormFringeB']]);
const COUPLE = 0.35;      // the share of a neighbour pair's stretch taken back per substep
const LOFT = 0.3;         // the share of the field's updraught a string takes (the field's is tuned to loft a leaf)
/** the bones of the collision form */
export const FORM_BONES = Object.freeze(['pelvis', 'lumbar', 'torso', 'neck', 'head', 'upperArmL', 'upperArmR', 'foreArmL', 'foreArmR', 'bustL', 'bustR', 'thighL', 'thighR', 'shankL', 'shankR']);
const FORM_PCT = 0.8;     // a capsule's radius: this share of its vertices lie within it (the trunk and the head: hair lies on them)
const LIMB_PCT = 0.95;    // a limb's: nearly all of it (a leg sweeps through a skirt; its knee must not poke out)
const NODE_R = 0.012;     // a string's own thickness at a joint (m)
const SHEET_R = 0.025;    // a curtain's at a joint: the cloth spans to its neighbours, so it keeps further off
const REACH = 1.25;       // the far-side rule's exit must lie within this share of the joint's link from the joint before it
const CLEAR = 0.004;      // the least gap a string keeps from the form, where its rest allows (m)
const CURTAIN = { strings: 16, links: 4 };
const DRAPE_BONE = /^(clavicle|upperArm|foreArm|elbowFold|hand)[LR]$/;   // the arm's chain: a flowing vertex keeps its own weight on it

/**
 * What flows on a compiled hero, its rig with the strings, the skin re-weighed along them, and the collision form.
 * @param {object} mesh    the compiled rest mesh (planLayered)
 * @param {object} recipe  its recipe (the rig, the parts; a part's own `rigidity` makes it flow)
 * @param {{ hair?, pieces?: { [part]: { rigidity, layout?: 'strand'|'curtain', strings?, links?, carrier? } } }} opts
 *   `hair` the hair's sections (false: the hair locked); `pieces` garment parts that flow beyond those that say so
 * @returns {{ R, skin, strings, pairs, form }}  (no strings ⇒ the rig and the skin as they were)
 */
export function flowRig(mesh, recipe, { hair = HAIR_SECTIONS, pieces = {}, legs = false } = {}) {
  const rig = recipe.rig; const R0 = validateRig(rig); const skin0 = bindLayered(mesh, recipe, R0);
  const byPart = {}; mesh.provenance.forEach((p, i) => { (byPart[p.part] ??= []).push(i); });
  const V = mesh.vertices;
  // what flows: the hair's sections, then each part that says (or is told) its rigidity, a shell staying locked
  const want = [];
  for (const [part, P] of Object.entries(hair || {})) if (byPart[part]) want.push({ part, layout: 'strand', from: 'skull', ...P });
  // a part that says its rigidity; one tied at a point (`root`: a ribbon, a streamer, a bow's tail) hangs as a strand from it
  // (or its material, cloth-law.js: a rigidity and a weight; `pieces` adds to what a part says, field by field)
  const said = Object.fromEntries(Object.entries(recipe.parts || {}).filter(([, p]) => p.rigidity !== undefined || p.material !== undefined).map(([n, p]) => [n, { ...(p.rigidity !== undefined ? { rigidity: p.rigidity } : {}), ...(p.material !== undefined ? { material: p.material } : {}), ...(Array.isArray(p.root) ? { layout: 'strand', from: p.root } : {}) }]));
  for (const part of new Set([...Object.keys(said), ...Object.keys(pieces)])) { const P = { ...said[part], ...pieces[part] }, r = clothRigidity(P); if (!byPart[part] || r === null || r >= 1) continue; want.push({ part, layout: 'curtain', ...P }); }
  const flowing = new Set(want.map((w) => w.part));
  const joints = { ...rig.joints }, bones = [...rig.bones], strings = [], pairs = [];
  const axes = new Set();
  const axisFor = (carrier) => {
    const b = R0.bones[R0.boneIndex[carrier]], h = R0.joints[b.head];
    if (!axes.has(carrier)) { axes.add(carrier); joints[`${carrier}FlowAxisR`] = { at: [h[0] + 0.05, h[1], h[2]], rides: carrier }; joints[`${carrier}FlowAxisL`] = { at: [h[0] - 0.05, h[1], h[2]], rides: carrier }; }
    return [`${carrier}FlowAxisL`, `${carrier}FlowAxisR`];
  };
  // the blend round a joint: the mean of the original weights of the vertices it stands for
  const blendOf = (ids) => { const acc = {}; for (const i of ids) skin0.weights[i].forEach((w, k) => { if (w) acc[skin0.joints[i][k]] = (acc[skin0.joints[i][k]] || 0) + w; }); const e = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 4); const s = e.reduce((t, [, w]) => t + w, 0); return e.map(([b, w]) => [Number(b), w / s]); };
  const carrierOf = (ids) => { const n = {}; for (const i of ids) n[skin0.dominant[i]] = (n[skin0.dominant[i]] || 0) + 1; return R0.bones[Number(Object.entries(n).sort((a, b) => b[1] - a[1])[0][0])].id; };
  const cap = byPart.hairCap?.map((i) => V[i]);
  const skull = cap?.length ? (() => { const mn = [0, 1, 2].map((k) => Math.min(...cap.map((p) => p[k]))), mx = [0, 1, 2].map((k) => Math.max(...cap.map((p) => p[k]))); return mn.map((v, k) => (v + mx[k]) / 2); })() : mul(add(R0.joints.headBase, R0.joints.headTop), 0.5);
  const addString = (name, part, carrier, restPts, binIds, params, cover) => {
    const jn = restPts.map((_, k) => `${name}J${k}`), bn = restPts.slice(1).map((_, k) => `${name}${k + 1}`), aux = axisFor(carrier);
    restPts.forEach((p, k) => { joints[jn[k]] = { at: p.map(r6), rides: carrier }; });
    bn.forEach((b, k) => bones.push({ id: b, head: jn[k], tail: jn[k + 1], aux }));
    strings.push({ name, part, carrier, joints: jn, bones: bn, rest: restPts.map((p) => p.map(r6)), lengths: restPts.slice(1).map((p, k) => len(sub(p, restPts[k]))), params, blends: binIds.map(blendOf), cover });
    return strings.length - 1;
  };
  for (const W of want) {
    // (a piece hung from `top` (z, m): its vertices above keep their skin, the curtain hung from there: the realistic
    // body's tailored robe, its bodice and hips the tailor's, its skirt below the hips on strings)
    const ids = Number.isFinite(W.top) ? byPart[W.part].filter((i) => V[i][2] <= W.top) : byPart[W.part]; if (ids.length < 8) continue;
    const params = { ...materialParams({ rigidity: W.rigidity, material: W.material }), ...Object.fromEntries(['stiffness', 'damping', 'sail', 'gravity'].filter((k) => W[k] !== undefined).map((k) => [k, W[k]])) };
    const pts = ids.map((i) => V[i]);
    // the carrier: what holds the attached edge (the head for hair; for a garment the bone its top rides most)
    const carrier = W.carrier ?? (W.from === 'skull' ? 'head' : carrierOf(ids.filter((_, i) => pts[i][2] >= Math.max(...pts.map((p) => p[2])) - 0.1 * (Math.max(...pts.map((p) => p[2])) - Math.min(...pts.map((p) => p[2]))))));
    if (W.layout === 'strand') {
      // root → tip: by distance from the skull's centre (hair), from where it is tied (a ribbon), else from the top down
      const d = W.from === 'skull' ? pts.map((p) => len(sub(p, skull))) : Array.isArray(W.from) ? pts.map((p) => len(sub(p, W.from))) : pts.map((p) => -p[2]);
      const sorted = [...d].sort((a, b) => a - b), q = (f) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
      const rootIds = ids.filter((_, i) => d[i] <= q(0.08)), tipIds = ids.filter((_, i) => d[i] >= q(0.92));
      const root = centroid(rootIds.map((i) => V[i])), tip = centroid(tipIds.map((i) => V[i])), ax = sub(tip, root), L2 = dot(ax, ax); if (L2 < 1e-6) continue;
      const s = pts.map((p) => Math.max(0, Math.min(1, dot(sub(p, root), ax) / L2))), n = W.links ?? Math.max(2, Math.min(6, Math.round(Math.sqrt(L2) / 0.06)));
      const restPts = [root], bins = [rootIds];
      for (let k = 1; k < n; k++) { const inS = ids.filter((_, i) => Math.abs(s[i] - k / n) <= 0.5 / n); restPts.push(inS.length ? centroid(inS.map((i) => V[i])) : add(root, mul(ax, k / n))); bins.push(inS.length ? inS : rootIds); }
      restPts.push(tip); bins.push(tipIds);
      addString(W.part, W.part, carrier, restPts, bins, params, ids.map((i, m) => ({ i, a: [[0, 1]], s: s[m] })));
      continue;
    }
    // a CURTAIN: strings round the piece's hanging edge (from its top's centre), each from the top down
    const M = W.strings ?? CURTAIN.strings, n = W.links ?? CURTAIN.links;
    const zs = pts.map((p) => p[2]), zt = Math.max(...zs), zb = Math.min(...zs), H = zt - zb; if (H < 0.02) continue;
    const top = ids.filter((_, i) => zs[i] >= zt - 0.1 * H), c = centroid(top.map((i) => V[i]));
    const th = pts.map((p) => dmath.atan2(p[0] - c[0], p[1] - c[1])), s = pts.map((p) => (zt - p[2]) / H);
    const angDiff = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
    // AN OPEN CURTAIN (a cape round the back, open at the front) spreads its strings over the arc it covers, from one
    // edge to the other, so its open edges are the cloth's own and the strings either side of its middle are coupled; a
    // ring (a skirt: no gap wider than a string's share) keeps its strings from the back round
    const ths = [...th].sort((a, b) => a - b); let gap = ths[0] + 2 * Math.PI - ths[ths.length - 1], from = ths[0];
    for (let q = 1; q < ths.length; q++) if (ths[q] - ths[q - 1] > gap) { gap = ths[q] - ths[q - 1]; from = ths[q]; }
    const open = gap > (2 * Math.PI) / M, arc = open ? 2 * Math.PI - gap : 2 * Math.PI, origin = open ? from : -Math.PI;
    const made = [];
    for (let m = 0; m < M; m++) {
      const a0 = origin + (arc * (m + 0.5)) / M, inA = ids.filter((_, i) => angDiff(th[i], a0) < arc / (2 * M));
      if (inA.length < 8) continue;
      const S = Object.fromEntries(inA.map((i) => [i, s[ids.indexOf(i)]]));
      const bin = (lo, hi) => inA.filter((i) => S[i] >= lo && S[i] <= hi);
      const binsK = [bin(0, 0.06), ...Array.from({ length: n - 1 }, (_, k) => bin((k + 1) / n - 0.5 / n, (k + 1) / n + 0.5 / n)), bin(0.94, 1)];
      if (binsK.some((b) => !b.length)) continue;
      made.push({ m, a0, k: addString(`${W.part}S${m}`, W.part, carrier, binsK.map((b) => centroid(b.map((i) => V[i]))), binsK, params, null) });
    }
    if (!made.length) continue;
    // the vertices: between the two strings either side of them, by angle; neighbours coupled (round a full ring)
    // (a ring stays a ring when a share of it found too few vertices for a string: its neighbours either side of the gap
    // take its cloth between them, rather than leaving a seam the cloth opens along)
    const full = !open && made.length >= 3;
    if (full && legs) for (const x of made) strings[x.k].ring = made.length;
    ids.forEach((i, mi) => {
      let lo = null, hi = null;
      for (let q = 0; q < made.length; q++) { const A = made[q], B = made[(q + 1) % made.length]; if (!full && q === made.length - 1) break; const span = ((B.a0 - A.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI, at = ((th[mi] - A.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); if (at <= span) { lo = A; hi = B; const f = at / span; (strings[A.k].cover ??= []).push({ i, a: [[0, 1 - f]], s: s[mi] }); if (f > 0) (strings[B.k].cover ??= []).push({ i, a: [[0, f]], s: s[mi] }); break; } }
      if (!lo) { const near = made.reduce((b, x) => (angDiff(th[mi], x.a0) < angDiff(th[mi], b.a0) ? x : b), made[0]); (strings[near.k].cover ??= []).push({ i, a: [[0, 1]], s: s[mi] }); }
    });
    for (let q = 0; q < made.length - (full ? 0 : 1); q++) {
      const A = strings[made[q].k], B = strings[made[(q + 1) % made.length].k];
      for (let j = 1; j < A.rest.length; j++) pairs.push({ a: made[q].k, b: made[(q + 1) % made.length].k, j, d: len(sub(A.rest[j], B.rest[j])) });
    }
  }
  if (!strings.length) return { R: R0, skin: skin0, strings: [], pairs: [], form: null };
  // the hair's neighbours
  const at = Object.fromEntries(strings.map((st, i) => [st.name, i]));
  for (const [a, b] of HAIR_NEIGHBOURS) { if (at[a] === undefined || at[b] === undefined) continue; const A = strings[at[a]], B = strings[at[b]]; for (let j = 1; j < Math.min(A.rest.length, B.rest.length); j++) pairs.push({ a: at[a], b: at[b], j, d: len(sub(A.rest[j], B.rest[j])) }); }
  const R = validateRig({ ...rig, joints, bones });
  const skin = bindLayered(mesh, recipe, R);
  // re-weigh what flows: each vertex along its string(s) (u ∈ [0, n]: between the links nearest it; the root's half
  // link shared with the root's own blend)
  const acc = new Map();
  for (const st of strings) {
    const n = st.bones.length, bi = st.bones.map((b) => R.boneIndex[b]);
    for (const { i, a: [[, share]], s } of st.cover || []) {
      const u = s * n, b = Math.min(n - 1, Math.floor(u)), t = u - b; let e;
      if (t >= 0.5 && b + 1 < n) e = [[bi[b], 1.5 - t], [bi[b + 1], t - 0.5]];
      else if (t < 0.5 && b > 0) e = [[bi[b - 1], 0.5 - t], [bi[b], 0.5 + t]];
      else if (t < 0.5) e = [...st.blends[0].map(([x, w]) => [x, (0.5 - t) * w]), [bi[0], 0.5 + t]];
      else e = [[bi[b], 1]];
      const m = acc.get(i) ?? {}; for (const [x, w] of e) m[x] = (m[x] || 0) + w * share; acc.set(i, m);
    }
    delete st.cover;
  }
  // cloth DRAPED ON A LIMB keeps its share on it: a vertex whose own skin weighs an arm (a cloak over the shoulder and
  // the upper arm: body-garment.js capePart) goes with that arm by that share and flows by the rest, so a swinging arm
  // carries the cloth over it instead of passing through it; the hair and the skirts weigh no arm and flow as before
  const drapeBones = new Set(R.bones.map((b, x) => (DRAPE_BONE.test(b.id) ? x : -1)).filter((x) => x >= 0));
  for (const [i, m] of acc) {
    const own = skin.joints[i].map((j, k) => [j, skin.weights[i][k]]).filter(([j, w]) => w > 0 && drapeBones.has(j)), h = own.reduce((t, [, w]) => t + w, 0);
    if (h > 1e-6) { const tot = Object.values(m).reduce((t, w) => t + w, 0); for (const x of Object.keys(m)) m[x] *= (1 - h) / tot; for (const [j, w] of own) m[j] = (m[j] || 0) + w; }
  }
  for (const [i, m] of acc) {
    const e = Object.entries(m).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4), tot = e.reduce((t, [, w]) => t + w, 0);
    const j = [0, 0, 0, 0], w = [0, 0, 0, 0]; e.forEach(([x, y], k) => { j[k] = Number(x); w[k] = y / tot; });
    skin.joints[i] = j; skin.weights[i] = w; skin.dominant[i] = j[0];
  }
  const out = { R, skin, strings, pairs, form: collisionForm(mesh, R, skin0, flowing) };
  if (legs && strings.some((st) => st.ring)) out.legs = legSurface(mesh, R, skin, flowing);
  return out;
}

/** the bones whose surface a skirt's ring is carried clear of (the shin, the foot, the toes) */
const LEG_BONE = /^(shank|foot|toes)[LR]$/;
const LEG_BIN = { along: 0.03, around: 12 };   // the leg's surface sampled by 3 cm along each bone and 30° round it
const LEG_CLEAR = 0.025;  // the gap (m) a skirt's ring keeps outside the shin and the foot
const LEG_PASSES = 2;     // the passes a ring's target is pushed clear of the legs in, as posed
const LEG_SPREAD = 0.6;
const HEM_RUN = 0.15;     // how far past a ring's last joint its cloth runs on, a share of the last link   // the share of a string's push out round a leg its neighbour takes (and the next of that)
/**
 * THE LEGS' SURFACE a skirt's ring keeps outside: the outermost vertex of the shin, the foot and the toes (body and what
 * is worn on them; nothing that flows, no hair) in each bin along and round its bone, each carried by that bone.
 * → [{ b: bone index, p: rest point }]
 */
function legSurface(mesh, R, skin, flowing) {
  const best = new Map();
  mesh.vertices.forEach((v, i) => {
    const part = mesh.provenance[i].part, b = skin.dominant[i], bone = R.bones[b];
    // (an adornment is never the leg: a skirt's hem work rides the shin's weights at rest, and the skirt was pushed off it)
    if (!bone || !LEG_BONE.test(bone.id) || flowing.has(part) || /^(hair|adorn\.)/.test(part)) return;
    const a = R.joints[bone.head], z = R.joints[bone.tail], g = segDist(v, a, z), ax = sub(z, a), al = len(ax) || 1e-9;
    const off = sub(v, g.q), ref = Math.abs(ax[2] / al) > 0.7 ? [1, 0, 0] : [0, 0, 1];
    const e1 = (() => { const w = sub(ref, mul(ax, dot(ref, ax) / (al * al))); return mul(w, 1 / (len(w) || 1)); })(), e2 = mul([ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]], 1 / al);
    const ang = Math.floor(((dmath.atan2(dot(off, e2), dot(off, e1)) + Math.PI) / (2 * Math.PI)) * LEG_BIN.around) % LEG_BIN.around;
    const key = `${b},${Math.floor((g.t * al) / LEG_BIN.along)},${ang}`, cur = best.get(key);
    if (!cur || g.d > cur.d || (g.d === cur.d && i < cur.i)) best.set(key, { i, d: g.d, b });
  });
  return [...best.values()].sort((x, y) => x.i - y.i).map(({ i, b }) => ({ b, p: [...mesh.vertices[i]] }));
}
/** the angle (rad) between two directions round the vertical, folded into [0, π] */
const angGap = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
/**
 * A SKIRT'S RING CARRIED BY THE LEGS (shipped games' rule: the hem's ring is pushed out round both shins and feet, so
 * the trailing leg carries the cloth back instead of the heel passing through it). Each string of a ring, at each height
 * a shin or a foot point stands at, must lie far enough out round the ring's axis (the vertical through its top) that
 * the cloth between it and its neighbour (their chord) passes outside that point, wherever between them it stands; a
 * string short of it is moved straight out from the axis (its angle kept, so the ring keeps its order and closes), the
 * shortfall shared between the two joints the point lies between by where it lies. In place on S.
 */
function clearLegs(S, axis, spacing, pts) {
  const cs = dmath.cos(spacing / 2), zTop = S[0].p[2], last = S.length - 1;
  const zLow = S[last].p[2] - HEM_RUN * Math.max(0, S[last - 1].p[2] - S[last].p[2]);
  for (const { p: P, a: aP, h: hP } of pts) {
    if (P[2] > zTop || P[2] < zLow) continue;
    for (let j = 1; j < S.length; j++) {
      const A = S[j - 1].p, B = S[j].p;
      // (the last link runs on past its joint to the cloth's own edge, the hem's ring below the string's last bin)
      if (A[2] - B[2] < 1e-6 || !(A[2] >= P[2] && P[2] >= B[2] - (j === last ? HEM_RUN * (A[2] - B[2]) : 0))) continue;
      const t = (A[2] - P[2]) / (A[2] - B[2]), Q = add(A, mul(sub(B, A), t));
      const qx = Q[0] - axis[0], qy = Q[1] - axis[1];
      const gap = angGap(aP, dmath.atan2(qx, qy)); if (gap >= spacing) break;
      const need = (hP + LEG_CLEAR) * dmath.cos(gap - spacing / 2) / cs, short = need - Math.sqrt(qx * qx + qy * qy);
      if (short <= 0) break;
      const out = (x, d) => { const q = x.p, h = Math.sqrt((q[0] - axis[0]) ** 2 + (q[1] - axis[1]) ** 2) || 1e-9; x.p = [q[0] + ((q[0] - axis[0]) / h) * d, q[1] + ((q[1] - axis[1]) / h) * d, q[2]]; };
      if (j === 1 || t > 1) out(S[j], short / Math.max(t, 0.25));
      else { const den = t * t + (1 - t) * (1 - t); out(S[j], (short * t) / den); out(S[j - 1], (short * (1 - t)) / den); }
      break;
    }
  }
}
/** the hair alone on its strings (flowRig with no garment flowing) */
export const hairRig = (mesh, recipe, { sections = HAIR_SECTIONS } = {}) => flowRig(mesh, { ...recipe, parts: Object.fromEntries(Object.entries(recipe.parts || {}).map(([n, p]) => [n, p.rigidity === undefined ? p : (({ rigidity: _r, ...q }) => q)(p)])) }, { hair: sections });

/**
 * THE COLLISION FORM: the body and what is locked on it, as capsules — per form bone the segment from its head to its
 * tail at rest and the radius holding FORM_PCT of the vertices it carries most, the hair and every flowing part left out.
 */
export function collisionForm(mesh, R, skin, flowing = new Set()) {
  const out = [];
  for (const id of FORM_BONES) {
    const bi = R.boneIndex[id]; if (bi === undefined) continue; const b = R.bones[bi];
    const a = R.joints[b.head], z = R.joints[b.tail];
    // TAPERED: a radius at each end, from the vertices nearer it (a thigh is thick at the hip and slim at the knee)
    const d0 = [], d1 = [];
    mesh.vertices.forEach((v, i) => { const part = mesh.provenance[i].part; if (skin.dominant[i] !== bi || /^hair/.test(part) || flowing.has(part)) return; const g = segDist(v, a, z); (g.t < 0.5 ? d0 : d1).push(g.d); });
    if (d0.length + d1.length < 8) continue;
    const pct = /^(thigh|shank|upperArm|foreArm)/.test(id) ? LIMB_PCT : FORM_PCT, at = (d) => { d.sort((x, y) => x - y); return d[Math.floor(pct * (d.length - 1))]; };
    const r0 = d0.length >= 4 ? at(d0) : at(d1), r1 = d1.length >= 4 ? at(d1) : r0;
    out.push({ bone: id, a, b: z, r: Math.max(r0, r1), r0, r1 });
  }
  return out;
}
/** the nearest point on segment a–b to p, and the distance */
function segDist(p, a, b) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / Math.max(1e-12, dot(ab, ab)))); const q = add(a, mul(ab, t));
  return { q, d: len(sub(p, q)), t };
}
/** a tapered capsule's radius at t along it */
const radiusAt = (cap, t) => (cap.r0 ?? cap.r) + ((cap.r1 ?? cap.r) - (cap.r0 ?? cap.r)) * t;

/**
 * A FLOW SIMULATION over poses in time: `step(pose, dt, air)` advances the strings to the posed body (`air`: the air's
 * velocity, world m/s, the body's own motion already taken off) and returns the pose with its `flow` channel. Starts
 * from rest; deterministic for the same sequence of calls.
 * @param {object} H  flowRig's result
 */
export function flowSimulation(H, { substep = 1 / 240, iterations = 3, floor = null } = {}) {
  const { R, strings, form, pairs } = H; const rest = R.joints;
  // (the body as it plays: a clip solved clamped, a rider's legs to the irons, is replayed clamped, never refused)
  const Rc = R.reach === 'clamp' ? R : { ...R, reach: 'clamp' };
  const ground = (floor ?? Math.min(...Object.values(R.legs).flatMap((L) => [rest[L.toeBase][2], rest[L.toeTip][2]]))) + NODE_R;
  const G = [0, 0, -9.81];
  // the most each joint may come within each capsule's axis: never closer than it lay at rest (CLEAR short of it), and
  // no further than the capsule's radius where it stands (tapered) and the string's own thickness
  const thick = strings.map((st) => (st.name === st.part ? NODE_R : SHEET_R));
  const restCap = strings.map((st) => st.rest.map((p) => form.map((cap) => Math.max(0, segDist(p, cap.a, cap.b).d - CLEAR))));
  const carrierIx = strings.map((st) => R.boneIndex[st.carrier]);
  let state = null, time = 0;
  const fix = (st, S) => { for (let j = 1; j < S.length; j++) { const a = S[j - 1].p, d = sub(S[j].p, a), l = len(d) || 1e-9; S[j].p = add(a, mul(d, st.lengths[j - 1] / l)); } };
  // a joint inside the form leaves it on the side its target lies (cloth swept by a fast leg goes back over it, never
  // through to the far side where it would be caught); a target inside too, by the nearest way
  function constrain(st, si, S, caps, T) {
    for (let it = 0; it < iterations; it++) {
      fix(st, S);
      for (let j = 1; j < S.length; j++) caps.forEach((cap, ci) => {
        const { q, d, t } = segDist(S[j].p, cap.a, cap.b), r = Math.min(radiusAt(cap, t) + thick[si], restCap[si][j][ci]);
        if (!(r > 0) || d >= r) return;
        // the nearest way out, unless the joint has crossed to the far side of the capsule from its target: then the
        // target's side (off the axis at the joint's own place along it)
        const ax = sub(cap.b, cap.a), al = len(ax) || 1e-9, an = mul(ax, 1 / al), perp = (v) => sub(v, mul(an, dot(v, an)));
        let out = d > 1e-9 ? mul(sub(S[j].p, q), 1 / d) : null;
        // (only where its link can reach it: an exit beyond the link's length is pulled back through the capsule by the
        // lengths, so then the nearest way)
        if (T) { const w = perp(sub(T[j], q)), wl = len(w); if (wl > 1e-6 && (!out || dot(out, w) < 0)) { const far = add(q, mul(w, r / wl)); if (len(sub(far, S[j - 1].p)) <= st.lengths[j - 1] * REACH) out = mul(w, 1 / wl); } }
        S[j].p = add(q, mul(out ?? [0, 0, 1], r));
      });
      for (let j = 1; j < S.length; j++) if (S[j].p[2] < ground) S[j].p = [S[j].p[0], S[j].p[1], ground];
    }
    fix(st, S);   // the lengths have the last word (a push out of the form moves a joint a hair's breadth; a stretched link reads)
  }
  const ride = (f, p) => add(f.head, mv(f.m, sub(p, f.restHead)));
  const posed = (pose) => {
    const { nodes } = rigNodesAt(Rc, { ...pose, flow: undefined }); const F = boneFrames(R, rest, nodes);
    const caps = form.map((c) => { const fb = F[R.boneIndex[c.bone]]; return { r: c.r, r0: c.r0, r1: c.r1, a: ride(fb, c.a), b: ride(fb, c.b) }; });
    // each joint's target: its rest place carried by its own blend
    const targets = strings.map((st) => st.rest.map((p, j) => st.blends[j].reduce((o, [b, w]) => add(o, mul(ride(F[b], p), w)), [0, 0, 0])));
    // the legs' surface as posed, and each ring's axis: the vertical through its strings' roots
    let L = null;
    if (H.legs) {
      const tops = {}; strings.forEach((st, si) => { if (st.ring) (tops[st.part] ??= []).push(targets[si][0]); });
      const pts = H.legs.map(({ b, p }) => ride(F[b], p)), axes = Object.fromEntries(Object.entries(tops).map(([k, v]) => [k, centroid(v)]));
      // (each point's bearing and distance round each ring's axis, read once a pose)
      L = { axes, pts: Object.fromEntries(Object.entries(axes).map(([k, ax]) => [k, pts.map((p) => { const x = p[0] - ax[0], y = p[1] - ax[1]; return { p, a: dmath.atan2(x, y), h: Math.sqrt(x * x + y * y) }; })])) };
      // THE TARGET FOLLOWS THE LEGS: a ring's target pushed out round the shins and the feet as they stand now, so the pull
      // and the far-side rule carry the cloth back with the trailing leg instead of asking it to stay where the heel passes
      strings.forEach((st, si) => { if (!st.ring) return; const T = targets[si].map((p) => ({ p })); for (let it = 0; it < LEG_PASSES; it++) clearLegs(T, L.axes[st.part], (2 * Math.PI) / st.ring, L.pts[st.part]); targets[si] = T.map((x) => x.p); });
    }
    return { F, caps, targets, L };
  };
  // WHAT IS SHOWN of a ring: the simulated strings carried clear of the shins and the feet as posed (pushed straight out
  // from the ring's axis, the links' lengths kept, a few passes), a pass over the result only: the simulation's own state
  // is untouched, so the cloth is never flung by it
  // (each string's push shared out round the ring, LEG_SPREAD of it to each neighbour and on, so the ring bulges round the
  // leg as cloth does instead of creasing between one string pushed out and the next left in, which folded the faces
  // between them inside out)
  const worn = (Ss, L) => {
    if (!L) return Ss;
    const out = [...Ss], parts = {};
    strings.forEach((st, si) => { if (st.ring) (parts[st.part] ??= []).push(si); });
    for (const [part, ix] of Object.entries(parts)) {
      const axis = L.axes[part], spacing = (2 * Math.PI) / ix.length, rad = (p) => Math.sqrt((p[0] - axis[0]) ** 2 + (p[1] - axis[1]) ** 2);
      const clear = (si, W) => { for (let it = 0; it < LEG_PASSES; it++) { clearLegs(W, axis, spacing, L.pts[part]); fix(strings[si], W); } return W; };
      const first = ix.map((si) => clear(si, Ss[si].map((x) => ({ p: [...x.p] }))));
      let gain = ix.map((si, q) => first[q].map((x, j) => Math.max(0, rad(x.p) - rad(Ss[si][j].p))));
      for (let pass = 0; pass < 2; pass++) gain = gain.map((g, q) => g.map((v, j) => Math.max(v, LEG_SPREAD * Math.max(gain[(q + ix.length - 1) % ix.length][j], gain[(q + 1) % ix.length][j]))));
      ix.forEach((si, q) => {
        const W = Ss[si].map((x, j) => { const p = x.p, h = rad(p) || 1e-9, d = gain[q][j]; return { p: [p[0] + ((p[0] - axis[0]) / h) * d, p[1] + ((p[1] - axis[1]) / h) * d, p[2]] }; });
        fix(strings[si], W); out[si] = clear(si, W);
      });
    }
    return out;
  };
  const channel = (F, S, st, si, out) => { const f = F[carrierIx[si]]; st.joints.forEach((jn, j) => { out[jn] = sub(add(mtv(f.m, sub(S[j].p, f.head)), f.restHead), st.rest[j]).map(r6); }); };
  function step(pose, dt, air0 = [0, 0, 0]) {
    const air = [air0[0], air0[1], air0[2] * LOFT];
    const { F, caps, targets, L } = posed(pose);
    if (!state) state = targets.map((T) => T.map((p) => ({ p: [...p], prev: [...p] })));
    const downs = strings.map((_, si) => mv(F[carrierIx[si]].m, [0, 0, -1]));   // the rest's down, turned with the carrier
    const nSub = Math.max(1, Math.round(dt / substep)), sdt = dt / nSub;
    for (let k = 0; k < nSub; k++) {
      strings.forEach((st, si) => {
        const P = st.params, S = state[si], T = targets[si];
        S[0].p = [...T[0]]; S[0].prev = [...T[0]];
        const grav = mul(sub(G, mul(downs[si], 9.81)), P.gravity);   // gravity as it differs from the rest's
        for (let j = 1; j < S.length; j++) {
          const x = S[j]; const v = mul(sub(x.p, x.prev), 1 / sdt);
          const acc = add(add(mul(sub(T[j], x.p), P.stiffness), grav), mul(sub(air, v), P.sail));
          const vn = mul(add(v, mul(acc, sdt)), dmath.exp(-P.damping * sdt));
          x.prev = x.p; x.p = add(x.p, mul(vn, sdt));
        }
      });
      // neighbours as one mass: eased back toward their rest spacing (before the constraints, which have the last word)
      for (const q of pairs) { const x = state[q.a][q.j], y = state[q.b][q.j], d = sub(y.p, x.p), l = len(d) || 1e-9, c = mul(d, COUPLE * 0.5 * (l - q.d) / l); x.p = add(x.p, c); y.p = sub(y.p, c); }
      strings.forEach((st, si) => constrain(st, si, state[si], caps, st.name === st.part ? null : targets[si]));   // the far-side rule is the cloth's
      time += sdt;
    }
    const flow = {}, shown = worn(state, L); strings.forEach((st, si) => channel(F, shown[si], st, si, flow));
    return { ...pose, flow };
  }
  /** a flow channel made to obey the constraints on `pose` (a blended frame: the seam), the simulation untouched */
  function project(pose, flow) {
    const { F, caps, targets, L } = posed(pose); const out = {};
    const Ss = strings.map((st, si) => {
      const f = F[carrierIx[si]]; const S = st.joints.map((j, k) => ({ p: ride(f, add(st.rest[k], flow[j])) }));
      constrain(st, si, S, caps, st.name === st.part ? null : targets[si]); return S;
    });
    const shown = worn(Ss, L); strings.forEach((st, si) => channel(F, shown[si], st, si, out));
    return out;
  }
  return { step, project, get time() { return time; }, positions: () => state && state.map((S) => S.map((x) => [...x.p])), caps: (pose) => posed(pose).caps };
}

/**
 * A clip's flow, simulated: `poses` the clip's poses at even steps over `seconds` (a loop: the last step meets the
 * first), `air(t)` the air's velocity at time t (world m/s, the body's own motion taken off). A loop is run in until two
 * cycles agree (at least `warm`, at most `settle`) and the last recorded, its seam cross-faded over `fade` of the cycle
 * and put through the constraints; a one-shot runs once from rest. `substep` and `iterations` the simulation's
 * (flowSimulation; its defaults when absent). → the poses with their `flow`.
 */
export function simulateClip(H, poses, seconds, { loop = true, warm = 3, settle = 10, fade = 0.15, air = () => [0, 0, 0], substep, iterations } = {}) {
  const N = poses.length, dt = seconds / (loop ? N : Math.max(1, N - 1)); const sim = flowSimulation(H, { ...(substep ? { substep } : {}), ...(iterations ? { iterations } : {}) });
  for (let k = 0; k < 60; k++) sim.step(poses[0], 1 / 60, air(0));   // settled at the first pose (and the clip's air before it)
  let out = [], gap = Infinity;
  for (let c = 0; c < (loop ? settle : 1); c++) {
    const before = out; out = poses.map((p, i) => sim.step(p, i || c ? dt : 1e-9, air(i * dt)));
    if (before.length) gap = Math.max(...before.map((p, i) => Math.max(...Object.keys(p.flow).map((k) => Math.hypot(...p.flow[k].map((v, a) => v - out[i].flow[k][a]))))));
    if (loop && c + 1 >= warm && gap < 1e-3) break;
  }
  if (!loop) return out;
  const nf = Math.max(1, Math.round(fade * N)), start = out[0].flow;
  return out.map((p, i) => {
    const w = i >= N - nf ? (i - (N - nf) + 1) / (nf + 1) : 0; if (!w) return p;
    const e = w * w * (3 - 2 * w);
    const flow = Object.fromEntries(Object.entries(p.flow).map(([k, v]) => [k, v.map((x, a) => x + (start[k][a] - x) * e)]));
    return { ...p, flow: sim.project(p, flow) };
  });
}
/** the old names: the hair simulation is the flow simulation */
export const hairSimulation = flowSimulation;
