/**
 * THE ATHLETES — the people a sport is played by, each a character made with create_character (a sketch ref), carried on
 * the arena's key beside the play: a lane's runner, a side's player, a seat's golfer or bowler. The arena stores the
 * refs, never the bodies: like a versus roster, a sport follows its characters' edits, packed again wherever the page is
 * served (world-scene.js: each character's rig bones and rigid parts, versus-character.js characterBody). On the page a
 * slot with a body plays in it (athlete-pose.js, athlete.client.js); a slot without one, a ref the store has lost or a
 * rig the figure cannot stand up, is the arena's stick figure. Absent, nothing is added anywhere.
 *
 *   athletes: [<ref> | null, …]   one per slot, in the sim's order (the lanes; side a then side b, each in its roles'
 *                                 order; the seats), cycled when shorter than the slots
 *
 *   readAthletes(v, most, fail)  → the list checked (undefined when absent); throws through `fail`, teaching
 *   athleteBodies(refs)          → { <ref>: body } from the store for each ref with one, or null
 */
export const ATHLETE_REF = /^[A-Za-z0-9_-]{1,64}$/;

/** An arena's athletes, checked: 1 to `most` slots, each a character's ref or null (that slot's stick figure). */
export function readAthletes(v, most, fail) {
  if (v === undefined) return undefined;
  const words = `athletes is a list of 1 to ${most} characters' refs (made with create_character), one per slot in the sim's order, null for a slot's stick figure`;
  if (!Array.isArray(v) || v.length < 1 || v.length > most) fail(words);
  v.forEach((r, i) => { if (r !== null && !(typeof r === 'string' && ATHLETE_REF.test(r))) fail(`athletes[${i}]: ${words}`); });
  return [...v];
}

/** Each athlete's body from the store (one per character), or null when none has one. */
export async function athleteBodies(refs) {
  if (!Array.isArray(refs) || !refs.some((r) => typeof r === 'string')) return null;
  const { characterBodies } = await import('../versus/versus-character.js');
  return characterBodies(refs.filter((r) => typeof r === 'string').map((character) => ({ character })));
}
