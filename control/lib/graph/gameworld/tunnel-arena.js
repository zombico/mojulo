/**
 * THE ARENA TUNNEL — a match's arena tunnelled from a few words ("a tight three-lane arena with long sightlines") into a
 * PLAN the arena concern lays (lay-concerns.js arenaLayout), never a fixed map. Scapeshift's loop (tunnel.js): the words
 * are read into traits, each pulls a setting of the layout grammar, the layout is built and assessed against each
 * trait's measure and the arena's laws (lay-concerns.js arenaLaws: routes loop, spawns unseen, cover near, no line
 * across), and what fails is tweaked inside its rails, a bounded number of passes, every pass logged.
 *
 * The grammar, in the arena's own frame (u across, v along, the centre at 0, 0); everything it stands is the same
 * turned half round the centre (a piece at (u, v) has its partner at (-u, -v)), so neither side has the better ground:
 *   wall     round the floor, 3 m high
 *   lanes    `lanes` (2 to 4) lanes split by dividers along v, open at both ends (`gapEnd`) and the middle (`gapMid`), so
 *            every way loops; a blocker across each lane's middle, a way round it either side
 *   ring     a court in the middle (`court`, of half the side) walled round with a doorway on each side (`gapMid`), the
 *            floor round it the loop
 *   crates   `many` (0 to 1) of them, at seeded places off the walls and the spawns' ring, one or two high
 *   supplies by risk: health where the fewest see (a pocket), armor and the overdrive where the most do (contested),
 *            rounds between
 *   weapons  (asked, weapon-roles.js) each gun the arena's sightlines serve where its band's lines meet: the close gun
 *            where the clear lines are short, the long gun where they are long; one its lines hardly fall in is not laid
 *   stagger  (close quarters) a blocker at each lane's quarters against alternate sides, and the dividers' middle gaps
 *            offset: the way zig-zags and no line runs a lane or crosses them all
 *   breaks   short walls the tweak stands across a line the laws found (a spawn seen, a line across), where the floor
 *            is most open, each with its partner; one that cut a way is taken away and never stood there again: the
 *            laws shape the arena, not a hand
 *
 *   bases    (a team map) two bases at the ends, the second the first turned half round, no spawn of one in sight of
 *            the other's
 *
 * A trait the grammar cannot show is a GAP, named with what would close it (a figure of eight, a mirror, capture the
 * flag, floors and high ground), never filled silently.
 *
 *   ARENA_TRAITS                              the traits, by the words that name them
 *   composeArena(candidate, seed)             → { half, pieces } the grammar's layout
 *   arenaDomain()                             → a tunnel domain
 *   tunnelArena(intent, { seed, spawns, weapons, teams })   → the tunnel's record; its plan { half, pieces, spawns,
 *                                               drops, longest, armory?, bases? } (armory: each asked role's share of the
 *                                               clear lines; bases: each side's spawns, by index)
 *
 * Pure; seeded dice only.
 */
import { tunnel } from './tunnel.js';
import { ARENA, arenaAsks, arenaSpawns, arenaBases, arenaLongest, arenaSightlines, askBoxes, concernLaws, lineBlocked } from './lay-concerns.js';
import { WEAPON_ROLES, bandShare, servedRoles } from './weapon-roles.js';
import { mulberry32 } from '../vegetation/grow.js';

const r2 = (v) => Math.round(v * 100) / 100;
const clone = (v) => JSON.parse(JSON.stringify(v));
const S = (words, read, set) => ({ words, read, set });
const G = (words, read, gap) => ({ words, read, gap });

// the grammar's rails
const RAILS = Object.freeze({ half: [12, 26], lanes: [2, 4], gapEnd: [2.5, 6], gapMid: [3, 8], court: [0.25, 0.45], many: [0, 1] });
const clamp = (k, v) => Math.max(RAILS[k][0], Math.min(RAILS[k][1], v));

