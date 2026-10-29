/**
 * BARED: a gaunt corpse with parts gone back to bone, the inverse of the decayed skeleton: the zombie's body drawn in
 * further, and a few of its parts, seeded from the card's list, the skeleton's (laid on the tiered hero by
 * ./tiered-layers.js). The words a card's `bared.parts` takes:
 *
 *   skull     the head gone to its skull, its jaw its own bone, on a neck drawn in under it
 *   arm       one arm bone from the shoulder: the humerus, the forearm's bones, the hand's and the fingers'
 *   foreArm   one forearm and its hand bone from the elbow, the upper arm still flesh
 *   thigh     one thigh to its femur, the shin below still flesh
 *   shin      one shin and its foot to the bone, from the knee
 *   ribs      one side's ribs broken through the chest, an open wound of meat under them
 *   halfForeArm, halfUpperArm, halfThigh, halfShin   the limb's bone its whole length, a sleeve of its flesh left at
 *             one end (seeded), the torn edge layered: the skin ends, the meat under it runs on onto the bone
 *
 *   pickBared(spec, rand, lost)   → [{ part, side }]   spec { count: [lo, hi], parts }: how many, from which
 *
 * Pure: the dice are the caller's.
 */
// the stretches of a limb each word bares: the upper arm, the forearm, the thigh, the shin
const REGIONS = { arm: ['ua', 'fa'], foreArm: ['fa'], halfForeArm: ['fa'], halfUpperArm: ['ua'], thigh: ['th'], halfThigh: ['th'], shin: ['sh'], halfShin: ['sh'] };
/** the parts a card bares: a seeded count, each word once, each a side of its own; a lost part's side stays as the loss
 * left it (an arm bares once, as the whole arm or its forearm; a lost forearm has no bone left to show) → [{ part, side }] */
export function pickBared(spec, rand, lost) {
  const replaced = [], pool = [...spec.parts], [lo, hi] = spec.count ?? [1, 2], n = lo + Math.floor(rand() * (hi - lo + 1));
  // (each word claims its stretch of the limb on its side, so a whole and a half word never bare the same one)
  const taken = new Set(), claims = (part, side) => (REGIONS[part] ?? [part]).map((r) => `${r}${side}`);
  while (replaced.length < n && pool.length) {
    const part = pool.splice(Math.floor(rand() * pool.length), 1)[0], side = part === 'skull' ? null : rand() < 0.5 ? 'R' : 'L';
    if (claims(part, side).some((c) => taken.has(c)) || (lost?.part === 'foreArm' && lost.side === side && (REGIONS[part] ?? []).includes('fa'))) continue;
    for (const c of claims(part, side)) taken.add(c);
    replaced.push({ part, side });
  }
  return replaced;
}

