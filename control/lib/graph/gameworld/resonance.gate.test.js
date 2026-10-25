import { describe, expect, it } from 'vitest';

import { composeGameworld, runSteps } from './index.js';
import { quickWorld } from './quick.js';
import { cubeOfWorld } from './intent.js';
import { resonanceCheck } from './resonance.js';

// THE COMPILER'S GATE (the Resonance theme): worlds made the ways a creator makes them (words composed, a quick game),
// each opening a resonance; the run's orders are checked. It FIRES on a new gap: a case not in KNOWN_GAPS whose
// resonance is not laid, or laid and not held. It ratchets: a known gap that is filled fails too until its line is
// deleted, so the ledger only shrinks. Every gap here is the compiler's (the steps not laying what the cube opens),
// never the creator's; the run reports it and refuses nothing.
const CASES = [
  { id: 'co-op words', row: 'co-op-screen', world: () => composeGameworld({ prompt: 'a couch co-op platformer to play with my brother', seed: 1 }) },
  { id: 'co-op quick', row: 'co-op-screen', world: () => ({ ...quickWorld({ id: 'duo', quick: { goal: 'collect', pickup: 'coin', camera: 'side', hero: { cast: 'female' } }, style: { kit: 'trail-valley' } }), intent: { cube: { soul: { seats: 'two', frame: 'follow-all' } } } }) },
  { id: 'stealth words', row: 'watched-sneak', world: () => composeGameworld({ prompt: 'a stealth game sneaking past guards in a castle', seed: 1 }) },
  { id: 'sneak quick', row: 'watched-sneak', world: () => quickWorld({ id: 'sn', quick: { goal: 'sneak' }, style: { kit: 'trail-valley' } }) },
];
// the gaps the check has found and the compiler has not yet filled: 'unlaid' (opened, not laid) or 'unheld' (laid, its
// law does not hold), each with why
const KNOWN_GAPS = {
  // the composed co-op platformer writes its intent (four seats, the shared camera, a side camera) and lays its levels
  // on the composer's own camera with no hero per seat
  'co-op words': 'unlaid',
  // the composed stealth game writes its intent (watchers who remember, an unseen goal) and lays no watchers: only the
  // quick sneak lays guards
  'stealth words': 'unlaid',
  // the quick sneak lays its guards with sight where its stealth cube asks for memory
  'sneak quick': 'unheld',
};

const statusOf = (world, row) => {
  const r = resonanceCheck(cubeOfWorld(world).cube, runSteps(world, { ref: 'g' }).map((s) => s.order)).find((x) => x.id === row);
  return !r ? 'unopened' : !r.laid ? 'unlaid' : r.held === false ? 'unheld' : 'ok';
};

describe('the compiler lays what a composition opens', () => {
  it.each(CASES.map((c) => [c.id, c]))('%s', (_, c) => {
    expect(statusOf(c.world(), c.row), KNOWN_GAPS[c.id] ? `known gap: ${KNOWN_GAPS[c.id]} (filled? delete its KNOWN_GAPS line)` : 'a new compiler gap').toBe(KNOWN_GAPS[c.id] ?? 'ok');
  }, 600_000);

  it('the ledger names only cases the gate runs', () => {
    for (const id of Object.keys(KNOWN_GAPS)) expect(CASES.some((c) => c.id === id), id).toBe(true);
  });
});
