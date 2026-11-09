/**
 * brawl practice — the brawler's practice room: a yard to learn a brawler in, the street's own blocks (the belt, the
 * core, the moves, the crowd's mind, the things) under a practice mind. Not the fighting game's training: a brawler is
 * learned by SPACE and CROWDS (lining up across the street, the chain and what drops it, the clinch, the desperation's
 * price, reading who swings next), so the room says those, not frames.
 *
 *   practiceOf({ belt, players, dummies, things?, health?, range?, waves?, loop? }) → a room: { ctx, s, mind, yard }
 *     waves    the WAVE TESTER in the brawler's yard (the range's `waves` below, the same runner): groups of the crowd
 *              come in, by their entrances, to their formations, hiding, lying in wait
 *     players  [{ recipe, style? }], one to four (a seat each)
 *     dummies  [{ type? (a CROWD_TYPES id, 'thug' by default) | recipe?, mode, at?, n? }]: at m along the belt and n m
 *              across it (spread along the room by default); a dummy's MODE (PRACTICE_MODES):
 *                stand   stands where it is put
 *                walk    walks back and forth across the street where it stands (lining up on a moving body)
 *                swing   steps onto the player's line and throws its blow on a slow beat (reading a blow)
 *                crowd   the street's own crowd mind, its tokens and its ring (being surrounded)
 *                grab    walks into the player to take hold, knees and throws (getting out of a hold)
 *                shoot   stands its ground and, on a slow beat, aims its gun (its warning) and fires at the player
 *                        (`gun`: a gun's name or dials, brawl-guns.js; the rifle by default): stepping off a round's line
 *     range    THE RANGE (the run & gun's practice room): `{ guns?, grenades?, waves?, loop? }`, the guns passed in to be tried (each a
 *              name or dials over one, brawl-guns.js readGun; the machine gun, the spread, the flame and the rocket by
 *              default), the player holding the first, its sidearm under it; the buttons read by the gunner's reader
 *              (brawl-gunner.js: fire, aim, plant, roll, jump, grenade; no melee). The range never runs dry: a spent
 *              gun is loaded again, the grenades back. Its readouts: rounds fired and landed, their damage, the rounds
 *              taken. A dummy keeps its own health (a crowd type's).
 *              Its WAVES (`waves`, brawl-waves.js: groups of the crowd's types, each its formation and its attack pattern)
 *              the range's wave tester: one wave at a time, its bodies coming in from the view's edges (or the street's
 *              back) to their stations round the player as it starts, its shooters firing to its pattern (each volley
 *              warned of, the aim fixed from its start; a flinch cuts it short), its brawlers and every body under
 *              'tokens' the street's crowd; cleared when its last falls (the time it took and the rounds taken kept),
 *              the next after its breath, the set over again (`loop`, true unless it says).
 *     things   the street's (brawl-things.js), in the belt's metres: put back as they were on a reset
 *     health   'chains' (a dummy's health a few of the player's chains: it falls, and is back on its spot BACK frames
 *              later) or 'refill' (its health back whenever it is free: it never falls)
 *   A player never dies in the yard: knocked out, it is back on its feet where it lies, its health whole.
 *   stepYard(room, buttons) → the room a frame on: each seat's buttons ({ x, z, a, j, s }) read by the brawler's reader
 *              (brawl-moves.js), the dummies' pads by their modes, the core's step, the room's rules, and each press's
 *              VERDICT kept (`yard.log`): taken (how many frames late) or dropped, and why
 *   resetYard(room) → everyone on their spots, whole, the things put back, the logs cleared
 *   yardRead(room, player?) → what the room shows a player: the line to each dummy, the chain (its steps landed, how it
 *              ended and why), the press log, the clinch, the last combo, the tokens, a state held, a weapon held
 *   brawlMoveList(F) → a brawler's moves as its player reads them, by kind (the command-list idiom's `kinds`)
 *   rangeMoveList(room) → the range's guns and the gunner's moves, the same way
 *
 * Pure: no clock, no dice (the yard's frame is the core's).
 */
import { newBrawl, stepBrawl, enterBody, BRAWL_RULES } from './brawl-core.js';
import { brawlFighter, newReader, readButtons, BRAWL_STYLES } from './brawl-moves.js';
import { crowdPads, newCrowdMind, crowdFighter, CROWD_TYPES, aimAt } from './brawl-crowd.js';
import { readGun } from './brawl-guns.js';
import { readRangeWaves, stationsOf, entryOf, volleyAt, WAVE_RULES } from './brawl-waves.js';
import { newGunReader, readGunButtons, gunMoveList } from './brawl-gunner.js';
import { readThings, THINGS } from './brawl-things.js';
import { viewHalf } from './brawl-belt.js';

export const PRACTICE_MODES = Object.freeze({
  stand: 'stands where it is put',
  walk: 'walks back and forth across the street where it stands: line up on a moving body',
  swing: 'steps onto your line and throws its blow on a slow beat: read it, step off the line, answer',
  crowd: 'the street\'s own crowd: a few close in at once and the rest circle; learn to read who swings next',
  grab: 'walks into you to take hold, knees and throws: get out with the desperation',
  shoot: 'stands its ground and, on a slow beat, aims its gun and fires at you: step off the round\'s line, or roll',
});
/** the range's guns unless it says (the sidearm is always under them) */
export const RANGE_GUNS = Object.freeze(['machine-gun', 'spread', 'flame', 'rocket']);
export const PRACTICE_MODE_IDS = Object.freeze(Object.keys(PRACTICE_MODES));
export const HEALTH_MODES = Object.freeze(['chains', 'refill']);
/** frames a felled dummy lies before it is back on its spot; a dummy's health in the player's chains; the swing's beat */
export const BACK = 180;
export const CHAINS = 2.5;
export const BEAT = 90;
const LOG = 8;
const FREE = new Set(['stand', 'walk', 'land']);
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** a brawler style's chain damage: its blows down to the knockdown, summed (what a dummy's health is measured in) */
const chainDamage = (F) => Array.from({ length: F.brawl.chain }, (_, k) => F.moves[`chain.${k + 1}`].damage * (F.moves[`chain.${k + 1}`].hits || 1)).reduce((a, b) => a + b, 0);

