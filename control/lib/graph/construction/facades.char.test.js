import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { facadeRecipe, FACADE_KINDS } from './facades.js';

// Characterization pin: every facade kind's recipe at three footprints, plain and in a house style's palette.
// Captured before the facades were derived from the furnishing styles (furnishings/styles.js); a change here is an
// emission change and must say so.
const FT = 304.8;
const FOOTPRINTS = {
  sofa: [[7, 3, 2.7], [5.2, 2.9, 2.4], [9, 3.4, 3]], armchair: [[2.9, 2.9, 2.6], [2.5, 2.7, 2.4], [3.3, 3.2, 3]],
  chesterfield: [[7.2, 3.1, 2.5], [6, 3, 2.4], [8.5, 3.3, 2.7]], 'coffee-table': [[4, 2, 1.5], [3, 1.6, 1.3], [5, 2.6, 1.6]],
  'dining-table': [[6, 3.2, 2.5], [4, 3, 2.4], [8, 4, 2.5]], chair: [[1.5, 1.6, 2.9], [1.6, 1.7, 3.1], [1.4, 1.5, 2.7]],
  bookcase: [[3, 1.1, 6], [2.5, 1, 5], [4, 1.4, 6.5]], 'media-console': [[5.5, 1.5, 1.8], [4, 1.4, 1.6], [8, 1.9, 2.2]],
  sideboard: [[5, 1.6, 2.8], [4, 1.4, 2.6], [7, 2, 3]], chest: [[3.4, 1.6, 3.4], [3.5, 1.5, 2.6], [6, 2, 4.2]],
  nightstand: [[1.6, 1.4, 1.9], [1.5, 1.3, 2.2], [2.2, 1.8, 2]],
};
const PALETTE = { upholstery: '#3d6b5a', wood: '#5a3a22', cabinet: '#dcd6c8' };
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const recipes = () => Object.keys(FACADE_KINDS).map((kind) => FOOTPRINTS[kind].flatMap(([w, d, h]) => [null, PALETTE].map((palette) => facadeRecipe(kind, { W: w * FT, D: d * FT, H: h * FT, palette }))));

describe('facades: recipe characterization', () => {
  it('covers every kind', () => expect(Object.keys(FOOTPRINTS).sort()).toEqual(Object.keys(FACADE_KINDS).sort()));
  it('builds every recipe byte-identically', () => {
    expect(Object.fromEntries(Object.keys(FACADE_KINDS).map((k, i) => [k, sha(recipes()[i])]))).toMatchInlineSnapshot(`
      {
        "armchair": "91f30b8ad908a620",
        "bookcase": "4f6d5ec70f6cb554",
        "chair": "63263c5214e91816",
        "chest": "dedd491c0ee88392",
        "chesterfield": "32957b030271a850",
        "coffee-table": "348a07cf75a9aa50",
        "dining-table": "4a6ae13bee4bbc96",
        "media-console": "17470eb711246875",
        "nightstand": "0d27f287aa854eb2",
        "sideboard": "a5027c675055de05",
        "sofa": "07d0c051d5c08998",
      }
    `);
  });
});
