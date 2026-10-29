/**
 * THE CAST: an anchor Egocube and the people rolled against it, checked as a whole (docs/egocube.md, Relationships,
 * Cast laws, The fractal). It builds nothing: a sheet per member and the cast sheet that says who they are to each
 * other, what the laws found and what was drawn again. The character loop makes each member as it makes one character.
 *
 *   rollCast({ anchor?, cast?, factions?, setting?, bodies?, seed = 1 })   → the cast sheet
 *   readCastRequest(request)                                      throws on an unknown word, naming the known ones
 *   castOfScale(scale, { n? })                                    the relations a game of that size asks for
 *
 *   anchor:   { brief?, facets?, path = 'hero', body?: 'person' | 'beastkin', faction? }
 *   cast:     { <key>: { relation, n?, roles?, rank?, bond?, body?, faction?, brief?, facets?, species?, ooze?, mascot?,
 *                        tune?, wildcard? } }
 *             A key is a path below the anchor ('rival', 'emperor', 'emperor/dragon'): a member's relation is to its
 *             parent (the anchor at the top), which comes first. `n` makes that many (`party-1` … `party-n`); `roles`
 *             names their roles in turn, the rest proposed by complement.
 *   factions: { <id>: { tradition?, era?, lean? } }   a faction's own setting words, over the game's
 *   bodies:   { person?, beastkin?, beast?, mascot? }  multipliers on the odds of an unasked body ("chibi" leans mascot)
 *
 * THE OPERATORS. A relation aims a target distance δ (looseness λ) from its anchor's value on the archetype (round the
 * wheel), the role (the range order), the build (the mass order) and the age (band steps), turned into a lean the
 * member's roll multiplies into its priors (egocube.js `lean`); motivation and order are pulled to a target on the
 * member's own die (`pull`), never marked asked. `shadow` s reflects motivation toward its mirror; `complement` leans
 * away from the roles and archetypes the party already holds. A facet a relation leaves free leans toward the root
 * anchor at 0.6^depth.
 *
 * BONDS AND BODIES. `bond: 'party'` is first party (it fights in the party, in a class); `bond: 'familiar'` is second
 * party, kept by its parent (a stand, a summon, a companion), and wears its keeper's accent. A body is a person (the
 * hero door), beast-kin (a beast lineage: cat-folk on the hero door, Kimahri below it, by its humanity), a beast (a real
 * species, the animal door: Red XIII; its `ooze` the mutagen's words, mutagen/oozes/, that make the species a game
 * creature, dire or mythical, of frost or of bone, carried to the animal door) or a mascot (mascot.js: the poke-companion). A beast and a mascot carry the roll's temperament (role,
 * archetype, motivation, order) beside their own body. Unasked, a party member's and a familiar's body is thrown on its
 * own die, leaned by the setting's era and genre; every other relation is a person.
 *
 * THE LAWS, checked as each member is rolled, against those before it: party silhouettes are distinct; a shadow wears
 * its anchor's silhouette word, a rival and a foil another; named members differ in stature or in silhouette word (the
 * size ladder); a member rolled after both poles (the anchor and the first shadow or mastermind) sits between them on
 * motivation. A broken law draws the later member again (egocube.js `redraw`), never the anchor nor a member whose facets
 * the law reads were all asked; one still broken after MAX_REDRAWS is kept, and the sheet says so.
 *
 * THE FRACTAL. Every die is keyed by the cast's seed and the member's path, and members are rolled in the order they are
 * written, so a member added at the end never moves one rolled before it: a cast only grows.
 *
 * Pure and deterministic. With no setting and no faction, the anchor is `rollEgocube({ brief, facets, seed, path })`.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { rollEgocube } from './egocube.js';
import { AGES, BUILDS, ROLES, ARCHETYPES, ARCHETYPE_IDS } from './facets.js';
import { readSetting, mascotWeight } from './setting.js';
import { rollMascot } from './mascot.js';
import { ARCHETYPE_PROMISE, ARCHETYPE_HUE } from './mascot-from-person.js';
import { HEIGHT, AGE_SCALE } from './plan.js';
import { oozeErrors } from '../mutagen/compose.js';

export const MAX_REDRAWS = 6;

const R = (o) => Object.freeze(o);
/**
 * The relations: the doc's presets (first readings, for the eyes gate), and the journey's functions over them.
 *   archetype / role / size: { d?, l?, toward?, signed? }   size is δ on the build (signed: toward heavier or lighter)
 *   age: { step }   bands older (+) or younger (−) than the anchor
 *   echo e: motivation near the anchor's (spread e), `by` shifted; shadow s: reflected toward its mirror
 *   motivation / order: a fixed pull { at, spread, min?, max? }
 *   silhouette: 'same' | 'distinct' against the anchor; pole: a bookend; bond: the bond it makes by default
 */
