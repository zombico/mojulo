/**
 * THE TABLE RPG'S CAST — the module's antagonists as a character graph rolled on the egocube (egocube/cast.js
 * `rollCast`), written out as the kernel's factions and foes, so a factioned encounter is one the graph decides: who
 * leads, who answers to whom, who is whose rival, and what each will listen to.
 *
 *   withCast(module) → module
 *     `cast: true | { seed?, as?, people? }`: two factions from the journey's cast. The mastermind's (its leader rank 5,
 *     its lieutenant rank 4 or a step below a master the module ranks lower, its troops rank 1), wary of the party from
 *     the start; and the rival's (the rival rank 3, its hands rank 1), neutral; each the other's rival, so a blow to one
 *     is a gift to the other. Foes are written as `mastermind`, `lieutenant`, `troop`, `rival`, `hand`, or under the
 *     ids `as` names for them (a module's own foes, or a starter's boss, minion and road bandits), and a faction as
 *     `mastermind` and `rival`. What the module writes itself wins, key by key: a foe's name, rank and text, a
 *     faction's name and standing. `people: { <part>: { body?, species?, brief?, facets?, mascot? } }` says what a part
 *     is (cast.js's member words): a person (the default), a beast-kin (a lineage below the hero door), a beast (a real
 *     species) or a mascot; human and not are made alike.
 *     A foe's `egocube: true | { brief?, facets? } | { roll }` rolls it a persona alone, as a party member's.
 *   Each foe with a persona gets `persona: { name, epithet, archetype, body, species?, reads, relation? }` and what it
 *   listens to from its mind: self-serving heeds a bribe and selfless scorns one; bound heeds a parley and scorns a
 *   threat; free heeds a threat and scorns a parley (`heeds` / `scorns`, unless the module writes its own).
 *   castRequestOf(module) → { cast, seed } | null   the request an egocube cast row stores (its members made characters)
 *   CAST_PARTS, CAST_LEADERS, CAST_PATH   the parts a cast writes, those made characters, each part's member path
 */
import { rollCast, BODIES } from '../egocube/cast.js';
import { rollEgocube } from '../egocube/egocube.js';
import { ARCHETYPES } from '../egocube/facets.js';
import { rollName, memberSeed } from './table-rpg-party.js';

export const CAST_PARTS = Object.freeze(['mastermind', 'lieutenant', 'troop', 'rival', 'hand']);
/** The parts a cast makes characters of (the named; the rank and file are the faction's uniform) */
export const CAST_LEADERS = Object.freeze(['mastermind', 'lieutenant', 'rival']);
// the words a part's body takes (cast.js's member words)
const PEOPLE_KEYS = ['body', 'species', 'brief', 'facets', 'mascot'];

// the cast request: the mastermind's faction and the rival's, rolled against the party's lead (the anchor, not written)
const REQUEST = {
  mastermind: { relation: 'mastermind' },
  'mastermind/lieutenant': { relation: 'lieutenant' },
  'mastermind/troops': { relation: 'rank', rank: 'foot' },
  rival: { relation: 'rival' },
  'rival/hands': { relation: 'rank', rank: 'foot' },
};
const PART_OF = { mastermind: 'mastermind', 'mastermind/lieutenant': 'lieutenant', 'mastermind/troops': 'troop', rival: 'rival', 'rival/hands': 'hand' };
/** A part's member path in the cast row (create_character { egocube, member }) */
export const CAST_PATH = Object.freeze(Object.fromEntries(Object.entries(PART_OF).map(([k, v]) => [v, `hero/${k}`])));
const FACTION_OF = { mastermind: 'mastermind', lieutenant: 'mastermind', troop: 'mastermind', rival: 'rival', hand: 'rival' };
const RANK_OF = { mastermind: 5, lieutenant: 4, rival: 3 };
// the egocube's ranks inside a faction, as the table's ranks 1–5
const TABLE_RANK = { foot: 1, elite: 2, hired: 2, officer: 3, lieutenant: 4, leader: 5 };
// what a band led by each archetype calls itself, and what its rank and file are called by how they fight
const BAND = { innocent: 'Flock', explorer: 'Free Company', sage: 'Order', hero: 'Company', outlaw: 'Gang', magician: 'Circle', everyman: 'Band', jester: 'Troupe', lover: 'House', caregiver: 'Fold', creator: 'Guild', ruler: 'Court' };
const HAND = { frontline: 'shield', flanker: 'blade', support: 'hand', controller: 'binder', caster: 'adept', ranged: 'bow', 'non-combatant': 'servant' };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** What a mind listens to: { heeds, scorns } from motivation (for whom) and order (by what rule). */
export function earOf({ motivation, order }) {
  const heeds = [], scorns = [];
  if (motivation >= 0.66) heeds.push('bribe'); else if (motivation <= 0.33) scorns.push('bribe');
  if (order <= 0.33) { heeds.push('parley'); scorns.push('threaten'); } else if (order >= 0.66) { heeds.push('threaten'); scorns.push('parley'); }
  return { heeds, scorns };
}

