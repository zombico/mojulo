/**
 * Whether a world fights with guns, read off its words alone (no runtime): its quick goal shoots (shoot, deathmatch) or
 * it carries arms. The readout and the rail link the combat book (book.js) for it; the book itself asks the made level
 * for an armed player. Pure.
 */
export function combatGame(world) {
  const Q = world?.quick;
  return !!(Q && (Q.goal === 'shoot' || Q.goal === 'deathmatch' || Q.arms));
}
