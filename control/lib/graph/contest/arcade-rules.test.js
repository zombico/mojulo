// The arcade rules: a sport as a card of modules its family composes. The concept on one card (chosen in code, the
// first): it composes to a sport the kernel reads and the shape's sim has its dials; a variant moves a module's word and
// keeps the rest; the refusals teach; the card served names every card and what it leaves out. Every card through the
// kernel and an exhibition is the deep sweep's (arcade-rules.deep.test.js).
import { describe, it, expect } from 'vitest';
import { ARCADE_SPORTS, ARCADE_SPORT_IDS, ARCADE_FAMILIES, arcadeCard, composeArcade, arcadeRulesCard } from './arcade-rules.js';
import { resolveSport, sportOf, MATCH_SPORT_IDS } from './sports.js';
import { contestRead } from './contest-kernel.js';

const first = ARCADE_SPORT_IDS[0], card = ARCADE_SPORTS[first];

describe('a card composed', () => {
  it('through its family to a sport of the family\'s shape the kernel reads, the sim\'s dials on it, its omissions said', () => {
    const s = composeArcade(card, first), fam = ARCADE_FAMILIES[card.family];
    expect(s.shape).toBe(fam.shape);
    const C = contestRead(s.spec());
    expect(C.shape).toBe(fam.shape === 'team' ? 'match' : fam.shape);
    for (const k of ['ball', 'players', 'strokes', 'net', 'serve', 'receive', 'home']) expect(s[k], k).toBeDefined();
    expect(s.arcade).toEqual({ family: card.family, card: first });
    expect(s.omits.length).toBeGreaterThan(0);
    // it is the book's by name, and plays on its shape's arena
    expect(sportOf(first)).toMatchObject({ shape: s.shape, words: card.words });
    expect(MATCH_SPORT_IDS).toContain(first);
    expect(JSON.stringify(resolveSport(first).spec())).toBe(JSON.stringify(s.spec()));
  });
  it('a variant moves a module\'s word over the card\'s and keeps the rest; words and omits replace', () => {
    const v = resolveSport({ id: 'mini', from: first, score: { to: 5 }, words: 'a short one' });
    const base = resolveSport(first).spec(), spec = v.spec();
    expect(spec.scoring.ladder[0]).toMatchObject({ to: 5, by: base.scoring.ladder[0].by });
    expect({ ...spec, scoring: null }).toEqual({ ...base, scoring: null });
    expect(v).toMatchObject({ id: 'mini', words: 'a short one', arcade: { family: card.family, card: first } });
    expect(arcadeCard({ from: first, omits: [] }).omits).toEqual([]);
    expect(contestRead(spec).scoring.ladder[0].to).toBe(5);
  });
  it('refuses, teaching: a module the family has not, a card that is not, the book\'s own id, the wrong shape', () => {
    expect(() => resolveSport({ id: 'x1', from: first, wings: 2 })).toThrow(new RegExp(`a ${card.family} card has no 'wings' \\(its modules: `));
    expect(() => resolveSport({ id: 'x1', from: 'quidditch' })).toThrow(/from names an arcade card \(/);
    expect(() => resolveSport({ id: first, from: first })).toThrow(new RegExp(`'${first}' is the book's`));
    expect(() => resolveSport({ id: 'X', from: first })).toThrow(/an id: a short lower-case name/);
    expect(() => resolveSport({ id: 'x1', from: first }, 'turns')).toThrow(/plays on the court/);
  });
});

describe('the arcade rules\' card', () => {
  it('names each family\'s modules and every card with its words and what it leaves out, small', () => {
    const c = arcadeRulesCard();
    expect(c.id).toBe('contest-arcade');
    expect(Buffer.byteLength(c.body)).toBeLessThan(4096);
    for (const [id, f] of Object.entries(ARCADE_FAMILIES)) { expect(c.body).toContain(`${id} (`); expect(c.body).toContain(f.says); }
    for (const id of ARCADE_SPORT_IDS) { expect(c.body).toContain(`  ${id} (`); for (const o of ARCADE_SPORTS[id].omits) expect(c.body).toContain(o); }
    expect(c.body).toContain('distilled-rulebook');
  });
});

describe('a no-volley zone a variant can play', () => {
  it('the court lays it and its foul costs the point; a cost the match cannot restart from is refused', () => {
    expect(() => composeArcade(arcadeCard({ id: 'pb-x', from: 'pickleball' }))).not.toThrow();
    expect(() => composeArcade(arcadeCard({ id: 'pb-x', from: 'pickleball', fouls: { kitchen: 'free' } }))).toThrow(/fouls\.kitchen is 'point'/);
    expect(() => composeArcade(arcadeCard({ id: 'pb-x', from: 'pickleball', fouls: { kitchen: 'fault' } }))).toThrow(/fouls\.kitchen is 'point'/);
    expect(() => composeArcade(arcadeCard({ id: 'pb-x', from: 'pickleball', noVolley: 'nowhere' }))).toThrow(/noVolley names a region the court lays/);
  });
});
