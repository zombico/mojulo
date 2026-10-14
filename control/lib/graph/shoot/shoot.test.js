import { describe, it, expect } from 'vitest';
import { hfovForFocal, focalForHfov, parseLens, FILM_MM } from './lens.js';
import { easeFraction, compileCamera, cameraAt, sampleProgram, programOf, shotAt } from './sample.js';
import { normalizeShoot, shootReadout, lowerShoot, parseEase, parseCameraType } from './plan.js';

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// the smallest plan that exercises every channel: a two-node dolly past a subject with a lens change
const DOLLY = {
  fps: 24,
  cameras: [{
    id: 'a', type: 'two-node', lens: '35mm',
    keys: [
      { t: 0, pos: [-10, -12, 2], look_at: [0, 0, 1], ease: 'easy ease' },
      { t: 2, pos: [0, -8, 3] },
      { t: 5, pos: [10, -12, 2], poi: [2, 0, 1], focal_mm: 85, ease: 'easy ease in' },
    ],
  }],
};

describe('lens', () => {
  it('a 50mm lens on 36mm film sees 39.6° across', () => {
    expect(hfovForFocal(50)).toBeCloseTo(39.598, 3);
  });
  it('focal → field of view → focal round-trips', () => {
    for (const f of [15, 35, 200]) expect(focalForHfov(hfovForFocal(f, FILM_MM), FILM_MM)).toBeCloseTo(f, 9);
  });
  it('reads the words people use', () => {
    expect(parseLens('35mm')).toBe(35);
    expect(parseLens('85 MM')).toBe(85);
    expect(parseLens({ hfov: hfovForFocal(24) })).toBeCloseTo(24, 9);
    expect(parseLens('wide')).toBeNull();
  });
});

describe('timing (the AE ease model)', () => {
  it('two linear sides are the identity', () => {
    for (const u of [0.1, 0.5, 0.9]) expect(easeFraction(u, false, false)).toBe(u);
  });
  it('easy ease on both sides is symmetric and leaves at zero speed', () => {
    expect(easeFraction(0.5, true, true)).toBeCloseTo(0.5, 6);
    expect(easeFraction(0.01, true, true)).toBeLessThan(0.01 * 0.2);
    expect(1 - easeFraction(0.99, true, true)).toBeLessThan(0.01 * 0.2);
  });
  it('ease out only starts slow and arrives at speed', () => {
    expect(easeFraction(0.01, true, false)).toBeLessThan(0.002);
    expect(1 - easeFraction(0.99, true, false)).toBeGreaterThan(0.005);
  });
});

describe('the sampler', () => {
  const { plan } = normalizeShoot(DOLLY);
  const cam = plan.cameras[0];
  const c = compileCamera(cam);

  it('hits every key exactly', () => {
    for (const k of cam.keys) {
      const at = cameraAt(c, k.t);
      expect(dist(at.pos, k.pos)).toBeLessThan(1e-9);
      expect(dist(at.look, k.poi)).toBeLessThan(1e-9);
      expect(at.hfov).toBeCloseTo(hfovForFocal(k.focal_mm), 9);
    }
  });

  it('linear timing moves at constant speed along the curve', () => {
    const lin = compileCamera({ ...cam, keys: cam.keys.map((k) => ({ ...k, ease: 'linear' })) });
    // inside the middle segment (both its keys linear) equal times cover equal arc length
    const steps = [];
    let prev = cameraAt(lin, 2).pos;
    for (let j = 1; j <= 12; j++) { const p = cameraAt(lin, 2 + 3 * j / 12).pos; steps.push(dist(prev, p)); prev = p; }
    const mean = steps.reduce((a, b) => a + b) / steps.length;
    for (const s of steps) expect(Math.abs(s - mean) / mean).toBeLessThan(0.01);
  });

  it('a hold key freezes until the next key', () => {
    const held = compileCamera({ ...cam, keys: cam.keys.map((k, i) => (i === 0 ? { ...k, ease: 'hold' } : k)) });
    expect(cameraAt(held, 1.99).pos).toEqual(cam.keys[0].pos);
    expect(dist(cameraAt(held, 2).pos, cam.keys[1].pos)).toBeLessThan(1e-9);
  });

  it('a one-node camera aims by yaw and pitch', () => {
    const { plan: p } = normalizeShoot({ cameras: [{ type: 'one-node', keys: [{ t: 0, pos: [0, 0, 2], yaw: 90, pitch: 0 }] }] });
    const at = cameraAt(compileCamera(p.cameras[0]), 0);
    expect(at.look[0]).toBeCloseTo(0, 9);
    expect(at.look[1]).toBeGreaterThan(at.pos[1]);
    expect(at.look[2]).toBeCloseTo(2, 9);
  });

  it('the program cuts between shots and samples one frame per tick', () => {
    const two = normalizeShoot({ ...DOLLY, shots: [{ name: 'wide', camera: 'a', span: [0, 2] }, { name: 'push', camera: 'a', span: [3, 5] }] }).plan;
    const prog = programOf(two);
    expect(prog.total).toBe(4);
    expect(shotAt(prog, 2.5)).toMatchObject({ index: 1, t: 3.5 });
    const frames = sampleProgram(two);
    expect(frames).toHaveLength(4 * 24 + 1);
    expect(frames[0].shot).toBe('wide');
    expect(frames.at(-1).shot).toBe('push');
    expect(frames[10].worldFraming.cameraPosition).toHaveLength(3);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(sampleProgram(plan))).toBe(JSON.stringify(sampleProgram(normalizeShoot(DOLLY).plan)));
  });
});

