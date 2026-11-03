// The construction shelf's laws on its machines: the chain holds together at every pose (each body's pivot on its
// parent's joint, each ram's ends on their pins and its length within its stroke, each link at its own length), each
// joint's range is its ram's (derived, never stated), a named pose stands in its ranges and its ground pose touches the
// ground, the machine is held to its envelope and its stability, and the words it takes and refuses. One machine per
// distinct procedure, chosen in code from the archetypes; here, the crawler excavator.
import { describe, it, expect } from 'vitest';
import { CON_ARCHETYPES, CON_ODM, assembleMachine, findConPart, machineCtx, posedJoints, resolveConPart, toolLow } from './index.js';
import { apply } from './con-common.js';
import { rangeOf, solveChain } from './con-chain.js';
import { ramParts } from './con-parts.js';

// (a machine whose tool closes a linkage on a ram: the excavator's bucket)
const ID = Object.keys(CON_ARCHETYPES).find((k) => Object.values(CON_ARCHETYPES[k].joints).some((j) => j.linkage));
const ctx = machineCtx(ID), arch = ctx.arch;
const near = (a, b, tol = 1e-6) => a.every((v, k) => Math.abs(v - b[k]) < tol);
const split = (ref) => ref.split('.');

describe('the chain holds together at every named pose', () => {
  for (const pose of Object.keys(arch.poses)) {
    it(pose, () => {
      const j = posedJoints(ID, pose), C = solveChain(arch, j, ctx);
      // each body's pivot on its parent's hardpoint
      for (const e of arch.layout.filter((x) => x.on)) {
        const [p, hp] = split(e.on);
        expect(near(apply(C.frames[e.id], [0, 0, 0]), apply(C.frames[p], ctx.hp(p, hp)), 1e-9), e.id).toBe(true);
      }
      // each ram's barrel from its base toward its eye, its rod from the eye back, its length within its stroke
      for (const s of C.struts) {
        const row = ctx.row(ctx.entry(s.id).sku);
        if (s.kind === 'barrel') { expect(s.length, s.item).toBeGreaterThanOrEqual(row.dims.closed - 1e-6); expect(s.length, s.item).toBeLessThanOrEqual(row.dims.closed + row.dims.stroke + 1e-6); }
        if (s.kind === 'link') expect(s.length, s.item).toBeCloseTo(row.dims.length, 6);
      }
      const pairs = C.struts.filter((s) => s.kind !== 'link');
      for (const b of pairs.filter((s) => s.kind === 'barrel')) {
        const rod = pairs.find((s) => s.item === `${b.item}.rod`);
        expect(near(apply(b.frame, [0, b.length, 0]), rod.frame.t, 1e-9), b.item).toBe(true);
      }
    });
  }
});

describe('a joint\'s range is its ram\'s', () => {
  it('at each end of a ram-driven joint, its ram is closed or at full stroke', () => {
    for (const [name, J] of Object.entries(arch.joints).filter(([, J]) => J.ram)) {
      const r = rangeOf(arch, name, ctx), row = ctx.row(ctx.entry(J.ram).sku);
      const L = (v) => solveChain(arch, { ...posedJoints(ID, 'rest'), [name]: v }, ctx).struts.find((s) => s.id === J.ram && s.kind === 'barrel').length;
      const ends = [L(r[0]), L(r[1])].sort((a, b) => a - b);
      expect(ends[0], name).toBeCloseTo(row.dims.closed, 2);
      expect(ends[1], name).toBeCloseTo(row.dims.closed + row.dims.stroke, 2);
    }
    // (a slew has no ram: it turns freely)
    expect(rangeOf(arch, 'slew', ctx)).toBe(null);
  });
  it('the rod stays in its barrel at full stroke and clear of its base closed', () => {
    for (const row of Object.values(CON_ODM).filter((r) => r.kind === 'con-ram')) {
      const P = ramParts(row.dims);
      expect(row.dims.closed + row.dims.stroke - P.rod).toBeLessThan(P.barrel);
      expect(row.dims.closed - P.rod).toBeGreaterThan(0);
    }
  });
});

