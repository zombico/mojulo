/**
 * A SIDE MAP LEVEL (a world's `levels.<id>.sidemap`, laid by levels.js `gameStages` as one stage, section `sidemap`):
 * the map built on the level's geocube (scene.js, the geocube's `show: 'sidemap'`) and played by the world's hero,
 * laid for the hero's own height and reach, so the map, its laws and its play agree.
 *
 *   the HERO     the world's hero on the platform rule its feel lowers (feel/lower.js), running the lane the map is laid
 *                along (+y at x 0), standing at the first zone's checkpoint
 *   the CAMERA   the side map's (worlds/controllable/sidemap.js): its zones, their checkpoints, their rising frames
 *   the LEVEL    the layout's blocks its colliders, its ladders climbables (play.js)
 *   a FALL       out of the frame's bottom: counted in the catch zone in limbo (`side-fall`), a life where the world's
 *                mechanics keep lives (`mechanics.lives`: their `falls`), and back at the zone's checkpoint. The game's
 *                own fall policy is off: a chute goes far below where its catch box stands
 *   the GOAL     the last zone's far side reached (a boss's room: its fight comes with the world's foes)
 *
 *   sideMapLevelOrder(G, stage, { ref, heroRef, heroGaits?, heroStature?, pilot?, title?, mechanics? })
 *     → { tool: 'create_sketch', args: { title, manifest }, laws }   laws: the map's own (laws.js), each `sidemap:<id>`
 *
 * Pure.
 */
import { playerWorld } from '../../playscape/player.js';
import { feelRule } from '../feel/lower.js';
import { sideMapOf, SIDE_MAP_STATURE } from './scene.js';
import { sideMapPlay, SIDE_FALL } from './play.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

/** A side map level's order: the stage's map laid for the world's hero and played by it. */
export function sideMapLevelOrder(G, stage, { ref, heroRef, heroGaits = null, heroStature = null, pilot = null, title, mechanics = null } = {}) {
  if (!heroRef) throw new Error('levels: a side map is played by a hero seen from the side; give the world a hero (its characters)');
  const name = title ?? `${G.name ?? G.id} · ${stage.label ?? stage.level}`, stature = heroStature ?? SIDE_MAP_STATURE;
  const manifest0 = { ...stage.manifest, ...(G.feel ? { feel: G.feel } : {}), stature };
  const M = sideMapOf(manifest0), L = M.layout, P = sideMapPlay(L, { stature, target: 'hero' });
  const s0 = Math.min(...L.swept.map((r) => r.s0)), s1 = Math.max(...L.swept.map((r) => r.s1));
  // the hero: the feel's rule on the lane, as tall as it stands
  const written = G.feel ? feelRule(G.feel) : null;
  const rule = { ...(written ?? {}), move: 'lane', lane: [[0, r3(s0 - 20)], [0, r3(s1 + 20)]], collideHeight: stature };
  const controls = `A / D  run · Space  jump${written?.dash ? ' · F  dash' : ''}${written?.buster ? ' · J  fire (hold: charge)' : ''}${L.ladders.length ? ' · W / S  climb' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const W0 = playerWorld({ heroRef, ...(heroGaits ? { gaits: heroGaits } : {}), ...(pilot ? { pilot } : {}), walk: false, id: 'hero', title: name, controls, rule });
  const hero = { ...W0.entities[0], transform: { pos: P.spawn, heading: Math.PI / 2 } };
  // the goal: the last zone's far side; the falls: the catch zone in limbo, a life each where the world keeps lives
  const last = L.zones.at(-1), goal = { kind: 'reach-exit', at: [0, r3(last.rect[1] - 2.5), r3(last.exit[1] + 1)], radius: 2.5, planar: false };
  const lives = G.mechanics?.lives ? [{ kind: 'lives', start: G.mechanics.lives, falls: [SIDE_FALL] }] : [];
  const ev = W0.events ?? {};
  const events = { ...ev, sources: [...(ev.sources ?? []), P.catch] };
  const manifest = {
    ...manifest0, title: name,
    figures: W0.figures, entities: [hero, ...P.ladders], camera: P.camera, events, colliders: P.colliders,
    ...(mechanics?.play ? { play: mechanics.play } : {}),
    // (its crates break: the game's own degree where it says one, else `objects`, the action game's, crates.js)
    ...(L.crates?.length && !manifest0.destruction ? { destruction: mechanics?.destruction ?? 'objects' } : {}),
    game: { levelRef: ref, mechanics: [goal, ...lives], fall: 'none' },
  };
  return { tool: 'create_sketch', args: { title: name, manifest }, laws: M.laws.map((l) => ({ ...l, id: `sidemap:${l.id}` })) };
}
