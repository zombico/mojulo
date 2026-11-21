import { describe, it, expect } from 'vitest';
import { subjectBounds, subjectShot, plateSize, plateCacheKey, bakeFrontStage, LIVE_TREATMENTS } from './front-plates.js';
import { FRONT_CARDS, FRONT_CARD_IDS } from '../playscape/ui/front-cards/loader.js';

// THE START SCREEN'S PICTURES, FRAMED: the subject's own faces (never its studio floor), a camera turned off its front by
// the slot's view and drawn back as far as its crop needs. The capture itself needs a browser and is seen on an export;
// what is decided before it is tested here.
const card = FRONT_CARDS[FRONT_CARD_IDS[0]];
const quad = (z0, z1, more = {}) => ({ corners: [[-0.2, 0, z0], [0.2, 0, z0], [0.2, 0, z1], [-0.2, 0, z1]], ...more });
const figure = { faces: [quad(0, 1.8), quad(-0.1, -0.1, { studio: true, corners: [[-10, -10, -0.1], [10, -10, -0.1], [10, 10, -0.1], [-10, 10, -0.1]] })] };

describe('framing a subject', () => {
  it('its bounds are its own faces, the studio left out', () => {
    expect(subjectBounds(figure)).toEqual({ min: [-0.2, 0, 0], max: [0.2, 0, 1.8] });
    expect(subjectBounds({ faces: [figure.faces[1]] })).toBeNull();
  });

  it('a front view looks at its front from +y; a turned view turns round it', () => {
    const b = subjectBounds(figure);
    const front = subjectShot(b, { view: 'front', crop: 'full' });
    expect(front.pos[0]).toBeCloseTo(0, 6);
    expect(front.pos[1]).toBeGreaterThan(0);
    const side = subjectShot(b, { view: 'profile', crop: 'full' });
    expect(side.pos[1]).toBeCloseTo(0, 6);
    expect(Math.hypot(side.pos[0], side.pos[1])).toBeCloseTo(Math.hypot(front.pos[0], front.pos[1]), 6);
  });

  it('a tighter crop comes nearer and looks higher', () => {
    const b = subjectBounds(figure);
    const full = subjectShot(b, { view: 'front', crop: 'full' }), bust = subjectShot(b, { view: 'front', crop: 'bust' });
    expect(bust.pos[1]).toBeLessThan(full.pos[1]);
    expect(bust.target[2]).toBeGreaterThan(full.target[2]);
  });

  it('a plate is captured at its box\'s shape, and kept by what made it', () => {
    const { width, height } = plateSize(card, 0, { height: 900 });
    const [, , w, h] = card.frames.wide.subjects[0];
    expect(width / height).toBeCloseTo((w * 16) / (h * 9), 2);
    const s = { ref: 'a', manifest: { kind: 'layered', n: 1 } };
    expect(plateCacheKey(s, card, 0)).toBe(plateCacheKey({ ...s }, card, 0));
    expect(plateCacheKey(s, card, 0)).not.toBe(plateCacheKey({ ...s, manifest: { kind: 'layered', n: 2 } }, card, 0));
  });
});

describe('a stage\'s plates', () => {
  it('a slot with no subject, or a subject with no sketch, is not pictured, and is said', async () => {
    const none = await bakeFrontStage({ composition: card.id }, { getSketch: () => null });
    expect(none.plates).toEqual(card.slots.map(() => null));
    expect(none.says[0]).toMatch(/has no subject/);
    const missing = await bakeFrontStage({ composition: card.id, subjects: ['gone'] }, { getSketch: () => null });
    expect(missing.says[0]).toMatch(/no sketch 'gone'/);
    expect((await bakeFrontStage({ composition: 'nope' }, { getSketch: () => null })).says[0]).toMatch(/no front card/);
  });
  it('a 3d stage in a treatment the live stage cannot draw says its pictures stay still', async () => {
    const other = ['duotone', 'halftone', 'ink', 'posterize'].find((t) => !LIVE_TREATMENTS.includes(t));
    const r = await bakeFrontStage({ composition: card.id, mode: '3d', treatment: other }, { getSketch: () => null });
    expect(r.says[0]).toMatch(new RegExp(`the ${other} pictures stay still`));
    expect((await bakeFrontStage({ composition: card.id, mode: '3d' }, { getSketch: () => null })).says.join(' ')).not.toMatch(/stay still/);
  });
});
