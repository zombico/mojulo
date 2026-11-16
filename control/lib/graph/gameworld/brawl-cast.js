/**
 * A BRAWL'S CAST — the FOES department's page of a beat-em-up or a run & gun: who the street's crowd is. The crowd is
 * the game's own bestiary (foes.js), never a list of the brawl's stock bodies: a wave is written by ROLE or by a foe's
 * id, as a fight's is (fights.js FIGHT_ROLES, castRoles), and each foe fights on the street as what it IS.
 *
 *   BRAWL_PLAYS            { <foe class>: <crowd type> } how a class fights on the street (brawl/brawl-crowd.js
 *                          CROWD_TYPES: the body's moves, health and timing). A new foe class is a row
 *   brawlPlay(entry, { gun? }) → the crowd type a bestiary entry plays: its class's, its rank over it (a boss or a
 *                          miniboss a big body; an elite never the street's weakest); on a run & gun (`gun`) a foe that
 *                          does not shoot still carries a gun, since everyone on that street does
 *   readBrawlWaves(waves)  → the waves as written, checked: [{ foes: { <role or foe id>: n }, name?, formation?,
 *                          pattern?, entrance?, cover?, ambush?, after? }] (a bare { <role or id>: n } is its `foes`)
 *   brawlCast(G, waves, { gun?, plays? }) → { waves, foes, says }
 *       waves   the street's (brawl-waves.js readRangeWaves): each crowd entry { type, n, foe: '<id>' }
 *       foes    the bestiary ids that come, in the order they first do (each one body to make)
 *       says    advice: a foe drawn as a jointed figure (a beast: only a person's body stands on the street yet)
 *       plays   the creator's own { <foe id>: <crowd type> } over the read
 *   brawlBodies(G, cast)   → { <foe id>: true | false }: does it have a body the street can draw (a person or a people,
 *                          made through the hero door; a beast and a model made elsewhere have none yet)
 *   withBodies(waves, rosterAt) → the waves with each crowd entry's `roster` (the page's roster index its body is drawn
 *                          from) where its foe has one, and no `foe` (the page's word is the index)
 *
 * Pure.
 */
import { bestiaryOf, isPeople, isModel } from './foes.js';
import { castRoles, FIGHT_ROLES } from './fights.js';
import { FOE_CLASSES } from '../foes/index.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';
import { readRangeWaves } from '../brawl/brawl-waves.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`gameworld: brawl${m}`);

export const BRAWL_PLAYS = Object.freeze({
  walker: 'thug', swarm: 'thug', patrol: 'thug', guard: 'sword', summoner: 'thug',
  hopper: 'jumper', swooper: 'jumper', charger: 'charger', pursuer: 'charger',
  lurker: 'knife', stalker: 'knife', brute: 'heavy',
  turret: 'rifleman', hunter: 'gunner', lobber: 'grenadier',
});
// (what a foe that does not shoot carries where everyone shoots, by how big it stands)
const GUN_PLAY = Object.freeze({ minion: 'rifleman', elite: 'gunner', miniboss: 'bazooka', boss: 'bazooka' });
const WAVE_WORDS = ['foes', 'name', 'formation', 'pattern', 'entrance', 'cover', 'ambush', 'after', 'beat'];

/** The crowd type a bestiary entry plays on the street. */
export function brawlPlay(entry, { gun = false } = {}) {
  const c = FOE_CLASSES[entry?.class], rank = entry?.rank ?? 'minion', base = BRAWL_PLAYS[entry?.class] ?? 'thug';
  const shoots = ['shot', 'lob'].includes(c?.attack?.kind);
  if (gun) return shoots ? (rank === 'boss' || rank === 'miniboss' ? 'bazooka' : base) : GUN_PLAY[rank] ?? 'rifleman';
  if (shoots) return base;
  if (rank === 'boss' || rank === 'miniboss') return 'heavy';
  return rank === 'elite' && base === 'thug' ? 'charger' : base;
}

/** The waves as written, checked. */
export function readBrawlWaves(waves) {
  if (!Array.isArray(waves) || !waves.length || waves.length > 20) throw fail('.waves is a list of 1 to 20 waves, each { foes: { <role or foe id>: n }, name?, formation?, pattern? } (or the foes alone)');
  return waves.map((w0, i) => {
    if (!isObj(w0)) throw fail(`.waves[${i}] is { foes: { <role or foe id>: n }, … }`);
    const w = isObj(w0.foes) ? w0 : { foes: w0 };
    for (const k of Object.keys(w)) if (!WAVE_WORDS.includes(k)) throw fail(`.waves[${i}].${k} is not a wave's word (${WAVE_WORDS.join(', ')})`);
    const ids = Object.keys(w.foes);
    if (!ids.length) throw fail(`.waves[${i}].foes names who comes: { <role or foe id>: n }`);
    for (const id of ids) if (!(Number.isInteger(w.foes[id]) && w.foes[id] >= 1 && w.foes[id] <= 8)) throw fail(`.waves[${i}].foes.${id} is how many come, 1 to 8`);
    return w;
  });
}

/** A brawl's waves cast from the world's bestiary. */
export function brawlCast(G, waves, { gun = false, plays = null } = {}) {
  const B = bestiaryOf(G ?? {}), R = castRoles(G), W = readBrawlWaves(waves), foes = [], says = [];
  if (plays !== null) {
    if (!isObj(plays)) throw fail('.plays is { <foe id>: <crowd type> }');
    for (const [id, t] of Object.entries(plays)) {
      if (!B[id]) throw fail(`.plays.${id}: the bestiary holds ${Object.keys(B).join(', ')}`);
      if (!CROWD_TYPES[t]) throw fail(`.plays.${id} is one of ${Object.keys(CROWD_TYPES).join(', ')}`);
    }
  }
  const out = W.map((w, i) => {
    const crowd = Object.entries(w.foes).map(([word, n]) => {
      const id = FIGHT_ROLES[word] ? R[word] : word;
      if (!B[id]) throw fail(`.waves[${i}].foes.${word}: a role (${Object.keys(FIGHT_ROLES).join(', ')}) or one of the bestiary's (${Object.keys(B).join(', ')})`);
      if (!foes.includes(id)) foes.push(id);
      return { type: plays?.[id] ?? brawlPlay(B[id], { gun }), n, foe: id };
    });
    const { foes: _f, ...rest } = w;
    return { ...rest, crowd };
  });
  // (read as the street reads them, so a fault is said here: its formations, its counts)
  try { readRangeWaves(out.map(({ crowd, ...w }) => ({ ...w, crowd: crowd.map(({ type, n }) => ({ type, n })) }))); } catch (e) { throw fail(`.waves: ${e.message.replace(/^brawl: /, '')}`); }
  const bodies = brawlBodies(G, { foes });
  for (const id of foes) if (!bodies[id]) says.push(`${id} is drawn as a jointed figure: only a person's body stands on the street yet (skin it as a person or a people to give it one)`);
  return { waves: out, foes, says };
}

/** Which of the cast have a body the street can draw. */
export function brawlBodies(G, cast) {
  const B = bestiaryOf(G ?? {});
  return Object.fromEntries(cast.foes.map((id) => [id, !!B[id] && isPeople(B[id]) && !isModel(B[id])]));
}

/** The waves as the page takes them: each crowd entry's body by its roster index, where its foe has one. */
export function withBodies(waves, rosterAt) {
  return waves.map((w) => ({ ...w, crowd: w.crowd.map(({ foe, ...c }) => (Number.isInteger(rosterAt?.[foe]) ? { ...c, roster: rosterAt[foe] } : c)) }));
}
