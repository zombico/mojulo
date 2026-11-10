/**
 * THE MONSTER MANUAL — a setting's creatures as one coherent set: each of an element of the system's polarity, each a
 * role of the cast, their weaknesses and resistances following from what opposes what, their numbers from their role
 * and how far into the game they are met. A vertical slice of the lorecube: it lowers to the party RPG's own words
 * (playscape/rpg: `foes` and the `skills` they use), and what it lowers is read back by that game's own reader.
 *
 *   ROLES            the cast's four (gameworld/foe-casting.js ROLES: grunt, harrier, elite, boss), read from there
 *   ROLE_STATS       a role's numbers at level 1, in the RPG's stats, set beside its presets (a grunt a starter, a
 *                    harrier quick and frail, an elite a wall, a boss the fight a level ends on)
 *
 * MADE IN PASSES (passes.js), a manual's ladder three rungs:
 *   premise     the polarity it stands on and its creatures, each an id, an element and a role: a raw-new pass's
 *   affinity    each creature's weak, resist and absorb: from the polarity (a thing is weak to what beats or opposes
 *               its element, resists its own and what it beats; a boss absorbs its own), under the author's own
 *   numbered    each creature's level: how far in it is met, which scales its role's numbers
 *
 *   newManual({ name?, polarity, creatures: [{ id, element, role, name? }] })   a RAW-NEW pass: the premise alone
 *   intensifyManual(M, { affinity?: true | { <id>: { weak?, resist?, absorb?, immune? } }, levels?: true | { <id>: n } })
 *       → { manual, open }   an INTENSIFICATION, rungs in order. `true` lays the derived values; an object lays the
 *       author's over them (affinity) or is the levels as written
 *   readManual(v)                a stored manual at any depth: read, or throws, teaching
 *   MANUAL                       the part (passes.js)
 *   manualLaws(M) → [{ law, ok, value }]   in-polarity, every-element (each element of the polarity has a creature),
 *       every-role (a grunt, an elite and a boss at least), every-weakness (once its affinity is said: nothing is
 *       weak to nothing), ladder (once numbered: a role higher is worth more). Advice
 *   lowerManual(M) → { foes: { <id>: foe }, skills: { <id>: skill } }   the party RPG's words (needs the numbered
 *       rung): each creature a foe with its stats, its lists and the skill of its element; one skill an element used
 *       (a blow of that element on one foe), and one on every foe for an element a boss is of
 *
 * WHAT IT CANNOT LAND: an action game's foe has no element, weakness or resistance (holder.js: foe, `part`), so a
 * manual lowers to the party RPG alone; `lowerManual` says so in `lacks`.
 *
 * Pure and deterministic.
 */
import { definePart } from './passes.js';
import { rootOf, resolvePolarity, readPolarity, affinityOf, elementHandles } from './polarity.js';
import { ROLES as CAST_ROLES } from '../gameworld/foe-casting.js';

