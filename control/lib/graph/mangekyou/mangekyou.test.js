import { describe, it, expect } from 'vitest';
import { turnMangekyou, readConcept, routeOrder, readPrinciples, rollOrder, AXES } from './index.js';
import { readLeaves, valueAt } from './leaves.js';
import { VOCABULARY } from './teams.js';
import { hexToRgb, lchOf } from '../color-theorist/oklab.js';

// the smallest design that holds every axis, plus the things a mangekyou must never touch
const PROP = Object.freeze({
  kind: 'workbench', id: 'sword-1', title: 'a sword', seed: 42, position: [1, 2, 3], rank: 'elite', hp: 30, element: 'fire',
  build: {
    item: 'sword', finish: 'black', class: 'charger',
    dials: { stylize: 0.4, ornament: 0.3 }, register: 'heroic',
    parts: { blade: { length: 0.9, taper: 0.6, scale: 1.2 }, guard: { width: 0.22 } },
    colors: { blade: '#9aa3ad', grip: '#3b2a1a', accent: '#c9a23a' },
  },
});
const GAME = Object.freeze({
  kind: 'gameworld', seed: 7, levels: [{ id: 'a', height: 12, tint: '#336699' }],
  foes: { grunt: { class: 'charger', rank: 'minion', skin: { species: 'wolf', ooze: 'fire' }, scale: 1.1, tint: '#aa3322' } },
  style: { accent: '#ffcc00' },
});
const turn = (o) => turnMangekyou({ manifest: PROP, n: 4, roll: 101, ...o });
const apply = (m, patch) => { const d = structuredClone(m); for (const op of patch) { const s = op.path.slice(1).split('/'); let n = d; for (const k of s.slice(0, -1)) n = n[k]; n[s.at(-1)] = op.value; } return d; };
const lightness = (hex) => lchOf(hexToRgb(hex))[0];

describe('the general reading: any recipe, by its leaves', () => {
  it('reads each visual axis from the leaves alone, never a name, a place, a time or a gameplay number', () => {
    const leaves = readLeaves(PROP, { vocab: VOCABULARY });
    const at = Object.fromEntries(leaves.map((l) => [l.path, l.axis]));
    expect(at['/build/colors/blade']).toBe('colour');
    expect(at['/build/parts/blade/length']).toBe('size');
    expect(at['/build/parts/blade/taper']).toBe('silhouette');
    expect(at['/build/finish']).toBe('surface');
    expect(at['/build/register']).toBe('detail');
    expect(at['/seed']).toBe('roll');
    for (const never of ['/id', '/kind', '/title', '/position/0', '/rank', '/hp', '/element', '/build/class', '/build/item']) expect(at[never]).toBeUndefined();
  });
  it('reads a word only under a key its vocabulary names', () => {
    const leaves = readLeaves({ name: 'black', finish: 'black' }, { vocab: VOCABULARY });
    expect(leaves.map((l) => l.path)).toEqual(['/finish']);
  });
});

describe('an order is authored, not seeded by its author', () => {
  it('refuses an order without its roll: the library never rolls dice', () => {
    expect(() => turnMangekyou({ manifest: PROP })).toThrow(/rolled when it is authored/);
  });
  it('replays byte for byte from its roll, and a new roll is a new kaleidoscope', () => {
    expect(JSON.stringify(turn({ concept: 'faction liveries' }))).toBe(JSON.stringify(turn({ concept: 'faction liveries' })));
    expect(JSON.stringify(turn({ roll: 202 }).variants)).not.toBe(JSON.stringify(turn().variants));
    const a = rollOrder(), b = rollOrder();
    expect(Number.isInteger(a) && a >= 1).toBe(true);
    expect(a === b && rollOrder() === a).toBe(false);
  });
  it('is goosed: candidates commit to different axes at different strengths, and the n kept are dispersed', () => {
    const out = turn({ n: 6 });
    expect(out.variants).toHaveLength(6);
    const sets = new Set(out.variants.map((v) => Object.keys(v.moves).filter((k) => AXES.includes(k)).sort().join('+')));
    expect(sets.size).toBeGreaterThanOrEqual(3);
    expect(out.spread.min).toBeGreaterThan(0);
    const patches = new Set(out.variants.map((v) => JSON.stringify(v.patch)));
    expect(patches.size).toBe(6);
  });
});