describe('the recipe', () => {
  it('reads AE words into the canonical form', () => {
    expect(parseEase('Easy Ease')).toBe('easy_ease');
    expect(parseEase('easyEaseOut')).toBe('easy_ease_out');
    expect(parseCameraType('Two-Node')).toBe('two_node');
    const { plan, warnings } = normalizeShoot(DOLLY);
    expect(warnings).toEqual([]);
    const cam = plan.cameras[0];
    expect(cam.type).toBe('two_node');
    expect(cam.keys.map((k) => k.focal_mm)).toEqual([35, 35, 85]);       // the lens carries forward
    expect(cam.keys[1].poi).toEqual([0, 0, 1]);                            // and so does the point of interest
    expect(cam.keys.map((k) => k.ease)).toEqual(['easy_ease', 'linear', 'easy_ease_in']);
    expect(plan.shots).toEqual([{ name: 'a', camera: 'a', span: [0, 5] }]);
  });

  it('is idempotent', () => {
    const once = normalizeShoot(DOLLY).plan;
    expect(normalizeShoot(once).plan).toEqual(once);
  });

  it('sorts keys, warns on what it drops', () => {
    const { plan, warnings } = normalizeShoot({ cameras: [{ keys: [{ t: 4, pos: [1, 0, 0], poi: [0, 0, 0] }, { t: 1, pos: [0, 1, 0] }, { t: 2 }] }] });
    expect(plan.cameras[0].keys.map((k) => k.t)).toEqual([1, 4]);
    expect(warnings.some((w) => /no position/.test(w))).toBe(true);
  });

  it('refuses nothing it can read and returns null when nothing survives', () => {
    expect(normalizeShoot({ cameras: [{ keys: [] }] }).plan).toBeNull();
    expect(normalizeShoot(null).plan).toBeNull();
  });

  it('a one-key camera holds a still for a default shot length', () => {
    const { plan } = normalizeShoot({ cameras: [{ keys: [{ pos: [5, 5, 2], poi: [0, 0, 0] }] }] });
    expect(plan.shots[0].span).toEqual([0, 3]);
  });

  it('the readout measures the move', () => {
    const r = shootReadout(normalizeShoot(DOLLY).plan);
    expect(r.duration_s).toBe(5);
    expect(r.cameras[0].lens_mm).toEqual([35, 85]);
    expect(r.cameras[0].path_units).toBeGreaterThan(20);   // at least the straight-line distance through the keys
    expect(r.cameras[0].peak_speed_units_s).toBeGreaterThan(r.cameras[0].path_units / 5);
    expect(shootReadout(normalizeShoot(DOLLY).plan, { metersPerUnit: 2 }).cameras[0].path_m).toBeCloseTo(r.cameras[0].path_units * 2, 1);
  });

  it('lowers to what the page draws', () => {
    const low = lowerShoot(normalizeShoot(DOLLY).plan);
    const cam = low.cameras[0];
    expect(cam.track.n).toBe(5 * 24 + 1);
    expect(cam.track.pos).toHaveLength(cam.track.n * 3);
    expect(cam.path[0]).toEqual([-10, -12, 2]);
    expect(cam.path.at(-1)).toEqual([10, -12, 2]);
    expect(cam.poiPath).toBeDefined();   // the point of interest moves from [0,0,1] to [2,0,1]
  });
});

