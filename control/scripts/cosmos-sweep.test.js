import { describe, it, expect } from 'vitest';
import { parseArgs, formatSweep, formatFixture } from './cosmos-sweep.mjs';
import { sweep } from '../lib/graph/cosmos/sweep.js';
import { fixture } from '../lib/graph/cosmos/fixtures.js';
import { dryRun } from '../lib/graph/cosmos/cosmos.js';

describe('cosmos-sweep CLI', () => {
  it('parses its flags, and names them on an unknown one', () => {
    expect(parseArgs([])).toEqual({ n: 500, seed: 1, density: 0.2, top: 15, fixture: null, json: false });
    expect(parseArgs(['--n', '40', '--seed', '9', '--fixture', 'jrpg', '--json'])).toMatchObject({ n: 40, seed: 9, fixture: 'jrpg', json: true });
    expect(() => parseArgs(['--n', 'many'])).toThrow(/--n takes a number/);
    expect(() => parseArgs(['--size'])).toThrow(/unknown argument '--size' \(known: --n/);
  });

  it('prints the fixtures, the verdict counts and both rankings', () => {
    const text = formatSweep(sweep({ n: 50, seed: 2 }), { top: 5 });
    expect(text).toMatch(/^cosmos sweep · n 50 · seed 2 · density 0.2/);
    expect(text).toMatch(/◆ dungeon-crawler\s+makeable/);
    expect(text).toMatch(/unlock by facet/);
    expect(text).toMatch(/build order: work packages/);
    expect(text).toMatch(/unlock by value: the top 5/);
  });

  it('prints one fixture row by row, with what each value lowers to', () => {
    const f = fixture('jrpg');
    const text = formatFixture(f, dryRun(f.cube));
    expect(text).toMatch(/verdict blocked/);
    expect(text).toMatch(/combat=turn-based\s+absent/);
  });
});
