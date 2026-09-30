import { describe, it, expect } from 'vitest';
import { planSolidTurntable, renderSolidTurntableToHtml, assembleSolidTurntableScene, SOLID_SHAPES, SOLID_SURFACES } from './solid-turntable.js';
import { CRYSTAL_GEMS } from '../polygonizer/crystal-optics.js';

describe('the turntable crystal shape', () => {
  it('is a shape and a surface', () => { expect(SOLID_SHAPES).toContain('crystal'); expect(SOLID_SURFACES).toContain('crystal'); });
  it.each(CRYSTAL_GEMS)('%s: an exact polytope at circumradius 1, its surface the crystal response', (gem) => {
    const p = planSolidTurntable({ shape: 'crystal', gem });
    expect(p.surface).toBe('crystal'); expect(p.crystal.gem).toBe(gem); expect(p.faces.length).toBeGreaterThan(4);
    const r = Math.max(...p.faces.flatMap((f) => f.corners.map((c) => Math.hypot(...c)))); expect(r).toBeCloseTo(1, 9);
  });
  it('defaults an unknown gem or cut the way the turntable defaults an unknown shape', () => {
    const p = planSolidTurntable({ shape: 'crystal', gem: 'jade', cut: 'emerald' }); expect(p.crystal.gem).toBe('quartz'); expect(p.crystal.cut).toBe('natural');
    expect(planSolidTurntable({ shape: 'crystal', gem: 'diamond', cut: 'brilliant' }).faces).toHaveLength(121);
  });
  it('the page carries both kernels and draws on one canvas; other shapes stay the CSS page', () => {
    const html = renderSolidTurntableToHtml({ shape: 'crystal', gem: 'ruby' });
    expect(html).toContain('function shineKernel()'); expect(html).toContain('function printKernel()'); expect(html).toContain('<canvas id="stage">');
    expect(html).not.toContain('preserve-3d');
    const plain = renderSolidTurntableToHtml({ shape: 'dodecahedron' }); expect(plain).toContain('preserve-3d'); expect(plain).not.toContain('shineKernel');
  });
  it('the World form tags crystal faces, bakes their first frame and lays a floor for the print; other shapes carry no tag', () => {
    const w = assembleSolidTurntableScene({ shape: 'crystal', gem: 'sapphire', cut: 'brilliant', glow: 0.4 }); const stone = w.faces.filter((f) => f.group !== 'floor');
    expect(stone.every((f) => f.crystal?.gem === 'sapphire' && f.crystal.glow === 0.4)).toBe(true); expect(new Set(stone.map((f) => f.fill)).size).toBeGreaterThan(5);
    expect(w.faces.some((f) => f.group === 'floor')).toBe(true);
    expect(assembleSolidTurntableScene({ shape: 'cube' }).faces.some((f) => 'crystal' in f)).toBe(false);
  });
  it('is deterministic', () => { expect(renderSolidTurntableToHtml({ shape: 'crystal', gem: 'opal' })).toBe(renderSolidTurntableToHtml({ shape: 'crystal', gem: 'opal' })); });
  it('a crystal surface on another shape renders as vexar, byte for byte, as it did before it was a surface', () => {
    for (const shape of ['cube', 'sphere', 'octahedron']) {
      expect(planSolidTurntable({ shape, surface: 'crystal' }).surface).toBe('vexar');
      expect(renderSolidTurntableToHtml({ shape, surface: 'crystal' })).toBe(renderSolidTurntableToHtml({ shape }));
      expect(JSON.stringify(assembleSolidTurntableScene({ shape, surface: 'crystal' }))).toBe(JSON.stringify(assembleSolidTurntableScene({ shape })));
    }
  });
  it('escapes the title into the page', () => {
    const title = '</title><script>alert(1)</script>';
    for (const shape of ['cube', 'crystal']) {
      const html = renderSolidTurntableToHtml({ shape, title });
      expect(html).not.toContain('<script>alert(1)'); expect(html).toContain('<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>');
    }
  });
});
