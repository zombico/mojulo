/**
 * THE SIDE MAP'S BOSS (a side map's `boss`, a roster id: gameworld/bosses.js): the robot its last room holds, stood by
 * the foe shelf (foes.js standFoe) as its class at the boss's rank, on the lane's rail (the side strip's RAIL), facing the
 * way in, drawn as the hero door made it (its figure the runner's `foe-<id>` step, on the figure library's clips) at its
 * TIER (`tier`, a share of the hero's height: a brute stands taller), in the rail's cel light like every body on the map.
 * Its fall is the level's end: a defeat-all of the boss in place of the far side's reach. Its health is the HUD's bar
 * (the defeat-all's `bar`), never a bar over its head.
 *
 * A MACHINE (a roster boss with a `mecha` body: level 0's worker bot) is stood as its mecha shelf frame's rig, drawn at the
 * tier's height, with no figure of its own to mint.
 *
 *   sideMapBossCast(G, ends, { refs, stature? }) → { figures, entities, mechanics } | null   (`ends.boss` from
 *     cast.js sideMapEnds: { id, at, heading }; `refs` { <boss id>: <its figure's sketch> }; null when no boss or no figure)
 *
 * Pure.
 */
import { standFoe, RAIL } from '../foes.js';
import { libraryFigure } from '../stage-figures.js';
import { BOSSES } from '../bosses.js';
import { WRECK_LINGER } from '../vanish.js';
import { mechaFootprint } from '../../mecha-shelf/mecha-figure.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export function sideMapBossCast(G, ends, { refs = {}, stature = 1.67 } = {}) {
  const P = ends?.boss, B = P && BOSSES[P.id];
  if (!B || (!B.mecha && !refs[P.id])) return null;
  const part = { figures: {}, entities: [] }, id = `boss-${P.id}`;
  // (its figure: the hero door's, by its ref; a MACHINE's its mecha shelf frame, stood as its rig at its own size)
  const e = standFoe(G, part, { id, entry: { class: B.class, rank: 'boss' }, at: P.at, heading: P.heading }, { figure: B.mecha ? { mecha: { ...B.mecha } } : libraryFigure(refs[P.id]) });
  // (its size the tier's, not the class's stand-in beast's: a hero-door body drawn at its own height × the tier, its
  // collider and its hit egg with it)
  // (its health in the HUD, its bar the level's, never over its head: the defeat-all's `bar`, `hpBar: 'none'`)
  const H = r3(stature * B.tier), R = r3(0.3 * B.tier), { scale: _s, ...body } = e.body;
  // (a machine drawn at the tier's height: its frame's own height scaled to it)
  const scale = B.mecha ? r3(H / mechaFootprint(B.mecha).H) : B.tier;
  e.body = { ...body, hpBar: 'none', ...(scale !== 1 ? { scale } : {}), radius: R, egg: { a: r3(0.42 * B.tier), c: r3(H / 2), cz: r3(H / 2) }, ...(B.hp ? { hp: B.hp } : {}) };
  // (a robot: DESTROYED as it falls, apart at every joint, its pieces flung in the explosion, then gone in smoke;
  // gameworld/vanish.js, the page's wreck)
  e.body.vanish = { is: 'smoke', linger: WRECK_LINGER, die: 'dismantle', sever: 'all' };
  // (its gun where the roster says it: its height a share of its own, its rate; level.js fires it as a travelling round)
  if (e.weapon && B.shot) e.weapon = { ...e.weapon, ...(B.shot.eye ? { eye: r3(B.shot.eye * H) } : {}), ...(B.shot.cooldown ? { cooldown: B.shot.cooldown } : {}) };
  // (its TELL lights the room round its face as it winds up: worlds/controllable/shot-light.js `rule.tell`)
  e.rule = { ...e.rule, tell: { color: parseInt(B.signal.slice(1), 16), at: r3(H * 0.85) }, collideHeight: H, collideRadius: R, rail: { a: [0, -RAIL.wake], b: [0, r3((ends.rail?.length ?? P.at[1]) + RAIL.wake)], join: P.at, heading: P.heading } };
  return { figures: part.figures, entities: part.entities, mechanics: [{ kind: 'defeat-all', who: `${id}*`, count: 1, label: B.name, bar: { of: id, hp: e.body.hp, label: B.name } }] };
}
