// CARPENTER ANT major worker (Camponotus pennsylvanicus). Thesis: three beads on a string — a big heart-shaped head
// with strong mandibles, a slim arched thorax, a one-node waist (petiole), a round gaster · ELBOWED antennae as long as
// the head and thorax · long walking legs · no wings · glossy black · 6–13 mm (Hansen & Klotz, Carpenter Ants of the
// United States and Canada).
export const bug = {
  order: 'Formicidae', name: 'a carpenter ant worker', length: 0.012, clearance: 0.07,
  head: { form: 'prognathous', len: 0.27, w: 0.125, h: 0.095, pitch: -14, lift: 0.02, r0: 0.85, peak: 0.3, r1: 0.55, q: 1.2 },
  trunk: { form: 'slim', len: 0.32, h: 0.07, arch: 0.045 },
  tail: { form: 'gaster', len: 0.36, w: 0.125, h: 0.11, peak: 0.42, r1: 0.3, q: 0.9 },
  legs: { form: 'walker', reach: 1.35, thick: 0.9 },
  antennae: { form: 'geniculate', len: 0.55, yaw: 50, rise: 45, elbow: { at: 1, deg: 60, flare: -55 } },
  mouth: { form: 'mandibles', len: 0.1, r: 0.022 }, eyes: { form: 'small', size: 0.18, at: 0.55, elev: 10 },
  colors: { body: '#15120f', legs: '#1b1612', eyes: '#2a2620' },
};
