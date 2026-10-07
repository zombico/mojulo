/**
 * LOCAL MERU — a level where the walk goes up. Meru is the world mountain, and the polygonizer's vertical ruler
 * (polygonizer/meru.js): a local meru is one level's own. Its picture is the polygonizer's — a MANDALA (the plan: a
 * shape at every height) on a MERU (named heights up one axis).
 *
 * A level is a stack of TIERS up one meru. Each stands on the top of the one below (the first on the ground where the
 * trail it follows leaves off) and says how the walk gets UP it. A little grammar, so a lot can be said with it:
 *
 *   forms   mound   an earthwork: a plan (`sides`: 0 round, 3 or more a polygon) that narrows from its `foot` to its
 *                   `summit` over its `height`, `profile` its bulge (under 1 a dome, 1 a cone, over 1 a peak)
 *           tower   a timber watchtower: a square `side` wide, a deck `deck` up, a rail, an eave, a roof
 *   ups     spiral  a shelf round the flank, flights of steps and the landings between, `turns` round, `hand`ed
 *           stair   a straight stair up one face, flights in line with landings between, cut into the flank or
 *                   standing out from it
 *           climb   a climb up a face, the link it prefers named (`link.prefer`)
 *
 * A mound is climbed by a spiral or a stair, a tower by a climb. Stacked: a mound on a mound is a terraced mountain, a
 * square mound on a square mound a ziggurat, a stair up a square mound a temple pyramid, a tower on a summit a lookout,
 * a tower on a tower a taller one. Every tier faces the way the walk arrives on the one below.
 *
 * The place never builds a connector: a flight, a landing and a climb are ANCHORS it asks to have joined, and playscape
 * answers them (links.js answerAnchor). The steps' going is the man-made index's (era/out-made.js `steps`).
 *
 *   readLocalMeru(recipe)   the recipe against its defaults; the older one-mound-one-tower words still read
 *   planLocalMeru(recipe)   → { recipe, join, tiers, links, route, meru, going, anchors }
 *   localMeruLaws(plan)     → the ledger: [{ law, want, why, ok, value, from }]
 *
 * Coordinates are the followed trail's site (x across, y along, z up, metres). Pure numbers; nothing builds a face.
 */
import { outTrailSite } from '../era/out-trail.js';
import { madeLaws } from '../era/out-made.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { meruMarks } from '../polygonizer/meru.js';
import { LOCAL_MERU_PRESETS } from './presets.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);
const TAU = Math.PI * 2;
const dirOf = (a) => [Math.cos(a), Math.sin(a)];

// the walker the platform rule makes (worlds/controllable/rules-platform.js): the step it walks up without a jump
export const WALKER = Object.freeze({ step: 0.35, height: 1.8, headroom: 2.1 });

/** Each form's dials and the way up it takes unless a tier names another. */
export const FORMS = Object.freeze({
  mound: { dials: { height: 12, foot: 13, summit: 4.5, profile: 0.85, sides: 0, turn: 0 }, ups: ['spiral', 'stair'] },
  tower: { dials: { side: 3, deck: 6, rail: 1, eave: 2.3, roof: 2.2, around: 0.6 }, ups: ['climb'] },
});
/** Each way up's dials. */
export const UPS = Object.freeze({
  spiral: { width: 1.6, turns: 1.25, hand: 'left', edge: 'rail' },
  stair: { width: 2.4, edge: 'open' },
  climb: { link: { prefer: 'ladder' } },
});

/** The defaults a recipe starts from: a mound climbed by its spiral and a tower on its summit. */
export const LOCAL_MERU = Object.freeze({
  // the outdoor steps' going (playscape stairs `steps`, era/out-made.js `steps` laws): 2R + T one stride
  going: { riser: 0.15, stride: 0.65, flight: 10, landing: 1.2 },
  approach: null,   // metres from the seam to the first way up; null: clear of the first tier's foot
  tiers: [{ form: 'mound' }, { form: 'tower' }],
});

const KEYS = { id: 1, after: 1, going: 1, approach: 1, preset: 1, tiers: 1, mound: 1, path: 1, tower: 1 };

