/**
 * THE SCENE COMPOSER's reader: a game's intent for an interior, in words or by axis, resolved into one value on each
 * of the bay axes (style/bay-axes.js: construction, palette, plot, dressing). One best guess, no search: each axis takes
 * the value its own words name; an axis the words leave alone takes the register the words lean to as a whole (each
 * register's words, and every axis's, count toward it), else the base (the kit's or the use's register).
 *
 *   COMPOSE_WORDS        { axis: { value: [words] } }: what people say of each axis's values
 *   REGISTER_WORDS       { register: [words] }: what names a whole register (a hangar, a warehouse, a lab, an office)
 *   readCompose(c, base) → { resolved: { construction, palette, plot, dressing }, said: { axis: why } }   pure
 *     c     '<words>' | { words?, register?, mood?, roles?, construction?, palette?, plot?, dressing? }: a named axis is
 *           pinned, a named register is the base; the mood (compose-plot.js: even, drama, noir) read too, the darkest heard;
 *           how much breaks (`destruction`, breakability.js's degrees) the most the words let, the recipe's where it sets none
 *   resolveCompose(manifest) → AUTHORING TIME (create_sketch / update_sketch): a stage's `compose` read and stored as
 *           { intent, resolved, said }; a stored one comes back as it was, so the build never re-decides
 *   composeForBuild(m)   → the resolved axes: the stored ones, else read now (a test, a direct assemble)
 *   rolesPinned(m)       → the rooms' roles the intent pins ({ room: role }, compose-roles.js), or {}
 *   beatsPinned(m)       → the rooms' beats the intent pins ({ room: beat | 'none' }, compose-plot.js), or {}
 *
 * The words are data: a new register, or a new value on an axis, adds its words here and is read like the rest.
 */
import { CONSTRUCTIONS, PALETTES, PLOTS, DRESSINGS, REGISTER_PRESETS } from './style/bay-axes.js';
import { MOODS, MOOD_IDS, BEAT_IDS } from './compose-plot.js';
import { DEGREE_IDS } from '../playscape/destruct/breakability.js';

export const COMPOSE_AXES = Object.freeze(['construction', 'palette', 'plot', 'dressing']);
const TABLES = { construction: CONSTRUCTIONS, palette: PALETTES, plot: PLOTS, dressing: DRESSINGS };
const REGISTERS = Object.keys(REGISTER_PRESETS);

export const REGISTER_WORDS = Object.freeze({
  military: ['military', 'hangar', 'armoury', 'armory', 'bunker', 'barracks', 'silo', 'command post'],
  utility: ['utility', 'warehouse', 'depot', 'plant room', 'factory', 'workshop', 'loading dock', 'garage', 'boiler room'],
  science: ['science', 'lab', 'laboratory', 'research', 'clean room', 'control room', 'facility', 'observatory'],
  everyday: ['everyday', 'office', 'school', 'clinic', 'hospital', 'shop', 'store', 'mall', 'hotel', 'library', 'apartment'],
});

// how much the words let break (playscape/destruct/breakability.js DEGREES): a crate's smashing, a firefight's cover, a
// demolition's walls
export const DESTRUCTION_WORDS = Object.freeze({
  objects: Object.freeze(['smash the crates', 'breakable crates', 'crates break', 'smashable']),
  cover: Object.freeze(['firefight', 'shootout', 'gunfight', 'wreck', 'wrecks', 'wrecked', 'destructible', 'smash']),
  world: Object.freeze(['demolition', 'demolish', 'tear down', 'everything breaks', 'collapse', 'collapses']),
});

export const COMPOSE_WORDS = Object.freeze({
  construction: {
    military: ['steel plate', 'armour plate', 'armor plate', 'board-formed concrete', 'blast door', 'bulkhead', 'vault roof'],
    utility: ['concrete block', 'cinder block', 'cladding', 'standing seam', 'sawtooth roof', 'trusses', 'industrial'],
    science: ['white panels', 'panelled', 'paneled', 'glazed tile', 'terrazzo', 'carbon fibre', 'carbon fiber', 'coffered', 'sterile'],
    everyday: ['drywall', 'plasterboard', 'carpet', 'veneer', 'laminate', 'vinyl floor', 'ceiling tiles', 'suspended ceiling'],
  },
  palette: {
    military: ['military greys', 'military grey', 'gunmetal', 'olive drab', 'olive', 'drab', 'signal orange', 'camouflage'],
    utility: ['safety yellow', 'safety green', 'yellow steel', 'faded', 'grimy', 'oily'],
    science: ['white', 'clinical', 'teal', 'pale', 'spotless', 'pristine'],
    everyday: ['beige', 'neutral', 'muted', 'wood', 'homely', 'corporate', 'pastel'],
  },
  plot: {
    military: ['harsh light', 'red light', 'alarm', 'emergency light', 'searchlight'],
    utility: ['sodium', 'amber light', 'orange light', 'floodlit', 'floodlights', 'work lights'],
    science: ['cold', 'blue light', 'cyan', 'glowing', 'fluorescent', 'bright'],
    everyday: ['warm light', 'soft light', 'daylight', 'downlights', 'cosy', 'cozy', 'exit signs'],
  },
  dressing: {
    military: ['crane', 'gantry', 'grating', 'heavy', 'hazard stripes', 'exposed services'],
    utility: ['pipes', 'conduit', 'cables', 'loading', 'pallets'],
    science: ['instruments', 'equipment'],
    everyday: ['tidy', 'finished', 'carpeted', 'furnished'],
  },
});

