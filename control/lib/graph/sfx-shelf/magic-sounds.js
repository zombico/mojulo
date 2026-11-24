/**
 * sfx-shelf/magic-sounds — magic as a KIT, so spells, statuses and the world they change are heard by what they are:
 *
 *   ELEMENTS   each element by its phase and its tier: the cast gathering, then the blow landing as a bolt (minor), a
 *              burst (major) or a cataclysm (ultimate). The words games use for an element (`ELEMENT_WORDS`: lightning
 *              is thunder, holy is light, shadow is dark, frost is ice…) are one element here
 *   STATUSES   a status taken (poison, burn, freeze, paralysis, sleep, silence, confusion, blindness, stun, petrify,
 *              doom, regen, haste, slow, berserk, a barrier), and what every status shares (a stat raised, a stat lowered,
 *              a status cured, one wearing off, poison's tick)
 *   SPELLS     the spells that are no element's blow: a great heal, a revive, a drain, mana restored, a dispel, time
 *              stopped, the shelf's own (heal, buff, curse, teleport, summon)
 *   BATTLE     a battle's own moments: its start, a boss appearing, a critical hit, a weakness struck, a blow resisted, a
 *              foe dissolving, a level gained, a skill learned
 *   WORLD      what magic does to a world: a quake, the ground cracking, stone rising and sinking, lava erupting, a flood,
 *              ice spreading, vines growing, a portal opening and closing, a ward over the land, the sky darkening, dawn
 *              breaking; and the world held (lava, a portal's hum, an arcane aura, a poison bog)
 *
 * Every word is a shelf row (`MAGIC_ROWS`, roster.js lays them): a new one is `recorded`, heard as its `standIn` (the
 * nearest row the shelf synthesizes) until the sound library records it, so a page without the library hears what it
 * heard before; one with no stand-in is silent until then.
 *
 *   elementOf(word)                      the element a word names (ELEMENT_WORDS), or null
 *   elementSound(element, { phase?, tier? })   a shelf word: phase 'cast' | 'land' (default), tier minor | major | ultimate
 *   skillTier(skill)                     a skill's tier by its reach and power: every foe, or a big blow, is major
 *   skillSounds(skill)                   { cast?, land? }: an RPG skill (playscape/rpg/rpg.js's shape) heard as cast and as landed
 *   battleSounds(skills, { items? })     { order, ends: [[<rpg happening>, <word>]…], also: { crit, weak } }: an RPG battle's
 *                                        happenings (playscape/rpg/juice.js juiceKeys) by the kit, most specific first; a
 *                                        page plays the first of each lane its moment carries, the accents over them
 *   magicRecorded()                      whether the library records the kit (its fire bolt): a page asks before it plays it
 *
 * Pure but for magicRecorded (it reads the library's index); timeless.
 */
import { recordedFor } from '../sound-library/library.js';

const freeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

export const MAGIC_TIERS = Object.freeze(['minor', 'major', 'ultimate']);
const TIER_PHASE = Object.freeze({ minor: 'bolt', major: 'burst', ultimate: 'cataclysm' });

// each element: its category on the shelf, what it is made of, the row it is heard as until recorded, and its words
export const ELEMENTS = freeze({
  fire: { category: 'elemental', matter: ['fire'], standIn: 'fire-whoosh', words: ['flame', 'blaze', 'ember', 'pyro'] },
  ice: { category: 'elemental', matter: ['water', 'glass'], standIn: 'ice-crack', words: ['frost', 'cold', 'blizzard', 'cryo'] },
  thunder: { category: 'elemental', matter: ['electric'], standIn: 'lightning-strike', words: ['lightning', 'electric', 'shock', 'storm', 'volt'] },
  water: { category: 'elemental', matter: ['water'], standIn: 'water-splash', words: ['tide', 'aqua', 'hydro', 'wave'] },
  wind: { category: 'elemental', matter: ['air'], standIn: 'wind-gust', words: ['air', 'aero', 'gale', 'sky'] },
  earth: { category: 'elemental', matter: ['earth', 'stone'], standIn: 'stone-break', words: ['stone', 'rock', 'ground', 'quake', 'geo'] },
  light: { category: 'magic', matter: ['energy', 'glass'], standIn: 'spell-cast', words: ['holy', 'radiant', 'sun', 'divine'] },
  dark: { category: 'magic', matter: ['energy'], standIn: 'curse', words: ['shadow', 'void', 'necro', 'umbra'] },
  poison: { category: 'elemental', matter: ['water', 'creature'], standIn: null, words: ['venom', 'toxic', 'bio', 'acid'] },
  nature: { category: 'magic', matter: ['earth', 'wood'], standIn: 'nature-spell', words: ['wood', 'plant', 'forest', 'leaf', 'verdant'] },
  arcane: { category: 'magic', matter: ['energy'], standIn: 'spell-cast', words: ['arcana', 'mana', 'astral', 'force'] },
});
export const ELEMENT_NAMES = Object.freeze(Object.keys(ELEMENTS));
export const ELEMENT_WORDS = Object.freeze(Object.fromEntries(Object.entries(ELEMENTS).flatMap(([el, E]) => [[el, el], ...E.words.map((w) => [w, el])])));

