import { describe, it, expect } from 'vitest';
import { readRig, planRig, deckBoxes, railBox, STAIR } from './plan.js';
import { rigWorld } from './build.js';
import { rigLaws } from './laws.js';
import { rigMapSvg } from './map.js';
import { RIGS, RIG_IDS } from './rigs.js';
import { CELL, RAILS } from './tiles.js';

// THE OFFSHORE RIG (offshore/): a level of open decks over the sea, built of three tiles (floor, rails, pillars) and
// the modules on them. A small rig of two decks and a stair exercises the procedures; the shelf's first rig, the laws.

const SMALL = Object.freeze({
  id: 'small', seed: 1,
  decks: [
    { id: 'low', z: 4, map: ['========', '========', '========', '========'] },
    { id: 'high', z: 12, inner: 'bulwark', walls: { '+y': 'screen' }, map: ['########', '########', '########', '########'] },
  ],
  legs: [[0, 0], [8, 0], [0, 4], [8, 4]],
  stairs: [{ from: 'low', to: 'high', at: [1, 0], dir: '+x', side: '+y' }],
  modules: [{ kind: 'container', deck: 'high', at: [5.5, 2.5] }],
});
const at = (d, i, j, W) => d.floor[j * W + i];

describe('offshore rig: the plan', () => {
  it('reads a rig\'s words, refusing what it cannot lay', () => {
    expect(readRig(SMALL).decks.map((d) => d.id)).toEqual(['low', 'high']);
    expect(() => readRig({ ...SMALL, decks: [{ ...SMALL.decks[0], map: ['==x====='] }] })).toThrow(/rows of|is not a glyph/);
    expect(() => readRig({ ...SMALL, decks: [SMALL.decks[0], { ...SMALL.decks[1], map: ['###'] }] })).toThrow(/rows of 8 glyphs/);
    expect(() => readRig({ ...SMALL, decks: [SMALL.decks[0], { ...SMALL.decks[1], z: 18 }] })).toThrow(/a stair rises 5 to 9/);
    expect(() => readRig({ ...SMALL, modules: [{ kind: 'castle', deck: 'high', at: [1, 1] }] })).toThrow(/kind is one of/);
    expect(() => readRig({ ...SMALL, stairs: [{ ...SMALL.stairs[0], side: '-x' }] })).toThrow(/two square ways/);
  });

  it('a stair is a switchback in three cells by two: risers under 0.2, goings a stride, its well cut through the deck it climbs to', () => {
    const P = planRig(SMALL), S = P.stairs[0], high = P.decks[1];
    expect(S.rise).toBeLessThanOrEqual(0.2);
    expect(S.going).toBeGreaterThanOrEqual(0.28);
    expect(S.treads.at(-1).z).toBeCloseTo(high.z - S.rise, 3);
    expect(S.zL).toBeCloseTo((S.z0 + S.z1) / 2, 6);
    for (const [i, j] of S.cells) expect(at(high, i, j, P.W)).toBe(null);
    expect(at(high, ...S.arrival, P.W)).toBe('plate');
    expect(STAIR.cells).toEqual([3, 2]);
  });

  it('rails are found on every open edge but the stair\'s head, a hole\'s by the deck\'s inner kind, a wall by the way it faces', () => {
    const P = planRig(SMALL);
    const high = P.rails.filter((r) => r.deck === 'high');
    // (the well's rails: bulwarks round three sides and the lane the first flight climbs; the second lane's start open)
    const well = high.filter((r) => r.kind === 'bulwark');
    expect(well.length).toBeGreaterThan(0);
    expect(well.some((r) => r.normal === '+x' && r.line === CELL && r.lo === CELL)).toBe(false);
    expect(well.some((r) => r.normal === '+x' && r.line === CELL && r.lo === 0)).toBe(true);
    expect(high.find((r) => r.normal === '+y').kind).toBe('screen');
    expect(P.rails.filter((r) => r.deck === 'low').every((r) => r.kind === 'guard')).toBe(true);
    // (each run a box in its floor's edge, as tall as its kind)
    for (const r of P.rails) { const B = railBox(r); expect(B.max[2] - B.min[2]).toBeCloseTo(RAILS[r.kind].h, 6); }
  });

  it('columns stand at every other node on what is under them, never in a flight; legs run from the sea bed through every deck', () => {
    const P = planRig(SMALL);
    const cols = P.pillars.filter((p) => p.kind === 'column'), legs = P.pillars.filter((p) => p.kind === 'leg');
    expect(legs).toHaveLength(4);
    for (const l of legs) { expect(l.z0).toBe(P.sea.bed); expect(l.z1).toBeGreaterThan(12); }
    expect(cols.filter((c) => c.carries === 'high').every((c) => c.on === 'low' && c.z0 === 4)).toBe(true);
    expect(cols.filter((c) => c.carries === 'low').every((c) => c.on === 'sea')).toBe(true);
    const S = P.stairs[0];
    for (const c of cols.filter((q) => q.carries === 'high')) expect(c.at[0] > S.rect.min[0] && c.at[0] < S.rect.max[0] && c.at[1] > S.rect.min[1] && c.at[1] < S.rect.max[1]).toBe(false);
    // (a column dropping to the sea through a deck's hole is none: the shelf rig's moonpool)
    const hole = planRig({ ...SMALL, decks: [{ ...SMALL.decks[0], map: ['========', '===..===', '===..===', '========'] }, SMALL.decks[1]], stairs: [] });
    expect(hole.pillars.some((p) => p.at[0] === 4 * CELL && p.at[1] === 2 * CELL)).toBe(false);
    expect(planRig({ ...SMALL, stairs: [] }).pillars.some((p) => p.at[0] === 4 * CELL && p.at[1] === 2 * CELL && p.carries === 'high')).toBe(true);
  });

  it('a deck\'s boxes: its void cells walked by no one and seen across, its pillars, modules and walls, its stair\'s mass', () => {
    const P = planRig(SMALL), B = deckBoxes(P, 'high');
    expect(B.filter((b) => b.void).every((b) => b.sight === false)).toBe(true);
    expect(B.filter((b) => b.void)).toHaveLength(6);
    expect(B.some((b) => b.module === 'container')).toBe(true);
    expect(B.some((b) => b.rail === 'bulwark')).toBe(true);
    expect(deckBoxes(P, 'low').some((b) => b.stair)).toBe(true);
  });
});

