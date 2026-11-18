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
import { runSteps } from './runner.js';
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
    // the page draws the district under the level's pilot and game (its passers-by are the street's own, never the hero)
    const { figures: _f, ...bare } = m;
    const { payload } = await resolveWorldScene({ ref: 'gw-level', title: 'Downtown', manifest: { ...bare, entities: m.entities.map(({ figure: _g, ...e }) => e) } });
    expect(payload.faces.length).toBeGreaterThan(1000);
    expect((payload.walkers ?? []).some((w) => w.id === 'hero')).toBe(false);
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

describe('a district\'s foes: crews', () => {
  const W = { ...MEADOWMARK_HERO, levels: { downtown: { name: 'Downtown', geocity: CITY, foes: { from: ['thug', 'runner'], count: 6 } } }, foes: { thug: { class: 'brute' }, runner: { class: 'pursuer' } } };
  for (const k of ['links', 'start', 'review', 'fights', 'mainQuest', 'errands']) delete W[k];
  // the level as the run makes it (the runner stands the level's foes on it)
  const levelOf = (world) => { const st = runSteps(world, { ref: 'gw' }).find((x) => /^level-/.test(x.key)); return st.order.args ? st.order.args.manifest : st.order.manifest; };
  it('stand on a district\'s street in crews that fight as one: held until the hero is near, ringed, pressed two at a time', async () => {
    const { readGameworld: read } = await import('./world.js'), { foePlacements, CREW } = await import('./foes.js');
    const G = read(W), E2 = stageEnds(gameStages(W)[0].manifest), P = foePlacements(G, 'downtown', E2);
    expect(P).toHaveLength(6);
    // two crews of three, each round a spot of its own along the street, the level's kinds in turn
    const crews = [...new Set(P.map((p) => p.crew.id))];
    expect(crews).toEqual(['crew-1', 'crew-2']);
    for (const id of crews) {
      const mine = P.filter((p) => p.crew.id === id);
      expect(mine).toHaveLength(CREW.size);
      for (const p of mine) expect(Math.hypot(p.at[0] - mine[0].at[0], p.at[1] - mine[0].at[1])).toBeLessThanOrEqual(CREW.spread + 1e-6);
      expect(new Set(mine.map((p) => p.eid)).size).toBe(2);
    }
    const a = P.find((p) => p.crew.id === 'crew-1').at, b = P.find((p) => p.crew.id === 'crew-2').at;
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(10);
    // on the level: each a foe with its crew as its mind's group (its plan, its attackers), in no building's box
    const m = levelOf(W);
    const foes = m.entities.filter((e) => e.team === 'foes');
    expect(foes).toHaveLength(6);
    for (const f of foes) {
      expect(f.rule.mind.group).toMatchObject({ attackers: CREW.attackers });
      expect(f.rule.mind.group.plan.map((s) => (typeof s === 'string' ? s : s.pattern))).toEqual(['hold', 'encircle', 'close']);
      expect(E2.colliders.some((c) => f.transform.pos[0] > c.min[0] && f.transform.pos[0] < c.max[0] && f.transform.pos[1] > c.min[1] && f.transform.pos[1] < c.max[1] && f.transform.pos[2] + 0.5 > c.min[2] && f.transform.pos[2] + 0.5 < c.max[2])).toBe(false);
    }
    expect(m.game.mechanics.map((x) => x.kind)).toContain('fail-on-death');
  }, 120_000);

  it('in play a crew holds off, then closes on the hero, and never more than its attackers hold a token', () => {
    const m = levelOf(W);
    const crew1 = m.entities.filter((e) => e.rule.mind && e.rule.mind.group && e.rule.mind.group.id === 'crew-1');
    const at = crew1[0].transform.pos, hero = m.entities.find((e) => e.pilotable);
    // the hero stood 12 m from the crew, on the street
    const ents = [{ ...hero, figure: undefined, body: { type: 'mesh', shape: 'box', hittable: true, hp: 1000 }, transform: { pos: [at[0] - 12, at[1], at[2]], heading: 0 } }, ...crew1.map((e) => ({ ...e, body: { ...e.body, type: 'mesh', shape: 'box' } }))];
    const w = createWorld({ entities: ents, colliders: [] });
    const dist = () => crew1.map((e) => Math.hypot(w.byId[e.id].transform.pos[0] - w.byId.hero.transform.pos[0], w.byId[e.id].transform.pos[1] - w.byId.hero.transform.pos[1]));
    const d0 = Math.min(...dist());
    let most = 0;
    for (let i = 0; i < 60 * 8; i++) { stepWorld(w, {}, 1 / 60, { ground: () => at[2] }); most = Math.max(most, crew1.filter((e) => w.byId[e.id].groupToken).length); }
    expect(Math.min(...dist())).toBeLessThan(d0 - 4);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(2);
  }, 120_000);
});

