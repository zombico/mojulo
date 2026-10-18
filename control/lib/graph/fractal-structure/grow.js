/**
 * fractal-structure / grow — a read structure (read.js) → STACKS: each a plan ring lifted through stations
 * `{ z, s }` (a height, and the ring's radius there in units of the stack's R), turned, centred. The faces step
 * (faces.js) skins them; nothing here builds a face.
 *
 *   plinth   terraces under the body, the body's own plan widened by the margin, stepping in
 *   body     one stack a tier (bhumi): tier heights diminish geometrically up the rise; the ring's scale follows
 *            r(f) = top + (1 − top)(1 − f^p) over the height fraction f (p = 1 the cone, 2 the parabolic curve); a
 *            `stepped` rise holds each tier at its base scale, so the tier above stands back on a terrace; `twist`
 *            turns each tier past the one below (the turning square)
 *   band     the cornice that caps each tier but the last, proud of the wall by `depth` of the width
 *   crown    on the top ring: a neck, a ribbed oblate disc (a star of `ribs` points) and a finial; or a dome; or a finial
 *   echo     the whole structure again at `scale` of the body's width where it stands, at `around` directions
 *            (faces, corners or both), `rings` rows up `reach` of the body, sunk `sink` of its width into the flank,
 *            each copy growing its own echoes, to `depth`: the self-similarity. A copy's tiers thin with its level.
 *
 * The face budget trims the echo's depth (the deepest copies go first), never the main body, and says so.
 */
import { planRing, radiusAt, ringConvex } from './plan.js';

export const MAX_FACES = 24000;
const DEG = Math.PI / 180;

const crownRing = (ribs) => planRing({ form: 'star', points: ribs, inner: 0.86 });
const finialRing = () => planRing({ form: 'circle', sides: 12 });

/** The rise's tier breaks as height fractions [0 … 1]: tier i weighs diminish^i. */
export function tierBreaks(tiers, diminish) {
  const w = Array.from({ length: tiers }, (_, i) => diminish ** i);
  const sum = w.reduce((a, b) => a + b, 0);
  const out = [0];
  let acc = 0;
  for (const x of w) { acc += x; out.push(acc / sum); }
  out[tiers] = 1;
  return out;
}

/** The ring's scale at height fraction f. */
export const riseScale = (rise, f) => rise.top + (1 - rise.top) * (1 - Math.min(1, Math.max(0, f)) ** rise.power);

/** A plan one echo level coarser: an offset's middle bays cut once less and to three, a star's points halved. */
export function coarserPlan(plan) {
  switch (plan.form) {
    case 'offset': return plan.depth > 1 ? { ...plan, depth: plan.depth - 1 } : plan.bays > 3 ? { ...plan, bays: 3 } : { form: 'square' };
    case 'turned': return plan.k > 1 ? { ...plan, k: Math.max(1, plan.k >> 1) } : plan;
    case 'circle': return { ...plan, sides: Math.max(8, plan.sides >> 1) };
    case 'star': return { ...plan, points: Math.max(4, plan.points >> 1) };
    case 'stepped-circle': return { ...plan, steps: Math.max(1, plan.steps >> 1) };
    default: return plan;
  }
}

/** A copy's words at echo level `lv`: its tiers thin and its plan coarsens, so a copy of a copy is not as fine as the tower it echoes. */
function atLevel(S, lv) {
  if (lv === 0) return S;
  let plan = S.plan;
  for (let k = 0; k < lv; k += 1) plan = coarserPlan(plan);
  const tiers = Math.max(2, Math.round(S.rise.tiers * 0.6 ** lv));
  // two levels down a copy is a few metres of detail: its tiers stay, its cornices and its disc go to a plain finial
  if (lv >= 2) return { ...S, plan, rise: { ...S.rise, tiers, cornice: false }, crown: S.crown.form === 'none' ? S.crown : { ...S.crown, form: 'finial' } };
  return { ...S, plan, rise: { ...S.rise, tiers } };
}