export const RELATIONS = Object.freeze({
  shadow:     R({ reads: 'the same want, the other face', archetype: { d: 0, l: 0.1 }, shadow: 1, role: { d: 0 }, size: { d: 0.2 }, age: { step: 0 }, silhouette: 'same', pole: true }),
  rival:      R({ reads: 'near enough to compare, apart enough to clash', archetype: { d: 0.25 }, shadow: 0.3, role: { d: 0.15 }, size: { d: 0.7 }, age: { step: 0 }, silhouette: 'distinct' }),
  foil:       R({ reads: 'the opposite want: each shows what the other is', archetype: { d: 1 }, echo: 0.15, silhouette: 'distinct' }),
  mentor:     R({ reads: 'ahead on the same road', archetype: { d: 0.15, toward: { sage: 3 } }, echo: 0.1, by: -0.1, age: { step: 2 } }),
  party:      R({ reads: 'what the others lack', complement: true, echo: 0.15, bond: 'party' }),
  familiar:   R({ reads: 'kept by another and fights beside them; the two read as one', archetype: { d: 0, l: 0.25 }, echo: 0.1, bond: 'familiar' }),
  lieutenant: R({ reads: 'the master\'s hand (the Dragon)', archetype: { d: 0.2 }, echo: 0.1, role: { toward: { frontline: 6 } }, size: { d: 0.6, signed: true } }),
  mastermind: R({ reads: 'the one behind it all (the Emperor)', archetype: { toward: { ruler: 4, magician: 4 } }, motivation: { at: 0.92, spread: 0.05, min: 0.85 }, role: { toward: { 'non-combatant': 4, caster: 4 } }, size: { d: -0.4, signed: true }, age: { step: 2 }, pole: true }),
  rank:       R({ reads: 'one of the faction\'s own: a uniform, and as much of a person as the rank shows' }),
  // the journey's functions (Vogler), as presets over the same operators
  ally:       R({ reads: 'an ally on the road', complement: true, echo: 0.15, bond: 'party' }),
  herald:     R({ reads: 'the one who brings the call', archetype: { toward: { sage: 2, innocent: 2, magician: 2 } }, role: { toward: { 'non-combatant': 3 } }, echo: 0.2 }),
  'threshold-guardian': R({ reads: 'the one who stands at the door', role: { toward: { frontline: 4 } }, size: { d: 0.4, signed: true }, motivation: { at: 0.5, spread: 0.2 }, order: { at: 0.2, spread: 0.1 } }),
  trickster:  R({ reads: 'the one who answers to no plan, not even the hero\'s', archetype: { toward: { jester: 6 } }, order: { at: 0.88, spread: 0.08 } }),
  shapeshifter: R({ reads: 'the one whose side is never sure', archetype: { toward: { lover: 2, outlaw: 2, magician: 2 } }, motivation: { at: 0.5, spread: 0.08 } }),
});

/** Ranks inside a faction: individuation ι, how much of their own Egocube shows over the faction's template. */
export const RANKS = Object.freeze({ foot: 0.1, elite: 0.3, officer: 0.6, lieutenant: 0.8, leader: 1, hired: 0.7 });
export const BONDS = Object.freeze(['party', 'familiar']);
export const BODIES = Object.freeze(['person', 'beastkin', 'beast', 'mascot']);
/** The peoples a beast-kin is drawn from: the lineages whose humanity runs below the hero door. */
export const BEASTKIN = Object.freeze(['feline', 'lupine', 'ursine', 'avian', 'draconic', 'insectoid']);
/** A familiar beast's species by the role its temperament fights in (fauna/species.js ids, with their family). */
export const BEASTS = Object.freeze({
  frontline: [['brownBear', 'ursine'], ['wildBoar', 'suid'], ['rhino', 'pachyderm'], ['bison', 'bovid']],
  flanker: [['wolf', 'canine'], ['cougar', 'feline'], ['leopard', 'feline'], ['lynx', 'feline'], ['fox', 'canine']],
  support: [['dog', 'canine'], ['deer', 'cervid'], ['horse', 'equine'], ['redPanda', 'procyonid']],
  controller: [['wolf', 'canine'], ['crow', 'avian'], ['octopus', 'cephalopod']],
  caster: [['greatHornedOwl', 'avian'], ['fox', 'canine'], ['snake', 'squamate'], ['crow', 'avian']],
  ranged: [['baldEagle', 'avian'], ['greatHornedOwl', 'avian'], ['lion', 'feline']],
  'non-combatant': [['houseCat', 'feline'], ['dog', 'canine'], ['rabbit', 'leporid']],
});
/** A first-party beast's: a fighter in its own right, big enough to stand in the line (Red XIII, not a pet). */
export const PARTY_BEASTS = Object.freeze({
  frontline: [['brownBear', 'ursine'], ['tiger', 'feline'], ['wildBoar', 'suid']],
  flanker: [['wolf', 'canine'], ['cougar', 'feline'], ['leopard', 'feline'], ['lion', 'feline']],
  support: [['dog', 'canine'], ['horse', 'equine'], ['deer', 'cervid']],
  controller: [['wolf', 'canine'], ['baldEagle', 'avian']],
  caster: [['fox', 'canine'], ['greatHornedOwl', 'avian'], ['lynx', 'feline']],
  ranged: [['baldEagle', 'avian'], ['cheetah', 'feline']],
});
/** How often an unasked party member or familiar is each body, by the setting's era (a mascot more, the more the
 * genre leans to one; a body the party already has, a quarter as often for each). First readings: a myth has beast-kin
 * and beasts at its fires; the modern world, a dog. */