export const STATUSES = freeze({
  poison: { label: 'poisoned: a sickly bubbling', standIn: 'curse' },
  burn: { label: 'set burning: a flare that clings', standIn: 'fire-whoosh' },
  freeze: { label: 'frozen solid: ice closing over', standIn: 'ice-crack' },
  paralysis: { label: 'paralysed: a crackling seize', standIn: 'lightning-strike' },
  sleep: { label: 'put to sleep: a soft drowsy shimmer', standIn: null },
  silence: { label: 'silenced: a muffled seal', standIn: null },
  confusion: { label: 'confused: a dizzy warble', standIn: null },
  blindness: { label: 'blinded: a dark flash', standIn: 'curse' },
  stun: { label: 'stunned: a ringing daze', standIn: null },
  petrify: { label: 'turned to stone: a grinding crust', standIn: 'stone-break' },
  doom: { label: 'doomed: a tolling countdown', standIn: 'curse' },
  regen: { label: 'regenerating: a gentle rising glow', standIn: 'heal' },
  haste: { label: 'hasted: a quick rising whoosh', standIn: 'buff' },
  slow: { label: 'slowed: a falling, dragging warp', standIn: 'curse' },
  berserk: { label: 'berserk: a red roaring surge', standIn: 'buff' },
  barrier: { label: 'a barrier raised: a shimmering dome', standIn: 'shield-up' },
});
export const STATUS_NAMES = Object.freeze(Object.keys(STATUSES));
// the words a game says for a status
export const STATUS_WORDS = Object.freeze({ poison: 'poison', venom: 'poison', burn: 'burn', burning: 'burn', blaze: 'burn', freeze: 'freeze', frozen: 'freeze', ice: 'freeze',
  paralysis: 'paralysis', paralyze: 'paralysis', shock: 'paralysis', sleep: 'sleep', silence: 'silence', mute: 'silence', confusion: 'confusion', confuse: 'confusion',
  blind: 'blindness', blindness: 'blindness', stun: 'stun', petrify: 'petrify', stone: 'petrify', doom: 'doom', regen: 'regen', haste: 'haste', slow: 'slow',
  berserk: 'berserk', barrier: 'barrier', shield: 'barrier', protect: 'barrier', ward: 'barrier' });

// what every status shares
export const STATUS_SHARED = Object.freeze({ up: 'stat-up', down: 'stat-down', cure: 'status-cure', fade: 'status-fade', tick: 'poison-tick', shift: 'status-shift' });
export const SPELLS = Object.freeze({ heal: 'heal', healMajor: 'heal-major', revive: 'revive', drain: 'life-drain', mana: 'mana-restore', dispel: 'dispel', timeStop: 'time-stop',
  buff: 'buff', curse: 'curse', teleport: 'teleport', summon: 'summon' });
export const BATTLE = Object.freeze({ start: 'battle-start', boss: 'boss-appear', crit: 'critical-hit', weak: 'weakness-hit', resist: 'resisted', dissolve: 'foe-dissolve',
  level: 'level-up-sting', learn: 'skill-learn' });
export const WORLD = Object.freeze({ quake: 'earthquake', crack: 'ground-crack', rise: 'stone-rise', sink: 'stone-sink', lava: 'lava-eruption', flood: 'flood-surge',
  freeze: 'ice-spread', grow: 'vines-grow', portalOpen: 'portal-open', portalClose: 'portal-close', ward: 'ward-dome', darken: 'sky-darken', dawn: 'dawn-swell' });