describe('follow: a camera on something that moves', async () => {
  const { shootSubjects, followPoint } = await import('./subjects.js');
  const { sampleCameraTrack } = await import('./sample.js');
  // a car driving +x along a 20-unit lane at 2 units/s (the constant-speed wrap), and a looping mover going +y
  const PAYLOAD = {
    cars: [{ car: 'sedan', path: [[0, 0, 0], [20, 0, 0]], speed: 2 }],
    carMeshes: { sedan: { pos: '', col: '' } },
    movers: [{ group: 'ball', path: [[0, 0, 1], [0, 10, 1]], period: 5, loop: true }],
  };
  const subjects = shootSubjects(PAYLOAD);

  it('names what moves on a schedule, and reads it as the page does', () => {
    expect([...subjects.keys()]).toEqual(['car:0', 'mover:ball']);
    expect(subjects.get('car:0').at(3).pos).toEqual([6, 0, 0]);
    expect(subjects.get('mover:ball').at(2.5).pos[1]).toBeCloseTo(5, 9);
  });

  it('an offset in the subject frame turns with its heading', () => {
    const behind = followPoint({ follow: 'mover:ball', offset: [-2, 0, 1], frame: 'subject' }, subjects, 1);   // heading +y
    expect(behind[0]).toBeCloseTo(0, 9);
    expect(behind[1]).toBeCloseTo(2 - 2, 9);
    expect(behind[2]).toBeCloseTo(2, 9);
  });

  const PAN = { cameras: [{ id: 'pan', keys: [
    { t: 0, pos: [10, -8, 2], poi: { follow: 'car:0', offset: [0, 0, 0.5] }, ease: 'easy ease out' },
    { t: 4, pos: { follow: 'car:0', offset: [-3, 0, 1], frame: 'subject' }, poi: { follow: 'car:0', offset: [3, 0, 0], frame: 'subject' } },
  ] }] };

  it('aims at the subject wherever it is, and eases a fixed key onto it', () => {
    const { plan } = normalizeShoot(PAN, { subjects });
    const c = compileCamera(plan.cameras[0], { subjects });
    expect(cameraAt(c, 0).look).toEqual([0, 0, 0.5]);
    expect(dist(cameraAt(c, 4).pos, [8 - 3, 0, 1])).toBeLessThan(1e-9);    // the car at 8, the camera 3 behind it
    const mid = cameraAt(c, 2).pos;                                        // between the fixed place and the tail
    expect(mid[0]).toBeGreaterThan(4); expect(mid[0]).toBeLessThan(10);
    expect(cameraAt(c, 6).pos[0]).toBeCloseTo(12 - 3, 9);                  // past the last key it keeps riding along
  });

  it('a follow nobody can find is dropped with a warning, not thrown', () => {
    const { plan, warnings } = normalizeShoot({ cameras: [{ keys: [
      { t: 0, pos: [0, -5, 2], poi: [0, 0, 0] },
      { t: 2, pos: { follow: 'car:9' } },
      { t: 3, pos: [0, -4, 2], poi: { follow: 'walker:4' } },
    ] }] }, { subjects });
    expect(plan.cameras[0].keys.map((k) => k.t)).toEqual([0, 3]);
    expect(plan.cameras[0].keys[1].poi).toEqual([0, 0, 0]);   // the aim before it is kept
    expect(warnings.some((w) => /car:9/.test(w))).toBe(true);
    expect(warnings.some((w) => /walker:4/.test(w))).toBe(true);
  });

  it('the drawn path of a following camera is its track, beside the route of what it follows', () => {
    const { plan } = normalizeShoot(PAN, { subjects });
    const low = lowerShoot(plan, { subjects });
    const cam = low.cameras[0];
    const track = sampleCameraTrack(plan.cameras[0], plan.fps, { subjects });
    expect(cam.path).toHaveLength(track.n);
    expect(cam.follows.map((f) => f.id)).toEqual(['car:0']);
    expect(cam.follows[0].path.at(-1)).toEqual([8, 0, 0]);
    expect(shootReadout(plan, { subjects }).cameras[0].follows).toEqual(['car:0']);
  });

  it('a frame shows the world at its camera time', () => {
    const { plan } = normalizeShoot({ ...PAN, shots: [{ camera: 'pan', span: [2, 4] }] }, { subjects });
    const frames = sampleProgram(plan, { subjects });
    expect(frames[0]).toMatchObject({ t: 0, world_t: 2 });
    expect(frames.at(-1)).toMatchObject({ t: 2, world_t: 4 });
  });
});
