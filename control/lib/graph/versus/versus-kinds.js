/**
 * versus kinds — Mojulo Fighter as a host for kinds of fighting game. A KIND names a fighting game's way of playing as
 * words over what versus already runs: its systems (versus-library.js SYSTEMS, switched on by word), its dials (the
 * rules' own numbers), the input grammar it is played with (versus-input.js SCHEMES), how its combos are built, its
 * plane, and the look and the game type its effects are drawn in (scene/juice-style.js). A kind is data: a new system is
 * code once in versus-core.js, then any kind can switch it on. What a kind's games have that versus does not run yet is
 * said (`lacks`), never dropped silently: the report is advice, as a feel's is (gameworld/feel/lower.js).
 *
 *   street     Street Fighter-like: links and special cancels, motion inputs, a super meter; parry the kind's option
 *   anime-air  Guilty Gear-like: gatlings (L → M → H), the air dash and the double jump, the reset (Roman cancel), burst,
 *              a guard bar
 *   iron       Tekken-like: four limbs (a button each), strings up to ten, juggles extended by the bound, the sidestep
 *              (a dodge in 2D)
 *   tag        Dragon Ball FighterZ / Marvel-like: a team, assists, a superdash
 *   platform   Smash-like: percent and knockback growth, ring-outs, platforms
 *
 *   FIGHT_KINDS, FIGHT_KIND_IDS
 *   kindRules(kind, rules?)   → the rules a match fights by: the kind's systems and dials under the game's own (the
 *                               game's systems added to the kind's; a dial the game sets wins)
 *   kindRecipe(recipe, rules) → a fighter's recipe with what the rules' systems need of it and it lacks: its four limbs
 *                               (limbsFor) under 'limbs', its strings (stringsFor) under 'strings'
 *   kindReport(kind)          → { kind, after, systems, options, scheme, combos, plane, look, flavor, lacks }
 *
 * Pure data and a merge: no clock, no dice.
 */
import { SYSTEMS, LIMB_SLOTS, LIMB_POINTS, NORMAL_FAMILIES } from './versus-library.js';
import { FAMILIES, TRADITIONS } from './versus-traditions.js';

const k = (o) => Object.freeze({ ...o, systems: Object.freeze(o.systems), options: Object.freeze(o.options ?? []), rules: Object.freeze(o.rules ?? {}), lacks: Object.freeze(o.lacks ?? []) });

export const FIGHT_KINDS = Object.freeze({
  street: k({
    name: 'street', after: 'Street Fighter', systems: [], options: ['parry'], scheme: 'classic', combos: 'links: a light chains into itself; a connected normal cancels into a special or a super',
    plane: '2D', look: 'material', flavor: 'action',
    lacks: [],
  }),
  'anime-air': k({
    name: 'anime-air', after: 'Guilty Gear', systems: ['gatling', 'airdash', 'airjump', 'reset', 'burst', 'guard'], scheme: 'classic',
    combos: 'gatlings: a connected normal cancels into a stronger one (L → M → H, on hit or block), and into a special or a super; air combos after the air dash',
    plane: '2D', look: 'cel', flavor: 'action',
    lacks: ['the slowdown a Roman cancel puts on the other fighter', 'the dust launcher', 'a faultless defence'],
  }),
  iron: k({
    name: 'iron', after: 'Tekken', systems: ['limbs', 'strings', 'bound', 'sidestep'], scheme: 'limbs',
    combos: 'strings: each limb a button, a string\'s presses following on in order (on whiff too, up to ten); juggles off a launch, extended once by the bound',
    plane: '3D on a line (the sidestep a dodge in 2D)', look: 'material', flavor: 'realistic', rules: { juggle: 5 },
    lacks: ['the sidestep off the plane is a dodge in 2D (no tracking moves, no circling)', 'wall splats and wall combos', 'the rage art'],
  }),
  tag: k({
    name: 'tag', after: 'Dragon Ball FighterZ', systems: ['gatling', 'airdash', 'airjump'], scheme: 'simple', combos: 'auto combos and gatlings, extended by assists',
    plane: '2D', look: 'cel', flavor: 'action',
    lacks: ['a team of three (tag in and out)', 'assists', 'the superdash'],
  }),
  platform: k({
    name: 'platform', after: 'Super Smash Bros.', systems: ['airjump'], scheme: 'simple', combos: 'strings off the knockback, read by the percent',
    plane: '2D with platforms', look: 'isekai', flavor: 'platformer', rules: { airActions: 2 },
    lacks: ['percent and knockback growth', 'ring-outs (no health bar)', 'platforms on the stage', 'four players'],
  }),
});
export const FIGHT_KIND_IDS = Object.freeze(Object.keys(FIGHT_KINDS));