export const WORLD_HELD = Object.freeze({ lava: 'lava-flow', portal: 'portal-hum', aura: 'arcane-aura', bog: 'poison-bog' });

// ── the rows (roster.js lays each as a `recorded` row) ──
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
const row = (id, category, slot, label, aliases, matter, standIn = null) => ({ id, category, slot, label, aliases, matter, standIn });
const elementRows = Object.entries(ELEMENTS).flatMap(([el, E]) => [
  row(`${el}-cast`, 'magic', 'on', `a ${el} spell gathering`, [`${el} cast`, `${el} charge`, `${el} spell cast`], E.matter, 'spell-cast'),
  row(`${el}-bolt`, E.category, 'on', `a ${el} spell landing on one: a bolt (the minor tier)`, [`${el} bolt`, `${el} spell bolt`, `${el} minor spell`], E.matter, E.standIn),
  row(`${el}-burst`, E.category, 'on', `a ${el} spell bursting over many (the major tier)`, [`${el} burst`, `${el} blast`, `${el} wave`], E.matter, E.standIn),
  row(`${el}-cataclysm`, E.category, 'on', `${cap(el)} unleashed: a cataclysm (the ultimate tier)`, [`${el} cataclysm`, `${el} ultimate`, `${el} storm spell`], E.matter, E.standIn),
]);
const statusRows = Object.entries(STATUSES).map(([s, S]) => row(`status-${s}`, 'magic', 'on', `a status taken: ${S.label}`, [`${s} status`, `${s} inflicted`], ['energy'], S.standIn));
export const MAGIC_ROWS = Object.freeze([
  ...elementRows,
  ...statusRows,
  row('stat-up', 'magic', 'on', 'a stat raised: a bright rising chime', ['stat up', 'stat boost', 'power up spell'], ['energy'], 'buff'),
  row('stat-down', 'magic', 'on', 'a stat lowered: a dull falling tone', ['stat down', 'debuff', 'weaken'], ['energy'], 'curse'),
  row('status-cure', 'magic', 'on', 'a status cured: a cleansing sparkle', ['status cure', 'cleanse', 'esuna'], ['energy', 'glass'], 'heal'),
  row('status-fade', 'magic', 'on', 'a status wearing off: a soft fading shimmer', ['status fade', 'wears off', 'status ends'], ['energy']),
  row('poison-tick', 'magic', 'on', 'poison taking its toll: a small sickly pulse', ['poison tick', 'poison damage', 'dot tick'], ['water', 'creature']),
  row('status-shift', 'magic', 'on', 'a status changed: a neutral magical shimmer', ['status shift', 'status change', 'condition change'], ['energy']),
  row('heal-major', 'magic', 'on', 'a great heal: a warm swelling choir of light', ['heal major', 'great heal', 'heal all', 'curaga'], ['energy', 'glass'], 'heal'),
  row('revive', 'magic', 'on', 'a fallen ally revived: a rising radiant swell', ['raise', 'resurrect', 'phoenix'], ['energy', 'glass'], 'heal'),
  row('life-drain', 'magic', 'on', 'life drained: a dark pulling suck', ['life drain', 'drain', 'vampiric'], ['energy'], 'curse'),
  row('mana-restore', 'magic', 'on', 'mana restored: a cool rising shimmer', ['mana restore', 'ether', 'mp restore'], ['energy', 'glass'], 'heal'),
  row('dispel', 'magic', 'on', 'magic dispelled: a sharp unravelling', ['dispel', 'unravel', 'counterspell'], ['energy'], 'shield-break'),
  row('time-stop', 'magic', 'on', 'time stopped: a deep warping freeze', ['time stop', 'stop time', 'chronostasis'], ['energy']),
  row('battle-start', 'stinger', 'on', 'a battle beginning: a rushing swirl into the fight', ['battle start', 'encounter', 'battle transition'], ['air', 'energy']),
  row('boss-appear', 'stinger', 'on', 'a boss appearing: an ominous swelling boom', ['boss appear', 'boss intro', 'boss entrance'], ['energy']),
  row('critical-hit', 'impact', 'on', 'a critical hit: a sharp heavy crack', ['critical hit', 'crit', 'critical'], ['flesh', 'energy'], 'hit'),
  row('weakness-hit', 'impact', 'on', 'a weakness struck: a bright ringing accent', ['weakness hit', 'weak point', 'super effective'], ['energy']),
  row('resisted', 'impact', 'on', 'a blow resisted: a dull deflected thud', ['resisted', 'resist', 'ineffective'], ['energy']),
  row('foe-dissolve', 'magic', 'on', 'a foe dissolving away: a shimmering fade', ['foe dissolve', 'enemy fade', 'foe vanish'], ['energy']),
  row('level-up-sting', 'stinger', 'on', 'a level gained: a triumphant rising sparkle', ['level up sting', 'party level up', 'level gained'], ['energy', 'glass']),
  row('skill-learn', 'stinger', 'on', 'a skill learned: a bright ascending chime', ['skill learn', 'new skill', 'skill learned'], ['energy', 'glass']),
  row('earthquake', 'world', 'on', 'the ground quaking: a deep rumble and rattling', ['earthquake', 'quake', 'tremor'], ['earth', 'stone'], 'collapse'),
  row('ground-crack', 'world', 'on', 'the ground splitting open: a fissure tearing', ['ground crack', 'fissure', 'chasm open'], ['earth', 'stone'], 'stone-break'),
  row('stone-rise', 'world', 'on', 'stone rising from the ground: a grinding upheaval', ['stone rise', 'pillar rise', 'wall rise'], ['stone', 'earth'], 'stone-break'),
  row('stone-sink', 'world', 'on', 'stone sinking into the ground: a grinding descent', ['stone sink', 'pillar sink', 'wall sink'], ['stone', 'earth'], 'stone-break'),
  row('lava-eruption', 'world', 'on', 'lava erupting: a deep blast and molten spatter', ['lava eruption', 'eruption', 'volcano blast'], ['fire', 'earth'], 'fire-whoosh'),
  row('flood-surge', 'world', 'on', 'water flooding in: a rushing surge', ['flood surge', 'flood', 'tidal surge'], ['water'], 'water-splash'),
  row('ice-spread', 'world', 'on', 'ice spreading over the ground: a crackling freeze', ['ice spread', 'freeze over', 'frost spread'], ['water', 'glass'], 'ice-crack'),
  row('vines-grow', 'world', 'on', 'vines growing fast: creaking, rustling growth', ['vines grow', 'overgrowth', 'roots rise'], ['wood', 'earth'], 'nature-spell'),
  row('portal-open', 'world', 'on', 'a portal opening: a swirling rising whoosh', ['portal open', 'rift open', 'portal opening'], ['energy', 'air'], 'teleport'),
  row('portal-close', 'world', 'on', 'a portal closing: a collapsing swirl', ['portal close', 'rift close', 'portal closing'], ['energy', 'air'], 'teleport'),
  row('ward-dome', 'world', 'on', 'a ward raised over the land: a vast shimmering dome', ['ward dome', 'barrier dome', 'great ward'], ['energy'], 'shield-up'),
  row('sky-darken', 'world', 'on', 'the sky darkening: an ominous rising swell', ['sky darken', 'darkness falls', 'eclipse'], ['energy', 'air'], 'curse'),
  row('dawn-swell', 'world', 'on', 'dawn breaking: a warm radiant swell', ['dawn swell', 'light returns', 'sunrise swell'], ['energy', 'air']),
  row('lava-flow', 'world', 'hold', 'lava flowing: a molten bubbling and hiss, held', ['lava flow', 'molten lava', 'lava bubbling'], ['fire', 'earth']),
  row('portal-hum', 'world', 'hold', 'a portal held open: a deep swirling hum', ['portal hum', 'rift hum'], ['energy']),
  row('arcane-aura', 'magic', 'hold', 'an arcane aura: an enchanted shimmering drone', ['arcane aura', 'magic aura', 'enchantment hum'], ['energy']),
  row('poison-bog', 'world', 'hold', 'a poison bog: a thick sickly bubbling, held', ['poison bog', 'toxic swamp', 'acid pool'], ['water', 'creature']),
]);

