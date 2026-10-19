import { describe, it, expect, vi } from 'vitest';

const captured = { specs: null };
vi.mock('@/lib/motion/world-frames', () => ({
  renderWorldFrames: vi.fn(async (html, specs) => { captured.specs = specs; return { pngs: specs.map(() => Buffer.from('f')), width: 720, height: 540 }; }),
}));

const { renderWorldPlan } = await import('@/lib/motion/world-motion');
const { QUANTUM_LAW } = await import('./laws.js');
const { planQuantumWorld, planQuantumFilm } = await import('./world.js');

describe('science worlds: the quantum film', () => {
  it('circles an atom\'s clouds, then holds the end card short of the wrap', async () => {
    const manifest = { kind: 'quantum-view', model: { ...QUANTUM_LAW.hydrogen.example, samples: 200 } };
    const r = await renderWorldPlan({ sketch: { ref: 'sk_q', manifest }, params: {}, fps: 6 });
    expect(r.shots).toEqual(['run', 'end']);
    const plan = planQuantumWorld(manifest);
    const end = captured.specs.filter((s) => s.shot === 1).map((s) => s.t / 1000);
    expect(Math.max(...end)).toBeLessThan(plan.playback + plan.hold);
  });

  it('sways across the front of several orbitals side by side, so they never line up behind each other', () => {
    const plan = planQuantumWorld({ kind: 'quantum-view', model: { ...QUANTUM_LAW.hydrogen.example, samples: 200, state: { orbitals: [{ n: 1 }, { n: 2, l: 1, m: 0 }] } } });
    const keys = planQuantumFilm({}, plan).shoot.cameras[0].keys, c = plan.bounds.center;
    // the clouds sit along x: every key looks at them more from the front (y) than from the side (x)
    expect(keys.every((k) => Math.abs(k.pos[1] - c[1]) > Math.abs(k.pos[0] - c[0]))).toBe(true);
  });

  it('films a line\'s run and its end card', async () => {
    const r = await renderWorldPlan({ sketch: { ref: 'sk_l', manifest: { kind: 'quantum-view', model: QUANTUM_LAW.well.example } }, params: {}, fps: 6 });
    expect(r.shots).toEqual(['run', 'end']);
  });
});
