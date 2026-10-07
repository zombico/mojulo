// EUROPEAN MANTIS (Mantis religiosa). Thesis: a long thin body raised at the front on a LONG neck-like prothorax · a
// triangular head that turns, big eyes at its corners · the forelegs folded up as RAPTORIAL graspers, spiny femur and
// tibia jackknifed · four long thin walking legs · leaf-green wings laid along the abdomen · 60–75 mm (Ehrmann,
// Mantodea: Gottesanbeterinnen der Welt).
// BUILT AS: the trunk is the meso- and metathorax (and the prothorax's base); the raised PROTHORAX is a real NECK
// section pitched up off the trunk's front, slim, swelling a little where the raptorial forelegs socket on it
// (`legs.fore.on: 'neck'`); the HEAD is its own small triangle on the neck's tip — wide across the eyes at its top,
// narrowing down to the mouth (a hypognathous loft with r0 high and r1 low).
export const bug = {
  order: 'Mantodea', name: 'a European mantis', length: 0.068, clearance: 0.07,
  neck: { len: 0.3, w: 0.026, h: 0.028, pitch: 45, r0: 0.8, peak: 0.85, r1: 0.85, p: 1, q: 1, overlap: 0.05 },
  head: { form: 'hypognathous', len: 0.11, w: 0.095, h: 0.04, pitch: -60, lift: 0, overlap: 0.2, r0: 1, peak: 0.12, r1: 0.35, p: 1, q: 1 },
  trunk: { form: 'long', len: 0.22, w: 0.032, h: 0.034, split: [0.24, 0.38, 0.38], r0: 0.85, peak: 0.6, r1: 0.95 },
  tail: { form: 'tapered', len: 0.5, w: 0.075, h: 0.045, segments: 8, pitch: 4, r1: 0.3 },
  legs: { form: 'runner', reach: 0.82, thick: 0.6, mid: { angles: { femur: 35, tibia: -58 } }, hind: { angles: { femur: 35, tibia: -58 } }, fore: { form: 'grasper', on: 'neck', at: 0.75, reach: 0.9, thick: 2, yaw: 80, coxa: { len: 0.18 }, femur: { len: 0.24 }, tibia: { len: 0.15 }, angles: { coxa: -85, femur: 30, tibia: -155, tarsus: -175 } } },
  antennae: { form: 'filiform', len: 0.2, r: 0.004, at: 0.25 }, mouth: { form: 'mandibles', len: 0.03 }, eyes: { form: 'large', size: 0.55, at: 0.15, elev: 0 },
  wings: { pose: 'flat', poseOver: { sweep: 84, dihedral: 3 }, pairs: [{ form: 'tegmen', len: 0.55, chord: 0.16 }] },
  colors: { body: '#6f9a3a', legs: '#7aa543', tegmen: '#86ad4c', eyes: '#a7b56a' },
};
