import { describe, expect, it } from 'vitest';

import { lowerObjectFaces, planWorkbench, collectWrapSources } from './workbench.js';
import { lowerAssembly } from '../polygonizer/workbench-assembly.js';

const lathe = (extra = {}) => ({ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], ...extra });

describe('planWorkbench — per-part readout', () => {
  it('reports each monomer with its size + base/top z', () => {
    const lowered = lowerAssembly({ parts: [
      { kind: 'lathe', height: 2, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] },
      { kind: 'lathe', height: 3, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] },
    ] });
    const { stats } = planWorkbench({ kind: 'workbench', ...lowered });
    expect(stats.monomers).toBe(2);
    expect(stats.parts).toHaveLength(2);
    expect(stats.parts[0].base).toBe(0);
    expect(stats.parts[0].top).toBeCloseTo(2, 1);
    expect(stats.parts[1].base).toBeCloseTo(2, 1);
    expect(stats.parts[1].top).toBeCloseTo(5, 1);
  });

  it('a replicated assembly (radial stool: 4 legs + seat) bakes end-to-end', () => {
    const lowered = lowerAssembly({ parts: [
      { id: 'legs', kind: 'lathe', height: 40, profile: [{ t: 0, radius: 1.5 }, { t: 1, radius: 1.5 }], radial: { count: 4, radius: 15 } },
      { kind: 'lathe', height: 3, profile: [{ t: 0, radius: 18 }, { t: 1, radius: 18 }], on: 'legs' },
    ] });
    const { stats } = planWorkbench({ kind: 'workbench', ...lowered });
    expect(stats.monomers).toBe(5);          // 4 legs + seat lowered to flat monomers
    expect(stats.faces).toBeGreaterThan(0);  // real geometry baked
    expect(stats.parts).toHaveLength(5);
    expect(stats.warnings).toBeUndefined();  // seated on the grid
    expect(stats.size.h).toBeCloseTo(43, 0); // 40 legs + 3 seat
  });

  it('seated-on-the-grid object emits no warning', () => {
    const { stats } = planWorkbench({ kind: 'workbench', lathes: [lathe()] });
    expect(stats.warnings).toBeUndefined();
  });

  it('warns when the object floats above the measured grid', () => {
    const { stats } = planWorkbench({ kind: 'workbench', lathes: [lathe({ axisFrom: { x: 0, y: 0, z: 5 }, axisTo: { x: 0, y: 0, z: 7 } })] });
    expect(stats.warnings).toBeDefined();
    expect(stats.warnings[0]).toMatch(/floats/);
  });

  it('counts and reads out drapes like any other monomer', () => {
    const drape = { anchor: [[-4, 0, 10], [4, 0, 10]], hang: 8 };
    const { stats } = planWorkbench({ kind: 'workbench', lathes: [lathe()], drapes: [drape] });
    expect(stats.monomers).toBe(2);
    expect(stats.drapes).toBe(1);
    const drapePart = stats.parts.find((p) => p.kind === 'drape');
    expect(drapePart).toBeDefined();
    expect(drapePart.size.w).toBeGreaterThan(0);
    expect(drapePart.open).toBeUndefined(); // a sheet is open by intent — no closure warning
  });

  it('passes caps:false through to lathe face lowering', () => {
    const capped = lowerObjectFaces({ kind: 'workbench', lathes: [lathe({ crossSections: 4, samples: 8 })] });
    const open = lowerObjectFaces({ kind: 'workbench', lathes: [lathe({ crossSections: 4, samples: 8, caps: false })] });
    expect(open.length).toBeLessThan(capped.length);
    expect(() => planWorkbench({ kind: 'workbench', lathes: [lathe({ caps: false })] })).not.toThrow();
  });

  it('rejects a drape material typo loudly instead of silently falling back', () => {
    const drape = { anchor: [[-4, 0, 10], [4, 0, 10]], material: 'golden' };
    expect(() => planWorkbench({ kind: 'workbench', drapes: [drape] })).toThrow(/drapes\[0\]\.material/);
  });
});

