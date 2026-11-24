// The home's producer: the questions only the person can answer, one a turn, the rail it starts from, and the steps
// that make it named into doors already built. It builds nothing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { HOME_QUESTIONS, readStart, needsProducer, homeStart, homeHandOff } from './producer.js';
import { HOME_RAILS, HOME_RAIL_IDS, HOME_LACKS, HOME_BRIDGES, homeRailOf } from './rails.js';
import { QUESTION_IDS } from './intake.js';
import { TOOL_LINES } from '../../mcp/tool-lines.js';
import { OUTCOMES } from '../structure/open.js';
import { getSketchVocabCard } from '../sketch-vocab/loader.js';
import { STYLE_NAMES } from '../interior/styles.js';

const steps = (s) => homeStart(s).next.map((x) => x.step);
const ids = HOME_QUESTIONS.map((q) => q.id);
// the doors a step names, by the listed tools it calls
const doorsOf = (list) => [...new Set(list.flatMap((s) => Object.keys(TOOL_LINES).filter((t) => new RegExp(`\\b${t}\\(`).test(s.door ?? ''))))];

describe('the home\'s rails', () => {
  it('each names into what is built: listed doors, the house\'s outcomes, vocab cards, the producer\'s questions', () => {
    const outcomes = OUTCOMES.map((o) => o.id);
    for (const id of HOME_RAIL_IDS) {
      const r = homeRailOf(id);
      for (const d of r.doors) expect(TOOL_LINES[d], `${id}: ${d} is no listed tool`).toBeTruthy();
      for (const o of r.outcomes) expect(outcomes, `${id}: ${o}`).toContain(o);
      for (const c of r.cards) expect(getSketchVocabCard(c), `${id}: card ${c}`).toBeTruthy();
      expect(r.asks.every((q) => ids.includes(q) && q !== 'what')).toBe(true);
      expect(r.first).toBeTruthy(); expect(r.words.length).toBeGreaterThan(0);
    }
    expect(() => homeRailOf('castle')).toThrow(/no rail/);
    expect(HOME_LACKS.join(' ')).toMatch(/no prices/);
    for (const b of HOME_BRIDGES) expect(doorsOf([b]).length).toBeGreaterThan(0);
  });

  it('every step of every hand-off calls a listed door, and the rail\'s own doors are the ones it calls', () => {
    for (const id of HOME_RAIL_IDS) {
      const list = homeHandOff({ rail: id, start: { place: { from: 'plan' }, living: { rooms: ['lounge'] } } });
      expect(list.at(-2).step).toBe('show'); expect(list.at(-1).step).toBe('offer');
      for (const d of HOME_RAILS[id].doors) expect(doorsOf(list), `${id} calls ${d}`).toContain(d);
    }
  });

  it('the home you have is the decor demo\'s session: the hand-off names the calls it made', () => {
    // docs/images/src/decor-demo/session.json: a homeowner's floor plan to three rooms designed and walked through
    const session = JSON.parse(readFileSync(path.resolve(__dirname, '../../../../docs/images/src/decor-demo/session.json'), 'utf8'));
    const made = new Set(session.turns.flatMap((t) => t.tools.filter((x) => !x.error).map((x) => x.name)));
    const list = homeHandOff({ rail: 'move-in', start: { place: 'plan', living: { rooms: ['the living room', 'the dining room', 'the big bedroom'] }, look: 'warm, natural, cozy' } });
    for (const d of doorsOf(list)) expect(made, `the session never called ${d}`).toContain(d);
    for (const d of ['mint_building', 'design_interior', 'forge_motion', 'stitch_motion']) expect(made).toContain(d);
    // a room each that they named, and no other
    expect(list.filter((s) => s.step === 'room').map((s) => s.room)).toEqual(['the living room', 'the dining room', 'the big bedroom']);
  });
});

