import { describe, it, expect } from 'vitest';
import { resolveWorldScene } from '../worlds/world-scene.js';

// the stage kind through the World route (worlds/world-scene.js): the elements and the doors reach the page payload
const sketch = (manifest) => ({ ref: 'stage-elements', render_mode: 'world', manifest: { kind: 'stage', ...manifest } });
const NAVE = { reference: 'dmc3', kit: 'gothic-nave', rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 24, h: 13 }] };
const PLAZA = { reference: 'sunshine', kit: 'delfino-plaza', rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12 }] };

describe('the stage through the World route', () => {
  it('`fire` resolves the stage\'s baked torches and braziers into the page\'s fire channel; no fireSources leak', async () => {
    const { payload } = await resolveWorldScene(sketch({ ...NAVE, fire: true }));
    expect(payload.fire.sources.filter((s) => s.kind === 'brazier').length).toBe(2);
    expect(payload.fire.sources.every((s) => s.baked)).toBe(true);
    expect(payload.fire.day).toBe(0);
    expect('fireSources' in payload).toBe(false);
  });
  it('`water` brings the fountain\'s jets; doors and items arrive as the stage resolved them', async () => {
    const { payload } = await resolveWorldScene(sketch({ ...PLAZA, water: true,
      doors: [{ id: 'church', at: { house: 1, side: '-x' }, to: { map: 'nave', door: 'west' } }], items: [{ id: 'key', at: [6, 13] }] }));
    expect(payload.jets.length).toBeGreaterThan(0);
    expect(payload.doors.map((d) => d.id)).toEqual(['church']);
    expect(payload.items.map((d) => d.id)).toEqual(['key']);
    expect(payload.fire).toBeUndefined();
  });
});
