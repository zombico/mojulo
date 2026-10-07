/**
 * LOCAL MERU — a level where the walk goes up. Meru is the world mountain, and the polygonizer's vertical ruler
 * (polygonizer/meru.js): a local meru is one level's own. Its picture is the polygonizer's — a MANDALA (the plan: a
 * radius at every height) on a MERU (named heights up one axis) — and its parts are:
 *
 *   tier       a place to stand at a meru height: a landing, the summit, a tower's deck
 *   connector  what joins two tiers: a flight of steps on the spiral, a climb up the tower; each is an ANCHOR the place
 *              asks to have joined, and playscape answers (links.js answerAnchor). The place never builds a connector.
 *
 * The base unit: a MOUND (a radius that narrows from its foot to its summit, `profile` its bulge), a SPIRAL stairway
 * round it (a shelf `width` wide on the mound's flank, flights of outdoor steps by the man-made index's `steps` laws,
 * a landing between flights), its foot where the trail it follows leaves (`after`), its head on the summit, and a
 * WATCHTOWER on the summit (a square `side` wide, a deck `deck` up, a roof) climbed from the side the stair arrives on.
 *
 *   planLocalMeru(recipe)   → { recipe, join, meru, mandala, path, landings, flights, summit, tower, anchors }
 *   localMeruLaws(plan)     → the ledger: [{ law, want, why, ok, value, from }]
 *
 * Coordinates are the followed trail's site (x across, y along, z up, metres): the spiral is laid on from the seam.
 * Pure numbers, deterministic; nothing here builds a face.
 */
import { outTrailSite, OUT_TRAIL } from '../era/out-trail.js';
import { madeLaws } from '../era/out-made.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { meruMarks } from '../polygonizer/meru.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);
const TAU = Math.PI * 2;

// the walker the platform rule makes (worlds/controllable/rules-platform.js): the step it walks up without a jump,
// the room it stands in
export const WALKER = Object.freeze({ step: 0.35, height: 1.8, headroom: 2.1 });

/** The defaults a recipe starts from; every number is a dial. */
export const LOCAL_MERU = Object.freeze({
  mound: { height: 12, foot: 13, summit: 4.5, profile: 0.85 },
  path: { width: 1.6, turns: 1.25, hand: 'left', approach: null, edge: 'rail' },   // approach null: past the mound's foot
  // the outdoor steps' going (playscape stairs `steps`, era/out-made.js `steps` laws): 2R + T one stride
  going: { riser: 0.15, stride: 0.65, flight: 10, landing: 1.2 },
  tower: { side: 3, deck: 6, rail: 1, eave: 2.3, roof: 2.2, around: 0.6, link: { prefer: 'ladder' } },
});

const KEYS = { id: 1, after: 1, mound: 1, path: 1, going: 1, tower: 1 };

/** A recipe read against the defaults; anything it does not know is refused with what it does. */
export function readLocalMeru(recipe = {}) {
  for (const k of Object.keys(recipe)) if (!KEYS[k]) throw new Error(`local-meru: '${k}' is not a setting (settings: ${Object.keys(KEYS).join(', ')})`);
  const D = LOCAL_MERU, merge = (k) => {
    const v = recipe[k] || {};
    for (const q of Object.keys(v)) if (!(q in D[k])) throw new Error(`local-meru: ${k}.${q} is not a setting (${k}: ${Object.keys(D[k]).join(', ')})`);
    return { ...D[k], ...v };
  };
  const R = { id: recipe.id || 'meru', mound: merge('mound'), path: merge('path'), going: merge('going'), tower: merge('tower'), after: recipe.after || null };
  const M = R.mound;
  if (!(M.height > 0)) throw new Error('local-meru: mound.height must be metres above 0');
  if (!(M.summit > 0 && M.foot > M.summit)) throw new Error('local-meru: mound.foot must be wider than mound.summit, both above 0');
  if (!(M.profile > 0)) throw new Error('local-meru: mound.profile must be above 0 (1 a cone, under 1 a dome, over 1 a peak)');
  if (!['left', 'right'].includes(R.path.hand)) throw new Error("local-meru: path.hand is 'left' (the mound on your left as you climb) or 'right'");
  if (!['rail', 'open'].includes(R.path.edge)) throw new Error("local-meru: path.edge is 'rail' or 'open'");
  if (!(R.path.turns > 0)) throw new Error('local-meru: path.turns must be above 0');
  if (R.path.approach === null) R.path.approach = M.foot + 1;
  if (!(R.path.approach >= 0)) throw new Error('local-meru: path.approach must be metres at or above 0 (null: past the mound\'s foot)');
  return R;
}