describe('planWorkbench — shell monomers', () => {
  const dome = (extra = {}) => ({ solid: 'icosahedron', radius: 5, center: { x: 0, y: 0, z: 5 }, ...extra });

  it('a shell alone is a valid workbench and is counted in the stats', () => {
    const { stats } = planWorkbench({ kind: 'workbench', shells: [dome()] });
    expect(stats.monomers).toBe(1);
    expect(stats.shells).toBe(1);
    expect(stats.faces).toBe(20);
    expect(stats.parts[0].kind).toBe('shell');
  });

  it('measures the shell at literal scale — `radius` is the CIRCUMradius, not half the bbox', () => {
    // An icosahedron's vertices reach the circumsphere but its faces do not: the widest extent is
    // 2·(phi/sqrt(1+phi^2))·r = 1.701·r, not 2·r. So `center.z = radius` does NOT seat one on the
    // grid, and the existing float lint says so — which is exactly the advisory it is there for.
    const { stats } = planWorkbench({ kind: 'workbench', shells: [dome()] });
    expect(stats.size.w).toBeCloseTo(8.5, 1);
    expect(stats.size.h).toBeCloseTo(8.5, 1);
    expect(stats.parts[0].base).toBe(0.7);      // 5 - 4.2533, at the readout's 1-decimal rounding
    expect(stats.warnings.some((w) => /floats/.test(w))).toBe(true);
  });

  it('a sphere-like shell seated by its own bbox draws no grid warning', () => {
    const { stats } = planWorkbench({ kind: 'workbench', shells: [dome({ center: { x: 0, y: 0, z: 5 * 0.85065 } })] });
    expect(stats.parts[0].base).toBeCloseTo(0, 1);
    expect(stats.warnings).toBeUndefined();
  });

  it('composes with the other monomer kinds in one object', () => {
    const { stats } = planWorkbench({ kind: 'workbench', lathes: [lathe()], shells: [dome({ radius: 1, center: { x: 0, y: 0, z: 3 } })] });
    expect(stats.monomers).toBe(2);
    expect(stats.parts.map((p) => p.kind)).toEqual(['lathe', 'shell']);
  });

  it('an `open` cutaway is intentional, so it is not flagged as a dropped cap', () => {
    const { stats } = planWorkbench({ kind: 'workbench', shells: [dome({ open: { ring: 'bottom', band: 0.4 } })] });
    expect(stats.faces).toBeLessThan(20);
    expect((stats.warnings || []).some((w) => /open shell/.test(w))).toBe(false);
  });

  it('rejects a bad shell spec at mint with a teaching error', () => {
    expect(() => planWorkbench({ kind: 'workbench', shells: [{ solid: 'soccerball', radius: 1 }] })).toThrow(/shells\[0\]\.solid/);
    expect(() => planWorkbench({ kind: 'workbench', shells: [{ solid: 'cube' }] })).toThrow(/shells\[0\]\.radius/);
  });

  it('rejects a shell material typo loudly instead of silently falling back', () => {
    expect(() => planWorkbench({ kind: 'workbench', shells: [dome({ material: 'golden' })] })).toThrow(/shells\[0\]\.material/);
  });

  it('faceIds are unique across several shells in one manifest', () => {
    const faces = lowerObjectFaces({ shells: [dome({ solid: 'cube' }), dome({ solid: 'cube', center: { x: 20, y: 0, z: 5 } })] }, undefined);
    expect(faces).toHaveLength(12);
    expect(new Set(faces.map((f) => f.faceId)).size).toBe(12);
  });
});

