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
 *                 buff?, carry?, hits?, damage?, drain?, steal? } }   target: foe | foes | ally | allies | self; stat: atk
 *                 (a blow) | mag (a spell); EFFECTS: hits 2-8 strikes, each its own swing; damage gravity (power the
 *                 share of the HP as it stands; a foe immune to 'gravity' takes none), fixed (power exactly), pierce (no
 *                 guard against it) or mp (taken from the MP); drain the share of it the user takes back; steal a foe's
 *                 first drop into the bag, once a foe;
 *                 status: { is: poison | sleep | silence, chance?, rounds? }; buff: { stat, pct, rounds? };
 *                 carry: usable from any class once learned
 *     foes?:      { <id>: { name?, hp, mp?, atk, def, mag, spd, xp?, gold?, cp?, weak?, resist?, absorb?, immune?,
 *                 skills?, drops?: [{ item, chance }], boss?, pattern?, phases? } }
 *                 pattern: [{ use: 'attack' | 'guard' | '<skill>', when?: { hpBelow?, hpAbove?, turn?, every?, after? },
 *                 weight?: 1-9, charge?: true | '<line>' }]   its ACTION PATTERN: on its turn, a row whose `when` holds
 *                 (its HP below or above a share, its nth turn, every nth, from its nth on) and that it can pay for, by
 *                 weight (5 unsaid); none, the rule every foe keeps (a skill by chance, else an attack). A row that
 *                 CHARGES is telegraphed: its turn spent gathering (the line said, `{name}` the foe's), and its next
 *                 turn the blow or the skill let go at twice its power (kernel.js CHARGED): a turn to guard or mend
 *                 phases: [{ below, say?, pattern?, weak?, resist?, absorb?, immune?, atk?, def?, mag?, spd? }]   its
 *                 PHASES: a form it takes the first time its HP falls under `below` (each under the one before), what
 *                 the phase names replacing its own, said (`say`, {name} the foe's) and roared as it comes
 *     states?:    { <id>: { name?, said?, rounds?, skip?, noCast?, miss?, wild?, tick?, wake?, stats?, takes?, berserk?,
 *                 reflect?, taunt?, doom?, stack?, hit?, eva?, crit? } | true }   the world's own states, or a preset's
 *                 (presets.js STATE_PRESETS) by name: what each does is readState's (stats its bearer's numbers scaled, takes
 *                 the damage it takes scaled, berserk a frenzy past commanding, reflect a spell at it alone turned back,
 *                 taunt the foes' aimed blows drawn to it, doom it falls as the state runs out; stack what a second cast
 *                 does). A fight that meets none carries no table
 *     items?:     [ids] | { <item>: { name?, heal?, mp?, revive?, cure?, hurt?, element?, target?, status?, buff? } }   what an item
 *                 does in a fight (its count is the bag's: held:bag:<item>); default: every preset
 *     gear?:      [ids] | { <item>: { name?, slot: weapon | armor | accessory, atk?, def?, mag?, spd?, hp?, mp?, classes?,
 *                 resist?, immune?, ward?, hit?, eva?, crit?, element?, inflict?, grants? } }   (TRAITS, a class's too: the
 *                 elements its wearer takes half of or none of, the states it wards off; its RATES, shares added to the
 *                 fight's: hit (its blows surer), eva (blows at it go wide), crit (its blows critical); what its plain
 *                 blow carries, an element and a status it may leave where it lands, inflict: { is, chance?, rounds? };
 *                 the skills it grants while worn; its REACTIONS on another's turn: counter (the chance it strikes back at a
 *                 blow aimed at it alone; a counter is never countered), cover (it steps before a badly hurt ally a foe's
 *                 blow is aimed at), revive (the share of its HP it rises with, once a fight). A foe names its rates,
 *                 element, inflict, counter and revive as its own fields; a state may carry rates and reactions)
 *                 what a member may wear, one item a slot, its numbers added to theirs (default: every preset); worn
 *                 items come from the bag and go back to it (held:bag:<item>); a class switch takes off what it forbids
 *     encounters?: [{ id, foes: [foe ids], at?: [x, y], who?: '<entity>' | ['<entity>', …], near?, flee?, room?, pages? }]
 *                 pages: [{ when: { start: true } | { foe?, hpBelow } | { round }, say: text | [text], who?, sets?, summon?, heal? }]
 *                 the FIGHT'S OWN PAGES (RPG Maker's troop events): each said once, the first time its moment holds (the
 *                 fight begun; a foe, of that kind, brought under a share of its HP; its nth round reached), in the
 *                 message line, `who` before the words; `sets` a story flag as it is said (`flag:<name>` on the bus);
 *                 `summon: [foe ids]` calls foes into the fight (six in all at most; a figure each past the foes' in
 *                 `who`, minted `dormant`, woken as it comes); `heal: share` gives back that share of HP to the foe its
 *                 when names, else to every foe standing
 *                 at: walking up to it starts the fight (a visible foe: `who` is the one standing there, or each foe's
 *                 own figure in the foes' order, the first standing at `at`; each falls
 *                 when the fight is won); without at, a cue starts it: `then: { emit: 'rpg-battle:<id>' }`; room: the
 *                 room it is met in, [x0, y0, x1, y1, floor] (an arena stage holds the fight to it)
 *     random?:    { sets: [[foe ids]], every?: metres, chance?, after?: metres, in?: [{ at: [x, y], r }] }
 *                 a roll every `every` metres walked (in those zones, or anywhere), none in the first `after`
 *     shops?:     { <id>: { name?, wares?: [item or gear ids], buys?: false, inn?: gold, raise?: gold } }   (raise: a temple,
 *                 each fallen member raised, healed and cured, for that gold: rpg-raised:<shop>)   a merchant's wares at their
 *                 price (an item's or gear's `price`, else the preset's), bought into the bag with `rules.gold`, and the
 *                 bag's priced things bought back at half unless `buys: false`; `inn`: a night's stay for that gold (full
 *                 HP and MP, cured). A cue opens one: `then: { emit: 'rpg-shop:<id>' }`
 *     juice?:     false | { on?: { <happening>: juice }, <name>: [steps] }   what the fight's moments feel like, over the
 *                 defaults (juice.js); a skill's own `juice` too. Every beat says rpg-on:<happening> on the bus
 *     rules?:     { gold?: '<var>', defeat?: 'fail' | 'retry', switch?: 'anywhere' | 'never', carry?: 'class' | 'all',
 *                 foeHp?: 'bar' | 'hidden', turns?: 'rounds' | 'timeline', size?: 1-4, cap?: n, xp?: { base, growth },
 *                 stage?: 'live' | 'arena' | 'backdrop' (where it is fought: on the map as it stands; on a place solved
 *                 near where it was met, its ground the map's, what stands in it and before the camera cleared for the
 *                 fight, the party on the left; or on an arena of its own before a background drawn once from the map),
 *                 view?: 'side' | 'front' | 'left' | 'right' | 'overhead' (where the fight is seen from: from the side, over
 *                 the party at the foes, a three-quarter view from either hand, from above),
 *                 cinema?: { on?: 'skills' | 'all', ui?: 'none' | 'numbers' | 'all', skip?: seconds }   a skill (or every
 *                 action) played as a short film: the actor close, behind it at its target, the target as it lands, back
 *                 to the view; what UI stays meanwhile; past `skip` seconds (3) it may be skipped,
 *                 cp?: [n], sp?: n, seed?: n }   turns: every member picks then all act in speed order (rounds), or
 *                 each acts when its gauge fills at its speed, the quick more often (timeline)
 *   }
 *
 * A class, a skill, a foe or an item named without a definition is the preset of that id (presets.js). Stats: hp, mp,
 * atk, def, mag, spd.
 *
 * On the bus: `rpg.battle` (1 while a fight is up), `rpg.won` (fights won), `rpg.<member>.<hp|mp|level|class>`; the
 * events `rpg-won`, `rpg-fled`, `rpg-lost`, each also with `:<encounter>` (a random one's id is `random`). A cue
 * may emit `rpg-battle:<encounter>`, `rpg-rest` (full HP and MP), `rpg-join:<member>`, `rpg-open:<class>`,
 * `rpg-shop:<shop>`; a purchase says `rpg-bought:<shop>:<item>`, a sale `rpg-sold:<shop>:<item>`, a stay `rpg-stayed:<shop>`.
 *
 * What the battles, the party menu and a shop show is mana-ui's (rpg-ui.js, the spec; the page's RPG channel its host):
 * lowered with a world's UI guide, the cfg carries `theme` (the guide as a mana-ui theme, playscape/ui/mana-theme.js;
 * 'greybox' until the guide is settled); without one, the console RPG's.
 *
 *   readRpg(play)       → the kernel's cfg, or null; throws, teaching
 *   rpgCues(play)       → the cues: walking up to an encounter, a won fight's foe falling, a lost one failing the level
 *   withRpg(play)       → play with those cues appended (the same object without play.rpg)
 *   lowerRpg(play)      → { vars, rpg: cfg } or null (absent: zero bytes)
 *   RPG_RULES, RPG_TARGETS, RPG_STATUSES
 */
