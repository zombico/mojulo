/**
 * Geocube domains: one cube, many levels. A cube is its style and its ingredients (terrains, interiors); its domains
 * compose them into the levels it makes, and expanding one lowers it in the cube's one style. A cube that names none
 * offers one per terrain and one per interior, so `terrain: 'x'` and `domain: { terrain: 'x' }` are one path.
 */
import { describe, expect, it } from 'vitest';

import { planLocalMeru } from '../local-meru/plan.js';
import { readGeocube, pickDomain, geocubeDomains, expandGeocube, withGeocube, geocubePaint, lowerGeocube, geocubeContrastOf, geocubeStructures, geocubeRamps, GEOCUBE_DOMAINS, CUBE_STREET_PAINT } from './geocube.js';
import { readHour } from './geocube-hours.js';
import { rollTiers } from '../local-meru/roll.js';
import { assembleStageScene } from './stage.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';
import { readLevel } from '../level/graph.js';
import { sequentialLevel } from '../level/sequential.js';
import { resolveLevel, readGameworld } from '../gameworld/world.js';
import { composeGameworld } from '../gameworld/compose.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { MEADOWMARK } from '../gameworld/examples.js';

// a cube with a second terrain of its own land and a second room, and no domains: it offers one per place
const CUBE = { from: 'gothic-night', outside: { terrains: { shore: { reads: 'A cold beach under the walls', base: 'isekai-sakura', tiers: [{ form: 'mound', height: 3, foot: 12, summit: 7 }], colour: { sand: '#6a6660' } } } },
  inside: { interiors: { crypt: { reads: 'A low vault under the hall', size: [8, 10, 4] } } } };
// the same cube naming its levels
const NAMED = { ...CUBE, domains: { 'shore-night': { reads: 'The beach by moonlight', terrain: 'shore' }, 'shore-dawn': { terrain: 'shore', hour: 'dawn' }, crypt: { interior: 'crypt' } } };
const strip = ({ painted: _p, ...rest }) => rest;
// the same cube raising a beacon on its top, and a domain that stands it there
const RAISED = { ...NAMED, structures: { beacon: [{ id: 'beacon', preset: 'needle', on: 'summit', size: 2, palette: { crown: '#ffcc66' } }] },
  domains: { ...NAMED.domains, 'beacon-hill': { terrain: 'default', structures: 'beacon' } } };

describe('reading domains', () => {
  it('a cube without domains offers one per terrain, then one per interior; a cube with them offers those', () => {
    expect(geocubeDomains(readGeocube(CUBE)).map((d) => [d.name, d.side])).toEqual([['default', 'outside'], ['shore', 'outside'], ['room', 'inside'], ['crypt', 'inside']]);
    expect(geocubeDomains(readGeocube(NAMED)).map((d) => d.name)).toEqual(['shore-night', 'shore-dawn', 'crypt']);
    // a preset names its levels beside its own document, and reads them in when it is named
    expect(geocubeDomains(readGeocube('limestone-crags')).map((d) => d.name)).toEqual(Object.keys(GEOCUBE_DOMAINS['limestone-crags'].domains));
  });

  it('refuses a domain that changes the style, or names what the cube has not', () => {
    expect(() => readGeocube({ ...NAMED, domains: { odd: { terrain: 'shore', colour: { stone: '#000000' } } } })).toThrow(/domains.odd.colour: a domain composes the cube's ingredients in the cube's one style/);
    expect(() => readGeocube({ ...NAMED, domains: { odd: { terrain: 'tundra' } } })).toThrow(/domains.odd.terrain 'tundra' is not one of .* \(terrains: default, shore\)/);
    expect(() => readGeocube({ ...NAMED, domains: { odd: { interior: 'crypt', hour: 'dusk' } } })).toThrow(/an interior takes none/);
    expect(() => readGeocube({ ...NAMED, domains: { odd: { terrain: 'shore', interior: 'crypt' } } })).toThrow(/not both/);
    expect(() => readGeocube({ ...CUBE, inside: { interiors: { shore: {} } } })).toThrow(/'shore' names a terrain and an interior/);
  });
});

