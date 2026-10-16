/**
 * The geocube: a level's core look as data, lowered into its inside and its outside so the two share one style; the
 * `geocube` kind shows a specimen, and a stage's `geocube` builds a level on the cube with the recipe's keys winning.
 */
import { describe, expect, it } from 'vitest';

import { GEOCUBE_PRESETS, readGeocube, lowerGeocube, geocubeRamps, cubeContrast, geocubeContrastOf } from './geocube.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { assembleStageScene } from './stage.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

const groups = (p) => new Set(p.faces.map((f) => f.group));
const show = (cube, s) => WORLD_KINDS.geocube.resolve({ kind: 'geocube', cube, show: s }, {});

describe('geocube: reading a cube', () => {
  it('reads every preset, and a variant of one with `from`', () => {
    for (const id of Object.keys(GEOCUBE_PRESETS)) expect(readGeocube(id).id).toBe(id);
    const v = readGeocube({ from: 'gothic-night', colour: { accent: '#2a6a8a' } });
    expect(v.id).toBe('gothic-night-variant');
    expect(v.colour.accent).toBe('#2a6a8a');
    expect(v.colour.stone).toBe(GEOCUBE_PRESETS['gothic-night'].colour.stone);
  });
  it('refuses what it does not know, key by key', () => {
    expect(() => readGeocube('castle')).toThrow(/not a preset/);
    expect(() => readGeocube({ from: 'island-noon', colour: { stone: 'grey' } })).toThrow(/colour.stone is a #rrggbb/);
    expect(() => readGeocube({ from: 'island-noon', light: { glow: 1 } })).toThrow(/light.glow is not a setting/);
    expect(() => readGeocube({ from: 'island-noon', inside: { bones: 'isekai-meadow' } })).toThrow(/not a room kit/);
    expect(() => readGeocube({ from: 'island-noon', outside: { base: 'gothic-stone' } })).toThrow(/not an isekai card/);
    const { moon, ...light } = GEOCUBE_PRESETS['gothic-night'].light;
    expect(() => readGeocube({ ...GEOCUBE_PRESETS['gothic-night'], light })).toThrow(/light.moon is needed/);
  });
  it('gives every ramp the cube\'s shade: the dark ends lean the same way', () => {
    const R = geocubeRamps(readGeocube('island-noon'));
    expect(Object.keys(R)).toEqual(expect.arrayContaining(['stone', 'floor', 'grass', 'sand']));
    expect(Object.values(R).every((r) => r.length === 5)).toBe(true);
  });
});

describe('geocube: the two specimens share one style', () => {
  it('lowers the inside to the bare bones in the cube\'s reference, and the outside to a look on its base', () => {
    const c = readGeocube('gothic-night'), inside = lowerGeocube(c, 'inside'), outside = lowerGeocube(c, 'outside');
    expect(inside).toMatchObject({ kit: 'gothic-stone', reference: 'gothic-night', dress: false });
    expect(inside.tone.ramps.stone).toEqual(geocubeRamps(c).stone);
    expect(outside.kit).toMatch(/^geocube-gothic-night-[0-9a-f]{6}$/);
    expect(outside.meru.shading).toMatchObject({ smooth: true, crevice: 0.6 });
    // the same cube re-read registers the same look; a changed one a new look
    expect(lowerGeocube(readGeocube('gothic-night'), 'outside').kit).toBe(outside.kit);
    expect(lowerGeocube(readGeocube({ from: 'gothic-night', id: 'gothic-night', colour: { stone: '#6a6a7a' } }), 'outside').kit).not.toBe(outside.kit);
  });
  it('shows the room with its accent wall, and the island with polygon land and no tiles on the rock', () => {
    const room = show('gothic-night', 'room');
    expect(groups(room).has('stage:accent')).toBe(true);
    expect(groups(room).has('stage:focus')).toBe(false);
    const land = show('gothic-night', 'land');
    expect(land.cameras[0].name).toBe('island');
    const rock = land.faces.filter((f) => f.group === 'isekai:cliff' || f.group === 'isekai:rock');
    expect(rock.length).toBeGreaterThan(500);
    expect(rock.every((f) => !f.texture && f.aoFlat)).toBe(true);
    expect(groups(land).has('isekai:grass')).toBe(false);
    expect(land.geocube).toMatchObject({ id: 'gothic-night', show: 'land' });
  });
  it('refuses keys the kind does not take', () => {
    expect(() => show('gothic-night', 'hall')).toThrow(/show is 'room' or 'land'/);
    expect(() => WORLD_KINDS.geocube.resolve({ kind: 'geocube', cube: 'gothic-night', rooms: [] }, {})).toThrow(/'rooms' is not a setting/);
  });
});

describe('stage: a level built on a cube', () => {
  it('takes the cube\'s inside under its own rooms, dressed by the kit unless it says', () => {
    const p = assembleStageScene({ kind: 'stage', geocube: 'gothic-night', rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 8, h: 6 }, { id: 'b', x: 10, y: 0, w: 8, d: 8, h: 5 }] }, {});
    expect(groups(p).has('stage:wall')).toBe(true);
    expect(() => assembleStageScene({ kind: 'stage', geocube: 'gothic-night', kit: 'research-lab' }, {})).toThrow(/takes its kit from the cube/);
  });
  it('takes the cube\'s outside under its own meru', () => {
    const p = assembleStageScene({ kind: 'stage', geocube: 'jungle-haze', meru: { tiers: [{ form: 'mound', height: 9, foot: 14, summit: 5 }] } }, {});
    expect(p.faces.some((f) => f.aoFlat)).toBe(true);
    expect(p.faces.some((f) => f.group === 'isekai:water')).toBe(true);   // the cube's island stays unless the meru says
  });
});