describe('planWorkbench — the shells vocab-card worked example', () => {
  // Kept honest on purpose: solid-vocab/workbench.md ships this recipe, so it must mint.
  const CARD_EXAMPLE = {
    kind: 'workbench',
    shells: [{
      solid: 'truncated_icosahedron',
      radius: 12,
      center: { x: 0, y: 0, z: 12 },
      tint: '#e8e6e0',
      material: 'plaster',
      ops: [
        { op: 'inset', select: { sides: 6 }, ratio: 0.2 },
        { op: 'extrude', select: { group: 'inset' }, by: 0.8, material: 'steel' },
        { op: 'recolor', select: { sides: 5, every: 3 }, tint: '#39c2d7', material: 'glass' },
        { op: 'port', select: { group: 'panel', near: [0, 0, 1], count: 1 }, radius: 1.2, depth: 1.6, material: 'gunmetal' },
      ],
    }],
    units: 'cm',
  };

  it('mints without throwing', () => {
    expect(() => planWorkbench(CARD_EXAMPLE)).not.toThrow();
  });

  it('produces the object the card describes', () => {
    const faces = lowerObjectFaces(CARD_EXAMPLE, undefined);
    const of = (g) => faces.filter((f) => f.group === g).length;
    expect(of('panel')).toBe(20);            // one raised panel per hexagon
    expect(of('rim')).toBe(20 * 6);
    expect(of('wall')).toBe(20 * 6);
    expect(faces.filter((f) => f.tint === '#39c2d7')).toHaveLength(4);
    expect(of('port')).toBeGreaterThan(0);
  });
});

describe('planWorkbench — loft monomers (field-solids F1)', () => {
  const hull = {
    path: [[0, 0, 0], [12, 0, 0]],
    stations: [
      { t: 0, profile: [[0, 0.2], [0.05, 0.05], [0, 0], [-0.05, 0.05]] },
      { t: 0.5, profile: [[1.8, 1.7], [1.5, 0.1], [-1.5, 0.1], [-1.8, 1.7]] },
      { t: 1, profile: [[1.2, 1.5], [1.1, 0.4], [-1.1, 0.4], [-1.2, 1.5]] },
    ],
  };
  it('a loft alone is a valid workbench, counted and read out like any monomer, closed', () => {
    const { stats } = planWorkbench({ lofts: [hull], units: 'm' });
    expect(stats.monomers).toBe(1);
    expect(stats.lofts).toBe(1);
    expect(stats.parts).toHaveLength(1);
    expect(stats.parts[0].kind).toBe('loft');
    expect(stats.parts[0].size.w).toBe(12);
    expect(stats.parts[0].open).toBeUndefined();
    expect(stats.warnings).toBeUndefined();
  });
  it('a manifest with no `lofts` key reports no lofts stat (pre-F1 shape preserved)', () => {
    const { stats } = planWorkbench({ lathes: [lathe()] });
    expect('lofts' in stats).toBe(false);
  });
  it('rejects a station point-count mismatch at mint, naming the station', () => {
    const bad = { ...hull, stations: [hull.stations[0], { t: 0.5, profile: [[0, 0], [1, 0], [1, 1]] }, hull.stations[2]] };
    expect(() => planWorkbench({ lofts: [bad] })).toThrow(/stations\[1\]\.profile has 3 points but stations\[0\] has 4/);
  });
  it('rejects a loft material typo loudly', () => {
    expect(() => planWorkbench({ lofts: [{ ...hull, material: 'brasss' }] })).toThrow(/lofts\[0\]\.material/);
  });
  it('an assembled loft part stacks straight up the z axis and bakes end-to-end', () => {
    const lowered = lowerAssembly({ parts: [
      { kind: 'lathe', height: 1, id: 'foot', profile: [{ t: 0, radius: 3 }, { t: 1, radius: 2 }] },
      { kind: 'loft', height: 6, on: 'foot', stations: [{ t: 0, profile: { radius: 2, sides: 12 } }, { t: 1, profile: [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [-1, 1]] }] },
    ] });
    expect(lowered.lofts).toHaveLength(1);
    expect(lowered.lofts[0].axisFrom).toEqual({ x: 0, y: 0, z: 1 });
    expect(lowered.lofts[0].axisTo).toEqual({ x: 0, y: 0, z: 7 });
    const { stats } = planWorkbench({ lathes: lowered.lathes, lofts: lowered.lofts });
    const loft = stats.parts.find((p) => p.kind === 'loft');
    expect(loft.base).toBe(1);
    expect(loft.top).toBe(7);
    expect(lowerObjectFaces({ lofts: lowered.lofts }).length).toBeGreaterThan(12);
  });
});

