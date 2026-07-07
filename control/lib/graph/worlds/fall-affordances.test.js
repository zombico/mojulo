import { describe, it, expect } from 'vitest';

import { buildBus } from './event-bus.js';

// ── Fall-handling affordances (game-mechanics.plan.md, decision 3) ──────────────────────────────
// Two small, in-grain additions the fall-penalty-respawn opt-in needs:
//   1. min/max CLAMP on the bus inc/set verbs — so a fall penalty floors hp at 1 and can NEVER
//      reach 0 (a fall must never end the run).
//   2. syncToCtrl — a bus `move` on a controllable id records a WARP intent applied to the walking
//      player after the tick (the respawn teleport; the symmetric inverse of the zone-position read).

const B = buildBus();
const ent = (id, pos) => ({ id, transform: { pos }, vel: [0, 0, -30] });

describe('var clamp on inc/set', () => {
  it('inc floors at min — a fall penalty caps hp at 1, never 0', () => {
    const s = B.createBusState({ reactions: [{ on: 'fell', do: 'inc', var: 'hp', by: -20, min: 1 }], vars: { hp: 15 } }, []);
    B.processEvents(s, [{ type: 'fell' }]);
    expect(s.vars.hp).toBe(1);                         // 15 - 20 = -5 → floored to 1
    B.processEvents(s, [{ type: 'fell' }]);
    expect(s.vars.hp).toBe(1);                         // still 1, never below — the run-safety invariant
  });

  it('inc without min behaves exactly as before (unclamped)', () => {
    const s = B.createBusState({ reactions: [{ on: 'hurt', do: 'inc', var: 'hp', by: -20 }], vars: { hp: 15 } }, []);
    B.processEvents(s, [{ type: 'hurt' }]);
    expect(s.vars.hp).toBe(-5);                        // no floor → can go lethal (feeds fail-on-death)
  });

  it('set clamps to max (a resource ceiling); non-numeric set is untouched', () => {
    const s = B.createBusState({ reactions: [
      { on: 'refill', do: 'set', var: 'hp', to: 200, max: 100 },
      { on: 'name', do: 'set', var: 'label', to: 'boss' },
    ], vars: {} }, []);
    B.processEvents(s, [{ type: 'refill' }]);
    expect(s.vars.hp).toBe(100);
    B.processEvents(s, [{ type: 'name' }]);
    expect(s.vars.label).toBe('boss');                 // strings pass through the clamp untouched
  });
});

describe('syncToCtrl — respawn teleport of the walking player', () => {
  it('a move reaction on a controllable id warps that entity after the tick', () => {
    const s = B.createBusState({ reactions: [{ on: 'enter', match: { zone: 'catch' }, do: 'move', target: 'hero', to: [0, 0, 5] }] }, []);
    const hero = ent('hero', [40, 0, -80]);            // fallen into the void, moving down
    B.processEvents(s, [{ type: 'enter', zone: 'catch', entity: 'hero' }]);
    B.syncToCtrl(s, [hero]);
    expect(hero.transform.pos).toEqual([0, 0, 5]);     // teleported to spawn
    expect(hero.vel).toEqual([0, 0, 0]);               // fall velocity killed
  });

  it('only warps the tick a move fired — a normal tick leaves the walker alone', () => {
    const s = B.createBusState({ reactions: [{ on: 'enter', match: { zone: 'catch' }, do: 'move', target: 'hero', to: [0, 0, 5] }] }, []);
    const hero = ent('hero', [10, 2, 0]);
    B.processEvents(s, [{ type: 'enter', zone: 'other' }]);   // not the catch zone → no warp
    B.syncToCtrl(s, [hero]);
    expect(hero.transform.pos).toEqual([10, 2, 0]);    // untouched — the walk rule's position stands
  });

  it('warps clear after applying (no lingering teleport next tick)', () => {
    const s = B.createBusState({ reactions: [{ on: 'enter', do: 'move', target: 'hero', to: [0, 0, 5] }] }, []);
    const hero = ent('hero', [9, 9, 0]);
    B.processEvents(s, [{ type: 'enter' }]);
    B.syncToCtrl(s, [hero]);                            // applies [0,0,5]
    hero.transform.pos = [3, 3, 0];                     // player walks away
    B.syncToCtrl(s, [hero]);                            // no pending warp → no-op
    expect(hero.transform.pos).toEqual([3, 3, 0]);
  });

  it('the whole fall-respawn shape: catch-zone enter → clamped penalty + teleport, in one tick', () => {
    // exactly what the `fall:{mode:respawn,penalty,floor:1}` policy lowers to.
    const s = B.createBusState({
      reactions: [
        { on: 'enter', match: { zone: '__catch__' }, do: 'inc', var: 'hp', by: -25, min: 1 },
        { on: 'enter', match: { zone: '__catch__' }, do: 'move', target: 'hero', to: [0, 0, 2] },
      ],
      vars: { hp: 10 },
    }, []);
    const hero = ent('hero', [50, 0, -120]);
    B.processEvents(s, [{ type: 'enter', zone: '__catch__', entity: 'hero' }]);
    B.syncToCtrl(s, [hero]);
    expect(s.vars.hp).toBe(1);                          // penalized but ALIVE — run cannot end from a fall
    expect(hero.transform.pos).toEqual([0, 0, 2]);      // back at spawn
  });
});
