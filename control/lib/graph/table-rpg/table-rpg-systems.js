/**
 * THE RULES — how a pen-and-paper game rolls a character, decides a check and settles a fight, as data the table RPG
 * kernel (table-rpg-kernel.js) reads. A rules card is one RESOLUTION PROCEDURE (its `check.kind`) and its numbers. The
 * cards here are STARTERS, one per procedure: generic, in mojulo's own words and numbers, named for the procedure, not
 * for any game. A game the person names is written out as a card by their own model from the rules they supply, the
 * way a board game is written out for the tabletop type; the kernel checks it and teaches what is missing. A card
 * written out may carry its own `attribution`, which the referee packet prints.
 *
 *   target      a d20 plus a modifier against a target number; six abilities from 3 to 18
 *   under       three dice for each ability in order, a d20 rolled at or under the ability
 *   bands       2d6 plus a stat read in bands: 10 or more a hit, 7–9 a hit at a cost, 6 or less a miss
 *   shifts      four fudge dice plus a stat against a rung; the margin is shifts, three over a critical
 *   percent     d100 at or under a score out of a hundred, a fifth of it a critical
 *   challenge   a d6 plus a stat against two d10: beat both a strong hit, one a weak hit, neither a miss
 *
 * A module is written in PORTABLE words, so one scenario plays under any card: a check names a FACULTY (might,
 * agility, grit, wits, insight, presence, stealth) and a DIFFICULTY (easy, medium, hard); a foe a RANK (1 a minion … 5 a
 * boss); a member a ROLE (the egocube's). The card says what each is in its own numbers: `faculties`,
 * `check.difficulty`, `foes`, `classes[].roles`.
 *
 *   card: {
 *     name, about, attribution?,
 *     abilities: [id], names: { id: 'Strength' },
 *     faculties: { might, agility, grit, wits, insight, presence, stealth → ability id },
 *     generate: { default, methods: { <id>: { dice, order: 'assign' | 'in-order', scale? } | { values } |
 *                 { budget, min, max, cost } } }        rolled, an array to place, or points to buy
 *     modifier: { kind: 'step', base, per } (floor((score − base) / per)) | { kind: 'table', bands: [[upto, mod]] } |
 *               { kind: 'none' } (the score is the modifier)
 *     check: { kind: 'target' | 'under' | 'bands' | 'shifts' | 'percent' | 'challenge', difficulty: { easy, medium, hard },
 *              trained?: { base, every } }   trained: a bonus on the class's two best abilities, base at level 1 and one
 *              more every `every` levels
 *     combat: { initiative: 'roll' | 'side' | 'order', damage: 'dice' | 'shifts' | 'harm', foesAct: bool,
 *               defence: 'armour' | 'none', costOn?: [band] }   foesAct false: the players roll every die, and a foe
 *               hurts only on the bands `costOn` names (a hit at a cost and a miss, or a miss alone)
 *     foes: [rank 1 … 5] each { hp, defence, attack, damage, xp }   in the card's own terms (damage dice or harm, also
 *           what a trap of that rank deals)
 *     hp: { kind: 'die' (the class's hit die, max at first level, `rolled` to roll it), ability } |
 *         { kind: 'fixed', value } | { kind: 'derived', of: [ability], div }
 *     progression: { kind: 'xp', thresholds } | { kind: 'misses', at } | { kind: 'milestone' }
 *     classes: { <id>: { name, about, priority: [ability], roles: [egocube role], weapon: { name, dice | harm, faculty },
 *                hitDie?, armour?, live } }   priority the abilities best first (an array is placed in that order);
 *                live the live RPG's class it plays as (playscape/rpg/presets.js)
 *     live: { hp, mp, atk, def, mag, spd → ability }   how a sheet reads as the live RPG's stats (table-rpg-party.js)
 *     range: [lo, hi]   an ability's span, for that reading
 *   }
 *
 *   TABLE_RPG_SYSTEMS, TABLE_RPG_SYSTEM_IDS, FACULTIES, DIFFICULTIES, CHECK_KINDS
 *   systemOf(id | card) → card     a card written out is taken as it is, checked by the kernel's compile
 */

