import { describe, expect, it } from 'vitest';

import { strokePathSvg, residualRectsSvg, strokeOverlaySvg, overlayWireSvg } from './stroke-overlay-svg.js';

const stroke = { id: 's1', intent: 'silhouette', view: 'frontal', points: [[0.25, 0.25, 1], [0.75, 0.25, 1], [0.75, 0.75, 1], [0.25, 0.75, 1]] };

describe('stroke-overlay-svg — the stroke and its residual over the wire', () => {
  it('draws the stroke in the view square, closed for a silhouette, its width from pressure', () => {
    const p = strokePathSvg(stroke, 900);
    expect(p).toContain('id="stroke-s1"'); expect(p).toContain('M225.0,225.0 L675.0,225.0'); expect(p).toMatch(/ Z"/); expect(p).toContain('stroke-width="5.00"');
    const light = strokePathSvg({ ...stroke, intent: 'contour', closed: false, points: stroke.points.map(([x, y]) => [x, y, 0]) }, 900);
    expect(light).not.toMatch(/ Z"/); expect(light).toContain('stroke-width="1.50"');
  });
  it('a residual mask becomes one rect per scanline run; an empty mask draws nothing', () => {
    const res = 4; const mask = new Uint8Array([0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1]);
    const g = residualRectsSvg(mask, res, 400);
    expect((g.match(/<rect /g) || []).length).toBe(4); expect(g).toContain('x="100.0" y="0.0" width="200.0" height="100.0"'); expect(g).toContain('x="0.0" y="300.0" width="400.0"');
    expect(residualRectsSvg(new Uint8Array(16), 4, 400)).toBe('');
  });
  it('the overlay carries the numbers as data attributes and splices before the closing tag', () => {
    const residual = { iou: 0.81, share: 0.12, bbox: [0.2, 0.2, 0.5, 0.6], res: 2, mask: new Uint8Array([1, 0, 0, 0]) };
    const overlay = strokeOverlaySvg(stroke, 200, { residual });
    expect(overlay).toContain('data-iou="0.81"'); expect(overlay).toContain('data-residual-share="0.12"'); expect(overlay).toContain('data-residual-bbox="0.2 0.2 0.5 0.6"');
    expect(overlay.indexOf('id="residual"')).toBeLessThan(overlay.indexOf('id="stroke-s1"'));   // the band sits under the line
    const svg = overlayWireSvg('<svg viewBox="0 0 200 200"><rect/></svg>', overlay);
    expect(svg.endsWith('</g></svg>')).toBe(true); expect(() => overlayWireSvg('<div/>', overlay)).toThrow(/not an svg/);
    expect(strokeOverlaySvg(stroke, 200)).not.toContain('data-iou');
  });
  it('hit marks: a filled dot per hit, a hollow one per miss, mirrored twins dashed', () => {
    const resolved = [{ x: 0.1, y: 0.1, hit: { part: 'body' } }, { x: 0.2, y: 0.2, hit: null }];
    const g = strokeOverlaySvg({ ...stroke, intent: 'contour' }, 100, { resolved, mirrored: [[0.9, 0.1], [0.8, 0.2]] });
    expect(g).toContain('id="stroke-hits"'); expect((g.match(/<circle /g) || []).length).toBe(4);
    expect(g).toContain('cx="10.0" cy="10.0" r="3.2" fill="#c8401f"'); expect(g).toContain('cx="20.0" cy="20.0" r="3.2" fill="none"'); expect(g).toContain('stroke-dasharray="4 4"');
  });
});
