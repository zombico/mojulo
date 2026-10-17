/**
 * PARTY BATTLES — `play.rpg`: a party of classed characters, the classes they switch between, their skills, the foes
 * they meet and where, fought in rounds by the battle kernel (kernel.js) in a window over the field (the page's rpg
 * channel, scene/channels/rpg-channel.js). `play.battle` (ui/battles.js, one hero, one foe) is a separate, older thing
 * and is left as it is.
 *
 *   play.rpg: {
 *     party:      [{ id, name?, class, level?, joins?: '<flag>', bonus?: { <stat>: n }, classes?: [class ids], gear?,
 *                 auto?: true | { keeper } }]
 *                 the battle order; a member with `joins` is in once that flag is set (or `rpg-join:<id>` is emitted);
 *                 `classes` limits what they may switch to (default: every class of the world); `gear`: { <slot>: item }
 *                 what they wear as the party starts (default: their class's `start`); `auto`: a FAMILIAR (second party: a
 *                 stand, a summon, a companion) that picks for itself, smart-reactive and never on the dice: it mends the
 *                 hurt (its keeper first), raises the fallen, strikes a weakness, finishes the weakest foe, else the
 *                 hardest hitter. The page asks no command of it
 *     classes?:   [ids] | { <id>: { name?, about?, base?, growth?, skills?: [entry], opens?: '<flag>', start? } | true }
 *                 the world's classes (default: every preset). entry = { skill, at?: rank } learned at that class rank,
 *                 or { skill, cost: n, requires?: [skill] } bought on the class's tree with its points
 *     skills?:    { <id>: { name?, about?, mp?, target?, power?, stat?, scale?, element?, heal?, revive?, cure?, status?,
 *                 buff?, carry? } }   target: foe | foes | ally | allies | self; stat: atk (a blow) | mag (a spell);
 *                 status: { is: poison | sleep | silence, chance?, rounds? }; buff: { stat, pct, rounds? };
 *                 carry: usable from any class once learned
 *     foes?:      { <id>: { name?, hp, mp?, atk, def, mag, spd, xp?, gold?, cp?, weak?, resist?, absorb?, immune?,
 *                 skills?, drops?: [{ item, chance }], boss? } }
 *     items?:     [ids] | { <item>: { name?, heal?, mp?, revive?, cure?, hurt?, element?, target? } }   what an item
 *                 does in a fight (its count is the bag's: held:bag:<item>); default: every preset
 *     gear?:      [ids] | { <item>: { name?, slot: weapon | armor | accessory, atk?, def?, mag?, spd?, hp?, mp?, classes? } }
 *                 what a member may wear, one item a slot, its numbers added to theirs (default: every preset); worn
 *                 items come from the bag and go back to it (held:bag:<item>); a class switch takes off what it forbids
 *     encounters?: [{ id, foes: [foe ids], at?: [x, y], who?: '<entity>', near?, flee? }]
 *                 at: walking up to it starts the fight (a visible foe: `who` is the one standing there, and it falls
 *                 when the fight is won); without at, a cue starts it: `then: { emit: 'rpg-battle:<id>' }`
 *     random?:    { sets: [[foe ids]], every?: metres, chance?, after?: metres, in?: [{ at: [x, y], r }] }
 *                 a roll every `every` metres walked (in those zones, or anywhere), none in the first `after`
 *     juice?:     false | { on?: { <happening>: juice }, <name>: [steps] }   what the fight's moments feel like, over the
 *                 defaults (juice.js); a skill's own `juice` too. Every beat says rpg-on:<happening> on the bus
 *     rules?:     { gold?: '<var>', defeat?: 'fail' | 'retry', switch?: 'anywhere' | 'never', carry?: 'class' | 'all',
 *                 foeHp?: 'bar' | 'hidden', turns?: 'rounds' | 'timeline', size?: 1-4, cap?: n, xp?: { base, growth },
 *                 cp?: [n], sp?: n, seed?: n }   turns: every member picks then all act in speed order (rounds), or
 *                 each acts when its gauge fills at its speed, the quick more often (timeline)
 *   }
 *
 * A class, a skill, a foe or an item named without a definition is the preset of that id (presets.js). Stats: hp, mp,
 * atk, def, mag, spd.
 *
 * On the bus: `rpg.battle` (1 while a fight is up), `rpg.won` (fights won), `rpg.<member>.<hp|mp|level|class>`; the
 * events `rpg-won`, `rpg-fled`, `rpg-lost`, each also with `:<encounter>` (a random one's id is `random`). A cue
 * may emit `rpg-battle:<encounter>`, `rpg-rest` (full HP and MP), `rpg-join:<member>`, `rpg-open:<class>`.
 *
 *   readRpg(play)       → the kernel's cfg, or null; throws, teaching
 *   rpgCues(play)       → the cues: walking up to an encounter, a won fight's foe falling, a lost one failing the level
 *   withRpg(play)       → play with those cues appended (the same object without play.rpg)
 *   lowerRpg(play)      → { vars, rpg: cfg } or null (absent: zero bytes)
 *   RPG_RULES, RPG_TARGETS, RPG_STATUSES
 */
