// VENOM: the animal of the poison. Its coat gone a dark wet green, acid spots glowing on its back and a glowing belly,
// a row of barbs, long venom fangs and eyes of acid. An element: it lays over any form; its bite carries poison.
export const ooze = {
  id: 'venom',
  about: 'of the poison: a dark green coat, glowing acid spots and belly, a row of barbs, long fangs, acid eyes',
  element: 'poison',
  push: {
    desaturate: 0.3,
    tint: { color: '#1f3a22', amount: 0.5, light: 0.5 },
    hackles: { count: 8, height: 0.35, lean: 0.6, color: '#9cff3a', glow: true },
    marks: [
      { on: 'torso', kind: 'spots', count: 12, size: [0.06, 0.12], t: [0, 0.6], group: 'Acid', color: '#9cff3a', glow: true },
      { on: 'torso', kind: 'belly', from: 0.7, group: 'AcidBelly', color: '#c4ff5a', glow: true },
    ],
    fangs: 2.4,
    eyes: { color: '#e6ff3a', glow: true },
    motif: 'toxin',
  },
};
