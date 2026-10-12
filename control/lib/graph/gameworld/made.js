/**
 * WHAT A RUN MADE — the gameworld's record of the sketches its runner made (design_game's `run`), kept in the recipe so
 * a later run knows what is there and whether the creator changed it since:
 *
 *   made?: { <key>: { ref, order, stored } }
 *     key     'hero', 'hero-equipped', 'guard' (a quick sneak's), 'ride' (a quick game's vehicle), 'systems', 'gear-<class>', 'level-<level>-<n>' (a stage), or 'game'
 *     ref     the sketch it made
 *     order   the print of the order it made it from (a later run remakes it when the book's order moves)
 *     stored  the print of the manifest it left there (a manifest that no longer prints so was edited by hand, and a
 *             run leaves it as it is unless forced)
 *
 * Pure: the shape only. The runner (runner.js) writes it; nothing here reads the database.
 */
export const MADE_KEY = /^(hero|hero-equipped|guard|ride|cast-[a-z][a-z0-9-]*|systems|gear-[a-z]+|level-[a-z0-9-]+|game)$/;
const PRINT = /^[0-9a-f]{8}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Read the record and say what is wrong. → the record */
export function readMade(made) {
  const fail = (m) => new Error(`gameworld: made${m} (the runner writes it: run design_game with run: true rather than writing it by hand)`);
  if (!isObj(made)) throw fail(' is { <hero | systems | gear-<class>>: { ref, order, stored } }');
  for (const [k, v] of Object.entries(made)) {
    if (!MADE_KEY.test(k)) throw fail(`.${k} is not something a run makes (hero, hero-equipped, guard, ride, cast-<id>, systems, gear-<class>, level-<level>-<n>, game)`);
    if (!isObj(v) || typeof v.ref !== 'string' || !v.ref || !PRINT.test(v.order ?? '') || !PRINT.test(v.stored ?? '')) throw fail(`.${k} is { ref, order, stored }`);
    for (const x of Object.keys(v)) if (!['ref', 'order', 'stored'].includes(x)) throw fail(`.${k}.${x} is not part of the record (ref, order, stored)`);
  }
  return made;
}