export const BODY_ODDS = Object.freeze({
  party: { myth: { person: 1, beastkin: 0.2, beast: 0.1, mascot: 0.08 }, rustic: { person: 1, beastkin: 0.08, beast: 0.1, mascot: 0.04 }, modern: { person: 1, beast: 0.06 }, future: { person: 1, beastkin: 0.12, beast: 0.04, mascot: 0.08 } },
  familiar: { myth: { person: 0.5, beast: 1, mascot: 0.6 }, rustic: { person: 0.3, beast: 1, mascot: 0.4 }, modern: { person: 0.3, beast: 1, mascot: 0.3 }, future: { person: 0.6, beast: 0.3, mascot: 1 } },
});

/** The cast a game of each size asks for (the completeness ladder), poles first so the bookends hold every member. */
export const SCALES = Object.freeze({
  hero: { reads: 'the hero alone (H + 0)' },
  rival: { reads: 'the hero and a rival (H + R)' },
  party: { reads: 'the hero and a party (H + Pn)' },
  journey: { reads: 'a journey cast: a party, a mentor and a rival, a mastermind, its lieutenant and its troops' },
});
export function castOfScale(scale, { n = 3 } = {}) {
  if (!SCALES[scale]) throw new Error(`cast: a scale is ${Object.keys(SCALES).join(', ')} (got ${JSON.stringify(scale)})`);
  if (!(Number.isInteger(n) && n >= 1 && n <= 7)) throw new Error('cast: a party is 1 to 7 besides the hero');
  if (scale === 'hero') return {};
  if (scale === 'rival') return { rival: { relation: 'rival' } };
  if (scale === 'party') return { party: { relation: 'party', n } };
  return {
    mastermind: { relation: 'mastermind' },
    'mastermind/lieutenant': { relation: 'lieutenant' },
    'mastermind/troops': { relation: 'rank', rank: 'foot' },
    mentor: { relation: 'mentor' },
    rival: { relation: 'rival' },
    party: { relation: 'party', n },
  };
}

// ─── reading a request ─────────────────────────────────────────────────────────────────────────────────────────────
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`cast: ${m}`);
const TOP_KEYS = ['anchor', 'cast', 'factions', 'setting', 'bodies', 'seed'];
const ANCHOR_KEYS = ['brief', 'facets', 'path', 'body', 'faction'];
const MEMBER_KEYS = ['relation', 'n', 'roles', 'rank', 'bond', 'body', 'faction', 'brief', 'facets', 'species', 'ooze', 'mascot', 'tune', 'wildcard'];
const TUNE_KEYS = ['archetype', 'technique', 'size', 'shadow', 'looseness', 'silhouette'];
const FACTION_KEYS = ['tradition', 'era', 'lean'];
const SEGMENT = /^[a-z][a-z0-9-]{0,23}$/;
const unit01 = (v) => typeof v === 'number' && v >= 0 && v <= 1;

