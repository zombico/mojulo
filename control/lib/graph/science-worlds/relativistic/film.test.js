import { describe, it, expect, vi } from 'vitest';

const captured = { specs: null };
vi.mock('@/lib/motion/world-frames', () => ({
  renderWorldFrames: vi.fn(async (html, specs) => { captured.specs = specs; return { pngs: specs.map(() => Buffer.from('f')), width: 720, height: 540 }; }),
}));

const { renderWorldPlan } = await import('@/lib/motion/world-motion');
const { RELATIVISTIC_LAW } = await import('./laws.js');
const { planRelativisticWorld, planRelativisticFilm } = await import('./world.js');

describe('science worlds: the relativistic film', () => {
  it('swings a light world\'s eye toward the disk\'s plane at the observer\'s distance, then holds the end card', async () => {
    const manifest = { kind: 'relativistic-view', model: RELATIVISTIC_LAW.observer.example };
    const r = await renderWorldPlan({ sketch: { ref: 'sk_bh', manifest }, params: {}, fps: 4 });
    expect(r.shots).toEqual(['run', 'end']);
    const plan = planRelativisticWorld(manifest), keys = planRelativisticFilm(manifest, plan).shoot.cameras[0].keys;
    const D = plan.solved.model.distance;
    expect(keys.every((k) => Math.abs(Math.hypot(...k.pos) - D) < 1e-3)).toBe(true);
    expect(Math.acos(keys[keys.length - 1].pos[2] / D)).toBeGreaterThan(Math.acos(keys[0].pos[2] / D));
    expect(Math.max(...captured.specs.filter((s) => s.shot === 1).map((s) => s.t / 1000))).toBeLessThan(plan.playback + plan.hold);
  });

  it('films an orbit world\'s run and its end card', async () => {
    const r = await renderWorldPlan({ sketch: { ref: 'sk_o', manifest: { kind: 'relativistic-view', model: RELATIVISTIC_LAW.body.example } }, params: {}, fps: 4 });
    expect(r.shots).toEqual(['run', 'end']);
  });
});
