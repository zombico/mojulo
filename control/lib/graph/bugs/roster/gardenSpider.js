// EUROPEAN GARDEN SPIDER female (Araneus diadematus). Thesis: TWO body parts — a small flat cephalothorax carrying
// eight long thick legs with high knees, and a big round abdomen behind, with a white cross on its back · eight small
// eyes on the front · short pedipalps and fangs at the front · no antennae, no wings · brown-orange · 10–20 mm body
// (Roberts, Spiders of Britain and Northern Europe).
export const bug = {
  order: 'Araneae', name: 'a garden spider', length: 0.015, clearance: 0.12,
  head: 'fused', trunk: { form: 'cephalothorax', len: 0.46, w: 0.18, h: 0.1 }, tail: { form: 'sac', len: 0.5, w: 0.27, h: 0.28, r0: 0.7, peak: 0.27, r1: 0.25, p: 0.6, q: 0.7, pitch: 10, overhang: 0.05, lift: 0.1 },
  legs: { form: 'spider', reach: 1.05, thick: 1.25, socket: -15, each: [{ reach: 1.15 }, { reach: 1.05 }, { reach: 0.8 }, { reach: 1, yaw: -38 }] },
  palps: { reach: 0.9 }, antennae: null, mouth: 'fangs', eyes: 'simple',
  colors: { body: '#7a4f2a', trunk: '#6a4426', tail: '#8a5a2c', legs: '#6e4826', eyes: '#141210' },
  markings: [{ on: 'tail', kind: 'band', run: [0.18, 0.72], t: [0, 0.1], group: 'Cross', color: '#eee2c6' }, { on: 'tail', kind: 'band', run: [0.4, 0.51], t: [0, 0.45], group: 'Cross' }],
};