const fail = (m) => new Error(`lorecube: manual${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const ROLES = CAST_ROLES;
export const ROLE_IDS = Object.freeze(Object.keys(ROLES));

/** A role's numbers at level 1 (hp, mp, atk, def, mag, spd, xp, gold): beside the RPG's presets, so a party of three
 *  at level 1 beats a pack of grunts and the boss wants a few levels and its weakness. */
export const ROLE_STATS = Object.freeze({
  grunt: { hp: 18, mp: 8, atk: 8, def: 4, mag: 4, spd: 6, xp: 5, gold: 4 },
  harrier: { hp: 12, mp: 10, atk: 7, def: 2, mag: 6, spd: 12, xp: 5, gold: 3 },
  elite: { hp: 32, mp: 16, atk: 12, def: 8, mag: 7, spd: 6, xp: 12, gold: 10 },
  boss: { hp: 150, mp: 60, atk: 16, def: 10, mag: 13, spd: 8, xp: 80, gold: 120 },
});
/** How much each level past the first adds to a role's numbers. */
export const LEVEL_GROWTH = 0.3;
export const MAX_LEVEL = 20;

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const KEYS = ['name', 'polarity', 'creatures', 'affinity', 'levels'];
const LISTS = ['weak', 'resist', 'absorb', 'immune'];

function readPolarityOf(v) {
  // (a name, or a polarity as written or made: its premise is all a manual stands on)
  const P = readPolarity(typeof v === 'string' ? v : { ...(v.id ? { id: v.id } : {}), shape: v.shape, of: v.of });
  return P.id ? P.id : { shape: P.shape, of: P.of };
}

/** A stored manual at any depth. */
export function readManual(v) {
  if (!isObj(v)) throw fail(' is { name?, polarity, creatures, affinity?, levels? }');
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw fail(`.${k} is not part of a manual (${KEYS.join(', ')})`);
  if (v.polarity === undefined) throw fail('.polarity is what its creatures\' elements stand on: a named polarity or { shape, of }');
  const out = { ...(v.name !== undefined ? { name: String(v.name).trim() } : {}), polarity: readPolarityOf(v.polarity) };
  if (!Array.isArray(v.creatures) || !v.creatures.length) throw fail('.creatures is a list of { id, element, role, name? }');
  out.creatures = v.creatures.map((c, i) => {
    const at = `.creatures[${i}]`;
    if (!isObj(c)) throw fail(`${at} is { id, element, role, name? }`);
    for (const k of Object.keys(c)) if (!['id', 'element', 'role', 'name'].includes(k)) throw fail(`${at}.${k} is not part of a creature (id, element, role, name)`);
    if (typeof c.id !== 'string' || !ID.test(c.id)) throw fail(`${at}.id is a short lower-case word`);
    const root = rootOf(c.element);
    if (!root) throw fail(`${at}.element '${c.element}' is no element the character book knows`);
    if (!ROLES[c.role]) throw fail(`${at}.role is one of the cast's: ${ROLE_IDS.join(', ')}`);
    return { id: c.id, element: root, role: c.role, ...(c.name !== undefined ? { name: String(c.name).trim() } : {}) };
  });
  const ids = out.creatures.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw fail(`.creatures: two share an id (${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')})`);
  if (v.affinity !== undefined) {
    if (!isObj(v.affinity)) throw fail('.affinity is { <creature>: { weak?, resist?, absorb?, immune? } }');
    out.affinity = {};
    for (const [id, A] of Object.entries(v.affinity)) {
      if (!ids.includes(id)) throw fail(`.affinity.${id} is no creature of this manual`);
      if (!isObj(A)) throw fail(`.affinity.${id} is { weak?, resist?, absorb?, immune? }`);
      for (const k of Object.keys(A)) if (!LISTS.includes(k)) throw fail(`.affinity.${id}.${k} is not one of its lists (${LISTS.join(', ')})`);
      out.affinity[id] = Object.fromEntries(LISTS.filter((k) => A[k] !== undefined).map((k) => {
        if (!Array.isArray(A[k]) || !A[k].every((w) => typeof w === 'string' && /^[a-z][a-z0-9-]*$/.test(w))) throw fail(`.affinity.${id}.${k} is a list of element words`);
        return [k, [...A[k]]];
      }));
    }
    const missing = ids.filter((id) => !out.affinity[id]);
    if (missing.length) throw fail(`.affinity says nothing of ${missing.join(', ')}: every creature has its lists, an empty one where it has none`);
  }
  if (v.levels !== undefined) {
    if (!isObj(v.levels)) throw fail('.levels is { <creature>: the level it is met at }');
    for (const [id, n] of Object.entries(v.levels)) {
      if (!ids.includes(id)) throw fail(`.levels.${id} is no creature of this manual`);
      if (!Number.isInteger(n) || n < 1 || n > MAX_LEVEL) throw fail(`.levels.${id} is a whole level, 1 to ${MAX_LEVEL}`);
    }
    const missing = ids.filter((id) => v.levels[id] === undefined);
    if (missing.length) throw fail(`.levels says nothing of ${missing.join(', ')}`);
    out.levels = { ...v.levels };
  }
  return out;
}