describe('geocube: its contrast, the shaping in the vertex', () => {
  const ROOM = [{ id: 'a', x: 0, y: 0, w: 6, d: 6, h: 4 }];
  it('reads a cube\'s contrast and refuses a bad one; a cube without one shapes nothing', () => {
    expect(readGeocube('valley-morning').contrast).toBe('wii');
    expect(() => readGeocube({ from: 'island-noon', contrast: 'ps2' })).toThrow(/geocube: contrast: 'ps2' is not a preset/);
    expect(geocubeContrastOf({ kind: 'stage', geocube: 'island-noon', rooms: ROOM })).toBeNull();
    expect(geocubeContrastOf({ kind: 'stage', geocube: { from: 'valley-morning', contrast: false }, rooms: ROOM })).toBeNull();
    expect(geocubeContrastOf({ kind: 'stage', rooms: ROOM })).toBeNull();
  });
  it('resolves against the cube: the inside leans to its floor, the outside to its grass, both to its shade', () => {
    const c = readGeocube('valley-morning');
    const inside = cubeContrast(c, 'inside', { value: true }), outside = cubeContrast(c, 'outside');
    expect(inside).toMatchObject({ ground: c.colour.floor, mode: 'value', hemi: 0.55 });
    expect(outside).toMatchObject({ ground: c.colour.grass, mode: 'colour' });
    expect(outside.shade).toBe(inside.shade);
    expect(outside.toLight[2]).toBeGreaterThan(0);   // the sun is up
    expect(geocubeContrastOf({ kind: 'city', paint: { geocube: 'valley-morning' } })).toMatchObject({ ground: c.colour.grass });
    expect(geocubeContrastOf({ kind: 'geocube', cube: 'valley-morning', show: 'land' })).toMatchObject({ ground: c.colour.grass });
    expect(geocubeContrastOf({ kind: 'geocube', cube: 'valley-morning' })).toMatchObject({ ground: c.colour.floor });
  });
  it('the land hands its crease and ridge to the cube; a cube without contrast keeps its own', () => {
    expect(lowerGeocube(readGeocube('valley-morning'), 'outside').meru.shading).toMatchObject({ crevice: 0, ridge: 0, smooth: true, blend: 0.6 });
    expect(lowerGeocube(readGeocube({ from: 'valley-morning', contrast: false }), 'outside').meru.shading).toMatchObject({ crevice: 0.6, ridge: 0.35 });
  });
  it('a world on the cube carries it to the emitters, and the export is shaped by it', async () => {
    const shaped = await resolveWorldScene({ title: 't', manifest: { kind: 'stage', geocube: 'valley-morning', rooms: ROOM } });
    expect(shaped.payload.vertexContrast).toMatchObject({ mode: 'value', crevice: 0.55 });   // the inside is toned
    expect(shaped.payload.ao).toEqual({});
    const plain = await resolveWorldScene({ title: 't', manifest: { kind: 'stage', geocube: { from: 'valley-morning', contrast: false }, rooms: ROOM } });
    expect(plain.payload.vertexContrast).toBeUndefined();
    const a = facesToGlb(shaped.payload), b = facesToGlb(plain.payload), c = facesToGlb({ ...shaped.payload, vertexContrast: undefined });
    expect(Buffer.from(a.bytes ?? a).equals(Buffer.from(b.bytes ?? b))).toBe(false);
    expect(Buffer.from(c.bytes ?? c).equals(Buffer.from(b.bytes ?? b))).toBe(true);   // absent ⇒ the same bytes
  });
});
