/**
 * interior/units — an interior is authored in millimetres (the furniture's own unit, furnishings/forms.js); the house it
 * sits in is feet (polygonizer/floorplan-structure.js). A length may be written the way people say it.
 */

export const MM_PER_FT = 304.8;
export const mmToFt = (mm) => mm / MM_PER_FT;
export const ftToMm = (ft) => ft * MM_PER_FT;

const UNIT_MM = { mm: 1, cm: 10, m: 1000, in: 25.4, '"': 25.4, ft: MM_PER_FT, "'": MM_PER_FT };

/**
 * A length → millimetres, or null when it is not one. A number is millimetres; a string carries its unit:
 * '2400', '2400mm', '240cm', '2.4m', '36in', '36"', '14ft', "14'", "14'6\"", '14ft 6in'.
 */
export function lengthMm(v) {
  if (Number.isFinite(v)) return v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().replace(/\s+/g, '');
  const feetInches = /^(\d+(?:\.\d+)?)(?:ft|')(\d+(?:\.\d+)?)(?:in|")?$/.exec(s);
  if (feetInches) return +feetInches[1] * MM_PER_FT + +feetInches[2] * 25.4;
  const m = /^(\d+(?:\.\d+)?)(mm|cm|m|in|"|ft|')?$/.exec(s);
  if (!m) return null;
  const mm = +m[1] * UNIT_MM[m[2] || 'mm'];
  return mm > 0 ? mm : null;
}

/** [w, d, h] of lengths → mm, or null if any is not a length. */
export function sizeMm(v, n = 3) {
  if (!Array.isArray(v) || v.length !== n) return null;
  const out = v.map(lengthMm);
  return out.every((x) => x != null) ? out : null;
}

export const r1 = (n) => Math.round(n * 10) / 10;
export const r0 = (n) => Math.round(n);
