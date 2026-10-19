/**
 * Effect light: the rules (a night sky lights fully, noon a quarter), the page block compiling, and the beam and moment
 * channels throwing their light only when the world asks (`fxLight`), absent ⇒ their pages as before.
 */
import { describe, expect, it } from 'vitest';

import { FX_LIGHT, fxDay, fxLightScript } from './effect-light.js';
import { beamScript } from './channels/beam-channel.js';
import { momentScript } from './channels/moment-channel.js';
import { eventsChannelScript } from './channels/events.js';
import { BEAMS } from '../playscape/elements/beams.js';
import { lowerPlay } from '../playscape/ui/direction.js';

describe('effect light: the rules', () => {
  it('lights a night world fully and a noon one by FX_LIGHT.noon, between by the sky', () => {
    expect(fxDay([8, 10, 20])).toBe(FX_LIGHT.night);
    expect(fxDay([140, 190, 240])).toBe(FX_LIGHT.noon);
    const dusk = fxDay([60, 70, 100]);
    expect(dusk).toBeLessThan(FX_LIGHT.night);
    expect(dusk).toBeGreaterThan(FX_LIGHT.noon);
    expect(fxDay(null)).toBe(FX_LIGHT.night);
  });

  it('writes a block that compiles, with its strongest-N lights and its own names', () => {
    const src = fxLightScript({ day: 0.5 });
    expect(() => new Function('THREE', 'scene', 'window', `${src}; return 1;`)).not.toThrow();
    expect(src).toContain(`uFxP[${FX_LIGHT.max}]`);
    expect(src).not.toMatch(/__fx(Seen|Push|U|L)\b/);   // the fx channel's names are its own
  });
});

describe('effect light: the channels', () => {
  it('throws a beam\'s and a moment\'s light only when asked', () => {
    const specs = [BEAMS.orb, BEAMS.laser];
    expect(beamScript(specs)).toBe(beamScript(specs, { fx: false }));
    expect(beamScript(specs)).not.toContain('__fxlPush');
    const on = beamScript(specs, { fx: true });
    expect(on.match(/__fxlPush\(/g).length).toBeGreaterThanOrEqual(3);   // the head, a ray's body, the charge
    expect(momentScript(['strike', 'sparks'])).not.toContain('__fxlPush');
    expect(momentScript(['strike', 'sparks'], { fx: true })).toContain('__fxlPush');
  });

  it('carries the block and its step in a world whose events ask, and nothing in one that does not', () => {
    const entities = [{ id: 'a', rule: { type: 'walk' }, transform: { pos: [0, 0, 0] }, body: { type: 'none' } }, { id: 'b', rule: { type: 'static' }, transform: { pos: [6, 0, 0] }, body: { type: 'none' } }];
    const ev = lowerPlay({ entities, play: { cues: [{ id: 'x', when: { start: true }, then: { beam: { who: 'a', to: 'b', is: 'orb' } } }] } }, { player: 'a' });
    const off = eventsChannelScript(ev), on = eventsChannelScript({ ...ev, fxLight: true }, { fxDay: 1 });
    expect(off).not.toContain('__stepFxLight');
    expect(on).toContain('__stepFxLight();');
    expect(on).toContain('const __FXLR = ');
  });
});