// every phrase of the tables, longest first: a phrase heard is taken out of the text, so the words inside it are not heard
// again ('military greys' is the palette's, not 'military grey' as well, nor the register's 'military')
const PHRASES = [...Object.entries(REGISTER_WORDS).flatMap(([r, ws]) => ws.map((w) => ({ w, register: r }))),
  ...Object.entries(MOODS).flatMap(([mood, M]) => M.words.map((w) => ({ w, mood }))),
  ...Object.entries(DESTRUCTION_WORDS).flatMap(([degree, ws]) => ws.map((w) => ({ w, degree }))),
  ...Object.entries(COMPOSE_WORDS).flatMap(([axis, vs]) => Object.entries(vs).flatMap(([v, ws]) => ws.map((w) => ({ w, axis, v }))))]
  .sort((a, b) => b.w.length - a.w.length || (a.w < b.w ? -1 : 1));
// what the text says, phrase by phrase, each a whole word (a plural taken), the text lowered
function hear(text) {
  let t = ` ${text.toLowerCase()} `;
  const heard = [];
  for (const P of PHRASES) {
    const re = new RegExp(`([^a-z])${P.w.replace(/[-]/g, '\\-')}s?(?=[^a-z])`, 'g');
    if (re.test(t)) { heard.push(P); t = t.replace(re, (all, pre) => pre + ' '.repeat(all.length - pre.length)); }
  }
  return heard;
}
const KEYS = ['words', 'register', 'roles', 'mood', 'beats', 'destruction', ...COMPOSE_AXES];

function readIntent(c) {
  if (typeof c === 'string') return { words: c };
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error(`stage: compose is words ('a cold lab under sodium light') or { words?, register?, ${COMPOSE_AXES.join('?, ')}? }`);
  for (const k of Object.keys(c)) if (!KEYS.includes(k)) throw new Error(`stage: compose.${k} is not a setting (${KEYS.join(', ')})`);
  if (c.words !== undefined && typeof c.words !== 'string') throw new Error('stage: compose.words is words');
  if (c.roles !== undefined && (!c.roles || typeof c.roles !== 'object' || Array.isArray(c.roles))) throw new Error('stage: compose.roles is { room: role } (compose-roles.js ROLES)');
  if (c.beats !== undefined && (!c.beats || typeof c.beats !== 'object' || Array.isArray(c.beats) || Object.values(c.beats).some((b) => b !== 'none' && !BEAT_IDS.includes(b)))) throw new Error(`stage: compose.beats is { room: ${BEAT_IDS.join(' | ')} | 'none' }`);
  if (c.destruction !== undefined && !DEGREE_IDS.includes(c.destruction)) throw new Error(`stage: compose.destruction is ${DEGREE_IDS.join(', ')}`);
  if (c.mood !== undefined && !MOOD_IDS.includes(c.mood)) throw new Error(`stage: compose.mood is ${MOOD_IDS.join(', ')}`);
  if (c.register !== undefined && !REGISTERS.includes(c.register)) throw new Error(`stage: compose.register is ${REGISTERS.join(', ')}`);
  for (const a of COMPOSE_AXES) if (c[a] !== undefined && !TABLES[a][c[a]]) throw new Error(`stage: compose.${a} is ${Object.keys(TABLES[a]).join(', ')}`);
  return c;
}

