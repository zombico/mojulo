/**
 * brawl power look — what a hero's power looks like on the page: its beam (brawl-powers.js) read against the elements'
 * shelf (playscape/elements/beams.js BEAMS), and the colour its round, its burst and its pips are drawn in. Apart from
 * brawl-powers.js because that one is inlined into the page (brawl-page.js BRAWL_PAGE_MODULES) and this one is not: the
 * page carries a colour, never the shelf.
 *
 *   beamColour(beam)        → '#rrggbb' the beam's colour (its own, or its first strand's), or null for no such beam
 *   powerLook(power)        → { id, stock, beam, colour } a power as written (brawl-powers.js readPower) with its colour;
 *                            throws naming the beams for a beam the shelf has not
 *
 * Pure.
 */
import { BEAMS, BEAM_NAMES } from '../playscape/elements/beams.js';
import { readPower } from './brawl-powers.js';

const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

export function beamColour(beam) {
  const B = BEAMS[beam];
  if (!B) return null;
  const c = B.color ?? (Array.isArray(B.strands) ? B.strands.find((s) => s.color)?.color : B.strands?.color);
  return Array.isArray(c) ? hex(c) : null;
}

export function powerLook(power, at = 'power') {
  const P = readPower(power, at);
  if (!BEAMS[P.beam]) throw new Error(`brawl: ${at}.beam is its look, one of ${BEAM_NAMES.join(', ')}`);
  return { ...P, colour: beamColour(P.beam) ?? '#ffffff' };
}