const stack = (ring, c, R, turn, role, level, stations, caps, tier) => ({ ring, c, R, turn, role, level, stations, caps, ...(tier !== undefined ? { tier } : {}) });

// A crown on a top ring of radius `rc` (world units) whose base is at z: stacks of R = 1, their stations in world units.
function crownStacks(S, c, z, rc, turn, level) {
  const { form, size } = S.crown;
  if (form === 'none') return [];
  const a = rc * size, out = [];
  const finial = (z0, k) => {
    const f = a * k;
    out.push(stack(finialRing(), c, 1, turn, 'crown', level,
      [[z0, 0.3], [z0 + 0.22 * f, 0.42], [z0 + 0.42 * f, 0.24], [z0 + 0.6 * f, 0.12], [z0 + 1.05 * f, 0.02]].map(([zz, s]) => ({ z: zz, s: s * f })),
      { top: true, bottom: false }));
  };
  if (form === 'finial') { finial(z, 0.9); return out; }
  if (form === 'dome') {
    const st = [];
    for (let i = 0; i <= 6; i += 1) { const t = (i / 6) * 80 * DEG; st.push({ z: z + a * Math.sin(t), s: a * Math.cos(t) }); }
    out.push(stack(finialRing(), c, 1, turn, 'crown', level, st, { top: true, bottom: false }));
    finial(z + a * Math.sin(80 * DEG), 0.5);
    return out;
  }
  // the disc (amalaka): a neck, then an oblate ribbed disc, its ribs fractions of the circle
  const ribs = level ? Math.max(8, Math.round(S.crown.ribs / 2 ** level)) : S.crown.ribs;
  const neckTop = z + 0.18 * a, b = 0.36 * a, lim = 72 * DEG, zc = neckTop + b * Math.sin(lim);
  out.push(stack(crownRing(ribs), c, 1, turn, 'band', level, [{ z, s: 0.66 * a }, { z: neckTop, s: 0.58 * a }], { top: false, bottom: false }));
  const st = [];
  for (let i = 0; i <= 6; i += 1) { const t = -lim + (i / 6) * 2 * lim; st.push({ z: zc + b * Math.sin(t), s: a * Math.cos(t) }); }
  out.push(stack(crownRing(ribs), c, 1, turn, 'crown', level, st, { top: true, bottom: true }));
  finial(zc + b * Math.sin(lim), 0.55);
  return out;
}

/**
 * Where a structure at `frame` stands its copies: [{ c: [x, y, z], R, H, turn }]. The rows sit at the bottoms of the
 * tiers that hold the heights reach · j / (rings − 1); a copy's centre is `sink` of its width into the flank there.
 */
export function echoFrames(S, frame, bodyZ) {
  if (!S.echo) return [];
  const { c, R, H, turn } = frame;
  const ring = planRing(S.plan);
  const { tiers, twist } = S.rise;
  const F = tierBreaks(tiers, S.rise.diminish);
  const { scale, where, around, rings, reach, sink } = S.echo;
  const out = [], rows = new Set();
  for (let j = 0; j < rings; j += 1) {
    const f = rings === 1 ? 0 : (reach * j) / (rings - 1);
    let t = 0;
    while (t < tiers - 1 && F[t + 1] <= f + 1e-9) t += 1;
    if (rows.has(t)) continue;
    rows.add(t);
    const tTurn = turn + t * twist * DEG, s0 = riseScale(S.rise, F[t]), z0 = bodyZ + F[t] * H;
    for (const [w, k] of where === 'both' ? [['faces', 1], ['corners', 0.72]] : [[where, 1]]) {
      for (let q = 0; q < around; q += 1) {
        const ang = tTurn + (q * 2 * Math.PI) / around + (w === 'corners' ? Math.PI / around : 0);
        const mr = scale * k * s0 * R;
        const d = radiusAt(ring, ang - tTurn) * s0 * R + mr * (1 - 2 * sink);
        out.push({ c: [c[0] + d * Math.cos(ang), c[1] + d * Math.sin(ang), z0], R: mr, H: H * (mr / R), turn: ang });
      }
    }
  }
  return out;
}

