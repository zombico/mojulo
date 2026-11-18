/**
 * THE ARENA MAP'S LAWS — the core principles of a fighting map, each measured on the map's own grid (map.js) in the
 * game's own numbers (the kit: the run, the bands its guns are for). Each is one fact of line-of-sight combat and what
 * it asks of a map; held together they are what a generator is allowed to make (generate.js), so a map of any blocks
 * that holds them all plays. Advice, never a refusal: a law not held says what, where, and what would mend it.
 *
 *   PRINCIPLES            { <law>: { group, why, asks } }   the table: structure, access, sight, economy
 *   kitOf(brief?)         → { run, bands, longest, want }   the numbers a map is sized from (a mission's brief, or a person's)
 *   furnish(I, V, kit)    → { spawns: [[i, j, k]], items: [{ at, gives, major }] }   where the map's own shape puts them
 *   mapLaws(M, kit?)      → { laws: [{ law, group, holds, n, says }], held, of, short, mend, furnished, measures }
 *                           (short: how far the sight and spawn laws are from held, for a search to climb)
 *
 * Pure, no dice: what is placed is read off the map (the least seen cells spawn, the most seen holds the prize).
 */
import { CELL, RISE } from './blocks.js';
import { indexMap, visibility, distances, key, centre } from './map.js';
import { BANDS, BAND_IDS } from '../mission/sections.js';

export const PRINCIPLES = Object.freeze({
  // STRUCTURE: the plan is a circuit
  bounded: { group: 'structure', why: 'a fight is held on the map: nothing walks or falls off it', asks: 'a wall or a rail round the map\'s edge on every floor: what stops a body' },
  connected: { group: 'structure', why: 'a body set down anywhere can reach everywhere, and come back', asks: 'every standing place reached from every other (a drop counts one way only)' },
  loops: { group: 'structure', why: 'a line of sight is also a line of retreat: a place with one way in is a trap for who is in it and a fortress for who holds its door', asks: 'no part of the map hangs off a single way (an alcove of a cell or two aside)' },
  // ACCESS: nothing built runs into anything
  ramps: { group: 'access', why: 'a ramp that meets a wall, a floor or a ceiling is a way that is not one', asks: 'a landing at each end that leads on, its cells clear of mass, no floor over them, no wall across its line, a slope a body walks' },
  ladders: { group: 'access', why: 'a ladder is a way up only if its shaft is open and its ledge is stood on', asks: 'a floor at its foot, nothing over the foot, a ledge at its top that leads on, no wall along the ledge' },
  drops: { group: 'access', why: 'dropping is the fast way down: free, one way, and never a fall out of the game', asks: 'every open edge of an upper floor over a place to land, a body\'s drop or less below; else a rail' },
  'levels-twice': { group: 'access', why: 'the loop, stood on end: a level with one way up is a fortress', asks: 'two ways up to every upper floor, one of them a ramp (a body on a ladder cannot fight), a drop being a way down only' },
  // SIGHT: range picks the gun, exposure prices the place
  'line-cap': { group: 'sight', why: 'a line longer than any carried gun is for is dead ground, and one line across the map owns it', asks: 'the longest clear line no longer than the longest band carried, and long enough to use it' },
  'range-mix': { group: 'sight', why: 'each gun wins at its own range: a map with one range is a map for one gun', asks: 'a share of the floor whose longest line is in each band the kit carries a gun for' },
  'break-near': { group: 'sight', why: 'with no cover to crouch behind, safety is a step out of sight', asks: 'from most places, against most who see them, a place a second\'s run away that they do not see' },
  'height-paid': { group: 'sight', why: 'high ground sees more and shows less; free, it is simply where everyone stands', asks: 'every upper floor seen from at least as many places as the floor below is, on average' },
  // ECONOMY: equal starts, advantage on the map
  spawns: { group: 'economy', why: 'a body comes back equal and unseen, with a choice of ways', asks: 'spawns out of each other\'s sight and out of sight of the prizes, each with two ways on' },
  items: { group: 'economy', why: 'no one holds everything: control is a route run, and the best thing is in the most seen place', asks: 'the prizes far apart, the first of them among the most seen places of the map' },
  lap: { group: 'economy', why: 'the map is as big as its clock: a lap of the prizes is about the time one takes to come back', asks: 'the round of the prizes run in a quarter to three quarters of a minute' },
});
export const LAW_IDS = Object.freeze(Object.keys(PRINCIPLES));

