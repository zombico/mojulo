/**
 * workbench-program — the code kind end to end (expressiveness.plan.md E3). Claims: a
 * program returning a SPEC lowers through the workbench kernel (closure audit, groups,
 * ledger inherited) and re-renders byte-identical; a program returning FACES passes the
 * face-list shape check and the closure audit reports; `params` are the dials (a change
 * re-runs); a throwing program fails the mint with its log; absent `program` the manifest
 * passes through untouched (byte-for-byte); the export ledger carries the source hash and
 * realm version; the expansion is memoised; toolkit v2 reaches the program as ctx.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

let tmp, expandWorkbenchProgram, _resetWorkbenchProgramCache, lowerObjectFaces, planWorkbench, WORKBENCH_LIGHT,
  auditClosure, mintSolidHandler, SketchRepository, exportModelHandler, buildBookToolkit;

const FLANGE_SRC = `
  const bores = Array.from({ length: params.n }, (_, i) => {
    const a = (i / params.n) * Math.PI * 2;
    const cx = params.pcd * Math.cos(a), cy = params.pcd * Math.sin(a);
    return { id: 'bore', op: 'subtract', shape: { kind: 'capsule', a: [cx, cy, -1], b: [cx, cy, params.t + 1], radius: params.hole } };
  });
  console.log('bores', bores.length);
  return { fields: [{ cells: 40, terms: [
    { id: 'disc', op: 'add', shape: { kind: 'lathe', profile: [{ t: 0, radius: params.r }, { t: 1, radius: params.r }], axisFrom: [0, 0, 0], axisTo: [0, 0, params.t] } },
    ...bores,
  ] }] };
`;
const flange = (params = { n: 4, r: 6, pcd: 4.5, hole: 0.5, t: 1.2 }) => ({ kind: 'workbench', units: 'cm', program: { source: FLANGE_SRC, params, seed: 1 } });

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'mojulo-code-kind-'));
  process.env.SQLITE_PATH = join(tmp, 'test.db');
  process.env.MOJULO_OUTCOMES_DIR = join(tmp, 'outcomes');
  ({ expandWorkbenchProgram, _resetWorkbenchProgramCache } = await import('./workbench-program.js'));
  ({ lowerObjectFaces, planWorkbench, WORKBENCH_LIGHT } = await import('./workbench.js'));
  ({ auditClosure } = await import('../polygonizer/face-closure.js'));
  ({ buildBookToolkit } = await import('../views/recipe-book/toolkit.js'));
  ({ mintSolidHandler } = await import('@/lib/mcp/tools/mint-solid'));
  ({ SketchRepository } = await import('@/lib/db/repositories/sketches'));
  ({ exportModelHandler } = await import('@/lib/mcp/tools/sketch-model-export'));
});
afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });
beforeEach(() => _resetWorkbenchProgramCache());

describe('expansion', () => {
  it('absent `program`, the manifest passes through untouched — the same object', () => {
    const m = { kind: 'workbench', lathes: [{ axisFrom: [0, 0, 0], axisTo: [0, 0, 1], profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] }] };
    const ex = expandWorkbenchProgram(m);
    expect(ex.manifest).toBe(m);
    expect(ex.faces).toEqual([]);
    expect(ex.program).toBe(null);
  });
  it('a spec return expands to monomers (program removed, explicit arrays merged AFTER), with the report and the log', () => {
    const m = { ...flange(), lathes: [{ axisFrom: [0, 0, 1.2], axisTo: [0, 0, 3], profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] }] };
    const ex = expandWorkbenchProgram(m);
    expect(ex.manifest.program).toBeUndefined();
    expect(ex.manifest.fields).toHaveLength(1);
    expect(ex.manifest.fields[0].terms).toHaveLength(5);
    expect(ex.manifest.lathes).toHaveLength(1);
    expect(ex.program).toMatchObject({ returned: 'spec', monomers: 1, realm_version: 1, budget_ms: 5000, log: ['bores 4'] });
    expect(ex.program.source_hash).toMatch(/^[0-9a-f]{16}$/);
  });
  it('the flange lowers through the kernel: closed, genus = bolts + bore (each bolt is a torus handle), groups inherited, byte-identical', () => {
    const faces = lowerObjectFaces(flange(), WORKBENCH_LIGHT);
    expect(auditClosure(faces).closed).toBe(true);
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['disc', 'bore']));
    expect(JSON.stringify(lowerObjectFaces(flange(), WORKBENCH_LIGHT))).toBe(JSON.stringify(faces));
  });
  it('params are the dials: n=6 makes six bores; the expansion is memoised per (source, params, seed)', () => {
    const six = expandWorkbenchProgram(flange({ n: 6, r: 6, pcd: 4.5, hole: 0.5, t: 1.2 }));
    expect(six.manifest.fields[0].terms).toHaveLength(7);
    const again = expandWorkbenchProgram(flange({ n: 6, r: 6, pcd: 4.5, hole: 0.5, t: 1.2 }));
    expect(again.program).toBe(six.program);   // the same run report object — cached, the realm did not run again
  });
  it('a face-list return is shaded, tagged, and audited; a bad face teaches', () => {
    const src = `
      const s = 1;
      const v = [[-s,-s,0],[s,-s,0],[s,s,0],[-s,s,0],[-s,-s,2],[s,-s,2],[s,s,2],[-s,s,2]];
      const q = (a,b,c,d) => ({ corners: [v[a],v[b],v[c],v[d]], group: 'cube' });
      return [q(0,3,2,1), q(4,5,6,7), q(0,1,5,4), q(1,2,6,5), q(2,3,7,6), q(3,0,4,7)];`;
    const ex = expandWorkbenchProgram({ kind: 'workbench', program: { source: src } });
    expect(ex.program).toMatchObject({ returned: 'faces', faces: 6 });
    expect(ex.faces).toHaveLength(6);
    expect(ex.faces.every((f) => f.group === 'cube' && /^#[0-9a-f]{6}$/i.test(f.fill) && f.doubleSided)).toBe(true);
    expect(auditClosure(ex.faces).closed).toBe(true);
    expect(() => expandWorkbenchProgram({ kind: 'workbench', program: { source: 'return [{ corners: [[0,0,0]] }];' } })).toThrow(/face\[0\]: a returned face is/);
  });
  it('a throwing program fails with its message AND its log; an empty / wrong return teaches', () => {
    expect(() => expandWorkbenchProgram({ kind: 'workbench', program: { source: "console.log('sizing'); throw new Error('no such bolt');" } }))
      .toThrow(/code program failed — the program threw: no such bolt[\s\S]*program log:\n {2}sizing/);
    expect(() => expandWorkbenchProgram({ kind: 'workbench', program: { source: 'return { foo: 1 };' } })).toThrow(/no monomer arrays \(keys: foo\)/);
    expect(() => expandWorkbenchProgram({ kind: 'workbench', program: { source: 'return 42;' } })).toThrow(/returned number/);
    expect(() => expandWorkbenchProgram({ kind: 'workbench', program: { source: 'return [];' } })).toThrow(/empty face list/);
    expect(() => expandWorkbenchProgram({ kind: 'workbench', program: { source: 'while (true) {}', budgetMs: 80 } })).toThrow(/budgetMs 80/);
  });
  it('a program may return an assembly; the kernel lowers it', () => {
    const src = "return { assembly: { parts: [{ kind: 'lathe', height: 1, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] }, { kind: 'lathe', height: 3, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] }] } };";
    const ex = expandWorkbenchProgram({ kind: 'workbench', program: { source: src } });
    expect(ex.program.returned).toBe('spec');
    expect(ex.manifest.lathes.length).toBe(2);
  });
});

describe('ctx — toolkit v2', () => {
  it('reaches the program as ctx: terms + surfaceNet let a program polygonize its own field into faces', () => {
    const tk = buildBookToolkit();
    expect(tk.version).toBe(2);
    expect(Object.isFrozen(tk.solids)).toBe(true);
    const src = `
      const { terms, surfaceNet, compose } = ctx.solids;
      const s = terms.elongate(compose([{ op: 'add', shape: { kind: 'sphere', center: [0,0,0], radius: 1 } }]), { by: [1, 0, 0] });
      const quads = surfaceNet(s.d, ctx.solids.padBounds(s.bounds, 0.2), { cells: 24 });
      console.log('quads', quads.length, 'version', ctx.version);
      return quads.map((q) => ({ corners: q.corners.map((c) => [c.x, c.y, c.z]), group: 'pill' }));`;
    const ex = expandWorkbenchProgram({ kind: 'workbench', program: { source: src } });
    expect(ex.program.returned).toBe('faces');
    expect(ex.program.log[0]).toMatch(/^quads \d+ version 2$/);
    expect(auditClosure(ex.faces).closed).toBe(true);
  });
});

describe('through mint_solid, planWorkbench and the export ledger', () => {
  it("mint_solid kind 'code' stores kind:'workbench' + program, returns stats.program with the log; update via params", async () => {
    const res = await mintSolidHandler({ kind: 'code', title: 'flange', ref: 'code-flange', spec: { units: 'cm', source: FLANGE_SRC, params: { n: 4, r: 6, pcd: 4.5, hole: 0.5, t: 1.2 }, seed: 1 } });
    expect(res.ok).toBe(true);
    expect(res.stats.fields).toBe(1);
    expect(res.stats.program).toMatchObject({ returned: 'spec', monomers: 1, log: ['bores 4'] });
    const stored = SketchRepository.getByRef('code-flange').manifest;
    expect(stored.kind).toBe('workbench');
    expect(stored.program).toEqual({ source: FLANGE_SRC, params: { n: 4, r: 6, pcd: 4.5, hole: 0.5, t: 1.2 }, seed: 1 });
    expect(stored.fields).toBeUndefined();   // recipes not renders: no generated monomers stored
  });
  it('a failing program fails the mint with the log and the card pointer', async () => {
    await expect(mintSolidHandler({ kind: 'code', spec: { source: "console.log('x'); throw new Error('bad');" } }))
      .rejects.toThrow(/the program threw: bad[\s\S]*program log:\n {2}x[\s\S]*get_solid_vocab\(\{ id: 'code' \}\)/);
    await expect(mintSolidHandler({ kind: 'code', spec: {} })).rejects.toThrow(/needs `source`/);
  });
  it('planWorkbench readout: a face-list program is a `program` part with an advisory closure line', () => {
    const open = { kind: 'workbench', program: { source: 'return [{ corners: [[0,0,0],[1,0,0],[1,1,0]] }];' } };
    const { stats } = planWorkbench(open);
    expect(stats.parts.find((p) => p.kind === 'program')).toMatchObject({ faces: 1, open: { holes: 1 } });
    expect(stats.warnings.join('\n')).toMatch(/program faces form an open shell/);
  });
  it('the export ledger carries code: { source_hash, realm_version, budget_ms, returned, monomers } beside field_solids', async () => {
    const out = await exportModelHandler({ ref: 'code-flange', format: 'glb', write: false });
    expect(out.ok).toBe(true);
    expect(out.code).toMatchObject({ realm_version: 1, budget_ms: 5000, returned: 'spec', monomers: 1 });
    expect(out.code.source_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(out.field_solids).toMatchObject({ count: 1, cells: 40 });
  });

  it("the code card's three worked programs mint as written (the card cannot drift from the kernel)", async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname } = await import('node:path');
    const card = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../solid-vocab/code.md'), 'utf8');
    const blocks = [...card.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => /source:/.test(b));
    expect(blocks).toHaveLength(3);
    const specs = blocks.map((b) => {
      // the flange block is a mint_solid({ kind, title, spec }) call; the others are `spec: { … }` fragments
      const src = /^mint_solid\(/.test(b.trim()) ? b.trim().replace(/\)\s*$/, '') .replace(/^mint_solid\(/, 'return (') + ')' : `return ({ ${b} });`;
      const call = new Function(src)();   // eslint-disable-line no-new-func — test-only: evaluating the card's own JS literal
      return call.spec;
    });
    const refs = ['card-flange', 'card-staircase', 'card-train'];
    for (let i = 0; i < specs.length; i += 1) {
      const res = await mintSolidHandler({ kind: 'code', ref: refs[i], spec: specs[i] });
      expect(res.ok, refs[i]).toBe(true);
      expect(res.stats.program.returned, refs[i]).toBe('spec');
      expect(res.stats.ledger.closed, refs[i]).toBe(true);
    }
    expect((await mintSolidHandler({ kind: 'code', ref: 'card-train-2', spec: specs[2] })).stats.monomers).toBe(3 + 3 * 3 * 2);   // 3 cars + 18 wheels
  });
});

