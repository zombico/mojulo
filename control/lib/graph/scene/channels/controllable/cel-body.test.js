// The cel body on the page (world-scene.js heroFigure `cel`, index.js): a figure whose parts carry their shade tones
// (`colS`) is drawn part by part (never merged) in the toon step, keyed by the side strip's key; a page whose figures
// carry none of it keeps every byte (no toon code). The concepts: emitted only for a cel figure; a cel figure is never
// merged; the step's key is the land's. On a side map's page a body turns its head toward the screen (more standing
// than moving), and on no other page; each cel body keyed by its zone's nearest lamp (the camera's zones carry them), and
// the shot light takes a cel body as a hard rim (its edge turned toward the shot); charging, a cel body is lit up by its
// charge (its silhouette's band most, flickering faster past a level); a dial inking the bodies alone (`only: 'bodies'`) leaves the world's faces unlined.
import { describe, it, expect } from 'vitest';
import { controllableChannelScript, CEL_BODY, FACE_SCREEN, CEL_CHARGE } from './index.js';
import { emitThreeWorld } from '../../scene-three.js';
import { shotLightScript, SHOT_LIGHT_CEL } from './shot-light-view.js';
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
  it('on a side map, a body turns its head toward the screen, more standing than moving; on no other page', () => {
    const sideMap = { rule: 'side-map', target: 'hero', screen: [24, 13.5], dist: 18, zones: [{ rect: [-20, 20, -2, 10], lock: 'z', checkpoint: [0, 0] }] };
    expect(controllableChannelScript([hero], sideMap, { body: fig(true) })).toContain('turns its head toward the screen');
    expect(controllableChannelScript([hero], { rule: 'side', target: 'hero' }, { body: fig(true) })).not.toContain('turns its head toward the screen');
    expect(FACE_SCREEN.rest).toBeGreaterThan(FACE_SCREEN.moving);
  });
  it('the bodies\' ink alone leaves the world\'s faces unlined', () => {
    const floor = { corners: [[-2, -2, 0], [2, -2, 0], [2, 2, 0], [-2, 2, 0]], normal: [0, 0, 1], fill: '#556677', group: 'floor' };
    const all = emitThreeWorld({ faces: [floor], toon: { ink: {} }, inline: true }), bodies = emitThreeWorld({ faces: [floor], toon: { ink: { only: 'bodies' } }, inline: true });
    expect(all).toMatch(/"ink":\{/);
    expect(bodies).not.toMatch(/"ink":\{/);
  });
  it('on a side map a cel body is keyed by its zone\'s lamps, and the shot takes it as a hard rim', () => {
    const sideMap = { rule: 'side-map', target: 'hero', screen: [24, 13.5], dist: 18, zones: [{ rect: [-20, 20, -2, 10], lock: 'z', checkpoint: [0, 0], lamps: [[-2.6, 3, 4]] }] };
    const page = controllableChannelScript([hero], sideMap, { body: fig(true) });
    expect(page).toContain('__toonKeyOf');
    expect(page).toContain('[[-2.6,3,4]]');
    const shot = shotLightScript();
    expect(shot).toContain('slCel');
    expect(SHOT_LIGHT_CEL.cap).toBeGreaterThan(0.09);
  });
  it('charging, a cel body is lit up by its charge: its silhouette most, flickering faster once a level is reached', () => {
    const page = controllableChannelScript([hero], null, { body: fig(true) });
    expect(page).toContain('uToonCharge');
    expect(CEL_CHARGE.rim).toBeGreaterThan(CEL_CHARGE.body);
    expect(CEL_CHARGE.rate[1]).toBeGreaterThan(CEL_CHARGE.rate[0]);
    expect(controllableChannelScript([hero], null, { body: fig(false) })).not.toContain('uToonCharge');
  });
});
