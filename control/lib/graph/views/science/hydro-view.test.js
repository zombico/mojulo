import { describe, expect, it } from 'vitest';

import { planHydroScene, assembleHydroScene, HYDRO_SCENARIOS } from './hydro-view.js';
import { planHydroChain } from '../../physics/hydro.js';
import { sketchRenderMode } from '../../sketch/sketch-manifest.js';

const R = (scenario, extra = {}) => ({ kind: 'hydro-view', scenario, ...extra });

describe('planHydroScene — determinism & registration', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    for (const s of HYDRO_SCENARIOS) {
      expect(JSON.stringify(planHydroScene(R(s)))).toBe(JSON.stringify(planHydroScene(R(s))));
    }
  });

  it('exposes the six arcs of the explainer, and falls back to the dam on an unknown one', () => {
    expect(HYDRO_SCENARIOS).toEqual(['dam', 'penstock', 'turbine', 'generator', 'plant', 'spillway']);
    expect(planHydroScene(R('waterfall')).stats.scenario).toBe('dam');
  });

  it('registers as an orbit-only object-render world', () => {
    expect(sketchRenderMode({ kind: 'hydro-view' })).toBe('world');
  });

  it('every arc quotes the SAME chain — one physics, five depictions', () => {
    const chain = planHydroChain({ head: 90, flow: 55 });
    for (const s of HYDRO_SCENARIOS) {
      const st = planHydroScene(R(s, { head: 90, flow: 55 })).stats;
      expect(st.jetV).toBeCloseTo(chain.jet.v, 9);
      expect(st.rpm).toBeCloseTo(chain.runner.rpm, 9);
      expect(st.f).toBeCloseTo(chain.generator.f, 9);
      expect(st.powerMW.elec).toBeCloseTo(chain.power.elec / 1e6, 9);
    }
  });

  it('scale multiplies the world without changing the physics stats', () => {
    const one = planHydroScene(R('dam'));
    const two = planHydroScene(R('dam', { scale: 2 }));
    expect(two.bounds.radius).toBeCloseTo(one.bounds.radius * 2, 6);
    expect(two.stats.jetV).toBeCloseTo(one.stats.jetV, 9);
  });
});

describe('arc 1 — the dam stores head', () => {
  const plan = planHydroScene(R('dam', { head: 100 }));

  it('hydrostatic pressure arrows on the dam face grow with depth (P = ρgh made visible)', () => {
    const arrows = plan.fields[0].sets[0].samples;
    expect(arrows.length).toBeGreaterThanOrEqual(5);
    const byDepth = [...arrows].sort((a, b) => b.pos[2] - a.pos[2]);   // shallow → deep
    for (let i = 1; i < byDepth.length; i++) expect(byDepth[i].amp).toBeGreaterThan(byDepth[i - 1].amp);
  });

  it('the outlet jet rides the tracer channel and quotes Torricelli in the readout', () => {
    expect(plan.tracers.length).toBeGreaterThanOrEqual(3);
    expect(plan.fields[0].readout.join(' ')).toContain('√(2gh)');
    expect(plan.stats.jetV).toBeCloseTo(planHydroChain({ head: 100 }).jet.v, 9);
  });

  it('clickable picks name the dam, the reservoir and the outlet', () => {
    expect(plan.picks.map((p) => p.name)).toEqual(['dam', 'reservoir', 'outlet']);
    for (const p of plan.picks) expect(plan.faces.some((f) => f.group === p.name)).toBe(true);
  });

  it('nothing spins yet — the dam arc is stored energy, not the machine', () => {
    expect(plan.movers).toEqual([]);
  });
});