// One structure (or copy) at `frame`, then its copies to maxDepth.
function growAt(root, frame, level, maxDepth, out, colliders) {
  const S = atLevel(root, level);
  const { c, R, H, turn } = frame;
  const ring = planRing(S.plan);
  let z = c[2];
  if (S.plinth && level === 0) {
    const { steps, height, margin } = S.plinth, h = (height * 2 * R) / steps;
    for (let k = 0; k < steps; k += 1) {
      const s = 1 + margin * ((steps - k) / steps);
      out.push(stack(ring, c, R, turn, 'plinth', level, [{ z, s }, { z: z + h, s }], { top: true, bottom: false }));
      colliders.push({ ring, c, R, turn, s, z0: z, z1: z + h, role: 'plinth' });
      z += h;
    }
  }
  const { tiers, stepped, twist, cornice } = S.rise;
  const F = tierBreaks(tiers, S.rise.diminish);
  for (let i = 0; i < tiers; i += 1) {
    const z0 = z + F[i] * H, z1 = z + F[i + 1] * H, band = z1 - z0;
    const tTurn = turn + i * twist * DEG;
    const s0 = riseScale(S.rise, F[i]);
    const s1 = stepped ? s0 : riseScale(S.rise, F[i + 1]);
    const hc = cornice && i < tiers - 1 ? Math.min(cornice.height * band, band * 0.6) : 0;
    // a tier's own top shows only where no cornice covers it (the cornice's caps are the ledge and its underside)
    out.push(stack(ring, c, R, tTurn, 'body', level, [{ z: z0, s: s0 }, { z: z1 - hc, s: s1 }], { top: hc === 0, bottom: level > 0 && i === 0 }, i));
    if (level === 0) colliders.push({ ring, c, R, turn: tTurn, s: Math.max(s0, s1), z0, z1, role: 'body' });
    if (hc > 0) {
      const sc = s1 + cornice.depth * 2;
      out.push(stack(ring, c, R, tTurn, 'band', level, [{ z: z1 - hc, s: sc }, { z: z1, s: sc }], { top: true, bottom: true }, i));
    }
  }
  out.push(...crownStacks(S, c, z + H, riseScale(S.rise, 1) * R, turn + (tiers - 1) * twist * DEG, level));
  if (level >= maxDepth) return;
  for (const f of echoFrames(S, frame, z)) growAt(root, f, level + 1, maxDepth, out, colliders);
}

/** Faces a stack will make: a side for each ring edge between stations; a cap is one polygon, or a fan when the ring is not convex. */
export function stackFaces(st) {
  const n = st.ring.length, cap = ringConvex(st.ring) ? 1 : n;
  return n * (st.stations.length - 1) + (st.caps.top ? cap : 0) + (st.caps.bottom ? cap : 0);
}

/**
 * growStructure(S, { maxFaces }) → { stacks, colliders, depth, asked, trimmed, faces }. The echo's depth is cut back
 * until the faces fit; the main body is always whole.
 */
export function growStructure(S, { maxFaces = MAX_FACES } = {}) {
  const asked = S.echo ? S.echo.depth : 0;
  const frame = { c: S.at, R: S.size / 2, H: S.height, turn: S.turn * DEG };
  for (let depth = asked; ; depth -= 1) {
    const stacks = [], colliders = [];
    growAt(S, frame, 0, depth, stacks, colliders);
    const faces = stacks.reduce((n, st) => n + stackFaces(st), 0);
    if (faces <= maxFaces || depth === 0) return { stacks, colliders, depth, asked, trimmed: depth < asked, faces };
  }
}
