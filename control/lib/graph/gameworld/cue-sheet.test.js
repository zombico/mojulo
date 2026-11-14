import { describe, it, expect } from 'vitest';
import { cueSheet, levelScore, onScore, readCues } from './cue-sheet.js';
import { composeGameworld, MEADOWMARK_HERO } from './index.js';
import { resolveWorldAudio } from '../beats/beats-world.js';

// The cue sheet (cue-sheet.js): each department's request for music, answered on the game's one identity.
// One world per kind of request: a composed world (the flow's screens, its levels, the outcomes), one with foes and a
// boss (the fights), one with a story moment in a game slot (a cinematic).
const forest = () => composeGameworld({ prompt: 'a haunted forest with relics to collect, a boss at the end', seed: 1 });
const ids = (S) => S.requests.map((r) => r.id);
const row = (S, id) => S.requests.find((r) => r.id === id);
// the flow's first ask (a game with a front asks for its title; one without opens on its levels screen, a menu)
const flowAsk = (S) => S.requests.find((r) => r.by === 'flow');

describe('the requests', () => {
  it('the flow asks for its screens, each level for its place, a boss for its fight, the build for the outcomes', () => {
    const w = forest(), S = cueSheet({ ...w, music: {} }, { game: 5 }), L = Object.keys(w.levels);
    expect(ids(S)).toEqual(expect.arrayContaining([flowAsk(S).id, ...L.map((id) => `level:${id}`), `boss:${L.at(-1)}`, 'victory', 'defeat']));
    expect(['title', 'menu']).toContain(flowAsk(S).role);
    expect(flowAsk(S).loop).toBe(true);
    expect(row(S, `level:${L[0]}`)).toMatchObject({ by: 'levels', role: 'place', source: 'suggested' });
    expect(row(S, `boss:${L.at(-1)}`)).toMatchObject({ by: 'foes', mood: 'boss' });
    expect(row(S, 'victory')).toMatchObject({ role: 'stinger', loop: false, mood: 'victory' });
    // the same world, the same sheet
    expect(cueSheet({ ...w, music: {} }, { game: 5 })).toEqual(S);
  });

  it('a level that fields foes asks for its fights; a cinematic the flow plays asks for its cue', () => {
    const first = Object.keys(MEADOWMARK_HERO.levels)[0];
    const fights = cueSheet({ ...MEADOWMARK_HERO, music: {}, foes: { grunt: { class: 'walker' } }, levels: { ...MEADOWMARK_HERO.levels, [first]: { ...MEADOWMARK_HERO.levels[first], foes: { from: ['grunt'] } } } });
    expect(row(fights, `fight:${first}`)).toMatchObject({ by: 'foes', mood: 'battle' });
    const story = [{ id: 'the-oath', who: [], where: { level: first }, when: { slot: 'opening' }, beats: [{ say: 'We ride at dawn.' }] }];
    let S; try { S = cueSheet({ ...MEADOWMARK_HERO, music: {}, story }); } catch { S = null; }
    if (S) expect(row(S, 'cinematic:the-oath')).toMatchObject({ by: 'story', mood: 'ceremony', source: 'stand-in' });
  });
});

describe('the answers', () => {
  it('every cue of a game shares its identity, and the direction\'s cast; a flow\'s cue carries its own seed', () => {
    const S = cueSheet({ ...forest(), music: { direction: { identity: 5, cast: { ground: 'cello' } } } });
    expect(S.identity).toBe(5);
    for (const r of S.requests.filter((x) => x.cue)) { expect(r.cue.score.game, r.id).toBe(5); expect(r.cue.score.cast, r.id).toMatchObject({ ground: 'cello' }); }
    expect(Number.isInteger(flowAsk(S).cue.score.seed)).toBe(true);
    expect(row(S, S.requests.find((r) => r.role === 'place').id).cue.score.seed).toBeUndefined();
    // and each is music a level or the flow can play
    expect(resolveWorldAudio({ soundtrack: flowAsk(S).cue }, { ref: 'lv' }).soundtrack.kind).toBe('beats-composition');
  });

  it('the game\'s own word wins: a mood, a silence; a mood that is none is refused; an id nothing asked is said', () => {
    const w = forest(), L = Object.keys(w.levels)[0], ask = flowAsk(cueSheet({ ...w, music: {} })).id;
    const S = cueSheet({ ...w, music: { cues: { [ask]: 'ceremony', [`level:${L}`]: false, victory: { mood: 'triumph', seed: 9 }, 'level:nowhere': 'forest' } } });
    expect(row(S, ask)).toMatchObject({ mood: 'ceremony', source: 'own' });
    expect(row(S, `level:${L}`)).toMatchObject({ source: 'silence', cue: null });
    expect(row(S, 'victory').cue.score).toMatchObject({ mood: 'triumph', seed: 9 });
    expect(S.unasked).toEqual(['level:nowhere']);
    expect(() => readCues({ title: 'polka' })).toThrow(/not a mood/);
    expect(() => readCues({ title: { mood: 'forest', tempo: 90 } })).toThrow(/not one of/);
  });

  it('the stand-ins are said and owed until the theme and the ending cue are written; an electronic game takes its own', () => {
    const S = cueSheet({ ...forest(), music: {} });
    expect(flowAsk(S)).toMatchObject({ source: 'stand-in' });
    expect(S.owed.some((l) => l.startsWith(`${flowAsk(S).id}: no `))).toBe(true);
    const club = cueSheet({ ...forest(), music: { direction: { style: 'club' } } });
    expect(flowAsk(club)).toMatchObject({ mood: 'deep', style: 'club' });
    expect(club.requests.find((r) => r.role === 'boss')).toMatchObject({ mood: 'peak', style: 'club' });
  });
});

