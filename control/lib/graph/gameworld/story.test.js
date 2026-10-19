import { describe, it, expect } from 'vitest';

import { MEADOWMARK_HERO } from './examples.js';
import { readGameworld } from './world.js';
import { runSteps } from './runner.js';
import { heroOrders, castOrders } from './hero-looks.js';
import { gameStages, stageLevelOrder, stageEnds, stageSpots, stageLane, gameStore } from './levels.js';
import { bindStory } from './story.js';
import { reviewParts } from './review.js';
import { gameworldBibleHtml } from './bible-html.js';
import { storyReport } from './runner.js';
import { readMade } from './made.js';

// The cast (characters.cast) and the story (gameworld story): people made as the hero is, placed in the levels by the
// moments that name them, bound to the world as laid; what cannot bind is reported, never thrown.
const { review, ...base } = MEADOWMARK_HERO;
const CAST = {
  mayor: { name: 'Mayor Ilse', looks: { body: { cast: 'female', tune: 'stout' }, hair: ['bob'], colour: { palette: { Top: '#3a5a8c' } } } },
  guard: { looks: { body: { cast: 'male' } } },
};
const W = ({ cast = CAST, story } = {}) => ({
  ...base,
  characters: { ...base.characters, ...(cast ? { cast } : {}) },
  levels: {
    gate: { name: 'The gate', seed: 8, walk: { nodes: { path: { trail: true }, yard: { trail: true } } } },
    cave: { name: 'The cave', seed: 8, walk: { nodes: { mouth: { trail: true } } } },
  },
  links: [{ from: 'gate', to: 'cave' }],
  ...(story ? { story } : {}),
});
const WELCOME = { id: 'welcome', who: ['mayor'], where: { level: 'gate', place: 'pocket' }, when: { start: true }, sets: ['met-mayor'], beats: [{ banter: { with: ['mayor', 'hero'], lines: [{ who: 'mayor', say: 'Welcome.' }, { who: 'hero' }] } }] };
const LAYOUT = { stageEnds, stageSpots, stageLane };

