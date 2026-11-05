import { describe, it, expect } from 'vitest';
import { composeLive } from '../worlds/controllable/compose.js';
import { blockMatter } from './matter.js';
import { rupaPhysics } from './index.js';
import { groundField } from './ground.js';
import { pour, flow, barrier, fluidAt, fluidVolume } from './fluid.js';
import { scriptOf, leafAt } from './wind-script.js';
import { solveWind, bendAt } from './wind-solver.js';

const { resistance, bleed, blockDrag, wakeFactor } = rupaPhysics;

describe('blocking: a barrier is its porosity, and flow gets past it by law', () => {
  it('resistance, bleed and drag from the open share: none through a solid wall, all through nothing', () => {
    expect(bleed(0)).toBe(0); expect(blockDrag(0)).toBe(1.2);
    expect(bleed(1)).toBe(1); expect(blockDrag(1)).toBe(0);
    expect(resistance(0.5)).toBeCloseTo((1 / ((0.62 + 0.38 * 0.125) * 0.5) - 1) ** 2, 12);
    expect(bleed(0.3)).toBeLessThan(bleed(0.6));
  });

  it('the wake: a solid wall stills the air right behind it and the flow recovers as a plane wake; a hedge shelters less deeply', () => {
    const h = 2;
    expect(wakeFactor(0.1, h, 0)).toBe(0);
    expect(wakeFactor(20 * h, h, 0)).toBeCloseTo(1 - 0.98 * Math.sqrt((1.2 * 2 * h) / (20 * h)), 12);
    expect(wakeFactor(10 * h, h, 0)).toBeLessThan(wakeFactor(40 * h, h, 0));
    expect(wakeFactor(0.1, h, 0.5)).toBeCloseTo(bleed(0.5), 12);           // close behind: what bleeds through
    expect(wakeFactor(0.1, h, 0.5)).toBeGreaterThan(wakeFactor(0.1, h, 0));
  });
});

describe('blocking the wind on the runtime', () => {
  const CW = composeLive();
  const LEAF = { size: [0.06, 0.04, 0.002], mass: 0.06 * 0.04 * 0.0003 * 600, joules: 1, stiff: 1e8, bounce: 0.1 };
  const fence = (y0, porosity) => [0, 1, 2, 3, 4, 5].map((r) => ({ id: `f${y0}:${r}`, min: [0, y0, r * 0.5], max: [0.2, y0 + 6, (r + 1) * 0.5], hp: 1, ...blockMatter({ min: [0, y0, r * 0.5], max: [0.2, y0 + 6, (r + 1) * 0.5] }, { matter: 'brick', porosity }) }));

  it('a leaf behind a hedge drifts more than one behind a solid wall and less than one in the open', () => {
    const w = CW.createWorld({ entities: [], breakables: [...fence(-10, 0), ...fence(0, 0.5)], rupa: { wind: { speed: 10, dir: 0 } } });
    for (const [id, y] of [['wall', -7], ['hedge', 3], ['open', 20]]) CW.throwMatter(w, { id, at: [2, y, 2.5], vel: [0, 0, 0], ...LEAF });
    for (let i = 0; i < 60; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 });
    const dx = (id) => w.rupa.bodies.find((b) => b.id === id).pos[0] - 2;
    expect(dx('wall')).toBeLessThan(dx('hedge'));
    expect(dx('hedge')).toBeLessThan(dx('open'));
  });

  it('a porous fence takes less of the wind\'s push: where a solid dry fence tips, a slatted one stands', () => {
    const dry = (porosity, y) => [0, 1].map((r) => ({ id: `p${porosity}:${r}`, min: [0, y, r * 0.5], max: [0.5, y + 0.5, (r + 1) * 0.5], hp: 1, ...blockMatter({ min: [0, y, r * 0.5], max: [0.5, y + 0.5, (r + 1) * 0.5] }, { matter: 'pine', porosity }) }));
    const w = CW.createWorld({ entities: [], breakables: [...dry(0, 0), ...dry(0.6, 5)], rupa: { wind: { speed: 50, dir: 0 } } });
    for (let i = 0; i < 60; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 });
    const tipped = w.rupa.toppled.map((t) => t.id);
    expect(tipped.some((id) => id.startsWith('p0:'))).toBe(true);
    expect(tipped.some((id) => id.startsWith('p0.6:'))).toBe(false);
  });
});

