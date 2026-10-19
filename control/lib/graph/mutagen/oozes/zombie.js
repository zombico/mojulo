// ZOMBIE: the animal dead and still walking. Wasted (the trunk drawn in, the hindquarters most), its coat greyed and gone
// toward the green of rot, wounds and bare bone in seeded patches, the ears laid down, the jaw slack and the eyes a
// sick pale glow.
export const ooze = {
  id: 'zombie',
  about: 'rotting and undead: wasted, grey-green, open wounds and bare ribs, drooping ears, a slack jaw and a sick glow',
  form: { bulk: 0.88, tailBush: 0.6 },
  push: {
    wedge: { fore: 0.95, hind: 0.82 },
    ears: { drop: 45, height: 0.9 },
    desaturate: 0.6,
    tint: { color: '#6d7a55', amount: 0.45, light: 0.6 },
    marks: [
      { on: 'torso', kind: 'spots', count: 9, size: [0.12, 0.22], group: 'Wound', color: '#3d2424' },
      { on: 'torso', kind: 'stripes', run: [0.6, 0.86], t: [0.4, 0.66], count: 3, width: 0.5, group: 'Bone', color: '#d7cdb1' },
      { on: 'legs', kind: 'spots', count: 3, size: [0.2, 0.35], group: 'Wound', color: '#3d2424' },
    ],
    eyes: { color: '#cfff7a', glow: true },
    expression: { jawOpen: 20, cornerRetract: 0.3 },
  },
};
