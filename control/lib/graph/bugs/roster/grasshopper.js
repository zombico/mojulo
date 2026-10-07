// DIFFERENTIAL GRASSHOPPER (Melanoplus differentialis). Thesis: a long body with a face-down head and a SADDLE
// pronotum over the thorax · HUGE hind legs: drumstick femurs along the flank, the tibia folded under, the knee high
// behind the body · short thread (filiform) antennae · leathery forewings (tegmina) laid along the back past the abdomen
// · olive-yellow, black chevrons on the hind femur · 28–44 mm (Capinera, Field Guide to Grasshoppers).
export const bug = {
  order: 'Orthoptera', name: 'a differential grasshopper', length: 0.038, clearance: 0.045,
  head: { form: 'hypognathous', len: 0.17, w: 0.07, h: 0.085, pitch: -80 },
  trunk: { form: 'saddle', len: 0.26 },
  pronotum: { from: 0, to: 0.55, w: 1.12, h: 1.12, drop: 0.12 },
  tail: { form: 'tapered', len: 0.52, w: 0.07, h: 0.075, segments: 8, pitch: 0 },
  legs: { form: 'walker', reach: 0.6, hind: { form: 'jumper', reach: 1.05, yaw: -84, femur: { r: 0.065, flat: 0.75 }, angles: { tibia: -25 } } },
  antennae: { form: 'filiform', len: 0.24, rise: 28, curve: 8 }, mouth: 'mandibles', eyes: { form: 'compound', size: 0.36, at: 0.35, elev: 20 },
  wings: { pose: 'roof', poseOver: { roll: -32, sweep: 84, dihedral: -1 }, pairs: [{ form: 'tegmen', len: 0.58, chord: 0.09 }] },
  colors: { body: '#8a8a3c', head: '#9a9445', trunk: '#8a853b', pronotum: '#7c7a36', tail: '#a59c4e', legs: '#8f8a40', tegmen: '#7a7337', eyes: '#3b3420' },
};
