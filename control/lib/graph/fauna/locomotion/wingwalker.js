// W-walk — the wing-walkers: bat and pterosaur. On the ground they walk on four, the forelimb on the folded wing
// (the bat on its wrists and thumbs, the pterosaur on the knuckles of its wing hand). In the air the wing bones that
// wing.js already builds fold and spread through the beat: downstroke spread, upstroke folded and swept back.
export const RIG = {
  id: 'wingwalker', name: 'wing-walker',
  legs: ['LF', 'RF', 'LH', 'RH'],
  chain: { fore: ['wingRoot', 'wingHumerus', 'wingForearm', 'wrist'], hind: ['hip', 'stifle', 'hock', 'hindPaw'] },
  stance: 'quadrupedal on folded wings',
};

export const FAMILIES = {
  chiropteran: {
    spine: { trunk: 2, neck: 1, tail: 0 },
    gaits: {
      crawl: { pattern: 'lateralWalk', duty: 0.75, stride: 0.8, fr: [0, 0.2], sprawl: 0.7 },
      fly:   { pattern: 'wingbeat', membrane: true },
    },
    axial: { flex: 0.1, lateral: 0.15, wave: 'none', roll: 0.2, yaw: 0.2, head: 'steady', tail: 'none' },
    note: 'crawls clumsily on its wrists and hind feet; flies with deep, flexing wingbeats, the membrane billowing',
    source: 'Riskin et al. 2005 (bat quadrupedal locomotion); Swartz et al. 1996 (bat wing membrane skin)',
  },
  pterosaur: {
    spine: { trunk: 2, neck: 3, tail: 1 },
    gaits: {
      walk: { pattern: 'lateralWalk', duty: 0.7, stride: 1, fr: [0, 0.4] },
      fly:  { pattern: 'wingbeat', membrane: true },
      glide: { pattern: 'soar' },
    },
    axial: { flex: 0.1, lateral: 0.05, wave: 'none', roll: 0.15, yaw: 0.1, head: 'nod', tail: 'still' },
    note: 'walks on all fours on its folded wings; vaults into the air off the forelimbs; soars on long, narrow wings',
    source: 'Habib 2008 (quadrupedal launch in pterosaurs); Mazin et al. 2003 (pterosaur trackways)',
  },
};
