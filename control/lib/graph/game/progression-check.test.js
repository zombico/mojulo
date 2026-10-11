import { describe, it, expect } from 'vitest';
import { checkProgression } from './progression-check.js';

const STORE = { slices: [{ name: 'campaign', kind: 'progression' }, { name: 'world', kind: 'flags' }] };
const game = (levels) => ({ store: STORE, levels });
const FLAGGER = { produces: { events: [{ type: 'setFlag', slice: 'world' }] } };
// a level whose cue emits `mayor-met` on the bus, mapped by game.on to the flag itself
const SETTER = { ...FLAGGER, on: { 'mayor-met': { emit: { type: 'setFlag', slice: 'world', key: 'met-mayor', value: true } } } };

describe('checkProgression', () => {
  it('reaches every level of a clean campaign, in play order', () => {
    const r = checkProgression(game([{ ref: 'a' }, { ref: 'b', gate: { completed: 'a' } }, { ref: 'c', gate: { completed: 'b' } }]));
    expect(r).toEqual({ ok: true, reachable: ['a', 'b', 'c'], locked: [], unproven: [] });
  });

  it('opens a level gated on one listed after it', () => {
    const r = checkProgression(game([{ ref: 'b', gate: { completed: 'a' } }, { ref: 'a' }]));
    expect(r.ok).toBe(true);
    expect(r.reachable).toEqual(['b', 'a']);
  });

  it('names a gate on a level the game does not hold', () => {
    const r = checkProgression(game([{ ref: 'a' }, { ref: 'b', gate: { completed: 'ghost' } }]));
    expect(r.ok).toBe(false);
    expect(r.locked).toEqual([{ ref: 'b', why: "its gate waits on 'ghost', a level the game does not hold" }]);
  });

  it('names a level gated on itself, and a cycle', () => {
    const self = checkProgression(game([{ ref: 'a' }, { ref: 'b', gate: { completed: 'b' } }]));
    expect(self.locked[0].why).toMatch(/finishing itself/);
    const cycle = checkProgression(game([{ ref: 'a' }, { ref: 'b', gate: { completed: 'c' } }, { ref: 'c', gate: { completed: 'b' } }]));
    expect(cycle.locked.map((l) => l.ref)).toEqual(['b', 'c']);
    expect(cycle.locked[0].why).toMatch(/never reachable \(a cycle/);
  });

  it('locks a flag gate no reachable level may set, and passes it on as locked downstream', () => {
    const r = checkProgression(game([{ ref: 'a' }, { ref: 'b', gate: { flag: 'met-mayor' } }, { ref: 'c', gate: { completed: 'b' } }]));
    expect(r.locked).toEqual([
      { ref: 'b', why: "its gate waits on flag 'met-mayor', and no reachable level's contract may set a flag on 'world'" },
      { ref: 'c', why: "its gate waits on 'b', which is never reachable (a cycle, or a locked level before it)" },
    ]);
    const noSlice = checkProgression({ levels: [{ ref: 'a' }, { ref: 'b', gate: { flag: 'x' } }] });
    expect(noSlice.locked[0].why).toMatch(/no flags slice/);
  });

  it('opens a flag gate a reachable level sets through game.on, as proven', () => {
    const r = checkProgression(game([{ ref: 'a' }, { ref: 'b', gate: { flag: 'met-mayor' } }]), { a: SETTER });
    expect(r).toEqual({ ok: true, reachable: ['a', 'b'], locked: [], unproven: [] });
    // the same level setting another key only allows this one
    const other = checkProgression(game([{ ref: 'a' }, { ref: 'b', gate: { flag: 'saw-ending' } }]), { a: SETTER });
    expect(other.unproven.map((u) => u.ref)).toEqual(['b']);
  });

  it('opens a flag gate a reachable contract only allows, as unproven', () => {
    const levels = [{ ref: 'a' }, { ref: 'b', gate: { flag: 'met-mayor' } }];
    const r = checkProgression(game(levels), { a: FLAGGER });
    expect(r.ok).toBe(true);
    expect(r.unproven).toEqual([{ ref: 'b', why: "flag 'met-mayor' is allowed by 'a''s contract, but no level's game.on sets it" }]);
    // a flag set only by an unreachable level opens nothing
    const r2 = checkProgression(game([{ ref: 'a' }, { ref: 'b', gate: { flag: 'k' } }, { ref: 'z', gate: { completed: 'ghost' } }]), { z: FLAGGER });
    expect(r2.locked.map((l) => l.ref)).toEqual(['b', 'z']);
  });

  it('is pure: the same game gives the same report', () => {
    const g = game([{ ref: 'a' }, { ref: 'b', gate: { flag: 'k' } }]);
    expect(JSON.stringify(checkProgression(g, { a: FLAGGER }))).toBe(JSON.stringify(checkProgression(g, { a: FLAGGER })));
  });
});
