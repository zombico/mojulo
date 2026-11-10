/**
 * mecha-gait — a frame's walk, read from its structure and scaled to its size: the gait a frame of the shelf walks on a
 * page (its legs keyed by the shelf's own IK, mecha-ik.js, each key a stance its legs reach within their ranges).
 *
 *   gaitOf(archetype)            → the gait: its legs and their pattern, its hip height, its reach, its stride, cadence and
 *                                  speed, its swing and its sway, and what limited it
 *   gaitStances(gait, keys?)     → the stances of one cycle (mecha-ik.js's words: the pelvis's height and sway, each foot's
 *                                  place and lift), its feet's places along the way
 *   gaitLaws(gait, posed)        → [{ name, ok, info }]: every key reached within range, a planted foot still, a swinging
 *                                  foot clear, the support it never lacks, a walk and not a run
 *
 * THE STRUCTURE: its legs (two, a biped's alternate steps; four, each foot lifted in turn, three always down, in the order
 * of the six that keeps a side's two feet farthest apart, its stride shortened until their outlines, turned with their
 * legs, pass clear), their geometry and their joints' ranges, as the IK reaches them: the farthest a
 * foot is set ahead and behind the hip at the height it walks at (the knees bent as far as gives it the longest reach).
 * THE SIZE: dynamic similarity, as animals of every size walk alike at the same Froude number (v² / g·L, L the hip's
 * height): a walk at Fr 0.25, its relative stride (a cycle's distance over L) 2.3·Fr^0.3 (Alexander's), so a bigger
 * frame strides longer and steps slower (its cadence as 1/√L), faster over the ground (as √L). A frame whose legs reach
 * less than that stride takes the stride they reach, at the same cadence: slower. The machine walks as the animal its size
 * would, as far as its legs allow; nothing here knows its actuators' speeds.
 *
 * The frame's own frame (+y forward, +x right, metres). Pure and deterministic; a gait's reach is a few dozen IK solves.
 */
import { MECHA_ARCHETYPES, mechaCtx, posedFrame, assembleFrame, frameRow as archetypeRow } from './index.js';
import { lowerAssemblerBuild } from '../worlds/workbench-assembler.js';
import { legKeys, legGeometry, legYaw } from './mecha-ik.js';

const G = 9.81, r3 = (v) => Math.round(v * 1000) / 1000 + 0;
/** The walk's numbers: its Froude number, its duty (the share of a cycle a foot is down) by its legs, its keys a cycle. */
export const GAIT = Object.freeze({ froude: 0.25, duty: Object.freeze({ 2: 0.6, 4: 0.75 }), keys: 16, swing: 0.12, sway: 0.35, run: 0.5, creep: 0.02, spreads: Object.freeze([1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.4]) });
// a four-legged frame's lateral sequence (a leg's phase): hind left, fore left, hind right, fore right
const LATERAL = Object.freeze({ rl: 0, fl: 0.25, rr: 0.5, fr: 0.75 });

// the longest d (0..hi) that `ok(d)` holds for, `ok` holding at 0
function farthest(ok, hi, n = 22) {
  if (!ok(0)) return 0;
  let a = 0, b = hi;
  if (ok(b)) return b;
  for (let i = 0; i < n; i++) { const m = (a + b) / 2; if (ok(m)) a = m; else b = m; }
  return a;
}
// a stance its legs hold: every leg reached, no joint past its range
const holds = (archetype, st) => { try { const P = posedFrame(archetype, st); return P.reached && !P.clamped.length; } catch { return false; } };

