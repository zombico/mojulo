/**
 * THE ARM CANNON'S BONE (the toy armour's `cannon`, armor/toy.js; the buster's, worlds/controllable/buster.js): the
 * cannon a hero wears round its hand rides a BONE OF ITS OWN, so the page can swap the hand for the cannon while the
 * buster is out (scaling the cannon's bone up and the hand's down) and an engine export carries the same swap.
 *
 * The bone, `buster<S>`, runs from the wrist to the knuckles of the hand it is worn on, both its joints riding that
 * hand: every clip keys it as the hand moves (station-loft-rig.js rigNodesAt places a riding joint for any pose). It is
 * appended after every other bone (the body's, and the cloth's strings when they flow), so the bones before it keep
 * their indices and their keys. Every point of the cannon's parts (`adorn.buster<S>` and its signature's) is weighed
 * wholly to it.
 *
 *   BUSTER_PART                      the cannon's parts by name (a capture: its side)
 *   busterRig(mesh, R, skin)         → { R, skin, side } with the bone, or null for a figure that wears no cannon (the
 *                                    rig and the skin as they were, byte for byte)
 *   HAND_BONE                        the bones of a hand (the palm, the wrist's bridge, the fingers), by side
 *
 * Pure: the rig and the skin in, new ones out (neither is changed in place).
 */

export const BUSTER_PART = /^adorn\.buster([RL])(\.|$)/;
/** the bones a hand is made of on a side (the hero's: hand, wristBridge and the fingers in their segments, thumb1R …
 * little3R) */
export const HAND_BONE = (S) => new RegExp(`^(hand|wristBridge|thumb|index|middle|ring|little|pinky)[A-Za-z0-9]*${S}$`);

/** The cannon's bone on the rig, its parts weighed to it; null where the figure wears no cannon. */
export function busterRig(mesh, R, skin) {
  const prov = mesh?.provenance;
  if (!Array.isArray(prov) || !R?.bones || !skin?.joints) return null;
  const ids = [];
  let side = null;
  prov.forEach((p, i) => { const m = BUSTER_PART.exec(p?.part ?? ''); if (m) { ids.push(i); side ??= m[1]; } });
  const hand = side && R.bones[R.boneIndex[`hand${side}`]];
  if (!ids.length || !hand) return null;
  const base = `busterBase${side}`, tip = `busterTip${side}`, id = `buster${side}`, n = R.bones.length;
  const R2 = {
    ...R,
    joints: { ...R.joints, [base]: [...R.joints[hand.head]], [tip]: [...R.joints[hand.tail]] },
    rides: { ...R.rides, [base]: hand.id, [tip]: hand.id },
    bones: [...R.bones, { id, head: base, tail: tip }],
    boneIndex: { ...R.boneIndex, [id]: n },
  };
  const joints = skin.joints.slice(), weights = skin.weights.slice(), dominant = Array.from(skin.dominant);
  for (const i of ids) { joints[i] = [n, 0, 0, 0]; weights[i] = [1, 0, 0, 0]; dominant[i] = n; }
  return { R: R2, skin: { ...skin, joints, weights, dominant }, side };
}
