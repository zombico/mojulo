/**
 * SIZE CLASS — how big an animal is, in the five words a level places it by (a biocube's fauna, era/biocube-fauna.js),
 * measured, never tagged: a bug by its bauplan's `length` (bugs/species.js), an animal by its skeleton's longest
 * extent (./skeleton.js, metres, the bones' bounding box). Nothing is authored per species: a new species gets its class
 * by the bones it builds.
 *
 *   SIZE_CLASSES          each class's read and its upper bound (m, the longest extent under it)
 *   SIZE_CLASS_IDS        mini, smol, chonky, behemoth, gargantuan, smallest first
 *   classOfExtent(m)      → the class an extent falls in
 *   extentOf(id)          → an animal's or a bug's longest extent (m), or null for neither
 *   sizeClassOf(id)       → { id, roster: 'fauna' | 'bugs', extent, class }, or null
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
  behemoth: Object.freeze({ under: 5, read: 'a hippo, a rhino, a crocodile, a giraffe' }),
  gargantuan: Object.freeze({ under: Infinity, read: 'an elephant and up: it stands in a level as terrain does' }),
});
export const SIZE_CLASS_IDS = Object.freeze(Object.keys(SIZE_CLASSES));

export function classOfExtent(m) {
  if (!(Number.isFinite(m) && m >= 0)) throw new Error(`size class: an extent is a length in metres (not ${m})`);
  return SIZE_CLASS_IDS.find((k) => m < SIZE_CLASSES[k].under);
}

const EXTENT = new Map();
export function extentOf(id) {
  if (EXTENT.has(id)) return EXTENT.get(id);
  let e = null;
  if (BUG_SPECIES[id]) e = BUG_SPECIES[id].length;
  else if (SPECIES[id]) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const b of faunaSkeleton(id).bones) for (const p of [b.head, b.tail]) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    e = Math.round(Math.max(...hi.map((v, k) => v - lo[k])) * 1000) / 1000;
  }
  EXTENT.set(id, e);
  return e;
}

export function sizeClassOf(id) {
  const extent = extentOf(id);
  if (extent === null) return null;
  return Object.freeze({ id, roster: BUG_SPECIES[id] ? 'bugs' : 'fauna', extent, class: classOfExtent(extent) });
}
