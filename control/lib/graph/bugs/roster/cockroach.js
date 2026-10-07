// AMERICAN COCKROACH (Periplaneta americana). Thesis: a long flat oval body under a broad SHIELD pronotum that hides
// the head from above · long glossy red-brown wings over the whole abdomen · whip antennae longer than the body ·
// long spiny RUNNING legs splayed wide · two short cerci at the tail · 34–53 mm (Bell, Roth & Nalepa, Cockroaches).
export const bug = {
  order: 'Blattodea', name: 'an American cockroach', length: 0.04, clearance: 0.04004,
  head: { form: 'hypognathous', len: 0.11, w: 0.08, h: 0.065, pitch: -55, lift: 0.01, overlap: 0.35 },
  trunk: { form: 'shield', len: 0.27, w: 0.165, h: 0.06 },
  // the SHIELD: a broad oval plate from the mesothorax forward PAST the trunk's front (from < 0), roofing the head
  pronotum: { from: -0.14, to: 0.5, w: 1.35, h: 1.2, drop: -0.12 },
  tail: { form: 'oval', len: 0.55, w: 0.19, h: 0.042, pitch: -1, segments: 7, r0: 1, peak: 0.3, r1: 0.3 },
  legs: { form: 'runner', reach: 0.9, fore: { angles: { femur: 5, tibia: -35 } }, mid: { angles: { femur: 5, tibia: -35 } }, hind: { angles: { femur: 5, tibia: -35 } } },
  antennae: { form: 'whip', len: 1.2, rise: 22, curve: 28, yaw: 28 }, mouth: { form: 'mandibles', len: 0.03 }, eyes: { form: 'compound', size: 0.4 },
  // the tegmina laid flat and straight back, broad, overlapping on the midline, covering the whole abdomen
  wings: { pose: 'flat', poseOver: { sweep: 88, dihedral: -2 }, pairs: [{ form: 'tegmen', socket: 80, len: 0.72, chord: 0.36, r0: 0.7, peak: 0.4, r1: 0.25, lead: 0.35, thick: 0.01 }] },
  extras: [{ kind: 'cerci', len: 0.1, r: 0.012, spread: 25 }],
  colors: { body: '#5c2c14', pronotum: '#6b3a1c', tegmen: '#7a3e1a', legs: '#5a3018', antennae: '#4e2814', eyes: '#1a120c' },
  markings: [{ on: 'pronotum', kind: 'band', run: [0, 1], t: [0.3, 0.6], group: 'Rim', color: '#c49a5a' }],
};
