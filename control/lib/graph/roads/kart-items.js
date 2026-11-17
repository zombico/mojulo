/**
 * A KART RACE'S ITEMS — boxes on the way that hand a racer something to use, and the things they hand out. The genre's
 * mystery box: a row of them across the way, each a glossy rounded cube with a "?" in it, turning and bobbing, its
 * shell lit at its rim in colours that run round it (a fresnel), so it reads at a distance as a thing to drive at.
 * Driving through one takes an item if the racer holds none; the box pops and comes back after `back` seconds.
 *
 *   ITEMS   the shelf (original to mojulo, in the candy family's words; a new item is a row of a known kind):
 *     sugar-rush  boost   a burst of speed the moment it is used (the drive rule's boost: rules-drive.js `boostT`)
 *     toffee      trap    a sticky blob dropped behind: a kart that drives over it is slowed and wobbles
 *     gumball     shot    a ball rolled ahead down the track's own line: the kart it meets is knocked and spun
 *   readItems(v) → the options a track's `items` says (true, false, or { every?, across?, back?, odds? }), or null
 *   itemRows(plan, opts) → [{ s, boxes: [[x, y, z]] }]   rows across the way on the straights, never on the grid
 *   itemTable(plan, opts) → { boxes, r, back, kinds, odds } | null   the page's table (a drive surface's `items`)
 *   kartItemsStep(S, karts, dt) → effects   pure and import-free: the page embeds its source as it is
 *     S       the race's item state: { T (the table), seed, box: [seconds till back], held: { id: kind }, traps, shots,
 *             spin: { id: seconds } } (made by `itemState`)
 *     karts   [{ id, pos: [x, y, z], heading, speed, use, ai, line? }] (`use`: the racer pressed its item this frame)
 *     → [{ id, boost? , slow?, spin? }] what happened to whom this frame (the page lays it on the drive rule's entity)
 *   itemState(T, seed) → the state a race starts with
 *
 * A rival uses what it holds: a boost on a straight at once, a toffee when a kart is close behind it, a gumball when
 * one is ahead in reach (or each after a while, so nothing is held for the whole race).
 *
 * Pure, seeded (its own dice in the state).
 */
const r3 = (v) => Math.round(v * 1000) / 1000;

export const ITEMS = Object.freeze({
  'sugar-rush': Object.freeze({ kind: 'boost', says: 'sugar rush', seconds: 1.8, hex: '#ffd03a' }),
  toffee: Object.freeze({ kind: 'trap', says: 'toffee', r: 1.5, slow: 0.4, spin: 0.7, life: 30, hex: '#d9892b' }),
  gumball: Object.freeze({ kind: 'shot', says: 'gumball', speed: 30, r: 0.55, life: 3.5, slow: 0.25, spin: 1.1, hex: '#ff4f86' }),
});
/** How the boxes are laid and how often each item comes out of one. */
export const ITEM_BOXES = Object.freeze({ every: 170, least: 30, clear: 40, across: 4, size: 1.4, lift: 1.05, r: 1.5, back: 2.5,
  odds: Object.freeze({ 'sugar-rush': 0.45, gumball: 0.3, toffee: 0.25 }) });

/** A track's `items` checked: true (the boxes as ITEM_BOXES lays them), false or none, or { every?, across?, back?,
 *  odds? } (odds: { <item>: weight } over the shelf's items). → the options, or null; throws on a bad one. */
export function readItems(v) {
  if (v === undefined || v === null || v === false) return null;
  if (v === true) return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error('roadway: items is true, false or { every?, across?, back?, odds? }');
  for (const k of Object.keys(v)) if (!['every', 'across', 'back', 'odds'].includes(k)) throw new Error(`roadway: items.${k} is not an item setting (every, across, back, odds)`);
  for (const k of ['every', 'across', 'back']) if (v[k] !== undefined && !(Number.isFinite(v[k]) && v[k] > 0)) throw new Error(`roadway: items.${k} is a number over 0`);
  if (v.odds !== undefined) for (const [id, w] of Object.entries(v.odds)) { if (!ITEMS[id]) throw new Error(`roadway: items.odds names '${id}', not an item (${Object.keys(ITEMS).join(', ')})`); if (!(Number.isFinite(w) && w >= 0)) throw new Error(`roadway: items.odds.${id} is a weight, 0 or more`); }
  return { ...v };
}

