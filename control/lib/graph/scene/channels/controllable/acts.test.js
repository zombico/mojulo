// The battle acts in the renderer (controllable/index.js, `acts`: a page that plays party battles): the figure plays its
// own clip for the act its e.act names, at the act's phase on the world's clock. Emitted only where battles are, so a
// page without them carries none of it.
import { describe, expect, it } from 'vitest';
import { controllableChannelScript } from './index.js';

const ents = [{ id: 'h', pilotable: true, rule: { type: 'walk' }, body: { type: 'figure-rig', figure: 'h' }, transform: { pos: [0, 0, 0], heading: 0 } }];
const figure = { rig: true, clips: {} };

describe('a battle\'s acts on the figures', () => {
  it('are emitted with acts, and add nothing without', () => {
    const plain = controllableChannelScript(ents, null, { h: figure }), acted = controllableChannelScript(ents, null, { h: figure }, { acts: true });
    expect(plain).not.toContain('__actClip');
    expect(plain).toBe(controllableChannelScript(ents, null, { h: figure }, { acts: false }));
    expect(acted).toContain('__actClip');
    expect(acted).toMatch(/swing_neutral/);
    // (the act's phase drives the clip mix, in place of the gait's)
    expect(acted).toMatch(/advanceGaitMix\(rig\.mix, mode, phase,/);
    expect(plain).toMatch(/advanceGaitMix\(rig\.mix, mode, e\.gaitPhase,/);
  });
});