/** What the words ask, and what each sets in the grammar. */
export const ARENA_TRAITS = Object.freeze({
  small: S(['small', 'tight', 'compact', 'little', 'cramped'], 'small: 26 m across', { half: 13 }),
  medium: S(['medium', 'mid-size', 'midsize'], 'medium: 36 m across', { half: 18 }),
  large: S(['large', 'big', 'huge', 'wide', 'sprawling', 'vast'], 'large: 48 m across', { half: 24 }),
  'two-lanes': S(['two lanes', 'two-lane', '2 lanes', 'two-lanes'], 'two lanes, side by side', { topology: 'lanes', lanes: 2 }),
  'three-lanes': S(['three lanes', 'three-lane', '3 lanes', 'three-lanes', 'lanes', 'lane'], 'three lanes: a middle and two flanks', { topology: 'lanes', lanes: 3 }),
  'four-lanes': S(['four lanes', 'four-lane', '4 lanes', 'four-lanes'], 'four lanes', { topology: 'lanes', lanes: 4 }),
  ring: S(['ring', 'loop', 'courtyard', 'court', 'atrium', 'donut', 'circle', 'circuit'], 'a walled court in the middle, the floor round it a loop', { topology: 'ring' }),
  dense: S(['cluttered', 'dense', 'crates', 'busy', 'crowded', 'warehouse'], 'dense: cover everywhere', { many: 0.85 }),
  sparse: S(['sparse', 'open', 'bare', 'empty', 'minimal'], 'sparse: little cover between the walls', { many: 0.1 }),
  close: S(['close quarters', 'close-quarters', 'cqb', 'corridors', 'claustrophobic'], 'close quarters: no line much longer than half the floor', { sight: 'close' }),
  long: S(['long sightlines', 'long sightline', 'sniper', 'snipers', 'long-range', 'long range', 'sightlines'], 'long sightlines: a lane that runs most of the floor', { sight: 'long' }),
  'figure-eight': G(['figure eight', 'figure-eight', 'figure-8', 'eight'], 'two loops sharing a crossing', { why: 'the grammar lays lanes or one court; a figure of eight is two loops through one crossing', proposal: 'a topology `eight`: two courts side by side, their doorways facing across a shared middle' }),
  team: S(['team', 'teams', 'bases', 'two sides', 'team deathmatch', 'tdm', 'control point', 'king of the hill', 'objective'], 'a team map: a base at each end, the floor turned half round so neither side has the better ground', { teams: 2 }),
  mirror: G(['mirrored', 'mirror', 'mirror-image'], 'two halves mirrored across the middle', { why: 'a mirror hands one side the right-hand peeks into the other (the peeks-fair law counts them): a team map here is turned half round its centre instead, each base at an end, which is as fair and keeps the peeks even', proposal: 'a mirror whose wall ends are set so each side peeks the other as often from its gun\'s side' }),
  ctf: G(['ctf', 'capture the flag', 'flags', 'flag'], 'capture the flag: a flag at each base', { why: 'a flag carried is a body following a body: the cast cannot yet carry one (a team map and a control point are laid)', proposal: 'a `carry` op on the cast (a thing held to a body, dropped where it falls) and a capture mechanic over it' }),
  floors: G(['floors', 'multi-level', 'storeys', 'stories', 'towers', 'tower', 'balcony', 'balconies', 'bridges', 'high ground', 'ramps'], 'more than one floor: high ground, ramps, a bridge', { why: 'the arena is one floor: the minds path on one floor at a time (nav.js)', proposal: 'raised platforms on ramps (stairs from era/storeys.js), and a nav that joins floors by their flights' }),
});

