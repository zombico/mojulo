/**
 * brawl-villains — THE SUPERVILLAIN SHELF: who a superhero street ends on, one row each, every row composed of the foe
 * shelf's idioms as the street plays them (brawl-crowd.js; docs/foes.md): a SUMMONER's summons (called a few at a time,
 * cut down with it), a PAIR (two as one encounter: one down, the other enrages), a FORM it is defeated into (the shelf's
 * modes: `becomes`), stages that CALL its henchmen in; its power (brawl-powers.js) its every special. Nothing here is
 * new behaviour: a new villain is a row of words the street already plays, and an agent designs one in the same words.
 *
 *   VILLAINS          { <kind>: row }: the masterminds, the juggernauts, the twins, the warlords, the speedsters, the
 *                     tempests, and the campaign's LIEUTENANTS (`lieutenant: true`: who holds a street on the way)
 *   VILLAIN_WORDS     what a designed villain may say over its kind's row
 *   readVillain(v, at)   a villain's words checked (its kind's row with the person's words over it) → the row, settled
 *                     { kind, idiom, name?, reads, beat, archetype, power, cpu, hp, summons?, pair?, stages, henchmen? }
 *   villainWave(row, { name, power?, crowd? }) → the boss's wave words (brawl-crowd.js readWaves): { boss, crowd } — its
 *                     fighter (the archetype's, its power over it), its stages (each its cpu, its name, the fighter it
 *                     becomes, who it calls in), its summons, its pair; `crowd` the bodies its stages call, each its stage
 *   villainSays(row)  → { reads, beat }: what it does and how it is beaten, said to a player
 *
 * A row:
 *   idiom      the foe shelf's word it is built on: summoner | pair | modes | stages | pursuer
 *   reads      what it does, said to a player; beat: how it is beaten
 *   archetype  its fighter (versus-solver.js), power: its every special (one of the shelf's, or designed: readPower)
 *   cpu, hp    how it fights as it comes in (versus-cpu.js CPU_LEVELS), its health (the street's crowd tune over it)
 *   summons    { type, n?, every?, bound? } (brawl-crowd.js readSummons): who it calls while it stands
 *   pair       { archetype, power, name?, down? }: the second of two (brawl-crowd.js readPair)
 *   stages     [{ at?, name?, cpu?, calls?: { <crowd type>: n }, form?: { archetype, power, name? } }]: its acts, each
 *              begun as its health falls (the first as it comes in), `calls` the henchmen it calls in as that act
 *              begins, `form` the fighter it is defeated into
 *   henchmen   [{ type, n, summons? }]: who stands with it from the start
 * Pure.
 */
import { solveFighter } from '../versus/versus-solver.js';
import { CPU_LEVELS } from '../versus/versus-cpu.js';
import { readPower, powerRecipe } from './brawl-powers.js';
import { CROWD_TYPES, CROWD_TYPE_IDS, BOSS_PLAYS, SUMMON_EVERY, PAIR_DOWNS } from './brawl-crowd.js';

const f = Object.freeze;
const IDIOMS = f(['summoner', 'pair', 'modes', 'stages', 'pursuer']);
const ARCHETYPES = f(['all-rounder', 'rushdown', 'zoner', 'grappler']);

