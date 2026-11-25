// The scroll stage's space (scroll-stage/space-layers.js): the side map's layers read for space. The concepts: a layer is
// laid only where the camera sees it as it is carried down its track, and wherever the camera stands it sees the layer
// to its frame's edges; every star stands at its layer's depth, square to the camera; each layer back is quieter, and a
// hull hazed toward the void by its depth; the dust in front is dim; the same seed the same sky.
import { describe, it, expect } from 'vitest';
import { scrollCamera, toScreen, layerGrowth } from './frame.js';
import { SPACE_LAYERS, SPACE_LAYER_IDS, SPACE_VOID, layerSpan, layScrollSpace, hazeHulls } from './space-layers.js';

const cam = scrollCamera(10), extent = { u: [0, 3 * cam.screen.along], v: [0, 0] };
const luma = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

describe('the scroll stage\'s space', () => {
  it('a layer\'s span holds the camera\'s whole frame at its depth wherever the track carries it', () => {
    for (const id of SPACE_LAYER_IDS) {
      const d = SPACE_LAYERS[id].depth * cam.dist, g = layerGrowth(cam, d), S = layerSpan(cam, extent, d);
      for (const c of [extent.u[0], extent.u[1]]) {
        expect(c - (g * cam.screen.along) / 2).toBeGreaterThanOrEqual(S.u[0] - 1e-9);
        expect(c + (g * cam.screen.along) / 2).toBeLessThanOrEqual(S.u[1] + 1e-9);
      }
      expect(S.v[1] - S.v[0]).toBeCloseTo(g * cam.screen.across, 9);
    }
  });

  it('every star stands at its layer\'s depth, square to the camera, in either view', () => {
    for (const view of ['side', 'top']) {
      const C = scrollCamera(10, { view }), { faces } = layScrollSpace(C, extent, { layers: ['near', 'dust'] });
      for (const f of faces) {
        const want = SPACE_LAYERS[f.group.split(':')[1]].depth * C.dist;
        for (const p of f.corners) expect(toScreen(view, p)[2]).toBeCloseTo(want, 2);
      }
    }
  });

  it('lays as many as a screen seen at its depth asks, so every layer reads at its grain', () => {
    const { report } = layScrollSpace(cam, extent);
    for (const id of SPACE_LAYER_IDS) {
      const Y = SPACE_LAYERS[id], d = Y.depth * cam.dist, g = layerGrowth(cam, d), S = layerSpan(cam, extent, d);
      const seen = ((S.u[1] - S.u[0]) * (S.v[1] - S.v[0])) / (g * g * cam.screen.along * cam.screen.across);
      expect(report[id]).toBe(Math.round(Y.per * seen));
    }
  });

  it('each star layer back is quieter, and the dust in front dimmer than any', () => {
    const { faces } = layScrollSpace(cam, extent), by = (id) => mean(faces.filter((f) => f.group === `space:${id}`).map((f) => luma(f.fill)));
    const stars = SPACE_LAYER_IDS.filter((id) => SPACE_LAYERS[id].depth < 0).sort((a, b) => SPACE_LAYERS[b].depth - SPACE_LAYERS[a].depth);
    for (let k = 1; k < stars.length; k++) expect(by(stars[k])).toBeLessThan(by(stars[k - 1]));
    expect(by('dust')).toBeLessThan(by(stars.at(-1)));
  });

  it('a hull is hazed toward the void by its depth', () => {
    const f = [{ corners: [], fill: '#a0a4ac' }], near = hazeHulls(f, cam, -cam.dist)[0].fill, far = hazeHulls(f, cam, -6 * cam.dist)[0].fill;
    expect(luma(near)).toBeLessThan(luma('#a0a4ac'));
    expect(luma(far)).toBeLessThan(luma(near));
    expect(luma(far)).toBeGreaterThan(luma(SPACE_VOID));
  });

  it('the same seed the same sky; another seed another', () => {
    const a = layScrollSpace(cam, extent, { seed: 3, layers: ['mid'] }), b = layScrollSpace(cam, extent, { seed: 3, layers: ['mid'] }), c = layScrollSpace(cam, extent, { seed: 4, layers: ['mid'] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(c.faces)).not.toBe(JSON.stringify(a.faces));
    expect(() => layScrollSpace(cam, extent, { layers: ['nebula'] })).toThrow(/space layer/);
  });
});