/** The grammar's layout for a candidate: { half, pieces } in the arena's own frame. */
export function composeArena(c, seed = 1) {
  const H = c.half, P = [];
  const wall = (u, v, along, length, height = 2.2, thick) => P.push({ form: 'wall', u: r2(u), v: r2(v), along, length: r2(length), height, ...(thick ? { thick } : {}) });
  const pair = (u, v, along, length, height) => { wall(u, v, along, length, height); if (Math.abs(u) > 1e-9 || Math.abs(v) > 1e-9) wall(-u, -v, along, length, height); };
  // the wall round it
  wall(0, H, 'u', 2 * H + 0.6, ARENA.wall, 0.6); wall(0, -H, 'u', 2 * H + 0.6, ARENA.wall, 0.6);
  wall(H, 0, 'v', 2 * H, ARENA.wall, 0.6); wall(-H, 0, 'v', 2 * H, ARENA.wall, 0.6);
  const lanes = [];
  if (c.topology === 'ring') {
    const R = c.court * 2 * H, seg = (2 * R - c.gapMid) / 2;
    // the court's four sides, each two pieces either side of its doorway
    for (const s of [1, -1]) {
      wall(s * (c.gapMid / 2 + seg / 2), R, 'u', seg, ARENA.wall); wall(s * (c.gapMid / 2 + seg / 2), -R, 'u', seg, ARENA.wall);
      wall(R, s * (c.gapMid / 2 + seg / 2), 'v', seg, ARENA.wall); wall(-R, s * (c.gapMid / 2 + seg / 2), 'v', seg, ARENA.wall);
    }
    // a pillar in the court (a crate stack), no line through its doorways
    P.push({ form: 'crate', u: 0, v: 0, stack: 2 });
    lanes.push({ u0: R, u1: H, mid: (R + H) / 2 });
  } else {
    const n = c.lanes, w = (2 * H) / n;
    for (let k = 1; k < n; k++) {
      const u = r2(-H + k * w);
      // staggered, a divider's middle gap is offset (up one side of the centre, down the other, so its turned partner
      // matches): the gaps no longer line up across the lanes
      const g = c.stagger ? -Math.sign(u) * H / 4 : 0, lo = -H + c.gapEnd, hi = H - c.gapEnd, a = g - c.gapMid / 2, b = g + c.gapMid / 2;
      if (a - lo > 1) wall(u, (lo + a) / 2, 'v', a - lo, ARENA.wall);
      if (hi - b > 1) wall(u, (b + hi) / 2, 'v', hi - b, ARENA.wall);
    }
    // a blocker across each lane's middle: round it either side
    for (let j = 0; j < n; j++) {
      const uc = -H + (j + 0.5) * w, u0 = -H + j * w, u1 = u0 + w;
      wall(uc, 0, 'u', Math.min(Math.abs(uc) < 1e-9 ? 4 : 6, w * 0.5));
      // STAGGERED: a blocker at each quarter against alternate sides, so the way zig-zags and no line runs the lane
      if (c.stagger) { wall(u0 + 0.3 * w, H / 2, 'u', w * 0.6); wall(u1 - 0.3 * w, -H / 2, 'u', w * 0.6); }
      lanes.push({ u0, u1, mid: uc });
    }
  }
  for (const [u, v, along, length] of c.breaks ?? []) pair(u, v, along, length);
  // crates at seeded places, off the walls and the spawns' ring, in turned pairs
  const dice = mulberry32((seed * 7919 + 13) >>> 0), boxes = () => askBoxes(arenaAsks(P, (u, v) => [u, v, 0]));
  const want = Math.round(1 + 6 * c.many);
  for (let tries = 0, put = 0; put < want && tries < want * 30; tries++) {
    const u = r2(-H + 4 + dice() * (2 * H - 8)), v = r2(1.5 + dice() * (H - 5.5)), stack = dice() < 0.5 ? 1 : 2;
    const near = (x, y) => boxes().some((B) => x > B.min[0] - 1.6 && x < B.max[0] + 1.6 && y > B.min[1] - 1.6 && y < B.max[1] + 1.6);
    if (near(u, v) || near(-u, -v)) continue;
    P.push({ form: 'crate', u, v, stack }, { form: 'crate', u: -u, v: -v, stack });
    put++;
  }
  return { half: H, pieces: P, lanes };
}

