// GREEN SHIELD BUG (Palomena prasina). Thesis: a flat broad SHIELD from above, widest at the shoulders, about 0.55 as
// wide as long · a small flat triangular head set into a trapezoid PRONOTUM with rounded shoulders · a big triangular
// scutellum, the hemelytra folded flat on the back, their brown membrane tips overlapping at the rounded rear · low,
// the back only gently domed · five-segment antennae about half the body · the beak (rostrum) folded back under the
// chest · short walking legs splayed under the rim · bright green · 12–14 mm (Southwood & Leston, Land and Water Bugs
// of the British Isles, 1959; britishbugs.org.uk).
export const bug = {
  order: 'Hemiptera', name: 'a green shield bug', length: 0.013, clearance: 0.05,
  head: { form: 'prognathous', len: 0.15, w: 0.1, h: 0.04, pitch: -10, r0: 0.9, peak: 0.25, r1: 0.45, p: 0.8, q: 0.9, overlap: 0.3 },
  trunk: { form: 'shield', len: 0.3, w: 0.2, h: 0.08, r0: 0.95, peak: 0.25, r1: 0.5 },
  pronotum: { from: 0, to: 0.62, w: 1.62, h: 1.2 },
  tail: { form: 'flat', len: 0.5, w: 0.25, h: 0.07, segments: 5, r0: 1, peak: 0.08, r1: 0.32, p: 0.8, q: 1 },
  scutellum: { len: 0.4, w: 0.14, h: 0.015, lift: 1.18 },
  legs: { form: 'walker', reach: 0.55, thick: 1.3 },
  antennae: { form: 'filiform', len: 0.44, segs: 5, r: 0.009, rise: 15, yaw: 35, curve: 15 },
  mouth: { form: 'beak', len: 0.3, r: 0.01, pitch: -165 },
  eyes: { form: 'small', size: 0.25, at: 0.45, elev: 10 },
  wings: { pairs: [{ form: 'elytra', len: 0.62, w: 1.08, h: 1.05, r0: 0.95, peak: 0.12, r1: 0.3, p: 0.7, q: 1, seam: 0.3 }] },
  colors: { body: '#4f8a2b', head: '#58962f', pronotum: '#5a9a30', scutellum: '#7cba48', trunk: '#4f8a2b', tail: '#4a7f28', elytra: '#4f8a2b', legs: '#5f8f3a', antennae: '#567a30', mouth: '#4a6a2a', eyes: '#3a2a1c' },
  markings: [{ on: 'elytron', kind: 'band', run: [0.8, 1], group: 'Membrane', color: '#5b4a2e' }],
};
