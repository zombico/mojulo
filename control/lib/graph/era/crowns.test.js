/**
 * A stage's `crowns` word (era/isekai.js readCrowns): a reading by name, or { form, flock? }; a realistic crown is flock
 * (form/flora-read.js FLOCK) unless it says `flock: false`, and no other reading takes the setting.
 */
import { describe, it, expect } from 'vitest';
import { readCrowns, CROWNS } from './isekai.js';
import { readFlock } from '../form/flora-read.js';

describe('a stage\'s crowns', () => {
  it('reads a crown by name, a realistic one as flock unless it says not', () => {
    for (const c of CROWNS.filter((c) => c !== 'realistic')) expect(readCrowns(c)).toEqual({ crowns: c });
    expect(readCrowns('realistic')).toEqual({ crowns: 'realistic', flock: readFlock() });
    expect(readCrowns({ form: 'realistic' })).toEqual(readCrowns('realistic'));
    expect(readCrowns({ form: 'realistic', flock: false })).toEqual({ crowns: 'realistic' });
    expect(readCrowns({ form: 'realistic', flock: { shadow: 'solid', leaves: false } })).toEqual({ crowns: 'realistic', flock: { shadow: 'solid', leaves: false } });
  });

  it('refuses a word it does not know, and the flock on any crown but a realistic one', () => {
    expect(() => readCrowns('fluffy')).toThrow(/crowns is/);
    expect(() => readCrowns({ form: 'hybrid', flock: true })).toThrow(/realistic crown's setting/);
    expect(() => readCrowns({ form: 'realistic', holes: 2 })).toThrow(/not a setting/);
  });
});
