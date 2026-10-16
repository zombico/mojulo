/**
 * THE STARTER BOOK — classes, skills, foes and battle items a world may name without defining them. A world's own
 * definition under the same id takes the preset's place whole; anything it leaves out it does not get. These are
 * conventions of the genre (a frontline fighter, a caster, a healer, a thief…), never any one game's.
 *
 *   CLASS_PRESETS   id → { name, about, base, growth, skills: [{ skill, at } | { skill, cost, requires? }] }
 *                   at: the class rank the skill comes at (learned for good); cost: class points on the tree
 *   SKILL_PRESETS   id → { name, about, mp, target, power?, stat?, scale?, element?, heal?, revive?, cure?, status?, buff?, carry? }
 *   FOE_PRESETS     id → { name, hp, mp?, atk, def, mag, spd, xp, gold, cp?, weak?, resist?, absorb?, immune?, skills?, drops?, boss? }
 *   ITEM_PRESETS    id → { name, heal?, mp?, revive?, cure?, hurt?, element?, target }
 *   GEAR_PRESETS    id → { name, slot: weapon | armor | accessory, atk?, def?, mag?, spd?, hp?, mp?, classes? }
 *                   worn by one member in its slot, its numbers added to theirs; classes: who may wear it (any, unnamed)
 *   GEAR_SLOTS      the slots, in the order the party menu lists them
 *   a class's `start`: { <slot>: gear } what a member of it wears when the party starts
 *   ELEMENTS        the element words the presets use (any lower-case word is an element)
 *
 * Numbers are tuned so a party of three at level 1 beats a pack of three starters with a potion or two to spare, and
 * the boss wants level 5 and its weakness.
 */

export const ELEMENTS = Object.freeze(['fire', 'ice', 'thunder', 'light', 'dark']);

const st = (hp, mp, atk, def, mag, spd) => Object.freeze({ hp, mp, atk, def, mag, spd });

export const CLASS_PRESETS = Object.freeze({
  fighter: {
    name: 'Fighter', about: 'the front line: hits hard, takes hits, no magic',
    base: st(34, 0, 11, 8, 2, 6), growth: st(8, 0, 2.6, 1.8, 0.3, 0.9),
    skills: [{ skill: 'power-strike', at: 1 }, { skill: 'cleave', at: 3 }, { skill: 'rally', cost: 1 }, { skill: 'berserk', cost: 2, requires: ['rally'] }],
    start: { weapon: 'bronze-sword', armor: 'leather-armor' },
  },
  knight: {
    name: 'Knight', about: 'the shield: high defence, guards the weak, a holy blade later',
    base: st(38, 4, 9, 11, 4, 4), growth: st(9, 0.6, 2.1, 2.4, 0.6, 0.6),
    skills: [{ skill: 'guard-up', at: 1 }, { skill: 'shield-bash', at: 2 }, { skill: 'protect', cost: 1 }, { skill: 'holy-blade', cost: 2, requires: ['shield-bash'] }],
    start: { weapon: 'bronze-sword', armor: 'chain-mail' },
  },
  mage: {
    name: 'Mage', about: 'the caster: elemental magic, a sleep spell, frail',
    base: st(22, 14, 5, 4, 12, 6), growth: st(4.5, 3.2, 0.8, 0.9, 2.8, 0.9),
    skills: [{ skill: 'fire', at: 1 }, { skill: 'blizzard', at: 2 }, { skill: 'thunder', at: 3 }, { skill: 'sleep', cost: 1 }, { skill: 'firestorm', cost: 2, requires: ['fire'] }, { skill: 'focus', cost: 1 }],
    start: { weapon: 'oak-staff', armor: 'robe' },
  },
  cleric: {
    name: 'Cleric', about: 'the healer: mends, cures and raises; a little holy light',
    base: st(26, 12, 7, 6, 10, 5), growth: st(5.5, 2.8, 1.2, 1.2, 2.4, 0.8),
    skills: [{ skill: 'heal', at: 1 }, { skill: 'cure', at: 2 }, { skill: 'protect', at: 3 }, { skill: 'raise', cost: 2 }, { skill: 'heal-all', cost: 2, requires: ['heal'] }, { skill: 'holy', cost: 3, requires: ['raise'] }],
    start: { weapon: 'oak-staff', armor: 'robe' },
  },
  rogue: {
    name: 'Rogue', about: 'the quick one: acts first, poisons, slows',
    base: st(26, 4, 9, 5, 4, 11), growth: st(5.5, 0.6, 2.0, 1.1, 0.6, 2.0),
    skills: [{ skill: 'poison-blade', at: 1 }, { skill: 'trip', at: 2 }, { skill: 'backstab', cost: 1 }, { skill: 'smoke', cost: 1 }],
    start: { weapon: 'dagger', armor: 'leather-armor' },
  },
  monk: {
    name: 'Monk', about: 'the fist: no gear, strong blows, heals itself',
    base: st(32, 4, 12, 6, 5, 8), growth: st(7.5, 0.5, 2.8, 1.3, 0.8, 1.4),
    skills: [{ skill: 'chakra', at: 1 }, { skill: 'flurry', at: 2 }, { skill: 'pressure-point', cost: 1 }, { skill: 'focus', cost: 1 }],
    start: { weapon: 'cestus', armor: 'gi' },
  },
});

