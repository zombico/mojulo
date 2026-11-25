import { describe, it, expect } from 'vitest';
import { speedFxConfig, speedFxScript, SPEED_FX } from './speed-fx.js';

// THE SPEED'S LOOK (channels/speed-fx.js): a flown craft's speed in the world round it, from its pilot's rule: a rail
// stage's speed and boost, a cockpit's cruise and top speed; speed lines in the air, dust in space.
const level = (rule, extra = {}) => ({ kind: 'airspace', entities: [{ id: 'player', pilotable: true, rule }, { id: 'foe-1', rule: { type: 'ai' } }], ...extra });

describe('the speed\'s look', () => {
  it('reads a level\'s pilot: a rail stage\'s cruise and boost, a cockpit\'s cruise and its engines full; none where nothing flies', () => {
    expect(speedFxConfig(level({ type: 'rail', speed: 120, boost: { mul: 1.7 } }))).toEqual({ mode: 'air', base: 120, turbo: 204 });
    expect(speedFxConfig(level({ type: 'rail', speed: 60 }), { space: true })).toEqual({ mode: 'space', base: 60, turbo: 102 });
    const S = speedFxConfig(level({ type: 'starfighter', speed: 150 }), { space: true });
    expect(S.mode).toBe('space');
    expect(S.base).toBeLessThan(S.turbo);
    expect(speedFxConfig(level({ type: 'fly' }))).toBeNull();
    expect(speedFxConfig({ kind: 'airspace' })).toBeNull();
  });

  it('is one block for both looks, driven by the pilot\'s own motion, with no dice of the browser\'s', () => {
    for (const mode of ['air', 'space']) {
      const js = speedFxScript({ mode, base: 100, turbo: 170 });
      expect(() => new Function(js)).not.toThrow();
      expect(js).toContain('__mojSpeedFx');
      expect(js).toContain(JSON.stringify(SPEED_FX[mode === 'air' ? 'air' : 'space']));
      expect(js).not.toMatch(/Math\.random/);
    }
  });
});
