// S-hop — the hoppers: kangaroo, rabbit, frog. Long hind legs that push off together, short forelegs that catch or
// prop. The kangaroo hops on its hind legs alone with the big tail as a counterweight, and at a crawl walks on five
// "legs": fore paws and tail plant, the hind legs swing through together (pentapedal). The rabbit's fast run is a
// half-bound, the hind feet landing ahead of the fore. The frog launches from Z-folded hind legs and lands on its
// forelegs.
export const RIG = {
  id: 'saltatorial', name: 'hopper',
  legs: ['LF', 'RF', 'LH', 'RH'],
  chain: { fore: ['shoulder', 'elbow', 'carpus', 'forePaw'], hind: ['hip', 'stifle', 'hock', 'hindPaw', 'hindToe'] },
  stance: 'hopping',
};

export const FAMILIES = {
  macropod: {
    spine: { trunk: 3, neck: 2, tail: 4 },
    gaits: {
      crawl: { pattern: 'pentapedal', duty: 0.7, stride: 0.8, fr: [0, 0.3] },
      hop:   { pattern: 'bipedHop', duty: 0.3, stride: 3.5, fr: [0.3, 10], hindOnly: true },
    },
    axial: { flex: 0.2, lateral: 0, wave: 'none', roll: 0, yaw: 0, head: 'steady', tail: 'counter' },
    note: 'creeps on all fours and the tail at grazing pace; hops on the hind legs, the tail swinging up and down to balance',
    source: 'Dawson & Taylor 1973 (energetics of hopping); O\'Connor et al. 2014 (the tail as a fifth leg)',
  },
  leporid: {
    spine: { trunk: 4, neck: 1, tail: 1 },
    gaits: {
      hop:   { pattern: 'halfBound', duty: 0.45, stride: 1.2, fr: [0, 0.5], slow: true },
      bound: { pattern: 'halfBound', duty: 0.25, stride: 3.2, fr: [0.5, 10] },
    },
    axial: { flex: 0.8, lateral: 0, wave: 'none', roll: 0, yaw: 0.05, head: 'steady', tail: 'still' },
    note: 'lollops in short hops; runs in long half-bounds, the hind feet landing ahead of the front, the back bowing',
    source: 'Hildebrand 1977 (half-bound)',
  },
  anuran: {
    spine: { trunk: 1, neck: 0, tail: 0 },
    gaits: {
      crawl: { pattern: 'lateralWalk', duty: 0.75, stride: 0.6, fr: [0, 0.2], sprawl: 0.6 },
      hop:   { pattern: 'saltation', duty: 0.35, stride: 4, fr: [0.2, 6] },
      swim:  { pattern: 'frogKick' },
    },
    axial: { flex: 0.2, lateral: 0, wave: 'none', roll: 0, yaw: 0, head: 'steady', tail: 'none' },
    note: 'unfolds all hind joints at once to leap, lands on its forelegs; swims with both hind legs kicking together',
    source: 'Gray 1968 (animal locomotion); Astley & Roberts 2012 (frog jumping)',
  },
};
