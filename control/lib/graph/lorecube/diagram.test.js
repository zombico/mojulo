// The lorecube's drawings are made from its data: a relation drawn is a relation the polarity has, a gauge drawn is a
// gauge that carries; the same lore gives the same manifest.
import { describe, it, expect } from 'vitest';
import { polarityDiagram, reserveDiagram, backdropTimeline, backdropWeb, backdropMap } from './diagram.js';
import { POLARITY_IDS, POLARITIES, resolvePolarity, relationsOf, elementHandles, newPolarity, intensifyPolarity } from './polarity.js';
import { carriersOf } from './reserve.js';

const ofShape = (shape) => POLARITY_IDS.find((id) => POLARITIES[id].shape === shape);
const kinds = (M, kind) => M.marks.filter((m) => m.kind === kind);
const says = (M) => kinds(M, 'text').map((t) => t.value);

describe('polarityDiagram', () => {
  it('draws each element once in its own tint, and one line a relation', () => {
    for (const shape of ['ring', 'pairs', 'wheel', 'poles']) {
      const P = resolvePolarity(ofShape(shape)), M = polarityDiagram(P);
      expect(kinds(M, 'circle').map((c) => c.fill), shape).toEqual(expect.arrayContaining(P.elements.map((e) => elementHandles(e).tint)));
      expect(kinds(M, 'circle'), shape).toHaveLength(P.elements.length);
      const allied = P.elements.reduce((n, e) => n + P.allies[e].length, 0) / 2;
      expect(kinds(M, 'line'), shape).toHaveLength(relationsOf(P).length + allied);
      expect(M.viewBox.width).toBeGreaterThan(0);
      expect(M.viewBox.height).toBeGreaterThan(300);
    }
  });

  it('a ring\'s arrows have one head, an opposition a head at both ends, an alliance none', () => {
    const ring = kinds(polarityDiagram(ofShape('ring')), 'line');
    expect(ring.every((l) => l.head === 'arrow' && !l.tail)).toBe(true);
    const wheel = kinds(polarityDiagram(ofShape('wheel')), 'line');
    expect(wheel.filter((l) => l.head === 'arrow' && l.tail === 'arrow').length).toBeGreaterThan(0);
    expect(wheel.filter((l) => l.head === 'none').length).toBeGreaterThan(0);
  });

  it('says the reasons that are said, and how many relations are still open', () => {
    const premise = newPolarity({ shape: 'ring', of: ['fire', 'ice', 'wind'] });
    expect(says(polarityDiagram(premise))).toContain('3 of 3 relations have no reason yet');
    const half = intensifyPolarity(premise, { why: { 'fire>ice': 'melts it' } }).polarity;
    expect(says(polarityDiagram(half))).toEqual(expect.arrayContaining(['fire beats ice: melts it', '2 of 3 relations have no reason yet']));
  });

  it('is deterministic, and takes a title', () => {
    expect(polarityDiagram(ofShape('pairs'))).toEqual(polarityDiagram(ofShape('pairs')));
    expect(polarityDiagram(ofShape('pairs'), { title: 'the four courts' }).title).toBe('the four courts');
  });
});

describe('reserveDiagram', () => {
  const R = { name: 'inner reserve', spent: ['special', 'move', 'imbue'], refill: ['time'], empty: ['refused'] };

  it('draws the reserve, each spend, and each gauge that carries one, joined as they are carried', () => {
    const M = reserveDiagram(R), C = carriersOf(R), t = says(M);
    for (const s of R.spent) expect(t).toContain(s);
    for (const c of C.carriers) expect(t).toContain(c.id);
    expect(kinds(M, 'rect')).toHaveLength(1 + R.spent.length + C.carriers.length);
    expect(kinds(M, 'line')).toHaveLength(R.spent.length + C.carriers.reduce((n, c) => n + c.carries.length, 0));
  });

  it('marks a spend no gauge carries, and says a reserve split across meters', () => {
    const M = reserveDiagram(R), t = says(M);
    expect(t).toContain('no gauge carries it');
    expect(kinds(M, 'rect').filter((r) => r.dash)).toHaveLength(1);
    expect(t.some((x) => /one reserve in the lore, 2 gauges/.test(x))).toBe(true);
    const whole = says(reserveDiagram({ name: 'mana', spent: ['special'] }));
    expect(whole).not.toContain('no gauge carries it');
    expect(whole.some((x) => /one reserve in the lore/.test(x))).toBe(false);
  });

  it('cuts no word in half, and is deterministic', () => {
    for (const v of says(reserveDiagram(R))) expect(v).not.toMatch(/ \w$/);
    expect(reserveDiagram(R)).toEqual(reserveDiagram(R));
  });
});

