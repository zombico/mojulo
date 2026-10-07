// ARIZONA BARK SCORPION (Centruroides sculpturatus). Thesis: a low flat body of a fused front (prosoma: a carapace as
// wide as long, widest behind) and seven broad plates (mesosoma) on eight sprawled walking legs, the knees just over
// the back · long PINCER pedipalps held forward and low, each a swollen palm and two open fingers · the five-segment
// TAIL (metasoma) rising steeply and curled forward over the back, a bulb and a curved sting at its end ·
// straw-yellow · 70–80 mm with the tail; about 35 mm without (Stockwell, Scorpions of the Southwest). The pincers and
// the curled tail carry the silhouette.
export const bug = {
  order: 'Scorpiones', name: 'a bark scorpion', length: 0.035, clearance: 0.05,
  head: 'fused',
  trunk: { form: 'prosoma', len: 0.34, w: 0.15, h: 0.075, r0: 0.95, peak: 0.25, r1: 0.6 },
  tail: { form: 'mesosoma', len: 0.66, w: 0.16, h: 0.07, r0: 0.92, peak: 0.4, r1: 0.45 },
  legs: { form: 'spider', reach: 0.7, thick: 0.95, socket: -30, each: [28, 2, -22, -48].map((yaw) => ({ yaw, angles: { coxa: -25, femur: 35, tibia: -60, tarsus: -28 } })) },
  palps: { form: 'cheliped', reach: 1, thick: 1, yaw: 45, femur: { len: 0.22, r: 0.03 }, tibia: { len: 0.2, r: 0.032 },
    chela: { palm: 0.19, r: 0.07, flat: 0.75, finger: 0.2, fr: 0.028, gape: 24 }, angles: { coxa: -20, femur: 20, tibia: 10, tarsus: 0 } },
  antennae: null, mouth: 'none', eyes: { form: 'simple', count: 2, size: 0.12, at: 0.6, elev: 70 },
  extras: [{ kind: 'metasoma', len: 1.05, r: 0.056, segs: 5, rise: 50, curl: 32, sting: 0.12 }],
  colors: { body: '#c2a058', legs: '#cfae68', claws: '#b48a46', sting: '#4a3018' },
};
