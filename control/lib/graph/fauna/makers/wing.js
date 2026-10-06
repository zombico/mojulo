// THE WING MAKERS — species-free wing data for ../wing.js (buildWing), worn by a family through `wings: { wing, at,
// fold, palette }`. A bird is a `featherWing(...)`, a bat / dragon a `membraneWing(...)`.
//   featherWing({ arm: [humerus, ulna, hand] m (0.03 … 0.5 each), tertials 0 … 6, secondaries 6 … 24, primaries 6 … 12,
//     secLen / primLen m (flight feather lengths), primReach m (extra primary length at the wing tip), slotFrom 0 … 1
//     (fraction of primaries emarginated into slots; 1 = none), slotBy 0 … 1 (slot depth), width m (vane half-width),
//     tertialLen / tertialWidth / boneR × (1 = default) }) — defaults: a ~2.5 m-span soaring wing.
//   membraneWing(k = 0.19 (× the 4 m-span dragon wing; 0.19 ≈ a 1 m-span flying fox), { humerusFold, forearmFold
//     (degrees, folded pose), digitFold: [V, IV, III, II] degrees })
// Both are pure and deterministic.

const lerp = (a, b, t) => a + (b - a) * t;
const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/** A FEATHERED wing as data for wing.js (vanes): tertials on the humerus, secondaries on the ulna, primaries on the
 * hand (the outer ones emarginated into slots), greater and lesser covert rows over them, seeded tones. The
 * defaults are a broad soaring wing of ~2.5 m span (griffon); a second bird passes its own numbers. */
export function featherWing({ arm = [0.2, 0.29, 0.2], tertials = 3, secondaries = 16, primaries = 10, secLen = 0.44, primLen = 0.5, primReach = 0.16,
  slotFrom = 0.35, slotBy = 0.55, width = 0.085, tertialLen = 1, tertialWidth = 1, boneR = 1 } = {}) {
  const rays = []; const add1 = (o) => rays.push(o);
  for (let k = 0; k < tertials; k++) add1({ kind: 'tertial', bone: 0, at: 0.55 + 0.2 * k, angle: 100, foldAngle: 5, len: (0.3 + 0.03 * k) * tertialLen, width: 0.1 * tertialWidth, layer: 0.012 - 0.002 * k, group: 'Flight' });
  const S = secondaries - 1;
  for (let k = 0; k < secondaries; k++) add1({ kind: 'secondary', bone: 1, at: 0.03 + 0.97 * k / S, angle: 98 - 3 * (k / S), foldAngle: 176, len: secLen + 0.03 * Math.sin(Math.PI * k / S), width, layer: 0.004 * (S - k) / S, group: 'Flight' });
  for (let k = 0; k < primaries; k++) { const t = k / (primaries - 1); add1({ kind: 'primary', bone: 2, at: 0.1 + 0.9 * t, angle: lerp(95, 8, t ** 0.9), foldAngle: 4, len: primLen + primReach * Math.sin(Math.PI * Math.min(1, t * 1.15)), width: lerp(width, width * 0.82, t), layer: 0.006 + 0.004 * t,
    emarg: t > slotFrom ? { from: 0.45, by: slotBy } : null, group: 'Flight' }); }
  const flight = rays.filter((r) => r.kind !== 'tertial');
  for (const [row, frac, z] of [['greater', 0.42, 0.022], ['lesser', 0.22, 0.034]]) flight.forEach((r) => add1({ ...r, kind: `${row}Covert`, len: r.len * frac, width: r.width * 1.05, emarg: null, layer: z + (r.layer ?? 0), group: row === 'greater' ? 'Covert' : 'CovertLesser' }));
  const TONES = { Flight: { tones: ['FlightA', 'FlightB', 'FlightC'], under: 'FlightUnder' }, Covert: { tones: ['CovertA', 'CovertB', 'CovertC'], under: 'CovertUnder', tipGroup: 'CovertTip', tipFrom: 0.62 },
    CovertLesser: { tones: ['LesserA', 'LesserB', 'LesserC'], under: 'CovertUnder', tipGroup: 'LesserTip', tipFrom: 0.8 } };
  rays.forEach((r, i) => { const T = TONES[r.group]; const k = (i + (hash(`${r.kind}${i}`) % 5 === 0 ? 1 : 0)) % 2 + (hash(`t${r.kind}${i}`) % 7 === 0 ? 1 : 0); Object.assign(r, { tone: T.tones[k], under: T.under, ...(T.tipGroup ? { tipGroup: T.tipGroup, tipFrom: T.tipFrom } : {}) }); });
  return { girdle: 'torso', boneGroup: 'WingBone', surface: 'vanes',
    arm: [{ id: 'humerus', len: arm[0], spread: 8, folded: -80, r: [0.035 * boneR, 0.03 * boneR] }, { id: 'ulna', len: arm[1], spread: -6, folded: 168, r: [0.03 * boneR, 0.025 * boneR] }, { id: 'hand', len: arm[2], spread: -6, folded: -165, r: [0.025 * boneR, 0.015 * boneR] }],
    rays, frame: { spread: { S: [1, 0, 0.14], C: [0, 1, 0] }, folded: { S: [0.2, 0, -1], C: [0, 1, 0] } } };
}