describe('planWorkbench — field monomers (field-solids F3)', () => {
  const flange = {
    cells: 32,
    terms: [
      { id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, 1], profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }] } },
      { id: 'bore', op: 'subtract', shape: { kind: 'sweep', path: [[0, 0, -1], [0, 0, 2]], radius: 1 } },
    ],
  };
  it('a field alone is a valid workbench, counted, read out at its size, closed, seated on the grid', () => {
    const { stats } = planWorkbench({ fields: [flange] });
    expect(stats.monomers).toBe(1);
    expect(stats.fields).toBe(1);
    expect(stats.parts[0].kind).toBe('field');
    expect(stats.parts[0].size.w).toBeGreaterThan(5.6);
    expect(stats.parts[0].size.w).toBeLessThanOrEqual(6.1);
    expect(stats.parts[0].open).toBeUndefined();
    expect(stats.warnings).toBeUndefined();
  });
  it('a manifest with no `fields` key reports no fields stat (pre-F3 shape preserved)', () => {
    expect('fields' in planWorkbench({ lathes: [lathe()] }).stats).toBe(false);
  });
  it('field faces carry `group` tags into the lowered face list', () => {
    const faces = lowerObjectFaces({ fields: [flange] });
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['disc', 'bore']));
  });
  it('rejects a bad term list at mint with the path, and a material typo loudly', () => {
    expect(() => planWorkbench({ fields: [{ terms: [{ op: 'subtract', shape: flange.terms[1].shape }] }] })).toThrow(/fields\[0\]\.terms\[0\]\.op: the first term must be 'add'/);
    expect(() => planWorkbench({ fields: [{ ...flange, cells: 2 }] })).toThrow(/fields\[0\]\.cells/);
    expect(() => planWorkbench({ fields: [{ ...flange, material: 'steeel' }] })).toThrow(/fields\[0\]\.material/);
  });
  it('an assembled field part stacks by translation and bakes end-to-end', () => {
    const lowered = lowerAssembly({ parts: [
      { kind: 'lathe', height: 2, id: 'foot', profile: [{ t: 0, radius: 4 }, { t: 1, radius: 4 }] },
      { kind: 'field', height: 1, on: 'foot', cells: 24, terms: flange.terms },
    ] });
    expect(lowered.fields).toEqual([{ cells: 24, terms: flange.terms, translate: [0, 0, 2] }]);
    const { stats } = planWorkbench({ lathes: lowered.lathes, fields: lowered.fields });
    const field = stats.parts.find((p) => p.kind === 'field');
    expect(field.base).toBeCloseTo(2, 0);
    expect(field.top).toBeCloseTo(3, 0);
  });
});

