/**
 * brawl crowd — a crowd that fights like one, not like six duelists: who may close in, where the rest wait, what each
 * kind of thug throws, and the waves that hold each gate. It hands the brawl's core (brawl-core.js) a pad a body, as a
 * player's buttons do (brawl-moves.js); the core never knows who chose.
 *
 *   • ATTACK TOKENS: at most `tokens` bodies close in on a player at once; the rest CIRCLE at `ring`, spread across the
 *     band, half of them working round to the player's back (the flank). A body with a token lines up across the belt
 *     (within a third of the core's `line`), closes to its blow's reach, and swings only when the player is free and no
 *     other body is already swinging at them, so a player always gets a frame to act between two attackers' blows.
 *   • BACK OFF WHEN HURT: a body struck gives its token back; once up, it backs away to the ring and waits `cool` frames
 *     before it asks again (as after any attack of its own).
 *   • TYPES as recipes (CROWD_TYPES): a fighter from the fight's solver (an archetype, a weapon, its health) and a role:
 *     what it throws (`chain` its first blows, a special by its slot, or `grab`: it walks into the player to take hold,
 *     knees and throws), how much of its chain. The thug, the knife, the charger (a rush from range), the jumper (a
 *     leaping overhead), the heavy (a big body that grabs).
 *   • WAVES: each held screen's crowd (`waves: [{ screen, crowd: [{ type, n }] }]`), waiting offstage until a player walks
 *     into its screen, entering by turns from the view's right edge, its left and the street's back, at most `limit`
 *     on the street at once (the rest as others fall); the screen's gate opens (`cleared`) when the last falls.
 *
 *   CROWD_TYPES, CROWD_RULES
 *   readWaves(waves, belt)                  → the waves, settled (throws naming the fault)
 *   streetOf({ belt, players, waves, rules?, crowd? }) → a street: { ctx, s, mind } (players: [{ recipe, style? }])
 *   stepStreet(street, playerPads)          → the street a frame on: the crowd's pads, the core's step, the waves
 *
 * Pure and deterministic: its only variety is a hash of a body's id (no dice, no clock).
 */
import { solveFighter } from '../versus/versus-solver.js';
import { brawlFighter } from './brawl-moves.js';
import { newBrawl, stepBrawl } from './brawl-core.js';
import { viewHalf } from './brawl-belt.js';

/** what a thug is: its fighter (an archetype, a weapon, its health) and what it throws */
const type = (says, o) => Object.freeze({ says, ...o });
export const CROWD_TYPES = Object.freeze({
  thug: type('the street\'s own: walks in, throws two or three of its chain', { archetype: 'all-rounder', hp: 260, attack: 'chain', combo: 3 }),
  knife: type('quick and armed: a knife in the lead hand, two cuts and away', { archetype: 'rushdown', hp: 180, weapon: 'knife', attack: 'chain', combo: 2 }),
  charger: type('a rush from range: it lines up far off and runs the player down', { archetype: 'all-rounder', hp: 300, attack: 'special.back.M' }),
  jumper: type('a leaping overhead: it comes down on the player from a step away', { archetype: 'rushdown', hp: 220, attack: 'special.down.M' }),
  heavy: type('a big body that grabs: it walks into the player, knees and throws', { archetype: 'grappler', hp: 600, attack: 'grab', combo: 2, knees: 2 }),
});
export const CROWD_TYPE_IDS = Object.freeze(Object.keys(CROWD_TYPES));

export const CROWD_RULES = Object.freeze({
  tokens: 2,          // bodies closing in on one player at once
  ring: 2600,         // mm the rest circle at
  spread: 900,        // mm across the band between the circlers' places
  limit: 6,           // bodies of a wave on the street at once
  cool: [50, 110],    // frames a body waits after its attack (or being hurt) before it asks again
  approach: 200,      // frames a body may take to close in before it gives its token back
  dead: 120,          // mm a body counts as there
  enter: 1200,        // mm outside the view a body enters from
});

