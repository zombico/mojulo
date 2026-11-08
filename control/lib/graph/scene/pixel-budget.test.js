import { describe, it, expect } from 'vitest';
import { emitThreeWorld } from './scene-three.js';

// THE PIXEL BUDGET: a page played live (controllable entities) caps the screen's density at 1.5 and holds it to the frame's
// time; a page with none, a capture (its frame is its size) and the pixel look (its own density) keep theirs.
const ENT = [{ id: 'hero', body: { type: 'box' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }];
const page = (o = {}) => emitThreeWorld({ faces: [], entities: ENT, ...o });

describe('the pixel budget', () => {
  it('a game page: capped at 1.5, stepped down a quarter on slow frames and back on quick ones', () => {
    const P = page();
    expect(P).toContain('const __dprCap = Math.min(window.devicePixelRatio || 1, 1.5);');
    expect(P).toContain('__budget(t);');
    expect(P).not.toContain('renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));');
    // (and the page's module still parses)
    const mod = P.slice(P.indexOf('<script type="module">') + 22, P.lastIndexOf('</script>'));
    expect(() => new Function(mod.replace(/^\s*import [^;]+;/gm, '').replace(/await /g, ''))).not.toThrow();
  });

  it('not on a still page, a capture or the pixel look', () => {
    const still = emitThreeWorld({ faces: [] });
    for (const P of [still, page({ capture: true }), page({ pixel: { scale: 3 } })]) expect(P).not.toContain('__budget');
    expect(still).toContain('renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));');
  });
});