import { CLASS_PRESETS, SKILL_PRESETS, FOE_PRESETS, ITEM_PRESETS, GEAR_PRESETS, GEAR_SLOTS } from './presets.js';
import { RPG_STATS, rpgInit, rpgMirror } from './kernel.js';
import { readJuice } from './juice.js';
import { itemKey } from '../ui/items.js';

export const RPG_TARGETS = Object.freeze(['foe', 'foes', 'ally', 'allies', 'self']);
export const RPG_STATUSES = Object.freeze({ poison: 'loses a tenth of its HP each round, until cured or rested', sleep: 'skips its turns; a blow or the round\'s end may wake it', silence: 'cannot use a skill that costs MP' });
export const RPG_RULES = Object.freeze({
  gold: 'gold', defeat: 'fail', switch: 'anywhere', carry: 'class', foeHp: 'bar', turns: 'rounds', size: 4, cap: 50,
  xp: Object.freeze({ base: 10, growth: 1.5 }), cp: Object.freeze([0, 4, 10, 18, 30, 45, 65, 90]), sp: 1, seed: 1,
});
const RULE_WORDS = { defeat: ['fail', 'retry'], switch: ['anywhere', 'never'], carry: ['class', 'all'], foeHp: ['bar', 'hidden'], turns: ['rounds', 'timeline'] };
const BUFF_STATS = ['atk', 'def', 'mag', 'spd'];
const DEFAULT_BASE = Object.freeze({ hp: 30, mp: 0, atk: 8, def: 6, mag: 4, spd: 6 });
const DEFAULT_GROWTH = Object.freeze({ hp: 6, mp: 0, atk: 2, def: 1.5, mag: 1, spd: 1 });
const FLAG = /^[a-z][a-z0-9-]{0,47}$/;

const ID = /^[a-z][a-z0-9-]*$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const err = (m) => new Error(`play.rpg${m}`);
const words = (s) => s.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());
const id = (v, where) => { if (typeof v !== 'string' || !ID.test(v)) throw err(`${where} '${v}' is a lower-case word (letters, digits, dashes)`); return v; };
const keysOnly = (o, allowed, where) => { for (const k of Object.keys(o)) if (!allowed.includes(k)) throw err(`${where}.${k} is not part of it (${allowed.join(', ')})`); };
const optNum = (v, where, lo = 0) => { if (v !== undefined && !(num(v) && v >= lo)) throw err(`${where} is a number of ${lo} or more`); return v; };
const listOf = (v, where, what) => { if (v === undefined) return []; if (!Array.isArray(v)) throw err(`${where} is a list of ${what}`); return v; };
const elements = (v, where) => listOf(v, where, 'words').map((e, i) => id(e, `${where}[${i}]`));

// a table given as a list of preset ids, or as { <id>: definition | true }, → { <id>: definition | null (the preset) }
function table(v, where) {
  if (v === undefined) return null;
  if (Array.isArray(v)) return Object.fromEntries(v.map((k, i) => [id(k, `${where}[${i}]`), null]));
  if (!isObj(v)) throw err(`${where} is a list of preset ids, or { <id>: its definition }`);
  for (const k of Object.keys(v)) { id(k, `${where} key`); if (v[k] !== true && !isObj(v[k])) throw err(`${where}.${k} is its definition, or true for the preset`); }
  return Object.fromEntries(Object.entries(v).map(([k, d]) => [k, d === true ? null : d]));
}

function readStatBlock(v, where, fallback) {
  if (v === undefined) return { ...fallback };
  if (!isObj(v)) throw err(`${where} is { ${RPG_STATS.join(', ')} }`);
  keysOnly(v, RPG_STATS, where);
  for (const k of Object.keys(v)) optNum(v[k], `${where}.${k}`);
  return { ...fallback, ...v };
}