describe('arc 2 — the penstock converts PE → KE', () => {
  const plan = planHydroScene(R('penstock'));

  it('water strands descend from the reservoir and leave the nozzle moving', () => {
    for (const tr of plan.tracers) {
      const zs = tr.path.map((p) => p[2]);
      expect(zs[0]).toBeGreaterThan(zs[zs.length - 1]);              // net fall
      const xs = tr.path.map((p) => p[0]);
      expect(xs[xs.length - 1]).toBeGreaterThan(xs[0]);              // net downstream travel
    }
  });

  it('equal-time resampling makes the flow visibly accelerate — later steps are longer', () => {
    const path = plan.tracers[0].path;
    const step = (i) => Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1], path[i + 1][2] - path[i][2]);
    const early = step(1), late = step(path.length - 3);
    expect(late).toBeGreaterThan(early * 2);
  });

  it('pressure arrows on the pipe wall grow with the drop, and Bernoulli anchors the readout', () => {
    const arrows = plan.fields[0].sets[0].samples;
    for (let i = 1; i < arrows.length; i++) expect(arrows[i].amp).toBeGreaterThan(arrows[i - 1].amp);
    expect(plan.fields[0].readout.join(' ')).toContain('v²/2g');
  });
});

describe('arc 3 — the turbine: momentum → torque → spin', () => {
  const plan = planHydroScene(R('turbine', { head: 60, flow: 40 }));

  it('the runner rides a SPIN mover about the horizontal axis, rendered at a watchable rate', () => {
    expect(plan.movers.length).toBe(1);
    const mv = plan.movers[0];
    expect(mv.group).toBe('runner');
    expect(mv.spin.axis).toEqual([0, 1, 0]);
    expect(mv.spin.omega).toBeGreaterThanOrEqual(0.5);
    expect(mv.spin.omega).toBeLessThanOrEqual(2.0);
  });

  it('the runner group is authored centred on the origin (the spin mover places it at the pivot)', () => {
    const runnerCorners = plan.faces.filter((f) => f.group === 'runner').flatMap((f) => f.corners);
    const cx = runnerCorners.reduce((s, c) => s + c[0], 0) / runnerCorners.length;
    const cz = runnerCorners.reduce((s, c) => s + c[2], 0) / runnerCorners.length;
    expect(Math.abs(cx)).toBeLessThan(0.5);
    expect(Math.abs(cz)).toBeLessThan(0.5);
    expect(plan.movers[0].pivot[2]).toBeGreaterThan(0);
  });

  it('the jet flies to the wheel tangent and the readout carries the momentum law + u = v/2', () => {
    const jet = plan.tracers[0];
    expect(jet.path[0][0]).toBeGreaterThan(10);
    expect(jet.path[jet.path.length - 1][0]).toBeLessThan(1.5);      // reaches the bottom bucket
    const text = plan.fields[0].readout.join(' ');
    expect(text).toContain('ρQ(v−u)(1−cosθ)');
    expect(text).toContain('u = v/2');
  });

  it('the real rpm is quoted even though the render is slowed', () => {
    const chain = planHydroChain({ head: 60, flow: 40 });
    expect(plan.stats.rpm).toBeCloseTo(chain.runner.rpm, 9);
    expect(plan.stats.omegaRender).toBeLessThanOrEqual(2.0);
  });
});

describe('arc 4 — the generator: spin → electricity', () => {
  const plan = planHydroScene(R('generator'));

  it('the rotor spins about the VERTICAL axis; the stator stays still', () => {
    expect(plan.movers.length).toBe(1);
    expect(plan.movers[0].group).toBe('rotor');
    expect(plan.movers[0].spin.axis).toEqual([0, 0, 1]);
    expect(plan.faces.some((f) => f.group === 'stator')).toBe(true);
  });

  it('the pole drum alternates two fills (N/S) around the ring', () => {
    const sides = plan.faces.filter((f) => f.group === 'rotor' && f.corners.length === 4 && !f.fill.startsWith('#7') && !f.fill.startsWith('#4a50'));
    const fills = new Set(sides.map((f) => f.fill));
    expect(fills.has('#cf5548')).toBe(true);
    expect(fills.has('#4a6fd0')).toBe(true);
  });

  it('the EMF wave is a real sine beside the machine, with a pulse tracer riding it', () => {
    const wave = plan.fields[0].lines[0].pts;
    const zs = wave.map((p) => p[2]);
    const mid = (Math.max(...zs) + Math.min(...zs)) / 2;
    const signs = zs.map((z) => (z - mid > 1e-6 ? 1 : z - mid < -1e-6 ? -1 : 0)).filter((s) => s !== 0);
    let crossings = 0;
    for (let i = 1; i < signs.length; i++) if (signs[i] !== signs[i - 1]) crossings++;
    expect(crossings).toBeGreaterThanOrEqual(3);                      // two full cycles
    expect(plan.tracers.length).toBeGreaterThanOrEqual(1);
  });

  it('Faraday + the frequency law anchor the readout', () => {
    const text = plan.fields[0].readout.join(' ');
    expect(text).toContain('ε = −dΦ/dt');
    expect(text).toContain('Hz');
    expect(plan.stats.f).toBeCloseTo(planHydroChain({}).generator.f, 9);
  });
});

