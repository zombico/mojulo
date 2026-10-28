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
 *   ribs      one side's ribs broken through the chest, lying on the flesh over the cage
 *
 *   pickBared(spec, rand, lost)   → [{ part, side }]   spec { count: [lo, hi], parts }: how many, from which
 *
 * Pure: the dice are the caller's.
 */
/** the parts a card bares: a seeded count, each word once, each a side of its own; a lost part's side stays as the loss
 * left it (an arm bares once, as the whole arm or its forearm; a lost forearm has no bone left to show) → [{ part, side }] */
export function pickBared(spec, rand, lost) {
  const replaced = [], pool = [...spec.parts], [lo, hi] = spec.count ?? [1, 2], n = lo + Math.floor(rand() * (hi - lo + 1));
  const taken = new Set(), keyOf = (part, side) => (part === 'arm' || part === 'foreArm' ? `arm${side}` : `${part}${side}`);
  while (replaced.length < n && pool.length) {
    const part = pool.splice(Math.floor(rand() * pool.length), 1)[0], side = part === 'skull' ? null : rand() < 0.5 ? 'R' : 'L';
    if (taken.has(keyOf(part, side)) || (part === 'foreArm' && lost?.part === 'foreArm' && lost.side === side)) continue;
    taken.add(keyOf(part, side)); replaced.push({ part, side });
  }
  return replaced;
}

