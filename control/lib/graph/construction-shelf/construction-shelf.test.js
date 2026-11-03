// The construction shelf's laws on its machines: the chain holds together at every pose (each body's pivot on its
// parent's joint, each ram's ends on their pins and its length within its stroke, each link at its own length), each
// joint's range is its ram's (derived, never stated), a named pose stands in its ranges and its ground pose touches the
// ground, the machine is held to its envelope and its stability, and the words it takes and refuses. One machine per
// distinct procedure, chosen in code from the archetypes: a tool on a linkage (the excavator's bucket), and a front
// whose laws are points it sweeps (the dozer's blade and ripper, a ram based on a body fixed to its joint's parent).
import { describe, it, expect } from 'vitest';
import { CON_ARCHETYPES, CON_MOUNTS, CON_ODM, assembleMachine, composeMachine, findConPart, machineCtx, posedJoints, resolveConPart, toolLow } from './index.js';
import { CON_CARRIERS, withCarrier } from './con-archetypes.js';
import { scaleDims } from './con-odm.js';
import { apply } from './con-common.js';
import { rangeOf, solveChain } from './con-chain.js';
import { ramParts } from './con-parts.js';

// (a machine whose tool closes a linkage on a ram: the excavator's bucket)
const ID = Object.keys(CON_ARCHETYPES).find((k) => Object.values(CON_ARCHETYPES[k].joints).some((j) => j.linkage));
const SWEPT = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].laws.measure);
// (a tool tilted through a rocker, a loader's Z-bar; a machine on another carrier, the carrier swap)
const ROCKER = Object.keys(CON_ARCHETYPES).find((k) => Object.values(CON_ARCHETYPES[k].joints).some((j) => j.linkage?.kind === 'rocker'));
const SWAPPED = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].carrier);
// (stages sliding a share each, a tool held level, several joints set down in one pose, parts drawn at another size)
const SLID = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].layout.filter((e) => e.joint && CON_ARCHETYPES[k].joints[e.joint].kind === 'slide').length > 1);
const LEVEL = Object.keys(CON_ARCHETYPES).find((k) => Object.values(CON_ARCHETYPES[k].poses).some((p) => Object.values(p).includes('level')));
const GROUNDS = Object.keys(CON_ARCHETYPES).find((k) => Object.values(CON_ARCHETYPES[k].poses).some((p) => Object.values(p).filter((v) => v === 'ground').length > 2));
const SCALED = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].layout.some((e) => CON_ODM[e.sku].dims.scale));
// (a ram of nested stages, a tipper's hoist; a body turning freely on a hinge, a mixer's drum; a load it carries)
const TELESCOPED = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].layout.some((e) => (CON_ODM[e.sku].dims.stages ?? 2) > 2));
const SPUN = Object.keys(CON_ARCHETYPES).find((k) => Object.values(CON_ARCHETYPES[k].joints).some((j) => j.kind === 'hinge' && !j.ram && !j.linkage));
const LADEN = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].laws.payload);
const MACHINES = [...new Set([ID, SWEPT, ROCKER, SWAPPED, SLID, LEVEL, GROUNDS, SCALED, TELESCOPED, SPUN, LADEN])];
const ctx = machineCtx(ID), arch = ctx.arch;
const near = (a, b, tol = 1e-6) => a.every((v, k) => Math.abs(v - b[k]) < tol);
// (a point is 'body.hardpoint', the hardpoint's own name may hold a dot: 'rear.wheel.r')
const split = (ref) => { const i = ref.indexOf('.'); return [ref.slice(0, i), ref.slice(i + 1)]; };

