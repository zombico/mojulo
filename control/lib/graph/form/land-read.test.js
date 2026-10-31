/**
 * The land read as form (form/land-read.js): a small meru island's payload read twice gives the same read; a payload
 * with no land reads as nothing; every vertex its face's; the sward in the grass map's fourth channel.
 */
import { describe, expect, it } from 'vitest';

import { landRead, formPayload, SWARD_MEDIUM, GRASS_OFF } from './land-read.js';
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

  it('the sward rides the grass map\'s fourth channel: its length, tall, medium or short, in areas each wholly one', () => {
    const P = payload('grass'), alpha = (sward) => {
      const R = landRead(P, C, { grass: 'map', sward });
      // (the World page's read: the map alone, its brush grown on the page)
      expect(R.brush.pos.length).toBe(0);
      // (the grass's own cells: where cover is)
      const px = Buffer.from(formPayload(R).grass.px, 'base64'), a = [];
      for (let q = 0; q < px.length / 4; q++) if (px[q * 4 + 2] > 0) a.push(px[q * 4 + 3]);
      return a;
    };
    expect(new Set(alpha({ medium: 0 }))).toEqual(new Set([0]));
    expect(new Set(alpha('short'))).toEqual(new Set([255]));
    // (the share is the land's grass, whatever the island's size; areas, not a sprinkle: most cells at one length)
    const third = alpha({ short: 0.3, medium: 0 });
    expect(third.filter((v) => v > 191).length / third.length).toBeCloseTo(0.3, 1);
    expect(third.filter((v) => v === 0 || v === 255).length / third.length).toBeGreaterThan(0.7);
    // (a long sward lays stretches of it medium, SWARD_MEDIUM, between its tall ones; named, its own share)
    const meadow = alpha('tall'), at = (a, lo, hi) => a.filter((v) => v >= lo && v <= hi).length / a.length;
    expect(at(meadow, 64, 191)).toBeCloseTo(SWARD_MEDIUM.share, 1);
    expect(at(meadow, 0, 0) + at(meadow, 127, 128)).toBeGreaterThan(0.7);
    expect(at(alpha({ medium: 0.2 }), 64, 191)).toBeCloseTo(0.2, 1);
  }, 120_000);

  it('no grass in the ground a thing has claimed (its plants\' `clear`), thin and short at its edge, the rest as it was', () => {
    const P = payload('grass'), map = (Q) => { const G = formPayload(landRead(Q, C, { grass: 'map' })).grass; return { G, px: Buffer.from(G.px, 'base64') }; };
    const A = map(P), [nx] = A.G.size, cellXY = (q) => [A.G.origin[0] + (q % nx) * A.G.cell, A.G.origin[1] + Math.floor(q / nx) * A.G.cell];
    // (a claim on the thickest grass)
    let best = 0; for (let q = 0; q < A.px.length / 4; q++) if (A.px[q * 4 + 2] > A.px[best * 4 + 2]) best = q;
    const [cx, cy] = cellXY(best), r = 1.2, B = map({ ...P, plants: { clear: [[cx, cy, r]] } });
    for (let q = 0; q < A.px.length / 4; q++) {
      const d = Math.hypot(cellXY(q)[0] - cx, cellXY(q)[1] - cy), a = A.px[q * 4 + 2], b = B.px[q * 4 + 2];
      if (d < r) expect(b).toBe(0);
      else if (d < r + GRASS_OFF) expect(b).toBeLessThanOrEqual(a);
      else expect(b).toBe(a);
    }
    // (no claim, no change: the same map)
    expect(map({ ...P, plants: { clear: [] } }).px.equals(A.px)).toBe(true);
  }, 120_000);

  it('the drifts hold their shares of the land\'s grass, no two in one cell', () => {
    const R = landRead(payload('grass'), C, { grass: 'map', drifts: [{ id: 'wheat', share: 0.3 }, { id: 'chaff', share: 0.2 }] });
    const px = Buffer.from(formPayload(R).grass.px, 'base64'), dp = Buffer.from(formPayload(R).grass.drifts.px, 'base64');
    let n = 0; const got = [0, 0];
    for (let q = 0; q < px.length / 4; q++) {
      if (px[q * 4 + 2] === 0) { expect(dp[q * 4] + dp[q * 4 + 1]).toBe(0); continue; }
      n++; if (dp[q * 4] > 127) got[0]++; if (dp[q * 4 + 1] > 127) got[1]++;
      expect(dp[q * 4] > 127 && dp[q * 4 + 1] > 127).toBe(false);
    }
    expect(got[0] / n).toBeCloseTo(0.3, 1);
    expect(got[1] / n).toBeCloseTo(0.2, 1);
    expect(formPayload(R).grass.drifts.kinds.map((k) => k.id)).toEqual(['wheat', 'chaff']);
  }, 120_000);

  it('a payload with no land reads as nothing', () => {
    expect(landRead({ faces: [{ group: 'meru:stone', corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] }], cameras: [] }, C)).toBeNull();
  });
});
