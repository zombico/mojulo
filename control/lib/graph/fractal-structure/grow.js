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
 *            `top` stands one copy on the crown instead of its finial (a lantern).
 *   colonnade  ANOTHER structure's words (a column, by default) stood round the plan's perimeter, spaced by arc
 *            length, or on a grid; an entablature ring at their capitals, spanning to the wall for a `roof`; a body
 *            that `carry`s stands on them. A structure made of structures.
 *   hollow   the body a wall round open ground: the inner edge at height f is inner + rake · f, each tier an annulus
 *
 * The face budget trims the echo's depth (the deepest copies go first), never the main body, and says so.
 */
import { planRing, radiusAt, ringConvex } from './plan.js';
import { readStructure } from './read.js';

export const MAX_FACES = 24000;
const DEG = Math.PI / 180;

// the crown's own rings, stretched with the structure (an oval body wears an oval crown)
const crownRing = (S, ribs) => stretchRing({ form: 'star', points: ribs, inner: 0.86 }, S.stretch);
const finialRing = (S) => stretchRing({ form: 'circle', sides: 12 }, S.stretch);

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
  // two levels down a copy is a few metres of detail: its tiers stay; its cornices, its columns and its disc go
  if (lv >= 2) return { ...S, plan, colonnade: false, rise: { ...S.rise, tiers, cornice: false }, crown: S.crown.form === 'none' ? S.crown : { ...S.crown, form: 'finial' } };
  return { ...S, plan, rise: { ...S.rise, tiers } };
}

const stretched = new Map();
/** A plan ring stretched per axis (memoised, so a ring keeps one identity for the convexity memo). */
function stretchRing(plan, stretch) {
  const base = planRing(plan), [sx, sy] = stretch || [1, 1];
  if (sx === 1 && sy === 1) return base;
  const key = `${JSON.stringify(plan)}|${sx}|${sy}`;
  if (!stretched.has(key)) stretched.set(key, Object.freeze(base.map(([x, y]) => Object.freeze([x * sx, y * sy]))));
  return stretched.get(key);
}
/** The structure's plan ring, stretched. */
export const ringOf = (S) => stretchRing(S.plan, S.stretch);

// a stack: `ring` lifted through `stations` ({ z, s }), turned, centred; `inner` (a scale per station) makes it an annulus
const stack = (S, o) => ({ pal: S.palette, ...o });

// A crown on a top ring of radius `rc` (world units) whose base is at z → { stacks, top }: stacks of R = 1, their stations
// in world units; `top` the crown's highest surface but its finial, where a lantern stands (`finial: false` then).
function crownStacks(S, c, z, rc, turn, level, { finial: withFinial = true } = {}) {
  const { form, size } = S.crown;
  if (form === 'none') return { stacks: [], top: z };
  const a = rc * size, out = [];
  const piece = (ring, role, stations, caps) => out.push(stack(S, { ring, c, R: 1, turn, role, level, stations, caps }));
  const finial = (z0, k) => {
    if (!withFinial) return;
    const f = a * k;
    piece(finialRing(S), 'crown', [[z0, 0.3], [z0 + 0.22 * f, 0.42], [z0 + 0.42 * f, 0.24], [z0 + 0.6 * f, 0.12], [z0 + 1.05 * f, 0.02]].map(([zz, s]) => ({ z: zz, s: s * f })), { top: true, bottom: false });
  };
  if (form === 'finial') { finial(z, 0.9); return { stacks: out, top: z }; }
  if (form === 'slab') {
    // an abacus: a square block flaring from the shaft (the plan's corners sit on the unit circle, so `a` reaches them)
    piece(stretchRing('square', S.stretch), 'crown', [{ z, s: 0.78 * a }, { z: z + 0.2 * a, s: a }, { z: z + 0.42 * a, s: a }], { top: true, bottom: true });
    return { stacks: out, top: z + 0.42 * a };
  }
  if (form === 'dome') {
    const st = [];
    for (let i = 0; i <= 6; i += 1) { const t = (i / 6) * 80 * DEG; st.push({ z: z + a * Math.sin(t), s: a * Math.cos(t) }); }
    piece(finialRing(S), 'crown', st, { top: true, bottom: false });
    finial(z + a * Math.sin(80 * DEG), 0.5);
    return { stacks: out, top: z + a * Math.sin(80 * DEG) };
  }
  // the disc (amalaka): a neck, then an oblate ribbed disc, its ribs fractions of the circle
  const ribs = level ? Math.max(8, Math.round(S.crown.ribs / 2 ** level)) : S.crown.ribs;
  const neckTop = z + 0.18 * a, b = 0.36 * a, lim = 72 * DEG, zc = neckTop + b * Math.sin(lim);
  piece(crownRing(S, ribs), 'band', [{ z, s: 0.66 * a }, { z: neckTop, s: 0.58 * a }], { top: false, bottom: false });
  const st = [];
  for (let i = 0; i <= 6; i += 1) { const t = -lim + (i / 6) * 2 * lim; st.push({ z: zc + b * Math.sin(t), s: a * Math.cos(t) }); }
  piece(crownRing(S, ribs), 'crown', st, { top: true, bottom: true });
  finial(zc + b * Math.sin(lim), 0.55);
  return { stacks: out, top: zc + b * Math.sin(lim) };
}