export const SKILL_PRESETS = Object.freeze({
  // the front line
  'power-strike': { name: 'Power Strike', about: 'a heavy blow', mp: 0, target: 'foe', power: 2, stat: 'atk', scale: 1.4 },
  cleave: { name: 'Cleave', about: 'a sweep through every foe', mp: 3, target: 'foes', power: 0, stat: 'atk', scale: 0.9 },
  rally: { name: 'Rally', about: 'the party\'s attack rises for 3 rounds', mp: 0, target: 'allies', buff: { stat: 'atk', pct: 0.25, rounds: 3 } },
  berserk: { name: 'Berserk', about: 'its own attack rises sharply for 4 rounds', mp: 0, target: 'self', buff: { stat: 'atk', pct: 0.6, rounds: 4 } },
  'guard-up': { name: 'Guard Up', about: 'its own defence rises for 3 rounds', mp: 0, target: 'self', buff: { stat: 'def', pct: 0.6, rounds: 3 } },
  'shield-bash': { name: 'Shield Bash', about: 'a blow that may stun (sleep 1 round)', mp: 2, target: 'foe', power: 1, stat: 'atk', scale: 0.9, status: { is: 'sleep', chance: 0.4, rounds: 1 } },
  'holy-blade': { name: 'Holy Blade', about: 'a light-element blow', mp: 4, target: 'foe', power: 4, stat: 'atk', scale: 1.3, element: 'light' },
  // magic
  fire: { name: 'Fire', about: 'fire on one foe', mp: 3, target: 'foe', power: 6, stat: 'mag', scale: 0.8, element: 'fire', carry: true },
  blizzard: { name: 'Blizzard', about: 'ice on one foe', mp: 3, target: 'foe', power: 6, stat: 'mag', scale: 0.8, element: 'ice' },
  thunder: { name: 'Thunder', about: 'thunder on one foe', mp: 4, target: 'foe', power: 8, stat: 'mag', scale: 0.8, element: 'thunder' },
  firestorm: { name: 'Firestorm', about: 'fire on every foe', mp: 8, target: 'foes', power: 6, stat: 'mag', scale: 0.7, element: 'fire' },
  sleep: { name: 'Sleep', about: 'puts one foe to sleep', mp: 3, target: 'foe', status: { is: 'sleep', chance: 0.75, rounds: 3 } },
  focus: { name: 'Focus', about: 'its own magic rises for 3 rounds', mp: 0, target: 'self', buff: { stat: 'mag', pct: 0.5, rounds: 3 } },
  // healing
  heal: { name: 'Heal', about: 'restores one ally\'s HP', mp: 3, target: 'ally', power: 10, stat: 'mag', scale: 1.1, heal: true, carry: true },
  'heal-all': { name: 'Heal All', about: 'restores the whole party\'s HP', mp: 8, target: 'allies', power: 8, stat: 'mag', scale: 0.8, heal: true },
  cure: { name: 'Cure', about: 'ends poison, sleep and silence', mp: 2, target: 'ally', cure: ['poison', 'sleep', 'silence'] },
  raise: { name: 'Raise', about: 'revives a fallen ally', mp: 8, target: 'ally', revive: true },
  protect: { name: 'Protect', about: 'one ally\'s defence rises for 4 rounds', mp: 3, target: 'ally', buff: { stat: 'def', pct: 0.5, rounds: 4 } },
  holy: { name: 'Holy', about: 'holy light on one foe', mp: 6, target: 'foe', power: 12, stat: 'mag', scale: 1, element: 'light' },
  // the quick ones
  'poison-blade': { name: 'Poison Blade', about: 'a cut that may poison', mp: 0, target: 'foe', power: 0, stat: 'atk', scale: 0.8, status: { is: 'poison', chance: 0.6 } },
  trip: { name: 'Trip', about: 'one foe\'s speed falls for 3 rounds', mp: 0, target: 'foe', buff: { stat: 'spd', pct: -0.4, rounds: 3 } },
  backstab: { name: 'Backstab', about: 'a precise, heavy cut', mp: 2, target: 'foe', power: 4, stat: 'atk', scale: 1.5 },
  smoke: { name: 'Smoke', about: 'every foe may be silenced', mp: 2, target: 'foes', status: { is: 'silence', chance: 0.6, rounds: 3 } },
  // the fist
  chakra: { name: 'Chakra', about: 'restores its own HP and ends poison', mp: 0, target: 'self', power: 8, stat: 'mag', scale: 1, heal: true, cure: ['poison'] },
  flurry: { name: 'Flurry', about: 'a rain of blows on one foe', mp: 3, target: 'foe', power: 3, stat: 'atk', scale: 1.6 },
  'pressure-point': { name: 'Pressure Point', about: 'one foe\'s defence falls for 3 rounds', mp: 0, target: 'foe', buff: { stat: 'def', pct: -0.4, rounds: 3 } },
  // what foes use
  bite: { name: 'Bite', mp: 0, target: 'foe', power: 2, stat: 'atk', scale: 1.1 },
  venom: { name: 'Venom', mp: 0, target: 'foe', power: 0, stat: 'atk', scale: 0.6, status: { is: 'poison', chance: 0.7 } },
  howl: { name: 'Howl', mp: 0, target: 'self', buff: { stat: 'atk', pct: 0.4, rounds: 3 } },
  spores: { name: 'Spores', mp: 4, target: 'foes', status: { is: 'sleep', chance: 0.4, rounds: 2 } },
  'dark-bolt': { name: 'Dark Bolt', mp: 3, target: 'foe', power: 7, stat: 'mag', scale: 0.8, element: 'dark' },
  'fire-breath': { name: 'Fire Breath', mp: 6, target: 'foes', power: 8, stat: 'mag', scale: 0.7, element: 'fire' },
  mend: { name: 'Mend', mp: 4, target: 'ally', power: 12, stat: 'mag', scale: 0.8, heal: true },
});

