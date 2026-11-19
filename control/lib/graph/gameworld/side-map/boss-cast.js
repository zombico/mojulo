/**
 * THE SIDE MAP'S BOSS (a side map's `boss`, a roster id: gameworld/bosses.js): the robot its last room holds, stood by
 * the foe shelf (foes.js standFoe) as its class at the boss's rank, on the lane's rail (the side strip's RAIL), facing the
 * way in, drawn as the hero door made it (its figure the runner's `foe-<id>` step, on the figure library's clips) at its
 * TIER (`tier`, a share of the hero's height: a brute stands taller), in the rail's cel light like every body on the map.
 * Its fall is the level's end: a defeat-all of the boss in place of the far side's reach.
 *
 *   sideMapBossCast(G, ends, { refs, stature? }) → { figures, entities, mechanics } | null   (`ends.boss` from
 *     cast.js sideMapEnds: { id, at, heading }; `refs` { <boss id>: <its figure's sketch> }; null when no boss or no figure)
 *
 * Pure.
 */
import { standFoe, RAIL } from '../foes.js';
import { libraryFigure } from '../stage-figures.js';
import { BOSSES } from '../bosses.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export function sideMapBossCast(G, ends, { refs = {}, stature = 1.67 } = {}) {
  const P = ends?.boss, B = P && BOSSES[P.id];
  if (!B || !refs[P.id]) return null;
  const part = { figures: {}, entities: [] }, id = `boss-${P.id}`;
  const e = standFoe(G, part, { id, entry: { class: B.class, rank: 'boss' }, at: P.at, heading: P.heading }, { figure: libraryFigure(refs[P.id]) });
  // (its size the tier's, not the class's stand-in beast's: a hero-door body drawn at its own height × the tier, its
  // collider and its hit egg with it)
  const H = r3(stature * B.tier), R = r3(0.3 * B.tier), { scale: _s, ...body } = e.body;
  e.body = { ...body, ...(B.tier !== 1 ? { scale: B.tier } : {}), radius: R, egg: { a: r3(0.42 * B.tier), c: r3(H / 2), cz: r3(H / 2) } };
  e.rule = { ...e.rule, collideHeight: H, collideRadius: R, rail: { a: [0, -RAIL.wake], b: [0, r3((ends.rail?.length ?? P.at[1]) + RAIL.wake)], join: P.at, heading: P.heading } };
  return { figures: part.figures, entities: part.entities, mechanics: [{ kind: 'defeat-all', who: `${id}*`, count: 1, label: B.name }] };
}