const r1 = (v) => Math.round(v * 10) / 10;
const LIMITS = { alcove: 2, share: 0.12, broken: 0.75, lap: [12, 45], apart: 4 * CELL, spawns: 4, majors: ['armour', 'weapon', 'health'] };

/** The numbers a map is sized from: a mission's brief (mission/brief.js), or a person with a gun for the near bands. */
export function kitOf(brief = null) {
  const bands = brief ? BAND_IDS.filter((b) => brief.serves[b]) : ['close', 'mid'], top = bands[bands.length - 1] ?? 'mid';
  return { run: brief?.run ?? 4.6, bands, longest: BANDS[top].reach[1], want: BANDS[top].reach[0] };
}
const bandOf = (d) => (d < BANDS.close.reach[1] ? 'close' : d < BANDS.mid.reach[1] ? 'mid' : 'long');

/** Where the map's own shape puts its spawns and its things. */
export function furnish(I, V, kit) {
  const n = V.n, ground = [...Array(n).keys()].filter((x) => V.at[x][2] === 0 && I.und.get(V.ids[x]).length >= 2);
  const D = new Map(), dist = (x) => { if (!D.has(x)) D.set(x, distances(I, V.ids[x])); return D.get(x); }, d = (a, b) => dist(a).get(V.ids[b]) ?? Infinity;
  const sees = (a, b) => V.vis[a * n + b] === 1;
  // spawns: the least seen first, then each the farthest from those chosen that none of them sees
  const spawns = [];
  const byQuiet = [...ground].sort((a, b) => V.seenBy[a] - V.seenBy[b] || a - b);
  if (byQuiet.length) spawns.push(byQuiet[0]);
  while (spawns.length < LIMITS.spawns) {
    const far = (x) => Math.min(...spawns.map((s) => Math.min(d(s, x), d(x, s))));
    const pool = ground.filter((x) => !spawns.includes(x)), unseen = pool.filter((x) => spawns.every((s) => !sees(s, x)));
    const from = unseen.length ? unseen : pool;
    if (!from.length) break;
    spawns.push(from.reduce((m, x) => (far(x) > far(m) + 1e-9 ? x : m)));
  }
  // the prizes: the first where the most see it (not from a spawn if it can be helped), each next the farthest from those laid
  const all = [...Array(n).keys()].filter((x) => !spawns.includes(x)), quiet = all.filter((x) => spawns.every((s) => !sees(s, x)));
  const pool = quiet.length >= LIMITS.majors.length ? quiet : all, items = [];
  if (pool.length) {
    const first = pool.reduce((m, x) => (V.seenBy[x] > V.seenBy[m] ? x : m));
    const laid = [first];
    while (laid.length < LIMITS.majors.length) {
      const far = (x) => Math.min(...laid.map((s) => Math.min(d(s, x), d(x, s)))), rest = pool.filter((x) => !laid.includes(x));
      if (!rest.length) break;
      laid.push(rest.reduce((m, x) => (far(x) > far(m) + 1e-9 ? x : m)));
    }
    laid.forEach((x, q) => items.push({ at: V.at[x], gives: LIMITS.majors[q], major: true, x }));
    // the small things: the least seen places, a few cells from anything laid
    const small = all.filter((x) => !laid.includes(x)).sort((a, b) => V.seenBy[a] - V.seenBy[b] || a - b), took = [...laid];
    for (const x of small) {
      if (items.length >= LIMITS.majors.length + 4) break;
      if (took.every((t) => Math.hypot(V.at[t][0] - V.at[x][0], V.at[t][1] - V.at[x][1]) >= 2 || V.at[t][2] !== V.at[x][2])) { took.push(x); items.push({ at: V.at[x], gives: items.length % 2 ? 'ammo' : 'health', major: false, x }); }
    }
  }
  return { spawns: spawns.map((x) => V.at[x]), spawnIdx: spawns, items, d };
}

