// CARIBBEAN SPINY LOBSTER (Panulirus argus). Thesis: a lobster with NO CLAWS — the silhouette is carried instead by
// the two huge SECOND ANTENNAE: thick spiny stalks (the peduncle as stout as a walking leg's merus) running forward
// and out in a wide V, the whips longer than the whole body · a pair of stout forward-pointing HORNS (the supraorbital
// spines) over the eyes, the eyes small on short stalks beneath them, no long rostrum · a spiny CYLINDRICAL carapace
// a little under half the body, then a broad segmented muscular TAIL (six rings) held straight out, ending in a wide
// TAIL FAN · five pairs of slender walking legs, all ending in simple pointed dactyls (the first pair stoutest), the
// body carried a little higher than a clawed lobster's · reddish to tan-brown, the tail with cream spots. Size: total
// body length commonly ~20 cm, up to 45 cm (Holthuis 1991, FAO Species Catalogue vol. 13 "Marine Lobsters of the
// World", Panulirus argus); adults in the fishery typically 20–30 cm. Here `length` is the carapace front to the sixth
// tail ring (0.27 m); the fan adds ~0.03 m, the antennae ~1.3× the body more. Not a clawed lobster (no chelae), not a
// shrimp (the antennae are thick and armoured, the carapace cylindrical), not a slipper lobster (no flat plates).
export const bug = {
  order: 'Achelata', name: 'a Caribbean spiny lobster', length: 0.27, clearance: 0.06,
  head: 'fused',
  trunk: { form: 'cylinder', len: 0.42, w: 0.13, h: 0.14, r0: 0.6, peak: 0.6, r1: 0.85, p: 0.6, q: 0.8, belly: 0.8 },
  tail: { form: 'muscle', len: 0.58, w: 0.12, h: 0.085, segments: 6, dip: 0.16, r0: 0.95, peak: 0.15, r1: 0.62, p: 1, q: 0.8, pitch: -3 },
  legs: {
    form: 'crabwalker', socket: -60,
    femur: { len: 0.17, r: 0.02, flat: 0.7, thin: 'plane' }, tibia: { len: 0.16, r: 0.016 }, tarsus: { len: 0.11, r: 0.012, end: 0.15 }, tarsi: 2,
    angles: { coxa: -15, femur: 30, tibia: -45, tarsus: -60 },
    fore: { femur: { len: 0.19, r: 0.025 }, tibia: { len: 0.15, r: 0.02 } },
    each: [{ at: 0.42, yaw: 50 }, { at: 0.54, yaw: 28 }, { at: 0.65, yaw: 6 }, { at: 0.76, yaw: -18 }, { at: 0.87, yaw: -42 }],
  },
  // the second antennae: a stout spiny peduncle (a third of the length) then the whip, forward and out
  antennae: { form: 'peduncle', len: 1.3, r: 0.03, segs: 20, scape: 0.12, shape: [[0, 1.3], [0.3, 0.9], [0.32, 0.5], [1, 0.12]], at: 0.9, socket: 25, gap: 0.06, rise: 14, yaw: 40, curve: 14, flare: 12 },
  // the supraorbital horns: a raised spike either side over the eyes (a palp: the coxa up the side, the spike forward)
  palps: { form: 'palp', yaw: 80, coxa: { len: 0.16, r: 0.01, end: 0.9 }, femur: { len: 0.085, r: 0.018, end: 0, shape: 'carrot' }, tibia: { len: 0.004, r: 0.002 }, tarsus: null,
    angles: { coxa: 76, femur: 22, tibia: 22, tarsus: 0 } },
  mouth: 'none',
  eyes: { form: 'stalked', stalk: 0.25, size: 0.1, at: 0.95, elev: 35, yaw: 30, rise: 35 },
  extras: [{ kind: 'fan', len: 0.17, r: 0.12 }],
  colors: { body: '#7a4428', legs: '#a8743c', claws: '#a8743c', eyes: '#141410', antennae: '#6e3a22' },
};
