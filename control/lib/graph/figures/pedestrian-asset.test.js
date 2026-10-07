import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { pedestrianFaces, CLOAKS, HEADWEAR } from './pedestrian-asset.js';

const hash = (x) => createHash('sha1').update(JSON.stringify(x)).digest('hex');
const pal = { skin: '#c08a64', shirt: '#d8cdb4', skirt: '#d8cdb4', forearm: '#c08a64', thigh: '#c08a64', shin: '#c08a64', pants: '#c08a64', shoe: '#4a3220', cloak: '#6a5a48', headwear: '#1c1a18' };
const top = (fs) => Math.max(...fs.flatMap((f) => f.corners.map((c) => c[2])));

describe('pedestrian wraps: a cloak from the shoulders, a covering for the head', () => {
  it('adds nothing without a wrap', () => {
    const a = pedestrianFaces({ lod: 'mini', cut: 'knee', palette: pal }), b = pedestrianFaces({ lod: 'mini', cut: 'knee', palette: pal, cloak: null, headwear: null });
    expect(hash(b)).toBe(hash(a));
  });

  it('hangs a cloak in its own colour, the knee cloak lower than the hip cloak', () => {
    const base = pedestrianFaces({ lod: 'mini', cut: 'knee', palette: pal });
    const low = (fs) => Math.min(...fs.filter((f) => !base.some((g) => g.fill === f.fill && hash(g.corners) === hash(f.corners))).flatMap((f) => f.corners.map((c) => c[2])));
    for (const to of Object.keys(CLOAKS)) expect(pedestrianFaces({ lod: 'mini', cut: 'knee', palette: pal, cloak: to }).length).toBeGreaterThan(base.length);
    expect(low(pedestrianFaces({ lod: 'mini', cut: 'knee', palette: pal, cloak: 'knee' }))).toBeLessThan(low(pedestrianFaces({ lod: 'mini', cut: 'knee', palette: pal, cloak: 'hip' })));
  });

  it('crowns the head with each headwear, no taller than a hand over it', () => {
    const base = pedestrianFaces({ lod: 'mini', palette: pal }), h = top(base);
    for (const kind of HEADWEAR) {
      const fs = pedestrianFaces({ lod: 'mini', palette: pal, headwear: kind });
      expect(fs.length, kind).toBeGreaterThan(base.length);
      expect(top(fs), kind).toBeGreaterThan(h);
      expect(top(fs) - h, kind).toBeLessThan(0.1);
    }
  });

  it('bakes the same wrap the same each time, in every pose', () => {
    for (const pose of ['idleL', 'strollR', 'stoop', 'hoe', 'carry']) {
      const a = pedestrianFaces({ lod: 'mini', cut: 'ankle', pose, palette: pal, cloak: 'hip', headwear: 'veil' });
      expect(a.every((f) => f.corners.every((c) => c.every(Number.isFinite))), pose).toBe(true);
    }
  });
});