/** A practice room. */
export function practiceOf({ belt, players, dummies = [], things, health = 'chains', range, waves, loop } = {}) {
  if (!belt) throw new Error('brawl: a practice room needs its belt');
  if (!Array.isArray(players) || !players.length || players.length > 4) throw new Error('brawl: a practice room has 1 to 4 players');
  if (!HEALTH_MODES.includes(health)) throw new Error(`brawl: a practice room's health is ${HEALTH_MODES.join(' | ')}`);
  if (!Array.isArray(dummies) || dummies.length > 8) throw new Error('brawl: a practice room has up to 8 dummies');
  const fighters = players.map((p) => brawlFighter(p.recipe, { style: p.style }));
  // THE RANGE's guns: the sidearm, the guns passed in, the grenade, and each shooting dummy's
  if (range !== undefined && (!range || typeof range !== 'object')) throw new Error('brawl: a practice room\'s range is { guns?, grenades? }');
  const guns = range ? [readGun('sidearm'), ...(range.guns ?? RANGE_GUNS).map((g, k) => readGun(g, `range.guns[${k}]`)), readGun('grenade')] : [];
  if (range && guns.length < 3) throw new Error('brawl: a range has a gun or more to try');
  const gunIx = (spec, where) => { const g = readGun(spec, where); let k = guns.findIndex((h) => JSON.stringify(h) === JSON.stringify(g)); if (k < 0) { k = guns.length; guns.push(g); } return k; };
  const L = belt.length, [n0, n1] = belt.depth;
  const half = viewHalf(belt);
  // the dummies' fighters (a crowd type's, or a recipe's), their spots, their modes
  const kinds = {}, spec = dummies.map((d, i) => {
    if (!PRACTICE_MODES[d.mode ?? 'stand']) throw new Error(`brawl: dummies[${i}].mode is one of ${PRACTICE_MODE_IDS.join(', ')}`);
    if (d.type !== undefined && !CROWD_TYPES[d.type]) throw new Error(`brawl: dummies[${i}].type is one of ${Object.keys(CROWD_TYPES).join(', ')}`);
    const key = d.recipe ? `recipe:${i}` : `type:${d.type ?? 'thug'}`;
    if (kinds[key] === undefined) { kinds[key] = fighters.length; fighters.push(d.recipe ? brawlFighter(d.recipe) : crowdFighter(d.type ?? 'thug')); }
    const at = d.at ?? Math.min(L - 1, half + 2 + i * 1.6), n = d.n ?? ((i % 3) - 1) * 1.2;
    if (!(at >= 0 && at <= L && n >= n0 && n <= n1)) throw new Error(`brawl: dummies[${i}] stands on the belt, in its band`);
    // (a dummy that shoots: its own gun, a shooting crowd type's, or the rifle)
    const gunSpec = d.gun ?? (d.type && CROWD_TYPES[d.type].gun) ?? (d.mode === 'shoot' ? 'rifle' : null);
    return { fighter: kinds[key], mode: d.mode ?? 'stand', type: d.recipe ? 'thug' : d.type ?? 'thug', home: [Math.round(at * 1000), Math.round(n * 1000)], ...(gunSpec ? { gun: gunIx(gunSpec, `dummies[${i}].gun`) } : {}) };
  });
  // each player's armed self for every weapon on the floor (a box's too), as the street compiles them
  const T = things ? readThings(things, belt) : [];
  const weapons = [...new Set(T.flatMap((t) => [t, t.holds].filter(Boolean)).filter((t) => t.kind === 'weapon').map((t) => t.what))];
  const armed = {};
  players.forEach((pl, i) => { for (const w of weapons) { armed[`${i}:${w}`] = fighters.length; fighters.push(brawlFighter({ ...pl.recipe, weapon: w }, { style: pl.style })); } });
  const ctx = { fighters, belt, ...(weapons.length ? { armed } : {}) };
  const homes = players.map((_, i) => [Math.round((half - 2 + i * 0.7) * 1000), Math.round(n0 * 1000 + ((i + 1) * (n1 - n0) * 1000) / (players.length + 1))]);
  // THE WAVES' bodies, each wave's waiting offstage (its own gun, poise and health where the wave says)
  // (the range's waves, or the brawler yard's own)
  const W = range && range.waves ? readRangeWaves(range.waves) : waves ? readRangeWaves(waves) : null;
  const waveSpec = [];
  if (W) W.forEach((w, k) => { for (const c of w.crowd) for (let j = 0; j < c.n; j++) {
    const key = `type:${c.type}`, T = CROWD_TYPES[c.type];
    if (kinds[key] === undefined) { kinds[key] = fighters.length; fighters.push(crowdFighter(c.type)); }
    waveSpec.push({ fighter: kinds[key], type: c.type, wave: k, hp: c.hp, arms: { wave: k, ...(T.gun ? { gun: gunIx(T.gun, `range.waves[${k}]`) } : {}), ...((c.poise ?? T.poise) ? { poise: c.poise ?? T.poise } : {}) } });
  } });
  if (guns.length) ctx.guns = guns;
  // (each body's arms: a player on the range its first gun over its sidearm, its grenades; a shooting dummy its gun)
  const arms = [
    ...players.map(() => (range ? { gun: 1, grenades: range.grenades ?? 3, grenadeGun: 1 + (range.guns ?? RANGE_GUNS).length } : {})),
    ...spec.map((d, j) => ({ ...(d.gun !== undefined ? { gun: d.gun } : {}), ...(CROWD_TYPES[d.type]?.poise && !dummies[j].recipe ? { poise: CROWD_TYPES[d.type].poise } : {}) })),
    ...waveSpec.map((w) => w.arms),
  ];
  const bodies = [
    ...players.map((_, i) => ({ fighter: i, side: 'player', x: homes[i][0], z: homes[i][1], ...arms[i] })),
    ...spec.map((d, j) => ({ fighter: d.fighter, side: 'crowd', x: d.home[0], z: d.home[1], face: -1, ...(d.mode === 'grab' ? {} : { grabs: false }), ...arms[players.length + j] })),
    ...waveSpec.map((w, j) => ({ fighter: w.fighter, side: 'crowd', x: 0, z: 0, face: -1, ...(CROWD_TYPES[w.type].plays.includes('grab') ? {} : { grabs: false }), ...arms[players.length + spec.length + j] })),
  ];
  const s = newBrawl(ctx, { bodies, ...(T.length ? { things: T } : {}) });
  if (range) arm(s, players.length, guns);
  // (a dummy's health: a few of the first player's chains, or its own refilled)
  const hpOf = Math.max(1, Math.round(chainDamage(fighters[0]) * CHAINS));
  if (health === 'chains' && !range) for (const d of s.bodies.slice(players.length)) d.hp = hpOf;
  waveSpec.forEach((w, j) => { if (w.hp) s.bodies[players.length + spec.length + j].hp = w.hp; });
  const P = players.length;
  const yard = {
    players: P, health, hp: s.bodies.map((b) => b.hp), homes: [...homes, ...spec.map((d) => d.home), ...waveSpec.map(() => [0, 0])],
    modes: [...spec.map((d) => d.mode), ...waveSpec.map(() => 'wave')],
    ...(W ? { wave: newWaveRun(W, (range && range.waves ? range.loop : loop) !== false, waveSpec.map((w, j) => ({ id: P + spec.length + j, wave: w.wave, type: w.type }))), station: {}, ambush: {} } : {}), things: T.map((t) => ({ ...t })), arms, volley: {},
    ...(range ? { range: true, shots: players.map(() => ({ fired: 0, landed: 0, damage: 0, struck: 0 })) } : {}),
    readers: players.map(() => (range ? newGunReader() : newReader())), prev: players.map(() => ({})), pending: players.map(() => []),
    log: players.map(() => []), chain: players.map(() => ({ steps: [], last: null })), combo: players.map(() => ({ hits: 0, damage: 0, last: null })),
    ko: {}, free: {},
  };
  const mind = newCrowdMind(Object.fromEntries([...spec.map((d, j) => [P + j, d.type]), ...waveSpec.map((w, j) => [P + spec.length + j, w.type])]));
  return { ctx, s, mind, yard };
}

