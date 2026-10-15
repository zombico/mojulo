import { describe, it, expect } from 'vitest';
import { diffReports, formatDiff } from './eval-diff.js';

const report = (rows) => ({
  when: 't', surface: 'body',
  routing: { correct: rows.filter((r) => r.ok).length, total: rows.length, rows, misses: rows.filter((r) => !r.ok) },
});
const row = (phrasing, expected, got) => ({ phrasing, expected, got, ok: expected === got });

describe('two routing reports, row by row', () => {
  it('splits a rise into the model moving and the answer key moving', () => {
    const a = report([
      row('change her hair', 'create_character', 'update_character'),   // the key will move to the reply
      row('sign my file', 'sign_asset', 'semantic_search'),             // the model will move
      row('walk through Thebes', 'create_sketch', 'compose_world'),     // will leave
      row('a bar chart', 'create_sketch', 'create_sketch'),             // unchanged
    ]);
    const b = report([
      row('change her hair', 'update_character', 'update_character'),
      row('sign my file', 'sign_asset', 'sign_asset'),
      row('a bar chart', 'create_sketch', 'create_sketch'),
      row('stamp my model', 'sign_asset', 'export_model'),
    ]);
    const d = diffReports(a, b);
    expect(d.legacy).toBe(false);
    expect(d.hits).toEqual({ model: 1, key: 1, both: 0, added: 0, removed: 0 });
    expect(d.flips.map((f) => [f.phrasing, f.why])).toEqual([
      ['change her hair', 'key'], ['sign my file', 'model'], ['walk through Thebes', 'removed'], ['stamp my model', 'added'],
    ]);
    expect(formatDiff(d)).toMatch(/model's answers moving: 1; the answer key moving: 1/);
  });

  it('a removed hit counts against the rise; a report with misses only compares by misses', () => {
    const a = report([row('x', 't', 't')]), b = report([]);
    expect(diffReports(a, b).hits.removed).toBe(-1);
    const legacy = (misses) => ({ routing: { correct: 0, total: 2, misses } });
    const m = (phrasing) => ({ phrasing, expected: 't', got: null });
    const d = diffReports(legacy([m('x'), m('y')]), legacy([m('y'), m('z')]));
    expect(d.legacy).toBe(true);
    expect([d.fixed, d.new, d.still].map((ms) => ms.map((x) => x.phrasing))).toEqual([['x'], ['z'], ['y']]);
    expect(formatDiff(d)).toMatch(/misses only/);
  });
});
