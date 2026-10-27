/**
 * The land read as form (form/land-read.js): a small meru island's payload read twice gives the same read; a payload
 * with no land reads as nothing; every vertex its face's; the sward in the grass map's fourth channel.
 */
import { describe, expect, it } from 'vitest';

import { landRead, formPayload } from './land-read.js';
import { readGeocube } from '../era/geocube.js';
import { assembleStageScene } from '../era/stage.js';

// the smallest island with a beach and a mound (as local-meru/island-scale.test.js builds it), under island-noon's colours
const payload = (cover = 'soil') => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }], island: { geology: true, walk: 'none', cover } } }, {});

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

  it('the sward rides the grass map\'s fourth channel: all tall, all short, or areas wholly one or the other', () => {
    const P = payload('grass'), alpha = (sward) => {
      const R = landRead(P, C, { grass: 'map', sward });
      // (the World page's read: the map alone, its brush grown on the page)
      expect(R.brush.pos.length).toBe(0);
      // (the grass's own cells: where cover is)
      const px = Buffer.from(formPayload(R).grass.px, 'base64'), a = [];
      for (let q = 0; q < px.length / 4; q++) if (px[q * 4 + 2] > 0) a.push(px[q * 4 + 3]);
      return a;
    };
    expect(new Set(alpha('tall'))).toEqual(new Set([0]));
    expect(new Set(alpha('short'))).toEqual(new Set([255]));
    // (the share is the land's grass, whatever the island's size; areas, not a sprinkle: most cells at one end or the other)
    const third = alpha({ short: 0.3 });
    expect(third.filter((v) => v > 127).length / third.length).toBeCloseTo(0.3, 1);
    expect(third.filter((v) => v === 0 || v === 255).length / third.length).toBeGreaterThan(0.7);
  }, 120_000);

  it('a payload with no land reads as nothing', () => {
    expect(landRead({ faces: [{ group: 'meru:stone', corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] }], cameras: [] }, C)).toBeNull();
  });
});
