/**
 * WHAT A RUN MADE — the gameworld's record of the sketches its runner made (design_game's `run`), kept in the recipe so
 * a later run knows what is there and whether the creator changed it since:
 *
 *   made?: { <key>: { ref, order, stored } }
 *     key     'hero', 'hero-equipped', 'guard' (a quick sneak's), 'ride' (a quick game's vehicle), 'foe' and 'tower' (a quick defence's figures), 'farmhand' (a quick farm's), 'keeper' (the minigames' stall keeper), 'athlete' (a quick sport's), each of those a pool ('guard-2' …), 'systems', 'gear-<class>', 'stock-<id>' (a starter item the world's gear populates), 'folk-<town>-<who>' (a town's person, folk-cast.js), 'level-<level>-<n>' (a stage), 'map-<n>' (a tactics book's epoch maps), 'foes-<id>' (a bestiary entry's beast: foes.js), or 'game'
 *     ref     the sketch it made
 *     order   the print of the order it made it from (a later run remakes it when the book's order moves)
 *     stored  the print of the manifest it left there (a manifest that no longer prints so was edited by hand, and a
 *             run leaves it as it is unless forced)
 *   an audit's record ('audit-level-<level>-<n>', runner.js auditSteps) is { ref, order, stored, verdict }: ref the level
 *   it walked, stored the print of what it walked (the level's row and the game's), verdict { completable, note } what
 *   the walk proved (completable true, false, or null when no browser could walk it: walked again once one can)
 *
 * Pure: the shape only. The runner (runner.js) writes it; nothing here reads the database.
 */
export const MADE_KEY = /^(hero|hero-equipped|(guard|foe|tower|farmhand|keeper|athlete)(-\d+)?|ride|cast-[a-z][a-z0-9-]*|casting|folk-[a-z0-9][a-z0-9-]*|systems|gear-[a-z]+|stock-[a-z0-9-]+|level-[a-z0-9-]+|audit-level-[a-z0-9-]+|map-\d+|game|fighter-[a-z0-9-]+|foes-[a-z][a-z0-9-]*)$/;
const PRINT = /^[0-9a-f]{8}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Read the record and say what is wrong. → the record */
export function readMade(made) {
  const fail = (m) => new Error(`gameworld: made${m} (the runner writes it: run design_game with run: true rather than writing it by hand)`);
  if (!isObj(made)) throw fail(' is { <hero | systems | gear-<class>>: { ref, order, stored } }');
  for (const [k, v] of Object.entries(made)) {
    if (!MADE_KEY.test(k)) throw fail(`.${k} is not something a run makes (hero, hero-equipped, guard, ride, foe, tower, farmhand, keeper, athlete, cast-<id>, casting, folk-<town>-<who>, systems, gear-<class>, stock-<id>, level-<level>-<n>, audit-level-<level>-<n>, map-<n>, game, fighter-<id>[-sheet], foes-<id>; a figure's pool: guard-2 …)`);
    if (!isObj(v) || typeof v.ref !== 'string' || !v.ref || !PRINT.test(v.order ?? '') || !PRINT.test(v.stored ?? '')) throw fail(`.${k} is { ref, order, stored }`);
    const audit = k.startsWith('audit-');
    for (const x of Object.keys(v)) if (!['ref', 'order', 'stored', ...(audit ? ['verdict'] : [])].includes(x)) throw fail(`.${k}.${x} is not part of the record (ref, order, stored${audit ? ', verdict' : ''})`);
    if (audit && (!isObj(v.verdict) || ![true, false, null].includes(v.verdict.completable) || typeof v.verdict.note !== 'string')) throw fail(`.${k}.verdict is { completable: true | false | null, note }`);
  }
  return made;
}
