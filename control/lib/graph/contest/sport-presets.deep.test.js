// Every sport's every preset, swept: each reads as a quick game's words (its venue a stadium's, its broadcast a package's,
// its rules its arena's) and mints its level. The law tests are sport-presets.test.js.
import { describe, it, expect } from 'vitest';
import { SPORT_PRESETS } from './sport-presets.js';
import { quickWorld, readQuick } from '../gameworld/quick.js';
import { runSteps } from '../gameworld/runner.js';

describe('every preset', () => {
  for (const [sport, book] of Object.entries(SPORT_PRESETS)) {
    for (const name of Object.keys(book)) {
      it(`${sport} ${name} reads and mints its level`, () => {
        const quick = sport === 'meet' ? { goal: 'meet', event: 'sprint', lanes: 2, preset: name, athletes: false } : { goal: 'contest', sport, preset: name, athletes: false };
        expect(() => readQuick(quick)).not.toThrow();
        const st = runSteps(quickWorld({ id: 'deep', quick }), { ref: 'gw_deep' });
        expect(st[0].order.manifest.game.levelRef).toBeTruthy();
        expect(typeof book[name].reads).toBe('string');
      });
    }
  }
});
