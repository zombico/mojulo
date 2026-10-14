import { describe, it, expect } from 'vitest';
import { solvePalette, scriptShift, PALETTE_SCHEME_IDS, PALETTE_KEYS, PALETTE_SCRIPTS } from './solve.js';
import { sheetStats } from './contact.js';
import { novelSeed, signatureOf, paletteDistance } from './ledger.js';

// The sweep: every scheme in every key at the ends of every axis. The value laws (the ones a kit's look is built on)
// hold everywhere; the rest are advice and may fail at a corner, but every one is checked.
const ENDS = [-1, 1];
const VALUE_LAWS = ['ramps-climb', 'shade-is-colour', 'sky-brightest', 'ui-contrast'];

describe('the palette over its range', () => {
  for (const scheme of PALETTE_SCHEME_IDS) {
    it(`${scheme}: the value laws hold in every key at every axis end`, () => {
      for (const key of Object.keys(PALETTE_KEYS)) for (const heat of ENDS) for (const weight of ENDS) for (const activity of ENDS) {
        const K = solvePalette({ seed: 31, scheme, key, heat, weight, activity });
        for (const law of VALUE_LAWS) expect(K.checks.find((c) => c.law === law), `${scheme} ${key} h${heat} w${weight} a${activity}: ${law}`).toMatchObject({ ok: true });
      }
    });
  }
});

// The machine half of "is there a house look": fifty palettes from the seed alone (what a world naming nothing gets)
// spread over the wheel, the keys and the schemes; and the ledger keeps a stream of them apart.
describe('the spread of the auto default', () => {
  it('fifty seeds: the ground in most of the wheel, no hue holding a quarter, every key, most schemes', () => {
    const S = sheetStats(Array.from({ length: 50 }, (_, i) => solvePalette({ seed: 1000 + i })));
    expect(S.ground.used).toBeGreaterThanOrEqual(8);
    expect(S.ground.top).toBeLessThanOrEqual(0.25);
    expect(Object.keys(S.keys).sort()).toEqual(Object.keys(PALETTE_KEYS).sort());
    expect(Object.keys(S.schemes).length).toBeGreaterThanOrEqual(PALETTE_SCHEME_IDS.length - 1);
    expect(S.groundL.most - S.groundL.least).toBeGreaterThan(0.12);
  });
  it('twenty through the ledger: no near-twins (under 0.04), where twenty raw rolls have them', () => {
    let s = 77;
    const roll = () => { s = (Math.imul(s ^ (s >>> 13), 1103515245) + 12345) >>> 0; return (s % 2147483646) + 1; };
    const sig = [];
    for (let i = 0; i < 20; i += 1) sig.push(signatureOf(solvePalette({ seed: novelSeed({}, { recent: sig, roll }) })));
    const near = sig.map((a, i) => Math.min(...sig.filter((_, j) => j !== i).map((b) => paletteDistance(a, b))));
    expect(near.filter((d) => d < 0.04)).toEqual([]);
  });
});

describe('the colour scripts over the range', () => {
  for (const arc of Object.keys(PALETTE_SCRIPTS)) {
    it(`${arc}: the value laws hold at every level, every key; the levels move apart`, () => {
      for (const key of Object.keys(PALETTE_KEYS)) {
        const Ks = [0, 1, 2, 3, 4].map((i) => { const shift = scriptShift(arc, i, 5); return solvePalette(shift ? { seed: 31, key, shift } : { seed: 31, key }); });
        for (const K of Ks) for (const law of VALUE_LAWS) expect(K.checks.find((c) => c.law === law), `${arc} ${key}: ${law}`).toMatchObject({ ok: true });
        const g = Ks.map(signatureOf), widest = Math.max(...g.flatMap((a, i) => g.slice(i + 1).map((b) => paletteDistance(a, b))));
        expect(widest, `${arc} ${key}`).toBeGreaterThan(0.03);
      }
    });
  }
});
