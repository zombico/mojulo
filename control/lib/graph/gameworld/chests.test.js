// CHESTS: a party RPG's treasure off the path. A chest walked up to and opened gives everything it holds into the bag at
// once and says the find; opened again it is empty, and says so; emptied, its shut body goes and its open one comes (as
// the level starts too, the store having left it empty); what each holds is kept in the store's chests slice. Each
// fighting stage of a book that asks keeps them on the beats its packs leave free, its loot by how far on.
import { describe, it, expect } from 'vitest';
import { chestCast, chestLoot, CHEST_LOOT, CHEST_SLICE, CHEST, CHEST_KEY, MIMIC } from './chests.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { foundSay } from '../playscape/ui/menus.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { createBusState, processEvents, watchEvents } from '../worlds/event-bus.js';
import { runSteps, readGameworld, MEADOWMARK_HERO } from './index.js';
import { readBattles } from './battles.js';

const spots = [{ at: [10, 0, 0], toward: [20, 0, 0] }, { at: [30, 0, 0], toward: [40, 0, 0] }];

describe('a chest', () => {
  it('opened gives all it holds at once and says it; again, it is empty; emptied, its open body takes the shut one\'s place', () => {
    const C = chestCast(spots, { tier: 0, seed: 3 });
    expect(C.entities.map((e) => [e.id, e.body.form, !!e.dormant])).toEqual([['chest-1', 'chest', false], ['chest-1-open', 'chest-open', true], ['chest-2', 'chest', false], ['chest-2-open', 'chest-open', true]]);
    // (a step aside from the way, facing it)
    expect(Math.abs(C.entities[0].transform.pos[1])).toBeCloseTo(CHEST.aside, 3);
    const ev = lowerPlay({ play: C.play }, { player: 'hero' }), bus = createBusState(ev, []);
    const fire = (type) => { processEvents(bus, [{ type }]); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
    const H = C.play.menus[0].holds, held = (h) => bus.vars[`held:${h}:${H[0].item}`] ?? 0;
    expect(held('chest-1')).toBe(H[0].count);
    fire('use-cue-chest-1-opened');
    for (const h of H) { expect(bus.vars[`held:bag:${h.item}`], h.item).toBe(h.count); expect(bus.vars[`held:chest-1:${h.item}`]).toBe(0); }
    // (the menu is never left up: the find is said instead)
    expect(bus.vars['ui-menu-chest-1']).toBe(0);
    expect(ev.hud.some((r) => r.as === 'toast' && r.text === foundSay(C.play, H))).toBe(true);
    // (its holder's change said, for the store to keep; its bodies swapped)
    expect(bus.log.some((e) => e.type === `out:chest-1:${H[0].item}:${H[0].count}`)).toBe(true);
    expect(bus.log.some((e) => e.type === 'cue:chest-1-empty')).toBe(true);
    fire('use-cue-chest-1-opened');
    expect(bus.vars[`held:bag:${H[0].item}`]).toBe(H[0].count);
    expect(ev.hud.some((r) => r.text === 'It\'s empty.')).toBe(true);
  });

  it('says its find in words: a count over one, an article for one', () => {
    expect(foundSay({}, [{ item: 'potion', count: 2 }])).toBe('Found 2 potions!');
    expect(foundSay({}, [{ item: 'antidote', count: 1 }, { item: 'potion', count: 1 }])).toBe('Found an antidote and a potion!');
    expect(foundSay({}, [{ item: 'gold', count: 60 }])).toBe('Found 60 gold!');
  });

  it('its loot by how far on, on a seed, no two alike in a stage while there are rows to spare', () => {
    const L = chestLoot(1, 3, 7);
    expect(new Set(L.map((x) => JSON.stringify(x))).size).toBe(3);
    for (const x of L) expect(CHEST_LOOT[1].map((r) => JSON.stringify(r))).toContain(JSON.stringify(x));
    expect(chestLoot(1, 3, 7)).toEqual(L);
  });
});

describe('a book\'s chests (battles.chests)', () => {
  it('each fighting stage keeps them where its packs are not; the store keeps what each holds; none unasked; teaches', () => {
    const W = { ...MEADOWMARK_HERO, battles: { chests: 2 } }, S = runSteps(W, { ref: 'gw' });
    const L = S.filter((s) => s.key.startsWith('level-')).map((s) => s.order.manifest), withChests = L.filter((m) => (m.play?.menus ?? []).some((x) => x.kind === 'chest'));
    expect(withChests.length).toBeGreaterThan(0);
    const M = withChests[0], packs = (M.play.rpg.encounters ?? []).map((e) => e.at);
    for (const e of M.entities.filter((x) => /^chest-\d+$/.test(x.id))) for (const p of packs) expect(Math.hypot(e.transform.pos[0] - p[0], e.transform.pos[1] - p[1]), e.id).toBeGreaterThan(1);
    expect(M.game.mechanics.find((m) => m.kind === 'bag')).toMatchObject({ holders: CHEST_SLICE });
    expect(S.find((s) => s.key === 'game').order.store.slices ?? S.find((s) => s.key === 'game').order.store).toBeTruthy();
    expect(JSON.stringify(S.find((s) => s.key === 'game').order.store)).toContain(`"${CHEST_SLICE}"`);
    // (unasked, none)
    const plain = runSteps({ ...MEADOWMARK_HERO, battles: {} }, { ref: 'gw' }).filter((s) => s.key.startsWith('level-')).map((s) => s.order.manifest);
    expect(plain.some((m) => (m.play?.menus ?? []).some((x) => x.kind === 'chest'))).toBe(false);
    expect(() => readBattles({ chests: 9 })).toThrow(/chests is how many treasure chests/);
    expect(readGameworld(W).battles.chests).toBe(2);
  });
});

// LOCKED CHESTS AND MIMICS (battles.chests { n, locked, mimics }): a locked chest's key won from a pack on its stage, the
// bag holding it opening the chest (and keeping it); a mimic a fight sprung as the party walks up, its treasure had when
// it is won; a world asking none keeps its chests as they were
describe('locked chests and mimics', () => {
  const run = (play) => {
    const ev = lowerPlay({ play }, { player: 'hero' }), bus = createBusState(ev, []);
    const fire = (type) => { processEvents(bus, [{ type }]); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
    return { ev, bus, fire };
  };

  it('a locked chest says so until its key is won from the stage\'s pack; then it opens, the key kept', () => {
    const C = chestCast(spots.slice(0, 1), { seed: 3, packs: ['pack-1'], locked: 1 }), H = C.play.menus[0].holds;
    const key = Object.keys(C.play.items).find((k) => C.play.items[k].kind === 'key');
    expect(C.play.items[key]).toMatchObject({ name: CHEST_KEY.name, kind: 'key' });
    const { ev, bus, fire } = run(C.play);
    fire('use-cue-chest-1-locked'); fire('use-cue-chest-1-unlocked');
    expect(bus.vars[`held:bag:${H[0].item}`] ?? 0).toBe(0);
    expect(ev.hud.some((r) => /locked/.test(r.text ?? ''))).toBe(true);
    fire('rpg-won:pack-1');
    expect(bus.vars[`held:bag:${key}`]).toBe(1);
    fire('use-cue-chest-1-unlocked');
    expect(bus.vars[`held:bag:${H[0].item}`]).toBe(H[0].count);
    expect(bus.vars[`held:bag:${key}`]).toBe(1);
  });

  it('a mimic is a fight the chest stands for, sprung as the party walks up; won, its treasure is had', () => {
    const C = chestCast(spots.slice(0, 1), { seed: 3, mimics: 1 }), H = C.play.menus[0].holds;
    expect(C.encounters).toEqual([{ id: 'chest-1-mimic', foes: [MIMIC], at: C.entities[0].transform.pos.slice(0, 2), who: 'chest-1', near: CHEST.reach }]);
    expect(C.play.cues.some((c) => c.id === 'chest-1-opened')).toBe(false);
    const { bus, fire } = run(C.play);
    fire('rpg-won:chest-1-mimic');
    expect(bus.vars[`held:bag:${H[0].item}`]).toBe(H[0].count);
  });

  it('a book asks for them by shares; asking none keeps the chests as they were; each read and taught', () => {
    expect(chestCast(spots, { seed: 3 })).toEqual(chestCast(spots, { seed: 3, packs: ['pack-1'] }));
    const W = { ...MEADOWMARK_HERO, battles: { chests: { n: 2, locked: 0.5, mimics: 0.5 } } };
    expect(() => readGameworld(W)).not.toThrow();
    expect(() => readBattles({ chests: { n: 2, locked: 0.8, mimics: 0.5 } })).toThrow(/together at most 1/);
    expect(() => readBattles({ chests: { lots: 1 } })).toThrow(/not lots/);
    expect(readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter' }] }, items: { 'iron-key-chest-1': { name: 'Iron Key', kind: 'key' } } }).keys).toEqual({ 'iron-key-chest-1': 'Iron Key' });
  });
});

