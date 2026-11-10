// Narrative lore, extracted: it sets down what a text says and marks what it reads into it; it never authors.
import { describe, it, expect } from 'vitest';
import { BACKDROP, BASES, AGENCIES, newBackdrop, intensifyBackdrop, clarifyBackdrop, extendBackdrop, settleOrder, readBackdrop, backdropReport, backdropLaws, chapterDigest } from './backdrop.js';
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

describe('extendBackdrop: the author\'s further text', () => {
  const played = () => intensifyBackdrop(whole(), { play: { begins: { after: 4 }, route: [{ place: 'town', shows: [2, 4] }], basis: 'stated' } }).backdrop;

  it('sets new events in after the ones they follow, renumbers, and every reference follows', () => {
    const B = played();
    const X = extendBackdrop(B, {
      actors: [{ id: 'masons', name: 'the masons', kind: 'people' }],
      stretches: [{ id: 's1b', handle: 'the building', agency: 'acted', after: 's1' }],
      events: [
        { says: 'Masons are brought from the coast', who: ['masons'], after: 2, stretch: 's1b', from: [2] },
        { says: 'They cut the stone from the valley\'s own walls', who: ['masons'], after: 2, stretch: 's1b', from: ['new:1'], order: 'unsaid' },
      ],
    });
    expect(X.events.map((e) => e.says.slice(0, 12))).toEqual(['The river fl', 'The millers ', 'Masons are b', 'They cut the', 'The valley d', 'The lowlande']);
    expect(X.events.map((e) => e.n)).toEqual([1, 2, 3, 4, 5, 6]);
    // the new ones' causes, and the old ones', by their new numbers
    expect(X.events[2].from).toEqual([2]);
    expect(X.events[3].from).toEqual([3]);
    expect(X.events[4].from).toEqual([2]);
    expect(X.events[5].from).toEqual([5]);
    // where play begins and what the route shows follow the same events
    expect(X.play.begins).toEqual({ after: 6 });
    expect(X.play.route[0].shows).toEqual([2, 6]);
    expect(X.stretches.map((s) => s.id)).toEqual(['s1', 's1b', 's2', 's3']);
    expect(backdropReport(X).unordered).toEqual([4]);
  });

  it('keeps every word that was there; adds, never corrects', () => {
    const B = whole(), X = extendBackdrop(B, { places: [{ id: 'ridge', name: 'the ridge', state: 'bare' }], texture: ['the dam hums at night'], unknowns: ['who lives on the ridge'], wants: [{ who: 'lowlanders', wants: 'the toll lowered', basis: 'stated' }] });
    expect(X.events).toEqual(B.events);
    expect(X.places.slice(0, 2)).toEqual(B.places);
    expect(X.wants).toHaveLength(B.wants.length + 1);
    expect(X.texture.at(-1)).toBe('the dam hums at night');
    expect(() => extendBackdrop(B, { actors: [{ id: 'millers', name: 'the millers again', kind: 'people' }] })).toThrow(/already there: further text adds; a correction is clarifyBackdrop/);
  });

  it('says what is wrong: an event with nowhere to go, a cause that is no event, a stretch broken in two', () => {
    const B = whole();
    expect(() => extendBackdrop(B, { events: [{ says: 'x', after: 9 }] })).toThrow(/after is the event it follows, as the backdrop stands: 0 to 4/);
    expect(() => extendBackdrop(B, { events: [{ says: 'x', after: 2, stretch: 's1', from: ['new:3'] }] })).toThrow(/or an earlier new one/);
    expect(() => extendBackdrop(B, { events: [{ says: 'x', after: 3, stretch: 's1' }] })).toThrow(/one unbroken run of events/);
    expect(() => extendBackdrop(B, { stretches: [{ id: 'sx', handle: 'x', agency: 'acted' }] })).toThrow(/says the stretch it comes after/);
  });

  it('a clarification may restate a conflict the author names again', () => {
    const C = clarifyBackdrop(whole(), { conflicts: { 'the-water': { over: 'the floods, and who pays for them' } } });
    expect(C.conflicts[0].over).toBe('the floods, and who pays for them');
    expect(C.conflicts[0].between).toEqual(['millers', 'river']);
  });
});

