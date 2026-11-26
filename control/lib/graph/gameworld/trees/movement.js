/**
 * THE SKILL TREE ON MOVEMENT's rows (tree.js): each a way the hero moves, written as a PATCH to the platform rule
 * (worlds/controllable/rules-platform.js), made from the hero's own rule, so a skill is the hero's numbers turned, never a
 * number of its own. A patch's keys are paths in the rule (`dash.air.count`), so two skills that turn the same part of
 * the rule (a dash carried further, a second air dash) both hold.
 *
 *   MOVE_SKILLS   { <id>: { read, needs?, patch(base) → { <path>: value } } }   `needs` the part of the rule the hero must
 *                 already have for the skill to turn it (an air dash is a dash's: a hero with none has nothing to turn)
 *   moveSkillPatch(id, base) → the patch, or throws, teaching (a skill whose `needs` the hero lacks)
 *
 * A new way to move is a row. Pure.
 */
import { TRAVERSAL_MOVES } from '../actions.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

export const MOVE_SKILLS = Object.freeze({
  'double-jump': Object.freeze({ read: 'a second jump in the air', patch: (b) => TRAVERSAL_MOVES['double-jump'].rule(b) }),
  'triple-jump': Object.freeze({ read: 'a third jump in the air, after the second', patch: () => ({ airJumps: 2 }) }),
  'high-jump': Object.freeze({ read: 'jumps half as high again', patch: (b) => TRAVERSAL_MOVES['high-jump'].rule(b) }),
  glide: Object.freeze({ read: 'a held jump slows the fall', patch: (b) => TRAVERSAL_MOVES.glide.rule(b) }),
  swift: Object.freeze({ read: 'runs a sixth faster', needs: 'speed', patch: (b) => ({ speed: r4(b.speed * 7 / 6) }) }),
  'long-dash': Object.freeze({ read: 'the dash carries a third further', needs: 'dash.time', patch: (b) => ({ 'dash.time': r4(b.dash.time * 4 / 3) }) }),
  'air-dash': Object.freeze({ read: 'a dash more in the air before the ground', needs: 'dash.air.count', patch: (b) => ({ 'dash.air.count': b.dash.air.count + 1 }) }),
});
export const MOVE_SKILL_IDS = Object.freeze(Object.keys(MOVE_SKILLS));

/** A skill's patch on the hero's rule. */
export function moveSkillPatch(id, base) {
  const S = MOVE_SKILLS[id];
  if (!S) throw new Error(`trees: '${id}' is no way to move (${MOVE_SKILL_IDS.join(', ')})`);
  if (S.needs && get(base, S.needs) == null) throw new Error(`trees: ${id} (${S.read}) turns the hero's ${S.needs}, and this hero has none`);
  return { ...S.patch(base) };
}