/** A frame's gait, read from its structure and scaled to its size. */
export function gaitOf(archetype) {
  const row = archetypeRow(archetype);
  const ctx = mechaCtx(archetype), legs = legKeys(row), n = legs.length;
  if (n !== 2 && n !== 4) throw new Error(`mecha gait: a frame walks on two legs or four (the ${archetype} has ${n})`);
  const stand = posedFrame(archetype, 'stand'), z0 = stand.root.t[2];
  const geo = Object.fromEntries(legs.map((S) => [S, legGeometry(row, ctx, S)]));
  // (the hip's height over the ground, standing: the length that sets its size)
  const L = r3(z0 + Math.max(...legs.map((S) => geo[S].hip[2])));
  const fore = n === 2 ? ['r'] : legs.filter((S) => S[0] === 'f'), aft = n === 2 ? ['l'] : legs.filter((S) => S[0] === 'r');
  const plan = (spread) => {
    // the reach at a height: the farthest each foot is set ahead and behind, the others opposite (a stride's two ends)
    const reachAt = (h) => farthest((d) => holds(archetype, { height: h, ...(spread !== 1 ? { spread } : {}), feet: Object.fromEntries([...fore.map((S) => [S, { y: d }]), ...aft.map((S) => [S, { y: -d }])]) })
      && holds(archetype, { height: h, ...(spread !== 1 ? { spread } : {}), feet: Object.fromEntries([...fore.map((S) => [S, { y: -d }]), ...aft.map((S) => [S, { y: d }])]) }), L);
    // (the knees bent as far as gives the longest reach: the walk's height, among a few below standing)
    const heights = [1, 0.97, 0.94, 0.9, 0.86].map((k) => r3(z0 * k)).filter((h) => holds(archetype, { height: h, ...(spread !== 1 ? { spread } : {}) }));
    if (!heights.length) return null;
    const best = heights.map((h) => ({ h, d: reachAt(h) })).reduce((a, b) => (b.d > a.d + 1e-3 ? b : a));
    const duty = GAIT.duty[n];
    // (by its size: the walk at its Froude number, its natural stride and cadence)
    const vF = Math.sqrt(GAIT.froude * G * L), sF = 2.3 * GAIT.froude ** 0.3 * L, f = vF / sF;
    // (by its structure: a foot planted travels duty·stride against the hip, ± half of it about the hip; its reach caps it)
    const sReach = (2 * best.d * 0.92) / duty, limited = sReach < sF;
    // (the swing's clearance: a share of its hip height, as high as its legs lift a foot mid-swing)
    const lift = farthest((u) => holds(archetype, { height: best.h, ...(spread !== 1 ? { spread } : {}), feet: { [legs[0]]: { y: 0, lift: u } } }), GAIT.swing * L * 1.5);
    const swing = r3(Math.min(GAIT.swing * L, lift * 0.9));
    // (a biped's pelvis swayed toward its planted foot, a share of the way over it; a four-legged frame holds its line)
    const track = n === 2 ? Math.abs(stand.feet.r.x - stand.feet.l.x) : 0;
    // (each foot's outline in plan, turned with its leg: a side's two feet kept clear of each other as they pass)
    const make = (S, shape = 1, phase = n === 2 ? { r: 0, l: 0.5 } : LATERAL) => ({
      archetype, legs: Object.freeze(legs), pattern: n === 2 ? 'alternate' : sequenceOf(phase), L, height: best.h, reach: r3(best.d),
      duty, stride: r3(S), step: r3(S / 2), cadence: r3(f), stepsPerMinute: Math.round(f * 2 * 60), speed: r3(f * S), froude: r3(((f * S) ** 2) / (G * L)),
      natural: Object.freeze({ stride: r3(sF), speed: r3(vF) }), limitedBy: S < sF - 1e-6 ? 'reach' : 'size',
      swing, shape, ...(spread !== 1 ? { spread } : {}), sway: r3(n === 2 ? GAIT.sway * track / 2 : 0), track: r3(track),
      phase: Object.freeze({ ...phase }), ...(spacing ? { footClear: spacing.need } : {}),
      turn: r3(Math.min(0.6, (f * S) / Math.max(1, L))),
    });
    // (the whole cycle held, not only a stride's two ends: a foot lifting from behind asks its ankle the most; the stride
    // shortened until every key holds)
    // (the swing's shape first: the gentlest whose cycle holds at the stride its reach allows; then the stride)
    let S = limited ? sReach : sF;
    const fits = (g) => gaitStances(g).every((st) => holds(archetype, st));
    const shape = [1, 2, 3, 4].find((k) => fits(make(S, k))) ?? 4;
    // (a four-legged frame's legs in the order that keeps a side's two feet farthest apart as they pass, of the six that
    // lift one foot at a time; its stride shortened until their outlines pass clear: a hind foot never swung into the fore
    // foot still planted ahead of it)
    const order = (S) => (spacing ? ORDERS.map((ph) => ({ ph, gap: sideGap(make(S, shape, ph), row, spacing) })).reduce((a, b) => (b.gap > a.gap + 1e-6 ? b : a)) : { ph: make(S, shape).phase, gap: Infinity });
    let O = order(S);
    for (let i = 0; i < 40 && !fits(make(S, shape, O.ph)); i++) { S *= 0.95; O = order(S); }
    // (what its legs reach; then what its feet allow, where they would meet)
    const reached = S;
    for (let i = 0; i < 60 && (O.gap < (spacing?.need ?? 0) || !fits(make(S, shape, O.ph))); i++) { S *= 0.95; O = order(S); }
    const g = make(S, shape, O.ph);
  return Object.freeze({ ...g, ...(spacing ? { footGap: r3(O.gap), ...(S < reached - 1e-6 ? { limitedBy: 'feet' } : {}) } : {}) });
  };
  // (a four-legged frame's feet set wider fore and aft where that lets it walk faster with its feet clear: a leg that aims
  // turns its foot as it reaches, its footprint swinging toward its neighbour's, and room between them is a longer stride)
  const spacing = gapNeeds(archetype, row, legs, stand);
  const plans = (spacing ? GAIT.spreads : [1]).map(plan).filter(Boolean);
  if (!plans.length) throw new Error(`mecha gait: the ${archetype} cannot hold its own standing height`);
  const ok = (g) => g.froude > GAIT.creep && (!spacing || g.footGap >= spacing.need - 1e-6);
  return plans.filter(ok).reduce((a, b) => (b.speed > a.speed + 1e-6 ? b : a), plans.filter(ok)[0] ?? plans.reduce((a, b) => (b.speed > a.speed ? b : a)));
}

