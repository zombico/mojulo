/**
 * arsenal — a game's WEAPONS AND STRINGS (combos.js: the arsenal the practice room plays), written once on the world and
 * laid on every level's hero that strikes, so what is tuned in the room is what every level plays.
 *
 *   gameworld.arsenal: 'auto' | false | a template's id | { from: <template>, …edits } | a whole arsenal
 *     'auto'       the kit of the world's feel template (combos.js arsenalFor: the nearer template that has one); none
 *                  when its template has no kit
 *     a template   combos.js TEMPLATE_ARSENALS: fallen-angel (the stylish game), fable-of-artesia (the action-adventure)
 *     { from }     that template's kit with edits over it: `art`, `ranged` replaced; `timing`, `mp`, `juggle` merged;
 *                  `weapons` by id (a known id's `moves` merged move by move, a move `null` dropped; its `combos` by id,
 *                  `{ id, drop: true }` dropped; any other field replaced; `{ id, drop: true }` drops the weapon; a new
 *                  id added)
 *     an arsenal   { timing?, weapons, ranged?, juggle?, art?, mp? } as combos.js readArsenal reads it
 *
 *   readGameArsenal(raw)   → raw, or throws naming what it takes (the world's read)
 *   arsenalOfGame(G)       → { arsenal, from: 'operator' | 'template' | 'feel', template?, why } or null (none written,
 *                            false, or 'auto' on a feel whose template has no kit)
 *   arsenalSuggestion(G)   → { suggest: 'auto', template, why } for a world that writes none, whose hero strikes and whose
 *                            feel's template has a kit; else null. Never laid unasked: a kit changes every level's bytes
 *   heroStrikes(G)         → the world's hero carries a right-hand item it strikes with (adornment.js BASIC_VERBS)
 *   armLevel(G, manifest)  → the level with the arsenal laid on each pilot that strikes (`rule.strikeContact`): the
 *                            weapons, the moveset, the sidearm; and on its foes the juggle's combo rules and their HEALTH
 *                            IN THE KIT'S STRINGS (below). Without an arsenal, or with no hero that strikes, the manifest
 *                            itself (zero bytes added)
 *
 * ONE SCALE: a world that writes an arsenal numbers its foes by its own kit, not by the foe shelf's frame (a blow of 20,
 * foes/vocab.js HERO; a blade deals a tenth of that). A foe's health is the strings its rank takes (STRINGS_BY_RANK: a
 * grunt one, an elite three and a half, a boss eleven) times what the kit's first light string deals on a blade of the
 * normal class (stringDamage: its moves' damage × the weapon's × HELD_STRIKE.normal's; a heavier blade fells sooner).
 *   stringDamage(A) → a number   ·   foeHealth(rank, A) → the hp a foe of that rank carries in a world armed with A
 *
 * Pure.
 */
import { TEMPLATE_ARSENALS, arsenalFor, readArsenal, lowerArsenal, lowerJuggle } from './combos.js';
import { HELD_STRIKE } from '../polygonizer/hero-swing.js';

/** The strings a foe of each rank takes to fall (mind/vocab.js RANKS), the action game's pace: a grunt to one, an elite to
 * three or four, a boss to ten or twelve. */
export const STRINGS_BY_RANK = Object.freeze({ minion: 1, elite: 3.5, miniboss: 6, boss: 11 });
/** What the kit's first light string deals: its first drawn weapon's first ground combo that opens on the light, its
 * moves' damage × the weapon's, on a blade of the normal class. */
export function stringDamage(A) {
  const W = A.weapons.find((x) => (x.figure ?? 'drawn') === 'drawn') ?? A.weapons[0];
  const c = W.combos.find((x) => !x.air && x.beats[0] === 'L') ?? W.combos.find((x) => !x.air) ?? W.combos[0];
  const per = c.moves.reduce((s, id) => s + (W.moves[id]?.damage ?? 1), 0);
  return per * (W.damage ?? 1) * HELD_STRIKE.normal.damage;
}
export const foeHealth = (rank, A) => Math.max(1, Math.round((STRINGS_BY_RANK[rank] ?? STRINGS_BY_RANK.minion) * stringDamage(A)));

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`gameworld: arsenal ${m}`); };
const TEMPLATES = Object.keys(TEMPLATE_ARSENALS);
const TAKES = `'auto' (the feel template's kit), false, a template (${TEMPLATES.join(', ')}), { from: <template>, …edits }, or an arsenal { weapons, … }`;

