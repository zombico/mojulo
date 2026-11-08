/**
 * sfx-shelf/register — the realistic register's floor: what any sound in it must reach, taken from the layered set's
 * own weakest (the Mobile Suit Arena floor, improved: sets/mecha-layered.js, measured in baseline.js), never written
 * by hand. A family's every dial point is held to it (families.deep.test.js); its defaults in the regular tier.
 *
 *   layers   at least as many as the thinnest layered sound stacks
 *   heard    it fills at least as many bands, as the ear weighs them (measure.js `heard`)
 *   crest    at least as much punch, unless it swells rather than strikes (a gust, a riser)
 */
import { BASELINE } from './baseline.js';

const L = Object.values(BASELINE['mecha-layered']);
export const REGISTER = Object.freeze({
  layers: Math.min(...L.map((m) => m.layers)),
  heard: Math.min(...L.map((m) => m.heard)),
  crestDb: Math.min(...L.map((m) => m.crestDb)),
});

/** What a sound lacks of the register, as readable lines (none: it is in it). */
export function meetsRegister(m, { swell = false } = {}) {
  const off = [];
  if (m.layers < REGISTER.layers) off.push(`layers ${m.layers} < ${REGISTER.layers}`);
  if (m.heard < REGISTER.heard) off.push(`heard spread ${m.heard} < ${REGISTER.heard}`);
  if (!swell && m.crestDb < REGISTER.crestDb) off.push(`crest ${m.crestDb} dB < ${REGISTER.crestDb}`);
  return off;
}
