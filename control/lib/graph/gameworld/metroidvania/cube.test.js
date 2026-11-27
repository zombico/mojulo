// THE BOX ON ITS GEOCUBE: a box whose words name no theme takes its look from its level's cube: the cube's library in
// the cube's colour, gem and rock; its words' theme still wins, as written; a cube with no box leaves the greybox.
import { describe, it, expect } from 'vitest';
import { boxOf } from './scene.js';
import { cubeBoxTheme, boxLookOf, tintToward, BOX_TINT } from './cube.js';
import { BOX_THEMES } from './themes.js';
import { vampireSonata, vampireSonataGame } from './vampire-sonata.js';
import { xenoJager, XENOJAGER_CUBE } from './xeno-jager.js';
import { readGeocube } from '../../era/geocube.js';
import { readGameworld } from '../world.js';
import { gameStages } from '../levels.js';

const M = (words, cube) => ({ kind: 'geocube', show: 'metroidvania', metroidvania: words, stature: 1.63, ...(cube ? { cube } : {}) });
const { theme: _castle, ...bare } = vampireSonata();
const hsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const h = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, (mx + mn) / 2];
};

describe('the box on its geocube', () => {
  it('reads its look in one order: its words\' theme, else its cube\'s box, else the greybox', () => {
    expect(boxLookOf(vampireSonata(), 'limestone-crags')).toMatchObject({ id: 'castle', from: 'words' });
    expect(boxLookOf(bare, 'gothic-night')).toMatchObject({ id: 'castle', from: 'cube', cube: 'gothic-night' });
    expect(boxLookOf(bare, 'valley-morning')).toBeNull();
    expect(boxLookOf(bare)).toBeNull();
    // (a cube that names no library the box has is said, teaching the libraries)
    expect(() => cubeBoxTheme({ from: 'gothic-night', box: { library: 'spaceship' } })).toThrow(/box.library is castle/);
    expect(() => readGeocube({ from: 'gothic-night', box: { tint: 2, library: 'castle' } })).toThrow(/box.tint/);
  });

  it('dresses the castle on the gothic night as its words do, byte for byte, and the planet on its own cube', () => {
    const a = boxOf(M(vampireSonata())), b = boxOf(M(bare, 'gothic-night'));
    expect(b.look.theme).toBe(BOX_THEMES.castle);
    expect(b.dress.faces).toEqual(a.dress.faces);
    expect(boxOf(M(bare, 'valley-morning')).dress).toBeUndefined();
    const x = boxOf(M(xenoJager({ theme: null }), XENOJAGER_CUBE));
    expect(x.look).toMatchObject({ id: 'xeno', from: 'cube', cube: 'xenojager' });
    expect(x.dress.plan).toEqual(boxOf(M(xenoJager())).dress.plan);
  });

  it('tints a library toward its cube\'s colours, each keeping its lightness, every law holding', () => {
    const cube = { from: 'limestone-crags', box: { library: 'castle' } }, T = cubeBoxTheme(cube), C = readGeocube(cube), L0 = BOX_THEMES.castle.looks;
    T.looks.forEach((L, k) => {
      for (const [key, role] of [['stone', 'stone'], ['trim', 'trim']]) {
        const [h0, l0] = hsl(L0[k][key]), [h1, l1] = hsl(L[key]), [hc] = hsl(C.colour[role]), arc = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
        expect(Math.abs(l1 - l0)).toBeLessThan(0.02);
        if (arc(h0, hc) > 10) expect(arc(h1, hc)).toBeLessThan(arc(h0, hc));
      }
    });
    expect(tintToward('#336699', '#993333', 0)).toBe('#336699');
    expect(BOX_TINT).toBeGreaterThan(0);
    const B = boxOf(M(bare, cube));
    expect(B.laws.filter((l) => !l.holds)).toEqual([]);
  });

  it('grows its cube\'s crystals in every druse and its boulders of its rock', () => {
    const cube = { ...XENOJAGER_CUBE, outside: { ...readGeocube('gothic-night').outside, crystals: { gem: 'ruby', glow: 0.5 } }, box: { library: 'xeno', tint: 0, rock: 'granite' } };
    const T = cubeBoxTheme(cube);
    expect(T.looks.every((L) => L.gem === 'ruby' && L.glow === 0.5 && L.rock === 'granite')).toBe(true);
    const B = boxOf(M(xenoJager({ theme: null }), cube));
    expect(new Set(B.dress.faces.filter((f) => f.crystal).map((f) => f.crystal.gem))).toEqual(new Set(['ruby']));
  });

  it('is what a game gets: a box level with no theme dressed by its world\'s geocube', () => {
    const G = vampireSonataGame({ heroRef: 'h' });
    G.levels.castle.metroidvania = xenoJager({ theme: null });
    G.style = { ...(G.style ?? {}), geocube: XENOJAGER_CUBE };
    const [stage] = gameStages(readGameworld(G));
    expect(stage.manifest.cube).toEqual(XENOJAGER_CUBE);
    expect(boxOf({ ...stage.manifest, stature: 1.63 }).look).toMatchObject({ id: 'xeno', from: 'cube' });
  });
});
