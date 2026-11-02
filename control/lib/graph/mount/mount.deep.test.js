import { describe, it, expect } from 'vitest';
import { resolveMount } from './build.js';
import { gaitCycle } from './gait.js';
import { gaitGates } from './gates.js';
import { GAITS } from './reference.js';
import { REGISTERS } from './cards.js';

// The deep sweep: every gait at both ends of its speed band, on both leads where it has one, in every register, held to
// the machine gate (the joint ranges are the preferred speed's, so they are checked in mount.test.js, not here).
describe('the mount at its speed bands\' ends', () => {
  for (const register of Object.keys(REGISTERS)) {
    const B = resolveMount('horse', { register });
    for (const [gait, spec] of Object.entries(GAITS)) for (const v of spec.speed) for (const lead of spec.symmetric ? ['right'] : ['right', 'left']) {
      it(`${register} ${gait} at ${v} m/s, ${lead} lead`, () => {
        const r = gaitGates(B, gaitCycle(B, gait, { speed: v * Math.sqrt(B.scale), lead }));
        expect(r.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
      });
    }
  }
});