describe('offshore rig: the laws', () => {
  it('the shelf\'s rigs hold every law', () => {
    for (const id of RIG_IDS) { const L = rigLaws(planRig(RIGS[id])); expect(L.filter((l) => !l.holds), id).toEqual([]); expect(L.map((l) => l.law)).toEqual(['railed', 'joined', 'carried', 'stairs-clear', 'modules-placed', 'sight-broken', 'cover-in-reach']); }
  });

  it('a deck no stair reaches is cut off; a module off its floor is advised', () => {
    const cut = rigLaws(planRig({ ...SMALL, stairs: [] }));
    expect(cut.find((l) => l.law === 'joined').holds).toBe(false);
    const off = rigLaws(planRig({ ...SMALL, modules: [{ kind: 'container', deck: 'high', at: [7.5, 3.5] }] }));
    expect(off.find((l) => l.law === 'modules-placed').says).toMatch(/off its floor/);
  });
});

describe('offshore rig: built', () => {
  it('guard rails stop a body and no gaze (barriers); walls, pillars, decks and modules stop both; the sea is ocean water', () => {
    const P = planRig(SMALL), W = rigWorld(P);
    expect(W.barriers.filter((b) => /rig:rail:guard/.test(b.of)).length).toBe(P.rails.filter((r) => r.kind === 'guard').length);
    expect(W.colliders.some((c) => /rig:rail:bulwark/.test(c.of))).toBe(true);
    expect(W.colliders.some((c) => c.of === 'rig:leg')).toBe(true);
    expect(W.colliders.filter((c) => /^rig:deck:/.test(c.of)).length).toBeLessThan(P.W * P.H);
    const sea = W.faces.find((f) => f.water);
    expect(sea.liquid.kind).toBe('ocean');
    expect(sea.corners[0][2]).toBe(P.sea.z);
  });

  it('a tread\'s box stands under the tread drawn over it, so a body\'s footprint over two treads is never stopped', () => {
    const P = planRig(SMALL), W = rigWorld(P), S = P.stairs[0];
    const boxes = W.colliders.filter((c) => c.of === `rig:${S.id}`);
    for (const t of S.treads) { const b = boxes.find((c) => c.min[0] === t.min[0] && c.min[1] === t.min[1]); if (b) expect(b.max[2]).toBeLessThan(t.z - 2 * S.rise + 0.35); }
  });

  it('a night rig in the rain: its lamps light what they reach and nothing through a deck, its open tiles wet, its rain under no deck', () => {
    const NIGHT = { ...SMALL, hour: 'night', weather: 'rain', fittings: { every: 2 }, floods: [{ deck: 'high', at: [20, 6], height: 6, aim: [20, 6] }] };
    const P = planRig(NIGHT), W = rigWorld(P), D = rigWorld(planRig({ ...NIGHT, floods: [] }));
    expect(P.wet).toBe(true);
    expect(P.lamps.filter((l) => l.kind === 'fitting').every((l) => l.at[2] < 12)).toBe(true);
    // (the flood's pool on the high deck under it: brighter than the same tile unlit; the low deck under the plate is not)
    const top = (B, z, x, y) => B.faces.find((f) => f.group === 'rig:deck' && f.normal[2] > 0.9 && f.corners[0][2] === z && f.corners[0][0] <= x && f.corners[2][0] >= x && f.corners[0][1] <= y && f.corners[2][1] >= y);
    const v = (f) => parseInt(f.fill.slice(1, 3), 16);
    expect(v(top(W, 12, 20, 6))).toBeGreaterThan(v(top(D, 12, 20, 6)) + 40);
    expect(v(top(W, 4, 20, 6))).toBe(v(top(D, 4, 20, 6)));
    expect(W.faces.filter((f) => f.glow).length).toBeGreaterThan(P.lamps.length - 1);
    // (wet: the high deck's tiles are the film's; of the low deck's, only those open to the sky through the stair's well)
    const well = new Set(P.stairs[0].cells.map((c) => `${c}`)), cellOf = (q) => `${Math.floor((q[0][0] + 0.1) / CELL)},${Math.floor((q[0][1] + 0.1) / CELL)}`;
    expect(W.page.wetRoad.quads.filter((q) => q[0][2] === 12).length).toBe(P.W * P.H - 6);
    expect(W.page.wetRoad.quads.filter((q) => q[0][2] === 4).every((q) => well.has(cellOf(q)))).toBe(true);
    expect(W.page.wetRoad.lamps).toHaveLength(1);
    expect(W.page.weather.climate).toEqual({ rain: 1 });
    expect(W.page.roofs.length).toBeGreaterThan(0);
    expect(W.page.sky.day).toBe(0);
    // (a dry day rig carries none of it)
    const day = rigWorld(planRig(SMALL));
    expect(day.page.weather).toBeUndefined();
    expect(day.page.wetRoad).toBeUndefined();
    expect(() => readRig({ ...SMALL, hour: 'dusk' })).toThrow(/hour is one of/);
    expect(() => readRig({ ...SMALL, floods: [{ deck: 'high', at: [1, 1] }] })).toThrow(/aim is/);
  });

  it('the same rig builds the same bytes, and its map draws every deck\'s tiles and rounds', () => {
    const a = JSON.stringify(rigWorld(planRig(SMALL))), b = JSON.stringify(rigWorld(planRig(SMALL)));
    expect(a).toBe(b);
    const R = planRig(RIGS[RIG_IDS[0]]), svg = rigMapSvg(R, { deck: 'main', patrols: R.watch.filter((w) => w.deck === 'main') });
    expect(svg).toContain('#ff5a5a');
    expect(svg).toContain('up to top');
  });
});