// what is worn: { <slot>: item }
function readWorn(v, where) {
  if (!isObj(v)) throw err(`${where} is { ${GEAR_SLOTS.join('?, ')}? }: the item worn in each slot`);
  keysOnly(v, GEAR_SLOTS, where);
  return Object.fromEntries(Object.entries(v).map(([slot, it]) => { if (typeof it !== 'string' || !it) throw err(`${where}.${slot} is an item`); return [slot, itemKey(it)]; }));
}

function readSkill(k, d, where) {
  keysOnly(d, ['name', 'about', 'mp', 'target', 'power', 'stat', 'scale', 'element', 'heal', 'revive', 'cure', 'status', 'buff', 'carry', 'juice'], where);
  optNum(d.mp, `${where}.mp`); optNum(d.power, `${where}.power`); optNum(d.scale, `${where}.scale`);
  const heal = !!d.heal, revive = !!d.revive;
  const target = d.target ?? (heal || revive || d.cure ? 'ally' : 'foe');
  if (!RPG_TARGETS.includes(target)) throw err(`${where}.target is ${RPG_TARGETS.join(', ')}`);
  if (d.stat !== undefined && d.stat !== 'atk' && d.stat !== 'mag') throw err(`${where}.stat is atk (a blow, against defence) or mag (a spell)`);
  const stat = d.stat ?? (heal || revive ? 'mag' : (d.power ?? 0) > 0 ? 'atk' : 'mag');
  const scale = d.scale ?? (d.stat !== undefined || (d.power ?? 0) > 0 ? 1 : 0);
  const cure = listOf(d.cure, `${where}.cure`, 'statuses');
  for (const s of cure) if (!RPG_STATUSES[s]) throw err(`${where}.cure: '${s}' is not a status (${Object.keys(RPG_STATUSES).join(', ')})`);
  let status = null;
  if (d.status !== undefined) {
    if (!isObj(d.status) || !RPG_STATUSES[d.status.is]) throw err(`${where}.status is { is: ${Object.keys(RPG_STATUSES).join(' | ')}, chance?, rounds? }`);
    keysOnly(d.status, ['is', 'chance', 'rounds'], `${where}.status`);
    if (d.status.chance !== undefined && !(num(d.status.chance) && d.status.chance > 0 && d.status.chance <= 1)) throw err(`${where}.status.chance is above 0, at most 1`);
    status = { is: d.status.is, chance: d.status.chance ?? 1, rounds: d.status.rounds ?? 3 };
  }
  let buff = null;
  if (d.buff !== undefined) {
    if (!isObj(d.buff) || !BUFF_STATS.includes(d.buff.stat) || !num(d.buff.pct) || d.buff.pct === 0) throw err(`${where}.buff is { stat: ${BUFF_STATS.join(' | ')}, pct: a share up (0.5) or down (-0.3), rounds? }`);
    keysOnly(d.buff, ['stat', 'pct', 'rounds'], `${where}.buff`);
    buff = { stat: d.buff.stat, pct: d.buff.pct, rounds: d.buff.rounds ?? 3 };
  }
  const power = d.power ?? 0, harm = !heal && !revive && (power > 0 || scale > 0);
  if (!harm && !heal && !revive && !cure.length && !status && !buff) throw err(`${where} does nothing: give it power (a blow or a spell), heal, revive, cure, status or buff`);
  return {
    id: k, name: d.name ?? words(k), about: d.about ?? '', mp: d.mp ?? 0, target, power, stat, scale, harm,
    element: d.element !== undefined ? id(d.element, `${where}.element`) : null, heal, revive, cure, status, buff, carry: !!d.carry,
  };
}

