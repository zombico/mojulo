// The space ground: a frame's gravity by name, its jump reaching the same height slower under a lighter one; a field
// cut from an airless cube heard and drawn as airless (no wind, no air in its sky); every other frame and page as it was.
import { describe, expect, it } from 'vitest';
import { frameEntity, frameGravity, FRAME_GRAVITY, FRAME_WORLD } from './pilot.js';
import { MASSIF_FORMS, frameFieldCube } from './field.js';
import { readGeocube } from '../era/geocube.js';
import { frameAudio } from '../gameworld/frame-sound.js';
import { formSkyScript } from '../scene/channels/form-sky.js';

const apex = (e, g) => (e.rule.move.jump ** 2) / (2 * g);

describe('the space ground', () => {
  it('names its gravities, and refuses one it cannot read, teaching', () => {
    expect(frameGravity('planetary')).toBe(FRAME_WORLD.gravity);
    expect(frameGravity('space')).toBeLessThan(frameGravity('planetary') / 2);
    expect(frameGravity(3.71)).toBe(3.71);
    expect(() => frameGravity('zero')).toThrow(/planetary \| space/);
  });

  it('a frame under a lighter gravity jumps as high, slower, and lands hard only falling faster than it can there', () => {
    const own = frameEntity('vanguard', { id: 'p', at: [0, 0, 0] }), light = frameEntity('vanguard', { id: 'p', at: [0, 0, 0], gravity: FRAME_GRAVITY.space });
    expect(apex(light, FRAME_GRAVITY.space)).toBeCloseTo(apex(own, FRAME_WORLD.gravity), 0);
    expect(light.rule.move.jump / FRAME_GRAVITY.space).toBeGreaterThan(own.rule.move.jump / FRAME_WORLD.gravity);
    expect(light.rule.hardLand).toBeLessThan(18);
    // (the frame's own gravity changes nothing: the same entity, byte for byte)
    expect(JSON.stringify(frameEntity('vanguard', { id: 'p', at: [0, 0, 0], gravity: FRAME_WORLD.gravity }))).toBe(JSON.stringify(own));
    expect(own.rule.hardLand).toBeUndefined();
  });

  it('an airless field is heard and drawn airless; one with air as it was', () => {
    const airless = Object.entries(MASSIF_FORMS).find(([, id]) => readGeocube(id).light.heavens?.void);
    expect(airless).toBeTruthy();
    expect(readGeocube(frameFieldCube(airless[0])).light.heavens.void).toBeTruthy();
    expect(frameAudio({ airless: true }).wind).toBeUndefined();
    expect(frameAudio({}).wind).toBeTruthy();
    expect(formSkyScript({ airless: true })).toContain('U.uA.value.set(0, 0, 0)');
    expect(formSkyScript({})).toBe(formSkyScript({ airless: false }));
    expect(formSkyScript({})).not.toContain('uA.value.set');
  });
});
