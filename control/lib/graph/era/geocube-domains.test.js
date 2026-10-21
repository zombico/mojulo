/**
 * Geocube domains: one cube, many levels. A cube is its style and its ingredients (terrains, interiors); its domains
 * compose them into the levels it makes, and expanding one lowers it in the cube's one style. A cube that names none
 * offers one per terrain and one per interior, so `terrain: 'x'` and `domain: { terrain: 'x' }` are one path.
 */
import { describe, expect, it } from 'vitest';

import { readGeocube, pickDomain, geocubeDomains, expandGeocube, withGeocube, geocubePaint, lowerGeocube, geocubeContrastOf } from './geocube.js';
import { readHour } from './geocube-hours.js';
import { assembleStageScene } from './stage.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';
import { readLevel } from '../level/graph.js';
import { sequentialLevel } from '../level/sequential.js';
import { resolveLevel } from '../gameworld/world.js';
import { MEADOWMARK } from '../gameworld/examples.js';

// a cube with a second terrain of its own land and a second room, and no domains: it offers one per place
const CUBE = { from: 'gothic-night', outside: { terrains: { shore: { reads: 'A cold beach under the walls', base: 'isekai-sakura', tiers: [{ form: 'mound', height: 3, foot: 12, summit: 7 }], colour: { sand: '#6a6660' } } } },
  inside: { interiors: { crypt: { reads: 'A low vault under the hall', size: [8, 10, 4] } } } };
// the same cube naming its levels
const NAMED = { ...CUBE, domains: { 'shore-night': { reads: 'The beach by moonlight', terrain: 'shore' }, 'shore-dawn': { terrain: 'shore', hour: 'dawn' }, crypt: { interior: 'crypt' } } };
const strip = ({ painted: _p, ...rest }) => rest;

describe('reading domains', () => {
  it('a cube without domains offers one per terrain, then one per interior; a cube with them offers those', () => {
    expect(geocubeDomains(readGeocube(CUBE)).map((d) => [d.name, d.side])).toEqual([['default', 'outside'], ['shore', 'outside'], ['room', 'inside'], ['crypt', 'inside']]);
    expect(geocubeDomains(readGeocube(NAMED)).map((d) => d.name)).toEqual(['shore-night', 'shore-dawn', 'crypt']);
    // a preset names its levels beside its own document, and reads them in when it is named
    expect(geocubeDomains(readGeocube('limestone-crags')).map((d) => d.name)).toEqual(['crag-path', 'cove-dusk', 'temple-hall']);
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
    expect(new Set(['crag-path', 'cove-dusk', 'temple-hall'].map((d) => P(d).palette)).size).toBe(1);
    const crag = geocubeContrastOf({ kind: 'stage', geocube: cube, domain: 'crag-path' }), cove = geocubeContrastOf({ kind: 'stage', geocube: cube, domain: 'cove-dusk' });
    expect(cove).toMatchObject({ ground: crag.ground, shade: crag.shade });
    expect(cove.toLight).not.toEqual(crag.toLight);   // the cove is at dusk
    expect(withGeocube({ kind: 'stage', geocube: cube, domain: 'cove-dusk' }).meru.shading).toEqual(withGeocube({ kind: 'stage', geocube: cube, domain: 'crag-path' }).meru.shading);
  });

  it('the specimen shows a domain: its room in its interior, and the levels the cube makes', () => {
    const P = WORLD_KINDS.geocube.resolve({ kind: 'geocube', cube: NAMED, domain: 'crypt' }, {});
    expect(P.geocube).toMatchObject({ show: 'room', domain: { name: 'crypt', side: 'inside', interior: 'crypt' } });
    expect(P.geocube.domains.map((d) => d.name)).toEqual(['shore-night', 'shore-dawn', 'crypt']);
    expect(P.faces.some((f) => f.group === 'stage:accent')).toBe(true);
    expect(() => WORLD_KINDS.geocube.resolve({ kind: 'geocube', cube: NAMED, domain: 'crypt', show: 'land' }, {})).toThrow(/the domain is inside: show 'room'/);
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
