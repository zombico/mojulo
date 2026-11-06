import { describe, it, expect } from 'vitest';
import { turnMangekyou, readConcept, routeOrder, readPrinciples, rollOrder, AXES } from './index.js';
import { readLeaves, valueAt } from './leaves.js';
import { VOCABULARY } from './teams.js';
import { hexToRgb, lchOf } from '../color-theorist/oklab.js';
import { meshOfFaces, outlinesApart } from './outline.js';

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

describe("the house's words", () => {
  it("an arm's parts are swapped slot by slot, within the words that slot takes, and its finish card by name", () => {
    const rifle = { kind: 'equipment', item: 'rifle', model: 'assault', style: 'fde', parts: { optic: 'reddot', stock: 'collapsible', barrel: 'standard' } };
    const slot = (id) => VOCABULARY.find((v) => v.id === id).words;
    const out = turnMangekyou({ manifest: rifle, concept: 'different shapes and finishes', n: 5, roll: 4242 });
    let parts = 0;
    for (const v of out.variants) {
      for (const [k, w] of Object.entries(v.manifest.parts)) { expect(slot(`part:${k}`)).toContain(w); if (w !== rifle.parts[k]) parts += 1; }
      expect(VOCABULARY.find((x) => x.id === 'finish').words).toContain(v.manifest.style);
    }
    expect(parts).toBeGreaterThan(0);
    expect(slot('part:barrel')).toEqual(['short', 'standard', 'long']);
    // each swap said as what it was and what it became, in its own vocabulary
    for (const v of out.variants) for (const w of v.moves.words ?? []) {
      expect(w.from).not.toBe(w.to);
      expect(VOCABULARY.find((x) => x.id === w.vocab).words).toEqual(expect.arrayContaining([w.from, w.to]));
    }
  });
  it('a piece of furniture as stored: its forms and fabric are words, its millimetres whole quantities moved by a ratio', () => {
    const sofa = { kind: 'workbench', build: { type: 'furniture', piece: 'sofa', dials: { arms: 'rolled', back: 'tufted', cushions: 'bench', seatH: 440, armH: 760 }, legs: 'turned', size: [2190, 945, 760], fabric: 'tartan' } };
    const out = turnMangekyou({ manifest: sofa, concept: 'different shapes, fabrics and sizes', n: 5, roll: 31 });
    const sized = out.variants.filter((v) => v.moves.size);
    expect(sized.length).toBeGreaterThan(0);
    for (const v of sized) {
      for (const x of [...v.manifest.build.size, v.manifest.build.dials.seatH]) expect(Number.isInteger(x)).toBe(true);
      expect(Math.abs(v.manifest.build.size[0] - 2190)).toBeGreaterThan(1);
    }
    expect(out.variants.some((v) => v.manifest.build.fabric !== 'tartan' || v.manifest.build.legs !== 'turned')).toBe(true);
    // a box's bare w and h are not a thing's size
    expect(readLeaves({ marks: [{ w: 80, h: 40 }] }).length).toBe(0);
  });
});

describe('a scale is kept a scale', () => {
  it('a whole-number scale moves in whole steps, its 1 too, and a ladder of them keeps its order', () => {
    const tiers = { kind: 'equipment', tiers: { early: { ornament: 1 }, mid: { ornament: 2 }, late: { ornament: 3 } } };
    let moved = 0;
    for (const roll of [1, 2, 3, 4, 5]) for (const v of turnMangekyou({ manifest: tiers, concept: 'more ornate', n: 3, roll }).variants) {
      const [a, b, c] = ['early', 'mid', 'late'].map((t) => v.manifest.tiers[t].ornament);
      for (const x of [a, b, c]) expect(Number.isInteger(x) && x >= 1).toBe(true);
      expect(a < b && b < c).toBe(true);
      moved += 1;
    }
    expect(moved).toBeGreaterThan(0);
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

describe('a new order looks away from what was shown', () => {
  it('the variants shown before are not offered again, and every candidate hears the axis its concept names', () => {
    const first = turn({ n: 4, concept: 'different shapes' });
    for (const v of first.variants) expect(v.moves.silhouette).toBeDefined();
    const again = turn({ n: 4, concept: 'different shapes', seen: first.variants.map((v) => v.manifest) });
    expect(again.order.pass.seen).toBe(4);
    const shown = new Set(first.variants.map((v) => JSON.stringify(v.patch)));
    for (const v of again.variants) expect(shown.has(JSON.stringify(v.patch))).toBe(false);
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

describe('the outline gate: different shapes, or one shape in other coats', () => {
  // a box as World faces (six quads)
  const box = ([x, y, z]) => {
    const c = (i, j, k) => [i * x, j * y, k * z];
    const q = (...p) => ({ corners: p });
    return [q(c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0)), q(c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)),
      q(c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)), q(c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)),
      q(c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)), q(c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)), { corners: [[0, 0, -1], [9, 0, -1], [9, 9, -1]], studio: true }];
  };
  it('reads shape, not size or the studio, and says each variant against the design', () => {
    const cube = meshOfFaces(box([1, 1, 1]));
    expect(cube.faces).toHaveLength(12);
    const out = outlinesApart({ design: cube, v1: meshOfFaces(box([3, 3, 3])), v2: meshOfFaces(box([4, 1, 1])) });
    expect(out.from.v1).toBe(1);
    expect(out.from.v2).toBeLessThan(0.75);
    expect(out.pairs).toEqual([{ a: 'v1', b: 'v2', iou: out.from.v2 }]);
    expect(out.ok).toBe(true);
    expect(outlinesApart({ v1: cube, v2: meshOfFaces(box([2, 2, 2])) })).toMatchObject({ ok: false, mostAlike: { iou: 1 } });
  });
});
