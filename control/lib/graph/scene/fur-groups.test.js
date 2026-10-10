import { describe, it, expect } from 'vitest';
import { tagFurFaces, furSkip, FUR_SKIP_DEFAULT } from './fur-groups.js';

const face = (fill, extra = {}) => ({ corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], fill, ...extra });

describe('which faces of a character grow fur', () => {
  const palette = { Skin: '#D9A77E', Top: '#3d6fa8', Hair: '#3b291e', Brow: '#3b291e', Sclera: '#f5eee2', Pupil: '#152532' };

  it('tags each face by its palette group, fur or bare, and drops the studio floor', () => {
    const { faces, palette: furred, anyFur } = tagFurFaces(
      [face('#d9a77e'), face('#3d6fa8'), face('#f5eee2'), face('#152532'), face('#20262e', { studio: true }), face('#abcdef')],
      palette,
    );
    expect(faces.map((f) => f.group)).toEqual(['fur:Skin', 'fur:Top', 'bare:Sclera', 'bare:Pupil', 'fur:Other']);
    expect(Object.keys(furred)).toEqual(['Skin', 'Top', 'Hair']);
    expect(anyFur).toBe(true);
  });

  it('a colour two groups share goes to the furred one (a hero\'s Hair and Brow)', () => {
    expect(tagFurFaces([face('#3b291e')], palette).faces[0].group).toBe('fur:Hair');
    expect(tagFurFaces([face('#3b291e')], { Brow: '#3b291e', Hair: '#3b291e' }).faces[0].group).toBe('fur:Hair');
  });

  it('the default keeps eyes, mouth, nose, claws and horns bare across hero, anime and animal palettes', () => {
    for (const g of ['Sclera', 'Iris', 'Pupil', 'Lid', 'Lids', 'LidRim', 'LidShadow', 'Limbus', 'Catchlight', 'Ink', 'Brow', 'Mouth', 'Lip', 'Teeth', 'Palate', 'NosePad', 'Nostrils', 'Claw', 'Hoof', 'Horn', 'Pad']) {
      expect(FUR_SKIP_DEFAULT.test(g), g).toBe(true);
    }
    for (const g of ['Skin', 'Coat', 'Hair', 'Top', 'Bottom', 'Shoes', 'Belly', 'Mane', 'Snout', 'Ears', 'EarInner', 'Fur']) {
      expect(FUR_SKIP_DEFAULT.test(g), g).toBe(false);
    }
  });

  it('a named skip list replaces the default', () => {
    const skip = furSkip('Skin, Shoes');
    expect(skip('Skin')).toBe(true);
    expect(skip('Sclera')).toBe(false);
    expect(tagFurFaces([face('#d9a77e')], palette, skip).anyFur).toBe(false);
  });
});