describe('arc 5 — the plant: the whole chain in one world', () => {
  const plan = planHydroScene(R('plant'));

  it('runner and generator share one shaft — twin spin movers, same axis, same ω, same pivot', () => {
    expect(plan.movers.map((m) => m.group).sort()).toEqual(['rotor', 'runner']);
    const [a, b] = plan.movers;
    expect(a.spin.omega).toBeCloseTo(b.spin.omega, 12);
    expect(a.spin.axis).toEqual(b.spin.axis);
    expect(a.pivot).toEqual(b.pivot);
  });

  it('water rides the water path end to end — from the reservoir to the tailrace', () => {
    const water = plan.tracers.filter((t) => t.color[2] === 255);
    expect(water.length).toBeGreaterThanOrEqual(2);
    for (const tr of water) {
      expect(tr.path[0][0]).toBeLessThan(0);                          // starts in the reservoir
      expect(tr.path[tr.path.length - 1][0]).toBeGreaterThan(25);     // ends in the tailrace
    }
  });

  it('power leaves along the wire — a gold pulse tracer on a sagging line', () => {
    const pulse = plan.tracers.find((t) => t.color[0] === 255 && t.color[2] === 120);
    expect(pulse).toBeTruthy();
    expect(plan.fields[0].lines.length).toBeGreaterThanOrEqual(2);    // the two wire spans
    const wire = plan.fields[0].lines[0].pts;
    const chordMid = (wire[0][2] + wire[wire.length - 1][2]) / 2;
    expect(wire[Math.floor(wire.length / 2)][2]).toBeLessThan(chordMid);   // it sags
  });

  it('the five stations are clickable and the readout totals the chain', () => {
    expect(plan.picks.map((p) => p.name)).toEqual(['dam', 'penstock', 'runner', 'rotor', 'pylon']);
    const text = plan.fields[0].readout.join(' ');
    expect(text).toContain('PE → KE');
    expect(text).toContain('MW');
  });
});

describe('assembleHydroScene — the emitThreeWorld payload', () => {
  it('outdoor arcs open in daylight, machine arcs in the dark; glow stays off', () => {
    expect(assembleHydroScene(R('dam')).bg).toBe('#9cc4e8');
    expect(assembleHydroScene(R('plant')).bg).toBe('#9cc4e8');
    expect(assembleHydroScene(R('turbine')).bg).toBe('#0b0f16');
    expect(assembleHydroScene(R('generator')).bg).toBe('#0b0f16');
    for (const s of HYDRO_SCENARIOS) expect(assembleHydroScene(R(s)).glow).toBe(false);
  });

  it('cameras frame each arc for its reading — side for the water arcs, front for the machines', () => {
    expect(assembleHydroScene(R('dam')).cameras[0].name).toBe('side');
    expect(assembleHydroScene(R('turbine')).cameras[0].name).toBe('front');
    expect(assembleHydroScene(R('plant')).cameras[0].name).toBe('aerial');
  });

  it('threads faces, picks, movers, tracers and the field channel through to the world', () => {
    const scene = assembleHydroScene(R('plant'), { title: 'the whole chain' });
    expect(scene.title).toBe('the whole chain');
    expect(scene.faces.length).toBeGreaterThan(50);
    expect(scene.movers.length).toBe(2);
    expect(scene.tracers.length).toBeGreaterThan(2);
    expect(scene.fields.length).toBe(1);
    expect(scene.viewBox).toEqual({ width: 1120, height: 780 });
  });
});

