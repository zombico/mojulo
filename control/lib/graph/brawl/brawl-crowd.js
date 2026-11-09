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
 *   • EVERYONE IS A BODY: a thug is a brawler as a player is (brawl-moves.js brawlFighter: the chain, the strong, the
 *     run, every air blow, the desperation, its specials), only its own TIMING AND DAMAGE (`tune`, BRAWL_TUNE) and its
 *     REPERTOIRE (`plays`, CROWD_PLAYS: the player's own moves as its commands). TYPES as recipes (CROWD_TYPES): a
 *     fighter from the fight's solver (an archetype, a weapon, its health), its tune, its plays, how much of its chain,
 *     its `poise` (the stagger a light round's flinch waits for: a big body soaks a stream).
 *     A body given a token picks one of its plays (by its own hash; a strong one only off its cooldown) and closes to
 *     where that play starts: in reach for a blow, a jump away for a leap, the ring's edge for a run. The thug, the
 *     knife, the charger (a rush from range), the jumper (leaps), the heavy (a big slow body that grabs).
 *   • WAVES: each held screen's crowd (`waves: [{ screen, crowd: [{ type, n, entrance?, ambush? }] }]`), waiting offstage until a player walks
 *     into its screen (a held screen with no wave is open from the start), entering by turns from the view's right edge, its left and the street's back, at most `limit`
 *     on the street at once (the rest as others fall); the screen's gate opens (`cleared`) when the last falls. A crowd
 *     entry's ENTRANCE (brawl-waves.js ENTRANCES: walk, the default, by turns from the edges and the back; a door, a drop,
 *     a dig or a vault onto a spot in the view, brawl-core.js enterBody; a RIDE in on a mount from the view's edge, its
 *     `mount` { kind, passes, onFoot }: knocked off it, a rider on foot fights on) and its AMBUSH (hidden in the view ahead,
 *     crouched behind whatever is there, until a player comes within `ambush` of it).
 *
 *   • THE SHOOTING CROWD (`shoot`): a body with a gun holds its range along the belt (SHOOT_RANGE), and given a token
 *     AIMS at the player for its gun's warning (its `telegraph`, the aim fixed as it starts: the round goes where the
 *     warning pointed, so a player who steps off it is missed), then fires its volley. The tokens are its fire tokens.
 *   • THE BOSS (a wave's `boss: { recipe, cpu?, hp?, tune?, plays?, weapon? }`, the belt's boss screen only): any of
 *     the fight's characters, a body as every other is (a brawler's fighter, its own `tune`, its own `weapon` the whole
 *     fight: an armed boss, the fight's blade), played by the fight's own
 *     opponent (versus-cpu.js cpuPad), shown the duel it reads (the boss and its target along the belt) and its modern
 *     buttons turned into the brawl's commands; and, every while (BOSS_REST frames after the last), a PLAY of its own
 *     (`plays`, BOSS_PLAYS by default: the brawler's strong and its enders, the run, the leaps, the desperation when
 *     held), thrown as the crowd throws one, once it stands where the play starts. It steps onto the player's line
 *     before it swings, takes no token and, like the crowd, never starts a blow on a player another body is already
 *     swinging at or who is still reeling (its own combo goes on). It enters from the right edge as its wave comes in, with its own
 *     bar (`mind.boss`, its name); when it falls, the rest of its wave flees and the stage is clear.
 *
 *   CROWD_TYPES, CROWD_RULES
 *   readWaves(waves, belt)                  → the waves, settled (throws naming the fault)
 *   streetOf({ belt, players, waves, things?, rules?, crowd? }) → a street: { ctx, s, mind } (players: [{ recipe,
 *                                           style? }]; things the street's, brawl-things.js, in the belt's metres: each
 *                                           player's armed self compiled for every weapon on the street)
 *   stepStreet(street, playerPads)          → the street a frame on: the crowd's pads, the core's step, the waves
 *   crowdPads(s, ctx, M), newCrowdMind(type) the crowd's mind alone, for bodies already on the street (a practice room's)
 *
 * Pure and deterministic: its only variety is a hash of a body's id (no dice, no clock).
 */
import { solveFighter } from '../versus/versus-solver.js';
import { WEAPONS } from '../versus/versus-library.js';
import { cpuPad, newCpuMemory, CPU_LEVELS } from '../versus/versus-cpu.js';
import { BTN } from '../versus/versus-input.js';
import { brawlFighter, STRONG_SLOTS } from './brawl-moves.js';
import { readGun, ACROSS } from './brawl-guns.js';
import { newBrawl, stepBrawl, enterBody } from './brawl-core.js';
import { viewHalf } from './brawl-belt.js';
import { readThings, MOUNTS, MOUNT_IDS } from './brawl-things.js';

