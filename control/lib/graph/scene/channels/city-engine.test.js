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
  it('a city car\'s sound design: the car at the wheel (the pilot while it is driven, its rider the one who got in), the door opened and shut, the engine started a moment after and stopped on getting out; its growl, its road, its screech, the brakes and the gears', () => {
    const cab = block(audioChannelScript({ engine: { voice, top: 28, level: 0.3, idle: 0.12, cab: true, drive: { load: { voice, level: 0.4 } } }, cues: {} }));
    expect(cab).toContain('const P = E.cab ? (P0 && P0.mount && P0.riderId ? P0 : null) : P0;');
    expect(cab).toContain("__cp && __cp.mount ? __cw.byId[__cp.riderId]");
    for (const k of ['car:door', 'car:open', 'car:start', 'car:off']) expect(cab).toContain(`__cue('${k}'`);
    for (const k of ['car:crash', 'car:horn', 'car:brake', 'car:shift']) expect(cab).toContain(`__AUDIO.cues['${k}']`);
    expect(cab).toMatch(/ev\.code === 'KeyH'/);
    // (the engine runs only once the starter has caught: started on getting in, stopped on getting out; no idle on foot)
    expect(cab).toContain('const __rides = !!K.started && __phase === \'ride\';');
    expect(cab).toContain('if (__rides && !H) {');
    for (const k of ['K.load.set(', 'K.road.set(', 'K.skid.set(']) expect(cab).toContain(k);
    expect(cab).toContain('if (H) H.set(__beatsMuted || !P ? 0 : __rev(K.speed));');
    // (its revs through gears: each gear climbs and the next drops it back; the gear it is in)
    const fns = new Function('E', `${cab.match(/const __GEARS = [^\n]*\n/)[0]}${cab.match(/const __rev = [^\n]*\n/)[0]}${cab.match(/const __gearOf = [^\n]*\n/)[0]}return [__rev, __gearOf];`)({ idle: 0.12, top: 28 });
    const [rev, gearOf] = fns;
    expect(rev(0)).toBe(0.12);
    expect(rev(4.9)).toBeGreaterThan(rev(2)); expect(rev(5.4)).toBeLessThan(rev(4.9));
    expect(rev(28)).toBeCloseTo(1, 5);
    expect(gearOf(0)).toBe(0); expect(gearOf(28)).toBe(4); expect(gearOf(12)).toBeGreaterThan(gearOf(4));
    expect(() => new Function(cab.replace(/^[^\n]*\n/, ''))).not.toThrow();
  });
  it('a place\'s ambience is held under the bed, quieter in a car; absent, not a byte', () => {
    const on = audioChannelScript({ ambience: { voice, level: 0.3 } }), off = audioChannelScript({});
    expect(on).toContain('__beatsAmbience'); expect(off).not.toContain('__beatsAmbience');
  });
  it('the level\'s audio keeps the engine\'s `cab` through the world\'s read', () => {
    expect(resolveWorldAudio({ engine: { voice: 'car-engine', top: 28, cab: true } }).engine).toMatchObject({ top: 28, cab: true });
    expect(resolveWorldAudio({ engine: { voice: 'car-engine', top: 28 } }).engine.cab).toBeUndefined();
    // (its drive's held voices, by their shelf words, and a place's ambience)
    const A = resolveWorldAudio({ engine: { voice: 'road-car-engine', top: 28, cab: true, drive: { load: { voice: 'road-car-load' }, road: { voice: 'road-roar', level: 0.3 }, skid: { voice: 'tire-squeal' } } }, ambience: { voice: 'traffic-hum' } });
    expect(Object.keys(A.engine.drive)).toEqual(['load', 'road', 'skid']); expect(A.engine.drive.road.level).toBe(0.3);
    expect(A.ambience.voice.layers.length).toBeGreaterThan(0);
  });
});
