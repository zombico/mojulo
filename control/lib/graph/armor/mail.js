// armor/mail — the MAIL family: a coat of linked rings (a hauberk), its hood (a coif) and its leggings (chausses), as an
// adornment kit for the hero (station-loft-adorn.js modes). Pure data out; no dice.
//
// Mail is a FABRIC OF RINGS, never plates (law 12): it hangs from the shoulders and follows the body (not rigid), its
// whole field worked in courses of rings (the `courses` signature: a row every few centimetres, each the last's rings
// offset by half a ring), its edges ending in a ring hem. It is long: a byrnie to the hip, a hauberk past the hip and
// down the thighs, slit for riding; its sleeves to the elbow, then the wrist. A belt is buckled over it; a surcoat (a
// tabard) may hang over it, and the coif frames the face.
//
//   language: { coif: true | false (the hood, when coverage reaches it), surcoat: 'none' | 'tabard' }
//   groups:   Mail (the rings: metal), Belt, Buckle, Tabard (the surcoat's cloth), Trim (its hem)
//
// Addresses as plate.js: torso stations `s` 0 (hips) → 4 (neck), the ring parameter `t` in the halves Ht and Hl; the
// cranium's `t` is lamellar.js's slot index (0 the face → 8 the back).
import { armorProportion } from './principles.js';
import { r4 } from './plate.js';

export const SURCOATS = Object.freeze(['none', 'tabard']);
// ORDER (law 9, per family): the shirt and its short sleeves first (a byrnie), then its skirt and belt (a hauberk), the
// long sleeves, the coif, the chausses
export const MAIL_ORDER = Object.freeze([[0.0, 'byrnie'], [0.3, 'skirt'], [0.45, 'sleeves'], [0.6, 'coif'], [0.75, 'chausses']]);

