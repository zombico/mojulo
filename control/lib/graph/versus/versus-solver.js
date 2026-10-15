/**
 * versus solver — design intent → a character recipe.
 *
 * A designer says who the fighter is (an archetype, a body, a few signature words); the solver fills the moveset
 * slots from the library and closes the rock-paper-scissors loop the archetype leaves open, writing down what each
 * word did. The recipe it returns is an ordinary recipe (versus-compile.js): the designer edits any slot after.
 *
 *   intent = { id, name?, archetype: 'all-rounder' | 'rushdown' | 'zoner' | 'grappler', cast?, signature?: [words] }
 *   signature words: kicks, punches, fire (a fireball), reversal (the invincible uppercut), grab (a command throw),
 *                    overhead (a leaping overhead), heavy, light
 *
 * Every fighter has the throw (the loop's third corner) and an answer to a jump: the reversal if it has one, an
 * anti-air normal at stand.H if it does not.
 *
 * An intent also carries what a designer adds after the solve, so a game's roster stays a few words:
 *   body?     { height, arm, leg, torso, girth }   the body over the cast (a character's measure, versus-character.js)
 *   weapon?   a word (versus-library WEAPONS) or dials
 *   library?  the fighter's own specials and supers (versus-compile.js)
 *   normals?  { <slot>: family | { family, strength?, tune? } }      replaces the solved slot
 *   specials? { <dir>: id | { id, motion?, tune? } | null }           replaces (or, null, empties) a direction
 *   super?    id | { id, tune? }
 *   tune?     { <slot> | special.<dir> | super | throw: tune }          a tune onto what the solve chose
 */

export const ARCHETYPES = Object.freeze({
  'all-rounder': {
    says: 'a fireball, the reversal and a rush: every answer, none the strongest',
    cast: 'heroic', lean: 'mixed',
    specials: { neutral: 'fireball', forward: 'rising', back: 'rush' }, super: 'super-fireball',
    movement: {},
  },
  rushdown: {
    says: 'fast feet, an overhead and a rush: lives at close range, wins by pressure',
    cast: 'lithe', lean: 'light',
    specials: { forward: 'rising', back: 'spin', down: 'leap' }, super: 'super-rush',
    movement: { hp: 950, walk: { f: 60, b: 44 }, dash: { f: { frames: 16, dist: 1250 } } },
  },
  zoner: {
    says: 'a fast fireball and long pokes: keeps the screen, weak up close',
    cast: 'heroic', lean: 'long',
    specials: { neutral: 'fireball', forward: 'rising', back: 'spin' }, super: 'super-fireball',
    movement: { hp: 950, walk: { f: 46, b: 40 } },
  },
  grappler: {
    says: 'a command throw and a big body: walks in slowly, one read takes a third of the bar',
    cast: 'brute', lean: 'heavy',
    specials: { neutral: 'grab', back: 'rush', down: 'leap' }, super: 'super-grab',
    movement: { hp: 1100, walk: { f: 42, b: 34 }, dash: { f: { frames: 22, dist: 900 } }, jump: { vy: 116 } },
  },
});

// a lean's normal per slot; signature words swap families in or out
const LEANS = Object.freeze({
  mixed: { 'stand.L': 'jab', 'stand.M': 'straight', 'stand.H': 'roundhouse', 'crouch.L': 'crouch-jab', 'crouch.M': 'low-kick', 'crouch.H': 'sweep', 'air.L': 'air-punch', 'air.M': 'air-kick', 'air.H': 'air-stomp' },
  light: { 'stand.L': 'jab', 'stand.M': 'hook', 'stand.H': 'front-kick', 'crouch.L': 'crouch-jab', 'crouch.M': 'low-kick', 'crouch.H': 'sweep', 'air.L': 'air-punch', 'air.M': 'air-kick', 'air.H': 'air-kick' },
  long: { 'stand.L': 'jab', 'stand.M': 'front-kick', 'stand.H': 'roundhouse', 'crouch.L': 'crouch-jab', 'crouch.M': 'crouch-punch', 'crouch.H': 'sweep', 'air.L': 'air-punch', 'air.M': 'air-kick', 'air.H': 'air-stomp' },
  heavy: { 'stand.L': 'jab', 'stand.M': 'hook', 'stand.H': 'uppercut', 'crouch.L': 'crouch-jab', 'crouch.M': 'crouch-punch', 'crouch.H': 'sweep', 'air.L': 'air-punch', 'air.M': 'air-stomp', 'air.H': 'air-stomp' },
});

