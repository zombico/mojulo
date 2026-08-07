/**
 * edifice WORLD_KIND wiring (E2) — the `edifice` kind is registered, walkable, and its
 * resolver returns a renderable World payload with the plan + advisory assessment attached.
 */
import { describe, it, expect } from 'vitest';
import { WORLD_KINDS } from '@/lib/graph/worlds/world-kinds';
import { assembleEdificeScene } from './edifice.js';

const MANIFEST = {
  kind: 'edifice', seed: 3,
  masses: [
    { id: 'hall', at: [0, 0], footprint: { w: 50, d: 40 }, floors: 2, facade: { material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frame: '#333' }, roof: 'flat' },
    { id: 'wing', on: { anchor: 'hall', side: 'E', align: 'center', gap: 12 }, footprint: { w: 28, d: 60 }, floors: 3, facade: { material: 'brick', rhythm: 'punched', glass: '#9a6650', frame: '#6f4636' }, roof: 'mission' },
  ],
  concourses: [{ from: 'hall', to: 'wing', width: 10 }],
  entrance: 'hall',
};

describe('edifice WORLD_KIND', () => {
  it('is registered as a walkable kind with a fogBoxes extractor', () => {
    expect(WORLD_KINDS.edifice).toBeTruthy();
    expect(WORLD_KINDS.edifice.walk).toBe(true);
    const boxes = WORLD_KINDS.edifice.fogBoxes(MANIFEST);
    expect(boxes.length).toBe(3);                 // 2 masses + 1 hall envelope
    expect(boxes.every((b) => Number.isFinite(b.cx) && Number.isFinite(b.hz))).toBe(true);
  });

  it('resolves to a World payload with faces, cameras, walk, plan + assessment', async () => {
    const payload = await WORLD_KINDS.edifice.resolve(MANIFEST, { title: 'Test Edifice' });
    expect(payload.faces.length).toBeGreaterThan(100);
    expect(payload.cameras.length).toBeGreaterThan(0);
    expect(payload.walk).toMatchObject({ spawn: expect.any(Array) });
    expect(payload.title).toBe('Test Edifice');
    expect(payload.edifice.masses).toHaveLength(2);
    expect(payload.reachability.ok).toBe(true);
  });

  it('assembleEdificeScene honors walk:false (a look-only edifice)', () => {
    const payload = assembleEdificeScene({ ...MANIFEST, walk: false });
    expect(payload.walk).toBe(false);
  });
});