const drop = (item, chance) => Object.freeze({ item, chance });

export const FOE_PRESETS = Object.freeze({
  slime: { name: 'Slime', hp: 14, atk: 7, def: 3, mag: 2, spd: 4, xp: 4, gold: 3, weak: ['fire'], drops: [drop('potion', 0.2)] },
  bat: { name: 'Bat', hp: 11, atk: 7, def: 2, mag: 2, spd: 12, xp: 4, gold: 2, weak: ['thunder'], skills: ['bite'] },
  wolf: { name: 'Wolf', hp: 20, atk: 9, def: 4, mag: 2, spd: 9, xp: 6, gold: 4, weak: ['fire'], skills: ['bite', 'howl'] },
  goblin: { name: 'Goblin', hp: 22, atk: 9, def: 5, mag: 3, spd: 7, xp: 7, gold: 8, drops: [drop('potion', 0.3)] },
  spider: { name: 'Cave Spider', hp: 18, atk: 8, def: 4, mag: 4, spd: 8, xp: 6, gold: 4, weak: ['fire'], skills: ['venom'], drops: [drop('antidote', 0.3)] },
  shroom: { name: 'Fungoid', hp: 24, mp: 12, atk: 7, def: 5, mag: 6, spd: 3, xp: 7, gold: 5, weak: ['fire'], resist: ['ice'], skills: ['spores'], drops: [drop('ether', 0.15)] },
  skeleton: { name: 'Skeleton', hp: 30, atk: 12, def: 7, mag: 3, spd: 6, xp: 11, gold: 9, weak: ['light', 'fire'], absorb: ['dark'], immune: ['poison', 'sleep'], drops: [drop('feather', 0.1)] },
  bandit: { name: 'Bandit', hp: 28, atk: 11, def: 6, mag: 3, spd: 10, xp: 10, gold: 18, skills: ['venom'], drops: [drop('potion', 0.4), drop('firebomb', 0.15)] },
  wisp: { name: 'Wisp', hp: 20, mp: 30, atk: 5, def: 9, mag: 12, spd: 9, xp: 12, gold: 10, weak: ['light'], resist: ['fire', 'ice', 'thunder'], absorb: ['dark'], skills: ['dark-bolt'] },
  golem: { name: 'Stone Golem', hp: 55, atk: 15, def: 14, mag: 2, spd: 2, xp: 18, gold: 15, cp: 2, weak: ['thunder'], resist: ['fire', 'ice'], immune: ['poison', 'sleep'] },
  shaman: { name: 'Goblin Shaman', hp: 26, mp: 30, atk: 7, def: 5, mag: 10, spd: 7, xp: 12, gold: 14, skills: ['mend', 'dark-bolt'], drops: [drop('ether', 0.3)] },
  drake: { name: 'Ember Drake', hp: 160, mp: 60, atk: 17, def: 10, mag: 13, spd: 8, xp: 80, gold: 120, cp: 5, weak: ['ice'], absorb: ['fire'], immune: ['sleep', 'poison'], skills: ['fire-breath', 'bite'], boss: true, drops: [drop('hi-potion', 1)] },
});

