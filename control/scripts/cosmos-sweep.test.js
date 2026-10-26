import { describe, it, expect } from 'vitest';
import { parseArgs, formatSweep, formatFixture } from './cosmos-sweep.mjs';
import { sweep } from '../lib/graph/cosmos/sweep.js';
import { fixture } from '../lib/graph/cosmos/fixtures.js';
import { dryRun } from '../lib/graph/cosmos/cosmos.js';

describe('cosmos-sweep CLI', () => {
  it('parses its flags, and names them on an unknown one', () => {
    expect(parseArgs([])).toEqual({ n: 500, seed: 1, density: 0.2, roll: 'fair', around: null, top: 15, fixture: null, json: false });
    expect(parseArgs(['--roll', 'flat', '--around', 'probes'])).toMatchObject({ roll: 'flat', around: 'probes' });
    expect(parseArgs(['--n', '40', '--seed', '9', '--fixture', 'jrpg', '--json'])).toMatchObject({ n: 40, seed: 9, fixture: 'jrpg', json: true });
    expect(() => parseArgs(['--n', 'many'])).toThrow(/--n takes a number/);
    expect(() => parseArgs(['--size'])).toThrow(/unknown argument '--size' \(known: --n/);
  });

  it('prints the fixtures, the verdict counts and both rankings', () => {
    const text = formatSweep(sweep({ n: 50, seed: 2 }), { top: 5 });
    expect(text).toMatch(/^cosmos sweep · n 50 · seed 2 · density 0.2 · fair roll/);
    expect(formatSweep(sweep({ n: 20, seed: 2, around: 'jrpg' }))).toMatch(/^cosmos sweep · n 20 · seed 2 · around jrpg/);
    expect(text).toMatch(/◆ dungeon-crawler\s+makeable/);
    expect(text).toMatch(/unlock by facet/);
    expect(text).toMatch(/build order: work packages/);
    expect(text).toMatch(/unlock by value: the top 5/);
    expect(text).toMatch(/godot ladder, power: .*\n  now\s+\d+\n  \+ power\./);
    expect(text).toMatch(/godot by value: /);
  });

  it('prints one fixture row by row, with what each value lowers to', () => {
    const f = fixture('shooter');
    expect(formatFixture(f, dryRun(f.cube))).toMatch(/verdict makeable/);
    // the same shooter asked at seventh-generation fidelity has a gap: the era is partial (its live light built as
    // opt-ins, its lightmaps, normal maps, HDR and IBL planned)
    const hd = { ...f, cube: { ...f.cube, reality: { ...f.cube.reality, era: 'gen-7' } } };
    const text = formatFixture(hd, dryRun(hd.cube));
    expect(text).toMatch(/verdict gaps/);
    expect(text).toMatch(/era=gen-7\s+partial/);
  });
});