// the older words: one mound (`mound`), its spiral (`path`, `approach` on it) and a tower (`tower`, `link` on it)
function tiersOfOld(recipe) {
  const { approach, ...path } = recipe.path || {}, { link, ...tower } = recipe.tower || {};
  return { approach, tiers: [{ form: 'mound', ...(recipe.mound || {}), up: { via: 'spiral', ...path } }, { form: 'tower', ...tower, up: { via: 'climb', ...(link ? { link } : {}) } }] };
}

/** A recipe read against the defaults; anything it does not know is refused with what it does. */
export function readLocalMeru(recipe = {}) {
  for (const k of Object.keys(recipe)) if (!KEYS[k]) throw new Error(`local-meru: '${k}' is not a setting (settings: id, after, going, approach, preset, tiers)`);
  const old = recipe.mound || recipe.path || recipe.tower;
  if (old && recipe.tiers) throw new Error('local-meru: say the level as `tiers`, or as mound/path/tower, not both');
  if (recipe.preset !== undefined && !LOCAL_MERU_PRESETS[recipe.preset]) throw new Error(`local-meru: preset '${recipe.preset}' is not one (presets: ${Object.keys(LOCAL_MERU_PRESETS).join(', ')})`);
  if (old && recipe.preset) throw new Error('local-meru: a preset names its tiers; say it, or mound/path/tower, not both');
  // the tiers: the recipe's own, else its preset's, else the default
  const o = old ? tiersOfOld(recipe) : { approach: recipe.approach, tiers: recipe.tiers || (recipe.preset ? LOCAL_MERU_PRESETS[recipe.preset].tiers : LOCAL_MERU.tiers) };
  for (const q of Object.keys(recipe.going || {})) if (!(q in LOCAL_MERU.going)) throw new Error(`local-meru: going.${q} is not a setting (going: ${Object.keys(LOCAL_MERU.going).join(', ')})`);
  if (!Array.isArray(o.tiers) || !o.tiers.length) throw new Error('local-meru: tiers is a list, bottom first, of at least one tier');
  const count = {}, tiers = o.tiers.map((t, k) => {
    const F = FORMS[t.form];
    if (!F) throw new Error(`local-meru: tiers[${k}].form '${t.form}' is not a form (forms: ${Object.keys(FORMS).join(', ')})`);
    const { form, id, up = {}, ...dials } = t;
    for (const q of Object.keys(dials)) if (!(q in F.dials)) throw new Error(`local-meru: a ${form} has no '${q}' (${form}: ${Object.keys(F.dials).join(', ')}, up)`);
    const via = up.via || F.ups[0];
    if (!F.ups.includes(via)) throw new Error(`local-meru: a ${form} is climbed by ${F.ups.join(' or ')}, not '${via}'`);
    const { via: _v, ...upDials } = up;
    for (const q of Object.keys(upDials)) if (!(q in UPS[via])) throw new Error(`local-meru: a ${via} has no '${q}' (${via}: ${Object.keys(UPS[via]).join(', ')})`);
    count[form] = (count[form] || 0) + 1;
    return { k, form, idWanted: id, ...F.dials, ...dials, up: { via, ...UPS[via], ...upDials } };
  });
  for (const t of tiers) t.id = t.idWanted || (count[t.form] > 1 ? `${t.form}-${tiers.filter((q) => q.form === t.form).indexOf(t) + 1}` : t.form);
  const ids = tiers.map((t) => t.id);
  if (new Set(ids).size !== ids.length) throw new Error(`local-meru: tier ids are named twice (${ids.join(', ')})`);
  tiers.forEach((t, k) => {
    if (t.form === 'mound' && k && tiers[k - 1].form === 'tower') throw new Error(`local-meru: ${t.id} is a mound on a tower (${tiers[k - 1].id}): a mound stands on the ground or on a mound`);
    // a tower with a tier standing on it is open: no eave, no roof, its deck the next tier's ground
    if (t.form === 'tower') t.roofed = k === tiers.length - 1;
  });
  for (const t of tiers) {
    delete t.idWanted;
    if (t.form === 'mound') {
      if (!(t.height > 0)) throw new Error(`local-meru: ${t.id}.height must be metres above 0`);
      if (!(t.summit > 0 && t.foot > t.summit)) throw new Error(`local-meru: ${t.id}.foot must be wider than ${t.id}.summit, both above 0`);
      if (!(t.profile > 0)) throw new Error(`local-meru: ${t.id}.profile must be above 0 (1 a cone, under 1 a dome, over 1 a peak)`);
      if (!(t.sides === 0 || (Number.isInteger(t.sides) && t.sides >= 3))) throw new Error(`local-meru: ${t.id}.sides is 0 (round) or a whole number of 3 or more`);
    }
    if (t.up.via === 'spiral') {
      if (!['left', 'right'].includes(t.up.hand)) throw new Error(`local-meru: ${t.id}.up.hand is 'left' (the mound on your left as you climb) or 'right'`);
      if (!(t.up.turns > 0)) throw new Error(`local-meru: ${t.id}.up.turns must be above 0`);
    }
    if (t.up.edge !== undefined && !['rail', 'open'].includes(t.up.edge)) throw new Error(`local-meru: ${t.id}.up.edge is 'rail' or 'open'`);
  }
  const approach = o.approach ?? null;
  if (approach !== null && !(approach >= 0)) throw new Error("local-meru: approach must be metres at or above 0 (null: clear of the first tier's foot)");
  return { id: recipe.id || 'meru', after: recipe.after || null, going: { ...LOCAL_MERU.going, ...(recipe.going || {}) }, approach, tiers };
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

/** The mound's half-width (apothem, for a polygon) at height z above its foot: the mandala at that meru height. */
export const moundRadius = (M, z) => M.summit + (M.foot - M.summit) * Math.pow(Math.max(0, 1 - Math.min(1, z / M.height)), M.profile);
/** The height under half-width r on the mound's flank (the inverse; at or past the foot, 0). */
export function moundHeightAt(M, r) {
  if (r >= M.foot) return 0;
  if (r <= M.summit) return M.height;
  return M.height * (1 - Math.pow((r - M.summit) / (M.foot - M.summit), 1 / M.profile));
}
/** How far out the plan's edge stands at angle a, over its apothem: 1 round, more toward a polygon's corners. */
export function planFactor(sides, turn, a) {
  if (!(sides >= 3)) return 1;
  const w = TAU / sides, m = ((((a - turn) % w) + w) % w) - w / 2;
  return 1 / Math.cos(m);
}

// the going for a rise: risers sharing it evenly, the tread one stride leaves, flights of at most `flight`
function goingOf(G, rise) {
  const n = Math.max(1, Math.round(rise / G.riser)), R = rise / n, nf = Math.ceil(n / G.flight);
  const base = Math.floor(n / nf), extra = n % nf;
  return { n, R, T: G.stride - 2 * R, flights: Array.from({ length: nf }, (_, i) => base + (i < extra ? 1 : 0)) };
}

// THE SPIRAL: flights and landings along the shelf's centreline round a mound, from angle a0 up to its summit. The
// landings are as long as the turns ask (never shorter than the going's landing or the path's width).
function laySpiral(t, G) {
  const W = t.up.width, g = goingOf(G, t.height), hand = t.up.hand === 'left' ? 1 : -1;
  const rc = (z, a) => (moundRadius(t, z) + W / 2) * planFactor(t.sides, t.turnAt, a);
  const walk = (L) => {
    const segs = []; let s = 0, th = 0, z = 0;
    const run = (len, z0, z1, kind, k) => {
      const n = Math.max(1, Math.ceil(len / 0.25)), seg = { kind, k, s0: s, th0: th, z0, z1, pts: [{ s, th, z: z0 }] };
      for (let i = 1; i <= n; i++) {
        const zz = z0 + ((z1 - z0) * i) / n, a = t.a0 + hand * th, r = rc(zz, a), dr = (rc(zz, a + hand * 1e-3) - rc(zz, a - hand * 1e-3)) / 2e-3;
        th += len / n / Math.hypot(r, dr);
        seg.pts.push({ s: s + (len * i) / n, th, z: zz });
      }
      s += len; seg.s1 = s; seg.th1 = th; segs.push(seg);
    };
    g.flights.forEach((n, i) => { const z0 = z; z += n * g.R; run(n * g.T, z0, z, 'flight', i + 1); if (i < g.flights.length - 1) run(L, z, z, 'landing', i + 1); });
    return { segs, s, th };
  };
  const want = t.up.turns * TAU, Lmin = Math.max(G.landing, W);
  let L = Lmin, laid = walk(L);
  if (g.flights.length > 1 && laid.th < want) {
    let lo = Lmin, hi = Lmin;
    while (walk(hi).th < want && hi < 400) hi *= 2;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (walk(mid).th < want) lo = mid; else hi = mid; }
    L = hi; laid = walk(L);
  }
  return { ...laid, going: g, landing: L, rc, hand };
}

