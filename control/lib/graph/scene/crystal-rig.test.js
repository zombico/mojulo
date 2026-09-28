import { describe, expect, it } from 'vitest';
import { rigKernel, RIG_OPERATORS, RIG_OP_OF, pulseAt, solveRig, buildGrid, colorName, lambdaColor, satisfied, validateCrystalLight, crystalRigFor, occluderTriangles, solveRigOnFaces, RIG_OPERATOR_MAX } from './crystal-rig.js';
import { crystalTermFaces } from '../polygonizer/crystal-faces.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const white = { o: [0, -0.1, 0], d: [0, 1, 0], color: [1, 1, 1], power: 1, E: null, lambda: null, width: 0.002, gen: 0 };
const stone = (gem, axis = [0, 0, 1], extra = {}) => ({ at: [0, 0, 0], axis: unit(axis), r: 0.006, op: RIG_OP_OF[gem], seed: 3, ...extra });
const run = (gem, beam = white, axis, extra) => RIG_OPERATORS[RIG_OP_OF[gem]](beam, stone(gem, axis, extra), { entry: 0.094, t: 0 });
const hue = (c) => { const [r, g, b] = c; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; const h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); return Math.round(((h * 60) + 360) % 360); };
const avgPower = (b) => { if (!b.pulse) return b.power; let a = 0; for (let i = 0; i < 1000; i++) a += pulseAt(b.pulse, (i / 1000) * b.pulse.period); return b.power * a / 1000; };

