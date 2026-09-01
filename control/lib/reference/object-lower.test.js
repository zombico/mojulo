import { describe, it, expect } from 'vitest';
import { lowerObjectCage, fuseObjectInsights, OBJECT_PROTOCOL } from './object-lower.js';
import { planWorkbench } from '@/lib/graph/worlds/workbench';
import { planAssembler } from '@/lib/graph/worlds/workbench-assembler';

const lathe = (id, zFrom, zTo, radius, extra = {}) => ({
  id, monomer: 'lathe', junction: 'stack', zFrom, zTo, radius, ...extra,
});

const MOKA = {
  identity: 'slender stainless moka pot — conical boiler, gasket band, straight upper, flared rim',
  unitHeight: 22,
  orthographic: true,
  view: { az: 35, el: 20 },
  parts: [
    lathe('boiler', 0, 0.45, 4, { profile: [{ t: 0, radius: 4 }, { t: 1, radius: 2.6 }] }),
    lathe('gasket', 0.45, 0.5, 2.8),
    lathe('upper', 0.5, 0.92, 2.7),
    lathe('rim', 0.92, 1, 3.1),
    { id: 'valve', monomer: 'lathe', junction: 'jut', anchor: [3.6, 0, 0.2], normal: [1, 0, 0], depth: 1.6, jut: 0.6, rect: { w: 1, h: 1 } },
  ],
};

describe('object-lower — one-shot', () => {
  it('lowers a part-graph into a workbench recipe the mint gate accepts', () => {
    const { manifest, ledger } = lowerObjectCage(MOKA, 'moka');
    expect(manifest.kind).toBe('workbench');
    expect(manifest.facing).toBe(35);
    expect(ledger.mode).toBe('one-shot');
    expect(ledger.parts).toBe(5);
    // Fractions were multiplied by unitHeight — the rim tops out at the declared total.
    expect(manifest.lathes.at(-1).axisTo.z).toBeCloseTo(22, 5);
    expect(() => planWorkbench(manifest)).not.toThrow();
  });

  it('rejects an absolute z — the fraction discipline is structural, not advisory', () => {
    const bad = { ...MOKA, parts: [lathe('boiler', 0, 12, 4)] };
    expect(() => lowerObjectCage(bad)).toThrow(/FRACTION of unitHeight/);
  });

  it('requires the identity lock and a named junction per part', () => {
    expect(() => lowerObjectCage({ ...MOKA, identity: '' })).toThrow(/identity/);
    const noJunction = { ...MOKA, parts: [{ id: 'a', monomer: 'lathe', zFrom: 0, zTo: 1, radius: 2 }] };
    expect(() => lowerObjectCage(noJunction)).toThrow(/junction must be one of/);
  });

  it('flags a jut that protrudes far less than it declared', () => {
    const sunk = {
      ...MOKA,
      parts: [
        lathe('body', 0, 1, 5),
        { id: 'boss', monomer: 'extrude', junction: 'jut', anchor: [0, 0, 0.5], normal: [1, 0, 0], depth: 1, jut: 0.9, rect: { w: 1, h: 1 } },
      ],
    };
    const { ledger } = lowerObjectCage(sunk);
    expect(ledger.shortfall.map((s) => s.id)).toContain('boss');
    expect(ledger.warnings.join(' ')).toMatch(/protrude far less than declared/);
  });
});

const LIGHTHOUSE = {
  identity: 'stylized lighthouse diorama — cream tapered tower, red cupola, purple faceted rock island',
  unitHeight: 100,
  orthographic: true,
  view: { az: 45, el: 25 },
  segments: [
    {
      id: 'island', heightFrac: 0.3, on: 'ground',
      parts: [{ id: 'rock', monomer: 'shell', junction: 'composite', solid: 'icosahedron', radius: 14, center: [0, 0, 0.5], tint: '#6b4f8a' }],
    },
    {
      id: 'tower', heightFrac: 0.55, on: 'island',
      parts: [lathe('shaft', 0, 0.85, 6, { profile: [{ t: 0, radius: 7 }, { t: 1, radius: 4.5 }] }),
              lathe('collar', 0.85, 1, 5.2, { tint: '#b8352f' })],
    },
    {
      id: 'cupola', heightFrac: 0.15, on: 'tower',
      parts: [lathe('lantern', 0, 0.7, 3.6, { tint: '#b8352f' }),
              { id: 'gallery', monomer: 'extrude', junction: 'jut', anchor: [3.6, 0, 0.3], normal: [1, 0, 0], depth: 1.4, jut: 0.8, rect: { w: 1.2, h: 1.2 } }],
    },
  ],
};

