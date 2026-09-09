// parts-booleans.plan.md B1 — `cuts[]`: a boolean between NAMED monomers, lowered to one
// `fields` entry. The kernel promise: absent cuts the manifest passes through by identity.

import { describe, expect, it } from 'vitest';

import { lowerCuts, validateCuts, hasCuts, CUTTABLE_KINDS } from './workbench-cuts.js';
import { composeFieldTerms } from './field-terms.js';

const flange = { id: 'flange', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1.2 }, profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }], tint: '#8899aa', material: 'steel' };
const bore = (id, x, y, r = 0.45) => ({ id, path: [[x, y, -1], [x, y, 3]], radius: r });
const BORED = {
  kind: 'workbench', units: 'cm',
  lathes: [flange, { id: 'knob', axisFrom: { x: 20, y: 0, z: 0 }, axisTo: { x: 20, y: 0, z: 2 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] }],
  sweeps: [bore('bore', 0, 0, 1.2), bore('b1', 4.5, 0), bore('b2', -4.5, 0), { path: [[30, 0, 0], [30, 0, 5]], radius: 0.3 }],
  cuts: [{ id: 'bolts', from: 'flange', subtract: ['bore', 'b1', 'b2'], cells: 48 }],
};

describe('lowerCuts — the rewrite', () => {
  it('absent cuts the manifest passes through BY IDENTITY (the byte-identity promise)', () => {
    const plain = { lathes: [flange] };
    expect(lowerCuts(plain)).toBe(plain);
    expect(lowerCuts({ ...plain, cuts: [] })).toEqual({ ...plain, cuts: [] });
    expect(hasCuts(plain)).toBe(false);
    expect(hasCuts({ cuts: [] })).toBe(false);
    expect(validateCuts(plain)).toEqual([]);
    expect(validateCuts({ ...plain, cuts: [] })).toEqual([]);
    expect(validateCuts({ ...plain, cuts: 'x' })).toEqual(['cuts: must be an array of { from, subtract | intersect: [ids] }']);
  });

  it('a lathe flange + three sweep bores → ONE field, the named monomers gone, the rest untouched', () => {
    const out = lowerCuts(BORED);
    expect(out.cuts).toBeUndefined();
    expect(out.lathes.map((l) => l.id)).toEqual(['knob']);
    expect(out.sweeps).toHaveLength(1);              // the unnamed sweep stays
    expect(out.sweeps[0].id).toBeUndefined();
    expect(out.fields).toHaveLength(1);
    const f = out.fields[0];
    expect(f.id).toBe('bolts');
    expect(f.cells).toBe(48);
    expect(f.tint).toBe('#8899aa');                  // the body's look rides the cut part
    expect(f.material).toBe('steel');
    expect(f.terms.map((t) => [t.id, t.op, t.shape.kind])).toEqual([
      ['flange', 'add', 'lathe'], ['bore', 'subtract', 'sweep'], ['b1', 'subtract', 'sweep'], ['b2', 'subtract', 'sweep'],
    ]);
    expect(f.terms[0].shape.profile).toBe(flange.profile);
    expect(f.cut).toEqual({ id: 'bolts', from: 'flange', subtract: ['bore', 'b1', 'b2'], cells: 48 });
    // the emitted term list is a valid field: it composes, and the field is negative inside the disc, positive in the bore
    const term = composeFieldTerms(f.terms);
    expect(term.d({ x: 3, y: 0, z: 0.6 })).toBeLessThan(0);
    expect(term.d({ x: 0, y: 0, z: 0.6 })).toBeGreaterThan(0);
    expect(term.d({ x: 4.5, y: 0, z: 0.6 })).toBeGreaterThan(0);
    // lowering the LOWERED manifest is the identity — the seam is idempotent
    expect(lowerCuts(out)).toBe(out);
    // the input was not mutated
    expect(BORED.lathes).toHaveLength(2);
    expect(BORED.cuts).toHaveLength(1);
  });

  it('defaults: id `cut:<from>`, cells 64; `blend` fillets the operands only; `intersect` is the other verb', () => {
    const out = lowerCuts({ lathes: [flange], sweeps: [bore('bore', 0, 0, 1.2)], cuts: [{ from: 'flange', subtract: ['bore'], blend: 0.3 }] });
    const f = out.fields[0];
    expect(f.id).toBe('cut:flange');
    expect(f.cells).toBe(64);
    expect(f.terms[0].blend).toBeUndefined();
    expect(f.terms[1].blend).toBe(0.3);
    expect(f.cut.blend).toBe(0.3);
    const box = { id: 'env', profile: { rect: { w: 4, h: 4 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 } };
    const i = lowerCuts({ lathes: [flange], extrudes: [box], cuts: [{ from: 'flange', intersect: ['env'] }] });
    expect(i.fields[0].terms[1]).toMatchObject({ id: 'env', op: 'intersect', shape: { kind: 'extrude', profile: box.profile } });
    expect(i.extrudes).toBeUndefined();
    expect(i.fields[0].cut.intersect).toEqual(['env']);
  });

  it('a field monomer nests as a `transform` sub-solid (its translate, else the identity), inner groups kept', () => {
    const pocket = { id: 'pocket', translate: [1, 0, 0], terms: [{ id: 'sock', op: 'add', shape: { kind: 'sphere', center: [0, 0, 1.2], radius: 1 } }] };
    const out = lowerCuts({ lathes: [flange], fields: [pocket], cuts: [{ from: 'flange', subtract: ['pocket'] }] });
    expect(out.fields).toHaveLength(1);
    expect(out.fields[0].terms[1]).toEqual({ op: 'transform', translate: [1, 0, 0], terms: pocket.terms, combine: 'subtract' });
    const asBody = lowerCuts({ fields: [{ id: 'blob', terms: pocket.terms }], sweeps: [bore('bore', 0, 0, 0.3)], cuts: [{ from: 'blob', subtract: ['bore'] }] });
    expect(asBody.fields[0].terms[0]).toEqual({ op: 'transform', translate: [0, 0, 0], terms: pocket.terms });
    expect(composeFieldTerms(asBody.fields[0].terms).parts.map((p) => p.id)).toEqual(['sock', 'bore']);
  });

  it('a cut of a cut: the emitted field is addressable by the cut id and consumed in turn', () => {
    const out = lowerCuts({
      lathes: [flange], sweeps: [bore('bore', 0, 0, 1.2), bore('side', 6, 0, 0.5)],
      cuts: [{ id: 'bored', from: 'flange', subtract: ['bore'] }, { id: 'notched', from: 'bored', subtract: ['side'] }],
    });
    expect(out.fields).toHaveLength(1);
    expect(out.fields[0].id).toBe('notched');
    expect(out.fields[0].terms[0].op).toBe('transform');   // the earlier cut nests as a field
    expect(out.fields[0].terms[0].terms.map((t) => t.id)).toEqual(['flange', 'bore']);
    expect(out.fields[0].terms[1]).toMatchObject({ id: 'side', op: 'subtract' });
    expect(out.sweeps).toBeUndefined();
    expect(out.lathes).toBeUndefined();
  });

  it('refuses, naming the id: unknown, duplicate, reused, self, no field twin, shelled / tapered / wrapped, bad verbs and dials', () => {
    const base = { lathes: [flange], sweeps: [bore('bore', 0, 0, 1.2)] };
    const bad = (cuts, extra = {}) => validateCuts({ ...base, ...extra, cuts })[0];
    expect(bad([{ from: 'flange', subtract: ['nope'] }])).toMatch(/cuts\[0\]\.subtract 'nope': no monomer carries that `id` \(known: flange, bore\)/);
    expect(bad([{ id: 'a', from: 'flange', subtract: ['bore'] }, { id: 'b', from: 'flange', subtract: ['bore'] }])).toMatch(/cuts\[1\]\.from 'flange': already consumed/);
    expect(bad([{ from: 'flange', subtract: ['bore'] }, { from: 'flange', subtract: ['bore'] }])).toMatch(/cuts\[1\]\.id 'cut:flange': already names a monomer/);
    expect(bad([{ from: 'flange', subtract: ['flange'] }])).toMatch(/an operand cannot be its own body/);
    expect(bad([{ from: 'flange', subtract: ['bore', 'bore'] }])).toMatch(/'bore': listed twice/);
    expect(bad([{ from: 'flange', subtract: ['bore'], intersect: ['bore'] }])).toMatch(/exactly one of `subtract` \/ `intersect`/);
    expect(bad([{ from: 'flange' }])).toMatch(/exactly one of/);
    expect(bad([{ from: 'flange', subtract: [] }])).toMatch(/non-empty array of monomer ids/);
    expect(bad([{ subtract: ['bore'] }])).toMatch(/cuts\[0\]\.from: must name a monomer/);
    expect(bad([{ from: 'flange', subtract: ['bore'], cells: 4 }])).toMatch(/cuts\[0\]\.cells: must be an integer in \[16, 128\]/);
    expect(bad([{ from: 'flange', subtract: ['bore'], blend: -1 }])).toMatch(/cuts\[0\]\.blend/);
    expect(bad([{ from: 'flange', subtract: ['bore'], id: 'bore' }])).toMatch(/cuts\[0\]\.id 'bore': already names a monomer/);
    expect(bad([{ from: 'flange', subtract: ['bore'] }], { lathes: [flange, { ...flange }] })).toMatch(/monomer id 'flange' is used twice \(lathes\[0\] and lathes\[1\]\)/);
    // no field twin
    expect(bad([{ from: 'flange', subtract: ['lid'] }], { shells: [{ id: 'lid', solid: 'cube', radius: 2 }] })).toMatch(/'lid': a shell has no field twin/);
    expect(bad([{ from: 'hull', subtract: ['bore'] }], { lofts: [{ id: 'hull' }] })).toMatch(/'hull': a loft has no field twin/);
    expect(bad([{ from: 'tray', subtract: ['bore'] }], { extrudes: [{ id: 'tray', profile: { rect: { w: 4, h: 4 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 }, wallThickness: 0.3 }] })).toMatch(/a shelled extrude/);
    expect(bad([{ from: 'fin', subtract: ['bore'] }], { extrudes: [{ id: 'fin', profile: { points: [[0, 0], [1, 0], [0, 1]] }, endProfile: { points: [[0, 0], [1, 0], [0, 1]] }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 } }] })).toMatch(/a tapered extrude/);
    expect(bad([{ from: 'can', subtract: ['bore'] }], { lathes: [flange, { ...flange, id: 'can', wrap: { source: { svg: '<svg/>' } } }] })).toMatch(/'can': a wrapped monomer cannot be cut/);
    expect(CUTTABLE_KINDS).toEqual(['lathe', 'extrude', 'sweep', 'field']);
  });
});