describe('a variant is a patch over the design, on its visual axes only', () => {
  it('moves only leaves the reading found, and its patch applied to the design is the variant', () => {
    const paths = new Set(readLeaves(PROP, { vocab: VOCABULARY }).map((l) => l.path));
    for (const v of turn({ n: 5 }).variants) {
      expect(v.patch.length).toBeGreaterThan(0);
      for (const op of v.patch) expect(paths.has(op.path)).toBe(true);
      expect(apply(PROP, v.patch)).toEqual(v.manifest);
    }
  });
  it('leans the way the concept says: darker variants are darker, bigger ones bigger', () => {
    const dark = turn({ concept: 'darker', n: 6 }).variants.filter((v) => v.moves.colour);
    expect(dark.length).toBeGreaterThan(0);
    for (const v of dark) expect(lightness(v.manifest.build.colors.accent)).toBeLessThan(lightness(PROP.build.colors.accent));
    const big = turn({ concept: 'bigger', n: 6, roll: 7 }).variants.filter((v) => v.moves.size);
    expect(big.length).toBeGreaterThan(0);
    expect(big.filter((v) => v.moves.size.ratio > 1).length).toBeGreaterThan(big.length / 2);
  });
  it('a concept naming no axis turns them all; one naming an axis the design lacks says so', () => {
    expect(Object.values(readConcept('').weights).every((w) => w > 0)).toBe(true);
    const out = turnMangekyou({ manifest: { kind: 'x', colors: { a: '#123456' } }, concept: 'bigger', n: 1, roll: 3 });
    expect(out.order.unreached).toContain('size');
  });
});

describe('principles hold', () => {
  it('a lock is never moved, a bound is kept, a palette holds every colour', () => {
    const palette = ['#101010', '#e0d0b0', '#7a1f2b'];
    const out = turn({ n: 6, concept: 'colours and sizes', principles: { lock: ['/build/colors/grip'], bounds: { '/build/parts/blade/length': [0.8, 1] }, palette } });
    for (const v of out.variants) {
      expect(v.manifest.build.colors.grip).toBe(PROP.build.colors.grip);
      expect(v.manifest.build.parts.blade.length).toBeGreaterThanOrEqual(0.8);
      expect(v.manifest.build.parts.blade.length).toBeLessThanOrEqual(1);
      for (const k of ['blade', 'accent']) expect([PROP.build.colors[k], ...palette]).toContain(v.manifest.build.colors[k]);
    }
  });
  it('refuses malformed principles', () => {
    expect(() => readPrinciples({ lock: ['grip'] })).toThrow(/JSON Pointers/);
    expect(() => readPrinciples({ palette: ['red'] })).toThrow(/hex/);
    expect(() => readPrinciples({ axes: { smell: 1 } })).toThrow(/axes/);
  });
});

describe('routed to the team that owns the design', () => {
  it("a game's foe goes to foe design, kept through design_game, and only that foe turns", () => {
    expect(routeOrder(GAME, { at: '/foes/grunt' })).toMatchObject({ department: 'foes', keep: 'design_game' });
    const out = turnMangekyou({ manifest: GAME, at: '/foes/grunt', n: 3, roll: 5 });
    expect(out.order.team.department).toBe('foes');
    for (const v of out.variants) {
      for (const op of v.patch) expect(op.path.startsWith('/foes/grunt/')).toBe(true);
      expect(v.manifest.foes.grunt.class).toBe('charger');
      expect(v.manifest.foes.grunt.rank).toBe('minion');
    }
  });
  it('a whole game goes to production and turns only the chapters a look is written in', () => {
    const out = turnMangekyou({ manifest: GAME, n: 3, roll: 9 });
    expect(out.order.team.department).toBe('production');
    for (const v of out.variants) {
      expect(v.manifest.levels).toEqual(GAME.levels);
      expect(v.manifest.seed).toBe(GAME.seed);
    }
  });
  it('a prop goes to characters, props and vehicles; a kind no team names goes to production', () => {
    expect(routeOrder(PROP)).toMatchObject({ department: 'characters', keep: 'update_sketch' });
    expect(routeOrder({ kind: 'farm-ledger' }).department).toBe('production');
  });
});

describe('passes', () => {
  it('a kept variant is the next base, several kept are crossed, and a pass patch still applies to the design', () => {
    const first = turn({ n: 4 }).variants;
    const one = turn({ kept: [first[0].manifest] });
    expect(one.order.pass).toMatchObject({ kept: 1, crossed: 0 });
    for (const v of one.variants) expect(apply(PROP, v.patch)).toEqual(v.manifest);
    const two = turn({ kept: [first[0].manifest, first[1].manifest] });
    expect(two.order.pass.kept).toBe(2);
    expect(two.order.pass.crossed).toBeGreaterThan(0);
    for (const v of two.variants) expect(apply(PROP, v.patch)).toEqual(v.manifest);
  });
  it('a rejected variant is not offered back, and the pass is named by what it was given', () => {
    const first = turn({ n: 4 }).variants;
    const next = turn({ rejected: [first[0].manifest] });
    expect(next.order.pass.id).toBe('p0.1');
    for (const v of next.variants) expect(v.manifest).not.toEqual(first[0].manifest);
    expect(valueAt(PROP, '/build/finish')).toBe('black');
  });
});