import { CLASS_PRESETS, SKILL_PRESETS, FOE_PRESETS, ITEM_PRESETS, GEAR_PRESETS, GEAR_SLOTS, STATE_PRESETS } from './presets.js';
import { RPG_STATS, rpgInit, rpgMirror } from './kernel.js';
import { readJuice } from './juice.js';
import { itemKey } from '../ui/items.js';

export const RPG_TARGETS = Object.freeze(['foe', 'foes', 'ally', 'allies', 'self']);
export const RPG_STATUSES = Object.freeze({ poison: 'loses a tenth of its HP each round, until cured or rested', sleep: 'skips its turns; a blow or the round\'s end may wake it', silence: 'cannot use a skill that costs MP' });
export const RPG_RULES = Object.freeze({
  gold: 'gold', defeat: 'fail', switch: 'anywhere', carry: 'class', foeHp: 'bar', turns: 'rounds', size: 4, cap: 50,
  xp: Object.freeze({ base: 10, growth: 1.5 }), cp: Object.freeze([0, 4, 10, 18, 30, 45, 65, 90]), sp: 1, seed: 1,
});
const RULE_WORDS = { defeat: ['fail', 'retry'], switch: ['anywhere', 'never'], carry: ['class', 'all'], foeHp: ['bar', 'hidden'], turns: ['rounds', 'timeline'], view: ['side', 'front', 'left', 'right', 'overhead'], stage: ['live', 'backdrop', 'arena'] };
const BUFF_STATS = ['atk', 'def', 'mag', 'spd'];
// the RATES (traits.js of RPG Maker's: hit, evasion, critical), each a share added to the fight's own
export const RATE_KEYS = Object.freeze(['hit', 'eva', 'crit']);
// the REACTIONS (rpg.js readReacts): a strike back, a step before an ally, a rise from a fall
export const REACT_KEYS = Object.freeze(['counter', 'cover', 'revive']);
const RATE_SAYS = { hit: 'how much surer its blows land', eva: 'how often a blow at it goes wide', crit: 'how much more often its blows are critical' };
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

