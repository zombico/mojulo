import { describe, it, expect } from 'vitest';
import { composeGameworld } from './compose.js';
import { readGameworld, runSteps } from './index.js';

const S = (w) => runSteps(w, { ref: 'gw' });

describe('the hub: a town every way leads back to', () => {
  it('a party RPG is laid round its town: the wilds joined to it both ways, no fights there, its merchant and inn in it', () => {
    const w = composeGameworld({ prompt: 'a jrpg where a party battles monsters across the wilds', seed: 3 });
    expect(w).toMatchObject({ topology: 'interconnected', hub: w.start });
    const G = readGameworld(w), others = G.ids.filter((id) => id !== G.hub);
    expect(w.links.map((l) => [l.from, l.to])).toEqual(others.map((id) => [G.hub, id]));
    expect(w.levels[G.hub].places).toEqual({ town: true });
    const steps = S(w), L = steps.filter((s) => s.key.startsWith('level-'));
    const hub = L.filter((s) => s.key.startsWith(`level-${G.hub}-`)), wild = L.filter((s) => !s.key.startsWith(`level-${G.hub}-`));
    // (the town: no packs, the merchant and the inn beside where the party comes in)
    const H = hub[0].order.manifest;
    expect(H.play.rpg.encounters ?? []).toEqual([]);
    expect(Object.keys(H.play.rpg.shops)).toEqual(['merchant', 'innkeeper']);
    expect(H.figures.merchant.heroRef).toBe('gw-keeper');
    // (the wilds: the packs, and no shop or free rest of their own)
    const fights = wild.flatMap((s) => s.order.manifest.play?.rpg?.encounters ?? []);
    expect(fights.length).toBeGreaterThan(0);
    for (const s of wild) {
      expect(s.order.manifest.play?.rpg?.shops).toBeUndefined();
      expect((s.order.manifest.play?.cues ?? []).some((c) => c.id === 'rpg-rest-spot')).toBe(false);
    }
    // (the game's ways: out of the town to each of the wilds, and from each back to it)
    const game = steps.find((s) => s.key === 'game').order, exits = (lvl) => game.levels.find((l) => l.ref === `gw-level-${lvl}-0`).exits.map((e) => e.to);
    expect(exits(G.hub)).toEqual(others.map((id) => `gw-level-${id}-0`));
    for (const id of others) expect(exits(id)).toContain(`gw-level-${G.hub}-0`);
    // the centre is laid: the readout says so
    expect(w.brief.hub).toBe(G.hub);
  });

  it('a hub is a map world\'s level; a genre with no hub, a single level or a building is laid as before', () => {
    const w = composeGameworld({ prompt: 'a jrpg where a party battles monsters', seed: 3 });
    expect(() => readGameworld({ ...w, topology: undefined })).toThrow(/hub is a map world/);
    expect(() => readGameworld({ ...w, hub: 'nowhere' })).toThrow(/hub names the level/);
    expect(composeGameworld({ prompt: 'a jrpg where a party battles monsters', seed: 3, levels: 1 }).hub).toBeUndefined();
    expect(composeGameworld({ prompt: 'a platformer in a meadow', seed: 3 }).hub).toBeUndefined();
  });
});
