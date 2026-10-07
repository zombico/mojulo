/**
 * slicing interceptors — what the cut looks like while it happens, before anything parts. Scapeshift's interceptor
 * contract: grown after the thing is made, never colliding, never named, only seen; each kind a SITE finder, a GROWER
 * and an aggressiveness from 0 (none) to 1, seeded, on its own group. Here the sites are the cleave's own: every cut
 * PLANE, and the SCORE, where that plane meets the item's skin.
 *
 * The cut is a STYLE, a setting like a tone: it picks the timing, which marks grow and how they look, and how the
 * pieces part. Everything is values (white is 1) on an `fx:<mark>` group, so colour is the tone's, later (a laser
 * red, an anime slash cyan, the same recipe):
 *
 *   blade   stroke by stroke (a grid's `#` drawn plane by plane; a shatter cracked out from the impact): the score,
 *           a band sweeping each plane, sparks where it passes, the faces glinting, dust in the gaps; a radial spread
 *   laser   one slow beam at a time from an emitter off the item's face: the score glows and COOLS behind it, sparks
 *           spray along the beam, thin smoke rises; the pieces barely part
 *   anime   the slash first (a crescent across each plane, all in a breath), then the BEAT (nothing moves), then every
 *           score at once with a FLASH; the halves SLIP along their cut
 *   impact  a RING from the hit and a flash, cracks out from it fast, chips and a dust burst; the pieces BURST from it
 *
 * Marks: score, blade (band | crescent), beam, spark, glint, dust, ring, flash. A style's numbers can be overridden
 * per mark (`marks: { spark: { rate: 20 } }`); each mark's dial (`spark: 0.5`, or `intensity`) scales how much of it.
 *
 * The STROKES and `cutAt` (when the cut is done): collapse({ delay: cutAt, spread: result.spread, origin }) keeps the
 * chunks whole until then and parts them the style's way. They are also the COVER-UP: every engine shows destruction
 * by swapping a whole mesh for its pre-cut chunks, and the marks hide that swap; an engine that cannot play them drops
 * them and the swap still works.
 *
 * SOUND: each style names a cue per mark (`sounds`); the result carries `sounds`, the cue timeline (sounds.js), and
 * the call can rename, re-gain or silence any mark's cue (`sounds: { beam: 'my-laser', spark: false }`).
 *
 *   slicing(cut, item, { style?, intensity?, <mark>?, marks?, origin?, seed?, sounds?, gain? })
 *     → { style, cutAt, seconds, strokes, elements, spread, origin, sounds }
 */
import { V } from './polytope.js';
import { itemOf } from './cleave.js';
import { cutSounds } from './sounds.js';

export const SLICE_KINDS = Object.freeze(['score', 'blade', 'beam', 'spark', 'glint', 'dust', 'ring', 'flash']);
const CAP = { score: 600, spark: 220, glint: 400, dust: 60 };