/** A MEMBRANE wing as data for wing.js: the DRAGON_WING layout (humerus, forearm, digits V–II carrying the membrane,
 * a free thumb I), every length and radius × `k` (1 = the 4 m-span dragon), the folded pose and the frames for a
 * crawling bat. `fold` angles: the humerus back and down, the forearm forward-down to the wrist on the ground. */
export function membraneWing(k = 0.19, { humerusFold = -73, forearmFold = 143, digitFold = [176, 177, 178, 179] } = {}) {
  const r = (a) => a.map((x) => x * k);
  return { girdle: 'torso', boneGroup: 'WingBone', surface: 'membrane',
    arm: [{ id: 'wingHumerus', len: 0.55 * k, spread: 20, folded: humerusFold, r: r([0.075, 0.055]) }, { id: 'wingForearm', len: 0.85 * k, spread: -30, folded: forearmFold, r: r([0.05, 0.035]) }],
    rays: [
      { name: 'body', bone: 0, at: 0, angle: 105, foldAngle: 12, len: 1.05 * k },
      { digit: 'V', bone: 1, at: 1, angle: 78, foldAngle: digitFold[0], len: 1.25 * k, r: r([0.028, 0.012]), offset: 0.03 * k },
      { digit: 'IV', bone: 1, at: 1, angle: 52, foldAngle: digitFold[1], len: 1.55 * k, r: r([0.03, 0.012]), offset: 0.03 * k },
      { digit: 'III', bone: 1, at: 1, angle: 28, foldAngle: digitFold[2], len: 1.7 * k, r: r([0.032, 0.012]), offset: 0.03 * k },
      { digit: 'II', bone: 1, at: 1, angle: 8, foldAngle: digitFold[3], len: 1.5 * k, r: r([0.032, 0.014]), offset: 0.03 * k, claw: 0.07 * k },
      { digit: 'I', bone: 1, at: 1, angle: -35, foldAngle: -40, len: 0.16 * k, r: r([0.03, 0.02]), phalanges: 2, claw: 0.09 * k },
    ],
    membrane: { order: [0, 1, 2, 3, 4], sag: [0.22, 0.3, 0.27, 0.24], sub: 10, along: [0, 0.12, 0.28, 0.46, 0.66, 0.84, 1], thickness: 0.007 * k, root: 3, bone: 0.03 * k,
      groups: { top: 'MembraneBack', under: 'MembraneUnder', rim: 'MembraneRim', vein: 'Vein' }, veins: { every: 3, r: 0.009 * k, to: 0.8 } },
    // spread: the wing plane level, out to the side; folded: the plane standing down the flank (span axis down and a
    // little out, chord axis forward)
    frame: { spread: { S: [1, 0, -0.17], C: [0, 1, -0.12] }, folded: { S: [0.35, 0, -1], C: [0, 1, 0] } } };
}
