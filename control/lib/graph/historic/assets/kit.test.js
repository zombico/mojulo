import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { orientBox, localSize, placeAsset } from './kit.js';
import { SUMER_ASSETS } from './sumer.js';
import { PATTERNS } from '../patterns.js';
import { planHistoricCity, assetCall } from '../historic-city.js';
import { SUMER } from '../cultures/sumer.js';

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

describe('historic asset kit', () => {
  const rect = { x: 10, y: 20, w: 6, d: 4 };
  it('turns a local front (−y) to face the slot', () => {
    const front = (f) => { const { W } = localSize(rect, f); return orientBox({ x: 0, y: 0, w: W, d: 0.5 }, rect, f); };
    expect(front('n')).toMatchObject({ x: 10, y: 20, w: 6, d: 0.5 });
    expect(front('s')).toMatchObject({ x: 10, y: 23.5, w: 6, d: 0.5 });
    expect(front('e')).toMatchObject({ x: 15.5, y: 20, w: 0.5, d: 4 });
    expect(front('w')).toMatchObject({ x: 10, y: 20, w: 0.5, d: 4 });
  });
  it('every asset is built from shared patterns and stays on its slot (only a front reach may leave it)', () => {
    for (const A of Object.values(SUMER_ASSETS)) {
      for (const id of A.patterns) expect(PATTERNS[id], `${A.id}: ${id}`).toBeTruthy();
      const w = (A.envelope.w[0] + A.envelope.w[1]) / 2, d = (A.envelope.d[0] + A.envelope.d[1]) / 2;
      const slot = { asset: A.id, rect: { x: 0, y: 0, w, d }, facing: 'n', exposed: true };
      const { boxes } = placeAsset(A, slot, { palette: SUMER.palette, culture: SUMER, rng: () => 0.5 });
      expect(boxes.length, A.id).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(b.x, A.id).toBeGreaterThanOrEqual(-1e-6); expect(b.x + b.w, A.id).toBeLessThanOrEqual(w + 1e-6);
        expect(b.y + b.d, A.id).toBeLessThanOrEqual(d + 1e-6);   // nothing out the back
      }
    }
  });
  it('every slot the layout asks for is in the kit; the asset call reports counts and what is still a placeholder', () => {
    const p = planHistoricCity({ seed: 7 });
    for (const q of p.slots) expect(SUMER_ASSETS[q.asset], q.asset).toBeTruthy();
    const call = assetCall(p, SUMER_ASSETS);
    const zig = call.find((e) => e.asset === 'ziggurat');
    expect(zig).toMatchObject({ count: 1, designed: true });
    expect(call.find((e) => e.asset === 'house-small').count).toBeGreaterThan(10);
    expect(call.reduce((n, e) => n + e.count, 0)).toBe(p.slots.length);
  });
  it('each slot dresses on its own stream: redesigning one asset moves nothing else', () => {
    const base = planHistoricCity({ seed: 7 });
    const kit = { ...SUMER_ASSETS, 'white-temple': { ...SUMER_ASSETS['white-temple'], build: ({ W, D }) => [{ kind: 'temple', x: 0, y: 0, w: W, d: D, z0: 0, z1: 3, tint: '#ffffff' }] } };
    const next = planHistoricCity({ seed: 7, assets: kit });
    const others = (q) => hash(q.boxes.filter((b) => b.asset !== 'white-temple'));
    expect(others(next)).toBe(others(base));
    expect(hash(next.slots)).toBe(hash(base.slots));
  });
});
