// The STAGE GUIDE (scene-staging.plan.md, S0) — declares the ground plane so a
// painted plate inherits scale/floor by construction. Pure geometry + a
// deterministic machine audit (dims, register marks removed, sky≠ground).
import { describe, it, expect } from 'vitest';
import {
  buildStageGuide, stageGuideSvg, stageOverlaySvg, personSvg, auditStagePlate, REGISTER_COLOR,
} from './stage-guide.js';

const STAGE = {
  unit: 859, dRef: 1, horizonY: 500, groundYRef: 1037,
  plate: { width: 3072, height: 1216 },
};
const FRAME = { width: 832, height: 1216 };

describe('buildStageGuide', () => {
  const g = buildStageGuide(STAGE, { frame: FRAME, depthTicks: [1, 2, 3] });
  it('sizes to the plate and centers the default frame viewport', () => {
    expect(g.width).toBe(3072);
    expect(g.frame.x).toBe((3072 - 832) / 2);
    expect(g.frame.w).toBe(832);
  });
  it('tick figures inherit footY and span from the kernel', () => {
    const t1 = g.ticks.find((t) => t.depth === 1);
    const t2 = g.ticks.find((t) => t.depth === 2);
    expect(t1.footY).toBe(1037);
    expect(t1.span).toBe(859);
    expect(t2.footY).toBeCloseTo(768.5, 5);
    expect(t2.span).toBe(429.5); // deeper = smaller, standing higher
  });
});

describe('SVG emitters', () => {
  const g = buildStageGuide(STAGE, { frame: FRAME });
  it('the guide SVG carries the register color, horizon, and frame box', () => {
    const svg = stageGuideSvg(g);
    expect(svg).toContain(REGISTER_COLOR);
    expect(svg).toContain(`y1='500'`);           // horizon line
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('</svg>');
  });
  it('the overlay omits fills and uses the eyes-gate color, not the register color', () => {
    const svg = stageOverlaySvg(g);
    expect(svg).toContain('#00ff88');
    expect(svg).not.toContain('<rect width'); // no sky/ground fills — transparent overlay
  });
  it('personSvg scales with span and plants feet at footY', () => {
    const svg = personSvg(400, 1000, 800);
    expect(svg).toContain('<circle cx=\'400\'');    // head at the figure's x
    expect(svg).toContain(`y2='1000'`);             // feet line at footY
    // head diameter scales with span: r = span*0.065
    expect(svg).toContain(`r='${800 * 0.065}'`);
  });
});

describe('auditStagePlate — the machine gate', () => {
  const g = buildStageGuide(STAGE, { frame: FRAME });
  const W = 3072; const H = 1216;
  const paint = (skyRGB, groundRGB, leakPixels = 0) => {
    const raw = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i += 1) {
      const y = (i / W) | 0;
      const [r, gg, b] = y < g.horizonY ? skyRGB : groundRGB;
      raw[i * 4] = r; raw[i * 4 + 1] = gg; raw[i * 4 + 2] = b; raw[i * 4 + 3] = 255;
    }
    for (let i = 0; i < leakPixels; i += 1) { raw[i * 4] = 0xff; raw[i * 4 + 1] = 0x2b; raw[i * 4 + 2] = 0xd6; }
    return raw;
  };

  it('passes a clean painted plate (sky≠ground, no register leak)', () => {
    const a = auditStagePlate(paint([150, 180, 220], [90, 130, 70]), W, H, g);
    expect(a.dims).toBe(true);
    expect(a.linesRemoved).toBe(true);
    expect(a.groundDistinct).toBe(true);
    expect(a.pass).toBe(true);
  });

  it('fails when the worker left magenta guide marks (register leak)', () => {
    const a = auditStagePlate(paint([150, 180, 220], [90, 130, 70], 20000), W, H, g);
    expect(a.linesRemoved).toBe(false);
    expect(a.pass).toBe(false);
  });

  it('flags a flat wash as ground-indistinct (advisory, not a hard fail)', () => {
    const a = auditStagePlate(paint([150, 180, 220], [150, 180, 220]), W, H, g);
    expect(a.groundDistinct).toBe(false);
    expect(a.pass).toBe(true); // dims + linesRemoved still hold → advisory only
  });

  it('fails on a dimension mismatch', () => {
    const a = auditStagePlate(paint([150, 180, 220], [90, 130, 70]), 800, 600, g);
    expect(a.dims).toBe(false);
    expect(a.pass).toBe(false);
  });
});