describe('the operators (the study\'s G1 gates, ported)', () => {
  it.each(Object.keys(RIG_OP_OF))('%s never gains power (ruby averaged over its pulse)', (gem) => {
    const r = run(gem, white, [0, 1, 0.001]); expect(r.beams.reduce((s, b) => s + avgPower(b), 0)).toBeLessThanOrEqual(1 + 1e-9);
  });
  it('relay: one beam, re-aimed along c (whichever end faces the beam)', () => {
    const c = unit([0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3)]); const r = run('quartz', white, c);
    expect(r.beams).toHaveLength(1); expect(Math.abs(dot(r.beams[0].d, c))).toBeCloseTo(1, 12);
    const back = run('quartz', white, c.map((x) => -x)); expect(dot(back.beams[0].d, c)).toBeCloseTo(1, 12);
  });
  it('amethyst and sapphire relay in their own colours', () => {
    const rig = crystalRigFor([...crystalTermFaces({ id: 'a', shape: { kind: 'crystal', gem: 'amethyst', center: [0, 0, 0], size: 1 } }), ...crystalTermFaces({ id: 's', shape: { kind: 'crystal', gem: 'sapphire', center: [3, 0, 0], size: 1 } })],
      { lamps: [{ at: [0, -5, 0], aim: [0, 0, 0] }] });
    const [am, sa] = rig.stones; expect(am.op).toBe('relay'); expect(hue(am.tint)).toBeGreaterThan(255); expect(hue(sa.tint)).toBeGreaterThan(190); expect(hue(sa.tint)).toBeLessThan(255);
    const r = RIG_OPERATORS.relay(white, { ...am, at: [0, 0, 0] }, { entry: 0.09 }); expect(colorName(r.beams[0].color, r.beams[0].lambda)).toBe('violet');
  });
  it('fan: white → five beams, five hues, all in the plane ⟂ c; a coloured beam passes as one', () => {
    const r = run('diamond'); expect(r.beams).toHaveLength(5); expect(new Set(r.beams.map((b) => hue(b.color))).size).toBe(5);
    expect(r.beams.every((b) => Math.abs(b.d[2]) < 1e-9)).toBe(true);
    expect(run('diamond', { ...white, color: [0, 1, 0.1], lambda: 540 }).beams).toHaveLength(1);
  });
  it('fan: the plane follows the stone (c tilted, the fan tilts with it); the spread is a dial', () => {
    const c = unit([1, 0, 1]); const r = run('diamond', white, c); expect(r.beams.every((b) => Math.abs(dot(b.d, c)) < 1e-9)).toBe(true);
    const ang = (bs) => Math.acos(Math.min(1, dot(bs[0].d, bs[4].d))) * 180 / Math.PI;
    expect(ang(run('diamond').beams)).toBeCloseTo(26, 6); expect(ang(run('diamond', white, [0, 0, 1], { spread: 90 }).beams)).toBeCloseTo(90, 6);
  });
  it('twin: two parallel beams, crossed E, offset 2r·tan 6.24°·5; an o-polarized beam goes one way', () => {
    const r = run('calcite', white, [1, 0, 1]); const [o, e] = r.beams; const off = Math.hypot(...[0, 1, 2].map((k) => e.o[k] - o.o[k]));
    expect(r.beams).toHaveLength(2); expect(dot(o.d, e.d)).toBeCloseTo(1, 12); expect(dot(o.E, e.E)).toBeCloseTo(0, 12);
    expect(off).toBeCloseTo(0.012 * Math.tan(6.24 * Math.PI / 180) * 5, 9);
    const pol = run('calcite', { ...white, E: o.E }, [1, 0, 1]); expect(pol.beams.map((b) => b.key)).toEqual(['o']);
  });
  it('gate: Malus cos² (0/30/60/90° → 1 / 0.75 / 0.25 / blocked), and dark looking down c', () => {
    const res = [0, 30, 60, 90].map((a) => { const E = [Math.sin(a * Math.PI / 180), 0, Math.cos(a * Math.PI / 180)]; const r = run('tourmaline', { ...white, E }); return r.beams.length ? r.beams[0].power : 0; });
    expect(res[0]).toBeCloseTo(1, 9); expect(res[1]).toBeCloseTo(0.75, 9); expect(res[2]).toBeCloseTo(0.25, 9); expect(res[3]).toBe(0);
    expect(run('tourmaline', white, [0, 1, 0]).beams).toHaveLength(0);
  });
  it('charge: white → a red pass-through and a pulsed red laser along c; red just passes', () => {
    const r = run('ruby'); expect(r.beams.some((b) => b.pulse)).toBe(true); expect(r.beams.every((b) => b.lambda === 694)).toBe(true);
    const laser = r.beams.find((b) => b.pulse); expect(laser.d).toEqual([0, 0, 1]);
    const red = run('ruby', { ...white, color: [1, 0.02, 0.01], lambda: 694 }); expect(red.beams).toHaveLength(1); expect(red.beams[0].pulse).toBeUndefined();
  });
  it('iris: its colours are the angle (they change as the opal turns), all visible', () => {
    const turns = [0, 20, 40].map((deg) => { const a = deg * Math.PI / 180; return run('opal', white, [0.2, -0.35, 1], { x: [Math.cos(a), Math.sin(a), 0] }).beams.map((b) => Math.round(b.lambda)); });   // spun about (near) c
    expect(JSON.stringify(turns[0])).not.toBe(JSON.stringify(turns[1])); expect(turns.flat().every((l) => l >= 405 && l <= 690)).toBe(true);
  });
  it('colour names: by wavelength, else by hue', () => {
    expect([640, 590, 540, 490, 445].map((l) => colorName(lambdaColor(l), l))).toEqual(['red', 'orange', 'green', 'cyan', 'violet']);
    expect(colorName([1, 1, 1])).toBe('white'); expect(colorName([1, 0, 0])).toBe('red'); expect(colorName([0.3, 1, 0.22])).toBe('green');
  });
});

