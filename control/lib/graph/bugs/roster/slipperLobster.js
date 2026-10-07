// MEDITERRANEAN SLIPPER LOBSTER (Scyllarides latus). Thesis: a lobster with NO CLAWS and NO WHIPS — a BROAD, FLAT,
// armoured body, much wider than deep, like a paving stone with a tail: a squarish flattened CARAPACE with sharp
// side edges, the small eyes set in sockets at its front corners · the second antennae reduced to short, broad, FLAT
// PLATES held out in front of the face (two lobes a side, a scalloped shovel spread level with the carapace) · a
// broad flat segmented TAIL (six rings, the side plates making it as wide as the carapace) ending in a wide TAIL FAN ·
// five pairs of short walking legs tucked under the edge, the body carried close to the ground · brown to reddish-brown,
// blotched. Size: up to 45 cm total length, adults commonly ~30 cm (Holthuis 1991, FAO Species Catalogue vol. 13
// "Marine Lobsters of the World", Scyllarides latus). Here `length` is the carapace front to the sixth tail ring
// (0.27 m); the fan adds ~0.03 m and the antennal plates ~0.04 m in front. Not a spiny lobster (no long antennae), not
// a clawed lobster (no chelae), not a crab (the tail is out behind, not tucked), not a woodlouse (the fan and plates).
export const bug = {
  order: 'Achelata', name: 'a Mediterranean slipper lobster', length: 0.27, clearance: 0.05,
  head: 'fused',
  trunk: { form: 'cylinder', len: 0.42, w: 0.3, h: 0.075, r0: 0.95, peak: 0.6, r1: 0.8, p: 0.35, q: 0.4, belly: 0.55, samples: 10 },
  tail: { form: 'muscle', len: 0.58, w: 0.235, h: 0.05, segments: 6, dip: 0.12, r0: 0.95, peak: 0.12, r1: 0.82, p: 0.6, q: 0.6, pitch: -2, belly: 0.6 },
  legs: {
    form: 'crabwalker', socket: -55,
    coxa: { len: 0.04, r: 0.022, end: 0.8 }, femur: { len: 0.09, r: 0.018, flat: 0.6, thin: 'plane' }, tibia: { len: 0.085, r: 0.014 }, tarsus: { len: 0.06, r: 0.011, end: 0.15 }, tarsi: 2,
    angles: { coxa: 0, femur: 10, tibia: -80, tarsus: -55 },
    each: [{ at: 0.3, yaw: 45 }, { at: 0.45, yaw: 25 }, { at: 0.6, yaw: 5 }, { at: 0.74, yaw: -18 }, { at: 0.88, yaw: -40 }],
  },
  // the second antennae: a short stout stalk, then broad flat plates spread level in front of the face
  antennae: { form: 'lamellate', len: 0.05, r: 0.02, segs: 2, shape: [[0, 1.2], [1, 1]], at: 0.95, socket: 45, gap: 0.035, rise: -6, yaw: 12, curve: 0, flare: 0,
    plates: { count: 2, len: 0.16, w: 0.4 } },
  mouth: 'none',
  eyes: { form: 'stalked', stalk: 0.08, size: 0.09, at: 0.92, elev: 40, yaw: 50, rise: 30 },
  extras: [{ kind: 'fan', len: 0.15, r: 0.13 }],
  colors: { body: '#7a4a2e', legs: '#9a6a3c', claws: '#9a6a3c', eyes: '#141410', antennae: '#86522f' },
};
