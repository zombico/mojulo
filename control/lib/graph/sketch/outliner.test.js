import { describe, expect, it } from 'vitest';

import {
  OUTLINER_GROUPS,
  STL_UNIT_MM,
  buildOutliner,
  groupOutliner,
  hudFacts,
  isViewportKind,
  pickHead,
  scaleStatement,
} from './outliner.js';

// Real shapes, taken from this workshop's store rather than invented — the whole
// point of the module is that manifests do not share a spine.
const WORKBENCH = {
  kind: 'workbench', title: 'Wizard', units: 'm',
  lathes: new Array(16).fill({}), extrudes: new Array(5).fill({}),
  sweeps: new Array(2).fill({}), drapes: new Array(3).fill({}),
  viewBox: { width: 1, height: 1 },
};
const CITY = {
  kind: 'fractal-city', title: 'City', seed: 7, anchor: {}, depth: 3, density: 0.5,
  baseScale: 1, time: 'dusk', locale: 'en', elements: { a: 1, b: 2 },
  civicAreas: [{}],
};
const CONTROLLABLE = {
  kind: 'controllable', title: 'Crypt', entities: [{}], camera: { a: 1, b: 2, c: 3, d: 4 },
  ground: { a: 1, b: 2, c: 3, d: 4 }, game: { a: 1, b: 2, c: 3 }, audio: { soundtrack: 'x' },
};

describe('buildOutliner', () => {
  it('reads a workbench recipe as its own four geometry branches', () => {
    const keys = buildOutliner(WORKBENCH).map((b) => b.key);
    expect(keys).toEqual(['lathes', 'extrudes', 'sweeps', 'drapes']);
  });

  it('reads a city recipe as completely different branches', () => {
    // The point of the module: there is no shared spine to walk.
    const keys = buildOutliner(CITY).map((b) => b.key);
    expect(keys).toEqual(['elements', 'civicAreas']);
  });

  it('counts arrays by length and objects by key', () => {
    const byKey = Object.fromEntries(buildOutliner(WORKBENCH).map((b) => [b.key, b.count]));
    expect(byKey.lathes).toBe(16);
    expect(byKey.extrudes).toBe(5);
    expect(Object.fromEntries(buildOutliner(CITY).map((b) => [b.key, b.count])).elements).toBe(2);
  });

  it('drops identity fields, which are not structure', () => {
    const keys = buildOutliner(WORKBENCH).map((b) => b.key);
    for (const noise of ['kind', 'title', 'units', 'viewBox']) expect(keys).not.toContain(noise);
    expect(buildOutliner(CITY).map((b) => b.key)).not.toContain('seed');
  });

  it('keeps a branch it has no word for, marked unnamed', () => {
    // An outliner that hid what it could not label would lie about the recipe.
    const branches = buildOutliner({ kind: 'x', title: 'y', doohickeys: [1, 2, 3] });
    expect(branches).toHaveLength(1);
    expect(branches[0]).toMatchObject({ key: 'doohickeys', count: 3, named: false });
  });

  it('marks known branches named, so the rail can label them', () => {
    expect(buildOutliner(WORKBENCH).every((b) => b.named)).toBe(true);
  });

  it('orders geometry before staging before sound before provenance', () => {
    const groups = buildOutliner(CONTROLLABLE).map((b) => b.group);
    const seen = [...new Set(groups)];
    expect(seen).toEqual(seen.slice().sort((a, b) => OUTLINER_GROUPS.indexOf(a) - OUTLINER_GROUPS.indexOf(b)));
    expect(buildOutliner(CONTROLLABLE)[0].key).toBe('entities');
  });

  it('skips empty, false and absent values rather than drawing zero rows', () => {
    expect(buildOutliner({ kind: 'x', faces: [], audio: null, showSlotMarkers: false })).toEqual([]);
  });

  it('survives a missing or malformed manifest', () => {
    expect(buildOutliner(null)).toEqual([]);
    expect(buildOutliner('nope')).toEqual([]);
  });
});

describe('groupOutliner', () => {
  it('drops bands the artifact has nothing in', () => {
    const groups = groupOutliner(buildOutliner(WORKBENCH)).map((g) => g.group);
    expect(groups).toEqual(['geometry']);
  });

  it('splits a staged, sounded artifact across its bands', () => {
    const groups = groupOutliner(buildOutliner(CONTROLLABLE));
    expect(groups.map((g) => g.group)).toEqual(['geometry', 'staging', 'sound']);
    expect(groups[2].branches.map((b) => b.key)).toEqual(['audio']);
  });
});

