/**
 * act — a persona's ACT on the hero it plays: a read played in a style (interpret.js) as the hero's body take (body.js),
 * from the actor's stand on that hero's rig (gestures.js standOf over its cast's relaxed preset), a one-shot clip at 30
 * keys a second the packer samples as it samples a gait (station-loft-rig.js packLayeredRig `acts`), and the GLB writes
 * as `act:<take>` beside the face's `face:<take>`, on the same clock (scene-gltf.js).
 *
 *   actsOf(persona, reads) → { <take>: { seconds, body, style, seed } }: the reads played in a style (a read with no
 *     style has no act: the persona's path, byte for byte); what persona/bundle.js personaHero carries on the hero
 *   actClipOn(act, R, hero) → the clip: fn(u) → pose, `keys`, `once`, and `act` (what the GLB's `moj:act` says of it)
 *
 * Pure and deterministic.
 */
import { GESTURE_PRESETS } from '../polygonizer/hero-gesture.js';
import { standOf } from './gestures.js';
import { actBody, actClip } from './body.js';

/** each read played in a style, as the hero carries it */
export function actsOf(persona, reads) {
  return Object.fromEntries(Object.entries(reads).filter(([, R]) => R.style).map(([id, R]) => [id, { seconds: R.seconds, body: R.body, style: R.style, seed: persona.reads?.[id]?.seed ?? 1 }]));
}

/** the actor's stand on a hero: its cast's relaxed preset's trunk and legs, the arms found on the rig */
export const actStand = (R, hero) => standOf(R, GESTURE_PRESETS.relaxed[hero?.cast] ?? GESTURE_PRESETS.relaxed.male);

/** an act as the hero's clip on its rig */
export function actClipOn(act, R, hero) {
  const take = actBody({ seconds: act.seconds, body: act.body }, { R, base: actStand(R, hero), style: act.style, seed: act.seed });
  const fn = actClip(take);
  fn.act = { style: act.style, seconds: act.seconds, gestures: take.gestures.map((g) => ({ word: g.word, cause: g.cause, side: g.side, start: g.start, apex: g.apex, end: g.end })) };
  return fn;
}
