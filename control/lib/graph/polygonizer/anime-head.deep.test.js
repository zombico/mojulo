/** The anime head's exhaustive sweeps (anime-head.test.js keeps the laws on representative heads). Every sculpt word
 * and every hair word at its range ends, each end once (the bases alternated, not crossed), and one named cut per hair
 * procedure (its family and its shapes, chosen from the catalog) built and audited closed: the deep tier
 * (`npm run test:deep`, and in CI), not on every `npm test`. */
import { describe, it, expect } from 'vitest';
import { animeHead, ANIME_HAIR_BASE, ANIME_HAIR_MOVES, ANIME_HAIR_FORM_WORDS } from './anime-head.js';
import { ANIME_SCULPT, ANIME_SCULPT_KEYS } from './anime-sculpt.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { layeredExposure } from './station-loft-exposure.js';

const failures = (m) => Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n, r]) => `${n} b${r.boundaryEdges} nm${r.nonManifold} w${r.windingErrors} d${r.degenerate}`);

describe('anime head: the graphic face, swept', () => {
  it('every word at its range ends closes (sampled across the bases and the families); the eyes read', () => {
    const families = ['bob', 'short', 'long', 'hime'], bad = [];
    ANIME_SCULPT_KEYS.forEach((k, i) => ANIME_SCULPT.RANGES[k].forEach((v, j) => {
      // a family on every third build (the words reach the hair only through the fit's drape), bald otherwise
      const preset = (i + j) % 2 ? 'male' : 'female', hair = (i + j) % 3 ? 'none' : families[i % 4], h = animeHead({ preset, hair, sculpt: { [k]: v } }), mesh = compileLayered(h);
      const f = failures(mesh); if (f.length) bad.push(`${preset} ${hair} ${k}=${v}: ${f.join(', ')}`);
      if (j === 1) { const ex = layeredExposure(mesh, { res: 128 }); for (const e of ['irisR', 'irisL']) if (!['reads', 'faint'].includes(ex.parts[e].flag)) bad.push(`${preset} ${k}=${v}: ${e} ${ex.parts[e].flag}`); }
    }));
    expect(bad).toEqual([]);
  }, 180000);
});

describe('anime head: the hair words, swept', () => {
  it('every word at its range ends closes (sampled on its family, the bases alternated)', () => {
    const ends = [
      ['short', { lift: { crown: 0.3, temple: 0.14, fringe: 0.12, nape: 0.14 } }], ['short', { lift: { crown: 0, temple: 0, fringe: 0, nape: 0 } }], ['short', { section: 'ridge', crownAccents: 'tuck' }],
      ['short', { sweepBack: { amount: 0.5 } }], ['short', ANIME_HAIR_MOVES['swept-back'].hair], ['short', { sweepSides: { amount: 1, from: 0 } }], ['short', { hairline: { front: 1 } }],
      ['long', { ridge: 2, flute: 1 }], ['long', { fringeGroups: [[1, 2, 3, 4, 5, 6, 7]], backNotch: 1 }], ['bob', { fringeGroups: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]], backNotch: 0.5 }], ['long', ANIME_HAIR_MOVES['side-parted'].hair],
      ['long', { flip: { amount: 1, out: 1, rise: 1, hold: 1 } }], ['bob', { flip: 0.5, fringeNotch: 1 }], ['short', { spikes: { amount: 1, reach: 3, width: 3, up: 1 } }], ['short', { spikes: 0.4, crownAccents: 'tuck' }],
      ['long', { sideTail: { amount: 1, side: 'right', length: 2, width: 2, height: 1 } }], ['bob', { sideTail: { amount: 0.5, side: 'left', length: 0.3, width: 0.3, height: -1 } }],
    ];   // (the named cuts' own words are swept below, one per procedure)
    ends.forEach(([style, words], i) => {
      const preset = i % 2 ? 'male' : 'female', h = animeHead({ preset, hair: [ANIME_HAIR_BASE[preset].form, { ...words, style }] });
      expect(failures(compileLayered(h)), `${preset} ${style} ${JSON.stringify(words).slice(0, 80)}`).toEqual([]);
    });
  });
});

describe('anime head: every named cut, swept', () => {
  const on = (preset, hair) => { const h = animeHead({ preset, hair: [ANIME_HAIR_BASE[preset].form, ...(Array.isArray(hair) ? hair : [hair])] }); return { h, mesh: compileLayered(h) }; };
  // the named cuts (the ones that promise a covered scalp), one per procedure: the family and, for a shapes cut, its shape
  // families (carrots, bananas, peppers, peels), else its form words; the first of each, the bases alternated
  const NAMED = ['flipped-long', 'blunt-bob', 'side-tail', 'broku', 'jinto', 'kairo', 'bidel', 'selene', 'sintia', 'frieda', 'frieda-pony', 'hiraku', 'miwako'];
  const procedure = (w) => { const H = ANIME_HAIR_MOVES[w].hair, S = H.shapes;
    const fams = S ? [...new Set([...(S.layers || []).map((l) => l.shape), ...['carrot', 'banana', 'pepper', 'peel'].filter((f) => S[`${f}s`])])].sort() : ANIME_HAIR_FORM_WORDS.filter((k) => H[k] !== undefined);
    return `${H.style}:${fams.join(',')}`; };
  const firsts = NAMED.filter((w, i) => NAMED.findIndex((v) => procedure(v) === procedure(w)) === i);
  it('one cut per procedure closes and keeps the scalp covered', () => {
    expect(firsts.length).toBeGreaterThan(5);
    firsts.forEach((cut, i) => {
      const preset = i % 2 ? 'male' : 'female', { h, mesh } = on(preset, cut);
      expect(failures(mesh), `${preset} ${cut}`).toEqual([]);
      expect(Math.max(...Object.values(h.hairCoverage.views)), `${preset} ${cut}`).toBeLessThanOrEqual(0.02);
    });
  });
});
