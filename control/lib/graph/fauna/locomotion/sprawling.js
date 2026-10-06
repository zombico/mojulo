// Q-sprawl — the sprawlers: crocodile, platypus, and the monitor lizard (a species of the snake family, in axial.js,
// that overrides its rig to this one). The upper arm and thigh stick out sideways, the elbow and knee bend down to the
// ground, and the feet swing in wide arcs. The SPINE does much of the work: a standing wave bends the body side to
// side, its nodes at the shoulders and hips, lengthening each stride. The crocodile can also lift into a HIGH WALK
// with the legs under it, and small crocodiles gallop.
export const RIG = {
  id: 'sprawling', name: 'sprawling',
  legs: ['LF', 'RF', 'LH', 'RH'],
  chain: { fore: ['shoulder', 'elbow', 'carpus', 'forePaw', 'foreToe'], hind: ['hip', 'stifle', 'hock', 'hindPaw', 'hindToe'] },
  stance: 'sprawling',
};

export const FAMILIES = {
  crocodilian: {
    spine: { trunk: 4, neck: 1, tail: 6 },
    gaits: {
      crawl:  { pattern: 'lateralWalk', duty: 0.8, stride: 1.2, fr: [0, 0.2], sprawl: 1, bellyDrag: true },
      walk:   { pattern: 'trot', duty: 0.6, stride: 1.4, fr: [0, 0.4], sprawl: 0.4, highWalk: true },
      // disputed: big adults rarely gallop (young crocodiles do); the gallop is kept as the more visual reading
      gallop: { pattern: 'bound', duty: 0.3, stride: 2.4, fr: [0.4, 3] },
      swim:   { pattern: 'tailDrive', limbsTucked: true },
    },
    axial: { flex: 0.2, lateral: 0.5, wave: 'standing', roll: 0.1, yaw: 0.35, head: 'steady', tail: 'trail' },
    note: 'belly-crawls with the legs sprawled, or lifts into the high walk; bursts into a bounding gallop; swims by sweeping the tail, legs tucked back',
    source: 'Zug 1974 (crocodilian galloping); Reilly & Elias 1998 (alligator sprawling and high walk)',
  },
  monotreme: {
    spine: { trunk: 3, neck: 1, tail: 2 },
    gaits: {
      crawl: { pattern: 'lateralWalk', duty: 0.75, stride: 0.9, fr: [0, 0.3], sprawl: 0.6, knuckles: true },
      swim:  { pattern: 'forelimbRow' },
    },
    axial: { flex: 0.1, lateral: 0.3, wave: 'standing', roll: 0.3, yaw: 0.25, head: 'steady', tail: 'still' },
    note: 'sprawls on land on its knuckles; swims by rowing with the big webbed fore paddles, hind feet steering',
    source: 'Fish et al. 1997 (platypus swimming), 2001 (platypus walking)',
  },
};
