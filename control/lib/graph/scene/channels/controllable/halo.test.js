// THE HALO ON A PAGE (style.js's transformation, channels/controllable/index.js): a hero that carries a Halo Meter hears
// the transform press and is seen transformed (a ring of light over its head); a page without one carries neither.
import { describe, it, expect } from 'vitest';
import { controllableChannelScript } from './index.js';

const HERO = [{ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 6 }, transform: { pos: [0, 0, 0] }, body: { type: 'box', size: [0.6, 0.6, 1.8] } }];
describe('the halo on a page', () => {
  it('hears the transform press and draws the halo only where the meter carries one', () => {
    const halo = controllableChannelScript(HERO, null, {}, { styleMeter: { halo: {} } });
    const meter = controllableChannelScript(HERO, null, {}, { styleMeter: {} });
    expect(halo).toContain("const tf = __k('transform')");
    expect(halo).toContain('THE HALO (style.js)');
    expect(halo).toContain('transform,                       // transform (B)');
    expect(halo).toContain('function __haloMat(m, fig)');
    expect(halo).toContain('__haloWing(1)');
    for (const no of ["__k('transform')", 'THE HALO', '__prevTransform', '__haloMat', '__haloWing']) expect(meter).not.toContain(no);
    expect(() => new Function(halo)).not.toThrow();   // (it parses: the page's own script, whole)
  });
});
