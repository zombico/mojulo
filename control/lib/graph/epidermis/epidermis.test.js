/**
 * epidermis — the cube's concepts on one relational head: the brows grow deterministically from their seed, lie on
 * the skin (never inside it, each hair its own length), ride the brow pad's action, and a shape word changes them.
 */
import { describe, expect, it } from 'vitest';

import { readEpidermis, growEpidermis, BROW_SHAPES } from './epidermis.js';
import { relationalHead } from '../polygonizer/head-relational.js';

const head = relationalHead({ sex: 'male' });
const grown = growEpidermis(head, readEpidermis('default'));
const mm = (d) => (d / head.landmarks.H) * 230;
const rootZ = (g) => g.strands.reduce((m, s) => m + s.pts[0].z, 0) / g.strands.length;

describe('the epidermis cube', () => {
  it('reads a preset, and a shape word with numbers over it', () => {
    expect(readEpidermis('default').hair.brows.arch).toBe(BROW_SHAPES.natural.arch);
    const c = readEpidermis({ hair: { brows: { shape: 'arched', density: 0.5 } } });
    expect(c.hair.brows.arch).toBe(BROW_SHAPES.arched.arch);
    expect(c.hair.brows.density).toBe(0.5);
    expect(() => readEpidermis({ hair: { brows: { shape: 'unibrow' } } })).toThrow();
  });
  it('grows the same brows from the same seed, and others from another', () => {
    expect(growEpidermis(head, readEpidermis('default'))).toEqual(grown);
    const other = growEpidermis(head, readEpidermis({ hair: { brows: { seed: 7 } } }));
    expect(other.strands[0].pts[0]).not.toEqual(grown.strands[0].pts[0]);
  });
  it('lays every hair on the skin, never in it, at its own length', () => {
    expect(grown.counts.brows).toBeGreaterThan(200);
    for (const s of grown.strands) {
      for (const p of s.pts) expect(head.field(p)).toBeGreaterThan(-1e-6);
      let L = 0; for (let i = 1; i < s.pts.length; i++) L += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y, s.pts[i].z - s.pts[i - 1].z);
      expect(mm(L)).toBeLessThan(13);
    }
  });
  it('rides the brow pad: a raised brow carries its hairs up', () => {
    const raised = growEpidermis(relationalHead({ sex: 'male', actions: { browRaise: 1 } }), readEpidermis('default'));
    expect(mm(rootZ(raised) - rootZ(grown))).toBeGreaterThan(3);
  });
});
