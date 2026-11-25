/**
 * THE BOX'S FOES (a metroidvania level's `foes` beside its box; docs/metroidvania-map.md "Foes"): who haunts each room,
 * as the placements the foe shelf stands (gameworld/foes.js foePlacements `ends.placed`, hostileCast on the lane's rail),
 * so the box's foes are the bestiary's own: their classes, their minds, their skins.
 *
 *   WHO       a region's `foes` (its ring's word: who haunts it), else the level's `from` in turn: a corridor's are its
 *             region's walkers (a class on the ground), a shaft's its flyers (a class with wings: the swooper's dive)
 *   HOW MANY  a corridor or a hall a foe a FOE_EVERY metres of its floor at the box's first region, more as the walk goes
 *             in (RISE more by the last region, the walk's depth), a shaft a flyer in its middle (a region with none to fly, a walker at its
 *             foot); a turn none
 *   WHERE     on its floor, spread along it, never within CLEAR metres of a doorway nor over a hole, facing the way in
 *             (the hero comes through the room's way in); a flyer in its storey's middle
 *   NONE IN   the gate room, a save room, a map room, a boss's room (its boss alone), the throne, a gatehouse: where she
 *             rests, reads, or fights the one she came for
 *
 *   boxPlaced(L, G, from) → [{ id, eid, at: [0, s, z], heading, room }]   (G the box's greybox: its screens, holes and
 *             doorways; `from` the level's bestiary ids, `bestiary` its entries by id to tell a flyer from a walker)
 *   boxEnds(L, G, from, { spawn, bestiary }) → the ends the foe cast reads: { placed, spawn, beats: [], rail: { length } }
 *   CAST_LAWS, castLaws(L, G, placed, { bestiary, hp?, hit? }) → [{ id, holds, says }]   quiet-rooms (none where she rests,
 *             reads or fights the one she came for), stand-clear (none over a hole nor at a doorway), on-their-feet (a
 *             shaft's foes fly, a corridor's walk), rising (the fight never eases going in: each region's threat a screen,
 *             a foe by its rank and an elite THREAT minions, at least EASE of the mean of the regions before it in its box), between-saves (no more foes between two
 *             save rooms than SURVIVE times the hits her health takes: `hp` over `hit`; boxPlaced leaves a stretch's last
 *             foes out past it)
 *   FOE_EVERY, RISE, CLEAR, QUIET
 *
 * Pure: a box and its bestiary make the same foes.
 */
import { FLOOR } from './rooms.js';

/** a corridor's foes: one a FOE_EVERY metres of its floor in the first region, RISE more by the last (the walk's depth,
 * first region to last, whatever their number: the core stands twice the first region's) */
export const FOE_EVERY = 18;
export const RISE = 1;
/** an elite's threat in minions' (the rising law's measure), and the share of the foes between two saves that land a hit
 * on her (the between-saves law's: two in three miss her or are cut first) */
export const THREAT = 3, SURVIVE = 1.5;
/** a region's threat a screen falls at most to this share of the mean of the regions before it in its box */
export const EASE = 0.7;
/** no foe stands within CLEAR metres of a doorway, nor over a hole */
export const CLEAR = 3;
/** no two foes of a floor nearer than APART metres */
export const APART = 3;
/** the rooms that stand no foe: where she rests, reads, or meets the one she came for */
export const QUIET = Object.freeze(['gate', 'save', 'map', 'boss', 'throne', 'gatehouse', 'portcullis']);
const r3 = (v) => Math.round(v * 1000) / 1000;
const FLYING = new Set(['swooper']);

const quiet = (r, L) => r.id === L.entry.room || r.save || r.mapRoom || r.boss || r.role === 'throne' || r.role === 'gatehouse' || r.role === 'portcullis';