describe('the poses', () => {
  it('a named pose stands within every range, the same each time', () => {
    for (const pose of Object.keys(arch.poses)) {
      const j = posedJoints(ID, pose);
      for (const [k, v] of Object.entries(j)) { const r = rangeOf(arch, k, ctx); if (r) { expect(v, `${pose}.${k}`).toBeGreaterThanOrEqual(r[0] - 0.01); expect(v, `${pose}.${k}`).toBeLessThanOrEqual(r[1] + 0.01); } }
      expect(posedJoints(ID, pose)).toEqual(j);
    }
  });
  it('a ground pose sets its tool down on the ground', () => {
    const ground = Object.keys(arch.poses).filter((p) => Object.values(arch.poses[p]).includes('ground'));
    expect(ground.length).toBeGreaterThan(0);
    for (const p of ground) expect(Math.abs(toolLow(arch, ctx, posedJoints(ID, p))), p).toBeLessThan(0.01);
  });
  it('clamps the operator\'s joint into its range and says so; names what it takes', () => {
    const { readout } = assembleMachine(ID, { pose: { boom: 170 } });
    expect(readout.clamped).toEqual(['boom']);
    expect(readout.joints.boom).toBe(rangeOf(arch, 'boom', ctx)[1]);
    expect(() => posedJoints(ID, 'wheelie')).toThrow(/is one of/);
    expect(() => posedJoints(ID, { wrist: 10 })).toThrow(/not one of its joints/);
  });
});

describe('the machine as built', () => {
  const { manifest, readout } = assembleMachine(ID);
  it('holds every law: its envelope, its arcs, its tail, its ground pressure, its rated lift, its clearance, its size', () => {
    expect(readout.laws.laws.filter((l) => !l.ok)).toEqual([]);
    expect(readout.laws.laws.map((l) => l.id)).toEqual(expect.arrayContaining(['reach', 'depth', 'dumpHeight', 'tail', 'groundPressure', 'lift', 'clearance', 'transport', 'mass']));
    expect(readout.audit.ok).toBe(true);
  });
  it('reaches farther along the ground than it digs down, and dumps lower than it cuts', () => {
    const E = readout.envelope;
    expect(E.reach).toBeGreaterThan(E.depth);
    expect(E.dumpHeight).toBeLessThan(E.cutHeight);
  });
  it('is the same machine each time, a pose moving its frames and never its parts', () => {
    expect(assembleMachine(ID).manifest).toEqual(manifest);
    const dug = assembleMachine(ID, { pose: 'dig' }).manifest;
    const src = (m, id) => m.items.find((it) => it.id === id).source;
    for (const it of manifest.items) expect(src(dug, it.id), it.id).toEqual(it.source);
    expect(dug.items.find((it) => it.id === 'stick').at).not.toEqual(manifest.items.find((it) => it.id === 'stick').at);
  });
  it('slews its upper and what it carries, never its undercarriage', () => {
    const turned = assembleMachine(ID, { pose: { ...posedJoints(ID, 'rest'), slew: 90 } }).manifest, at = (m, id) => m.items.find((it) => it.id === id);
    expect(at(turned, 'under')).toEqual(at(manifest, 'under'));
    expect(at(turned, 'house').rotate[2]).toBeCloseTo(90, 6);
  });
});

describe('the words', () => {
  it('finds a part by the words people say, and refuses one it does not have', () => {
    const [sku, row] = Object.entries(CON_ODM).find(([, r]) => r.aliases.length);
    expect(findConPart(row.aliases[0].toUpperCase())).toBe(sku);
    expect(findConPart('flux capacitor')).toBe(null);
    expect(() => resolveConPart('no-such-part')).toThrow(/Unknown construction part/);
    expect(() => assembleMachine('hovercrane')).toThrow(/Unknown construction archetype/);
    expect(() => resolveConPart(sku, { palette: 'tartan' })).toThrow(/Unknown construction palette/);
  });
});