const KICK_FOR = { jab: 'knee', straight: 'front-kick', hook: 'roundhouse', uppercut: 'roundhouse', 'crouch-jab': 'low-kick', 'crouch-punch': 'low-kick', 'air-punch': 'air-kick' };
const PUNCH_FOR = { knee: 'jab', 'front-kick': 'straight', roundhouse: 'uppercut', 'low-kick': 'crouch-punch', 'air-kick': 'air-punch', 'air-stomp': 'air-punch' };

export const SIGNATURES = Object.freeze({
  kicks: 'kicks where a punch would be',
  punches: 'punches where a kick would be',
  fire: 'a fireball at neutral',
  reversal: 'the invincible uppercut at forward',
  grab: 'a command throw at neutral (or down)',
  overhead: 'a leaping overhead at down',
  heavy: 'a heavier body: more health, slower feet',
  light: 'a lighter body: less health, quicker feet',
});

/** Intent → { recipe, notes } (notes: what each word did, in order). */
export function solveFighter(intent = {}) {
  const arch = ARCHETYPES[intent.archetype ?? 'all-rounder'];
  if (!arch) throw new Error(`versus: archetype '${intent.archetype}' is one of ${Object.keys(ARCHETYPES).join(', ')}`);
  const words = intent.signature ?? [];
  for (const w of words) if (!SIGNATURES[w]) throw new Error(`versus: signature '${w}' is one of ${Object.keys(SIGNATURES).join(', ')}`);
  const notes = [`${intent.archetype ?? 'all-rounder'}: ${arch.says}`];
  const normals = { ...LEANS[arch.lean] };
  const specials = { ...arch.specials };
  const mv = JSON.parse(JSON.stringify(arch.movement));

  const swap = (table, word) => {
    for (const [slot, fam] of Object.entries(normals)) {
      if (table[fam] && sameStance(fam, table[fam])) { normals[slot] = table[fam]; notes.push(`${word}: ${slot} ${fam} → ${table[fam]}`); }
    }
  };
  if (words.includes('kicks')) swap(KICK_FOR, 'kicks');
  if (words.includes('punches')) swap(PUNCH_FOR, 'punches');
  if (words.includes('fire') && !Object.values(specials).includes('fireball')) {
    const at = specials.neutral ? (specials.down ? 'back' : 'down') : 'neutral';
    if (specials.neutral && at !== 'neutral') { specials[at] = specials.neutral; }
    specials.neutral = 'fireball';
    notes.push('fire: a fireball at neutral');
  }
  if (words.includes('reversal') && specials.forward !== 'rising') { specials.forward = 'rising'; notes.push('reversal: the rising uppercut at forward'); }
  if (words.includes('grab') && !Object.values(specials).includes('grab')) {
    const at = specials.neutral ? 'down' : 'neutral';
    specials[at] = 'grab';
    notes.push(`grab: a command throw at ${at}`);
  }
  if (words.includes('overhead') && !Object.values(specials).includes('leap')) { specials.down = 'leap'; notes.push('overhead: a leaping overhead at down'); }
  if (words.includes('heavy')) { mv.hp = (mv.hp ?? 1000) + 100; mv.walk = { f: (mv.walk?.f ?? 52) - 6, b: (mv.walk?.b ?? 40) - 4 }; notes.push('heavy: +100 health, slower walk'); }
  if (words.includes('light')) { mv.hp = (mv.hp ?? 1000) - 80; mv.walk = { f: (mv.walk?.f ?? 52) + 6, b: (mv.walk?.b ?? 40) + 4 }; notes.push('light: -80 health, quicker walk'); }

  // close the loop: an answer to a jump
  if (!Object.values(specials).includes('rising') && normals['stand.H'] !== 'uppercut') {
    notes.push(`no reversal: stand.H ${normals['stand.H']} → uppercut, the anti-air`);
    normals['stand.H'] = 'uppercut';
  }
  if (!Object.values(specials).includes('fireball')) notes.push('no fireball: the screen is crossed on foot; a jump-in is the approach');
  notes.push('throw: every fighter throws (L + M, or T)');

  const superId = words.includes('fire') && arch.super !== 'super-fireball' && !Object.values(specials).includes('grab') ? 'super-fireball' : arch.super;
  const recipe = {
    id: intent.id ?? 'fighter',
    name: intent.name ?? intent.id ?? 'Fighter',
    archetype: intent.archetype ?? 'all-rounder',
    cast: intent.cast ?? arch.cast,
    ...mv,
    normals: Object.fromEntries(Object.entries(normals).map(([slot, family]) => [slot, { family }])),
    specials: Object.fromEntries(Object.entries(specials).map(([dir, id]) => [dir, { id }])),
    super: { id: superId },
  };
  overlay(recipe, intent, notes);
  return { recipe, notes };
}

