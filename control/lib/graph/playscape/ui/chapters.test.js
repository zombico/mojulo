import { describe, it, expect } from 'vitest';
import { readChapters, chapterCues, chapterBus, withChapterCues, chapterContract, chapterKey } from './chapters.js';
import { readCues } from './cues.js';
import { lowerPlay } from './direction.js';
import { validateLevelContract } from '../../game/level-contract.js';
import { synthesizeLevel } from '../../game/level-synth.js';
import { gameChannelScript } from '../../scene/channels/game.js';
import { checkProgression } from '../../game/progression-check.js';
import { boardPieceIds, pieceCues } from './board-html.js';

// a town: talking at the gate warns the mayor (chapter one); the siege follows it, and a menu presents the turn
const PLAY = {
  menus: [{ id: 'siege-banner', kind: 'read', text: '[narrator: the siege begins]' }],
  chapters: [
    { id: 'warned', when: { use: { at: [4, 0], r: 1.5 } }, world: { set: { gate: 'shut' } } },
    { id: 'siege', when: { after: 'warned' }, world: { spawn: ['soldier-*'], vanish: 'merchant', weather: 'thunderstorm' }, open: 'siege-banner' },
  ],
  carry: 'world',
};
const STORE = { slices: [{ name: 'campaign', kind: 'progression' }, { name: 'world', kind: 'flags' }] };
const GAME = { levelRef: 'town', produces: { events: [] } };