describe('the city\'s crews', () => {
  it('are people every one, dressed as crews: a bestiary a city game takes whole, stood on its district', async () => {
    const { CITY_CREWS } = await import('./foes.js');
    for (const e of Object.values(CITY_CREWS)) expect(e.skin).toMatchObject({ people: 'human', dress: { rail: 'comic' } });
    expect(new Set(Object.values(CITY_CREWS).map((e) => e.skin.dress.faction)).size).toBe(Object.keys(CITY_CREWS).length);
    const W = { ...MEADOWMARK_HERO, foes: structuredClone(CITY_CREWS), levels: { downtown: { name: 'Downtown', geocity: CITY, foes: { from: Object.keys(CITY_CREWS), count: 3 } } } };
    for (const k of ['links', 'start', 'review', 'fights', 'mainQuest', 'errands']) delete W[k];
    expect(() => readGameworld(W)).not.toThrow();
    const steps = runSteps(W, { ref: 'gw' });
    // each is made through the hero door as a person (a cast and an outfit), never a creature's body
    for (const id of Object.keys(CITY_CREWS)) { const s = steps.find((x) => x.key === `foes-${id}`); expect(s).toBeTruthy(); expect(JSON.stringify(s.order)).toMatch(/"cast":"(male|female)"/); expect(JSON.stringify(s.order)).toMatch(/"outfit"/); }
    const lv = steps.find((x) => /^level-/.test(x.key)), m = lv.order.args ? lv.order.args.manifest : lv.order.manifest;
    expect(m.entities.filter((e) => e.team === 'foes').map((e) => e.id).sort()).toEqual(['foe-criminal-1', 'foe-mercenary-1', 'foe-thug-1']);
  }, 120_000);
});

describe('a calm city', () => {
  it('is the style\'s word: the district\'s recipe gives up its traffic, its occlusion pass and half its shadows\' size, and nothing unasked', async () => {
    const { CITY_CALM } = await import('./world.js');
    const mk = (style) => { const W = { ...MEADOWMARK_HERO, style, levels: { downtown: { name: 'Downtown', geocity: CITY } } }; for (const k of ['links', 'start', 'review', 'fights', 'mainQuest', 'errands', 'foes']) delete W[k]; return W; };
    const man = (W) => { const lv = runSteps(W, { ref: 'gw' }).find((x) => /^level-/.test(x.key)); return lv.order.args ? lv.order.args.manifest : lv.order.manifest; };
    const calm = man(mk({ ...(MEADOWMARK_HERO.style ?? {}), calm: true })), plain = man(mk({ ...(MEADOWMARK_HERO.style ?? {}) }));
    expect(calm).toMatchObject(CITY_CALM);
    for (const k of Object.keys(CITY_CALM)) expect(k in plain).toBe(false);
    expect(() => readGameworld(mk({ calm: 'yes' }))).toThrow(/calm is true or false/);
  }, 120_000);
});
