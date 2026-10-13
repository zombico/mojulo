// the city's seeded dice: one stream per layer and key (`${seed}|<layer>-v1|<key>`), so no layer's rolls move another's
export function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function strHash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
/** The dice of one layer (and one key within it). */
export const streamOf = (seed, layer, key = '') => mulberry32(strHash(`${seed}|${layer}-v1|${key}`));