const SPECIAL_DIRS = ['neutral', 'forward', 'back', 'down'];
const NORMAL_KEYS = Object.keys(LEANS.mixed);

/** What the designer wrote over the solve: a weapon, their own shelf, slots replaced, tunes. */
function overlay(recipe, intent, notes) {
  if (intent.body) {
    recipe.body = { ...intent.body };
    notes.push(`body: ${intent.character ? `the character ${intent.character}'s, ` : ''}${Object.entries(intent.body).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  if (intent.weapon) {
    recipe.weapon = intent.weapon;
    const kind = typeof intent.weapon === 'string' ? intent.weapon : intent.weapon.kind ?? 'sword';
    notes.push(`weapon: ${kind}, its strikes hit with the blade and pay for it in recovery`);
  }
  if (intent.library) { recipe.library = intent.library; notes.push(`library: ${[...Object.keys(intent.library.specials ?? {}), ...Object.keys(intent.library.supers ?? {})].join(', ')}`); }
  for (const [slot, n] of Object.entries(intent.normals ?? {})) {
    if (!NORMAL_KEYS.includes(slot)) throw new Error(`versus: normals.${slot} is not a slot (${NORMAL_KEYS.join(', ')})`);
    recipe.normals[slot] = typeof n === 'string' ? { family: n } : { ...n };
    notes.push(`normals: ${slot} → ${recipe.normals[slot].family}`);
  }
  for (const [dir, sp] of Object.entries(intent.specials ?? {})) {
    if (!SPECIAL_DIRS.includes(dir)) throw new Error(`versus: specials.${dir} is not a direction (${SPECIAL_DIRS.join(', ')})`);
    if (sp === null) { delete recipe.specials[dir]; notes.push(`specials: ${dir} emptied`); continue; }
    recipe.specials[dir] = typeof sp === 'string' ? { id: sp } : { ...sp };
    notes.push(`specials: ${dir} → ${recipe.specials[dir].id}`);
  }
  if (intent.super) { recipe.super = typeof intent.super === 'string' ? { id: intent.super } : { ...intent.super }; notes.push(`super → ${recipe.super.id}`); }
  for (const [key, tune] of Object.entries(intent.tune ?? {})) {
    if (NORMAL_KEYS.includes(key)) recipe.normals[key] = { ...recipe.normals[key], tune };
    else if (key.startsWith('special.') && SPECIAL_DIRS.includes(key.slice(8))) {
      const dir = key.slice(8);
      if (!recipe.specials[dir]) throw new Error(`versus: tune.${key}: the fighter has no special at ${dir}`);
      recipe.specials[dir] = { ...recipe.specials[dir], tune };
    } else if (key === 'super') recipe.super = { ...recipe.super, tune };
    else if (key === 'throw') recipe.throw = { tune };
    else throw new Error(`versus: tune.${key} is a normal slot, special.<${SPECIAL_DIRS.join(' | ')}>, super or throw`);
    notes.push(`tune: ${key} (${Object.keys(tune).join(', ')})`);
  }
}

const STANCE_OF = { jab: 'stand', straight: 'stand', hook: 'stand', uppercut: 'stand', 'front-kick': 'stand', roundhouse: 'stand', knee: 'stand', 'crouch-jab': 'crouch', 'low-kick': 'crouch', 'crouch-punch': 'crouch', sweep: 'crouch', 'crouch-uppercut': 'crouch', 'air-punch': 'air', 'air-kick': 'air', 'air-stomp': 'air' };
const sameStance = (a, b) => STANCE_OF[a] === STANCE_OF[b];