function readFoe(k, d, where) {
  keysOnly(d, ['name', ...RPG_STATS, 'xp', 'gold', 'cp', 'weak', 'resist', 'absorb', 'immune', 'skills', 'drops', 'boss'], where);
  for (const s of ['hp', 'atk', 'def', 'mag', 'spd']) if (!num(d[s]) || d[s] < 0) throw err(`${where}.${s} is a number (hp, atk, def, mag, spd are each needed)`);
  if (d.hp < 1) throw err(`${where}.hp is 1 or more`);
  for (const s of ['mp', 'xp', 'gold', 'cp']) optNum(d[s], `${where}.${s}`);
  const drops = listOf(d.drops, `${where}.drops`, '{ item, chance }').map((x, i) => {
    if (!isObj(x) || typeof x.item !== 'string' || !(num(x.chance) && x.chance > 0 && x.chance <= 1)) throw err(`${where}.drops[${i}] is { item, chance: above 0, at most 1 }`);
    return { item: itemKey(x.item), chance: x.chance };
  });
  const immune = listOf(d.immune, `${where}.immune`, 'elements and statuses').map((e, i) => id(e, `${where}.immune[${i}]`));
  return {
    name: d.name ?? words(k), base: { hp: d.hp, mp: d.mp ?? 99, atk: d.atk, def: d.def, mag: d.mag, spd: d.spd },
    xp: d.xp ?? 0, gold: d.gold ?? 0, cp: d.cp ?? (d.boss ? 4 : 1),
    weak: elements(d.weak, `${where}.weak`), resist: elements(d.resist, `${where}.resist`), absorb: elements(d.absorb, `${where}.absorb`), immune,
    skills: listOf(d.skills, `${where}.skills`, 'skill ids').map((s, i) => id(s, `${where}.skills[${i}]`)), drops, boss: !!d.boss,
  };
}

function readItem(k, d, where) {
  keysOnly(d, ['name', 'heal', 'mp', 'revive', 'cure', 'hurt', 'element', 'target'], where);
  for (const s of ['heal', 'mp', 'hurt']) optNum(d[s], `${where}.${s}`);
  const cure = listOf(d.cure, `${where}.cure`, 'statuses');
  for (const s of cure) if (!RPG_STATUSES[s]) throw err(`${where}.cure: '${s}' is not a status`);
  if (!d.heal && !d.mp && !d.revive && !cure.length && !d.hurt) throw err(`${where} does nothing in a fight: heal, mp, revive, cure or hurt`);
  const target = d.target ?? (d.hurt ? 'foe' : 'ally');
  if (!RPG_TARGETS.includes(target) || target === 'self') throw err(`${where}.target is foe, foes, ally or allies`);
  return { name: d.name ?? words(k), heal: d.heal ?? 0, mp: d.mp ?? 0, revive: !!d.revive, cure, hurt: d.hurt ?? 0, element: d.element !== undefined ? id(d.element, `${where}.element`) : null, target };
}

