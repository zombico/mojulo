// GUARD: it holds its post and watches in a narrow beam, sweeping its gaze either side, so a sneak can time it; an
// intruder it sees it engages, then it goes back. The castle sentry, the night watchman, the hound at the gate.
export const foe = {
  id: 'guard',
  reads: 'holds its post, sweeping a narrow gaze; engages what it sees',
  move: 'hold',
  attack: { kind: 'strike' },
  mind: { motivation: 'guard', aggressiveness: 'bold', perception: 'sight', sight: 'narrow', gaze: 'sweep' },
  fits: { support: ['four', 'two'], size: ['smol', 'chonky'] },
  presence: 1,
  toll: { downs: 2, harm: 1 }, stomp: 'blow', threat: 2,
  standIn: 'wolf',
};