/** The rows of boxes: on the straights, a row every `every` metres or so, each `across` boxes over the way's width. */
export function itemRows(plan, opts = {}) {
  const O = { ...ITEM_BOXES, ...opts }, a = plan.alignment, L = a.length, X = plan.X, st = plan.stations;
  // (a straight is where the line runs without a corner's curvature: the stations' own k)
  const straight = (s) => Math.abs(a.at(((s % L) + L) % L).k) < 1 / 300;
  const want = Math.max(1, Math.round(L / O.every)), rows = [];
  for (let k = 0; k < want; k++) {
    // (a row where its share of the lap falls, then on to the first straight from there that runs `least` metres)
    let s = O.clear + ((L - 2 * O.clear) * (k + 0.5)) / want;
    for (let tries = 0; tries < 80 && !(straight(s) && straight(s + O.least) && straight(s - 6)); tries++) s += 4;
    if (s > L - O.clear || rows.some((r) => Math.abs(r.s - s) < O.every * 0.4)) continue;
    const q = a.at(s), lane = (2 * X.road) / O.across;
    const boxes = Array.from({ length: O.across }, (_, i) => { const off = -X.road + lane * (i + 0.5); return [r3(q.x - Math.sin(q.heading) * off), r3(q.y + Math.cos(q.heading) * off), r3(q.z + O.lift)]; });
    rows.push({ s: r3(s), boxes });
  }
  void st;
  return rows;
}

/** The page's table: the boxes, how near takes one, how soon one comes back, the items and their odds. */
export function itemTable(plan, opts = {}) {
  const O = { ...ITEM_BOXES, ...opts }, rows = itemRows(plan, O);
  if (!rows.length) return null;
  const odds = Object.entries(O.odds).filter(([id]) => ITEMS[id]);
  return { boxes: rows.flatMap((r) => r.boxes), r: O.r, back: O.back, size: O.size,
    kinds: Object.fromEntries(odds.map(([id]) => [id, { ...ITEMS[id] }])), odds: odds.map(([id, w]) => [id, w]) };
}

/** The state a race's items start in. */
export function itemState(T, seed = 1) {
  return { T, seed: (seed >>> 0) || 1, box: T.boxes.map(() => 0), held: {}, traps: [], shots: [], spin: {}, since: {} };
}

/**
 * One step of the race's items. Self-contained (the page embeds this function's source): its dice are the state's own
 * (a mulberry32), and every helper is inside it.
 */