/**
 * Where the level starts: the seam of the trail it follows (`after: { trail, kit, seed }`, the stage recipe's own
 * words) — its line, its way on and its height where it leaves — or the origin facing +y when it follows none.
 */
export function joinOfTrail(after) {
  if (!after) return { from: null, at: [0, 0, 0], N: [0, 1, 0], site: null };
  const kit = after.kit || 'isekai-meadow', st = ISEKAI_STYLES[kit];
  if (!st) throw new Error(`local-meru: after.kit '${kit}' is not an isekai kit (${Object.keys(ISEKAI_STYLES).join(', ')})`);
  const seed = Number.isFinite(after.seed) ? after.seed : 1, site = outTrailSite(st, after.trail === undefined ? true : after.trail, seed);
  const D = site.D, x = site.trailX(D), sl = site.out.plan.trailSlope(D), l = Math.hypot(sl, 1);
  return { from: `out-trail:${site.out.plan.id}`, kit, seed, at: P([x, D, site.ground(x, D)]), N: P([sl / l, 1 / l, 0]), site };
}

/** The mound's radius at height z above its foot (the mandala at that meru height). */
export const moundRadius = (M, z) => M.summit + (M.foot - M.summit) * Math.pow(Math.max(0, 1 - Math.min(1, z / M.height)), M.profile);
/** The height under radius r on the mound's flank (the inverse; at or past the foot, 0). */
export function moundHeightAt(M, r) {
  if (r >= M.foot) return 0;
  if (r <= M.summit) return M.height;
  return M.height * (1 - Math.pow((r - M.summit) / (M.foot - M.summit), 1 / M.profile));
}

// the going for a flight of n risers sharing the rise: the riser, and the tread one stride leaves
function goingOf(G, rise) {
  const n = Math.max(1, Math.round(rise / G.riser)), R = rise / n;
  return { n, R, T: G.stride - 2 * R };
}

/**
 * Lay the spiral: flights and landings along the shelf's centreline, from the foot (angle 0) round and up to the
 * summit. The risers share the whole rise evenly; flights hold at most `going.flight` of them; the landings between
 * are as long as the turns ask (never shorter than the going's landing or the path's width).
 */
function laySpiral(R) {
  const M = R.mound, W = R.path.width, G = R.going;
  const all = goingOf(G, M.height), nf = Math.ceil(all.n / G.flight), base = Math.floor(all.n / nf), extra = all.n % nf;
  const flightRisers = Array.from({ length: nf }, (_, i) => base + (i < extra ? 1 : 0));
  const rc = (z) => moundRadius(M, z) + W / 2;
  // walk the centreline: each tread a run T at its riser's height, each landing a run L level
  const walk = (L) => {
    const segs = []; let s = 0, th = 0, z = 0;
    const run = (len, z0, z1, kind, k) => {
      const n = Math.max(1, Math.ceil(len / 0.25)), seg = { kind, k, s0: s, th0: th, z0, z1, pts: [] };
      for (let i = 0; i <= n; i++) {
        const f = i / n, zz = z0 + (z1 - z0) * f;
        if (i) th += (len / n) / rc(zz);
        seg.pts.push({ s: s + len * f, th, z: zz });
      }
      s += len; seg.s1 = s; seg.th1 = th; segs.push(seg);
    };
    flightRisers.forEach((n, i) => {
      const z0 = z; z += n * all.R;
      run(n * all.T, z0, z, 'flight', i + 1);
      if (i < nf - 1) run(L, z, z, 'landing', i + 1);
    });
    return { segs, s, th };
  };
  const want = R.path.turns * TAU, Lmin = Math.max(G.landing, W);
  let L = Lmin, laid = walk(L);
  if (nf > 1 && laid.th < want) {
    let lo = Lmin, hi = Lmin;
    while (walk(hi).th < want && hi < 400) hi *= 2;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (walk(mid).th < want) lo = mid; else hi = mid; }
    L = hi; laid = walk(L);
  }
  return { ...laid, going: { ...all, risers: all.n }, flightRisers, landing: L, rc };
}

