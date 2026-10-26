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
 *   atStature(body)              → the body drawn at a player's stature when it is smaller (a chibi, a mascot)
 *
 * A body shorter than ATHLETE_STATURE (a chibi, a mascot) plays at it, scaled whole about its feet: its proportions are
 * its own (the big head, the short legs) and its reach is a player's, so the racquet meets the ball the sim swings at
 * and the keeper's hands reach the bar; a round one only as far as a broad player's width (ATHLETE_HALF_WIDTH), so it
 * keeps to its lane. A body that tall or taller is drawn at its own size.
 */
/** The least stature a sport's body is drawn at (m): a sim's player is a grown one. ATHLETE_HALF_WIDTH caps the growth
 * so a round body (an orb, a big head) is never wider than a broad player (m, its farthest part from the middle line). */
export const ATHLETE_STATURE = 1.5, ATHLETE_HALF_WIDTH = 0.45;
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
  const bodies = await characterBodies(refs.filter((r) => typeof r === 'string').map((character) => ({ character })));
  return bodies && Object.fromEntries(Object.entries(bodies).map(([ref, b]) => [ref, atStature(b)]));
}

const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** A body below a player's stature scaled whole about its feet (the origin: x and y centred, its soles on z = 0) to it;
 * a body at or past it as it is. */
export function atStature(body) {
  const top = Math.max(...body.bones.flatMap((b) => [b.head[2], b.tail[2]]));
  if (!(top > 0) || top >= ATHLETE_STATURE) return body;
  const f32 = (pos) => new Float32Array(Uint8Array.from(Buffer.from(pos, 'base64')).buffer);   // (a copy: a pooled buffer's offset need not be aligned)
  let half = 0;
  for (const p of body.parts) if (p?.pos) { const f = f32(p.pos); for (let i = 0; i < f.length; i += 3) half = Math.max(half, Math.abs(f[i])); }
  const k = Math.min(ATHLETE_STATURE / top, half > 0 ? ATHLETE_HALF_WIDTH / half : Infinity);
  if (!(k > 1)) return body;
  const grow = (p) => p.map((v) => r4(v * k));
  const scalePos = (pos) => { const f = f32(pos); for (let i = 0; i < f.length; i++) f[i] *= k; return Buffer.from(f.buffer).toString('base64'); };
  return {
    ...body,
    bones: body.bones.map((b) => ({ ...b, head: grow(b.head), tail: grow(b.tail) })),
    parts: body.parts.map((p) => (p?.pos ? { ...p, pos: scalePos(p.pos) } : p)),
    stature: { own: r4(top), drawn: r4(top * k) },
  };
}
