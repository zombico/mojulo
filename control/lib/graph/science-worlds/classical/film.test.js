import { describe, it, expect, vi } from 'vitest';

// the capture is stubbed: these tests read the frames the film asks for (camera, page time, shot), not pixels
const captured = { specs: null, html: null };
vi.mock('@/lib/motion/world-frames', () => ({
  renderWorldFrames: vi.fn(async (html, specs) => {
    captured.specs = specs; captured.html = html;
    return { pngs: specs.map(() => Buffer.from('frame')), width: 720, height: 540 };
  }),
}));

const { renderWorldPlan } = await import('@/lib/motion/world-motion');
const { assembleClassicalScene, planClassicalWorld, planClassicalFilm } = await import('./world.js');
const { normalizeFilm, keyMoment, DEFAULT_REPLAY_SPEED } = await import('./film.js');
const { solveClassical } = await import('./solve.js');

const BOUNCE = {
  kind: 'classical-view',
  model: { bodies: [{ id: 'ball', mass: 0.06, radius: 0.033, at: [0, 0, 1.5], v: [0.6, 0, 0] }], laws: [{ law: 'gravity-uniform' }, { law: 'plane', e: 0.75 }], duration: 5 },
};
const PENDULUM = {
  kind: 'classical-view',
  model: { bodies: [{ id: 'bob', mass: 1, at: [0.866, 0, 0.5] }], laws: [{ law: 'gravity-uniform' }, { law: 'rod', between: ['bob', [0, 0, 1]] }], duration: 4 },
};
const film = (manifest, fps = 12) => renderWorldPlan({ sketch: { ref: 'sk_test', manifest }, params: {}, fps });

describe('science worlds: the classical film', () => {
  it('proposes run → slowed replay → end card, every frame on the run\'s own clock and never past the hold', async () => {
    const r = await film(BOUNCE);
    expect(r.shots).toEqual(['run', 'replay', 'end']);
    const plan = planClassicalWorld(BOUNCE), cycle = plan.playback + plan.hold;
    const byShot = (i) => captured.specs.filter((s) => s.shot === i).map((s) => s.t / 1000);
    const [run, replay, end] = [0, 1, 2].map(byShot);
    // the run plays in real page time; the replay advances a quarter as fast per frame
    expect(run[1] - run[0]).toBeCloseTo(1 / 12, 4);
    expect(replay[1] - replay[0]).toBeCloseTo(DEFAULT_REPLAY_SPEED / 12, 4);
    expect(Math.max(...run)).toBeCloseTo(plan.playback - 1 / 12, 4);   // the frame on the cut belongs to the next shot
    // the end card holds on the last frame and stops short of the wrap back to t = 0
    expect(Math.min(...end)).toBeGreaterThanOrEqual(plan.playback);
    expect(Math.max(...end)).toBeLessThan(cycle);
    // the replay is the first bounce: the key moment the solver found, inside the replay's span
    const key = planClassicalFilm(BOUNCE, plan).key;
    expect(key.why).toBe('the sharpest change in motion');
    expect(key.page).toBeGreaterThanOrEqual(Math.min(...replay));
    expect(key.page).toBeLessThanOrEqual(Math.max(...replay));
    expect(Math.abs(key.t - Math.sqrt((2 * (1.5 - 0.033)) / 9.8))).toBeLessThan(0.05);   // the first touch of the floor
    // the page the frames run on carries the science block, told it is a capture and which shot plays
    expect(captured.html).toContain('__sciShot = spec.shot');
  });

  it('maps every frame to a sample of the same recorded run the page plays', async () => {
    await film(PENDULUM);
    const plan = planClassicalWorld(PENDULUM), solved = solveClassical({ model: PENDULUM.model });
    const N = solved.tracks.t.length;
    for (const s of captured.specs) {
      const ph = (s.t / 1000) % (plan.playback + plan.hold);
      const u = ph < plan.playback ? ph / plan.playback : 1;
      const i = Math.round(u * (N - 1));
      // the model time the frame shows is the page time scaled by the run's rate, to within one sample
      expect(Math.abs(solved.tracks.t[i] - Math.min(ph, plan.playback) * plan.rate)).toBeLessThanOrEqual(PENDULUM.model.duration / (N - 1));
    }
  });

  it('takes the recipe\'s film dress: callouts on the model clock, a chosen moment, no replay, no card', () => {
    const m = { ...PENDULUM, model: { ...PENDULUM.model, duration: 8 }, dress: { playback: 4, film: { callouts: [{ at: 2, text: 'fastest here', on: 'bob' }], replay: { at: '1 s', speed: 0.5 } } } };
    const payload = assembleClassicalScene(m);
    // 8 s of model in 4 s of page: the callout at model t = 2 s shows at page t = 1 s
    expect(payload.science.film.callouts[0]).toMatchObject({ from: 1, text: 'fastest here', group: 'body:bob' });
    expect(payload.defaultShoot.shots.find((s) => s.name === 'replay')).toMatchObject({ speed: 0.5 });
    expect(payload.science.film.liberties[0].what).toMatch(/2× slower/);
    const plain = assembleClassicalScene({ ...m, dress: { film: { replay: false, end_card: false } } });
    expect(plain.defaultShoot.shots.map((s) => s.name)).toEqual(['run']);
    expect(plain.science.film.end).toBeUndefined();
  });

  it('keeps a recipe\'s own shoot plan, and reads its speeds for the slow-motion tag', () => {
    const shoot = { cameras: [{ id: 'cam', keys: [{ t: 0, pos: [0, -5, 1], poi: [0, 0, 0.5] }] }], shots: [{ name: 'all', camera: 'cam', span: [0, 4] }, { name: 'slow', camera: 'cam', span: [1, 2], speed: 0.2 }] };
    const payload = assembleClassicalScene({ ...PENDULUM, shoot });
    expect(payload.defaultShoot).toBeUndefined();
    expect(payload.science.film.speeds).toEqual([1, 0.2]);
  });

  it('checks the film dress', () => {
    const bodies = [{ id: 'ball' }];
    expect(() => normalizeFilm({ captions: [] }, bodies)).toThrow(/unknown field 'captions'/);
    expect(() => normalizeFilm({ callouts: [{ at: 1, text: 'x', on: 'nobody' }] }, bodies)).toThrow(/no body 'nobody'/);
    expect(() => normalizeFilm({ callouts: [{ at: [2, 1], text: 'x' }] }, bodies)).toThrow(/ends before it starts/);
    expect(() => normalizeFilm({ replay: { speed: 2 } }, bodies)).toThrow(/between 0.1 and 1/);
    expect(normalizeFilm({ callouts: [{ at: [250, 'ms'], text: 'x' }] }, bodies).callouts[0].at).toEqual([0.25]);
    expect(normalizeFilm({ callouts: [{ at: ['1 s', '2 s'], text: 'x' }] }, bodies).callouts[0].at).toEqual([1, 2]);
  });

  it('finds the fastest moment when nothing in the run is sudden (the bottom of a swing)', () => {
    const solved = solveClassical({ model: PENDULUM.model });
    const key = keyMoment(solved);
    expect(key.why).toBe('the fastest moment');
    const k = solved.tracks.t.indexOf(solved.tracks.t.find((t) => t === key.t));
    expect(Math.abs(solved.tracks.bodies.bob.x[k][2])).toBeLessThan(0.02);   // at the bottom (z ≈ 0)
  });
});
