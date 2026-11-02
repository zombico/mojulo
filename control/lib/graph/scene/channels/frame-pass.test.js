/**
 * The frame pass (scene/channels/frame-pass.js): one depth-aware softening of the far over the whole frame, asked by the
 * air's blur and by the view cone's `soften` (the crust: the impressions past the reach), each pixel taking the larger.
 * It is wrapped round three's render first, hands the scene's hooks no target, keeps the plain frame where it cannot run,
 * and is not on the page when neither asks.
 */
import { describe, expect, it } from 'vitest';

import { FRAME_PASS, framePassScript } from './frame-pass.js';
import { readAtmosphere, atmosphereInput } from './atmosphere.js';
import { VIEW_CONE, readCone } from './view-cone.js';
import { emitThreeWorld } from '../scene-three.js';

const air = (o = 'mist') => atmosphereInput(readAtmosphere(o), { sun: [0, -0.5, 0.8] });
const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], normal: [0, 0, 1], fill: '#888888' };

describe('the frame pass', () => {
  it('is asked by the air\'s blur, by the crust\'s soften, or both, and by neither not at all', () => {
    expect(framePassScript({})).toBe('');
    expect(framePassScript({ air: air({ kind: 'mist', blur: false }) })).toBe('');
    const a = framePassScript({ air: air() }), c = framePassScript({ soften: 1.5 }), b = framePassScript({ air: air(), soften: 1.5 });
    for (const src of [a, b, c]) expect(() => new Function('THREE', 'scene', 'renderer', src)).not.toThrow();
    expect(a).toContain('airDepth(');
    expect(c).not.toContain('airDepth(');
    expect(c).toContain(`uSoft * clamp( ( z - uReach ) / max( uReach * ${(FRAME_PASS.span - 1).toFixed(1)}, 1.0 ), 0.0, 1.0 )`);
    // (both: a pixel takes the larger)
    expect(b).toContain('r = max( r, uSoft * clamp(');
  });

  it('holds what the canvas would, wraps three\'s render, hands the hooks no target, and keeps the plain frame where it cannot run', () => {
    const src = framePassScript({ soften: 1.5 });
    for (const s of ['RT.isXRRenderTarget = true', "ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')", 'renderer.xr.isPresenting', 'rt === RT ? null : rt', '!cam.isPerspectiveCamera',
      // (the air's blur starts no nearer than the reach, or its own share of the visibility without a cone)
      'Math.max(FP.air.from, window.__mojCone ? window.__mojCone.reach : 0)']) expect(framePassScript({ air: air(), soften: 1.5 })).toContain(s);
    expect(src).toContain('window.__mojCone ? window.__mojCone.reach : FP.reach');
  });

  it('reads the crust\'s soften off the cone: true for the grain, a number of css pixels, refused out of range', () => {
    expect(readCone({ soften: true })).toEqual({ reach: null, soften: VIEW_CONE.soften });
    expect(readCone({ reach: 40, soften: 2 })).toEqual({ reach: 40, soften: 2 });
    expect(readCone({ reach: 40 })).toEqual({ reach: 40 });
    expect(readCone(40)).toEqual({ reach: 40 });
    expect(() => readCone({ soften: 9 })).toThrow(/soften/);
    expect(() => readCone({ blur: 1 })).toThrow(/cone.blur is not a setting/);
  });

  it('is on the page right after the scene is made when asked, and a page that asks for nothing gains not a byte', () => {
    const page = emitThreeWorld({ faces: [face], soften: 1.5 });
    expect(page.indexOf('the frame pass: the far softened past the crust')).toBeGreaterThan(page.indexOf('const scene = new THREE.Scene();'));
    expect(emitThreeWorld({ faces: [face] })).toBe(emitThreeWorld({ faces: [face], soften: null }));
  });
});