/** The axes the intent asks for, and why each is what it is. */
export function readCompose(c, base = 'everyday') {
  const I = readIntent(c), home = I.register ?? base;
  if (!REGISTERS.includes(home)) throw new Error(`stage: compose: base '${home}' is not a register (${REGISTERS.join(', ')})`);
  // each axis's words, by value; the register the whole leans to (its own words count twice: they name the place)
  const said0 = hear(I.words || '');
  const heard = Object.fromEntries(COMPOSE_AXES.map((a) => [a, Object.fromEntries(Object.keys(COMPOSE_WORDS[a]).map((v) => [v, said0.filter((P) => P.axis === a && P.v === v).map((P) => P.w)]))]));
  const lean = Object.fromEntries(REGISTERS.map((r) => [r, 2 * said0.filter((P) => P.register === r).length + COMPOSE_AXES.reduce((n, a) => n + (heard[a][r]?.length ?? 0), 0)]));
  // (ties go to the base, then the registers' order)
  const order = [home, ...REGISTERS.filter((r) => r !== home)];
  const best = (score) => order.reduce((b, r) => ((score[r] ?? 0) > (score[b] ?? 0) ? r : b), order[0]);
  const leant = best(lean), leaning = lean[leant] > 0;
  const resolved = {}, said = {};
  for (const a of COMPOSE_AXES) {
    if (I[a] !== undefined) { resolved[a] = I[a]; said[a] = 'pinned'; continue; }
    const score = Object.fromEntries(Object.entries(heard[a]).map(([v, ws]) => [v, ws.length])), v = best(score);
    if (score[v] > 0) { resolved[a] = v; said[a] = `said: ${heard[a][v].join(', ')}`; } else { resolved[a] = leaning ? leant : home; said[a] = leaning ? `leans ${leant}` : `base ${home}`; }
  }
  // the mood (compose-plot.js MOODS): pinned, else the words' (the darkest heard wins), else even
  const moods = said0.filter((P) => P.mood).map((P) => P.mood);
  if (I.mood !== undefined) { resolved.mood = I.mood; said.mood = 'pinned'; }
  else if (moods.length) { resolved.mood = MOOD_IDS.filter((m) => moods.includes(m)).pop(); said.mood = `said: ${said0.filter((P) => P.mood === resolved.mood).map((P) => P.w).join(', ')}`; }
  else { resolved.mood = 'even'; said.mood = 'none said: even'; }
  // how much breaks (breakability.js): pinned, else the most the words let break, else nothing said (the game's own)
  const degrees = said0.filter((P) => P.degree).map((P) => P.degree);
  if (I.destruction !== undefined) { resolved.destruction = I.destruction; said.destruction = 'pinned'; }
  else if (degrees.length) { resolved.destruction = DEGREE_IDS.filter((d) => degrees.includes(d)).pop(); said.destruction = `said: ${said0.filter((P) => P.degree === resolved.destruction).map((P) => P.w).join(', ')}`; }
  return { resolved, said };
}

// a stage's base register: its bay kit's, else none (the reader's default)
const baseOf = (kit) => (typeof kit === 'string' && kit.startsWith('bay-') && REGISTERS.includes(kit.slice(4)) ? kit.slice(4) : undefined);
const stored = (c) => !!(c && typeof c === 'object' && c.resolved && typeof c.resolved === 'object');

/** AUTHORING TIME: the stage's intent read and stored; a stored reading, or a manifest without `compose`, as it was. */
export function resolveCompose(manifest) {
  if (!manifest || manifest.kind !== 'stage' || manifest.compose === undefined || stored(manifest.compose)) return manifest;
  const { resolved, said } = readCompose(manifest.compose, baseOf(manifest.kit));
  // (the degree the words name is the recipe's `destruction` where it sets none: a default the operator changes)
  return { ...manifest, compose: { intent: manifest.compose, resolved, said }, ...(resolved.destruction && manifest.destruction === undefined ? { destruction: resolved.destruction } : {}) };
}

/** The axes a build composes: the stored ones (each checked against its table), else the intent read now. */
export function composeForBuild(m) {
  const c = m.compose;
  if (!stored(c)) return readCompose(c, baseOf(m.kit)).resolved;
  for (const a of COMPOSE_AXES) if (!TABLES[a][c.resolved[a]]) throw new Error(`stage: compose.resolved.${a} is ${Object.keys(TABLES[a]).join(', ')}`);
  if (c.resolved.mood !== undefined && !MOODS[c.resolved.mood]) throw new Error(`stage: compose.resolved.mood is ${MOOD_IDS.join(', ')}`);
  return c.resolved;
}

/** The rooms' roles the intent pins (compose-roles.js reads the rest from the plan). */
export const rolesPinned = (m) => (stored(m.compose) ? m.compose.intent : m.compose)?.roles ?? {};
/** The rooms' beats the intent pins (compose-plot.js reads the rest from the role and the mood). */
export const beatsPinned = (m) => (stored(m.compose) ? m.compose.intent : m.compose)?.beats ?? {};