describe('object-lower — segment-first', () => {
  it('lowers segments into an assembler plus one workbench recipe per segment', () => {
    const { manifest, ledger, segments } = lowerObjectCage(LIGHTHOUSE, 'lighthouse');
    expect(manifest.kind).toBe('assembler');
    expect(manifest.items.map((i) => i.id)).toEqual(['island', 'tower', 'cupola']);
    expect(segments).toHaveLength(3);
    expect(segments.every((s) => s.manifest.kind === 'workbench')).toBe(true);
    expect(ledger.mode).toBe('segments');
    expect(ledger.parts).toBe(5);
  });

  it("composes by relation — every segment gravity-seats, none authors a z", () => {
    const { manifest } = lowerObjectCage(LIGHTHOUSE);
    expect(manifest.items.map((i) => i.on)).toEqual(['ground', 'island', 'tower']);
    for (const item of manifest.items) expect(item.at?.[2] ?? 0).toBe(0);
    // The assembler computes the running z: each part sits on top of the last.
    const { stats } = planAssembler(manifest);
    const tops = stats.parts.map((p) => p.topZ);
    expect(tops[1]).toBeGreaterThan(tops[0]);
    expect(tops[2]).toBeGreaterThan(tops[1]);
    expect(stats.parts[0].baseZ).toBeCloseTo(0, 1);
  });

  it('scopes each part fraction to its OWN segment, not the whole', () => {
    const { segments } = lowerObjectCage(LIGHTHOUSE);
    const tower = segments.find((s) => s.id === 'tower');
    // 0.55 of 100 = a 55-tall segment; its own 0.85..1 collar tops out at 55.
    expect(tower.ledger.unitHeight).toBeCloseTo(55, 5);
    expect(tower.manifest.lathes.at(-1).axisTo.z).toBeCloseTo(55, 5);
  });

  it('accepts a shell-only segment (the assembler gate used to reject one)', () => {
    const { manifest } = lowerObjectCage(LIGHTHOUSE);
    expect(() => planAssembler(manifest)).not.toThrow();
  });

  it('refuses parts and segments together, and a z at the segment altitude', () => {
    expect(() => lowerObjectCage({ ...LIGHTHOUSE, parts: MOKA.parts })).toThrow(/never both/);
    const withZ = { ...LIGHTHOUSE, segments: LIGHTHOUSE.segments.map((s, i) => (i ? s : { ...s, at: [0, 0, 5] })) };
    expect(() => lowerObjectCage(withZ)).toThrow(/never authors z/);
  });

  it('warns when a segment did not name its support', () => {
    const implicit = { ...LIGHTHOUSE, segments: LIGHTHOUSE.segments.map(({ on, ...rest }) => rest) };
    const { ledger } = lowerObjectCage(implicit);
    expect(ledger.warnings.join(' ')).toMatch(/did not name a support/);
    expect(ledger.segments.every((s) => s.seating.implicit)).toBe(true);
  });
});

describe('object-lower — multi-pass fusion', () => {
  it('is a no-op on a first pass', () => {
    const { insights, fusion } = fuseObjectInsights(null, MOKA);
    expect(insights).toBe(MOKA);
    expect(fusion).toBeNull();
  });

  it('lets a second view send ONLY its corrections', () => {
    const correction = { parts: [{ id: 'boiler', radius: 5.2 }] };
    const { insights, fusion } = fuseObjectInsights(MOKA, correction);
    expect(fusion.mode).toBe('fused');
    expect(fusion.updated).toEqual(['boiler']);
    expect(fusion.carried).toEqual(['gasket', 'upper', 'rim', 'valve']);
    // The corrected field lands; everything else on that part survives.
    const boiler = insights.parts.find((p) => p.id === 'boiler');
    expect(boiler.radius).toBe(5.2);
    expect(boiler.monomer).toBe('lathe');
    expect(boiler.zTo).toBe(0.45);
    expect(insights.identity).toBe(MOKA.identity);
    // And it still lowers.
    expect(lowerObjectCage(insights).manifest.kind).toBe('workbench');
  });

  it('adds a part the first view could not see, and drops one it disproved', () => {
    const { insights, fusion } = fuseObjectInsights(MOKA, {
      parts: [{ id: 'handle', monomer: 'sweep', junction: 'jut', path: [[3, 0, 0.5], [6, 0, 0.7], [3, 0, 0.9]], radius: 0.5 }],
      drop: ['valve'],
    });
    expect(fusion.added).toEqual(['handle']);
    expect(fusion.dropped).toEqual(['valve']);
    expect(insights.parts.map((p) => p.id)).toEqual(['boiler', 'gasket', 'upper', 'rim', 'handle']);
  });

  it('merges segments by id and their parts within', () => {
    const { insights, fusion } = fuseObjectInsights(LIGHTHOUSE, {
      segments: [{ id: 'tower', heightFrac: 0.5, parts: [{ id: 'shaft', radius: 8 }] }],
    });
    expect(fusion.updated).toContain('tower/shaft');
    expect(fusion.carried).toEqual(expect.arrayContaining(['island', 'cupola', 'tower/collar']));
    const tower = insights.segments.find((s) => s.id === 'tower');
    expect(tower.heightFrac).toBe(0.5);
    expect(tower.parts.find((p) => p.id === 'shaft').radius).toBe(8);
    expect(tower.parts).toHaveLength(2);
  });

  it('does not fuse across a mode switch — that is a re-authoring', () => {
    const { insights, fusion } = fuseObjectInsights(MOKA, LIGHTHOUSE);
    expect(fusion.mode).toBe('replaced');
    expect(insights).toBe(LIGHTHOUSE);
  });

  it('never carries the stored ledger into the next read', () => {
    const withLedger = { ...MOKA, __ledger: { warnings: ['stale'] } };
    const { insights } = fuseObjectInsights(withLedger, { parts: [{ id: 'rim', radius: 3.4 }] });
    expect(insights.__ledger).toBeUndefined();
  });
});