/** Read a cast request and say what is wrong. → the request */
export function readCastRequest(q = {}) {
  if (!isObj(q)) throw err(`a cast is { ${TOP_KEYS.join(', ')} }`);
  for (const k of Object.keys(q)) if (!TOP_KEYS.includes(k)) throw err(`'${k}' is not part of a cast (${TOP_KEYS.join(', ')})`);
  if (q.seed !== undefined && !Number.isInteger(q.seed)) throw err('seed is an integer');
  if (q.setting !== undefined) readSetting(q.setting);
  if (q.bodies !== undefined && !(isObj(q.bodies) && Object.entries(q.bodies).every(([k, w]) => BODIES.includes(k) && typeof w === 'number' && w >= 0))) throw err(`bodies is { ${BODIES.join(', ')} }, each a weight ≥ 0 on how often an unasked body is one`);
  const factions = q.factions ?? {};
  if (!isObj(factions)) throw err('factions is { <id>: { tradition?, era?, lean? } }');
  for (const [id, F] of Object.entries(factions)) {
    if (!SEGMENT.test(id)) throw err(`factions.${id}: a faction id is a short lower-case word`);
    if (!isObj(F)) throw err(`factions.${id} is { ${FACTION_KEYS.join(', ')} }`);
    for (const k of Object.keys(F)) if (!FACTION_KEYS.includes(k)) throw err(`factions.${id}.${k} is not a faction word (${FACTION_KEYS.join(', ')})`);
    readSetting(F);
  }
  const faction = (f, at) => { if (f !== undefined && !factions[f]) throw err(`${at}.faction '${f}' is not one of the factions (${Object.keys(factions).join(', ') || 'none given'})`); };
  const A = q.anchor ?? {};
  if (!isObj(A)) throw err(`anchor is { ${ANCHOR_KEYS.join(', ')} }`);
  for (const k of Object.keys(A)) if (!ANCHOR_KEYS.includes(k)) throw err(`anchor.${k} is not part of the anchor (${ANCHOR_KEYS.join(', ')})`);
  if (A.path !== undefined && !SEGMENT.test(A.path)) throw err('anchor.path is a short lower-case word (hero)');
  if (A.body !== undefined && !['person', 'beastkin'].includes(A.body)) throw err('anchor.body is \'person\' or \'beastkin\': the cast is rolled against a life');
  if (A.brief !== undefined && typeof A.brief !== 'string') throw err('anchor.brief is words');
  if (A.facets !== undefined && !isObj(A.facets)) throw err('anchor.facets is the Egocube\'s facets');
  faction(A.faction, 'anchor');
  const cast = q.cast ?? {};
  if (!isObj(cast)) throw err('cast is { <key>: { relation, … } }: the members by their path below the anchor');
  const seen = new Set();
  for (const [key, m] of Object.entries(cast)) {
    const at = `cast.${key}`, segs = key.split('/');
    if (!segs.every((s) => SEGMENT.test(s))) throw err(`${at}: a member's key is a path of short lower-case words (rival, emperor/dragon)`);
    const parent = segs.slice(0, -1).join('/');
    if (parent && !seen.has(parent)) throw err(`${at}: its parent '${parent}' is written before it (a relation is to its parent)`);
    if (!isObj(m)) throw err(`${at} is { relation, … }`);
    for (const k of Object.keys(m)) if (!MEMBER_KEYS.includes(k)) throw err(`${at}.${k} is not part of a member (${MEMBER_KEYS.join(', ')})`);
    if (!RELATIONS[m.relation]) throw err(`${at}.relation is one of ${Object.keys(RELATIONS).join(', ')} (got ${JSON.stringify(m.relation)})`);
    if (m.n !== undefined && !(Number.isInteger(m.n) && m.n >= 1 && m.n <= 7)) throw err(`${at}.n is 1 to 7: that many members`);
    if (m.roles !== undefined && !(Array.isArray(m.roles) && m.roles.every((r) => ROLES[r]))) throw err(`${at}.roles is a list of roles (${Object.keys(ROLES).join(', ')})`);
    if (m.relation === 'rank' ? !RANKS.hasOwnProperty(m.rank) : m.rank !== undefined) throw err(`${at}.rank is one of ${Object.keys(RANKS).join(', ')}${m.relation === 'rank' ? '' : ', on a rank member'}`);
    if (m.bond !== undefined && !BONDS.includes(m.bond)) throw err(`${at}.bond is ${BONDS.map((b) => `'${b}'`).join(' or ')} (first party: in the party; second party: a familiar)`);
    if (m.body !== undefined && !BODIES.includes(m.body)) throw err(`${at}.body is one of ${BODIES.join(', ')}`);
    if (m.species !== undefined && !(typeof m.species === 'string' && m.species)) throw err(`${at}.species is a species id (fauna: wolf, lion, greatHornedOwl …)`);
    if (m.species !== undefined && (m.body ?? 'beast') !== 'beast') throw err(`${at}.species is a beast's`);
    if (m.ooze !== undefined) {
      if ((m.body ?? (m.species !== undefined ? 'beast' : undefined)) !== 'beast') throw err(`${at}.ooze makes a beast a game creature: give body: 'beast'`);
      const bad = oozeErrors(m.ooze, `${at}.ooze`);
      if (bad.length) throw err(bad.join('; '));
    }
    if (m.mascot !== undefined && !isObj(m.mascot)) throw err(`${at}.mascot is the mascot's facets (mascot.js)`);
    if (m.brief !== undefined && typeof m.brief !== 'string') throw err(`${at}.brief is words`);
    if (m.facets !== undefined && !isObj(m.facets)) throw err(`${at}.facets is the Egocube's facets`);
    if (m.wildcard !== undefined && typeof m.wildcard !== 'boolean') throw err(`${at}.wildcard is true for a member the bookends do not hold`);
    if (m.tune !== undefined) {
      if (!isObj(m.tune)) throw err(`${at}.tune is { ${TUNE_KEYS.join(', ')} }`);
      for (const [k, v] of Object.entries(m.tune)) {
        if (!TUNE_KEYS.includes(k)) throw err(`${at}.tune.${k} is not a tuning (${TUNE_KEYS.join(', ')})`);
        if (k === 'silhouette' ? !['same', 'distinct'].includes(v) : !(k === 'size' ? typeof v === 'number' && v >= -1 && v <= 1 : unit01(v))) throw err(`${at}.tune.${k} is ${k === 'silhouette' ? "'same' or 'distinct'" : k === 'size' ? 'a number −1 … 1' : 'a number 0 … 1'}`);
      }
    }
    faction(m.faction, at);
    if (m.n !== undefined) for (let i = 1; i <= m.n; i++) seen.add(`${key}-${i}`);
    else seen.add(key);
  }
  return q;
}

