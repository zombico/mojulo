// COCKCHAFER / MAY BUG male (Melolontha melolontha). Thesis: a stout ELONGATE barrel of a beetle, about 0.4 as wide as
// long, domed · a small black head tipped down, carrying the male's big FAN antennae (seven long leaves, held spread
// forward) · a black, short, rounded pronotum · chestnut-brown elytra that stop SHORT of the tail, leaving the
// abdomen's end bare: a long, tapering, down-bent PYGIDIUM sticking out behind · a row of WHITE TRIANGLES along each
// flank of the abdomen below the elytra's edge · brownish walking legs of middling length · 25–30 mm (Wikipedia,
// "Common cockchafer"; Harde, A Field Guide in Colour to Beetles, 1984).
export const bug = {
  order: 'Coleoptera', name: 'a cockchafer', length: 0.028, clearance: 0.1,
  head: { form: 'prognathous', len: 0.13, w: 0.085, h: 0.07, pitch: -30, lift: -0.01, r0: 0.85, peak: 0.4, r1: 0.5, p: 0.8, q: 0.8, overlap: 0.25 },
  trunk: { form: 'shield', len: 0.26, w: 0.15, h: 0.12, split: [0.45, 0.27, 0.28], belly: 0.7 },
  pronotum: { from: 0, to: 0.5, w: 1.12, h: 1.08 },
  tail: { form: 'flat', len: 0.64, w: 0.17, h: 0.13, segments: 6, dip: 0.05, r0: 0.95, peak: 0.3, r1: 0.1, p: 0.8, q: 2.0, pitch: -4, belly: 0.75 },
  legs: { form: 'walker', reach: 0.8, thick: 1.4, yaw: [45, -12, -45] },
  antennae: { form: 'lamellate', len: 0.12, r: 0.008, rise: 30, yaw: 35, curve: 5, plates: { count: 7, len: 0.13, w: 0.03 } },
  mouth: { form: 'mandibles', len: 0.03 },
  eyes: { form: 'small', size: 0.3, at: 0.55, elev: 5 },
  wings: { pairs: [{ form: 'elytra', len: 0.52, w: 1.0, h: 0.95, r0: 0.95, peak: 0.35, r1: 0.55, p: 0.7, q: 0.8, seam: 0.4, lift: 0.3 }] },
  colors: { body: '#1d1712', head: '#1a1512', pronotum: '#1d1712', trunk: '#2a201a', tail: '#3b2c22', elytra: '#8b5a2b', legs: '#6b4426', antennae: '#6b4426', mouth: '#2a201a', eyes: '#0d0b0a' },
  markings: [{ on: 'tail', kind: 'spots', spots: [[0.12, 0.64, 0.08, 0.2], [0.27, 0.64, 0.08, 0.2], [0.42, 0.64, 0.08, 0.2], [0.57, 0.64, 0.08, 0.2], [0.72, 0.64, 0.08, 0.2]], group: 'Triangle', color: '#e9e4d6' }],
};
