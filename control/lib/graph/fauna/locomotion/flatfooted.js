// Q-plant — the flat-footed: bears, raccoons, red panda, rodents, otter, chimp. The whole sole goes down, heel first,
// and rolls to the toes. The body rolls over each stance leg (the bear's swagger). The small ones run in BOUNDS,
// the back arching and stretching; the chimp walks on its knuckles with the primate DIAGONAL-sequence walk.
export const RIG = {
  id: 'flatfooted', name: 'flat-footed',
  legs: ['LF', 'RF', 'LH', 'RH'],
  chain: { fore: ['shoulder', 'elbow', 'carpus', 'forePaw', 'foreToe'], hind: ['hip', 'stifle', 'hock', 'hindPaw', 'hindToe'] },
  stance: 'plantigrade',
};

const BOUNDER = { flex: 0.8, lateral: 0.05, wave: 'none', roll: 0.1, yaw: 0.1, head: 'steady', tail: 'trail' };

export const FAMILIES = {
  ursine: {
    spine: { trunk: 3, neck: 2, tail: 1 },
    gaits: {
      walk:   { pattern: 'lateralWalk', duty: 0.7, stride: 1.2, fr: [0, 0.4], heelRoll: true },
      amble:  { pattern: 'lateralWalk', duty: 0.5, stride: 1.6, fr: [0.4, 1] },
      gallop: { pattern: 'rotaryGallop', duty: 0.3, stride: 2.6, fr: [1, 6] },
    },
    axial: { flex: 0.4, lateral: 0.1, wave: 'none', roll: 0.35, yaw: 0.2, head: 'sway', tail: 'still' },
    note: 'heel-first steps with the body rolling over each planted leg and the head swinging low; a fast amble, then a rocking gallop',
    source: 'Hildebrand 1977; Shine et al. 2015 (bear plantigrade walking)',
    species: {
      giantPanda: { gaits: { gallop: null }, note: 'a slow, rolling walk and an amble; it seldom runs' },
      wombat: { gaits: { amble: null, trot: { pattern: 'trot', duty: 0.45, stride: 1.6, fr: [0.4, 1.5] } },
        axial: { roll: 0.2, head: 'steady' }, note: 'a short-legged trot and a surprisingly fast bounding gallop' },
      koala: { gaits: { gallop: null }, axial: { roll: 0.2, head: 'steady' }, note: 'a slow walk on the ground; it bounds briefly between trees' },
    },
  },
  procyonid: {
    spine: { trunk: 4, neck: 2, tail: 4 },
    gaits: {
      walk:  { pattern: 'lateralWalk', duty: 0.7, stride: 1.2, fr: [0, 0.4], heelRoll: true },
      trot:  { pattern: 'trot', duty: 0.45, stride: 1.8, fr: [0.4, 1.5] },
      bound: { pattern: 'halfBound', duty: 0.3, stride: 2.5, fr: [1.5, 6] },
    },
    axial: { ...BOUNDER, flex: 0.6, roll: 0.25 },
    note: 'a hunched, heel-down shuffle; it breaks into a humping half-bound when it hurries',
    source: 'Hildebrand 1977',
  },
  rodent: {
    spine: { trunk: 4, neck: 1, tail: 3 },
    gaits: {
      walk:  { pattern: 'lateralWalk', duty: 0.7, stride: 1, fr: [0, 0.4] },
      bound: { pattern: 'halfBound', duty: 0.3, stride: 2.4, fr: [0.4, 6] },
    },
    axial: BOUNDER,
    note: 'scurries and bounds, the back arching and stretching',
    source: 'Hildebrand 1977',
    species: {
      // the beaver: waddles on land; swims with the webbed hind feet, the paddle tail as a rudder
      beaver: {
        gaits: { waddle: { pattern: 'lateralWalk', duty: 0.75, stride: 0.9, fr: [0, 0.3] }, walk: null,
          swim: { pattern: 'paddle' } },
        axial: { flex: 0.3, roll: 0.3, tail: 'drive' },
        note: 'waddles slowly on land; swims with the webbed hind feet, the flat tail as a rudder',
      },
      squirrel: { gaits: { bound: { pattern: 'bound', duty: 0.25 } }, axial: { tail: 'counter', tailBuild: 'fur' },
        note: 'bounds in quick arcs with pauses, the bushy tail flicking for balance' },
    },
  },
  mustelid: {
    spine: { trunk: 5, neck: 2, tail: 4 },
    gaits: {
      walk:  { pattern: 'lateralWalk', duty: 0.7, stride: 1, fr: [0, 0.4] },
      bound: { pattern: 'bound', duty: 0.3, stride: 2.8, fr: [0.4, 6] },
      swim:  { pattern: 'verticalHumps', amp: 0.08 },
    },
    axial: { ...BOUNDER, flex: 1 },
    note: 'the long back humps into an inchworm arch in every bound; it swims by waving the body and tail up and down',
    source: 'Hildebrand 1977; Fish 1994 (otter swimming)',
    species: {
      meerkat: { gaits: { swim: null, bound: null, walk: { pattern: 'lateralWalk', duty: 0.7, stride: 0.8, fr: [0, 0.4] } },
        axial: { flex: 0.2, head: 'steady', tail: 'prop' }, note: 'stands sentinel upright on its haunches, the tail a prop; drops to all fours to run' },
    },
  },
  primate: {
    spine: { trunk: 3, neck: 2, tail: 0 },
    gaits: {
      walk:    { pattern: 'diagonalWalk', duty: 0.7, stride: 1.2, fr: [0, 0.4], knuckles: true },
      upright: { pattern: 'bipedWalk', duty: 0.65, stride: 0.9, fr: [0, 0.3], bentHipKnee: true },
      gallop:  { pattern: 'rotaryGallop', duty: 0.35, stride: 2.2, fr: [0.4, 4] },
    },
    axial: { flex: 0.3, lateral: 0.1, wave: 'none', roll: 0.25, yaw: 0.25, head: 'steady', tail: 'none' },
    note: 'knuckle-walks with the primate diagonal sequence; can stride a few steps upright, hips and knees bent',
    source: 'Hildebrand 1967 (primate diagonal-sequence walking); Pontzer et al. 2009 (chimpanzee locomotion)',
    species: {
      // the monkeys walk on flat palms, their tails swaying; the sloth crawls; the orangutan fist-walks slowly
      capuchin: { spine: { trunk: 3, neck: 2, tail: 5 },
        gaits: { walk: { pattern: 'diagonalWalk', duty: 0.7, stride: 1.2, fr: [0, 0.4], knuckles: false }, upright: null,
          bound: { pattern: 'halfBound', duty: 0.3, stride: 2.4, fr: [1, 5] } },
        axial: { tail: 'trail' }, note: 'walks on flat palms, the tail swaying; bounds when it hurries' },
      lemur: { spine: { trunk: 3, neck: 2, tail: 6 },
        gaits: { walk: { pattern: 'diagonalWalk', duty: 0.7, stride: 1.2, fr: [0, 0.4], knuckles: false }, upright: null,
          bound: { pattern: 'halfBound', duty: 0.3, stride: 2.6, fr: [1, 6] } },
        axial: { tail: 'trail' }, note: 'palms flat, the ringed tail held up; bounds and leaps' },
      sloth: { gaits: { walk: { pattern: 'diagonalWalk', duty: 0.85, stride: 0.8, fr: [0, 0.15], knuckles: false }, upright: null, gallop: null },
        axial: { roll: 0.15, head: 'steady' }, note: 'a slow, sprawled crawl on the ground; it cannot run' },
      orangutan: { gaits: { upright: null, gallop: null }, note: 'a slow fist-walk on all fours' },
    },
  },
};
