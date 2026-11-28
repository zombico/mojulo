// THE CRAG (field.js form `crag`, local-meru/massif.js card `crag`): a rock in the belt broken up, its spurs the cover a
// frame needs from what fights it from overhead. Measured against the plain asteroid it is drawn beside: far more of it
// stands tall, its tallest rock well over a frame's height again, and its middle stays open (what is defended stands there).
import { describe, expect, it } from 'vitest';
import { frameField, frameFieldCube, MASSIF_FORMS } from './field.js';

function relief(form, N = 60) {
  const F = frameField(frameFieldCube(form)), [cx, cy] = F.centre, h = F.half, H = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H.push({ u: i / (N - 1) * 2 - 1, v: j / (N - 1) * 2 - 1, z: F.heightAt(cx + (i / (N - 1) * 2 - 1) * h, cy + (j / (N - 1) * 2 - 1) * h) });
  const zs = H.map((p) => p.z).sort((a, b) => a - b), floor = zs[Math.floor(zs.length * 0.2)];
  return { tall: H.filter((p) => p.z - floor > 25).length / H.length, top: zs.at(-1) - floor, middle: Math.max(...H.filter((p) => Math.hypot(p.u, p.v) < 0.12).map((p) => p.z - floor)) };
}

describe('the crag', () => {
  it('is a form of its own, its own battlefield cube', () => {
    expect(MASSIF_FORMS.crag).toBe('belt-crag');
    expect(frameFieldCube('crag').outside).toBeTruthy();
  });

  it('stands far taller than the asteroid it is drawn beside, its middle left open', () => {
    const A = relief('asteroid'), C = relief('crag');
    expect(C.tall).toBeGreaterThan(A.tall * 5);
    expect(C.tall).toBeGreaterThan(0.05);
    expect(C.top).toBeGreaterThan(45);
    expect(C.middle).toBeLessThan(20);   // (a ledge or a crater's rim, never a spur: those stand 15 m and more, well out)
  });
});