// the bridges of the two-way ways (a way whose loss cuts the map), each with the size of its smaller side
function bridges(I) {
  const ids = I.nodes, num = new Map(), low = new Map(), size = new Map(), out = [];
  let t = 0;
  const visit = (root) => {
    const stack = [[root, null, 0]];
    num.set(root, ++t); low.set(root, t); size.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1], [a, parent] = top, nb = I.und.get(a);
      if (top[2] < nb.length) {
        const b = nb[top[2]++];
        if (b === parent && !top[3]) { top[3] = true; continue; }
        if (!num.has(b)) { num.set(b, ++t); low.set(b, t); size.set(b, 1); stack.push([b, a, 0]); }
        else low.set(a, Math.min(low.get(a), num.get(b)));
      } else {
        stack.pop();
        if (parent != null) {
          low.set(parent, Math.min(low.get(parent), low.get(a))); size.set(parent, size.get(parent) + size.get(a));
          if (low.get(a) > num.get(parent)) out.push({ a: parent, b: a, side: size.get(a) });
        }
      }
    }
    return size.get(root);
  };
  for (const id of ids) if (!num.has(id)) { const total = visit(id); for (const b of out) if (b.total == null) b.total = total; }
  return out.map((b) => ({ ...b, small: Math.min(b.side, b.total - b.side) }));
}

