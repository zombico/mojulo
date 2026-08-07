/**
 * newton-cradles — a COMPLEX actions-world that exercises the whole event-bus stack end to end
 * (event-bus.plan.md). Two independent Newton's cradles, each a row of tethered spheres, rigged
 * from a direction on a staggered timer. It is the proof case for every principle at once:
 *
 *   - mechanism vs policy:  physics emits `contact` FACTS; reactions assign MEANING (`clack`).
 *   - rules tied to physics: the rig is a reaction `impulse` reaching back INTO a body (Phase 5b).
 *   - scope isolation:      cradle A and B are distinct scope keys — rigging A leaves B silent.
 *   - determinism:          autonomous (no input) ⇒ a seeded playthrough is byte-reproducible.
 *
 * Pure builder: returns a manifest ({ physics, events, actions, faces }). The node proof
 * (newton-cradles.test.js) and the /world generator both consume it — one definition, no drift.
 *
 * The clack POLICY (contact fact → meaning) is now composed from the `onContact` contact-policy
 * idiom (game-idioms.js) instead of hand-pairing a `source` with its `reaction`; game-idioms.test.js
 * proves the recomposition is behaviorally identical under the bus hashState oracle. The rig saga +
 * arm events stay authored here — they are physics rigging, not contact policy.
 */

import { compose, onContact } from '../game-idioms.js';

// One cradle = a row of `n` touching tethered spheres along x at a given y, hanging from anchors.
function cradleBodies(key, y, n, r, z, top, color) {
  const bodies = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * (2 * r);          // centred row, spacing = 2r → just touching at rest
    bodies.push({ id: `${key}-${i}`, collider: 'sphere', position: [x, y, z], radius: r, restitution: 1, friction: 0, anchor: [x, y, top], color });
  }
  return bodies;
}

export function buildCradles({ n = 5, r = 0.5 } = {}) {
  const z = 6, top = z + 3.5;
  // Two cradles, rigged from OPPOSITE ends in OPPOSITE directions on a staggered delay — so their
  // independence is visible: A starts first pulling right, B starts later pulling left.
  const cradles = [
    { key: 'A', y: -2.0, end: 0, dir: 'right', gain: 5, delay: 0.4, color: '#ff7a59' },
    { key: 'B', y: 2.0, end: n - 1, dir: 'left', gain: 6, delay: 1.4, color: '#7ad1ff' },
  ];

  const bodies = [];
  for (const c of cradles) bodies.push(...cradleBodies(c.key, c.y, n, r, z, top, c.color));
  const physics = { gravity: [0, 0, -9.8], bodies };

  // POLICY: each in-cradle ball-on-ball contact (the click-clack) emits a `clack` scoped to that
  // cradle — surfaced as a FACT and given MEANING by one `onContact` per cradle. Scope is what keeps
  // the two cradles' event streams from ever crossing.
  const clacks = cradles.map((c) => onContact({ a: `${c.key}-*`, b: `${c.key}-*`, do: 'emit', type: 'clack', scope: c.key }));
  // The RIG, as a scope-keyed saga: wait the cradle's delay, then impulse its end ball in its
  // direction (a reaction reaching into physics). One def, one live instance per cradle scope.
  const sequences = [{
    id: 'rig', scope: 'event.cradle', trigger: { on: 'arm' },
    steps: [
      { await: { timer: 'event.delay' } },
      { do: 'impulse', target: 'event.endBall', dir: 'event.dir', gain: 'event.gain' },
    ],
  }];
  // Autonomous, staggered, independent rigging — no user input (the deterministic playthrough).
  const initial = cradles.map((c) => ({ type: 'arm', cradle: c.key, endBall: `${c.key}-${c.end}`, dir: c.dir, gain: c.gain, delay: c.delay }));

  // The clack policy composes from the idiom; the rig saga + arm events stay authored (rigging, not
  // contact policy).
  const events = compose(...clacks, { sequences }, { initial });

  // Manual pull too (actions channel): key 1 rigs A, key 2 rigs B.
  const actions = [
    { on: 'key', key: '1', target: `A-${cradles[0].end}`, do: 'impulse', dir: 'right', gain: 5 },
    { on: 'key', key: '2', target: `B-${cradles[1].end}`, do: 'impulse', dir: 'left', gain: 6 },
  ];

  // a simple ground quad for visual grounding (the cradles hang above it).
  const faces = [{ corners: [[-6, -5, 0], [6, -5, 0], [6, 5, 0], [-6, 5, 0]], fill: '#2a2f3a' }];

  return { physics, events, actions, faces, cradles, n, r };
}