/** The level from a recipe: its join, its meru and mandala, the spiral, the summit, the tower, the anchors. */
export function planLocalMeru(recipe = {}) {
  const R = readLocalMeru(recipe), M = R.mound, W = R.path.width, T = R.tower;
  const join = joinOfTrail(R.after), z0 = join.at[2];
  const sp = laySpiral(R), hand = R.path.hand === 'left' ? 1 : -1;
  // the approach runs straight on from the seam to the spiral's foot; the mound stands to the climbing hand there
  const N = join.N, left = [-N[1], N[0], 0];
  const foot = [join.at[0] + N[0] * R.path.approach, join.at[1] + N[1] * R.path.approach];
  const r0 = sp.rc(0), centre = [foot[0] + left[0] * hand * r0, foot[1] + left[1] * hand * r0];
  const a0 = Math.atan2(foot[1] - centre[1], foot[0] - centre[0]);
  const ang = (th) => a0 + hand * th;
  const onRing = (r, th, z) => P([centre[0] + Math.cos(ang(th)) * r, centre[1] + Math.sin(ang(th)) * r, z0 + z]);
  const wayOn = (th) => P([-Math.sin(ang(th)) * hand, Math.cos(ang(th)) * hand, 0]);
  const at = (p) => onRing(sp.rc(p.z), p.th, p.z);

  const path = sp.segs.flatMap((g, i) => (i ? g.pts.slice(1) : g.pts).map((p) => ({ s: r5(p.s), th: r5(p.th), z: r5(z0 + p.z), at: at(p), kind: g.kind })));
  const flights = sp.segs.filter((g) => g.kind === 'flight').map((g) => {
    const n = sp.flightRisers[g.k - 1], mid = g.pts[Math.floor(g.pts.length / 2)];
    return { id: `flight-${g.k}`, k: g.k, s0: r5(g.s0), s1: r5(g.s1), th0: r5(g.th0), th1: r5(g.th1), z0: r5(z0 + g.z0), z1: r5(z0 + g.z1), risers: n, R: r5(sp.going.R), T: r5(sp.going.T),
      from: at(g.pts[0]), to: at(g.pts[g.pts.length - 1]), mid: at(mid), N: wayOn(mid.th) };
  });
  const landings = sp.segs.filter((g) => g.kind === 'landing').map((g) => {
    const mid = g.pts[Math.floor(g.pts.length / 2)];
    return { id: `landing-${g.k}`, k: g.k, s0: r5(g.s0), s1: r5(g.s1), th0: r5(g.th0), th1: r5(g.th1), z: r5(z0 + g.z0), length: r5(g.s1 - g.s0), at: at(mid), N: wayOn(mid.th) };
  });

  // the head of the stair steps off onto the summit, the way it was going; the tower squares to that arrival
  const thEnd = sp.th, arrive = onRing(M.summit - 0.4, thEnd, M.height), arrival = ang(thEnd);
  const half = T.side / 2, claim = r5(Math.SQRT2 * half + T.around), budget = r5(M.summit);
  // the tower face looking down the arrival: its outward normal points from the centre toward where the stair lands
  const n = [Math.cos(arrival), Math.sin(arrival)], u = [-n[1], n[0]];
  const faceMid = [centre[0] + n[0] * half, centre[1] + n[1] * half];
  const marks = meruMarks([
    { name: 'seam', z: z0 },
    ...landings.map((l) => ({ name: l.id, z: l.z })),
    { name: 'summit', z: z0 + M.height },
    { name: 'deck', z: z0 + M.height + T.deck },
    { name: 'rail', z: z0 + M.height + T.deck + T.rail },
    { name: 'eave', z: z0 + M.height + T.deck + T.eave },
    { name: 'apex', z: z0 + M.height + T.deck + T.eave + T.roof },
  ].map((m) => ({ ...m, z: r5(m.z) })));
  const summitZ = marks.z('summit'), deckZ = marks.z('deck');
  const tower = {
    centre: P(centre), side: T.side, half, deck: deckZ, rail: marks.z('rail'), eave: marks.z('eave'), apex: marks.z('apex'),
    n: P([...n, 0]), u: P([...u, 0]), corners: [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => P([centre[0] + (n[0] * a + u[0] * b) * half, centre[1] + (n[1] * a + u[1] * b) * half, summitZ])),
    claim, budget, overflow: r5(claim - budget),
  };
  const climb = {
    from: P([faceMid[0] + n[0] * 0.6, faceMid[1] + n[1] * 0.6, summitZ]),
    to: P([faceMid[0], faceMid[1], deckZ]),
    N: P([-n[0], -n[1], 0]), rise: r5(deckZ - summitZ),
  };

  const id = `local-meru:${R.id}`, tag = (a) => ({ ...a, level: id });
  const anchors = [
    ...(join.from ? [{ id: `junction-${join.site.out.plan.id}-${R.id}`, kind: 'junction', between: [join.from, id], at: join.at, N: join.N, width: W }] : []),
    { id: 'foot', kind: 'tier', tier: 'foot', at: P([foot[0], foot[1], z0]), N: wayOn(0), z: z0 },
    ...flights.map((f) => ({ id: f.id, kind: 'site', site: 'stairs', at: f.mid, N: f.N, from: f.from, to: f.to, s0: f.s0, s1: f.s1, rise: r5(f.z1 - f.z0),
      going: { risers: f.risers, riser: f.R, tread: f.T }, curve: { centre: P([...centre, f.z0]), radius: r5(sp.rc((f.z0 + f.z1) / 2 - z0)), hand: R.path.hand } })),
    ...landings.map((l) => ({ id: l.id, kind: 'tier', tier: 'landing', beat: 'rest', at: l.at, N: l.N, z: l.z, length: l.length })),
    { id: 'summit', kind: 'tier', tier: 'summit', beat: 'reveal', at: arrive, N: wayOn(thEnd), z: summitZ, r: budget },
    { id: 'tower', kind: 'beat', beat: 'landmark', at: P([...centre, marks.z('apex')]), node: 'tower', solid: true },
    { id: 'climb-1', kind: 'site', site: 'climb', at: P([faceMid[0], faceMid[1], r5((summitZ + deckZ) / 2)]), from: climb.from, to: climb.to, N: climb.N, rise: climb.rise, link: { ...T.link } },
    { id: 'deck', kind: 'tier', tier: 'deck', at: P([...centre, deckZ]), z: deckZ, area: r5(T.side * T.side) },
  ].map(tag);

  return {
    recipe: R, join, centre: P(centre), hand, a0: r5(a0),
    meru: marks,
    mandala: { foot: M.foot, summit: M.summit, width: W, radiusAt: (z) => moundRadius(M, z - z0), shelfAt: (z) => sp.rc(z - z0) },
    path, flights, landings, going: sp.going, landing: r5(sp.landing), length: r5(sp.s), turns: r5(sp.th / TAU),
    summit: { z: summitZ, r: M.summit, arrive }, tower, climb, anchors,
  };
}