/** a range's players: the gun they hold over their sidearm (index 0), loaded */
function arm(s, P, guns) {
  for (let i = 0; i < P; i++) { const p = s.bodies[i]; p.sd = 0; p.am = guns[p.gn].ammo ?? undefined; if (p.am === undefined) delete p.am; }
}
/** Everyone on their spots and whole, the things put back, the logs cleared. */
export function resetYard(room) {
  const { yard, ctx } = room;
  const fresh = newBrawl(ctx, { bodies: room.s.bodies.map((b, i) => ({ fighter: i < yard.players ? i : b.fb ?? b.fi, side: b.side, x: yard.homes[i][0], z: yard.homes[i][1], face: i < yard.players ? 1 : -1, ...(b.ng ? { grabs: false } : {}), ...(yard.arms?.[i] ?? {}) })), ...(yard.things.length ? { things: yard.things.map((t) => ({ ...t })) } : {}) });
  fresh.bodies.forEach((b, i) => { b.hp = yard.hp[i]; });
  if (yard.range) arm(fresh, yard.players, ctx.guns);
  fresh.f = room.s.f;
  const waveReset = yard.wave ? { wave: newWaveRun(yard.wave.list, yard.wave.loop, yard.wave.bodies), station: {}, ambush: {} } : {};
  return { ...room, s: fresh, mind: newCrowdMind(room.mind.type), yard: { ...yard, readers: yard.readers.map(() => (yard.range ? newGunReader() : newReader())), volley: {}, ...waveReset, ...(yard.range ? { shots: yard.shots.map(() => ({ fired: 0, landed: 0, damage: 0, struck: 0 })) } : {}), prev: yard.prev.map(() => ({})), pending: yard.pending.map(() => []), log: yard.log.map(() => []), chain: yard.chain.map(() => ({ steps: [], last: null })), combo: yard.combo.map(() => ({ hits: 0, damage: 0, last: null })), ko: {}, free: {} } };
}

// ── the dummies' practice mind ───────────────────────────────────────────────────────────────────────────────

function dummyPads(room, M) {
  const { s, ctx, yard } = room, P = yard.players, pads = [];
  // (the crowd mode's dummies and a wave's bodies the crowd's mind drives: its brawlers, and all under 'tokens')
  const crowd = s.bodies.filter((b, i) => i >= P && (yard.modes[i - P] === 'crowd' || (yard.modes[i - P] === 'wave' && !b.gone && byMind(room, b))));
  // (the crowd mode's dummies think as the street's crowd; the others by their own mode)
  if (crowd.length) {
    const all = crowdPads(s, ctx, { ...M, type: Object.fromEntries(crowd.map((b) => [b.id, M.type[b.id]])) });
    for (const b of crowd) pads[b.id] = all[b.id] ?? {};
  }
  const line = Math.round(s.rules.line / 3), [n0, n1] = ctx.belt.depth.map((v) => Math.round(v * 1000));
  for (let i = P; i < s.bodies.length; i++) {
    const d = s.bodies[i], mode = yard.modes[i - P], home = yard.homes[i];
    if (mode === 'crowd' || mode === 'wave' || d.gone || d.ko) continue;
    const T = d.tg >= 0 ? s.bodies[d.tg] : null;
    if (mode === 'stand') { pads[i] = Math.abs(d.x - home[0]) > 300 && FREE.has(d.st) ? { x: sgn(home[0] - d.x) } : {}; continue; }
    if (mode === 'walk') {
      // across the street and back where it stands: the far edge, then the near
      const dir = (yard.free[i] ??= 1);
      if ((dir > 0 && d.z >= n1 - 150) || (dir < 0 && d.z <= n0 + 150)) yard.free[i] = -dir;
      pads[i] = { z: yard.free[i], x: Math.abs(d.x - home[0]) > 300 ? sgn(home[0] - d.x) : 0 };
      continue;
    }
    if (!T) { pads[i] = {}; continue; }
    if (mode === 'shoot') {
      // its ground held; on the beat its aim (the gun's warning, the aim kept from its start), then its round where it
      // aimed; a flinch cuts it short (its shot never comes)
      if (d.st === 'hit' || d.st === 'fall' || d.st === 'down' || d.st === 'rise') { delete yard.volley[i]; pads[i] = {}; continue; }
      const G = ctx.guns[d.gn], v = yard.volley[i];
      if (v) {
        const t = v.t + 1;
        pads[i] = t <= G.telegraph ? { aim: v.aim } : t === G.telegraph + 1 ? { fire: v.aim } : {};
        if (t > G.telegraph + 1) delete yard.volley[i]; else yard.volley[i] = { t, aim: v.aim };
        continue;
      }
      if (Math.abs(d.x - home[0]) > 300 && FREE.has(d.st)) { pads[i] = { x: sgn(home[0] - d.x) }; continue; }
      if (FREE.has(d.st) && s.f % BEAT === 0) { const aim = aimAt(d, T); yard.volley[i] = { t: 0, aim }; pads[i] = { aim }; continue; }
      pads[i] = {};
      continue;
    }
    if (mode === 'grab') {
      if (d.st === 'hold') { pads[i] = s.f % 16 === 8 ? { hold: (d.kn ?? 0) >= 2 ? 'forward' : 'knee' } : {}; continue; }
      pads[i] = Math.abs(d.z - T.z) > line ? { z: sgn(T.z - d.z) } : { x: sgn(T.x - d.x) };
      continue;
    }
    // swing: onto the player's line, in to its blow's reach, and the blow on the beat
    const F = ctx.fighters[d.fi], m = F.moves['chain.1'], reach = m.reach - 150, dx = Math.abs(T.x - d.x);
    if (Math.abs(d.z - T.z) > line) { pads[i] = { z: sgn(T.z - d.z) }; continue; }
    if (dx > reach) { pads[i] = { x: sgn(T.x - d.x) }; continue; }
    pads[i] = FREE.has(d.st) && FREE.has(T.st) && s.f % BEAT === 0 && d.face === sgn(T.x - d.x) ? { mv: 'chain.1' } : {};
  }
  if (yard.wave) wavePads(room, pads);
  return pads;
}