// ─── the operators ─────────────────────────────────────────────────────────────────────────────────────────────────
const COMBAT_ROLES = Object.keys(ROLES).filter((r) => r !== 'non-combatant');
const wordOf = (derives) => (derives?.silhouette ?? []).map((d) => /^silhouette = (\S+)/.exec(d)?.[1]).find(Boolean);
const ROLE_WORD = Object.fromEntries(Object.entries(ROLES).map(([r, v]) => [r, wordOf(v.derives)]));
const ARCHETYPE_WORDS = Object.fromEntries(ARCHETYPE_IDS.map((a) => [a, [wordOf(ARCHETYPES[a].light.derives), wordOf(ARCHETYPES[a].shadow.derives)].filter(Boolean)]));
const BUILD_IDS = Object.keys(BUILDS), AGE_IDS = Object.keys(AGES);
/** A facet's distance between two values, 0 … 1. */
export function facetDistance(facet, v, a) {
  if (v === a) return 0;
  if (facet === 'archetype') { const n = ARCHETYPE_IDS.length, s = Math.abs(ARCHETYPE_IDS.indexOf(v) - ARCHETYPE_IDS.indexOf(a)); return Math.min(s, n - s) / (n / 2); }
  if (facet === 'role') return v === 'non-combatant' || a === 'non-combatant' ? 1 : Math.abs(COMBAT_ROLES.indexOf(v) - COMBAT_ROLES.indexOf(a)) / (COMBAT_ROLES.length - 1);
  if (facet === 'build') return Math.abs(BUILD_IDS.indexOf(v) - BUILD_IDS.indexOf(a)) / (BUILD_IDS.length - 1);
  if (facet === 'age') return Math.abs(AGE_IDS.indexOf(v) - AGE_IDS.indexOf(a)) / (AGE_IDS.length - 1);
  throw err(`no distance on ${facet}`);
}
const gauss = (x, l) => Math.exp(-(x * x) / (2 * l * l));
const round3 = (x) => Math.round(x * 1000) / 1000;
const VALUES = { archetype: ARCHETYPE_IDS, role: Object.keys(ROLES), build: BUILD_IDS, age: AGE_IDS };

/** One operator over a facet → { <value>: × } (absent when it says nothing). */
function operatorLean(facet, op, anchorValue, looseness) {
  if (!op) return null;
  const l = op.l ?? looseness, out = {};
  for (const v of VALUES[facet]) {
    let w = 1;
    if (op.d !== undefined && anchorValue !== undefined) {
      if (op.signed) {
        const ids = VALUES[facet], at = ids.indexOf(anchorValue) / (ids.length - 1), t = Math.min(1, Math.max(0, at + op.d));
        w = gauss(ids.indexOf(v) / (ids.length - 1) - t, l);
      } else w = gauss(facetDistance(facet, v, anchorValue) - op.d, l);
    }
    if (op.toward?.[v] !== undefined) w *= op.toward[v];
    out[v] = round3(Math.max(w, 1e-3));
  }
  return out;
}
const ageLean = (step, a) => {
  if (step === undefined || a === undefined) return null;
  const t = Math.min(AGE_IDS.length - 1, Math.max(0, AGE_IDS.indexOf(a) + step));
  return Object.fromEntries(AGE_IDS.map((v, i) => [v, round3(Math.max(gauss(i - t, 0.6), 1e-3))]));
};
const clampPull = (P) => ({ ...P, at: Math.round(Math.min(1, Math.max(0, P.at)) * 100) / 100 });
const mul = (a, b) => { if (!a) return b; if (!b) return a; const out = { ...a }; for (const [k, w] of Object.entries(b)) out[k] = round3((out[k] ?? 1) * w); return out; };

// ─── bodies, silhouettes, statures ─────────────────────────────────────────────────────────────────────────────────
function hashSeed(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const die = (seed, path, what) => mulberry32(hashSeed(`${seed}::cast::${path}::${what}`));
function pickWeighted(rand, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0), total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) if ((r -= w) < 0) return v;
  return entries[entries.length - 1][0];
}
const pickOne = (rand, list) => list[Math.floor(rand() * list.length)];

/** A member's silhouette word: its sheet's (a person's), its form (a mascot's), its family (a beast's). */
export function silhouetteOf(m) {
  if (m.body === 'beast') return `beast:${m.beast.family}`;
  if (m.body === 'mascot') return `mascot:${m.sheet.facets.form}`;
  for (const d of m.sheet.derives?.silhouette ?? []) { const x = /^silhouette = (\S+)/.exec(d); if (x) return x[1]; }
  return null;
}
/** A person's stature (the plan's metres, before the head): the build's height at the age's scale. */
export const statureOf = (m) => (m.body === 'person' || m.body === 'beastkin' ? round3(HEIGHT[m.sheet.facets.build] * AGE_SCALE[m.sheet.facets.age]) : null);
/** The facets a member's mind is read from: the sheet's (a person), the temperament's (a beast, a mascot). */
const mindOf = (m) => m.temperament ?? m.sheet.facets;
/** A member's accent hue, by its archetype (the mascot read's), the one a familiar wears. */
const accentOf = (m) => ARCHETYPE_HUE[mindOf(m).archetype];

// ─── rolling ───────────────────────────────────────────────────────────────────────────────────────────────────────
const depthOf = (path) => path.split('/').length - 1;

/** The members in the order they are rolled: { key, path, parent, spec }, a counted member as each of its n. */
function membersOf(q, anchorPath) {
  const out = [];
  for (const [key, m] of Object.entries(q.cast ?? {})) {
    const parentKey = key.split('/').slice(0, -1).join('/'), parent = parentKey ? `${anchorPath}/${parentKey}` : anchorPath;
    if (m.n === undefined) out.push({ key, path: `${anchorPath}/${key}`, parent, spec: m });
    else for (let i = 1; i <= m.n; i++) {
      const role = m.roles?.[i - 1];
      out.push({ key: `${key}-${i}`, path: `${anchorPath}/${key}-${i}`, parent, spec: { ...m, ...(role ? { facets: { ...(m.facets ?? {}), role } } : {}) } });
    }
  }
  return out;
}

