// B-dig — the two-legged toe-walkers: birds and the meat-eating dinosaurs. Hip, knee, ankle, then the toes; the
// heel is the backward-bending joint halfway up the leg. Legs half a stride apart, a walk with a foot always down and
// a run without (or with a short flight). Birds hold the head still in space at the walk and then thrust it forward
// (the head bob); ducks and penguins waddle. A theropod carries its spine level with the tail as a counterweight.
export const RIG = {
  id: 'biped', name: 'two-legged',
  legs: ['L', 'R'],
  chain: { leg: ['hip', 'knee', 'ankle', 'toe'] },
  stance: 'digitigrade biped',
};

const BIRD = { flex: 0, lateral: 0, wave: 'none', roll: 0.1, yaw: 0.1, head: 'thrust', tail: 'still' };

export const FAMILIES = {
  avian: {
    spine: { trunk: 1, neck: 4, tail: 1 },
    gaits: {
      walk: { pattern: 'bipedWalk', duty: 0.6, stride: 1.4, fr: [0, 0.5] },
      hop:  { pattern: 'bipedHop', duty: 0.4, stride: 1.2, fr: [0, 1] },
      fly:  { pattern: 'wingbeat' },
      glide: { pattern: 'soar' },
    },
    axial: BIRD,
    note: 'on the ground it walks or hops, the head holding still then thrusting; in the air it flaps and soars',
    source: 'Gatesy & Biewener 1991 (bird and human bipedal locomotion); Necker 2007 (head bobbing)',
    species: {
      chicken: {
        gaits: { hop: null, glide: null, run: { pattern: 'bipedRun', duty: 0.4, stride: 2.4, fr: [0.5, 3] },
          fly: { short: true } },
        note: 'struts with the hold-and-thrust head bob; runs low and fast; flutters only short hops into the air',
      },
      mallard: {
        gaits: { walk: null, hop: null, waddle: { pattern: 'bipedWalk', duty: 0.65, stride: 1, fr: [0, 0.4] },
          swim: { pattern: 'paddle' } },
        axial: { roll: 0.4, head: 'steady' },
        note: 'waddles, the body rolling over each foot; paddles with webbed feet on the water; flies fast and direct',
      },
      emperorPenguin: {
        spine: { trunk: 1, neck: 2, tail: 1 },
        gaits: { walk: null, hop: null, fly: null, glide: null,
          waddle: { pattern: 'bipedWalk', duty: 0.75, stride: 0.5, fr: [0, 0.15] },
          slide: { pattern: 'belly' },
          swim: { pattern: 'wingRow' } },
        axial: { roll: 0.5, yaw: 0.2, head: 'steady' },
        note: 'waddles upright with a big side-to-side rock; toboggans on the belly; flies underwater on its flippers',
      },
      vulture: { gaits: { fly: { soarMostly: true } }, note: 'hops and lopes on the ground; soars for hours on still wings' },
      macaw: { gaits: { hop: null, walk: { sidle: true }, glide: null },
        note: 'sidles along a branch, gripping with two toes forward and two back, using the beak as a third hand; flies direct' },
      greatHornedOwl: { gaits: { glide: null }, note: 'walks and hops awkwardly on the ground; flies silently on deep wingbeats' },
      ostrich: { gaits: { hop: null, fly: null, glide: null, run: { pattern: 'bipedRun', duty: 0.35, stride: 3.5, fr: [0.5, 4] } },
        note: 'flightless: walks with long strides and runs fast on two toes, the wings held out for balance' },
      rooster: { gaits: { hop: null, glide: null, run: { pattern: 'bipedRun', duty: 0.4, stride: 2.4, fr: [0.5, 3] }, fly: { short: true } },
        note: 'struts with the head bob, runs low and fast; flutters only short hops into the air' },
      turkey: { gaits: { glide: null, run: { pattern: 'bipedRun', duty: 0.4, stride: 2.4, fr: [0.5, 3] }, fly: { short: true } },
        note: 'struts and runs; flies only short bursts up to a roost' },
      peacock: { gaits: { hop: null, glide: null, fly: { short: true } }, note: 'walks with the train trailing; flies only short heavy bursts' },
      swan: { gaits: { walk: null, hop: null, waddle: { pattern: 'bipedWalk', duty: 0.65, stride: 1, fr: [0, 0.4] }, swim: { pattern: 'paddle' } },
        axial: { roll: 0.4, head: 'steady' }, note: 'waddles heavily on land; glides on the water paddling with webbed feet; flies with slow deep beats' },
      canadaGoose: { gaits: { walk: null, hop: null, waddle: { pattern: 'bipedWalk', duty: 0.65, stride: 1, fr: [0, 0.4] }, swim: { pattern: 'paddle' } },
        axial: { roll: 0.3, head: 'steady' }, note: 'waddles and grazes on land; paddles on the water; flies strongly, honking' },
      flamingo: { gaits: { hop: null, glide: null }, note: 'walks on long legs through the shallows; flies with the neck and legs stretched out' },
      hummingbird: { gaits: { walk: null, hop: null, glide: null }, note: 'barely walks; hovers and darts on a blur of wingbeats' },
    },
  },
  theropod: {
    spine: { trunk: 3, neck: 3, tail: 6 },
    gaits: {
      walk: { pattern: 'bipedWalk', duty: 0.6, stride: 1.4, fr: [0, 0.5] },
      run:  { pattern: 'bipedRun', duty: 0.4, stride: 2.6, fr: [0.5, 4] },
    },
    axial: { flex: 0.05, lateral: 0.1, wave: 'none', roll: 0.15, yaw: 0.2, head: 'steady', tail: 'counter' },
    note: 'the spine level as a beam over the hips, head forward and tail back; the tail swings against the hips each step',
    source: 'Hutchinson & Garcia 2002 (Tyrannosaurus running); Persons & Currie 2011 (tail muscles)',
    species: {
      // disputed: how fast an adult T. rex could go; a heavy, grounded run is kept as the more visual reading
      tRex: { gaits: { run: { duty: 0.5, stride: 1.9, fr: [0.5, 1.2], grounded: true } },
        note: 'a heavy, striding walk, head low and swinging; at speed, a pounding grounded run with no flight phase' },
      velociraptor: { gaits: { run: { duty: 0.35, stride: 3, fr: [0.5, 6] } },
        note: 'a quick, springy run, the sickle claw held up off the ground' },
    },
  },
};