// ── the waves (the range's wave tester, brawl-waves.js) ───────────────────────────────────────────────────────

/** a wave run: its waves, which is on, its clock, the clear times kept */
function newWaveRun(list, loop, bodies) {
  return { list, loop, bodies, k: 0, state: 'wait', t: list[0].after, start: 0, struck: 0, cleared: [], rounds: 0 };
}
const REELS = new Set(['hit', 'fall', 'down', 'rise']);
/** a wave's body the crowd's mind drives: a brawler (no gun), or any body of a wave under 'tokens' */
function byMind(room, b) {
  const w = room.yard.wave, k = w.bodies.find((x) => x.id === b.id)?.wave;
  return k === undefined || b.gn === undefined || w.list[k].pattern === 'tokens';
}
/** one volley's frame: its aim held for the gun's warning (fixed from its start), then its rounds; null when done */
function volleyPad(d, v, G, count) {
  const t = v.t + 1;
  if (t <= G.telegraph) return [{ aim: v.aim }, { ...v, t }];
  if (v.n < count) return [{ fire: v.aim }, { ...v, t, n: (d.fc ?? 0) <= 1 ? v.n + 1 : v.n }];
  return [{}, null];
}
/** the wave's pattern shooters: to their stations, then each its volley on the pattern's frame in the beat */
function wavePads(room, pads) {
  const { s, ctx, yard } = room, W = yard.wave;
  if (W.state !== 'on') return;
  const w = W.list[W.k], T = s.bodies[0];
  const mine = W.bodies.filter((x) => x.wave === W.k).map((x) => s.bodies[x.id]).filter((b) => !b.gone && !b.ko);
  // (lying in wait: hidden until a player comes near, then springing)
  for (const d of mine) {
    if (!yard.ambush[d.id]) continue;
    const near = s.bodies.slice(0, yard.players).some((q) => !q.gone && Math.abs(q.x - d.x) < WAVE_RULES.ambush && Math.abs(q.z - d.z) < 1600);
    if (near || d.st !== 'hide') { delete yard.ambush[d.id]; pads[d.id] = { pop: true }; } else pads[d.id] = {};
  }
  const shooters = w.pattern === 'tokens' ? [] : mine.filter((b) => b.gn !== undefined && !yard.ambush[b.id]);
  const gt = s.f - W.start;
  shooters.forEach((d, k) => {
    const i = d.id, at = yard.station[i];
    // (a flinch cuts its volley short)
    if (REELS.has(d.st)) { delete yard.volley[i]; pads[i] = {}; return; }
    const v = yard.volley[i], G = ctx.guns[d.gn], count = CROWD_TYPES[W.bodies.find((x) => x.id === i).type].volley ?? 1;
    if (v) { const [pad, next] = volleyPad(d, v, G, count); pads[i] = pad; if (next) yard.volley[i] = next; else delete yard.volley[i]; return; }
    // to its station, then on the beat
    if (at && (Math.abs(d.x - at[0]) > WAVE_RULES.dead || Math.abs(d.z - at[1]) > WAVE_RULES.dead)) {
      pads[i] = { x: Math.abs(d.x - at[0]) > WAVE_RULES.dead ? sgn(at[0] - d.x) : 0, z: Math.abs(d.z - at[1]) > WAVE_RULES.dead ? sgn(at[1] - d.z) : 0 };
      return;
    }
    const off = volleyAt(w.pattern, k, shooters.length, sgn(d.x - T.x) || 1, w.beat);
    if ((FREE.has(d.st) || d.st === 'hide') && gt >= off && (gt - off) % w.beat === 0) { const aim = aimAt(d, T); yard.volley[i] = { t: 0, n: 0, aim }; pads[i] = { aim }; return; }
    // (behind its cover between volleys: down)
    pads[i] = w.cover && FREE.has(d.st) ? { hide: true } : {};
  });
}
/** the wave run a frame on: a wave in after its breath (its bodies to their stations), cleared when its last falls */
function waveStep(room) {
  const { s, ctx, yard } = room, W = yard.wave;
  const P = yard.players, half = Math.round(viewHalf(ctx.belt) * 1000), view = [s.cam - half, s.cam + half];
  const band = ctx.belt.depth.map((v) => Math.round(v * 1000));
  for (const e of s.events) if (W.state === 'on' && e.t === 'hit' && e.d < P) W.struck++;
  if (W.state === 'wait') {
    if (--W.t > 0) return;
    const w = W.list[W.k], ids = W.bodies.filter((x) => x.wave === W.k).map((x) => x.id), T = s.bodies[0];
    const stations = stationsOf(w.formation, ids.length, [T.x, T.z], band, view);
    ids.forEach((id, j) => {
      const b = s.bodies[id], st = stations[j];
      // its ENTRANCE: walking in from the view's edge (or the back), out of a door, dropping, digging, vaulting; or
      // lying in wait where it stands
      if (w.ambush) enterBody(s, ctx, id, { how: 'walk', x: st[0], z: st[1], hide: true });
      else if (w.entrance === 'walk') { const [ex, ez] = entryOf(st, [T.x, T.z], band, view, w.formation); enterBody(s, ctx, id, { how: 'walk', x: ex, z: ez }); }
      else enterBody(s, ctx, id, { how: w.entrance, x: st[0], z: st[1] });
      b.hp = yard.hp[id]; b.face = sgn(T.x - b.x) || -1;
      if (w.ambush) yard.ambush[id] = 1;
      yard.station[id] = st;
      // (its cover: a piece between its station and the player, cleared with the wave)
      if (w.cover) {
        s.things ??= []; s.nt ??= 1;
        // (clear of its station by its own half-width and a body's, so its shooter stands right behind it)
        const gap = Math.round((THINGS.cover[w.cover].w * 1000) / 2) + s.rules.body + WAVE_RULES.coverGap;
        const c = { id: s.nt++, kind: 'cover', what: w.cover, x: st[0] + (sgn(T.x - st[0]) || -1) * gap, z: st[1], hp: THINGS.cover[w.cover].hp, wave: W.k };
        s.things.push(c);
      }
    });
    W.state = 'on'; W.start = s.f; W.struck = 0;
    s.events.push({ t: 'wave', k: W.k, of: W.list.length, name: w.name, n: ids.length });
    return;
  }
  if (W.state !== 'on') return;
  const ids = W.bodies.filter((x) => x.wave === W.k).map((x) => x.id);
  if (!ids.every((id) => s.bodies[id].ko)) return;
  // (its cover cleared with it)
  if (s.things) s.things = s.things.filter((c) => c.wave !== W.k);
  // cleared: its time and the rounds taken kept; the next after its breath (or the set over again)
  W.cleared = [...W.cleared, { k: W.k, frames: s.f - W.start, struck: W.struck }].slice(-20);
  s.events.push({ t: 'waveCleared', k: W.k, frames: s.f - W.start, struck: W.struck });
  const next = W.k + 1;
  if (next < W.list.length || W.loop) { W.k = next % W.list.length; W.state = 'wait'; W.t = W.list[W.k].after; if (next >= W.list.length) W.rounds++; }
  else W.state = 'done';
}