describe('readChapters', () => {
  it('reads a chapter as its turn and its world, as cue effects', () => {
    const [warned, siege] = readChapters(PLAY);
    expect(warned).toEqual({ id: 'warned', when: { use: { at: [4, 0], r: 1.5 } }, after: null, world: [{ set: 'gate', to: 'shut' }], open: null });
    expect(siege).toMatchObject({ when: null, after: 'warned' });
    expect(siege.world).toEqual([{ spawn: 'soldier-*' }, { vanish: 'merchant' }, { weather: 'thunderstorm' }]);
    expect(readChapters({})).toEqual([]);
  });

  it('teaches on a bad chapter', () => {
    const bad = (chapters, extra = {}) => () => readChapters({ chapters, ...extra });
    expect(bad([])).toThrow(/a list of \{ id, when, world\?, open\? \}/);
    expect(bad([{ id: 'Siege', when: { start: true } }])).toThrow(/lower-case word/);
    expect(bad([{ id: 'a', when: { start: true } }, { id: 'a', when: { start: true } }])).toThrow(/two chapters called 'a'/);
    expect(bad([{ id: 'a' }])).toThrow(/what turns it/);
    expect(bad([{ id: 'a', when: { after: 'ghost' } }])).toThrow(/another chapter's id/);
    expect(bad([{ id: 'a', when: { start: true }, world: { burn: true } }])).toThrow(/not a world change \(spawn, vanish, set, weather, do\)/);
    expect(bad([{ id: 'a', when: { start: true }, passage: 'autumn' }])).toThrow(/not a chapter field/);
    expect(bad([{ id: 'a', when: { start: true } }], { carry: 3 })).toThrow(/flags slice/);
    expect(bad([{ id: 'a', when: { after: 'b' } }, { id: 'b', when: { after: 'c' } }, { id: 'c', when: { after: 'b' } }])).toThrow(/b → c → b wait on each other/);
  });
});

describe('chapter cues', () => {
  it('lower to cues the cue reader accepts: an ask, a turn on the count, and a carried twin when the play carries', () => {
    const cues = chapterCues(PLAY), byId = Object.fromEntries(cues.map((c) => [c.id, c]));
    expect(cues.map((c) => c.id)).toEqual(['chapter-warned-ask', 'chapter-warned', 'chapter-warned-carried', 'chapter-siege', 'chapter-siege-carried']);
    expect(byId['chapter-warned-ask']).toMatchObject({ when: PLAY.chapters[0].when, then: { emit: 'chapter-warned-asked' } });
    expect(byId['chapter-siege']).toMatchObject({ when: { var: 'chapter-siege-n', eq: 1 }, once: true });
    expect(byId['chapter-siege'].then).toEqual([{ spawn: 'soldier-*' }, { vanish: 'merchant' }, { weather: 'thunderstorm' }, { set: 'chapter-siege', to: 1 }, { emit: 'chapter-siege' }, { open: 'siege-banner' }]);
    expect(byId['chapter-siege-carried']).toMatchObject({ when: { on: 'chapter-siege-carried' }, once: true });
    expect(byId['chapter-siege-carried'].then.some((t) => t.emit || t.open)).toBe(false);
    expect(byId['chapter-siege-carried'].then).toContainEqual({ set: 'chapter-siege-n', to: 100 });
    expect(() => readCues(withChapterCues(PLAY))).not.toThrow();
    // the counts: a happening for the first, the first's live turn for the one after it
    expect(chapterBus(PLAY).reactions).toEqual([
      { on: 'chapter-warned-asked', do: 'inc', var: 'chapter-warned-n' },
      { on: 'chapter-warned', do: 'inc', var: 'chapter-siege-n' },
    ]);
    // without carry: no twin
    expect(chapterCues({ ...PLAY, carry: undefined }).map((c) => c.id)).toEqual(['chapter-warned-ask', 'chapter-warned', 'chapter-siege']);
    expect(chapterBus({})).toBe(null);
  });

  it('reach the bus through lowerPlay', () => {
    const ev = lowerPlay({ play: PLAY });
    const emits = (ev.reactions || []).filter((r) => r.do === 'emit').map((r) => r.type);
    expect(emits).toContain('chapter-siege');
    expect(JSON.stringify(ev)).toMatch(/chapter-warned/);
  });

  it('show on the UI board as cue rows', () => {
    expect(boardPieceIds({ play: PLAY })).toContain('ui:cues');
    expect(pieceCues(withChapterCues(PLAY))).toMatch(/chapter-siege/);
  });

  it('change not a byte of a play without chapters', () => {
    const play = { cues: [{ id: 'hi', when: { start: true }, then: { say: 'hello' } }] };
    expect(withChapterCues(play)).toBe(play);
    expect(JSON.stringify(lowerPlay({ play }))).toBe(JSON.stringify(lowerPlay({ play: JSON.parse(JSON.stringify(play)) })));
  });
});

describe('chapterContract', () => {
  it('maps each turn to its flag, declares the write and the read, and validates against the store', () => {
    const g = chapterContract(GAME, PLAY);
    expect(g.on['chapter-siege']).toEqual({ emit: { type: 'setFlag', slice: 'world', key: chapterKey('siege'), value: true } });
    expect(g.produces.events).toEqual([{ type: 'setFlag', slice: 'world' }]);
    expect(g.consumes).toEqual([{ slice: 'world' }]);
    expect(g.chapters).toEqual({ slice: 'world', carried: [{ key: 'chapter:warned', event: 'chapter-warned-carried' }, { key: 'chapter:siege', event: 'chapter-siege-carried' }] });
    expect(validateLevelContract(g, STORE)).toMatchObject({ ok: true });
  });

  it('is idempotent, keeps hand rows, and is the same object when the play does not carry', () => {
    const once = chapterContract(GAME, PLAY);
    expect(chapterContract(once, PLAY)).toEqual(once);
    const hand = { ...GAME, produces: { events: [{ type: 'setFlag', slice: 'world' }] }, consumes: [{ slice: 'world' }], on: { 'boss-down': { end: 'success' } } };
    const g = chapterContract(hand, PLAY);
    expect(g.produces.events).toHaveLength(1);
    expect(g.consumes).toHaveLength(1);
    expect(g.on['boss-down']).toEqual({ end: 'success' });
    expect(chapterContract(GAME, { ...PLAY, carry: undefined })).toBe(GAME);
    expect(chapterContract(GAME, undefined)).toBe(GAME);
  });

  it('rides synthesizeLevel, so the world page and the game shell read one contract', () => {
    expect(synthesizeLevel({ game: GAME, play: PLAY }).game.chapters.slice).toBe('world');
    const plain = { game: GAME };
    expect(synthesizeLevel(plain).game).toBe(GAME);
  });
});

describe('the game channel', () => {
  it('pushes the chapters the store already holds at start, and adds nothing without them', () => {
    const g = chapterContract(GAME, PLAY);
    const withCh = gameChannelScript(g), without = gameChannelScript(GAME);
    expect(withCh).toMatch(/CHAPTERS carried in/);
    expect(withCh).toMatch(/__inputQueue\.push/);
    expect(without).not.toMatch(/CHAPTERS|__inputQueue/);
  });
});

describe('a campaign that carries chapters', () => {
  it('proves its chapter gates through the levels that turn them', () => {
    const town = chapterContract(GAME, PLAY);
    const manifest = { store: STORE, levels: [{ ref: 'town' }, { ref: 'walls', gate: { flag: chapterKey('siege') } }, { ref: 'aftermath', gate: { flag: chapterKey('fallen') } }] };
    const r = checkProgression(manifest, { town });
    expect(r.reachable).toEqual(['town', 'walls', 'aftermath']);
    expect(r.ok).toBe(true);
    expect(r.unproven).toEqual([{ ref: 'aftermath', why: "flag 'chapter:fallen' is allowed by 'town''s contract, but no level's game.on sets it" }]);
  });
});
