import { describe, it, expect } from 'vitest';
import { composeGameworld } from './compose.js';
import { readGameworld, runSteps } from './index.js';
import { gameStages, stageEnds } from './levels.js';
import { readGeocube, cubeStreetLook, CUBE_STREET_PAINT } from '../era/geocube.js';

const S = (w) => runSteps(w, { ref: 'gw' });

describe('the hub: a town every way leads back to', () => {
  it('a party RPG is laid round its town: the wilds joined to it both ways, no fights there, its merchant and inn in it', () => {
    // (the smallest hub that still has its wilds: the town and one stretch, so a whole world is run in the time)
    const w = composeGameworld({ prompt: 'a jrpg where a party battles monsters across the wilds', seed: 3, levels: 2 });
    expect(w).toMatchObject({ topology: 'interconnected', hub: w.start });
    const G = readGameworld(w), others = G.ids.filter((id) => id !== G.hub);
    expect(w.links.map((l) => [l.from, l.to])).toEqual(others.map((id) => [G.hub, id]));
    expect(w.levels[G.hub].places).toEqual({ town: true, street: { houses: 6, enter: 2, walk: ['shop'], walls: true } });
    const steps = S(w), L = steps.filter((s) => s.key.startsWith('level-'));
    const hub = L.filter((s) => s.key.startsWith(`level-${G.hub}-`)), wild = L.filter((s) => !s.key.startsWith(`level-${G.hub}-`));
    // (the town: no packs, the merchant and the inn beside where the party comes in)
    const H = hub[0].order.manifest;
    expect(H.play.rpg.encounters ?? []).toEqual([]);
    expect(Object.keys(H.play.rpg.shops)).toEqual(['merchant', 'innkeeper']);
    // (kept by the town's own folk: using its shopkeeper opens the shop, another of its people the inn; no keeper of
    // its own stands, and none is made)
    expect(w.characters.folk).toBe(true);
    const opens = (id) => H.play.cues.filter((c) => c.then?.emit === `rpg-shop:${id}`);
    for (const id of ['merchant', 'innkeeper']) {
      expect(opens(id)).toHaveLength(1);
      const at = opens(id)[0].when.use.at, who = H.entities.find((e) => e.id.startsWith('folk-') && Math.hypot(e.transform.pos[0] - at[0], e.transform.pos[1] - at[1]) < 0.01);
      expect(who).toBeTruthy();
    }
    expect(H.entities.some((e) => e.id === 'merchant' || e.id === 'innkeeper')).toBe(false);
    expect(steps.some((s) => s.key === 'keeper')).toBe(false);
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
    // (the shop walked into as part of the world: its keeper inside it, at its counter)
    const E = stageEnds(gameStages(w).find((s) => s.level === G.hub).manifest), shop = E.townDoors.find((d) => d.id.includes('shop') && d.enter === 'walk');
    const box = shop.rooms.find((r) => r.id === 'shopfloor').box, at = opens('merchant')[0].when.use.at;
    expect(at[0] > box.min[0] && at[0] < box.max[0] && at[1] > box.min[1] && at[1] < box.max[1]).toBe(true);
    // (and each townsperson stands their own way: their stand, the shared idle, or crouched)
    const idles = H.entities.filter((e) => e.id.startsWith('folk-')).map((e) => (H.figures[e.id].moves?.idle === 'gesture' ? 'own' : H.figures[e.id].clips.idle));
    expect(new Set(idles).size).toBeGreaterThan(1);
    // the centre is laid: the readout says so
    expect(w.brief.hub).toBe(G.hub);
  }, 120000);

  it('the town is drawn from the game\'s art direction: its builders the cube\'s, its street in the cube\'s paint, the road through it', () => {
    const w = composeGameworld({ prompt: 'a jrpg where a party battles monsters across the wilds', seed: 3 });
    const G = readGameworld(w), cube = readGeocube(G.style.geocube), builders = cubeStreetLook(cube).anchor;
    // (no word named who builds: the cube's builders do, not the seed's roll)
    expect(Object.values(w.civilizations)[0].anchor).toBe(builders);
    const town = gameStages(w).find((s) => s.level === G.hub).manifest.town;
    expect(town).toMatchObject({ anchor: builders, street: true, paint: { ...CUBE_STREET_PAINT } });
    // (a word that names the builders still decides them; the street keeps the cube's paint)
    const said = composeGameworld({ prompt: 'a jrpg of shell domes where a party battles monsters across the wilds', seed: 3 });
    const t2 = gameStages(said).find((s) => s.level === said.hub).manifest.town;
    expect(Object.values(said.civilizations)[0].anchor).toBe('shell');
    expect(t2).toMatchObject({ anchor: 'shell', paint: { ...CUBE_STREET_PAINT } });
  }, 120000);

  it('a hub is a map world\'s level; a genre with no hub, a single level or a building is laid as before', () => {
    const w = composeGameworld({ prompt: 'a jrpg where a party battles monsters', seed: 3 });
    expect(() => readGameworld({ ...w, topology: undefined })).toThrow(/hub is a map world/);
    expect(() => readGameworld({ ...w, hub: 'nowhere' })).toThrow(/hub names the level/);
    expect(composeGameworld({ prompt: 'a jrpg where a party battles monsters', seed: 3, levels: 1 }).hub).toBeUndefined();
    expect(composeGameworld({ prompt: 'a platformer in a meadow', seed: 3 }).hub).toBeUndefined();
  });
});