const camel = (s) => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
// who a foe is: its reading (the archetype's light or shadow), what it wants and by what rule, its place in the graph;
// a person's (or a beast-kin's) in its sheet's own words, a beast's or a mascot's from its body and its temperament
function personaOf(m, name, relation) {
  const R = m.reading ?? m.sheet.reading, body = m.body ?? 'person', epithet = R.reads === 'shadow' ? R.shadow : `the ${R.archetype}`;
  let reads;
  if (body === 'person' || body === 'beastkin') {
    const at = m.sheet.reads.findIndex((r) => r.startsWith(`${epithet}:`));
    reads = m.sheet.reads.slice(at < 0 ? -3 : at).join('; ');
    if (body === 'beastkin') reads = `a beast-kin, ${m.sheet.ancestry.reads.replace(/, humanity [\d.]+$/, '')}; ${reads}`;
  } else {
    const A = ARCHETYPES[R.archetype], t = m.temperament;
    const what = body === 'beast' ? `a ${camel(m.beast.species)}` : `a mascot, ${m.sheet.reads[0]}`;
    reads = `${what}; ${R.reads === 'shadow' ? `${A.shadow.name}: ${A.shadow.reads}` : A.light.reads}; motivation ${t.motivation}, order ${t.order}`;
  }
  return {
    ...(name ? { name } : {}), epithet, archetype: R.archetype, body,
    ...(m.beast ? { species: m.beast.species } : {}), reads, ...(relation ? { relation } : {}),
  };
}

/** The cast a module asks for, as an egocube cast row stores it ({ kind: 'egocube', cast }): the very request
 * withCast rolls, so a member made a character from the row is the persona the game reads. null: no cast. */
export function castRequestOf(module) {
  if (module.cast === undefined || module.cast === false) return null;
  const ask = module.cast === true ? {} : module.cast, people = ask.people ?? {};
  const cast = Object.fromEntries(Object.entries(REQUEST).map(([key, spec]) => [key, { ...spec, ...(people[PART_OF[key]] ?? {}) }]));
  return { cast, seed: ask.seed ?? module.seed ?? 1 };
}

// a foe as the cast made it, under what the module wrote for it
const writeFoe = (own, made) => ({ ...made, ...(own ?? {}) });

