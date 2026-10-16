/**
 * BATTLE JUICE — what a fight's moments feel like: the hit that jolts, the crit that flashes and holds, the fire that
 * bursts on the foe. Data, composed: a JUICE is a list of STEPS, a step may name another juice, and the world binds
 * juices to the fight's HAPPENINGS (`on`), the most specific binding winning. Defaults ship; a world's own lie over
 * them; and every beat also says its happenings on the bus (`rpg-on:<key>`), so any cue answers with anything a cue
 * can do: that is how a world grows its own systems on the fight.
 *
 *   play.rpg.juice: false | { on?: { <happening>: juice }, also?: { <happening>: juice }, <name>: [step | '<name>', …] }
 *     on     one juice a beat: its most specific happening's
 *     also   layered over it: every happening of the beat that has one adds its steps (a weakness's emphasis over the
 *            element's burst)
 *   a skill's juice: juice | { cast?: juice, land?: juice }   (its own, over any binding)
 *   juice = '<name>' | step | [step | '<name>', …]
 *
 *   STEPS (JUICE_STEPS)
 *     on the map, at a figure (the target's, or the actor's: at: 'actor'):
 *       { puff: '<moment>', at?, color?, scale? }   a moment plays there (playscape/elements/moments.js)
 *       { beam: '<attack>', color? }               an attack flies from the actor to the target (beams.js presets)
 *       { shake: k, for? }                         the camera shakes (k 0..1)
 *     in the window:
 *       { flash: '#rrggbb'?, for? }                the screen flashes
 *       { jolt: 'target' | 'actor' | 'window', k? } its row (or the window) jolts
 *       { pop: 'normal' | 'big' | 'crit' | 'small', color? }   how the number rises
 *     in time:   { hold: seconds }                 the beat lingers (a hit-stop, a pause before the boss)
 *     the bus:   { emit: '<event>' }               any cue may answer it
 *
 *   HAPPENINGS, a beat's keys most specific first (juiceKeys):
 *     a blow     skill:<id>, crit, weak, element:<el>, resist, absorb, hit
 *     a use      cast:<skill>, cast · item:<item>
 *     heal:<skill>, heal · miss · status:<is>, status · ko:<foe>, ko · fall (a member)
 *     start:boss, start · victory · defeat · flee · level · learn
 *
 *   JUICE_PRESETS, JUICE_ON, JUICE_ALSO   the defaults: named juices, what each happening plays, what layers over
 *   readJuice(v, { skills })   → { on: { <key>: [step] }, also: { <key>: [step] }, fx: { puffs, shake, beams: { <name>: spec } } } every name
 *                              resolved; throws, teaching
 *   juiceKeys(beat)            → [keys] (the page runs this function's own source)
 */
import { MOMENTS } from '../elements/moments.js';
import { readBeam, beamLanding, BEAM_NAMES } from '../elements/beams.js';

export const JUICE_STEPS = Object.freeze({
  puff: '{ puff: <moment>, at?: target | actor, color?, scale? } a moment plays at the figure',
  beam: '{ beam: <attack>, color? } an attack flies from the actor\'s figure to the target\'s',
  shake: '{ shake: k (0..1), for?: s } the camera shakes',
  flash: '{ flash: colour?, for?: s } the screen flashes',
  jolt: '{ jolt: target | actor | window, k? } the row (or the window) jolts',
  pop: '{ pop: normal | big | crit | small, color? } how the number rises',
  hold: '{ hold: s } the beat lingers',
  emit: '{ emit: <event> } a bus event, for any cue to answer',
});
const POPS = ['normal', 'big', 'crit', 'small'];
const JOLTS = ['target', 'actor', 'window'];
const HEX = /^#[0-9a-f]{6}$/i;

