// The shaded look's laws, on one drum and one box (the smallest round and the smallest edge): a round spreads its light
// across a face (smoothed corners), an edge keeps it (the crease); the shade never black; four corners at most; the
// kit's shaded pole (no tiles) and a set piece in its own polygons; deterministic.
import { describe, it, expect } from 'vitest';
import { shadeFaces, SHADED_LIGHT } from './shaded-look.js';
import { buildBlock } from '../era/blocks.js';
import { trackKit } from './track-kit.js';
import { TRACK_BLOCKS, SETS, paintPiece } from './set-pieces.js';
import { SWATCH_KITS } from '../era/style/swatches.js';

const drum = buildBlock({ id: 'd', read: 'a drum', tier: 'machine', mounts: ['ground'], parts: [{ id: 'd', prim: 'drum', r: 2, h: 4, sides: 16 }] }).faces;
const box = buildBlock({ id: 'b', read: 'a box', tier: 'machine', mounts: ['ground'], parts: [{ id: 'b', prim: 'box', size: [4, 4, 4] }] }).faces;
const grey = () => [0.6, 0.6, 0.6];
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

describe('the shaded look', () => {
  it('a round spreads its light across a face; an edge keeps it', () => {
    const d = shadeFaces(drum, { colourOf: grey, shadows: false }), b = shadeFaces(box, { colourOf: grey, shadows: false });
    const sides = (fs) => fs.filter((f) => f.corners.some((p) => p[2] > 0.1) && f.corners.some((p) => p[2] < 0.1));
    expect(sides(d).some((f) => new Set(f.cornerFills).size > 1)).toBe(true);
    expect(sides(b).every((f) => new Set(f.cornerFills).size === 1)).toBe(true);
  });
  it('the shade never black; four corners at most; deterministic', () => {
    const d = shadeFaces(drum, { colourOf: grey });
    for (const f of d) { expect(f.corners.length).toBeLessThanOrEqual(4); for (const h of f.cornerFills) expect(lum(h)).toBeGreaterThan(255 * 0.6 * SHADED_LIGHT.shadeFloor * 0.5); }
    expect(JSON.stringify(shadeFaces(drum, { colourOf: grey }))).toBe(JSON.stringify(d));
  });
  it('the kit\'s shaded pole: no tiles; a set piece in its own polygons, lit per corner', () => {
    const K = trackKit({ id: SWATCH_KITS[0], pole: 'shaded' });
    expect(K.pole).toBe('shaded');
    expect(K.surface('grass', [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]]).texture).toBeUndefined();
    const b = buildBlock(TRACK_BLOCKS[SETS.kart.focus.built], { library: TRACK_BLOCKS }), f = paintPiece(b.faces, K);
    expect(f.length).toBeGreaterThan(0);
    for (const x of f) { expect(x.texture).toBeUndefined(); expect(x.cornerFills?.length).toBe(x.corners.length); }
  });
});
