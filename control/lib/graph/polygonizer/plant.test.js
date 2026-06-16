import { describe, it, expect } from 'vitest';
import {
  validatePlants,
  expandPlant,
  expandPlants,
  estimatePlantSegments,
  GOLDEN,
  FORMS,
  MAX_TAIJIS_PER_PLANT,
} from './plant.js';
import { validateTaijis } from './taiji.js';
import { renderManjiTreeToSvg } from './manji-svg.js';

const AXIS = { base: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 0, z: 6 } };

describe('plant — validation', () => {
  it('accepts an empty/defaulted spec', () => {
    expect(validatePlants([{}])).toEqual([]);
    expect(validatePlants([{ form: 'shoot', ...AXIS, count: 13 }])).toEqual([]);
  });

  it('accepts every form', () => {
    for (const form of FORMS) {
      expect(validatePlants([{ form, ...AXIS }])).toEqual([]);
    }
  });

  it('accepts conifer foliage aliases for local tree mode', () => {
    expect(validatePlants([{ form: 'tree', ...AXIS, foliage: 'conifer' }])).toEqual([]);
    expect(validatePlants([{ form: 'tree', ...AXIS, foliage: 'pine' }])).toEqual([]);
    expect(validatePlants([{ form: 'tree', ...AXIS, foliage: 'fir', foliageTiers: 6 }])).toEqual([]);
  });

  it('rejects an unknown form', () => {
    expect(validatePlants([{ form: 'shrubbery' }])[0]).toMatch(/form: must be one of/);
  });

  it('rejects a zero-length growth axis', () => {
    const errs = validatePlants([{ base: { x: 1, y: 1, z: 1 }, tip: { x: 1, y: 1, z: 1 } }]);
    expect(errs[0]).toMatch(/base and tip must differ/);
  });

  it('rejects a bad leafProfile, negative count, and non-vec points', () => {
    expect(validatePlants([{ leafProfile: 'fat' }])[0]).toMatch(/leafProfile/);
    expect(validatePlants([{ count: -3 }])[0]).toMatch(/count: must be a non-negative integer/);
    expect(validatePlants([{ base: [0, 0, 0] }])[0]).toMatch(/base: must be \{x,y,z\}/);
  });

  it('bounds the compiled taiji count', () => {
    const errs = validatePlants([{ count: 999, discCount: 999 }]);
    expect(errs.some((e) => /too large/.test(e))).toBe(true);
  });

  it('bounds a tree that would blow past the cap via depth/branches', () => {
    const errs = validatePlants([{ form: 'tree', depth: 6, branches: 5 }]);
    expect(errs.some((e) => /too large/.test(e))).toBe(true);
    expect(validatePlants([{ form: 'tree', depth: 4, branches: 2 }])).toEqual([]);
  });

  it('bounds a grove that scatters too many / too-large trees', () => {
    expect(validatePlants([{ form: 'grove', count: 60, tree: { depth: 6, branches: 4 } }]).some((e) => /too large/.test(e))).toBe(true);
    expect(validatePlants([{ form: 'grove', count: 12 }])).toEqual([]);
  });

  it('brush matter renders as strokes (polylines), not filled polygons', () => {
    const svg = renderManjiTreeToSvg({
      kind: 'manji-tree', dimensions: '3d',
      tree: { id: 'world', spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.1 } }, anchor: { x: 0, y: 0, z: 0 }, slots: [] },
      showSlotMarkers: false,
      taijis: [{ yin: { x: 0, y: 0, z: 0 }, yang: { x: 1, y: 0, z: 2 }, twist: 0.05, radius: 0.2, matter: { fill: 'brush' } }],
    });
    expect(svg).toMatch(/<polyline /);
  });

  it('is lenient on a non-array (no throw, empty errors)', () => {
    expect(validatePlants(undefined)).toEqual([]);
    expect(validatePlants(null)).toEqual([]);
  });
});