// the floor point (a 2 m grid inside the wall) farthest from any box: where cover is wanted most
function barest(built) {
  const H = built.half, boxes = askBoxes(built.blocks);
  const dist = (u, v) => Math.min(...boxes.map((B) => Math.hypot(Math.max(B.min[0] - u, 0, u - B.max[0]), Math.max(B.min[1] - v, 0, v - B.max[1]))));
  let best = [0, 0], bd = -1;
  for (let u = -H + 3; u <= H - 3; u += 2) for (let v = 1; v <= H - 3; v += 2) { const d = dist(u, v); if (d > bd) { bd = d; best = [u, v]; } }
  return best;
}

// the supplies, placed by RISK: every free spot on the floor (2 m apart, clear of the boxes and the spawns) is scored
// by how much of the floor sees it (a 4 m grid, eye to eye). Health goes where the fewest see (a pocket to recover in),
// armor and the overdrive where the most do (contested: worth a fight), rounds between. Each a turned pair, no two
// within 4 m. Asked `weapons` (roles the arena serves), each gun goes where the clear lines from it fall most in its
// band, after the rest. → [{ u, v, gives, seen, slot? }] (seen: the share of the floor that sees it)
function arenaDrops(built, c, weapons = []) {
  const H = c.half, boxes = askBoxes(arenaAsks(built.pieces, (u, v) => [u, v, 0]));
  const free = (u, v) => !boxes.some((B) => u > B.min[0] - 1 && u < B.max[0] + 1 && v > B.min[1] - 1 && v < B.max[1] + 1) && !built.spawns.some((s) => Math.hypot(s[0] - u, s[1] - v) < 3);
  const eyes = [];
  for (let u = -H + 2; u <= H - 2; u += 4) for (let v = -H + 2; v <= H - 2; v += 4) if (free(u, v)) eyes.push([u, v, 1.6]);
  const spots = [];
  for (let u = -H + 2; u <= H - 2; u += 2) for (let v = 1; v <= H - 2; v += 2) {
    if (!free(u, v) || !free(-u, -v)) continue;
    const clear = eyes.filter((e) => !lineBlocked(e, [u, v, 1.2], boxes)), seen = clear.length / Math.max(1, eyes.length);
    spots.push({ u: r2(u), v: r2(v), seen: r2(seen), ...(weapons.length ? { lines: clear.map((e) => Math.hypot(e[0] - u, e[1] - v)) } : {}) });
  }
  spots.sort((a, b) => a.seen - b.seen || a.u - b.u || a.v - b.v);
  const taken = [], apart = (q) => taken.every((t) => Math.hypot(t.u - q.u, t.v - q.v) >= 4 && Math.hypot(t.u + q.u, t.v + q.v) >= 4);
  const pick = (list, gives) => { const q = list.find(apart) ?? list[0]; taken.push(q); return [{ u: q.u, v: q.v, gives, seen: q.seen }, { u: -q.u, v: -q.v, gives, seen: q.seen }]; };
  const most = [...spots].reverse(), mid = [...spots.slice(Math.floor(spots.length / 2)), ...spots.slice(0, Math.floor(spots.length / 2)).reverse()];
  const items = [...pick(spots, 'health'), ...pick(most, 'armor'), ...pick(most, 'overdrive'), ...pick(mid, 'ammo')];
  for (const role of weapons) {
    const band = WEAPON_ROLES[role].band, fit = (q) => bandShare(q.lines, band);
    const by = [...spots].sort((a, b) => fit(b) - fit(a) || b.seen - a.seen || a.u - b.u || a.v - b.v);
    items.push(...pick(by, 'weapon').map((d) => ({ ...d, slot: role })));
  }
  return items;
}

