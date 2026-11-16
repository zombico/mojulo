// A LEVEL THAT IS A CITY (geocity/): a metro's neighbourhood on its cube, in metres, played from its streets and its
// roofs by the world's hero with the moves it starts with (the city stalker's wall and line). The smallest metro that
// still rings, one neighbourhood of it evoked.
import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel, GEOCITY_EVOKE } from './world.js';
import { heroOrders } from './hero-looks.js';
import { GEAR_CLIPS, WALL_CLIPS, moveStates } from '../playscape/player.js';
import { gameStages, stageEnds, stageLevelOrder } from './levels.js';
import { MEADOWMARK_HERO } from './examples.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';
import { reachOf } from '../game/reach.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const METRO = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const WORLD = { id: 'metro-patrol', name: 'Metro patrol', seed: 2, style: { hour: 'noon' }, levels: { downtown: { name: 'Downtown', geocity: METRO } } };
const inBox = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] + 0.5 > c.min[2] && p[2] + 0.5 < c.max[2];

describe('a geocity level', () => {
  it('reads as the city alone, on its cube, a neighbourhood of it evoked unless it says', () => {
    const R = resolveLevel(readGameworld(WORLD), 'downtown');
    expect(R.geocity).toMatchObject({ spec: { ...METRO, evoke: GEOCITY_EVOKE }, cube: 'valley-morning', hour: 'noon' });
    expect(resolveLevel(readGameworld({ ...WORLD, levels: { downtown: { geocity: { ...METRO, evoke: 'corridor' } } } }), 'downtown').geocity.spec.evoke).toBe('corridor');
    expect(() => readGameworld({ ...WORLD, levels: { downtown: { geocity: METRO, geotown: { pattern: 'old-town' } } } })).toThrow(/the city alone/);
    expect(() => readGameworld({ ...WORLD, levels: { downtown: { geocity: { metro: 'no-such-metro' } } } })).toThrow(/geocity/);
    // its sky: the style's clouds painted over the cube at its hour, on the stage's manifest; a word the sky lacks is refused
    const sky = { ...WORLD, style: { hour: 'golden', clouds: 'fair' } };
    expect(resolveLevel(readGameworld(sky), 'downtown').geocity).toMatchObject({ hour: 'golden', clouds: 'fair' });
    expect(gameStages(sky)[0].manifest).toMatchObject({ hour: 'golden', clouds: 'fair' });
    expect(gameStages(WORLD)[0].manifest.clouds).toBeUndefined();
    expect(() => readGameworld({ ...WORLD, style: { clouds: 'fluffy' } })).toThrow(/clouds/);
  });

  const S = gameStages(WORLD), E = stageEnds(S[0].manifest);

  it('is one stage, set down on the metro\'s walk and ended across its block, on its own ground, in no building\'s box', () => {
    expect(S.map((s) => s.section)).toEqual(['geocity']);
    expect(S[0].manifest).toMatchObject({ kind: 'geocube', show: 'geocity', hour: 'noon', geocity: { evoke: GEOCITY_EVOKE } });
    expect(S[0].unlit).toBeUndefined();
    expect(E.planar).toBe(true);
    expect(Math.hypot(E.exit[0] - E.spawn[0], E.exit[1] - E.spawn[1])).toBeGreaterThan(10);
    for (const p of [E.spawn, E.exit]) {
      expect(E.ground(p[0], p[1])).toBeCloseTo(p[2], 2);
      expect(E.colliders.some((c) => inBox(p, c))).toBe(false);
    }
    expect(E.colliders.length).toBeGreaterThan(50);
    expect(E.beats.length).toBeGreaterThan(0);
  }, 120_000);

  it('is played by the world\'s hero with the moves it starts with: the wall and the line on its platform rule', async () => {
    const W = { ...MEADOWMARK_HERO, style: { ...(MEADOWMARK_HERO.style ?? {}), hour: 'noon' }, levels: WORLD.levels, links: undefined, start: undefined };
    for (const k of ['links', 'start']) delete W[k];
    W.characters = { ...W.characters, hero: { ...W.characters.hero, actions: { none: true, moves: ['wall', 'swinger'] } } };
    const G = readGameworld(W), m = stageLevelOrder(G, gameStages(W)[0], { ref: 'lv_0', heroRef: 'gw-hero' }).args.manifest;
    expect(m).toMatchObject({ kind: 'geocube', show: 'geocity' });
    const hero = m.entities.find((e) => e.pilotable);
    expect(hero.rule).toMatchObject({ type: 'platform', wall: true, gear: 'swinger' });
    // the gear's own clips (player.js GEAR_CLIPS): on the hero's mint, as its motion page's, and played by the figure
    // where the hero carries them; a hero without the line carries none
    expect(m.figures.hero.moves).toMatchObject(moveStates(['wall', 'swinger']));
    const clipsOf = (world) => heroOrders(readGameworld(world)).motion?.args.patch.find((op) => op.path === '/hero/clips')?.value;
    expect(Object.keys(clipsOf(W))).toEqual(expect.arrayContaining([...Object.keys(GEAR_CLIPS), ...Object.keys(WALL_CLIPS)]));
    expect(clipsOf({ ...W, characters: { ...W.characters, hero: { ...W.characters.hero, actions: { none: true } } } })).toBeUndefined();
    expect(m.game.mechanics.map((x) => x.kind)).toContain('reach-exit');
    // the page draws the metro under the level's pilot and game (the keys a level lays over it are the page's, never
    // refused as the city's own), no stand-in walking it
    const { figures: _f, ...bare } = m;
    const { payload } = await resolveWorldScene({ ref: 'gw-level', title: 'Downtown', manifest: { ...bare, entities: m.entities.map(({ figure: _g, ...e }) => e) } });
    expect(payload.faces.length).toBeGreaterThan(1000);
    expect((payload.walkers ?? []).length).toBe(0);
  }, 120_000);

  it('its towers take the line: a hero in the air over its street finds an anchor on a face and swings, and the moves open roofs', () => {
    const ground = (p) => E.ground(p[0], p[1]) ?? 0;
    // over the walk beside the tallest mass near the spawn, facing along that mass's long side
    const tall = E.colliders.filter((c) => c.max[2] - c.min[2] >= 30).sort((a, b) => Math.hypot((a.min[0] + a.max[0]) / 2 - E.spawn[0], (a.min[1] + a.max[1]) / 2 - E.spawn[1]) - Math.hypot((b.min[0] + b.max[0]) / 2 - E.spawn[0], (b.min[1] + b.max[1]) / 2 - E.spawn[1]))[0];
    expect(tall).toBeTruthy();
    const alongX = tall.max[0] - tall.min[0] >= tall.max[1] - tall.min[1];
    const pos = alongX ? [tall.min[0], tall.min[1] - 6, 0] : [tall.min[0] - 6, tall.min[1], 0];
    pos[2] = ground(pos) + 12;
    const h = { id: 'hero', pilotable: true, rule: { type: 'platform', collideRadius: 0.35, collideHeight: 1.7, wall: true, gear: 'swinger' }, transform: { pos, heading: alongX ? 0 : Math.PI / 2 } };
    const w = createWorld({ entities: [h], colliders: E.colliders });
    stepWorld(w, { boost: 1 }, 1 / 60, { ground });
    const hero = w.byId.hero;
    expect(hero.swinging).toBeTruthy();
    expect(hero.swinging.anchor[2]).toBeGreaterThan(pos[2]);
    // held and pumped for two seconds, cast again as each line is met: carried along the street at a swing's speed
    let path = 0, fastest = 0;
    for (let i = 0; i < 120; i++) {
      const from = [...hero.transform.pos];
      stepWorld(w, { boost: 1, forward: 1 }, 1 / 60, { ground });
      const d = Math.hypot(hero.transform.pos[0] - from[0], hero.transform.pos[1] - from[1]);
      path += d; fastest = Math.max(fastest, d * 60);
    }
    expect(path).toBeGreaterThan(15);
    expect(fastest).toBeGreaterThan(10);
    // the reach (game/reach.js): on the level's own boxes, the wall and the line open roofs a run and a jump do not
    const near = E.colliders.filter((c) => Math.hypot((c.min[0] + c.max[0]) / 2 - E.spawn[0], (c.min[1] + c.max[1]) / 2 - E.spawn[1]) < 150);
    const z0 = Math.min(...near.map((c) => c.min[2]));
    const level = { colliders: near, grounds: [{ x0: E.spawn[0] - 200, y0: E.spawn[1] - 200, x1: E.spawn[0] + 200, y1: E.spawn[1] + 200, z: z0 }] };
    const base = { type: 'platform', collideRadius: 0.35, collideHeight: 1.7 };
    const plain = reachOf(level, base).reached.size, moved = reachOf(level, { ...base, wall: true, gear: 'swinger' }).reached.size;
    expect(moved).toBeGreaterThan(plain);
  }, 120_000);
});