describe('blocking the wind in the scripts', () => {
  const at = (s) => { const c = 2.5 / s.vt + s.rest; for (let t = 0; t < c; t += 0.005) { const L = leafAt(s, 0, t); if (L.falling && L.age > 2.5 / s.vt - 0.02) return L.pos[0] - 1; } return null; };
  it('a scripted leaf behind a hedge lands farther than behind a solid wall, by the same law', () => {
    const wall = { min: [0, -3, 0], max: [0.4, 3, 3] }, src = { min: [1, 0, 2.5], max: [1, 0, 2.5] };
    const solid = scriptOf({ speed: 10, dir: 0 }, { source: src, wakes: [wall] }), hedge = scriptOf({ speed: 10, dir: 0 }, { source: src, wakes: [{ ...wall, porosity: 0.5 }] });
    expect(at(solid)).toBeLessThan(0.05);              // held in the wall's still air
    expect(at(hedge)).toBeGreaterThan(at(solid));
  });
  it('the solver shelters grass behind a wall', () => {
    const S = solveWind([{ id: 'g', kind: 'grass', place: { min: [1, -1, 0], max: [1, -1, 0] }, count: 1 }, { id: 'g2', kind: 'grass', place: { min: [1, 20, 0], max: [1, 20, 0] }, count: 1, seed: 1 }], { speed: 8, dir: 0 }, { wakes: [{ min: [0, -5, 0], max: [0.4, 5, 2] }] });
    const b = S.batches[0];
    expect(b.shelter[0]).toBeLessThan(b.shelter[1]);
    expect(bendAt(b, 0, 1).angle).toBeLessThan(bendAt(b, 1, 1).angle);
  });
});

describe('blocking water on the ground', () => {
  // a channel 12 m long, a barrier across it at x = 0; water poured upstream
  const channel = () => groundField({ origin: [-6, -1], size: [12, 2], cell: 0.25, soil: 'clay', soilDepth: 3 });
  const dam = (f, o) => barrier(f, { box: { min: [-0.125, -1, 0], max: [0.125, 1, o.top ?? 1] }, matter: o.matter ?? 'concrete', porosity: o.porosity ?? 0, thick: o.thick ?? 0.25 });
  const run = (o, volume = 6, seconds = 20) => flow(pour(dam(channel(), o), { at: [-3, 0], volume, radius: 1.5 }), { seconds });
  const downstream = (f) => fluidAt(f, 3, 0).depth;
  const through = (f) => { let v = 0; for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) if (f.origin[0] + (i + 0.5) * f.cell > 0.25) v += f.fluid.d[j * f.nx + i]; return v * f.cell * f.cell; };

  it('a solid barrier holds the water behind it; nothing reaches the far side; the volume is kept', () => {
    const r = run({ thick: 1 });
    expect(downstream(r.field)).toBeLessThan(1e-6);
    expect(fluidAt(r.field, -3, 0).depth).toBeGreaterThan(0.3);
    expect(fluidVolume(r.field)).toBeCloseTo(6, 6);
    expect(r.events).toEqual([]);
  });

  it('a porous barrier seeps by Bernoulli through its open share: more open, more through', () => {
    const a = run({ porosity: 0.1, thick: 1 }, 6, 3), b = run({ porosity: 0.4, thick: 1 }, 6, 3);   // while it still runs through
    expect(through(a.field)).toBeGreaterThan(0);
    expect(through(b.field)).toBeGreaterThan(through(a.field));   // the volume that got through
  });

  it('water rising past a low barrier pours over its top', () => {
    expect(downstream(run({ top: 0.2, thick: 1 }, 8).field)).toBeGreaterThan(0.05);
  });

  it('where the water\'s push beats its weight and joint, a thin adobe barrier breaches and the water floods through; a thick concrete one holds', () => {
    const weak = run({ matter: 'adobe', thick: 0.1, top: 1.5 }, 9), strong = run({ matter: 'concrete', thick: 1, top: 1.5 }, 9);
    expect(weak.events.some((e) => e.kind === 'breach')).toBe(true);
    expect(downstream(weak.field)).toBeGreaterThan(0.05);
    expect(strong.events).toEqual([]);
    expect(JSON.stringify(run({ matter: 'adobe', thick: 0.1, top: 1.5 }, 9).events)).toBe(JSON.stringify(weak.events));
  });
});
