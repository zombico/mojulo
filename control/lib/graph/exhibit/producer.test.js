// The exhibit's producer: the four questions only the person can answer, one a turn, the exhibits a concept points at,
// and the fit once their time is known. It builds nothing; a plain ask is made at once.
import { describe, it, expect } from 'vitest';
import { EXHIBIT_QUESTIONS, readStart, needsProducer, nearestExhibits, exhibitStart } from './producer.js';
import { exhibitFit, TIME_IDS } from './fit.js';
import { AUDIENCES } from './brief.js';

// a small catalog, the shape the door hands in: a card a row, one of them a hub that is read and not listed
const cards = new Map([
  ['earth/hydro', { name: 'Hydropower', summary: 'a dam, its reservoir and the turbine that makes electricity from falling water', when: 'how a dam works' }],
  ['earth/waterfall', { name: 'Waterfall', summary: 'water over a ledge', when: 'a waterfall' }],
  ['history/pompeii', { name: 'Pompeii', summary: 'the town in 79 CE', when: 'a Roman town' }],
  ['history/italy', { name: 'Italy', summary: 'the peninsula: Rome, Pompeii', when: 'Roman Italy' }],
  ['math/hidden', { name: 'Electricity hidden', summary: 'electricity', when: 'electricity', index: false }],
]);
const steps = (s) => exhibitStart(s, { cards }).next.map((x) => x.step);
const ids = EXHIBIT_QUESTIONS.map((q) => q.id);

describe('the exhibit\'s start', () => {
  it('asks the four questions in order, one a turn, and nothing twice', () => {
    expect(ids).toEqual(['concept', 'people', 'time', 'brought']);
    for (const q of EXHIBIT_QUESTIONS) expect(q.ask).toMatch(/\?$/);
    const empty = exhibitStart({}, { cards });
    expect(empty).toMatchObject({ ok: true, readout: 'start', built: false, producer: { seat: 'producer', step: 'concept', ask: EXHIBIT_QUESTIONS[0].ask } });
    expect(empty.next.map((x) => x.step)).toEqual(ids);
    // each answer given drops its question, in any order
    expect(steps({ concept: 'a dam', people: ['child'] })).toEqual(['place', 'time', 'brought']);
    expect(steps({ time: 'visit' })).toEqual(['concept', 'people', 'brought']);
    expect(exhibitStart({ concept: 'a dam', people: ['child'] }, { cards }).producer.step).toBe('time');
  });

  it('a plain ask is made at once; the producer leads only for people, a time, material or several subjects', () => {
    expect(needsProducer({ concept: 'a dam' })).toBe(false); expect(needsProducer({})).toBe(false);
    expect(needsProducer({ concept: 'a dam', brought: 'none' })).toBe(false);
    for (const more of [{ people: ['child'] }, { time: 'glance' }, { brought: ['a syllabus'] }, { wants: { rooms: 3 } }]) expect(needsProducer({ concept: 'a dam', ...more })).toBe(true);
    const plain = exhibitStart({ concept: 'how a dam makes electricity' }, { cards });
    expect(plain.plain).toBe(true); expect(plain.says).toMatch(/made at once/); expect(plain.next[0].step).toBe('place');
    const led = exhibitStart({ concept: 'how a dam makes electricity', time: 'visit' }, { cards });
    expect(led.plain).toBeUndefined(); expect(led.says).toMatch(/PRODUCER/);
  });

  it('places a concept on the exhibits whose own words it uses, most first, the one it names ahead', () => {
    const N = nearestExhibits('how a dam makes electricity from falling water', cards);
    expect(N[0]).toMatchObject({ id: 'earth/hydro' }); expect(N[0].matched).toEqual(expect.arrayContaining(['electricity', 'water']));
    expect(N.map((r) => r.id)).not.toContain('math/hidden');
    // a tie goes to the exhibit a word names, not the hub that mentions it
    expect(nearestExhibits('Pompeii', cards)[0].id).toBe('history/pompeii');
    expect(nearestExhibits('Pompeii', cards, 1)).toHaveLength(1);
    expect(nearestExhibits('what they should leave understanding', cards)).toEqual([]);
    expect(nearestExhibits('a dam', null)).toEqual([]);
    const out = exhibitStart({ concept: 'the tariff ledgers of a guild' }, { cards });
    expect(out.nearest).toBeUndefined(); expect(out.uncovered.says).toMatch(/say so before anything is built/);
    expect(exhibitStart({}, { cards }).uncovered).toBeUndefined();
  });

  it('says the fit once their time is known, and offers the make only when all four are answered', () => {
    const time = TIME_IDS[1], people = [AUDIENCES[0]];
    const part = exhibitStart({ concept: 'a dam', time }, { cards });
    expect(part.fit).toEqual(exhibitFit({ time })); expect(part.next.map((x) => x.step)).not.toContain('make');
    expect(exhibitStart({ concept: 'a dam', people }, { cards }).fit).toBeUndefined();
    const all = exhibitStart({ concept: 'a dam', people, time, brought: 'none', wants: { compare: true } }, { cards });
    expect(all.fit).toEqual(exhibitFit({ time, people, wants: { compare: true } }));
    expect(all.next.map((x) => x.step)).toEqual(['place', 'make']);
    expect(all.next[1]).toMatchObject({ size: all.fit.size, door: all.fit.door }); expect(all.next[1].says).toMatch(/never for them/);
    expect(all.producer).toBeNull();
  });

  it('reads what it is handed and teaches the rest', () => {
    expect(readStart({ concept: '  a dam ', people: 'child' })).toEqual({ concept: 'a dam', people: ['child'] });
    expect(() => readStart('a dam')).toThrow(/start is \{/);
    expect(() => readStart({ topic: 'x' })).toThrow(/topic is not one/);
    expect(() => readStart({ concept: '' })).toThrow(/leave understanding/);
    expect(() => readStart({ people: ['adults'] })).toThrow(/who it is for/);
    expect(() => readStart({ time: 'ages' })).toThrow(/how long people have/);
    expect(() => readStart({ brought: [] })).toThrow(/'none'/);
    expect(() => readStart({ wants: { rooms: 0 } })).toThrow(/how many subjects/);
  });
});