// the orders a four-legged frame may lift its feet in, one at a time a quarter of a cycle apart (the hind left first)
const ORDERS = Object.freeze(['fl', 'rr', 'fr'].flatMap((a, i, A) => A.filter((b) => b !== a).map((b) => [a, b, A.find((c) => c !== a && c !== b)])).map((o) => Object.freeze({ rl: 0, [o[0]]: 0.25, [o[1]]: 0.5, [o[2]]: 0.75 })));
// an order's name: the lateral sequence (a side's hind then its fore), the diagonal (a hind then the other side's fore),
// or as its feet lift
function sequenceOf(ph) {
  const seq = Object.keys(ph).sort((a, b) => ph[a] - ph[b]).join(' ');
  return seq === 'rl fl rr fr' ? 'lateral sequence' : seq === 'rl fr rr fl' ? 'diagonal sequence' : `sequence ${seq}`;
}
// a four-legged frame's feet as outlines in plan: all that hangs from each ankle (its bay, its petals, its wheels: the
// layout's bodies on it), built standing, each body's box corners about its sole's centre; and each leg's heading at a
// foot's place (a leg that aims turns its foot as it reaches: its footprint swings with it); null for a biped (its feet
// side by side, never in each other's way along the frame)
function gapNeeds(archetype, row, legs, stand) {
  if (legs.length !== 4) return null;
  const ctx = mechaCtx(archetype);
  const under = (foot) => { const set = new Set([foot]); let grew = true; while (grew) { grew = false; for (const e of row.layout) { const up = typeof e.on === 'string' ? e.on.split('.')[0] : null; if (up && set.has(up) && !set.has(e.id)) { set.add(e.id); grew = true; } } } return set; };
  const items = assembleFrame(archetype, { pose: 'stand', laws: false }).manifest.items;
  const feet = Object.fromEntries(legs.map((S) => {
    const ids = under(row.legs[S].foot), B = lowerAssemblerBuild({ items: items.filter((it) => ids.has(it.id)) }), f0 = stand.feet[S];
    const pts = B.placements.filter((p) => p.bounds).flatMap((p) => [[p.bounds.min[0], p.bounds.min[1]], [p.bounds.max[0], p.bounds.min[1]], [p.bounds.min[0], p.bounds.max[1]], [p.bounds.max[0], p.bounds.max[1]]]).map(([x, y]) => [x - f0.x, y - f0.y]);
    const G = legGeometry(row, ctx, S), yaw = (x, y) => legYaw(row.legs[S], G, [x, y, 0], { yaw: 0, base: f0.base ?? 0 });
    return [S, { pts, x: f0.x, yaw0: yaw(f0.x, f0.y), yaw }];
  }));
  const size = Math.max(...legs.map((S) => { const ys = feet[S].pts.map((p) => p[1]); return Math.max(...ys) - Math.min(...ys); }));
  return { feet, need: r3(0.05 * size) };
}
// the least clearance (m, along the frame) between a side's two footprints over a cycle, sampled finely: the fore foot's
// rearmost reach less the hind foot's foremost, each outline turned with its leg's heading where its foot then stands
function sideGap(gait, row, spacing) {
  const F = spacing.feet, extent = (S, y, k) => {
    const f = F[S], a = ((f.yaw(row.legs[S].at[0] * k, y) - f.yaw0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    let lo = Infinity, hi = -Infinity;
    for (const [px, py] of f.pts) { const v = y + px * s + py * c; if (v < lo) lo = v; if (v > hi) hi = v; }
    return [lo, hi];
  };
  let least = Infinity;
  for (let i = 0; i < 96; i++) {
    const p = i / 96;
    for (const [f, h] of [['fl', 'rl'], ['fr', 'rr']]) {
      const k = gait.spread ?? 1, yf = row.legs[f].at[1] * k + footAt(gait, (((p - gait.phase[f]) % 1) + 1) % 1).y, yh = row.legs[h].at[1] * k + footAt(gait, (((p - gait.phase[h]) % 1) + 1) % 1).y;
      least = Math.min(least, extent(f, yf, k)[0] - extent(h, yh, k)[1]);
    }
  }
  return least;
}

// a leg's foot at its own phase p (0..1, its planting at 0): planted, it runs from +a to −a against the hip; swinging, it
// is carried back to +a over an arc
// (`shape` k: the lift as sin(πu)^k, the foot carried forward as it lifts, sooner the higher k: a foot that cannot lift
// flat from behind (a knee-forward leg's ankle stops it) leaves the ground later, nearer under the hip)
function footAt(gait, p) {
  const a = (gait.duty * gait.stride) / 2, k = gait.shape ?? 1;
  if (p < gait.duty) return { y: a - (2 * a * p) / gait.duty, lift: 0 };
  const u = (p - gait.duty) / (1 - gait.duty), w = k > 1 ? Math.min(1, u * (1 + 0.25 * (k - 1))) : u;
  // (a swinging foot is off the ground, if only just: never read as planted while it moves)
  return { y: -a + 2 * a * (0.5 - 0.5 * Math.cos(Math.PI * w)), lift: u > 0 ? Math.max(0.002, gait.swing * Math.sin(Math.PI * u) ** k) : 0 };
}

/** One cycle's stances (mecha-ik.js's words), key by key: at phase k / keys, each foot where its own phase puts it. */
export function gaitStances(gait, keys = GAIT.keys) {
  return Array.from({ length: keys }, (_, k) => {
    const p = k / keys, feet = {};
    for (const S of gait.legs) { const q = (((p - gait.phase[S]) % 1) + 1) % 1, F = footAt(gait, q); feet[S] = { y: r3(F.y), lift: r3(F.lift) }; }
    // (the sway toward the planted foot of a biped: over the right foot at the middle of its planting)
    const dx = gait.sway ? r3(gait.sway * Math.cos(2 * Math.PI * (p - gait.duty / 2))) : 0;
    return { height: gait.height, ...(gait.spread ? { spread: gait.spread } : {}), feet, ...(dx ? { sway: [dx, 0] } : {}) };
  });
}

/** The gait's laws on its cycle (`posed`: each stance as posedFrame solved it). */
export function gaitLaws(gait, stances, posed) {
  const L = [], law = (name, ok, info) => L.push({ name, ok: !!ok, ...(info !== undefined ? { info } : {}) });
  law('every key is reached, no joint past its range', posed.every((P) => P.reached && !P.clamped.length), posed.map((P, k) => (P.reached && !P.clamped.length ? null : [k, P.clamped])).filter(Boolean));
  // (a planted foot holds still on the ground: its place against the hip and the body's travel sum to the same)
  const K = stances.length;
  const still = gait.legs.every((S) => {
    const down = stances.map((st, k) => ({ k, y: st.feet[S].y + (k / K) * gait.stride, lift: st.feet[S].lift })).filter((x) => x.lift === 0);
    const runs = []; for (const x of down) { const last = runs.at(-1); if (last && x.k === last.at(-1).k + 1) last.push(x); else runs.push([x]); }
    // (a run across the cycle's end wraps: the body has travelled a stride)
    return runs.every((run) => run.every((x) => Math.abs(x.y - run[0].y) < 0.01));
  });
  law('a planted foot holds still on the ground', still);
  law('a swinging foot clears the ground', stances.every((st) => gait.legs.every((S) => st.feet[S].lift >= 0)) && stances.some((st) => gait.legs.some((S) => st.feet[S].lift >= gait.swing * 0.9)), gait.swing);
  const need = gait.legs.length === 2 ? 1 : 3, least = Math.min(...stances.map((st) => gait.legs.filter((S) => st.feet[S].lift === 0).length));
  law(`it never has fewer than ${need} foot${need > 1 ? 's' : ''} down`.replace('foots', 'feet'), least >= need, least);
  law('it walks: a Froude number below a run\'s, above a creep\'s', gait.froude <= GAIT.run && gait.froude > GAIT.creep, gait.froude);
  // (a four-legged frame's two feet on a side never meet: their outlines, turned with their legs, pass clear)
  if (gait.footClear) law('a side\'s two feet pass clear of each other', gait.footGap >= gait.footClear - 1e-6, { gap: gait.footGap, clear: gait.footClear });
  return L;
}