/** The cut styles. `timing`: stroke (plane by plane) | crack (out from the impact) | sweep (one beam after another) | beat. */
export const CUT_STYLES = Object.freeze({
  blade: {
    about: 'a clean cut: the score, a band sweeping each plane, sparks, glinting faces, dust in the gaps',
    timing: { grid: 'stroke', other: 'crack' }, sweep: 0.16, stagger: 0.07, speed: 14,
    marks: { score: { cool: 0.12 }, blade: { shape: 'band', width: 0.05 }, spark: { rate: 6, spray: 'out', life: [0.25, 0.55] }, glint: { life: 0.18, peak: 0.6 }, dust: { value: 0.78, size: 0.16, rise: 0.25, life: 0.7 } },
    part: { mode: 'radial', scale: 0.18 },
    sounds: { blade: 'swish', score: 'slice', spark: 'chip', dust: 'settle' },
  },
  laser: {
    about: 'a beam drawn slowly along each cut from off the face; the score glows and cools, sparks spray, smoke rises',
    timing: { grid: 'sweep', other: 'sweep' }, rate: 2.2, gap: 0.12,
    marks: { score: { cool: 1.4 }, beam: { width: 0.012, standoff: 1.6 }, spark: { rate: 18, spray: 'along', life: [0.15, 0.4] }, glint: { life: 1.2, peak: 0.55 }, dust: { value: 0.62, size: 0.08, rise: 0.9, life: 1.4 } },
    part: { mode: 'radial', scale: 0.04, seconds: 0.4 },
    sounds: { beam: 'laser-hum', score: 'sizzle', spark: 'sizzle', dust: 'settle' },
  },
  anime: {
    about: 'the slash first, then the beat, then every score at once with a flash; the halves slip along the cut',
    timing: { grid: 'beat', other: 'beat' }, slash: 0.07, stagger: 0.05, beat: 0.42,
    marks: { blade: { shape: 'crescent', width: 0.09 }, flash: { life: 0.07 }, score: { cool: 0.25, grow: 0.03 }, glint: { life: 0.22, peak: 0.7 }, spark: { rate: 2, spray: 'out', life: [0.2, 0.4] } },
    part: { mode: 'slip', slip: 0.14, seconds: 0.35, jitter: 0, twist: 0 },
    sounds: { blade: 'swish', flash: 'shing', score: 'slice' },
  },
  impact: {
    about: 'a ring from the hit and a flash, cracks running out fast, chips and a dust burst; the pieces burst from it',
    timing: { grid: 'crack', other: 'crack' }, speed: 22,
    marks: { ring: { life: 0.28, reach: 0.9 }, flash: { life: 0.05 }, score: { cool: 0.08 }, spark: { rate: 9, spray: 'burst', life: [0.3, 0.7] }, glint: { life: 0.12, peak: 0.5 }, dust: { value: 0.7, size: 0.22, rise: 0.15, life: 0.9, at: 'impact' } },
    part: { mode: 'burst', scale: 0.12, seconds: 0.18 },
    sounds: { ring: 'boom', flash: 'crack', score: 'crack', spark: 'chip', dust: 'settle' },
  },
});
export const CUT_STYLE_IDS = Object.freeze(Object.keys(CUT_STYLES));

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fair = (list, cap) => (list.length <= cap ? list : Array.from({ length: cap }, (_, i) => list[Math.floor(((i + 0.5) * list.length) / cap)]));
const mid = (ss) => V.mul(ss.reduce((a, s) => V.add(a, s.m), [0, 0, 0]), 1 / ss.length);

// where a point sits against a box: inside (every |local| under its half size) and on its skin (one at its half size)
function against(b, p, eps = 1e-4) {
  const d = V.sub(p, b.c), o = [b.A, b.B, b.C].map((a, k) => Math.abs(V.dot(d, V.unit(a))) - b.h[k]);
  return { within: o.every((x) => x <= eps), deep: o.every((x) => x < -eps), on: o.every((x) => x <= eps) && o.some((x) => x > -eps) };
}

/** The score: each cut face's edges that lie on the skin of a block and inside no other, once per plane. */
function scoreSegments(chunks, blocks) {
  const seen = new Set(), out = [];
  for (const c of chunks) for (const f of c.faces) {
    if (!f.cut || !f.plane) continue;
    const pts = f.corners;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], m = V.mul(V.add(a, b), 0.5);
      if (V.len(V.sub(b, a)) < 1e-4) continue;
      const key = [a, b].map((p) => p.map((x) => Math.round(x * 1e3)).join(',')).sort().join('|');
      if (seen.has(key)) continue;
      const rel = blocks.map((B) => against(B, m));
      if (!rel.some((r) => r.on) || rel.some((r) => r.deep)) continue;   // on the skin, not buried in another block
      seen.add(key);
      out.push({ plane: f.plane, a, b, m, n: f.normal });
    }
  }
  return out;
}

const planeOrder = (id) => id.slice(1).split('.').map(Number);

