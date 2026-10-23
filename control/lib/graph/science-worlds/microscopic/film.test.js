import { describe, it, expect, vi } from 'vitest';

const captured = { specs: null };
vi.mock('@/lib/motion/world-frames', () => ({
  renderWorldFrames: vi.fn(async (html, specs) => { captured.specs = specs; return { pngs: specs.map(() => Buffer.from('f')), width: 720, height: 540 }; }),
}));

const { renderWorldPlan } = await import('@/lib/motion/world-motion');
const { MICROSCOPIC_LAW } = await import('./laws.js');
const { planMicroscopicWorld, planMicroscopicFilm } = await import('./world.js');

describe('science worlds: the microscopic film', () => {
  it('replays the first reaction slowed down, then holds the end card short of the wrap', async () => {
    const manifest = { kind: 'microscopic-view', model: MICROSCOPIC_LAW.reaction.example };
    const r = await renderWorldPlan({ sketch: { ref: 'sk_m', manifest }, params: {}, fps: 12 });
    expect(r.shots).toEqual(['run', 'replay', 'end']);
    const plan = planMicroscopicWorld(manifest), film = planMicroscopicFilm(manifest, plan);
    expect(film.key.why).toBe('the first reaction');
    const end = captured.specs.filter((s) => s.shot === 2).map((s) => s.t / 1000);
    expect(Math.max(...end)).toBeLessThan(plan.playback + plan.hold);
  });

  it('films the run and its end card when nothing reacts', async () => {
    const r = await renderWorldPlan({ sketch: { ref: 'sk_d', manifest: { kind: 'microscopic-view', model: MICROSCOPIC_LAW.brownian.example } }, params: {}, fps: 6 });
    expect(r.shots).toEqual(['run', 'end']);
  });
});