// THE STAIR: flights in line up one face, landings between, from its foot `run` out from the summit's edge
function layStair(t, G) {
  const g = goingOf(G, t.height), runs = [];
  let s = 0, z = 0;
  g.flights.forEach((n, i) => {
    runs.push({ kind: 'flight', k: i + 1, s0: s, s1: s + n * g.T, z0: z, z1: z + n * g.R }); s += n * g.T; z += n * g.R;
    if (i < g.flights.length - 1) { runs.push({ kind: 'landing', k: i + 1, s0: s, s1: s + G.landing, z0: z, z1: z }); s += G.landing; }
  });
  return { runs, run: s, going: g };
}

/** The level from a recipe: its join, its tiers bottom first, the ways up them, the route walked, the meru, the anchors. */
export function planLocalMeru(recipe = {}) {
  const R = readLocalMeru(recipe), G = R.going, join = joinOfTrail(R.after), N = join.N, z0 = join.at[2];
  const left = [-N[1], N[0]], tiers = [], links = [], route = [{ at: join.at, kind: 'walk' }];
  let below = null;
  const walkTo = (at) => route.push({ at: P(at), kind: 'walk' });
  for (const t0 of R.tiers) {
    const t = { ...t0, base: below ? below.top : z0 };
    const arrive = below ? below.arrive : null, aArr = arrive ? Math.atan2(arrive.at[1] - below.centre[1], arrive.at[0] - below.centre[0]) : null;
    if (t.form === 'mound' && t.up.via === 'spiral') {
      const W = t.up.width, hand = t.up.hand === 'left' ? 1 : -1, rc0 = moundRadius(t, 0) + W / 2;
      if (!below) {
        // the first: the approach runs on from the seam to the spiral's foot; the mound stands to the climbing hand there,
        // a polygon turned so its face meets the approach square
        const approach = R.approach ?? t.foot + 1, foot = [join.at[0] + N[0] * approach, join.at[1] + N[1] * approach];
        t.centre = P([foot[0] + left[0] * hand * rc0, foot[1] + left[1] * hand * rc0]);
        t.a0 = Math.atan2(foot[1] - t.centre[1], foot[0] - t.centre[0]); t.turnAt = t.sides >= 3 ? t.a0 - Math.PI / t.sides : 0; t.approach = approach;
      } else { t.centre = below.centre; t.a0 = aArr; t.turnAt = (below.turnAt || 0) + (t.turn * Math.PI) / 180; }
      const sp = laySpiral(t, G), ang = (th) => t.a0 + hand * th;
      const ring = (th, z, off = 0) => { const a = ang(th), r = sp.rc(z, a) + off * planFactor(t.sides, t.turnAt, a); return P([t.centre[0] + Math.cos(a) * r, t.centre[1] + Math.sin(a) * r, t.base + z]); };
      const wayOn = (th) => { const a = ang(th); return P([-Math.sin(a) * hand, Math.cos(a) * hand, 0]); };
      const path = sp.segs.flatMap((g, i) => (i ? g.pts.slice(1) : g.pts).map((q) => ({ s: r5(q.s), th: r5(q.th), z: r5(t.base + q.z), at: ring(q.th, q.z), kind: g.kind })));
      const piece = (g) => { const mid = g.pts[Math.floor(g.pts.length / 2)]; return { k: g.k, s0: r5(g.s0), s1: r5(g.s1), th0: r5(g.th0), th1: r5(g.th1), z0: r5(t.base + g.z0), z1: r5(t.base + g.z1), from: ring(g.pts[0].th, g.pts[0].z), to: ring(g.th1, g.z1), mid: ring(mid.th, mid.z), N: wayOn(mid.th), radius: r5(sp.rc((g.z0 + g.z1) / 2, ang(mid.th))) }; };
      const flights = sp.segs.filter((g) => g.kind === 'flight').map((g) => ({ ...piece(g), id: `${t.id}.flight-${g.k}`, risers: sp.going.flights[g.k - 1] }));
      const landings = sp.segs.filter((g) => g.kind === 'landing').map((g) => ({ ...piece(g), id: `${t.id}.landing-${g.k}`, z: r5(t.base + g.z0), length: r5(g.s1 - g.s0) }));
      const thEnd = sp.th, aEnd = ang(thEnd), rEnd = (t.summit - 0.4) * planFactor(t.sides, t.turnAt, aEnd);
      t.arrive = { at: P([t.centre[0] + Math.cos(aEnd) * rEnd, t.centre[1] + Math.sin(aEnd) * rEnd, t.base + t.height]), N: wayOn(thEnd) };
      walkTo(path[0].at); for (const q of path) route.push({ at: q.at, kind: q.kind }); walkTo(t.arrive.at);
      links.push({ id: `${t.id}.up`, via: 'spiral', tier: t.id, width: W, hand: t.up.hand, edge: t.up.edge, path, flights, landings, landing: r5(sp.landing), length: r5(sp.s), turns: r5(sp.th / TAU), going: sp.going, ring, a0: t.a0, rcAt: sp.rc });
    } else if (t.form === 'mound' && t.up.via === 'stair') {
      const st = layStair(t, G), W = t.up.width, Rs = st.run + t.summit;
      let face;
      if (!below) {
        const approach = R.approach ?? Math.max(1, t.foot - Rs + 1), foot = [join.at[0] + N[0] * approach, join.at[1] + N[1] * approach];
        t.centre = P([foot[0] + N[0] * Rs, foot[1] + N[1] * Rs]); face = Math.atan2(-N[1], -N[0]); t.approach = approach;
      } else { t.centre = below.centre; face = aArr; }
      t.turnAt = t.sides >= 3 ? face - Math.PI / t.sides : 0; t.a0 = face;
      const out = dirOf(face), inN = P([-out[0], -out[1], 0]), at = (s, z) => P([t.centre[0] + out[0] * (Rs - s), t.centre[1] + out[1] * (Rs - s), t.base + z]);
      const zAt = (s) => { const q = st.runs.find((r) => s >= r.s0 - 1e-9 && s <= r.s1 + 1e-9) || st.runs[st.runs.length - 1]; return q.z0 + ((q.z1 - q.z0) * (s - q.s0)) / Math.max(q.s1 - q.s0, 1e-9); };
      const path = []; for (let s = 0; s <= st.run + 1e-9; s += 0.25) path.push({ s: r5(s), z: r5(t.base + zAt(s)), at: at(s, zAt(s)), kind: 'flight' });
      const piece = (r) => ({ k: r.k, s0: r5(r.s0), s1: r5(r.s1), z0: r5(t.base + r.z0), z1: r5(t.base + r.z1), from: at(r.s0, r.z0), to: at(r.s1, r.z1), mid: at((r.s0 + r.s1) / 2, (r.z0 + r.z1) / 2), N: inN });
      const flights = st.runs.filter((r) => r.kind === 'flight').map((r) => ({ ...piece(r), id: `${t.id}.flight-${r.k}`, risers: st.going.flights[r.k - 1] }));
      const landings = st.runs.filter((r) => r.kind === 'landing').map((r) => ({ ...piece(r), id: `${t.id}.landing-${r.k}`, z: r5(t.base + r.z0), length: r5(r.s1 - r.s0) }));
      t.arrive = { at: at(st.run + 0.6, t.height), N: inN };
      walkTo(path[0].at); for (const q of path) route.push({ at: q.at, kind: q.kind }); walkTo(t.arrive.at);
      links.push({ id: `${t.id}.up`, via: 'stair', tier: t.id, width: W, edge: t.up.edge, path, flights, landings, landing: G.landing, length: r5(st.run), turns: 0, going: st.going, face, start: r5(Rs), at });
    } else {
      // a tower: on the ground past the approach, or on the top below; its climb on the face the walk arrives at
      const half = t.side / 2;
      if (!below) {
        const approach = R.approach ?? 2; t.approach = approach;
        t.centre = P([join.at[0] + N[0] * (approach + half + 0.6), join.at[1] + N[1] * (approach + half + 0.6)]);
      } else t.centre = below.centre;
      const a = below ? aArr : Math.atan2(-N[1], -N[0]), n = dirOf(a), u = [-n[1], n[0]];
      t.turnAt = a; t.half = half;
      t.deckZ = r5(t.base + t.deck); t.railZ = r5(t.deckZ + t.rail); t.eaveZ = r5(t.deckZ + t.eave); t.apexZ = r5(t.eaveZ + t.roof);
      t.n = P([...n, 0]); t.u = P([...u, 0]);
      t.corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([p, q]) => P([t.centre[0] + (n[0] * p + u[0] * q) * half, t.centre[1] + (n[1] * p + u[1] * q) * half, t.base]));
      const faceMid = [t.centre[0] + n[0] * half, t.centre[1] + n[1] * half];
      const climb = { id: `${t.id}.climb`, from: P([faceMid[0] + n[0] * 0.6, faceMid[1] + n[1] * 0.6, t.base]), to: P([faceMid[0], faceMid[1], t.deckZ]), N: P([-n[0], -n[1], 0]), rise: r5(t.deck), link: { ...t.up.link } };
      t.arrive = { at: P([climb.to[0] + climb.N[0] * 0.8, climb.to[1] + climb.N[1] * 0.8, t.deckZ]), N: climb.N };
      walkTo(climb.from); route.push({ at: climb.from, kind: 'climb' }, { at: climb.to, kind: 'climb' }); walkTo(t.arrive.at);
      links.push({ id: `${t.id}.up`, via: 'climb', tier: t.id, climb, length: 0, turns: 0 });
    }
    t.top = r5(t.form === 'tower' ? t.deckZ : t.base + t.height);
    // what the tier stands on, and what it leaves for the next: a mound's summit, a tower's deck
    t.budget = r5(t.form === 'tower' ? t.half - 0.3 : t.summit);
    t.claim = r5(t.form === 'tower' ? Math.SQRT2 * t.half + t.around : t.foot + (t.up.via === 'spiral' ? t.up.width : 0) + 0.5);
    if (t.up.via === 'stair') t.claim = r5(Math.max(t.claim, links[links.length - 1].start + 0.3));
    tiers.push(t); below = t;
  }
  // the route measured: distance walked along it (a climb counts its height)
  let s = 0; route.forEach((q, i) => { if (i) s += Math.hypot(q.at[0] - route[i - 1].at[0], q.at[1] - route[i - 1].at[1], q.kind === 'climb' ? q.at[2] - route[i - 1].at[2] : 0); q.s = r5(s); });

  // the meru: the seam, every landing, every tier's top, a tower's rail, eave and apex — up one axis, in height order
  const marks = [{ name: 'seam', z: z0 }];
  for (const L of links) for (const l of L.landings || []) marks.push({ name: l.id, z: l.z });
  for (const t of tiers) {
    marks.push({ name: t.id, z: t.top });
    if (t.form === 'tower') marks.push({ name: `${t.id}.rail`, z: t.railZ }, ...(t.roofed ? [{ name: `${t.id}.eave`, z: t.eaveZ }, { name: `${t.id}.apex`, z: t.apexZ }] : []));
  }
  const meru = meruMarks(marks.map((m, i) => ({ ...m, z: r5(m.z), i })).sort((a, b) => a.z - b.z || a.i - b.i).map(({ name, z }) => ({ name, z })));

  const id = `local-meru:${R.id}`, first = links[0];
  const footAt = first.via === 'climb' ? first.climb.from : first.path[0].at, footN = first.via === 'climb' ? first.climb.N : first.flights[0].N;
  const anchors = [
    ...(join.from ? [{ id: `junction-${join.site.out.plan.id}-${R.id}`, kind: 'junction', between: [join.from, id], at: join.at, N: join.N, width: first.width || 1.6 }] : []),
    { id: 'foot', kind: 'tier', tier: 'foot', at: footAt, N: first.via === 'spiral' ? join.N : footN, z: z0 },
  ];
  for (const L of links) {
    if (L.via === 'climb') { const c = L.climb; anchors.push({ id: c.id, kind: 'site', site: 'climb', at: P([c.to[0], c.to[1], r5((c.from[2] + c.to[2]) / 2)]), from: c.from, to: c.to, N: c.N, rise: c.rise, link: c.link }); continue; }
    for (const f of L.flights) {
      anchors.push({ id: f.id, kind: 'site', site: 'stairs', at: f.mid, N: f.N, from: f.from, to: f.to, s0: f.s0, s1: f.s1, rise: r5(f.z1 - f.z0),
        going: { risers: f.risers, riser: r5(L.going.R), tread: r5(L.going.T) }, ...(L.via === 'spiral' ? { curve: { centre: P([...tiers.find((q) => q.id === L.tier).centre, f.z0]), radius: f.radius, hand: L.hand } } : {}) });
    }
    for (const l of L.landings) anchors.push({ id: l.id, kind: 'tier', tier: 'landing', beat: 'rest', at: l.mid, N: l.N, z: l.z, length: l.length });
  }
  for (const t of tiers) {
    if (t.form === 'tower') {
      anchors.push({ id: t.id, kind: 'tier', tier: 'deck', at: P([...t.centre, t.deckZ]), z: t.deckZ, area: r5(t.side * t.side) });
      anchors.push({ id: `${t.id}.landmark`, kind: 'beat', beat: 'landmark', at: P([...t.centre, t.apexZ]), node: t.id, solid: true });
    } else anchors.push({ id: t.id, kind: 'tier', tier: 'summit', beat: 'reveal', at: t.arrive.at, N: t.arrive.N, z: t.top, r: t.summit });
  }
  return { recipe: R, join, tiers, links, route, meru, going: goingOf(G, 1), anchors: anchors.map((a) => ({ ...a, level: id })), top: tiers[tiers.length - 1] };
}