const premiseOf = (v) => (isObj(v) ? { ...(v.name !== undefined ? { name: v.name } : {}), polarity: v.polarity, creatures: v.creatures } : null);
const reads = (v) => { try { return readManual(v); } catch { return null; } };

export const MANUAL = definePart({
  id: 'manual',
  rungs: [
    { id: 'premise', rawNew: true, holds: (v) => !!premiseOf(v) && !!reads(premiseOf(v)), view: premiseOf },
    { id: 'affinity', holds: (v) => isObj(v.affinity) && !!reads(v), open: () => ['affinity'], view: (v) => v.affinity },
    { id: 'numbered', holds: (v) => isObj(v.levels) && !!reads(v), open: () => ['levels'], view: (v) => v.levels },
  ],
});

/** A raw-new pass: the polarity and the creatures, and nothing of how they fare. */
export function newManual(v) {
  if (!isObj(v)) throw fail(' is made from { name?, polarity, creatures }');
  const more = Object.keys(v).filter((k) => ['affinity', 'levels'].includes(k));
  if (more.length) throw fail(`.${more[0]} is not a raw-new pass's: it says which creatures there are (polarity, creatures) and stops; ${more.join(', ')} ${more.length === 1 ? 'is' : 'are'} the next passes' (intensifyManual)`);
  return readManual(v);
}

/** What the polarity gives a creature: weak to what beats or opposes its element, resisting its own and what it beats;
 *  a boss takes its own element in (absorb) instead of resisting it. */
export function derivedAffinity(M) {
  const V = readManual(premiseOf(M)), P = resolvePolarity(V.polarity);
  return Object.fromEntries(V.creatures.map((c) => {
    const A = affinityOf(P, c.element), own = elementHandles(c.element).rpg;
    return [c.id, c.role === 'boss' ? { weak: A.weak, resist: A.resist.filter((e) => e !== own), absorb: [own] } : { weak: A.weak, resist: A.resist }];
  }));
}

/** The level a creature is met at when none is written: by its role (grunts first, the boss last). */
export const derivedLevels = (M) => Object.fromEntries(readManual(premiseOf(M)).creatures.map((c) => [c.id, { grunt: 1, harrier: 2, elite: 3, boss: 5 }[c.role]]));

/** An intensification: affinities, then levels; what was there is never touched. */
export function intensifyManual(M, add = {}) {
  const base = readManual(M);
  if (!isObj(add)) throw fail(' is intensified with { affinity?, levels? }');
  for (const k of Object.keys(add)) {
    if (['name', 'polarity', 'creatures'].includes(k)) throw fail(`.${k} is its premise: an intensification adds under it and never changes it`);
    if (!KEYS.includes(k)) throw fail(`.${k} is not part of a manual (${KEYS.join(', ')})`);
    if (base[k] !== undefined) throw fail(`.${k} is already said: an intensification adds the rungs that are missing and changes none`);
  }
  const next = { ...base };
  if (add.affinity !== undefined) {
    const derived = derivedAffinity(base);
    if (add.affinity !== true && !isObj(add.affinity)) throw fail('.affinity is true (as the polarity gives it) or { <creature>: its own lists }');
    next.affinity = add.affinity === true ? derived : { ...derived, ...Object.fromEntries(Object.entries(add.affinity).map(([id, A]) => [id, { ...(derived[id] ?? {}), ...A }])) };
  }
  if (add.levels !== undefined) {
    if (!next.affinity) throw fail(': its levels are said before its affinity: what a creature is weak to comes before how strong it is');
    if (add.levels !== true && !isObj(add.levels)) throw fail('.levels is true (by role) or { <creature>: level }');
    next.levels = add.levels === true ? derivedLevels(base) : { ...derivedLevels(base), ...add.levels };
  }
  const manual = readManual(next);
  return { manual, open: !manual.affinity ? ['affinity'] : !manual.levels ? ['levels'] : [] };
}

