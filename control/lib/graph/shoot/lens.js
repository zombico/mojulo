/**
 * Shoot plan — the lens. A camera's lens is one number, its focal length in millimetres, over a film back
 * (`film_mm`, the horizontal width; 36 mm is After Effects' default and full-frame still film). The horizontal
 * field of view every `worldFraming` consumer reads is derived from the two, never stored:
 *
 *     hfov = 2·atan(film / (2·focal))
 *
 * AE's own `zoom` (in pixels) is the same relation over the comp width; it is not accepted here because a world has
 * no comp width. Pure functions.
 */

export const FILM_MM = 36;

/** The preset lenses After Effects offers, in mm. */
export const LENS_PRESETS = [15, 20, 24, 28, 35, 50, 80, 135, 200];

const DEG = 180 / Math.PI;

/** Horizontal field of view (degrees) of a focal length on a film back. */
export function hfovForFocal(focalMm, filmMm = FILM_MM) {
  return 2 * Math.atan(filmMm / (2 * focalMm)) * DEG;
}

/** Focal length (mm) that gives a horizontal field of view (degrees) on a film back. */
export function focalForHfov(hfovDeg, filmMm = FILM_MM) {
  return filmMm / (2 * Math.tan(hfovDeg / (2 * DEG)));
}

/**
 * Read a lens from the words people use: a number of mm, `'35mm'`, `'35 mm'`, `{ focal_mm }`, or a field of view
 * (`{ hfov }` in degrees). Returns the focal length in mm, or null when there is nothing usable.
 */
export function parseLens(v, filmMm = FILM_MM) {
  if (v == null) return null;
  if (typeof v === 'number') return v > 0 && Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*mm$/i);
    return m && +m[1] > 0 ? +m[1] : null;
  }
  if (typeof v === 'object') {
    if (v.focal_mm != null) return parseLens(v.focal_mm, filmMm);
    if (Number.isFinite(v.hfov) && v.hfov > 0 && v.hfov < 180) return focalForHfov(v.hfov, filmMm);
  }
  return null;
}
