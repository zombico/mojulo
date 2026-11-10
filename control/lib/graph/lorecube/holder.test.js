// Who holds a slice of a power system, and what of it can be theirs alone: read before anything is built.
import { describe, it, expect } from 'vitest';
import { HOLDER_KINDS, HOLDER_KIND_IDS, DIALS, DIAL_IDS, SCOPES, HOLDS, HOLDER, newHolder, intensifyHolder, readHolder, holdersReport } from './holder.js';
import { depthOf, openOf, rawNewCeiling, checkPass } from './passes.js';
import { holdMatrixDiagram, holdersDiagram } from './diagram.js';

const by = (laws) => Object.fromEntries(laws.map((l) => [l.law, l]));
// a kind and a dial by the scope the table gives them, found in the table (a cell is an input; the scope is the procedure)
const cell = (scope) => { for (const k of HOLDER_KIND_IDS) for (const d of DIAL_IDS) if (HOLDS[k][d].scope === scope) return [k, d]; return null; };

describe('the table of what a holder can own', () => {
  it('answers every kind for every dial, with a known scope and its words; what is not none names the key that sets it', () => {
    expect(Object.keys(HOLDS)).toEqual(HOLDER_KIND_IDS);
    for (const k of HOLDER_KIND_IDS) {
      expect(Object.keys(HOLDS[k]), k).toEqual(DIAL_IDS);
      for (const d of DIAL_IDS) {
        const c = HOLDS[k][d];
        expect(SCOPES, `${k}.${d}`).toContain(c.scope);
        expect(c.says, `${k}.${d}`).toBeTruthy();
        if (c.scope !== 'none') expect(c.by, `${k}.${d}`).toBeTruthy();
      }
    }
    for (const s of SCOPES) expect(cell(s), s).toBeTruthy();
    expect(Object.keys(HOLDER_KINDS).length).toBeGreaterThan(1);
    expect(Object.keys(DIALS)).toEqual(DIAL_IDS);
  });
});

