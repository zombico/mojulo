/**
 * THE BOOK SYSTEMS — how a pen-and-paper game rolls a character, decides a check and settles a fight, as data the table
 * RPG kernel (table-rpg-kernel.js) reads. Each system is one RESOLUTION PROCEDURE (its `check.kind`), stated in our own
 * words: mechanics, never a book's text. A system taken from an openly licensed reference carries its `attribution`,
 * which a page or a packet that plays it prints.
 *
 *   d20         a d20 plus a modifier against a difficulty class; six abilities 3–18 (SRD 5.2, CC BY 4.0)
 *   classic     three dice in order, a d20 rolled UNDER the ability; the old-school table of modifiers (generic)
 *   moves       2d6 plus a stat read in bands: 10+ a hit, 7–9 a hit with a cost, 6- a miss (the 2d6-bands family)
 *   ladder      four fudge dice plus an approach against a rung of the ladder (Fate Accelerated, CC BY 3.0)
 *   percentile  d100 rolled under a skill out of a hundred, a fifth of it a critical (the percentile family)
 *   action      an action die plus a stat against two challenge dice (Ironsworn SRD, CC BY 4.0)
 *
 * A module is written in PORTABLE words, so one scenario plays under any system: a check names a FACULTY (might,
 * agility, grit, wits, insight, presence, stealth) and a DIFFICULTY (easy, medium, hard); a foe a RANK (1 a minion … 5 a
 * boss). The card says what each is in its own numbers: `faculties`, `check.difficulty`, `foes`.
 *
 *   card: {
 *     name, about, attribution?,
 *     abilities: [id], names: { id: 'Strength' },
 *     faculties: { might, agility, grit, wits, insight, presence, stealth → ability id },
 *     generate: { default, methods: { <id>: { dice, order: 'assign' | 'in-order', scale? } | { values } |
 *                 { budget, min, max, cost } } }        rolled, an array to place, or points to buy
 *     modifier: { kind: 'step', base, per } (floor((score − base) / per)) | { kind: 'table', bands: [[upto, mod]] } |
 *               { kind: 'none' } (the score is the modifier)
 *     check: { kind: 'd20' | 'under' | 'bands' | 'ladder' | 'percentile' | 'action', difficulty: { easy, medium, hard },
 *              bonus?: 'proficiency' }
 *     combat: { initiative: 'd20' | 'side' | 'order', damage: 'dice' | 'shifts' | 'harm', foesAct: bool,
 *               defence: 'armour' | 'none', costOn?: [band] }   foesAct false: the players roll every die, and a foe
 *               hurts only on the bands `costOn` names (the 2d6 family: a hit at a cost and a miss; the action
 *               family: a miss, a weak hit losing the initiative and no more)
 *     foes: [rank 1 … 5] each { hp, defence, attack, damage, xp }   in the system's own terms (damage dice or harm,
 *           also what a trap of that rank deals)
 *     hp: { kind: 'die' (the class's hit die, max at first level), ability } | { kind: 'fixed', value } |
 *         { kind: 'derived', of: [ability], div }
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
export const CHECK_KINDS = Object.freeze(['d20', 'under', 'bands', 'ladder', 'percentile', 'action']);

const SIX = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SIX_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const SIX_FACULTIES = { might: 'str', agility: 'dex', grit: 'con', wits: 'int', insight: 'wis', presence: 'cha', stealth: 'dex' };
const SIX_LIVE = { hp: 'con', mp: 'wis', atk: 'str', def: 'con', mag: 'int', spd: 'dex' };

const d20 = {
  name: 'd20',
  about: 'a d20 plus a modifier against a difficulty class; six abilities from 3 to 18, a modifier of (score − 10) / 2',
  attribution: 'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  abilities: SIX, names: SIX_NAMES, faculties: SIX_FACULTIES,
  generate: { default: 'roll', methods: {
    roll: { dice: '4d6kh3', order: 'assign' },
    array: { values: [15, 14, 13, 12, 10, 8] },
    pointbuy: { budget: 27, min: 8, max: 15, cost: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 } },
  } },
  modifier: { kind: 'step', base: 10, per: 2 },
  check: { kind: 'd20', difficulty: { easy: 10, medium: 15, hard: 20 }, bonus: 'proficiency' },
  combat: { initiative: 'd20', damage: 'dice', foesAct: true, defence: 'armour' },
  foes: [
    { hp: 7, defence: 12, attack: 3, damage: '1d6+1', xp: 25 },
    { hp: 13, defence: 12, attack: 3, damage: '1d6+2', xp: 50 },
    { hp: 22, defence: 13, attack: 4, damage: '1d10+2', xp: 200 },
    { hp: 45, defence: 14, attack: 5, damage: '2d8+3', xp: 450 },
    { hp: 75, defence: 15, attack: 6, damage: '2d10+3', xp: 1100 },
  ],
  hp: { kind: 'die', ability: 'con' },
  progression: { kind: 'xp', thresholds: [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000] },
  classes: {
    fighter: { name: 'Fighter', about: 'armour and a blade, the front of the party', priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'], roles: ['frontline'], hitDie: 10, armour: { base: 16 }, weapon: { name: 'longsword', dice: '1d8', faculty: 'might' }, live: 'fighter' },
    rogue: { name: 'Rogue', about: 'quick hands and a short blade, first through a door', priority: ['dex', 'con', 'int', 'wis', 'cha', 'str'], roles: ['flanker', 'ranged'], hitDie: 8, armour: { base: 11, dex: true }, weapon: { name: 'rapier', dice: '1d8', faculty: 'agility' }, live: 'rogue' },
    wizard: { name: 'Wizard', about: 'a book of spells and a frail body', priority: ['int', 'con', 'dex', 'wis', 'cha', 'str'], roles: ['caster', 'controller'], hitDie: 6, armour: { base: 10, dex: true }, weapon: { name: 'fire bolt', dice: '1d10', faculty: 'wits' }, live: 'mage' },
    cleric: { name: 'Cleric', about: 'a holy symbol, a mace and the party\'s mending', priority: ['wis', 'con', 'str', 'cha', 'dex', 'int'], roles: ['support', 'non-combatant'], hitDie: 8, armour: { base: 16 }, weapon: { name: 'mace', dice: '1d6', faculty: 'might' }, live: 'cleric' },
  },
  live: SIX_LIVE, range: [3, 18],
};

const classic = {
  name: 'classic',
  about: 'three dice for each ability in order, a d20 rolled under the ability to pass; small modifiers from a table',
  abilities: SIX, names: SIX_NAMES, faculties: SIX_FACULTIES,
  generate: { default: 'roll', methods: { roll: { dice: '3d6', order: 'in-order' }, heroic: { dice: '4d6kh3', order: 'assign' } } },
  modifier: { kind: 'table', bands: [[3, -3], [5, -2], [8, -1], [12, 0], [15, 1], [17, 2], [99, 3]] },
  // roll-under: the difficulty shifts the target (an easy task is the ability + 2, a hard one the ability − 4)
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
  progression: { kind: 'xp', thresholds: [0, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 200000] },
  classes: {
    fighter: { name: 'Fighter', about: 'a sword, mail and nerve', priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'], roles: ['frontline'], hitDie: 8, armour: { base: 15, dex: true }, weapon: { name: 'sword', dice: '1d8', faculty: 'might' }, live: 'fighter' },
    thief: { name: 'Thief', about: 'locks, ledges and a knife', priority: ['dex', 'int', 'con', 'cha', 'wis', 'str'], roles: ['flanker', 'ranged'], hitDie: 4, armour: { base: 12, dex: true }, weapon: { name: 'dagger', dice: '1d4', faculty: 'agility' }, live: 'rogue' },
    magician: { name: 'Magician', about: 'one spell a day and a staff', priority: ['int', 'dex', 'wis', 'con', 'cha', 'str'], roles: ['caster', 'controller'], hitDie: 4, armour: { base: 10, dex: true }, weapon: { name: 'staff', dice: '1d6', faculty: 'might' }, live: 'mage' },
    cleric: { name: 'Cleric', about: 'a mace, a prayer and the dead turned back', priority: ['wis', 'str', 'con', 'cha', 'dex', 'int'], roles: ['support', 'non-combatant'], hitDie: 6, armour: { base: 15 }, weapon: { name: 'mace', dice: '1d6', faculty: 'might' }, live: 'cleric' },
  },
  live: SIX_LIVE, range: [3, 18],
};

const MOVES_STATS = ['force', 'grace', 'wits', 'heart', 'nerve'];
const moves = {
  name: 'moves',
  about: '2d6 plus a stat from −1 to +3, read in bands: 10 or more a hit, 7 to 9 a hit with a cost, 6 or less a miss; the players roll every die',
  abilities: MOVES_STATS, names: { force: 'Force', grace: 'Grace', wits: 'Wits', heart: 'Heart', nerve: 'Nerve' },
  faculties: { might: 'force', agility: 'grace', grit: 'nerve', wits: 'wits', insight: 'wits', presence: 'heart', stealth: 'grace' },
  generate: { default: 'array', methods: { array: { values: [2, 1, 1, 0, -1] } } },
  modifier: { kind: 'none' },
  // the difficulty a forward or an ongoing: +1 easy, −1 hard
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
  classes: {
    brawler: { name: 'Brawler', about: 'fists, a chain and no fear', priority: ['force', 'nerve', 'grace', 'heart', 'wits'], roles: ['frontline'], weapon: { name: 'chain', harm: 2, faculty: 'might' }, live: 'fighter' },
    scout: { name: 'Scout', about: 'first in, first out, never seen', priority: ['grace', 'wits', 'nerve', 'heart', 'force'], roles: ['flanker', 'ranged'], weapon: { name: 'knife', harm: 1, faculty: 'agility' }, live: 'rogue' },
    seer: { name: 'Seer', about: 'sees what is coming and says it aloud', priority: ['wits', 'heart', 'grace', 'nerve', 'force'], roles: ['caster', 'controller'], weapon: { name: 'hex', harm: 2, faculty: 'wits' }, live: 'mage' },
    mender: { name: 'Mender', about: 'keeps the others standing', priority: ['heart', 'wits', 'nerve', 'grace', 'force'], roles: ['support', 'non-combatant'], weapon: { name: 'staff', harm: 1, faculty: 'might' }, live: 'cleric' },
  },
  live: { hp: 'nerve', mp: 'heart', atk: 'force', def: 'nerve', mag: 'wits', spd: 'grace' }, range: [-1, 3],
};

const FAE = ['careful', 'clever', 'flashy', 'forceful', 'quick', 'sneaky'];
const ladder = {
  name: 'ladder',
  about: 'four fudge dice (−1, 0, +1 each) plus an approach from 0 to +3, against a rung of the ladder; three over is success with style',
  attribution: 'This work is based on Fate Core System and Fate Accelerated Edition (found at https://www.faterpg.com/), products of Evil Hat Productions, LLC, developed, authored, and edited by Leonard Balsera, Brian Engard, Jeremy Keller, Ryan Macklin, Mike Olson, Clark Valentine, Amanda Valentine, Fred Hicks, and Rob Donoghue, and licensed for our use under the Creative Commons Attribution 3.0 Unported license (https://creativecommons.org/licenses/by/3.0/).',
  abilities: FAE, names: { careful: 'Careful', clever: 'Clever', flashy: 'Flashy', forceful: 'Forceful', quick: 'Quick', sneaky: 'Sneaky' },
  faculties: { might: 'forceful', agility: 'quick', grit: 'forceful', wits: 'clever', insight: 'careful', presence: 'flashy', stealth: 'sneaky' },
  generate: { default: 'array', methods: { array: { values: [3, 2, 2, 1, 1, 0] } } },
  modifier: { kind: 'none' },
  // a rung of the ladder: Average (+1), Fair (+2), Great (+4)
  check: { kind: 'ladder', difficulty: { easy: 1, medium: 2, hard: 4 } },
  combat: { initiative: 'order', damage: 'shifts', foesAct: true, defence: 'none' },
  // a foe's blow is its shifts; `damage` is the stress a trap of its rank deals
  foes: [
    { hp: 1, defence: 1, attack: 1, damage: 1, xp: 0 },
    { hp: 2, defence: 2, attack: 2, damage: 1, xp: 0 },
    { hp: 3, defence: 2, attack: 3, damage: 2, xp: 0 },
    { hp: 4, defence: 3, attack: 3, damage: 2, xp: 0 },
    { hp: 6, defence: 4, attack: 4, damage: 3, xp: 0 },
  ],
  // stress: three boxes and a mild consequence, as one track of four
  hp: { kind: 'fixed', value: 4 },
  progression: { kind: 'milestone' },
  classes: {
    duelist: { name: 'Duelist', about: 'a blade and a flourish', priority: ['flashy', 'quick', 'forceful', 'careful', 'clever', 'sneaky'], roles: ['frontline', 'flanker'], weapon: { name: 'blade', faculty: 'presence' }, live: 'fighter' },
    sneak: { name: 'Sneak', about: 'never where the trouble looks', priority: ['sneaky', 'quick', 'clever', 'careful', 'flashy', 'forceful'], roles: ['ranged'], weapon: { name: 'knife', faculty: 'stealth' }, live: 'rogue' },
    scholar: { name: 'Scholar', about: 'knows the answer and the trick', priority: ['clever', 'careful', 'sneaky', 'quick', 'flashy', 'forceful'], roles: ['caster', 'controller'], weapon: { name: 'cantrip', faculty: 'wits' }, live: 'mage' },
    guardian: { name: 'Guardian', about: 'stands between the others and harm', priority: ['forceful', 'careful', 'quick', 'clever', 'flashy', 'sneaky'], roles: ['support', 'non-combatant'], weapon: { name: 'hammer', faculty: 'might' }, live: 'knight' },
  },
  live: { hp: 'forceful', mp: 'clever', atk: 'forceful', def: 'careful', mag: 'clever', spd: 'quick' }, range: [0, 3],
};

const BRP = ['str', 'con', 'dex', 'int', 'pow', 'app'];
const percentile = {
  name: 'percentile',
  about: 'characteristics of 3d6 × 5; a d100 rolled at or under the score passes, a fifth of it is a critical, 96 and over a fumble',
  abilities: BRP, names: { str: 'Strength', con: 'Constitution', dex: 'Dexterity', int: 'Intelligence', pow: 'Power', app: 'Appearance' },
  faculties: { might: 'str', agility: 'dex', grit: 'con', wits: 'int', insight: 'pow', presence: 'app', stealth: 'dex' },
  generate: { default: 'roll', methods: { roll: { dice: '3d6', order: 'in-order', scale: 5 }, assign: { dice: '3d6', order: 'assign', scale: 5 } } },
  modifier: { kind: 'none' },
  // the score's share: easy doubles it, hard halves it
  check: { kind: 'percentile', difficulty: { easy: 2, medium: 1, hard: 0.5 } },
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
  classes: {
    soldier: { name: 'Soldier', about: 'drilled, armed and steady', priority: ['str', 'con', 'dex', 'pow', 'int', 'app'], roles: ['frontline'], weapon: { name: 'rifle', dice: '1d8+1', faculty: 'agility' }, live: 'fighter' },
    investigator: { name: 'Investigator', about: 'asks the next question', priority: ['int', 'pow', 'dex', 'app', 'con', 'str'], roles: ['controller', 'caster'], weapon: { name: 'revolver', dice: '1d8', faculty: 'agility' }, live: 'mage' },
    drifter: { name: 'Drifter', about: 'knows the back roads and the back doors', priority: ['dex', 'con', 'app', 'int', 'pow', 'str'], roles: ['flanker', 'ranged'], weapon: { name: 'knife', dice: '1d4+1', faculty: 'agility' }, live: 'rogue' },
    doctor: { name: 'Doctor', about: 'a steady hand and a black bag', priority: ['int', 'dex', 'pow', 'con', 'app', 'str'], roles: ['support', 'non-combatant'], weapon: { name: 'scalpel', dice: '1d3', faculty: 'agility' }, live: 'cleric' },
  },
  live: { hp: 'con', mp: 'pow', atk: 'str', def: 'con', mag: 'int', spd: 'dex' }, range: [15, 90],
};

const IRON = ['edge', 'heart', 'iron', 'shadow', 'wits'];
const action = {
  name: 'action',
  about: 'an action die (d6) plus a stat from 1 to 3 against two challenge dice (d10): beat both a strong hit, one a weak hit, neither a miss; the players roll every die',
  attribution: 'This work is based on Ironsworn (found at https://www.ironswornrpg.com), created by Shawn Tomkin, and licensed for our use under the Creative Commons Attribution 4.0 International license (https://creativecommons.org/licenses/by/4.0/).',
  abilities: IRON, names: { edge: 'Edge', heart: 'Heart', iron: 'Iron', shadow: 'Shadow', wits: 'Wits' },
  faculties: { might: 'iron', agility: 'edge', grit: 'iron', wits: 'wits', insight: 'wits', presence: 'heart', stealth: 'shadow' },
  generate: { default: 'array', methods: { array: { values: [3, 2, 2, 1, 1] } } },
  modifier: { kind: 'none' },
  // an add to the action die: +1 easy, −1 hard
  check: { kind: 'action', difficulty: { easy: 1, medium: 0, hard: -1 } },
  combat: { initiative: 'order', damage: 'harm', foesAct: false, defence: 'none', costOn: ['fail', 'fumble'] },
  // a rank's harm: troublesome, dangerous, formidable, extreme, epic
  foes: [
    { hp: 3, defence: 0, attack: 0, damage: 1, xp: 0 },
    { hp: 4, defence: 0, attack: 0, damage: 2, xp: 0 },
    { hp: 6, defence: 0, attack: 0, damage: 3, xp: 0 },
    { hp: 8, defence: 0, attack: 0, damage: 4, xp: 0 },
    { hp: 10, defence: 0, attack: 0, damage: 5, xp: 0 },
  ],
  hp: { kind: 'fixed', value: 5 },
  progression: { kind: 'milestone' },
  classes: {
    ironclad: { name: 'Ironclad', about: 'armour, a shield and a vow', priority: ['iron', 'heart', 'edge', 'wits', 'shadow'], roles: ['frontline'], weapon: { name: 'axe', harm: 2, faculty: 'might' }, live: 'knight' },
    hunter: { name: 'Hunter', about: 'a bow and a long patience', priority: ['edge', 'wits', 'shadow', 'iron', 'heart'], roles: ['ranged', 'flanker'], weapon: { name: 'bow', harm: 1, faculty: 'agility' }, live: 'rogue' },
    mystic: { name: 'Mystic', about: 'reads the bones and the old marks', priority: ['wits', 'heart', 'shadow', 'edge', 'iron'], roles: ['caster', 'controller'], weapon: { name: 'rite', harm: 2, faculty: 'wits' }, live: 'mage' },
    healer: { name: 'Healer', about: 'herbs, splints and steady words', priority: ['heart', 'wits', 'iron', 'edge', 'shadow'], roles: ['support', 'non-combatant'], weapon: { name: 'staff', harm: 1, faculty: 'might' }, live: 'cleric' },
  },
  live: { hp: 'iron', mp: 'heart', atk: 'iron', def: 'iron', mag: 'wits', spd: 'edge' }, range: [1, 3],
};

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };

export const TABLE_RPG_SYSTEMS = deepFreeze({ d20, classic, moves, ladder, percentile, action });
export const TABLE_RPG_SYSTEM_IDS = Object.freeze(Object.keys(TABLE_RPG_SYSTEMS));

export function systemOf(system) {
  if (system && typeof system === 'object' && !Array.isArray(system)) return system;
  const card = TABLE_RPG_SYSTEMS[system];
  if (!card) throw new Error(`table rpg: no system '${system}' (${TABLE_RPG_SYSTEM_IDS.join(', ')}), or write one out`);
  return card;
}