/** Who stands where in the box. */
export function boxPlaced(L, G, from, { bestiary = {}, hp = 100, hit = 10 } = {}) {
  if (!from?.length) return [];
  const W = G.screen.width, H = G.screen.height, out = [], walkAt = new Map(L.walk.map((id, k) => [id, k]));
  const flies = (id) => FLYING.has(bestiary[id]?.class);
  const K = Math.max(1, L.rings.length - 1);
  for (const r of L.rooms) {
    if (quiet(r, L) || r.kind === 'turn') continue;
    const R = L.rings[r.ring], who = R.foes ?? from;
    const walkers = who.filter((f) => !flies(f)), flyers = who.filter(flies);
    // (the way in: the door the walk came through, the foes facing it)
    const k = walkAt.get(r.id), prev = k > 0 ? L.rooms.find((x) => x.id === L.walk[k - 1]) : null;
    const inFromRight = prev ? prev.rect[0] > r.rect[0] : false, heading = r3(inFromRight ? Math.PI / 2 : -Math.PI / 2);
    const [c, rr, w, h] = r.rect, floor = rr * H + FLOOR, depth = Math.min(1, r.ring / K);
    if (r.kind === 'shaft') {
      // A SHAFT: a flyer in its middle storey; a region with none to fly, a walker at its foot
      if (flyers.length) { const j = Math.floor(h / 2); out.push({ id: `${r.id}-f1`, eid: flyers[r.ring % flyers.length], at: [0, r3((c + w / 2) * W), r3((rr + j) * H + FLOOR + H * 0.4)], heading, room: r.id }); continue; }
      if (!walkers.length) continue;
      const holesAt = (G.holes ?? []).filter((q) => Math.abs(q.z - rr * H) < 1e-3 && q.s1 > c * W && q.s0 < (c + w) * W), s = [0.3, 0.7].map((k) => r3((c + k * w) * W)).find((x) => holesAt.every((q) => x < q.s0 - 1 || x > q.s1 + 1));
      if (s !== undefined) out.push({ id: `${r.id}-w1`, eid: walkers[r.ring % walkers.length], at: [0, s, r3(floor)], heading, room: r.id });
      continue;
    }
    // A CORRIDOR: walkers spread along its floor, more the deeper the region; clear of its doorways and its holes
    if (!walkers.length) continue;
    const s0 = c * W, s1 = (c + w) * W, n = Math.max(1, Math.round(((s1 - s0) / FOE_EVERY) * (1 + RISE * depth)));
    const doors = (G.doorways ?? []).filter((d) => d.s >= s0 - 1 && d.s <= s1 + 1 && Math.abs(d.z0 - floor) < 0.5).map((d) => d.s);
    const holes = (G.holes ?? []).filter((q) => Math.abs(q.z - rr * H) < 1e-3 && q.s1 > s0 && q.s0 < s1);
    const free = (s) => doors.every((d) => Math.abs(d - s) >= CLEAR) && holes.every((q) => s < q.s0 - 1 || s > q.s1 + 1) && s > s0 + CLEAR && s < s1 - CLEAR;
    // (spread: each foe its share of the floor, then the quarter-shares between where those are taken; kept apart)
    const tries = [];
    for (const off of [0.5, 0.25, 0.75]) for (let q = 0; q < n; q++) tries.push(r3(s0 + ((q + off) / n) * (s1 - s0)));
    const at = [];
    for (const s of tries) {
      if (at.length >= n) break;
      if (!free(s) || at.some((x) => Math.abs(x - s) < APART)) continue;
      at.push(s);
    }
    at.sort((a, b) => a - b).forEach((s, q) => out.push({ id: `${r.id}-w${q + 1}`, eid: walkers[(q + r.ring + Math.round(depth * 2)) % walkers.length], at: [0, s, r3(floor)], heading, room: r.id }));
  }
  // (and no more between two saves than her health takes, castLaws' between-saves: walked in order from each save, a
  // room's last foes past it are left out)
  const most0 = Math.floor((SURVIVE * hp) / hit), drop = new Set(), byId = new Map(L.rooms.map((r) => [r.id, r]));
  let since = 0;
  for (const id of L.walk) {
    if (byId.get(id)?.save) since = 0;
    const mine = out.filter((p) => p.room === id), room = Math.max(0, most0 - since);
    for (const p of mine.slice(room)) drop.add(p.id);
    since += Math.min(mine.length, room);
  }
  return drop.size ? out.filter((p) => !drop.has(p.id)) : out;
}

