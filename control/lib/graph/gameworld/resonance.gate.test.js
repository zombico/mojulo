import { describe, expect, it } from 'vitest';

import { composeGameworld, runSteps } from './index.js';
import { quickWorld } from './quick.js';
import { cubeOfWorld } from './intent.js';
import { resonanceCheck, formGaps } from './resonance.js';
import { MEADOWMARK_HERO } from './examples.js';

// THE COMPILER'S GATE (the Resonance theme): worlds made the ways a creator makes them (words composed, the form's
// creator fields then filled as the readout asks; a quick game), each opening a resonance; the run's orders are checked. It FIRES on a new gap: a case not in KNOWN_GAPS whose
// resonance is not laid, or laid and not held. It ratchets: a known gap that is filled fails too until its line is
// deleted, so the ledger only shrinks. Every gap here is the compiler's (the steps not laying what the cube opens),
// never the creator's; the run reports it and refuses nothing.
const COOP = () => composeGameworld({ prompt: 'a couch co-op platformer to play with my brother', seed: 1 });
const CASES = [
  // (the words fill what the composer can of the form; the hero the readout asks for is written as a creator would:
  // a character book)
  { id: 'co-op words', row: 'co-op-screen', world: () => ({ ...COOP(), characters: MEADOWMARK_HERO.characters }) },
  { id: 'co-op quick', row: 'co-op-screen', world: () => ({ ...quickWorld({ id: 'duo', quick: { goal: 'collect', pickup: 'coin', camera: 'side', hero: { cast: 'female' } }, style: { kit: 'trail-valley' } }), intent: { cube: { soul: { seats: 'two', frame: 'follow-all' } } } }) },
  { id: 'stealth words', row: 'watched-sneak', world: () => composeGameworld({ prompt: 'a stealth game sneaking past guards in a castle', seed: 1 }) },
  { id: 'sneak quick', row: 'watched-sneak', world: () => quickWorld({ id: 'sn', quick: { goal: 'sneak' }, style: { kit: 'trail-valley' } }) },
];
// the gaps the check has found and the compiler has not yet filled: 'unlaid' (opened, not laid) or 'unheld' (laid, its
// law does not hold), each with why
const KNOWN_GAPS = {
  // (filled 1025: 'stealth words', the composed stealth game laid no watchers; its words now write each level's
  // goal.guards, guards who see on the beats and the unseen goal; 'co-op words', the composed co-op platformer laid
  // no seats on a side camera: its form's camera and levels are now the composer's, and its hero the book the readout
  // asks for)
};

const statusOf = (world, row) => {
  const r = resonanceCheck(cubeOfWorld(world).cube, runSteps(world, { ref: 'g' }).map((s) => s.order)).find((x) => x.id === row);
  return !r ? 'unopened' : !r.laid ? 'unlaid' : r.held === false ? 'unheld' : 'ok';
};

describe('the compiler lays what a composition opens', () => {
  it.each(CASES.map((c) => [c.id, c]))('%s', (_, c) => {
    expect(statusOf(c.world(), c.row), KNOWN_GAPS[c.id] ? `known gap: ${KNOWN_GAPS[c.id]} (filled? delete its KNOWN_GAPS line)` : 'a new compiler gap').toBe(KNOWN_GAPS[c.id] ?? 'ok');
  }, 600_000);

  // THE FORM, before the run: what the words open, the composer fills (the camera, levels it runs); what is the creator's
  // (the hero) is asked, never chosen. A form the composer leaves empty is the compiler's gap, like an unlaid row
  it('the form of what the words open: the composer fills its fields, the creator\'s are asked', () => {
    const w = COOP();
    expect(w.camera).toBe('side');
    expect(Object.values(w.levels).every((L) => Object.values(L.walk.nodes).every((n) => n.trail))).toBe(true);
    expect(formGaps(w, cubeOfWorld(w).cube).map((f) => [f.row, f.field, f.by])).toEqual([['co-op-screen', 'hero', 'creator']]);
    const booked = { ...w, characters: MEADOWMARK_HERO.characters };
    expect(formGaps(booked, cubeOfWorld(booked).cube)).toEqual([]);
  });

  it('the ledger names only cases the gate runs', () => {
    for (const id of Object.keys(KNOWN_GAPS)) expect(CASES.some((c) => c.id === id), id).toBe(true);
  });
});
