// Q-grav — the pillar-legged: elephant, hippo, rhino, triceratops, sauropods, stegosaurus, tortoise. Legs held
// nearly straight under the body like columns, short steps, a high duty factor. The elephant never has all four
// feet off the ground: its fastest gait is an amble, a running walk (Hutchinson et al. 2003). The spine barely
// flexes; the long necks and tails of the sauropods swing as counterweights.
export const RIG = {
  id: 'graviportal', name: 'pillar-legged',
  legs: ['LF', 'RF', 'LH', 'RH'],
  chain: { fore: ['shoulder', 'elbow', 'carpus', 'forePaw', 'foreToe'], hind: ['hip', 'stifle', 'hock', 'hindPaw', 'hindToe'] },
  stance: 'columnar',
};

const COLUMN = { flex: 0.05, lateral: 0.05, wave: 'none', roll: 0.15, yaw: 0.1, head: 'steady', tail: 'trail' };
const SLOW_WALK = { pattern: 'lateralWalk', duty: 0.7, stride: 1.1, fr: [0, 0.3] };

export const FAMILIES = {
  pachyderm: {
    spine: { trunk: 2, neck: 1, tail: 2 },
    gaits: {
      walk: SLOW_WALK,
      trot: { pattern: 'trot', duty: 0.45, stride: 1.6, fr: [0.3, 1.5] },
      gallop: { pattern: 'rotaryGallop', duty: 0.35, stride: 2.2, fr: [1.5, 4] },
    },
    axial: COLUMN,
    note: 'heavy, short steps on straight legs; the body rides level',
    source: 'Hildebrand 1977; Alexander & Pond 1992 (rhinoceros gaits)',
    species: {
      // the elephant: no flight phase at any speed
      elephant: {
        gaits: { trot: null, gallop: null, amble: { pattern: 'lateralWalk', duty: 0.5, stride: 1.4, fr: [0.3, 1] } },
        axial: { head: 'nod', trunkSwing: 1 },
        note: 'walks and, faster, ambles: a running walk in which never all four feet leave the ground; the trunk swings',
      },
      hippo: { gaits: { gallop: null, swim: { pattern: 'trot', duty: 0.3, stride: 1.5, bottomWalk: true } },
        note: 'trots fast on land; in water it bounces along the bottom in slow-motion leaps' },
    },
  },
  ceratopsian: {
    spine: { trunk: 2, neck: 1, tail: 3 },
    gaits: {
      walk: SLOW_WALK,
      trot: { pattern: 'trot', duty: 0.45, stride: 1.6, fr: [0.3, 1.5] },
      // disputed: whether big ceratopsians could gallop; a rhino-like charge is the more visual reading
      gallop: { pattern: 'rotaryGallop', duty: 0.35, stride: 2.2, fr: [1.5, 4] },
    },
    axial: { ...COLUMN, head: 'nod' },
    note: 'a rhino-like walker that can break into a charging gallop, the frill bobbing',
    source: 'Paul & Christiansen 2000 (ceratopsid forelimb posture and running)',
  },
  hadrosaur: {
    spine: { trunk: 3, neck: 2, tail: 4 },
    gaits: {
      walk: { pattern: 'lateralWalk', duty: 0.68, stride: 1.2, fr: [0, 0.4] },
      run:  { pattern: 'bipedRun', duty: 0.4, stride: 2.4, fr: [0.4, 3], hindOnly: true },
    },
    axial: { flex: 0.15, lateral: 0.05, wave: 'none', roll: 0.15, yaw: 0.15, head: 'steady', tail: 'counter' },
    note: 'browses on all fours; rears onto the hind legs and runs on two, the tail held out straight behind',
    source: 'Maidment & Barrett 2012 (facultative bipedality in ornithischians)',
  },
  sauropod: {
    spine: { trunk: 3, neck: 6, tail: 8 },
    gaits: {
      walk:  { pattern: 'lateralWalk', duty: 0.75, stride: 1, fr: [0, 0.25] },
      amble: { pattern: 'lateralWalk', duty: 0.55, stride: 1.3, fr: [0.25, 0.6] },
    },
    // disputed: tail and neck carriage; a tail held clear of the ground and swinging is the more visual reading
    axial: { ...COLUMN, lateral: 0.1, head: 'reach', tail: 'counter', neckSwing: 0.4 },
    note: 'slow pillar steps; the long neck and the long tail swing gently as counterweights, the tail held off the ground',
    source: 'Henderson 2006 (sauropod locomotion); trackways show narrow-gauge pillar steps',
  },
  thyreophoran: {
    spine: { trunk: 3, neck: 1, tail: 4 },
    gaits: {
      walk: { pattern: 'lateralWalk', duty: 0.75, stride: 0.9, fr: [0, 0.25] },
    },
    axial: { ...COLUMN, head: 'steady', tail: 'counter' },
    note: 'a slow, plodding walk, short forelegs and long hind legs, the tail swinging side to side',
    source: 'Maidment & Barrett 2012 (ornithischian limb posture)',
  },
  testudine: {
    spine: { trunk: 1, neck: 3, tail: 1 },
    gaits: {
      walk: { pattern: 'lateralWalk', duty: 0.85, stride: 0.6, fr: [0, 0.1], sprawl: 0.3 },
    },
    axial: { flex: 0, lateral: 0, wave: 'none', roll: 0.3, yaw: 0.15, head: 'reach', tail: 'still' },
    note: 'the slowest walk: the shell rocks from side to side over each leg, the neck reaching out',
    source: 'Jayes & Alexander 1980 (tortoise walking)',
  },
};
