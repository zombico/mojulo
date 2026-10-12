// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { readQuick } from '@/lib/graph/gameworld/quick.js';

// The quick path: a simple LOOP (one level, one goal), never a simple picture: any hero the door draws, or none (first
// person); the goal placed on the stage's own anchors; the game made in one call, walkable and not proved beatable.
beforeEach(() => { closeDb(); });
const stored = (ref) => SketchRepository.getByRef(ref)?.manifest;
const mechanicsOf = (ref) => stored(ref).game.mechanics.map((m) => m.kind);

describe('design_game quick', () => {
  it('collect, first person: the coins lie on the trail\'s beats, the exit at its end, the game in one call', async () => {
    const out = await designGameHandler({ quick: { goal: 'collect', pickup: 'coin', world: { id: 'coins', name: 'Coin Run', style: { kit: 'trail-valley' } } }, ref: 'q' });
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['level-run-0', 'make'], ['game', 'make']]);
    const L = stored('q-level-run-0');
    expect(mechanicsOf('q-level-run-0')).toEqual(['collect', 'reach-exit']);
    expect(L.game.mechanics[0].pickups.length).toBeGreaterThan(2);
    expect(L.game.mechanics[0].pickups.every((p) => p.item === 'coin')).toBe(true);
    expect(L.entities[0]).toMatchObject({ id: 'player', rule: { type: 'walk' }, body: { type: 'none' } });
    expect(L.figures).toBeUndefined();
    expect(stored('q-game').store.slices.map((s) => s.kind)).toEqual(['inventory', 'progression']);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('q-level-run-0'));
    // the coins and the exit, dressed by the game's decoration (glyphs, baked to figure frames on the page)
    expect(payload.entities.filter((e) => e.id.startsWith('dec_pk_')).length).toBe(L.game.mechanics[0].pickups.length);
    expect(payload.entities.some((e) => e.id.startsWith('dec_exit'))).toBe(true);
    // the light play shell, and a playtest of the same game
    expect(stored('q-game').shell).toBe('play');
    expect(out.next.find((n) => n.step === 'play')).toMatchObject({ gate: 'eyes', card: 'gameworld-next', playtest: '/api/sketches/q-game/playtest' });
  }, 240_000);

  it('reach with a climb and a hero the door draws: the hero pilots both stages, the climb\'s exit is its top, in volume', async () => {
    const hero = { cast: 'female', head: 'anime', look: ['heroine', 'determined'], hair: ['frieda-pony'], palette: { Top: '#7a2f8e' }, gear: { right: { item: 'sword' } } };
    const out = await designGameHandler({ quick: { goal: 'reach', climb: true, hero, theme: { accent: '#7a2f8e', style: 'hud' }, world: { id: 'summit', style: { kit: 'isekai-meadow' } } }, ref: 's' });
    expect(out.ran.map((r) => r.key)).toEqual(['hero', 'level-run-0', 'level-run-1', 'game']);
    expect(stored('s-hero').hero.gear.right).toMatchObject({ item: 'sword' });
    expect(stored('s-level-run-1').figures.hero.heroRef).toBe('s-hero');
    expect(stored('s-level-run-1').game.mechanics[0]).toMatchObject({ kind: 'reach-exit', planar: false });
    expect(stored('s-game').theme).toMatchObject({ accent: '#7a2f8e' });
  }, 240_000);

  it('survive and avoid: a countdown; hazards on the water the trail crosses, and hp to lose', async () => {
    await designGameHandler({ quick: { goal: 'survive', seconds: 30, world: { id: 'hold' } }, ref: 'h' });
    expect(mechanicsOf('h-level-run-0')).toEqual(['survive']);
    await designGameHandler({ quick: { goal: 'avoid', world: { id: 'wade', style: { kit: 'isekai-meadow' } } }, ref: 'a' });
    const kinds = mechanicsOf('a-level-run-0');
    expect(kinds[kinds.length - 1]).toBe('reach-exit');
    if (kinds.includes('hazard-damage')) expect(stored('a-game').store.slices.map((s) => s.kind)).toContain('character');
  }, 240_000);

  it('collect in a building, first person: the tavern laid from its use, pickups in its rooms, the end its cellar', async () => {
    const out = await designGameHandler({ quick: { goal: 'collect', pickup: 'key', building: { use: 'tavern', seed: 2 }, world: { id: 'inn', name: 'Last orders' } }, ref: 'b' });
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['level-run-0', 'make'], ['game', 'make']]);
    const L = stored('b-level-run-0');
    expect(L.program.use).toBe('tavern');
    expect(L.level.mechanics[0]).toMatchObject({ kind: 'collect' });
    expect(L.level.mechanics[0].pickups.every((p) => p.item === 'key')).toBe(true);
    // lowered as it is played: the pickups, then the cellar's goal routed through the doorways
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('b-level-run-0'));
    expect(payload.program).toMatchObject({ use: 'tavern', goal: 'cellar' });
    expect(payload.entities.some((e) => e.id.startsWith('dec_exit'))).toBe(true);
    expect(payload.entities.filter((e) => e.id.startsWith('dec_pk_')).length).toBe(L.level.mechanics[0].pickups.length);
  }, 240_000);

  it('says what is wrong', () => {
    expect(() => readQuick({ goal: 'win' })).toThrow(/goal is one of reach/);
    expect(() => readQuick({ goal: 'reach', pickup: 'coin' })).toThrow(/pickup belongs to the collect goal/);
    expect(() => readQuick({ goal: 'reach', hero: 'tall' })).toThrow(/hero is a hero-door spec/);
    expect(() => readQuick({ goal: 'avoid', building: { use: 'tavern' } })).toThrow(/no hazards/);
    expect(() => readQuick({ goal: 'reach', climb: true, building: { use: 'tavern' } })).toThrow(/not a climb/);
  });
});
