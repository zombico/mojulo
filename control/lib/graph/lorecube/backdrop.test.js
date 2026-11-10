// Narrative lore, extracted: it sets down what a text says and marks what it reads into it; it never authors.
import { describe, it, expect } from 'vitest';
import { BACKDROP, BASES, AGENCIES, newBackdrop, intensifyBackdrop, clarifyBackdrop, readBackdrop, backdropReport, backdropLaws, chapterDigest } from './backdrop.js';
import { depthOf, openOf, rawNewCeiling, checkPass } from './passes.js';
import { CHAPTERS } from '../gameworld/chapters.js';

const by = (laws) => Object.fromEntries(laws.map((l) => [l.law, l]));
// the smallest lore that has every kind of statement: a valley, a dam, and what the dam left behind
const premise = {
  title: 'The Drowned Valley',
  actors: [{ id: 'millers', name: 'the millers', kind: 'people' }, { id: 'lowlanders', name: 'the lowlanders', kind: 'people' }, { id: 'river', name: 'the river', kind: 'force' }],
  events: [
    { n: 1, says: 'The river floods the low fields three years running', who: ['river'] },
    { n: 2, says: 'The millers dam it above the valley', who: ['millers'] },
    { n: 3, says: 'The valley drowns behind the dam; no one can stop the water', who: ['river'] },
    { n: 4, says: 'The lowlanders move up to the mill town', who: ['lowlanders'] },
  ],
};
const ordered = { stretches: [{ id: 's1', handle: 'the floods and the dam', agency: 'acted' }, { id: 's2', handle: 'the drowning', agency: 'watched' }, { id: 's3', handle: 'the move', agency: 'acted' }], events: { 1: { stretch: 's1' }, 2: { stretch: 's1', from: [1] }, 3: { stretch: 's2', from: [2] }, 4: { stretch: 's3', from: [3] } } };
const present = { places: [{ id: 'lake', name: 'the lake', state: 'the valley, under water' }, { id: 'town', name: 'the mill town', state: 'crowded since the move', who: ['millers', 'lowlanders'] }], moves: [{ from: 'lake', to: 'town', says: 'power from the dam', basis: 'stated' }], texture: ['the bells of the drowned church are heard in a dry summer'] };
const reading = {
  wants: [{ who: 'millers', wants: 'the dam kept', over: 'the dam', basis: 'stated' }, { who: 'lowlanders', wants: 'their valley back', over: 'the dam', basis: 'inferred', because: 'they lost it to the water' }],
  conflicts: [{ id: 'the-water', between: ['millers', 'river'], over: 'the floods', state: 'resolved', basis: 'stated', stretch: 's1' }],
  threads: ['the drowned church'], unknowns: ['who owns the dam', 'how long ago it was'],
};
const upTo = (...adds) => adds.reduce((B, a) => intensifyBackdrop(B, a).backdrop, newBackdrop(premise));
const whole = () => upTo(ordered, { ...present, events: { 3: { at: ['lake'] }, 4: { at: ['town'] } } }, reading);

