/**
 * THE MISSION'S PHASES ON A MAP — a shooter's first level fought on a fighting map (generate.js, held to the laws), not
 * walked down a line. The firing range decides the rules (the brief's guns, their bands, the run, the hold's clock:
 * mission/brief.js); the map decides where. Every place is read off the map's own measures (map.js: what stands, what
 * walks to what and how far, what sees what; laws.js furnish: its spawns and its prizes), so another map is another
 * mission and the same map and seed the same one.
 *
 *   the start   the player set down on one of the map's spawns, the one farthest from the heart (the dice between the
 *               two farthest)
 *   arm up      (take) the small thing nearest that spawn by walking, a few steps off
 *   clear       one a band the brief's sections ask (contact close, lane mid, overwatch long): its foes woken out of
 *               sight of where the body stands as it begins, at that band's distance by walking or by the line where
 *               the map allows, spread over different approaches and levels
 *   hold        at the heart (the first prize's place: the most seen on the map), its waves woken out of the heart's
 *               sight on the spawns and the quiet places, coming in by different ways and levels; it begins as the
 *               last clear is met, wherever the body is (a zone would begin nothing for a body already in it)
 *   get out     (reach) the spawn farthest from the heart by a way the mission has not yet walked
 *   (what lies on the floor, and a place a take or a reach is met at, stands only in a cell with no floor over or under
 *   it: the runtime's zones read a place flat, so one under a gallery would be taken from the floor below)
 *
 *   phasesOnMap(brief, map, { seed?, at?, start?, exits? }) → the composition the mission level consumes
 *     (gameworld/mission-level.js; start: the cell the body is set down on, in place of the far spawn, where it stands on
 *     the map and reaches the heart, as a building's way in; exits: the cells a way out may be, in place of the spawns,
 *     as a building's doors: gameworld/mission-building.js):
 *     { on: 'map', seed, heading, sections: [{ id, kind, band, entry, foes: [{ id, at, heading }], drops, task, door: null,
 *       zone: null, cells }], primitives: [], anchors: { spawn, exit }, heart, start, cells }   (cells: the map's cells
 *     each place stands in, for the laws and a player that walks the map's own graph)
 *   phaseLaws(P, map) → [{ law, holds, says }]   advice, never a refusal:
 *     placed      every place the mission names stands on the map and is reached from the start
 *     unseen      no foe is woken in sight of where the body stands as its phase begins, within the close band
 *     two-ways    the hold's waves come in by two different ways at least
 *     in-order    it teaches before it tests: arm up first, the bands near to far, the hold after them, the way out last
 *     banded      each clear's foes stand at its band from where its phase begins, walked or seen (where the map allows)
 *   mapRoute(I, from, to) → [node ids] the shortest way the map gives from one node to another (drops one way), or null
 *   nodeAt(I, pos, eye?)  → the node a body at `pos` stands on (a ramp's cell included)
 *
 * Pure; seeded dice only.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { CELL, RISE } from './blocks.js';
import { indexMap, visibility, key, centre } from './map.js';
import { kitOf, furnish } from './laws.js';
import { mapPoint } from './ground.js';
import { SECTIONS, BANDS, BAND_IDS } from '../mission/sections.js';

const r2 = (v) => Math.round(v * 100) / 100;
const euclid = (a, b) => { const A = centre(a), B = centre(b); return Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]); };
const count = (kind, brief) => Math.max(1, Math.min(8, Math.round(SECTIONS[kind].foes * (brief.scale ?? 1))));
// a body's own phases of the brief: what each section is on a map
const ROLE = { take: 'arm', clear: 'clear', hold: 'hold', reach: 'out' };
// (how far out of the heart a way is read: the node this many steps out on the way in)
const OUT = 2;

/** The walk from a node: metres to each node reached and the node each was reached from. */
function walkFrom(I, from) {
  const D = new Map([[from, 0]]), prev = new Map(), open = [from];
  while (open.length) {
    let m = 0;
    for (let x = 1; x < open.length; x++) if (D.get(open[x]) < D.get(open[m])) m = x;
    const a = open.splice(m, 1)[0], da = D.get(a);
    for (const e of I.adj.get(a)) { const d = da + e.cost; if (!D.has(e.to) || d < D.get(e.to) - 1e-9) { if (!D.has(e.to)) open.push(e.to); else if (!open.includes(e.to)) open.push(e.to); D.set(e.to, d); prev.set(e.to, a); } }
  }
  return { D, prev, from };
}
const routeTo = (W, to) => { if (!W.D.has(to)) return null; const out = [to]; while (out[0] !== W.from && W.prev.has(out[0])) out.unshift(W.prev.get(out[0])); return out; };

