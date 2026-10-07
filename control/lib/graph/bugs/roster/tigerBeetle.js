// GREEN TIGER BEETLE (Cicindela campestris). Thesis: a LONG-LEGGED SPRINTER held high off the ground on slender legs
// (the hind leg about as long as the body) · a HEAD WIDER THAN THE PRONOTUM, its bulging eyes the widest point at the
// front · big pale SICKLE MANDIBLES crossing in front, toothed · a narrow, almost square pronotum · a flat parallel-sided
// elytral shield, metallic green with small cream spots (one on the disc, the rest along the margin) · slender
// thread antennae about half the body · bronze legs · 12–16 mm (Wikipedia "Cicindela campestris"; Luff, The
// Carabidae (ground beetles) of Britain and Ireland, RES Handbook 4/2, 2007).
export const bug = {
  order: 'Coleoptera', name: 'a green tiger beetle', length: 0.014, clearance: 0.22,
  head: { form: 'prognathous', len: 0.14, w: 0.115, h: 0.075, pitch: -10, r0: 0.8, peak: 0.45, r1: 0.6, p: 0.8, q: 0.8, overlap: 0.15 },
  trunk: { form: 'shield', len: 0.27, w: 0.08, h: 0.075, split: [0.45, 0.27, 0.28], r0: 0.9, peak: 0.5, r1: 0.85 },
  pronotum: { from: 0, to: 0.45, w: 1.1, h: 1.1 },
  tail: { form: 'flat', len: 0.48, w: 0.15, h: 0.08, segments: 5, r0: 0.8, peak: 0.45, r1: 0.4, p: 0.7, q: 0.8 },
  legs: { form: 'runner', reach: 1.0, thick: 1.0, angles: { coxa: -40, femur: 20, tibia: -62, tarsus: -6 }, fore: { yawOver: 30, angles: { femur: 10 } }, hind: { reach: 1.2 } },
  antennae: { form: 'filiform', len: 0.5, r: 0.006, rise: 30, yaw: 30, curve: 25 },
  mouth: { form: 'mandibles', len: 0.26, r: 0.035, shape: 'banana', flat: 0.7, bend: 0.6, spread: 28, pitch: -8, teeth: [{ at: 0.3, len: 1.4 }, { at: 0.5, len: 1.1 }] },
  eyes: { form: 'large', size: 0.6, at: 0.55, elev: 22, bulge: 1.0, depth: 0.75 },
  wings: { pairs: [{ form: 'elytra', len: 0.58, w: 1.25, h: 1.2, r0: 0.85, peak: 0.45, r1: 0.35, p: 0.6, q: 0.9, seam: 0.4, lift: 0.2, stations: 16, slots: 'ring20' }] },
  colors: { body: '#2c6b34', head: '#33803d', pronotum: '#33803d', tail: '#2c6b34', elytra: '#3a8a44', legs: '#8c5a3c', mouth: '#e6dcb8', antennae: '#7a4e34', eyes: '#2a2a22' },
  markings: [
    { on: 'elytron', kind: 'spots', spots: [[0.1, 0.4, 0.12, 0.12], [0.45, 0.15, 0.1, 0.1], [0.5, 0.5, 0.1, 0.12], [0.88, 0.3, 0.12, 0.12]], group: 'Spot', color: '#ece4c4' },
  ],
};