describe('a backdrop, made in passes', () => {
  it('raw-new sets down what happened and who was in it, and stops', () => {
    const B = newBackdrop(premise);
    expect(depthOf(BACKDROP, B)).toBe(1);
    expect(rawNewCeiling(BACKDROP)).toBe(1);
    for (const l of checkPass(BACKDROP, 'raw-new', null, B)) expect(l.ok, l.law).toBe(true);
    expect(openOf(BACKDROP, B)).toEqual({ rung: 'ordered', missing: ['stretches'] });
    expect(() => newBackdrop({ ...premise, wants: [] })).toThrow(/wants is not a raw-new pass's/);
    expect(() => newBackdrop({ ...premise, events: [{ ...premise.events[0] }, { ...premise.events[1], from: [1] }, premise.events[2], premise.events[3]] })).toThrow(/'from' is not a raw-new pass's/);
  });

  it('intensify lays the rungs in order: stretches and causes, the present, the reading; the events\' words are never touched', () => {
    const B = newBackdrop(premise), done = whole();
    expect(depthOf(BACKDROP, upTo(ordered))).toBe(2);
    expect(depthOf(BACKDROP, done)).toBe(4);
    for (const l of checkPass(BACKDROP, 'intensify', B, done)) expect(l.ok, l.law).toBe(true);
    expect(done.events.map((e) => e.says)).toEqual(premise.events.map((e) => e.says));
    expect(() => intensifyBackdrop(B, { threads: ['the drowned church'] })).toThrow(/reading is said before its ordered \(stretches\)/);
    expect(() => intensifyBackdrop(B, { actors: [] })).toThrow(/is its premise/);
    expect(() => intensifyBackdrop(upTo(ordered), { events: { 2: { from: [1] } } })).toThrow(/already said/);
    expect(() => intensifyBackdrop(B, { events: { 9: { stretch: 's1' } }, stretches: ordered.stretches })).toThrow(/events 1, 2, 3, 4 are in none|no event of this backdrop/);
  });
});

describe('it extracts, it never authors', () => {
  it('a stretch has a handle, never a name', () => {
    expect(() => readBackdrop({ ...premise, stretches: [{ id: 's1', name: 'The Age of Mills', agency: 'acted' }] })).toThrow(/a stretch has a handle, not a name/);
  });

  it('every reading carries its basis, and an inference says from what', () => {
    expect(BASES).toEqual(['stated', 'inferred', 'asked']);
    const bad = (wants) => () => intensifyBackdrop(upTo(ordered, present), { ...reading, wants });
    expect(bad([{ who: 'millers', wants: 'the dam kept' }])).toThrow(/basis is how it is known: stated, inferred, asked/);
    expect(bad([{ who: 'millers', wants: 'profit', basis: 'inferred' }])).toThrow(/is inferred: say from what/);
  });

  it('the author\'s choices are given, never inferred', () => {
    const B = whole();
    expect(() => intensifyBackdrop(B, { play: { begins: { after: 4 }, basis: 'inferred' } })).toThrow(/the author's to give, never the tool's to infer/);
    const played = intensifyBackdrop(B, { play: { begins: { after: 4 }, pov: { who: 'a ferryman' }, basis: 'stated' } });
    expect(depthOf(BACKDROP, played.backdrop)).toBe(5);
    expect(played.open).toEqual([]);
  });

  it('a cause comes before what it causes; an actor or a place named must be one', () => {
    expect(() => readBackdrop({ ...premise, events: [premise.events[0], { n: 2, says: 'x', from: [3] }, premise.events[2], premise.events[3]] })).toThrow(/not an earlier event/);
    expect(() => readBackdrop({ ...premise, events: [{ n: 1, says: 'x', who: ['ghosts'] }] })).toThrow(/'ghosts' is no actor of this backdrop/);
    expect(() => readBackdrop({ ...premise, events: [{ n: 2, says: 'x' }] })).toThrow(/numbered from 1 in the order they happened/);
    expect(() => readBackdrop({ ...premise, actors: [{ id: 'fog', name: 'the fog', kind: 'weather' }] })).toThrow(/kind is people, or a force no one commands/);
  });
});

describe('clarifyBackdrop', () => {
  it('is a patch: it answers named unknowns and changes only what it names', () => {
    const B = whole();
    const C = clarifyBackdrop(B, { resolves: ['who owns the dam'], actors: { millers: { says: 'they own the dam outright' } }, texture: ['the town smells of wet grain'] });
    expect(C.unknowns).toEqual(['how long ago it was']);
    expect(C.resolved).toEqual(['who owns the dam']);
    expect(C.actors.find((a) => a.id === 'millers').says).toBe('they own the dam outright');
    expect(C.texture).toHaveLength(2);
    // everything it did not name is as it was
    expect(C.events).toEqual(B.events);
    expect(C.conflicts).toEqual(B.conflicts);
    expect(C.places).toEqual(B.places);
    expect(C.actors.filter((a) => a.id !== 'millers')).toEqual(B.actors.filter((a) => a.id !== 'millers'));
  });

  it('answers only what was open; adds a place the author names, never an actor or an event', () => {
    const B = whole();
    expect(() => clarifyBackdrop(B, { resolves: ['why the sky is green'] })).toThrow(/not one of its unknowns/);
    expect(clarifyBackdrop(B, { places: { ridge: { name: 'the ridge', state: 'bare' } } }).places.map((p) => p.id)).toEqual(['lake', 'town', 'ridge']);
    expect(() => clarifyBackdrop(B, { actors: { ghosts: { name: 'the ghosts', kind: 'people' } } })).toThrow(/is none of its actors/);
    expect(() => clarifyBackdrop(B, { events: { 9: { says: 'x' } } })).toThrow(/is none of its events/);
  });
});

describe('backdropReport', () => {
  it('reports each stretch and whether anyone acts in it, as the text says', () => {
    const R = backdropReport(whole());
    expect(R.stretches.map((s) => [s.id, s.acts, s.events])).toEqual([['s1', true, [1, 2]], ['s2', false, [3]], ['s3', true, [4]]]);
    expect(Object.keys(AGENCIES)).toContain('watched');
    expect(R.depth).toMatchObject({ stretches: 3, acted: 2, open: 0 });
    expect(R.depth.says).toMatch(/the author's to choose/);
  });

  it('reports an event with no stated cause, and the events that touch each place', () => {
    expect(backdropReport(newBackdrop(premise)).uncaused).toEqual([2, 3, 4]);
    const R = backdropReport(whole());
    expect(R.uncaused).toEqual([]);
    expect(R.placeEvents).toEqual({ lake: [3], town: [4] });
  });

  it('reports a conflict two wants imply that the text does not list, marked inferred; never adds it', () => {
    const B = whole(), R = backdropReport(B);
    expect(R.derived).toEqual([{ between: ['millers', 'lowlanders'], over: 'the dam', basis: 'inferred', because: 'both want it' }]);
    expect(B.conflicts).toHaveLength(1);
    // listed, it is no longer derived
    const listed = { ...B, conflicts: [...B.conflicts, { id: 'the-dam', between: ['millers', 'lowlanders'], over: 'the dam', state: 'open', basis: 'inferred', because: 'both want it' }] };
    expect(backdropReport(listed).derived).toEqual([]);
    expect(backdropReport(listed).open).toEqual(['the-dam']);
  });

  it('given the author\'s route, says how much of the backdrop it meets and what it misses', () => {
    const B = intensifyBackdrop(whole(), { play: { begins: { after: 4 }, route: [{ place: 'town', shows: [2, 4] }], basis: 'stated' } }).backdrop;
    expect(backdropReport(B).coverage).toEqual({ of: 4, met: 2, missed: [1, 3], unvisited: ['lake'] });
    expect(backdropReport(whole())).not.toHaveProperty('coverage');
  });
});

describe('backdropLaws', () => {
  it('advises: uncaused events, events that touch no place, an unlisted conflict, a route that misses', () => {
    expect(by(backdropLaws(newBackdrop(premise))).caused).toMatchObject({ ok: false, value: '2, 3, 4' });
    const L = by(backdropLaws(whole()));
    expect(L.caused.ok).toBe(true);
    expect(L.placed).toMatchObject({ ok: false, value: '1, 2' });
    expect(L['derived-said'].ok).toBe(false);
    expect(L['mostly-stated'].ok).toBe(true);
    expect(backdropLaws(whole())).toEqual(backdropLaws(whole()));
  });
});

describe('chapterDigest', () => {
  it('hands each chapter of the game book its own part, under that chapter\'s id', () => {
    const D = chapterDigest(intensifyBackdrop(whole(), { play: { begins: { after: 3 }, pov: { who: 'a ferryman' }, basis: 'stated' } }).backdrop);
    for (const id of Object.keys(D)) expect(CHAPTERS.map((c) => c.id), id).toContain(id);
    expect(D.intent).toMatchObject({ title: 'The Drowned Valley', play: { begins: { after: 3 }, pov: { who: 'a ferryman' } }, unknowns: ['who owns the dam', 'how long ago it was'] });
    expect(D.world.places.map((p) => [p.id, p.made_by])).toEqual([['lake', [3]], ['town', [4]]]);
    expect(D.world.forces).toEqual([{ name: 'the river' }]);
    expect(D.cast.people.map((p) => p.id)).toEqual(['millers', 'lowlanders']);
    expect(D.cast.people[1].wants[0]).toMatchObject({ basis: 'inferred' });
    // the story: what is before play, and what is in it
    expect(D.story.before_play.map((e) => e.n)).toEqual([1, 2, 3]);
    expect(D.story.in_play.map((e) => e.n)).toEqual([4]);
    expect(D['main-quest'].threads).toEqual(['the drowned church']);
  });

  it('a premise alone still hands the story its events, and says play is not given', () => {
    const D = chapterDigest(newBackdrop(premise));
    expect(D.intent.play).toMatch(/not given/);
    expect(D.story.before_play).toHaveLength(4);
    expect(D).not.toHaveProperty('main-quest');
  });
});