describe.each(MACHINES)('%s: the chain holds together at every named pose', (machine) => {
  const ctx = machineCtx(machine), arch = ctx.arch, ID = machine;
  for (const pose of Object.keys(arch.poses)) {
    it(pose, () => {
      const j = posedJoints(ID, pose), C = solveChain(arch, j, ctx);
      // each body's pivot on its parent's hardpoint
      // (a slide's body moves along its axis from the hardpoint; every other body's pivot is on it)
      for (const e of arch.layout.filter((x) => x.on)) {
        const [p, hp] = split(e.on), q = apply(C.frames[e.id], [0, 0, 0]), o = apply(C.frames[p], ctx.hp(p, hp));
        if (e.joint && arch.joints[e.joint].kind === 'slide') {
          const ax = apply({ R: C.frames[p].R, t: [0, 0, 0] }, arch.joints[e.joint].axis ?? [0, 1, 0]), d = q.map((v, k) => v - o[k]), t = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2];
          expect(near(d, ax.map((v) => v * t), 1e-9), e.id).toBe(true);
        } else expect(near(q, o, 1e-9), e.id).toBe(true);
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
        // (a telescopic ram's stages along its barrel, each overlapping the tube outside it and the next inside it)
        const P = ramParts(ctx.row(ctx.entry(b.id).sku).dims), stages = pairs.filter((s) => s.item.startsWith(`${b.item}.s`));
        const at = (s) => s.frame.t.reduce((v, x, k) => v + (x - b.frame.t[k]) * b.frame.R[k][1], 0);
        const tubes = [[0, P.barrel], ...stages.map((s) => [at(s), at(s) + P.stage]), [b.length - P.rod, b.length]];
        for (let k = 1; k < tubes.length; k++) {
          expect(tubes[k][0], `${b.item} ${k}`).toBeGreaterThan(tubes[k - 1][0]);
          expect(tubes[k - 1][1] - tubes[k][0], `${b.item} ${k}`).toBeGreaterThan(stages.length ? 0.05 : 0);
        }
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
      const P = ramParts(row.dims), n = row.dims.stages ?? 2;
      // (a telescopic ram's barrel, stages and rod reach past full stroke, each still in the one outside it)
      expect(row.dims.closed + row.dims.stroke - P.rod - (n - 2) * (P.stage ?? 0)).toBeLessThan(P.barrel - (n > 2 ? 0.05 * (n - 1) : 0));
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

describe.each(MACHINES)('%s as built', (machine) => {
  it('holds every law it is held to, and its bill of materials', () => {
    const { readout } = assembleMachine(machine);
    expect(readout.laws.laws.filter((l) => !l.ok)).toEqual([]);
    expect(readout.laws.laws.map((l) => l.id)).toEqual(expect.arrayContaining(['transport', 'mass', ...(CON_ARCHETYPES[machine].laws.groundPressure ? ['groundPressure'] : []), ...(CON_ARCHETYPES[machine].laws.payload ? ['volume', 'payload'] : []), ...Object.keys(CON_ARCHETYPES[machine].laws.measure ?? {})]));
    expect(readout.audit.ok).toBe(true);
  });
});

describe('the machine as built', () => {
  const { manifest, readout } = assembleMachine(ID);
  it('is held to its envelope, its tail, its rated lift and its clearance', () => {
    expect(readout.laws.laws.map((l) => l.id)).toEqual(expect.arrayContaining(['reach', 'depth', 'dumpHeight', 'tail', 'lift', 'clearance']));
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

describe('the carrier swap', () => {
  it('takes the dropped kinds off and puts the carrier\'s parts on, the front untouched', () => {
    const swapped = CON_ARCHETYPES[SWAPPED], base = CON_ARCHETYPES[Object.keys(CON_ARCHETYPES).find((k) => k !== SWAPPED && CON_ARCHETYPES[k].carriers?.includes(swapped.carrier))];
    const C = CON_CARRIERS[swapped.carrier], kind = (e) => CON_ODM[e.sku].kind;
    expect(swapped.layout.filter((e) => C.drops.includes(kind(e)))).toEqual([]);
    expect(swapped.layout.filter((e) => C.adds.some((a) => a.id === e.id))).toHaveLength(C.adds.length);
    const front = (a) => a.layout.filter((e) => e.joint || e.ram || e.link).map((e) => e.id);
    expect(front(swapped)).toEqual(front(base));
    expect(swapped.physics).not.toBe(base.physics);
    expect(() => withCarrier(base, 'hovercraft')).toThrow(/Unknown construction carrier/);
  });
});

describe('the chain\'s other procedures', () => {
  it('slides each stage its share of its joint: a telescope\'s sections, a mast\'s stages', () => {
    const ctx = machineCtx(SLID), arch = ctx.arch, name = Object.keys(arch.joints).find((k) => arch.joints[k].kind === 'slide');
    const stages = arch.layout.filter((e) => e.joint === name), at = (v) => solveChain(arch, { ...posedJoints(SLID, 'rest'), [name]: v }, ctx).frames;
    const r = rangeOf(arch, name, ctx), a = at(r[0]), b = at(r[1]);
    // (each stage's origin in its parent's frame, along the joint's axis)
    const axis = arch.joints[name].axis ?? [0, 1, 0];
    for (const e of stages) {
      const [p] = split(e.on), along = (F) => { const d = apply(F[e.id], [0, 0, 0]).map((v, k) => v - F[p].t[k]), R = F[p].R; return [0, 1, 2].reduce((s, k) => s + axis[k] * (R[0][k] * d[0] + R[1][k] * d[1] + R[2][k] * d[2]), 0); };
      expect(along(b) - along(a), e.id).toBeCloseTo((r[1] - r[0]) * Math.abs(e.scale ?? 1), 6);
    }
  });
  it('holds a tool level whatever the joints above it turn', () => {
    const ctx = machineCtx(LEVEL), arch = ctx.arch;
    for (const [pose, spec] of Object.entries(arch.poses).filter(([, p]) => Object.values(p).includes('level'))) {
      const name = Object.keys(spec).find((k) => spec[k] === 'level'), body = arch.layout.find((e) => e.joint === name).id;
      const F = solveChain(arch, posedJoints(LEVEL, pose), ctx).frames[body];
      expect(Math.abs(F.R[2][1]), pose).toBeLessThan(1e-6);
    }
  });
  it('sets each joint a pose grounds down on the ground in turn', () => {
    const ctx = machineCtx(GROUNDS), arch = ctx.arch;
    const pose = Object.keys(arch.poses).find((p) => Object.values(arch.poses[p]).filter((v) => v === 'ground').length > 2);
    const j = posedJoints(GROUNDS, pose), F = solveChain(arch, j, ctx).frames;
    for (const name of Object.keys(arch.poses[pose]).filter((k) => arch.poses[pose][k] === 'ground')) {
      // (what the joint carries: its body and every body hung below it)
      const under = (e) => { for (let x = e; x; x = x.on ? arch.layout.find((y) => y.id === split(x.on)[0]) : null) if (x.joint === name) return true; return false; };
      const bodies = arch.layout.filter((e) => !e.ram && !e.link && under(e));
      const low = Math.min(...bodies.filter((e) => ctx.outline(e.id)).flatMap((e) => ctx.outline(e.id).map((p) => apply(F[e.id], p)[2])));
      expect(Math.abs(low), name).toBeLessThan(0.01);
    }
  });
  it('draws a part at another size as its design, every length times its scale', () => {
    // (a part drawn only at another size: its numbers its design's times its scale, nothing else said)
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const [sku, row, base] = Object.entries(CON_ODM).filter(([, r]) => r.dims.scale).map(([s0, r]) => [s0, r, Object.keys(CON_ODM).find((b) => !CON_ODM[b].dims.scale && CON_ODM[b].kind === r.kind && same({ ...scaleDims(CON_ODM[b].dims, r.dims.scale), scale: r.dims.scale }, r.dims))]).find((x) => x[2]);
    const k = row.dims.scale;
    const a = resolveConPart(sku).garage.hardpoints, b = resolveConPart(base).garage.hardpoints;
    for (const [n, p] of Object.entries(b)) if (a[n] && !Array.isArray(p[0])) expect(near(a[n], p.map((v) => v * k), 0.002), n).toBe(true);
  });
});

describe('the door\'s swaps', () => {
  // (a machine with a mount, and a tool its mount takes that is not its own bucket; one carrier a machine lists)
  const M = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].mount), mount = CON_MOUNTS[CON_ARCHETYPES[M].mount.family];
  const tool = Object.keys(mount.tools).find((t) => t !== 'bucket');
  it('puts a tool its mount takes in its bucket\'s place, the rest of the machine as it was', () => {
    const key = composeMachine(M, { tool }), a = machineCtx(M).arch.layout, b = machineCtx(key).arch.layout;
    expect(key).toBe(`${M}+${tool}`);
    const changed = b.filter((e, i) => e.sku !== a[i].sku);
    expect(changed.map((e) => e.joint)).toEqual(['tool']);
    expect(composeMachine(M, { tool: 'bucket' })).toBe(M);
    const { readout } = assembleMachine(M, { tool });
    expect(readout).toMatchObject({ archetype: M, composed: key, tool });
  });
  it('re-reads the laws as built: its mass with its tool, its lift against tipping alone, a bucket\'s envelope read and not held', () => {
    const { readout } = assembleMachine(M, { tool }), ids = readout.laws.laws.map((l) => l.id);
    expect(ids).not.toEqual(expect.arrayContaining(['reach']));
    const mass = readout.laws.laws.find((l) => l.id === 'mass');
    expect(mass.ok).toBe(true);
    const lift = readout.laws.laws.find((l) => l.id === 'lift');
    if (lift) expect(lift.band[0]).toBe(0);
    if (readout.envelope) expect(readout.envelope.reach).toBeGreaterThan(0);
  });
  it('refuses a tool its mount does not take, and a carrier it does not list, naming what it takes', () => {
    const other = Object.keys(CON_MOUNTS).find((f) => f !== CON_ARCHETYPES[M].mount.family), foreign = Object.keys(CON_MOUNTS[other].tools).find((t) => !mount.tools[t]);
    expect(() => composeMachine(M, { tool: foreign })).toThrow(new RegExp(`takes ${Object.keys(mount.tools).join(', ')}`));
    const fixed = Object.keys(CON_ARCHETYPES).find((k) => !CON_ARCHETYPES[k].mount);
    expect(() => composeMachine(fixed, { tool })).toThrow(/its tool is its own/);
    expect(() => composeMachine(M, { carrier: 'hovercraft' })).toThrow(/Unknown construction carrier/);
  });
  it('makes the machine a carrier names: a machine and its carrier the same as its archetype', () => {
    const base = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].carriers?.length), carrier = CON_ARCHETYPES[base].carriers[0];
    const made = composeMachine(base, { carrier });
    expect(CON_ARCHETYPES[made].carrier).toBe(carrier);
    expect(assembleMachine(base, { carrier }).manifest).toEqual(assembleMachine(made).manifest);
  });
});

describe('a hauler', () => {
  it('turns a body on a free hinge as far as it is told, unclamped, a pose moving the body and never its parts', () => {
    const arch = CON_ARCHETYPES[SPUN], [name] = Object.entries(arch.joints).find(([, j]) => j.kind === 'hinge' && !j.ram && !j.linkage);
    expect(rangeOf(arch, name, machineCtx(SPUN))).toBe(null);
    const a = assembleMachine(SPUN, { pose: { [name]: 720 } }), b = assembleMachine(SPUN, { pose: { [name]: 0 } });
    expect(a.readout.clamped).toBeUndefined();
    const body = arch.layout.find((e) => e.joint === name).id;
    expect(a.manifest.items.map((i) => i.source)).toEqual(b.manifest.items.map((i) => i.source));
    expect(near(a.manifest.items.find((i) => i.id === body).at, b.manifest.items.find((i) => i.id === body).at, 1e-6)).toBe(true);
  });
  it('carries its rated payload in its body: the weight off it as built, its material filling its volume', () => {
    const { readout } = assembleMachine(LADEN), L = Object.fromEntries(readout.laws.laws.map((l) => [l.id, l]));
    expect(CON_ARCHETYPES[LADEN].laws.massShift).toBe(-CON_ARCHETYPES[LADEN].laws.payload.kg);
    expect(L.payload.ok && L.volume.ok).toBe(true);
  });
});