const kindOf = (kind) => {
  const K = FIGHT_KINDS[kind];
  if (!K) throw new Error(`versus: kind is one of ${FIGHT_KIND_IDS.join(', ')}`);
  return K;
};

/** The rules a match of this kind fights by: the kind's systems and dials, under the game's own. */
export function kindRules(kind, rules = {}) {
  const K = kindOf(kind), own = rules ?? {};
  const systems = [...new Set([...K.systems, ...(own.systems ?? [])])];
  for (const w of systems) if (!SYSTEMS[w]) throw new Error(`versus: the ${K.name} kind names a system versus does not run ('${w}')`);
  return { ...K.rules, ...own, ...(systems.length ? { systems } : {}) };
}

/** What a kind is, for a readout: its systems and options, its grammar, its look and flavor, and what versus lacks of it. */
export function kindReport(kind) {
  const K = kindOf(kind);
  return { kind: K.name, after: K.after, systems: [...K.systems], options: [...K.options], scheme: K.scheme, combos: K.combos, plane: K.plane, look: K.look, flavor: K.flavor, lacks: [...K.lacks] };
}

// a limb's strength (1 the lead hand quick, 2 the rear hand and 3 the lead leg middling, 4 the rear leg heavy)
const LIMB_STRENGTH = Object.freeze({ 1: 'L', 2: 'M', 3: 'M', 4: 'H' });
/** A fighter's four limbs: for each ground stance and limb, the first family of its tradition (else the genre's normals,
 * else any) that strikes with that limb at that stance; none ⇒ its own normal of that strength. */
export function limbsFor(recipe) {
  const pools = [TRADITIONS[recipe.tradition]?.moves ?? {}, NORMAL_FAMILIES, FAMILIES];
  return Object.fromEntries(LIMB_SLOTS.map((slot) => {
    const [stance, n] = slot.split('.'), strength = LIMB_STRENGTH[n];
    for (const pool of pools) {
      const id = Object.keys(pool).find((f) => FAMILIES[f] && FAMILIES[f].stance === stance && LIMB_POINTS[n].includes(FAMILIES[f].limb));
      if (id) return [slot, { family: id, strength }];
    }
    return [slot, { family: recipe.normals[`${stance}.${strength}`].family, strength }];
  }));
}
/** A fighter's default strings: over its limbs (1,2; 1,2,4; 1,1,2; 3,4; and a ten-hit string), else over its stand
 * normals (L, M, H). */
export function stringsFor(recipe) {
  if (recipe.limbs) {
    const s = (...ns) => ns.map((n) => `stand.${n}`);
    return [s(1, 2), s(1, 2, 4), s(1, 1, 2), s(3, 4), s(1, 1, 2, 4, 3, 4, 2, 1, 3, 4)];
  }
  return [['stand.L', 'stand.M', 'stand.H']];
}
/** A fighter's recipe as the rules' systems need it: its limbs and strings filled in where it has none. */
export function kindRecipe(recipe, rules = {}) {
  const on = (w) => !!rules.systems && rules.systems.includes(w);
  let r = recipe;
  if (on('limbs') && !r.limbs) r = { ...r, limbs: limbsFor(r) };
  if (on('strings') && !r.strings) r = { ...r, strings: stringsFor(r) };
  return r;
}