// ── a press's verdict ────────────────────────────────────────────────────────────────────────────────────────

/** why a press asked for `want` was not taken, from the body as the press ran out */
function whyNot(p, F, want, rules) {
  if (F.moves[want]?.cool && p.cd > 0) return `on cooldown: the strong back in ${p.cd} frames`;
  if (p.st === 'hold') return 'holding a body: attack knees it or throws it';
  if (p.st === 'hit' || p.st === 'fall' || p.st === 'down' || p.st === 'rise' || p.st === 'held' || p.st === 'thrown') return 'reeling: a body being hit acts on nothing';
  if (p.st === 'air' || p.st === 'prejump') return p.mv || p.airMove ? 'in the air, its air attack spent' : 'in the air';
  if (p.hs > 0) return 'held in the blow\'s hitstop';
  if (p.mv) {
    const m = F.moves[p.mv];
    if (!p.conn && (want.startsWith('chain.') || want === 'strong.break' || want === 'strong.out')) return 'the blow before missed: a chain goes on only from a hit';
    if (p.mf > m.startup + m.active - 1 + rules.cancelLate) return 'too late: the blow\'s window had closed';
    return 'not from this blow';
  }
  if (p.st === 'land' || p.st === 'pick') return 'landing: a moment\'s recovery';
  return 'busy';
}
const PRESS_WORDS = { a: 'attack', h: 'strong', j: 'jump', s: 'special' };

function verdicts(room, i, buttons, before, after) {
  const { yard, s } = room, p = s.bodies[i], F = room.ctx.fighters[p.fi], prev = yard.prev[i], log = yard.log[i];
  const say = (e) => { log.push({ f: s.f, ...e }); if (log.length > LOG) log.shift(); };
  // a new press: what the reader made of it
  const pressed = Object.keys(PRESS_WORDS).filter((k) => buttons[k] && !prev[k]);
  if (pressed.length) {
    const words = pressed.map((k) => PRESS_WORDS[k]).join(' + ');
    if (before.st === 'hold' && buttons.a) yard.pending[i].push({ f: s.f, words, want: 'hold', kn: before.kn ?? 0 });
    else if (after.want && after.want !== (yard.pending[i].at(-1)?.want)) yard.pending[i].push({ f: s.f, words, want: after.want });
    else if (pressed.includes('a') && p.st === 'pick') say({ words, verdict: 'taken', what: 'picked up', late: 0 });
    else if (pressed.includes('j') && !after.want) yard.pending[i].push({ f: s.f, words, want: 'jump' });
    else if (!after.want && !after.tk) say({ words, verdict: 'dropped', why: whyNot(p, F, pressed.includes('h') ? 'strong' : 'chain.1', s.rules) });
  }
  // the presses waiting: taken once the body starts what they asked, dropped once the reader lets them go
  yard.pending[i] = yard.pending[i].filter((q) => {
    const late = s.f - q.f;
    if (q.want === 'hold') {
      if ((p.kn ?? 0) !== q.kn || p.st !== 'hold') { say({ words: q.words, verdict: 'taken', what: p.st === 'hold' ? 'knee' : 'throw', late }); return false; }
      if (late > 6) { say({ words: q.words, verdict: 'dropped', why: 'the knee before still landing' }); return false; }
      return true;
    }
    if (q.want === 'jump') {
      if (p.st === 'prejump' || p.st === 'air') { say({ words: q.words, verdict: 'taken', what: 'jump', late }); return false; }
      if (late > 4) { say({ words: q.words, verdict: 'dropped', why: whyNot(p, F, 'jump', s.rules) }); return false; }
      return true;
    }
    if (p.mv === q.want) { say({ words: q.words, verdict: 'taken', what: q.want, late, ...(q.note ? { note: q.note } : {}) }); return false; }
    // (a chain's next blow, its last missed: the reader made it a fresh chain once the body was free)
    if (after.want === 'chain.1' && q.want.startsWith('chain.') && q.want !== 'chain.1') { q.note = 'the blow before missed: a new chain'; q.want = 'chain.1'; return true; }
    // (the breaker or the blowout, its blow before missed: the reader made it the opener once the body was free)
    if (after.want === 'strong' && (q.want === 'strong.break' || q.want === 'strong.out')) { q.note = 'the blow before missed: the opener'; q.want = 'strong'; return true; }
    if (after.want !== q.want) { say({ words: q.words, verdict: 'dropped', want: q.want, why: q.why ?? whyNot(p, F, q.want, s.rules) }); return false; }
    // (why it waits, while it waits: what the body is doing that it cannot be taken)
    if (!FREE.has(p.st) || (F.moves[q.want]?.cool && p.cd > 0)) q.why = whyNot(p, F, q.want, s.rules);
    return true;
  });
  yard.prev[i] = { ...buttons };
}