/** THE PLAYS: a player's own moves, as the crowd throws them (each a body's command, as a player's buttons make it) */
export const CROWD_PLAYS = Object.freeze({
  chain: 'in reach: its chain, `combo` blows of it',
  strong: 'in reach: the strong opener, its chain after it',
  break: 'its chain, ended early by the breaker',
  blowout: 'its chain, ended by the blowout: the player flung',
  run: 'from the ring\'s edge: it runs in and throws the running blow',
  kick: 'from a jump away: it leaps in, the flying kick',
  dive: 'from a jump away: it leaps in, the dive kick down at a slant',
  grab: 'it walks into the player to take hold, knees and throws',
  special: '`special.<neutral | forward | back | down>`: its special at that direction',
  desperate: 'held: it breaks out with its desperation, paying its price',
  shoot: 'a gun\'s (the run & gun\'s crowd): it holds its range, aims a beat (its gun\'s warning), then fires its volley',
});
const STRONG_PLAYS = new Set(['strong', 'break', 'blowout', 'dive']);
/** how a street's crowd may come in (brawl-waves.js ENTRANCES, brawl-core.js enterBody) */
const STREET_ENTRANCES = ['walk', 'door', 'drop', 'dig', 'vault', 'ride'];
/** a mount's options read (brawl-things.js MOUNTS): its kind, its passes, whether its rider fights on foot */
export function readMount(m, where) {
  if (m === undefined) return {};
  if (!m || typeof m !== 'object') throw new Error(`brawl: ${where} is { kind?, passes?, onFoot? }`);
  if (m.kind !== undefined && !MOUNTS[m.kind]) throw new Error(`brawl: ${where}.kind is one of ${MOUNT_IDS.join(', ')}`);
  if (m.passes !== undefined && !(Number.isInteger(m.passes) && m.passes >= 0 && m.passes <= 6)) throw new Error(`brawl: ${where}.passes is 0 to 6`);
  if (m.onFoot !== undefined && typeof m.onFoot !== 'boolean') throw new Error(`brawl: ${where}.onFoot is true or false`);
  return { ...(m.kind ? { kind: m.kind } : {}), ...(m.passes !== undefined ? { passes: m.passes } : {}), ...(m.onFoot !== undefined ? { onFoot: m.onFoot } : {}) };
}
/** a rider's pad: from the saddle, a gun's rounds at a player ahead of it (its mount does the rest) */
export function rideFire(p, T) {
  if (p.gn === undefined || !T || T.gone || Math.sign(T.x - p.x) !== p.md || Math.abs(T.x - p.x) > 5500) return {};
  const [, az] = aimAt(p, T);
  return { fire: [p.md, az] };
}
/** where a shooter fires from: along the belt, at least and at most (mm) */
export const SHOOT_RANGE = Object.freeze([2200, 4800]);
/** the aim at a body from another: along it, across it at the diagonal's slant, or straight across (eight ways) */
export function aimAt(p, T) {
  const dx = T.x - p.x, dz = T.z - p.z, ax = Math.sign(dx);
  if (Math.abs(dx) < 300) return [0, Math.sign(dz) || 1];
  return [ax || p.face, Math.abs(dz) < Math.abs(dx) * ACROSS * 0.5 ? 0 : Math.sign(dz)];
}
/** the guns a crowd's types carry: { ids (each its index in ctx.guns), guns } */
export function crowdGuns(types, guns = []) {
  const out = guns.slice(), at = {};
  for (const t of types) { const g = CROWD_TYPES[t]?.gun; if (g && at[g] === undefined) { at[g] = out.length; out.push(readGun(g)); } }
  return { at, guns: out };
}
/** a boss's plays unless its wave says (its grabs are the fight's throw, the CPU's) */
export const BOSS_PLAYS = Object.freeze(['strong', 'break', 'blowout', 'run', 'kick', 'dive', 'desperate']);
/** frames a boss fights as the fight's CPU between two plays of its own (and up to a second more, its own) */
export const BOSS_REST = 90;
/** what a thug is: its fighter (an archetype, a weapon, its health), its timing and damage, what it throws */
const type = (says, o) => Object.freeze({ says, ...o, tune: Object.freeze(o.tune ?? {}), plays: Object.freeze(o.plays) });
export const CROWD_TYPES = Object.freeze({
  thug: type('the street\'s own: walks in, throws two or three of its chain (now and then broken off with a knockdown), or leaps in with a kick; a beat slow, a little weaker than a player', { archetype: 'all-rounder', hp: 260, tune: { damage: 80, startup: 2, recovery: 3 }, plays: ['chain', 'chain', 'break', 'kick'], combo: 3 }),
  knife: type('quick and armed: a knife in the lead hand, two cuts and away, or a run in with the blade', { archetype: 'rushdown', hp: 180, weapon: 'knife', tune: { damage: 90, startup: 1, recovery: 2 }, plays: ['chain', 'chain', 'run'], combo: 2 }),
  charger: type('a rush from range: it lines up far off and runs the player down, or blows them away down the street', { archetype: 'all-rounder', hp: 300, tune: { damage: 90, startup: 2 }, plays: ['special.back', 'special.back', 'run', 'blowout'], combo: 2 }),
  jumper: type('it leaps: a leaping overhead, a flying kick, a dive kick from a jump away', { archetype: 'rushdown', hp: 220, tune: { damage: 85, startup: 1, recovery: 2 }, plays: ['special.down', 'kick', 'dive'], combo: 2 }),
  heavy: type('a big slow body that grabs: it walks into the player, knees and throws, or swings its strong; held, it breaks out', { archetype: 'grappler', hp: 600, tune: { damage: 110, startup: 4, recovery: 5, cool: 140 }, plays: ['grab', 'grab', 'strong', 'break', 'desperate'], combo: 2, knees: 2, poise: 80 }),
  // THE ARMED CROWD (an armed brawl's own, any brawl's too): each its weapon the whole fight, the fight's blades
  sword: type('a sword in the lead hand: two cuts and a strong one, or a leaping cut', { archetype: 'all-rounder', hp: 240, weapon: 'sword', tune: { damage: 85, startup: 2, recovery: 3 }, plays: ['chain', 'chain', 'strong', 'kick'], combo: 2 }),
  spear: type('a spear in the rear hand: it pokes from far off, or runs in on its point; the longest reach, the slowest home', { archetype: 'zoner', hp: 220, weapon: 'spear', tune: { damage: 80, startup: 3, recovery: 4 }, plays: ['chain', 'chain', 'run', 'break'], combo: 2 }),
  axe: type('a big body with an axe: slow, and one cut floors you; its strong, a chop to the floor, a dive from the air', { archetype: 'grappler', hp: 420, weapon: 'axe', tune: { damage: 105, startup: 4, recovery: 5, cool: 130 }, plays: ['strong', 'chain', 'break', 'dive'], combo: 2, poise: 60 }),
  // THE SHOOTING CROWD (the run & gun's): each its gun (brawl-guns.js), its rounds slow and warned of
  rifleman: type('a rifle: it holds its range, aims a beat, one slow round', { archetype: 'all-rounder', hp: 160, gun: 'rifle', plays: ['shoot'], volley: 1, poise: 20 }),
  gunner: type('a burst: a beat of aim, then three rounds close together', { archetype: 'rushdown', hp: 180, gun: 'burst', plays: ['shoot'], volley: 3, poise: 20 }),
  grenadier: type('a lob: a grenade arced at where the player stands', { archetype: 'zoner', hp: 200, gun: 'lob', plays: ['shoot'], volley: 1, poise: 25 }),
  bazooka: type('a big body with a rocket: a long aim, a slow rocket that bursts', { archetype: 'grappler', hp: 320, gun: 'bazooka', plays: ['shoot'], volley: 1, poise: 70 }),
  staff: type('a staff, long both ways: three blows, a sweep that blows the player down the street, a leaping strike; its wood is struck as it swings', { archetype: 'zoner', hp: 260, weapon: 'staff', tune: { damage: 85, startup: 2, recovery: 3 }, plays: ['chain', 'chain', 'blowout', 'kick'], combo: 3 }),
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
  ambush: 2600,       // mm a player comes within, along the street, for a hidden body to spring
  enter: 1200,        // mm outside the view a body enters from
  convoy: 2600,       // mm between riders coming in together, one behind another
});

