// A REPEAT'S SLOPE: a flat piece laid on sloped ground (a street's paint) carries `slope` [dz/dx, dz/dy] on its
// transform; the page shears that instance to lie on the plane about its own place. A page with none carries not a byte.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { emitThreeWorld } from './scene-three.js';

const quad = (z, hex, s = 1) => ({ corners: [[-s, -s, z], [s, -s, z], [s, s, z], [-s, s, z]], normal: [0, 0, 1], fill: hex });
const floor = { ...quad(0, '#777777', 50), group: 'ground' };
const mark = (transforms) => [{ group: 'paint', template: [quad(0, '#ffffff')], transforms }];
const parses = (html) => {
  const src = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] }); return null; } catch (e) { return String(e.stderr || e.message).slice(0, 400); }
};

describe('a repeat\'s slope', () => {
  it('rides beside the transforms, one a piece and 0 where none, and the page shears by it', () => {
    const html = emitThreeWorld({ faces: [floor], repeats: mark([{ pos: [0, 0, 0], slope: [0.05, -0.02] }, { pos: [4, 0, 0] }, { pos: [8, 0, 0], slope: [0, 0] }]) });
    expect(html).toContain('"sl":[[0.05,-0.02],0,0]');
    expect(html).toContain('e[2] += sl[0] * e[0] + sl[1] * e[1]');
    expect(parses(html)).toBe(null);
    // (near the camera only, the tiled path: sheared there too)
    const near = emitThreeWorld({ faces: [floor], repeats: [{ ...mark([{ pos: [0, 0, 0], slope: [0.05, 0] }])[0], near: 60 }] });
    expect(near.match(/e\[2\] \+= sl\[0\]/g).length).toBeGreaterThanOrEqual(2);
    expect(parses(near)).toBe(null);
  });
  it('a page whose repeats have none is the page it was', () => {
    const html = emitThreeWorld({ faces: [floor], repeats: mark([{ pos: [0, 0, 0] }]) });
    expect(html).not.toContain('"sl"');
    expect(html).not.toContain('sl[0]');
  });
  it('the shear lays a level piece on the plane through its place, whatever its turn and size', () => {
    // (the page's arithmetic, on a column-major matrix: z gains slope · (x, y) of each basis vector)
    const a = 0.7, c = Math.cos(a), s = Math.sin(a), k = 2, e = [c * k, s * k, 0, 0, -s * k, c * k, 0, 0, 0, 0, k, 0, 5, 6, 7, 1], sl = [0.05, -0.02];
    e[2] += sl[0] * e[0] + sl[1] * e[1]; e[6] += sl[0] * e[4] + sl[1] * e[5]; e[10] += sl[0] * e[8] + sl[1] * e[9];
    for (const [lx, ly] of [[1, 0], [0, 1], [3, -2]]) {
      const wx = e[0] * lx + e[4] * ly + e[12], wy = e[1] * lx + e[5] * ly + e[13], wz = e[2] * lx + e[6] * ly + e[14];
      expect(wz).toBeCloseTo(7 + sl[0] * (wx - 5) + sl[1] * (wy - 6), 9);
    }
  });
});