// ── the yard a frame on ──────────────────────────────────────────────────────────────────────────────────────

export function stepYard(room, buttons = []) {
  const yard = { ...room.yard, readers: room.yard.readers.slice(), prev: room.yard.prev.slice(), pending: room.yard.pending.map((q) => q.map((e) => ({ ...e }))), log: room.yard.log.map((l) => l.slice()), chain: room.yard.chain.map((c) => ({ ...c, steps: c.steps.slice() })), combo: room.yard.combo.map((c) => ({ ...c })), ko: { ...room.yard.ko }, free: { ...room.yard.free }, volley: { ...room.yard.volley }, ...(room.yard.range ? { shots: room.yard.shots.map((x) => ({ ...x })) } : {}), ...(room.yard.wave ? { wave: { ...room.yard.wave }, station: { ...room.yard.station }, ambush: { ...room.yard.ambush } } : {}) };
  const mind = { ...room.mind, tok: Object.fromEntries(Object.entries(room.mind.tok).map(([k, v]) => [k, v.slice()])), b: Object.fromEntries(Object.entries(room.mind.b).map(([k, v]) => [k, { ...v }])) };
  const r0 = { ...room, yard, mind };
  const pads = dummyPads(r0, mind);
  const before = room.s.bodies.map((b) => ({ st: b.st, kn: b.kn, mv: b.mv }));
  const readerAfter = [];
  for (let i = 0; i < yard.players; i++) {
    const p = room.s.bodies[i];
    const [pad, r] = yard.range ? readGunButtons(yard.readers[i], buttons[i] ?? {}, p) : readButtons(yard.readers[i], buttons[i] ?? {}, p, room.ctx.fighters[p.fi]);
    yard.readers[i] = r; readerAfter[i] = r; pads[i] = pad;
  }
  const s = stepBrawl(room.s, pads, room.ctx);
  const out = { ...r0, s };
  for (let i = 0; i < yard.players; i++) { if (yard.range) gunVerdicts(out, i, buttons[i] ?? {}, room.s.bodies[i]); else verdicts(out, i, buttons[i] ?? {}, before[i], readerAfter[i]); }
  rules(out);
  return out;
}

// a range press's verdict: a shot fired (its gun) or not, and why; a grenade thrown or not
const GUN_FREE = new Set(['stand', 'walk', 'air', 'prejump', 'land']);
function gunWhy(p, what) {
  if (p.st === 'roll') return 'rolling: a roll fires nothing';
  if (p.st === 'hit' || p.st === 'fall' || p.st === 'down' || p.st === 'rise') return 'reeling: a body being hit fires nothing';
  if (what === 'grenade') return p.lc > 0 ? 'a grenade still in the air' : 'no grenades';
  return 'busy';
}
function gunVerdicts(room, i, buttons, was) {
  const { yard, s, ctx } = room, p = s.bodies[i], prev = yard.prev[i], log = yard.log[i];
  const say = (e) => { log.push({ f: s.f, ...e }); if (log.length > LOG) log.shift(); };
  const fired = s.events.filter((e) => e.t === 'fire' && e.p === i);
  if (buttons.a && !prev.a) {
    const shot = fired.find((e) => e.gun !== ctx.guns[p.gi]?.id);
    if (shot) say({ words: 'fire', verdict: 'taken', what: shot.gun, late: 0 });
    else if (!GUN_FREE.has(was.st) || was.st === 'roll') say({ words: 'fire', verdict: 'dropped', why: gunWhy(was, 'fire') });
    else yard.pending[i].push({ f: s.f, words: 'fire', want: 'fire' });
  }
  if (buttons.s && !prev.s) {
    const lob = fired.find((e) => e.gun === ctx.guns[p.gi]?.id);
    say(lob ? { words: 'grenade', verdict: 'taken', what: 'grenade', late: 0 } : { words: 'grenade', verdict: 'dropped', why: gunWhy(was, 'grenade') });
  }
  // (a fire press waiting out its gun's rate: taken by the next round, or dropped as the trigger is let go)
  yard.pending[i] = yard.pending[i].filter((q) => {
    const shot = fired.find((e) => e.gun !== ctx.guns[p.gi]?.id);
    if (shot) { say({ words: q.words, verdict: 'taken', what: shot.gun, late: s.f - q.f }); return false; }
    if (!buttons.a) { say({ words: q.words, verdict: 'dropped', why: 'let go before the gun was ready (its rate)' }); return false; }
    return true;
  });
  yard.prev[i] = { ...buttons };
}

