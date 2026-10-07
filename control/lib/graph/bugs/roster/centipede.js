// BROWN CENTIPEDE (Lithobius forficatus). Thesis: a flat ribbon of FIFTEEN leg-bearing plates, one pair of legs each,
// the legs splayed out to the sides and lengthening toward the back, the last pair longest and trailing · a flat head
// with thread antennae and poison claws (forcipules) curving under it · chestnut brown · 18–30 mm (Lewis, The Biology
// of Centipedes).
// the walking legs lengthen toward the back (pairs 0–13), the 15th pair trails
const REACH = Array.from({ length: 14 }, (_, j) => ({ reach: Number((1.35 + (0.75 * j) / 13).toFixed(3)) }));
export const bug = {
  order: 'Chilopoda', name: 'a brown centipede', length: 0.025, clearance: 0.03759,
  head: { form: 'prognathous', len: 0.07, w: 0.062, h: 0.02, pitch: 0, r0: 0.85, peak: 0.45, r1: 0.6 },
  // Lithobius' long and short back plates alternate (heterotergy)
  trunk: { form: 'centipede', w: 0.066, h: 0.022, dip: 0.35, split: [1, 0.8, 1.15, 0.8, 1.15, 0.8, 1.15, 1.15, 0.8, 1.15, 0.8, 1.15, 0.8, 1.15, 0.8] }, tail: 'telson',
  legs: { form: 'manyfoot', fore: { yaw: [30, -42], angles: { tibia: -40 } }, mid: { yaw: [30, -42], angles: { tibia: -40 } }, each: REACH, hind: { reach: 2.8, yaw: -150, angles: { coxa: -10, femur: 10, tibia: -10, tarsus: -5 } } },
  antennae: { form: 'moniliform', len: 0.4, r: 0.006, yaw: 30, rise: 10, curve: 35, flare: 20 }, mouth: { form: 'forcipules', len: 0.075, spread: 32, pitch: -12, bend: 0.55, toward: [-0.6, 0, -1] }, eyes: { form: 'small', size: 0.25 },
  colors: { body: '#7a3a18', head: '#6a3216', legs: '#9a5a2c', antennae: '#8a4a22' },
};
