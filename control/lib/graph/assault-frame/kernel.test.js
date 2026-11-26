import { describe, it, expect } from 'vitest';
import { buildFrameKernel, frameKernelSource } from './kernel.js';
import { frameFigure } from './figure.js';
import { frameEntity, frameMounts } from './pilot.js';
import { STOCK } from './parts.js';

// THE FRAME KERNEL (kernel.js): the frame's modules as one page-runnable source. One case: a build that is no stock
// frame's, its figure and its entity from the kernel the modules' own, byte for byte (the tripwire for a module that
// comes to need something the kernel does not carry).
const build = { from: Object.keys(STOCK)[0], head: 'hd-lancet', core: 'cr-raptor', legs: 'lg-heavy', armL: 'bl-shear', backL: null };

describe('the frame kernel', () => {
  it('is one source the page can run, with no module syntax left in it', () => {
    const src = frameKernelSource();
    expect(src).not.toMatch(/^\s*(import|export)\b/m);
    expect(() => new Function(`return ${src};`)()).not.toThrow();
  });

  it('builds a chosen frame as the modules do: its figure (in the world\'s light handed to it) and its entity', () => {
    const K = buildFrameKernel();
    const server = frameFigure({ build, palette: 'federation' }, { setting: { sky: { preset: 'dusk' } } });
    const page = K.frameFigure({ build, palette: 'federation' }, server.form);
    expect(JSON.stringify(page)).toBe(JSON.stringify(server));
    const opts = { id: 'player', at: [1, 2, 3], heading: 1.2, pilot: true, figure: 'frame-garage', mounts: frameMounts(build) };
    expect(JSON.stringify(K.frameEntity(build, { ...opts, mounts: K.frameMounts(build) }))).toBe(JSON.stringify(frameEntity(build, opts)));
    expect(K.assembleFrame(build).laws.length).toBeGreaterThan(0);
  });
});
