/**
 * The TARGET a game is drawn for: the resolution it is exported to and how the camera frames a standing figure. Together
 * they say how many pixels a metre of the world covers near the figure, and so how dense its polygons and texels need
 * to be. This is the density half of fidelity; the look half is the era (eras.js).
 *
 * The rule for an outline: a ring of N sides round a radius of r pixels misses the true circle by r·(1 − cos(π/N)),
 * about r·π²/(2N²), so an outline within `error` pixels wants N ≥ π·√(r / (2·error)). Sides grow with the square root of
 * the pixel radius, so a figure's triangles grow about with how many pixels tall it stands, not with the screen's
 * pixel count. Detail the eye resolves (a face, fingers, gear) is a separate budget, not this rule's.
 *
 *   readTarget(spec)          a target { resolution, framing, error } (words or numbers) → checked, with its heights
 *   pxPerMetre(target, h)     pixels per metre near a standing figure h metres tall
 *   sidesFor(rPx, error)      the sides an outline of radius rPx wants
 *   outlineError(rPx, sides)  how far a ring of `sides` misses a circle of radius rPx, in pixels
 */
export const RESOLUTIONS = Object.freeze({ '480p': 480, '720p': 720, '1080p': 1080, '1440p': 1440, '4k': 2160 });
/** the share of the screen's height a standing figure fills */
export const FRAMINGS = Object.freeze({ close: 0.8, 'third-person': 1 / 3, wide: 0.18, 'top-down': 0.1 });
export const DEFAULT_TARGET = Object.freeze({ resolution: '1080p', framing: 'third-person', error: 1 });

const no = (msg) => { throw new Error(`target: ${msg}`); };
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Error text for a target spec, or null. */
export function targetError(spec) {
  try { readTarget(spec); return null; } catch (e) { return e.message; }
}

/**
 * A target spec → { resolution, framing, error, screenPx, figurePx }. `resolution` is a word (RESOLUTIONS) or the
 * screen's height in pixels; `framing` a word (FRAMINGS) or the share of that height the figure fills (0..1); `error`
 * the outline's allowance in pixels (default 1). A word alone is the resolution.
 */
export function readTarget(spec) {
  const t = typeof spec === 'string' ? { resolution: spec } : spec;
  if (!t || typeof t !== 'object' || Array.isArray(t)) no(`a target is a resolution word (${Object.keys(RESOLUTIONS).join(', ')}) or { resolution, framing?, error? }`);
  for (const k of Object.keys(t)) if (!['resolution', 'framing', 'error'].includes(k)) no(`${k} is not a setting (resolution, framing, error)`);
  const resolution = t.resolution ?? DEFAULT_TARGET.resolution, framing = t.framing ?? DEFAULT_TARGET.framing, error = t.error ?? DEFAULT_TARGET.error;
  const screenPx = typeof resolution === 'number' ? resolution : RESOLUTIONS[resolution];
  if (!(Number.isFinite(screenPx) && screenPx >= 120 && screenPx <= 8640)) no(`resolution is a word (${Object.keys(RESOLUTIONS).join(', ')}) or the screen's height in pixels, 120..8640`);
  const share = typeof framing === 'number' ? framing : FRAMINGS[framing];
  if (!(Number.isFinite(share) && share > 0 && share <= 1)) no(`framing is a word (${Object.keys(FRAMINGS).join(', ')}) or the share of the screen's height a standing figure fills, above 0 and at most 1`);
  if (!(Number.isFinite(error) && error >= 0.25 && error <= 8)) no('error is the outline\'s allowance in pixels, 0.25..8');
  return { resolution, framing, error, screenPx, figurePx: r3(screenPx * share) };
}

/** Pixels per metre near a standing figure `heightM` metres tall, framed as the target says. */
export const pxPerMetre = (target, heightM) => target.figurePx / heightM;

/** The sides an outline of radius `rPx` pixels wants to stay within `error` pixels of a circle. */
export const sidesFor = (rPx, error = 1) => Math.PI * Math.sqrt(rPx / (2 * error));

/** How far a ring of `sides` sides misses a circle of radius `rPx` pixels. */
export const outlineError = (rPx, sides) => rPx * (1 - Math.cos(Math.PI / sides));