/**
 * The ledger. The steps' laws are the man-made index's own (era/out-made.js `steps`), measured on the going; the rest
 * are the level's: the walker steps every riser, a landing is a place to stand, the shelves never stack, a fall off the
 * edge is railed, the tower fits the summit with a walk round it, the climb is one pull, the landmark is seen from the
 * seam, the join meets its trail. Advice, never a refusal.
 */
export function localMeruLaws(plan) {
  const R = plan.recipe, M = R.mound, W = R.path.width, g = plan.going, z0 = plan.join.at[2];
  const steps = madeLaws('steps', { blondel: r5(2 * g.R + g.T), R: r5(g.R), T: r5(g.T), uneven: 0, flight: Math.max(...plan.flights.map((f) => f.risers)) })
    .map((l) => ({ ...l, from: 'out-made:steps' }));
  const law = (name, want, why, ok, value) => ({ law: name, want, why, ok, value, from: 'local-meru' });
  // the shelf's outer edge stands this far over the flank below it; a turn above must clear it in plan
  const drop = (z) => z - moundHeightAt(M, moundRadius(M, z) + W);
  const drops = plan.path.map((p) => drop(p.z - z0)), maxDrop = r5(Math.max(...drops));
  let stack = Infinity;
  for (const p of plan.path) {
    const q = plan.path.find((o) => o.th >= p.th + TAU);
    if (q) stack = Math.min(stack, q.z - p.z - drop(q.z - z0));
  }
  // the landmark seen from the seam: eye height at the seam to the tower's apex, clear of the mound all the way
  const eye = [plan.join.at[0], plan.join.at[1], z0 + WALKER.height - 0.2], apex = [plan.centre[0], plan.centre[1], plan.tower.apex];
  let seen = true;
  for (let i = 1; i < 60; i++) {
    const f = i / 60, x = eye[0] + (apex[0] - eye[0]) * f, y = eye[1] + (apex[1] - eye[1]) * f, z = eye[2] + (apex[2] - eye[2]) * f;
    const r = Math.hypot(x - plan.centre[0], y - plan.centre[1]);
    if (z - z0 < M.height && r < moundRadius(M, z - z0) - 0.05) { seen = false; break; }
  }
  const fp = plan.path[0].at, seam = plan.join.at;
  const clear = (plan.centre[0] - seam[0]) * plan.join.N[0] + (plan.centre[1] - seam[1]) * plan.join.N[1] - M.foot;
  return [
    ...steps,
    law('step-up', `every riser ≤ the walker's step (${WALKER.step} m)`, 'the platform rule walks up a riser no taller than its step; a taller one is a jump', g.R <= WALKER.step + 1e-9, r5(g.R)),
    law('landing', `every landing ≥ ${Math.max(R.going.landing, W)} m long`, 'a pause between flights is a place to stand, as long as the path is wide', plan.landing >= Math.max(R.going.landing, W) - 1e-9, plan.landing),
    law('turns', `the spiral turns ${R.path.turns} times`, 'the climb wraps the mound as far as the recipe asks; fewer turns than asked means the flights alone already go further round', Math.abs(plan.turns - R.path.turns) < 0.02 || plan.flights.length < 2, plan.turns),
    law('shelves', 'a turn above clears the edge of the turn below', 'the shelves never stack: from above, every turn is its own ring', stack >= 0, Number.isFinite(stack) ? r5(stack) : 'one turn'),
    law('edge', R.path.edge === 'rail' ? 'railed: the drop off the edge is guarded' : 'open: no drop over 1 m', 'a fall over 1 m hurts: the man-made index rails a bridge past it', R.path.edge === 'rail' || maxDrop <= 1, maxDrop),
    law('tower-fits', `the tower and a ${R.tower.around} m walk round it inside the summit`, 'the tower stands on the summit, not over its edge: its claim within the summit\'s budget', plan.tower.overflow <= 0, `${plan.tower.claim} in ${plan.tower.budget}`),
    law('one-pull', 'the climb ≤ 6 m', 'arms tire: a longer climb wants a ledge to rest on', plan.climb.rise <= 6 + 1e-9, plan.climb.rise),
    law('landmark', 'the tower seen from the seam', 'where the mountain begins, the walker sees where it ends', seen, seen ? 'seen' : 'hidden'),
    law('clear', 'the mound stands past the seam', 'the level begins where the trail it follows ends: its foot does not spill back over that trail', clear >= -1e-9, r5(clear)),
    law('seam', 'the approach starts on the trail it follows: line, heading and height', 'two levels meet where one leaves off, with no step', Math.hypot(fp[0] - seam[0] - plan.join.N[0] * R.path.approach, fp[1] - seam[1] - plan.join.N[1] * R.path.approach) < 0.01 && Math.abs(fp[2] - seam[2]) < 0.01, 'met'),
  ];
}