describe('planWorkbench — cuts between named monomers (parts-booleans B1)', () => {
  const flange = { id: 'flange', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 }, profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }], tint: '#a0a0a0' };
  const bore = { id: 'bore', path: [[0, 0, -1], [0, 0, 2]], radius: 1 };
  it('a lathe + a sweep under `cuts` read out as ONE closed field part, with the cut named and its rounding warned', () => {
    const { stats } = planWorkbench({ lathes: [flange], sweeps: [bore], cuts: [{ from: 'flange', subtract: ['bore'], cells: 32 }] });
    expect(stats.monomers).toBe(1);
    expect(stats.lathes).toBe(0);
    expect(stats.sweeps).toBe(0);
    expect(stats.fields).toBe(1);
    expect(stats.parts).toHaveLength(1);
    expect(stats.parts[0]).toMatchObject({ kind: 'field', index: 0, cut: 'cut:flange', from: 'flange' });
    expect(stats.parts[0].open).toBeUndefined();
    expect(stats.cuts).toEqual([{ id: 'cut:flange', from: 'flange', subtract: ['bore'], cells: 32, edge_round: expect.any(Number) }]);
    expect(stats.warnings).toHaveLength(1);
    expect(stats.warnings[0]).toMatch(/^cut 'cut:flange' \(flange subtract bore\) rounds every edge to about 0\.188 cm \(32 cells\)/);
    const faces = lowerObjectFaces({ lathes: [flange], sweeps: [bore], cuts: [{ from: 'flange', subtract: ['bore'], cells: 32 }] });
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['flange', 'bore']));
    // the hole is real: no face centre sits inside the bore's radius near the disc's mid-height
    const inside = faces.filter((f) => { const c = f.corners; const x = c.reduce((s, p) => s + p[0], 0) / 4; const y = c.reduce((s, p) => s + p[1], 0) / 4; const z = c.reduce((s, p) => s + p[2], 0) / 4; return Math.hypot(x, y) < 0.8 && z > 0.3 && z < 0.7; });
    expect(inside).toHaveLength(0);
  });
  it('absent `cuts` the faces are byte-identical, and an empty list is the same as none (the promise)', () => {
    const plain = { lathes: [flange], sweeps: [bore] };
    expect(JSON.stringify(lowerObjectFaces({ ...plain, cuts: [] }))).toBe(JSON.stringify(lowerObjectFaces(plain)));
    const { stats } = planWorkbench(plain);
    expect('cuts' in stats).toBe(false);
    expect(stats.monomers).toBe(2);
    // the uncut bore runs below the grid — the ordinary seat warning, and no cut warning
    expect(stats.warnings).toEqual([expect.stringMatching(/^Object sinks 1 cm below the grid/)]);
  });
  it('a bad monomer is reported as ITSELF, and a bad cut by its id, in the same 400', () => {
    expect(() => planWorkbench({ lathes: [{ ...flange, material: 'steeel' }], sweeps: [bore], cuts: [{ from: 'flange', subtract: ['bore'] }] })).toThrow(/lathes\[0\]\.material/);
    expect(() => planWorkbench({ lathes: [flange], sweeps: [bore], cuts: [{ from: 'flange', subtract: ['nope'] }] })).toThrow(/Invalid monomers:\n- cuts\[0\]\.subtract 'nope': no monomer carries that `id` \(known: flange, bore\)/);
    expect(() => planWorkbench({ lathes: [flange], sweeps: [bore], cuts: [{ from: 'flange', subtract: ['bore'] }, { from: 'flange', subtract: ['bore'] }] })).toThrow(/cuts\[1\]/);
    expect(() => planWorkbench({ lathes: [flange], cuts: 'x' })).toThrow(/cuts: must be an array/);
  });
  it('collectWrapSources lowers the same way, so wrap keys by index agree with the faces', () => {
    const can = { axisFrom: { x: 10, y: 0, z: 0 }, axisTo: { x: 10, y: 0, z: 4 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], wrap: { source: { svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' } } };
    const m = { lathes: [flange, can], sweeps: [bore], cuts: [{ from: 'flange', subtract: ['bore'], cells: 16 }] };
    const src = collectWrapSources(m);
    expect(src).toHaveLength(1);
    expect(src[0].key).toBe('wrap_0');   // the can is lathes[0] once the flange has left the array
    const wrapped = lowerObjectFaces(m).filter((f) => f.texture);
    expect(wrapped.length).toBeGreaterThan(0);
    expect(new Set(wrapped.map((f) => f.texture))).toEqual(new Set(['wrap_0']));
  });
});

describe('opacity — opt-in translucency per monomer', () => {
  const box = (extra = {}) => ({ profile: { rect: { w: 2, h: 1 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 3 }, ...extra });
  it('stamps a face-level `alpha` on every face of a monomer with 0 < opacity < 1 (the World + glTF legs read it per group)', () => {
    const faces = lowerObjectFaces({ extrudes: [box({ opacity: 0.3, group: 'pane' })], lathes: [lathe({ opacity: 0.5 })] });
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.filter((f) => f.group === 'pane').every((f) => f.alpha === 0.3)).toBe(true);
    expect(faces.filter((f) => f.group !== 'pane').every((f) => f.alpha === 0.5)).toBe(true);
  });
  it('absent, 1, 0 or out-of-range opacity leaves the faces byte-identical (no `alpha` key)', () => {
    const plain = lowerObjectFaces({ extrudes: [box()] });
    for (const opacity of [undefined, 1, 0, 1.5, -0.2, 'glass']) {
      expect(lowerObjectFaces({ extrudes: [box({ opacity })] })).toEqual(plain);
    }
    expect(plain.some((f) => 'alpha' in f)).toBe(false);
  });
  it('the material shelf\'s glass row does NOT imply translucency — minted glass stays opaque', () => {
    expect(lowerObjectFaces({ extrudes: [box({ material: 'glass' })] }).some((f) => 'alpha' in f)).toBe(false);
  });
});
