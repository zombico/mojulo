import { describe, it, expect } from 'vitest';

import { bakeActor } from './pixel-actor.js';

// synthetic decode: 8x8 solid field with an optional changed patch —
// stands in for a meru-locked base + face-variant render pair
const frame = (patch) => {
  const data = new Uint8Array(8 * 8 * 4);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const inPatch = patch && x >= patch.x && x < patch.x + 2 && y >= patch.y && y < patch.y + 2;
      data.set(inPatch ? [200, 40, 40, 255] : [40, 40, 200, 255], (y * 8 + x) * 4);
    }
  }
  return { data, width: 8, height: 8 };
};

describe('bakeActor — the one-call actor pipeline', () => {
  const files = { base: 'base.png', wink: 'wink.png', gape: 'gape.png' };
  const decodeBy = (map) => async (path) => map[Object.keys(map).find((k) => path.endsWith(k))];

  it('bakes base + diff-extracted groups with placement cells, blanks, and health ratios', async () => {
    const actor = await bakeActor({
      dir: '/nowhere',
      decode: decodeBy({ 'base.png': frame(), 'wink.png': frame({ x: 2, y: 2 }), 'gape.png': frame({ x: 2, y: 5 }) }),
      files,
      grid: [8, 8],
      groups: { face: ['wink', 'gape'] },
    });
    expect(actor.base.size).toEqual([8, 8]);
    const face = actor.groups.face;
    expect(face.cell).toEqual([2, 2]);                       // union bbox origin
    expect(face.sprites.wink.size).toEqual(face.sprites.gape.size); // shared box
    expect(face.blank.cells.every((r) => /^\.+$/.test(r))).toBe(true);
    expect(actor.changedRatios.wink).toBeCloseTo(4 / 64);
    expect(actor.provenance.base.sha256).toBe(null);         // synthetic: no file to hash
  });

  it('refuses a drifted pair loudly instead of smearing a giant cel', async () => {
    // "variant" is the inverse field — everything changed
    const inverse = { data: frame().data.map((v, i) => (i % 4 === 3 ? v : 255 - v)), width: 8, height: 8 };
    await expect(bakeActor({
      dir: '/nowhere',
      decode: decodeBy({ 'base.png': frame(), 'wink.png': inverse }),
      files: { base: 'base.png', wink: 'wink.png' },
      grid: [8, 8],
      groups: { face: ['wink'] },
    })).rejects.toThrow(/drifted/);
  });
});