/** The shortest way between two nodes, or null. */
export function mapRoute(I, from, to) { return from === to ? [from] : routeTo(walkFrom(I, from), to); }

/** The node a body at `pos` (its eye `eye` over its feet) stands on: the standable cell under it, or the ramp's cell. */
export function nodeAt(I, pos, eye = 0, at = [0, 0, 0]) {
  const x = pos[0] - at[0], y = pos[1] - at[1], foot = pos[2] - eye - at[2], i = Math.floor(x / CELL), j = Math.floor(y / CELL);
  let best = null, bd = Infinity;
  for (const id of I.nodes) {
    const c = I.at.get(id);
    if (c[0] !== i || c[1] !== j) continue;
    const z = c[2] * RISE, d = Math.abs(foot - z);
    if (z <= foot + 1.2 && d < bd) { bd = d; best = id; }
  }
  return best;
}

/** The phases on the map (see the header). */
export function phasesOnMap(brief, map, { seed = 1, at = [0, 0, 0], start: startAt = null, exits = null } = {}) {
  if (!brief || !Array.isArray(brief.sections)) throw new Error('arena-map: phases want a mission brief (mission/brief.js missionBrief)');
  const rnd = mulberry32(seed | 0), I = indexMap(map), V = visibility(I), kit = kitOf(brief), F = furnish(I, V, kit), n = V.n;
  const idOf = (c) => key(...c), cellOf = (id) => I.at.get(id), pt = (id) => mapPoint(cellOf(id), at);
  const sees = (a, b) => { const x = V.index.get(a), y = V.index.get(b); return x != null && y != null && V.vis[x * n + y] === 1; };
  const walks = new Map(), walk = (id) => { if (!walks.has(id)) walks.set(id, walkFrom(I, id)); return walks.get(id); };
  const far = (a, b) => walk(a).D.get(b) ?? Infinity;
  // (a place a thing lies or a task is met in is read flat by the runtime's zones, objectives' and supplies', planar: so
  // it is laid only in a cell with no other floor over or under it, where flat is the same as there)
  const column = new Map();
  for (const id of V.ids) { const c = cellOf(id), k2 = `${c[0]},${c[1]}`; column.set(k2, (column.get(k2) ?? 0) + 1); }
  const alone = (id) => column.get(`${cellOf(id)[0]},${cellOf(id)[1]}`) === 1;
  const heart = F.items.find((x) => x.major) ? idOf(F.items.find((x) => x.major).at) : V.ids[V.seenBy.indexOf(Math.max(...V.seenBy))];
  // THE START: a spawn far from the heart (the two farthest, the dice between them)
  const spawns = F.spawns.map(idOf).filter((id) => Number.isFinite(far(id, heart)));
  const byFar = [...(spawns.length ? spawns : V.ids)].sort((a, b) => far(b, heart) - far(a, heart) || (a < b ? -1 : 1));
  const pick = byFar[Math.min(byFar.length - 1, Math.floor(rnd() * Math.min(2, byFar.length)))];
  // (a start asked for, a building's way in, where it stands and reaches the heart: the body is set down there)
  const asked = startAt ? idOf(startAt) : null, start = asked && V.index.has(asked) && Number.isFinite(far(asked, heart)) ? asked : pick;
  const used = new Set(), taken = new Set([start, heart]);
  const walked = (a, b) => { for (const id of mapRoute(I, a, b) ?? []) used.add(id); };
  const sections = [];
  let here = start, foeN = 0;
  const foe = (id, from) => { const p = pt(id), q = pt(from); return { id: `foe-${++foeN}`, at: p, heading: r2(Math.atan2(q[1] - p[1], q[0] - p[0])), cell: cellOf(id) }; };

  for (const kind of brief.sections) {
    const row = SECTIONS[kind], role = ROLE[row.task] ?? 'clear', entry = pt(here), out = { id: kind, kind, band: row.band, entry, foes: [], drops: [], door: null, zone: null };
    if (role === 'arm') {
      // the small thing nearest the start by walking, a few steps off it (so walking to it is walking: a take begun
      // inside its own place is never met)
      const small = F.items.filter((x) => !x.major).map((x) => idOf(x.at)).filter((id) => !taken.has(id) && alone(id) && far(here, id) >= CELL && Number.isFinite(far(here, id)));
      const near = [...(small.length ? small : V.ids.filter((id) => !taken.has(id) && alone(id) && far(here, id) >= CELL && far(here, id) <= 3 * CELL))].sort((a, b) => far(here, a) - far(here, b) || (a < b ? -1 : 1));
      const it = near[0] ?? here;
      taken.add(it); walked(here, it);
      out.drops.push({ at: pt(it), gives: 'ammo' });
      out.task = { kind: 'take', text: row.text, at: pt(it) };
      out.cells = { at: cellOf(it) };
      here = it;
    } else if (role === 'clear') {
      // its foes at the band from where the body stands as it begins, out of its sight, spread over approaches and levels
      const B = BANDS[row.band ?? 'mid'], W = walk(here), k = count(kind, brief), chosen = [];
      const approach = (id) => { const r = routeTo(W, id); return r ? r[Math.min(OUT, r.length - 1)] : id; };
      const pool = V.ids.filter((id) => !taken.has(id) && W.D.has(id) && id !== here);
      for (let q = 0; q < k && pool.length; q++) {
        let best = null, bs = Infinity;
        for (const id of pool) {
          if (chosen.includes(id)) continue;
          const d = W.D.get(id), l = euclid(cellOf(here), cellOf(id)), inWalk = d >= B.reach[0] && d <= B.reach[1], inLine = l >= B.reach[0] && l <= B.reach[1];
          const fit = inWalk ? 0 : inLine ? 1 : 2 + Math.min(Math.abs(d - B.m), Math.abs(l - B.m)) / B.m;
          const seen = sees(here, id) ? (l <= BANDS.close.reach[1] ? 40 : 8) : 0;
          const sameWay = chosen.filter((c) => approach(c) === approach(id)).length, sameLevel = chosen.length && chosen.every((c) => cellOf(c)[2] === cellOf(id)[2]) ? 1 : 0;
          const spread = chosen.length ? Math.min(...chosen.map((c) => euclid(cellOf(c), cellOf(id)))) : 12;
          const s = fit * 10 + seen + sameWay * 3 + sameLevel - Math.min(spread, 12) / 4 + rnd() * 0.5;
          if (s < bs) { bs = s; best = id; }
        }
        if (!best) break;
        chosen.push(best); taken.add(best);
      }
      out.foes = chosen.map((id) => foe(id, here));
      out.task = { kind: row.task, text: row.text, foes: out.foes.map((f) => f.id) };
      // (the fight ends where its last foe stood: the farthest by walking, where the body is when the next begins)
      const last = [...chosen].sort((a, b) => W.D.get(b) - W.D.get(a))[0] ?? here;
      out.cells = { from: cellOf(here), foes: chosen.map(cellOf) };
      walked(here, last); here = last;
    } else if (role === 'hold') {
      // the heart: its waves out of its sight, the spawns first, by different ways and levels
      walked(here, heart);
      const W = walk(heart), way = (id) => { const r = routeTo(W, id); return r ? r[Math.min(OUT, r.length - 1)] : id; };
      const yard = BANDS[brief.yard ?? 'mid'], k = count(kind, brief), spawnSet = new Set(F.spawns.map(idOf));
      const pool = V.ids.filter((id) => id !== heart && id !== start && W.D.has(id) && !sees(heart, id) && W.D.get(id) >= yard.reach[0]);
      const waves = [], ways = new Map();
      for (let w = 0; w < brief.waves; w++) {
        const wave = [];
        for (let q = 0; q < k && pool.length; q++) {
          let best = null, bs = Infinity;
          for (const id of pool) {
            if (wave.includes(id)) continue;
            const s = (spawnSet.has(id) ? 0 : 2) + (ways.get(way(id)) ?? 0) * 3 + (wave.some((c) => cellOf(c)[2] === cellOf(id)[2]) ? 1 : 0) + Math.abs(W.D.get(id) - 2 * yard.m) / yard.m + rnd() * 0.5;
            if (s < bs) { bs = s; best = id; }
          }
          if (!best) break;
          wave.push(best); ways.set(way(best), (ways.get(way(best)) ?? 0) + 1);
        }
        if (wave.length) waves.push(wave);
      }
      const W2 = waves.map((wv) => wv.map((id) => foe(id, heart)));
      out.foes = W2.flat();
      out.task = { kind: 'hold', text: row.text, seconds: brief.hold, every: r2(brief.hold / (brief.waves + 1)), waves: W2.map((wv) => wv.map((f) => f.id)), at: pt(heart) };
      out.cells = { at: cellOf(heart), waves: waves.map((wv) => wv.map(cellOf)), ways: [...ways.keys()].map(cellOf) };
      // what lies at the heart for the hold: the map's first prize, read as the mission's health and rounds
      if (alone(heart)) out.drops.push({ at: pt(heart), gives: 'health' });
      here = heart;
    } else {
      // the way out: the spawn farthest from the heart, by a way not walked yet (the start's last)
      const W = walk(here), fresh = (id) => (routeTo(W, id) ?? []).slice(OUT).filter((x) => used.has(x)).length;
      // (the ways out asked for, a building's doors, where any is reached: one of those, by the same measure)
      const doors = (exits ?? []).map(idOf).filter((id) => W.D.has(id));
      const pool0 = doors.length ? doors : [...F.spawns.map(idOf).filter((id) => id !== start && W.D.has(id)), ...(W.D.has(start) ? [start] : [])], pool = pool0.some(alone) ? pool0.filter(alone) : pool0;
      const exit = [...pool].sort((a, b) => (W.D.get(b) - CELL * 2 * fresh(b)) - (W.D.get(a) - CELL * 2 * fresh(a)) || (a < b ? -1 : 1))[0] ?? here;
      out.task = { kind: 'reach', text: row.text, at: pt(exit) };
      out.cells = { at: cellOf(exit), fresh: fresh(exit) };
      here = exit;
    }
    sections.push(out);
  }
  // the map's other things on its floor from the start: its prizes and small things, as rounds and health
  const lying = new Set(sections.flatMap((S) => S.drops.map((d) => d.at.join(','))));
  for (const x of F.items) { const p = mapPoint(x.at, at); if (alone(idOf(x.at)) && !lying.has(p.join(',')) && sections[0]) { sections[0].drops.push({ at: p, gives: x.gives === 'health' ? 'health' : 'ammo' }); lying.add(p.join(',')); } }
  const exitS = sections.findLast((S) => S.task?.kind === 'reach'), H = pt(heart), S0 = pt(start);
  return {
    on: 'map', seed, heading: r2(Math.atan2(H[1] - S0[1], H[0] - S0[0])), sections, primitives: [],
    anchors: { spawn: S0, exit: exitS ? exitS.task.at : pt(here) }, heart: H, start: cellOf(start), cells: { start: cellOf(start), heart: cellOf(heart) },
  };
}

