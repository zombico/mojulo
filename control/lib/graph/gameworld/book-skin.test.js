// The book's skin (book-skin.js): a world's book recoloured, retyped and reframed as data, a preset or the model's own
// values, every one checked, so a skin reaches no further than the book's variables and rules. A world without one
// keeps its book byte for byte.
import { describe, expect, it } from 'vitest';
import { readBookSkin, skinHead, BOOK_SKINS } from './book-skin.js';
import { gameworldBibleHtml } from './bible-html.js';
import { readGameworld, MEADOWMARK } from './index.js';

describe('the book skin', () => {
  it('a preset by name; a preset overridden; a skin of its own', () => {
    const id = Object.keys(BOOK_SKINS)[0];
    expect(readBookSkin({ skin: id })).toEqual(BOOK_SKINS[id]);
    expect(readBookSkin({ skin: { from: id, accent: '#ff00aa' } })).toMatchObject({ ...BOOK_SKINS[id], accent: '#ff00aa' });
    const own = readBookSkin({ skin: { paper: '#000000', ink: '#ffffff', frame: 'rule' } });
    expect(own).toEqual({ paper: '#000000', ink: '#ffffff', frame: 'rule' });
    const { link, css } = skinHead(own);
    expect(link).toBe('');
    expect(css).toContain('--paper:#000000');
    expect(readBookSkin(undefined)).toBeNull();
    expect(skinHead(null)).toEqual({ link: '', css: '' });
  });

  it('refuses what is no colour, no face, no word of its list, by name', () => {
    expect(() => readBookSkin({ skin: 'camo' })).toThrow(/book: skin 'camo' is not a preset/);
    expect(() => readBookSkin({ skin: { ink: 'red' } })).toThrow(/skin.ink is a colour/);
    expect(() => readBookSkin({ skin: { mono: 'x"}body{display:none' } })).toThrow(/skin.mono is a font family's name/);
    expect(() => readBookSkin({ skin: { texture: 'noise' } })).toThrow(/skin.texture is none or grid or scanlines/);
    expect(() => readBookSkin({ skin: { glow: 1 } })).toThrow(/skin.glow is not a skin setting/);
    expect(() => readGameworld({ ...MEADOWMARK, book: { skin: 'camo' } })).toThrow(/gameworld: book: skin 'camo'/);
  });

  it("dresses the world's book, and a world without one keeps its book's bytes", () => {
    const id = Object.keys(BOOK_SKINS)[0], plain = gameworldBibleHtml(MEADOWMARK), skinned = gameworldBibleHtml({ ...MEADOWMARK, book: { skin: id } });
    expect(skinned).toContain(skinHead(BOOK_SKINS[id]).css);
    expect(skinned.replace(skinHead(BOOK_SKINS[id]).link, '').replace(`\n${skinHead(BOOK_SKINS[id]).css}`, '')).toBe(plain);
  });
});