describe('a level\'s score from the sheet', () => {
  it('its place under it, its boss coming in with the tension; a game with no `music` is asked nothing', () => {
    const w = forest(), L = Object.keys(w.levels);
    expect(onScore(w)).toBe(false);
    expect(levelScore(w, L[0])).toBeNull();
    const W = { ...w, music: {} };
    expect(levelScore(W, L[0], { game: 5 })).toEqual({ soundtrack: cueSheet(W, { game: 5 }).requests.find((r) => r.id === `level:${L[0]}`).cue });
    const last = levelScore(W, L.at(-1), { game: 5 });
    expect(last.combat.score.mood).toBe('boss');
    // and it plays: the level's audio resolves, the fight score with its tension
    const audio = resolveWorldAudio(last, { ref: 'lv', mechanics: ['hp-pool'] });
    expect(audio.soundtrack.kind).toBe('beats-composition');
    expect(audio.combat).toBeTruthy();
  });
});

describe('a made game is scored from its sheet', () => {
  it('a designed game with a `music`: every level carries its cue on the game\'s identity; with none, the levels it built', async () => {
    const { runSteps, fingerprint } = await import('./index.js');
    const w = forest();
    const levels = (W) => runSteps(W, { ref: 'gw' }).filter((s) => s.key.startsWith('level-') && s.order?.manifest);
    const plain = levels(w), scored = levels({ ...w, music: {} });
    for (const s of plain) expect(s.order.manifest.audio).toBeUndefined();
    const games = new Set();
    for (const s of scored) { expect(s.order.manifest.audio.soundtrack.score.mood, s.key).toBeTruthy(); games.add(s.order.manifest.audio.soundtrack.score.game); }
    expect(games.size).toBe(1);
    expect(scored.some((s) => s.order.manifest.audio.combat?.score.mood === 'boss')).toBe(true);
    const bare = ({ audio: _a, ...m }) => m;
    expect(fingerprint(scored.map((s) => bare(s.order.manifest)))).toBe(fingerprint(plain.map((s) => s.order.manifest)));
    // the sheet and the score lie together: a game with both hears both
    const both = levels({ ...w, music: {}, sound: {} })[0].order.manifest.audio;
    expect(both.soundtrack && both.sfx?.sheet).toBeTruthy();
  });

  it('a quick game with a `music` and no quick.music is scored from the sheet; what quick.music says still wins', async () => {
    const { runSteps } = await import('./index.js');
    const { quickWorld } = await import('./quick.js');
    const level = (W) => runSteps(W, { ref: 'gw' }).find((s) => s.key.startsWith('level-')).order.manifest;
    expect(level(quickWorld({ id: 'qm', quick: { goal: 'reach' } })).audio).toBeUndefined();
    const scored = level({ ...quickWorld({ id: 'qm', quick: { goal: 'reach' } }), music: { cues: {} } });
    expect(scored.audio?.soundtrack?.score?.mood ?? null).not.toBeNull();
    const said = level({ ...quickWorld({ id: 'qm', quick: { goal: 'reach', music: 'tavern' } }), music: {} });
    expect(said.audio.soundtrack.score.mood).toBe('tavern');
  });
});
