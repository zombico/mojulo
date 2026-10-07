import { describe, expect, it } from 'vitest';

import { NECK_GLSL, basinStep, faucetFaces, fallAeration, jetAt, jetGrowth, jetHitTime, jetNeck, jetOmega, jetProfile, jumpRadius, normalizeJets, sheetProfile } from './jet.js';
import { normalizeShallows, basinFaces } from './shallows.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const tap = (litres, r0 = 0.005, o = {}) => jetProfile({ r0, Q: litres / 1000, ...o });

describe('the falling stream', () => {
  it('drips, streams or foams by its Weber number against a threshold that drops for a wide spout', () => {
    expect(tap(0).regime).toBe('off');
    expect(tap(0.004).regime).toBe('drip');
    expect(tap(0.012).regime).toBe('jet');
    expect(tap(0.06, 0.005, { aerated: true }).regime).toBe('aerated');
    expect(tap(0.001, 0.001).Wec).toBeGreaterThan(tap(0.001, 0.005).Wec);                // gravity helps a wide spout stream
    expect(tap(0.001, 0.0001).Wec).toBeGreaterThan(3.7);                                   // a fine needle: toward the classic 4
  });

  it('keeps its flow as it falls: it thins as it speeds up', () => {
    const j = tap(0.06);
    for (const tau of [0, 0.05, 0.12, 0.2]) {
      const a = jetAt(j, tau);
      expect(Math.PI * a.r * a.r * a.speed).toBeCloseTo(j.Q, 9);
    }
    expect(jetAt(j, 0.2).r).toBeLessThan(0.6 * j.r0);
  });

  it('lands where it has fallen the asked height', () => {
    const j = jetProfile({ r0: 0.005, Q: 6e-5, dir: [0.3, 0, -1] });
    const tau = jetHitTime(j, -0.35);
    expect(jetAt(j, tau).p[2]).toBeCloseTo(-0.35, 9);
    expect(jetAt(j, tau).p[0]).toBeGreaterThan(0);
  });

  it('a trickle beads before it reaches a sink; a full stream stays glassy', () => {
    const fall = (j) => jetHitTime(j, -0.35);
    const trickle = tap(0.012), full = tap(0.2);
    const gt = jetGrowth(trickle, fall(trickle), 200), gf = jetGrowth(full, fall(full), 200);
    for (let i = 1; i < gt.length; i++) expect(gt[i]).toBeGreaterThanOrEqual(gt[i - 1]);
    expect(gt[200]).toBe(3);
    expect(gf[200]).toBeLessThan(0.3);
    // the ripple that beads it is set where it has thinned: far shorter than the spout's own mode
    expect(jetOmega(trickle, fall(trickle), gt)).toBeGreaterThan(10 * trickle.omega);
  });

  it('the shader twin necks the same as the builder, and a neck below zero is a break', () => {
    const js = NECK_GLSL.replace(/float (\w+)\(([^)]*)\)/g, (_, n, args) => `function ${n}(${args.replace(/float /g, '')})`).replace(/float /g, 'let ');
    const twin = new Function('A', 'ph', `const { sin, min, max } = Math; ${js}; return jetNeck(A, ph);`);
    for (const A of [0, 0.1, 0.8, 3]) for (const ph of [0, 1, 2.5, 4.2, 5.9]) expect(twin(A, ph)).toBeCloseTo(jetNeck(A, ph), 9);
    expect(jetNeck(3, 4.712)).toBe(0);
  });

  it('spreads into a hydraulic jump that grows as Q^(5/8) and drowns under a deeper layer', () => {
    expect(jumpRadius(8e-5, 0) / jumpRadius(1e-5, 0)).toBeCloseTo(8 ** 0.625, 6);
    expect(jumpRadius(6e-5, 0)).toBeGreaterThan(0.02);
    expect(jumpRadius(6e-5, 0)).toBeLessThan(0.1);
    expect(jumpRadius(6e-5, 0.04)).toBeLessThan(0.01 * jumpRadius(6e-5, 0));
  });
});