const scaled = (role, level) => { const k = 1 + LEVEL_GROWTH * (level - 1), S = ROLE_STATS[role]; return Object.fromEntries(Object.entries(S).map(([s, n]) => [s, Math.round(n * k)])); };

/** The laws a manual is held to: advice, never a refusal. */
export function manualLaws(M) {
  const V = readManual(M), P = resolvePolarity(V.polarity);
  const outside = V.creatures.filter((c) => !P.elements.includes(c.element)).map((c) => `${c.id} (${c.element})`);
  const empty = P.elements.filter((e) => !V.creatures.some((c) => c.element === e));
  const noRole = ['grunt', 'elite', 'boss'].filter((r) => !V.creatures.some((c) => c.role === r));
  const laws = [
    { law: 'in-polarity', ok: outside.length === 0, value: outside.join(', ') || 'all' },
    { law: 'every-element', ok: empty.length === 0, value: empty.join(', ') || 'all' },
    { law: 'every-role', ok: noRole.length === 0, value: noRole.join(', ') || 'all' },
  ];
  if (V.affinity) {
    const none = V.creatures.filter((c) => !(V.affinity[c.id].weak ?? []).length).map((c) => c.id);
    laws.push({ law: 'every-weakness', ok: none.length === 0, value: none.join(', ') || 'all' });
  }
  if (V.levels) {
    // a role higher is worth more: the xp of each creature against every creature of a role below it
    const order = ROLE_IDS, worth = (c) => scaled(c.role, V.levels[c.id]).xp;
    const upset = V.creatures.flatMap((a) => V.creatures.filter((b) => order.indexOf(b.role) > order.indexOf(a.role) && ROLES[b.role].rank !== ROLES[a.role].rank && worth(b) <= worth(a)).map((b) => `${b.id} under ${a.id}`));
    laws.push({ law: 'ladder', ok: upset.length === 0, value: upset.join(', ') || 'rises' });
  }
  return laws;
}

const title = (s) => s.replace(/(^|-)([a-z])/g, (_, d, c) => (d ? ' ' : '') + c.toUpperCase());

/** The party RPG's words for it: each creature a foe, each element a skill. */
export function lowerManual(M) {
  const V = readManual(M);
  if (!V.affinity || !V.levels) throw fail(` lowers once it is numbered: it is at its ${!V.affinity ? 'premise' : 'affinity'} (intensifyManual)`);
  const skills = {}, foes = {};
  const skillOf = (element, all) => {
    const el = elementHandles(element).rpg, id = `${el}-${all ? 'storm' : 'lash'}`;
    skills[id] ??= all
      ? { name: `${title(el)} Storm`, about: `${el} on every foe`, mp: 8, target: 'foes', power: 6, stat: 'mag', scale: 0.7, element: el }
      : { name: `${title(el)} Lash`, about: `${el} on one foe`, mp: 3, target: 'foe', power: 5, stat: 'mag', scale: 0.8, element: el };
    return id;
  };
  for (const c of V.creatures) {
    const { hp, mp, atk, def, mag, spd, xp, gold } = scaled(c.role, V.levels[c.id]), A = V.affinity[c.id];
    foes[c.id] = {
      name: c.name ?? title(c.id), hp, mp, atk, def, mag, spd, xp, gold,
      ...Object.fromEntries(LISTS.filter((k) => (A[k] ?? []).length).map((k) => [k, A[k]])),
      skills: [skillOf(c.element, false), ...(c.role === 'boss' ? [skillOf(c.element, true)] : [])],
      ...(c.role === 'boss' ? { boss: true } : {}),
    };
  }
  return { foes, skills, lacks: ['an action game\'s foe has no element, weakness or resistance: a manual lowers to the party RPG alone'] };
}
