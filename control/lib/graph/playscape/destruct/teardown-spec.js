/**
 * teardown-spec — the `teardown` recipe word on a workbench `frames` entry, read and checked. No imports, so the frame
 * validator and the teardown itself can both use it.
 *
 *   teardown: true                          the piece exploded: every part back along the way it seats, held (a still)
 *   teardown: 'exploded' | 'disassemble' | 'assemble'
 *   teardown: { show, at?, seconds?, distance? }
 *     at        a still after `at` steps are undone (the last seated first); 'exploded' is all of them
 *     seconds   per step (default 0.6); distance: in the frame's unit (default 12% of the piece's largest side)
 *
 * 'exploded' and any `at` are STILLS (the faces moved, nothing plays); 'disassemble' and 'assemble' PLAY in the World.
 */
export const TEARDOWN_SHOWS = Object.freeze(['exploded', 'disassemble', 'assemble']);

/** The word normalised → { show, still, at?, seconds?, distance? }, or null when absent or false. */
export function teardownOf(v) {
  if (v === undefined || v === null || v === false) return null;
  const o = v === true ? { show: 'exploded' } : typeof v === 'string' ? { show: v } : v;
  const show = o.show || 'exploded';
  const out = { show, still: show === 'exploded' || o.at !== undefined };
  for (const k of ['at', 'seconds', 'distance']) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

/** What is wrong with a `teardown` word, or null. `at` names where in the recipe it sits. */
export function teardownError(v, at = 'teardown') {
  if (v === undefined || v === null || v === false || v === true) return null;
  if (typeof v === 'string') return TEARDOWN_SHOWS.includes(v) ? null : `${at}: one of ${TEARDOWN_SHOWS.join(', ')} (or true: exploded)`;
  if (typeof v !== 'object' || Array.isArray(v)) return `${at}: true, a show (${TEARDOWN_SHOWS.join(', ')}), or { show, at?, seconds?, distance? }`;
  const extra = Object.keys(v).filter((k) => !['show', 'at', 'seconds', 'distance'].includes(k));
  if (extra.length) return `${at}.${extra[0]}: not a teardown key (show, at, seconds, distance)`;
  if (v.show !== undefined && !TEARDOWN_SHOWS.includes(v.show)) return `${at}.show: one of ${TEARDOWN_SHOWS.join(', ')}`;
  if (v.at !== undefined && !(Number.isInteger(v.at) && v.at >= 0)) return `${at}.at: a whole number of steps undone, ≥ 0`;
  if (v.seconds !== undefined && !(Number.isFinite(v.seconds) && v.seconds > 0)) return `${at}.seconds: seconds a step, > 0`;
  if (v.distance !== undefined && !(Number.isFinite(v.distance) && v.distance > 0)) return `${at}.distance: a distance in the frame's unit, > 0`;
  return null;
}
