// The starters: two exhibits as an agent would make them. Their words hold to their sources: a Pompeii claim cites only
// what its record entry read, graded by how far the record checks it; a hydro caption's numbers are the chain's own.
import { describe, it, expect } from 'vitest';
import { EXHIBIT_STARTERS, recordClaim, hydroWing, makeStarter, thousands } from './starters.js';
import { POMPEII_RECORD } from '../historic/record/pompeii.js';
import { planHydroChain } from '../physics/hydro.js';
import { readBrief } from './brief.js';
import { TOUR_LIMITS } from './tour.js';

const entry = (id) => POMPEII_RECORD.find((e) => e.id === id);
const inputs = (S) => S.steps.map((s) => s.input);

describe('the Pompeii starter', () => {
  const town = inputs(EXHIBIT_STARTERS.pompeii)[0];

  it('names the town\'s parts, and states only claims its record holds, citing what the record read', () => {
    expect(town).toMatchObject({ id: 'history/pompeii', params: { parts: true } });
    const brief = readBrief(town.curation);
    for (const c of brief.claims) {
      const e = entry(c.id);
      expect(e).toBeTruthy();
      // a claim's sources are its entry's, never a search snippet
      expect(c.cite.length).toBeGreaterThan(0);
      for (const s of c.cite) expect(e.sources.some((src) => s.startsWith(`${src.author}, ${src.title}`) && !/snippet/.test(src.via || ''))).toBe(true);
      expect(c.grade).toBe(e.confidence === 'read' ? 'attested' : 'reconstructed');
    }
    expect(() => recordClaim('atlantis', 'x')).toThrow(/no entry 'atlantis'/);
    // the sign-off is the expert's: a starter never writes it
    expect(town.curation.signoff).toBeUndefined();
  });

  it('gives every stop its claims and a word for each audience the brief writes for', () => {
    const ids = new Set(town.curation.claims.map((c) => c.id));
    expect(town.tour.stops.length).toBeLessThanOrEqual(TOUR_LIMITS.stops);
    for (const s of town.tour.stops) {
      expect(s.claims.length).toBeGreaterThan(0);
      for (const c of s.claims) expect(ids.has(c)).toBe(true);
      expect(s.caption.length).toBeLessThanOrEqual(TOUR_LIMITS.caption);
      for (const a of town.curation.audiences.filter((a) => a !== 'general')) expect(s.captions?.[a]).toBeTruthy();
    }
    // every claim is said somewhere
    expect(new Set(town.tour.stops.flatMap((s) => s.claims))).toEqual(ids);
  });
});

describe('the hydro starter', () => {
  it('says the chain\'s own numbers, so a caption moves with the head', () => {
    const say = (W) => JSON.stringify(inputs(W));
    const c = planHydroChain({});
    const W = EXHIBIT_STARTERS.hydro;
    expect(say(W)).toContain(`${(Math.round(c.jet.v * 10) / 10)} m/s`);
    expect(say(W)).toContain(`${thousands(c.pressure.base / 1000)} kPa`);
    expect(say(W)).toContain(`${(Math.round(c.power.elec / 1e5) / 10)} MW reaches the line`);
    const high = hydroWing(120), h = planHydroChain({ head: 120 });
    expect(say(high)).toContain(`${thousands(h.pressure.base / 1000)} kPa`);
    expect(say(high)).not.toBe(say(W));
    expect([thousands(589), thousands(1177), thousands(15936)]).toEqual(['589', '1,177', '15,936']);
  });

  it('is one wing of toured rooms and a states room, joined by the refs made before it', async () => {
    const calls = [];
    const made = await makeStarter('hydro', async (input) => { calls.push(input); return { ref: `sk_${calls.length}` }; });
    const wing = calls.at(-1);
    expect(wing.rooms).toEqual(['sk_1', 'sk_2', 'sk_3', 'sk_4', 'sk_5', 'sk_6']);
    expect(calls.slice(0, 5).every((x) => x.id === 'earth/hydro' && x.tour && x.curation.aims.length)).toBe(true);
    expect(calls[5].states.of.map((s) => s.params.head)).toEqual([30, 60, 120]);
    expect(Object.keys(made)).toEqual(['dam', 'penstock', 'turbine', 'generator', 'plant', 'head', 'wing']);
    await expect(makeStarter('nowhere', async () => ({}))).rejects.toThrow(/no starter 'nowhere'/);
  });
});
