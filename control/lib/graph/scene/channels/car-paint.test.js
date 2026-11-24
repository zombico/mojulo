// Car paint (car-paint.js): a clear coat over the pooled vehicles, on a page whose finish asks to reflect. The
// concepts: the coat is laid on the paint and the trim each its own; a page that asks for none carries none of it.
import { describe, it, expect } from 'vitest';
import { carPaintScript, CAR_COAT } from './car-paint.js';
import { flowChannelScript } from './flow.js';
import { cabPoolScript } from './cab-pool.js';

const env = { zenith: [0.24, 0.38, 0.59], horizon: [0.89, 0.74, 0.6], ground: [0.31, 0.26, 0.21] };
const flow = { T: 1, signals: [{ cycle: 30 }], kinds: [{ model: 'sedan', len: 4.5 }], tints: [[1, 0, 0]], lanes: [{ axis: 'x', cross: 0, lo: 0, hi: 10, dir: 1, z: [[0, 0]] }], cars: [[0, 0, 0, 0]] };

describe('car paint', () => {
  it('a clear coat: the sky by Fresnel and the sun\'s glint, the paint\'s and the trim\'s each their own', () => {
    const page = carPaintScript(env, [0.6, -0.78, 0.13]);
    expect(page).toContain('const __carCoat');
    expect(page).toContain("'car-coat-' + part");
    expect(page).toContain(JSON.stringify(CAR_COAT));
    expect(CAR_COAT.paint.coat).toBeGreaterThan(CAR_COAT.trim.coat);
  });

  it('the traffic and the cars a player takes wear it only on a page that asks; any other page as it was', () => {
    expect(flowChannelScript(flow).includes('__carCoat')).toBe(false);
    expect(flowChannelScript(flow, { coat: true })).toContain("__flCoat[part] || __flMat");
    expect(cabPoolScript({ patrol: true }).includes('__carCoat')).toBe(false);
    expect(cabPoolScript({ patrol: true, coat: true }).match(/__carCoat\(/g).length).toBe(3);
  });
});
