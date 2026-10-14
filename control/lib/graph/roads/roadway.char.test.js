// Characterization pin: the freeway corridor (the 401 by Pearson, the spike's default) is a compatibility promise.
// Design classes, closed alignments, hills and ramps are additive: the corridor's plan must not move by a byte.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { planRoadway } from './roadway.js';

const h = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('the freeway corridor, pinned', () => {
  it('faces and lane graph are byte-identical', () => {
    const p = planRoadway({});
    expect({ faces: h(p.faces), roadway: h(p.roadway ?? p.lanes ?? null) }).toMatchInlineSnapshot(`
      {
        "faces": "edb0f165adc22ef84fe6fdb3ecbe34a68fabc3472fc477034b820c6f8ee58118",
        "roadway": "1a749b91a08e6948868ba1b9a9f1129ccb11d6bafb3512b146825fc37dc357ee",
      }
    `);
  });
});