describe('picking a domain', () => {
  it('the level\'s ask (a name, a change of one, or a composition), else the heartbeat\'s terrain, else the cube\'s first', () => {
    const c = readGeocube(NAMED);
    expect(pickDomain(c, 'crypt')).toMatchObject({ name: 'crypt', from: 'level', domain: { side: 'inside', interior: 'crypt' } });
    expect(pickDomain(c, { from: 'shore-dawn', hour: 'dusk' })).toMatchObject({ name: 'shore-dawn', from: 'level', changed: ['hour'], domain: { terrain: 'shore', hour: 'dusk' } });
    // a change of side takes the other side's ingredients with it
    expect(pickDomain(c, { from: 'shore-dawn', interior: 'room' }).domain).toEqual({ side: 'inside', interior: 'room', reads: expect.any(String) });
    expect(pickDomain(c, { terrain: 'default', hour: 'night' })).toMatchObject({ name: null, from: 'level', domain: { side: 'outside', terrain: 'default', hour: 'night' } });
    expect(pickDomain(c, undefined, 'shore')).toMatchObject({ name: 'shore-night', from: 'heartbeat' });
    expect(pickDomain(c, undefined, 'tundra')).toMatchObject({ name: 'shore-night', from: 'cube', wanted: 'tundra', offered: ['shore-night', 'shore-dawn', 'crypt'] });
    expect(() => pickDomain(c, 'hall')).toThrow(/domain 'hall' is not one of .* \(domains: shore-night, shore-dawn, crypt\)/);
    expect(() => pickDomain(c, { from: 'crypt', light: {} })).toThrow(/a different light is a different cube/);
  });
});

describe('expanding a domain', () => {
  it('a domain on a terrain is the terrain asked for: the same stage, byte for byte', () => {
    const a = assembleStageScene({ kind: 'stage', seed: 3, geocube: CUBE, terrain: 'shore', meru: true });
    const b = assembleStageScene({ kind: 'stage', seed: 3, geocube: CUBE, domain: { terrain: 'shore' }, meru: true });
    expect(JSON.stringify(strip(b))).toBe(JSON.stringify(strip(a)));
    expect(b.painted).toMatchObject({ domain: null, from: 'level', terrain: 'shore', offered: ['default', 'shore', 'room', 'crypt'] });
    expect(() => withGeocube({ kind: 'stage', geocube: CUBE, terrain: 'shore', domain: 'shore' })).toThrow(/domain or terrain, not both/);
  });

  it('an outside domain alone stands on the cube\'s island at its hour; a stage\'s own hour wins; an inside one is the room', () => {
    const c = readGeocube(NAMED), dawn = withGeocube({ kind: 'stage', geocube: NAMED, domain: 'shore-dawn' });
    expect(dawn.kit).toBe(lowerGeocube(c, 'outside', 'shore', readHour('dawn')).kit);
    expect(dawn.meru.tiers).toEqual(NAMED.outside.terrains.shore.tiers);
    expect(withGeocube({ kind: 'stage', geocube: NAMED, domain: 'shore-dawn', hour: 'noon' }).kit).toBe(lowerGeocube(c, 'outside', 'shore', readHour('noon')).kit);
    expect(expandGeocube(c, 'shore-dawn').manifest.kit).toBe(dawn.kit);
    const crypt = withGeocube({ kind: 'stage', geocube: NAMED, domain: 'crypt' });
    expect(crypt.rooms[0]).toMatchObject({ w: 8, d: 10, h: 4 });
    expect(() => withGeocube({ kind: 'stage', geocube: NAMED, domain: 'crypt', meru: true })).toThrow(/the domain is inside .* ask an outside domain/);
    expect(geocubePaint({ geocube: NAMED, domain: 'shore-dawn', meru: true })).toMatchObject({ domain: 'shore-dawn', terrain: 'shore', hour: 'dawn', reads: 'A cold beach under the walls' });
  });

  it('every domain is the cube\'s one style: the same palette and contrast, its own land and light', () => {
    const cube = 'limestone-crags', P = (domain) => geocubePaint({ geocube: cube, domain });
    expect(new Set(Object.keys(GEOCUBE_DOMAINS[cube].domains).map((d) => P(d).palette)).size).toBe(1);
    const crag = geocubeContrastOf({ kind: 'stage', geocube: cube, domain: 'crag-path' }), cove = geocubeContrastOf({ kind: 'stage', geocube: cube, domain: 'cove-dusk' });
    expect(cove).toMatchObject({ ground: crag.ground, shade: crag.shade });
    expect(cove.toLight).not.toEqual(crag.toLight);   // the cove is at dusk
    expect(withGeocube({ kind: 'stage', geocube: cube, domain: 'cove-dusk' }).meru.shading).toEqual(withGeocube({ kind: 'stage', geocube: cube, domain: 'crag-path' }).meru.shading);
  });

  it('the specimen shows a domain: its room in its interior, and the levels the cube makes', async () => {
    const P = WORLD_KINDS.geocube.resolve({ kind: 'geocube', cube: NAMED, domain: 'crypt' }, {});
    expect(P.geocube).toMatchObject({ show: 'room', domain: { name: 'crypt', side: 'inside', interior: 'crypt' } });
    expect(P.geocube.domains.map((d) => d.name)).toEqual(['shore-night', 'shore-dawn', 'crypt']);
    expect(P.faces.some((f) => f.group === 'stage:accent')).toBe(true);
    expect(() => WORLD_KINDS.geocube.resolve({ kind: 'geocube', cube: NAMED, domain: 'crypt', show: 'land' }, {})).toThrow(/the domain is inside: show 'room'/);
    expect(() => WORLD_KINDS.geocube.resolve({ kind: 'geocube', cube: NAMED, domain: 'shore-dawn', show: 'room' }, {})).toThrow(/the domain is outside: show 'land', 'trail', 'path' or 'town'/);
    // an outside domain walked: its island, every way up drawn, at its hour
    const T = await WORLD_KINDS.geocube.resolve({ kind: 'geocube', cube: NAMED, domain: 'shore-dawn', show: 'trail', seed: 3 }, {});
    expect(T.geocube).toMatchObject({ show: 'trail', domain: { name: 'shore-dawn', terrain: 'shore', hour: 'dawn' } });
    // a cube that names no more than its own room and land reads out as it always did
    expect(WORLD_KINDS.geocube.resolve({ kind: 'geocube', cube: 'gothic-night' }, {}).geocube.domains).toBeUndefined();
  });
});