/** a weapon's or a combo's list, edited by id (`{ id, drop: true }` drops one; a known id merged by `merge`; a new one added) */
function byId(base, edits, merge, at) {
  if (!Array.isArray(edits)) no(`${at} is a list of edits by id`);
  const out = base.map((x) => ({ ...x }));
  for (const [i, E] of edits.entries()) {
    if (!isObj(E) || typeof E.id !== 'string' || !E.id) no(`${at}[${i}] is { id, … } (drop: true drops it)`);
    const k = out.findIndex((x) => x.id === E.id);
    if (E.drop === true) { if (k < 0) no(`${at}[${i}]: no '${E.id}' to drop (${base.map((x) => x.id).join(', ')})`); out.splice(k, 1); continue; }
    if (k < 0) out.push(E); else out[k] = merge(out[k], E);
  }
  return out;
}
function mergeWeapon(W, E) {
  const { moves, combos, ...rest } = E, out = { ...W, ...rest };
  if (moves !== undefined) {
    if (!isObj(moves)) no(`weapons '${W.id}'.moves is { <id>: a move's fields over the kit's, or null to drop it }`);
    const M = { ...W.moves };
    for (const [id, m] of Object.entries(moves)) { if (m === null) delete M[id]; else M[id] = isObj(M[id]) && isObj(m) ? { ...M[id], ...m } : m; }
    out.moves = M;
  }
  if (combos !== undefined) out.combos = byId(W.combos, combos, (c, e) => ({ ...c, ...e }), `weapons '${W.id}'.combos`);
  return out;
}
/** a template's kit with edits over it (see the header) */
function editedKit(raw) {
  const { from, ...E } = raw;
  if (!TEMPLATE_ARSENALS[from]) no(`.from is a template with a kit (${TEMPLATES.join(', ')}), not '${from}'`);
  const K = structuredClone(TEMPLATE_ARSENALS[from]);
  for (const k of Object.keys(E)) if (!['timing', 'weapons', 'ranged', 'juggle', 'art', 'mp'].includes(k)) no(`edit '${k}' is not part of an arsenal (timing, weapons, ranged, juggle, art, mp)`);
  const out = { ...K, ...(E.art !== undefined ? { art: E.art } : {}), ...(E.ranged !== undefined ? { ranged: E.ranged } : {}) };
  // (timing, mp and the juggle merged over the kit's; null drops the kit's)
  for (const k of ['timing', 'mp', 'juggle']) {
    if (E[k] === undefined) continue;
    if (E[k] === null) { delete out[k]; continue; }
    if (!isObj(E[k])) no(`.${k} is an object merged over the kit's, or null to drop it`);
    out[k] = { ...(K[k] ?? {}), ...E[k] };
  }
  // (ranged replaced; null or [] none)
  if (E.ranged === null || (Array.isArray(E.ranged) && !E.ranged.length)) delete out.ranged;
  if (E.weapons !== undefined) out.weapons = byId(K.weapons, E.weapons, mergeWeapon, 'weapons');
  return out;
}
/** the arsenal a written value names (undefined for 'auto') */
function arsenalOf(raw) {
  if (typeof raw === 'string') {
    if (!TEMPLATE_ARSENALS[raw]) no(`is ${TAKES}; '${raw}' is none of them`);
    return structuredClone(TEMPLATE_ARSENALS[raw]);
  }
  if (!isObj(raw)) no(`is ${TAKES}`);
  return raw.from !== undefined ? editedKit(raw) : raw;
}
const say = (e) => e.message.replace(/^combos: /, '');

