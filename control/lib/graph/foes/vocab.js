/**
 * THE FOE VOCABULARY: the words a foe class is written in, said once for every class, the way mind/vocab.js says once
 * what every mind decides. A class (./classes/*.js) is a MOVE, an ATTACK, a mind (mind/vocab.js words) and the bodies it
 * fits; it names no species, no skin and no clip. Rank is not the class's: any class at any rank (FOE_RANKS).
 *
 *   PACES        a mover's speed, as a share of the hero's run (HERO.run), slowest first
 *   MOVES        how it moves: each its line, what it needs of a body (`needs`: ground | wings), what it lays on the
 *                mind (`mind`) and on the rule (`rule`), its own move's numbers (`own`, the rule's `foe` record:
 *                worlds/controllable/foe.js plays a move the mind does not), and what lowers it today (`status`,
 *                `lowers`, an engine's mark read from the mind it rides on, `rides`, or written per engine)
 *   ATTACKS      how it hurts: each its line, the Power verb it holds (`verb`: what the mind measures; `contact` a
 *                touch, `during` when only then), its default timing in the lab's words (feel/kernel.js SPAR: startup,
 *                active, recovery in frames at 60 Hz; startup is the telegraph), and what lowers it
 *   STOMPS       what a stomp on its head does: blow (a stomp is one of the hero's blows), hurts (the stomper is hurt),
 *                bounce (it bounces the stomper and takes nothing)
 *   FOE_RANKS    per mind rank (mind/vocab.js RANKS): × the class's downs, × its threat and × its presence (a boss
 *                stands taller than the minions of its class). A minion's downs times the
 *                rank's, times HERO.blow, meets the rank's typical health (mind/vocab.js RANK_HP), so a resolved foe
 *                never draws the mind's advisory
 *   HERO         the frame a class is measured in: the hero's run (m/s, the platform rule's default speed), its health,
 *                the health one of its blows takes and the health one hit on it costs (the mind's frame: relative to
 *                the hero's 100; a level goal's 20 hp and its 2 a hit are the same tenth), and its height (m): a
 *                class's PRESENCE is its body's size (its longest extent, nose to tail or wing to wing) as a share of
 *                it, so a foe reads at a game's size whatever animal plays it (a guinea pig walker is a metre long,
 *                not 25 cm)
 *
 * Status words as the cosmos registry says them: built · partial · local · absent. Pure data.
 */

export const PACES = Object.freeze({
  crawl: 0.25,
  slow: 0.4,
  even: 0.6,
  quick: 0.85,
  fast: 1.15,
});

export const HERO = Object.freeze({ run: 6, hp: 100, blow: 20, hit: 10, height: 1.7 });

const MIND = 'lib/graph/worlds/controllable/mind.js';
const GROUP = 'lib/graph/worlds/controllable/group.js';
const PKG = 'hostile-encounters';

// a foe's own moves (worlds/controllable/foe.js): played on the web; no engine kernel plays them yet
const FOE = 'lib/graph/worlds/controllable/foe.js';
const SUMMON = 'lib/graph/worlds/controllable/summon.js';
const WEB_ONLY = { godot: 'absent', roblox: 'absent' };