export function kartItemsStep(S, karts, dt) {
  const T = S.T, out = [];
  const dice = () => { S.seed = (S.seed + 0x6d2b79f5) >>> 0; let t = S.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = () => { let total = 0; for (const o of T.odds) total += o[1]; let u = dice() * total; for (const o of T.odds) { u -= o[1]; if (u <= 0) return o[0]; } return T.odds[T.odds.length - 1][0]; };
  const hit = (k, I) => { out.push({ id: k.id, slow: I.slow, spin: I.spin }); S.spin[k.id] = I.spin; };
  // the boxes: back after their time; a kart through one takes an item if it holds none (the box pops either way)
  for (let i = 0; i < T.boxes.length; i++) {
    if (S.box[i] > 0) { S.box[i] = Math.max(0, S.box[i] - dt); continue; }
    const b = T.boxes[i];
    for (const k of karts) {
      if (Math.hypot(k.pos[0] - b[0], k.pos[1] - b[1]) > T.r || Math.abs(k.pos[2] - b[2]) > 3) continue;
      S.box[i] = T.back;
      if (!S.held[k.id]) { S.held[k.id] = pick(); S.since[k.id] = 0; out.push({ id: k.id, took: S.held[k.id] }); }
      break;
    }
  }
  for (const k in S.spin) { S.spin[k] = Math.max(0, S.spin[k] - dt); if (!S.spin[k]) delete S.spin[k]; }
  // using: the racer's press, or a rival's judgement
  const fwd = (k) => [Math.cos(k.heading), Math.sin(k.heading)];
  for (const k of karts) {
    const id = S.held[k.id];
    if (!id) continue;
    S.since[k.id] = (S.since[k.id] || 0) + dt;
    const I = T.kinds[id];
    let go = !!k.use;
    if (k.ai && !go) {
      const f = fwd(k), rel = (o) => { const dx = o.pos[0] - k.pos[0], dy = o.pos[1] - k.pos[1]; return { along: dx * f[0] + dy * f[1], across: Math.abs(-dx * f[1] + dy * f[0]) }; };
      const others = karts.filter((o) => o !== k).map(rel);
      if (I.kind === 'boost') go = S.since[k.id] > 0.6;
      else if (I.kind === 'trap') go = others.some((q) => q.along < -2 && q.along > -16 && q.across < 4) || S.since[k.id] > 8;
      else go = others.some((q) => q.along > 4 && q.along < 30 && q.across < 3) || S.since[k.id] > 10;
    }
    if (!go) continue;
    delete S.held[k.id];
    const f = fwd(k);
    if (I.kind === 'boost') out.push({ id: k.id, boost: I.seconds, used: id });
    else if (I.kind === 'trap') { S.traps.push({ at: [k.pos[0] - f[0] * 2.4, k.pos[1] - f[1] * 2.4, k.pos[2]], id, life: I.life, by: k.id, arm: 0.4 }); out.push({ id: k.id, used: id }); }
    else { S.shots.push({ at: [k.pos[0] + f[0] * 2.4, k.pos[1] + f[1] * 2.4, k.pos[2] + I.r], v: Math.max(I.speed, (k.speed || 0) + 12), heading: k.heading, id, life: I.life, by: k.id, arm: 0.25, line: k.line || null }); out.push({ id: k.id, used: id }); }
  }
  // the traps: a kart over one is slowed and wobbles, and the trap is spent
  for (let i = S.traps.length - 1; i >= 0; i--) {
    const q = S.traps[i], I = T.kinds[q.id];
    q.life -= dt; q.arm = Math.max(0, q.arm - dt);
    if (q.life <= 0) { S.traps.splice(i, 1); continue; }
    if (q.arm > 0) continue;
    const k = karts.find((o) => Math.hypot(o.pos[0] - q.at[0], o.pos[1] - q.at[1]) < I.r + 0.6);
    if (k) { hit(k, I); S.traps.splice(i, 1); }
  }
  // the shots: rolled ahead along the track's line (its points: the line's, [x, y, heading, …] every few metres), the
  // first kart met knocked and spun; a shot that meets a trap takes it with it
  for (let i = S.shots.length - 1; i >= 0; i--) {
    const q = S.shots[i], I = T.kinds[q.id];
    q.life -= dt; q.arm = Math.max(0, q.arm - dt);
    if (q.life <= 0) { S.shots.splice(i, 1); continue; }
    const P = T.line;
    if (P && P.length >= 8) {
      // (the line's point nearest the shot, and the heading a little on from it: the shot leans toward the line)
      let best = 0, bd = Infinity;
      for (let j = 0; j < P.length; j += 4) { const d = (P[j] - q.at[0]) ** 2 + (P[j + 1] - q.at[1]) ** 2; if (d < bd) { bd = d; best = j; } }
      const n = P.length, ahead = (best + 16) % n, want = Math.atan2(P[ahead + 1] - q.at[1], P[ahead] - q.at[0]);
      let dh = want - q.heading; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      q.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
    }
    q.at[0] += Math.cos(q.heading) * q.v * dt; q.at[1] += Math.sin(q.heading) * q.v * dt;
    const t = S.traps.findIndex((o) => Math.hypot(o.at[0] - q.at[0], o.at[1] - q.at[1]) < T.kinds[o.id].r + I.r);
    if (t >= 0) { S.traps.splice(t, 1); S.shots.splice(i, 1); continue; }
    if (q.arm > 0) continue;
    const k = karts.find((o) => Math.hypot(o.pos[0] - q.at[0], o.pos[1] - q.at[1]) < I.r + 1.1);
    if (k) { hit(k, I); S.shots.splice(i, 1); }
  }
  return out;
}
