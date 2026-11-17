// THE CITY STALKER ON A GEOCITY LEVEL: a district of a metro played from its streets and its roofs by the world's hero with
// the moves it starts with (the wall and the line): the moves on its rule, their clips on its mint and its figure, the
// chase and the wind that follow its speed, its sky; and on the district's own boxes the engine swings, reaches roofs
// and glides. The smallest metro that still rings, one neighbourhood of it evoked.
import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel } from './world.js';
import { heroOrders } from './hero-looks.js';
import { GEAR_CLIPS, WALL_CLIPS, moveStates } from '../playscape/player.js';
import { gameStages, stageEnds, stageLevelOrder } from './levels.js';
import { MEADOWMARK_HERO } from './examples.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';
import { reachOf } from '../game/reach.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const CITY = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2], evoke: 'neighbourhood' };
const WORLD = { id: 'metro-patrol', name: 'Metro patrol', seed: 2, style: { hour: 'noon' }, levels: { downtown: { name: 'Downtown', geocity: CITY } } };

describe('the city stalker on a geocity level', () => {
  it('its sky: the style\'s clouds painted over the district at its hour; a word the sky lacks is refused', () => {
    const sky = { ...WORLD, style: { hour: 'golden', clouds: 'fair' } };
    expect(resolveLevel(readGameworld(sky), 'downtown').geocity).toMatchObject({ hour: 'golden', clouds: 'fair' });
    expect(gameStages(sky)[0].manifest).toMatchObject({ hour: 'golden', clouds: 'fair' });
    expect(gameStages(WORLD)[0].manifest.clouds).toBeUndefined();
    expect(() => readGameworld({ ...WORLD, style: { clouds: 'fluffy' } })).toThrow(/clouds/);
  });

  const S = gameStages(WORLD), E = stageEnds(S[0].manifest);

  it('is played by the world\'s hero with the moves it starts with: the wall and the line on its platform rule', async () => {
    const W = { ...MEADOWMARK_HERO, style: { ...(MEADOWMARK_HERO.style ?? {}), hour: 'noon' }, levels: WORLD.levels };
    for (const k of ['links', 'start', 'review']) delete W[k];
    W.characters = { ...W.characters, hero: { ...W.characters.hero, actions: { none: true, moves: ['wall', 'swinger'] } } };
    const G = readGameworld(W), m = stageLevelOrder(G, gameStages(W)[0], { ref: 'lv_0', heroRef: 'gw-hero' }).args.manifest;
    expect(m).toMatchObject({ kind: 'geocube', show: 'geocity' });
    const hero = m.entities.find((e) => e.pilotable);
    expect(hero.rule).toMatchObject({ type: 'platform', wall: true, gear: 'swinger' });
    // the moves' own clips (player.js MOVE_CLIPS): on the hero's mint, as its motion page's, and played by the figure
    // where the hero carries them; a hero without the moves carries none
    expect(m.figures.hero.moves).toMatchObject(moveStates(['wall', 'swinger']));
    const clipsOf = (world) => heroOrders(readGameworld(world)).motion?.args.patch.find((op) => op.path === '/hero/clips')?.value;
    expect(Object.keys(clipsOf(W))).toEqual(expect.arrayContaining([...Object.keys(GEAR_CLIPS), ...Object.keys(WALL_CLIPS)]));
    expect(clipsOf({ ...W, characters: { ...W.characters, hero: { ...W.characters.hero, actions: { none: true } } } })).toBeUndefined();
    expect(Object.keys(GEAR_CLIPS)).toEqual(expect.arrayContaining(['swing_left', 'zip_left', 'dive', 'glide']));
    expect(GEAR_CLIPS.swing_left.keys[0].armL.x).toBe(-GEAR_CLIPS.swing.keys[0].armR.x);
    // a hero on a line is chased at its speed and hears it: the follow camera's rush, the audio's
    expect(m.camera).toMatchObject({ rule: 'follow', rush: true });
    expect(m.audio).toMatchObject({ rush: true });
    // the page draws the district under the level's pilot and game, no stand-in walking it
    const { figures: _f, ...bare } = m;
    const { payload } = await resolveWorldScene({ ref: 'gw-level', title: 'Downtown', manifest: { ...bare, entities: m.entities.map(({ figure: _g, ...e }) => e) } });
    expect(payload.faces.length).toBeGreaterThan(1000);
    expect((payload.walkers ?? []).length).toBe(0);
  }, 120_000);

  it('its towers take the line, its roofs are reached, and a glide carries on past a fall', () => {
    const ground = (p) => E.ground(p[0], p[1]) ?? 0;
    const body = (pos, heading) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', collideRadius: 0.35, collideHeight: 1.7, wall: true, gear: 'swinger' }, transform: { pos, heading } });
    // over the walk beside the tallest mass near the spawn, facing along that mass's long side
    const near0 = (c) => Math.hypot((c.min[0] + c.max[0]) / 2 - E.spawn[0], (c.min[1] + c.max[1]) / 2 - E.spawn[1]);
    const tall = E.colliders.filter((c) => c.max[2] - c.min[2] >= 30).sort((a, b) => near0(a) - near0(b))[0];
    expect(tall).toBeTruthy();
    const alongX = tall.max[0] - tall.min[0] >= tall.max[1] - tall.min[1];
    const pos = alongX ? [tall.min[0], tall.min[1] - 6, 0] : [tall.min[0] - 6, tall.min[1], 0];
    pos[2] = ground(pos) + 12;
    const w = createWorld({ entities: [body(pos, alongX ? 0 : Math.PI / 2)], colliders: E.colliders }), hero = w.byId.hero;
    stepWorld(w, { boost: 1 }, 1 / 60, { ground });
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
    const near = E.colliders.filter((c) => near0(c) < 150), z0 = Math.min(...near.map((c) => c.min[2]));
    const level = { colliders: near, grounds: [{ x0: E.spawn[0] - 200, y0: E.spawn[1] - 200, x1: E.spawn[0] + 200, y1: E.spawn[1] + 200, z: z0 }] };
    const base = { type: 'platform', collideRadius: 0.35, collideHeight: 1.7 };
    expect(reachOf(level, { ...base, wall: true, gear: 'swinger' }).reached.size).toBeGreaterThan(reachOf(level, base).reached.size);
    // THE GLIDE over the district's own boxes: from 40 m over the walk, the jump held, well past where a fall lands
    const fly = (input) => {
      const gw = createWorld({ entities: [body([E.spawn[0], E.spawn[1], E.spawn[2] + 40], E.heading)], colliders: E.colliders }), gh = gw.byId.hero;
      let n = 0;
      for (let i = 0; i < 1500 && !((gh.grounded || gh.walling) && i > 5); i++) { stepWorld(gw, input, 1 / 60, { ground }); if (gh.gliding) n++; }
      return { went: Math.hypot(gh.transform.pos[0] - E.spawn[0], gh.transform.pos[1] - E.spawn[1]), n };
    };
    const glide = fly({ jumpHeld: 1 }), fall = fly({});
    expect(glide.n).toBeGreaterThan(30);
    expect(glide.went).toBeGreaterThan(fall.went + 40);
  }, 120_000);
});