export const VILLAINS = f({
  mastermind: f({ idiom: 'summoner', name: 'The Mastermind', archetype: 'zoner', power: 'nova', cpu: 'novice', hp: 440,
    reads: 'keeps back behind a screen of drones it summons, a few at a time, and throws a great ball of force; hurt, it calls its blasters',
    beat: 'go through the drones to it: cut it down and every drone it called falls with it',
    summons: f({ type: 'drone', n: 2, every: 200, bound: true }),
    stages: f([f({ name: 'The plan' }), f({ at: 0.6, name: 'Contingency', cpu: 'regular', calls: f({ blaster: 2 }) }), f({ at: 0.25, name: 'Endgame', cpu: 'veteran' })]) }),
  juggernaut: f({ idiom: 'modes', name: 'The Juggernaut', archetype: 'grappler', power: 'might', cpu: 'regular', hp: 520,
    reads: 'an armoured suit that walks through blows and grabs and slams; break the suit and the one inside comes out fast and furious',
    beat: 'stay out of its grab while the suit stands; once it breaks, the pilot is quick but frail',
    stages: f([f({ name: 'The suit' }), f({ at: 0.45, name: 'The suit breaks', cpu: 'veteran', form: f({ archetype: 'rushdown', power: 'frenzy', name: 'Out of the suit' }) })]) }),
  twins: f({ idiom: 'pair', name: 'The Twins', archetype: 'zoner', power: 'beam', cpu: 'regular', hp: 300,
    reads: 'two who fight as one: one fires down the street while the other rushes in; drop one and the other is enraged',
    beat: 'drop the one that fires first, then weather the other\'s rage',
    pair: f({ archetype: 'rushdown', power: 'flame', down: 'enrage' }),
    stages: f([f({}), f({ at: 0.5, name: 'Side by side', cpu: 'veteran' })]) }),
  warlord: f({ idiom: 'stages', name: 'The Warlord', archetype: 'grappler', power: 'wall', cpu: 'novice', hp: 500,
    reads: 'fights at the head of its army, raising walls of stone and shoving them down the street, calling soldiers in at every turn',
    beat: 'clear each wave of reinforcements before you close in; stand off the line its walls slide down',
    henchmen: f([f({ type: 'heavy', n: 1 })]),
    stages: f([f({ name: 'At the head of the army' }), f({ at: 0.66, name: 'Reinforcements', cpu: 'regular', calls: f({ thug: 2, heavy: 1 }) }), f({ at: 0.33, name: 'The last line', cpu: 'veteran', calls: f({ blaster: 2 }) })]) }),
  speedster: f({ idiom: 'pursuer', name: 'The Speedster', archetype: 'rushdown', power: 'frenzy', cpu: 'veteran', hp: 340,
    reads: 'never still: it runs you down from across the street and is gone before you can answer',
    beat: 'let it come and meet its rush with your strong; it does not stand and trade',
    stages: f([f({}), f({ at: 0.4, name: 'Faster', cpu: 'ace' })]) }),
  tempest: f({ idiom: 'modes', name: 'The Tempest', archetype: 'zoner', power: 'storm', cpu: 'regular', hp: 420,
    reads: 'calls lightning down all round it; hurt, it becomes the eye of a hurricane that blows you down the street',
    beat: 'stay out of its storm\'s reach, then strike between gusts',
    stages: f([f({ name: 'The storm' }), f({ at: 0.5, name: 'The eye of the storm', form: f({ archetype: 'zoner', power: 'gale', name: 'The eye of the storm' }) })]) }),
  // ── the campaign's LIEUTENANTS: who holds a street on the way to the villain ──
  enforcer: f({ idiom: 'stages', lieutenant: true, name: 'The Enforcer', archetype: 'grappler', power: 'might', cpu: 'novice', hp: 400,
    reads: 'the army\'s heavy: grabs and slams, and calls its thugs in when it is hurt',
    beat: 'keep out of its grab and strike as it recovers',
    stages: f([f({}), f({ at: 0.5, name: 'Back-up', calls: f({ thug: 2 }) })]) }),
  conjurer: f({ idiom: 'summoner', lieutenant: true, name: 'The Conjurer', archetype: 'zoner', power: 'beam', cpu: 'novice', hp: 340,
    reads: 'the army\'s summoner: hangs back and calls drones out of the ground',
    beat: 'go through the drones to it: when it falls they fall with it',
    summons: f({ type: 'drone', n: 2, every: 240, bound: true }),
    stages: f([f({}), f({ at: 0.4, name: 'Swarm', cpu: 'regular' })]) }),
});
export const VILLAIN_KINDS = f(Object.keys(VILLAINS).filter((k) => !VILLAINS[k].lieutenant));
export const LIEUTENANT_KINDS = f(Object.keys(VILLAINS).filter((k) => VILLAINS[k].lieutenant));

