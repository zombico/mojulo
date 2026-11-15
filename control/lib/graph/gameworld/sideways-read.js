/**
 * A LEVEL WALKED SIDEWAYS, READ — a composed world's `levels.<id>.sideways` (gameworld/sideways.js says what it is and
 * lays it): its words checked against the brawl's levels, its bestiary and its belt. Apart from the layer that lays it
 * so the world's reader takes no more than this.
 *   SIDEWAYS_KEYS · readSideways(v, { foes, where }) · sidewaysFoes(G)
 * Pure.
 */
import { brawlLevel, readBrawlLevel } from '../brawl/brawl-levels.js';
import { readStreet } from '../brawl/brawl-street.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';

export const SIDEWAYS_KEYS = Object.freeze(['ground', 'play', 'guns', 'grenades', 'cast', 'waves', 'things', 'scenes']);
const GROUND = Object.freeze({ kind: 'town' });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : [v]);

export function readSideways(v, { foes = null, where = 'sideways' } = {}) {
  const S = v === true ? {} : v;
  if (!isObj(S)) throw new Error(`${where} is true (the town's street, the starter's waves) or { ground?, play?, guns?, grenades?, cast?, waves?, things?, scenes? }: the level walked sideways`);
  for (const k of Object.keys(S)) if (!SIDEWAYS_KEYS.includes(k)) throw new Error(`${where}.${k} is not a sideways level's word (${SIDEWAYS_KEYS.join(', ')})`);
  const ground = S.ground ?? GROUND;
  try { readBrawlLevel(ground, `${where}.ground`); } catch (e) { throw new Error(e.message.replace(/^brawl: /, '')); }
  if (S.cast !== undefined) {
    if (!isObj(S.cast) || !Object.keys(S.cast).length) throw new Error(`${where}.cast is { '<crowd type>' | '*' | 'boss': '<foe>' | ['<foe>'…] }: who of the bestiary the crowd is drawn as`);
    for (const [as, who] of Object.entries(S.cast)) {
      if (as !== '*' && as !== 'boss' && !CROWD_TYPES[as]) throw new Error(`${where}.cast.${as}: a crowd type (${Object.keys(CROWD_TYPES).join(', ')}), '*' for the rest, or 'boss'`);
      for (const id of list(who)) if (typeof id !== 'string' || (foes && !foes[id])) throw new Error(`${where}.cast.${as}: '${id}' is not in the world's bestiary (${foes ? Object.keys(foes).join(', ') || 'none' : 'foes'})`);
    }
  }
  if (S.scenes !== undefined && S.scenes !== false && !isObj(S.scenes)) throw new Error(`${where}.scenes is the street's scenes { <id>: [beat…] }, or false for none`);
  // (its waves, things and scenes are read against its belt, as a street's: a fault is said here, before anything is made)
  // (a street needs a wave to be read: unsaid, the starter's are laid when the level is ordered; one stands in here)
  const belt = brawlLevel(ground).brawl.belt, held = belt.screens.findIndex((sc) => sc.gate);
  try { readStreet({ waves: S.waves ?? [{ screen: Math.max(0, held), crowd: [{ type: 'thug', n: 1 }] }], ...(S.things ? { things: S.things } : {}), ...(isObj(S.scenes) ? { scenes: S.scenes } : {}), ...(S.play !== undefined ? { play: S.play } : {}), ...(S.guns !== undefined ? { guns: S.guns } : {}), ...(S.grenades !== undefined ? { grenades: S.grenades } : {}) }, belt, where); } catch (e) { throw new Error(e.message.replace(/^brawl: /, '')); }
  return { ground, ...(S.play !== undefined && S.play !== 'brawl' ? { play: S.play } : {}), ...(S.guns ? { guns: S.guns } : {}), ...(S.grenades !== undefined ? { grenades: S.grenades } : {}), ...(S.cast ? { cast: Object.fromEntries(Object.entries(S.cast).map(([k, w]) => [k, list(w)])) } : {}), ...(S.waves ? { waves: S.waves } : {}), ...(S.things ? { things: S.things } : {}), ...(S.scenes !== undefined ? { scenes: S.scenes } : {}) };
}

/** The bestiary ids a world's sideways levels cast, in the bestiary's order. */
export function sidewaysFoes(G) {
  const used = new Set();
  for (const id of G.ids ?? Object.keys(G.levels ?? {})) { const S = G.levels[id]?.sideways; if (isObj(S) && isObj(S.cast)) for (const who of Object.values(S.cast)) for (const f of list(who)) used.add(f); }
  return Object.keys(G.foes ?? {}).filter((id) => used.has(id));
}
