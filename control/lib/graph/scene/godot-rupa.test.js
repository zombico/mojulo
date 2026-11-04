// THE DESTRUCTIBLE PHYSICS IN GODOT (rupa, `destruction: 'physical'`), its energy slice: an exported level's breakables
// run in the kernel (kernel/rupa.gd) as the web runs them, blow for blow and frame by frame. The corpus
// (rupa-conformance.js) is the web's runtime run over a handful of blocks a scenario; the Godot side runs the same
// scenarios and the two are compared character for character (MOJULO_GODOT). Without Godot the web half still holds:
// each scenario does what it says, the same way every run.
import { describe, it, expect } from 'vitest';
import { SCENARIOS, corpus, runRupa, scenarioById, block, DT } from './rupa-conformance.js';
import { MATTER } from '../rupa/matter.js';
import { runCorpus, kernelFiles } from './engines/runners.js';
import { compare } from './engines/conformance.js';

const GODOT = process.env.MOJULO_GODOT;
// the last frame's blocks: id → { how, z, joules }
const last = (sc) => {
  const snaps = runRupa(sc);
  return Object.fromEntries(snaps[snaps.length - 1].split(';').map((s) => { const [id, how, z, j] = s.split('|'); return [id, { how, z: Number(z), joules: Number(j) }]; }));
};

describe('the energy slice on the web (the truth the kernel is held to)', () => {
  it('runs every scenario the same way twice, a snapshot a frame', () => {
    for (const sc of SCENARIOS) {
      const a = runRupa(sc);
      expect(a.length, sc.id).toBe(sc.frames);
      expect(runRupa(sc), sc.id).toEqual(a);
    }
  });

  it('a burst breaks glass and brick and leaves stone; a giant monster\'s breaks the far stone a person\'s leaves', () => {
    const m = last(scenarioById('burst-matters'));
    for (const r of [0, 1, 2, 3]) {
      expect(m[`glass:${r}`].how).toBe('burst');
      expect(m[`stone:${r}`].how).toBe('-');
    }
    const sc = scenarioById('burst-power');
    expect(Object.values(last(sc)).every((b) => b.how === 'burst')).toBe(true);
    expect(Object.values(last({ ...sc, world: { heatShare: 0 } })).every((b) => b.how === '-')).toBe(true);
  });

  it('a lintel that loses a jamb falls and breaks; the jamb\'s courses drop and stand', () => {
    const m = last(scenarioById('lintel-loses-a-jamb'));
    expect(m.R0.how).toBe('call');
    expect(m.lintel.how).toBe('fall');
    expect(m.R1).toMatchObject({ how: '-', z: 0 });
    expect(m.L3).toMatchObject({ how: '-', z: 1.5 });
  });

  it('a short cantilever carries its load; a long one, worked out by a landing, snaps at its bond', () => {
    const m = last(scenarioById('cantilever-past-its-bond'));
    expect(m['slab2.1']).toMatchObject({ how: '-', z: 1.75 });
    for (let k = 0; k < 6; k++) expect(m[`slab6.${k}`].z, `slab6.${k}`).toBe(0);
  });

  it('a landing is an impact: a dropped stone breaks the glass it lands on', () => {
    expect(last(scenarioById('stack-lands')).sheet.how).toBe('crush');
  });

  it('rounds wear a course a round at a time and the fourth breaks it', () => {
    const sc = scenarioById('rounds-wear-a-wall'), snaps = runRupa(sc);
    const course = (f) => snaps[f].split(';')[0].split('|');
    expect(course(5)[1]).toBe('-');
    expect(Number(course(5)[3])).toBeLessThan(Number(snaps[0].split(';')[0].split('|')[3]));
    expect(course(15)[1]).toBe('-');
    expect(course(20)[1]).toBe('shot');
  });

  it('a column whose base is broken by a call drops a course and stands', () => {
    const m = last(scenarioById('call-breaks-the-base'));
    expect(m.c0.how).toBe('call');
    expect(m.c1).toMatchObject({ how: '-', z: 0 });
    expect(m.c4.z).toBeCloseTo(1.8, 6);
  });

  it('holds to the brittle matters (a plastic or cut block is a later slice) and hands the engine plain JSON', () => {
    const plastic = Object.values(MATTER).find((m) => m.yield > 0);
    expect(() => block('x', [0, 0, 0], [1, 1, 1], plastic.id)).toThrow(/plastic or cut/);
    const c = corpus();
    expect(c.map((s) => s.id)).toEqual(SCENARIOS.map((s) => s.id));
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
    expect(c.every((s) => s.dt === DT && s.floor === 0 && s.world.heatShare === 0)).toBe(true);
    expect(kernelFiles('godot', 'rupa')).toEqual({ files: ['js.gd', 'json_exact.gd', 'rupa.gd'], missing: [] });
  });
});

describe('kernel/rupa.gd is equal to the web (MOJULO_GODOT)', () => {
  it.skipIf(!GODOT)('runs every scenario of the energy slice equal to the web, frame by frame (MOJULO_GODOT)', () => {
    const scenarios = corpus();
    const { out, errors } = runCorpus('godot', 'rupa', scenarios, { bin: GODOT });
    expect(errors).toEqual([]);
    expect(compare('rupa', scenarios, out).filter((r) => !r.equal)).toEqual([]);
  }, 300000);

  // a corpus is only as good as what it catches: each plant breaks the kernel copy the run uses, never the source
  const PLANTS = [
    { name: 'a burst\'s share over the whole sphere', from: 'face_area(b, at) / (2.0 * PI', to: 'face_area(b, at) / (4.0 * PI' },
    { name: 'a landing that keeps its bounce\'s energy', from: 'var dE := 0.5 * mu * vn * vn * (1.0 - e * e)', to: 'var dE := 0.5 * mu * vn * vn' },
    { name: 'every span read as held at both ends', from: 'var M := W * lever / (4.0 if both else 1.0)', to: 'var M := W * lever / 4.0' },
    { name: 'gravity at half strength', from: 'b["falling"]["vz"] -= state["fall_g"] * dt', to: 'b["falling"]["vz"] -= state["fall_g"] * dt * 0.5' },
    { name: 'a world\'s power ignored', from: 'var p: float = R["power"]', to: 'var p: float = 1.0' },
  ];
  it.skipIf(!GODOT)('every planted bug in the blows, the landing, the load and gravity is caught (MOJULO_GODOT)', () => {
    const scenarios = corpus();
    for (const p of PLANTS) {
      const { out } = runCorpus('godot', 'rupa', scenarios, { bin: GODOT, mutate: [{ file: 'rupa.gd', from: p.from, to: p.to }] });
      expect(!out || compare('rupa', scenarios, out).some((r) => !r.equal), p.name).toBe(true);
    }
  }, 600000);
});