describe('the cast', () => {
  it('is read and taught: people with looks and motion, no player pages, no pinned base', () => {
    const G = readGameworld(W());
    expect(Object.keys(G.characters.cast)).toEqual(['mayor', 'guard']);
    expect(G.characters.cast.mayor.name).toBe('Mayor Ilse');
    const bad = (cast) => () => readGameworld(W({ cast }));
    expect(bad({ mayor: { actions: {} } })).toThrow(/cast\.mayor\.actions is not part of a cast member .*the player's, on the hero/);
    expect(bad({ hero: {} })).toThrow(/the hero is the hero's page/);
    expect(bad({ Mayor: {} })).toThrow(/a cast id is a short lower-case name/);
    expect(bad({ mayor: { looks: { base: { ref: 'x', rev: 1, print: 'p' } } } })).toThrow(/no pinned base/);
  });

  it('each is made as the hero is, under the same direction; the hero\'s own calls never change', () => {
    const G = readGameworld(W()), G0 = readGameworld(W({ cast: null }));
    expect(heroOrders(G)).toEqual(heroOrders(G0));
    const M = castOrders(G, 'mayor'), H = heroOrders(G);
    expect(M.mint.args).toMatchObject({ kind: 'layered', via: 'hero', title: `${G.name} · Mayor Ilse` });
    expect(M.mint.args.spec.palette.Top).toBe('#3a5a8c');
    expect(M.mint.args.spec).not.toEqual(H.mint.args.spec);
    expect(M.mint.args.toon).toEqual(H.mint.args.toon);   // the tradition's light, as the hero's
    expect(castOrders(G, 'nobody')).toBeNull();
  });

  it('a run records what it made of the cast', () => {
    expect(() => readMade({ 'cast-mayor': { ref: 'gw-cast-mayor', order: '0123abcd', stored: '89abcdef' } })).not.toThrow();
    expect(() => readMade({ 'cast-': { ref: 'x', order: '0123abcd', stored: '89abcdef' } })).toThrow(/is not something a run makes \(hero, hero-equipped, guard, ride, foe, tower, farmhand, cast-<id>/);
  });

  it('design_game makes each after the hero, at <ref>-cast-<id>; without a story no level is remade', () => {
    const S = runSteps(W(), { ref: 'gw' }), S0 = runSteps(W({ cast: null }), { ref: 'gw' });
    expect(S[0].key).toBe('hero');
    expect(S.filter((s) => s.key.startsWith('cast-')).map((s) => [s.key, s.ref])).toEqual([['cast-mayor', 'gw-cast-mayor'], ['cast-guard', 'gw-cast-guard']]);
    const prints = (steps) => Object.fromEntries(steps.filter((s) => !s.key.startsWith('cast-')).map((s) => [s.key, s.print]));
    expect(prints(S)).toEqual(prints(S0));
  }, 240_000);
});

describe('the story, bound', () => {
  const stages = gameStages(W());
  const castRefs = { mayor: 'gw-cast-mayor', guard: 'gw-cast-guard' };
  const bind = (story) => bindStory(readGameworld(W({ story })), stages, { castRefs, layout: LAYOUT });

  it('a moment binds to its level\'s first stage, its people standing at its place, its scene carrying their names', () => {
    const b = bind([WELCOME]);
    expect(b.unplaced).toEqual([]);
    expect(b.bound).toEqual([{ id: 'welcome', level: 'gate', node: 'path', place: 'pocket' }]);
    const slot = b.byStage['gate/path'];
    expect(slot.scenes[0]).toMatchObject({ id: 'welcome', names: { mayor: 'Mayor Ilse' }, sets: ['met-mayor'] });
    expect(slot.scenes[0].who).toBeUndefined();
    const pocket = stageSpots(stageEnds(stages[0].manifest)).find((s) => s.id === 'pocket').at;
    expect(slot.cast).toHaveLength(1);
    expect(slot.cast[0]).toMatchObject({ id: 'mayor', ref: 'gw-cast-mayor' });
    expect(Math.hypot(slot.cast[0].at[0] - pocket[0], slot.cast[0].at[1] - pocket[1])).toBeLessThan(2);
  }, 120_000);

  it('what cannot bind is unplaced, with what is missing; the rest binds', () => {
    const b = bind([
      { ...WELCOME, id: 'a', where: { level: 'tower' } },
      { ...WELCOME, id: 'b', where: { level: 'gate', stage: 'cellar' } },
      { ...WELCOME, id: 'c', where: { level: 'gate', place: 'altar' } },
      { ...WELCOME, id: 'd', who: ['smith'] },
      { ...WELCOME, id: 'e', stand: { mayor: 'balcony' } },
      { ...WELCOME, id: 'ok', where: { level: 'cave' } },
    ]);
    const why = Object.fromEntries(b.unplaced.map((u) => [u.id, u.why]));
    expect(why.a).toMatch(/no level 'tower' \(levels: gate, cave\)/);
    expect(why.b).toMatch(/no stage 'cellar' \(stages: path, yard\)/);
    expect(why.c).toMatch(/has no place 'altar' \(places: start, exit/);
    expect(why.d).toMatch(/'smith' not in the cast \(cast: mayor, guard\)/);
    expect(why.e).toMatch(/no place 'balcony' for mayor/);
    expect(b.bound.map((x) => x.id)).toEqual(['ok']);
    expect(b.byStage['cave/mouth'].cast[0].id).toBe('mayor');   // beside the start, with no place named
  }, 120_000);

  it('a level stage takes its people after the pilot, each a made cast figure; the story slice carries its flags', () => {
    const G = readGameworld(W({ story: [WELCOME] })), b = bindStory(G, stages, { castRefs, layout: LAYOUT });
    const o = stageLevelOrder(G, stages[0], { ref: 'gw-level-gate-0', heroRef: 'gw-hero', story: b.byStage['gate/path'] });
    const m = o.args.manifest;
    expect(m.entities.map((e) => e.id)).toEqual(['hero', 'mayor']);
    expect(m.entities[1]).toMatchObject({ rule: { type: 'static' }, body: { type: 'figure-rig', figure: 'mayor' } });
    expect(m.entities[1].pilotable).toBeUndefined();
    expect(m.figures.mayor).toMatchObject({ heroRef: 'gw-cast-mayor', library: 'quaternius-ual' });
    expect(m.play.scenes.map((s) => s.id)).toEqual(['welcome']);
    expect(m.play.carry).toBe('story');
    expect(gameStore(W({ story: [WELCOME] }), null).slices.map((s) => s.name)).toContain('story');
  }, 120_000);

  it('design_game passes each stage its share: the bound stage changes, the others are not remade', () => {
    const S = runSteps(W({ story: [WELCOME] }), { ref: 'gw' }), S0 = runSteps(W(), { ref: 'gw' });
    const print = (steps, key) => steps.find((s) => s.key === key).print;
    expect(print(S, 'level-gate-0')).not.toBe(print(S0, 'level-gate-0'));
    expect(print(S, 'level-gate-1')).toBe(print(S0, 'level-gate-1'));
    expect(print(S, 'level-cave-0')).toBe(print(S0, 'level-cave-0'));
  }, 240_000);

  it('reach: the moment starts as the hero comes to its place (an area round it, from the place as bound)', () => {
    const b = bind([{ ...WELCOME, when: { reach: 5 } }, { ...WELCOME, id: 'near-mayor', where: { level: 'cave' }, when: { reach: true } }]);
    const pocket = stageSpots(stageEnds(stages[0].manifest)).find((s) => s.id === 'pocket').at;
    expect(b.byStage['gate/path'].scenes[0].when).toEqual({ enter: { at: [pocket[0], pocket[1]], r: 5 } });
    const cave = b.byStage['cave/mouth'];
    expect(cave.scenes[0].when).toEqual({ enter: { at: [cave.cast[0].at[0], cave.cast[0].at[1]], r: 4 } });
    expect(() => readGameworld(W({ story: [{ ...WELCOME, when: { reach: 99 } }] }))).toThrow(/when\.reach is true \(4 m\) or metres up to 30/);
  }, 120_000);

  it('teaches a malformed moment (a typo in shape, not in what it names)', () => {
    const bad = (story) => () => readGameworld(W({ story }));
    expect(bad([{ ...WELCOME, where: 'gate' }])).toThrow(/story\[0\]\.where is \{ level, stage\?, place\? \}/);
    expect(bad([{ ...WELCOME, who: 'mayor' }])).toThrow(/story\[0\]\.who is a list of cast ids/);
    expect(bad([{ ...WELCOME, beats: [{ wait: 0 }] }])).toThrow(/story\[0\]\.beats\[0\]\.wait is seconds/);
    expect(bad([{ ...WELCOME, mood: 'grim' }])).toThrow(/story\[0\]\.mood is not part of a moment/);
    expect(bad([WELCOME, WELCOME])).toThrow(/'welcome' appears twice/);
  });
});

describe('the story, reviewed and shown', () => {
  it('the cast and the story are review parts only in a world that has them', () => {
    const ids = (w) => reviewParts(w).map((p) => p.id);
    expect(ids(W({ story: [WELCOME] }))).toEqual(expect.arrayContaining(['cast', 'story']));
    expect(ids(W({ cast: null }))).not.toContain('cast');
    expect(ids(W({ cast: null }))).not.toContain('story');
    expect(ids(W())).not.toContain('story');
  });

  it('the report names what bound and what could not; the world bible shows both', () => {
    const story = [WELCOME, { ...WELCOME, id: 'lost', where: { level: 'tower' } }];
    const r = storyReport(W({ story }));
    expect(r.bound.map((b) => b.id)).toEqual(['welcome']);
    expect(r.unplaced).toEqual([{ id: 'lost', why: expect.stringMatching(/no level 'tower'/) }]);
    const html = gameworldBibleHtml(W({ story }));
    expect(html).toContain('id="story"');
    expect(html).toContain('Mayor Ilse');
    expect(html).toContain('Unplaced');
    expect(html).toContain("no level 'tower'");
    expect(storyReport(W())).toBeNull();
    expect(gameworldBibleHtml(W({ cast: null }))).not.toContain('id="story"');
  }, 240_000);
});


describe('choices and quests, cascaded', () => {
  const stages = gameStages(W());
  const castRefs = { mayor: 'gw-cast-mayor', guard: 'gw-cast-guard' };
  const ASK = { ...WELCOME, sets: undefined, beats: [{ line: { who: 'mayor', say: 'Will you clear the cave?' } }, { choose: { options: [{ say: 'I will.', sets: ['took-job'] }, { say: 'No.' }] } }] };
  const { sets: _s, ...ASKED } = ASK;
  const DEEP = { id: 'deep', who: ['guard'], where: { level: 'cave' }, when: { reach: true }, sets: ['found-cave'], beats: [{ line: { who: 'guard' } }] };
  const QUESTS = [{ id: 'clear-the-cave', starts: 'took-job', steps: [{ log: 'Find the cave', done: 'found-cave', moments: ['deep'] }, { done: 'cave-cleared' }] }];
  const WQ = (extra = {}) => ({ ...W({ story: [ASKED, DEEP] }), quests: QUESTS, ...extra });

  it('a moment\'s choice carries its flags: the story slice is kept', () => {
    expect(gameStore(W({ story: [ASKED] }), null).slices.map((s) => s.name)).toContain('story');
  });

  it('a step\'s moments wait for the quest to begin (or the step before); every stage keeps the journal', () => {
    const G = readGameworld(WQ());
    const b = bindStory(G, stages, { castRefs, layout: LAYOUT });
    expect(b.byStage['cave/mouth'].scenes[0].if).toEqual([{ flag: 'took-job' }]);
    expect(b.byStage['gate/path'].scenes[0].if).toBeUndefined();
    expect(b.unset).toEqual([{ quest: 'clear-the-cave', step: 2, flag: 'cave-cleared' }]);
    for (const [i, s] of stages.entries()) {
      const o = stageLevelOrder(G, s, { ref: `gw-level-${i}`, heroRef: 'gw-hero', story: b.byStage[`${s.level}/${s.node}`] });
      expect(o.args.manifest.play.quests).toEqual([{ id: 'clear-the-cave', starts: 'took-job', steps: [{ log: 'Find the cave', done: 'found-cave' }, { done: 'cave-cleared' }] }]);
      expect(o.args.manifest.play.carry).toBe('story');
    }
  }, 120_000);

  it('teaches: a step\'s moments must be the story\'s, each in one step', () => {
    const bad = (quests) => () => readGameworld({ ...W({ story: [ASKED, DEEP] }), quests });
    expect(bad([{ id: 'q', steps: [{ done: 'x', moments: ['nowhere'] }] }])).toThrow(/'nowhere' is not a moment of the story \(welcome, deep\)/);
    expect(bad([{ id: 'q', steps: [{ done: 'x', moments: ['deep'] }, { done: 'y', moments: ['deep'] }] }])).toThrow(/'deep' is already in q, step 1/);
    expect(bad([{ id: 'q', steps: [{ log: 'x' }] }])).toThrow(/gameworld: quests\[0\]\.steps\[0\]\.done is the flag/);
  });

  it('reported and shown: the quests a review part, the unset step in the report and the bible', () => {
    expect(reviewParts(WQ()).map((p) => p.id)).toContain('quests');
    const r = storyReport(WQ());
    expect(r.unset).toEqual([{ quest: 'clear-the-cave', step: 2, flag: 'cave-cleared' }]);
    const html = gameworldBibleHtml(WQ());
    expect(html).toContain('Quest · clear-the-cave');
    expect(html).toContain('nothing in the story sets it');
  }, 240_000);

  it('design_game: the quests reach every stage; without them, no stage changes', () => {
    const S = runSteps(WQ(), { ref: 'gw' }), S0 = runSteps(W({ story: [ASKED, DEEP] }), { ref: 'gw' });
    const lv = (steps) => steps.filter((s) => s.key.startsWith('level-'));
    for (const [i, s] of lv(S).entries()) expect(s.print).not.toBe(lv(S0)[i].print);
  }, 240_000);
});

describe('companions: a cast member who joins', () => {
  const stages = gameStages(W());
  const castRefs = { mayor: 'gw-cast-mayor', guard: 'gw-cast-guard' };
  const JOIN = { mayor: CAST.mayor, guard: { ...CAST.guard, joins: 'joined-guard' } };
  const MEET = { id: 'meet', who: ['guard'], where: { level: 'cave' }, when: { reach: true }, beats: [{ choose: { who: 'guard', say: 'Shall I come?', options: [{ say: 'Come with me.', sets: ['joined-guard'] }, { say: 'Stay here.' }] } }] };
  const party = [{ id: 'guard', ref: 'gw-cast-guard', joins: 'joined-guard' }];

  it('is read and taught', () => {
    expect(readGameworld(W({ cast: JOIN })).characters.cast.guard.joins).toBe('joined-guard');
    expect(() => readGameworld(W({ cast: { guard: { joins: 'Joined' } } }))).toThrow(/cast\.guard\.joins is the flag that makes them join the hero/);
  });

  it('where the story stands them, they wait at their stand on the escort motive; elsewhere they sleep behind the start', () => {
    const G = readGameworld(W({ cast: JOIN, story: [MEET] }));
    const b = bindStory(G, stages, { castRefs, layout: LAYOUT });
    const at = (s, i) => stageLevelOrder(G, s, { ref: `gw-level-${i}`, heroRef: 'gw-hero', story: b.byStage[`${s.level}/${s.node}`], party }).args.manifest;
    const cave = at(stages.find((s) => s.level === 'cave'), 2), gate = at(stages[0], 0);
    const g = cave.entities.find((e) => e.id === 'guard');
    expect(g).toMatchObject({ team: 'party', rule: { type: 'ai', mind: { motivation: 'escort' }, escort: cave.entities[0].id } });
    expect(g.dormant).toBeUndefined();
    expect(cave.play.party).toEqual([{ who: 'guard', joins: 'joined-guard', at: 'stand-guard' }]);
    expect(cave.play.spots.find((s) => s.id === 'stand-guard').at).toEqual(g.transform.pos.slice(0, 2));
    const s = gate.entities.find((e) => e.id === 'guard');
    expect(s).toMatchObject({ dormant: true, team: 'party', body: { type: 'figure-rig', figure: 'guard' } });
    expect(gate.figures.guard).toMatchObject({ heroRef: 'gw-cast-guard' });
    expect(gate.play).toMatchObject({ party: [{ who: 'guard', joins: 'joined-guard' }], carry: 'story' });
  }, 120_000);

  it('design_game: every level carries them and the story slice; the figures are made as before', () => {
    const S = runSteps(W({ cast: JOIN }), { ref: 'gw' }), S0 = runSteps(W(), { ref: 'gw' });
    const print = (steps, key) => steps.find((s) => s.key === key).print;
    for (const k of ['cast-guard', 'cast-mayor', 'hero']) expect(print(S, k)).toBe(print(S0, k));
    for (const k of S.filter((s) => s.key.startsWith('level-')).map((s) => s.key)) expect(print(S, k)).not.toBe(print(S0, k));
    expect(gameStore(W({ cast: JOIN }), null).slices.map((s) => s.name)).toContain('story');
  }, 240_000);
});

describe('the story in a building level (structure rails merged in)', () => {
  const WB = (extra = {}) => ({
    ...base, characters: { ...base.characters, cast: { mayor: CAST.mayor, guard: { ...CAST.guard, joins: 'joined-guard' } } },
    levels: { gate: { name: 'The gate', seed: 8, walk: { nodes: { path: { trail: true } } } }, inn: { name: 'The inn', building: { use: 'tavern', seed: 2 } } },
    links: [{ from: 'gate', to: 'inn' }],
    quests: [{ id: 'q', steps: [{ log: 'Find the cellar', done: 'cellar' }] }],
    ...extra,
  });

  it('a building level keeps the journal and the party, as a walk\'s stage does', () => {
    const S = runSteps(WB(), { ref: 'gw' });
    const inn = S.find((s) => s.key.startsWith('level-inn')).order.manifest;
    expect(inn.play).toMatchObject({ quests: [{ id: 'q' }], party: [{ who: 'guard', joins: 'joined-guard' }], carry: 'story' });
    expect(inn.entities.find((e) => e.id === 'guard')).toMatchObject({ dormant: true, team: 'party', rule: { mind: { motivation: 'escort' } } });
  }, 240_000);

  it('a moment aimed at a building level is unplaced, said, not thrown', () => {
    const r = storyReport(WB({ story: [{ ...WELCOME, where: { level: 'inn' } }] }));
    expect(r.unplaced).toEqual([{ id: 'welcome', why: expect.stringMatching(/is a building: a moment binds to a walk's stages for now/) }]);
  }, 240_000);
});

describe('the story\'s slots (a tactics book\'s)', () => {
  const line = [{ line: { who: 'hero', say: 'On.' } }];
  const at = (m) => ({ id: 'm', beats: line, ...m });
  it('reads a level\'s before and after and an epoch\'s begin and end, an epoch\'s begin once a game', async () => {
    const { readStory, storyScene } = await import('./story.js');
    expect(readStory([at({ where: { level: 'vale' }, when: { slot: 'before' } }), at({ id: 'n', where: { epoch: 2 }, when: { slot: 'end' } }), at({ id: 'o', where: { epoch: 'The Rising' }, when: { slot: 'begin' } })])).toHaveLength(3);
    expect(storyScene(at({ where: { level: 'vale' }, when: { slot: 'after' } })).when).toEqual({ on: 'slot:after' });
    expect(storyScene(at({ where: { epoch: 1 }, when: { slot: 'end' } })).when).toEqual({ on: 'slot:after' });
    expect(storyScene(at({ where: { epoch: 1 }, when: { slot: 'begin' }, sets: ['woke'] }))).toMatchObject({ when: { on: 'slot:begin' }, if: [{ not: 'seen-m' }], sets: ['woke', 'seen-m'] });
  });
  it('refuses a slot it does not have, an epoch\'s slot on a level, a level\'s on an epoch, saying why', async () => {
    const { readStory } = await import('./story.js');
    expect(() => readStory([at({ where: { level: 'vale' }, when: { slot: 'during' } })])).toThrow(/when.slot is 'before', 'after', 'begin', 'end', alone in when/);
    expect(() => readStory([at({ where: { level: 'vale' }, when: { slot: 'begin' } })])).toThrow(/'begin' is an epoch's: where: \{ epoch \}/);
    expect(() => readStory([at({ where: { epoch: 1 }, when: { slot: 'before' } })])).toThrow(/an epoch's moment plays in its slot/);
    expect(() => readStory([at({ where: { epoch: 1, level: 'vale' }, when: { slot: 'end' } })])).toThrow(/where is \{ epoch \} alone/);
    expect(() => readStory([at({ where: { epoch: 0 }, when: { slot: 'end' } })])).toThrow(/epoch's name or its number, from 1/);
  });
  it('binds an epoch\'s moment to the book\'s epochs, unplaced (saying why) in a book that has none or not that one', () => {
    const G = readGameworld(MEADOWMARK_HERO), stages = gameStages(MEADOWMARK_HERO), layout = { stageEnds, stageSpots, stageLane };
    const told = (epochs, epoch) => bindStory({ ...G, story: [at({ where: { epoch }, when: { slot: 'begin' } })] }, stages, { layout, epochs });
    expect(told([{ name: 'Vale' }], 'vale')).toMatchObject({ bound: [{ id: 'm', epoch: 'Vale', slot: 'begin' }], byEpoch: { 0: { begin: [expect.objectContaining({ when: { on: 'slot:begin' } })], end: [] } } });
    expect(told(null, 1).unplaced[0].why).toMatch(/a tactics book's/);
    expect(told([{ name: 'Vale' }], 3).unplaced[0].why).toMatch(/no epoch 3 \(epochs: 1 Vale\)/);
  });
});

describe('a walked stage\'s slots', () => {
  it('play its before as it starts and its after as the hero comes to its exit; a stage with none is passed as it was', async () => {
    const { walkedSlots } = await import('./runner.js');
    const stage = gameStages(W())[0], exit = stageEnds(stage.manifest).exit;
    const sc = (on) => ({ id: on.slice(5), when: { on }, beats: [{ wait: 1 }] });
    const st = { scenes: [sc('slot:before'), sc('slot:after'), { id: 'x', when: { start: true }, beats: [{ wait: 1 }] }], cast: [] };
    expect(walkedSlots(st, [sc('slot:after')], stage).scenes.map((s) => s.when)).toEqual([{ start: true }, { enter: { at: [exit[0], exit[1]], r: 4 } }, { start: true }, { enter: { at: [exit[0], exit[1]], r: 4 } }]);
    const plain = { scenes: [{ id: 'x', when: { start: true }, beats: [] }], cast: [] };
    expect(walkedSlots(plain, undefined, stage)).toBe(plain);
    expect(walkedSlots(undefined, undefined, stage)).toBeUndefined();
  });
});