describe('plant — expansion shape', () => {
  it('shoot emits one capsule stem + one spindle leaf per node', () => {
    const t = expandPlant({ form: 'shoot', ...AXIS, count: 13 });
    expect(t).toHaveLength(14); // stem + 13 leaves
    expect(t[0].profile).toBe('capsule'); // the stem
    expect(t.slice(1).every((x) => x.profile === 'spindle')).toBe(true);
  });

  it('frond emits a capsule rachis + one pinna per count', () => {
    const t = expandPlant({ form: 'frond', ...AXIS, count: 11 });
    expect(t).toHaveLength(12);
    expect(t[0].profile).toBe('capsule');
    expect(t[0].center).toBeDefined(); // arching rachis bends via center
  });

  it('flower emits one petal per count plus disc florets', () => {
    expect(expandPlant({ form: 'flower', count: 21 })).toHaveLength(21);
    expect(expandPlant({ form: 'flower', count: 21, discCount: 80 })).toHaveLength(101);
  });

  it('rosette emits capsule tongue-leaves', () => {
    const t = expandPlant({ form: 'rosette', ...AXIS, count: 8 });
    expect(t).toHaveLength(8);
    expect(t.every((x) => x.profile === 'capsule')).toBe(true);
  });

  it('tree branches recursively into a geometric series of capsule limbs', () => {
    // branches=2, depth=3, no foliage → 1+2+4+8 = 15 segments, all capsule.
    const t = expandPlant({ form: 'tree', ...AXIS, depth: 3, branches: 2, foliage: false });
    expect(t).toHaveLength(15);
    expect(t.every((x) => x.profile === 'capsule')).toBe(true);
  });

  it('tree foliage adds spindle leaves at the terminal twigs', () => {
    const bare = expandPlant({ form: 'tree', ...AXIS, depth: 3, branches: 2, foliage: false });
    const leafy = expandPlant({ form: 'tree', ...AXIS, depth: 3, branches: 2, leafCount: 4 });
    expect(leafy.length).toBe(bare.length + Math.pow(2, 3) * 4); // 8 terminal twigs × 4 leaves
    expect(leafy.some((x) => x.profile === 'spindle')).toBe(true);
  });

  it("foliage:'cluster' (wig) emits ONE blob per twig instead of leafCount", () => {
    const leafy = expandPlant({ form: 'tree', ...AXIS, depth: 3, branches: 2, foliage: 'leaves', leafCount: 5 });
    const wig = expandPlant({ form: 'tree', ...AXIS, depth: 3, branches: 2, foliage: 'cluster' });
    const bare = expandPlant({ form: 'tree', ...AXIS, depth: 3, branches: 2, foliage: false });
    const terminals = Math.pow(2, 3); // 8
    expect(wig.length).toBe(bare.length + terminals);       // one wig per terminal twig
    expect(leafy.length).toBe(bare.length + terminals * 5); // five leaves per terminal
    expect(wig.length).toBeLessThan(leafy.length);          // the efficiency win
    expect(expandPlant({ form: 'tree', ...AXIS, foliage: 'wig' }).length)
      .toBe(expandPlant({ form: 'tree', ...AXIS, foliage: 'cluster' }).length); // alias
  });

  it("foliage:'pine' emits stacked tapered mass tiers per terminal twig", () => {
    const bare = expandPlant({ form: 'tree', ...AXIS, depth: 2, branches: 2, foliage: false });
    const pine = expandPlant({ form: 'tree', ...AXIS, depth: 2, branches: 2, foliage: 'pine', foliageTiers: 5, clusterSize: 0.6 });
    const terminals = Math.pow(2, 2);
    expect(pine).toHaveLength(bare.length + terminals * 6); // central cap + 5 tiers per terminal
    const foliage = pine.slice(bare.length);
    expect(foliage.every((x) => x.matter?.fill === 'silhouette')).toBe(true);
    expect(foliage.some((x) => x.profile === 'capsule')).toBe(true);
    expect(foliage.some((x) => x.profile === 'spindle')).toBe(true);
  });

  it('a bare tree (foliage:false) is all-capsule limbs, bounded', () => {
    const bare = expandPlant({ form: 'tree', ...AXIS, depth: 4, branches: 2, foliage: false });
    expect(bare.length).toBeGreaterThan(0);
    expect(bare.length).toBeLessThanOrEqual(MAX_TAIJIS_PER_PLANT);
    expect(bare.every((x) => x.profile === 'capsule')).toBe(true);
  });

  it('disc packs N spindle florets (sunflower) — flat by default', () => {
    const d = expandPlant({ form: 'disc', center: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 0, z: 1 }, count: 80 });
    expect(d).toHaveLength(80);
    expect(d.every((x) => x.profile === 'spindle')).toBe(true);
  });

  it('disc with length becomes a capsule-scaled ovoid (pinecone)', () => {
    const cone = expandPlant({ form: 'disc', center: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 0, z: 3 }, count: 60, length: 2.5 });
    expect(cone).toHaveLength(60);
    expect(cone.every((x) => x.profile === 'capsule')).toBe(true);
  });

  it('grove scatters many varied trees, deterministically and bounded', () => {
    const g = expandPlant({ form: 'grove', base: { x: 0, y: 0, z: 0 }, count: 9, region: { width: 16, depth: 12 } });
    expect(g.length).toBeGreaterThan(9 * 10); // many taijis across nine trees
    expect(g.length).toBeLessThanOrEqual(1600); // grove cap
    // Natural variation: the nine trunk bases are at distinct positions.
    const trunkXs = new Set(g.filter((t) => t.profile === 'capsule').map((t) => `${t.yin.x},${t.yin.y}`));
    expect(trunkXs.size).toBeGreaterThan(1);
    // Deterministic (no seed): same spec → identical geometry.
    expect(JSON.stringify(g)).toBe(JSON.stringify(expandPlant({ form: 'grove', base: { x: 0, y: 0, z: 0 }, count: 9, region: { width: 16, depth: 12 } })));
  });

  it('grove can scatter local pine trees through its tree template', () => {
    const g = expandPlant({
      form: 'grove',
      base: { x: 0, y: 0, z: 0 },
      count: 5,
      variation: 0.2,
      tree: { foliage: 'pine', foliageTiers: 4, branches: 1, depth: 3, branchAngle: 22 },
    });
    expect(g.length).toBeGreaterThan(5 * 8);
    expect(g.length).toBeLessThanOrEqual(1600);
    expect(g.some((x) => x.profile === 'capsule' && x.radius < 0.4)).toBe(true);
  });

  it('leafProfile=capsule turns shoot leaves into tongues', () => {
    const t = expandPlant({ form: 'shoot', ...AXIS, count: 5, leafProfile: 'capsule' });
    expect(t.slice(1).every((x) => x.profile === 'capsule')).toBe(true);
  });

  it('taper shrinks each successive leaf (self-similarity)', () => {
    const t = expandPlant({ form: 'shoot', ...AXIS, count: 6, taper: 0.8 });
    const leaves = t.slice(1);
    for (let i = 1; i < leaves.length; i += 1) {
      expect(leaves[i].radius).toBeLessThan(leaves[i - 1].radius);
    }
  });

  it('expandPlants flattens a list', () => {
    const out = expandPlants([{ form: 'shoot', count: 3 }, { form: 'flower', count: 5 }]);
    expect(out).toHaveLength(4 + 5);
  });

  it('GOLDEN is the 137.5° divergence and is the shoot default', () => {
    expect(GOLDEN).toBeCloseTo(0.381966, 5);
    expect(MAX_TAIJIS_PER_PLANT).toBeGreaterThan(0);
  });
});

