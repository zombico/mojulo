// The page's emitters past white, for the bloom (hot-faces.js; the sun's disc and a fire's halo beside them): a face
// that says it emits is drawn once more over itself in the frame's headroom, only under a world's finish.
import { describe, it, expect } from 'vitest';
import { collectHotFaces, hotFacesScript, HOT_FACES } from './hot-faces.js';
import { skyDomeScript, SUN_HOT } from './sky-dome.js';
import { emitThreeWorld } from '../scene-three.js';
import { readFinish } from '../page-light.js';

const quad = (extra) => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 1], [0, 0, 1]], fill: '#808080', ...extra });

describe('the hot faces', () => {
  it('are the faces that say they emit: a lit pane by its strength, a fixture by its paint; the rest are none', () => {
    const pane = quad({ emissive: [1, 0.85, 0.55], emissiveStrength: 1.4 }), lamp = quad({ fill: '#ffd890', glow: '0 0 28px 9px rgba(255,216,144,0.8)' });
    const H = collectHotFaces([quad(), pane, lamp, quad({ emissive: [1, 1, 1], emissiveStrength: 0 }), null]);
    expect(H.n).toBe(2);
    // (two triangles a quad, each corner its colour: linear, past its paint by the gain and its strength)
    expect(H.positions).toHaveLength(2 * 6 * 3);
    expect(H.colors[0]).toBeCloseTo(1 * 1.4 * HOT_FACES.gain, 4);
    expect(H.colors[0]).toBeGreaterThan(1);
    // (a strength is held at the most: a face is hot, not a sun)
    const hot = collectHotFaces([quad({ emissive: [1, 1, 1], emissiveStrength: 50 })]);
    expect(hot.colors[0]).toBeCloseTo(HOT_FACES.most * HOT_FACES.gain, 4);
    expect(collectHotFaces([quad()]).n).toBe(0);
    expect(hotFacesScript(collectHotFaces([quad()]))).toBe('');
    expect(JSON.stringify([...collectHotFaces([pane]).colors])).toBe(JSON.stringify([...collectHotFaces([pane]).colors]));
  });

  it('are drawn only under a world\'s finish with its bloom; the sun\'s disc goes past white with them', () => {
    const P = { faces: [quad(), quad({ emissive: [1, 0.85, 0.55], emissiveStrength: 1.4 })], inline: true }, fin = readFinish({ finish: true });
    expect(emitThreeWorld(P)).not.toContain('__mojHot');
    expect(emitThreeWorld({ ...P, finish: fin })).toContain('window.__mojHot = m;');
    expect(emitThreeWorld({ ...P, finish: { ...fin, bloom: null } })).not.toContain('__mojHot');
    expect(emitThreeWorld({ faces: [quad()], inline: true, finish: fin })).not.toContain('__mojHot');
    const sky = { zenith: [60, 110, 200], horizon: [200, 215, 235], center: [0, 0, 0], radius: 100, sun: { u: 0.5, h: 0.6 } };
    expect(skyDomeScript(sky)).not.toContain('setScalar');
    expect(skyDomeScript({ ...sky, hot: true })).toContain(`ssp.material.color.setScalar(${SUN_HOT});`);
  });
});
