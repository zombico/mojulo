import { describe, expect, it } from 'vitest';

import { carveTitles, needsShaping, titleChars, titleFontPaths, titleFontsFound, TITLE_SIZING } from './title-carve.js';
import { normalizeHud, TITLE_STYLES } from './hud-widgets.js';
import { CARVE_STYLES } from '../../motion/glyph-carver.js';

// ── the glyph carver's letters as a game's title cards ──
// The concept: a title row's words become an indexed glyph atlas in cap-height units, the same bytes every time, with
// the digits along whenever a text carries a placeholder; what cannot carve (a shaped script, an uncovered character,
// no face on the host) is named in `fallback` so the world keeps a banner there. A host without a parsable face is a
// legitimate state (the fallback), so the geometry assertions run only where one is found.

const hud = (rows) => normalizeHud(rows).widgets;
const hasFont = titleFontsFound().length > 0;

describe('title-carve — what a text carves', () => {
  it('every title style is a carve style, and the search order starts with the env face', () => {
    for (const s of TITLE_STYLES) expect(CARVE_STYLES[s], s).toBeTruthy();
    expect(titleFontPaths({ MOJULO_TITLE_FONT: '/x/face.ttf' })[0]).toBe('/x/face.ttf');
    expect(titleFontPaths({}).some((p) => /archivo-black\.ttf$/.test(p))).toBe(true);   // the cover shelf's display face when vendored
    expect(TITLE_SIZING.space).toBeGreaterThan(0);
  });

  it('a text carves its own characters, less placeholders and spaces; a placeholder brings the digits and signs', () => {
    expect(titleChars('K.O.')).toEqual(['K', '.', 'O']);
    expect(titleChars('ROUND {round}')).toEqual(expect.arrayContaining(['R', 'O', 'U', 'N', 'D', '0', '9', '+', '-', '.']));
    expect(titleChars('ROUND {round}')).not.toContain('{');
    expect(titleChars('FIGHT!')).not.toContain(' ');
  });

  it('a script whose letters join or reorder is named, one whose letters stand alone is not', () => {
    expect(needsShaping('قاتل!')).toBe('arabic');
    expect(needsShaping('สู้!')).toBe('thai');
    expect(needsShaping('लड़ो!')).toBe('devanagari');
    expect(needsShaping('FIGHT! Бой! 闘 ファイト')).toBeNull();
  });

  it('no title row ⇒ null (a world without one is never touched)', () => {
    expect(carveTitles(hud([{ on: 'x', text: 'Y' }, { var: 'hp' }]))).toBeNull();
    expect(carveTitles([])).toBeNull();
  });

  it('a shaped-script title is a fallback, never a throw', () => {
    const out = carveTitles(hud([{ on: 'fight', text: 'قاتل!', as: 'title' }]));
    expect(out.fallback).toEqual([{ on: 'fight', text: 'قاتل!', reason: 'shaped-script:arabic' }]);
    expect(Object.keys(out.styles)).toEqual([]);
  });
});

describe.runIf(hasFont)('title-carve — the atlas (a face found on this host)', () => {
  const rows = [{ on: 'round', text: 'ROUND {round}', as: 'title', style: 'blocky' }, { on: 'ko', text: 'K.O.', as: 'title' }];

  it('carves one indexed mesh per distinct character per style, in cap heights, the same bytes twice', () => {
    const a = carveTitles(hud(rows)), b = carveTitles(hud(rows));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.keys(a.styles).sort()).toEqual(['blocky', 'heavy']);
    expect(a.fallback).toEqual([]);
    const K = a.styles.heavy.glyphs.K;
    expect(K.p.length % 3).toBe(0); expect(K.i.length % 3).toBe(0);
    expect(K.i.length).toBeGreaterThan(30);
    expect(Math.max(...K.i)).toBeLessThan(K.p.length / 3);   // indices address the vertex list
    expect(K.a).toBeGreaterThan(0.4); expect(K.a).toBeLessThan(2);   // an advance in cap heights
    // the digits rode along with the placeholder, in the blocky style only
    for (const d of '0123456789') expect(a.styles.blocky.glyphs[d], d).toBeTruthy();
    expect(a.styles.heavy.glyphs['7']).toBeUndefined();
    expect(a.styles.heavy.depth).toBeGreaterThan(0);
  });

  it('the front cap faces the viewer (+z at z = 0) and the back cap away, by winding — the page reads normals from it', () => {
    const { styles } = carveTitles(hud([{ on: 'x', text: 'F', as: 'title' }]));
    const { p: P, i: I } = styles.heavy.glyphs.F;
    let front = 0, back = 0, wrong = 0, ymax = -Infinity, ymin = Infinity;
    for (let k = 0; k < P.length; k += 3) { ymax = Math.max(ymax, P[k + 1] / 1000); ymin = Math.min(ymin, P[k + 1] / 1000); }
    for (let k = 0; k < I.length; k += 3) {
      const v = (j) => [P[I[k + j] * 3] / 1000, P[I[k + j] * 3 + 1] / 1000, P[I[k + j] * 3 + 2] / 1000];
      const a = v(0), b = v(1), c = v(2);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nz = u[0] * w[1] - u[1] * w[0], nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2];
      const l = Math.hypot(nx, ny, nz) || 1;
      if (Math.abs(nz / l) < 0.99) continue;   // a wall or a bevel
      const z = (a[2] + b[2] + c[2]) / 3;
      if (z > -0.0005) { if (nz > 0) front++; else wrong++; } else { if (nz < 0) back++; else wrong++; }
    }
    expect(front).toBeGreaterThan(0); expect(back).toBeGreaterThan(0); expect(wrong).toBe(0);
    expect(ymax).toBeCloseTo(1, 1);   // a capital stands one cap height: baseline 0, top 1
    expect(ymin).toBeGreaterThan(-0.2);
  });

  it('a character no face on the host covers is a fallback for its title; the others still carve', () => {
    const out = carveTitles(hud([{ on: 'ok', text: 'GO', as: 'title' }, { on: 'odd', text: 'GO \u{10FFFD}', as: 'title' }]));
    expect(out.styles.heavy.glyphs.G).toBeTruthy();
    expect(out.fallback).toEqual([{ on: 'odd', text: 'GO \u{10FFFD}', reason: expect.stringMatching(/^missing-glyphs:/) }]);
  });
});
