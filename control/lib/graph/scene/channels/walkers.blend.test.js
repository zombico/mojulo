/**
 * The walkers' blend (scene/channels/walkers.js): a figure drawn as one skin, each corner placed by the bones it is
 * weighed to, so a body that bends along its length opens no seam between its parts; asked a walker at a time, on a
 * figure that carries its skin, and measured before it is asked (walkerSkinStretch). Absent, the channel is as it was.
 */
import { describe, expect, it } from 'vitest';

import { WALKER_BLEND, walkerSkinStretch, walkersChannelScript } from './walkers.js';

const f32 = (a) => Buffer.from(new Float32Array(a).buffer).toString('base64'), u8 = (a) => Buffer.from(Uint8Array.from(a)).toString('base64');
// a strip of two triangles along y over two bones end to end, the second bone turned `turn` radians about x at the joint
// (y = 1) in the clip's second key; `skin(v)` a corner's [joints, weights]
const strip = (skin, turn = 0.9) => {
  const C = [[0, 0, 0], [0.2, 0, 0], [0, 1, 0], [0.2, 0, 0], [0.2, 1, 0], [0, 1, 0], [0, 1, 0], [0.2, 1, 0], [0, 2, 0], [0.2, 1, 0], [0.2, 2, 0], [0, 2, 0]];
  const part = (corners) => ({ pos: f32(corners.flat()), col: u8(corners.flatMap(() => [200, 200, 200])), faces: corners.length / 3, jnt: u8(corners.flatMap((c) => skin(c)[0])), wgt: f32(corners.flatMap((c) => skin(c)[1])) });
  const q = [Math.sin(turn / 2), 0, 0, Math.cos(turn / 2)];
  return { rig: true, layered: true, figH: 2, bones: [{ id: 'a', head: [0, 0, 0] }, { id: 'b', head: [0, 1, 0] }], parts: [part(C.slice(0, 6)), part(C.slice(6))],
    clips: { forward: { k: 2, b: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, /* key 2 */ 0, 0, 0, 1, 0, 0, 0, ...q, 0, 1, 0] } } };
};
// (a corner on the joint shared half and half; the rest on its own bone)
const shared = (c) => (c[1] === 1 ? [[0, 1, 0, 0], [0.5, 0.5, 0, 0]] : c[1] < 1 ? [[0, 0, 0, 0], [1, 0, 0, 0]] : [[1, 0, 0, 0], [1, 0, 0, 0]]);
// (a binding that parts: the joint's corners on the far bone in one part, the near in the other, and a far corner on the wrong bone)
const parted = (c) => (c[1] === 2 && c[0] === 0 ? [[0, 0, 0, 0], [1, 0, 0, 0]] : c[1] <= 1 ? [[0, 0, 0, 0], [1, 0, 0, 0]] : [[1, 0, 0, 0], [1, 0, 0, 0]]);
const walker = (o = {}) => ({ figure: 'f', path: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 0, 0]], speed: 1, ...o });

describe('the walkers\' blend', () => {
  it('measures a skin: one that holds keeps its edges, one whose binding parts stretches them', () => {
    const good = walkerSkinStretch(strip(shared)), bad = walkerSkinStretch(strip(parted));
    expect(good.holds).toBe(true);
    expect(good.stretch).toBeLessThan(WALKER_BLEND.holds);
    expect(bad.holds).toBe(false);
    expect(bad.stretch).toBeGreaterThan(good.stretch * 3);
    // (a still clip stretches nothing; a figure with no skin has no measure)
    expect(walkerSkinStretch(strip(parted, 0)).stretch).toBe(0);
    const bare = strip(shared); for (const p of bare.parts) { delete p.jnt; delete p.wgt; }
    expect(walkerSkinStretch(bare)).toBeNull();
    expect(walkerSkinStretch(strip(shared))).toEqual(good);
  });

  it('is asked a walker at a time, on a figure that carries its skin; the bones posed as before, handed to the skin', () => {
    const fig = strip(shared), src = walkersChannelScript([walker({ blend: true })], { f: fig });
    for (const s of ['__buildWalkerSkin', 'uniform mat4 uWB[ 2 ]', 'aWJ', 'userData.prepass', '(r.rig.B ? r.rig.B[bi] : mesh.matrix).compose', '(w.blend && __wCanBlend(fig)) ? __buildWalkerSkin(fig) : __buildWalkerRig(fig)']) expect(src).toContain(s);
    expect(() => new Function('THREE', 'scene', 'decodeF32', 'decodeU8', 'hud', 'controls', 'camera', src)).not.toThrow();
    // (the array is as long as the longest blended figure's bones)
    const long = { ...fig, bones: [...fig.bones, { id: 'c', head: [0, 2, 0] }] };
    expect(walkersChannelScript([walker({ blend: true }), walker({ figure: 'g', blend: true })], { f: fig, g: long })).toContain('uniform mat4 uWB[ 3 ]');
  });

  it('absent, or asked of a figure with no skin, the channel is byte for byte as it was', () => {
    const fig = strip(shared), plain = walkersChannelScript([walker()], { f: fig });
    expect(plain).not.toContain('__buildWalkerSkin');
    expect(plain).toContain('      mesh.matrix.compose(__wv, __wq, __wONE);');
    const bare = strip(shared); for (const p of bare.parts) { delete p.jnt; delete p.wgt; }
    expect(walkersChannelScript([walker({ blend: true })], { f: bare })).toBe(walkersChannelScript([walker()], { f: bare }).replace('"speed":1}', '"speed":1,"blend":true}'));
    expect(walkersChannelScript([walker({ blend: true })], { f: bare })).not.toContain('__buildWalkerSkin');
  });
});
