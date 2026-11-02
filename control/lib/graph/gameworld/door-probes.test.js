// The door probes' concepts can hold: each family's concept (door-probes.js) holds on the door that makes its game today
// (its `reference`: a book world, or a quick goal through quickWorld, through the run's steps as design_game runs it), and fails
// on a bare walk. Without this a probe whose concept could never hold would read "not yet" forever. The sentence door
// itself is probed in the e2e tier (door-probes.e2e.test.js).
import { describe, expect, it } from 'vitest';

import { DOOR_PROBES, probeOfGenre } from './door-probes.js';
import { quickWorld } from './quick.js';
import { runSteps } from './runner.js';
import { FIXTURES } from '../cosmos/fixtures.js';

const stepsOf = ({ book, quick, world = {} }) => runSteps(book ?? { ...quickWorld({ id: 'ref', quick }), ...world }, { ref: 'ref' });
const walk = stepsOf({ quick: { goal: 'reach' } });   // the bodiless first-person walk to an exit

describe('each door probe\'s concept', () => {
  it('names a hillclimb genre that exists, at most one probe a genre', () => {
    const ids = new Set(FIXTURES.map((f) => f.id));
    for (const p of DOOR_PROBES.filter((x) => x.genre)) { expect(ids.has(p.genre), p.genre).toBe(true); expect(probeOfGenre(p.genre)).toBe(p); }
  });

  it.each(DOOR_PROBES.filter((p) => p.reference).map((p) => [p.family, p]))('%s holds on the door that makes it, not on a bare walk', (family, p) => {
    expect(p.holds({ world: null, steps: stepsOf(p.reference), refused: null }), `${family} on ${JSON.stringify(p.reference.book ?? p.reference.quick)}`).toBe(true);
    expect(p.holds({ world: null, steps: walk, refused: null }), `${family} on a bare walk`).toBe(false);
  }, 60_000);

  it('a refusal or a hand-off holds on nothing made, never on a level', () => {
    for (const p of DOOR_PROBES.filter((x) => !x.reference)) {
      expect(p.holds({ world: null, steps: [], refused: 'waits on soul.frame=fixed' }), p.family).toBe(true);
      expect(p.holds({ world: null, steps: walk, refused: null }), p.family).toBe(false);
    }
  });
});
