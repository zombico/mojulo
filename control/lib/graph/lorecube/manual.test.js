// A monster manual: creatures on a polarity, their weaknesses from what opposes what, lowered to the party RPG's own
// words and read back by that game's reader.
import { describe, it, expect } from 'vitest';
import { ROLES, ROLE_IDS, ROLE_STATS, MANUAL, newManual, intensifyManual, readManual, derivedAffinity, manualLaws, lowerManual } from './manual.js';
import { depthOf, openOf, rawNewCeiling, checkPass } from './passes.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { ELEMENTS as RPG_ELEMENTS } from '../playscape/rpg/presets.js';
import { manualDiagram } from './diagram.js';

const by = (laws) => Object.fromEntries(laws.map((l) => [l.law, l]));
const ring = { shape: 'ring', of: ['fire', 'ice', 'lightning'] };
// the smallest manual that holds every law: a creature an element, a grunt, an elite and a boss among them
const premise = { polarity: ring, creatures: [{ id: 'imp', element: 'fire', role: 'grunt' }, { id: 'wight', element: 'ice', role: 'elite' }, { id: 'ram', element: 'lightning', role: 'boss', name: 'The Ram' }] };
const whole = () => intensifyManual(newManual(premise), { affinity: true, levels: true }).manual;

describe('a manual, made in passes', () => {
  it('raw-new says the creatures and stops; how they fare is the next passes\'', () => {
    const M = newManual(premise);
    expect(depthOf(MANUAL, M)).toBe(1);
    expect(rawNewCeiling(MANUAL)).toBe(1);
    for (const l of checkPass(MANUAL, 'raw-new', null, M)) expect(l.ok, l.law).toBe(true);
    expect(openOf(MANUAL, M)).toEqual({ rung: 'affinity', missing: ['affinity'] });
    expect(() => newManual({ ...premise, levels: { imp: 1 } })).toThrow(/levels is not a raw-new pass's/);
  });

  it('intensify lays affinities, then levels, in that order, touching nothing below', () => {
    const M = newManual(premise);
    const a = intensifyManual(M, { affinity: true });
    expect(a.open).toEqual(['levels']);
    const done = intensifyManual(a.manual, { levels: true });
    expect(done.open).toEqual([]);
    expect(depthOf(MANUAL, done.manual)).toBe(3);
    for (const l of checkPass(MANUAL, 'intensify', M, done.manual)) expect(l.ok, l.law).toBe(true);
    expect(() => intensifyManual(M, { levels: true })).toThrow(/levels are said before its affinity/);
    expect(() => intensifyManual(M, { creatures: [] })).toThrow(/is its premise/);
    expect(() => intensifyManual(a.manual, { affinity: true })).toThrow(/already said/);
  });

  it('a creature is weak to what beats its element and resists its own and what it beats; a boss takes its own in', () => {
    const A = derivedAffinity(newManual(premise));
    expect(A.imp).toEqual({ weak: ['thunder'], resist: ['fire', 'ice'] });
    expect(A.ram).toEqual({ weak: ['ice'], resist: ['fire'], absorb: ['thunder'] });
  });

  it('the author\'s own lists and levels lie over the derived ones', () => {
    const M = intensifyManual(newManual(premise), { affinity: { imp: { immune: ['sleep'] } }, levels: { wight: 7 } }).manual;
    expect(M.affinity.imp).toEqual({ weak: ['thunder'], resist: ['fire', 'ice'], immune: ['sleep'] });
    expect(M.affinity.wight.weak).toEqual(['fire']);
    expect(M.levels).toMatchObject({ imp: 1, wight: 7 });
  });

  it('says what is wrong', () => {
    expect(() => readManual({ creatures: premise.creatures })).toThrow(/polarity is what its creatures' elements stand on/);
    expect(() => readManual({ polarity: ring, creatures: [] })).toThrow(/list of \{ id, element, role/);
    expect(() => readManual({ polarity: ring, creatures: [{ id: 'imp', element: 'plasma', role: 'grunt' }] })).toThrow(/no element the character book knows/);
    expect(() => readManual({ polarity: ring, creatures: [{ id: 'imp', element: 'fire', role: 'minion' }] })).toThrow(/role is one of the cast's: grunt, harrier, elite, boss/);
    expect(() => readManual({ polarity: ring, creatures: [premise.creatures[0], premise.creatures[0]] })).toThrow(/two share an id/);
    expect(() => readManual({ ...premise, levels: { imp: 0, wight: 1, ram: 1 } })).toThrow(/whole level, 1 to/);
    expect(() => readManual({ ...premise, affinity: { imp: { weak: [] } } })).toThrow(/says nothing of wight, ram/);
  });
});

describe('manualLaws', () => {
  it('the smallest whole manual holds every law', () => {
    for (const l of manualLaws(whole())) expect(l.ok, l.law).toBe(true);
  });

  it('says an element with no creature, a missing role, a creature outside the polarity', () => {
    const L = by(manualLaws(newManual({ polarity: ring, creatures: [{ id: 'imp', element: 'fire', role: 'grunt' }, { id: 'mole', element: 'earth', role: 'grunt' }] })));
    expect(L['every-element']).toMatchObject({ ok: false, value: 'ice, lightning' });
    expect(L['every-role']).toMatchObject({ ok: false, value: 'elite, boss' });
    expect(L['in-polarity']).toMatchObject({ ok: false, value: 'mole (earth)' });
  });

  it('says a creature weak to nothing, and a role worth no more than a lesser one', () => {
    const none = intensifyManual(newManual(premise), { affinity: { imp: { weak: [] } } }).manual;
    expect(by(manualLaws(none))['every-weakness']).toMatchObject({ ok: false, value: 'imp' });
    // a grunt met late, an elite met at once: the elite is worth less than the grunt
    const upset = intensifyManual(newManual(premise), { affinity: true, levels: { imp: 12, wight: 1 } }).manual;
    expect(by(manualLaws(upset)).ladder).toMatchObject({ ok: false, value: 'wight under imp' });
  });
});

describe('lowerManual', () => {
  it('needs the numbered rung', () => {
    expect(() => lowerManual(newManual(premise))).toThrow(/lowers once it is numbered: it is at its premise/);
  });

  it('gives each creature a foe in the RPG\'s words, and each element a skill; the game\'s own reader takes them', () => {
    const { foes, skills, lacks } = lowerManual(whole());
    expect(Object.keys(foes)).toEqual(['imp', 'wight', 'ram']);
    expect(foes.imp).toMatchObject({ name: 'Imp', weak: ['thunder'], resist: ['fire', 'ice'], skills: ['fire-lash'], hp: ROLE_STATS.grunt.hp });
    expect(foes.ram).toMatchObject({ name: 'The Ram', boss: true, absorb: ['thunder'], skills: ['thunder-lash', 'thunder-storm'] });
    expect(skills['thunder-storm']).toMatchObject({ target: 'foes', element: 'thunder' });
    for (const f of Object.values(foes)) for (const e of [...(f.weak ?? []), ...(f.resist ?? [])]) expect(RPG_ELEMENTS).toContain(e);
    expect(lacks[0]).toMatch(/action game's foe has no element/);
    // read back by the party RPG's reader, as a world would carry it
    const cfg = readRpg({ rpg: { party: [{ id: 'hero', class: 'fighter' }], foes, skills, encounters: [{ id: 'gate', foes: ['imp', 'wight', 'ram'] }] } });
    expect(cfg).toBeTruthy();
  });

  it('a creature met later is stronger, by its level; a role\'s rank is the cast\'s', () => {
    const late = intensifyManual(newManual(premise), { affinity: true, levels: { imp: 4 } }).manual;
    expect(lowerManual(late).foes.imp.hp).toBeGreaterThan(lowerManual(whole()).foes.imp.hp);
    expect(ROLE_IDS).toEqual(Object.keys(ROLES));
    for (const r of ROLE_IDS) expect(ROLE_STATS[r], r).toBeTruthy();
  });

  it('is deterministic', () => {
    expect(lowerManual(whole())).toEqual(lowerManual(whole()));
  });
});

describe('the manual, drawn', () => {
  it('draws a column an element, each creature once, and what each element is weak to', () => {
    const M = whole(), D = manualDiagram(M), said = D.marks.filter((m) => m.kind === 'text').map((t) => t.value);
    for (const e of ring.of) expect(said).toContain(e);
    expect(said).toEqual(expect.arrayContaining(['Imp', 'Wight', 'The Ram', 'weak to thunder', 'level 1']));
    expect(D.marks.filter((m) => m.kind === 'circle')).toHaveLength(ring.of.length);
    expect(manualDiagram(M)).toEqual(D);
    expect(manualDiagram(newManual(premise)).marks.some((m) => m.value === 'level not said')).toBe(true);
  });
});
