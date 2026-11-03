import { describe, it, expect } from 'vitest';
import { readGeocube, cubeMatter, geocubeMatterOf, GEOCUBE_PRESETS } from './geocube.js';
import { breakablesOf } from '../playscape/destruct/breakability.js';
import { assembleStageScene } from './stage.js';
import { starter } from './entries.js';

// one preset per interior kit (the procedure differs by kit), chosen from the catalogue
const byKit = (kit) => Object.keys(GEOCUBE_PRESETS).find((k) => GEOCUBE_PRESETS[k].inside.bones === kit);

describe('the cube says what its world is made of', () => {
  it('read off its own look: its tiles, its kit, the defaults, each role with its reason', () => {
    const M = cubeMatter(readGeocube(byKit('gothic-stone')));
    expect(M.wall).toMatchObject({ matter: 'stone', why: 'its tile is stone-brick' });
    expect(M.floor.matter).toBe('stone');
    expect(M.wood).toMatchObject({ matter: 'timber', why: expect.stringMatching(/default/) });
    const lab = cubeMatter(readGeocube(byKit('research-lab')));
    expect(lab.metal).toMatchObject({ matter: 'steel', why: expect.stringMatching(/research lab/) });
  });

  it('its own words win; a role it does not have, or a liquid, is refused', () => {
    const id = byKit('gothic-stone');
    const M = cubeMatter(readGeocube({ from: id, matter: { wall: 'concrete', glass: { matter: 'glass', fill: 0.5 } } }));
    expect(M.wall).toMatchObject({ matter: 'concrete', why: 'the cube says so' });
    expect(M.glass.fill).toBe(0.5);
    expect(() => readGeocube({ from: id, matter: { chimney: 'brick' } })).toThrow(/not a role/);
    expect(() => readGeocube({ from: id, matter: { wall: 'water' } })).toThrow(/liquid/);
  });

  it('a settlement\'s material words give the roles its skins do not: a thatch roof is pine at a third', () => {
    const id = byKit('gothic-stone');
    const M = cubeMatter({ ...readGeocube(id), settlements: { hamlet: { style: { materials: { roof: 'thatch', road: 'gravel' } } } } });
    expect(M.roof).toMatchObject({ matter: 'pine', fill: 0.33 });
    expect(M.ground.matter).toBe('gravel');
  });
});

describe('a physical level in a cube breaks by the cube\'s matter', () => {
  const stage = assembleStageScene({ ...starter('gothic-stone') });

  it('its walls take the cube\'s wall matter, its props keep their classes\' own; no cube changes nothing', () => {
    const plain = breakablesOf(stage, 'physical'), inCube = breakablesOf(stage, 'physical', { matterOf: { wall: { matter: 'steel' } } });
    const of = (r, cls) => r.breakables.filter((b, i) => r.things[i].class === cls);
    const walls = of(inCube, 'wall');
    if (walls.length) expect(walls.every((b) => b.matter === 'steel')).toBe(true);
    for (const cls of new Set(inCube.things.map((t) => t.class).filter((c) => !['wall', 'pilaster', 'set-piece', 'boulder', 'lid', 'door', 'lockers', 'rack', 'glass'].includes(c))))
      expect(of(inCube, cls).map((b) => b.matter)).toEqual(of(plain, cls).map((b) => b.matter));
    expect(JSON.stringify(breakablesOf(stage, 'physical', { matterOf: null }))).toBe(JSON.stringify(plain));
  });

  it('a level painted by a cube: the world hands its breakables the cube\'s matter; a level in no cube, its classes\'', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const id = byKit('gothic-stone');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const level = (extra) => ({ manifest: { ...starter('gothic-stone'), entities: [hero], destruction: 'physical', ...extra }, title: 'crypt' });
    const inCube = (await resolveWorldScene(level({ geocube: { from: id, matter: { accent: 'steel', wall: 'steel' } } }))).payload;
    const plain = (await resolveWorldScene(level({}))).payload;
    expect(geocubeMatterOf({ kind: 'stage', geocube: id }).wall.matter).toBe('stone');
    const was = new Map(plain.breakables.map((b) => [b.id, b]));
    const masonry = inCube.breakables.filter((b) => ['brick', 'stone', 'concrete'].includes(was.get(b.id)?.matter));
    expect(masonry.length).toBeGreaterThan(0);
    expect(masonry.every((b) => b.matter === 'steel')).toBe(true);                   // walls and set pieces: the cube's
    for (const b of inCube.breakables.filter((x) => was.get(x.id)?.matter === 'pine')) expect(b.matter).toBe('pine');   // crates keep theirs
    for (const b of inCube.breakables.filter((x) => was.get(x.id)?.matter === 'sheet-metal')) expect(b.fill).toBe(0.02);   // a steel shell stays a shell
    expect(plain.breakables.some((b) => b.matter === 'steel')).toBe(false);
  }, 120000);

  it('a scarred level paints its blows by the cube\'s matter and breaks nothing; unscarred, no physics at all', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const id = byKit('gothic-stone');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const level = (extra) => ({ manifest: { ...starter('gothic-stone'), entities: [hero], geocube: id, ...extra }, title: 'crypt' });
    const scarred = (await resolveWorldScene(level({ scars: true }))).payload;
    expect(scarred.rupa.scars.wall.id).toBe('stone');                      // the cube's walls
    expect(scarred.breakables).toBeUndefined();                             // the map is the map
    expect((await resolveWorldScene(level({ scars: { wall: 'concrete' } }))).payload.rupa.scars.wall.id).toBe('concrete');
    expect((await resolveWorldScene(level({}))).payload.rupa).toBeUndefined();
    await expect(resolveWorldScene(level({ scars: { wall: 'oil' } }))).rejects.toThrow(/scars.wall: oil is a liquid/);
  }, 120000);
});
