// WESTERN HONEY BEE worker (Apis mellifera). Thesis: a fuzzy compact thorax between a round face-down head and an
// oval banded abdomen as long as head + thorax · elbowed (geniculate) antennae · big kidney eyes on the sides · two
// pairs of clear wings folded flat over the back · six walking legs, the hind tibia broad (pollen basket) · amber and
// black bands · 12–15 mm (Winston, The Biology of the Honey Bee).
export const bug = {
  order: 'Hymenoptera', name: 'a honey bee worker', length: 0.0135, clearance: 0.0578,
  head: { form: 'hypognathous', len: 0.2, w: 0.095, h: 0.068, pitch: -52, lift: 0.05 },
  trunk: { form: 'compact', len: 0.3, w: 0.1, h: 0.1 },
  tail: { form: 'oval', len: 0.44, w: 0.115, h: 0.1, segments: 6, r1: 0.35, peak: 0.5, q: 0.7, pitch: -10 },
  legs: { form: 'walker', reach: 0.8, thick: 1.4, fore: { yaw: 20, femur: { len: 0.16 }, tibia: { len: 0.16 }, angles: { tibia: -64 }, tarsus: { len: 0.11 } }, mid: { angles: { tibia: -75 }, tarsus: { len: 0.13 } }, hind: { yaw: -34, angles: { tibia: -75 }, tarsus: { len: 0.14 }, tibia: { len: 0.21, r: 0.035, shape: 'bulb', r0: 0.45, peak: 0.8, end: 0.85, flat: 0.45, thin: 'plane' } } },
  antennae: { form: 'geniculate', len: 0.32, r: 0.006, rise: 65, curve: 14, elbow: { at: 1, deg: 95 } }, mouth: 'mandibles', eyes: { form: 'compound', size: 0.56, at: 0.5, elev: 8 },
  wings: { pose: 'flat', poseOver: { dihedral: 12 }, pairs: [{ form: 'membrane', len: 0.56, chord: 0.22 }, { form: 'membrane', len: 0.42, chord: 0.15, poseOver: { sweep: 62 } }] },
  extras: [{ kind: 'sting', len: 0.02, r: 0.006 }],
  colors: { body: '#3b2e1f', trunk: '#8a6a32', tail: '#c48a2a', legs: '#2a2219', eyes: '#121010', wing: '#d9dfe0' },
  markings: [{ on: 'tail', kind: 'segments', offset: 1, every: 1, from: 1.2, trim: 0, group: 'Band', color: '#2a1f15' }],
};