export const FACULTIES = Object.freeze(['might', 'agility', 'grit', 'wits', 'insight', 'presence', 'stealth']);
export const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
export const CHECK_KINDS = Object.freeze(['target', 'under', 'bands', 'shifts', 'percent', 'challenge']);

/** Experience to reach each level: `base` for the second, the step growing by `growth` each level after. */
const xpCurve = (base, growth, levels) => { const t = [0]; let step = base; for (let l = 1; l < levels; l++) { t.push(t[l - 1] + step); step = Math.round(step * growth); } return t; };

// the four starter classes every card plays, by the egocube's roles; each card gives their priorities and weapons
const CLASS_ROLES = {
  warrior: { name: 'Warrior', about: 'the front of the party', roles: ['frontline'], live: 'fighter' },
  scout: { name: 'Scout', about: 'first in, first out', roles: ['flanker', 'ranged'], live: 'rogue' },
  adept: { name: 'Adept', about: 'knows the trick of it', roles: ['caster', 'controller'], live: 'mage' },
  mender: { name: 'Mender', about: 'keeps the others standing', roles: ['support', 'non-combatant'], live: 'cleric' },
};
const classes = (each) => Object.fromEntries(Object.entries(each).map(([id, c]) => [id, { ...CLASS_ROLES[id], ...c }]));

const SIX = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SIX_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const SIX_FACULTIES = { might: 'str', agility: 'dex', grit: 'con', wits: 'int', insight: 'wis', presence: 'cha', stealth: 'dex' };
const SIX_LIVE = { hp: 'con', mp: 'wis', atk: 'str', def: 'con', mag: 'int', spd: 'dex' };

const target = {
  name: 'target',
  about: 'a d20 plus a modifier against a target number; six abilities from 3 to 18, a modifier of (score − 10) / 2',
  abilities: SIX, names: SIX_NAMES, faculties: SIX_FACULTIES,
  generate: { default: 'roll', methods: {
    roll: { dice: '4d6kh3', order: 'assign' },
    array: { values: [15, 14, 13, 12, 11, 8] },
    pointbuy: { budget: 30, min: 8, max: 15, cost: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 6, 14: 8, 15: 10 } },
  } },
  modifier: { kind: 'step', base: 10, per: 2 },
  check: { kind: 'target', difficulty: { easy: 10, medium: 14, hard: 18 }, trained: { base: 2, every: 4 } },
  combat: { initiative: 'roll', damage: 'dice', foesAct: true, defence: 'armour' },
  foes: [
    { hp: 7, defence: 12, attack: 3, damage: '1d6+1', xp: 25 },
    { hp: 13, defence: 12, attack: 3, damage: '1d6+2', xp: 50 },
    { hp: 22, defence: 13, attack: 4, damage: '1d10+2', xp: 200 },
    { hp: 45, defence: 14, attack: 5, damage: '2d8+3', xp: 450 },
    { hp: 75, defence: 15, attack: 6, damage: '2d10+3', xp: 1100 },
  ],
  hp: { kind: 'die', ability: 'con' },
  progression: { kind: 'xp', thresholds: xpCurve(250, 2, 12) },
  classes: classes({
    warrior: { priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'], hitDie: 10, armour: { base: 16 }, weapon: { name: 'sword', dice: '1d8', faculty: 'might' } },
    scout: { priority: ['dex', 'con', 'int', 'wis', 'cha', 'str'], hitDie: 8, armour: { base: 11, dex: true }, weapon: { name: 'short blade', dice: '1d8', faculty: 'agility' } },
    adept: { priority: ['int', 'con', 'dex', 'wis', 'cha', 'str'], hitDie: 6, armour: { base: 10, dex: true }, weapon: { name: 'bolt', dice: '1d10', faculty: 'wits' } },
    mender: { priority: ['wis', 'con', 'str', 'cha', 'dex', 'int'], hitDie: 8, armour: { base: 15 }, weapon: { name: 'mace', dice: '1d6', faculty: 'might' } },
  }),
  live: SIX_LIVE, range: [3, 18],
};

