import { describe, expect, it } from 'vitest';

import { strokeOverlayChannelScript, residualRuns } from './stroke-overlay.js';
import { emitThreeWorld } from '../scene-three.js';

const spec = {
  ref: 'lay-1', dz: 0.25, framing: { target: [0, 0.5, 0.5], distance: 3.9, focalPixels: 1400, size: 900 },
  views: { frontal: 180, 'three-quarter': 150, lateral: 90 },
  strokes: [{ id: 's1', view: 'frontal', intent: 'silhouette', closed: true, points: [[0.2, 0.2, 0.5], [0.8, 0.2, 0.5], [0.5, 0.8, 0.5]], camera: { azimuth: 180, elevation: 10, target: [0, 0.5, 0.5], distance: 3.9, focalPixels: 1400, size: 900 }, solved: { iou: 0.7 } }],
  residuals: { s1: { res: 4, runs: [[1, 1, 3]], now: { iou: 0.7, share: 0.3, bbox: [0.25, 0.25, 0.75, 0.5] } } },
};
const faces = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], fill: '#888888', group: 'body', outNormal: [0, 0, 1] }];

describe('stroke-overlay channel — drawing on the World page', () => {
  it('residualRuns: scanline runs [j, i0, i1] over a mask', () => {
    expect(residualRuns(new Uint8Array([0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1]), 4)).toEqual([[0, 1, 3], [1, 0, 1], [1, 3, 4], [3, 0, 4]]);
    expect(residualRuns(new Uint8Array(16), 4)).toEqual([]);
  });
  it('the script snaps the camera to the pinhole, takes pointer strokes, hands back a patch, and never writes', () => {
    const js = strokeOverlayChannelScript(spec);
    expect(js).toContain('stroke overlay channel'); expect(js).toContain('window.__mojStroke = stroke'); expect(js).toContain("path: '/strokes/-'");
    expect(js).toContain("op: 'solve'"); expect(js).toContain('controls.enabled = !on'); expect(js).toContain("get('draw')");
    expect(js).toContain('the page writes nothing'); expect(js).not.toMatch(/fetch\(|XMLHttpRequest/);
    expect(js).toContain('"runs":[[1,1,3]]');
  });
  it('emitThreeWorld mounts it only when a layered payload opts in; a page without it is byte-identical', () => {
    const plain = emitThreeWorld({ faces, title: 't' }); const off = emitThreeWorld({ faces, title: 't', strokeOverlay: null }); const on = emitThreeWorld({ faces, title: 't', strokeOverlay: spec });
    expect(off).toBe(plain); expect(on).not.toBe(plain);
    expect(on).toContain('stroke overlay channel'); expect(plain).not.toContain('stroke overlay channel'); expect(on).toContain('"ref":"lay-1"');
  });
});