/** A world's written arsenal, read (throws naming what it takes); returns it as written. */
export function readGameArsenal(raw) {
  if (raw === undefined || raw === null || raw === false || raw === 'auto') return raw;
  const A = arsenalOf(raw);
  try { readArsenal(A); } catch (e) { no(`${raw.from ? `(from ${raw.from}) ` : ''}${say(e)}`); }
  return raw;
}

/** The arsenal every level of a world lays on its hero, or null. */
export function arsenalOfGame(G) {
  const own = G?.arsenal;
  if (own === undefined || own === null || own === false) return null;
  if (own === 'auto') {
    const K = arsenalFor(G.feel);
    return K ? { arsenal: structuredClone(K.arsenal), from: 'feel', template: K.template, why: `its feel's template plays the ${K.template} kit` } : null;
  }
  readGameArsenal(own);
  const template = typeof own === 'string' ? own : own.from ?? null;
  return { arsenal: arsenalOf(own), from: template ? 'template' : 'operator', ...(template ? { template } : {}), why: typeof own === 'string' ? `the ${own} kit` : own.from ? `the ${own.from} kit with the operator's edits` : 'the operator\'s arsenal' };
}

/** THE BODY'S OWN BLOW (adornment.js BASIC_VERBS 'strike'): the hero carries a right-hand item it strikes with */
export const heroStrikes = (G) => (G?.characters?.hero?.adornment?.items ?? []).some((it) => it.slot === 'right' && (it.serves ?? []).includes('strike'));

/** What `arsenal: 'auto'` would lay on a world that writes none (see the header). */
export function arsenalSuggestion(G) {
  if (!G || G.arsenal !== undefined || !heroStrikes(G)) return null;
  const K = arsenalFor(G.feel);
  return K ? { suggest: 'auto', template: K.template, why: `its feel's template has a kit (${K.template}): its weapons, strings, specials and sidearm, as the practice room plays them` } : null;
}

/** The level with the world's arsenal laid on its hero that strikes and its foes (see the header). */
export function armLevel(G, manifest) {
  const R = arsenalOfGame(G);
  const ents = Array.isArray(manifest?.entities) ? manifest.entities : null;
  if (!R || !ents) return manifest;
  // (every body a seat plays the hero on, seats.js: the hero and its seats' copies, each that strikes)
  const strikes = (e) => !!(e && e.pilotable && Array.isArray(e.rule?.strikeContact));
  if (!ents.some(strikes)) return manifest;
  // (a weapon shows on the figure it names: the sheathed one, the fist's, only on an action hero that sheathes its blade,
  // levels.js actionHero; on any other hero the arsenal's sheathed weapons are left in the rack)
  const drawnOnly = { ...R.arsenal, weapons: R.arsenal.weapons.filter((W) => (W.figure ?? 'drawn') === 'drawn') };
  const lowered = new Map();
  const arm = (e) => {
    const A = e.rule.combat?.sheathed ? R.arsenal : drawnOnly;
    if (!A.weapons.length) return e;
    if (!lowered.has(A)) lowered.set(A, lowerArsenal(A));
    const weapons = lowered.get(A), side = weapons[0].sidearm;
    return { ...e, rule: { ...e.rule, weapons, moveset: weapons[0].moveset, ...(side ? { weapon: side.weapon } : {}) } };
  };
  // (the JUGGLE's rules on each foe's body: its hitstun, its air time, its recovery; a foe that writes its own keeps it)
  const combo = R.arsenal.juggle ? lowerJuggle(R.arsenal.juggle).combo : null;
  // (each foe's health in the kit's strings, by its rank: one scale)
  const foe = (e) => {
    if (!(e && e.team === 'foes' && e.body && Number.isFinite(e.body.hp))) return e;
    const body = { ...e.body, hp: foeHealth(e.rule?.mind?.rank ?? 'minion', R.arsenal), ...(combo && e.body.combo === undefined ? { combo } : {}) };
    return { ...e, body };
  };
  const entities = ents.map((e) => (strikes(e) ? arm(e) : foe(e)));
  return { ...manifest, entities };
}
