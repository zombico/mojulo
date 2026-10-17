import { describe, it, expect } from 'vitest';
import { runSteps, readGameworld, MEADOWMARK_HERO } from './index.js';
import { readMinigameBook, minigamesOfWords, mergeExtras } from './minigames.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { createBusState, processEvents, watchEvents } from '../worlds/event-bus.js';

const levels = (w) => runSteps(w, { ref: 'gw' }).filter((s) => s.key.startsWith('level-'));

describe('minigames: the games inside the game, kept on the trails', () => {
  it('read as written: true is the three; a list takes names or entries, each its own id; a wrong one teaches', () => {
    expect(readMinigameBook(true).map((g) => g.id)).toEqual(['blocks', 'match', 'fishing']);
    expect(readMinigameBook(['fishing', { game: 'fishing', prize: 'golden-lure' }]).map((g) => g.id)).toEqual(['fishing', 'fishing-2']);
    expect(readMinigameBook(false)).toBeNull();
    expect(() => readMinigameBook([{ game: 'darts' }])).toThrow(/gameworld: minigames\[0\]\.game is one of blocks, match, fishing/);
    expect(() => readMinigameBook([{ game: 'fishing', at: 'pond' }])).toThrow(/at is not part/);
  });

  it('heard in the prompt: "minigames" lays the three, "fishing" the pond; nothing asked, none', () => {
    expect(minigamesOfWords('a cozy jrpg with minigames').games.map((g) => g.game)).toEqual(['blocks', 'match', 'fishing']);
    expect(minigamesOfWords('a fishing village saga')).toMatchObject({ games: [{ id: 'fishing', game: 'fishing' }], words: ['fishing'] });
    expect(minigamesOfWords('a dark fantasy party rpg')).toBeNull();
    expect(readGameworld({ ...MEADOWMARK_HERO, brief: { prompt: 'an rpg with an arcade in town' } }).minigames.map((g) => g.game)).toEqual(['blocks']);
    // written wins over heard, false over both
    expect(readGameworld({ ...MEADOWMARK_HERO, minigames: false, brief: { prompt: 'minigames galore' } }).minigames).toBeUndefined();
    // a world that asks for none reads as it did
    expect('minigames' in readGameworld(MEADOWMARK_HERO)).toBe(false);
  });

  it('a keeper is made; each game stands on a trail stage beside the way, its gold in the bag carried with the battles\'', () => {
    const W = { ...MEADOWMARK_HERO, battles: {}, minigames: ['fishing', 'match'] };
    const S = runSteps(W, { ref: 'gw' });
    expect(S.find((s) => s.key === 'keeper')).toMatchObject({ ref: 'gw-keeper', ready: true, order: { spec: { cast: 'female' } } });
    const L = levels(W);
    const kept = L.filter((s) => s.order.manifest.play.minigames);
    expect(kept.flatMap((s) => s.order.manifest.play.minigames.map((g) => g.id))).toEqual(['fishing', 'match']);
    const M = kept[0].order.manifest, g = M.play.minigames[0];
    const keeper = M.entities.find((e) => e.id === `keeper-${g.id}`);
    expect(M.figures[keeper.id].heroRef).toBe('gw-keeper');
    expect(keeper.transform.pos.slice(0, 2)).toEqual(g.at.at);
    expect(g.purse).toBe('held:bag:gold');
    // the battles stay as they were beside it; the bag mechanic once
    expect(M.play.rpg).toBeDefined();
    expect(M.game.mechanics.filter((m) => m.kind === 'bag')).toEqual([{ kind: 'bag', slice: 'bag' }]);
    // the level lowers its round and its place: interact there and minigame:<id> goes out
    const ev = lowerPlay(M, { player: 'player' });
    expect(ev.minigames.games.map((x) => x.id)).toEqual(M.play.minigames.map((x) => x.id));
    const bus = createBusState(ev, []);
    const fire = (type) => { processEvents(bus, [{ type }]); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
    const use = ev.reactions.find((r) => r.do === 'emit' && r.type === `minigame:${g.id}`);
    expect(use).toBeDefined();
    fire(use.on);
    expect(bus.log.some((e) => e.type === `minigame:${g.id}`)).toBe(true);
  });

  it('without battles: the bag is the minigames\' own, in the store and on the stage', () => {
    const W = { ...MEADOWMARK_HERO, minigames: ['fishing'] };
    const S = runSteps(W, { ref: 'gw' });
    expect(S.find((s) => s.key === 'game').order.store.slices).toContainEqual({ name: 'bag', kind: 'inventory' });
    const M = levels(W).find((s) => s.order.manifest.play?.minigames).order.manifest;
    expect(M.game.mechanics).toContainEqual({ kind: 'bag', slice: 'bag' });
    expect(M.play.rpg).toBeUndefined();
  });

  it('a world without them makes the same steps it did', () => {
    const a = runSteps(MEADOWMARK_HERO, { ref: 'gw' }), b = runSteps({ ...MEADOWMARK_HERO, minigames: false }, { ref: 'gw' });
    expect(b.map((s) => [s.key, s.print])).toEqual(a.map((s) => [s.key, s.print]));
    expect(a.some((s) => s.key === 'keeper')).toBe(false);
  });

  it('two extras merge: figures and entities joined, cue lists joined, a mechanic once', () => {
    const m = mergeExtras({ figures: { a: 1 }, entities: [{ id: 'a' }], play: { rpg: {}, cues: [{ id: 'x' }] }, mechanics: [{ kind: 'bag', slice: 'bag' }] }, { figures: { b: 2 }, entities: [{ id: 'b' }], play: { minigames: [{ id: 'm' }], cues: [{ id: 'y' }] }, mechanics: [{ kind: 'bag', slice: 'bag' }] });
    expect(m).toEqual({ figures: { a: 1, b: 2 }, entities: [{ id: 'a' }, { id: 'b' }], play: { rpg: {}, cues: [{ id: 'x' }, { id: 'y' }], minigames: [{ id: 'm' }] }, mechanics: [{ kind: 'bag', slice: 'bag' }] });
  });
});