export const ITEM_PRESETS = Object.freeze({
  potion: { name: 'Potion', heal: 30, target: 'ally' },
  'hi-potion': { name: 'Hi-Potion', heal: 90, target: 'ally' },
  ether: { name: 'Ether', mp: 15, target: 'ally' },
  antidote: { name: 'Antidote', cure: ['poison'], target: 'ally' },
  remedy: { name: 'Remedy', cure: ['poison', 'sleep', 'silence'], target: 'ally' },
  feather: { name: 'Revival Feather', revive: true, target: 'ally' },
  firebomb: { name: 'Firebomb', hurt: 25, element: 'fire', target: 'foes' },
});

export const GEAR_SLOTS = Object.freeze(['weapon', 'armor', 'accessory']);
const BLADES = ['fighter', 'knight', 'rogue'], CASTERS = ['mage', 'cleric'], HEAVY = ['fighter', 'knight'];
export const GEAR_PRESETS = Object.freeze({
  'bronze-sword': { name: 'Bronze Sword', slot: 'weapon', atk: 4, classes: BLADES },
  'iron-sword': { name: 'Iron Sword', slot: 'weapon', atk: 9, classes: BLADES },
  dagger: { name: 'Dagger', slot: 'weapon', atk: 3, spd: 2, classes: ['rogue', 'fighter', 'mage'] },
  'oak-staff': { name: 'Oak Staff', slot: 'weapon', atk: 1, mag: 3, classes: CASTERS },
  'silver-staff': { name: 'Silver Staff', slot: 'weapon', atk: 2, mag: 7, classes: CASTERS },
  cestus: { name: 'Cestus', slot: 'weapon', atk: 4, classes: ['monk'] },
  'leather-armor': { name: 'Leather Armor', slot: 'armor', def: 3 },
  'chain-mail': { name: 'Chain Mail', slot: 'armor', def: 6, spd: -1, classes: HEAVY },
  robe: { name: 'Robe', slot: 'armor', def: 2, mag: 2 },
  gi: { name: 'Gi', slot: 'armor', def: 3, spd: 1, classes: ['monk'] },
  'swift-ring': { name: 'Swift Ring', slot: 'accessory', spd: 3 },
  'mana-charm': { name: 'Mana Charm', slot: 'accessory', mp: 8 },
});
