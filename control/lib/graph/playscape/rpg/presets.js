/**
 * THE STARTER BOOK — classes, skills, foes and battle items a world may name without defining them. A world's own
 * definition under the same id takes the preset's place whole; anything it leaves out it does not get. These are
 * conventions of the genre (a frontline fighter, a caster, a healer, a thief…), never any one game's.
 *
 *   CLASS_PRESETS   id → { name, about, base, growth, skills: [{ skill, at } | { skill, cost, requires? }] }
 *                   at: the class rank the skill comes at (learned for good); cost: class points on the tree
 *   SKILL_PRESETS   id → { name, about, mp, target, power?, stat?, scale?, element?, heal?, revive?, cure?, status?, buff?, carry? }
 *   FOE_PRESETS     id → { name, hp, mp?, atk, def, mag, spd, xp, gold, cp?, weak?, resist?, absorb?, immune?, skills?, drops?, boss? }
 *   ITEM_PRESETS    id → { name, price, heal?, mp?, revive?, cure?, hurt?, element?, target }
 *   GEAR_PRESETS    id → { name, price, slot: weapon | armor | accessory, atk?, def?, mag?, spd?, hp?, mp?, classes? }
 *                   price: the gold a shop asks for it (playscape/rpg/rpg.js shops); it buys back at half
 *                   worn by one member in its slot, its numbers added to theirs; classes: who may wear it (any, unnamed)
 *   GEAR_SLOTS      the slots, in the order the party menu lists them
 *   a class's `start`: { <slot>: gear } what a member of it wears when the party starts
 *   ELEMENTS        the element words the presets use (any lower-case word is an element)
 *
 * Numbers are tuned so a party of three at level 1 beats a pack of three starters with a potion or two to spare, and
 * the boss wants level 5 and its weakness.
 */

export const ELEMENTS = Object.freeze(['fire', 'ice', 'thunder', 'light', 'dark']);

/**
 * STATE_PRESETS — states a world may name without defining them (beside poison, sleep and silence, the kernel's own),
 * each by what it does (rpg.js readState): `skip` its turns lost, `noCast` no skill that costs MP, `miss` a share of its
 * blows go wide, `wild` its blows and spells at anyone at all, `tick` a share of its HP each turn (below 0 it hurts),
 * `wake: 'hit'` a blow ends it, `rounds` how long it lasts. `said`: how a line names one in it ("is paralysed").
 */
export const STATE_PRESETS = Object.freeze({
  paralysis: Object.freeze({ name: 'Paralysis', said: 'paralysed', rounds: 2, skip: true }),
  blind: Object.freeze({ name: 'Blindness', said: 'blinded', rounds: 3, miss: 0.5 }),
  confusion: Object.freeze({ name: 'Confusion', said: 'confused', rounds: 3, wild: true, wake: 'hit' }),
  burn: Object.freeze({ name: 'Burn', said: 'burning', rounds: 3, tick: -0.08 }),
  regen: Object.freeze({ name: 'Regen', said: 'regenerating', rounds: 4, tick: 0.08 }),
  // (what a state may do beside: its bearer's numbers, the damage it takes, a frenzy, a mirror, a lure, a countdown)
  haste: Object.freeze({ name: 'Haste', said: 'hasted', rounds: 4, stats: Object.freeze({ spd: 1.5 }) }),
  slow: Object.freeze({ name: 'Slow', said: 'slowed', rounds: 4, stats: Object.freeze({ spd: 0.6 }) }),
  barrier: Object.freeze({ name: 'Barrier', said: 'shielded', rounds: 4, takes: Object.freeze({ blow: 0.6 }) }),
  shell: Object.freeze({ name: 'Shell', said: 'shelled', rounds: 4, takes: Object.freeze({ spell: 0.6 }) }),
  berserk: Object.freeze({ name: 'Berserk', said: 'berserk', rounds: 3, berserk: true, stats: Object.freeze({ atk: 1.5 }) }),
  reflect: Object.freeze({ name: 'Reflect', said: 'reflecting', rounds: 3, reflect: true }),
  taunt: Object.freeze({ name: 'Taunt', said: 'taunting', rounds: 3, taunt: true }),
  doom: Object.freeze({ name: 'Doom', said: 'doomed', rounds: 5, doom: true, stack: 'keep' }),
  // (a reaction a state carries: a second life, spent as it is used)
  reraise: Object.freeze({ name: 'Reraise', said: 'blessed', rounds: 9, revive: 0.3, stack: 'keep' }),
});

const st = (hp, mp, atk, def, mag, spd) => Object.freeze({ hp, mp, atk, def, mag, spd });

