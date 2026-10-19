import { describe, it, expect } from 'vitest';
import { normalizeShoot, lowerShoot } from './plan.js';
import { programOf, shotAt, sampleProgram } from './sample.js';
import { shootChannelScript } from '../scene/channels/shoot.js';

// A shot's `speed` is a time stretch on the program clock: its span of the world plays slower (or faster).
const CAM = { id: 'c', keys: [{ t: 0, pos: [0, -5, 1], poi: [0, 0, 0] }, { t: 4, pos: [5, 0, 1], poi: [0, 0, 0] }] };

describe('shoot plan: a shot\'s speed', () => {
  it('stretches the shot on the program clock and plays its span of the world at that rate', () => {
    const { plan } = normalizeShoot({ cameras: [CAM], shots: [{ name: 'a', camera: 'c', span: [0, 2] }, { name: 'b', camera: 'c', span: [1, 2], speed: 0.25 }] });
    expect(plan.shots[1].speed).toBe(0.25);
    const program = programOf(plan);
    expect(program.shots[1].length).toBe(4);
    expect(program.total).toBe(6);
    expect(shotAt(program, 3).t).toBeCloseTo(1.25, 10);   // one second into the slowed shot: a quarter second of world
    expect(shotAt(program, 6).t).toBe(2);
    const frames = sampleProgram(plan, { fps: 4 });
    expect(frames.filter((f) => f.shot === 'b')).toHaveLength(17);   // four program seconds at 4 fps, and the closing frame
  });

  it('adds nothing to a plan without it, and refuses a speed out of range with a warning', () => {
    const { plan } = normalizeShoot({ cameras: [CAM], shots: [{ name: 'a', camera: 'c', span: [0, 2], speed: 1 }] });
    expect(plan.shots[0]).not.toHaveProperty('speed');
    const bad = normalizeShoot({ cameras: [CAM], shots: [{ name: 'a', camera: 'c', span: [0, 2], speed: 40 }] });
    expect(bad.plan.shots[0]).not.toHaveProperty('speed');
    expect(bad.warnings.join(' ')).toMatch(/outside/);
  });

  it('reaches the live page: the lowered shots carry it, and only then does the page clock stretch', () => {
    const plain = lowerShoot(normalizeShoot({ cameras: [CAM] }).plan);
    const slowed = lowerShoot(normalizeShoot({ cameras: [CAM], shots: [{ name: 'b', camera: 'c', span: [1, 2], speed: 0.5 }] }).plan);
    expect(slowed.shots[0]).toMatchObject({ speed: 0.5, length: 2 });
    expect(shootChannelScript(plain)).not.toContain('s.speed');
    expect(shootChannelScript(slowed)).toContain('(tau - s.start) * (s.speed || 1)');
  });
});