describe('object-lower — the protocol teaches both altitudes', () => {
  it('names the segment decision and the fusion contract', () => {
    expect(OBJECT_PROTOCOL.key_lines.join(' ')).toMatch(/SEGMENT OR ONE-SHOT/);
    expect(OBJECT_PROTOCOL.multipass_hint).toMatch(/FUSES/);
    expect(OBJECT_PROTOCOL.input_schema['insights.segments[]']).toBeTruthy();
  });
});


// The moka pot was entirely rotational, so every gate was validated only on
// circles — where inradius, circumradius and half-extent are the same number.
// The first square subject (object-reference.plan.md §12) broke three of them.
describe('object-lower — the gates on a BOXY subject', () => {
  const sq = (a) => [[-a, -a], [a, -a], [a, a], [-a, a]];
  const TOWER = {
    identity: 'white square tapered tower with a red door and a window',
    unitHeight: 100,
    parts: [
      { id: 'tower', monomer: 'extrude', junction: 'stack', zFrom: 0, zTo: 1, points: sq(18.8), endPoints: sq(9.7) },
      { id: 'door', monomer: 'extrude', junction: 'jut', anchor: [0, -16.74, 0.226], normal: [0, -1, 0], depth: 8, jut: 0.55, rect: { w: 7, h: 12 } },
    ],
  };

  it('does not inflate a wide flat slab\'s height by its own width', () => {
    // A 39-wide, 2.8-tall plinth measured 42.2 tall when the profile reach was
    // added to all three axes.
    const plinth = { identity: 'concrete plinth', unitHeight: 2.8,
      parts: [{ id: 'slab', monomer: 'extrude', junction: 'stack', zFrom: 0, zTo: 1, points: sq(19.7) }] };
    const { ledger } = lowerObjectCage(plinth);
    expect(ledger.measuredHeight).toBeCloseTo(2.8, 1);
    expect(ledger.warnings.join(' ')).not.toMatch(/measured height/);
  });

  it('does not report a face-mounted feature as buried by its own square host', () => {
    // A prism tested as a cylinder of its CIRCUMRADIUS swallowed every door and
    // window on its own wall.
    const { ledger } = lowerObjectCage(TOWER);
    expect(ledger.buried).toEqual([]);
    expect(ledger.shortfall).toEqual([]);
  });

  it('narrows containment along a taper', () => {
    // Same door, mounted high where the tower is thin: still exposed. Tested at
    // the base width all the way up, it would read as buried.
    const high = { ...TOWER, parts: [TOWER.parts[0],
      { ...TOWER.parts[1], id: 'window', anchor: [12.43, 0, 0.70], normal: [1, 0, 0], depth: 6, jut: 0.6, rect: { w: 5, h: 6 } }] };
    const { ledger } = lowerObjectCage(high);
    expect(ledger.buried).toEqual([]);
    expect(ledger.coverage.find((c) => c.id === 'window').covered).toBeLessThan(0.9);
  });

  it('flags a jut that is geometrically correct but too small to READ', () => {
    // 1.35 units proud of a 100-unit tower passed the RATIO check at 53% exposed
    // and was invisible in every render.
    const faint = { ...TOWER, parts: [TOWER.parts[0], { ...TOWER.parts[1], depth: 3, jut: 0.45 }] };
    const { ledger } = lowerObjectCage(faint);
    expect(ledger.faint.map((f) => f.id)).toContain('door');
    expect(ledger.warnings.join(' ')).toMatch(/too little to READ/);
    // ...and the deepened version does not fire.
    expect(lowerObjectCage(TOWER).ledger.faint).toBeUndefined();
  });

  it('scales the READ check against the OBJECT, not the segment', () => {
    // A small feature in a short segment is judged against the whole object's
    // height, which is the scale a viewer actually reads at.
    const seg = { identity: 'tower with gallery', unitHeight: 100,
      segments: [{ id: 'gallery', heightFrac: 0.1, on: 'ground', parts: [
        { id: 'deck', monomer: 'extrude', junction: 'stack', zFrom: 0, zTo: 1, points: sq(15) },
        { id: 'nub', monomer: 'extrude', junction: 'jut', anchor: [15, 0, 0.5], normal: [1, 0, 0], depth: 2, jut: 0.5, rect: { w: 1, h: 1 } },
      ] }] };
    const { ledger } = lowerObjectCage(seg);
    // 1.0 unit proud needs ~2 (2% of 100), not ~0.2 (2% of the 10-tall segment).
    expect(ledger.warnings.join(' ')).toMatch(/needs ~2/);
  });
});
