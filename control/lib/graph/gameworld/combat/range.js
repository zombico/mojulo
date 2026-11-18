/**
 * THE FIRING RANGE — a game being designed, its weapons tried before its levels exist. The weapons the game needs (each
 * by its fire type and its numbers), optionally what each looks like, carried by a person into the gym and measured on
 * the runtime the game will ship (measure.js): the rounds and the seconds each takes to drop a body at 5, 15 and 30 m,
 * its cone and climb, its marks on each matter, its switch and its reload, a melee weapon's cuts; the gym laid from those
 * numbers and played (gym.js, the combat book's page). A made game's own weapons go through the combat book; this is
 * the same range before there is a game.
 *
 *   rangeOf({ weapons, skins?, sounds?, foe?, name?, quiet? })   → { minted, m, reach, gym, gate } (book.js combatSample's shape)
 *   rangeHtml(spec)                              → the page
 *
 *   weapons  1 to 5 (a body's slots, in order), each one of:
 *              a kit word ('rifle', 'shotgun', 'handgun', ...: arms-kit.js): its numbers and its look the kit's
 *              { name, fire, ...numbers }: a FIRE TYPE and the numbers it asks (FIRE below; what is not given, its
 *                default): `hitscan` a round that lands where it is aimed the frame it is fired, `projectile` one that
 *                flies (its speed, its drop, its burst), `melee` a blade in the free hand (V from the eye)
 *              { name, weapon }: a runtime weapon row as it is (worlds/controllable/combat-ranged.js initWeapon)
 *            At most one melee weapon (the free hand holds one).
 *   skins    { [name]: a kit word or an arm's build words ({ item, model?, line?, parts? }) }: what a weapon looks like
 *            in the hands, its numbers untouched; absent, a graybox of its fire type (a rifle's shape for hitscan, a
 *            launcher's tube for a projectile, the combat knife for melee)
 *   sounds   { [name]: { shot?, reload?, hit?, draw? } } (a melee weapon's { swing?, hit? }), each a word of the SFX shelf:
 *            what a weapon sounds like, the game's own choice; absent, chosen by what it is (range-sound.js). `quiet`:
 *            no sound at all. `vary`: every shot, hit and swing a seeded variant (the game's sound sheet turns it on)
 *   foe      { hp? }: the body the rounds are timed against (100)
 * Pure but for the measures' time (a few seconds a weapon).
 */
import { measureCombat, combatLaws } from './measure.js';
import { gymOf, gymPageHtml } from './gym.js';
import { rangeBody } from './range-body.js';
import { armDetailed, withArmMeshes } from '../arms-kit.js';

// (the range's body: its fire types, its spec's reader and the person that carries it: range-body.js)
export { FIRE, FIRE_TYPES, validateRange, rangeBody, RANGE_MAX } from './range-body.js';

/** A range, measured and laid (book.js combatSample's shape). */
export function rangeOf(spec = {}) {
  const { pilot, foe, payload, name } = rangeBody(spec);
  const m = measureCombat(pilot, foe, { camera: 'first-person', name });
  m.laws = combatLaws(m);
  return { minted: { pilot, foe, payload }, m, ...gymOf(pilot, m) };
}

/** The range's page: its gym, played from the eye. */
export function rangeHtml(spec = {}) {
  const S = rangeOf(spec);
  // (each gun drawn in the hands as the arms library builds it, where it is an arm of the library: arms-kit.js)
  const P0 = S.minted.pilot, pilot = Array.isArray(P0.rule.loadout) ? withArmMeshes([{ ...P0, rule: { ...P0.rule, loadout: P0.rule.loadout.map(armDetailed) } }])[0] : P0;
  return gymPageHtml({ ...S.minted, pilot }, S.m, S.gym, S.gate, { kind: 'firing range', tag: `${spec.weapons.length} weapon${spec.weapons.length > 1 ? 's' : ''}`,
    // (the shooter's HUD, as every shooter's page wears it: the gun in hand, the health, the scope; no mission in it)
    mission: { title: spec.name ?? 'Firing range', theme: spec.theme ?? 'field-brief', tasks: [], plain: true } });
}

