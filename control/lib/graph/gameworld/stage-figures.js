/**
 * STAGE FIGURES — the one way a gameworld stands people on a stage: a battle's foes, a minigame's keeper, a quick
 * game's guards, rivals, farmhands and bots, the story's cast. Each is a figure (what the page rigs: a made character,
 * on the shared library's walk and idle, or on its own clips) and an entity (where it stands, how it moves, its body's
 * numbers), named alike. And a stage's extras (levels.js stageLevelOrder's `extra`: what a concern stands and plays)
 * composed, so several concerns share a stage.
 *
 *   libraryFigure(ref, { moves? })   a person on the shared library (quaternius-ual): its walk, idle and states, and its
 *                                    own moves over them where it has them
 *   fieldFigure(ref, field)          a cast member's (casting.js `field`): on the library, or a body the library does not
 *                                    fit (a beast, a mascot, a beast-kin) on its OWN clips, a `walker` (it never pilots)
 *   foeFigure(ref, look)             a foe's: a beast on its own gaits and reactions when its look names a `species`
 *                                    (a wolf pack, a giant spider), its swing on its strike clip when the look carries
 *                                    one (`strike`, a fielded foe's blow), else a person on the library
 *   beastLook(look)                  the species a foe's look names, or null (a person)
 *   readBeastFoe(look, why, where, fail)   a beast foe's look read: a species the fauna knows, and the oozes and stylism
 *                                    that grow it (the animal door's); `why` refuses it where a person's hands are needed
 *   PERSON_BODY                      a person's body numbers, spread after a rule's own (eye, stride, collision, step)
 *   standRule(more?)                 the rule of one who stands where it is put (static), `more` before the body
 *   standing(id, at, heading)        the entity of one who stands, its figure its own id
 *   stand(part, id, figure, at, heading)   both into a part's { figures, entities }
 *   facing(at, toward)               the heading from `at` toward a point
 *   mergeExtras(a, b)                two extras as one; composeExtras(...fns) the extra functions as one (or null)
 *
 * Pure. Every caller's output is what it wrote by hand before (the run's prints pin it).
 */
import { playerStates } from '../playscape/player.js';
import { beastFieldOf } from '../egocube/moves.js';
import { mutagenErrors } from '../mutagen/index.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export const FIGURE_LIBRARY = 'quaternius-ual';
export const PERSON_BODY = Object.freeze({ eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 });

export const libraryFigure = (ref, { moves = null } = {}) => ({ heroRef: ref, library: FIGURE_LIBRARY, clips: { ...playerStates([], FIGURE_LIBRARY), forward: 'Walk_Loop' }, ...(moves ? { moves } : {}) });

export const fieldFigure = (ref, field) => (field?.own
  ? { heroRef: ref, walker: true, clips: field.own, ...(field.moves ? { moves: field.moves } : {}) }
  : libraryFigure(ref, { moves: field?.moves }));

export const beastLook = (look) => (look && typeof look === 'object' && typeof look.species === 'string' ? look.species : null);
export const foeFigure = (ref, look) => (beastLook(look) ? fieldFigure(ref, beastFieldOf(beastLook(look), { strike: look.strike })) : libraryFigure(ref));

// a beast foe's look: its species, and what grows it (mutagen: the animal door's `ooze` and `stylism`)
const BEAST_LOOK_KEYS = ['species', 'ooze', 'stylism'];
export function readBeastFoe(F, why, where, fail) {
  if (why) throw fail(`${where} { species } is a beast foe: ${why}`);
  const stray = Object.keys(F).filter((k) => !BEAST_LOOK_KEYS.includes(k));
  if (stray.length) throw fail(`${where} { species, ooze?, stylism? } is a beast and what grows it (not ${stray.join(', ')})`);
  try { beastFieldOf(F.species); } catch (e) { throw fail(`${where}.species: ${e.message.replace(/^[^:]*: /, '')}`); }
  const errs = mutagenErrors(F.ooze, undefined, F.stylism);
  if (errs.length) throw fail(`${where}: ${errs.join('; ')}`);
}

export const standRule = (more = {}) => ({ type: 'static', ...more, ...PERSON_BODY });
export const standing = (id, at, heading) => ({ id, rule: standRule(), body: { type: 'figure-rig', figure: id }, transform: { pos: at, heading } });
export const facing = (at, toward) => r3(Math.atan2(toward[1] - at[1], toward[0] - at[0]));

export function stand(part, id, figure, at, heading) {
  part.figures[id] = figure;
  part.entities.push(standing(id, at, heading));
  return part;
}

/** Two stage extras as one: their figures, entities, plays (lists joined) and mechanics (each kind and slice once). */
export function mergeExtras(a, b) {
  if (!a) return b;
  if (!b) return a;
  const play = { ...(a.play ?? {}), ...(b.play ?? {}) };
  for (const k of ['cues', 'minigames', 'spots', 'menus']) if (a.play?.[k] && b.play?.[k]) play[k] = [...a.play[k], ...b.play[k]];
  const mechanics = [...(a.mechanics ?? [])];
  for (const m of b.mechanics ?? []) if (!mechanics.some((x) => x.kind === m.kind && x.slice === m.slice)) mechanics.push(m);
  return { ...a, ...b, figures: { ...(a.figures ?? {}), ...(b.figures ?? {}) }, entities: [...(a.entities ?? []), ...(b.entities ?? [])], play, mechanics };
}

/** Extra functions (ends → extra; nulls skipped) as one, or null when there are none; one alone is itself. */
export function composeExtras(...fns) {
  const own = fns.filter(Boolean);
  if (!own.length) return null;
  if (own.length === 1) return own[0];
  return (ends) => own.reduce((acc, f) => mergeExtras(acc, f(ends)), null);
}
