/**
 * A KIN'S HEADGEAR: helmets for the relational creature head (./relational.js), cut from the head's OWN FIELD. The
 * hero door's headgear cards (headgear/cards.js) are drawn on a person's cranium, its rows and its slots; a kin has no
 * such part (its head is one skin netted from a field: ./worn.js), and its skull is any shape: a goblin's little vault
 * behind a long nose, an orc's low one over a jaw. So a kin's helmet names no geometry of its own. It is the SKIN SET
 * OUT by a pad and a plate's thickness, kept above a RIM (a plane from over the eyes back and down to the nape), with a
 * hole round each ear's foot, and the card's own masses joined to it: a nasal down the nose's root, horns off its sides.
 * It fits whatever skull it is asked of, because it is that skull's surface.
 *
 *   KIN_HEADGEAR            { <id>: { reads, pad, thick, front, back, nasal?, horns?, spike? } } (V, the head's height)
 *     pad, thick            the gap under the plate and the plate's thickness
 *     front                 how far over the eye's top its rim runs at the face
 *     back                  the rim's height at the back of the skull (the nape low, the crown high)
 *     nasal                 { length, width }: a bar from the rim down the nose's root, on the skin
 *     horns                 { at (its foot's share of the vault's half breadth), len, r, out, up, back }: one a side
 *     spike                 { len, r }: one on the crown
 *   KIN_HEADGEAR_IDS
 *   kinHeadgearField(head, id) → { field(p), bounds, mid }: the helmet's field and its box in the head's own units
 *                           (./relational.js: STAND units, negative inside), `mid` a point inside it
 * Pure and deterministic.
 */
import { sdRoundCone } from '../polygonizer/vajra.js';
import { HEAD_V } from '../polygonizer/head-relational.js';

export const KIN_HEADGEAR = Object.freeze({
  'kin-cap': Object.freeze({ reads: 'a skull cap: a pot of hide or iron over the vault down to the brow, the ears out under its rim', pad: 0.012, thick: 0.035, front: 0.1, back: 0.4 }),
  'kin-nasal-helm': Object.freeze({ reads: 'a helm with a nasal: the cap run lower at the back, a bar down from its rim over the nose\'s root', pad: 0.012, thick: 0.04, front: 0.08, back: 0.3,
    nasal: Object.freeze({ length: 0.24, width: 0.07 }) }),
  'kin-horned-helm': Object.freeze({ reads: 'a horned helm: the helm with its nasal, a horn off each side curving up, a leader\'s', pad: 0.012, thick: 0.045, front: 0.08, back: 0.3,
    nasal: Object.freeze({ length: 0.24, width: 0.07 }), horns: Object.freeze({ at: 0.8, len: 0.5, r: 0.075, out: 0.8, up: 0.75, back: 0.1 }) }),
  'kin-spiked-cap': Object.freeze({ reads: 'a spiked cap: the skull cap with a spike on its crown', pad: 0.012, thick: 0.035, front: 0.1, back: 0.4, spike: Object.freeze({ len: 0.22, r: 0.05 }) }),
});
export const KIN_HEADGEAR_IDS = Object.freeze(Object.keys(KIN_HEADGEAR));

/** how far round an ear's foot the plate is cut back, over the ear's own half breadth (V) */
const EAR_ROOM = 0.035;

export function kinHeadgearField(head, id) {
  const G = KIN_HEADGEAR[id];
  if (!G) throw new Error(`creature-heads/headgear: no kin headgear '${id}' (${KIN_HEADGEAR_IDS.join(', ')})`);
  const sc = HEAD_V, R = head.relations, P = head.points, t = (G.pad + G.thick) * sc;
  // THE RIM: a plane through a point over the eyes and one at the back of the skull, its upper side kept
  const F = { y: P.eye.y, z: P.eye.z + (R.eyeSize + G.front) * sc }, B = { y: P.op.y, z: G.back * sc };
  const dy = B.y - F.y, dz = B.z - F.z, l = Math.hypot(dy, dz), n = { y: dz / l, z: -dy / l };
  const under = (p) => -((p.y - F.y) * n.y + (p.z - F.z) * n.z);
  // THE EARS' HOLES: a ball round each ear's foot
  const ear = head.vajras.find((w) => w.name === 'earR'), ec = ear ? { x: ear.a.x * sc, y: ear.a.y * sc, z: ear.a.z * sc } : null, er = ear ? (ear.r[0] + EAR_ROOM) * sc : 0;
  const hole = (p) => (ec ? er - Math.hypot(Math.abs(p.x) - ec.x, p.y - ec.y, p.z - ec.z) : -Infinity);
  // THE CARD'S OWN MASSES
  const cones = [];
  if (G.horns) { const H = G.horns, hw = ((R.cephalic * R.craniumLength) / 2) * sc;
    const a = { x: hw * H.at, y: P.crown.y, z: P.crown.z - 0.12 * sc }, L = H.len * sc, dl = Math.hypot(H.out, H.up, H.back);
    const b = { x: a.x + (H.out / dl) * L, y: a.y - (H.back / dl) * L, z: a.z + (H.up / dl) * L }, m = { x: a.x + (H.out / dl) * L * 0.62, y: (a.y + b.y) / 2, z: a.z + (H.up / dl) * L * 0.3 };
    for (const s of [1, -1]) cones.push([{ ...a, x: a.x * s }, { ...m, x: m.x * s }, H.r * sc, H.r * 0.7 * sc], [{ ...m, x: m.x * s }, { ...b, x: b.x * s }, H.r * 0.7 * sc, 0.008 * sc]); }
  if (G.spike) { const a = { x: 0, y: P.crown.y, z: P.crown.z - 0.05 * sc }, b = { x: 0, y: a.y - 0.03 * sc, z: a.z + G.spike.len * sc };
    cones.push([a, b, G.spike.r * sc, 0.008 * sc]); }
  const field = (p) => {
    const skin = head.field(p);
    let d = Math.max(skin - t, under(p), hole(p));
    // (the nasal: the plate itself, kept in a band down the midline from the rim to its length below it)
    if (G.nasal) d = Math.min(d, Math.max(skin - t, Math.abs(p.x) - (G.nasal.width / 2) * sc, p.z - F.z - 0.02 * sc, F.z - G.nasal.length * sc - p.z, P.eye.y - 0.1 * sc - p.y));
    for (const [a, b, ra, rb] of cones) d = Math.min(d, sdRoundCone(p, a, b, ra, rb));
    return d;
  };
  const pad = t + (G.horns ? G.horns.len * sc : G.spike ? G.spike.len * sc : 0) + 0.02 * sc, hb = head.bounds;
  const bounds = { min: { x: hb.min.x - pad, y: hb.min.y - pad, z: Math.min(B.z, F.z - (G.nasal?.length ?? 0) * sc) - 0.03 * sc }, max: { x: hb.max.x + pad, y: hb.max.y + pad, z: Math.max(hb.max.z, P.crown.z) + pad } };
  return { field, bounds, mid: { x: 0, y: P.crown.y, z: P.crown.z - 0.2 * sc } };
}
