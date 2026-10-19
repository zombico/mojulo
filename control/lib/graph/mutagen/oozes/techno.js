// TECHNO: the animal built, not born. Every surface gunmetal with dark seams across the trunk, a cyan light ring round
// each limb and the eyes, a row of fins down the back, ears drawn into sharp sensor blades. Its own limbs and rig: a
// machine in the animal's shape.
export const ooze = {
  id: 'techno',
  about: 'a machine in the animal\'s shape: gunmetal plates and seams, glowing rings at the limbs, fins, sensor ears, cyan eyes',
  push: {
    limbs: { paws: 1.2 },
    ears: { height: 1.2, sweep: 0.8 },
    hackles: { count: 4, height: 0.35, lean: 0.25, color: '#2b3036' },
    desaturate: 1,
    tint: { color: '#8b939c', amount: 0.85, light: 0.7 },
    marks: [
      { on: 'torso', kind: 'stripes', run: [0.1, 0.95], count: 3, width: 0.18, group: 'Seam', color: '#22262b' },
      { on: 'legs', kind: 'band', run: [0, 0.14], group: 'Glow', color: '#3ff0ff', glow: true },
    ],
    eyes: { color: '#40f0ff', glow: true, open: 1.2 },
    surfaces: { '*': 'gunmetal' },
  },
};
