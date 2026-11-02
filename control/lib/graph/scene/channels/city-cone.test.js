/**
 * The city on the view cone (scene/channels/city-cone.js): a near repeat that carries `cone` is shown by the cone's rule
 * rather than the ring. Its near level inside the reach and its far twin past it are complementary (no tree twice, none
 * missing); its kit shows while it covers a few pixels; the air takes what it has fully swallowed; all within the ring a
 * tile without the cone keeps. Absent any `cone`, not one byte.
 */
import { describe, expect, it } from 'vitest';

import { CITY_CONE, cityConeRule } from './city-cone.js';
import { emitThreeWorld } from '../scene-three.js';

// (the rule run as the page runs it, over tiles laid by hand: a tile { c, x, y, r, b: box, h })
const run = (tiles, p, win = {}) => { new Function('__nearTiles', 'p', 'window', cityConeRule())(tiles, p, win); return tiles.map((t) => t.im.visible); };
const tile = (c, x, y, extra = {}) => ({ c, x, y, r: 440, b: [x - 24, y - 24, 0, x + 24, y + 24, 14], h: 14, im: { visible: null }, ...extra });

describe('the city on the view cone', () => {
  it('shows a pair\'s near level inside the reach and its far twin past it: never both, never neither, within the ring', () => {
    for (let k = 0; k < 40; k++) {
      const x = (k * 37) % 400 - 200, y = (k * 53) % 400 - 200, eye = { x: 0, y: 0, z: 1.7 }, reach = 20 + (k % 7) * 15;
      const [inn, out] = run([tile('in', x, y), tile('out', x, y)], eye, { __mojCone: { reach, px: CITY_CONE.px } });
      const inRing = x * x + y * y < 440 * 440;
      expect(inn && out).toBe(false);
      expect(inn || out).toBe(inRing);
    }
  });

  it('shows the kit while its height covers a few pixels, and only within the ring', () => {
    const px = 0.0015, near = 14 / (CITY_CONE.kitPx * px);
    expect(run([tile('kit', 0, 60)], { x: 0, y: 0, z: 1.7 }, { __mojCone: { reach: 40, px } })[0]).toBe(true);
    const small = tile('kit', 0, 300, { h: 0.5 });
    expect(run([small], { x: 0, y: 0, z: 1.7 }, { __mojCone: { reach: 40, px } })[0]).toBe(300 - 24 < 0.5 / (CITY_CONE.kitPx * px));
    expect(near).toBeGreaterThan(400);
    expect(run([tile('kit', 0, 900)], { x: 0, y: 0, z: 1.7 }, { __mojCone: { reach: 40, px } })[0]).toBe(false);
  });

  it('leaves out what the air has fully taken, and keeps the ring for a tile without the cone', () => {
    const fogged = { __mojCone: { reach: 40, px: 0.0015 }, __mojAir: { taken: (ez, x, y, z) => Math.hypot(x, y, z) * 0.05 > 6 } };
    const [near, far] = run([tile('kit', 0, 60), tile('kit', 0, 200)], { x: 0, y: 0, z: 1.7 }, fogged);
    expect(near).toBe(true);
    expect(far).toBe(false);
    const plain = { x: 0, y: 100, r: 150, im: { visible: null } };
    expect(run([plain], { x: 0, y: 0, z: 1.7 })[0]).toBe(true);
  });

  it('is on the page only when a near repeat carries it, its pair tiled finer than the ring\'s', () => {
    const tpl = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], normal: [0, 0, 1], fill: '#888888' }];
    const base = { faces: tpl, inline: true }, rep = (extra) => ({ group: 'g', template: tpl, transforms: [{ pos: [0, 0, 0] }], near: 320, ...extra });
    const plain = emitThreeWorld({ ...base, repeats: [rep({})] }), coned = emitThreeWorld({ ...base, repeats: [rep({ cone: 'in' }), rep({ cone: 'out' })] });
    expect(plain).not.toContain('window.__mojCone, A = window.__mojAir');
    expect(coned).toContain('window.__mojCone, A = window.__mojAir');
    expect(coned).toContain(`r.cone && r.cone !== 'kit' ? ${CITY_CONE.tile} :`);
    // (a word the rule does not know is not carried: the ring stands)
    expect(emitThreeWorld({ ...base, repeats: [rep({ cone: 'sideways' })] })).toBe(plain);
  });
});