// TRAITS a class or a piece of gear carries (RPG Maker's traits): the elements it takes half of (resist) or none of
// (immune), the states it wards off (ward); its RATES, each added to the fight's own (kernel.js MISS, CRIT): `hit` how much
// surer its blows land, `eva` how often a blow at it goes wide, `crit` how much more often its blows are critical; its
// ATTACK, what a plain blow carries: `element` (a flame sword's fire) and `inflict` (a poison dagger's { is, chance?,
// rounds? }); and the skills it `grants` while it is worn or the class held. Null where it names none
const TRAIT_KEYS = ['resist', 'immune', 'ward', ...RATE_KEYS, 'element', 'inflict', 'grants', ...REACT_KEYS];
function readTraits(d, where) {
  const out = {};
  for (const k of ['resist', 'immune', 'ward']) if (d[k] !== undefined) out[k] = listOf(d[k], `${where}.${k}`, k === 'ward' ? 'states' : 'elements').map((e, i) => id(e, `${where}.${k}[${i}]`));
  Object.assign(out, readRates(d, where), readAttack(d, where), readReacts(d, where));
  if (d.grants !== undefined) out.grants = listOf(d.grants, `${where}.grants`, 'skill ids').map((e, i) => id(e, `${where}.grants[${i}]`));
  return Object.keys(out).length ? out : null;
}
// the RATES a trait, a foe or a state carries: each a share added to the fight's own, -1 to 1 (eva 0 to 1)
function readRates(d, where) {
  const out = {};
  for (const k of RATE_KEYS) if (d[k] !== undefined) {
    if (!(num(d[k]) && d[k] >= (k === 'eva' ? 0 : -1) && d[k] <= 1)) throw err(`${where}.${k} is ${RATE_SAYS[k]}: a share, ${k === 'eva' ? '0' : '-1'} to 1`);
    out[k] = d[k];
  }
  return out;
}
// its REACTIONS, what it does on another's turn: `counter` the chance it strikes back at one whose blow was aimed at it
// alone, `cover` it steps before a badly hurt ally a foe's blow is aimed at, `revive` the share of its HP it rises with,
// once a fight, as it falls
function readReacts(d, where, keys = REACT_KEYS) {
  const out = {};
  if (keys.includes('counter') && d.counter !== undefined) { if (!(num(d.counter) && d.counter > 0 && d.counter <= 1)) throw err(`${where}.counter is the chance it strikes back, above 0, at most 1`); out.counter = d.counter; }
  if (keys.includes('cover') && d.cover !== undefined) { if (d.cover !== true) throw err(`${where}.cover is true: it steps before a badly hurt ally`); out.cover = true; }
  if (keys.includes('revive') && d.revive !== undefined) { if (!(num(d.revive) && d.revive > 0 && d.revive <= 1)) throw err(`${where}.revive is the share of its HP it rises with, once a fight, above 0, at most 1`); out.revive = d.revive; }
  return out;
}
// what a plain blow carries: its element, and a status it may leave
function readAttack(d, where) {
  const out = {};
  if (d.element !== undefined) out.element = id(d.element, `${where}.element`);
  if (d.inflict !== undefined) {
    if (d.inflict?.rounds !== undefined && !(Number.isInteger(d.inflict.rounds) && d.inflict.rounds >= 1)) throw err(`${where}.inflict.rounds is 1 or more`);
    out.inflict = readStatusOf(d.inflict, `${where}.inflict`, 0.25);
  }
  return out;
}

// a state of the world's own (beside RPG_STATUSES, the kernel's three), by what it does (presets.js STATE_PRESETS)
// what a state does beside a held turn, a bar on casting, blows gone wide, blows at anyone, HP each turn and its rates:
// `stats` its bearer's numbers scaled while it lasts ({ atk?, def?, mag?, spd? }: a haste's speed, a slow's), `takes` the
// damage it takes scaled ({ blow?, spell? }: a barrier's blows, a shell's spells), `berserk` it attacks a foe of its own
// accord, `reflect` a spell aimed at it alone turns back on its caster, `taunt` the foes' blows and spells aimed at one
// come to it, `doom` it falls as the state runs out; and `stack`, what one cast on a bearer already in it does: refresh
// (its rounds anew, the default), keep (nothing), add (its rounds added, nine at most)
export const STATE_DOES = Object.freeze(['skip', 'noCast', 'miss', 'wild', 'tick', 'stats', 'takes', 'berserk', 'reflect', 'taunt', 'doom', ...REACT_KEYS]);
const STATE_KEYS = ['name', 'said', 'rounds', 'skip', 'noCast', 'miss', 'wild', 'tick', 'wake', ...RATE_KEYS, 'stats', 'takes', 'berserk', 'reflect', 'taunt', 'doom', 'stack', ...REACT_KEYS];
function readState(k, d, where) {
  if (RPG_STATUSES[k]) throw err(`${where}: '${k}' is the kernel's own status; a state of the world's own takes another name`);
  if (!isObj(d)) throw err(`${where} is { ${STATE_KEYS.join(', ')} }: a state, by what it does`);
  keysOnly(d, STATE_KEYS, where);
  for (const f of ['skip', 'noCast', 'wild', 'berserk', 'reflect', 'taunt', 'doom']) if (d[f] !== undefined && d[f] !== true) throw err(`${where}.${f} is true, or left out`);
  if (d.miss !== undefined && !(num(d.miss) && d.miss > 0 && d.miss < 1)) throw err(`${where}.miss is the share of its blows that go wide, above 0 and below 1`);
  if (d.tick !== undefined && !(num(d.tick) && d.tick !== 0 && Math.abs(d.tick) < 1)) throw err(`${where}.tick is a share of its HP each turn, below 0 to hurt, above to mend (not 0, under 1 either way)`);
  if (d.wake !== undefined && d.wake !== 'hit') throw err(`${where}.wake is 'hit': a blow ends it`);
  if (d.rounds !== undefined && !(Number.isInteger(d.rounds) && d.rounds >= 1)) throw err(`${where}.rounds is how many turns it lasts, 1 or more`);
  const scaled = (v, keys, at, lo, hi) => {
    if (v === undefined) return undefined;
    if (!isObj(v) || !Object.keys(v).length) throw err(`${at} is { ${keys.join('?, ')}? }: each a multiple, ${lo} to ${hi}`);
    keysOnly(v, keys, at);
    for (const [x, n] of Object.entries(v)) if (!(num(n) && n >= lo && n <= hi && n !== 1)) throw err(`${at}.${x} is a multiple, ${lo} to ${hi} (not 1)`);
    return { ...v };
  };
  const stats = scaled(d.stats, BUFF_STATS, `${where}.stats`, 0.25, 4), takes = scaled(d.takes, ['blow', 'spell'], `${where}.takes`, 0, 2);
  if (d.stack !== undefined && !['refresh', 'keep', 'add'].includes(d.stack)) throw err(`${where}.stack is refresh (its rounds anew), keep (nothing) or add (its rounds added)`);
  readRates(d, where);
  if (!STATE_DOES.some((f) => d[f]) && !RATE_KEYS.some((r) => d[r])) throw err(`${where} does nothing: ${STATE_DOES.join(', ')}, or a rate (${RATE_KEYS.join(', ')})`);
  return { name: d.name ?? words(k), said: d.said ?? words(k).toLowerCase(), rounds: d.rounds ?? 3, ...Object.fromEntries(['skip', 'noCast', 'miss', 'wild', 'tick', 'wake', 'berserk', 'reflect', 'taunt', 'doom', 'stack'].filter((f) => d[f] !== undefined).map((f) => [f, d[f]])),
    ...(stats ? { stats } : {}), ...(takes ? { takes } : {}), ...readRates(d, where), ...readReacts(d, where) };
}
// (the statuses a skill or an item may name: the kernel's three, the world's own states, the starter book's)
let knownStates = null;
const isStatus = (s) => !!RPG_STATUSES[s] || !!(knownStates && (s in knownStates || STATE_PRESETS[s]));
const statusWords = () => [...Object.keys(RPG_STATUSES), ...Object.keys(knownStates ?? {}), ...Object.keys(STATE_PRESETS)].filter((x, i, a) => a.indexOf(x) === i);