// the room's own rules after each frame: no player dies, a felled dummy comes back, refilled health, the chain and the
// combo kept for the readouts; on the range, the rounds counted, a spent gun loaded again, the grenades back
function rules(room) {
  const { s, yard, ctx } = room, P = yard.players;
  if (yard.range) {
    for (const e of s.events) {
      if (e.t === 'fire' && e.p < P) yard.shots[e.p].fired += e.n;
      if (e.t === 'hit' && e.kind === 'round' && e.p < P) { yard.shots[e.p].landed++; yard.shots[e.p].damage += e.dmg; }
      if (e.t === 'hit' && e.d < P && (e.kind === 'round' || e.kind === 'shot')) yard.shots[e.d].struck++;
    }
    for (let i = 0; i < P; i++) {
      const p = s.bodies[i], want = yard.arms[i].gun;
      if (p.gn !== want) { p.gn = want; p.am = ctx.guns[want].ammo ?? undefined; if (p.am === undefined) delete p.am; s.events.push({ t: 'reload', p: i }); }
      if (!(p.gr > 0) && !(p.lc > 0)) p.gr = yard.arms[i].grenades;
    }
  }
  for (const e of s.events) {
    if (e.t === 'hit' && e.p < P) {
      const c = yard.combo[e.p];
      if (!c.open) { c.hits = 0; c.damage = 0; c.open = 1; }
      c.hits++; c.damage += e.dmg;
      const mv = s.bodies[e.p].mv;
      if (mv && mv.startsWith('chain.')) { const k = parseInt(mv.slice(6), 10); if (!yard.chain[e.p].steps.includes(k)) yard.chain[e.p].steps.push(k); }
      // (the strong in the chain: the opener stands for its first blow; the breaker and the blowout end it)
      if (mv === 'strong' && !yard.chain[e.p].steps.includes(1)) { yard.chain[e.p].steps.push(1); yard.chain[e.p].open = 'strong'; }
      if (mv === 'strong.break' || mv === 'strong.out') yard.chain[e.p].ender = mv;
    }
  }
  for (let i = 0; i < P; i++) {
    const p = s.bodies[i], ch = yard.chain[i];
    // a chain ends when the body leaves it: the finisher landed, or dropped (the press log says why)
    if (ch.steps.length && !(p.mv && (p.mv.startsWith('chain.') || p.mv.startsWith('strong')))) {
      const n = ctx.fighters[p.fi].brawl.chain, done = ch.steps.includes(n) || ch.steps.some((k) => k > n);
      const lastWhy = yard.log[i].slice().reverse().find((e) => e.verdict === 'dropped');
      // (how it ended: the finisher, the breaker, the blowout, or dropped and why; opened by the strong, said so)
      const end = ch.ender === 'strong.break' ? 'breaker' : ch.ender === 'strong.out' ? 'blowout' : done ? 'finisher' : 'dropped';
      ch.last = { steps: ch.steps.slice(), of: n, end, ...(ch.open ? { open: ch.open } : {}), ...(end === 'dropped' ? { why: lastWhy?.why ?? 'no press after the last hit' } : {}) };
      ch.steps = []; delete ch.ender; delete ch.open;
    }
    // a combo over: once no dummy reels from it
    const c = yard.combo[i];
    if (c.open && !s.bodies.some((d, j) => j >= P && !d.gone && (d.st === 'hit' || d.st === 'fall') && d.combo > 0)) { c.last = { hits: c.hits, damage: c.damage }; c.open = 0; }
    // never dies: knocked out, back on its feet where it lies, whole
    if (p.ko && p.st === 'ko') { p.ko = 0; p.hp = ctx.fighters[p.fi].hp; p.st = 'rise'; p.sf = 0; }
  }
  if (yard.wave) waveStep(room);
  for (let i = P; i < s.bodies.length; i++) {
    const d = s.bodies[i];
    // (a wave's bodies stay down: the wave is cleared, not refilled)
    if (yard.modes[i - P] === 'wave') continue;
    if (d.ko && yard.ko[i] === undefined) yard.ko[i] = s.f;
    if (yard.ko[i] !== undefined && s.f - yard.ko[i] >= BACK) {
      // back on its spot, whole, a moment untouchable
      Object.assign(d, { ko: 0, gone: 0, hp: yard.hp[i], st: 'stand', sf: 0, mv: null, x: yard.homes[i][0], z: yard.homes[i][1], y: 0, vx: 0, vy: 0, vz: 0, combo: 0, jug: 0, inv: 30 });
      delete yard.ko[i];
      s.events.push({ t: 'back', p: i });
    }
    if (yard.health === 'refill' && FREE.has(d.st) && d.hp < yard.hp[i]) d.hp = yard.hp[i];
  }
}

// ── what the room shows ──────────────────────────────────────────────────────────────────────────────────────

/** What the room shows a player (index `i`): mm and frames, the HUD's to word. */
export function yardRead(room, i = 0) {
  const { s, yard, ctx, mind } = room, p = s.bodies[i], F = ctx.fighters[p.fi], P = yard.players;
  const reach = F.moves['chain.1'].reach;
  const line = s.bodies.slice(P).filter((d) => !d.gone).map((d) => {
    const dz = d.z - p.z, dx = d.x - p.x;
    return { id: d.id, at: [d.x, d.z], dz, dx, lined: Math.abs(dz) <= (yard.range ? ctx.guns[p.gn].line : s.rules.line), inReach: Math.abs(dx) <= reach + F.idle.stand.push[2], ko: !!d.ko, hp: d.hp, hpMax: yard.hp[d.id], mode: yard.modes[d.id - P], token: (mind.tok[i] ?? []).includes(d.id), ...(yard.range ? { stagger: d.sg ? Math.round((d.sg * 100) / (d.po ?? s.rules.poise)) : 0 } : {}) };
  });
  const ch = yard.chain[i];
  return {
    line,
    chain: { of: F.brawl.chain, now: ch.steps.slice(), last: ch.last },
    log: yard.log[i].slice(),
    clinch: p.st === 'hold' ? { knees: s.rules.knees - (p.kn ?? 0), left: Math.max(0, s.rules.hold - p.sf), of: s.rules.hold, back: !!p.back } : null,
    combo: { ...(yard.combo[i].open ? { hits: yard.combo[i].hits, damage: yard.combo[i].damage } : { hits: 0, damage: 0 }), last: yard.combo[i].last },
    tokens: (mind.tok[i] ?? []).slice(),
    state: p.ist ? { id: p.ist[0], left: p.ist[1] } : null,
    weapon: p.wpn ?? null,
    hp: p.hp, hpMax: F.hp,
    // (on the range: the gun held, its ammo, the rounds fired and landed, their damage, the rounds taken; a grenade's)
    // (the wave tester: which wave of how many, its formation and pattern, the bodies left, its clock, the clears kept)
    ...(yard.wave ? { wave: (() => { const W = yard.wave, w = W.list[W.k]; const left = W.bodies.filter((x) => x.wave === W.k && !s.bodies[x.id].ko && !s.bodies[x.id].gone).length; return { n: W.k + 1, of: W.list.length, name: w.name, formation: w.formation, pattern: w.pattern, state: W.state, left: W.state === 'on' ? left : 0, frames: W.state === 'on' ? s.f - W.start : 0, next: W.state === 'wait' ? W.t : 0, struck: W.struck, cleared: W.cleared.slice(), rounds: W.rounds }; })() } : {}),
    ...(yard.range ? { gun: { id: ctx.guns[p.gn].id, name: ctx.guns[p.gn].name ?? null, ammo: p.am ?? null, of: ctx.guns[p.gn].ammo, line: ctx.guns[p.gn].line, grenades: p.gr ?? 0, aim: [p.ax ?? p.face, p.az ?? 0], ...yard.shots[i] } } : {}),
  };
}

/** The range's guns as its player reads them (each its numbers) and the gunner's moves: the command list's kinds. */
export function rangeMoveList(room) {
  const a = room.yard.arms[0];
  return gunMoveList(room.ctx.guns.slice(1, a.grenadeGun), a.grenades);
}

// ── the move list ────────────────────────────────────────────────────────────────────────────────────────────

