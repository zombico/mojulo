import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { seasonFaces, isLeaf, SEASONS } from './foliage.js';
import { assembleCityScene } from './scene.js';
import { segmentLevel } from './level.js';
import { designCity } from './design.js';
import { cityGreen } from './green.js';
import { hexToRgb } from '../../polygonizer/vexar.js';

const leaf = { corners: [], fill: '#4f7a3a' }, petal = { corners: [], fill: '#e8b8c8' }, shadePetal = { corners: [], fill: '#736468' }, bark = { corners: [], fill: '#5a4a3c' }, tile = { corners: [], fill: '#ffffff', texture: 'bark-oak' };
const recipe = (rec = {}) => ({ kind: 'city', ...inferCity({ seed: 6, grammar: 'paris', board: { cols: 8, rows: 6 }, cars: false, ...rec }).recipe });

describe('foliage through the year', () => {
  it('tells a leaf or a petal (in light or shade) from bark and its tile', () => {
    expect([leaf, petal, shadePetal].every(isLeaf)).toBe(true);
    expect([bark, tile].some(isLeaf)).toBe(false);
  });
  it('turns a deciduous crown in autumn, bares it in winter, blossom to leaf in summer; an evergreen keeps its own', () => {
    const fs = [leaf, petal, shadePetal, bark, tile];
    const autumn = seasonFaces(fs, { season: 'autumn', deciduous: true });
    expect(autumn.slice(0, 3).every((f) => { const [r, g] = hexToRgb(f.fill); return r > g; })).toBe(true);
    expect(autumn.slice(3)).toEqual([bark, tile]);
    expect(seasonFaces(fs, { season: 'winter', deciduous: true })).toEqual([bark, tile]);
    expect(seasonFaces(fs, { season: 'winter', deciduous: false })).toEqual(fs);
    const summer = seasonFaces(fs, { season: 'summer', deciduous: true });
    expect(summer[0]).toBe(leaf);
    expect(summer.slice(1, 3).every((f) => { const [r, g] = hexToRgb(f.fill); return g > r; })).toBe(true);
    expect(seasonFaces(fs, { season: 'spring', deciduous: true })).toEqual(fs);
  });
  it('leans every leaf toward a paint\'s foliage, keeping its shade', () => {
    const [f] = seasonFaces([leaf], { foliage: '#3a6fb0', amount: 1 });
    const [r, g, b] = hexToRgb(f.fill);
    expect(b).toBeGreaterThan(g);
  });
  it('is a season the card knows', () => {
    expect(() => readCityPlan({ season: 'monsoon' })).toThrow(new RegExp(`season is ${SEASONS.map((s) => `'${s}'`).join(' \\| ')}`));
  });
  it('a winter city stamps bare deciduous crowns: fewer faces than its summer', () => {
    const sum = (s) => s.repeats.reduce((a, r) => a + r.template.length, 0);
    expect(sum(assembleCityScene(recipe({ season: 'winter' })))).toBeLessThan(sum(assembleCityScene(recipe({ season: 'summer' }))));
  });
});

describe('a tree stops a walker in a level', () => {
  it('a street tree\'s trunk and a planter\'s box are colliders; a shrub, a park\'s trees and a median\'s are not', () => {
    const d = designCity(recipe({ segments: true, green: { street: 1, median: 1 } })), seg = d.segments[0], L = segmentLevel(d, seg.id);
    const trunks = L.colliders.filter((c) => c.of.startsWith('green:'));
    expect(trunks.length).toBeGreaterThan(5);
    const shrubs = new Set(cityGreen(d).filter((g) => g.plant === 'shrub' || g.kind !== 'street').map((g) => `green:${g.key}`));
    expect(trunks.some((c) => shrubs.has(c.of))).toBe(false);
  });
});