describe('the sheet (water over a lip)', () => {
  it('pours at the critical depth and leaves the brink at q/h_b', () => {
    const j = sheetProfile({ W: 6, Q: 2 }), q = 2 / 6;
    expect(j.hc).toBeCloseTo(Math.cbrt((q * q) / 9.8), 9);
    expect(j.hb).toBeCloseTo(0.715 * j.hc, 9);
    expect(j.v0 * j.hb).toBeCloseTo(q, 9);
    expect(j.u0).toEqual([0, -j.v0, 0]);
  });

  it('a thin veil frays in metres, a broad river stays solid for tens; more flow throws farther', () => {
    const veil = sheetProfile({ W: 5, Q: 1.6 }), curtain = sheetProfile({ W: 26, Q: 45 });
    expect(veil.Lb).toBeLessThan(10);
    expect(curtain.Lb).toBeGreaterThan(18);
    expect(fallAeration(veil.Lb, 20)).toBe(1);
    expect(fallAeration(curtain.Lb, 10)).toBeLessThan(0.6);
    expect(fallAeration(curtain.Lb, 0)).toBe(0);
    const throwAt = (j) => -jetAt(j, jetHitTime(j, -30)).p[1];
    expect(throwAt(sheetProfile({ W: 5, Q: 4 }))).toBeGreaterThan(throwAt(veil));
  });

  it('a faucet never aerates by its fall; a landscape spout does', () => {
    expect(fallAeration(tap(0.2).Lb, 0.4)).toBe(0);
    const spout = jetProfile({ r0: 0.6, Q: 3 });
    expect(fallAeration(spout.Lb, 25)).toBeGreaterThan(0.9);
  });
});

describe('the basin it fills', () => {
  const B = { area: 0.18, drainR: 0.02, overflowH: 0.13, overflowW: 0.03 };
  const run = (Q, plug, secs, h = 0) => { for (let t = 0; t < secs * 120; t++) h = basinStep(h, 1 / 120, Q, plug, B); return h; };

  it('fills at Q/A with the plug in, and holds Torricelli\'s level with it out', () => {
    expect(run(2e-4, true, 10)).toBeCloseTo((2e-4 * 10) / 0.18, 9);
    const hs = (2e-4 / (0.6 * Math.PI * 0.02 * 0.02)) ** 2 / (2 * 9.8);
    expect(run(2e-4, false, 60)).toBeCloseTo(hs, 6);
    expect(run(0, false, 30, 0.05)).toBeLessThan(1e-4);                                   // pulled plug: it drains
  });

  it('the overflow caps it: a steady level a little over the slot', () => {
    const h = run(2e-4, true, 2000);
    expect(h).toBeGreaterThan(B.overflowH);
    expect(h).toBeLessThan(B.overflowH + 0.03);
    expect(run(2e-4, true, 60, h)).toBeCloseTo(h, 5);
  });

  it('a basin body starts empty, dishes to its drain, and a jet into it carries its geometry', () => {
    const M = 0.1, L = 10;
    const [b] = normalizeShallows([{ id: 'sink', kind: 'basin', at: [0, 0], size: [5, 3.6], ground: 8.5 }], { metersPerUnit: M });
    expect(b.grid.depth.every((d) => d <= 0)).toBe(true);
    expect(b.floor).toBeCloseTo(8.5 - 0.15 * L, 6);
    expect(b.drainZ).toBeLessThan(b.floor);
    expect(b.grid.dx).toBeCloseTo(0.012 * L, 1);
    const [j] = normalizeJets([{ at: [0, 1, 10.5], into: 'sink', flow: 0.06 }], { bodies: [b], metersPerUnit: M });
    expect(j.basin).toMatchObject({ area: 0.18, drainR: 0.02, plug: true });
    expect(j.basin.floor).toBe(b.drainZ);
    expect(basinFaces(b).length).toBeGreaterThan(16 * 12);
    expect(faucetFaces(j, { counter: 8.5 })).toHaveLength(24);
    const page = emitThreeWorld({ faces: basinFaces(b), shallows: { bodies: [b] }, jets: [j], metersPerUnit: M, inline: false });
    expect(page).toMatch(/stepJets\(t\);/);
    expect(page).toMatch(/function jetProfile/);                                          // the kernel the tests run, inlined
    expect(emitThreeWorld({ faces: basinFaces(b), shallows: { bodies: [b] }, inline: false })).not.toMatch(/stepJets/);
  });
});