export function slicing(cut, item, { style = 'blade', intensity = 1, marks = {}, origin, seed = 1, sounds = {}, gain = 1, ...rest } = {}) {
  const S0 = CUT_STYLES[style];
  if (!S0) throw new Error(`slicing: style must be one of ${CUT_STYLE_IDS.join(', ')}`);
  const S = { ...S0, ...Object.fromEntries(['sweep', 'stagger', 'speed', 'rate', 'gap', 'slash', 'beat'].filter((k) => rest[k] !== undefined).map((k) => [k, rest[k]])) };
  const M = Object.fromEntries(SLICE_KINDS.map((k) => [k, S.marks[k] ? { ...S.marks[k], ...(marks[k] || {}) } : null]));
  const A = Object.fromEntries(SLICE_KINDS.map((k) => [k, M[k] ? (rest[k] ?? intensity) : 0]));
  for (const k of SLICE_KINDS) if (!(A[k] >= 0 && A[k] <= 1)) throw new Error(`slicing: ${k} is a number from 0 (none) to 1 (all of it)`);
  const { blocks, frame } = item.blocks ? item : itemOf(item), rnd = mulberry32(seed >>> 0);
  const segs = scoreSegments(cut.chunks, blocks);
  const all = cut.chunks.flatMap((c) => c.faces.flatMap((f) => f.corners)), centre = V.mul(all.reduce(V.add, [0, 0, 0]), 1 / Math.max(1, all.length));
  // the impact, brought onto the item along its thinnest axis: a crack runs across a door, not through it
  const axes = [V.unit(frame.U), V.unit(V.cross([0, 0, 1], frame.U)), [0, 0, 1]];
  const thin = axes.map((e) => Math.max(...all.map((p) => V.dot(p, e))) - Math.min(...all.map((p) => V.dot(p, e)))).reduce((bi, x, i, xs) => (x < xs[bi] ? i : bi), 0);
  const at = origin ? V.sub(origin, V.mul(axes[thin], V.dot(V.sub(origin, centre), axes[thin]))) : centre;
  const size = Math.max(...[0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])) - Math.min(...all.map((p) => p[k])))) || 1;
  const timing = S.timing[cut.pattern === 'grid' ? 'grid' : 'other'];

  // the strokes: one per plane, each with a time, a sweep direction in the plane and its span along it
  const planes = new Map();
  for (const s of segs) { if (!planes.has(s.plane)) planes.set(s.plane, []); planes.get(s.plane).push(s); }
  const U = V.unit(frame.U), Zup = [0, 0, 1], ids = [...planes.keys()];
  const near = (id) => Math.min(...planes.get(id).map((x) => V.len(V.sub(x.m, at))));
  const order = timing === 'crack' ? ids.sort((p, q) => near(p) - near(q))
    : ids.sort((p, q) => { const a = planeOrder(p), b = planeOrder(q); return a[0] - b[0] || (a[1] || 0) - (b[1] || 0); });
  let clock = 0;
  const strokes = order.map((id, i) => {
    const ss = planes.get(id), n = V.unit(ss[0].n);
    let dir;
    if (cut.pattern === 'grid' && timing !== 'crack') dir = Number(id.slice(1).split('.')[0]) === 2 ? U : V.mul(Zup, -1);   // a level plane across, the others down
    else {
      const o0 = timing === 'crack' ? V.sub(mid(ss), at) : V.cross(n, axes[thin]);   // a crack runs outward; a slash or a beam along the face
      const o = V.sub(o0, V.mul(axes[thin], V.dot(o0, axes[thin]))), out = V.sub(o, V.mul(n, V.dot(o, n)));
      dir = V.len(out) > 1e-6 ? V.unit(out) : V.unit(V.cross(n, Zup));
    }
    const prog = ss.map((s) => V.dot(s.m, dir)), lo = Math.min(...prog), hi = Math.max(...prog);
    let birth, sweep;
    if (timing === 'stroke') { birth = i * S.stagger; sweep = S.sweep; }
    else if (timing === 'crack') { birth = near(id) / S.speed; sweep = Math.max(0.04, (hi - lo) / S.speed); }
    else if (timing === 'sweep') { birth = clock; sweep = Math.max(0.3, (hi - lo) / S.rate); clock = birth + sweep + S.gap; }
    else { birth = i * S.stagger; sweep = S.slash; }
    return { plane: id, birth: r5(birth), sweep: r5(sweep), dir: P(dir), span: [r5(lo), r5(hi)], n, depth: V.dot(ss[0].m, n) };
  });
  const when = new Map(strokes.map((s) => [s.plane, s]));
  const slashed = strokes.length ? Math.max(...strokes.map((s) => s.birth + s.sweep)) : 0;
  const reveal = timing === 'beat' ? slashed + S.beat : null;   // anime: nothing shows on the item until the beat is over
  const passAt = (plane, p) => {
    const s = when.get(plane), u = s.span[1] > s.span[0] ? (V.dot(p, s.dir) - s.span[0]) / (s.span[1] - s.span[0]) : 0;
    const k = Math.min(1, Math.max(0, u));
    return r5(reveal != null ? reveal + k * (M.score?.grow ?? 0.03) : s.birth + k * s.sweep);
  };
  const cutAt = r5(reveal != null ? reveal + (M.score?.grow ?? 0.03) : slashed);
  const el = [];

  if (A.flash > 0) el.push({ kind: 'flash', group: 'fx:flash', value: 1, amount: r5(A.flash), birth: r5(reveal ?? 0), life: M.flash.life });
  if (A.ring > 0) el.push({ kind: 'ring', group: 'fx:ring', value: 1, at: P(at), normal: P(axes[thin]), birth: 0, life: M.ring.life, radius: [0, r5(size * M.ring.reach)], width: r5(size * 0.03 * (0.5 + A.ring)) });

  // score: each segment drawn from the end the cut reaches first to the last, white, glowing `cool` seconds after
  if (A.score > 0) for (const s of fair(segs, Math.round(CAP.score * A.score))) {
    const ta = passAt(s.plane, s.a), tb = passAt(s.plane, s.b), [p, q, t0, t1] = ta <= tb ? [s.a, s.b, ta, tb] : [s.b, s.a, tb, ta];
    el.push({ kind: 'score', group: 'fx:score', value: 1, from: P(p), to: P(q), birth: t0, grow: r5(Math.max(1e-3, t1 - t0)), life: r5(cutAt - t0 + M.score.cool), cool: M.score.cool, width: r5(size * 0.006 * (0.6 + 0.4 * A.score)) });
  }
  // blade: a band (or a crescent) across each plane, travelling along the stroke
  if (A.blade > 0) for (const s of strokes) {
    const ss = planes.get(s.plane), side = V.unit(V.cross(s.n, s.dir)), w = ss.flatMap((x) => [V.dot(x.a, side), V.dot(x.b, side)]);
    el.push({ kind: 'blade', group: 'fx:blade', shape: M.blade.shape, value: 1, plane: s.plane, dir: s.dir, side: P(side), along: s.span, across: [r5(Math.min(...w) - size * 0.05), r5(Math.max(...w) + size * 0.05)], depth: r5(s.depth), normal: P(s.n), birth: s.birth, life: s.sweep, band: r5(size * M.blade.width * (0.5 + A.blade)) });
  }
  // beam: from an emitter off the item's face to the point the cut has reached, one stroke at a time
  if (A.beam > 0) for (const s of strokes) {
    const ss = planes.get(s.plane), side = V.unit(V.cross(s.n, s.dir)), w = ss.flatMap((x) => [V.dot(x.a, side), V.dot(x.b, side)]), c = (Math.min(...w) + Math.max(...w)) / 2;
    const face = V.dot(V.sub(at, centre), axes[thin]) < 0 ? -1 : 1, start = V.add(V.add(V.mul(s.n, s.depth), V.mul(s.dir, s.span[0])), V.mul(side, c));
    const emitter = V.add(V.add(start, V.mul(axes[thin], -face * size * M.beam.standoff)), [0, 0, size * 0.4]);
    el.push({ kind: 'beam', group: 'fx:beam', value: 1, plane: s.plane, emitter: P(emitter), from: P(start), to: P(V.add(start, V.mul(s.dir, s.span[1] - s.span[0]))), birth: s.birth, life: s.sweep, width: r5(size * M.beam.width * (0.5 + A.beam)) });
  }
  // sparks: chips off the score as the cut passes; out of the cut, along the beam, or burst from the hit
  if (A.spark > 0) {
    const sites = [];
    for (const s of segs) { const L = V.len(V.sub(s.b, s.a)), n = Math.floor((L / size) * M.spark.rate * A.spark + rnd()); for (let k = 0; k < n; k++) sites.push({ s, u: rnd() }); }
    const [l0, l1] = M.spark.life;
    for (const { s, u } of fair(sites, Math.round(CAP.spark * A.spark))) {
      const p = V.add(s.a, V.mul(V.sub(s.b, s.a), u)), st = when.get(s.plane);
      const out = M.spark.spray === 'burst' ? V.unit(V.add(V.sub(p, at), [0, 0, 0.3 + rnd() * 0.5]))
        : M.spark.spray === 'along' ? V.unit(V.add(V.mul(st.dir, -0.4), V.add(V.mul(axes[thin], (rnd() - 0.5) * 1.4), [0, 0, -0.2 - rnd() * 0.6])))
          : V.unit(V.add(V.mul(st.n, rnd() < 0.5 ? 1 : -1), V.add(V.mul(st.dir, 0.6), [0, 0, 0.5 + rnd()])));
      el.push({ kind: 'spark', group: 'fx:spark', value: 0.95, at: P(p), vel: P(V.mul(out, size * (1.2 + 1.8 * rnd()))), gravity: 20, birth: passAt(s.plane, p), life: r5(l0 + (l1 - l0) * rnd()), size: r5(size * (0.008 + 0.012 * rnd())) });
    }
  }
  // glint: every cut face, white as the cut crosses it, back to the inside after; it rides its chunk
  if (A.glint > 0) {
    const faces = cut.chunks.flatMap((c) => c.faces.map((f, fi) => ({ c, f, fi }))).filter(({ f }) => f.cut && f.plane && when.has(f.plane));
    for (const { c, f, fi } of fair(faces, Math.round(CAP.glint * A.glint))) {
      const m = V.mul(f.corners.reduce(V.add, [0, 0, 0]), 1 / f.corners.length);
      el.push({ kind: 'glint', group: 'fx:glint', chunk: c.id, face: fi, peak: r5(Math.min(1, f.value + M.glint.peak * A.glint)), to: f.value, birth: passAt(f.plane, m), life: r5(M.glint.life * (0.6 + 0.4 * A.glint)) });
    }
  }
  // dust: puffs where the planes open as the chunks part, or a burst at the hit
  if (A.dust > 0) {
    const puffs = M.dust.at === 'impact' ? Array.from({ length: 24 }, () => V.add(at, V.mul([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], size * 0.3)))
      : [...planes.values()].flatMap((ss) => ss.filter((_, i) => i % 3 === 0).map((s) => s.m));
    for (const p of fair(puffs, Math.round(CAP.dust * A.dust))) el.push({ kind: 'dust', group: 'fx:dust', value: M.dust.value, at: P(p), drift: P([(rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, M.dust.rise * (0.6 + 0.8 * rnd())]), birth: r5((M.dust.at === 'impact' ? 0 : cutAt) + 0.05 * rnd()), life: r5(M.dust.life * (0.7 + 0.6 * rnd())), size: [r5(size * 0.03), r5(size * M.dust.size * (0.5 + 0.5 * A.dust))] });
  }

  // how the pieces part: radial from the centre, burst from the hit, or each slipping along the cuts it lies across
  const part = S.part, spread = { scale: part.scale ?? 0, ...(part.seconds ? { seconds: part.seconds } : {}), ...(part.jitter != null ? { jitter: part.jitter } : {}), ...(part.twist != null ? { twist: part.twist } : {}) };
  if (part.mode === 'slip') {
    spread.offsets = Object.fromEntries(cut.chunks.map((c) => [c.id, P(strokes.reduce((o, s) => V.add(o, V.mul(s.dir, (V.dot(c.centroid, s.n) >= s.depth ? 1 : -1) * size * part.slip * 0.5)), [0, 0, 0]))]));
  }
  const out = {
    style, cutAt, seconds: r5(Math.max(cutAt, ...el.map((e) => e.birth + e.life))),
    strokes: strokes.map(({ n, depth, ...s }) => s), elements: el, spread, origin: part.mode === 'burst' ? P(at) : P(centre),
  };
  out.sounds = cutSounds(out, S.sounds || {}, { sounds, gain });   // when which cue fires: the style's, or the caller's
  return out;
}
