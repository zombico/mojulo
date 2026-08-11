process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// mapRef terrain inheritance at the tool surface (match-modes.plan.md M1): a game that plays one
// map under different rules mints the map ONCE and N light levels over it. This is the toy-scale
// twin of the arena's 7-mode × 5-map matrix — two levels, one map, promoted into a game.
import { describe, it, expect } from 'vitest';
import { mintControllableWorld } from '@/lib/mcp/tools/scene-controllable';
import { mintGame } from '@/lib/mcp/tools/create-game';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

const FLOOR = [
  { corners: [[-100, -100, 0], [100, -100, 0], [100, 100, 0], [-100, 100, 0]], fill: '#556' },
  { corners: [[-100, -100, 0], [-100, -100, 30], [-100, 100, 30], [-100, 100, 0]], fill: '#334' },
];
const hero = (over = {}) => ({
  id: 'hero', transform: { pos: [0, 0, 0] },
  rule: { type: 'walk', speed: 12 }, body: { type: 'mesh', shape: 'box', size: [4, 4, 8], color: '#fa0' },
  ...over,
});
const contract = (levelRef) => ({ levelRef, produces: { results: ['success'], events: [] } });

function mintToyMap() {
  if (SketchRepository.getByRef('sk_toy_map')) return;   // one :memory: DB per file
  return mintControllableWorld({
    ref: 'sk_toy_map', title: 'toy map', faces: FLOOR,
    entities: [{ ...hero(), pilotable: true }],   // a one-body roster for the match-channel tests
    figures: { guy: { motion: 'walk', proto: 'male' } },
  });
}

describe('mapRef at the mint surface', () => {
  it('mints light levels over one map, promotable into a game, resolving with the map terrain', async () => {
    mintToyMap();
    for (const [ref, title] of [['sk_toy_lv_easy', 'Toy · Easy'], ['sk_toy_lv_hard', 'Toy · Hard']]) {
      const res = mintControllableWorld({
        ref, title, mapRef: 'sk_toy_map',
        entities: [hero({ rule: { type: 'walk', speed: ref.endsWith('hard') ? 20 : 12 } })],
        game: contract(ref),
      });
      expect(res.ok).toBe(true);
    }
    // the stored rows are LIGHT: mapRef + own keys, no terrain
    for (const ref of ['sk_toy_lv_easy', 'sk_toy_lv_hard']) {
      const m = SketchRepository.getByRef(ref).manifest;
      expect(m.mapRef).toBe('sk_toy_map');
      expect(m.faces).toBeUndefined();
    }
    // promotion: both levels pass create_game's contract validation against the store
    const game = await mintGame({
      title: 'toy game', ref: 'sk_toy_game',
      store: { slices: [{ name: 'career', kind: 'progression' }] },
      levels: [{ ref: 'sk_toy_lv_easy', title: 'Easy' }, { ref: 'sk_toy_lv_hard', title: 'Hard' }],
      allowUnaudited: true,
    });
    expect(game.ok).toBe(true);
    // resolve: the light level plays on the map's terrain with ITS OWN entities
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_toy_lv_easy'));
    expect(payload.faces).toHaveLength(FLOOR.length);
    expect(payload.entities.map((e) => e.id)).toEqual(['hero']);
    expect(payload.entities[0].rule.speed).toBe(12);
  });

  it('validates figure references against the MERGED form (figures live on the map)', () => {
    mintToyMap();
    const res = mintControllableWorld({
      ref: 'sk_toy_lv_fig', title: 'Toy · Figure', mapRef: 'sk_toy_map',
      entities: [hero({ body: { type: 'figure-frames', figure: 'guy' } })],
    });
    expect(res.ok).toBe(true);
    expect(SketchRepository.getByRef('sk_toy_lv_fig').manifest.figures).toBeUndefined();
  });

  it('match channel: a mode authors seats + match layer + contract from the map roster', async () => {
    mintToyMap();
    const res = mintControllableWorld({ ref: 'sk_toy_ffa', mapRef: 'sk_toy_map', match: { mode: 'ffa', rivals: 3, killTarget: 2 } });
    expect(res.ok).toBe(true);
    expect(res.stats.match).toEqual({ mode: 'ffa', killTarget: 2, seats: ['player', 'opponent', 'opponent', 'opponent'] });
    const m = SketchRepository.getByRef('sk_toy_ffa').manifest;
    expect(m.mapRef).toBe('sk_toy_map');
    expect(m.faces).toBeUndefined();                                   // light form
    expect(m.match.spawns).toHaveLength(8);
    expect(m.game.consumes.map((c) => c.slice)).toEqual(['suits', 'ffa_rivals']);
    // and it PLAYS: promote + resolve like any level
    const game = await mintGame({
      title: 'toy match', ref: 'sk_toy_match_game',
      store: { slices: [{ name: 'suits', kind: 'party' }, { name: 'ffa_rivals', kind: 'party' }, { name: 'career', kind: 'progression' }] },
      levels: [{ ref: 'sk_toy_ffa', title: 'FFA' }],
      allowUnaudited: true,
    });
    expect(game.ok).toBe(true);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_toy_ffa'));
    expect(payload.faces).toHaveLength(FLOOR.length);
    expect(payload.match.killTarget).toBe(2);
  });

  it('match channel: watch modes seat an all-AI cast with a spectate contract', () => {
    mintToyMap();
    const res = mintControllableWorld({ ref: 'sk_toy_watch', mapRef: 'sk_toy_map', match: { mode: 'watch_ffa' } });
    expect(res.ok).toBe(true);
    const m = SketchRepository.getByRef('sk_toy_watch').manifest;
    expect(m.spectate).toBe(true);
    expect(m.pilot).toBeNull();                                        // tombstone in the stored form
    expect(m.entities.every((e) => e.seat === 'ai')).toBe(true);
    expect(m.game.spectate).toBe(true);
  });

  it('match channel: guards — needs mapRef + ref, and owns the level shape', () => {
    mintToyMap();
    expect(() => mintControllableWorld({ ref: 'sk_x1', match: { mode: 'ffa' } })).toThrow(/requires `mapRef`/);
    expect(() => mintControllableWorld({ mapRef: 'sk_toy_map', match: { mode: 'ffa' } })).toThrow(/explicit `ref`/);
    expect(() => mintControllableWorld({ ref: 'sk_x2', mapRef: 'sk_toy_map', match: { mode: 'ffa' }, entities: [hero()] }))
      .toThrow(/drop: entities/);
    expect(() => mintControllableWorld({ ref: 'sk_x3', mapRef: 'sk_toy_map', match: { mode: 'king_of_the_hill' } }))
      .toThrow(/unknown match mode/);
  });

  it('refuses a dangling or wrong-kind mapRef at mint', () => {
    expect(() => mintControllableWorld({ entities: [hero()], mapRef: 'sk_nope' }))
      .toThrow(/does not exist/);
    SketchRepository.create({ ref: 'sk_toy_notworld', title: 'x', manifest: { kind: 'assembler', items: [] } });
    expect(() => mintControllableWorld({ entities: [hero()], mapRef: 'sk_toy_notworld' }))
      .toThrow(/kind 'assembler'/);
  });
});
