/**
 * versus kinds — Mojulo Fighter as a host for kinds of fighting game. A KIND names a fighting game's way of playing as
 * words over what versus already runs: its systems (versus-library.js SYSTEMS, switched on by word), its dials (the
 * rules' own numbers), the input grammar it is played with (versus-input.js SCHEMES), how its combos are built, its
 * plane, and the look and the game type its effects are drawn in (scene/juice-style.js). A kind is data: a new system is
 * code once in versus-core.js, then any kind can switch it on. What a kind's games have that versus does not run yet is
 * said (`lacks`), never dropped silently: the report is advice, as a feel's is (gameworld/feel/lower.js).
 *
 *   street     Street Fighter-like: links and special cancels, motion inputs, a super meter; parry the kind's option
 *   anime-air  Guilty Gear-like: gatlings (L → M → H), the air dash and the double jump, burst, a guard bar
 *   iron       Tekken-like: four limbs, long strings, juggles with a bound, a sidestep off the plane
 *   tag        Dragon Ball FighterZ / Marvel-like: a team, assists, a superdash
 *   platform   Smash-like: percent and knockback growth, ring-outs, platforms
 *
 *   FIGHT_KINDS, FIGHT_KIND_IDS
 *   kindRules(kind, rules?)   → the rules a match fights by: the kind's systems and dials under the game's own (the
 *                               game's systems added to the kind's; a dial the game sets wins)
 *   kindReport(kind)          → { kind, after, systems, options, scheme, combos, plane, look, flavor, lacks }
 *
 * Pure data and a merge: no clock, no dice.
 */
import { SYSTEMS } from './versus-library.js';

const k = (o) => Object.freeze({ ...o, systems: Object.freeze(o.systems), options: Object.freeze(o.options ?? []), rules: Object.freeze(o.rules ?? {}), lacks: Object.freeze(o.lacks ?? []) });

export const FIGHT_KINDS = Object.freeze({
  street: k({
    name: 'street', after: 'Street Fighter', systems: [], options: ['parry'], scheme: 'classic', combos: 'links: a light chains into itself; a connected normal cancels into a special or a super',
    plane: '2D', look: 'material', flavor: 'action',
    lacks: [],
  }),
  'anime-air': k({
    name: 'anime-air', after: 'Guilty Gear', systems: ['gatling', 'airdash', 'airjump', 'burst', 'guard'], scheme: 'classic',
    combos: 'gatlings: a connected normal cancels into a stronger one (L → M → H, on hit or block), and into a special or a super; air combos after the air dash',
    plane: '2D', look: 'cel', flavor: 'action',
    lacks: ['the Roman cancel (meter spent to reset a move)', 'the dust launcher', 'a faultless defence'],
  }),
  iron: k({
    name: 'iron', after: 'Tekken', systems: [], scheme: 'classic', combos: 'strings: each limb a button, a move\'s follow-ups chained in a set order',
    plane: '3D on a line', look: 'material', flavor: 'realistic', rules: { juggle: 5 },
    lacks: ['four limbs (a button each)', 'ten-hit strings', 'the bound (a juggle extended off the floor)', 'the sidestep off the plane'],
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