/** play.rpg → the kernel's cfg, or null. Every name is checked; errors say what a field is. */
export function readRpg(play) {
  const P = play && play.rpg;
  if (P === undefined) return null;
  if (!isObj(P)) throw err(' is { party, classes?, skills?, foes?, items?, encounters?, random?, rules? }');
  keysOnly(P, ['party', 'classes', 'skills', 'foes', 'items', 'gear', 'encounters', 'random', 'rules', 'juice'], '');

  // the rules
  const Ru = P.rules ?? {};
  if (!isObj(Ru)) throw err('.rules is { gold?, defeat?, switch?, carry?, foeHp?, turns?, size?, cap?, xp?, cp?, sp?, seed? }');
  keysOnly(Ru, Object.keys(RPG_RULES), '.rules');
  for (const [k, ws] of Object.entries(RULE_WORDS)) if (Ru[k] !== undefined && !ws.includes(Ru[k])) throw err(`.rules.${k} is ${ws.join(' or ')}`);
  if (Ru.gold !== undefined && (typeof Ru.gold !== 'string' || !Ru.gold)) throw err('.rules.gold is the var the gold won goes into');
  if (Ru.size !== undefined && !(Number.isInteger(Ru.size) && Ru.size >= 1 && Ru.size <= 4)) throw err('.rules.size is how many fight at once, 1 to 4');
  if (Ru.cap !== undefined && !(Number.isInteger(Ru.cap) && Ru.cap >= 2 && Ru.cap <= 99)) throw err('.rules.cap is the highest level, 2 to 99');
  if (Ru.xp !== undefined && !(isObj(Ru.xp) && num(Ru.xp.base) && Ru.xp.base > 0 && num(Ru.xp.growth) && Ru.xp.growth >= 1)) throw err('.rules.xp is { base: the xp from level 1 to 2, growth: each next level\'s share more (1.5) }');
  if (Ru.cp !== undefined && !(Array.isArray(Ru.cp) && Ru.cp.length >= 1 && Ru.cp[0] === 0 && Ru.cp.every((n, i) => Number.isInteger(n) && (i === 0 || n > Ru.cp[i - 1])))) throw err('.rules.cp is the class points each class rank needs, rising from 0: [0, 2, 5, 9]');
  optNum(Ru.sp, '.rules.sp');
  if (Ru.seed !== undefined && !Number.isInteger(Ru.seed)) throw err('.rules.seed is a whole number');
  const rules = { ...RPG_RULES, ...Ru };

  // the party
  if (!Array.isArray(P.party) || !P.party.length || P.party.length > 8) throw err('.party is a list of 1 to 8 members: [{ id, name?, class, level?, joins?, bonus?, classes? }]');
  const seen = new Set();
  const party0 = P.party.map((p, i) => {
    const at = `.party[${i}]`;
    if (!isObj(p)) throw err(`${at} is { id, name?, class, level?, joins?, bonus?, classes? }`);
    keysOnly(p, ['id', 'name', 'class', 'level', 'joins', 'bonus', 'classes', 'gear', 'auto'], at);
    id(p.id, `${at}.id`);
    if (seen.has(p.id)) throw err(`${at}.id '${p.id}' is in the party twice`);
    seen.add(p.id);
    id(p.class, `${at}.class`);
    if (p.level !== undefined && !(Number.isInteger(p.level) && p.level >= 1 && p.level <= rules.cap)) throw err(`${at}.level is 1 to ${rules.cap}`);
    if (p.joins !== undefined && !FLAG.test(p.joins)) throw err(`${at}.joins is the flag that brings them in (a lower-case name: joined-mira)`);
    if (p.bonus !== undefined) { if (!isObj(p.bonus)) throw err(`${at}.bonus is { <stat>: n } on top of their class`); keysOnly(p.bonus, RPG_STATS, `${at}.bonus`); for (const k of Object.keys(p.bonus)) if (!num(p.bonus[k])) throw err(`${at}.bonus.${k} is a number`); }
    const classes = p.classes === undefined ? null : listOf(p.classes, `${at}.classes`, 'class ids').map((c, k) => id(c, `${at}.classes[${k}]`));
    if (classes && !classes.includes(p.class)) throw err(`${at}.classes leaves out their own class '${p.class}'`);
    const gear = p.gear === undefined ? null : readWorn(p.gear, `${at}.gear`);
    if (p.auto !== undefined && p.auto !== true && !(isObj(p.auto) && Object.keys(p.auto).every((k) => k === 'keeper') && typeof p.auto.keeper === 'string')) throw err(`${at}.auto is true, or { keeper: '<member id>' }: a familiar that picks for itself`);
    const auto = p.auto === undefined ? null : { keeper: p.auto === true ? null : p.auto.keeper };
    return { id: p.id, name: typeof p.name === 'string' && p.name ? p.name : words(p.id), cls: p.class, level: p.level ?? 1, joins: p.joins ?? null, bonus: { ...(p.bonus ?? {}) }, classes, gear, ...(auto ? { auto } : {}) };
  });
  if (party0.every((p) => p.joins)) throw err('.party: someone is in from the start (a member without joins)');
  if (party0.every((p) => p.auto)) throw err('.party: someone takes the player\'s commands (a member without auto)');
  for (const p of party0) if (p.auto?.keeper != null && !seen.has(p.auto.keeper)) throw err(`.party: ${p.id}'s keeper '${p.auto.keeper}' is not in the party`);

  // the classes: the world's (or every preset), and each member's own
  const givenClasses = table(P.classes, '.classes') ?? Object.fromEntries(Object.keys(CLASS_PRESETS).map((k) => [k, null]));
  for (const p of party0) for (const c of [p.cls, ...(p.classes ?? [])]) if (!(c in givenClasses)) givenClasses[c] = null;
  const classes = {}, skillWant = new Set();
  for (const [k, d0] of Object.entries(givenClasses)) {
    const at = `.classes.${k}`, d = d0 ?? CLASS_PRESETS[k];
    if (!d) throw err(`${at}: '${k}' is no preset class (${Object.keys(CLASS_PRESETS).join(', ')}): define it ({ base, growth, skills })`);
    if (d0) keysOnly(d0, ['name', 'about', 'base', 'growth', 'skills', 'opens', 'start'], at);
    if (d.opens !== undefined && !FLAG.test(d.opens)) throw err(`${at}.opens is the flag that opens the class`);
    const skills = listOf(d.skills, `${at}.skills`, '{ skill, at? } or { skill, cost, requires? }').map((e, i) => {
      const w = `${at}.skills[${i}]`;
      if (!isObj(e)) throw err(`${w} is { skill, at? } (learned at a class rank) or { skill, cost, requires? } (bought on the tree)`);
      keysOnly(e, ['skill', 'at', 'cost', 'requires'], w);
      id(e.skill, `${w}.skill`);
      skillWant.add(e.skill);
      if (e.cost !== undefined) {
        if (!(Number.isInteger(e.cost) && e.cost >= 1)) throw err(`${w}.cost is the class points it takes, 1 or more`);
        if (e.at !== undefined) throw err(`${w}: a skill comes at a rank or is bought (cost), not both`);
        const requires = listOf(e.requires, `${w}.requires`, 'skill ids').map((r, j) => id(r, `${w}.requires[${j}]`));
        return { skill: e.skill, cost: e.cost, requires };
      }
      if (e.requires !== undefined) throw err(`${w}.requires belongs to a bought skill (cost)`);
      if (e.at !== undefined && !(Number.isInteger(e.at) && e.at >= 1)) throw err(`${w}.at is the class rank it comes at, 1 or more`);
      return { skill: e.skill, at: e.at ?? 1 };
    });
    classes[k] = { name: d.name ?? words(k), about: d.about ?? '', base: readStatBlock(d.base, `${at}.base`, DEFAULT_BASE), growth: readStatBlock(d.growth, `${at}.growth`, DEFAULT_GROWTH), skills, opens: d.opens ?? null, start: d.start === undefined ? {} : readWorn(d.start, `${at}.start`) };
  }
  for (const [k, C] of Object.entries(classes)) for (const e of C.skills) for (const r of e.requires ?? []) if (!C.skills.some((x) => x.skill === r)) throw err(`.classes.${k}: '${e.skill}' requires '${r}', which is not on that class's tree`);

  // the foes: the world's, then every one an encounter names
  const foesGiven = table(P.foes, '.foes') ?? {};
  const E = listOf(P.encounters, '.encounters', '{ id, foes, at?, who?, near?, flee? }');
  const R0 = P.random;
  for (const [i, e] of E.entries()) if (isObj(e)) for (const f of listOf(e.foes, `.encounters[${i}].foes`, 'foe ids')) if (typeof f === 'string' && !(f in foesGiven)) foesGiven[f] = null;
  if (isObj(R0)) for (const s of listOf(R0.sets, '.random.sets', 'lists of foe ids')) for (const f of Array.isArray(s) ? s : []) if (typeof f === 'string' && !(f in foesGiven)) foesGiven[f] = null;
  const foes = {};
  for (const [k, d0] of Object.entries(foesGiven)) {
    const d = d0 ?? FOE_PRESETS[k];
    if (!d) throw err(`.foes: '${k}' is no preset foe (${Object.keys(FOE_PRESETS).join(', ')}): define it ({ hp, atk, def, mag, spd, xp, gold })`);
    foes[id(k, '.foes key')] = readFoe(k, d, `.foes.${k}`);
    for (const s of foes[k].skills) skillWant.add(s);
  }

  // the skills: the world's, then every one a class or a foe names
  const skillsGiven = table(P.skills, '.skills') ?? {};
  for (const s of skillWant) if (!(s in skillsGiven)) skillsGiven[s] = null;
  const skills = {};
  for (const [k, d0] of Object.entries(skillsGiven)) {
    const d = d0 ?? SKILL_PRESETS[k];
    if (!d) throw err(`.skills: '${k}' is no preset skill: define it ({ mp, target, power, stat, … })`);
    skills[k] = readSkill(k, d, `.skills.${k}`);
  }

  // the items a fight can use (default: every preset), their names the world's own when play.items names them
  const itemsGiven = table(P.items, '.items') ?? Object.fromEntries(Object.keys(ITEM_PRESETS).map((k) => [k, null]));
  for (const f of Object.values(foes)) for (const d of f.drops) if (!(d.item in itemsGiven) && ITEM_PRESETS[d.item]) itemsGiven[d.item] = null;
  const items = {};
  for (const [k0, d0] of Object.entries(itemsGiven)) {
    const k = itemKey(k0), d = d0 ?? ITEM_PRESETS[k];
    if (!d) throw err(`.items: '${k0}' is no preset battle item (${Object.keys(ITEM_PRESETS).join(', ')}): define what it does ({ heal | mp | revive | cure | hurt, target? })`);
    items[k] = readItem(k, d, `.items.${k0}`);
    const own = isObj(play.items) && isObj(play.items[k0]) && typeof play.items[k0].name === 'string' ? play.items[k0].name : null;
    if (own) items[k].name = own;
  }

  // the gear a member may wear (default: every preset; any a start or a member names), and who may wear it
  const gearGiven = table(P.gear, '.gear') ?? Object.fromEntries(Object.keys(GEAR_PRESETS).map((k) => [k, null]));
  for (const w of [...Object.values(classes).map((c) => c.start), ...party0.map((p) => p.gear ?? {})]) for (const it of Object.values(w)) if (!(it in gearGiven)) gearGiven[it] = null;
  for (const f of Object.values(foes)) for (const d of f.drops) if (!(d.item in gearGiven) && GEAR_PRESETS[d.item]) gearGiven[d.item] = null;
  const gear = {};
  for (const [k0, d0] of Object.entries(gearGiven)) {
    const k = itemKey(k0), d = d0 ?? GEAR_PRESETS[k], at = `.gear.${k0}`;
    if (!d) throw err(`${at}: '${k0}' is no preset gear (${Object.keys(GEAR_PRESETS).join(', ')}): define it ({ slot, atk?, def?, … })`);
    keysOnly(d, ['name', 'slot', ...RPG_STATS, 'classes'], at);
    if (!GEAR_SLOTS.includes(d.slot)) throw err(`${at}.slot is ${GEAR_SLOTS.join(', ')}`);
    for (const st of RPG_STATS) if (d[st] !== undefined && !num(d[st])) throw err(`${at}.${st} is a number it adds`);
    if (items[k]) throw err(`${at}: '${k}' is a battle item too; an item is worn or used, not both`);
    const own = isObj(play.items) && isObj(play.items[k0]) && typeof play.items[k0].name === 'string' ? play.items[k0].name : null;
    gear[k] = { name: own ?? d.name ?? words(k), slot: d.slot, mods: Object.fromEntries(RPG_STATS.filter((st) => d[st]).map((st) => [st, d[st]])), classes: d.classes ? [...d.classes] : null };
  }
  for (const [where, w] of [...Object.entries(classes).map(([c, C]) => [`.classes.${c}.start`, C.start]), ...party0.map((p, i) => [`.party[${i}].gear`, p.gear ?? {}])]) {
    for (const [slot, it] of Object.entries(w)) if (gear[it].slot !== slot) throw err(`${where}.${slot}: ${gear[it].name} is worn as ${gear[it].slot}`);
  }

  // the encounters
  const encSeen = new Set(), encounters = {}, met = [];
  E.forEach((e, i) => {
    const at = `.encounters[${i}]`;
    if (!isObj(e)) throw err(`${at} is { id, foes, at?, who?, near?, flee? }`);
    keysOnly(e, ['id', 'foes', 'at', 'who', 'near', 'flee'], at);
    id(e.id, `${at}.id`);
    if (e.id === 'random') throw err(`${at}.id 'random' is the random encounters' own`);
    if (encSeen.has(e.id)) throw err(`${at}.id '${e.id}' twice`);
    encSeen.add(e.id);
    if (!Array.isArray(e.foes) || !e.foes.length || e.foes.length > 6) throw err(`${at}.foes is 1 to 6 foe ids`);
    if (e.at !== undefined && !(Array.isArray(e.at) && e.at.length >= 2 && e.at.slice(0, 2).every(num))) throw err(`${at}.at is where it stands [x, y]`);
    if (e.who !== undefined && (typeof e.who !== 'string' || !/^[a-z][a-z0-9_-]*$/i.test(e.who))) throw err(`${at}.who is the entity standing for it on the map`);
    if (e.who !== undefined && e.at === undefined) throw err(`${at}.who stands somewhere: give its at`);
    optNum(e.near, `${at}.near`);
    if (e.flee !== undefined && typeof e.flee !== 'boolean') throw err(`${at}.flee is false for a fight with no escape`);
    const boss = e.foes.some((f) => foes[f].boss);
    encounters[e.id] = { foes: [...e.foes], flee: e.flee ?? !boss };
    if (e.at) met.push({ id: e.id, at: [e.at[0], e.at[1]], who: e.who ?? null, near: e.near ?? 2.2 });
  });

  // the random encounters
  let random = null;
  if (R0 !== undefined) {
    if (!isObj(R0)) throw err('.random is { sets: [[foe ids]], every?, chance?, after?, in? }');
    keysOnly(R0, ['sets', 'every', 'chance', 'after', 'in'], '.random');
    if (!Array.isArray(R0.sets) || !R0.sets.length || !R0.sets.every((s) => Array.isArray(s) && s.length >= 1 && s.length <= 6)) throw err('.random.sets is a list of foe groups, each 1 to 6 foe ids');
    if (R0.every !== undefined && !(num(R0.every) && R0.every >= 2)) throw err('.random.every is the metres walked between rolls, 2 or more');
    if (R0.chance !== undefined && !(num(R0.chance) && R0.chance > 0 && R0.chance <= 1)) throw err('.random.chance is a roll\'s chance of a fight, above 0, at most 1');
    optNum(R0.after, '.random.after');
    const zones = listOf(R0.in, '.random.in', '{ at: [x, y], r }').map((z, i) => {
      if (!isObj(z) || !Array.isArray(z.at) || !z.at.slice(0, 2).every(num) || !(num(z.r) && z.r > 0)) throw err(`.random.in[${i}] is { at: [x, y], r }`);
      return { at: [z.at[0], z.at[1]], r: z.r };
    });
    random = { sets: R0.sets.map((s) => [...s]), every: R0.every ?? 9, chance: R0.chance ?? 0.3, after: R0.after ?? 6, in: zones };
  }

  // the juice: the defaults, the world's own, each skill's own (juice.js)
  const juice = readJuice(P.juice, { skills: Object.fromEntries(Object.entries(skillsGiven).map(([k, d0]) => [k, { juice: (d0 ?? SKILL_PRESETS[k]).juice }])) });
  return { seed: rules.seed, party: party0, classes, skills, foes, items, gear, encounters, random, met, juice, rules: { ...rules, xp: { ...rules.xp }, cp: [...rules.cp] } };
}

