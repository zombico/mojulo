// Q-ung — the hoofed: horses, deer, giraffe, cattle and goats, pigs. Four legs standing on the tip of one toe
// (horse) or two (cloven), with an extra long bone (the cannon) and a springy fetlock that sinks under the load at
// mid-stance. The back is stiff: the stride comes from the long legs, and the head and neck swing as a pendulum
// that times the forelegs (the nod). Horses walk, trot, canter and gallop TRANSVERSE; camels and giraffes PACE
// instead of trotting and gallop rotary.
export const RIG = {
  id: 'hoofed', name: 'hoofed',
  legs: ['LF', 'RF', 'LH', 'RH'],
  chain: { fore: ['shoulder', 'elbow', 'carpus', 'fetlock', 'coronet', 'hoof'], hind: ['hip', 'stifle', 'hock', 'fetlock', 'coronet', 'hoof'] },
  stance: 'unguligrade',
};

const STIFF = { flex: 0.2, lateral: 0.03, wave: 'none', roll: 0.1, yaw: 0.1, head: 'nod', tail: 'trail' };

export const FAMILIES = {
  equine: {
    spine: { trunk: 3, neck: 3, tail: 2 },
    gaits: {
      walk:   { pattern: 'lateralWalk', duty: 0.65, stride: 1.2, fr: [0, 0.4] },
      trot:   { pattern: 'trot', duty: 0.42, stride: 1.9, fr: [0.4, 1.3] },
      canter: { pattern: 'canter', duty: 0.35, stride: 2.4, fr: [1.3, 2.5] },
      gallop: { pattern: 'transverseGallop', duty: 0.25, stride: 3.6, fr: [2.5, 10] },
    },
    axial: { ...STIFF, flex: 0.25 },
    note: 'the head nods twice a stride at the walk and once in the canter and gallop; the fetlocks sink at mid-stance',
    source: 'Hildebrand 1965 (symmetrical gaits of horses); Hildebrand 1977',
    species: {
      // the camel paces: both legs on a side together, the body swaying from side to side
      camel: {
        gaits: { trot: null, canter: null, pace: { pattern: 'pace', duty: 0.45, stride: 1.9, fr: [0.4, 1.5] },
          gallop: { pattern: 'rotaryGallop', duty: 0.3, stride: 3, fr: [1.5, 6] } },
        axial: { roll: 0.3, head: 'sway' },
        note: 'paces, the two legs on one side together, so the body rocks side to side; the long neck sways',
      },
    },
  },
  giraffid: {
    spine: { trunk: 3, neck: 4, tail: 2 },
    gaits: {
      walk:   { pattern: 'lateralWalk', duty: 0.65, stride: 1.1, fr: [0, 0.5], nearPace: true },   // pace-like walk
      gallop: { pattern: 'rotaryGallop', duty: 0.3, stride: 2.4, fr: [0.5, 4] },
    },
    axial: { ...STIFF, head: 'nod', neckSwing: 1 },
    note: 'a pace-like walk; in the gallop the long neck swings far forward and back with every stride',
    source: 'Hildebrand 1977; Basu, Wilson & Hutchinson 2019 (giraffe gaits)',
  },
  cervid: {
    spine: { trunk: 3, neck: 3, tail: 1 },
    gaits: {
      walk:   { pattern: 'lateralWalk', duty: 0.65, stride: 1.2, fr: [0, 0.5] },
      trot:   { pattern: 'trot', duty: 0.42, stride: 2.0, fr: [0.5, 1.5] },
      gallop: { pattern: 'transverseGallop', duty: 0.25, stride: 3.6, fr: [1.5, 10] },
      bound:  { pattern: 'bound', duty: 0.25, stride: 3.8, fr: [1.5, 10], leap: true },
    },
    axial: { ...STIFF, flex: 0.35 },
    note: 'deer flee in long springing bounds over cover; the white tail flags up',
    source: 'Hildebrand 1977',
    species: {
      // the moose: a long-legged trotter that rarely gallops and does not bound
      moose: { gaits: { bound: null }, note: 'a high-stepping trot over brush and snow is its working fast gait' },
    },
  },
  bovid: {
    spine: { trunk: 3, neck: 2, tail: 2 },
    gaits: {
      walk:   { pattern: 'lateralWalk', duty: 0.68, stride: 1.1, fr: [0, 0.4] },
      trot:   { pattern: 'trot', duty: 0.42, stride: 1.8, fr: [0.4, 1.5] },
      gallop: { pattern: 'transverseGallop', duty: 0.28, stride: 3, fr: [1.5, 8] },
    },
    axial: STIFF,
    note: 'a heavy, level walk with the head nodding; the gallop is short and rocking',
    source: 'Hildebrand 1977',
    species: {
      // the gazelle: stotting (pronking), all four legs straight, a display to predators
      gazelle: {
        gaits: { pronk: { pattern: 'pronk', duty: 0.25, stride: 0.6, fr: [0.5, 2], stiffLegs: true },
          gallop: { duty: 0.22, stride: 3.8, fr: [1.5, 14] } },
        axial: { flex: 0.35 },
        note: 'stots: springs straight up on four stiff legs, back arched; the gallop is long and fast',
      },
      goat: { gaits: { bound: { pattern: 'bound', duty: 0.3, stride: 1.6, fr: [0.5, 3], leap: true } }, note: 'bounds up rock from ledge to ledge' },
      ram: { gaits: { bound: { pattern: 'bound', duty: 0.3, stride: 1.6, fr: [0.5, 3], leap: true } }, note: 'bounds up rock from ledge to ledge' },
    },
  },
  suid: {
    spine: { trunk: 3, neck: 1, tail: 2 },
    gaits: {
      walk:   { pattern: 'lateralWalk', duty: 0.68, stride: 1.2, fr: [0, 0.5] },
      trot:   { pattern: 'trot', duty: 0.45, stride: 1.8, fr: [0.5, 1.6] },
      gallop: { pattern: 'transverseGallop', duty: 0.3, stride: 2.6, fr: [1.6, 6] },
    },
    axial: { ...STIFF, head: 'steady', tail: 'still' },
    note: 'short quick steps on the tips of the hooves; the head carried low and steady',
    source: 'Hildebrand 1977',
  },
};