/**
 * Where a structure at `frame` stands its copies against its flanks: [{ c: [x, y, z], R, H, turn }]. The rows sit at
 * the bottoms of the tiers that hold the heights reach · j / (rings − 1); a copy's centre is `sink` of its width into
 * the flank there. (A `top` echo stands on the crown: growAt places it.)
 */
export function echoFrames(S, frame, bodyZ) {
  if (!S.echo || S.echo.where === 'top') return [];
  const { c, R, H, turn } = frame;
  const ring = ringOf(S);
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

/** `count` points round a ring, evenly spaced by arc length from its first vertex (a square's corners each get one when count is a multiple of 4). */
export function perimeterPoints(ring, count) {
  const L = ring.map((p, i) => { const q = ring[(i + 1) % ring.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
  const total = L.reduce((a, b) => a + b, 0), out = [];
  let i = 0, acc = 0;
  for (let k = 0; k < count; k += 1) {
    const t = (k * total) / count;
    while (i < ring.length - 1 && acc + L[i] < t - 1e-12) { acc += L[i]; i += 1; }
    const u = L[i] > 0 ? (t - acc) / L[i] : 0, p = ring[i], q = ring[(i + 1) % ring.length];
    out.push([p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])]);
  }
  return out;
}

/** Where a colonnade's columns stand, in the plan's own frame (units of R, before the turn). */
export function colonnadePoints(col, ring) {
  if (col.layout === 'ring') return perimeterPoints(ring, col.count).map(([x, y]) => [x * col.radius, y * col.radius]);
  const [nx, ny] = col.count, hx = col.span * radiusAt(ring, 0), hy = col.span * radiusAt(ring, Math.PI / 2);
  const at = (i, n, h) => (n === 1 ? 0 : -h + (2 * h * i) / (n - 1));
  const out = [];
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) out.push([at(i, nx, hx), at(j, ny, hy)]);
  return out;
}

// The colonnade at base z: its columns (each another structure, grown whole) and, on a ring, the entablature at their
// capitals. Returns the height a body that `carry`s stands at.
function growColonnade(S, frame, z, level, out, colliders, wallAt) {
  const col = S.colonnade, { c, R, turn } = frame, ring = ringOf(S);
  const D = 2 * col.width * R, Hc = col.height * 2 * R;   // the column's diameter and the colonnade's height, world units
  const words = { ...col.of, size: D, turn: turn / DEG };
  // a column's plinth and capital scale with its width, not its height: measure one, then size the shaft to fit
  const probe = (h) => {
    const st = [];
    growAt(readStructure({ ...words, at: [0, 0, 0], height: h }, 'colonnade.of'), { c: [0, 0, 0], R: D / 2, H: h, turn: 0 }, 0, 0, st, []);
    return Math.max(...st.flatMap((x) => x.stations.map((q) => q.z)));
  };
  const shaft = Math.max(0.05 * Hc, Hc - (probe(Hc) - Hc));
  const cs = Math.cos(turn), sn = Math.sin(turn);
  for (const [px, py] of colonnadePoints(col, ring)) {
    const at = [c[0] + R * (cs * px - sn * py), c[1] + R * (sn * px + cs * py), z];
    const C = readStructure({ ...words, at, height: shaft }, 'colonnade.of');
    const own = [];
    growAt(C, { c: at, R: D / 2, H: shaft, turn }, 0, C.echo ? C.echo.depth : 0, own, level === 0 ? colliders : []);
    for (const st of own) out.push({ ...st, level: Math.max(st.level, level) });
  }
  const top = z + Hc;
  if (col.layout !== 'ring' || !col.beam) return top;
  // the entablature: a ring beam on the capitals, or with a `roof` a deck from the columns to the nearest wall
  const w = col.width * 1.2, eh = Math.max(0.7 * D, 0.05 * Hc);
  let inner = col.radius - w, outer = col.radius + w;
  if (col.roof) {
    const { edge, outside } = wallAt(top);
    if (outside) inner = Math.min(inner, edge - 0.01); else outer = Math.max(outer, edge + 0.01);
  }
  inner = Math.max(0.01, inner);
  out.push(stack(S, { ring, c, R, turn, role: 'band', level, stations: [{ z: top, s: outer }, { z: top + eh, s: outer }], inner: [inner, inner], caps: { top: true, bottom: true } }));
  if (level === 0) colliders.push({ ring, c, R, turn, s: outer, inner, z0: top, z1: top + eh, role: 'entablature' });
  return top + eh;
}

// One structure (or copy) at `frame`, then its copies to maxDepth.
function growAt(root, frame, level, maxDepth, out, colliders) {
  const S = atLevel(root, level);
  const { c, R, H, turn } = frame;
  const ring = ringOf(S);
  const col = S.colonnade;
  const { tiers, stepped, twist, cornice } = S.rise;
  const F = tierBreaks(tiers, S.rise.diminish);
  const hollowAt = (f, s) => (S.hollow ? Math.max(0.02, Math.min(s - 0.03, S.hollow.inner + S.hollow.rake * f)) : null);
  let z = c[2];
  if (S.plinth && level === 0) {
    // under a ring of columns standing outside the body, the plinth widens to carry them
    const base = col && col.layout === 'ring' && !col.carry && col.radius >= 0.98 ? Math.max(1, col.radius + col.width * 1.6 + 0.02) : 1;
    const { steps, height, margin } = S.plinth, h = (height * 2 * R) / steps;
    for (let k = 0; k < steps; k += 1) {
      const s = base + margin * ((steps - k) / steps);
      out.push(stack(S, { ring, c, R, turn, role: 'plinth', level, stations: [{ z, s }, { z: z + h, s }], caps: { top: true, bottom: false } }));
      colliders.push({ ring, c, R, turn, s, z0: z, z1: z + h, role: 'plinth' });
      z += h;
    }
  }
  let bodyZ = z;
  if (col) {
    const ground = z;
    // the wall a roof spans to at height zz: the body's face outside the columns, or the open ground's edge inside them
    const wallAt = (zz) => {
      const f = col.carry ? 0 : Math.min(1, Math.max(0, (zz - ground) / H)), s = riseScale(S.rise, f), ri = hollowAt(f, s);
      return ri !== null && col.radius < ri ? { edge: ri, outside: false } : { edge: s, outside: col.radius >= s };
    };
    const top = growColonnade(S, frame, z, level, out, colliders, wallAt);
    if (col.carry) bodyZ = top;
  }
  for (let i = 0; i < tiers; i += 1) {
    const z0 = bodyZ + F[i] * H, z1 = bodyZ + F[i + 1] * H, band = z1 - z0;
    const tTurn = turn + i * twist * DEG;
    const s0 = riseScale(S.rise, F[i]);
    const s1 = stepped ? s0 : riseScale(S.rise, F[i + 1]);
    const r0 = hollowAt(F[i], s0), r1 = S.hollow ? (stepped ? r0 : hollowAt(F[i + 1], s1)) : null;
    const hc = cornice && i < tiers - 1 ? Math.min(cornice.height * band, band * 0.6) : 0;
    const inner = S.hollow ? { inner: [r0, r1] } : {};
    // a tier's own top shows only where no cornice covers it (the cornice's caps are the ledge and its underside)
    out.push(stack(S, { ring, c, R, turn: tTurn, role: 'body', level, tier: i, stations: [{ z: z0, s: s0 }, { z: z1 - hc, s: s1 }], ...inner, caps: { top: hc === 0, bottom: level > 0 && i === 0 } }));
    if (level === 0) colliders.push({ ring, c, R, turn: tTurn, s: Math.max(s0, s1), ...(S.hollow ? { inner: Math.min(r0, r1) } : {}), z0, z1, role: 'body' });
    if (hc > 0) {
      const sc = s1 + cornice.depth * 2;
      const bandInner = S.hollow ? { inner: [Math.max(0.01, r1 - cornice.depth * 2), Math.max(0.01, r1 - cornice.depth * 2)] } : {};
      out.push(stack(S, { ring, c, R, turn: tTurn, role: 'band', level, tier: i, stations: [{ z: z1 - hc, s: sc }, { z: z1, s: sc }], ...bandInner, caps: { top: true, bottom: true } }));
    }
  }
  const lantern = S.echo && S.echo.where === 'top' && level < maxDepth;
  const crown = crownStacks(S, c, bodyZ + H, riseScale(S.rise, 1) * R, turn + (tiers - 1) * twist * DEG, level, { finial: !lantern });
  out.push(...crown.stacks);
  if (level >= maxDepth) return;
  if (lantern) growAt(root, { c: [c[0], c[1], crown.top], R: S.echo.scale * R, H: H * S.echo.scale, turn }, level + 1, maxDepth, out, colliders);
  for (const f of echoFrames(S, frame, bodyZ)) growAt(root, f, level + 1, maxDepth, out, colliders);
}

/** Faces a stack will make: a side for each ring edge between stations (twice for an annulus); a cap is one polygon, a fan when the ring is not convex, or a ring of quads on an annulus. */
export function stackFaces(st) {
  const n = st.ring.length, cap = st.inner ? n : ringConvex(st.ring) ? 1 : n;
  return n * (st.stations.length - 1) * (st.inner ? 2 : 1) + (st.caps.top ? cap : 0) + (st.caps.bottom ? cap : 0);
}

/**
 * growStructure(S, { maxFaces }) → { stacks, colliders, depth, asked, trimmed, faces }. The echo's depth is cut back
 * until the faces fit; the main body (its columns included) is always whole.
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
