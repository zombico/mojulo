// The brief: the expert's half of an exhibit, and the accuracy gate that reads their sign-off against the claims as they
// are now. Never 'passed': whether a claim is true is the expert's.
import { describe, it, expect } from 'vitest';
import { readBrief, stampSignoff, accuracyOf, gradeOfClaims, AUDIENCES } from './brief.js';
import { catalogueHtml } from './catalogue.js';

const claims = [
  { id: 'atp', text: 'Mitochondria make most of the ATP.', cite: 'Alberts ch. 14', grade: 'depicted' },
  { id: 'dna', text: 'The nucleus holds the DNA.', cite: ['Alberts ch. 4'], grade: 'depicted' },
];

describe('readBrief', () => {
  it('keeps the aims, the audiences in their order, the claims with their sources, the expert', () => {
    const b = readBrief({ aims: 'A cell is many parts.', audiences: ['specialist', 'child', 'child'], claims, expert: { name: 'Dr. Rivera', role: 'cell biologist' } });
    expect(b.aims).toEqual(['A cell is many parts.']);
    expect(b.audiences).toEqual(AUDIENCES.filter((a) => a !== 'general'));
    expect(b.claims[0]).toEqual({ id: 'atp', text: 'Mitochondria make most of the ATP.', cite: ['Alberts ch. 14'], grade: 'depicted' });
    expect(b.expert).toEqual({ name: 'Dr. Rivera', role: 'cell biologist' });
  });

  it('says what is wrong and what it takes', () => {
    const at = (b) => () => readBrief({ aims: ['x'], ...b });
    expect(() => readBrief({})).toThrow(/aims is what a visitor should leave understanding/);
    expect(at({ audiences: ['adults'] })).toThrow(/audiences names 'adults'; it is any of child, general, specialist/);
    expect(at({ claims: [{ id: 'A', text: 'x' }] })).toThrow(/claims\[0\]\.id is lowercase/);
    expect(at({ claims: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }] })).toThrow(/repeats 'a'/);
    expect(at({ claims: [{ id: 'a', text: 'x', grade: 'true' }] })).toThrow(/grade is one of attested/);
    expect(at({ signoff: { by: 'X', on: '2026-11-10', claims: 'all' } })).toThrow(/signs claims, and this brief states none/);
    expect(at({ claims, signoff: { by: 'X', on: 'yesterday', claims: 'all' } })).toThrow(/signoff\.on is the day the expert signed/);
    expect(at({ notes: 'x' })).toThrow(/'notes' is not a brief key/);
  });
});

describe('the accuracy gate', () => {
  const brief = readBrief({ aims: ['x'], claims });

  it('reads unsigned, then signed as stamped, then changed when a claim is edited or added', () => {
    expect(accuracyOf(brief)).toMatchObject({ gate: 'accuracy', state: 'unsigned', signed: 0, total: 2, unsigned: ['atp', 'dna'] });
    const stamped = stampSignoff({ ...brief, signoff: { by: 'Dr. Rivera', on: '2026-11-10', claims: 'all' } });
    expect(stamped.signoff.claims).toEqual(claims.map((c) => ({ id: c.id, text: c.text })));
    expect(readBrief(stamped).signoff.claims).toEqual(stamped.signoff.claims);
    expect(accuracyOf(stamped)).toMatchObject({ state: 'signed', signed: 2, by: 'Dr. Rivera', on: '2026-11-10' });
    const edited = { ...stamped, claims: [stamped.claims[0], { ...stamped.claims[1], text: 'The nucleus holds nearly all the DNA.' }, { id: 'new', text: 'x' }] };
    expect(accuracyOf(edited)).toMatchObject({ state: 'changed', signed: 1, changed: ['dna'], unsigned: ['new'] });
    expect(accuracyOf(edited).says).toMatch(/1 claim changed since and 1 added since: ask the expert again/);
    for (const b of [brief, stamped, edited]) expect(accuracyOf(b).state).not.toBe('passed');
  });

  it('a stop takes the least sure grade of its claims within one family', () => {
    expect(gradeOfClaims([{ grade: 'attested' }, { grade: 'conjectural' }, { grade: 'reconstructed' }])).toBe('conjectural');
    expect(gradeOfClaims([{ grade: 'simulated' }, { grade: 'depicted' }])).toBe('depicted');
    expect(gradeOfClaims([{ grade: 'simulated' }, { grade: 'attested' }])).toBe('simulated');
    expect(gradeOfClaims([{ text: 'x' }])).toBeUndefined();
  });
});

describe('the catalogue', () => {
  it('prints the aims, every caption by audience, each claim with its sources and its sign-off, and never establishes it', () => {
    const b = stampSignoff(readBrief({ aims: ['A cell is many parts.'], audiences: ['child'], claims, signoff: { by: 'Dr. Rivera', on: '2026-11-10', claims: 'all' } }));
    const tour = { stops: [{ title: 'Power', caption: 'ATP.', captions: { child: 'Power plants!' }, claims: ['atp'], camera: 'a' }] };
    const html = catalogueHtml({ title: 'Inside <a> cell', brief: b, rooms: [{ title: 'Inside an animal cell', label: 'Life', tour, brief: b }] });
    expect(html).toContain('Inside &lt;a&gt; cell');
    expect(html).toContain('A cell is many parts.');
    expect(html).toContain('data-a="Young visitors">Power plants!');
    expect(html).toContain('Alberts ch. 14');
    expect(html).toMatch(/Signed by Dr\. Rivera on 2026-11-10, every claim as it stands/);
    expect(html).toContain('it does not establish it');
    expect(html).not.toMatch(/<script|https?:\/\//);
  });
});