describe('plant — browser budget', () => {
  it('auto-drops a heavy plant to a light mesh when detail is unpinned', () => {
    // A big sunflower head: at medium it would blow the segment target, so the
    // guard re-expands at low. Same taiji COUNT, far fewer segments.
    const big = { form: 'flower', center: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 3, z: 0 }, count: 30, discCount: 200 };
    const auto = expandPlant(big);
    const forcedHigh = expandPlant({ ...big, detail: 'high' });
    expect(auto).toHaveLength(forcedHigh.length); // same geometry, different mesh
    expect(estimatePlantSegments(auto)).toBeLessThan(estimatePlantSegments(forcedHigh));
  });

  it('honors an explicitly pinned detail even when heavy', () => {
    const spec = { form: 'flower', center: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 3, z: 0 }, count: 30, discCount: 200, detail: 'high' };
    const a = expandPlant(spec);
    // 'high' is respected (not auto-dropped): its segment count exceeds 'low'.
    expect(estimatePlantSegments(a)).toBeGreaterThan(estimatePlantSegments(expandPlant({ ...spec, detail: 'low' })));
  });

  it('keeps a default tree under the auto target', () => {
    const t = expandPlant({ form: 'tree', ...AXIS, depth: 4, branches: 2 });
    expect(estimatePlantSegments(t)).toBeLessThan(8000);
  });
});