/** what a designed villain may say over its kind's row */
export const VILLAIN_WORDS = f(['kind', 'name', 'archetype', 'power', 'cpu', 'hp', 'summons', 'pair', 'stages', 'henchmen']);
const fail = (m) => new Error(`brawl: ${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const crowdOf = (v, at) => {
  if (!isObj(v) || !Object.keys(v).length) throw fail(`${at} is { <crowd type>: n }: who comes (${CROWD_TYPE_IDS.join(', ')})`);
  for (const [t, n] of Object.entries(v)) {
    if (!CROWD_TYPES[t]) throw fail(`${at}.${t}: a crowd type (${CROWD_TYPE_IDS.join(', ')})`);
    if (!(Number.isInteger(n) && n >= 1 && n <= 4)) throw fail(`${at}.${t} is how many, 1 to 4`);
  }
  return v;
};
const fighterOf = (v, at) => {
  if (!isObj(v)) throw fail(`${at} is { archetype, power, name? }`);
  for (const k of Object.keys(v)) if (!['archetype', 'power', 'name', 'down'].includes(k)) throw fail(`${at}.${k} is not its word (archetype, power, name${at.endsWith('pair') ? ', down' : ''})`);
  if (!ARCHETYPES.includes(v.archetype)) throw fail(`${at}.archetype is how it fights: ${ARCHETYPES.join(', ')}`);
  try { readPower(v.power, 'power'); } catch (e) { throw fail(`${at}.${e.message.replace(/^brawl: /, '')}`); }
  return v;
};

export function readVillain(v, at = 'villain') {
  const V = typeof v === 'string' ? { kind: v } : v;
  if (!isObj(V)) throw fail(`${at} is a kind (${VILLAIN_KINDS.join(', ')}) or { ${VILLAIN_WORDS.join('?, ')}? }`);
  for (const k of Object.keys(V)) if (!VILLAIN_WORDS.includes(k)) throw fail(`${at}.${k} is not a villain's word (${VILLAIN_WORDS.join(', ')})`);
  const kind = V.kind ?? 'mastermind';
  if (!VILLAINS[kind]) throw fail(`${at}.kind is one of ${Object.keys(VILLAINS).join(', ')}`);
  const R = { kind, ...VILLAINS[kind], ...Object.fromEntries(Object.entries(V).filter(([k]) => k !== 'kind')) };
  if (!ARCHETYPES.includes(R.archetype)) throw fail(`${at}.archetype is how it fights: ${ARCHETYPES.join(', ')}`);
  try { readPower(R.power, 'power'); } catch (e) { throw fail(`${at}.${e.message.replace(/^brawl: /, '')}`); }
  if (!CPU_LEVELS[R.cpu]) throw fail(`${at}.cpu is one of ${Object.keys(CPU_LEVELS).join(', ')}`);
  if (!(Number.isInteger(R.hp) && R.hp >= 100 && R.hp <= 2000)) throw fail(`${at}.hp is its health, 100 to 2000`);
  if (R.name !== undefined && !(typeof R.name === 'string' && R.name.trim() && R.name.length <= 40)) throw fail(`${at}.name is a short name (at most 40 letters)`);
  if (R.summons !== undefined) {
    const S = R.summons;
    if (!isObj(S) || !CROWD_TYPES[S.type] || CROWD_TYPES[S.type].hangs) throw fail(`${at}.summons is { type, n?, every?, bound? }: who it calls (a crowd type that does not summon: ${CROWD_TYPE_IDS.filter((t) => !CROWD_TYPES[t].hangs).join(', ')})`);
    if (S.n !== undefined && !(Number.isInteger(S.n) && S.n >= 1 && S.n <= 4)) throw fail(`${at}.summons.n is how many at once, 1 to 4`);
    if (S.every !== undefined && !(Number.isInteger(S.every) && S.every >= 60 && S.every <= 900)) throw fail(`${at}.summons.every is the frames between two calls, 60 to 900 (${SUMMON_EVERY} unsaid)`);
  }
  if (R.pair !== undefined) {
    fighterOf(R.pair, `${at}.pair`);
    if (R.pair.down !== undefined && !PAIR_DOWNS.includes(R.pair.down)) throw fail(`${at}.pair.down is ${PAIR_DOWNS.join(' | ')}`);
  }
  if (!Array.isArray(R.stages) || R.stages.length < 2 || R.stages.length > 5) throw fail(`${at}.stages is 2 to 5 acts [{ at?, name?, cpu?, calls?, form? }], the first as it comes in`);
  R.stages.forEach((st, k) => {
    if (!isObj(st)) throw fail(`${at}.stages[${k}] is { at?, name?, cpu?, calls?, form? }`);
    for (const w of Object.keys(st)) if (!['at', 'name', 'cpu', 'calls', 'form'].includes(w)) throw fail(`${at}.stages[${k}].${w} is not an act's word (at, name, cpu, calls, form)`);
    if (k === 0 && (st.calls || st.form)) throw fail(`${at}.stages[0] is how it comes in: its henchmen stand with it from the start (henchmen), and it becomes nothing yet`);
    if (st.cpu !== undefined && !CPU_LEVELS[st.cpu]) throw fail(`${at}.stages[${k}].cpu is one of ${Object.keys(CPU_LEVELS).join(', ')}`);
    if (st.calls !== undefined) crowdOf(st.calls, `${at}.stages[${k}].calls`);
    if (st.form !== undefined) fighterOf(st.form, `${at}.stages[${k}].form`);
  });
  if (R.henchmen !== undefined && !(Array.isArray(R.henchmen) && R.henchmen.length <= 4 && R.henchmen.every((h) => isObj(h) && CROWD_TYPES[h.type] && Number.isInteger(h.n) && h.n >= 1 && h.n <= 4))) throw fail(`${at}.henchmen is up to 4 of [{ type, n }] (a crowd type, 1 to 4): who stands with it from the start`);
  if (!IDIOMS.includes(R.idiom)) throw fail(`${at}: its row names no idiom`);
  return R;
}