// a status an effect leaves: { is, chance?, rounds? } (a state of the world's own lasts its own rounds unless it says)
function readStatusOf(v, where, chance = 1) {
  if (!isObj(v) || !isStatus(v.is)) throw err(`${where} is { is: ${statusWords().join(' | ')}, chance?, rounds? }`);
  keysOnly(v, ['is', 'chance', 'rounds'], where);
  if (v.chance !== undefined && !(num(v.chance) && v.chance > 0 && v.chance <= 1)) throw err(`${where}.chance is above 0, at most 1`);
  const own = !RPG_STATUSES[v.is] ? (knownStates[v.is] ?? STATE_PRESETS[v.is]) : null;
  return { is: v.is, chance: v.chance ?? chance, rounds: v.rounds ?? (own && own.rounds) ?? 3 };
}
// a buff an effect gives: { stat, pct, rounds? }
function readBuffOf(v, where) {
  if (!isObj(v) || !BUFF_STATS.includes(v.stat) || !num(v.pct) || v.pct === 0) throw err(`${where} is { stat: ${BUFF_STATS.join(' | ')}, pct: a share up (0.5) or down (-0.3), rounds? }`);
  keysOnly(v, ['stat', 'pct', 'rounds'], where);
  return { stat: v.stat, pct: v.pct, rounds: v.rounds ?? 3 };
}
// the DAMAGE a harmful effect deals, beside the usual (its power and its stat's share, less the target's guard):
// gravity a share of the target's HP as it stands (power: the share; a foe immune to 'gravity' takes none), fixed its
// power exactly, pierce the usual with no guard against it, mp the usual taken from the target's MP
export const DAMAGE_FORMS = Object.freeze(['gravity', 'fixed', 'pierce', 'mp']);
function readSkill(k, d, where) {
  keysOnly(d, ['name', 'about', 'mp', 'target', 'power', 'stat', 'scale', 'element', 'heal', 'revive', 'cure', 'status', 'buff', 'carry', 'juice', 'hits', 'damage', 'drain', 'steal'], where);
  optNum(d.mp, `${where}.mp`); optNum(d.power, `${where}.power`); optNum(d.scale, `${where}.scale`);
  const heal = !!d.heal, revive = !!d.revive;
  const target = d.target ?? (heal || revive || d.cure ? 'ally' : 'foe');
  if (!RPG_TARGETS.includes(target)) throw err(`${where}.target is ${RPG_TARGETS.join(', ')}`);
  if (d.stat !== undefined && d.stat !== 'atk' && d.stat !== 'mag') throw err(`${where}.stat is atk (a blow, against defence) or mag (a spell)`);
  const stat = d.stat ?? (heal || revive ? 'mag' : (d.power ?? 0) > 0 ? 'atk' : 'mag');
  const scale = d.scale ?? (d.stat !== undefined || (d.power ?? 0) > 0 ? 1 : 0);
  const cure = listOf(d.cure, `${where}.cure`, 'statuses');
  for (const s of cure) if (!isStatus(s)) throw err(`${where}.cure: '${s}' is not a status (${statusWords().join(', ')})`);
  const status = d.status !== undefined ? readStatusOf(d.status, `${where}.status`) : null;
  const buff = d.buff !== undefined ? readBuffOf(d.buff, `${where}.buff`) : null;
  const power = d.power ?? 0, harm = !heal && !revive && (power > 0 || scale > 0);
  // (the EFFECTS beside the blow: how many times it strikes, the form its damage takes, what it drains back, a theft)
  if (d.hits !== undefined && !(Number.isInteger(d.hits) && d.hits >= 2 && d.hits <= 8)) throw err(`${where}.hits is how many times it strikes, 2 to 8`);
  if (d.damage !== undefined && !DAMAGE_FORMS.includes(d.damage)) throw err(`${where}.damage is ${DAMAGE_FORMS.join(', ')} (gravity a share of the target's HP, fixed its power exactly, pierce no guard against it, mp from the MP)`);
  if (d.damage === 'gravity' && !(power > 0 && power <= 1)) throw err(`${where}.power is the share of the target's HP a gravity takes, above 0, at most 1`);
  if (d.damage === 'fixed' && !(power >= 1)) throw err(`${where}.power is the damage a fixed blow deals exactly, 1 or more`);
  if ((d.hits !== undefined || d.damage !== undefined || d.drain !== undefined) && !harm) throw err(`${where}: hits, damage and drain shape a harmful skill: give it power`);
  if (d.drain !== undefined && !(num(d.drain) && d.drain > 0 && d.drain <= 1)) throw err(`${where}.drain is the share of what it deals the user takes back (HP, or MP for mp damage), above 0, at most 1`);
  if (d.steal !== undefined && d.steal !== true) throw err(`${where}.steal is true: it takes a foe's first drop into the bag, once a foe`);
  if (!harm && !heal && !revive && !cure.length && !status && !buff && !d.steal) throw err(`${where} does nothing: give it power (a blow or a spell), heal, revive, cure, status, buff or steal`);
  return {
    id: k, name: d.name ?? words(k), about: d.about ?? '', mp: d.mp ?? 0, target, power, stat, scale, harm,
    element: d.element !== undefined ? id(d.element, `${where}.element`) : null, heal, revive, cure, status, buff, carry: !!d.carry,
    // (only a skill that has them carries them: every other's as it was)
    ...(d.hits !== undefined ? { hits: d.hits } : {}), ...(d.damage !== undefined ? { damage: d.damage } : {}),
    ...(d.drain !== undefined ? { drain: d.drain } : {}), ...(d.steal ? { steal: true } : {}),
  };
}

