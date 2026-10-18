/**
 * Relief: the cards, the words, and the field's promises: bounded by its height, seeded, its shape set in metres
 * (never by the mesh), each flavour reading as its own ground, and grain only below the geometry's finest octave.
 */
import { describe, expect, it } from 'vitest';

import { RELIEF_CARDS, readRelief, reliefField, reliefGrain } from './relief.js';

const grid = (f, n = 40, step = 1) => { const out = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out.push(f(i * step, j * step)); return out; };
const spread = (vs) => Math.max(...vs) - Math.min(...vs);

describe('relief: reading', () => {
  it('reads a card, a variant of one, and a document of its own', () => {
    for (const id of Object.keys(RELIEF_CARDS)) expect(readRelief(id)).toMatchObject({ id, height: RELIEF_CARDS[id].height });
    expect(readRelief({ from: 'craggy', height: 3 })).toMatchObject({ id: 'craggy*', flavour: 'ridged', height: 3 });
    expect(readRelief({ height: 1, scale: 10 })).toMatchObject({ id: 'own', flavour: 'fbm' });
  });
  it('refuses what it does not know, word by word', () => {
    expect(() => readRelief('lumpy')).toThrow(/'lumpy' is not a relief card/);
    expect(() => readRelief({ from: 'rolling', bumps: 2 })).toThrow(/'bumps' is not a word/);
    expect(() => readRelief({ from: 'rolling', flavour: 'perlin' })).toThrow(/flavour is one of/);
    expect(() => readRelief({ from: 'rolling', finest: 40 })).toThrow(/finest is metres/);
    expect(() => readRelief({ from: 'rolling', stretch: { along: [0, 0], by: 2 } })).toThrow(/stretch.along/);
    expect(() => readRelief({ from: 'rolling', terrace: { step: 1, riser: 0 } })).toThrow(/terrace.riser/);
  });
});

describe('relief: the field', () => {
  it('stays within its height, repeats for a seed and differs for another', () => {
    for (const id of Object.keys(RELIEF_CARDS).slice(0, 2)) {
      const R = readRelief(id), a = grid(reliefField(R, 5));
      expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(R.height);
      expect(spread(a)).toBeGreaterThan(R.height * 0.5);
      expect(grid(reliefField(R, 5))).toEqual(a);
      expect(grid(reliefField(R, 6))).not.toEqual(a);
    }
  });

  it('sets its octaves in metres: a finer finest adds detail, a wider scale widens the features', () => {
    const R = readRelief('rolling'), rough = (f) => { const vs = grid(f, 60, 0.5); let s = 0; for (let k = 1; k < vs.length; k++) if (k % 60) s += Math.abs(vs[k] - vs[k - 1]); return s; };
    expect(rough(reliefField({ ...R, finest: 0.6 }, 1))).toBeGreaterThan(rough(reliefField({ ...R, finest: 6 }, 1)));
    expect(rough(reliefField({ ...R, scale: 80 }, 1))).toBeLessThan(rough(reliefField(R, 1)));
  });

  it('terraces into benches and stretches along its direction', () => {
    const T = grid(reliefField(readRelief({ from: 'terraced', height: 3, terrace: { step: 1, riser: 0.2 } }), 2), 60);
    // most samples sit on a bench: at a whole number of steps off the crest
    const onBench = T.filter((h) => Math.abs((h + 3) - Math.round(h + 3)) < 1e-9).length;
    expect(onBench / T.length).toBeGreaterThan(0.5);
    // the dune's crests run long across x: it changes faster along y than along x
    const D = reliefField(readRelief({ from: 'dune', warp: null, stretch: { along: [1, 0], by: 4 } }), 3);
    let ax = 0, ay = 0;
    for (let k = 0; k < 400; k++) { const x = (k % 20) * 1.3, y = Math.floor(k / 20) * 1.3; ax += Math.abs(D(x + 0.5, y) - D(x, y)); ay += Math.abs(D(x, y + 0.5) - D(x, y)); }
    expect(ay).toBeGreaterThan(ax * 1.5);
  });

  it('grains only when asked, and only finer than the ground', () => {
    expect(reliefGrain({ ...readRelief('rolling'), grain: 0 }, 1)).toBeNull();
    const R = readRelief('rolling'), g = grid(reliefGrain(R, 1, 0.5), 30, 0.5);
    expect(Math.max(...g.map(Math.abs))).toBeLessThanOrEqual(1);
    expect(spread(g)).toBeGreaterThan(0.2);
    // the grain changes over a metre or two; the ground over tens of metres
    const f = reliefField(R, 1), step = (h) => { let s = 0; for (let k = 0; k < 200; k++) s += Math.abs(h(k * 0.5 + 0.5, 3) - h(k * 0.5, 3)); return s; };
    expect(step(reliefGrain(R, 1, 0.5)) / spread(g)).toBeGreaterThan(step(f) / spread(grid(f)));
  });
});