describe('a level on a domain', () => {
  const LEVEL = (more = {}) => ({ seed: 2, geocube: NAMED, nodes: { path: { trail: { run: 12 } }, top: { meru: true } }, ...more });

  it('every painted section carries the cube and the domain, and says what it got', () => {
    const L = sequentialLevel(LEVEL({ domain: 'shore-dawn' }));
    expect(L.paint).toMatchObject({ geocube: 'gothic-night-variant', domain: 'shore-dawn', hour: 'dawn', terrain: 'shore', from: 'level', nodes: ['path', 'top'] });
    expect(L.stages.map((s) => s.manifest.domain)).toEqual(['shore-dawn', 'shore-dawn']);
    expect(withGeocube(L.stages[0].manifest).kit).toBe(readLevel(LEVEL({ domain: 'shore-dawn' })).nodes.path.kit);
  });

  it('refuses an inside domain, a domain beside a terrain, and a domain with no cube', () => {
    expect(() => readLevel(LEVEL({ domain: 'crypt' }))).toThrow(/a level's sections are outside/);
    expect(() => readLevel(LEVEL({ domain: 'shore-dawn', terrain: 'shore' }))).toThrow(/domain or terrain, not both/);
    expect(() => readLevel({ nodes: { a: { trail: true } }, domain: 'x' })).toThrow(/domain is one of the levels a geocube makes: name the level's geocube/);
  });

  it('a world\'s level names its domain in its style, over the world\'s terrain', () => {
    const W = { ...MEADOWMARK, style: { ...MEADOWMARK.style, geocube: NAMED, terrain: 'shore' },
      levels: { ...MEADOWMARK.levels, 'meadow-ascent': { ...MEADOWMARK.levels['meadow-ascent'], style: { domain: 'shore-dawn' } } } };
    const lv = resolveLevel(W, 'meadow-ascent');
    expect(sequentialLevel(lv.level).paint).toMatchObject({ domain: 'shore-dawn', terrain: 'shore', from: 'level' });
    expect(lv.ledger).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'domain', local: 'shore-dawn' })]));
  });
});

