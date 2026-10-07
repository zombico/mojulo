// Q-dig — the running toe-walkers: dogs and cats. Four legs of four bones each (fore shoulder>elbow>carpus>forePaw
// >foreToe, hind hip>stifle>hock>hindPaw>hindToe), heels high, the weight on the toes. Built to run: a long stride
// from a flexible back. Dogs are the trotters (the wolf covers distance at a trot); cats rarely trot and go from a
// walk or a stalk straight to the gallop. Both gallop ROTARY, with the back flexing and extending every stride.
export const RIG = {
  id: 'cursorial', name: 'running toe-walker',
  legs: ['LF', 'RF', 'LH', 'RH'],
  chain: { fore: ['shoulder', 'elbow', 'carpus', 'forePaw', 'foreToe'], hind: ['hip', 'stifle', 'hock', 'hindPaw', 'hindToe'] },
  stance: 'digitigrade',
};

export const FAMILIES = {
  canine: {
    spine: { trunk: 3, neck: 2, tail: 4 },
    gaits: {
      walk:   { pattern: 'lateralWalk', duty: 0.65, stride: 1.3, fr: [0, 0.5] },
      trot:   { pattern: 'trot', duty: 0.4, stride: 2.2, fr: [0.5, 2.5] },
      gallop: { pattern: 'rotaryGallop', duty: 0.25, stride: 3.6, fr: [2.5, 12] },
    },
    axial: { flex: 0.5, lateral: 0.05, wave: 'none', roll: 0.15, yaw: 0.2, head: 'steady', tail: 'trail' },
    note: 'trots for distance with the head low and level; the back flexes hard only in the gallop',
    source: 'Hildebrand 1965, 1977 (gait patterns); Alexander & Jayes 1983 (gait change by Froude number)',
  },
  feline: {
    spine: { trunk: 4, neck: 2, tail: 5 },
    gaits: {
      stalk:  { pattern: 'lateralWalk', duty: 0.8, stride: 0.9, fr: [0, 0.15], crouch: 0.35 },
      walk:   { pattern: 'lateralWalk', duty: 0.65, stride: 1.3, fr: [0, 0.5] },
      trot:   { pattern: 'trot', duty: 0.42, stride: 2.0, fr: [0.5, 1.8] },
      gallop: { pattern: 'rotaryGallop', duty: 0.22, stride: 4.0, fr: [1.8, 20] },
    },
    axial: { flex: 0.75, lateral: 0.05, wave: 'none', roll: 0.2, yaw: 0.25, head: 'steady', tail: 'trail' },
    note: 'a supple back: the shoulder blades roll high at the walk and the spine coils and uncoils in the gallop',
    source: 'Hildebrand 1959 (running cheetah and horse); Hildebrand 1977',
    species: {
      // the cheetah: the most spine of any runner, two flight phases a stride (gathered and extended)
      cheetah: {
        gaits: { trot: null, gallop: { duty: 0.15, stride: 7.5, fr: [1.5, 40], flights: 2 } },
        axial: { flex: 1, tail: 'counter' },
        note: 'the spine coils and springs out every stride, with two flight phases; the tail steers in turns',
      },
    },
  },
};