// (free: a body that may swing, or be swung at; a running player is fair game)
const FREE = new Set(['stand', 'walk', 'land', 'run']);
const HURT = new Set(['hit', 'fall', 'down', 'rise', 'held', 'thrown']);
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
// a body's own variety: a hash of its id, 0 … 1
const vary = (id, k = 0) => { let h = (id * 2654435761 + k * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0; return (h % 1000) / 1000; };

/** Read the waves: one a held screen, its crowd by type. */
export function readWaves(waves, belt) {
  if (!Array.isArray(waves)) throw new Error('brawl: waves is a list of { screen, crowd: [{ type, n }] }');
  const seen = new Set();
  return waves.map((w0, i) => {
    let w = w0;
    const at = `waves[${i}]`;
    if (!w || typeof w !== 'object') throw new Error(`brawl: ${at} is { screen, crowd: [{ type, n }] }`);
    const sc = belt.screens[w.screen];
    if (!sc) throw new Error(`brawl: ${at}.screen is a screen of the belt (0 to ${belt.screens.length - 1})`);
    if (!sc.gate) throw new Error(`brawl: ${at}.screen ${w.screen} is not held: a wave holds a gated screen`);
    if (seen.has(w.screen)) throw new Error(`brawl: ${at}.screen ${w.screen} has a wave already`);
    seen.add(w.screen);
    if (!Array.isArray(w.crowd ?? []) || (!(w.crowd ?? []).length && !w.boss)) throw new Error(`brawl: ${at}.crowd is a list of { type, n } (or none, under a boss)`);
    w = { ...w, crowd: w.crowd ?? [] };
    for (const [j, c] of w.crowd.entries()) {
      if (!CROWD_TYPES[c.type]) throw new Error(`brawl: ${at}.crowd[${j}].type is one of ${CROWD_TYPE_IDS.join(', ')}`);
      if (!(Number.isInteger(c.n) && c.n >= 1 && c.n <= 20)) throw new Error(`brawl: ${at}.crowd[${j}].n is 1 to 20`);
      if (c.entrance !== undefined && !STREET_ENTRANCES.includes(c.entrance)) throw new Error(`brawl: ${at}.crowd[${j}].entrance is one of ${STREET_ENTRANCES.join(', ')}`);
      if (c.ambush !== undefined && typeof c.ambush !== 'boolean') throw new Error(`brawl: ${at}.crowd[${j}].ambush is true or false`);
      readMount(c.mount, `${at}.crowd[${j}].mount`);
    }
    if (w.boss !== undefined) {
      if (!sc.boss) throw new Error(`brawl: ${at}.boss: a boss stands on the belt's boss screen (its last)`);
      if (!w.boss || typeof w.boss !== 'object' || !w.boss.recipe) throw new Error(`brawl: ${at}.boss is { recipe, cpu?, hp?, tune?, plays?, weapon? } (a fighter's recipe: the fight's characters)`);
      if (w.boss.weapon !== undefined && !WEAPONS[w.boss.weapon]) throw new Error(`brawl: ${at}.boss.weapon is one of ${Object.keys(WEAPONS).join(', ')}`);
      if (w.boss.plays !== undefined && Array.isArray(w.boss.plays) && w.boss.plays.includes('grab')) throw new Error(`brawl: ${at}.boss.plays: a boss's grab is the fight's throw, its CPU's (no 'grab' play)`);
      if (w.boss.cpu !== undefined && !CPU_LEVELS[w.boss.cpu]) throw new Error(`brawl: ${at}.boss.cpu is one of ${Object.keys(CPU_LEVELS).join(', ')}`);
      if (w.boss.hp !== undefined && !(Number.isInteger(w.boss.hp) && w.boss.hp >= 1 && w.boss.hp <= 99999)) throw new Error(`brawl: ${at}.boss.hp is a whole number from 1 to 99999`);
    }
    return { screen: w.screen, crowd: w.crowd.map((c) => ({ type: c.type, n: c.n, ...(c.entrance && c.entrance !== 'walk' ? { entrance: c.entrance } : {}), ...(c.ambush ? { ambush: true } : {}), ...(c.mount ? { mount: readMount(c.mount, at) } : {}) })), ...(w.boss ? { boss: { recipe: w.boss.recipe, cpu: w.boss.cpu ?? 'regular', ...(w.boss.hp ? { hp: w.boss.hp } : {}), ...(w.boss.tune ? { tune: w.boss.tune } : {}), ...(w.boss.weapon ? { weapon: w.boss.weapon } : {}), plays: w.boss.plays ?? BOSS_PLAYS } } : {}) };
  }).sort((a, b) => a.screen - b.screen);
}

/** A thug's fighter: its archetype's recipe from the fight's solver, its weapon and health, its own timing and damage. */
export function crowdFighter(id) {
  const T = CROWD_TYPES[id];
  const recipe = { ...solveFighter({ id, archetype: T.archetype }).recipe, archetype: T.archetype, id, name: id, hp: T.hp, ...(T.weapon ? { weapon: T.weapon } : {}) };
  return brawlFighter(recipe, { tune: T.tune });
}
/** a play's move slot (a special's at its strength M), or null for one that is not a single blow */
export const playSlot = (play) => (play.startsWith('special.') ? `${play}.M` : { chain: 'chain.1', break: 'chain.1', blowout: 'chain.1', strong: 'strong', run: 'run.attack', kick: 'air.M', dive: 'strong.dive', desperate: 'desperate' }[play] ?? null);
/** a type's plays read: each one a play, its moves on the fighter */
export function readPlays(plays, F, where = 'plays') {
  if (!Array.isArray(plays) || !plays.length) throw new Error(`brawl: ${where} is a list of plays (${Object.keys(CROWD_PLAYS).join(', ')})`);
  for (const p of plays) {
    const base = p.startsWith('special.') ? 'special' : p;
    if (!CROWD_PLAYS[base]) throw new Error(`brawl: ${where} has no play '${p}' (${Object.keys(CROWD_PLAYS).join(', ')})`);
    const slot = playSlot(p);
    if (slot && !F.moves[slot]) throw new Error(`brawl: ${where}'s ${p} needs ${slot}, which the fighter has not`);
  }
  return plays;
}

/** A street to fight down: the players at its start, every wave's crowd waiting offstage, the crowd's mind. */
export function streetOf({ belt, players, waves = [], things, rules, crowd } = {}) {
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
  const bosses = {};
  // (a crowd body's own entrance or ambush, by its id)
  const entries = {};
  // (the shooting crowd's guns, each its index in ctx.guns)
  const armory = crowdGuns(types);
  W.forEach((w, k) => {
    // (the boss first of its wave: it comes in as the wave does)
    if (w.boss) {
      // (a body as every other: a brawler's fighter in its own tune, its plays on it)
      const BF = brawlFighter({ ...w.boss.recipe, ...(w.boss.hp ? { hp: w.boss.hp } : {}), ...(w.boss.weapon ? { weapon: w.boss.weapon } : {}) }, { tune: w.boss.tune });
      bosses[bodies.length] = { cpu: w.boss.cpu, name: w.boss.recipe.name ?? w.boss.recipe.id ?? 'boss', plays: readPlays(w.boss.plays, BF, `waves[${k}].boss.plays`), combo: Math.max(1, BF.brawl.chain - 1), knees: 3 };   // (its chain to the blow before the last: an ender's place)
      fighters.push(BF);
      bodies.push({ fighter: fighters.length - 1, side: 'crowd', x: 0, z: 0, wave: k }); kinds.push('boss');
    }
    for (const c of w.crowd) for (let j = 0; j < c.n; j++) { if (c.entrance || c.ambush) entries[bodies.length] = { how: c.entrance ?? 'walk', ...(c.ambush ? { ambush: 1 } : {}), ...(c.mount ? { mount: c.mount } : {}) }; bodies.push({ fighter: typeAt[c.type], side: 'crowd', x: 0, z: 0, wave: k, ...(CROWD_TYPES[c.type].plays.includes('grab') ? {} : { grabs: false }), ...(CROWD_TYPES[c.type].gun ? { gun: armory.at[CROWD_TYPES[c.type].gun] } : {}), ...(CROWD_TYPES[c.type].poise ? { poise: CROWD_TYPES[c.type].poise } : {}) }); kinds.push(c.type); }
  });
  // the street's things, and each player's armed self for every weapon among them (in a box or not)
  const T = things ? readThings(things, belt) : [];
  const weapons = [...new Set(T.flatMap((t) => [t, t.holds].filter(Boolean)).filter((t) => t.kind === 'weapon').map((t) => t.what))];
  const armed = {};
  players.forEach((pl, i) => { for (const w of weapons) { armed[`${i}:${w}`] = fighters.length; fighters.push(brawlFighter({ ...pl.recipe, weapon: w }, { style: pl.style })); } });
  const ctx = { fighters, belt, ...(weapons.length ? { armed } : {}), ...(armory.guns.length ? { guns: armory.guns } : {}) };
  const s = newBrawl(ctx, { bodies, rules, ...(T.length ? { things: T } : {}) });
  // (a held screen with no wave holds nothing: its gate is open from the start)
  s.cleared = belt.screens.map((sc, i) => (sc.gate && !W.some((w) => w.screen === i) ? i : -1)).filter((i) => i >= 0);
  // (each crowd body's type, by its id)
  const type = Object.fromEntries(kinds.map((t, j) => [players.length + j, t]));
  return { ctx, s, mind: { rules: { ...CROWD_RULES, ...(crowd ?? {}) }, waves: W, wave: 0, type, tok: {}, b: {}, entered: 0, bosses, entries, cpu: Object.fromEntries(Object.keys(bosses).map((id) => [id, newCpuMemory()])) } };
}

/** The street a frame on: the crowd thinks, the core steps, the waves come in and their gates open. */
export function stepStreet(street, playerPads = []) {
  const { ctx } = street;
  const mind = { ...street.mind, tok: Object.fromEntries(Object.entries(street.mind.tok).map(([k, v]) => [k, v.slice()])), b: Object.fromEntries(Object.entries(street.mind.b).map(([k, v]) => [k, { ...v }])), cpu: { ...street.mind.cpu } };
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
/** where a body's blow reaches from (mm, its front to the foe's centre), by its move's slot */
function reachOf(F, slot) {
  const m = F.moves[slot];
  if (!m) return 700;
  // (a move that travels reaches its travel further)
  return Math.round(m.reach + (m.travel ?? 0) * Math.max(0, m.startup + m.active - 2));
}
/** how far a jump carries along the belt, over its flight (mm) */
const jumpCarry = (F) => Math.round((F.jump.vx * 2 * F.jump.vy) / F.jump.g);
// (a run starts from this far at least: closer, the body throws its chain instead)
const RUN_FROM = 1600;
/** the play a body given a token throws: one of its type's, by its own hash; a strong play only off its cooldown */
function pickPlay(kind, p, s) {
  const can = kind.plays.filter((q) => q !== 'desperate' && !(STRONG_PLAYS.has(q) && p.cd > 0));
  return can.length ? can[Math.floor(vary(p.id, s.f) * can.length)] : 'chain';
}
// a pad that walks toward a point, still within `dead` of it
const toward = (p, x, z, dead) => ({ x: Math.abs(x - p.x) > dead ? sgn(x - p.x) : 0, z: Math.abs(z - p.z) > dead ? sgn(z - p.z) : 0 });

/** The crowd's pads this frame (its mind `M` changed in place: tokens, each body's mode): the bodies of the crowd it is
 * given a type for (`M.type`), any boss among them by `M.bosses`. A practice room's crowd thinks with it. */
export const crowdPads = (s, ctx, M) => think(s, ctx, M);
/** A crowd mind for bodies already on the street: their types by id. */
export const newCrowdMind = (type, rules) => ({ rules: { ...CROWD_RULES, ...(rules ?? {}) }, waves: [], wave: 0, type: { ...type }, tok: {}, b: {}, entered: 0, bosses: {}, cpu: {} });

/** a play under way, a frame on (the chain run on to its ender, the run to its blow, the leap to its kick), or null
 * when the body is not in one */
function underWay(p, T, F, m, kind) {
  const dxT = Math.abs(p.x - T.x);
  if (p.st === 'move' && p.mv && (p.mv.startsWith('chain.') || p.mv === 'strong')) {
    const k = p.mv === 'strong' ? 1 : parseInt(p.mv.slice(6), 10), n = Math.min(kind.combo ?? 1, F.brawl.chain);
    const ender = m.play === 'break' ? 'strong.break' : m.play === 'blowout' ? 'strong.out' : null;
    // (the ender once its chain is thrown, never off the chain's last blow)
    return k < n ? { mv: `chain.${k + 1}` } : ender && k < F.brawl.chain && p.mv !== 'strong' ? { mv: ender } : {};
  }
  // (on toward the player, the running blow once in its reach; too long a run, it stops)
  if (p.st === 'run') return dxT <= reachOf(F, 'run.attack') - 100 ? { mv: 'run.attack', x: p.face } : m.t > 150 || sgn(T.x - p.x) !== p.face ? {} : { x: p.face };
  if (p.st === 'air' || p.st === 'prejump') {
    // (the leap's blow: the dive kick from its height as it turns down, the flying kick as it comes into reach)
    const blow = m.play === 'dive' ? 'strong.dive' : m.play === 'kick' ? 'air.M' : null;
    const now = blow && p.st === 'air' && !p.airMove && (blow === 'strong.dive' ? p.vy <= 0 : p.vy <= 30 && dxT <= reachOf(F, 'air.M') + 300);
    return now ? { mv: blow } : {};
  }
  if (p.st === 'move' || p.st === 'throwing') return {};
  return null;
}
/** a play's first command, toward the player (`dir` along the belt) */
const startPad = (play, dir) => (play === 'run' ? { dash: 'run', x: dir } : play === 'kick' || play === 'dive' ? { jump: true, x: dir } : { mv: playSlot(play) });

function think(s, ctx, M) {
  const R = M.rules, B = s.bodies, pads = [];
  const [n0, n1] = ctx.belt.depth.map((v) => Math.round(v * 1000));
  const lineUp = Math.round(s.rules.line / 3);
  // (a player a body has chosen to swing at this frame: no other starts on them in the same frame)
  const claimed = new Set();
  for (const p of B) {
    if (p.side !== 'crowd' || p.gone || p.ko) { if (p.side === 'crowd') giveBack(M, p.id); continue; }
    // (only the bodies it is given: a practice room's other dummies are not its)
    if (M.type[p.id] === undefined) continue;
    const m = (M.b[p.id] ??= { mode: 'circle', t: 0, cool: Math.round(R.cool[0] * vary(p.id)) });
    m.t++;
    // lying in wait: hidden until a player comes near (or it is struck), then the crowd's own
    if (m.ambush) {
      const near = B.some((q) => q.side === 'player' && !q.gone && !q.ko && Math.abs(q.x - p.x) < R.ambush && Math.abs(q.z - p.z) < 1600);
      if (!near && p.st === 'hide') { pads[p.id] = {}; continue; }
      delete m.ambush;
    }
    const T = p.tg >= 0 ? B[p.tg] : null;
    // (what it is: a boss's own plays, else its type's)
    const kind = M.bosses[p.id] ?? CROWD_TYPES[M.type[p.id]], F = ctx.fighters[p.fi];
    if (m.cool > 0) m.cool--;
    // struck: the token given back; once up, back off and wait
    // held, a body with the desperation in its plays breaks out with it (paying its price), a moment in
    if (p.st === 'held' && kind.plays.includes('desperate') && p.sf >= 24 && p.hp > (F.moves.desperate.price ?? 0)) { giveBack(M, p.id); pads[p.id] = { mv: 'desperate' }; continue; }
    if (HURT.has(p.st)) {
      giveBack(M, p.id); delete m.fire;
      if (m.mode !== 'recover') { m.mode = 'recover'; m.t = 0; m.cool = Math.max(m.cool, R.cool[0] + Math.round((R.cool[1] - R.cool[0]) * vary(p.id, s.f))); }
      pads[p.id] = {};
      continue;
    }
    // riding: its mount does the going (brawl-core.js); a gun fires from the saddle
    if (p.st === 'ride') { pads[p.id] = rideFire(p, T); continue; }
    // holding the player (the heavy): its knees, then the throw
    if (p.st === 'hold') {
      pads[p.id] = m.t % 16 === 8 ? { hold: (p.kn ?? 0) >= (kind.knees ?? 2) ? 'forward' : 'knee' } : {};
      continue;
    }
    if (!T) { pads[p.id] = {}; continue; }
    if (M.bosses[p.id]) { pads[p.id] = bossPad(s, ctx, M, p, T, lineUp, claimed, m, kind); continue; }
    const side0 = sgn(p.x - T.x) || (p.id % 2 ? 1 : -1);
    const mine = holding(M, T.id);
    const has = mine.includes(p.id);
    // ── a volley under way: its aim held for its gun's warning, then its rounds, then done ──
    if (m.fire) {
      // (its aim kept from the warning's start: the round goes where the warning pointed)
      const G = ctx.guns[p.gn], aim = m.fire.aim;
      m.swung = 1; m.fire = { ...m.fire, t: m.fire.t + 1 };
      if (m.fire.t <= G.telegraph) { pads[p.id] = { aim }; continue; }
      if (m.fire.n < (kind.volley ?? 1)) { if ((p.fc ?? 0) <= 1) m.fire = { ...m.fire, n: m.fire.n + 1 }; pads[p.id] = { fire: aim }; continue; }
      delete m.fire; pads[p.id] = {}; continue;
    }
    // ── its play under way: the chain run on (to its ender), the run to its blow, the leap to its kick ──
    const going = underWay(p, T, F, m, kind);
    if (going) { m.swung = 1; pads[p.id] = going; continue; }
    // ── its blow over: the token back, away to the ring, a while before it asks again ──
    if (has && m.swung && FREE.has(p.st)) {
      giveBack(M, p.id); m.swung = 0; m.mode = 'recover'; m.t = 0;
      m.cool = R.cool[0] + Math.round((R.cool[1] - R.cool[0]) * vary(p.id, s.f));
    }
    if (m.mode === 'approach' && (!has || m.t > R.approach)) { giveBack(M, p.id); m.mode = 'recover'; m.t = 0; m.cool = R.cool[0]; }
    // ── a token, when one is free and its wait is over ──
    if (m.mode !== 'approach' && m.cool === 0 && mine.length < R.tokens && !mine.includes(p.id)) { mine.push(p.id); m.mode = 'approach'; m.t = 0; m.swung = 0; m.play = pickPlay(kind, p, s); }
    if (m.mode === 'approach') {
      const play = m.play ?? 'chain', front = F.idle.stand.push[2];
      const side = side0;
      const dx = Math.abs(p.x - T.x);
      // (a run from too close: the chain instead)
      if (play === 'run' && dx < RUN_FROM - 400) m.play = 'chain';
      // a SHOOTER holds its range along the belt (in from too far, back from too near), then aims and fires
      if (play === 'shoot') {
        if (p.gn === undefined) { m.play = 'chain'; pads[p.id] = {}; continue; }
        const [near, far] = SHOOT_RANGE;
        if (dx > far) { pads[p.id] = { x: -side }; continue; }
        if (dx < near) { pads[p.id] = { x: side }; continue; }
        if (FREE.has(T.st) && !claimed.has(T.id) && FREE.has(p.st) && p.st !== 'run') { claimed.add(T.id); const aim = aimAt(p, T); m.fire = { t: 0, n: 0, aim }; pads[p.id] = { aim }; continue; }
        pads[p.id] = {};
        continue;
      }
      // where the play starts: in its blow's reach; a leap a jump's carry away; a run from the ring's edge; a grab
      // walking into the body
      const leap = play === 'kick' || play === 'dive', run = m.play === 'run';
      const want = play === 'grab' ? 0 : run ? RUN_FROM : leap ? Math.max(front + 150, Math.round(jumpCarry(F) * 0.6)) : Math.max(front + 150, reachOf(F, playSlot(m.play)) - 160);
      // (touching, a blow's walk in stops there: walked on into a body, it would take hold of it, as a player's walk does)
      const touching = dx <= front + ctx.fighters[T.fi].idle.stand.push[2] + 30;
      // (lined up across the belt first, then in to where it starts)
      const zOk = Math.abs(p.z - T.z) <= lineUp;
      if (!zOk) { pads[p.id] = { x: dx < want ? side : 0, z: sgn(T.z - p.z) }; continue; }
      if (play === 'grab') { pads[p.id] = { x: -side, z: 0 }; continue; }
      if (dx > want + R.dead && !touching) { pads[p.id] = { x: -side, z: 0 }; continue; }
      // there and facing: it starts only when the player is free and no one else is swinging at them
      const busy = swinging(B, T, p.id);
      if (FREE.has(T.st) && !busy && !claimed.has(T.id) && p.face === -side && FREE.has(p.st) && p.st !== 'run') {
        claimed.add(T.id);
        pads[p.id] = startPad(m.play, -side);
        continue;
      }
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

/** another body of the crowd swinging at this player (in a move, holding, throwing, or on its way to a blow: a run in,
 * a leap in) */
const swinging = (B, T, id) => B.some((o) => o.side === 'crowd' && o.id !== id && !o.gone && !o.ko && o.tg === T.id && (o.st === 'move' || o.st === 'hold' || o.st === 'throwing' || o.st === 'run' || o.st === 'prejump' || o.st === 'air'));

// ── the boss ─────────────────────────────────────────────────────────────────────────────────────────────────

// a body as the fight's opponent reads one (versus-core's player: its states' names, its walk forward or back)
const duelBody = (q) => ({ x: q.x, y: q.y, vx: q.vx, face: q.face, st: q.st === 'walk' ? (Math.sign(q.wx) === q.face ? 'walkF' : q.wx ? 'walkB' : 'stand') : q.st === 'hold' || q.st === 'held' ? 'hit' : q.st, mv: q.mv, mf: q.mf, conn: q.conn, meter: q.meter, combo: q.combo, ko: q.ko, hp: q.hp });
/** the modern scheme's buttons (versus-input.js readCommand) as the brawl's command for this body */
function modernCommand(pad, p, F) {
  const fx = pad.x * p.face, b = pad.b, air = p.st === 'air' || p.st === 'prejump';
  if (b & BTN.S) {
    if (!air && b & BTN.H && F.moves.super && p.meter >= F.moves.super.cost) return { mv: 'super' };
    const dir = pad.y < 0 ? 'down' : fx > 0 ? 'forward' : fx < 0 ? 'back' : 'neutral';
    for (const d of [dir, 'neutral']) if (!air && F.moves[`special.${d}.M`]) return { mv: `special.${d}.M` };
    return null;
  }
  if (b & BTN.T) return air ? null : { mv: 'throw' };
  if (b & (BTN.L | BTN.M | BTN.H)) {
    const st = b & BTN.H ? 'H' : b & BTN.M ? 'M' : 'L';
    if (air) return { mv: `air.${st}` };
    if (pad.y < 0) return { mv: `crouch.${st}` };
    if (fx > 0 && F.moves[`forward.${st}`]) return { mv: `forward.${st}` };
    return { mv: `stand.${st}` };
  }
  if (pad.y > 0 && !air) return { jump: true };
  return null;
}
/** whether a boss stands where its play starts: lined up, and in its blow's reach, a jump's carry away, a run's start */
function playThere(p, T, F, ctx, play, lineUp) {
  if (Math.abs(p.z - T.z) > lineUp) return false;
  const dx = Math.abs(p.x - T.x), front = F.idle.stand.push[2];
  if (play === 'run') return dx >= RUN_FROM - 400 && dx <= RUN_FROM + 2400;
  if (play === 'kick' || play === 'dive') return Math.abs(dx - Math.round(jumpCarry(F) * 0.6)) <= 350;
  return dx <= Math.max(front + 150, reachOf(F, playSlot(play)) - 160) + 120 || dx <= front + ctx.fighters[T.fi].idle.stand.push[2] + 30;
}
function bossPad(s, ctx, M, p, T, lineUp, claimed, m, kind) {
  const F = ctx.fighters[p.fi], B = s.bodies;
  if (HURT.has(p.st)) { m.on = 0; return {}; }
  // ITS OWN PLAY under way, run on; over, it rests a while (the fight's CPU between)
  if (m.on) {
    const going = underWay(p, T, F, m, kind);
    if (going) return going;
    if (FREE.has(p.st)) { m.on = 0; m.play = null; m.rest = BOSS_REST + Math.round(60 * vary(p.id, s.f)); }
  }
  if (m.rest > 0) m.rest--;
  // its rest over, a play chosen (again a while on, if it never stood where it starts), thrown once it stands there
  if (!m.on && !(m.rest > 0)) {
    if (!m.play || m.t > 240) { m.play = pickPlay(kind, p, s); m.t = 0; }
    const dir = sgn(T.x - p.x) || p.face;
    if (playThere(p, T, F, ctx, m.play, lineUp) && FREE.has(p.st) && p.st !== 'run' && FREE.has(T.st) && !swinging(B, T, p.id) && !claimed.has(T.id) && p.face === dir) {
      claimed.add(T.id); m.on = 1; m.t = 0;
      return startPad(m.play, dir);
    }
  }
  // the duel the fight's opponent reads: the boss and its target along the belt, their shots
  const view = { phase: 'fight', f: s.f, p: [duelBody(p), duelBody(T)], shots: s.shots.filter((t) => t.o === p.id || t.o === T.id).map((t) => ({ ...t, o: t.o === p.id ? 0 : 1 })) };
  const { pad, mem } = cpuPad(view, { fighters: [F, ctx.fighters[T.fi]] }, 0, M.cpu[p.id], { ...CPU_LEVELS[M.bosses[p.id].cpu], seed: 7 + p.id });
  M.cpu[p.id] = mem;
  const dz = T.z - p.z, lined = Math.abs(dz) <= lineUp;
  // (across the belt first: onto the player's line; along it, where the duel walks)
  const out = { x: pad.x, z: lined ? 0 : Math.sign(dz) };
  const cmd = modernCommand(pad, p, F);
  if (!cmd) return out;
  if (cmd.jump) return lined ? { ...out, jump: true } : out;
  // a blow: lined up, and from neutral only on a free player no one else is swinging at (its own combo goes on)
  const ownCombo = p.mv && p.conn && (p.st === 'move' || p.st === 'air');
  if (!lined || (!ownCombo && (!FREE.has(T.st) || swinging(B, T, p.id) || claimed.has(T.id)))) return out;
  if (!ownCombo) claimed.add(T.id);
  return { ...out, mv: cmd.mv };
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
  // (the boss first, from the right edge)
  const order = [...waiting.filter((p) => M.bosses[p.id]), ...waiting.filter((p) => !M.bosses[p.id])];
  for (const p of order.slice(0, Math.max(0, R.limit - standing.length))) {
    const k = M.bosses[p.id] ? 0 : M.entered++ % 3;
    if (M.bosses[p.id]) s.events.push({ t: 'boss', p: p.id, name: M.bosses[p.id].name, hp: p.hp });
    const E = M.entries?.[p.id];
    if (E && E.how === 'ride') {
      // riding in from the view's edge (right or left by turns), toward the middle of the view, those coming together
      // one behind another
      const right = vary(p.id, 11) < 0.5, x = Math.max(0, Math.min(Math.round(belt.length * 1000), right ? cam + half + R.enter + k * R.convoy : cam - half - R.enter - k * R.convoy));
      enterBody(s, ctx, p.id, { how: 'ride', x, z: Math.round(n0 + 300 + (n1 - n0 - 600) * vary(p.id, 3)), mount: { ...(E.mount ?? {}), dir: right ? -1 : 1 } });
      continue;
    }
    if (E && (E.how !== 'walk' || E.ambush)) {
      // its own ENTRANCE onto a spot in the view (a door, a drop, a dig, a vault), or lying in wait ahead, hidden
      const x = Math.max(0, Math.min(Math.round(belt.length * 1000), cam + Math.round((E.ambush ? 0.25 + vary(p.id, 9) * 0.6 : vary(p.id, 7) - 0.5) * half)));
      const z = Math.round(n0 + 300 + (n1 - n0 - 600) * vary(p.id, 3));
      enterBody(s, ctx, p.id, { how: E.ambush ? 'walk' : E.how, x, z, hide: !!E.ambush });
      p.face = sgn(cam - p.x) || -1;
      if (E.ambush) (M.b[p.id] ??= { mode: 'circle', t: 0, cool: 0 }).ambush = 1;
      continue;
    }
    const x = k === 0 ? cam + half + R.enter : k === 1 ? cam - half - R.enter : cam + Math.round((vary(p.id, 7) - 0.5) * half);
    p.gone = 0; p.x = Math.max(0, Math.min(Math.round(belt.length * 1000), x)); p.z = k === 2 ? n1 : Math.round(n0 + (n1 - n0) * vary(p.id, 3));
    p.face = sgn(cam - p.x) || -1; p.st = 'stand'; p.sf = 0;
    s.events.push({ t: 'enter', p: p.id, from: ['right', 'left', 'back'][k], x: p.x, z: p.z });
  }
  // its boss fallen: the rest of its wave flees, and the stage is clear
  const boss = mine.find((p) => M.bosses[p.id]);
  if (boss && boss.ko && M.down !== M.wave) {
    M.down = M.wave;
    for (const p of mine) if (!p.ko) { p.ko = 1; p.gone = 1; s.events.push({ t: 'flee', p: p.id }); }
    s.events.push({ t: 'stageClear', screen: W.screen });
  }
  // the last of it fallen: its gate opens, the next wave waits for its screen
  if (!waiting.length && mine.every((p) => p.ko)) {
    s.cleared = [...s.cleared, W.screen];
    s.events.push({ t: 'cleared', screen: W.screen });
    M.wave++;
  }
}