/** The roll's lean and pull for a member against its anchor (and the party so far, and the root). */
function relationOf(spec, anchor, root, partySoFar, depth, bounds) {
  const Rel = RELATIONS[spec.relation], T = spec.tune ?? {}, l = T.looseness ?? 0.2;
  const a = mindOf(anchor), lean = {}, pull = {};
  const set = (facet, L) => { if (L) lean[facet] = mul(lean[facet], L); };
  if (spec.relation === 'rank') {
    const iota = RANKS[spec.rank];
    set('archetype', operatorLean('archetype', { d: 0 }, a.archetype, 0.1 + 0.4 * iota));
    if (spec.rank === 'foot' || spec.rank === 'elite') set('role', { frontline: 3, 'non-combatant': 0.05 });
    if (spec.rank === 'hired') { pull.motivation = { at: 0.65, spread: 0.08, min: 0.5, max: 0.8 }; pull.order = { at: 0.8, spread: 0.1 }; }
    else pull.motivation = { at: a.motivation, spread: 0.1 + 0.2 * iota };
    return { lean, pull, individuation: iota };   // a rank sits outside the bookends: the troops are the master's
  }
  const arch = Rel.archetype && { ...Rel.archetype, ...(T.archetype !== undefined ? { d: T.archetype } : {}) };
  set('archetype', operatorLean('archetype', arch, a.archetype, l));
  const role = Rel.role && { ...Rel.role, ...(T.technique !== undefined ? { d: T.technique } : {}) };
  set('role', operatorLean('role', role ?? (T.technique !== undefined ? { d: T.technique } : null), a.role, l));
  const size = Rel.size ? { ...Rel.size, ...(T.size !== undefined ? { d: Math.abs(T.size), signed: Rel.size.signed || T.size < 0 ? true : undefined } : {}) } : (T.size !== undefined ? { d: T.size, signed: T.size < 0 || undefined } : null);
  if (size && anchor.body !== 'beast' && anchor.body !== 'mascot') set('build', operatorLean('build', size, anchor.sheet.facets.build, l));
  if (Rel.age && anchor.body !== 'beast' && anchor.body !== 'mascot') set('age', ageLean(Rel.age.step, anchor.sheet.facets.age));
  if (Rel.complement) {
    const roles = new Set(partySoFar.map((m) => mindOf(m).role)), archs = new Set(partySoFar.map((m) => mindOf(m).archetype));
    set('role', Object.fromEntries(Object.keys(ROLES).map((r) => [r, r === 'non-combatant' ? 0 : roles.has(r) ? 0.08 : 1])));
    set('archetype', Object.fromEntries(ARCHETYPE_IDS.map((x) => [x, archs.has(x) ? 0.15 : 1])));
  }
  // a shadow wears its anchor's shape; a rival and a foil another
  const tuned = T.silhouette ?? Rel.silhouette, word = silhouetteOf(anchor);
  if (tuned && word) {
    const k = tuned === 'same' ? 4 : 0.2;
    set('role', Object.fromEntries(Object.keys(ROLES).map((r) => [r, ROLE_WORD[r] === word ? k : 1])));
    set('archetype', Object.fromEntries(ARCHETYPE_IDS.map((x) => [x, ARCHETYPE_WORDS[x].includes(word) ? k : 1])));
  }
  // the party reads by silhouette alone: away from the roles and the archetypes that draw a shape it already has
  if ((spec.bond ?? Rel.bond) === 'party') {
    const taken = new Set(partySoFar.map(silhouetteOf).filter(Boolean));
    if (taken.size) {
      set('role', Object.fromEntries(Object.keys(ROLES).map((r) => [r, taken.has(ROLE_WORD[r]) ? 0.1 : 1])));
      set('archetype', Object.fromEntries(ARCHETYPE_IDS.map((x) => [x, ARCHETYPE_WORDS[x].some((w) => taken.has(w)) ? 0.3 : 1])));
    }
  }
  // a facet the relation leaves free leans toward the root anchor, the less the deeper
  if (!Rel.archetype && !Rel.complement && depth > 0) {
    const s = 0.6 ** depth, r = mindOf(root).archetype;
    set('archetype', Object.fromEntries(ARCHETYPE_IDS.map((x) => [x, round3(1 - s + s * gauss(facetDistance('archetype', x, r), 0.3))])));
  }
  const shadow = T.shadow ?? Rel.shadow;
  if (Rel.motivation) pull.motivation = Rel.motivation;
  else if (shadow !== undefined) pull.motivation = clampPull({ at: a.motivation + shadow * (1 - 2 * a.motivation), spread: 0.08 });
  else if (Rel.echo !== undefined) pull.motivation = clampPull({ at: a.motivation + (Rel.by ?? 0), spread: Rel.echo });
  if (Rel.order) pull.order = Rel.order;
  // after both poles, a pulled motivation stays between them (the bookends)
  if (bounds && pull.motivation) pull.motivation = { ...pull.motivation, min: Math.max(pull.motivation.min ?? 0, bounds[0]), max: Math.min(pull.motivation.max ?? 1, bounds[1]) };
  return { lean, pull };
}

