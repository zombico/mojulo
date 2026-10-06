/**
 * skeleton — a species' bone tree, derived from the plan it already builds: the bones a gait poses and the part
 * bindings a skin reads. Nothing here reaches the plan (every species builds byte-identically); the layered rig
 * takes it from here.
 *
 * The AXIS is three regions laid along the body's own centreline, then the head:
 *  - TRUNK `spine0..` from the rump forward, over the torso and any body parts (a snake's coils);
 *  - NECK  `neck0..` from neckBase to neckTop, or along the neck lofts where a family has them (camel, plesiosaur);
 *  - TAIL  `tail0..` from the rump back, over the tail parts; an all-axis body with no tail part (fish, snakes)
 *    carves its tail from the rear quarter of the trunk, any other animal without one has no tail bones;
 *  - HEAD  `head`, from neckTop forward along the head's own length, pitched as worn.
 * Bone counts are the family's fixed spine counts (./locomotion/); `spine0` is the root.
 *
 * LIMBS come from the family's leg rows: one bone per row, joint to joint, parented by the joint chain; a limb's root
 * bone hangs on the axial bone nearest its root joint. The main chain of a shoulder or hip limb (the deepest path)
 * carries a ROLE (`fore.humerus`, `hind.metatarsus`, …): the rig profile a gait solver or a clip library maps by,
 * whatever the family calls its parts. A paired fin that is not a leg row (a fish's pectoral) is one bone from its
 * first station to its last. Right-side bones mirror to the left (…R → …L, x → −x).
 *
 * BIND, per plan part: a limb or fin part rides its bone; a decoration on one side rides the limb whose tube holds
 * its middle (a zebra's leg stripe), else the axis (a cow's teat); a part on the axis gets a bone per station, the
 * nearest of its OWN region's bones (torso stations ride the spine, never the neck), and a joint-to-joint axis part
 * gets its two ends; other midline parts (a mane, a fin, plates) ride the whole axis; head parts ride `head`.
 *
 * Pure and deterministic. Wings (the bones wing.js builds and wearWings discards) join in the rig step.
 */
import { speciesParams, speciesPlan, SPECIES } from './species.js';
import { locomotionFor } from './locomotion/index.js';

const TRUNK = /^(torso|coils|body\d*)$/;
const NECK = /^(neck|neckDown|neckUp|longNeck)$/;
const TAIL = /^(tail|tailTip|tailRinged|tailPaddle|tailBush|tailFlat|tailWhip|tailStiff|tailLoft|tailTaper|dock|scut)$/;
const ROLES = { fore: ['humerus', 'radius', 'metacarpus', 'digit', 'ungual', 'ungual2'], hind: ['femur', 'tibia', 'metatarsus', 'digit', 'ungual', 'ungual2'] };
const LIMB_ROOTS = { shoulder: 'fore', foreRoot: 'fore', hip: 'hind', hindRoot: 'hind' };
const FIN = /^(pectoral|pelvic)R$/;
const TAIL_CARVE = 0.25;   // a tail carved from the trunk takes its rear quarter (bodies that are all axis: snakes, fish)

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(...sub(a, b));
const r4 = (v) => (Math.sign(v) * Math.round(Math.abs(v) * 1e4)) / 1e4 + 0;   // symmetric, so a left bone is its right's mirror
const p4 = (p) => p.map(r4);
const mirrorName = (n) => n.replace(/R$/, 'L');

/** A part's centreline points, in its own station order. */
function centres(part, joints) {
  if (part.kind === 'segment') return [joints[part.from], joints[part.to]];
  return (part.stations || []).map((s) => {
    if (s.at) return s.at;
    const pts = Object.values(s.points);
    return mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length);
  });
}

/** Chain parts into one polyline from `anchor`: each next part joins at its nearer end. */
function chain(parts, joints, anchor) {
  const left = parts.map((p) => centres(p, joints)).filter((c) => c.length);
  const out = [];
  let end = anchor;
  while (left.length) {
    let best = 0, rev = false, bd = Infinity;
    left.forEach((c, i) => {
      const a = dist(end, c[0]), b = dist(end, c[c.length - 1]);
      if (a < bd) { bd = a; best = i; rev = false; }
      if (b < bd) { bd = b; best = i; rev = true; }
    });
    const c = left.splice(best, 1)[0];
    out.push(...(rev ? [...c].reverse() : c));
    end = out[out.length - 1];
  }
  return out;
}