describe('the home\'s start', () => {
  it('asks what first, then the rail\'s own questions in order, one a turn, nothing twice', () => {
    expect(ids).toEqual(QUESTION_IDS);
    for (const q of HOME_QUESTIONS) expect(q.ask).toMatch(/\?/);
    const empty = homeStart({});
    expect(empty).toMatchObject({ ok: true, readout: 'start', built: false, producer: { seat: 'producer', step: 'what' } });
    expect(empty.next.map((x) => x.step)).toEqual(['what']);
    expect(empty.rails.map((r) => r.id)).toEqual(HOME_RAIL_IDS);
    expect(empty.lacks).toEqual(HOME_LACKS);
    // a rail named with their place: its questions, in its order
    expect(steps({ what: 'move-in', place: 'plan' })).toEqual(['living', 'look', 'brought']);
    expect(steps({ what: 'new-house', living: 'a family of five, two work from home' })).toEqual(['look', 'place', 'brought']);
    expect(steps({ what: 'plans', place: { from: 'house', ref: 'sk_x' } })).toEqual(['brought']);
    // a café's living question is who comes, not who lives there
    expect(homeStart({ what: 'fit-out', place: 'measurements' }).producer.ask).toMatch(/seats/);
  });

  it('a plain ask is made at once; the producer leads for their place, their household or their material', () => {
    expect(needsProducer({})).toBe(false); expect(needsProducer({ what: 'room', look: 'japandi' })).toBe(false);
    expect(needsProducer({ what: 'room', brought: 'none' })).toBe(false);
    for (const more of [{ place: 'photo' }, { living: 'we have two cats' }, { brought: [{ id: 'p', kind: 'floor-plan', says: 'a two-bed flat', placed: 'plan' }] }]) expect(needsProducer({ what: 'room', ...more })).toBe(true);
    const plain = homeStart({ what: 'room', look: { style: 'japandi' } });
    expect(plain.plain).toBe(true); expect(plain.producer).toBeNull();
    expect(plain.next.map((x) => x.step)).toEqual(['make']);
    expect(plain.next[0].steps[0].style).toEqual({ name: 'japandi' });
    const led = homeStart({ what: 'room', place: 'photo' });
    expect(led.plain).toBeUndefined(); expect(led.says).toMatch(/PRODUCER/); expect(led.producer.step).toBe('living');
  });

  it('offers the make once the rail\'s questions are answered, said back first, its steps proposed and none run', () => {
    const all = homeStart({ what: 'move-in', place: 'plan', living: { rooms: ['lounge', 'bedroom'], uses: ['converse', 'read'] }, look: { style: 'warm-minimal', accent: 'japandi' }, brought: 'none' });
    expect(all.producer).toBeNull(); expect(all.next.map((x) => x.step)).toEqual(['make']);
    const make = all.next[0];
    expect(make).toMatchObject({ rail: 'move-in', doors: HOME_RAILS['move-in'].doors });
    expect(make.says).toMatch(/Say it back first/);
    expect(make.steps.map((s) => s.step)).toEqual(['house', 'read', 'room', 'room', 'review', 'walk', 'show', 'offer']);
    expect(make.steps[2]).toMatchObject({ room: 'lounge', style: { name: 'warm-minimal', accent: 'japandi' }, brief: { uses: ['converse', 'read'] } });
    expect(make.steps[0].says).toMatch(/Never a room the plan does not have/);
    expect(all.rail).toMatchObject({ id: 'move-in', first: HOME_RAILS['move-in'].first });
  });

  it('a question their own material answers is read, never asked', () => {
    const brought = [
      { id: 'plan', kind: 'floor-plan', says: 'a two-bed flat, the lounge facing south', placed: 'plan' },
      { id: 'pins', kind: 'inspiration', says: 'oak, linen, off-white walls', placed: 'style' },
      { id: 'money', kind: 'budget', says: 'about four thousand', aside: 'mojulo prices nothing; the schedule is what they price from' },
    ];
    const out = homeStart({ what: 'move-in', living: 'a couple, one works from home', brought });
    expect(out.next.map((x) => x.step)).toEqual(['place', 'look']);
    expect(out.next.every((x) => x.read && !x.ask)).toBe(true);
    expect(out.producer).toBeNull();
    expect(out.intake).toMatchObject({ items: 3, answered: { place: ['plan'], look: ['pins'] }, aside: [{ id: 'money' }] });
  });

  it('reads what it is handed and teaches the rest', () => {
    expect(readStart({ what: 'room', living: '  two kids  ', place: 'photo' })).toEqual({ what: 'room', living: { says: 'two kids' }, place: { from: 'photo' } });
    expect(() => readStart({ what: 'castle' })).toThrow(/\.what is the rail/);
    expect(() => readStart({ colour: 'red' })).toThrow(/\.colour is not one/);
    expect(() => readStart({ place: { from: 'house' } })).toThrow(/names its ref/);
    expect(() => readStart({ look: { style: 'gothic-revival' } })).toThrow(new RegExp(STYLE_NAMES[0]));
    expect(() => readStart({ living: { uses: ['juggle'] } })).toThrow(/a room's jobs/);
    expect(() => readStart({ brought: [{ id: 'b', kind: 'budget', says: 'ten grand', placed: 'pieces' }] })).toThrow(/prices nothing/);
    expect(() => readStart({ brought: [{ id: 'b', kind: 'keep', says: 'our sofa' }] })).toThrow(/nothing brought is dropped/);
  });
});
