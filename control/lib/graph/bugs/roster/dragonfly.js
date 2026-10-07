// COMMON GREEN DARNER (Anax junius), perched. Thesis: a LONG thin abdomen (two thirds of the body) behind a deep
// slanted thorax · a big round head that is nearly all eye · two pairs of long clear wings held flat out to the sides ·
// tiny bristle antennae · short legs bunched forward · green thorax, blue abdomen · 68–80 mm, wingspan to 116 mm
// (Paulson, Dragonflies and Damselflies of the East).
// BUILT AS: the thorax pitched up 35° (`pitch`), its first segment the long one so the wing roots sit back on its top,
// the legs socketed forward (`at`) under the head.
export const bug = {
  order: 'Odonata', name: 'a green darner', length: 0.076, clearance: 0.03,
  head: { form: 'globe', len: 0.085, w: 0.085, h: 0.07 },
  trunk: { form: 'slanted', len: 0.15, w: 0.045, h: 0.06, pitch: 35, split: [0.45, 0.3, 0.25] },
  tail: { form: 'long', len: 0.72, w: 0.022, h: 0.022, pitch: 3, r0: 1.35, peak: 0.1 },
  extras: [{ kind: 'cerci', len: 0.06, r: 0.006, spread: 12, rise: 4 }],
  legs: { form: 'walker', reach: 0.4, thick: 0.5, socket: -62,
    fore: { at: 0.12, yaw: 62, angles: { coxa: -60, femur: 25, tibia: -72, tarsus: -4 } }, mid: { at: 0.3, yaw: 38, angles: { coxa: -60, femur: 25, tibia: -72, tarsus: -4 } }, hind: { at: 0.48, yaw: 12, angles: { coxa: -60, femur: 25, tibia: -72, tarsus: -4 } } },
  antennae: { form: 'setaceous', len: 0.045 }, mouth: { form: 'mandibles', len: 0.02 }, eyes: { form: 'holoptic', size: 1.05, depth: 0.75, elev: 52, at: 0.5 },
  wings: { pose: 'spread', pairs: [{ form: 'narrow', len: 0.68, chord: 0.12, r0: 0.45, peak: 0.45, r1: 0.4, p: 0.6, q: 0.5, lead: 0.3, poseOver: { sweep: -6 } },
    { form: 'narrow', len: 0.64, chord: 0.17, r0: 0.75, peak: 0.18, r1: 0.4, p: 0.6, q: 0.7, lead: 0.3, poseOver: { sweep: 6 } }] },
  colors: { body: '#2f6a3a', trunk: '#4d8a3c', tail: '#3a6fa8', legs: '#1c1c1a', eyes: '#4f6f7c', wing: '#dfe6e6' },
};
