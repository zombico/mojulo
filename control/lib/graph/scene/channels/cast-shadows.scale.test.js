/**
 * cast-shadows at rock scale (nature-scenes.plan.md N2). Claims under test: without `bias` / `fitMin` the script
 * carries the city-scale literals exactly as before (1.1 world units of contact slack, a 60-unit FIT floor, a 0.5
 * near plane); declared, they land in the script and the near plane follows the box; emitThreeWorld passes them
 * through only when declared.
 */
import { describe, expect, it } from 'vitest';

import { castShadowScript } from './cast-shadows.js';
import { emitThreeWorld } from '../scene-three.js';

const BASE = { toLight: [0.5, 0.4, 0.7], alpha: 0.4, mapSize: 2048, span: 420 };

describe('cast shadows at rock scale', () => {
  it('absent: the city-scale literals, unchanged', () => {
    const s = castShadowScript(BASE);
    expect(s).toContain('__csBiasU.value = 1.1 / (c.far - c.near);');
    expect(s).toContain('__csR = Math.min(Math.max(__csR, 60), 1600);');
    expect(s).toContain('c.near = 0.5; c.far = half * 5;');
  });
  it('declared: the slack and floor are the scene\'s, and the near plane follows the box', () => {
    const s = castShadowScript({ ...BASE, bias: 0.02, fitMin: 0.4 });
    expect(s).toContain('__csBiasU.value = 0.02 / (c.far - c.near);');
    expect(s).toContain('__csR = Math.min(Math.max(__csR, 0.4), 1600);');
    expect(s).toContain('c.near = Math.min(0.5, half * 0.05); c.far = half * 5;');
  });
  it('emitThreeWorld passes them through only when declared', () => {
    const faces = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#888888' }];
    const plain = emitThreeWorld({ faces, shadows: { cast: true } });
    const rock = emitThreeWorld({ faces, shadows: { cast: true, bias: 0.05, fitMin: 2 } });
    expect(plain).not.toContain('"bias"'); expect(plain).toContain('__csBiasU.value = 1.1');
    expect(rock).toContain('"bias":0.05'); expect(rock).toContain('__csBiasU.value = 0.05');
  });
});
