/**
 * SIZE CLASS — how big an animal is, in the five words a level places it by (a biocube's fauna, era/biocube-fauna.js),
 * measured, never tagged: a bug by its bauplan's `length` (bugs/species.js), an animal by its skeleton's longest
 * extent (./skeleton.js, metres, the bones' bounding box). Nothing is authored per species: a new species gets its class
 * by the bones it builds. A body standing TALL (its skeleton's height) is gargantuan whatever its length: a giraffe.
 * Gargantuan is a rock's or a pillar's scale, an elephant up to a Gundam's: never a mountain (a unit past GARGANTUAN_MAX
 * is a landmark, not fauna).
 *
 *   SIZE_CLASSES          each class's read and its upper bound (m, the longest extent under it)
 *   SIZE_CLASS_IDS        mini, smol, chonky, behemoth, gargantuan, smallest first
 *   TALL, GARGANTUAN_MAX  the standing height that makes a body gargantuan (m), and the most a gargantuan unit is (m)
 *   classOfExtent(m, height?)  → the class an extent (and a standing height) falls in
 *   extentOf(id)          → an animal's or a bug's longest extent (m), or null for neither
 *   heightOf(id)          → an animal's standing height (m, its skeleton's), a bug's null, or null for neither
 *   sizeClassOf(id)       → { id, roster: 'fauna' | 'bugs', extent, height, class }, or null
 *
 * Pure and deterministic; an animal's skeleton built once.
 */
import { SPECIES } from './species.js';
import { faunaSkeleton } from './skeleton.js';
import { BUG_SPECIES } from '../bugs/species.js';

export const SIZE_CLASSES = Object.freeze({
  mini: Object.freeze({ under: 0.1, read: 'an insect: a gnat, a bee, a beetle' }),
  smol: Object.freeze({ under: 0.6, read: 'a mouse up to a pet: a rabbit, a cat, a duck' }),
  chonky: Object.freeze({ under: 3, read: 'past a pet up to a person or cattle: a dog, a sheep, a deer, a cow' }),
  behemoth: Object.freeze({ under: 5, read: 'a hippo, a rhino, a crocodile' }),
  gargantuan: Object.freeze({ under: Infinity, read: 'an elephant, a giraffe, up to a Gundam: it stands in a level as a rock or a pillar does' }),
});
export const SIZE_CLASS_IDS = Object.freeze(Object.keys(SIZE_CLASSES));
export const TALL = 4, GARGANTUAN_MAX = 20;

export function classOfExtent(m, height = null) {
  if (!(Number.isFinite(m) && m >= 0)) throw new Error(`size class: an extent is a length in metres (not ${m})`);
  if (Number.isFinite(height) && height >= TALL) return 'gargantuan';
  return SIZE_CLASS_IDS.find((k) => m < SIZE_CLASSES[k].under);
}

// an animal's skeleton's bounding box, once: { extent (its longest side), height (its standing height) }
const DIMS = new Map();
function dimsOf(id) {
  if (DIMS.has(id)) return DIMS.get(id);
  let d = null;
  if (BUG_SPECIES[id]) d = { extent: BUG_SPECIES[id].length, height: null };
  else if (SPECIES[id]) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const b of faunaSkeleton(id).bones) for (const p of [b.head, b.tail]) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    const m = (v) => Math.round(v * 1000) / 1000;
    d = { extent: m(Math.max(...hi.map((v, k) => v - lo[k]))), height: m(hi[2] - lo[2]) };
  }
  DIMS.set(id, d);
  return d;
}
export const extentOf = (id) => dimsOf(id)?.extent ?? null;
export const heightOf = (id) => dimsOf(id)?.height ?? null;

export function sizeClassOf(id) {
  const d = dimsOf(id);
  if (d === null) return null;
  return Object.freeze({ id, roster: BUG_SPECIES[id] ? 'bugs' : 'fauna', extent: d.extent, height: d.height, class: classOfExtent(d.extent, d.height) });
}
