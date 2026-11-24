// Keying in play (keying.js): a level's animated bodies posed on their layer's key and held between, the world and the
// camera on ones; a page without `keying` keeps every byte.

import { describe, it, expect } from 'vitest';
import { readKeying, keyClock, KEY_FPS } from './keying.js';

// the keys each layer takes over `seconds` of frames at `hz`
function keysOver(K, seconds, hz = 60) {
  const c = keyClock(K), n = { hero: 0, cast: 0 };
  for (let i = 0; i < Math.round(seconds * hz); i++) { const d = c.step(1 / hz); for (const L of ['hero', 'cast']) if (d[L]) n[L]++; }
  return n;
}

describe('a world\'s keying, read', () => {
  it('takes a grain for every layer, or a layer each; all on ones is nothing', () => {
    expect(readKeying('twos')).toEqual({ hero: 2, cast: 2, fps: KEY_FPS.rest });
    expect(readKeying(3)).toEqual({ hero: 3, cast: 3, fps: KEY_FPS.rest });
    expect(readKeying({ cast: 'twos', hero: 'ones' })).toEqual({ hero: 1, cast: 2, fps: KEY_FPS.rest });
    expect(readKeying({ cast: 'threes' })).toMatchObject({ hero: 3, cast: 3 });   // (the hero is the cast's unless it says)
    expect(readKeying({ cast: 'twos', fps: 30, root: 'held' })).toEqual({ hero: 2, cast: 2, fps: 30, root: 'held' });
    for (const none of [undefined, null, false, 'ones', 1, { hero: 'ones' }]) expect(readKeying(none)).toBeNull();
  });

  it('teaches on what it does not take', () => {
    expect(() => readKeying('fours')).toThrow(/ones, twos or threes/);
    expect(() => readKeying({ cast: 'twos', fps: 200 })).toThrow(/fps is a number/);
    expect(() => readKeying({ cast: 'twos', root: 'stepped' })).toThrow(/root is 'held'/);
    expect(() => readKeying({ bodies: 'twos' })).toThrow(/bodies is not a key/);
    expect(() => readKeying(['twos'])).toThrow(/a grain/);
  });
});

describe('the key clock', () => {
  // (over ten seconds: the first frame is a key, and so is the one that closes the tenth second)
  it('keys twos twelve times a second and threes eight at film\'s 24, whatever the frame rate', () => {
    expect(keysOver(readKeying('twos'), 10)).toEqual({ hero: 121, cast: 121 });
    expect(keysOver(readKeying('threes'), 10, 144)).toEqual({ hero: 81, cast: 81 });
    expect(keysOver(readKeying({ cast: 'twos', fps: 30 }), 10)).toEqual({ hero: 151, cast: 151 });
  });

  it('keeps each layer on its own grain, a layer on ones keyed every frame', () => {
    expect(keysOver(readKeying({ hero: 'ones', cast: 'threes' }), 10)).toEqual({ hero: 600, cast: 81 });
  });

  it('keys the first frame, holds between, and drops the backlog of a long frame', () => {
    const c = keyClock(readKeying('twos'));
    expect(c.step(1 / 60).cast).toBe(true);
    expect([c.step(1 / 60), c.step(1 / 60), c.step(1 / 60)].map((d) => d.cast)).toEqual([false, false, false]);
    expect(c.step(1 / 60).cast).toBe(true);   // (the fifth frame: 5/60 s past a key of 1/12 s)
    expect(c.step(1).cast).toBe(true);         // (a second's stall keys once)
    expect(c.step(1 / 60).cast).toBe(false);
  });
});

describe('keying on the page', () => {
  it('a world with a keying composes the key clock in place of the plain sync; one without keeps every byte', async () => {
    const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
    const floor = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]], fill: '#556' };
    const body = () => ({ type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] });
    const base = { faces: [floor], entities: [{ id: 'p', rule: { type: 'walk', speed: 4 }, pilotable: true, body: body() }], camera: { rule: 'follow', target: 'p' } };
    const plain = emitThreeWorld(base);
    const keyed = emitThreeWorld({ ...base, keying: readKeying('twos') });
    for (const s of ['__keySync', '__kyClock', 'KEYING IN PLAY']) { expect(keyed).toContain(s); expect(plain).not.toContain(s); }
    expect(keyed).not.toContain('for (const e of __world.entities) __syncEntity(e, dt);');
    expect(keyed).toContain('m.position.set(e.transform.pos[0]');   // (a held pose follows its place)
    // a held root steps the place with the pose: nothing is moved off the key
    const held = emitThreeWorld({ ...base, keying: readKeying({ cast: 'twos', root: 'held' }) });
    expect(held).toContain('__keySync');
    expect(held.slice(held.indexOf('function __keySync'))).not.toMatch(/^[^}]*m\.rotation\.z = e\.transform\.heading/);
    expect(emitThreeWorld({ ...base, keying: null })).toBe(plain);
  });
});
