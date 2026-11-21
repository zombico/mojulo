import { describe, it, expect } from 'vitest';
import { matte, trimmed, trimRect, treat, TREATMENT_FNS } from './front-treatments.js';
import { STAGE_TREATMENTS } from './front-stage.js';

// A START SCREEN'S PICTURES: a subject cut out by what changes between black and white, trimmed to itself, and drawn
// in a treatment in the game's colours. Pure over pixels: one small picture built here per rule.
const img = (w, h, px) => ({ width: w, height: h, data: Uint8ClampedArray.from(px) });
// a 4×4 frame: a 2×2 subject of colour C at alpha A in the middle, over a background
const C = [200, 80, 40], A = 0.5;
const over = (bg) => img(4, 4, Array.from({ length: 16 }, (_, i) => {
  const x = i % 4, y = Math.floor(i / 4), inside = x >= 1 && x <= 2 && y >= 1 && y <= 2;
  return inside ? [...C.map((c, k) => Math.round(c * A + bg[k] * (1 - A))), 255] : [...bg, 255];
}).flat());
const COLOURS = { ink: '#f0f0f0', accent: '#ff3300', bg: '#101010' };

describe('cutting a subject out', () => {
  it('recovers its colour and alpha from black and white, and leaves the background empty', () => {
    const cut = matte(over([0, 0, 0]), over([255, 255, 255]));
    const at = (x, y) => [...cut.data.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
    expect(at(0, 0)[3]).toBe(0);
    const p = at(1, 1);
    expect(Math.abs(p[3] - A * 255)).toBeLessThanOrEqual(2);
    p.slice(0, 3).forEach((c, k) => expect(Math.abs(c - C[k])).toBeLessThanOrEqual(3));
  });

  it('refuses two captures of different sizes', () => {
    expect(() => matte(img(1, 1, [0, 0, 0, 255]), img(2, 1, [0, 0, 0, 255, 0, 0, 0, 255]))).toThrow(/one frame at one size/);
  });

  it('says where its crop falls in the frame, the pad round it', () => {
    const cut = matte(over([0, 0, 0]), over([255, 255, 255]));
    expect(trimRect(cut)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(trimRect(cut, { pad: 3 })).toEqual({ x: -2, y: -2, w: 8, h: 8 });
    expect(trimRect(img(2, 2, new Array(16).fill(0)))).toBeNull();
  });

  it('trims to the subject, keeping a pad', () => {
    const cut = matte(over([0, 0, 0]), over([255, 255, 255]));
    expect([trimmed(cut).width, trimmed(cut).height]).toEqual([2, 2]);
    expect([trimmed(cut, { pad: 3 }).width, trimmed(cut, { pad: 3 }).height]).toEqual([8, 8]);
    expect(trimmed(img(2, 2, new Array(16).fill(0)))).toMatchObject({ width: 1, height: 1 });
  });
});

describe('the treatments', () => {
  const subject = trimmed(matte(over([0, 0, 0]), over([255, 255, 255])), { pad: 4 });
  const alphaAt = (im, i) => im.data[i * 4 + 3];

  it('each keeps the picture\'s size and is the same twice', () => {
    for (const t of STAGE_TREATMENTS) {
      const a = treat(subject, t, COLOURS), b = treat(subject, t, COLOURS);
      expect([a.width, a.height], t).toEqual([subject.width, subject.height]);
      expect(Buffer.from(a.data).equals(Buffer.from(b.data)), t).toBe(true);
    }
    expect(Object.keys(TREATMENT_FNS).sort()).toEqual([...STAGE_TREATMENTS].sort());
  });

  it('a recolouring keeps the subject\'s shape; a cut-out grows a rim of the accent round it', () => {
    const sil = treat(subject, 'silhouette', COLOURS);
    for (let i = 0; i < subject.width * subject.height; i++) expect(alphaAt(sil, i)).toBe(alphaAt(subject, i));
    const firstLit = [...sil.data].findIndex((v, i) => i % 4 === 3 && v > 0);
    expect([...sil.data.slice(firstLit - 3, firstLit)]).toEqual([240, 240, 240]);
    const cut = treat(subject, 'cutout', COLOURS);
    const covered = (im) => Array.from({ length: im.width * im.height }, (_, i) => alphaAt(im, i) > 0).filter(Boolean).length;
    expect(covered(cut)).toBeGreaterThan(covered(subject));
    const rim = [...cut.data].findIndex((v, i) => i % 4 === 3 && v > 0 && subject.data[i] === 0);
    expect([...cut.data.slice(rim - 3, rim)]).toEqual([255, 51, 0]);
  });

  it('names what it does not know', () => {
    expect(() => treat(subject, 'sepia', COLOURS)).toThrow(/not a treatment/);
  });
});
