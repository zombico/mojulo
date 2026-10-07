import { describe, it, expect } from 'vitest';
import { readTone, TONE_IDS, greyTwin, decodePng, drainFaces, rampAt } from './tone.js';
import { assembleStageScene, STAGE_PAGE_BUDGET } from './stage.js';
import { starter } from './entries.js';
import { surfaceTexture, collectFaceTextures } from '../landscape/surface-textures.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { toneScript } from '../scene/channels/tone.js';
import { extractEngineScore } from '../scene/engine-score.js';

// colour as its own concern: the tiles carry value, the tone says what colours those values become (era/tone.js)
const M = { ...starter('gothic-stone'), reference: 'gothic-night', art: { seed: 7 } };
const page = (p) => emitThreeWorld({ ...p, textures: collectFaceTextures(p.faces), inline: true });

describe('tone', () => {
  it('reads a preset, a preset with fields over it, or a whole direction; and says what is wrong', () => {
    for (const id of TONE_IDS) expect(readTone(id).ramps).toBeTruthy();
    expect(readTone({ preset: 'noir', steps: 2 }).steps).toBe(2);
    expect(readTone({ texture: 'shade', steps: 0, key: 0.5, gain: 1, default: 'a', ramps: { a: ['#000000', '#333333', '#666666', '#999999', '#ffffff'] } }).detail).toBe(0.45);
    expect(() => readTone('sepia')).toThrow(/tone is one of/);
    expect(() => readTone({ preset: 'noir', steps: 9 })).toThrow(/steps/);
    expect(() => readTone({ preset: 'noir', ramps: { night: ['#000000'] } })).toThrow(/five/);
    expect(() => readTone({ preset: 'flat', groups: { 'stage:wall': 'nope' } })).toThrow(/nope/);
  });

  it('a tile\'s value twin is a greyscale PNG a third the size; its shade twin keeps the joints dark and the faces near white', () => {
    const src = surfaceTexture('flagstone-a'), v = surfaceTexture('value:flagstone-a'), s = decodePng(surfaceTexture('shade:flagstone-a'));
    expect(v.length).toBeLessThan(src.length * 0.6);
    const d = decodePng(v);
    for (let i = 0; i < d.W * d.H; i += 97) expect(d.px[i * 4]).toBe(d.px[i * 4 + 2]);
    const g = []; for (let i = 0; i < s.W * s.H; i++) g.push(s.px[i * 4]);
    g.sort((a, b) => a - b);
    expect(g[Math.floor(g.length * 0.7)]).toBeGreaterThan(225);
    expect(g[Math.floor(g.length * 0.03)]).toBeLessThan(150);
    expect(greyTwin('not a png', 'value')).toBe(null);
  });

  it('drains the colour before the bake: grey tints, value tiles; a kept surface and a blend\'s floor', () => {
    const T = readTone('noir');
    const [a, b, c] = drainFaces([{ group: 'stage:wall', tint: [0.6, 0.3, 0.2], texture: 'flagstone-a' }, { group: 'stage:fixture', tint: [1, 0.5, 0] }, { group: 'stage:moss', tint: [0.02, 0.05, 0.02], alpha: 0.5 }], T);
    expect(a.tint[0]).toBe(a.tint[2]);
    expect(a.texture).toBe('value:flagstone-a');
    expect(b.tint).toEqual([1, 0.5, 0]);
    expect(c.tint[0]).toBeGreaterThan(0.2);
    expect(rampAt(T.ramps.night, 0)).toEqual(rampAt(T.ramps.night, -1));
  });

  it('a toned stage ships greys, its tone as page data under the budget; absent, not a byte of it', () => {
    const plain = assembleStageScene(M), toned = assembleStageScene({ ...M, tone: 'flat' });
    expect(plain.tone).toBe(undefined);
    expect(page(plain)).not.toContain('toneRamp');
    const keep = new Set(toned.tone.keep);
    for (const f of toned.faces) if (typeof f.texture === 'string' && !keep.has(f.group)) expect(f.texture.startsWith('shade:')).toBe(true);
    expect(toned.tone.gain).toBeGreaterThan(0.3);
    expect(toned.tone.ramps.length).toBe(4);
    const html = page(toned);
    expect(html).toContain('toneRamp');
    expect(html.length).toBeLessThan(Math.min(STAGE_PAGE_BUDGET, page(plain).length));
    const score = extractEngineScore({ ref: 'sk_t', manifest: { ...M, tone: 'flat' } }, toned);
    expect(score.tone.steps).toBe(4);
    expect(score.ledger.tone_graded_on_page.count).toBe(4);
  }, 120000);

  it('the page script parses and patches only group meshes outside `keep`', () => {
    const cfg = { steps: 3, gain: 1, mid: 0.5, detail: 0.4, ramps: [[[0, 0, 0], [0.2, 0.2, 0.2], [0.4, 0.4, 0.4], [0.7, 0.7, 0.7], [1, 1, 1]]], def: 0, groups: {}, keep: ['stage:fixture'] };
    const meshes = [{ isMesh: true, userData: { g: 'stage:wall' }, material: {} }, { isMesh: true, userData: { g: 'stage:fixture' }, material: {} }, { isMesh: true, userData: {}, material: {} }];
    const THREE = { Vector3: class { constructor(...a) { this.v = a; } }, SRGBColorSpace: 'srgb' };
    new Function('THREE', 'scene', toneScript(cfg))(THREE, { traverse: (fn) => meshes.forEach(fn), background: null, fog: null });
    expect(typeof meshes[0].material.onBeforeCompile).toBe('function');
    expect(meshes[1].material.onBeforeCompile).toBe(undefined);
    expect(meshes[2].material.onBeforeCompile).toBe(undefined);
    const sh = { uniforms: {}, fragmentShader: 'void main() {\n#include <fog_fragment>\n}' };
    meshes[0].material.onBeforeCompile(sh);
    expect(sh.fragmentShader).toContain('gl_FragColor.rgb = toneRamp(toneT);');
    expect(sh.uniforms.uSteps.value).toBe(3);
  });
});