describe('plant — paint (wave→world matter)', () => {
  it("defaults to silhouette; 'lines' opts back to wireframe; fibers is explicit", () => {
    const def = expandPlant({ form: 'shoot', ...AXIS, count: 6 });
    const lines = expandPlant({ form: 'shoot', ...AXIS, count: 6, paint: 'lines' });
    const sil = expandPlant({ form: 'shoot', ...AXIS, count: 6, paint: 'silhouette' });
    const fib = expandPlant({ form: 'shoot', ...AXIS, count: 6, paint: 'fibers' });
    expect(def.every((t) => t.matter?.fill === 'silhouette')).toBe(true); // default
    expect(lines.every((t) => !t.matter)).toBe(true);
    expect(sil.every((t) => t.matter?.fill === 'silhouette')).toBe(true);
    expect(fib.every((t) => t.matter?.fill === 'fibers')).toBe(true);
  });

  it('silhouette is far lighter than the wireframe it replaces', () => {
    const lines = expandPlant({ form: 'tree', ...AXIS, depth: 4, branches: 2, paint: 'lines' });
    const sil = expandPlant({ form: 'tree', ...AXIS, depth: 4, branches: 2, paint: 'silhouette' });
    expect(estimatePlantSegments(sil)).toBeLessThan(estimatePlantSegments(lines));
  });

  it('renders filled polygons through the pipeline when painted', () => {
    const svg = renderManjiTreeToSvg({
      kind: 'manji-tree', dimensions: '3d',
      tree: { id: 'world', spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.1 } }, anchor: { x: 0, y: 0, z: 0 }, slots: [] },
      showSlotMarkers: false,
      taijis: expandPlant({ form: 'shoot', ...AXIS, count: 8, paint: 'silhouette' }),
    });
    expect(svg).toMatch(/<polygon /);
  });
});

describe('plant — determinism (no seed)', () => {
  it('produces byte-identical taijis for the same spec', () => {
    const spec = { form: 'shoot', ...AXIS, count: 13, divergence: GOLDEN };
    expect(JSON.stringify(expandPlant(spec))).toBe(JSON.stringify(expandPlant(spec)));
  });

  it('every emitted taiji is a valid taiji spec', () => {
    for (const form of FORMS) {
      const taijis = expandPlant({ form, ...AXIS, count: 9, discCount: form === 'flower' ? 20 : 0 });
      expect(validateTaijis(taijis, [])).toEqual([]);
    }
  });
});

describe('plant — renders through the manji-tree pipeline', () => {
  const ROOT = {
    id: 'world',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.1 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [],
  };
  it('a compiled shoot paints strands + partition mesh end-to-end', () => {
    const svg = renderManjiTreeToSvg({
      kind: 'manji-tree',
      dimensions: '3d',
      tree: ROOT,
      taijis: expandPlant({ form: 'shoot', ...AXIS, count: 13 }),
    });
    expect(svg).toMatch(/<line /);
    expect(svg).toContain('#4a7c3a'); // default leaf/stem partition palette
  });
});