/**
 * The ledger. The steps' laws are the man-made index's own (era/out-made.js `steps`), measured on every flight; the
 * rest are the level's, per way up and per tier: the walker steps every riser, a landing is a place to stand, the turns
 * are as asked, the shelves never stack, a fall off an edge is railed, each tier fits on the one below, a stair starts on
 * what it climbs from, a climb is one pull, the top is seen from the seam, the first tier stands past the seam, the
 * join meets its trail. Advice, never a refusal.
 */
export function localMeruLaws(plan) {
  const R = plan.recipe, z0 = plan.join.at[2], out = [];
  const law = (name, want, why, ok, value, from = 'local-meru') => out.push({ law: name, want, why, ok, value, from });
  const walked = plan.links.filter((L) => L.via !== 'climb');
  if (walked.length) {
    const flights = walked.flatMap((L) => L.flights.map((f) => ({ f, g: L.going })));
    const worst = flights.reduce((a, b) => (Math.abs(2 * b.g.R + b.g.T - 0.65) > Math.abs(2 * a.g.R + a.g.T - 0.65) ? b : a));
    for (const l of madeLaws('steps', { blondel: r5(2 * worst.g.R + worst.g.T), R: r5(Math.max(...flights.map((q) => q.g.R))), T: r5(Math.min(...flights.map((q) => q.g.T))), uneven: 0, flight: Math.max(...flights.map((q) => q.f.risers)) })) out.push({ ...l, from: 'out-made:steps' });
    const R0 = Math.max(...flights.map((q) => q.g.R));
    law('step-up', `every riser ≤ the walker's step (${WALKER.step} m)`, 'the platform rule walks up a riser no taller than its step; a taller one is a jump', R0 <= WALKER.step + 1e-9, r5(R0));
  }
  const below = (t) => plan.tiers[plan.tiers.indexOf(t) - 1];
  for (const L of plan.links) {
    const t = plan.tiers.find((q) => q.id === L.tier), tag = (s) => `${L.tier}: ${s}`;
    if (L.via === 'spiral') {
      const W = L.width, Lmin = Math.max(R.going.landing, W);
      if (L.landings.length) law(tag('landing'), `every landing ≥ ${Lmin} m long`, 'a pause between flights is a place to stand, as long as the path is wide', L.landing >= Lmin - 1e-9, L.landing);
      law(tag('turns'), `the spiral turns ${t.up.turns} times`, 'the climb wraps the mound as far as the recipe asks; fewer turns than asked means the flights alone already go further round', Math.abs(L.turns - t.up.turns) < 0.02 || L.flights.length < 2, L.turns);
      const drop = (z) => z - moundHeightAt(t, moundRadius(t, z) + W);
      let stack = Infinity;
      for (const p of L.path) { const q = L.path.find((o) => o.th >= p.th + TAU); if (q) stack = Math.min(stack, q.z - p.z - drop(q.z - t.base)); }
      law(tag('shelves'), 'a turn above clears the edge of the turn below', 'the shelves never stack: from above, every turn is its own ring', stack >= 0, Number.isFinite(stack) ? r5(stack) : 'one turn');
      const maxDrop = r5(Math.max(...L.path.map((p) => drop(p.z - t.base))));
      law(tag('edge'), L.edge === 'rail' ? 'railed: the drop off the edge is guarded' : 'open: no drop over 1 m', 'a fall over 1 m hurts: the man-made index rails a bridge past it', L.edge === 'rail' || maxDrop <= 1, maxDrop);
    }
    if (L.via === 'stair' && below(t)) law(tag('stair-room'), `the stair's foot on ${below(t).id}`, 'a stair starts on what it climbs from, not out over its edge', L.start + 0.3 <= below(t).budget + 1e-9, `${r5(L.start)} in ${below(t).budget}`);
    if (L.via === 'climb') law(tag('one-pull'), 'the climb ≤ 6 m', 'arms tire: a longer climb wants a ledge to rest on', L.climb.rise <= 6 + 1e-9, L.climb.rise);
  }
  for (const t of plan.tiers.slice(1)) {
    const b = below(t);
    law(`${t.id}: fits`, `${t.id} and the walk round it inside ${b.id}'s top`, 'a tier stands on the one below, not over its edge: its claim within that top\'s budget', t.claim <= b.budget + 1e-9, `${t.claim} in ${b.budget}`);
  }
  // the top seen from the seam: eye height there to the top's highest point, clear of every mound on the way
  const top = plan.top, peak = [top.centre[0], top.centre[1], top.form === 'tower' ? (top.roofed ? top.apexZ : top.railZ) : top.top];
  const eye = [plan.join.at[0], plan.join.at[1], z0 + WALKER.height - 0.2];
  let seen = true;
  for (let i = 1; i < 60 && seen; i++) {
    const f = i / 60, p = [0, 1, 2].map((k) => eye[k] + (peak[k] - eye[k]) * f);
    for (const t of plan.tiers) {
      if (t.form !== 'mound' || p[2] >= t.top || p[2] < t.base) continue;
      const a = Math.atan2(p[1] - t.centre[1], p[0] - t.centre[0]), r = Math.hypot(p[0] - t.centre[0], p[1] - t.centre[1]) / planFactor(t.sides, t.turnAt, a);
      if (r < moundRadius(t, p[2] - t.base) - 0.05) { seen = false; break; }
    }
  }
  law('landmark', `${top.id} seen from the seam`, 'where the level begins, the walker sees where it ends', seen, seen ? 'seen' : 'hidden');
  const t0 = plan.tiers[0], N = plan.join.N, seam = plan.join.at;
  // how far the first tier reaches back toward the seam: a mound's foot along that way, a tower's corner
  const back = Math.atan2(-N[1], -N[0]), reach = t0.form === 'mound' ? t0.foot * planFactor(t0.sides, t0.turnAt, back) : Math.SQRT2 * t0.half;
  const clear = (t0.centre[0] - seam[0]) * N[0] + (t0.centre[1] - seam[1]) * N[1] - reach;
  law('clear', `${t0.id} stands past the seam`, 'the level begins where the trail it follows ends: its foot does not spill back over that trail', clear >= -1e-9, r5(clear));
  const fp = plan.route[1].at;
  law('seam', 'the approach starts on the trail it follows: line, heading and height', 'two levels meet where one leaves off, with no step',
    Math.abs((fp[0] - seam[0]) * N[1] - (fp[1] - seam[1]) * N[0]) < 0.01 && Math.abs(fp[2] - seam[2]) < 0.01, 'met');
  return out;
}