export const CLASS_PRESETS = Object.freeze({
  fighter: {
    name: 'Fighter', about: 'the front line: hits hard, takes hits, no magic',
    base: st(34, 0, 11, 8, 2, 6), growth: st(8, 0, 2.6, 1.8, 0.3, 0.9),
    skills: [{ skill: 'power-strike', at: 1 }, { skill: 'cleave', at: 3 }, { skill: 'rally', cost: 1 }, { skill: 'berserk', cost: 2, requires: ['rally'] }, { skill: 'armor-pierce', cost: 2 }, { skill: 'twin-cut', cost: 2, requires: ['power-strike'] }, { skill: 'blood-blade', cost: 2, requires: ['power-strike'] }],
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
    skills: [{ skill: 'fire', at: 1 }, { skill: 'blizzard', at: 2 }, { skill: 'thunder', at: 3 }, { skill: 'sleep', cost: 1 }, { skill: 'firestorm', cost: 2, requires: ['fire'] }, { skill: 'focus', cost: 1 }, { skill: 'drain', cost: 1 }, { skill: 'osmose', cost: 1 }, { skill: 'gravity', cost: 2, requires: ['drain'] }, { skill: 'meteor', cost: 3, requires: ['firestorm'] }],
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
    skills: [{ skill: 'poison-blade', at: 1 }, { skill: 'trip', at: 2 }, { skill: 'backstab', cost: 1 }, { skill: 'smoke', cost: 1 }, { skill: 'steal', cost: 1 }, { skill: 'mug', cost: 2, requires: ['steal'] }],
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
  // (EFFECTS, rpg.js readSkill: a theft, a theft with a blow, two cuts, a blow through armour, a draining spell, gravity)
  steal: { name: 'Steal', about: 'takes what a foe carries', mp: 0, target: 'foe', steal: true },
  mug: { name: 'Mug', about: 'a cut that takes what a foe carries', mp: 2, target: 'foe', power: 0, stat: 'atk', scale: 1, steal: true },
  'twin-cut': { name: 'Twin Cut', about: 'two quick cuts', mp: 3, target: 'foe', power: 0, stat: 'atk', scale: 0.7, hits: 2 },
  'armor-pierce': { name: 'Armor Pierce', about: 'a thrust that ignores armour', mp: 3, target: 'foe', power: 2, stat: 'atk', scale: 0.9, damage: 'pierce' },
  drain: { name: 'Drain', about: 'takes HP from a foe', mp: 5, target: 'foe', power: 6, stat: 'mag', scale: 0.7, drain: 0.5, element: 'dark' },
  gravity: { name: 'Gravity', about: 'a quarter of a foe\'s HP, whatever its guard', mp: 8, target: 'foe', power: 0.25, damage: 'gravity' },
  // (the states' own casts: time, wards, a mirror, a lure, a frenzy, a countdown; a world's to put on a class's tree or
  // grant, never on the presets' trees, so a world that names none carries no states)
  haste: { name: 'Haste', about: 'an ally acts more often', mp: 5, target: 'ally', status: { is: 'haste' } },
  slow: { name: 'Slow', about: 'a foe acts less often', mp: 4, target: 'foe', status: { is: 'slow', chance: 0.7 } },
  barrier: { name: 'Barrier', about: 'an ally takes less from blows', mp: 4, target: 'ally', status: { is: 'barrier' } },
  shell: { name: 'Shell', about: 'an ally takes less from spells', mp: 4, target: 'ally', status: { is: 'shell' } },
  reflect: { name: 'Reflect', about: 'spells at an ally turn back on their caster', mp: 6, target: 'ally', status: { is: 'reflect' } },
  provoke: { name: 'Provoke', about: 'draws the foes\' blows to itself', mp: 0, target: 'self', status: { is: 'taunt' } },
  frenzy: { name: 'Frenzy', about: 'an ally fights in a rage: stronger, past commanding', mp: 3, target: 'ally', status: { is: 'berserk' } },
  doom: { name: 'Doom', about: 'a foe falls when the count runs out', mp: 8, target: 'foe', status: { is: 'doom', chance: 0.6 } },
  // (COSTS beside the MP: a blow paid in blood, a spell that rests after, limit breaks a full gauge lets go)
  'blood-blade': { name: 'Blood Blade', about: 'a heavy cut paid for in its own HP', mp: 0, hpCost: 12, target: 'foe', power: 6, stat: 'atk', scale: 1.8 },
  meteor: { name: 'Meteor', about: 'stones from the sky on every foe; it rests three turns after', mp: 12, cooldown: 3, target: 'foes', power: 14, stat: 'mag', scale: 1.1 },
  braver: { name: 'Braver', about: 'a limit break: a leaping cut', mp: 0, limit: true, target: 'foe', power: 12, stat: 'atk', scale: 2.6 },
  'healing-wind': { name: 'Healing Wind', about: 'a limit break: every ally mended', mp: 0, limit: true, target: 'allies', power: 30, stat: 'mag', scale: 1.2, heal: true },
  reraise: { name: 'Reraise', about: 'an ally rises again once if it falls', mp: 12, target: 'ally', status: { is: 'reraise' } },
  osmose: { name: 'Osmose', about: 'draws MP from a foe', mp: 0, target: 'foe', power: 4, stat: 'mag', scale: 0.4, damage: 'mp', drain: 1 },
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
  // what the story's bosses use (gameworld/round-bosses.js)
  'tidal-wave': { name: 'Tidal Wave', mp: 6, target: 'foes', power: 8, stat: 'mag', scale: 0.7, element: 'ice' },
  gale: { name: 'Gale', mp: 6, target: 'foes', power: 8, stat: 'mag', scale: 0.7, element: 'thunder' },
  quake: { name: 'Quake', mp: 0, target: 'foes', power: 8, stat: 'atk', scale: 0.9 },
  'war-cry': { name: 'War Cry', mp: 0, target: 'self', buff: { stat: 'atk', pct: 0.4, rounds: 3 } },
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
  zombie: { name: 'Zombie', hp: 34, atk: 11, def: 5, mag: 2, spd: 3, xp: 10, gold: 6, weak: ['fire', 'light'], absorb: ['dark'], immune: ['poison', 'sleep'], skills: ['bite'], drops: [drop('antidote', 0.25)] },
  bandit: { name: 'Bandit', hp: 28, atk: 11, def: 6, mag: 3, spd: 10, xp: 10, gold: 18, skills: ['venom'], drops: [drop('potion', 0.4), drop('firebomb', 0.15)] },
  wisp: { name: 'Wisp', hp: 20, mp: 30, atk: 5, def: 9, mag: 12, spd: 9, xp: 12, gold: 10, weak: ['light'], resist: ['fire', 'ice', 'thunder'], absorb: ['dark'], skills: ['dark-bolt'] },
  golem: { name: 'Stone Golem', hp: 55, atk: 15, def: 14, mag: 2, spd: 2, xp: 18, gold: 15, cp: 2, weak: ['thunder'], resist: ['fire', 'ice'], immune: ['poison', 'sleep'] },
  shaman: { name: 'Goblin Shaman', hp: 26, mp: 30, atk: 7, def: 5, mag: 10, spd: 7, xp: 12, gold: 14, skills: ['mend', 'dark-bolt'], drops: [drop('ether', 0.3)] },
  // (the boss, tuned to the party the ladder (gameworld/battles.js PACKS) brings to it, walked for real: a careful party wins it, a
  // careless one mostly falls, held so by gameworld/boss-law.test.js. Its breath is telegraphed: every third turn it
  // gathers its fire a turn first, then lets it go at twice its power. Under half its HP it takes its second form: its
  // scales blaze, it drinks the cold that hurt it and fears the storm, it bites harder and breathes every second turn)
  drake: {
    name: 'Ember Drake', hp: 800, mp: 80, atk: 26, def: 10, mag: 24, spd: 8, xp: 80, gold: 120, cp: 5, weak: ['ice'], absorb: ['fire'], immune: ['gravity', 'doom', 'sleep', 'poison'], skills: ['fire-breath', 'bite'], boss: true, drops: [drop('hi-potion', 1)],
    pattern: [
      { use: 'bite', weight: 4 }, { use: 'attack', weight: 3 },
      { use: 'fire-breath', when: { every: 3 }, charge: '{name} gathers its fire…', weight: 9 },
    ],
    phases: [{
      below: 0.5, say: '{name}\'s scales blaze white-hot!', weak: ['thunder'], absorb: ['fire', 'ice'], atk: 30, mag: 28,
      pattern: [{ use: 'bite', weight: 4 }, { use: 'attack', weight: 3 }, { use: 'fire-breath', when: { every: 2 }, charge: '{name} gathers its fire…', weight: 9 }],
    }],
  },
  // THE STORY'S BOSSES (gameworld/round-bosses.js: the climax each kind of story calls for), each held to the boss law
  // like the drake (gameworld/boss-law.deep.test.js): a charged blow telegraphed, and a second form under half its HP
  // that turns its weaknesses round. A world writes each out whole in its battles (`battles.foes.<id>`) to edit.
  leviathan: {
    name: 'Leviathan', hp: 720, mp: 90, atk: 24, def: 12, mag: 21, spd: 9, xp: 80, gold: 120, cp: 5, weak: ['thunder'], absorb: ['ice'], immune: ['gravity', 'doom', 'sleep', 'poison'], skills: ['tidal-wave', 'bite'], boss: true, drops: [drop('hi-potion', 1)],
    pattern: [{ use: 'bite', weight: 4 }, { use: 'attack', weight: 3 }, { use: 'tidal-wave', when: { every: 3 }, charge: 'The sea rises behind {name}…', weight: 9 }],
    phases: [{ below: 0.5, say: '{name} sheds its frozen scales!', weak: ['fire'], absorb: ['ice', 'thunder'], mag: 26,
      pattern: [{ use: 'bite', weight: 4 }, { use: 'attack', weight: 3 }, { use: 'tidal-wave', when: { every: 2 }, charge: 'The sea rises behind {name}…', weight: 9 }] }],
  },
  champion: {
    name: 'The Champion', hp: 540, mp: 40, atk: 21, def: 14, mag: 8, spd: 10, xp: 80, gold: 160, cp: 5, immune: ['gravity', 'doom', 'sleep'], skills: ['power-strike', 'shield-bash'], boss: true, drops: [drop('hi-potion', 1)],
    pattern: [{ use: 'attack', weight: 4 }, { use: 'power-strike', weight: 3 }, { use: 'shield-bash', weight: 2 }, { use: 'power-strike', when: { every: 3 }, charge: '{name} raises the blade high…', weight: 9 }],
    phases: [{ below: 0.5, say: '{name} casts the shield aside!', def: 8, atk: 25, spd: 14,
      pattern: [{ use: 'attack', weight: 3 }, { use: 'power-strike', weight: 4 }, { use: 'cleave', when: { every: 3 }, charge: '{name} sets both hands to the blade…', weight: 9 }] }],
  },
  warlord: {
    name: 'The Warlord', hp: 950, mp: 40, atk: 30, def: 12, mag: 6, spd: 7, xp: 80, gold: 140, cp: 5, weak: ['fire'], immune: ['gravity', 'doom', 'sleep'], skills: ['cleave', 'war-cry'], boss: true, drops: [drop('hi-potion', 1)],
    pattern: [{ use: 'attack', weight: 4 }, { use: 'war-cry', when: { turn: 1 } }, { use: 'cleave', when: { every: 3 }, charge: '{name} hefts the great axe…', weight: 9 }],
    phases: [{ below: 0.5, say: '{name} roars, and the fire no longer bites!', weak: ['thunder'], resist: ['fire'], atk: 34,
      pattern: [{ use: 'attack', weight: 4 }, { use: 'war-cry', when: { every: 4 }, weight: 9 }, { use: 'cleave', when: { every: 2 }, charge: '{name} hefts the great axe…', weight: 9 }] }],
  },
  roc: {
    name: 'Thunderbird', hp: 700, mp: 90, atk: 22, def: 10, mag: 22, spd: 10, xp: 80, gold: 120, cp: 5, weak: ['ice'], absorb: ['thunder'], immune: ['gravity', 'doom', 'sleep', 'poison'], skills: ['gale', 'bite'], boss: true, drops: [drop('hi-potion', 1)],
    pattern: [{ use: 'bite', weight: 4 }, { use: 'attack', weight: 3 }, { use: 'gale', when: { every: 3 }, charge: '{name} spreads its wings as the sky darkens…', weight: 9 }],
    phases: [{ below: 0.5, say: 'Lightning crackles through {name}\'s feathers!', weak: ['fire'], absorb: ['thunder', 'ice'], spd: 12, mag: 25,
      pattern: [{ use: 'bite', weight: 4 }, { use: 'attack', weight: 3 }, { use: 'gale', when: { every: 2 }, charge: '{name} spreads its wings as the sky darkens…', weight: 9 }] }],
  },
  colossus: {
    name: 'The Colossus', hp: 900, mp: 0, atk: 30, def: 20, mag: 4, spd: 6, xp: 80, gold: 120, cp: 5, weak: ['thunder'], resist: ['fire', 'ice'], immune: ['gravity', 'doom', 'sleep', 'poison'], skills: ['quake'], boss: true, drops: [drop('hi-potion', 1)],
    pattern: [{ use: 'attack', weight: 5 }, { use: 'quake', when: { every: 3 }, charge: 'The ground trembles as {name} rises…', weight: 9 }],
    phases: [{ below: 0.5, say: '{name}\'s crystal core lies bare!', def: 8, spd: 8, weak: ['fire', 'ice'], resist: ['thunder'],
      pattern: [{ use: 'attack', weight: 5 }, { use: 'quake', when: { every: 2 }, charge: 'The ground trembles as {name} rises…', weight: 9 }] }],
  },
});

export const ITEM_PRESETS = Object.freeze({
  potion: { name: 'Potion', price: 8, heal: 30, target: 'ally' },
  'hi-potion': { name: 'Hi-Potion', price: 30, heal: 90, target: 'ally' },
  ether: { name: 'Ether', price: 20, mp: 15, target: 'ally' },
  antidote: { name: 'Antidote', price: 6, cure: ['poison'], target: 'ally' },
  remedy: { name: 'Remedy', price: 18, cure: ['poison', 'sleep', 'silence'], target: 'ally' },
  feather: { name: 'Revival Feather', price: 40, revive: true, target: 'ally' },
  firebomb: { name: 'Firebomb', price: 15, hurt: 25, element: 'fire', target: 'foes' },
  // (an item that leaves a status on the foes, or gives an ally a buff)
  'sleep-powder': { name: 'Sleep Powder', price: 30, status: { is: 'sleep', chance: 0.6, rounds: 2 }, target: 'foes' },
  'smoke-bomb': { name: 'Smoke Bomb', price: 25, status: { is: 'silence', chance: 0.7, rounds: 3 }, target: 'foes' },
  'power-tonic': { name: 'Power Tonic', price: 35, buff: { stat: 'atk', pct: 0.3, rounds: 3 }, target: 'ally' },
});

export const GEAR_SLOTS = Object.freeze(['weapon', 'armor', 'accessory']);
const BLADES = ['fighter', 'knight', 'rogue'], CASTERS = ['mage', 'cleric'], HEAVY = ['fighter', 'knight'];
export const GEAR_PRESETS = Object.freeze({
  'bronze-sword': { name: 'Bronze Sword', price: 25, slot: 'weapon', atk: 4, classes: BLADES },
  'iron-sword': { name: 'Iron Sword', price: 70, slot: 'weapon', atk: 9, classes: BLADES },
  dagger: { name: 'Dagger', price: 18, slot: 'weapon', atk: 3, spd: 2, classes: ['rogue', 'fighter', 'mage'] },
  'oak-staff': { name: 'Oak Staff', price: 22, slot: 'weapon', atk: 1, mag: 3, classes: CASTERS },
  'silver-staff': { name: 'Silver Staff', price: 65, slot: 'weapon', atk: 2, mag: 7, classes: CASTERS },
  cestus: { name: 'Cestus', price: 24, slot: 'weapon', atk: 4, classes: ['monk'] },
  'leather-armor': { name: 'Leather Armor', price: 20, slot: 'armor', def: 3 },
  'chain-mail': { name: 'Chain Mail', price: 60, slot: 'armor', def: 6, spd: -1, classes: HEAVY },
  robe: { name: 'Robe', price: 18, slot: 'armor', def: 2, mag: 2 },
  gi: { name: 'Gi', price: 22, slot: 'armor', def: 3, spd: 1, classes: ['monk'] },
  'swift-ring': { name: 'Swift Ring', price: 55, slot: 'accessory', spd: 3 },
  'mana-charm': { name: 'Mana Charm', price: 50, slot: 'accessory', mp: 8 },
  // (gear with TRAITS, rpg.js readTraits: what a blow carries, a rate, a skill granted)
  'venom-dagger': { name: 'Venom Dagger', price: 80, slot: 'weapon', atk: 5, spd: 1, classes: ['rogue', 'fighter', 'mage'], inflict: { is: 'poison', chance: 0.3 } },
  'flame-sword': { name: 'Flame Sword', price: 150, slot: 'weapon', atk: 10, classes: BLADES, element: 'fire' },
  'hunter-charm': { name: 'Hunter\'s Charm', price: 90, slot: 'accessory', hit: 0.05, crit: 0.08 },
  'shadow-cloak': { name: 'Shadow Cloak', price: 85, slot: 'armor', def: 3, eva: 0.08 },
  'ember-ring': { name: 'Ember Ring', price: 120, slot: 'accessory', mag: 2, grants: ['fire'] },
  // (gear with a REACTION, rpg.js readReacts: a strike back, a step before an ally, a second life)
  'riposte-ring': { name: 'Riposte Ring', price: 140, slot: 'accessory', counter: 0.3 },
  'guardian-crest': { name: 'Guardian Crest', price: 110, slot: 'accessory', def: 2, cover: true },
  'phoenix-charm': { name: 'Phoenix Charm', price: 220, slot: 'accessory', revive: 0.25 },
});