describe('structures, the landmarks a domain raises', () => {
  it('a cube names its sets; a domain stands one, or lists its own; inside there are none', () => {
    expect(geocubeDomains(readGeocube(RAISED)).find((d) => d.name === 'beacon-hill')).toMatchObject({ side: 'outside', structures: 'beacon' });
    expect(() => readGeocube({ ...RAISED, structures: { beacon: [{ preset: 'needle', on: 'shore' }] } })).toThrow(/on is 'summit'/);
    expect(() => readGeocube({ ...RAISED, structures: { beacon: [{ preset: 'needle' }] } })).toThrow(/stands at \[x, y, z\?\], or on: 'summit'/);
    expect(() => readGeocube({ ...RAISED, structures: { beacon: [{ preset: 'nope', at: [0, 0] }] } })).toThrow(/structures.beacon\[0\]/);
    expect(() => pickDomain(readGeocube(RAISED), { interior: 'crypt', structures: 'beacon' })).toThrow(/an interior takes none/);
    expect(() => pickDomain(readGeocube(RAISED), { structures: 'tower' })).toThrow(/structures 'tower' is not one of/);
  });

  it('stands on the climb\'s top, painted from the cube (its own colours over), lit by the cube\'s key at the hour', () => {
    const m = { kind: 'stage', geocube: RAISED, domain: 'beacon-hill' }, S = geocubeStructures(m);
    const top = withGeocube(m).meru.tiers.reduce((z, t) => z + t.height, 0);
    expect(S.list[0].at[2]).toBe(top);
    const R = geocubeRamps(readGeocube(RAISED));
    expect(S.list[0].palette).toEqual({ body: R.stone[2], band: R.trim[1], crown: '#ffcc66', plinth: R.floor[1] });
    // (the night cube's key is its moon; at noon, the sun)
    const noon = geocubeStructures({ ...m, domain: { from: 'beacon-hill', hour: 'noon' } });
    expect(noon.list).toEqual(S.list);
    expect(noon.light.toLight).not.toEqual(S.light.toLight);
    // walked as a trail, the climb is rolled from the seed: the beacon stands on the rolled top
    const walked = geocubeStructures({ kind: 'geocube', cube: RAISED, domain: 'beacon-hill', show: 'trail', seed: 5 });
    const rolled = rollTiers({ ...lowerGeocube(readGeocube(RAISED), 'outside').meru }, 5).tiers.reduce((z, t) => z + t.height, 0);
    expect(walked.list[0].at[2]).toBeCloseTo(rolled, 6);
    // none where the domain raises none, where it is inside, or on a trail
    expect(geocubeStructures({ kind: 'stage', geocube: RAISED, domain: 'shore-night' })).toBeNull();
    expect(geocubeStructures({ kind: 'stage', geocube: RAISED, domain: 'crypt' })).toBeNull();
    expect(geocubeStructures({ kind: 'stage', geocube: RAISED, domain: 'beacon-hill', trail: { run: 12 } })).toBeNull();
  });

  it('on a climb whose crown has no height of its own (a terraced mountain\'s lookout), the summit is its top', () => {
    const m = { kind: 'stage', geocube: RAISED, domain: 'beacon-hill', meru: { preset: 'terraced-mountain' } };
    const top = planLocalMeru(withGeocube(m).meru).tiers.at(-1);
    expect(top.height ?? null).toBeNull();
    expect(geocubeStructures(m).list[0].at[2]).toBe(top.top);
  });

  it('the world raises them on the domain\'s land, beside the recipe\'s own', async () => {
    const { payload: W } = await resolveWorldScene({ title: 't', manifest: { kind: 'geocube', cube: RAISED, domain: 'beacon-hill' } });
    const raised = W.faces.filter((f) => String(f.group).startsWith('structure:beacon:'));
    expect(raised.length).toBeGreaterThan(20);
    const zs = raised.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(geocubeStructures({ kind: 'geocube', cube: RAISED, domain: 'beacon-hill' }).list[0].at[2] - 1e-6);
  });
});

