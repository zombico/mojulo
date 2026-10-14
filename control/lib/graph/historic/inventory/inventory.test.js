// The inventory: a style spoken as a use becomes a kit asset. One case per procedure (a ring, a facing, the paint, a
// small lot, the emitter), the style chosen in code from the inventory, never a hand list.
import { describe, it, expect } from 'vitest';
import { inventoryAsset, inventoryKit, paintFace, languageOf, STYLE_IDS, GROUP_PALETTE } from './index.js';
import { placeAsset } from '../assets/kit.js';
import { toScene } from '../historic-city.js';
import { stream } from '../layout-kit.js';

const style = STYLE_IDS.find((s) => languageOf(s).L.vocab.mass === 'block');   // a flat-walled style: it has a front
const pal = { wall: '#d8c9a8', roof: '#8a4b33', timber: '#4d3a2a' };
const build = (A, slot, seed = 3) => placeAsset(A, slot, { palette: pal, culture: { palette: pal }, rng: stream(seed, 'inv') }).boxes;
const bbox = (bs) => { const ps = bs.flatMap((b) => b.pts); return { x0: Math.min(...ps.map((p) => p[0])), x1: Math.max(...ps.map((p) => p[0])), y0: Math.min(...ps.map((p) => p[1])), y1: Math.max(...ps.map((p) => p[1])), z0: Math.min(...ps.map((p) => p[2])), z1: Math.max(...ps.map((p) => p[2])) }; };

describe('an inventory asset', () => {
  const A = inventoryAsset({ id: 'house', style, use: 'dwelling' }), slot = { rect: { x: 40, y: 20, w: 11, d: 15 }, facing: 'n', z: 1.5 };
  it('is a kit asset: it builds lit panels on its slot, at its level, the same for the same dice', () => {
    const bs = build(A, slot), b = bbox(bs);
    expect(bs.length).toBeGreaterThan(8);
    expect(bs.every((x) => x.solid === 'panel' && x.pts.length >= 3 && /^#[0-9a-f]{6}$/.test(x.tint))).toBe(true);
    expect(b.z0).toBeCloseTo(1.5, 6);
    expect(b.x0).toBeGreaterThan(slot.rect.x - 1.5); expect(b.x1).toBeLessThan(slot.rect.x + slot.rect.w + 1.5);
    expect(JSON.stringify(build(A, slot))).toBe(JSON.stringify(bs));
    expect(JSON.stringify(build(A, slot, 4))).not.toBe(JSON.stringify(bs));
  });
  it('fronts the way its slot faces: its door side on the slot\'s facing edge', () => {
    for (const facing of ['n', 'e', 's', 'w']) {
      const b = bbox(build(A, { ...slot, rect: { x: 0, y: 0, w: 15, d: 15 }, facing })), edge = { n: b.y0, s: 15 - b.y1, w: b.x0, e: 15 - b.x1 }[facing];
      expect(edge, facing).toBeLessThan(0.01);   // the front wall (and its eave) on the facing edge
    }
  });
  it('says less the further it is seen from: far < mid < near', () => {
    const n = (ring) => build(inventoryAsset({ id: 'h', style, use: 'dwelling', ring }), slot).length;
    expect(n('far')).toBeLessThan(n('mid'));
    expect(n('mid')).toBeLessThan(n('near'));
    expect(build(A, { ...slot, ring: 'far' }).length).toBe(n('far'));   // a slot's own ring overrides the asset's
  });
  it('a lot smaller than the use needs is drawn in to fit, never cut lower', () => {
    const big = bbox(build(A, slot)), small = bbox(build(A, { ...slot, rect: { ...slot.rect, w: 4.5, d: 7 } }));
    expect(small.y1 - small.y0).toBeLessThan(7.6);
    expect(small.z1).toBeGreaterThan(big.z0 + 4);
  });
  it('refuses a style or a use the inventory lacks, by name', () => {
    expect(() => inventoryAsset({ id: 'x', style: 'brutalist', use: 'dwelling' })).toThrow(/'brutalist' is not a style/);
    expect(() => inventoryAsset({ id: 'x', style, use: 'cathedral' })).toThrow(/'cathedral' is not a use/);
    expect(Object.keys(inventoryKit({ a: { style, use: 'shop' }, b: { style, use: 'hall' } }))).toEqual(['a', 'b']);
  });
});

describe('the paint', () => {
  it('a group takes its colour from the culture\'s palette, else its own; a face\'s value moves it about the style\'s', () => {
    const nominal = { 'str:plaster': 0.88 };
    expect(paintFace({ plaster: '#ffffff', wall: '#000000' }, nominal, 'str:plaster', 0.88)).toBe('#ffffff');
    expect(paintFace({ wall: '#808080' }, nominal, 'str:plaster', 0.88)).toBe('#808080');
    expect(paintFace({}, nominal, 'str:plaster', 0.88)).toBe(GROUP_PALETTE['str:plaster'].hex);
    const dark = paintFace({ wall: '#808080' }, nominal, 'str:plaster', 0.5), lum = (h) => parseInt(h.slice(1, 3), 16);
    expect(lum(dark)).toBeLessThan(0x80);
  });
});

describe('through the emitter', () => {
  it('its panels become lit scene faces, one or more each', () => {
    const bs = build(inventoryAsset({ id: 'h', style, use: 'shop' }), { rect: { x: 0, y: 0, w: 10, d: 14 }, facing: 's' });
    const { faces, boxes } = toScene(bs, 1);
    expect(boxes).toHaveLength(0);
    expect(faces.length).toBeGreaterThanOrEqual(bs.length);
    expect(faces.every((f) => f.corners.length >= 3 && f.fill)).toBe(true);
  });
});
