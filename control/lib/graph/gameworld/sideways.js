/**
 * A LEVEL WALKED SIDEWAYS — a composed world's level that is a side-scrolling map (docs/side-scroll-map-principles.md):
 * a belt down a place, fought along and across. The level says its map; the world says who is on it. Nothing here is
 * a game of its own: it is how a world's hero, its party and its foes are laid on the sideways map, and made a level
 * the game's turn runs like any other.
 *
 *   levels.<id>.sideways: true | {
 *     ground?: { kind: 'town' | 'stage' | 'greybox', … }   the place and its belt (brawl/brawl-levels.js BRAWL_LEVELS):
 *                                                          its screens, its dress, its rise, turn and drift. Unsaid,
 *                                                          the town's street
 *     cast?:   { '<crowd type>' | '*' | 'boss': '<foe>' | ['<foe>'…] }
 *                                                          who of the world's bestiary the crowd is DRAWN as: a foe
 *                                                          under how it fights (brawl-crowd.js CROWD_TYPES), under `*`
 *                                                          for the rest, under `boss` for the boss. Each is a person
 *                                                          the run makes (a foe's sheet, or a crew's grunt by its
 *                                                          skin's `dress`). Unsaid, the crowd is the street's own
 *     waves?, things?, scenes?                             as a street's (brawl-street.js); unsaid, the starter's
 *   }
 *   Who plays: the world's hero, and each of its cast who joins (the party), a seat each to choose from.
 *
 *   SIDEWAYS_KEYS
 *   readSideways(v, { foes, where })        → the settled level words (throws naming the fault)
 *   sidewaysFoes(G)                         → the bestiary ids its sideways levels cast (the run makes each a figure)
 *   sidewaysStage(R, { title })             → the stage's manifest: the place and its belt, no street yet
 *   sidewaysLevelOrder(G, stage, { ref, hero, party, foeRefs, register? }) → { tool: 'create_sketch', args: { title,
 *                                             manifest }, playable: [{ id, name }] } the level, its street laid
 *   sidewaysTurn(flow, { setup, playable, staged })   → the flow, each level step asking the set-up (who plays, when
 *                                             there is more than one) and calling the street's scenes
 * Pure.
 */
import { brawlLevel } from '../brawl/brawl-levels.js';
import { readSideways } from './sideways-read.js';
import { readStreet } from '../brawl/brawl-street.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';
import { streetPlay, defaultScenes, brawlSetup, BRAWL_SCENES } from './quick.js';
import { withSetup } from './setup.js';

export { SIDEWAYS_KEYS, readSideways, sidewaysFoes } from './sideways-read.js';
const GROUND = Object.freeze({ kind: 'town' });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The stage a sideways level is: the place its ground names, with its belt (the street is laid when the level is
 * ordered: who is on it is the run's to say). */
export function sidewaysStage(S, { title } = {}) {
  return brawlLevel(S.ground ?? GROUND, title ? { title } : {});
}

/** The level, its street laid: the world's hero and party its players, its cast's foes the crowd's faces. */
export function sidewaysLevelOrder(G, stage, { ref, hero, heroName = null, party = [], foeRefs = {}, register = null, title = null } = {}) {
  const S = readSideways(G.levels[stage.level].sideways, { foes: G.foes ?? null, where: `levels.${stage.level}.sideways` });
  const name = title ?? `${G.name ?? G.id} · ${G.levels[stage.level].name ?? stage.level}`, place = G.levels[stage.level].name ?? stage.level;
  const belt = stage.manifest.brawl.belt, dress = stage.manifest.brawl.dress;
  // WHO PLAYS: the hero, then each who joins it; WHO IS FOUGHT: the cast's foes, each a character the run made
  const roster = [{ id: 'hero', name: heroName ?? 'Hero', hero: { ref: hero } }, ...party.filter((m) => m.ref).map((m) => ({ id: m.id, name: m.name ?? m.id, hero: { ref: m.ref } }))];
  const playable = roster.map((r) => ({ id: r.id, name: r.name }));
  const cast = {};
  for (const [as, ids] of Object.entries(S.cast ?? {})) for (const id of ids) {
    if (!foeRefs[id]) continue;
    let k = roster.findIndex((r) => r.id === `foe-${id}`);
    if (k < 0) { k = roster.length; roster.push({ id: `foe-${id}`, name: G.foes?.[id]?.name ?? id, hero: { ref: foeRefs[id] } }); }
    (cast[as] ??= []).push(k);
  }
  // (its waves drawn from how its cast fights, where the cast says; its boxes its setting's)
  const types = Object.keys(cast).filter((t) => CROWD_TYPES[t]);
  const street = {
    players: [0], roster,
    // (how it is played: a brawl, or a run & gun; what holds it and stands on it its play's, where it names neither)
    ...streetPlay(S.play, belt, { waves: S.waves, things: S.things, types: types.length ? types : null, setting: dress?.setting ?? null, guns: S.guns, grenades: S.grenades }),
    ...(Object.keys(cast).length ? { cast } : {}),
    ...(S.scenes === false ? {} : { scenes: S.scenes ?? defaultScenes(belt, { name: place }) }),
  };
  readStreet(street, belt, `levels.${stage.level}.sideways`);
  // (the hosted level's contract: it asks nothing of the store, and says how it ended)
  const game = { levelRef: 'street', consumes: [], produces: { results: ['success', 'fail'], events: [] }, presets: { default: {} }, complete: false };
  const { brawl, ...world } = stage.manifest;
  return { tool: 'create_sketch', args: { title: name, manifest: { ...world, title: name, brawl: { ...brawl, ...(register ? { register } : {}), street }, game } }, playable, staged: !!street.scenes, ...(street.play === 'gun' ? { guns: street.guns } : {}) };
}

/** A sideways world's turn: every level step asks the set-up (the world's own kept; who plays added when more than one
 * can) and, where every level is walked sideways and has scenes, calls them (arrive as play starts, leave once won). */
export function sidewaysTurn(flow, { setup = null, playable = [], staged = false, guns = [] } = {}) {
  const asked = withSetup(flow, brawlSetup(setup, playable, guns));
  if (!staged) return asked;
  return { ...asked, steps: Object.fromEntries(Object.entries(asked.steps).map(([k, st]) => [k, st.kind === 'level' ? { ...st, ...(st.start ? {} : { start: { scene: BRAWL_SCENES.start, once: false } }), ...(st.end ? {} : { end: { scene: BRAWL_SCENES.end, when: 'won' } }) } : st])) };
}