// a foe's action pattern: its rows, each a thing it does (an attack, a guard or a skill), when, and how often among
// those that hold (kernel.js patternPick)
const WHEN_KEYS = ['hpBelow', 'hpAbove', 'turn', 'every', 'after'];
function readPattern(v, where) {
  return listOf(v, where, '{ use, when?, weight?, charge? }').map((r, i) => {
    const at = `${where}[${i}]`;
    if (!isObj(r)) throw err(`${at} is { use: 'attack' | 'guard' | '<skill>', when?, weight?, charge? }`);
    keysOnly(r, ['use', 'when', 'weight', 'charge'], at);
    const use = id(r.use, `${at}.use`);
    // (a charge: a turn gathering, said, then the blow let go; a guard has nothing to gather)
    if (r.charge !== undefined && !(r.charge === true || (typeof r.charge === 'string' && r.charge.trim() && r.charge.length <= 80))) throw err(`${at}.charge is true or the line said as it gathers ({name} the foe's), 80 characters at most`);
    if (r.charge !== undefined && use === 'guard') throw err(`${at}.charge is for a blow or a skill: a guard has nothing to gather`);
    if (r.weight !== undefined && !(Number.isInteger(r.weight) && r.weight >= 1 && r.weight <= 9)) throw err(`${at}.weight is a whole number from 1 to 9 (how often among the rows that hold; 5 when left out)`);
    let when = null;
    if (r.when !== undefined) {
      if (!isObj(r.when)) throw err(`${at}.when is { ${WHEN_KEYS.join(', ')} }: its HP below or above a share (0 to 1), its nth turn, every nth, from its nth on`);
      keysOnly(r.when, WHEN_KEYS, `${at}.when`);
      for (const k of ['hpBelow', 'hpAbove']) if (r.when[k] !== undefined && !(num(r.when[k]) && r.when[k] > 0 && r.when[k] < 1)) throw err(`${at}.when.${k} is a share of its HP, above 0 and below 1`);
      for (const k of ['turn', 'every', 'after']) if (r.when[k] !== undefined && !(Number.isInteger(r.when[k]) && r.when[k] >= 1)) throw err(`${at}.when.${k} is a whole number of its own turns, 1 or more`);
      when = { ...r.when };
    }
    return { use, ...(when ? { when } : {}), weight: r.weight ?? 5, ...(r.charge !== undefined ? { charge: r.charge } : {}) };
  });
}

// a fight's own pages (kernel.js pages): each said once, when its moment first holds
const PAGE_WHEN = ['start', 'foe', 'hpBelow', 'round'];
function readFightPages(v, kinds, where, foeIds = kinds) {
  const shape = '{ when, say, who?, sets?, summon?, heal? }';
  return listOf(v, where, shape).map((p, i) => {
    const at = `${where}[${i}]`;
    if (!isObj(p)) throw err(`${at} is ${shape}: a fight's page, said once when its moment holds`);
    keysOnly(p, ['when', 'say', 'who', 'sets', 'summon', 'heal'], at);
    if (!isObj(p.when)) throw err(`${at}.when is { start: true } | { foe?, hpBelow } | { round }: the fight begun, a foe under a share of its HP, its nth round reached`);
    keysOnly(p.when, PAGE_WHEN, `${at}.when`);
    const w = p.when;
    if (w.start !== undefined && w.start !== true) throw err(`${at}.when.start is true: as the fight begins`);
    if (w.start && Object.keys(w).length > 1) throw err(`${at}.when.start stands alone`);
    if (w.foe !== undefined && !kinds.includes(w.foe)) throw err(`${at}.when.foe is one of the fight's foes (${[...new Set(kinds)].join(', ')})`);
    if (w.hpBelow !== undefined && !(num(w.hpBelow) && w.hpBelow > 0 && w.hpBelow < 1)) throw err(`${at}.when.hpBelow is a share of the foe's HP, above 0 and below 1`);
    if (w.round !== undefined && !(Number.isInteger(w.round) && w.round >= 1)) throw err(`${at}.when.round is a whole number, the fight's nth round (or turn on the timeline)`);
    if (!w.start && w.hpBelow === undefined && w.round === undefined) throw err(`${at}.when names its moment: start, hpBelow or round`);
    const say = [].concat(p.say ?? []);
    if (!say.length || !say.every((t) => typeof t === 'string' && t.trim())) throw err(`${at}.say is text | [text, …]: what is said`);
    if (p.who !== undefined && !(typeof p.who === 'string' && p.who.trim())) throw err(`${at}.who is the speaker's name, shown before the words`);
    if (p.sets !== undefined) id(p.sets, `${at}.sets`);
    // (what the page DOES as it is said: foes called into the fight, a share of HP given back)
    const summon = p.summon === undefined ? null : listOf(p.summon, `${at}.summon`, 'foe ids');
    if (summon && (!summon.length || !summon.every((k) => foeIds.includes(k)))) throw err(`${at}.summon is a list of foes (${foeIds.join(', ')}) called into the fight as the page is said`);
    if (p.heal !== undefined && !(num(p.heal) && p.heal > 0 && p.heal <= 1)) throw err(`${at}.heal is a share of HP given back, above 0, at most 1: to the foe the page's when names, else to every foe standing`);
    return { when: { ...w }, say, ...(p.who ? { who: p.who } : {}), ...(p.sets ? { sets: p.sets } : {}), ...(summon ? { summon: [...summon] } : {}), ...(p.heal !== undefined ? { heal: p.heal } : {}) };
  });
}