describe('scaleStatement', () => {
  it('reports the declared unit and the scale that prints it at true size', () => {
    // §3 says "1 unit = 1 m · stl-ready" and that is NOT the default: facesToStl
    // multiplies by `scale` and slicers read STL units as millimetres, so a metre
    // recipe needs scale 1000 to print at true size.
    expect(scaleStatement({ units: 'm' })).toEqual({ declared: 'm', stlScale: 1000 });
    expect(scaleStatement({ units: 'cm' })).toEqual({ declared: 'cm', stlScale: 10 });
    expect(scaleStatement({ units: 'mm' })).toEqual({ declared: 'mm', stlScale: 1 });
  });

  it('does not guess at units a recipe never declared', () => {
    expect(scaleStatement({ kind: 'fractal-city' })).toEqual({ declared: null, stlScale: 1 });
    expect(scaleStatement(null)).toEqual({ declared: null, stlScale: 1 });
  });

  it('ignores a unit it has no millimetre conversion for', () => {
    expect(scaleStatement({ units: 'furlongs' })).toEqual({ declared: null, stlScale: 1 });
  });

  it('agrees with the STL writer that one unit is one millimetre at scale 1', () => {
    expect(STL_UNIT_MM.mm).toBe(1);
  });
});

describe('hudFacts', () => {
  it('sums geometry parts across the branches that have them', () => {
    const facts = hudFacts({ sketch: { ref: 'sk_a', manifest: WORKBENCH } });
    expect(facts.parts).toBe(16 + 5 + 2 + 3);
    expect(facts.kind).toBe('workbench');
    expect(facts.scale.declared).toBe('m');
  });

  it('carries the seed when the recipe has one and null when it does not', () => {
    expect(hudFacts({ sketch: { ref: 'sk_c', manifest: CITY } }).seed).toBe(7);
    expect(hudFacts({ sketch: { ref: 'sk_w', manifest: WORKBENCH } }).seed).toBeNull();
  });

  it('reports a bake when the manifest carries one', () => {
    const facts = hudFacts({
      sketch: { ref: 'sk_gi', manifest: { ...CITY, giBake: { preset: 'exterior', bakedAt: '2026-08-01' } } },
      giBakeFrom: 'sk_src',
    });
    expect(facts.bake).toEqual({ preset: 'exterior', at: '2026-08-01', from: 'sk_src' });
  });

  it('reports no bake rather than an empty one', () => {
    expect(hudFacts({ sketch: { ref: 'sk_c', manifest: CITY } }).bake).toBeNull();
  });

  it('does not claim a triangle count it would need a full resolve to know', () => {
    // §3 lists "tri count"; getting it means resolveWorldScene, which is tens of
    // seconds for a big world. The home must not pay that to draw a text strip.
    expect(hudFacts({ sketch: { ref: 'sk_a', manifest: WORKBENCH } })).not.toHaveProperty('triangles');
  });

  it('is null for an artifact with no manifest', () => {
    expect(hudFacts({ sketch: null })).toBeNull();
    expect(hudFacts({ sketch: { ref: 'x' } })).toBeNull();
  });
});

describe('pickHead', () => {
  const mode = (m) => m?.mode || 'diagram';
  const s = (ref, m) => ({ ref, manifest: { mode: m } });

  it('opens on the newest artifact the viewport can actually open', () => {
    const head = pickHead([s('sk_flat', 'diagram'), s('sk_live', 'world'), s('sk_old', 'world')], mode);
    expect(head.ref).toBe('sk_live');
  });

  it('counts a css3d scene as a viewport reading', () => {
    expect(pickHead([s('sk_scene', 'scene')], mode).ref).toBe('sk_scene');
    expect(isViewportKind('scene')).toBe(true);
    expect(isViewportKind('world')).toBe(true);
  });

  it('falls back to the newest artifact when nothing is live', () => {
    // A workshop of only diagrams still gets a home that shows something.
    expect(pickHead([s('sk_a', 'diagram'), s('sk_b', 'svg')], mode).ref).toBe('sk_a');
  });

  it('does not treat heard/played kinds as viewport readings', () => {
    for (const m of ['beats', 'voice', 'game', 'play', 'svg', 'diagram']) {
      expect(isViewportKind(m)).toBe(false);
    }
  });

  it('is null on an empty workshop, which is the invitation', () => {
    expect(pickHead([], mode)).toBeNull();
    expect(pickHead(null, mode)).toBeNull();
  });
});