export function arenaDomain({ spawns = 8, weapons = null } = {}) {
  const frame = (H, extra) => ({ centre: [0, 0], half: H, z: 0, ...extra });
  return {
    id: 'arena', TRAITS: ARENA_TRAITS,
    start: (seed, base) => ({ half: ARENA.half, topology: 'lanes', lanes: 3, gapEnd: 3, gapMid: 5, court: 0.33, many: 0.45, sight: null, stagger: false, teams: 0, breaks: [], cut: [], setBy: {}, ...(base ?? {}) }),
    pull(cand, T, id) {
      if (T.gap) return { gap: T.gap };
      const c = clone(cand), changed = [];
      for (const [k, v] of Object.entries(T.set)) {
        if (c.setBy[k] && c.setBy[k] !== id) { changed.push(`${k}: kept from ${c.setBy[k]}`); continue; }
        c[k] = v; c.setBy[k] = id; changed.push(`${k} = ${v}`);
      }
      return { candidate: c, changed };
    },
    build(cand, seed) {
      const L = composeArena(cand, seed), H = cand.half;
      // a team map: two bases, one at each end, the contenders' half and a spare each (arenaBases); else spawns for all
      const B = cand.teams ? arenaBases(L.pieces, H, Math.max(2, Math.ceil(spawns / 2)) + 1) : null;
      const sp = B ? B.spawns : arenaSpawns(L.pieces, H, spawns), blocks = arenaAsks(L.pieces, (u, v) => [u, v, 0]);
      const built = { ...L, spawns: sp, blocks, ...(B ? { bases: B.bases } : {}) };
      built.line = arenaLongest(frame(H), askBoxes(blocks));
      // the guns asked: each one the arena's clear lines serve (its band holds enough of them), laid where its lines meet
      if (weapons?.length) built.armory = servedRoles(arenaSightlines(frame(H), askBoxes(blocks)), weapons);
      built.drops = arenaDrops(built, cand, (built.armory ?? []).filter((a) => a.served).map((a) => a.role));
      built.laws = concernLaws(['arena'], { ends: { spawn: [0, 0, 0] }, blocks, arena: frame(H, { spawns: sp.map(([u, v]) => [u, v, 0]), longest: 2 * H, ...(B ? { bases: B.bases } : {}) }) }).filter((l) => l.law !== 'floor-clear');
      return built;
    },
    measure(T, id, built, cand) {
      const H = built.half, long = built.line.longest;
      if (T.set.half) return { ok: H === T.set.half, value: `${2 * H} m across` };
      if (T.set.teams) return { ok: !!built.bases && built.bases.every((b) => b.length >= 2), value: built.bases ? `two bases of ${built.bases[0].length}` : 'no bases' };
      if (T.set.topology === 'ring') return { ok: cand.topology === 'ring', value: cand.topology };
      if (T.set.lanes) return { ok: cand.topology === 'lanes' && built.lanes.length === T.set.lanes, value: `${built.lanes.length} lanes` };
      if (T.set.many !== undefined) { const n = built.pieces.filter((p) => p.form === 'crate').length; return { ok: T.set.many > 0.5 ? n >= 10 : n <= 6, value: `${n} crates` }; }
      if (T.set.sight === 'close') return { ok: long <= 1.15 * H, value: `longest line ${long.toFixed(1)} m (${(1.15 * H).toFixed(1)} at most)` };
      if (T.set.sight === 'long') return { ok: long >= 1.5 * H, value: `longest line ${long.toFixed(1)} m (${(1.5 * H).toFixed(1)} wanted)` };
      return { ok: true, value: '' };
    },
    laws: (built) => built.laws.map((l) => ({ law: l.law, ok: l.holds, value: l.says })),
    tweak(cand, failed, pass, seed) {
      const c = clone(cand), changed = [], H = c.half;
      const built = this.build(cand, seed);
      // a short wall across a line, square to it (its partner stands turned): along the line's middle part, where the
      // floor is most open (never closing a corridor), and never where a break once cut a way
      const boxes = askBoxes(built.blocks);
      const room = (u, v) => Math.min(...boxes.map((B) => Math.hypot(Math.max(B.min[0] - u, 0, u - B.max[0]), Math.max(B.min[1] - v, 0, v - B.max[1]))));
      const breakAt = (a, b, why) => {
        const along = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 'v' : 'u';
        const tries = [0.5, 0.4, 0.6, 0.3, 0.7].map((t) => [r2(a[0] + (b[0] - a[0]) * t), r2(a[1] + (b[1] - a[1]) * t)])
          .filter((m) => ![...(c.breaks ?? []), ...(c.cut ?? [])].some((x) => Math.hypot(x[0] - m[0], x[1] - m[1]) < 1.5 || Math.hypot(x[0] + m[0], x[1] + m[1]) < 1.5) && room(m[0], m[1]) >= 0.6);
        if (!tries.length) { c.many = r2(clamp('many', c.many + 0.15)); changed.push(`many ${c.many} (${why}: no open floor on the line for a break)`); return; }
        const m = tries.reduce((p, q) => (room(q[0], q[1]) > room(p[0], p[1]) + 1e-9 ? q : p));
        (c.breaks ||= []).push([m[0], m[1], along, 3]); changed.push(`a break at [${m}] across ${along === 'v' ? 'u' : 'v'} (${why})`);
      };
      for (const l of failed.laws) {
        if (l.law === 'spawns-unseen') {
          const m = String(l.value).match(/(\d+)-(\d+)/);
          if (m) breakAt(built.spawns[+m[1] - 1], built.spawns[+m[2] - 1], 'spawns in sight');
        } else if (l.law === 'no-line-across' && built.line.from) breakAt(built.line.from, built.line.to, 'a line across');
        else if (l.law === 'routes-loop') {
          if (c.breaks?.length) { const b = c.breaks.pop(); (c.cut ||= []).push(b); changed.push(`the break at [${b[0]}, ${b[1]}] taken away: it cut a way (routes loop)`); }
          else if (c.stagger && c.setBy.sight !== 'close') { c.stagger = false; changed.push('lanes unstaggered (routes loop)'); }
          else if (c.topology === 'ring') { c.court = r2(clamp('court', c.court - 0.05)); c.many = r2(clamp('many', c.many - 0.15)); changed.push(`court ${c.court}, many ${c.many} (routes loop: room round the court)`); }
          else { c.gapMid = r2(clamp('gapMid', c.gapMid + 1)); c.gapEnd = r2(clamp('gapEnd', c.gapEnd + 0.5)); changed.push(`gaps ${c.gapEnd} / ${c.gapMid} (routes loop)`); }
        } else if (l.law === 'cover-near') {
          // asked sparse: a short wall where the floor is barest, not more crates
          if (c.setBy.many === 'sparse') { const p = barest(built); (c.breaks ||= []).push([p[0], p[1], 'u', 3]); changed.push(`a wall at [${p}] (cover near, kept sparse)`); }
          else { c.many = r2(clamp('many', c.many + 0.2)); changed.push(`many ${c.many} (cover near)`); }
        }
      }
      for (const t of failed.traits) {
        if (t.id === 'close' && c.topology === 'lanes' && !c.stagger) { c.stagger = true; changed.push('lanes staggered (close quarters)'); }
        else if (t.id === 'close' && built.line.from) breakAt(built.line.from, built.line.to, 'close quarters');
        else if (t.id === 'long') { if (c.breaks?.length) { c.breaks.pop(); changed.push('a break taken away (long sightlines)'); } else { c.many = r2(clamp('many', c.many - 0.2)); changed.push(`many ${c.many} (long sightlines)`); } }
      }
      return { candidate: c, changed: changed.length ? changed : [`reseed ${seed + 1}`], reseed: changed.length ? undefined : seed + 1 };
    },
    plan: (cand, built) => ({ half: built.half, pieces: built.pieces, spawns: built.spawns, drops: built.drops, longest: 2 * built.half, topology: cand.topology, ...(cand.topology === 'lanes' ? { lanes: cand.lanes } : {}), ...(built.armory ? { armory: built.armory } : {}), ...(built.bases ? { bases: built.bases } : {}) }),
  };
}

/** Tunnel an arena's words into its plan. `spawns`: how many it lays (a match's contenders, eight at most); `weapons`: the
 * pickup roles asked (weapon-roles.js), each laid when the arena serves it. */
export function tunnelArena(intent, { seed = 1, spawns = 8, passes = 12, weapons = null, teams = 0 } = {}) {
  return tunnel(arenaDomain({ spawns, weapons }), { intent, seed, passes, ...(teams ? { base: { teams } } : {}) });
}

export { RAILS as ARENA_RAILS };
