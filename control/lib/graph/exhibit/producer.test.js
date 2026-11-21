// The exhibit's producer: the four questions only the person can answer, one a turn, and the fit once their time is
// known. The exhibit is made new: the halls are samples, and nothing matches a concept to a catalog. It builds nothing.
import { describe, it, expect } from 'vitest';
import * as producer from './producer.js';
import { EXHIBIT_QUESTIONS, LIKE, readStart, needsProducer, exhibitStart } from './producer.js';
import { exhibitFit, TIME_IDS } from './fit.js';
import { AUDIENCES } from './brief.js';

const steps = (s) => exhibitStart(s).next.map((x) => x.step);
const ids = EXHIBIT_QUESTIONS.map((q) => q.id);

describe('the exhibit\'s start', () => {
  it('asks the four questions in order, one a turn, and nothing twice', () => {
    expect(ids).toEqual(['concept', 'people', 'time', 'brought']);
    for (const q of EXHIBIT_QUESTIONS) expect(q.ask).toMatch(/\?$/);
    const empty = exhibitStart({});
    expect(empty).toMatchObject({ ok: true, readout: 'start', built: false, producer: { seat: 'producer', step: 'concept', ask: EXHIBIT_QUESTIONS[0].ask } });
    expect(empty.next.map((x) => x.step)).toEqual(ids);
    // each answer given drops its question, in any order
    expect(steps({ concept: 'a dam', people: ['child'], scales: ['macro'] })).toEqual(['time', 'brought']);
    // (with a concept and no scale named yet, the agent's own step leads the list: it is no question for the person)
    expect(steps({ concept: 'a dam', people: ['child'] })).toEqual(['scale', 'time', 'brought']);
    expect(steps({ time: 'visit' })).toEqual(['concept', 'people', 'brought']);
    expect(exhibitStart({ concept: 'a dam', people: ['child'] }).producer.step).toBe('time');
  });

  it('a plain ask is made at once; the producer leads only for people, a time, material or several subjects', () => {
    expect(needsProducer({ concept: 'a dam' })).toBe(false); expect(needsProducer({})).toBe(false);
    expect(needsProducer({ concept: 'a dam', brought: 'none' })).toBe(false);
    for (const more of [{ people: ['child'] }, { time: 'glance' }, { brought: ['a syllabus'] }, { wants: { rooms: 3 } }]) expect(needsProducer({ concept: 'a dam', ...more })).toBe(true);
    const plain = exhibitStart({ concept: 'how a dam makes electricity' });
    expect(plain.plain).toBe(true); expect(plain.says).toMatch(/made at once, new/); expect(plain.next[0].step).toBe('scale'); expect(plain.next[0].ask).toBeUndefined(); expect(plain.producer.step).toBe('people');
    const led = exhibitStart({ concept: 'how a dam makes electricity', time: 'visit' });
    expect(led.plain).toBeUndefined(); expect(led.says).toMatch(/PRODUCER/);
  });

  it('the exhibit is made new: the halls are samples, and no concept is matched to a catalog', () => {
    expect(Object.keys(producer).filter((k) => /nearest|match|place/i.test(k))).toEqual([]);
    for (const s of [{}, { concept: 'how a dam makes electricity' }, { concept: 'a dam', people: ['child'], time: 'visit', brought: 'none' }]) {
      const out = exhibitStart(s);
      expect(out.like).toEqual(LIKE); expect(out.nearest).toBeUndefined(); expect(out.next.map((x) => x.step)).not.toContain('place');
    }
    expect(LIKE.says).toMatch(/SAMPLES/); expect(LIKE.says).toMatch(/make theirs new/);
  });

  it('says the fit once their time is known, and offers the make only when all four are answered', () => {
    const time = TIME_IDS[1], people = [AUDIENCES[0]];
    const part = exhibitStart({ concept: 'a dam', time });
    expect(part.fit).toEqual(exhibitFit({ time })); expect(part.next.map((x) => x.step)).not.toContain('make');
    expect(exhibitStart({ concept: 'a dam', people }).fit).toBeUndefined();
    const all = exhibitStart({ concept: 'a dam', people, time, brought: 'none', wants: { compare: true } });
    expect(all.fit).toEqual(exhibitFit({ time, people, wants: { compare: true } }));
    expect(all.next.map((x) => x.step)).toEqual(['scale', 'make']);
    const make = all.next[1];
    expect(make).toMatchObject({ size: all.fit.size, door: all.fit.door }); expect(make.says).toMatch(/never for them/); expect(make.says).toMatch(/new from the primitives/);
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
