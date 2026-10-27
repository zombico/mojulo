/**
 * THE FOE VOCABULARY: the words a foe class is written in, said once for every class, the way mind/vocab.js says once
 * what every mind decides. A class (./classes/*.js) is a MOVE, an ATTACK, a mind (mind/vocab.js words) and the bodies it
 * fits; it names no species, no skin and no clip. Rank is not the class's: any class at any rank (FOE_RANKS).
 *
 *   PACES        a mover's speed, as a share of the hero's run (HERO.run), slowest first
 *   MOVES        how it moves: each its line, what it needs of a body (`needs`: ground | wings), what it lays on the
 *                mind (`mind`) and on the rule (`rule`), and what lowers it today (`status`, `lowers`, an engine's mark
 *                read from the mind it rides on, `rides`, or written per engine)
 *   ATTACKS      how it hurts: each its line, the Power verb it holds (`verb`: what the mind measures), its default
 *                timing in the lab's words (feel/kernel.js SPAR: startup, active, recovery in frames at 60 Hz; startup
 *                is the telegraph), and what lowers it
 *   STOMPS       what a stomp on its head does: blow (a stomp is one of the hero's blows), hurts (the stomper is hurt),
 *                bounce (it bounces the stomper and takes nothing)
 *   FOE_RANKS    per mind rank (mind/vocab.js RANKS): × the class's downs and × its threat. A minion's downs times the
 *                rank's, times HERO.blow, meets the rank's typical health (mind/vocab.js RANK_HP), so a resolved foe
 *                never draws the mind's advisory
 *   HERO         the frame a class is measured in: the hero's run (m/s, the platform rule's default speed), its health,
 *                the health one of its blows takes and the health one hit on it costs (the mind's frame: relative to
 *                the hero's 100; a level goal's 20 hp and its 2 a hit are the same tenth)
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

export const HERO = Object.freeze({ run: 6, hp: 100, blow: 20, hit: 10 });

const MIND = 'lib/graph/worlds/controllable/mind.js';
const GROUP = 'lib/graph/worlds/controllable/group.js';
const PKG = 'hostile-encounters';

export const MOVES = Object.freeze({
  hold: {
    line: 'stands where it is put and turns to the hero in range',
    needs: [], mind: { motivation: 'sentry' }, rides: ['motivation', 'sentry'],
    status: 'built', lowers: MIND,
  },
  pace: {
    line: 'walks a stretch and turns at its ends, at a ledge and at a wall',
    needs: ['ground'], mind: { motivation: 'wander' },
    status: 'absent', effort: 'M', pkg: PKG, godot: 'absent', roblox: 'absent',
    note: 'the mind has no route: a patrol is its own rule (tutorial.js), web only; the stretch, the ledge and the wall turn are the mind\'s to learn',
  },
  chase: {
    line: 'hunts the hero down, sliding along what is in its way',
    needs: ['ground'], mind: { motivation: 'hunt' }, rides: ['motivation', 'hunt'],
    status: 'built', lowers: MIND,
  },
  hop: {
    line: 'moves in hops, each a short leap toward where it is going',
    needs: ['ground'], mind: { motivation: 'wander' }, rule: { jumpSpeed: 5 },
    status: 'absent', effort: 'M', pkg: PKG, godot: 'absent', roblox: 'absent',
    note: 'the mind walks; a mind that leaves the ground to travel does not exist',
  },
  drift: {
    line: 'hangs in the air and weaves, circling what it fights',
    needs: ['wings'], mind: { motivation: 'wander' }, rule: { flier: true }, rides: ['motivation', 'wander'],
    status: 'built', lowers: MIND,
  },
  dive: {
    line: 'drifts, then swoops at the hero on a telegraph and climbs back',
    needs: ['wings'], mind: { motivation: 'hunt' }, rule: { flier: true },
    status: 'absent', effort: 'M', pkg: PKG, godot: 'absent', roblox: 'absent',
    note: 'a flier circles (the mind\'s circle); the telegraphed swoop and the climb back do not exist',
  },
  rush: {
    line: 'sees the hero, braces, and charges in a straight line; a wall stuns it',
    needs: ['ground'], mind: { motivation: 'hunt' }, rule: { boost: true },
    status: 'partial', effort: 'M', pkg: PKG, godot: 'absent', roblox: 'absent',
    note: 'the mind\'s boost bursts and its tackle run; the brace, the locked line and the wall stun do not',
  },
  lurk: {
    line: 'lies still and unseen until the hero is near, then wakes and hunts',
    needs: ['ground'], mind: { motivation: 'hunt' },
    status: 'partial', effort: 'S', pkg: PKG, godot: 'absent', roblox: 'absent',
    note: 'a foe minted asleep and woken by a cue runs (a defence\'s waves); a wake on the hero\'s nearness does not',
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
    verb: null,
    status: 'absent', effort: 'M', pkg: PKG, godot: 'absent', roblox: 'absent',
    note: 'a body hurts only by a strike or a round; a touch from the side that costs the hero, and the stomp from above, do not exist; nor does a mind verb for it, so a hunter that hurts by touch resolves to ignore what it notices',
  },
  strike: {
    line: 'a blow at blade range, telegraphed by its wind-up',
    verb: 'melee', timing: { startup: 30, active: 4, recovery: 20 }, reach: 1.2,
    status: 'built', lowers: MELEE, ...AI_ATTACK,
  },
  shot: {
    line: 'fires at the hero, a pattern from the lab\'s shots (feel/kernel.js RANGED)',
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
    verb: 'dash', timing: { startup: 36, active: 40, recovery: 30 },
    status: 'absent', effort: 'M', pkg: PKG, godot: 'absent', roblox: 'absent',
    note: 'the mind\'s tackle beats a swing at close range; a charge that hits whatever its line meets does not exist',
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
  minion: { downs: 1, threat: 1 },
  elite: { downs: 3, threat: 2 },
  miniboss: { downs: 6, threat: 5 },
  boss: { downs: 15, threat: 12 },
});
