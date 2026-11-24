import { describe, it, expect } from 'vitest';
import { designGeotown } from './design.js';
import { PATTERNS, DEFAULT_PATTERN, SEGMENT_LETTERS } from './pattern.js';
import { STYLE_STARTERS, MATERIAL_WORDS } from '../era/arch-style.js';
import { dressedTile } from '../matte-paint/dressed.js';

// the Northeast suburb (pattern.js northeast): colonials and Capes detached on wide lots behind deep lawns, a drive to
// each garage, no kerb parking, garden apartments by the avenue; the streetcar suburb's where it does not differ
describe('the Northeast suburb', () => {
  const P = PATTERNS.northeast;
  it('is a pattern of its own in its colonial style, the streetcar suburb still the default', () => {
    expect(DEFAULT_PATTERN).toBe('bay-and-gable');
    expect(STYLE_STARTERS[P.style]).toBeTruthy();
    expect(STYLE_STARTERS.colonial.materials.timber).toBe('clapboard');
    expect(MATERIAL_WORDS.clapboard.on).toBe('wall');
    // (its houses detached only, on wide lots, set back behind deep lawns; no semis, no split flats)
    expect(P.mix.semi).toBe(0);
    expect(P.duplex.share).toBe(0);
    expect(P.plot.detached[0]).toBeGreaterThan(PATTERNS['bay-and-gable'].plot.detached[1]);
    expect(P.setback[0]).toBeGreaterThan(PATTERNS['bay-and-gable'].setback[1]);
    expect(SEGMENT_LETTERS.G).toBe('garden');
  });

  it('holds every law at a segment and a neighbourhood; each house its drive, no car on its local streets', () => {
    for (const spec of [{ segment: 'houses' }, { segment: 'garden' }, { evoke: 'neighbourhood', neighbourhood: 'suburb' }]) {
      const T = designGeotown({ pattern: 'northeast', ...spec }, { seed: 3 });
      expect(T.laws.filter((l) => !l.ok).map((l) => l.law), JSON.stringify(spec)).toEqual([]);
    }
    const T = designGeotown({ pattern: 'northeast', evoke: 'neighbourhood', neighbourhood: 'suburb' }, { seed: 3 });
    const houses = T.plots.filter((p) => p.kind === 'houses'), gardens = T.plots.filter((p) => p.kind === 'garden');
    expect(houses.length).toBeGreaterThan(0);
    expect(houses.every((p) => p.form === 'detached')).toBe(true);
    expect(gardens.length).toBeGreaterThan(0);
    expect(T.surfaces.some((s) => s.cls === 'drive')).toBe(true);
    // (no car on its local streets: the drives hold them; the avenue keeps its kerb, where the garden apartments park)
    const rank = (id) => T.streets.find((st) => st.id === id)?.rank;
    expect((T.parking?.lanes ?? []).filter((L) => rank(L.street) !== 'major')).toEqual([]);
  });

  it('dresses its colonials in clapboard: boards across the wall, each lapping over the one below and shading it', () => {
    const rows = 6, T = dressedTile({ cut: 'clapboard', stone: [241, 238, 230], mortar: [90, 90, 90], rows, metres: 1 }, { size: 120, seed: 3 });
    // (down a column, each board's lap a darker line: `rows` of them a repeat; across a row, the paint even)
    const lum = (i, j) => { const k = (j * T.W + i) * 3; return T.rgb[k] + T.rgb[k + 1] + T.rgb[k + 2]; };
    const col = Array.from({ length: T.H }, (_, j) => lum(60, j)), mean = col.reduce((a, b) => a + b, 0) / col.length;
    let laps = 0; for (let j = 1; j < T.H; j++) if (col[j] < mean * 0.9 && col[j - 1] >= mean * 0.9) laps++;
    expect(laps).toBe(rows);
    const row = Array.from({ length: T.W }, (_, i) => lum(i, 30));
    expect(Math.max(...row) - Math.min(...row)).toBeLessThan(mean * 0.12);
  });
});
