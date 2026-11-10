// the hover bot on a capture page in headless Chromium (scene/hover-bot.js): a little world of a slab with a step on it,
// flown across and teleported over. The e2e tier's (vitest.config.js E2E).
import { describe, it, expect } from 'vitest';
import { emitThreeWorld } from './scene-three.js';
import { openHoverBot, HOVER } from './hover-bot.js';

const quad = (x0, y0, x1, y1, z, group, fill) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill, group });
const wall = (x, y0, y1, z0, z1, group) => ({ corners: [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], fill: '#777777', group });
const faces = [quad(0, 0, 10, 10, 0, 'ground', '#557755'), quad(10, 0, 20, 10, 0.5, 'step', '#888888'), wall(10, 0, 10, 0, 0.5, 'step')];

describe('the hover bot, live', () => {
  it('stands its eye over the ground it finds, and flies a path at its speed, saying the step and the hole', async () => {
    const bot = await openHoverBot(emitThreeWorld({ faces, capture: true, inline: true, viewBox: { width: 320, height: 240 } }), { width: 320, height: 240, settleMs: 300 });
    try {
      expect((await bot.ground(5, 5)).z).toBeCloseTo(0, 3);
      expect((await bot.ground(15, 5)).group).toBe('step');
      expect(await bot.ground(30, 5)).toBeNull();
      const t = await bot.teleport({ at: [15, 5], heading: Math.PI });
      expect(t.eye[2]).toBeCloseTo(0.5 + HOVER.height, 3);
      expect(t.triangles).toBeGreaterThan(0);
      const F = await bot.fly({ path: [[2, 5], [24, 5]], speed: 'jog' });
      expect(F.report.steps).toHaveLength(1);
      expect(F.report.steps[0].dz).toBeCloseTo(0.5, 3);
      expect(F.report.holes.length).toBeGreaterThan(0);
      expect(F.report.groups.ground).toBeGreaterThan(0);
    } finally { await bot.close(); }
  }, 180000);
});