const words = (slot) => slot.split('.').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
// a blow by its own name (its family's: jab, straight, roundhouse), else its slot's
const blowWords = (m, slot) => (m && typeof m.id === 'string' ? m.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : words(slot));
const dataOf = (m) => [
  { what: 'startup', value: String(m.startup) }, { what: 'active', value: String(m.active) }, { what: 'recovery', value: String(m.recovery ?? '—') },
  { what: 'damage', value: String((m.damage ?? 0) * (m.hits || 1)) },
];
/** A brawler's moves as its player reads them, by kind: the chain (its style's), in the air, the clinch, the desperation,
 * the special, the street's things; the strong blows and their cooldown; the dashes. */
export function brawlMoveList(F) {
  const S = BRAWL_STYLES[F.brawl.style], n = F.brawl.chain;
  const chain = Array.from({ length: n }, (_, k) => {
    const m = F.moves[`chain.${k + 1}`];
    return { name: `${k + 1}. ${blowWords(m, S.chain[k])}`, input: 'A', about: k === n - 1 ? 'the last of the chain: it knocks down' : k ? 'on a hit, the next' : 'the first blow; a whiff ends the chain', data: dataOf(m) };
  });
  if (F.moves[`chain.${n}f`]) chain.push({ name: `${n}. ${blowWords(F.moves[`chain.${n}f`], S.finisher)} (finisher)`, input: '→ + A', about: 'toward the foe on the last press: the other finisher', data: dataOf(F.moves[`chain.${n}f`]) });
  const D = F.moves.desperate;
  const special = ['neutral', 'forward', 'back', 'down'].filter((d) => F.moves[`special.${d}.M`]).map((d) => ({ name: `${words(F.moves[`special.${d}.M`].id ?? d)}`, input: d === 'neutral' ? 'S' : d === 'forward' ? '→ + S' : d === 'back' ? '← + S' : '↕ + S', about: 'the fighter\'s special', data: dataOf(F.moves[`special.${d}.M`]) }));
  const cool = `${F.brawl.cool} frames from its start`;
  const strong = [
    { name: `Strong: ${blowWords(F.moves.strong, S.strong.slot)}`, input: 'St', about: 'from a stand, the opener: heavier and slower, it staggers long, and the chain follows on from its second blow (St, A, A …)', data: [...dataOf(F.moves.strong), { what: 'cooldown', value: cool }] },
    { name: 'Breaker', input: 'A …, St', about: 'after a fast blow that hit: the chain ended early, the body knocked down', data: [...dataOf(F.moves['strong.break']), { what: 'cooldown', value: cool }] },
    { name: 'Blowout', input: 'A …, → + St', about: 'after a fast blow that hit, toward the foe: the body flung down the street, bowling over the crowd behind it', data: [...dataOf(F.moves['strong.out']), { what: 'cooldown', value: cool }] },
  ];
  return [
    { label: 'Chain', moves: chain },
    { label: 'Strong', moves: strong },
    { label: 'Air', moves: [
      { name: 'Air punch', input: 'J, A', about: 'a jump straight up, then attack: quick, close', data: dataOf(F.moves['air.L']) },
      { name: 'Flying kick', input: '→ J, A', about: 'a jump with a direction, then attack (from a run, the long jump\'s)', data: dataOf(F.moves['air.M']) },
      { name: 'Stomp', input: 'J, St', about: 'a jump straight up, then strong: straight down, it knocks down', data: [...dataOf(F.moves['strong.air']), { what: 'cooldown', value: cool }] },
      { name: 'Dive kick', input: '→ J, St', about: 'a jump with a direction, then strong: down at a slant, it knocks down', data: [...dataOf(F.moves['strong.dive']), { what: 'cooldown', value: cool }] },
    ] },
    { label: 'Dash', moves: [
      { name: 'Run', input: '→ →', about: 'tapped twice toward, held: a run, across the street too', data: [{ what: 'speed (mm a frame)', value: String(Math.round((F.dash.f.dist * BRAWL_RULES.run) / (F.dash.f.frames * 100))) }] },
      { name: `Running blow: ${blowWords(F.moves['run.attack'], 'run.attack')}`, input: '→ →, A', about: 'running, attack: carried on by the run, it knocks down', data: dataOf(F.moves['run.attack']) },
      { name: 'Long jump', input: '→ →, J', about: `running, jump: it carries ${BRAWL_RULES.runJump - 100}% further`, data: [] },
      { name: 'Back-step', input: '← ←', about: 'tapped twice away: a step back, still facing the foe, untouchable as it starts', data: [{ what: 'distance (mm)', value: String(F.dash.b.dist) }, { what: 'frames', value: String(F.dash.b.frames) }, { what: 'untouchable', value: String(F.dash.b.invuln ?? 0) }] },
    ] },
    { label: 'Clinch', moves: [
      { name: 'Take hold', input: 'walk into', about: 'walk into a foe lined up in front of you', data: [{ what: 'frames walking in', value: String(BRAWL_RULES.grab) }] },
      { name: 'Knee', input: 'A', about: `held: a knee to the body; the ${BRAWL_RULES.knees}rd knocks down`, data: [{ what: 'damage', value: String(F.brawl.knee) }] },
      { name: 'Throw', input: '→ + A', about: 'held: thrown forward, into whoever stands behind', data: [{ what: 'damage', value: String(F.brawl.throw) }] },
      { name: 'Throw behind', input: '← + A', about: 'held: thrown behind you', data: [{ what: 'damage', value: String(F.brawl.throw) }] },
      { name: 'Suplex', input: 'A + ←/→', about: 'taken from behind: slammed down behind you', data: [{ what: 'damage', value: String(F.brawl.suplex) }] },
    ] },
    { label: 'Desperation', moves: [
      { name: 'Desperation', input: 'A + J', about: 'invincible, it strikes all round and knocks down; it costs health when it lands, never the last of it; it breaks a hold', data: [...dataOf(D), { what: 'price', value: String(D.price) }] },
    ] },
    ...(special.length ? [{ label: 'Special', moves: special }] : []),
    { label: 'Street', moves: [
      { name: 'Pick up', input: 'A over it', about: `food heals, a power-up holds its state, a weapon arms the chain (${Object.keys(THINGS.weapon).join(', ')})`, data: [] },
      { name: 'Throw the weapon', input: 'S', about: 'holding one: it strikes the first foe lined up ahead', data: [] },
    ] },
  ];
}