const FREE = new Set(['stand', 'walk', 'land']);
const HURT = new Set(['hit', 'fall', 'down', 'rise', 'held', 'thrown']);
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
// a body's own variety: a hash of its id, 0 … 1
const vary = (id, k = 0) => { let h = (id * 2654435761 + k * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0; return (h % 1000) / 1000; };

/** Read the waves: one a held screen, its crowd by type. */
export function readWaves(waves, belt) {
  if (!Array.isArray(waves)) throw new Error('brawl: waves is a list of { screen, crowd: [{ type, n }] }');
  const seen = new Set();
  return waves.map((w, i) => {
    const at = `waves[${i}]`;
    if (!w || typeof w !== 'object') throw new Error(`brawl: ${at} is { screen, crowd: [{ type, n }] }`);
    const sc = belt.screens[w.screen];
    if (!sc) throw new Error(`brawl: ${at}.screen is a screen of the belt (0 to ${belt.screens.length - 1})`);
    if (!sc.gate) throw new Error(`brawl: ${at}.screen ${w.screen} is not held: a wave holds a gated screen`);
    if (seen.has(w.screen)) throw new Error(`brawl: ${at}.screen ${w.screen} has a wave already`);
    seen.add(w.screen);
    if (!Array.isArray(w.crowd) || !w.crowd.length) throw new Error(`brawl: ${at}.crowd is a list of { type, n }`);
    for (const [j, c] of w.crowd.entries()) {
      if (!CROWD_TYPES[c.type]) throw new Error(`brawl: ${at}.crowd[${j}].type is one of ${CROWD_TYPE_IDS.join(', ')}`);
      if (!(Number.isInteger(c.n) && c.n >= 1 && c.n <= 20)) throw new Error(`brawl: ${at}.crowd[${j}].n is 1 to 20`);
    }
    return { screen: w.screen, crowd: w.crowd.map((c) => ({ type: c.type, n: c.n })) };
  }).sort((a, b) => a.screen - b.screen);
}

/** A thug's fighter: its archetype's recipe from the fight's solver, its weapon and health. */
export function crowdFighter(id) {
  const T = CROWD_TYPES[id];
  const recipe = { ...solveFighter({ id, archetype: T.archetype }).recipe, archetype: T.archetype, id, name: id, hp: T.hp, ...(T.weapon ? { weapon: T.weapon } : {}) };
  return brawlFighter(recipe);
}

/** A street to fight down: the players at its start, every wave's crowd waiting offstage, the crowd's mind. */
export function streetOf({ belt, players, waves = [], rules, crowd } = {}) {
  if (!belt) throw new Error('brawl: a street needs its belt');
  if (!Array.isArray(players) || !players.length || players.length > 4) throw new Error('brawl: a street has 1 to 4 players');
  const W = readWaves(waves, belt);
  const fighters = players.map((p) => brawlFighter(p.recipe, { style: p.style }));
  const types = [...new Set(W.flatMap((w) => w.crowd.map((c) => c.type)))];
  const typeAt = {};
  for (const t of types) { typeAt[t] = fighters.length; fighters.push(crowdFighter(t)); }
  const half = viewHalf(belt), [n0, n1] = belt.depth.map((v) => Math.round(v * 1000));
  const bodies = players.map((p, i) => ({ fighter: i, side: 'player', x: Math.round((half - 3 + i * 0.6) * 1000), z: Math.round(n0 + ((i + 1) * (n1 - n0)) / (players.length + 1)) }));
  const kinds = [];
  W.forEach((w, k) => { for (const c of w.crowd) for (let j = 0; j < c.n; j++) { bodies.push({ fighter: typeAt[c.type], side: 'crowd', x: 0, z: 0, wave: k, ...(CROWD_TYPES[c.type].attack === 'grab' ? {} : { grabs: false }) }); kinds.push(c.type); } });
  const ctx = { fighters, belt };
  const s = newBrawl(ctx, { bodies, rules });
  // (each crowd body's type, by its id)
  const type = Object.fromEntries(kinds.map((t, j) => [players.length + j, t]));
  return { ctx, s, mind: { rules: { ...CROWD_RULES, ...(crowd ?? {}) }, waves: W, wave: 0, type, tok: {}, b: {}, entered: 0 } };
}

/** The street a frame on: the crowd thinks, the core steps, the waves come in and their gates open. */
export function stepStreet(street, playerPads = []) {
  const { ctx } = street;
  const mind = { ...street.mind, tok: Object.fromEntries(Object.entries(street.mind.tok).map(([k, v]) => [k, v.slice()])), b: Object.fromEntries(Object.entries(street.mind.b).map(([k, v]) => [k, { ...v }])) };
  const pads = think(street.s, ctx, mind);
  for (const [i, p] of playerPads.entries()) if (p) pads[i] = p;
  const s = stepBrawl(street.s, pads, ctx);
  waves(s, ctx, mind);
  return { ctx, s, mind };
}

// ── the mind ─────────────────────────────────────────────────────────────────────────────────────────────────

const holding = (M, pid) => (M.tok[pid] ??= []);
function giveBack(M, id) {
  for (const k of Object.keys(M.tok)) M.tok[k] = M.tok[k].filter((j) => j !== id);
}
/** where a body's blow reaches from (mm, its front to the foe's centre), by what it throws */
function reachOf(F, attack) {
  if (attack === 'grab') return 0;
  const m = F.moves[attack === 'chain' ? 'chain.1' : attack];
  if (!m) return 700;
  // (a move that travels reaches its travel further)
  return Math.round(m.reach + (m.travel ?? 0) * Math.max(0, m.startup + m.active - 2));
}
// a pad that walks toward a point, still within `dead` of it
const toward = (p, x, z, dead) => ({ x: Math.abs(x - p.x) > dead ? sgn(x - p.x) : 0, z: Math.abs(z - p.z) > dead ? sgn(z - p.z) : 0 });

function think(s, ctx, M) {
  const R = M.rules, B = s.bodies, pads = [];
  const [n0, n1] = ctx.belt.depth.map((v) => Math.round(v * 1000));
  const lineUp = Math.round(s.rules.line / 3);
  for (const p of B) {
    if (p.side !== 'crowd' || p.gone || p.ko) { if (p.side === 'crowd') giveBack(M, p.id); continue; }
    const m = (M.b[p.id] ??= { mode: 'circle', t: 0, cool: Math.round(R.cool[0] * vary(p.id)) });
    m.t++;
    const T = p.tg >= 0 ? B[p.tg] : null;
    const kind = CROWD_TYPES[M.type[p.id]], F = ctx.fighters[p.fi];
    if (m.cool > 0) m.cool--;
    // struck: the token given back; once up, back off and wait
    if (HURT.has(p.st)) {
      giveBack(M, p.id);
      if (m.mode !== 'recover') { m.mode = 'recover'; m.t = 0; m.cool = Math.max(m.cool, R.cool[0] + Math.round((R.cool[1] - R.cool[0]) * vary(p.id, s.f))); }
      pads[p.id] = {};
      continue;
    }
    // holding the player (the heavy): its knees, then the throw
    if (p.st === 'hold') {
      pads[p.id] = m.t % 16 === 8 ? { hold: (p.kn ?? 0) >= (kind.knees ?? 2) ? 'forward' : 'knee' } : {};
      continue;
    }
    if (!T) { pads[p.id] = {}; continue; }
    const side0 = sgn(p.x - T.x) || (p.id % 2 ? 1 : -1);
    const mine = holding(M, T.id);
    const has = mine.includes(p.id);
    // ── what it throws (its blow under way: the chain run on, a grab held on to) ──
    if (p.st === 'move' && p.mv && p.mv.startsWith('chain.')) {
      const k = parseInt(p.mv.slice(6), 10);
      pads[p.id] = k < Math.min(kind.combo ?? 1, F.brawl.chain) ? { mv: `chain.${k + 1}` } : {};
      m.swung = 1;
      continue;
    }
    if (p.st === 'move' || p.st === 'air' || p.st === 'prejump' || p.st === 'throwing') { m.swung = 1; pads[p.id] = {}; continue; }
    // ── its blow over: the token back, away to the ring, a while before it asks again ──
    if (has && m.swung && FREE.has(p.st)) {
      giveBack(M, p.id); m.swung = 0; m.mode = 'recover'; m.t = 0;
      m.cool = R.cool[0] + Math.round((R.cool[1] - R.cool[0]) * vary(p.id, s.f));
    }
    if (m.mode === 'approach' && (!has || m.t > R.approach)) { giveBack(M, p.id); m.mode = 'recover'; m.t = 0; m.cool = R.cool[0]; }
    // ── a token, when one is free and its wait is over ──
    if (m.mode !== 'approach' && m.cool === 0 && mine.length < R.tokens && !mine.includes(p.id)) { mine.push(p.id); m.mode = 'approach'; m.t = 0; m.swung = 0; }
    if (m.mode === 'approach') {
      const reach = reachOf(F, kind.attack), front = F.idle.stand.push[2];
      const side = side0;
      // (lined up across the belt first, then in to the blow's reach; the grab walks into the body)
      const zOk = Math.abs(p.z - T.z) <= lineUp;
      const want = kind.attack === 'grab' ? 0 : Math.max(front + 150, reach - 160);
      const dx = Math.abs(p.x - T.x);
      if (!zOk) { pads[p.id] = { x: dx < want ? side : 0, z: sgn(T.z - p.z) }; continue; }
      if (kind.attack === 'grab') { pads[p.id] = { x: -side, z: 0 }; continue; }
      if (dx > want + R.dead) { pads[p.id] = { x: -side, z: 0 }; continue; }
      // in reach and facing: it swings only when the player is free and no one else is swinging at them
      const busy = mine.some((j) => j !== p.id && (B[j].st === 'move' || B[j].st === 'hold' || B[j].st === 'throwing'));
      if (FREE.has(T.st) && !busy && p.face === -side && FREE.has(p.st)) { pads[p.id] = { mv: kind.attack === 'chain' ? 'chain.1' : kind.attack }; continue; }
      pads[p.id] = {};
      continue;
    }
    // ── the ring: its place round the player, half the crowd on the player's back (the flank) ──
    if (m.mode === 'recover' && m.cool === 0) m.mode = 'circle';
    if (m.side === undefined || m.t % 120 === 0) {
      const ahead = B.filter((o) => o.side === 'crowd' && !o.gone && !o.ko && o.tg === T.id && o.id !== p.id && sgn(o.x - T.x) === T.face).length;
      const behind = B.filter((o) => o.side === 'crowd' && !o.gone && !o.ko && o.tg === T.id && o.id !== p.id && sgn(o.x - T.x) === -T.face).length;
      m.side = behind < ahead ? -T.face : ahead < behind ? T.face : side0;
    }
    // (each its own place: its rank among the ring on its side spreads it across the band, then a step further out;
    // the ring kept in the camera's view, where the player can reach it)
    const rank = B.filter((o) => o.side === 'crowd' && !o.gone && !o.ko && o.tg === T.id && o.id < p.id && (M.b[o.id]?.side ?? 0) === m.side && M.b[o.id]?.mode !== 'approach').length;
    const off = ((rank % 3) - 1) * R.spread, out = Math.floor(rank / 3) * 700;
    const half = Math.round(viewHalf(ctx.belt) * 1000), lo = s.cam - half + 900, hi = s.cam + half - 900;
    const gx = Math.max(lo, Math.min(hi, T.x + m.side * (R.ring + out))), gz = Math.max(n0, Math.min(n1, T.z + off));
    pads[p.id] = toward(p, gx, gz, R.dead * 2);
  }
  return pads;
}

// ── the waves ────────────────────────────────────────────────────────────────────────────────────────────────

function waves(s, ctx, M) {
  const W = M.waves[M.wave];
  if (!W) return;
  const belt = ctx.belt, sc = belt.screens[W.screen], B = s.bodies, R = M.rules;
  const players = B.filter((p) => p.side === 'player' && !p.ko && !p.gone);
  const mine = B.filter((p) => p.side === 'crowd' && p.wv === M.wave);
  const waiting = mine.filter((p) => p.gone && !p.ko);
  const standing = mine.filter((p) => !p.gone && !p.ko);
  // (it comes in when a player walks into its screen)
  const begun = M.begun ?? -1;
  if (begun !== M.wave) {
    if (!players.some((p) => p.x >= Math.round((sc.from + 2) * 1000))) return;
    M.begun = M.wave;
    s.events.push({ t: 'wave', screen: W.screen, n: mine.length });
  }
  // the next waiting bodies in, up to the limit, by turns from the right edge, the left and the street's back
  const half = Math.round(viewHalf(belt) * 1000), cam = s.cam;
  const [n0, n1] = belt.depth.map((v) => Math.round(v * 1000));
  for (const p of waiting.slice(0, Math.max(0, R.limit - standing.length))) {
    const k = M.entered++ % 3;
    const x = k === 0 ? cam + half + R.enter : k === 1 ? cam - half - R.enter : cam + Math.round((vary(p.id, 7) - 0.5) * half);
    p.gone = 0; p.x = Math.max(0, Math.min(Math.round(belt.length * 1000), x)); p.z = k === 2 ? n1 : Math.round(n0 + (n1 - n0) * vary(p.id, 3));
    p.face = sgn(cam - p.x) || -1; p.st = 'stand'; p.sf = 0;
    s.events.push({ t: 'enter', p: p.id, from: ['right', 'left', 'back'][k], x: p.x, z: p.z });
  }
  // the last of it fallen: its gate opens, the next wave waits for its screen
  if (!waiting.length && mine.every((p) => p.ko)) {
    s.cleared = [...s.cleared, W.screen];
    s.events.push({ t: 'cleared', screen: W.screen });
    M.wave++;
  }
}