const recipeOf = (archetype, power, name, id) => ({ ...powerRecipe({ ...solveFighter({ id, archetype }).recipe, archetype }, power), archetype, name });
// (a villain's plays: the boss's own and its power thrown as a play of its own; a pursuer runs more than it stands)
const playsOf = (R) => (R.idiom === 'pursuer' ? ['run', 'run', 'kick', 'dive', 'special.neutral'] : [...BOSS_PLAYS.filter((p) => p !== 'desperate'), 'special.neutral']);

export function villainWave(row, { name, power, crowd = 1 } = {}) {
  const R = row, pw = power ?? R.power, who = name ?? R.name;
  const stages = R.stages.map((st, k) => ({ ...(st.at !== undefined ? { at: st.at } : {}), ...(st.name ? { name: st.name } : {}), ...(st.cpu ? { cpu: st.cpu } : {}),
    ...(k === R.stages.length - 1 ? { plays: [...playsOf(R), 'special.neutral', 'desperate'] } : {}),
    ...(st.form ? { form: recipeOf(st.form.archetype, st.form.power, st.form.name ?? who, `${R.kind}-form-${k}`) } : {}) }));
  // (the henchmen its stages call: each a body of its wave held back until its act; those who stand with it from the start)
  const calls = R.stages.flatMap((st, k) => Object.entries(st.calls ?? {}).map(([type, n]) => ({ type, n, stage: k })));
  const boss = {
    recipe: recipeOf(R.archetype, pw, who, R.kind), cpu: R.cpu, hp: Math.round(R.hp * crowd), plays: playsOf(R), stages,
    ...(R.summons ? { summons: { ...R.summons } } : {}),
    ...(R.pair ? { pair: { recipe: recipeOf(R.pair.archetype, R.pair.power, R.pair.name ?? `${who}'s twin`, `${R.kind}-pair`), name: R.pair.name ?? `${who}'s twin`, cpu: R.cpu, hp: Math.round(R.hp * crowd), plays: playsOf(R), down: R.pair.down ?? 'enrage' } } : {}),
  };
  return { boss, crowd: [...(R.henchmen ?? []).map((h) => ({ type: h.type, n: h.n })), ...calls] };
}

export function villainSays(row) {
  return { reads: row.reads, beat: row.beat };
}