describe('the occluder', () => {
  const rnd = (() => { let a = 7; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const tris = []; for (let i = 0; i < 400; i++) { const c = [rnd() * 10, rnd() * 10, rnd() * 10]; for (let k = 0; k < 3; k++) tris.push(c[0] + rnd() - 0.5, c[1] + rnd() - 0.5, c[2] + rnd() - 0.5); }
  tris.push(-5, -5, 0, 15, -5, 0, 15, 15, 0);   // a big floor across many cells
  const brute = (o, d, tMax) => { let best = null; const K = rigKernel(); const g1 = K.buildGrid; for (let i = 0; i < tris.length; i += 9) { const h = g1(tris.slice(i, i + 9)).hit(o, d, tMax); if (h && (!best || h.t < best.t)) best = h; } return best; };
  it('agrees with brute force on random rays', () => {
    const grid = buildGrid(tris); let hits = 0;
    for (let i = 0; i < 300; i++) {
      const o = [rnd() * 14 - 2, rnd() * 14 - 2, rnd() * 12 + 0.5]; const d = unit([rnd() - 0.5, rnd() - 0.5, rnd() - 0.6]);
      const a = grid.hit(o, d, 50), b = brute(o, d, 50); expect(!!a).toBe(!!b); if (a) { hits++; expect(a.t).toBeCloseTo(b.t, 9); expect(dot(a.n, d)).toBeLessThanOrEqual(0); }
    }
    expect(hits).toBeGreaterThan(40);
  });
  it('respects tMax, and an empty occluder hits nothing', () => {
    const grid = buildGrid(tris); expect(grid.hit([5, 5, 3], [0, 0, -1], 1)).toBeNull(); expect(grid.hit([5, 5, 3], [0, 0, -1], 5).t).toBeGreaterThan(0);
    expect(buildGrid([]).hit([0, 0, 0], [1, 0, 0], 10)).toBeNull();
  });
});

describe('the solver', () => {
  const floor = [{ corners: [[-1, -1, -0.02], [1, -1, -0.02], [1, 1, -0.02], [-1, 1, -0.02]], fill: '#222' }, { corners: [[-1, 0.4, -0.02], [1, 0.4, -0.02], [1, 0.4, 1], [-1, 0.4, 1]], fill: '#222' }];
  const scene = { lamps: [{ ...white, o: [0, -0.3, 0] }], stones: [stone('calcite', [1, 0, 1]), { ...stone('tourmaline'), at: [0, 0.05, 0] }], budget: { maxLen: 3 } };
  it('is deterministic, lands pools on the walls, and budgets hold (a relay loop stops)', () => {
    const wall = buildGrid(occluderTriangles(floor)).hit; const a = JSON.stringify(solveRig({ ...scene, wall })), b = JSON.stringify(solveRig({ ...scene, wall }));
    expect(a).toBe(b); expect(JSON.parse(a).pools.length).toBeGreaterThan(0);
    const loop = solveRig({ lamps: [white], stones: [stone('quartz', [0, -1, 0]), { ...stone('quartz', [0, 1, 0]), at: [0, 0.04, 0] }], wall, budget: { beams: 40, maxLen: 3 } });
    expect(loop.stats.beams).toBeLessThanOrEqual(40);
  });
  it('targets catch beams by colour: a fan lights the red target and not the green one when aimed', () => {
    const fan = solveRig({ lamps: [white], stones: [stone('diamond')], targets: [], budget: { maxLen: 3 } });
    const red = fan.segments.find((s) => colorName(s.color) === 'red' && s.a[1] > 0); const dir = unit(red.b.map((x, k) => x - red.a[k]));
    const at = red.a.map((x, k) => x + dir[k] * 0.2);
    const r = solveRig({ lamps: [white], stones: [stone('diamond')], targets: [{ id: 'door', at, r: 0.01 }], budget: { maxLen: 3 } });
    expect(satisfied(r.lit.door, { color: 'red' })).toBe(true); expect(satisfied(r.lit.door, { color: 'green' })).toBe(false);
  });
  it('a receiver catches the light and glows; it does not act', () => {
    const r = solveRig({ lamps: [white], stones: [{ ...stone('quartz'), op: null }], budget: { maxLen: 3 } });
    expect(r.caught).toEqual([0]); expect(r.glows.some((g) => g.stone === 0)).toBe(true); expect(r.segments).toHaveLength(1);
  });
  it('the kernel is self-contained: rebuilt from its source it solves the same bytes', () => {
    const K = new Function(`return (${rigKernel.toString()})()`)();
    expect(JSON.stringify(K.solve(scene))).toBe(JSON.stringify(solveRig(scene)));
  });
});

describe('a recipe\'s crystalLight', () => {
  const hero = crystalTermFaces({ id: 'prism', shape: { kind: 'crystal', gem: 'diamond', center: [0, 0, 1], size: 1 } });
  const druse = crystalTermFaces({ id: 'bed', shape: { kind: 'crystal', gem: 'amethyst', size: 0.5, center: [4, 0, 0], cluster: { count: 20, seed: 2, on: { disc: { center: [4, 0, 0], radius: 1 } } } } });
  it('validates, naming what is wrong', () => {
    expect(validateCrystalLight({ lamps: [{ at: [0, 0, 0], aim: [1, 0, 0] }] })).toEqual([]);
    expect(validateCrystalLight({}).join()).toContain('lamps');
    expect(validateCrystalLight({ lamps: [{ at: [0, 0, 0] }] }).join()).toContain('aim');
    expect(validateCrystalLight({ lamps: [{ at: [0, 0, 0], dir: [1, 0, 0] }], targets: [{ id: 'a', at: [0, 0, 0], r: 1, want: { color: 'pink' } }] }).join()).toContain('want');
    expect(validateCrystalLight({ lamps: [{ at: [0, 0, 0], dir: [1, 0, 0] }], crystals: { prism: { op: 'laser' } } }).join()).toContain('crystals.prism');
  });
  it(`a hero stone acts; a druse of more than ${RIG_OPERATOR_MAX} catches; the recipe overrides either way`, () => {
    const spec = { lamps: [{ at: [0, -6, 1], aim: [0, 0, 1] }] }; const rig = crystalRigFor([...hero, ...druse], spec);
    expect(rig.stones.filter((s) => s.group === 'prism').map((s) => s.op)).toEqual(['fan']);
    expect(rig.stones.filter((s) => s.group === 'bed').every((s) => s.op === null)).toBe(true);
    const over = crystalRigFor([...hero, ...druse], { ...spec, crystals: { prism: { op: 'twin' }, bed: true } });
    expect(over.stones.find((s) => s.group === 'prism').op).toBe('twin'); expect(over.stones.filter((s) => s.group === 'bed').every((s) => s.op === 'relay')).toBe(true);
  });
  it('solves on the page\'s faces: the hero fans the lamp, the beams land', () => {
    const faces = [...hero, { corners: [[-9, -9, 0], [9, -9, 0], [9, 9, 0], [-9, 9, 0]], fill: '#333' }];
    const rig = crystalRigFor(faces, { lamps: [{ at: [0, -6, 1.2], aim: [0, 0, 1] }] }); const r = solveRigOnFaces(faces, rig);
    expect(r.segments.length).toBeGreaterThan(5); expect(new Set(r.segments.map((s) => colorName(s.color))).size).toBeGreaterThanOrEqual(5);
    expect(rig.lamps[0].width).toBeGreaterThan(0); expect(rig.budget.maxLen).toBeGreaterThan(10);
  });
  it('the lamp colour is sRGB hex, linearized', () => {
    const rig = crystalRigFor(hero, { lamps: [{ at: [0, -6, 1], aim: [0, 0, 1], color: '#ff8000' }] }); expect(rig.lamps[0].color[0]).toBe(1); expect(rig.lamps[0].color[1]).toBeCloseTo(0.2159, 3);
  });
});

describe('the workbench card\'s light puzzle', () => {
  it('is dark at rest and lit after two turns of the quartz (the recipe the card prints)', async () => {
    const { assembleWorkbenchScene } = await import('../worlds/workbench.js');
    const terms = [{ id: 'back', op: 'add', shape: { kind: 'box', center: [0, 13, 5], size: [40, 1, 10] } },
      { id: 'prism', op: 'add', shape: { kind: 'crystal', gem: 'diamond', cut: 'brilliant', center: [8, 0, 3], size: 2.2 } },
      { id: 'mirror', op: 'add', shape: { kind: 'crystal', gem: 'quartz', center: [-0.24, 0.59, 3], size: 1.8, axis: [0.9, 0.43, 0.03] } }];
    const faces = assembleWorkbenchScene({ kind: 'workbench', fields: [{ id: 'room', cells: 70, terms }] }).faces;
    const spec = { lamps: [{ at: [22, -1, 3.4], aim: [8, 0, 3] }], crystals: { prism: { spread: 70, bend: 0 } }, targets: [{ id: 'socket', at: [-5.69, 11.9, 3.33], r: 0.9, want: { color: 'green' } }] };
    const rig = crystalRigFor(faces, spec); const wall = buildGrid(occluderTriangles(faces)).hit;
    const turned = (a) => rig.stones.map((s) => (s.group !== 'mirror' ? s : { ...s, axis: [s.axis[0] * Math.cos(a) - s.axis[1] * Math.sin(a), s.axis[0] * Math.sin(a) + s.axis[1] * Math.cos(a), s.axis[2]] }));
    const lit = (a) => satisfied(solveRig({ ...rig, stones: turned(a), wall }).lit.socket, { color: 'green' });
    expect(lit(0)).toBe(false); expect(lit(Math.PI / 4)).toBe(false); expect(lit(Math.PI / 2)).toBe(true); expect(lit(3 * Math.PI / 4)).toBe(false);
  });
});