/** Roll one member's body on the cast's dice. → the member record, less its laws */
function rollMember({ path, parent, spec, anchor, root, partySoFar, seed, setting, factions, bodies, redraw, bounds }) {
  const Rel = RELATIONS[spec.relation];
  const bond = spec.bond ?? Rel.bond ?? null;
  const faction = spec.faction ?? anchor.faction ?? null;
  const own = faction ? { ...(setting ?? {}), ...factions[faction] } : setting;
  const era = own?.era ?? 'myth';
  let body = spec.body;
  if (!body) {
    const odds = bond && BODY_ODDS[bond]?.[era];
    if (odds) {
      const w = { ...odds };
      if (w.mascot) w.mascot *= 1 + 4 * mascotWeight(own);
      for (const [k, x] of Object.entries(bodies ?? {})) if (w[k] !== undefined) w[k] *= x; else if (x > 0 && k !== 'person') w[k] = 0.05 * x;
      if (bond === 'party') for (const o of partySoFar) if (o.body !== 'person' && w[o.body]) w[o.body] *= 0.25;
      body = pickWeighted(die(seed, path, 'body'), w);
    } else body = 'person';
  }
  const { lean, pull, individuation } = relationOf(spec, anchor, root, partySoFar, depthOf(path), spec.relation === 'rank' || bond === 'familiar' || spec.wildcard ? null : bounds);
  const facets = { ...(spec.facets ?? {}) };
  if (body === 'beastkin' && facets.ancestry === undefined) facets.ancestry = pickOne(die(seed, path, 'lineage'), BEASTKIN);
  const roll = { brief: spec.brief ?? '', facets, seed, path, ...(own !== undefined ? { setting: own } : {}), ...(Object.keys(lean).length ? { lean } : {}), ...(Object.keys(pull).length ? { pull } : {}), ...(redraw ? { redraw } : {}) };
  const person = rollEgocube(roll);
  const rec = { path, of: parent, relation: spec.relation, ...(bond ? { bond } : {}), body, ...(faction ? { faction } : {}), ...(spec.rank ? { rank: spec.rank, individuation } : {}), ...(spec.wildcard ? { wildcard: true } : {}) };
  if (body === 'person' || body === 'beastkin') return { ...rec, sheet: person };
  const temperament = Object.fromEntries(['role', 'archetype', 'motivation', 'order'].map((k) => [k, person.facets[k]]));
  const given = person.given.filter((k) => k in temperament);
  // a familiar wears its keeper's accent; a mascot reads its promise from the temperament's archetype
  const accent = bond === 'familiar' ? accentOf(anchor) : undefined;
  if (body === 'beast') {
    const known = [...Object.values(BEASTS), ...Object.values(PARTY_BEASTS)].flat().find(([id]) => id === spec.species);
    const pool = (bond === 'party' ? PARTY_BEASTS : BEASTS)[temperament.role] ?? BEASTS[temperament.role];
    const chosen = spec.species ? [spec.species, known?.[1] ?? 'beast'] : pickOne(die(seed, path, 'species'), pool);
    return { ...rec, temperament, given, reading: person.reading, beast: { species: chosen[0], family: chosen[1], ...(spec.ooze !== undefined ? { ooze: spec.ooze } : {}) }, ...(accent ? { accent } : {}) };
  }
  const mf = { promise: ARCHETYPE_PROMISE[temperament.archetype], ...(accent ? { hue: accent } : {}), ...(spec.mascot ?? {}) };
  const sheet = rollMascot({ facets: mf, seed, path, ...(own !== undefined ? { setting: own } : {}) });
  return { ...rec, temperament, given, reading: person.reading, sheet, ...(accent ? { accent } : {}) };
}

const givenOf = (m) => new Set(m.given ?? m.sheet?.given ?? []);
/** The laws a member breaks against the members before it: [{ law, against, why, on }] */
function lawsBroken(m, before, anchor, poles) {
  const out = [], sil = silhouetteOf(m), Rel = RELATIONS[m.relation], tuned = m.tune?.silhouette ?? Rel.silhouette;
  if (m.bond === 'party' && sil) {
    const twin = before.find((o) => o.bond === 'party' && silhouetteOf(o) === sil);
    if (twin) out.push({ law: 'party-silhouette', against: twin.path, why: `the party reads by silhouette alone: ${twin.path} is already a ${sil}`, on: ['role', 'archetype'] });
  }
  const parent = before.find((o) => o.path === m.of);
  if (parent && tuned && sil) {
    const ps = silhouetteOf(parent);
    if (tuned === 'same' && ps && ps !== sil) out.push({ law: 'shadow-silhouette', against: parent.path, why: `a shadow wears its anchor's silhouette word (${ps}), not ${sil}`, on: ['role', 'archetype'] });
    if (tuned === 'distinct' && ps === sil) out.push({ law: 'distinct-silhouette', against: parent.path, why: `a ${m.relation} is another shape than its anchor (both ${sil})`, on: ['role', 'archetype'] });
  }
  const st = statureOf(m);
  if (st && m.relation !== 'rank' && m.bond !== 'familiar') {
    const same = before.find((o) => o.relation !== 'rank' && o.bond !== 'familiar' && silhouetteOf(o) === sil && statureOf(o) && Math.abs(statureOf(o) - st) / Math.max(st, statureOf(o)) < 0.025);
    if (same) out.push({ law: 'size-ladder', against: same.path, why: `side by side with ${same.path}: the same silhouette word (${sil}) and the same stature`, on: ['build', 'age', 'role', 'archetype'] });
  }
  if (poles.length === 2 && !poles.includes(m) && !m.wildcard && m.relation !== 'rank' && m.bond !== 'familiar') {
    const [lo, hi] = [Math.min(...poles.map((p) => mindOf(p).motivation)), Math.max(...poles.map((p) => mindOf(p).motivation))], v = mindOf(m).motivation;
    if (v < lo - 0.05 || v > hi + 0.05) out.push({ law: 'bookends', against: poles[1].path, why: `motivation ${v} sits outside the poles' ${lo} … ${hi}`, on: ['motivation'] });
  }
  return out;
}

