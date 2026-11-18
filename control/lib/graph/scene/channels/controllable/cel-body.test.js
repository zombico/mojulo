// The cel body on the page (world-scene.js heroFigure `cel`, index.js): a figure whose parts carry their shade tones
// (`colS`) is drawn part by part (never merged) in the toon step, keyed by the side strip's key; a page whose figures
// carry none of it keeps every byte (no toon code). The concepts: emitted only for a cel figure; a cel figure is never
// merged; the step's key is the land's.
import { describe, it, expect } from 'vitest';
import { controllableChannelScript, CEL_BODY } from './index.js';
import { mergeableFigure } from './merged-figure.js';
import { SIDE } from '../../../era/geocube-side.js';
import { b64 } from '../../emit-util.js';

const u8 = (n) => b64(new Uint8Array(n).fill(128)), f32 = (n) => b64(new Float32Array(n));
const part = (extra = {}) => ({ pos: f32(9), col: u8(9), faces: 1, q: 'x', idx: 'x', ...extra });
const fig = (toon) => ({ rig: true, bones: [{ id: 'torso', head: [0, 0, 1], tail: [0, 0, 1.4] }], parts: [part(toon ? { colS: u8(9) } : {})], clips: {}, ...(toon ? { toon: true } : {}) });
const hero = { id: 'hero', pilotable: true, rule: { type: 'platform' }, body: { type: 'figure', figure: 'body' }, transform: { pos: [0, 0, 0], heading: 0 } };

describe('the cel body on the page', () => {
  it('a cel figure brings its toon step; a page without one carries none of it', () => {
    expect(controllableChannelScript([hero], null, { body: fig(true) })).toContain('__toonMat');
    expect(controllableChannelScript([hero], null, { body: fig(false) })).not.toContain('__toonMat');
  });
  it('a cel figure is drawn part by part, never merged', () => {
    expect(mergeableFigure(fig(false))).toBe(true);
    expect(mergeableFigure(fig(true))).toBe(false);
  });
  it('its step is keyed by the land\'s key, past the turning half', () => {
    expect(CEL_BODY.key).toEqual(SIDE.key);
    expect(CEL_BODY.step).toBeGreaterThan(0.05);
  });
});