describe('a holder, made in passes', () => {
  it('raw-new says who and stops; the slice and the differences are the next passes\'', () => {
    const H = newHolder({ id: 'ember', kind: 'class', name: 'the Ember Court' });
    expect(H).toEqual({ id: 'ember', kind: 'class', name: 'the Ember Court' });
    expect(depthOf(HOLDER, H)).toBe(1);
    expect(rawNewCeiling(HOLDER)).toBe(1);
    for (const l of checkPass(HOLDER, 'raw-new', null, H)) expect(l.ok, l.law).toBe(true);
    expect(openOf(HOLDER, H)).toEqual({ rung: 'slice', missing: ['slice'] });
    expect(() => newHolder({ id: 'ember', kind: 'class', slice: { element: 'fire' } })).toThrow(/slice is not a raw-new pass's/);
  });

  it('intensify adds what it holds, then what it differs by, in that order, touching nothing below', () => {
    const H = newHolder({ id: 'ember', kind: 'class' });
    const sliced = intensifyHolder(H, { slice: { element: 'flame' } });
    expect(sliced.holder.slice).toEqual({ element: 'fire' });
    expect(sliced.open).toEqual(['differs']);
    const done = intensifyHolder(sliced.holder, { differs: ['element', 'powers'] });
    expect(done.open).toEqual([]);
    expect(depthOf(HOLDER, done.holder)).toBe(3);
    for (const l of checkPass(HOLDER, 'intensify', H, done.holder)) expect(l.ok, l.law).toBe(true);
    expect(() => intensifyHolder(H, { differs: ['look'] })).toThrow(/expression is said before its slice/);
    expect(() => intensifyHolder(H, { kind: 'hero' })).toThrow(/is its premise/);
    expect(() => intensifyHolder(sliced.holder, { slice: { element: 'ice' } })).toThrow(/already said/);
  });

  it('says what is wrong', () => {
    expect(() => readHolder({ id: 'Ember', kind: 'class' })).toThrow(/id is a short lower-case word/);
    expect(() => readHolder({ id: 'ember', kind: 'guild' })).toThrow(/kind is who can hold a slice: hero, class, foe, faction/);
    expect(() => readHolder({ id: 'ember', kind: 'class', slice: {} })).toThrow(/one at least/);
    expect(() => readHolder({ id: 'ember', kind: 'class', slice: { element: 'plasma' } })).toThrow(/no element the character book knows/);
    expect(() => readHolder({ id: 'ember', kind: 'class', slice: { element: 'fire' }, differs: ['aura'] })).toThrow(/'aura' is not a dial/);
    expect(() => readHolder({ id: 'ember', kind: 'class', colour: 'red' })).toThrow(/colour is not part of a holder/);
  });
});

describe('holdersReport', () => {
  const ring = { shape: 'ring', of: ['fire', 'ice', 'lightning'] };
  const three = (kind, differs) => [['a', 'fire'], ['b', 'ice'], ['c', 'lightning']].map(([id, element]) => ({ id, kind, slice: { element }, differs }));

  it('says how each holder stands to each other in the polarity', () => {
    const R = holdersReport(three('foe', ['element']), { polarity: ring });
    expect(R.holders[0].stands).toEqual({ b: 'beats', c: 'yields' });
    expect(R.holders[1].stands).toEqual({ a: 'yields', c: 'beats' });
  });

  it('a difference that is the holder\'s own holds; one the whole game has one of, or nothing gives, is said', () => {
    const [ownKind, ownDial] = cell('own'), [worldKind, worldDial] = cell('world'), [noneKind, noneDial] = cell('none');
    expect(by(holdersReport(three(ownKind, [ownDial])).laws)['every-difference-own'].ok).toBe(true);
    const shared = holdersReport(three(worldKind, [worldDial]));
    expect(by(shared.laws)['every-difference-own']).toMatchObject({ ok: false, value: `a.${worldDial}, b.${worldDial}, c.${worldDial}` });
    expect(shared.holders[0].differs[0]).toMatchObject({ dial: worldDial, scope: 'world' });
    expect(by(holdersReport(three(noneKind, [noneDial])).laws)['every-difference-own'].ok).toBe(false);
  });

  it('two holders of one element, or one outside the polarity, are said', () => {
    const twice = holdersReport([{ id: 'a', kind: 'foe', slice: { element: 'fire' } }, { id: 'b', kind: 'foe', slice: { element: 'ember' } }], { polarity: ring });
    expect(by(twice.laws).distinct).toMatchObject({ ok: false, value: 'fire' });
    const out = holdersReport([{ id: 'a', kind: 'foe', slice: { element: 'earth' } }], { polarity: ring });
    expect(by(out.laws)['in-polarity']).toMatchObject({ ok: false, value: 'a (earth)' });
    expect(out.holders[0]).not.toHaveProperty('stands');
  });

  it('a weakness lands only on a kind that can take one', () => {
    const can = HOLDER_KIND_IDS.find((k) => HOLDS[k].weakness.scope !== 'none'), cannot = HOLDER_KIND_IDS.find((k) => HOLDS[k].weakness.scope === 'none');
    expect(by(holdersReport(three(can, ['element']), { polarity: ring }).laws)['weakness-lands'].ok).toBe(true);
    expect(by(holdersReport(three(cannot, ['element']), { polarity: ring }).laws)['weakness-lands']).toMatchObject({ ok: false, value: 'a, b, c' });
    // no polarity, no such law
    expect(by(holdersReport(three(cannot, ['element'])).laws)).not.toHaveProperty('weakness-lands');
  });

  it('a holder\'s reserve needs a gauge of its own scope', () => {
    const party = { name: 'mana', spent: ['skill'] }, hero = { name: 'breath', spent: ['sustain'] };
    const H = (kind, reserve) => [{ id: 'a', kind, slice: { reserve } }];
    expect(holdersReport(H('class', 'mana'), { reserves: [party] }).holders[0].reserve).toMatchObject({ carried: true });
    expect(by(holdersReport(H('class', 'breath'), { reserves: [hero] }).laws)['reserve-carried'].ok).toBe(false);
    expect(holdersReport(H('hero', 'breath'), { reserves: [hero] }).holders[0].reserve.carried).toBe(true);
    expect(holdersReport(H('hero', 'ki'), { reserves: [] }).holders[0].reserve.says).toMatch(/no reserve of that name/);
    expect(by(holdersReport([{ id: 'a', kind: 'hero' }]).laws)).not.toHaveProperty('reserve-carried');
  });

  it('refuses two holders of one id, and is deterministic', () => {
    expect(() => holdersReport([{ id: 'a', kind: 'foe' }, { id: 'a', kind: 'hero' }])).toThrow(/two share an id/);
    expect(holdersReport(three('foe', ['look']), { polarity: ring })).toEqual(holdersReport(three('foe', ['look']), { polarity: ring }));
  });
});

describe('the holders, drawn', () => {
  const kinds = (M, kind) => M.marks.filter((m) => m.kind === kind);

  it('the matrix has a cell for every kind and dial, each saying its scope', () => {
    const M = holdMatrixDiagram(), cells = HOLDER_KIND_IDS.length * DIAL_IDS.length;
    expect(kinds(M, 'rect').length).toBe(cells + SCOPES.length);
    const said = kinds(M, 'text').map((t) => t.value);
    for (const d of DIAL_IDS) expect(said).toContain(d);
    for (const k of HOLDER_KIND_IDS) expect(said).toContain(k);
    expect(M).toEqual(holdMatrixDiagram());
  });

  it('a roster draws each holder in its element\'s tint, a chip a difference, and the laws that do not hold', () => {
    const [worldKind, worldDial] = cell('world');
    const list = [{ id: 'a', kind: worldKind, slice: { element: 'fire' }, differs: [worldDial] }, { id: 'b', kind: worldKind, slice: { element: 'ice' }, differs: [worldDial] }];
    const M = holdersDiagram(list), said = kinds(M, 'text').map((t) => t.value);
    expect(kinds(M, 'circle')).toHaveLength(2);
    expect(kinds(M, 'rect')).toHaveLength(2);
    expect(said.some((x) => x.includes(`a.${worldDial}, b.${worldDial}`))).toBe(true);
    const fine = holdersDiagram([{ id: 'a', kind: 'foe', slice: { element: 'fire' }, differs: ['look'] }]);
    expect(kinds(fine, 'text').map((t) => t.value)).toContain('every law holds');
  });
});
