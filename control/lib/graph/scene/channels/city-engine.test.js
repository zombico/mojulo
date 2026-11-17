// A CITY'S CARS, HEARD (sound-sheet.js citySounds → audio.engine.cab): the engine is the car the pilot rides, silent on
// foot; the door as a car is got into and out of, the horn on H, a crash on a hard stop. A ride game's engine (no
// `cab`) is emitted as it always was: not a byte of the city's.
import { describe, it, expect } from 'vitest';
import { audioChannelScript } from './audio.js';
import { resolveWorldAudio } from '../../beats/beats-world.js';

const voice = { type: 'noise' };
const block = (src) => src.slice(src.indexOf("a ride's ENGINE"), src.indexOf('// thruster ROAR'));

describe('the city\'s cars, heard', () => {
  it('a ride game\'s engine carries none of the city\'s: it follows its pilot, as it did', () => {
    const plain = block(audioChannelScript({ engine: { voice, top: 10, level: 0.3, idle: 0.12 } }));
    expect(plain).not.toMatch(/mountedOn|car:door|KeyH/);
    expect(plain).toContain('const ctrl = window.__mojCtrl && window.__mojCtrl.world, P = ctrl');
    expect(plain).not.toContain('__rides');
  });
  it('a city car\'s engine is the ridden car\'s, and the door, the horn and a crash are played from the level\'s cues', () => {
    const cab = block(audioChannelScript({ engine: { voice, top: 28, level: 0.3, idle: 0.12, cab: true }, cues: {} }));
    expect(cab).toContain('const P = E.cab ? (P0 && P0.mountedOn && ctrl.byId[P0.mountedOn]) || null : P0;');
    for (const k of ['car:door', 'car:crash', 'car:horn']) expect(cab).toContain(`__AUDIO.cues['${k}']`);
    expect(cab).toMatch(/ev\.code === 'KeyH'/);
    // (the engine runs only while a car is ridden: started on getting in, stopped on getting out; no idle on foot)
    expect(cab).toContain('if (__rides && !H) {');
    expect(cab).toContain('else if (!__rides && H) { H.stop(); H = null; }');
    expect(cab).toContain('if (H) H.set(__beatsMuted || !P ? 0 : __rev(K.speed));');
    // (its revs through gears: each gear climbs and the next drops it back)
    const rev = new Function('E', `${cab.match(/const __GEARS = [^\n]*\n/)[0]}${cab.match(/const __rev = [^\n]*\n/)[0]}return __rev;`)({ idle: 0.12, top: 28 });
    expect(rev(0)).toBe(0.12);
    expect(rev(4.9)).toBeGreaterThan(rev(2)); expect(rev(5.4)).toBeLessThan(rev(4.9));
    expect(rev(28)).toBeCloseTo(1, 5);
    expect(() => new Function(cab.replace(/^[^\n]*\n/, ''))).not.toThrow();
  });
  it('the level\'s audio keeps the engine\'s `cab` through the world\'s read', () => {
    expect(resolveWorldAudio({ engine: { voice: 'car-engine', top: 28, cab: true } }).engine).toMatchObject({ top: 28, cab: true });
    expect(resolveWorldAudio({ engine: { voice: 'car-engine', top: 28 } }).engine.cab).toBeUndefined();
  });
});
