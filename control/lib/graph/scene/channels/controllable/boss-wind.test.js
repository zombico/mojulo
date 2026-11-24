import { describe, it, expect } from 'vitest';
import { controllableChannelScript } from './index.js';

// A BOSS WINDS UP (index.js __bossWind): a page with a director's boss plays its pattern's wind-up and strike clips as
// its move is told and lands; a page without one carries none of it.
const hero = { id: 'hero', kind: 'walker', transform: { pos: [0, 0, 1], heading: 0 }, rule: {}, body: {} };
const boss = { id: 'b', team: 'foes', transform: { pos: [0, 4, 0], heading: 0 }, rule: { type: 'none', boss: { kind: 'human', moves: {}, phases: [{ moves: {}, tempo: 2 }] } }, body: { type: 'mesh', hittable: true, hp: 100 } };

describe('a boss\'s wind-up on the page', () => {
  it('is emitted only where a boss stands, and parses', () => {
    expect(controllableChannelScript([hero], null, {})).not.toContain('__bossWind');
    const html = controllableChannelScript([hero, boss], null, {});
    expect(html).toContain('function __bossWind(e, fig)');
    const src = html.slice(html.indexOf('const __BOSS_STRIKE'), html.indexOf('function __syncRigEntity'));
    const wind = new Function('__world', `${src}; return __bossWind;`);
    // (told: the wind-up through the tell; landed: the strike; after, nothing of its own)
    const fig = { clips: { wind_quake: {}, strike_quake: {} } }, e = { bossS: { cur: { pattern: 'quake', t0: 1, land: 2 } } };
    expect(wind({ time: 1.5 })(e, fig)).toEqual({ mode: 'wind_quake', phase: 0.25 });
    expect(wind({ time: 2.1 })(e, fig).mode).toBe('strike_quake');
    expect(wind({ time: 3 })(e, fig)).toBe(null);
    expect(wind({ time: 1.5 })(e, { clips: {} })).toBe(null);
  });
});
