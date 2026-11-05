import { describe, it, expect } from 'vitest';
import { pageFigures } from './index.js';

// The figure bank as a level's page reads it (pageFigures): a layered figure (station-loft-rig packLayeredRig) leaves its
// skin's joints and weights to the exports, its parts packed as unit rigs' are and its clips on 16 bits; a figure
// byte-identical to an earlier one is named again; a bank with none of these comes back as it was.

const f32 = (a) => Buffer.from(Float32Array.from(a).buffer).toString('base64');
const u8 = (a) => Buffer.from(Uint8Array.from(a).buffer).toString('base64');
const fromF32 = (s) => { const b = Buffer.from(s, 'base64'); return Array.from(new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4)); };
const fromU16 = (s) => { const b = Buffer.from(s, 'base64'); return Array.from(new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2)); };
const fromI16 = (s) => { const b = Buffer.from(s, 'base64'); return Array.from(new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2)); };

// two triangles sharing an edge, as a soup of six corners
const SOUP = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const COL = Array.from({ length: 18 }, () => 200);
const clip = { k: 2, b: [0, 0, 0, 1, 0.1, 0.2, 1.5, 0.7071, 0, 0, 0.7071, -0.3, 0.25, 1.4] };
const layered = (extra = {}) => ({
  rig: true, layered: true, bones: [{ id: 'pelvis', head: [0, 0, 0], tail: [0, 0, 1] }],
  parts: [{ pos: f32(SOUP), col: u8(COL), faces: 2, jnt: u8(Array(24).fill(0)), wgt: f32(Array(24).fill(0.25)), inkFaces: 2 }],
  clips: { idle: clip, wait: { ...clip } }, figH: 1.7, ...extra,
});

describe('the figure bank a level\'s page reads', () => {
  it('a bank with no layered figure and no twins comes back as it was', () => {
    const bank = { car: { rig: true, bones: [], parts: [{ pos: f32(SOUP), col: u8(COL) }], clips: { forward: clip } } };
    const P = pageFigures(bank);
    expect(P.figs).toBe(bank);
    expect(P.same).toEqual({});
  });

  it('a layered figure: no skin weights, its part indexed on a uint16 grid, the same triangles', () => {
    const { figs } = pageFigures({ hero: layered() });
    const part = figs.hero.parts[0];
    expect(part.jnt).toBeUndefined();
    expect(part.wgt).toBeUndefined();
    expect(part.pos).toBeUndefined();
    expect(part).toMatchObject({ n: 4, faces: 2, inkFaces: 2 });
    const q = fromU16(part.q), idx = fromU16(part.idx);
    const back = idx.flatMap((i) => [0, 1, 2].map((a) => part.o[a] + q[3 * i + a] * part.s[a]));
    back.forEach((v, i) => expect(v).toBeCloseTo(SOUP[i], 4));
  });

  it('a skinned figure keeps its weights, and a part laid per corner is left as a soup', () => {
    const skinned = pageFigures({ hero: layered({ skin: true }) }).figs.hero.parts[0];
    expect(skinned.wgt).toBeDefined();
    const painted = pageFigures({ hero: { ...layered(), parts: [{ ...layered().parts[0], uv: f32(Array(12).fill(0)) }] } }).figs.hero.parts[0];
    expect(painted.pos).toBeDefined();
    expect(painted.wgt).toBeUndefined();
  });

  it('its clips on 16 bits, within the grain of the decimals they were written in', () => {
    const { figs } = pageFigures({ hero: layered() });
    const b = figs.hero.clips.idle.b, q = fromI16(b.q16);
    expect(q).toHaveLength(clip.b.length);
    const back = q.map((v, i) => (i % 7 < 4 ? v / 32767 : v * b.s));
    back.forEach((v, i) => expect(Math.abs(v - clip.b[i])).toBeLessThan(1e-4));
    // identical clips are identical strings: the bank's pool keeps one
    expect(figs.hero.clips.wait.b.q16).toBe(b.q16);
  });

  it('a figure byte-identical to an earlier one is named again, not written twice', () => {
    const foe = layered();
    const big = { ...foe, clips: { ...foe.clips, long: { k: 300, b: Array.from({ length: 2100 }, (_, i) => (i % 7 < 4 ? 0.5 : i / 1000)) } } };
    const P = pageFigures({ 'foe-1': big, 'foe-2': structuredClone(big), hero: layered() });
    expect(Object.keys(P.figs)).toEqual(['foe-1', 'hero']);
    expect(P.same).toEqual({ 'foe-2': 'foe-1' });
  });

  it('is deterministic', () => {
    expect(JSON.stringify(pageFigures({ hero: layered() }))).toBe(JSON.stringify(pageFigures({ hero: layered() })));
  });
});