/** Roll a cast. → { seed, anchor, order, members, redraws, kept, bookends, unread } */
export function rollCast(q = {}) {
  readCastRequest(q);
  const seed = q.seed ?? 1, A = q.anchor ?? {}, anchorPath = A.path ?? 'hero', factions = q.factions ?? {}, setting = q.setting, bodies = q.bodies;
  const own = A.faction ? { ...(setting ?? {}), ...factions[A.faction] } : setting;
  const facets = { ...(A.facets ?? {}) };
  if (A.body === 'beastkin' && facets.ancestry === undefined) facets.ancestry = pickOne(die(seed, anchorPath, 'lineage'), BEASTKIN);
  const anchorSheet = rollEgocube({ brief: A.brief ?? '', facets, seed, path: anchorPath, ...(own !== undefined ? { setting: own } : {}) });
  const anchor = { path: anchorPath, of: null, relation: null, bond: 'party', body: A.body ?? 'person', ...(A.faction ? { faction: A.faction } : {}), sheet: anchorSheet };
  const rolled = [anchor], byPath = { [anchorPath]: anchor }, redraws = [], kept = [], poles = [anchor];
  for (const { path, parent, spec } of membersOf(q, anchorPath)) {
    const anchorOf = byPath[parent], partySoFar = rolled.filter((o) => o.bond === 'party');
    let m, broken = [], r = 0;
    for (; r <= MAX_REDRAWS; r++) {
      const bounds = poles.length === 2 ? [Math.min(...poles.map((p) => mindOf(p).motivation)), Math.max(...poles.map((p) => mindOf(p).motivation))] : null;
      m = { ...rollMember({ path, parent, spec, anchor: anchorOf, root: anchor, partySoFar, seed, setting, factions, bodies, redraw: r, bounds }), ...(spec.tune ? { tune: spec.tune } : {}) };
      const asked = givenOf(m);
      broken = lawsBroken(m, rolled, anchor, poles).map((b) => ({ ...b, held: b.on.every((k) => asked.has(k)) }));
      if (broken.every((b) => b.held)) break;
      if (r < MAX_REDRAWS) for (const b of broken.filter((x) => !x.held)) redraws.push({ path, law: b.law, against: b.against, attempt: r });
    }
    for (const b of broken) kept.push({ path, law: b.law, against: b.against, why: b.why, ...(b.held ? { held: true } : {}) });
    const { tune: _t, ...rec } = m;
    const out = { ...rec, silhouette: silhouetteOf(m), stature: statureOf(m), ...(r ? { redrawn: Math.min(r, MAX_REDRAWS) } : {}) };
    rolled.push(out); byPath[path] = out;
    if (RELATIONS[spec.relation].pole && poles.length < 2) poles.push(out);
  }
  anchor.silhouette = silhouetteOf(anchor); anchor.stature = statureOf(anchor);
  const named = rolled.filter((o) => o.relation !== 'rank');
  return {
    seed, anchor: anchorPath,
    ...(setting !== undefined ? { setting } : {}), ...(Object.keys(factions).length ? { factions } : {}),
    order: rolled.map((o) => o.path),
    members: Object.fromEntries(rolled.map((o) => [o.path, o])),
    redraws, kept,
    bookends: poles.length === 2 ? { poles: poles.map((p) => p.path), motivation: poles.map((p) => mindOf(p).motivation), order: poles.map((p) => mindOf(p).order) } : null,
    unread: named.length > 1 ? ['palette spread: a person\'s sheet names no hue yet; the eyes judge whether the named members\' accents sit apart', ...(poles.length === 2 ? ['bookends on value, shape language and saturation: the eyes judge them; motivation is the one the roll holds'] : [])] : [],
  };
}

/** The members of a cast in a short line each: path, relation, body, the read. For a readout. */
export function castLines(C) {
  return C.order.map((p) => {
    const m = C.members[p], f = mindOf(m);
    const body = m.body === 'beast' ? `a ${m.beast.species}` : m.body === 'mascot' ? `a mascot (${m.sheet.facets.promise})` : m.body === 'beastkin' ? `${m.sheet.ancestry.reads}` : 'a person';
    return `${p}${m.relation ? ` (${m.relation}${m.bond && m.bond !== m.relation ? `, ${m.bond}` : ''})` : ''}: ${body}; ${f.role}, the ${f.archetype}, motivation ${f.motivation}${m.silhouette ? `; ${m.silhouette}` : ''}`;
  });
}

