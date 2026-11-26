/**
 * The walkers' near figure (scene/channels/walkers.js WALKER_DETAIL): a passer-by that names one (`near`, a realistic
 * person's near crowd figure) is drawn as it within its near reach of the camera and as its own figure past it, its near
 * rig built the first time it is wanted. No walker naming one: the channel is as it was, byte for byte.
 */
import { describe, expect, it } from 'vitest';

import { WALKER_DETAIL, WALKER_LIT, walkersChannelScript } from './walkers.js';

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
  it('names one: the tier chosen each frame on the walker\'s reach, every near rig made up front and hidden, a person\'s body shared', () => {
    const src = walkersChannelScript([walker({ near: 'p:near' })], { p: fig(2), 'p:near': fig(8) });
    expect(src).toContain('function __wTier(r)');
    expect(src).toContain(`const __wNear = ${WALKER_DETAIL.near};`);
    expect(src).toContain('"p:near"');
    // (made while the page warms behind the loading screen, hidden till its walker comes near)
    expect(src).toContain('for (const r of __walkerRigs) if (WBANK[r.w.near]) __wNearRig(r);');
    expect(src).toContain('r.rigs.near.group.visible = false;');
    expect(() => new Function('THREE', 'scene', 'camera', 'decodeF32', 'decodeU8', 'window', src)).not.toThrow();
    // (one skin a person, shared by its walkers: the skinned path)
    const skin = (n) => ({ ...fig(n), parts: fig(n).parts.map((q) => ({ ...q, jnt: u8(Array(4 * 3 * n).fill(0)), wgt: f32(Array(4 * 3 * n).fill(0.25)) })) });
    const sk = walkersChannelScript([walker({ near: 'p:near', blend: true, lit: true }), walker({ near: 'p:near', blend: true, lit: true })], { p: skin(2), 'p:near': skin(8) });
    expect(sk).toContain('let geo = __wSkinGeo.get(fig);');
    expect(() => new Function('THREE', 'scene', 'camera', 'decodeF32', 'decodeU8', 'window', sk)).not.toThrow();
    // (a page without near figures shares nothing: its walkers as they were)
    expect(walkersChannelScript([walker()], { p: fig(2) })).not.toContain('__wSkinGeo');
  });
  it('a lit walker (a realistic person): the scene\'s light on its colours, its floor where none reaches; none lit, not a byte', () => {
    const bank = { p: fig(2) };
    expect(walkersChannelScript([walker()], bank)).not.toContain('MeshLambertMaterial');
    const src = walkersChannelScript([walker({ lit: true })], bank);
    expect(src).toContain('MeshLambertMaterial');
    expect(src).toContain(`totalEmissiveRadiance += diffuseColor.rgb * ${WALKER_LIT.floor};`);
  });
  it('a looped walker\'s head start (startFrac): its place on the loop at clock zero; a held one already has it, none adds nothing', () => {
    const bank = { p: fig(2) };
    expect(walkersChannelScript([walker()], bank)).not.toContain('w.startFrac || 0)) % 1)');
    expect(walkersChannelScript([walker({ startFrac: 0.25 })], bank)).toContain('((sec / r.period + (w.startFrac || 0)) % 1) * r.total');
    expect(walkersChannelScript([walker({ startFrac: 0.25, holds: [] })], bank)).not.toContain('((sec / r.period + (w.startFrac || 0)) % 1)');
  });
});