// a foe's PHASES (kernel.js phases): each a form it takes the first time its HP falls under a share, in order, the
// rows it names replacing its own (its pattern, its traits, its numbers), said and roared as it comes
const PHASE_TRAITS = ['weak', 'resist', 'absorb', 'immune'], PHASE_STATS = ['atk', 'def', 'mag', 'spd'];
function readPhases(v, where) {
  const shape = '{ below, say?, pattern?, weak?, resist?, absorb?, immune?, atk?, def?, mag?, spd? }';
  let last = 1;
  return listOf(v, where, shape).map((p, i) => {
    const at = `${where}[${i}]`;
    if (!isObj(p)) throw err(`${at} is ${shape}: a form it takes when its HP falls under a share`);
    keysOnly(p, ['below', 'say', 'pattern', ...PHASE_TRAITS, ...PHASE_STATS], at);
    if (!(num(p.below) && p.below > 0 && p.below < last)) throw err(`${at}.below is a share of its HP, above 0 and below 1, each phase under the one before`);
    last = p.below;
    if (p.say !== undefined && !(typeof p.say === 'string' && p.say.trim() && p.say.length <= 80)) throw err(`${at}.say is the line said as it changes ({name} the foe's), 80 characters at most`);
    for (const s of PHASE_STATS) if (p[s] !== undefined && !(num(p[s]) && p[s] >= 0)) throw err(`${at}.${s} is its new ${s}, a number`);
    if (!PHASE_TRAITS.some((t) => p[t] !== undefined) && !PHASE_STATS.some((t) => p[t] !== undefined) && p.pattern === undefined) throw err(`${at} changes nothing: give it a pattern, traits (${PHASE_TRAITS.join(', ')}) or numbers (${PHASE_STATS.join(', ')})`);
    const out = { below: p.below };
    if (p.say !== undefined) out.say = p.say;
    if (p.pattern !== undefined) out.pattern = readPattern(p.pattern, `${at}.pattern`);
    for (const t of PHASE_TRAITS) if (p[t] !== undefined) out[t] = t === 'immune' ? listOf(p[t], `${at}.immune`, 'elements and statuses').map((e, j) => id(e, `${at}.immune[${j}]`)) : elements(p[t], `${at}.${t}`);
    for (const s of PHASE_STATS) if (p[s] !== undefined) out[s] = p[s];
    return out;
  });
}

function readFoe(k, d, where) {
  keysOnly(d, ['name', ...RPG_STATS, 'xp', 'gold', 'cp', 'weak', 'resist', 'absorb', 'immune', 'skills', 'drops', 'boss', 'pattern', 'phases', ...RATE_KEYS, 'element', 'inflict', 'counter', 'revive'], where);
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
    // (only a foe that has one carries it: every other's numbers as they were)
    ...(d.pattern !== undefined ? { pattern: readPattern(d.pattern, `${where}.pattern`) } : {}),
    ...(d.phases !== undefined ? { phases: readPhases(d.phases, `${where}.phases`) } : {}),
    // (its rates and what its plain blow carries, where it names them)
    ...readRates(d, where), ...readAttack(d, where), ...readReacts(d, where, ['counter', 'revive']),
  };
}

function readItem(k, d, where) {
  keysOnly(d, ['name', 'price', 'heal', 'mp', 'revive', 'cure', 'hurt', 'element', 'target', 'status', 'buff'], where);
  for (const s of ['heal', 'mp', 'hurt', 'price']) optNum(d[s], `${where}.${s}`);
  const cure = listOf(d.cure, `${where}.cure`, 'statuses');
  for (const s of cure) if (!isStatus(s)) throw err(`${where}.cure: '${s}' is not a status (${statusWords().join(', ')})`);
  // (an item may leave a status, a sleep powder's on the foes, or give a buff, a tonic's on an ally)
  const status = d.status !== undefined ? readStatusOf(d.status, `${where}.status`) : null, buff = d.buff !== undefined ? readBuffOf(d.buff, `${where}.buff`) : null;
  if (!d.heal && !d.mp && !d.revive && !cure.length && !d.hurt && !status && !buff) throw err(`${where} does nothing in a fight: heal, mp, revive, cure, hurt, status or buff`);
  const target = d.target ?? (d.hurt || status ? 'foe' : 'ally');
  if (!RPG_TARGETS.includes(target) || target === 'self') throw err(`${where}.target is foe, foes, ally or allies`);
  return { name: d.name ?? words(k), heal: d.heal ?? 0, mp: d.mp ?? 0, revive: !!d.revive, cure, hurt: d.hurt ?? 0, element: d.element !== undefined ? id(d.element, `${where}.element`) : null, target, ...(status ? { status } : {}), ...(buff ? { buff } : {}) };
}