describe('arc 6 — the spillway sheds the flood at night', () => {
  const plan = planHydroScene(R('spillway', { head: 60, flow: 40 }));

  it('gate count follows the design discharge, and the readout quotes gates × per-gate flow', () => {
    const gates = plan.faces.filter((f) => f.group === 'gate').length > 0;
    expect(gates).toBe(true);
    expect(plan.fields[0].readout.join(' ')).toMatch(/\d+ gates × \d+(\.\d+)? m³\/s/);
    const wide = planHydroScene(R('spillway', { flow: 300 }));
    const narrow = planHydroScene(R('spillway', { flow: 10 }));
    expect(wide.tracers.length).toBeGreaterThan(narrow.tracers.length);   // one falling tracer per gate
  });

  it('carries the reservoir lifted to head with the walls mapped as masks, the wavefield tailrace, and one live spout per gate', () => {
    const [reservoir, tailrace, ...spouts] = plan.surfaces;
    expect(reservoir.grid.cz).toBeGreaterThan(0);                          // stands AT HEAD behind the wall
    expect(reservoir.masks.length).toBe(3);                                // dam strip + both banks
    expect(tailrace.sources.length).toBe(plan.tracers.length);             // every gate a coherent source
    expect(tailrace.barrierY).toBeLessThan(-100);                          // pure source-sum, no plane wave
    expect(spouts.length).toBe(plan.tracers.length);                       // one falling sheet per gate
    for (const sp of spouts) {
      expect(sp.spout.path.length).toBeGreaterThan(8);                     // the arc, lip → basin
      expect(sp.spout.path[0][1]).toBeGreaterThan(sp.spout.path.at(-1)[1]); // it falls
      expect(sp.noLights).toBe(true);                                      // no per-sheet light stacking
    }
  });

  it('every pick anchors to authored faces', () => {
    expect(plan.picks.map((p) => p.name)).toEqual(['dam', 'gate', 'tailrace', 'deck']);
    for (const p of plan.picks) expect(plan.faces.some((f) => f.group === p.name)).toBe(true);
  });

  it('scale multiplies the water like the solids — surface grids, sources and masks all follow', () => {
    const one = planHydroScene(R('spillway'));
    const two = planHydroScene(R('spillway', { scale: 2 }));
    expect(two.surfaces[0].grid.cz).toBeCloseTo(one.surfaces[0].grid.cz * 2, 9);
    expect(two.surfaces[1].sources[0][0]).toBeCloseTo(one.surfaces[1].sources[0][0] * 2, 9);
    expect(two.surfaces[0].masks[0][1]).toBeCloseTo(one.surfaces[0].masks[0][1] * 2, 9);
    expect(two.surfaces[1].k).toBeCloseTo(one.surfaces[1].k / 2, 9);       // wavelength scales with the world
    expect(two.surfaces[2].spout.path[0][1]).toBeCloseTo(one.surfaces[2].spout.path[0][1] * 2, 9);
    expect(two.surfaces[2].spout.speed).toBeCloseTo(one.surfaces[2].spout.speed * 2, 9);
  });

  it('assembles as a night world with photo/aerial/side cameras and the surfaces on the payload', () => {
    const scene = assembleHydroScene(R('spillway'));
    expect(scene.bg).toBe('#0d1b36');
    expect(scene.cameras.map((c) => c.name)).toEqual(['photo', 'aerial', 'side']);
    expect(scene.surfaces.length).toBeGreaterThan(2);                      // reservoir + tailrace + spouts
    expect(scene.glow).toBe(false);
  });
});
