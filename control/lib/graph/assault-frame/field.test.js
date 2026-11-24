import { describe, it, expect } from 'vitest';
import { FRAME_FIELDS, frameField, frameFieldCube, frameFieldManifest } from './field.js';
import { readLocalMeru } from '../local-meru/plan.js';

// THE FIELD (field.js): a frame's level is a geocube's own land at a mech's scale, pure terrain. One case per concept: the
// field is a geocube land page's recipe; its height is the same for the same cube; it rolls the whole way round (an open
// island: no trail's level apron); the open word is an island nobody walks onto.
const form = Object.keys(FRAME_FIELDS)[0];

describe('the frame field', () => {
  it('is a geocube land in the seventh generation, a Sol world\'s, no trail drawn', () => {
    const m = frameFieldManifest(form);
    expect(m).toMatchObject({ kind: 'geocube', show: 'land', cube: { from: 'mars', era: 'gen-7', outside: { island: { walk: 'none', open: true } } } });
    expect(frameFieldCube(form, { world: 'moon' }).from).toBe('moon');
    expect(() => frameFieldCube('swamp')).toThrow(/plain, basin/);
  });

  it('reads its ground the same for the same cube, and rolls the whole way round', () => {
    const F = frameField(frameFieldCube(form)), [cx, cy] = F.centre, h = F.half;
    expect(frameField(JSON.parse(JSON.stringify(frameFieldCube(form))))).toBe(F);
    // (the south half, where a trail would land, is no flatter than the rest: no level apron)
    const flat = (j0, j1) => { let n = 0, k = 0; for (let j = j0; j <= j1; j++) for (let i = -4; i <= 4; i++) { k++; if (Math.abs(F.heightAt(cx + (i * h) / 4, cy + (j * h) / 4)) < 0.5) n++; } return n / k; };
    expect(flat(-4, -1)).toBeLessThan(0.5);
    // (the field's square inside its shore: no corner of it in the sea)
    for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) expect(F.heightAt(cx + i * h, cy + j * h)).toBeGreaterThan(-1);
  });

  it('takes the open word only on an island nobody walks onto', () => {
    expect(readLocalMeru({ island: { walk: 'none', open: true } }).island.open).toBe(true);
    expect(() => readLocalMeru({ island: { open: true } })).toThrow(/walk 'none'/);
    expect(() => readLocalMeru({ island: { walk: 'none', open: 1 } })).toThrow(/island.open is true/);
    expect(readLocalMeru({ island: true }).island).not.toHaveProperty('open');
  });
});