const fail = (m) => new Error(`magic sounds: ${m}`);

export function elementOf(word) {
  return typeof word === 'string' ? ELEMENT_WORDS[word.toLowerCase()] ?? null : null;
}

export function elementSound(element, { phase = 'land', tier = 'minor' } = {}) {
  const el = elementOf(element);
  if (!el) throw fail(`'${element}' names no element (${ELEMENT_NAMES.join(', ')}, or their words)`);
  if (phase === 'cast') return `${el}-cast`;
  if (phase !== 'land') throw fail(`phase '${phase}' is cast or land`);
  if (!TIER_PHASE[tier]) throw fail(`tier '${tier}' is one of ${MAGIC_TIERS.join(', ')}`);
  return `${el}-${TIER_PHASE[tier]}`;
}

// (a skill on every foe, or a blow of power 10 and more, is major; power 16 and more, or a big spell on every foe, ultimate)
export function skillTier(skill = {}) {
  const power = Number(skill.power) || 0, all = skill.target === 'foes' || skill.target === 'allies';
  return power >= 16 || (all && power >= 10) ? 'ultimate' : all || power >= 10 ? 'major' : 'minor';
}

export function skillSounds(skill = {}) {
  const el = elementOf(skill.element), magic = skill.stat === 'mag' || (!skill.stat && (Number(skill.mp) || 0) > 0);
  // (a spell that mends, raises or cures gathers light; another with no element, arcane)
  const cast = magic ? (el ? elementSound(el, { phase: 'cast' }) : skill.heal || skill.revive || skill.cure ? 'light-cast' : 'arcane-cast') : null;
  let land = null;
  if (skill.revive) land = SPELLS.revive;
  // (a heal is great by its reach, the whole party, or by a power past the blows': 20 and more)
  else if (skill.heal) land = skill.target === 'allies' || (Number(skill.power) || 0) >= 20 ? SPELLS.healMajor : SPELLS.heal;
  else if (el && (skill.power !== undefined || skill.stat)) land = elementSound(el, { tier: skillTier(skill) });
  else if (skill.cure && !skill.status) land = STATUS_SHARED.cure;
  else if (skill.buff) land = Number(skill.buff.pct) < 0 ? STATUS_SHARED.down : STATUS_SHARED.up;
  return { ...(cast ? { cast } : {}), ...(land ? { land } : {}) };
}