describe('a backdrop, drawn', () => {
  const B = {
    title: 'The Drowned Valley',
    actors: [{ id: 'millers', name: 'the millers', kind: 'people' }, { id: 'lowlanders', name: 'the lowlanders', kind: 'people' }, { id: 'river', name: 'the river', kind: 'force' }],
    events: [{ n: 1, says: 'The river floods the low fields', who: ['river'], stretch: 's1' }, { n: 2, says: 'The millers dam it', who: ['millers'], from: [1], stretch: 's1', at: ['dam'] }, { n: 3, says: 'The lowlanders move up to the town', who: ['lowlanders'], stretch: 's2', at: ['town'] }],
    stretches: [{ id: 's1', handle: 'the flood and the dam', agency: 'acted' }, { id: 's2', handle: 'the move', agency: 'acted' }],
    places: [{ id: 'dam', name: 'the dam', state: 'holds' }, { id: 'town', name: 'the mill town', state: 'crowded', who: ['millers', 'lowlanders'] }],
    moves: [{ from: 'dam', to: 'town', says: 'power', basis: 'inferred', because: 'the dam turns the mills' }],
    wants: [{ who: 'millers', wants: 'the dam kept', over: 'the dam', basis: 'stated' }, { who: 'lowlanders', wants: 'the valley back', over: 'the dam', basis: 'inferred', because: 'they lost it' }],
    conflicts: [{ id: 'the-floods', between: ['millers', 'river'], over: 'the floods', state: 'open', basis: 'stated' }],
    threads: ['the drowned church'], unknowns: ['who owns the dam'],
  };
  const says = (M) => M.marks.filter((m) => m.kind === 'text').map((t) => t.value);
  const of = (M, k) => M.marks.filter((m) => m.kind === k);

  it('the timeline draws every event once, in its stretch, with its causes; an event with none is said', () => {
    const M = backdropTimeline(B), t = says(M);
    expect(of(M, 'circle')).toHaveLength(B.events.length);
    expect(t).toEqual(expect.arrayContaining(['The millers dam it', 'from 1', 'no cause given', 'the flood and the dam', 'where play begins is not given', '· who owns the dam']));
    expect(t.some((x) => /the millers and the lowlanders, over the dam/.test(x))).toBe(true);
    const played = backdropTimeline({ ...B, play: { begins: { after: 3 }, pov: { who: 'a ferryman' }, basis: 'stated' } });
    expect(says(played).some((x) => /play begins, seen through a ferryman \(the author's\)/.test(x))).toBe(true);
    expect(backdropTimeline(B)).toEqual(M);
  });

  it('the web draws each actor once and each conflict once, joined; an open one marked, an implied one dotted and said so', () => {
    const M = backdropWeb(B), t = says(M);
    // a box an actor and a box a conflict (the listed one and the implied one), a line from each party to its conflict
    expect(of(M, 'rect')).toHaveLength(B.actors.length + 2);
    expect(of(M, 'line')).toHaveLength(4);
    expect(t).toEqual(expect.arrayContaining(['the floods', 'open where the text stops', 'the dam', 'implied by what both want; not said in the text', 'wants nothing', 'wants: the valley back *']));
    expect(of(M, 'line').filter((l) => l.dash === '2 4')).toHaveLength(2);
  });

  it('the map draws each place in its state, and what passes between; an inferred move is marked', () => {
    const M = backdropMap(B), t = says(M);
    expect(t).toEqual(expect.arrayContaining(['the dam', 'holds', 'the mill town', 'the millers, the lowlanders', 'power *']));
    expect(of(M, 'line')).toHaveLength(1);
    expect(says(backdropMap({ ...B, places: undefined, moves: undefined, events: B.events.map(({ at: _a, ...e }) => e) }))).toContain('no place is said yet');
  });
});