describe('settleOrder: the author says when', () => {
  const unsaid = () => extendBackdrop(whole(), { stretches: [{ id: 'sx', handle: 'the masons', agency: 'acted', after: 's1' }, { id: 'sy', handle: 'after the move', agency: 'acted', after: 's3' }], events: [{ says: 'Masons come from the coast', after: 2, stretch: 'sx', order: 'unsaid' }] });

  it('sets the events after the one named, into the stretch named, no longer unsaid; every reference follows', () => {
    const B = intensifyBackdrop(unsaid(), { play: { begins: { after: 5 }, basis: 'stated' } }).backdrop;
    expect(backdropReport(B).unordered).toEqual([3]);
    const S = settleOrder(B, { events: [3], after: 5, stretch: 'sy' });
    expect(S.events.map((e) => e.says.slice(0, 10))).toEqual(['The river ', 'The miller', 'The valley', 'The lowlan', 'Masons com']);
    expect(S.events[4]).toMatchObject({ n: 5, stretch: 'sy' });
    expect(S.events[4]).not.toHaveProperty('order');
    expect(backdropReport(S).unordered).toEqual([]);
    expect(S.events[3].from).toEqual([3]);
    // play still begins after the same event; a stretch left empty is gone, the rest in the events' order
    expect(S.play.begins).toEqual({ after: 4 });
    expect(S.stretches.map((x) => x.id)).toEqual(['s1', 's2', 's3', 'sy']);
  });

  it('refuses to put an event before what it comes from, or to break a stretch', () => {
    expect(() => settleOrder(whole(), { events: [4], after: 1 })).toThrow(/one unbroken run of events|a cause comes first/);
    expect(() => settleOrder(whole(), { events: [3], after: 0 })).toThrow(/a cause comes first/);
    expect(() => settleOrder(whole(), { events: [2], after: 2 })).toThrow(/and not one of them/);
  });
});

describe('stakes: who leans on whom, from what passes between places', () => {
  it('counts, for each of the people, what its places give and need, whom it leans on and who leans on it', () => {
    const B = extendBackdrop(whole(), { places: [{ id: 'coast', name: 'the coast', state: 'buys the town\'s flour', who: ['lowlanders'] }], moves: [{ from: 'town', to: 'coast', says: 'flour', basis: 'stated' }] });
    const S = Object.fromEntries(backdropReport(B).stakes.map((x) => [x.who, x]));
    // the millers are in the town, which draws on the lake; the lake has no one in it
    expect(S.millers).toMatchObject({ in: ['town'], needs: ['power from the dam'], gives: ['flour'], leans_on: [] });
    // the lowlanders are in the town and on the coast: what passes between their own places is neither given nor needed
    expect(S.lowlanders.in).toEqual(['town', 'coast']);
    expect(S.lowlanders.gives).toEqual([]);
    expect(S.millers.leaned_on_by).toEqual(['lowlanders']);
    expect(S.millers.supplies).toEqual(['lowlanders']);
    expect(S.lowlanders.draws_from).toEqual([]);
    expect(S).not.toHaveProperty('river');
    expect(backdropReport(newBackdrop(premise))).not.toHaveProperty('stakes');
  });
});

describe('beliefs, and a conflict that stands', () => {
  it('a belief is what a side takes to be so: kept apart from what is, and from what it wants; it carries its basis', () => {
    const B = extendBackdrop(whole(), { beliefs: [{ who: 'millers', holds: 'the lowlanders mean to breach the dam', basis: 'stated' }] });
    expect(B.beliefs).toEqual([{ who: 'millers', holds: 'the lowlanders mean to breach the dam', basis: 'stated' }]);
    expect(B.places).toEqual(whole().places);
    expect(chapterDigest(B).cast.people.find((p) => p.id === 'millers').believes).toEqual([{ holds: 'the lowlanders mean to breach the dam', basis: 'stated' }]);
    expect(() => extendBackdrop(whole(), { beliefs: [{ who: 'millers', holds: 'x', basis: 'inferred' }] })).toThrow(/is inferred: say from what/);
  });

  it('a conflict may stand: the parties differ and coexist; it is not counted open', () => {
    const B = extendBackdrop(whole(), { conflicts: [{ id: 'the-deed', between: ['millers', 'lowlanders'], over: 'what the old deed says', state: 'standing', basis: 'stated' }] });
    expect(backdropReport(B).open).toEqual([]);
    expect(backdropReport(B).derived).toEqual([]);
    expect(() => extendBackdrop(whole(), { conflicts: [{ id: 'x', between: ['millers', 'lowlanders'], over: 'x', state: 'frozen', basis: 'stated' }] })).toThrow(/how it stands where the text stops: resolved, open, standing/);
  });
});
