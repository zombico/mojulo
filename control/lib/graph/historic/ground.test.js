import { describe, it, expect } from 'vitest';
import { groundTile, groundTileFace, groundTileCss, GROUND_SURFACES } from './ground.js';
import { planHistoricCity, renderHistoricCityToHtml } from './historic-city.js';

describe('historic ground: what the town stands on', () => {
  it('every surface bakes a deterministic tile in the given colour', () => {
    for (const s of Object.keys(GROUND_SURFACES)) {
      const a = groundTile(s, '#c9b48c');
      expect(a.startsWith('data:image/png;base64,')).toBe(true);
      expect(groundTile(s, '#c9b48c')).toBe(a);
      expect(groundTile(s, '#a08060')).not.toBe(a);
    }
  });
  it('neighbouring strips tile continuously: the pattern is placed by world position', () => {
    const f = (x) => groundTileFace({ x, y: 0, z: 0, w: 1, d: 1 }, 'mud', '#d2bf98', '#d2bf98', { us: 10, mpu: 1 });
    // 4 m tile: a strip starting 4 m on shows the same offset as one at 0
    expect(f(4).bg.split(' ').slice(1, 3)).toEqual(f(0).bg.split(' ').slice(1, 3));
    expect(f(1).bg).toContain('-10.00px');
    expect(groundTileCss([f(0), f(4)]).match(/data:image\/png/g).length).toBe(1);
  });
  it('the main streets are rubble, the quays and the precinct brick, alleys mud, outside dry earth', () => {
    const p = planHistoricCity({ seed: 7 });
    const by = (s) => p.grounds.filter((g) => g.surface === s);
    expect(by('rubble').length).toBeGreaterThan(20);
    expect(by('brick').some((g) => g.kind === 'precinct-floor')).toBe(true);
    expect(by('brick').filter((g) => g.kind === 'quay').length).toBeGreaterThan(20);   // the quays: one strip per bank, nothing laid over them
    expect(by('mud').length).toBeGreaterThan(20);
    expect(p.grounds.find((g) => g.kind === 'ground').surface).toBe('dry-earth');
    expect(p.grounds.filter((g) => g.kind === 'lane' && !g.surface)).toEqual([]);
  });
  it('the street view stands in a lane at eye height, south of the precinct, looking toward it', () => {
    const p = planHistoricCity({ seed: 7 }), { eye, at } = p.views.street, { cols, cell, data, codes } = p.grid;
    expect(eye[2]).toBeCloseTo(1.7);
    expect(data[Math.floor(eye[1] / cell) * cols + Math.floor(eye[0] / cell)]).toBe(codes.LANE);
    expect(eye[1]).toBeGreaterThan(p.stats.precinct.y + p.stats.precinct.d);
    expect(at[1]).toBeLessThan(eye[1]);
  });
  it('the page carries each ground tile once, however many faces use it', () => {
    const html = renderHistoricCityToHtml({ seed: 7, view: 'street' });
    const vars = html.match(/--historic-[a-z-]+-[0-9a-f]{6}:url/g);
    expect(vars.length).toBe(new Set(vars).size);
    expect(vars.length).toBeGreaterThanOrEqual(4);
    expect((html.match(/var\(--historic-/g) || []).length).toBeGreaterThan(200);
  }, 120000);
});

import { skinTile, skinFace, WALL_SKINS } from './ground.js';
import { skinFor } from './assets/kit.js';
import { SUMER } from './cultures/sumer.js';
describe('historic wall skins: what a wall is made of', () => {
  it('each skin bakes a deterministic transparent overlay, in four turns', () => {
    for (const s of Object.keys(WALL_SKINS)) {
      const a = skinTile(s, 0);
      expect(a.startsWith('data:image/png;base64,')).toBe(true);
      expect(skinTile(s, 0)).toBe(a);
      expect(skinTile(s, 2)).not.toBe(a);
      expect(Buffer.from(a.split(',')[1], 'base64')[25]).toBe(6);   // RGBA: the face's lit colour shows through
    }
  });
  it('a skin rides over the lit fill on upright faces only, courses pinned to world height', () => {
    const wall = (z0) => ({ corners: [[0, 0, z0 + 1], [1, 0, z0 + 1], [1, 0, z0], [0, 0, z0]], fill: '#a08060' });
    const f = skinFace(wall(0), 'mudbrick', { us: 10, mpu: 1 });
    expect(f.bg.endsWith(', #a08060')).toBe(true);
    expect(f.skin).toBe('historic-skin-mudbrick-0');
    expect(skinFace(wall(WALL_SKINS.mudbrick[1]), 'mudbrick', { us: 10, mpu: 1 }).bg).toBe(f.bg);   // one tile height up: the same courses
    expect(f.texture).toBe('hskin-mudbrick');   // the World gets it too, multiplied by the lit colour
    expect(f.textureLit).toBe(true);
    const roof = { corners: [[0, 0, 3], [1, 0, 3], [1, 1, 3], [0, 1, 3]], fill: '#a08060' };
    expect(skinFace(roof, 'mudbrick', { us: 10, mpu: 1 })).toBe(roof);
  });
  it('Sumer: houses in mud render, the wall in bare brick, the ziggurat cased in baked brick, the pale whitewashed', () => {
    expect(skinFor(SUMER, { kind: 'house', tint: '#b49b76' })).toBe('mud-plaster');
    expect(skinFor(SUMER, { kind: 'house', tint: '#ece6d8' })).toBe('lime-plaster');
    expect(skinFor(SUMER, { kind: 'city-wall', tint: '#8f7553' })).toBe('mudbrick');
    expect(skinFor(SUMER, { kind: 'platform', tint: '#a4896a', asset: 'ziggurat' })).toBe('baked-brick');
    expect(skinFor(SUMER, { kind: 'door', tint: '#3a2a1a' })).toBe(null);
  });
  it('the page carries each skin once', () => {
    const html = renderHistoricCityToHtml({ seed: 7 });
    for (const m of html.match(/--historic-skin-[a-z-]+-\d:url/g) || []) expect(html.split(m).length).toBe(2);
    expect(html).toMatch(/var\(--historic-skin-mud-plaster-\d\)/);
  });
});
