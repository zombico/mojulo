// A stage under a sun or a moon in the form render (era/stage.js formLightFaces with `sun`; form/room-light.js
// solveDayLight): baked as a room is, its colour and its light apart, the sun beside its lamps. One small plaza with no
// dress, read by day and by night, in both eras.
import { describe, it, expect } from 'vitest';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { solveDayLight } from '../form/room-light.js';
import { formScript, FORM_PAGE } from '../scene/channels/form.js';

const PLAZA = { kind: 'stage', kit: 'island-plaza', reference: 'island-noon', dress: false, rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 10, h: 4 }] };
const read = async (extra, opts) => (await resolveWorldScene({ manifest: { ...PLAZA, ...extra }, title: 't' }, opts)).payload;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('a stage under a sun in the form render', () => {
  it('by day its faces carry their light apart from their colour, the sun a lamp far off; in gen-6 and for an engine it is paint', async () => {
    const g7 = await read({}, { era: 'gen-7' }), g6 = await read({}, {});
    expect(g6.form).toBeUndefined();
    expect(g6.faces.some((f) => f.cornerLight !== undefined)).toBe(false);
    const R = g7.form.room, sun = R.lights[R.lights.length - 1];
    expect(R.sun.ground).toHaveLength(3);
    expect(sun.radius).toBeGreaterThan(1e8);
    expect(sun.at[2]).toBeGreaterThan(0);
    // (a floor the sun reaches is brighter than one corner it does not, and the sun's part is what differs)
    const lit = g7.faces.filter((f) => f.cornerLight !== undefined && Array.isArray(f.cornerLight[0]));
    const ups = lit.filter((f) => f.normal[2] > 0.9).flatMap((f) => f.cornerLight.map(lum));
    expect(Math.max(...ups)).toBeGreaterThan(Math.min(...ups) * 1.5);
    // (a face turned down takes the ambient and the ground's bounce: the page's `ground`)
    const down = lit.find((f) => f.normal[2] < -0.9);
    if (down) expect(lum(down.cornerLight[0])).toBeLessThanOrEqual(lum(R.sun.ground) + 1e-3);
    // (an engine's handoff of a sunlit stage is paint, as it was)
    const hand = await read({}, { era: 'gen-7', unshaded: true, handoff: true });
    expect(hand.form).toBeUndefined();
    // (deterministic)
    expect(JSON.stringify((await read({}, { era: 'gen-7' })).form.room.lights)).toBe(JSON.stringify(R.lights));
  }, 120_000);

  it('at night the moon is the sun and the lanterns stand beside it, each brighter by it than the moon', async () => {
    const n7 = await read({ time: 'night', dress: undefined }, { era: 'gen-7' }), R = n7.form.room;
    expect(R.sun).toBeDefined();
    const moon = R.lights[R.lights.length - 1], lamps = R.lights.slice(0, -1);
    expect(lamps.length).toBeGreaterThan(0);
    expect(Math.max(...lamps.map((l) => lum(l.key)))).toBeGreaterThan(lum(moon.key));
  }, 120_000);

  it('the solve: a surface square to the sun shows its target; the lamps are in the sun\'s share', () => {
    const sun = { rgb: [1, 0.95, 0.85], gain: 0.7, bounce: [0.9, 0.8, 0.6], bounceGain: 0.15 }, lamp = { color: '#ffb060', intensity: 0.9, radius: 7 };
    const S = solveDayLight({ targets: { wall: '#806848' }, ambient: [0.3, 0.33, 0.4], sun, lights: [lamp] });
    expect(lum(S.sun)).toBeGreaterThan(lum(S.ambient));
    expect(lum(S.bounce)).toBeLessThan(lum(S.sun));
    // (a dimmer sun leaves the same lamp a larger share of it)
    const dim = solveDayLight({ targets: { wall: '#806848' }, ambient: [0.3, 0.33, 0.4], sun: { ...sun, gain: 0.2 }, lights: [lamp] });
    expect(lum(dim.keys[0]) / lum(dim.sun)).toBeGreaterThan(lum(S.keys[0]) / lum(S.sun));
  });

  it('the page keeps the sun in its live set whatever lamp stands nearer; a room\'s page carries none of that', () => {
    const page = (cfg) => formScript({ ...FORM_PAGE, ...cfg, maps: {} }), lamp = { at: [0, 0, 2], key: [1, 1, 1], radius: 6, live: true };
    expect(page({ lights: [lamp, { at: [0, 0, 1e6], key: [1, 1, 1], radius: 1e9, live: true }], ambient: [0.1, 0.1, 0.1], fall: 2, sun: { ground: [0.1, 0.1, 0.1] } })).toContain('l.r > 1e8 ? -1 : ');
    expect(page({ lights: [lamp], ambient: [0.1, 0.1, 0.1], fall: 2 })).not.toContain('l.r > 1e8');
  });
});
