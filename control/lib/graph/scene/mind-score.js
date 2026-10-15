/**
 * THE MINDS AS DATA: what an engine kernel needs to run the web's minds (worlds/controllable/mind.js, the `ai` rule) in
 * the bus's frame (z-up, recipe units, radians), beside the cast and the fight. It rides bus.json as `minds`; Godot's
 * kernel/mind.gd reads it (with kernel/nav.gd for pathing).
 *
 *   extractMinds(payload, player) → { version, tier?, off?, rules, minds, food? } | null
 *     tier    the world's class tuning (aiDifficulty → the matrix's skill × aggressiveness), as the web seeds it
 *     off     the world starts with its minds stood down (`ai: 'off'`; G wakes them)
 *     rules   every body's rule, as the web normalizes it (a mind reads its target's eye height off its rule)
 *     minds   each body that runs the `ai` rule: its weapon and loadout weapons (initWeapon's state at rest), the
 *             loadout slot in hand, where it was placed (its post and home by default)
 *     food    the bodies a forager grazes
 *     colliders  the world's boxes ({ min, max }): what a mind sees past, slides along and paths round
 * No body on the `ai` rule ⇒ null (no key).
 */
import { composeLive } from '../worlds/controllable/compose.js';

export const MINDS_VERSION = 'minds/1';
let CW = null;
const clone = (x) => JSON.parse(JSON.stringify(x));

export function extractMinds(payload, player = null) {
  const ents = Array.isArray(payload?.entities) ? payload.entities : [];
  if (!ents.some((e) => e && e.rule && e.rule.type === 'ai')) return null;
  CW ||= composeLive();
  const world = CW.createWorld({
    entities: clone(ents), ...(player ? { pilot: player } : {}),
    ...(Array.isArray(payload.colliders) ? { colliders: payload.colliders } : {}),
    ...(typeof payload.aiDifficulty === 'string' ? { aiDifficulty: payload.aiDifficulty } : {}),
    ...(payload.ai === 'off' ? { ai: 'off' } : {}),
  });
  const rules = {}, minds = {}, food = [];
  for (const e of world.entities) {
    if (e.isCamera) continue;
    rules[e.id] = clone(e.rule);
    if (e.food) food.push(e.id);
    if (e.rule.type !== 'ai') continue;
    minds[e.id] = {
      spawn: clone(e.spawn),
      ...(e.weapon ? { weapon: clone(e.weapon) } : {}),
      ...(e.loadoutWeapons ? { loadoutWeapons: clone(e.loadoutWeapons), loadoutIdx: e.loadoutIdx || 0 } : {}),
      ...(e.pilotRule ? { pilotRule: clone(e.pilotRule) } : {}),
      ...(e.team ? { team: e.team } : {}),
    };
  }
  return {
    version: MINDS_VERSION,
    ...(world.aiTuning ? { tier: clone(world.aiTuning) } : {}),
    ...(world.aiEnabled === false ? { off: true } : {}),
    rules, minds, ...(food.length ? { food } : {}), ...(world.colliders ? { colliders: clone(world.colliders) } : {}),
  };
}
