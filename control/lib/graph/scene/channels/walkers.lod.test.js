/**
 * The walkers' near figure (scene/channels/walkers.js WALKER_DETAIL): a passer-by that names one (`near`, a realistic
 * person's near crowd figure) is drawn as it within its near reach of the camera and as its own figure past it, its near
 * rig built the first time it is wanted. No walker naming one: the channel is as it was, byte for byte.
 */
import { describe, expect, it } from 'vitest';

import { WALKER_DETAIL, walkersChannelScript } from './walkers.js';

const f32 = (a) => Buffer.from(new Float32Array(a).buffer).toString('base64'), u8 = (a) => Buffer.from(Uint8Array.from(a)).toString('base64');
const fig = (n) => ({ rig: true, figH: 1.8, bones: [{ id: 'a', head: [0, 0, 0] }], parts: [{ pos: f32(Array(9 * n).fill(0).map((_, i) => i % 3 === 2 ? 1 : 0.1 * i)), col: u8(Array(9 * n).fill(200)), faces: n }], clips: { forward: { k: 1, b: [0, 0, 0, 1, 0, 0, 0] } } });
const walker = (o = {}) => ({ figure: 'p', path: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 0, 0]], speed: 1, ...o });

describe('the walkers\' near figure', () => {
  it('names nothing: the channel as it was', () => {
    const bank = { p: fig(2) };
    expect(walkersChannelScript([walker()], bank)).not.toContain('__wTier');
    // (a near name with no figure behind it is no near figure)
    expect(walkersChannelScript([walker({ near: 'p:near' })], bank)).toBe(walkersChannelScript([walker({ near: 'p:near' })], bank));
    expect(walkersChannelScript([walker({ near: 'p:near' })], bank)).not.toContain('__wTier');
  });
  it('names one: the tier chosen each frame on the walker\'s reach, the near rig built when first wanted', () => {
    const src = walkersChannelScript([walker({ near: 'p:near' })], { p: fig(2), 'p:near': fig(8) });
    expect(src).toContain('function __wTier(r)');
    expect(src).toContain(`const __wNear = ${WALKER_DETAIL.near};`);
    expect(src).toContain('"p:near"');
    // (built lazily: the walker's far rig up front, its near rig inside the tier's choice)
    expect(src.indexOf('r.rigs.near = ')).toBeGreaterThan(src.indexOf('function __wTier'));
  });
});
