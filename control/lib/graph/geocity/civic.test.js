// THE PLACES A CITY KEEPS (the metro's `civic`, blocks.js; segments.js `worship`, `cemetery`): a share of neighbourhoods
// give a calm block to a place of worship of a faith and their largest to a cemetery, on their own dice. The concepts:
// they are made, each a faith the metro names; `false` makes none and moves no other block; a bad word is refused.
import { describe, it, expect } from 'vitest';
import { designGeocity } from './design.js';
import { readGeocity } from './metro.js';
import { CIVIC_SEGMENTS } from './segments.js';

const SPEC = { metro: { from: 'lakeshore', rings: { core: 300, frame: 650 } }, extent: [1500, 1300], water: { sides: ['s'], depth: 100 }, core: [0.5, 0.3] };
const kinds = (d) => new Map(d.regions.flatMap((r) => (r.blocks ?? []).map((b) => [b.id, b])));

describe('the places a city keeps', () => {
  const on = kinds(designGeocity(SPEC, { seed: 3 })), off = kinds(designGeocity({ ...SPEC, civic: false }, { seed: 3 }));

  it('gives some neighbourhoods a place of worship of a faith it names, and a cemetery; none where it asks for none', () => {
    const places = [...on.values()].filter((b) => CIVIC_SEGMENTS.includes(b.kind));
    expect(places.some((b) => b.kind === 'worship')).toBe(true);
    expect(places.filter((b) => b.kind === 'worship').every((b) => ['church', 'mosque', 'temple'].includes(b.faith))).toBe(true);
    expect([...off.values()].some((b) => CIVIC_SEGMENTS.includes(b.kind))).toBe(false);
    // (one faith asked for, that faith alone)
    const only = [...kinds(designGeocity({ ...SPEC, civic: { faiths: { church: 0, mosque: 1, temple: 0 } } }, { seed: 3 })).values()].filter((b) => b.kind === 'worship');
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((b) => b.faith === 'mosque')).toBe(true);
  }, 60_000);

  it('takes its blocks on its own dice: every other block is the block it was', () => {
    for (const [id, b] of on) if (!CIVIC_SEGMENTS.includes(b.kind)) expect(off.get(id)?.kind, id).toBe(b.kind);
  }, 60_000);

  it('refuses a bad word, naming it', () => {
    expect(() => readGeocity({ ...SPEC, civic: { faiths: { druid: 1 } } })).toThrow(/civic/);
    expect(() => readGeocity({ ...SPEC, civic: { worship: { core: 2 } } })).toThrow(/civic/);
  });
});
