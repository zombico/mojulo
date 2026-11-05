import { describe, it, expect } from 'vitest';
import { contestResults, resultsKind } from './contest-results.js';
import { STAT_ROWS, statFormat } from './contest-stats.js';
import { manaUi, withIdioms } from '../../mana-ui/index.js';

// The handoff from the broadcast to the screen after it: an outcome's compact stats said again with the contest's own
// words, formats and lead. One kind chosen in code (the first two-sided one with a low-is-better row).
const KIND = Object.keys(STAT_ROWS).find((k) => STAT_ROWS[k].some((r) => r.better === 'low'));
const compact = Object.fromEntries(STAT_ROWS[KIND].map((r, i) => [r.id, { a: i + 2, b: i + 2 + (i % 2 ? 1 : -1) }]));
const envelope = { result: 'success', stats: { contest: compact } };

describe('a contest\'s results, handed on', () => {
  it('the kind is read off the rows; absent stats hand on nothing', () => {
    expect(resultsKind(compact)).toBe(KIND);
    expect(contestResults({ result: 'success' })).toBe(null);
    expect(contestResults({ result: 'fail', stats: { rows: [] } })).toBe(null);
  });
  it('each row in the contest\'s words and format, its one best value leading the way the row leans', () => {
    const R = contestResults(envelope, { names: ['North', 'South'] });
    expect(R.outcome).toBe('Won');
    expect(R.columns.map((c) => c.label)).toEqual(['', 'North', 'South']);
    R.rows.forEach((row, i) => {
      const def = STAT_ROWS[KIND][i], [a, b] = [compact[def.id].a, compact[def.id].b];
      expect(row.words).toBe(def.words);
      expect(row.c0).toBe(statFormat(def, a));
      const lead = a === b ? null : (def.better === 'low' ? a < b : a > b) ? 'c0' : 'c1';
      expect(row.lead, def.id).toBe(lead);
    });
    expect(R.scores.map((x) => x.side)).toHaveLength(2);
    expect(R.scores.find((x) => x.self).name).toBe('North');
  });
  it('the match-results idiom draws it: the score by side in its kit, the head to head with each lead marked', () => {
    const R = contestResults(envelope, { names: ['North', 'South'] });
    const rt = manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'match-results', props: { ...R, title: 'final', items: [{ label: 'Rematch', then: { emit: 'rematch' } }] } } } }), { read: () => undefined });
    const v = rt.view();
    expect(v).toContain('>Won<');
    expect(v).toContain('class="mana-chip" data-side="1"');
    expect((v.match(/data-lead="yes"/g) || []).length).toBe(R.rows.filter((r) => r.lead).length);
  });
});