// (only what a battle can do: the elements its skills and items strike with, the statuses they inflict, so a page carries
// the sounds it can play and no more)
export function battleSounds(skills = {}, { items = {} } = {}) {
  const acts = [...Object.values(skills), ...Object.values(items)].filter((x) => x && typeof x === 'object');
  const struck = [...new Set(acts.map((x) => x.element).filter((w) => typeof w === 'string' && elementOf(w)))].sort();
  const inflicted = new Set(acts.map((x) => x.status?.is).filter((w) => typeof w === 'string'));
  const lane = () => { const L = []; return { L, put: (key, word) => { if (word && !L.some(([k]) => k === key)) L.push([key, word]); } }; };
  // THE ENDS of a moment (a foe dissolving, a member falling, a level gained, a skill learned, the fight's start)
  const E = lane();
  E.put('ko', BATTLE.dissolve); E.put('fall', 'down'); E.put('level', BATTLE.level); E.put('learn', BATTLE.learn);
  E.put('start:boss', BATTLE.boss); E.put('start', BATTLE.start);
  // THE ACT: a status taken (the RPG's own, and every status the kit has, by its words), a heal, a blow, a cast
  const A = lane();
  for (const word of [...inflicted].sort()) { const st = STATUS_WORDS[word.toLowerCase()]; if (st) A.put(`status:${word}`, `status-${st}`); }
  // healing: a drain's absorb, each skill's own, then any heal (an item's)
  A.put('absorb', SPELLS.drain);
  const ids = Object.keys(skills).sort();
  for (const id of ids) { const S = skillSounds(skills[id]); if (skills[id]?.heal || skills[id]?.revive) A.put(`heal:${id}`, S.land); }
  A.put('heal', SPELLS.heal);
  // a blow: each elemental skill at its tier, then its element, then a resisted one, then any blow
  for (const id of ids) { const S = skillSounds(skills[id]); if (elementOf(skills[id]?.element) && S.land) A.put(`skill:${id}`, S.land); }
  for (const word of struck) A.put(`element:${word}`, elementSound(word));
  A.put('resist', BATTLE.resist); A.put('hit', 'hit');
  // a spell cast (a blow with no magic casts nothing), and a status changed (cured, raised, lowered, woken)
  for (const id of ids) { const S = skillSounds(skills[id]); if (S.cast) A.put(`cast:${id}`, S.cast); }
  A.put('status', STATUS_SHARED.shift);
  return { order: A.L, ends: E.L, also: { crit: BATTLE.crit, weak: BATTLE.weak } };
}

export function magicRecorded() {
  return !!recordedFor(elementSound('fire'));
}