/** play.rpg → the kernel's cfg, or null. Every name is checked; errors say what a field is. */
export function readRpg(play) {
  const P = play && play.rpg;
  if (P === undefined) return null;
  if (!isObj(P)) throw err(' is { party, classes?, skills?, foes?, items?, encounters?, random?, rules? }');
  keysOnly(P, ['party', 'classes', 'skills', 'foes', 'items', 'gear', 'encounters', 'random', 'shops', 'rules', 'juice', 'states'], '');
  // the world's own states (read first: a skill or an item names them), each its definition, or true for the preset
  const statesGiven = table(P.states, '.states') ?? {};
  knownStates = Object.fromEntries(Object.entries(statesGiven).map(([k, d]) => [id(k, '.states key'), d === null ? STATE_PRESETS[k] ?? (() => { throw err(`.states: '${k}' is no preset state (${Object.keys(STATE_PRESETS).join(', ')}): define it ({ said, skip | noCast | miss | wild | tick, rounds? })`); })() : d]));

  // the rules
  const Ru = P.rules ?? {};
  if (!isObj(Ru)) throw err('.rules is { gold?, defeat?, switch?, carry?, foeHp?, turns?, size?, cap?, xp?, cp?, sp?, seed?, view? }');
  // (view: where a fight is seen from, the side by default; written only where the book asks another)
  // (stage: where a fight is fought: on the map as it stands, 'live', the default; 'arena', a place solved near where it
  // was met on the map's own ground, cleared of what stands in it, the party on the left; or 'backdrop', the fighters on
  // an arena of their own before a background drawn once from the map: scene/channels)
  keysOnly(Ru, [...Object.keys(RPG_RULES), 'view', 'cinema', 'stage'], '.rules');
  // (cinema: a skill (or every action) played as a short film: a close-up on the actor, behind it at its target, the
  // target as it lands, back to the view; ui what stays on the screen meanwhile; skip the seconds past which it may be
  // cut short)
  if (Ru.cinema !== undefined) {
    const C = Ru.cinema;
    if (!isObj(C)) throw err(".rules.cinema is { on?: 'skills' | 'all', ui?: 'none' | 'numbers' | 'all', skip?: seconds }");
    keysOnly(C, ['on', 'ui', 'skip'], '.rules.cinema');
    if (C.on !== undefined && !['skills', 'all'].includes(C.on)) throw err(".rules.cinema.on is 'skills' (a skill's use) or 'all' (every action)");
    if (C.ui !== undefined && !['none', 'numbers', 'all'].includes(C.ui)) throw err(".rules.cinema.ui is 'none' (the screen clear), 'numbers' (the numbers and the action's name) or 'all'");
    if (C.skip !== undefined && !(num(C.skip) && C.skip >= 0)) throw err('.rules.cinema.skip is the seconds past which a film may be skipped (0: always)');
  }
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
    if (d0) keysOnly(d0, ['name', 'about', 'base', 'growth', 'skills', 'opens', 'start', ...TRAIT_KEYS], at);
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
    classes[k] = { name: d.name ?? words(k), about: d.about ?? '', base: readStatBlock(d.base, `${at}.base`, DEFAULT_BASE), growth: readStatBlock(d.growth, `${at}.growth`, DEFAULT_GROWTH), skills, opens: d.opens ?? null, start: d.start === undefined ? {} : readWorn(d.start, `${at}.start`), ...((t) => (t ? { traits: t } : {}))(readTraits(d, at)) };
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
    for (const r of [...(foes[k].pattern ?? []), ...(foes[k].phases ?? []).flatMap((p) => p.pattern ?? [])]) if (r.use !== 'attack' && r.use !== 'guard') skillWant.add(r.use);
  }

  // (the skills a class or a piece of gear grants are wanted too: the gear given, gathered here, read below)
  for (const [c, C] of Object.entries(givenClasses)) for (const k of (C ?? CLASS_PRESETS[c] ?? {}).grants ?? []) if (typeof k === 'string') skillWant.add(k);
  for (const d of Object.values(table(P.gear, '.gear') ?? {})) for (const k of (isObj(d) && Array.isArray(d.grants) ? d.grants : [])) if (typeof k === 'string') skillWant.add(k);
  for (const d of Object.values(GEAR_PRESETS)) for (const k of d.grants ?? []) skillWant.add(k);
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
    keysOnly(d, ['name', 'price', 'slot', ...RPG_STATS, 'classes', ...TRAIT_KEYS], at);
    optNum(d.price, `${at}.price`);
    if (!GEAR_SLOTS.includes(d.slot)) throw err(`${at}.slot is ${GEAR_SLOTS.join(', ')}`);
    for (const st of RPG_STATS) if (d[st] !== undefined && !num(d[st])) throw err(`${at}.${st} is a number it adds`);
    if (items[k]) throw err(`${at}: '${k}' is a battle item too; an item is worn or used, not both`);
    const own = isObj(play.items) && isObj(play.items[k0]) && typeof play.items[k0].name === 'string' ? play.items[k0].name : null;
    const traits = readTraits(d, at);
    gear[k] = { name: own ?? d.name ?? words(k), slot: d.slot, mods: Object.fromEntries(RPG_STATS.filter((st) => d[st]).map((st) => [st, d[st]])), classes: d.classes ? [...d.classes] : null, ...(traits ? { traits } : {}) };
  }
  for (const [where, w] of [...Object.entries(classes).map(([c, C]) => [`.classes.${c}.start`, C.start]), ...party0.map((p, i) => [`.party[${i}].gear`, p.gear ?? {}])]) {
    for (const [slot, it] of Object.entries(w)) if (gear[it].slot !== slot) throw err(`${where}.${slot}: ${gear[it].name} is worn as ${gear[it].slot}`);
  }

  // the encounters
  const encSeen = new Set(), encounters = {}, met = [];
  E.forEach((e, i) => {
    const at = `.encounters[${i}]`;
    if (!isObj(e)) throw err(`${at} is { id, foes, at?, who?, near?, flee?, room? }`);
    keysOnly(e, ['id', 'foes', 'at', 'who', 'near', 'flee', 'room', 'pages'], at);
    id(e.id, `${at}.id`);
    if (e.id === 'random') throw err(`${at}.id 'random' is the random encounters' own`);
    if (encSeen.has(e.id)) throw err(`${at}.id '${e.id}' twice`);
    encSeen.add(e.id);
    if (!Array.isArray(e.foes) || !e.foes.length || e.foes.length > 6) throw err(`${at}.foes is 1 to 6 foe ids`);
    if (e.at !== undefined && !(Array.isArray(e.at) && e.at.length >= 2 && e.at.slice(0, 2).every(num))) throw err(`${at}.at is where it stands [x, y]`);
    const ent = (v) => typeof v === 'string' && /^[a-z][a-z0-9_-]*$/i.test(v);
    // (its pages' summons: the foes called in, after its own, six at most in all; each may have a figure of its own past
    // the foes' in `who`, minted asleep, `dormant: true`, woken as it comes)
    const pages = e.pages !== undefined ? readFightPages(e.pages, e.foes, `${at}.pages`, Object.keys(foes)) : null;
    const called = (pages ?? []).reduce((n, p) => n + (p.summon ? p.summon.length : 0), 0);
    if (e.foes.length + called > 6) throw err(`${at}.pages summon ${called} foes to its ${e.foes.length}: six fight at most`);
    if (e.who !== undefined && !(ent(e.who) || (Array.isArray(e.who) && e.who.length >= e.foes.length && e.who.length <= e.foes.length + called && e.who.every(ent)))) throw err(`${at}.who is the entity standing for it on the map, or one for each of its foes, in their order (and for each foe its pages summon, minted dormant)`);
    if (e.who !== undefined && e.at === undefined) throw err(`${at}.who stands somewhere: give its at`);
    optNum(e.near, `${at}.near`);
    if (e.flee !== undefined && typeof e.flee !== 'boolean') throw err(`${at}.flee is false for a fight with no escape`);
    if (e.room !== undefined && !(Array.isArray(e.room) && e.room.length === 5 && e.room.every(num) && e.room[2] > e.room[0] && e.room[3] > e.room[1])) throw err(`${at}.room is the room it is fought in, [x0, y0, x1, y1, floor]`);
    const boss = e.foes.some((f) => foes[f].boss);
    encounters[e.id] = { foes: [...e.foes], flee: e.flee ?? !boss, ...(pages ? { pages } : {}) };
    if (e.at) met.push({ id: e.id, at: [e.at[0], e.at[1]], who: e.who ?? null, near: e.near ?? 2.2, ...(e.room ? { room: [...e.room] } : {}) });
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

  // the shops: what each sells at its price (the world's own, else the preset's), whether it buys back at half, and an
  // inn's stay; only a world with shops carries them (absent: zero bytes)
  let shops = null;
  if (P.shops !== undefined) {
    if (!isObj(P.shops) || !Object.keys(P.shops).length) throw err('.shops is { <id>: { name?, wares?: [item or gear ids], buys?: false, inn?: gold } }');
    shops = {};
    const priceOf = (k) => {
      const own = isObj(play.items) && isObj(play.items[k]) ? play.items[k].price : isObj(play.gear) && isObj(play.gear[k]) ? play.gear[k].price : undefined;
      return own ?? (ITEM_PRESETS[k] ?? GEAR_PRESETS[k])?.price;
    };
    for (const [sid, S] of Object.entries(P.shops)) {
      const at = `.shops.${sid}`;
      id(sid, at);
      if (!isObj(S)) throw err(`${at} is { name?, wares?, buys?, inn? }`);
      keysOnly(S, ['name', 'wares', 'buys', 'inn', 'raise'], at);
      const wares = listOf(S.wares, `${at}.wares`, 'item or gear ids').map((w0, i) => {
        const w = itemKey(w0), kind = items[w] ? 'item' : gear[w] ? 'gear' : null, price = priceOf(w0);
        if (!kind) throw err(`${at}.wares[${i}]: '${w0}' is none of the world's items or gear`);
        if (!(num(price) && price > 0)) throw err(`${at}.wares[${i}]: '${w0}' has no price: give it one (items.${w0}.price or gear.${w0}.price)`);
        return { item: w, kind, price: Math.round(price) };
      });
      if (S.buys !== undefined && typeof S.buys !== 'boolean') throw err(`${at}.buys is false for a shop that buys nothing back`);
      if (S.inn !== undefined && !(Number.isInteger(S.inn) && S.inn >= 0)) throw err(`${at}.inn is the gold a night's stay costs (0 or more)`);
      // (raise: a temple's rite, the gold to raise one fallen member, healed and cured)
      if (S.raise !== undefined && !(Number.isInteger(S.raise) && S.raise >= 0)) throw err(`${at}.raise is the gold to raise one fallen member (0 or more)`);
      if (!wares.length && S.inn === undefined && S.raise === undefined) throw err(`${at} sells nothing, is no inn and raises no one: give it wares, an inn's price or a temple's (raise)`);
      shops[sid] = { name: typeof S.name === 'string' && S.name ? S.name : S.raise !== undefined && !wares.length ? 'Temple' : S.inn !== undefined && !wares.length ? 'Inn' : 'Shop', wares, buys: wares.length ? S.buys !== false : false, inn: S.inn ?? null, ...(S.raise !== undefined ? { raise: S.raise } : {}) };
    }
  }

  // the juice: the defaults, the world's own, each skill's own (juice.js)
  const juice = readJuice(P.juice, { skills: Object.fromEntries(Object.entries(skillsGiven).map(([k, d0]) => [k, { juice: (d0 ?? SKILL_PRESETS[k]).juice }])) });
  // (the states the fight can meet: the world's own, and any preset a skill or an item names; none, no key)
  const used = new Set(Object.keys(knownStates));
  for (const S of Object.values(skills)) { if (S.status && !RPG_STATUSES[S.status.is]) used.add(S.status.is); for (const c of S.cure ?? []) if (!RPG_STATUSES[c]) used.add(c); }
  for (const I of Object.values(items)) { for (const c of I.cure ?? []) if (!RPG_STATUSES[c]) used.add(c); if (I.status && !RPG_STATUSES[I.status.is]) used.add(I.status.is); }
  // (and any a blow leaves: a class's, a piece of gear's or a foe's `inflict`)
  for (const T of [...Object.values(classes).map((c) => c.traits), ...Object.values(gear).map((g) => g.traits), ...Object.values(foes)]) if (T?.inflict && !RPG_STATUSES[T.inflict.is]) used.add(T.inflict.is);
  const states = used.size ? Object.fromEntries([...used].sort().map((k) => [k, readState(k, knownStates[k] ?? STATE_PRESETS[k], `.states.${k}`)])) : null;
  knownStates = null;
  return { seed: rules.seed, party: party0, classes, skills, foes, items, gear, encounters, random, met, juice, ...(states ? { states } : {}), ...(shops ? { shops } : {}), rules: { ...rules, xp: { ...rules.xp }, cp: [...rules.cp] } };
}

const doneVar = (enc) => `rpg-done-${enc}`;
/** A pack won on a page that carries flags stays won: the flag it sets as it falls, carried (playscape/ui/scenes.js). */
export const wonFlag = (id) => `won-${id}`;

/** The cues: walking up to a standing encounter starts it (once won, never again); a won one's foes leave in smoke; a lost
 * fight fails the level under `defeat: 'fail'` (the hp var a level's fail-on-death owns goes to 0). */
export function rpgCues(play) {
  const cfg = readRpg(play);
  if (!cfg) return [];
  const cues = [];
  for (const e of cfg.met) {
    cues.push({ id: `rpg-meet-${e.id}`, when: { enter: { at: e.at, r: e.near } }, if: [{ var: 'rpg.battle', eq: 0 }, { var: doneVar(e.id), eq: 0 }], then: { emit: `rpg-battle:${e.id}` } });
    // (a beaten pack leaves the map in a puff of smoke, as a won fight's foes do: a fallen body left lying read as a pack
    // still to fight)
    // (on a page that carries flags, a won pack stays won: its flag set as it falls, and carried in it is gone at once,
    // never fought again on a way walked back)
    const kept = typeof play?.carry === 'string';
    cues.push({ id: `rpg-beaten-${e.id}`, when: { on: `rpg-won:${e.id}` }, then: [{ set: doneVar(e.id), to: 1 }, ...[].concat(e.who ?? []).map((w) => ({ vanish: { who: w, with: 'smoke' } })), ...(kept ? [{ emit: `flag:${wonFlag(e.id)}` }] : [])] });
    if (kept) cues.push({ id: `rpg-won-before-${e.id}`, when: { on: `flag-carried:${wonFlag(e.id)}` }, then: [{ set: doneVar(e.id), to: 1 }, ...[].concat(e.who ?? []).map((w) => ({ vanish: w }))] });
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