export function withCast(module) {
  const seed = module.seed ?? 1;
  let foes = { ...(module.foes ?? {}) }, factions = module.factions;
  // a foe rolled alone
  for (const [id, F] of Object.entries(foes)) {
    if (!F?.egocube) continue;
    const ask = F.egocube === true ? {} : F.egocube;
    const roll = ask.roll ?? { seed: memberSeed(seed, `foe-${id}`), ...(ask.brief ? { brief: ask.brief } : {}), ...(ask.facets ? { facets: ask.facets } : {}) };
    const sheet = rollEgocube(roll), name = rollName(seed, `foe-${id}`);
    foes[id] = writeFoe({ ...F, egocube: { roll } }, { persona: personaOf({ sheet }, name), ...earOf(sheet.facets) });
  }
  if (module.cast === undefined || module.cast === false) return { ...module, foes };
  const ask = module.cast === true ? {} : module.cast;
  if (!isObj(ask)) throw new Error('table rpg: cast is true or { seed?, as?: { <part>: <foe id> }, people?: { <part>: { body?, … } } }');
  for (const k of Object.keys(ask)) if (!['seed', 'as', 'people'].includes(k)) throw new Error(`table rpg: cast.${k} is not a cast word (seed, as, people)`);
  const people = ask.people ?? {};
  if (!isObj(people)) throw new Error(`table rpg: cast.people is { ${CAST_PARTS.join(', ')} }: each { ${PEOPLE_KEYS.join(', ')} }`);
  for (const [k, v] of Object.entries(people)) {
    if (!CAST_PARTS.includes(k)) throw new Error(`table rpg: cast.people.${k} is not a part of the cast (${CAST_PARTS.join(', ')})`);
    if (!isObj(v)) throw new Error(`table rpg: cast.people.${k} is { ${PEOPLE_KEYS.join(', ')} }`);
    for (const w of Object.keys(v)) if (!PEOPLE_KEYS.includes(w)) throw new Error(`table rpg: cast.people.${k}.${w} is not a body word (${PEOPLE_KEYS.join(', ')}; a body is ${BODIES.join(', ')})`);
  }
  const as = ask.as ?? {};
  if (!isObj(as)) throw new Error(`table rpg: cast.as is { ${CAST_PARTS.join(', ')} }: each a foe id`);
  for (const [k, v] of Object.entries(as)) {
    if (!CAST_PARTS.includes(k)) throw new Error(`table rpg: cast.as.${k} is not a part of the cast (${CAST_PARTS.join(', ')})`);
    if (typeof v !== 'string') throw new Error(`table rpg: cast.as.${k} is a foe id`);
  }
  const C = rollCast(castRequestOf(module));
  const names = {}, made = {};
  for (const [key, part] of Object.entries(PART_OF)) {
    const m = C.members[`hero/${key}`], mind = m.temperament ?? m.sheet.facets;
    const lead = part === 'troop' ? names.mastermind : part === 'hand' ? names.rival : null;
    const name = lead ? `${lead}'s ${HAND[mind.role]}` : rollName(ask.seed ?? seed, `cast-${part}`);
    names[part] = name;
    made[part] = {
      name, rank: RANK_OF[part] ?? TABLE_RANK[m.rank] ?? 1, faction: FACTION_OF[part],
      persona: personaOf(m, m.relation === 'rank' ? null : name, m.relation === 'rank' ? `one of the ${m.rank} rank` : m.relation), ...earOf(mind),
    };
  }
  for (const part of CAST_PARTS) {
    const id = as[part] ?? part;
    // the lieutenant answers to its master: a step below it when the master is the module's own and ranked lower
    if (part === 'lieutenant' && foes[id]?.rank === undefined) made.lieutenant.rank = Math.max(1, Math.min(4, foes[as.mastermind ?? 'mastermind'].rank - 1));
    foes[id] = writeFoe(foes[id], made[part]);
  }
  const archOf = (part) => { const m = C.members[`hero/${part}`]; return (m.reading ?? m.sheet.reading).archetype; };
  const own = factions ?? {};
  factions = {
    mastermind: { name: `${names.mastermind}'s ${BAND[archOf('mastermind')]}`, standing: -1, rivals: ['rival'], ...(own.mastermind ?? {}) },
    rival: { name: `${names.rival}'s ${BAND[archOf('rival')]}`, standing: 0, rivals: ['mastermind'], ...(own.rival ?? {}) },
    ...Object.fromEntries(Object.entries(own).filter(([k]) => k !== 'mastermind' && k !== 'rival')),
  };
  // the cast kept as it was read: the parts on their foes, so the characters made from it find their foes
  return { ...module, foes, factions, cast: { seed: ask.seed ?? seed, as: Object.fromEntries(CAST_PARTS.map((p) => [p, as[p] ?? p])), ...(ask.people ? { people: ask.people } : {}) } };
}