describe('settlements, the towns a domain walks through', () => {
  // the same cube with a harbour town in its builders' language, and a domain that walks its street
  const TOWN = { ...NAMED, buildings: { anchor: 'tiered', uses: [{ use: 'dwelling', enter: 'door' }] },
    settlements: { harbour: { town: { length: 100, branches: 1 }, houses: 4, enter: 1 } },
    domains: { ...NAMED.domains, harbour: { terrain: 'shore', settlement: 'harbour' } } };

  it('a cube names its towns; a domain walks one, or writes its own; inside there are none', () => {
    const c = readGeocube(TOWN), D = pickDomain(c, 'harbour').domain;
    expect(D).toMatchObject({ side: 'outside', terrain: 'shore', settlement: 'harbour' });
    expect(() => readGeocube({ ...TOWN, settlements: { harbour: { town: { length: 10 } } } })).toThrow(/settlements.harbour.town: length is a number 90–160/);
    expect(() => readGeocube({ ...TOWN, settlements: { harbour: { houses: 40 } } })).toThrow(/houses is 1 to 12/);
    expect(() => pickDomain(c, { interior: 'crypt', settlement: 'harbour' })).toThrow(/an interior takes none/);
    expect(() => pickDomain(c, { settlement: 'port' })).toThrow(/settlement 'port' is not one of/);
  });

  it('a town domain alone walks a trail through its street, in the cube\'s builders\' language', () => {
    const m = withGeocube({ kind: 'stage', geocube: TOWN, domain: 'harbour' });
    expect(m.trail).toEqual({});
    expect(m.meru).toBeUndefined();
    // (its street laid through it, era/stage-street.js)
    expect(m.town).toEqual({ anchor: 'tiered', houses: 4, enter: 1, recipe: { length: 100, branches: 1 }, paint: CUBE_STREET_PAINT, street: true });
    // the stage's own street wins
    expect(withGeocube({ kind: 'stage', geocube: TOWN, domain: 'harbour', trail: {}, town: { houses: 2 } }).town).toEqual({ houses: 2 });
    expect(geocubePaint({ geocube: TOWN, domain: 'harbour' })).toMatchObject({ domain: 'harbour', settlement: 'harbour' });
  });

  it('a level lays the street once, on the first trail it paints', () => {
    const L = sequentialLevel({ seed: 2, geocube: TOWN, domain: 'harbour', nodes: { a: { trail: { run: 12 } }, b: { trail: { run: 12 } }, top: { meru: true } } });
    expect(L.stages.map((s) => s.manifest.town?.anchor ?? null)).toEqual(['tiered', null, null]);
  });

  it('the street stands on the trail', () => {
    const P = assembleStageScene(withGeocube({ kind: 'stage', seed: 4, geocube: TOWN, domain: 'harbour' }));
    expect(P.faces.some((f) => String(f.group).startsWith('town:'))).toBe(true);
  });
});

describe('a game expands its one cube', () => {
  it('a level asking for nothing, on a cube that names its levels, takes its heartbeat\'s, else the cube\'s first outside', () => {
    const inFirst = { ...NAMED, domains: { crypt: { interior: 'crypt' }, ...NAMED.domains } };
    const L = (more = {}) => sequentialLevel({ seed: 2, geocube: inFirst, nodes: { path: { trail: { run: 12 } } }, ...more });
    expect(L().paint).toMatchObject({ domain: 'shore-night', from: 'cube' });
    expect(L().stages[0].manifest.domain).toBe('shore-night');
    // a cube that names none paints as it always did: by terrain
    expect(sequentialLevel({ seed: 2, geocube: CUBE, nodes: { path: { trail: { run: 12 } } } }).paint).toMatchObject({ terrain: 'default', from: 'cube' });
    expect(sequentialLevel({ seed: 2, geocube: CUBE, nodes: { path: { trail: { run: 12 } } } }).paint.domain).toBeUndefined();
  });

  it('compose lends the cube\'s levels to the walks, the ones the words name first, and writes one cube', () => {
    const W = composeGameworld({ prompt: 'a limestone harbour at dusk', levels: 3, seed: 1 });
    expect(W.brief.cube.id).toBe('limestone-crags');
    expect(W.brief.domains.map((d) => [d.domain, d.word ?? null])).toEqual([['harbour-town', 'harbour'], ['cove-dusk', 'dusk'], ['crag-path', null]]);
    expect(Object.values(W.levels).every((L) => L.style?.geocube === undefined)).toBe(true);
    expect(W.brief.read.find((r) => r.word === 'harbour').decides).toContain('domain');
    const lid = W.brief.domains[1].level, R = resolveLevel(readGameworld(W), lid);
    expect(sequentialLevel(R.level).paint).toMatchObject({ geocube: expect.stringMatching(/^limestone-crags/), domain: 'cove-dusk', hour: 'dusk', terrain: 'cove' });
    // a cube that names no levels: no domains, as before
    expect(composeGameworld({ prompt: 'a gothic night', levels: 2, seed: 1 }).brief.domains).toBeUndefined();
  });
});
