/**
 * The land read as form (form/land-read.js): a small meru island's payload read twice gives the same read; a payload
 * with no land reads as nothing; every vertex its face's.
 */
import { describe, expect, it } from 'vitest';

import { landRead } from './land-read.js';
import { readGeocube } from '../era/geocube.js';
import { assembleStageScene } from '../era/stage.js';

// the smallest island with a beach and a mound (as local-meru/island-scale.test.js builds it), under island-noon's colours
const payload = () => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }], island: { geology: true, walk: 'none', cover: 'soil' } } }, {});

describe('landRead', () => {
  const C = readGeocube('island-noon');

  it('reads the same payload the same way, byte for byte, every vertex its face\'s', () => {
    const P = payload(), a = landRead(P, C), b = landRead(payload(), C);
    expect(a.pos).toEqual(b.pos);
    expect(a.c7).toEqual(b.c7);
    expect(a.spl).toEqual(b.spl);
    expect(a.faceOf.length * 3).toBe(a.pos.length);
    // (the faces' classes read, the sea found, the layers' atlases painted)
    expect(a.L.unread).toBe(0);
    expect(a.L.waterZ).not.toBeNull();
    expect(a.png(a.A.base).startsWith('data:image/png;base64,')).toBe(true);
  }, 120_000);

  it('a payload with no land reads as nothing', () => {
    expect(landRead({ faces: [{ group: 'meru:stone', corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] }], cameras: [] }, C)).toBeNull();
  });
});