/** The phases' laws (see the header). */
export function phaseLaws(P, map) {
  const I = indexMap(map), V = visibility(I), n = V.n, laws = [], law = (id, holds, says) => laws.push({ law: id, holds, says });
  const sees = (a, b) => { const x = V.index.get(key(...a)), y = V.index.get(key(...b)); return x != null && y != null && V.vis[x * n + y] === 1; };
  const W = walkFrom(I, key(...P.cells.start));
  // PLACED
  const named = [['the start', P.cells.start], ...P.sections.flatMap((S) => [...(S.cells?.at ? [[S.id, S.cells.at]] : []), ...(S.cells?.foes ?? []).map((c) => [`${S.id}'s foe`, c]), ...(S.cells?.waves ?? []).flat().map((c) => [`${S.id}'s wave`, c])])];
  const lost = named.filter(([, c]) => !I.standable(...c) || !W.D.has(key(...c))).map(([w, c]) => `${w} at ${c}`);
  law('placed', !lost.length, lost.length ? `not stood on, or not reached from the start: ${lost.slice(0, 4).join('; ')}` : `every place it names (${named.length}) stands on the map and is reached from the start`);
  // UNSEEN
  const close = BANDS.close.reach[1], woke = [];
  for (const S of P.sections) {
    const from = S.task?.kind === 'hold' ? S.cells.at : S.cells?.from, list = S.task?.kind === 'hold' ? S.cells.waves.flat() : S.cells?.foes ?? [];
    if (!from) continue;
    for (const c of list) if (sees(from, c) && euclid(from, c) <= close) woke.push(`${S.id}: a foe at ${c}, ${r2(euclid(from, c))} m in sight`);
  }
  law('unseen', !woke.length, woke.length ? `woken in sight within the close band (${close} m): ${woke.slice(0, 3).join('; ')}` : `no foe is woken in sight within ${close} m of where its phase begins`);
  // TWO-WAYS
  const hold = P.sections.find((S) => S.task?.kind === 'hold');
  if (hold) law('two-ways', hold.cells.ways.length >= 2, hold.cells.ways.length >= 2 ? `the hold's waves come in by ${hold.cells.ways.length} ways` : `the hold's waves come in by ${hold.cells.ways.length} way: the heart wants two approaches out of its sight (a bigger map, or another template)`);
  // IN-ORDER
  const kinds = P.sections.map((S) => S.task?.kind), bands = P.sections.filter((S) => S.task?.kind === 'clear').map((S) => BAND_IDS.indexOf(S.band)), faults = [];
  if (kinds[0] !== 'take') faults.push('it does not begin by arming up');
  if (bands.some((b, i) => i && b < bands[i - 1])) faults.push('the bands are not met near to far');
  if (hold && kinds.indexOf('hold') < kinds.lastIndexOf('clear')) faults.push('the hold comes before a clear');
  if (kinds[kinds.length - 1] !== 'reach') faults.push('it does not end at a way out');
  law('in-order', !faults.length, faults.length ? faults.join('; ') : 'it teaches before it tests: arm up, the bands near to far, the hold, the way out');
  // BANDED
  const off = [];
  for (const S of P.sections.filter((x) => x.task?.kind === 'clear')) {
    const B = BANDS[S.band ?? 'mid'], Wf = walkFrom(I, key(...S.cells.from));
    for (const c of S.cells.foes) { const d = Wf.D.get(key(...c)) ?? Infinity, l = euclid(S.cells.from, c); if (!((d >= B.reach[0] && d <= B.reach[1]) || (l >= B.reach[0] && l <= B.reach[1]))) off.push(`${S.id}: a foe ${r2(Math.min(d, l))} m off (the ${S.band} band is ${B.reach[0]} to ${B.reach[1]} m)`); }
  }
  law('banded', !off.length, off.length ? `out of band (the map is too small or too closed for it): ${off.slice(0, 3).join('; ')}` : 'each clear\'s foes stand at its band from where its phase begins');
  return laws;
}