const doneVar = (enc) => `rpg-done-${enc}`;

/** The cues: walking up to a standing encounter starts it (once won, never again); a won one's foe falls; a lost
 * fight fails the level under `defeat: 'fail'` (the hp var a level's fail-on-death owns goes to 0). */
export function rpgCues(play) {
  const cfg = readRpg(play);
  if (!cfg) return [];
  const cues = [];
  for (const e of cfg.met) {
    cues.push({ id: `rpg-meet-${e.id}`, when: { enter: { at: e.at, r: e.near } }, if: [{ var: 'rpg.battle', eq: 0 }, { var: doneVar(e.id), eq: 0 }], then: { emit: `rpg-battle:${e.id}` } });
    cues.push({ id: `rpg-beaten-${e.id}`, when: { on: `rpg-won:${e.id}` }, then: [{ set: doneVar(e.id), to: 1 }, ...(e.who ? [{ kill: e.who }] : [])] });
  }
  // a member who joins on a flag: in the fights once the flag is set here or carried in (scenes.js flag events)
  for (const p of cfg.party) if (p.joins) {
    cues.push({ id: `rpg-join-${p.id}`, when: { on: `flag:${p.joins}` }, then: { emit: `rpg-join:${p.id}` } });
    cues.push({ id: `rpg-joined-${p.id}`, when: { on: `flag-carried:${p.joins}` }, then: { emit: `rpg-join:${p.id}` } });
  }
  if (cfg.rules.defeat === 'fail') cues.push({ id: 'rpg-defeat', when: { on: 'rpg-lost' }, then: { set: 'hp', to: 0 } });
  return cues;
}

export function withRpg(play) {
  if (!play || play.rpg === undefined) return play;
  return { ...play, cues: [...(play.cues || []), ...rpgCues(play)] };
}

/** → { vars, rpg } or null: the party's starting vars (and each encounter's done flag), and the kernel's cfg. */
export function lowerRpg(play) {
  const cfg = readRpg(play);
  if (!cfg) return null;
  const vars = { 'rpg.battle': 0, 'rpg.won': 0 };
  for (const e of cfg.met) vars[doneVar(e.id)] = 0;
  rpgMirror(cfg, rpgInit(cfg), vars);
  if (!(cfg.rules.gold in vars)) vars[cfg.rules.gold] = 0;
  return { vars, rpg: cfg };
}