/** What the foe cast reads of a box. */
export function boxEnds(L, G, from, { spawn, bestiary = {} } = {}) {
  return { placed: boxPlaced(L, G, from, { bestiary }).map(({ room, ...p }) => p), spawn, beats: [], rail: { length: r3(L.box[0] * G.screen.width) } };
}

export const CAST_LAWS = Object.freeze(['quiet-rooms', 'stand-clear', 'on-their-feet', 'rising', 'between-saves']);

/** The cast's laws, measured on its placements. */
export function castLaws(L, G, placed, { bestiary = {}, hp = 100, hit = 10 } = {}) {
  const out = [], law = (id, holds, says) => out.push({ id, holds: !!holds, says });
  const room = new Map(L.rooms.map((r) => [r.id, r])), W = G.screen.width, H = G.screen.height;
  const loud = placed.filter((p) => quiet(room.get(p.room), L)).map((p) => p.room);
  law('quiet-rooms', !loud.length, loud.length ? `foes where she rests or reads: ${[...new Set(loud)].join(', ')}` : 'no foe in a gate, save, map or boss room, nor at the throne');
  const near = placed.filter((p) => {
    const r = room.get(p.room), z = r.rect[1] * H;
    return (G.holes ?? []).some((q) => Math.abs(q.z - z) < 1e-3 && p.at[1] > q.s0 - 0.5 && p.at[1] < q.s1 + 0.5) || (G.doorways ?? []).some((d) => Math.abs(d.z0 - p.at[2]) < 0.5 && Math.abs(d.s - p.at[1]) < CLEAR - 1e-3);
  }).filter((p) => room.get(p.room).kind !== 'shaft');
  law('stand-clear', !near.length, near.length ? `standing over a hole or at a doorway: ${near.map((p) => p.id).slice(0, 4).join(', ')}` : `every foe ${CLEAR} m and more from a doorway, none over a hole`);
  const flies = (p) => FLYING.has(bestiary[p.eid]?.class);
  const wrong = placed.filter((p) => (room.get(p.room).kind !== 'shaft' && flies(p)) || (room.get(p.room).kind === 'shaft' && !flies(p) && Math.abs(p.at[2] - (room.get(p.room).rect[1] * H + FLOOR)) > 0.01)).map((p) => p.id);
  law('on-their-feet', !wrong.length, wrong.length ? `out of their element: ${wrong.slice(0, 4).join(', ')}` : 'a shaft\'s foes fly (or one walks at its foot), a corridor\'s and a hall\'s walk');
  // (the foes a screen in each region of the walk, its rooms that stand any)
  // (its THREAT a screen: each foe by its rank, an elite THREAT times a minion)
  const threat = (p) => (bestiary[p.eid]?.rank === 'elite' ? THREAT : 1);
  const rate = L.rings.map((g) => { const rs = L.rooms.filter((r) => r.ring === g.i && !quiet(r, L) && r.kind !== 'turn'), cells = rs.reduce((n, r) => n + r.cells.length, 0); return cells ? placed.filter((p) => room.get(p.room).ring === g.i).reduce((n, p) => n + threat(p), 0) / cells : null; });
  // (each region's threat against the mean of the regions before it in its box: never far below what came before)
  const falls = [], before = new Map();
  rate.forEach((v, k) => {
    const g = L.rings[k];
    if (v === null || g.connector) return;
    const xs = before.get(g.box) ?? [], mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    if (mean !== null && v < mean * EASE - 1e-9) falls.push(g.place);
    before.set(g.box, [...xs, v]);
  });
  law('rising', !falls.length, falls.length ? `the fight eases going in at ${falls.join(', ')}` : 'the fight\'s threat a screen rises (or holds) region by region going in');
  let since = 0, most = 0;
  for (const id of L.walk) { if (room.get(id).save) since = 0; since += placed.filter((p) => p.room === id).length; most = Math.max(most, since); }
  const most0 = Math.floor((SURVIVE * hp) / hit);
  law('between-saves', most <= most0, `at most ${most} foes between two save rooms (at most ${most0}: her ${hp} health takes ${Math.floor(hp / hit)} hits, a hit from two foes in three)`);
  return CAST_LAWS.map((id) => out.find((l) => l.id === id));
}
