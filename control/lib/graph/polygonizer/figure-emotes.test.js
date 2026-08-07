// figure-emotes contract: every named emote compiles to the standard phase→dof
// motion, articulates without throwing, and animates through the shared
// motionFn front door (so GIFs / world frames / rig bakes all see it).
import { describe, it, expect } from 'vitest';

import { EMOTES, EMOTE_NAMES, emoteMotion, isEmoteSpec } from './figure-emotes.js';
import { articulate } from './figure-vajra.js';
import { figureIsAnimated, sampleMotionPose } from './figure-render.js';

describe('figure-emotes', () => {
  it('every emote resolves to a phase→dof that articulates', () => {
    for (const name of EMOTE_NAMES) {
      const move = emoteMotion(name, { frames: 12 });
      for (const u of [0, 0.25, 0.5, 0.75]) {
        const dof = move(u);
        expect(dof && typeof dof === 'object').toBe(true);
        expect(() => articulate(dof)).not.toThrow();
      }
    }
  });

  it('emote specs route through the shared motion front door', () => {
    expect(EMOTE_NAMES.length).toBeGreaterThanOrEqual(8);
    for (const name of EMOTE_NAMES) {
      expect(isEmoteSpec(name)).toBe(true);
      expect(figureIsAnimated({ kind: 'figure', motion: name })).toBe(true);
    }
    expect(isEmoteSpec({ emote: 'bow' })).toBe(true);
    expect(isEmoteSpec('walk')).toBe(false);
    expect(sampleMotionPose('bow', 0.4, 12)).toBeTruthy();
  });

  it('intensity exaggerates the pose away from neutral', () => {
    // mid-bow hinge should scale with the intensity push (perform bake included).
    const soft = emoteMotion({ emote: 'bow' }, { frames: 12 })(0.4);
    const hard = emoteMotion({ emote: 'bow', intensity: 1.5 }, { frames: 12 })(0.4);
    expect(Math.abs(hard.hinge)).toBeGreaterThan(Math.abs(soft.hinge));
  });

  it('rejects unknown emotes', () => {
    expect(() => emoteMotion('moonwalk')).toThrow(/unknown emote/);
    expect(EMOTES.moonwalk).toBeUndefined();
  });
});
