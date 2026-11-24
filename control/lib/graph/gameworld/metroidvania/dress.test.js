import { describe, it, expect } from 'vitest';
import { assembleBox, boxOf } from './scene.js';
import { dressBox } from './dress.js';
import { BOX_THEMES, lookOf, themeLaws } from './themes.js';
import { vampireSonata } from './vampire-sonata.js';
import { readBox } from './box.js';

const M = (words) => ({ kind: 'geocube', show: 'metroidvania', metroidvania: words, stature: 1.63 });

describe('a box dressed in its theme', () => {
  it('names a theme in its words, and refuses one it does not know', () => {
    expect(readBox(vampireSonata()).theme).toBe('castle');
    expect(() => readBox({ ...vampireSonata(), theme: 'spaceship' })).toThrow(/theme is castle/);
  });

  it('gives each ring its own look, its core the theme\'s last, and holds the theme\'s laws', () => {
    const rings = vampireSonata().rings.length, T = BOX_THEMES.castle;
    expect(lookOf(T, 0, rings)).toBe(T.looks[0]);
    expect(lookOf(T, rings - 1, rings)).toBe(T.looks.at(-1));
    const B = boxOf(M(vampireSonata()));
    expect(B.laws.filter((l) => !l.holds)).toEqual([]);
    expect(B.laws.map((l) => l.id)).toEqual(expect.arrayContaining(['theme:rings-distinct', 'theme:gates-read']));
    // (two rings alike are said)
    const same = { ...T, looks: [T.looks[1], T.looks[1], T.looks[1], T.looks[1]] };
    expect(themeLaws(same, rings).find((l) => l.id === 'rings-distinct').holds).toBe(false);
  });

  it('dresses nothing it does not see the box keep: its play the greybox\'s, no runner over a hole', () => {
    const plain = assembleBox(M({ ...vampireSonata(), theme: undefined })), dressed = assembleBox(M(vampireSonata()));
    // (the play stands as it stood: the same colliders, gates and what is picked up)
    expect(dressed.colliders).toEqual(plain.colliders);
    expect(dressed.breakables).toEqual(plain.breakables);
    expect(dressed.heldGates).toEqual(plain.heldGates);
    // (a runner never lies over a hole in the floor it runs down: a drop is never carpeted over)
    const B = boxOf(M(vampireSonata())), D = dressBox(B, 'castle');
    const runners = D.faces.filter((f) => f.group === 'box:runner');
    expect(runners.length).toBeGreaterThan(0);
    for (const h of B.greybox.holes) for (const f of runners) {
      const s = f.corners.map((p) => p[1]), z = f.corners[0][2];
      if (Math.abs(z - (h.z + 1.02)) > 0.05) continue;
      expect(Math.min(...s) >= h.s1 || Math.max(...s) <= h.s0).toBe(true);
    }
    // (a lamp a cell, lit faces near each)
    expect(D.lamps.length).toBeGreaterThanOrEqual(B.layout.rooms.length);
  });
});