export const JUICE_PRESETS = Object.freeze({
  hit: [{ pop: 'normal' }, { jolt: 'target' }, { puff: 'sparks', scale: 0.5 }],
  crit: [{ pop: 'crit' }, { flash: '#ffffff', for: 0.08 }, { shake: 0.35 }, { jolt: 'target', k: 2 }, { puff: 'flash' }, { hold: 0.25 }],
  weak: [{ pop: 'big' }, { shake: 0.2 }],
  resist: [{ pop: 'small' }, { jolt: 'target', k: 0.5 }],
  miss: [{ pop: 'small' }],
  heal: [{ pop: 'normal', color: '#7dffa5' }, { puff: 'sparks', color: '#7dffa5', scale: 0.5 }],
  status: [{ puff: 'smoke', scale: 0.5 }],
  ko: [{ puff: 'smoke' }, { shake: 0.2 }, { hold: 0.15 }],
  fall: [{ jolt: 'window', k: 1.5 }, { flash: '#ff3030', for: 0.12 }],
  start: [{ flash: '#ffffff', for: 0.12 }, { shake: 0.25 }],
  boss: [{ flash: '#ff6040', for: 0.3 }, { shake: 0.6 }, { hold: 0.6 }],
  victory: [{ flash: '#ffe07a', for: 0.2 }],
  level: [{ flash: '#ffe07a', for: 0.15 }],
  fire: ['hit', { puff: 'flash', color: '#ff7a2a' }],
  ice: ['hit', { puff: 'splash', color: '#bfe8ff' }],
  thunder: ['hit', { puff: 'strike' }, { flash: '#cfe4ff', for: 0.08 }],
  light: ['hit', { puff: 'flash', color: '#fff3b0' }],
  dark: ['hit', { puff: 'smoke', color: '#4a3a6a' }],
});
export const JUICE_ALSO = Object.freeze({ weak: 'weak', resist: 'resist' });
export const JUICE_ON = Object.freeze({
  hit: 'hit', crit: 'crit', miss: 'miss', heal: 'heal', status: 'status',
  ko: 'ko', fall: 'fall', start: 'start', 'start:boss': 'boss', victory: 'victory', level: 'level',
  'element:fire': 'fire', 'element:ice': 'ice', 'element:thunder': 'thunder', 'element:light': 'light', 'element:dark': 'dark',
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const err = (m) => new Error(`play.rpg.juice${m}`);
const KEY = /^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)?$/;

function readStep(s, where, fx) {
  const k = Object.keys(s).find((x) => JUICE_STEPS[x]);
  if (!k) throw err(`${where} is a step: ${Object.keys(JUICE_STEPS).join(', ')} (or a juice's name)`);
  const allow = { puff: ['puff', 'at', 'color', 'scale'], beam: ['beam', 'color'], shake: ['shake', 'for'], flash: ['flash', 'for'], jolt: ['jolt', 'k'], pop: ['pop', 'color'], hold: ['hold'], emit: ['emit'] }[k];
  for (const x of Object.keys(s)) if (!allow.includes(x)) throw err(`${where}.${x} is not part of a ${k} (${allow.join(', ')})`);
  if (s.color !== undefined && !(typeof s.color === 'string' && (HEX.test(s.color) || /^[a-z]+$/.test(s.color)))) throw err(`${where}.color is '#rrggbb' or a colorant`);
  if (s.at !== undefined && s.at !== 'target' && s.at !== 'actor') throw err(`${where}.at is target or actor`);
  for (const x of ['scale', 'for', 'k']) if (s[x] !== undefined && !(num(s[x]) && s[x] > 0)) throw err(`${where}.${x} is a number above 0`);
  if (k === 'puff') { if (!MOMENTS[s.puff]) throw err(`${where}.puff is a moment: ${Object.keys(MOMENTS).join(', ')}`); fx.puffs.add(s.puff); }
  if (k === 'beam') {
    if (!BEAM_NAMES.includes(s.beam)) throw err(`${where}.beam is an attack: ${BEAM_NAMES.join(', ')}`);
    const spec = readBeam(s.beam, `${where}.beam`);
    fx.beams.set(s.beam, spec);
    return { beam: s.beam, ...(s.color ? { color: s.color } : {}), land: beamLanding(spec) };
  }
  if (k === 'shake') { if (!(num(s.shake) && s.shake > 0 && s.shake <= 1)) throw err(`${where}.shake is 0 to 1`); fx.shake = true; }
  if (k === 'flash' && s.flash !== undefined && !(typeof s.flash === 'string' && HEX.test(s.flash))) throw err(`${where}.flash is '#rrggbb'`);
  if (k === 'jolt' && !JOLTS.includes(s.jolt)) throw err(`${where}.jolt is ${JOLTS.join(', ')}`);
  if (k === 'pop' && !POPS.includes(s.pop)) throw err(`${where}.pop is ${POPS.join(', ')}`);
  if (k === 'hold' && !(num(s.hold) && s.hold > 0 && s.hold <= 3)) throw err(`${where}.hold is seconds, above 0, at most 3`);
  if (k === 'emit' && !(typeof s.emit === 'string' && /^[a-z][a-z0-9:_-]*$/i.test(s.emit))) throw err(`${where}.emit is a bus event`);
  return { ...s };
}

/** A juice (a name, a step, or a list of them) → its steps, every name followed (a cycle refused). */
function flatten(v, where, named, fx, path = []) {
  if (typeof v === 'string') {
    if (!named[v]) throw err(`${where}: '${v}' is no juice (${Object.keys(named).join(', ')})`);
    if (path.includes(v)) throw err(`${where}: '${v}' names itself (${[...path, v].join(' → ')})`);
    return flatten(named[v], `.${v}`, named, fx, [...path, v]);
  }
  if (Array.isArray(v)) return v.flatMap((x, i) => flatten(x, `${where}[${i}]`, named, fx, path));
  if (isObj(v)) return [readStep(v, where, fx)];
  throw err(`${where} is a juice: its name, a step, or a list of them`);
}

/**
 * The juice a fight plays: the presets and the defaults' bindings, the world's own named juices and bindings over
 * them, each skill's own (its `juice`, bound as cast:<id> and skill:<id>). → { on, fx } or null (juice: false).
 */
export function readJuice(v, { skills = {} } = {}) {
  if (v === false) return { on: {}, also: {}, fx: { puffs: [], shake: false, beams: {} } };
  if (v !== undefined && !isObj(v)) throw err(' is false (none), or { on?, also?, <name>: [steps] } over the defaults');
  const own = v ?? {};
  const named = { ...JUICE_PRESETS };
  for (const [k, d] of Object.entries(own)) {
    if (k === 'on' || k === 'also') continue;
    if (!/^[a-z][a-z0-9-]*$/.test(k)) throw err(`.${k}: a juice's name is a lower-case word`);
    named[k] = d;
  }
  if (own.on !== undefined && !isObj(own.on)) throw err('.on is { <happening>: juice }');
  if (own.also !== undefined && !isObj(own.also)) throw err('.also is { <happening>: juice }: layered over the one that wins');
  const bind = { ...JUICE_ON, ...(own.on ?? {}) };
  for (const [id, S] of Object.entries(skills)) {
    if (S.juice === undefined) continue;
    const J = isObj(S.juice) && (S.juice.cast !== undefined || S.juice.land !== undefined) && !Object.keys(S.juice).some((x) => JUICE_STEPS[x]) ? S.juice : { land: S.juice };
    if (J.cast !== undefined) bind[`cast:${id}`] = J.cast;
    if (J.land !== undefined) bind[`skill:${id}`] = J.land;
  }
  const fx = { puffs: new Set(), shake: false, beams: new Map() }, on = {};
  for (const [k, j] of Object.entries(bind)) {
    if (!KEY.test(k)) throw err(`.on.${k}: a happening is a word, or a word and a name (hit, element:fire, ko:slime)`);
    on[k] = flatten(j, `.on.${k}`, named, fx);
  }
  const also = {};
  for (const [k, j] of Object.entries({ ...JUICE_ALSO, ...(own.also ?? {}) })) {
    if (!KEY.test(k)) throw err(`.also.${k}: a happening is a word, or a word and a name`);
    also[k] = flatten(j, `.also.${k}`, named, fx);
  }
  return { on, also, fx: { puffs: [...fx.puffs], shake: fx.shake, beams: Object.fromEntries(fx.beams) } };
}

/** A beat's happenings, most specific first (the page runs this function's own source). */
export function juiceKeys(b) {
  if (!b) return [];
  const k = b.kind, out = [];
  if (k === 'hurt') {
    if (b.skill) out.push('skill:' + b.skill);
    if (b.crit) out.push('crit');
    if (b.mul === 2) out.push('weak');
    if (b.element) out.push('element:' + b.element);
    if (b.mul === 0.5 || b.mul === 0) out.push('resist');
    out.push('hit');
  } else if (k === 'heal') {
    if (b.absorb) out.push('absorb');
    if (b.skill) out.push('heal:' + b.skill);
    out.push('heal');
  } else if (k === 'cast') {
    if (b.skill) out.push('cast:' + b.skill);
    if (b.item) out.push('item:' + b.item);
    out.push('cast');
  } else if (k === 'ko') {
    if (b.foe) out.push('ko:' + b.foe, 'ko'); else out.push('fall');
  } else if (k === 'status') {
    if (b.status) out.push('status:' + b.status);
    out.push('status');
  } else if (k === 'start') {
    if (b.boss) out.push('start:boss');
    out.push('start');
  } else if (k === 'miss') out.push('miss');
  else if (k === 'spoils' && b.xp !== undefined) out.push('victory');
  else if (k === 'end') out.push(b.lost ? 'defeat' : 'flee');
  else if (k === 'level') out.push('level');
  else if (k === 'learn') out.push('learn');
  return out;
}