const arcs = (P) => { const s = [0]; for (let i = 1; i < P.length; i++) s.push(s[i - 1] + dist(P[i - 1], P[i])); return s; };

/** The point at arc fraction f along polyline P. */
function at(P, S, f) {
  const t = f * S[S.length - 1];
  for (let i = 1; i < P.length; i++) if (t <= S[i] || i === P.length - 1) {
    const span = S[i] - S[i - 1], u = span > 0 ? Math.min(1, Math.max(0, (t - S[i - 1]) / span)) : 0;
    return add(P[i - 1], mul(sub(P[i], P[i - 1]), u));
  }
  return P[0];
}

/** n bones splitting polyline P evenly by arc length. */
function split(P, n, prefix) {
  if (n <= 0 || P.length < 2) return [];
  const S = arcs(P);
  return Array.from({ length: n }, (_, k) => ({ id: `${prefix}${k}`, head: at(P, S, k / n), tail: at(P, S, (k + 1) / n) }));
}

const segDist = (q, a, b) => { const d = sub(b, a), L2 = dot(d, d); const u = L2 > 0 ? Math.min(1, Math.max(0, dot(sub(q, a), d) / L2)) : 0; return dist(q, add(a, mul(d, u))); };

/** A species' skeleton: `{ species, rig, bones: [{ id, parent, head, tail, role? }], bind: { <part>: … } }`. */
export function faunaSkeleton(id) {
  if (!SPECIES[id]) return null;
  const family = SPECIES[id].family;
  const P = speciesParams(id), plan = speciesPlan(id), L = locomotionFor(family, id);
  const J = plan.joints, parts = plan.segments;
  const axisParts = (re) => parts.filter((p) => p.mirror !== 'name' && re.test(p.name));

  // TRUNK: chained from the neck end, then turned to run rump → front
  const neckBase = J.neckBase;
  let trunk = chain(axisParts(TRUNK), J, neckBase).reverse();
  const tailParts = axisParts(TAIL);
  let tailLine = tailParts.length ? chain(tailParts, J, trunk[0]) : [];
  let nTail = L.spine.tail;
  if (!tailParts.length && nTail > 0 && L.rig === 'axial') {
    // no tail part: carve the tail from the trunk's rear quarter
    const S = arcs(trunk), cut = at(trunk, S, TAIL_CARVE), k = S.findIndex((s) => s >= TAIL_CARVE * S[S.length - 1]);
    tailLine = [cut, ...trunk.slice(0, k).reverse()];
    trunk = [cut, ...trunk.slice(k)];
  }
  if (!tailLine.length) nTail = 0;
  // the neck: neckBase → neckTop, or, where the family lofts its neck (a camel's dip, a plesiosaur's length), along
  // those lofts from the front of the body (the camel's neckBase sits at the top of its curve)
  const neckLofts = axisParts(NECK).filter((p) => p.kind !== 'segment');
  const neckLine = L.spine.neck <= 0 ? [] : neckLofts.length ? [...chain(neckLofts, J, trunk[trunk.length - 1]), J.neckTop] : [neckBase, J.neckTop];

  const bones = [];
  const spine = split(trunk, L.spine.trunk, 'spine');
  spine.forEach((b, k) => bones.push({ ...b, parent: k ? `spine${k - 1}` : null }));
  const lastSpine = spine[spine.length - 1].id;
  const neck = split(neckLine, L.spine.neck, 'neck');
  neck.forEach((b, k) => bones.push({ ...b, parent: k ? `neck${k - 1}` : lastSpine }));
  const tail = split(tailLine, nTail, 'tail');
  tail.forEach((b, k) => bones.push({ ...b, parent: k ? `tail${k - 1}` : 'spine0' }));

  // HEAD: from neckTop, along the worn head's length, pitched as worn
  const H = plan.heads?.[0];
  const cap = H?.plan?.parts?.cranium?.caps;
  const headLen = cap ? (cap.tip[1] - cap.back[1]) * (H.plan.units?.scale || 1) : 0.25 * dist(trunk[0], trunk[trunk.length - 1]);
  const pitch = ((H?.pitch || 0) * Math.PI) / 180;
  bones.push({ id: 'head', parent: neck.length ? neck[neck.length - 1].id : lastSpine, head: J.neckTop, tail: add(J.neckTop, [0, headLen * Math.cos(pitch), headLen * Math.sin(pitch)]) });

  const axial = bones.slice();
  const nearestAxial = (q) => axial.reduce((b, c) => (segDist(q, c.head, c.tail) < segDist(q, b.head, b.tail) ? c : b));

  // LIMBS: one bone per leg row, parented by the joint chain
  const rows = (P.legs || []).filter((r) => J[r[1]] && J[r[2]]);
  const byTail = {}; for (const r of rows) byTail[r[2]] = r[0];
  const kids = {}; for (const r of rows) (kids[r[1]] ??= []).push(r);
  const depth = (j) => 1 + Math.max(0, ...(kids[j] || []).map((r) => depth(r[2])));
  const roles = {};
  for (const r of rows) {
    const side = LIMB_ROOTS[r[1]]; if (!side || byTail[r[1]]) continue;
    // the main chain: from the root, always the child with the deepest subtree (first listed on a tie)
    let k = 0, row = r;
    while (row) {
      roles[row[0]] = `${side}.${ROLES[side][Math.min(k, ROLES[side].length - 1)]}`;
      const next = (kids[row[2]] || []).reduce((b, c) => (!b || depth(c[2]) > depth(b[2]) ? c : b), null);
      row = next; k++;
    }
  }
  for (const r of rows) {
    const parent = byTail[r[1]] || nearestAxial(J[r[1]]).id;
    bones.push({ id: r[0], parent, head: J[r[1]], tail: J[r[2]], ...(roles[r[0]] ? { role: roles[r[0]] } : {}) });
  }
  // paired fins that are not leg rows: one bone, first station to last (other mirrored parts are decorations: below)
  const legNames = new Set(rows.map((r) => r[0]));
  for (const p of parts) {
    if (p.mirror !== 'name' || legNames.has(p.name) || !FIN.test(p.name)) continue;
    const c = centres(p, J); if (c.length < 2) continue;
    bones.push({ id: p.name, parent: nearestAxial(c[0]).id, head: c[0], tail: c[c.length - 1] });
  }

  // the left side
  const right = bones.filter((b) => b.id.endsWith('R') && !axial.includes(b));
  for (const b of right) {
    const flip = (q) => [-q[0], q[1], q[2]];
    bones.push({ id: mirrorName(b.id), parent: right.some((r) => r.id === b.parent) ? mirrorName(b.parent) : b.parent,
      head: flip(b.head), tail: flip(b.tail), ...(b.role ? { role: b.role } : {}) });
  }

  // BIND: limb and fin parts ride their bone; an axis part's stations each ride the nearest bone OF ITS OWN REGION
  // (the torso never rides the neck); a one-side decoration rides the limb whose tube it sits in, else the axis
  const carved = !tailParts.length && tail.length;
  const region = (name) => (TRUNK.test(name) ? [...spine, ...(carved ? tail : [])] : NECK.test(name) ? (neck.length ? neck : [spine[spine.length - 1]])
    : TAIL.test(name) ? (tail.length ? tail : [spine[0]]) : [...axial]);
  const nearestIn = (set) => (q) => set.reduce((b, c) => (segDist(q, c.head, c.tail) < segDist(q, b.head, b.tail) ? c : b)).id;
  const limbTube = rows.map((r) => {
    const part = parts.find((q) => q.name === r[0]), rad = (v) => (Array.isArray(v) ? Math.max(...v) : v || 0);
    return { id: r[0], a: J[r[1]], b: J[r[2]], r: part?.kind === 'segment' ? Math.max(rad(part.rA), rad(part.rB)) : 0.5 * dist(J[r[1]], J[r[2]]) };
  });
  const ids = new Set(bones.map((b) => b.id));
  const bind = {};
  for (const p of parts) {
    if (ids.has(p.name)) { bind[p.name] = p.name; continue; }
    const c = centres(p, J);
    if (p.mirror === 'name') {
      const mid = mul(c.reduce(add, [0, 0, 0]), 1 / c.length);
      const inside = limbTube.filter((t) => segDist(mid, t.a, t.b) <= t.r).sort((u, v) => segDist(mid, u.a, u.b) - segDist(mid, v.a, v.b))[0];
      bind[p.name] = inside ? inside.id : nearestIn(axial)(mid); continue;
    }
    const pick = nearestIn(region(p.name));
    bind[p.name] = p.kind === 'segment' ? { from: pick(J[p.from]), to: pick(J[p.to]) } : { stations: c.map(pick) };
  }

  return {
    species: id, family, rig: L.rig,
    bones: bones.map((b) => ({ id: b.id, parent: b.parent, head: p4(b.head), tail: p4(b.tail), ...(b.role ? { role: b.role } : {}) })),
    bind,
  };
}