/** The laws, measured (see the header). */
export function mapLaws(M, kit = kitOf()) {
  const I = indexMap(M), V = visibility(I), F = furnish(I, V, kit), laws = [], n = V.n;
  const law = (id, faults, ok, extra = '') => { const list = Array.isArray(faults) ? faults : [], bad = Array.isArray(faults) ? list.length : faults; laws.push({ law: id, group: PRINCIPLES[id].group, holds: !bad, n: bad, says: bad ? `${list.length ? list.slice(0, 3).join('; ') + (list.length > 3 ? `; and ${list.length - 3} more` : '') : extra}` : ok }); };
  // BOUNDED
  const open = [];
  for (const id of V.ids) {
    const c = I.at.get(id);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const b = [c[0] + di, c[1] + dj];
      if (b[0] >= 0 && b[1] >= 0 && b[0] < M.nx && b[1] < M.ny) continue;
      const w = I.wallAt(c, b, c[2]);
      // (a wall or a rail: what stops a body. A yard fenced round is bounded as a walled one is)
      if (!w) open.push(`${c} is open to the outside`);
    }
  }
  law('bounded', open, 'walled or railed round its edge on every floor');
  // CONNECTED: out from one place and back to it
  const first = I.nodes[0], out = first ? distances(I, first) : new Map(), back = new Map();
  if (first) {
    const rev = new Map(I.nodes.map((id) => [id, []]));
    for (const a of I.nodes) for (const e of I.adj.get(a)) rev.get(e.to).push(a);
    const q = [first]; back.set(first, 0);
    while (q.length) { const a = q.pop(); for (const b of rev.get(a)) if (!back.has(b)) { back.set(b, 1); q.push(b); } }
  }
  const cut = I.nodes.filter((id) => !out.has(id) || !back.has(id));
  law('connected', cut.length ? [`${cut.length} standing place${cut.length === 1 ? '' : 's'} not reached, or not come back from (the first: ${cut[0]})`] : [], `all ${I.nodes.length} standing places reach each other`);
  // LOOPS
  const hang = bridges(I).filter((b) => b.small > LIMITS.alcove).map((b) => `${b.small} places hang off the one way between ${b.a} and ${b.b}`);
  law('loops', hang, 'no part of the map hangs off a single way');
  // ACCESS
  const of = (kind) => I.connectors.filter((c) => c.kind === kind);
  law('ramps', of('ramp').flatMap((c) => c.faults.map((f) => `ramp ${c.n} ${f}`)), `${of('ramp').length} ramp${of('ramp').length === 1 ? '' : 's'}, each with its landings, its opening and its line clear`);
  law('ladders', of('ladder').flatMap((c) => c.faults.map((f) => `ladder ${c.n} ${f}`)), `${of('ladder').length} ladder${of('ladder').length === 1 ? '' : 's'}, each with its foot, its shaft and its ledge clear`);
  law('drops', I.dropFaults, 'every open edge of an upper floor is over a place to land');
  law('levels-twice', [...I.platforms.filter((p) => p.up < 2).map((p) => `a floor of ${p.cells.length} cell${p.cells.length === 1 ? '' : 's'} on level ${p.level} has ${p.up} way${p.up === 1 ? '' : 's'} up (${p.cells[0]})`),
    ...I.platforms.filter((p) => p.up >= 2 && !p.walked).map((p) => `the floor at ${p.cells[0]} is reached by ladders alone: one of its ways up is a ramp (a body on a ladder cannot fight)`)], I.platforms.length ? `${I.platforms.length} upper floor${I.platforms.length === 1 ? '' : 's'}, two ways up to each` : 'one level: nothing to climb');
  // SIGHT
  const longest = n ? Math.max(...V.far) : 0;
  law('line-cap', longest > kit.longest + 1e-6 ? [`the longest clear line is ${r1(longest)} m and the longest band carried reaches ${kit.longest} m: break it`] : longest < kit.want ? [`the longest clear line is ${r1(longest)} m and the longest band carried starts at ${kit.want} m: open one`] : [], `the longest clear line is ${r1(longest)} m (the kit's longest band: ${kit.want} to ${kit.longest} m)`);
  const share = Object.fromEntries(BAND_IDS.map((b) => [b, 0]));
  for (let x = 0; x < n; x++) share[bandOf(V.far[x])] += 1 / Math.max(1, n);
  // (a place whose longest line is in a farther band serves the nearer ones too: it fights at any range up to it)
  // (close quarters are read off a place's typical line, not its longest: a room with one long line out of a door is
  // still fought across the room)
  const CLOSE = BANDS.close.reach[1], upTo = (b) => BAND_IDS.slice(BAND_IDS.indexOf(b)).reduce((s, q) => s + share[q], 0), near = n ? [...V.typical].filter((t) => t < CLOSE).length / n : 0;
  const thin = [...(kit.bands.includes('close') && near < LIMITS.share ? [`${Math.round(near * 100)}% of the floor is close quarters (its lines ${CLOSE} m long or less, typically): a close gun wants ${Math.round(LIMITS.share * 100)}%`] : []),
    ...kit.bands.filter((b) => b !== 'close' && upTo(b) < LIMITS.share).map((b) => `${Math.round(upTo(b) * 100)}% of the floor has a line in the ${b} band: its gun wants ${Math.round(LIMITS.share * 100)}%`)];
  law('range-mix', thin, `${Math.round(near * 100)}% of the floor is close quarters; by its longest line: ${BAND_IDS.map((b) => `${Math.round(share[b] * 100)}% ${b}`).join(', ')}`);
  // BREAK-NEAR: against each one who sees a place, a place a second's run off that they do not see
  const reach = Math.max(2 * CELL, kit.run * 1.3);
  let pairs = 0, safe = 0;
  for (let c = 0; c < n; c++) {
    const near = [], D = distances(I, V.ids[c]);
    for (const [id, m] of D) if (m <= reach && V.index.has(id)) near.push(V.index.get(id));
    for (let d = 0; d < n; d++) { if (!V.vis[c * n + d]) continue; pairs++; if (near.some((e) => !V.vis[d * n + e])) safe++; }
  }
  const broken = pairs ? safe / pairs : 1;
  law('break-near', broken < LIMITS.broken ? [`from ${Math.round(broken * 100)}% of the lines a body is caught in, a step out of sight is within ${r1(reach)} m: ${Math.round(LIMITS.broken * 100)}% is asked (pillars, corners, a wall panel in the open floors)`] : [], `${Math.round(broken * 100)}% of the lines a body is caught in are broken within ${r1(reach)} m`);
  // HEIGHT-PAID
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0), base = mean([...Array(n).keys()].filter((x) => V.at[x][2] === 0).map((x) => V.seenBy[x]));
  const free = I.platforms.map((p) => ({ p, seen: mean(p.cells.map((id) => V.seenBy[V.index.get(id)])) })).filter((x) => x.seen < base).map((x) => `the floor at ${x.p.cells[0]} (level ${x.p.level}) is seen from ${r1(x.seen)} places and the ground from ${r1(base)}: it is a bunker (open its edges, rail it instead of walling it)`);
  law('height-paid', free, I.platforms.length ? `every upper floor is seen from as many places as the ground (${r1(base)} on average)` : 'one level: no high ground');
  // ECONOMY
  const S = F.spawnIdx, sp = [];
  if (S.length < 2) sp.push(`${S.length} spawn${S.length === 1 ? '' : 's'}: no place on the ground with two ways on`);
  for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) if (V.vis[S[a] * n + S[b]]) sp.push(`the spawns at ${V.at[S[a]]} and ${V.at[S[b]]} see each other`);
  const majors = F.items.filter((x) => x.major);
  for (const s of S) for (const m of majors) if (V.vis[s * n + m.x]) sp.push(`the spawn at ${V.at[s]} sees the ${m.gives} at ${m.at}`);
  law('spawns', sp, `${S.length} spawns, none in sight of another or of a prize`);
  const it = [];
  if (majors.length < 2) it.push(`${majors.length} prize${majors.length === 1 ? '' : 's'} laid: the floor is too small to keep them apart`);
  for (let a = 0; a < majors.length; a++) for (let b = a + 1; b < majors.length; b++) { const m = Math.min(F.d(majors[a].x, majors[b].x), F.d(majors[b].x, majors[a].x)); if (m < LIMITS.apart) it.push(`the ${majors[a].gives} and the ${majors[b].gives} are ${r1(m)} m apart: ${LIMITS.apart} m is asked`); }
  if (majors.length) { const rank = [...V.seenBy].sort((a, b) => b - a), third = rank[Math.floor(n / 3)] ?? 0; if (V.seenBy[majors[0].x] < third) it.push(`the ${majors[0].gives} is in a quiet place (seen from ${V.seenBy[majors[0].x]}): the first prize stands where the most see it`); }
  law('items', it, `${majors.length} prizes, ${LIMITS.apart} m or more apart, the ${majors[0]?.gives ?? 'first'} where the most see it`);
  let lap = 0;
  for (let a = 0; a < majors.length; a++) lap += F.d(majors[a].x, majors[(a + 1) % majors.length].x);
  const secs = majors.length > 1 && Number.isFinite(lap) ? lap / kit.run : 0;
  law('lap', secs < LIMITS.lap[0] ? [`the round of the prizes is ${r1(secs)} s of the run: ${LIMITS.lap[0]} s or more is asked (a bigger floor, the prizes on different levels)`] : secs > LIMITS.lap[1] ? [`the round of the prizes is ${r1(secs)} s of the run: ${LIMITS.lap[1]} s or less is asked (a smaller floor, a way across)`] : [], `the round of the prizes is ${r1(secs)} s of the run`);
  const held = laws.filter((l) => l.holds).length;
  // how far the sight laws are from held, as one number a search can climb (the laws themselves are yes or no)
  // (the lines too long: every place's excess over the cap, summed; close quarters: how far the quietest eighth of the
  // floor is from a close line; so a panel that shortens any of them counts before the law itself turns)
  const fars = [...V.far], eighth = [...V.typical].sort((a, b) => a - b).slice(0, Math.max(1, Math.ceil(n * LIMITS.share)));
  const over = fars.reduce((t, f) => t + Math.max(0, f - kit.longest), 0) / Math.max(1, n), tight = kit.bands.includes('close') ? eighth.reduce((t, f) => t + Math.max(0, f - BANDS.close.reach[1]), 0) / eighth.length : 0;
  const short = 10 * over + Math.max(0, kit.want - longest) + 100 * Math.max(0, LIMITS.broken - broken) + 10 * tight + 3 * sp.length;
  return { laws, held, of: laws.length, short: Math.round(short * 100) / 100, furnished: { spawns: F.spawns, items: F.items.map(({ at, gives, major }) => ({ at, gives, major })) },
    // WHAT A REPAIR MENDS (generate.js): the lines to break (those over the cap, the longest first; a spawn's line to
    // another spawn or to a prize), the open edges to rail, the upper floors no ramp reaches
    mend: {
      lines: [...[...Array(n).keys()].filter((x) => V.far[x] > kit.longest && V.farTo[x] >= 0).sort((a, b) => V.far[b] - V.far[a]).slice(0, 24).map((x) => [V.at[x], V.at[V.farTo[x]]]),
        ...S.flatMap((a, q) => [...S.slice(q + 1), ...majors.map((m) => m.x)].filter((b) => V.vis[a * n + b]).map((b) => [V.at[a], V.at[b]]))],
      rails: I.dropEdges,
      unwalked: I.platforms.filter((p) => !p.walked || p.up < 2).map((p) => p.cells.map((id) => I.at.get(id))),
    },
    measures: { places: n, levels: M.nz, longest: r1(longest), close: Math.round(near * 100) / 100, share: Object.fromEntries(BAND_IDS.map((b) => [b, Math.round(share[b] * 100) / 100])), broken: Math.round(broken * 100) / 100, lap: r1(secs), platforms: I.platforms.length, ramps: of('ramp').length, ladders: of('ladder').length } };
}