export const MOVES = Object.freeze({
  hold: {
    line: 'stands where it is put and turns to the hero in range',
    needs: [], mind: { motivation: 'sentry' }, rides: ['motivation', 'sentry'],
    status: 'built', lowers: MIND,
  },
  pace: {
    line: 'walks a stretch and turns at its ends, at a ledge and at a wall',
    needs: ['ground'], mind: { motivation: 'ambient' }, own: { stretch: 6, drop: 1 },
    status: 'built', lowers: FOE, ...WEB_ONLY,
  },
  chase: {
    line: 'hunts the hero down, sliding along what is in its way',
    needs: ['ground'], mind: { motivation: 'hunt' }, rides: ['motivation', 'hunt'],
    status: 'built', lowers: MIND,
  },
  hop: {
    line: 'moves in hops, each a short leap toward where it is going',
    needs: ['ground'], mind: { motivation: 'ambient' }, own: { stretch: 6, drop: 1, hop: { period: 0.8, air: 0.6, height: 0.8 } },
    status: 'built', lowers: FOE, ...WEB_ONLY,
  },
  drift: {
    line: 'hangs in the air and weaves, circling what it fights',
    needs: ['wings'], mind: { motivation: 'wander' }, rule: { flier: true }, rides: ['motivation', 'wander'],
    status: 'built', lowers: MIND,
  },
  dive: {
    line: 'drifts, then swoops at the hero on a telegraph and climbs back',
    needs: ['wings'], mind: { motivation: 'hunt' }, rule: { flier: true }, own: { dive: { altitude: 3, radius: 9, speed: 9, cooldown: 2 } },
    status: 'built', lowers: FOE, ...WEB_ONLY,
  },
  rush: {
    line: 'sees the hero, braces, and charges in a straight line; a wall stuns it',
    needs: ['ground'], mind: { motivation: 'hunt' }, own: { drop: 1, rush: { range: 14, speed: 10, run: 16, stun: 1.5 } },
    status: 'built', lowers: FOE, ...WEB_ONLY,
  },
  lurk: {
    line: 'lies still and unseen until the hero is near, then wakes and hunts',
    needs: ['ground'], mind: { motivation: 'hunt' }, own: { lurk: { radius: 4 } },
    status: 'built', lowers: FOE, ...WEB_ONLY,
  },
  swarm: {
    line: 'many as one: a pack that fans out, rings the hero and closes, a few at a time',
    needs: ['ground'], mind: { motivation: 'hunt' }, group: { plan: 'pack-hunt', attackers: 2 }, rides: ['squad', 'pack'],
    status: 'built', lowers: GROUP,
  },
});

const MELEE = 'lib/graph/worlds/controllable/combat-melee.js';
const RANGED = 'lib/graph/worlds/controllable/combat-ranged.js';
// the hero's swings and rounds are kernel/combat.gd's; every AI's attack stays the web's (cosmos/facets/power.js combat)
const AI_ATTACK = { godot: 'approximated', roblox: 'approximated' };

export const ATTACKS = Object.freeze({
  contact: {
    line: 'touching it hurts',
    verb: 'contact',
    status: 'built', lowers: FOE, ...WEB_ONLY,
  },
  strike: {
    line: 'a blow at blade range, telegraphed by its wind-up',
    verb: 'melee', timing: { startup: 30, active: 4, recovery: 20 }, reach: 1.2,
    status: 'built', lowers: MELEE, ...AI_ATTACK,
  },
  shot: {
    line: 'fires at the hero in a pattern from the action lab\'s shots (one aimed, a spread, a ring to jump)',
    verb: 'ranged', fireClass: 'sight', pattern: 'aimed', timing: { startup: 20 },
    status: 'built', lowers: RANGED, ...AI_ATTACK,
  },
  lob: {
    line: 'lobs at where the hero stood; it bursts where it lands',
    verb: 'lob', fireClass: 'lob', pattern: 'lob', timing: { startup: 30 },
    status: 'built', lowers: RANGED, ...AI_ATTACK,
  },
  spray: {
    line: 'sprays a cone at close range',
    verb: 'area', fireClass: 'area', timing: { startup: 24 },
    status: 'built', lowers: RANGED, ...AI_ATTACK,
  },
  charge: {
    line: 'its charge is the blow: whatever it runs into is hit',
    verb: 'contact', during: 'charge', timing: { startup: 36, recovery: 30 },
    status: 'built', lowers: FOE, ...WEB_ONLY,
  },
  call: {
    line: 'it calls its summons into the fight on a wind-up: its blow is them (its entry\'s `summons`)',
    verb: null, timing: { startup: 45, recovery: 30 },
    status: 'built', lowers: SUMMON, ...WEB_ONLY,
  },
  none: {
    line: 'it does not attack',
    verb: null,
    status: 'built',
  },
});

export const STOMPS = Object.freeze({
  blow: 'a stomp on its head is one of the hero\'s blows, and the stomper bounces',
  hurts: 'it hurts the stomper (spines, flame): the stomper is hit and knocked off',
  bounce: 'it bounces the stomper and takes nothing (too big, or a stepping stone)',
});

export const FOE_RANKS = Object.freeze({
  minion: { downs: 1, threat: 1, presence: 1 },
  elite: { downs: 3, threat: 2, presence: 1.15 },
  miniboss: { downs: 6, threat: 5, presence: 1.4 },
  boss: { downs: 15, threat: 12, presence: 1.8 },
});