const under = {
  name: 'under',
  about: 'three dice for each ability in order, a d20 rolled at or under the ability to pass; small modifiers from a table',
  abilities: SIX, names: SIX_NAMES, faculties: SIX_FACULTIES,
  generate: { default: 'roll', methods: { roll: { dice: '3d6', order: 'in-order' }, heroic: { dice: '4d6kh3', order: 'assign' } } },
  modifier: { kind: 'table', bands: [[3, -3], [5, -2], [8, -1], [12, 0], [15, 1], [17, 2], [99, 3]] },
  // the difficulty shifts the target: an easy task is the ability + 2, a hard one the ability − 4
  check: { kind: 'under', difficulty: { easy: 2, medium: 0, hard: -4 } },
  combat: { initiative: 'side', damage: 'dice', foesAct: true, defence: 'armour' },
  foes: [
    { hp: 4, defence: 11, attack: 1, damage: '1d6', xp: 10 },
    { hp: 9, defence: 12, attack: 2, damage: '1d6', xp: 25 },
    { hp: 18, defence: 14, attack: 4, damage: '1d8', xp: 75 },
    { hp: 27, defence: 15, attack: 5, damage: '2d6', xp: 175 },
    { hp: 45, defence: 17, attack: 7, damage: '2d8', xp: 500 },
  ],
  hp: { kind: 'die', ability: 'con', rolled: true },
  progression: { kind: 'xp', thresholds: xpCurve(1000, 2, 10) },
  classes: classes({
    warrior: { priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'], hitDie: 8, armour: { base: 15, dex: true }, weapon: { name: 'sword', dice: '1d8', faculty: 'might' } },
    scout: { priority: ['dex', 'int', 'con', 'cha', 'wis', 'str'], hitDie: 4, armour: { base: 12, dex: true }, weapon: { name: 'knife', dice: '1d4', faculty: 'agility' } },
    adept: { priority: ['int', 'dex', 'wis', 'con', 'cha', 'str'], hitDie: 4, armour: { base: 10, dex: true }, weapon: { name: 'staff', dice: '1d6', faculty: 'might' } },
    mender: { priority: ['wis', 'str', 'con', 'cha', 'dex', 'int'], hitDie: 6, armour: { base: 15 }, weapon: { name: 'mace', dice: '1d6', faculty: 'might' } },
  }),
  live: SIX_LIVE, range: [3, 18],
};

const bands = {
  name: 'bands',
  about: '2d6 plus a stat from −1 to +3, read in bands: 10 or more a hit, 7 to 9 a hit at a cost, 6 or less a miss; the players roll every die',
  abilities: ['force', 'grace', 'wits', 'heart', 'nerve'], names: { force: 'Force', grace: 'Grace', wits: 'Wits', heart: 'Heart', nerve: 'Nerve' },
  faculties: { might: 'force', agility: 'grace', grit: 'nerve', wits: 'wits', insight: 'wits', presence: 'heart', stealth: 'grace' },
  generate: { default: 'array', methods: { array: { values: [2, 1, 1, 0, -1] } } },
  modifier: { kind: 'none' },
  // the difficulty a bonus on the roll: +1 easy, −1 hard
  check: { kind: 'bands', difficulty: { easy: 1, medium: 0, hard: -1 } },
  combat: { initiative: 'order', damage: 'harm', foesAct: false, defence: 'none', costOn: ['partial', 'fail', 'fumble'] },
  foes: [
    { hp: 2, defence: 0, attack: 0, damage: 1, xp: 0 },
    { hp: 4, defence: 0, attack: 0, damage: 1, xp: 0 },
    { hp: 6, defence: 0, attack: 0, damage: 2, xp: 0 },
    { hp: 8, defence: 0, attack: 0, damage: 2, xp: 0 },
    { hp: 12, defence: 0, attack: 0, damage: 3, xp: 0 },
  ],
  hp: { kind: 'fixed', value: 6 },
  progression: { kind: 'misses', at: 5 },
  classes: classes({
    warrior: { priority: ['force', 'nerve', 'grace', 'heart', 'wits'], weapon: { name: 'chain', harm: 2, faculty: 'might' } },
    scout: { priority: ['grace', 'wits', 'nerve', 'heart', 'force'], weapon: { name: 'knife', harm: 1, faculty: 'agility' } },
    adept: { priority: ['wits', 'heart', 'grace', 'nerve', 'force'], weapon: { name: 'hex', harm: 2, faculty: 'wits' } },
    mender: { priority: ['heart', 'wits', 'nerve', 'grace', 'force'], weapon: { name: 'staff', harm: 1, faculty: 'might' } },
  }),
  live: { hp: 'nerve', mp: 'heart', atk: 'force', def: 'nerve', mag: 'wits', spd: 'grace' }, range: [-1, 3],
};

const SHIFT = ['strong', 'quick', 'clever', 'careful', 'bold', 'quiet'];
const shifts = {
  name: 'shifts',
  about: 'four fudge dice (−1, 0 or +1 each) plus a stat from 0 to +3, against a rung from 1 to 4; three over is a critical, a tie a success at a cost',
  abilities: SHIFT, names: Object.fromEntries(SHIFT.map((a) => [a, a[0].toUpperCase() + a.slice(1)])),
  faculties: { might: 'strong', agility: 'quick', grit: 'strong', wits: 'clever', insight: 'careful', presence: 'bold', stealth: 'quiet' },
  generate: { default: 'array', methods: { array: { values: [3, 2, 2, 1, 1, 0] } } },
  modifier: { kind: 'none' },
  check: { kind: 'shifts', difficulty: { easy: 1, medium: 2, hard: 4 } },
  combat: { initiative: 'order', damage: 'shifts', foesAct: true, defence: 'none' },
  // a foe's blow is its shifts; `damage` is the stress a trap of its rank deals
  foes: [
    { hp: 1, defence: 1, attack: 1, damage: 1, xp: 0 },
    { hp: 2, defence: 2, attack: 2, damage: 1, xp: 0 },
    { hp: 3, defence: 2, attack: 3, damage: 2, xp: 0 },
    { hp: 4, defence: 3, attack: 3, damage: 2, xp: 0 },
    { hp: 6, defence: 4, attack: 4, damage: 3, xp: 0 },
  ],
  // stress: one track of four
  hp: { kind: 'fixed', value: 4 },
  progression: { kind: 'milestone' },
  classes: classes({
    warrior: { priority: ['bold', 'quick', 'strong', 'careful', 'clever', 'quiet'], weapon: { name: 'blade', faculty: 'presence' } },
    scout: { priority: ['quiet', 'quick', 'clever', 'careful', 'bold', 'strong'], weapon: { name: 'knife', faculty: 'stealth' } },
    adept: { priority: ['clever', 'careful', 'quiet', 'quick', 'bold', 'strong'], weapon: { name: 'trick', faculty: 'wits' } },
    mender: { priority: ['strong', 'careful', 'quick', 'clever', 'bold', 'quiet'], weapon: { name: 'hammer', faculty: 'might' }, live: 'knight' },
  }),
  live: { hp: 'strong', mp: 'clever', atk: 'strong', def: 'careful', mag: 'clever', spd: 'quick' }, range: [0, 3],
};

const PCT = ['str', 'con', 'dex', 'int', 'will', 'cha'];
const percent = {
  name: 'percent',
  about: 'scores of 3d6 × 5; a d100 rolled at or under the score passes, a fifth of it is a critical, 96 and over a fumble',
  abilities: PCT, names: { str: 'Strength', con: 'Constitution', dex: 'Dexterity', int: 'Intelligence', will: 'Will', cha: 'Charm' },
  faculties: { might: 'str', agility: 'dex', grit: 'con', wits: 'int', insight: 'will', presence: 'cha', stealth: 'dex' },
  generate: { default: 'roll', methods: { roll: { dice: '3d6', order: 'in-order', scale: 5 }, assign: { dice: '3d6', order: 'assign', scale: 5 } } },
  modifier: { kind: 'none' },
  // the score's share: easy doubles it, hard halves it
  check: { kind: 'percent', difficulty: { easy: 2, medium: 1, hard: 0.5 } },
  combat: { initiative: 'order', damage: 'dice', foesAct: true, defence: 'none' },
  foes: [
    { hp: 6, defence: 0, attack: 35, damage: '1d4', xp: 0 },
    { hp: 10, defence: 0, attack: 45, damage: '1d6', xp: 0 },
    { hp: 14, defence: 0, attack: 55, damage: '1d8+1', xp: 0 },
    { hp: 18, defence: 0, attack: 65, damage: '1d10+2', xp: 0 },
    { hp: 26, defence: 0, attack: 75, damage: '2d8+2', xp: 0 },
  ],
  hp: { kind: 'derived', of: ['con', 'str'], div: 10 },
  progression: { kind: 'milestone' },
  classes: classes({
    warrior: { priority: ['str', 'con', 'dex', 'will', 'int', 'cha'], weapon: { name: 'rifle', dice: '1d8+1', faculty: 'agility' } },
    scout: { priority: ['dex', 'con', 'cha', 'int', 'will', 'str'], weapon: { name: 'knife', dice: '1d4+1', faculty: 'agility' } },
    adept: { priority: ['int', 'will', 'dex', 'cha', 'con', 'str'], weapon: { name: 'revolver', dice: '1d8', faculty: 'agility' } },
    mender: { priority: ['int', 'dex', 'will', 'con', 'cha', 'str'], weapon: { name: 'scalpel', dice: '1d3', faculty: 'agility' } },
  }),
  live: { hp: 'con', mp: 'will', atk: 'str', def: 'con', mag: 'int', spd: 'dex' }, range: [15, 90],
};

const CH = ['grit', 'speed', 'wits', 'heart', 'guile'];
const challenge = {
  name: 'challenge',
  about: 'a d6 plus a stat from 1 to 3 against two d10: beat both a strong hit, one a weak hit, neither a miss; the players roll every die',
  abilities: CH, names: Object.fromEntries(CH.map((a) => [a, a[0].toUpperCase() + a.slice(1)])),
  faculties: { might: 'grit', agility: 'speed', grit: 'grit', wits: 'wits', insight: 'wits', presence: 'heart', stealth: 'guile' },
  generate: { default: 'array', methods: { array: { values: [3, 2, 2, 1, 1] } } },
  modifier: { kind: 'none' },
  // the difficulty a bonus on the d6: +1 easy, −1 hard
  check: { kind: 'challenge', difficulty: { easy: 1, medium: 0, hard: -1 } },
  combat: { initiative: 'order', damage: 'harm', foesAct: false, defence: 'none', costOn: ['fail', 'fumble'] },
  foes: [
    { hp: 3, defence: 0, attack: 0, damage: 1, xp: 0 },
    { hp: 4, defence: 0, attack: 0, damage: 2, xp: 0 },
    { hp: 6, defence: 0, attack: 0, damage: 3, xp: 0 },
    { hp: 8, defence: 0, attack: 0, damage: 4, xp: 0 },
    { hp: 10, defence: 0, attack: 0, damage: 5, xp: 0 },
  ],
  hp: { kind: 'fixed', value: 5 },
  progression: { kind: 'milestone' },
  classes: classes({
    warrior: { priority: ['grit', 'heart', 'speed', 'wits', 'guile'], weapon: { name: 'axe', harm: 2, faculty: 'might' }, live: 'knight' },
    scout: { priority: ['speed', 'wits', 'guile', 'grit', 'heart'], weapon: { name: 'bow', harm: 1, faculty: 'agility' } },
    adept: { priority: ['wits', 'heart', 'guile', 'speed', 'grit'], weapon: { name: 'rite', harm: 2, faculty: 'wits' } },
    mender: { priority: ['heart', 'wits', 'grit', 'speed', 'guile'], weapon: { name: 'staff', harm: 1, faculty: 'might' } },
  }),
  live: { hp: 'grit', mp: 'heart', atk: 'grit', def: 'grit', mag: 'wits', spd: 'speed' }, range: [1, 3],
};

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };

export const TABLE_RPG_SYSTEMS = deepFreeze({ target, under, bands, shifts, percent, challenge });
export const TABLE_RPG_SYSTEM_IDS = Object.freeze(Object.keys(TABLE_RPG_SYSTEMS));

export function systemOf(system) {
  if (system && typeof system === 'object' && !Array.isArray(system)) return system;
  const card = TABLE_RPG_SYSTEMS[system];
  if (!card) throw new Error(`table rpg: no starter '${system}' (${TABLE_RPG_SYSTEM_IDS.join(', ')}); a named game is written out as a card`);
  return card;
}
