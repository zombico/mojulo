// Axial — the whole-body wave: snakes, fish, sharks, the manta, the plesiosaur. No walking legs; the body (or a pair
// of big fins) is the propulsor. Snakes push a travelling side-to-side wave from head to tail against the ground.
// Fish are sorted by how much of the body bends (Breder 1926): the eel the whole body, the salmon the rear two
// thirds, the shark the rear half, a tuna-like swimmer only the tail. The clownfish and angelfish row and scull
// with their fins; the manta flaps its pectoral wings; the plesiosaur flies underwater on four flippers.
export const RIG = {
  id: 'axial', name: 'whole-body wave',
  legs: [],
  chain: { body: ['head', 'neck', 'trunk', 'tail'] },
  stance: 'none',
};

const SWIMMER = { flex: 0, lateral: 1, wave: 'travelling', roll: 0, yaw: 0.1, head: 'steady', tail: 'drive' };

export const FAMILIES = {
  squamate: {
    // the snakes are the family's default; the monitor lizard overrides to the sprawling rig
    spine: { trunk: 12, neck: 1, tail: 3 },
    gaits: {
      slither: { pattern: 'lateralUndulation' },
      concertina: { pattern: 'concertina' },
      swim: { pattern: 'lateralUndulation', amp: 0.1 },
    },
    axial: { flex: 0, lateral: 1, wave: 'travelling', roll: 0, yaw: 0, head: 'steady', tail: 'trail' },
    note: 'side-to-side waves pass from head to tail, every point following the path of the head',
    source: 'Gray 1946 (snake undulation); Jayne 1986 (kinematics of terrestrial snake locomotion)',
    species: {
      monitorLizard: {
        rig: 'sprawling',
        spine: { trunk: 4, neck: 2, tail: 6 },
        gaits: { slither: null, concertina: null,
          walk: { pattern: 'lateralWalk', duty: 0.65, stride: 1.2, fr: [0, 0.4], sprawl: 0.8 },
          trot: { pattern: 'trot', duty: 0.45, stride: 1.8, fr: [0.4, 2.5], sprawl: 0.7 },
          swim: { pattern: 'tailDrive', amp: 0.12, limbsTucked: true } },
        axial: { flex: 0.1, lateral: 0.6, wave: 'standing', roll: 0.1, yaw: 0.4, head: 'sway', tail: 'counter' },
        note: 'a swaggering sprawl: the body bends side to side with each step, head swinging, tongue flicking; trots when it hurries',
      },
      rattlesnake: { gaits: { sidewind: { pattern: 'sidewinding' }, creep: { pattern: 'rectilinear' } },
        note: 'slithers, creeps straight when stalking, and sidewinds across loose sand' },
      anaconda: { gaits: { creep: { pattern: 'rectilinear' } },
        note: 'heavy: creeps straight by walking its belly scales, slithers, and swims well' },
      snake: { gaits: { creep: { pattern: 'rectilinear' } }, note: 'heavy-bodied: creeps straight by walking its belly scales, and slithers' },
      kingCobra: { gaits: { slither: { raised: 0.25 } }, note: 'slithers with the front third of the body raised when alarmed' },
      greenMamba: { gaits: { slither: { amp: 0.06, fast: true } }, note: 'a fast, shallow slither, often through branches' },
      // mythic: the sea serpent swims in vertical humps, as it is always drawn
      seaSerpent: {
        gaits: { slither: null, concertina: null, swim: { pattern: 'verticalHumps' } },
        axial: { lateral: 0.2, flex: 1 },
        note: 'swims in great vertical humps breaking the surface, the fin crest rippling (mythic: drawn as it is told)',
      },
    },
  },
  teleost: {
    spine: { trunk: 6, neck: 0, tail: 2 },
    gaits: {
      swim: { pattern: 'subcarangiform' },
    },
    axial: SWIMMER,
    note: 'the wave grows from behind the head to the tail, the tail fin sweeping widest',
    source: 'Breder 1926 (fish swimming modes); Lauder & Tytell 2005 (hydrodynamics of undulatory propulsion)',
    species: {
      salmon: { note: 'strong body waves to a big tail sweep; it can leap clear of the water' },
      morayEel: { gaits: { swim: { pattern: 'anguilliform' } }, note: 'the whole long body waves, more than one wavelength at once' },
      clownfish: { gaits: { swim: { pattern: 'labriform' } }, axial: { lateral: 0.3 },
        note: 'hovers and rows with its pectoral fins, a quick body flick to dart' },
      angelfish: { gaits: { swim: { pattern: 'medianPaired' } }, axial: { lateral: 0.2 },
        note: 'glides by sculling the tall dorsal and anal fins, pectorals fluttering' },
    },
  },
  chondrichthyan: {
    spine: { trunk: 6, neck: 0, tail: 3 },
    gaits: {
      swim: { pattern: 'carangiform' },
    },
    axial: { ...SWIMMER, lateral: 0.7, head: 'sway' },
    note: 'a stiff front, the rear half and the tall tail sweeping; the head swings gently with each beat',
    source: 'Breder 1926; Lauder & Di Santo 2015 (shark swimming)',
    species: {
      greatWhiteShark: { gaits: { swim: { pattern: 'thunniform' } }, axial: { lateral: 0.5, head: 'steady' },
        note: 'a stiff, torpedo body; nearly all the motion is the crescent tail beating' },
      mantaRay: {
        spine: { trunk: 3, neck: 0, tail: 3 },
        gaits: { swim: null, fly: { pattern: 'mobuliform' }, glide: { pattern: 'soar' } },
        axial: { flex: 0, lateral: 0, wave: 'none', roll: 0.1, yaw: 0, head: 'steady', tail: 'trail' },
        note: '"flies" underwater: the great pectoral wings flap with a wave rolling out along their span, then glide',
      },
    },
  },
  plesiosaur: {
    spine: { trunk: 3, neck: 8, tail: 3 },
    gaits: {
      // disputed: how the four flippers were timed; fore and hind out of phase is the more visual (rowing) reading
      swim: { pattern: 'flipperFlight' },
    },
    axial: { flex: 0, lateral: 0.05, wave: 'none', roll: 0.05, yaw: 0.05, head: 'reach', tail: 'trail' },
    note: 'flies underwater on four flippers, the hind pair half a beat behind the fore; the long neck held out stiff',
    source: 'Muscutt et al. 2017 (plesiosaur four-flipper swimming)',
  },
};