/** a mail suit at `dials.coverage` as one kit. opts: coif (boolean), surcoat ('none' | 'tabard') */
export function mailSuit(dials, ctx, { coif = true, surcoat = 'none' } = {}) {
  const { Ht, Hl, k = 1, height = 1.75 } = ctx; const c = dials.coverage ?? 1;
  const law = armorProportion(dials), minF = law.minFeature * height;
  const thick = Math.max(minF, 0.003 * k * law.thick), mug = (m) => r4(m * k * law.standoff);
  // the rings: a course every `pitch` (fewer and bigger as stylize rises, law 2), a ring's radius floored by law 4
  const ring = r4(Math.max(minF * 0.55, 0.0035 * k / law.lames ** 0.5)), pitch = r4(Math.max(ring * 3.2, 0.032 * k / law.lames));
  const rings = (extra = {}) => ({ kind: 'courses', pitch, r: ring, bead: r4(ring * 4), beads: 28, max: 18, lift: r4(ring * 0.3), group: 'Mail', ...extra });
  const mesh = (o) => ({ mode: 'shell', nt: 14, ns: 6, thick, rad: r4(0.06 * k), group: 'Mail', rigid: false, signature: rings(), ...o });
  const mT = mug(0.006);
  const PIECES = {
    // the shirt from the hip to the neck, and its sleeves to the elbow
    byrnie: () => [mesh({ id: 'torso-byrnie', part: 'torso', s: [0.0, 3.55], t: 'wrap', nt: 18, ns: 8, mugen: mT }),
      // the yoke over the shoulders, from the neck's foot (the coif's mantle takes its place when it is worn)
      ...(coif && c >= 0.6 ? [] : [mesh({ id: 'neck-yoke', mode: 'band', part: 'neck', over: ['torso'], pin: [3.9, 0, 'R', 'torso'], s: [0.0, 1.3], t: 'wrap', nt: 14, ns: 4, mugen: mug(0.004), support: 0.0, ramp: r4(0.35 * law.flare) })]),
      // (on the structured core the hips are the pelvis's: the shirt carries on down over it)
      ...(ctx.pelvis ? [mesh({ id: 'pelvis-byrnie', mode: 'band', part: 'pelvis', over: ['thighR', 'thighL', 'torso'], pin: [4.2, 0, 'R', 'pelvis'], s: [1.2, 4.8], t: 'wrap', nt: 16, ns: 4, mugen: mug(0.008), support: 1.2, ramp: r4(0.3 * law.flare) })] : []),
      ...['R', 'L'].map((S) => mesh({ id: `upperArm${S}-sleeve`, part: `upperArm${S}`, s: [0.0, 1.85], t: 'wrap', nt: 10, ns: 5, mugen: mug(0.004), support: 1.85, ramp: r4(0.25 * law.flare) }))],
    // the skirt down each thigh (slit between them for riding), and the belt over the shirt's waist
    skirt: () => { const knee = c >= 0.75, s1 = knee ? 3.1 : 2.1;
      return [...['R', 'L'].map((S) => mesh({ id: `thigh${S}-skirt`, part: `thigh${S}`, s: [0.0, s1], t: 'wrap', nt: 12, ns: 6, mugen: mug(0.012), support: s1, ramp: r4(0.6 * law.flare) })),
        { id: 'torso-belt', mode: 'band', part: 'torso', s: [0.75, 1.0], t: 'wrap', nt: 16, ns: 2, mugen: r4(mT + ring * 3), thick: r4(thick * 1.4), rad: r4(0.05 * k), group: 'Belt', rigid: false,
          signature: { kind: 'buckle', j: 1, w: r4(0.03 * k), h: r4(0.026 * k), bar: r4(Math.max(minF * 0.5, 0.004 * k)), standoff: r4(0.004 * k), group: 'Buckle' } }]; },
    sleeves: () => ['R', 'L'].map((S) => mesh({ id: `foreArm${S}-sleeve`, part: `foreArm${S}`, s: [0.0, 1.7], t: 'wrap', nt: 10, ns: 5, mugen: mug(0.004), support: 1.7, ramp: r4(0.4 * law.flare) })),
    // the coif: over the crown and the back of the head, framing the face, and down the neck onto the shoulders
    // (the cranium's t a slot index: the crown wrapped from the brow up, the sides from behind the face's slots back)
    coif: () => (coif ? [mesh({ id: 'cranium-coif', part: 'cranium', side: 'R', s: [5.0, 8], t: 'wrap', nt: 16, ns: 4, mugen: mug(0.006), rigid: true }),
      ...['R', 'L'].map((S) => mesh({ id: `cranium-coif${S}`, part: 'cranium', side: S, s: [0.6, 4.6], t: [5.0, 8.0], nt: 6, ns: 4, mugen: mug(0.007), rigid: true })),
      mesh({ id: 'neck-coif', mode: 'band', part: 'neck', over: ['torso'], pin: [3.9, 0, 'R', 'torso'], s: [0.0, 2.2], t: 'wrap', nt: 14, ns: 4, mugen: mug(0.004), support: 0.0, ramp: r4(0.35 * law.flare) })] : []),
    chausses: () => ['R', 'L'].map((S) => mesh({ id: `shank${S}-chausses`, part: `shank${S}`, s: [0.25, 1.85], t: 'wrap', nt: 10, ns: 5, mugen: mug(0.004) })),
  };
  const kit = [], worn = [];
  for (const [th, piece] of MAIL_ORDER) if (c >= th - 1e-9 && (!ctx.keep || ctx.keep.includes(piece))) { worn.push(piece); kit.push(...PIECES[piece]()); }
  // the surcoat over it all: a tabard hung front and back from the shoulders
  if (surcoat === 'tabard') { worn.push('surcoat');
    for (const [p, t0, t1] of [['F', -0.16, 0.16], ['B', 0.84, 1.16]]) {
      const path = Array.from({ length: 5 }, (_, i) => { const t = t0 + (t1 - t0) * i / 4; return [3.45, r4(Math.abs(t) * Ht > Ht ? (2 - t) * Ht : Math.abs(t) * Ht), t < 0 || t > 1 ? 'L' : 'R']; });
      kit.push({ id: `torso-surcoat${p}`, mode: 'strap', part: 'torso', path, width: r4(0.03 * k), thick: r4(0.004 * k), mugen: r4(mT + ring * 4), rad: r4(0.02 * k), group: 'Tabard', stack: false,
        signature: { kind: 'tabard', len: r4(0.95 * k), thick: r4(0.004 * k), stand: r4(0.01 * k), tilt: r4(0.02 * k), taper: 0.95, group: 'Tabard', hem: r4(0.006 * k), hemGroup: 'Trim' } }); } }
  return { kit, trace: { worn, pieces: worn.length, focal: coif && c >= 0.6 ? 'coif' : 'byrnie', courses: { pitch, ring } } };
}
